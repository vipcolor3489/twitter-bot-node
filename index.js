require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

twitterClient.v2.me() // ユーザー情報を取得
  .then(response => {
    console.log('User info:', response.data);
  })
  .catch(error => {
    console.error('Error:', error);
  });

const keywords = process.env.TWITTER_KEYWORDS.split(',');  // 複数のキーワードを指定
const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
const listId = process.env.TWITTER_LIST_ID;  // リストIDを取得

let lastTweetId = null;
let pauseUntil = 0; // レート制限による休止中の終了時刻（ms単位）

const checkTweets = async () => {
  const now = Date.now();

  // レート制限による待機中なら処理をスキップ
  if (now < pauseUntil) {
    return;
  }

  try {
// リスト内のツイートを取得
try {
  const res = await twitterClient.v2.listTweets(listId, {
    'tweet.fields': 'created_at',
    max_results: 5,
    since_id: lastTweetId,
  });

  if (res.data?.data?.length > 0) {
    const tweets = res.data.data.reverse(); // 古い順に
    for (const tweet of tweets) {
      const url = `https://twitter.com/i/web/status/${tweet.id}`;
      await axios.post(discordWebhook, { content: `🔔 ${url}` });
      lastTweetId = tweet.id;
    }
  }
} catch (err) {
  console.error('Error retrieving list tweets:', err);
}

    // ツイートの存在確認
    if (res.data?.data?.length > 0) {
      const tweets = res.data.data.reverse(); // 古い順に
      // キーワードにマッチするツイートのみをフィルタリング
      const matchedTweets = tweets.filter(tweet =>
        keywords.some(keyword => tweet.text.includes(keyword))
      );

      // マッチしたツイートをDiscordに通知
      for (const tweet of matchedTweets) {
        const url = `https://twitter.com/i/web/status/${tweet.id}`;
        await axios.post(discordWebhook, { content: `🔔 ${url}` });
        lastTweetId = tweet.id; // 最新のツイートIDを更新
      }
    }
  } catch (err) {
    if (err.code === 429 || err?.data?.title === 'Too Many Requests') {
      // レート制限時の対応
      const resetUnix = err.rateLimit?.reset;
      const resetTime = resetUnix
        ? new Date(resetUnix * 1000 + 9 * 60 * 60 * 1000) // JSTに変換
            .toISOString()
            .slice(11, 16) + ' JST'
        : '不明';

      await axios.post(discordWebhook, {
        content: `⚠️ Twitter APIレート制限中（${resetTime}まで）`,
      });

      if (resetUnix) {
        // reset時間（秒）→ミリ秒＋1分余裕
        pauseUntil = (resetUnix + 60) * 1000;
        console.log(`⏸️ 処理を ${(new Date(pauseUntil)).toLocaleTimeString('ja-JP')} まで休止`);
      }
    } else {
      console.error('❌ Error checking tweets:', err.message);
    }
  }
};

setInterval(checkTweets, 30000); // 30秒間隔でチェック
console.log('✅ Twitter to Discord bot is running...');

// ポートリッスン（Render の Web Service に必要）
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is running!');
});

app.listen(PORT, () => {
  console.log(`🌐 Listening on port ${PORT}`);
});
