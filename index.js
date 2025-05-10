require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
const express = require('express');

// Twitter APIクライアントの初期化
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// 必要な環境変数を設定
const listId = process.env.LIST_ID;
const iftttWebhookUrl = process.env.IFTTT_WEBHOOK_URL;

// 条件にしたいキーワード（複数指定可能）
const keywords = ['【要人発言】', '市場概況】', '【経済指標速報】', '【指標】', '【指標発表予定】'];

// 最後にチェックしたツイートIDを記録
let lastTweetId = null;

// Expressサーバーの設定（ポート番号指定）
const app = express();
const PORT = process.env.PORT || 3000;  // 環境変数 PORT が指定されていればそれを使用、無ければ 3000 番を使用

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// ツイートのチェックとIFTTT通知の送信
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

        // キーワードが含まれるかをチェック（部分一致）
        const match = keywords.some(keyword => text.includes(keyword));

        if (match) {
          console.log(`マッチしたツイート: ${text}`);

          // IFTTT Webhook で通知
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

// 10秒ごとにツイートをチェック（Twitter APIの制限を避けるため調整）
setInterval(fetchAndNotify, 10000); // 10秒ごとに実行、必要に応じて時間を調整

