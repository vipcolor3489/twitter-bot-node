require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
const express = require('express');

// Twitter API 認証情報
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// キーワードと環境変数
const keywords = process.env.TWITTER_KEYWORDS.split(',').map(k => k.trim());
const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
const listId = process.env.TWITTER_LIST_ID;

let lastTweetId = null;
let pauseUntil = 0;

// ツイートをチェックしてDiscordへ通知
const checkTweets = async () => {
  const now = Date.now();
  if (now < pauseUntil) return;

  try {
    const res = await twitterClient.v2.listTweets(listId, {
      max_results: 5,
      since_id: lastTweetId,
    });

    const tweets = res.data?.data;
    if (!tweets || tweets.length === 0) return;

    const orderedTweets = tweets.reverse(); // 古い順に処理

    for (const tweet of orderedTweets) {
      const text = tweet.text || '';
      const isMatch = keywords.some(keyword => text.includes(keyword));
      if (isMatch) {
        const url = `https://twitter.com/i/web/status/${tweet.id}`;
        await axios.post(discordWebhook, { content: `🔔 ${url}` });
        lastTweetId = tweet.id;
      }
    }
  } catch (err) {
    if (err.code === 429 || err?.data?.title === 'Too Many Requests') {
      const resetUnix = err.rateLimit?.reset;
      const resetTime = resetUnix
        ? new Date(resetUnix * 1000 + 9 * 60 * 60 * 1000).toISOString().slice(11, 16) + ' JST'
        : '不明';

      await axios.post(discordWebhook, {
        content: `⚠️ Twitter APIレート制限中（${resetTime}まで）`,
      });

      if (resetUnix) {
        pauseUntil = (resetUnix + 60) * 1000; // 1分余裕をもって休止
        console.log(`⏸️ 処理を ${(new Date(pauseUntil)).toLocaleTimeString('ja-JP')} まで休止`);
      }
    } else {
      console.error('❌ Error checking tweets:', err.message);
    }
  }
};

// 定期実行
setInterval(checkTweets, 30 * 1000);
console.log('✅ Twitter to Discord bot is running...');

// Web サーバー起動（Render対応）
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => {
  res.send('Bot is running!');
});
app.listen(PORT, () => {
  console.log(`🌐 Listening on port ${PORT}`);
});
