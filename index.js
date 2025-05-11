require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');

const twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
const userClient = twitterClient.readOnly;

const keywords = process.env.TWITTER_KEYWORDS.split(',');
const discordWebhook = process.env.DISCORD_WEBHOOK_URL;

let lastTweetId = null;
let pauseUntil = 0; // レート制限による休止中の終了時刻（ms単位）

const checkTweets = async () => {
  const now = Date.now();

  // レート制限による待機中なら処理をスキップ
  if (now < pauseUntil) {
    return;
  }

  try {
    const query = keywords.map(k => k.trim()).join(' OR ');
    const res = await userClient.v2.search(query, {
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
