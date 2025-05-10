require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
const fs = require('fs');

// Twitter APIクライアントの初期化
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const listId = process.env.LIST_ID;
const iftttWebhookUrl = process.env.IFTTT_WEBHOOK_URL;
const lastIdFile = 'last_id.txt';

// ✅ 条件にしたいキーワード（複数指定可能）
const keywords = ['【要人発言】', '市場概況】', '【経済指標速報】', '【指標】', '【指標発表予定】'];

// 前回のツイートIDを読み込む
function loadLastTweetId() {
  try {
    return fs.readFileSync(lastIdFile, 'utf-8');
  } catch (err) {
    return null;
  }
}

// ツイートIDを保存
function saveLastTweetId(id) {
  fs.writeFileSync(lastIdFile, id, 'utf-8');
}

async function fetchAndNotify() {
  try {
    const lastTweetId = loadLastTweetId();
    const timeline = await client.v2.listTweets(listId, { max_results: 5 });

    if (!timeline.data || !timeline.data.data) {
      console.log('ツイートが見つかりませんでした');
      return;
    }

    const tweets = timeline.data.data;

    for (const tweet of tweets.reverse()) {
      if (tweet.id !== lastTweetId) {
        const text = tweet.text;
        const match = keywords.some(keyword => text.includes(keyword));

        if (match) {
          console.log(`✅ マッチ: ${text}`);

          await axios.post(iftttWebhookUrl, {
            value1: text,
            value2: `https://twitter.com/i/web/status/${tweet.id}`
          });

          saveLastTweetId(tweet.id);
        } else {
          console.log(`✴ 条件外: ${text}`);
        }
      }
    }
  } catch (error) {
    console.error('🚨 エラー:', error?.response?.data || error.message);
  }
}

// ✅ 60秒ごとにチェック
setInterval(fetchAndNotify, 60000);
