require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');

// Twitter APIクライアントの初期化
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const listId = process.env.LIST_ID;
const iftttWebhookUrl = process.env.IFTTT_WEBHOOK_URL;

// ✅ 条件にしたいキーワード（複数指定可能）
const keywords = ['【要人発言】', '市場概況】', '【経済指標速報】', '【指標】', '【指標発表予定】'];

let lastTweetId = null;

async function fetchAndNotify() {
  try {
    const timeline = await client.v2.listTweets(listId, { max_results: 5 });

    if (!timeline.data || !timeline.data.data) {
      console.log('ツイートが見つかりませんでした');
      return;
    }

    const tweets = timeline.data.data;

    for (const tweet of tweets.reverse()) {
      if (tweet.id !== lastTweetId) {
        const text = tweet.text;

        // ✅ キーワードが含まれるかをチェック（部分一致）
        const match = keywords.some(keyword => text.includes(keyword));

        if (match) {
          console.log(`マッチしたツイート: ${text}`);

          await axios.post(iftttWebhookUrl, {
            value1: text,
            value2: `https://twitter.com/i/web/status/${tweet.id}`
          });

          lastTweetId = tweet.id;
        } else {
          console.log(`条件に合致しないツイート: ${text}`);
        }
      }
    }
  } catch (error) {
    console.error('エラー:', error);
  }
}

setInterval(fetchAndNotify, 10000);
