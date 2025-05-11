require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
// const express = require('express'); // テストでは不要

// Twitter API 認証情報
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// Discord Webhook URLとTwitterリストID
const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
const listId = process.env.TWITTER_LIST_ID;

// Discord投稿テスト用の関数
async function testPostLatestTwoTweetsToDiscord() {
  console.log(`🔍 Discord投稿テストを開始 (最新2件を投稿)...`);

  try {
    const requestParams = {
      max_results: 2, // 最新2件を取得
      "tweet.fields": "created_at,text", 
      "expansions": "author_id",
      "user.fields": "name,username"
    };

    // since_id は使用せず、常に最新のツイートを取得
    const res = await twitterClient.v2.listTweets(listId, requestParams);

    const tweetsToTest = res.data; 
    const usersData = res.includes?.users;

    if (!Array.isArray(tweetsToTest) || tweetsToTest.length === 0) {
      console.log('📝 APIからテスト用のポストを取得できませんでした。リストに投稿があるか、またはAPIキー/リストIDが正しいか確認してください。');
      return;
    }

    console.log(`取得したポスト数: ${tweetsToTest.length}件。Discordへ投稿します...`);

    const userMap = new Map();
    if (usersData) {
      for (const user of usersData) {
        userMap.set(user.id, user);
      }
    }

    // APIは通常新しい順で返すので、Discordに古いものから順に表示したい場合は reverse() する
    // (今回は最大2件なので、どちらでも大きな差はないですが、元のコードの挙動に合わせます)
    const orderedTweetsToTest = tweetsToTest.reverse(); 

    for (const tweet of orderedTweetsToTest) {
      const textContent = tweet.text || '';
      
      const author = userMap.get(tweet.author_id);
      const displayName = author ? author.name : '不明なユーザー';
      const userName = author ? `@${author.username}` : '';

      let formattedDate = '不明な日時';
      if (tweet.created_at) {
        const postDate = new Date(tweet.created_at);
        formattedDate = postDate.toLocaleString('ja-JP', {
          timeZone: 'Asia/Tokyo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
      }

      const discordMessage =
`${displayName} (${userName})
${textContent}
投稿日時: ${formattedDate}`;

      await axios.post(discordWebhook, { content: discordMessage });
      console.log(`🔔 Discordへテスト投稿完了: ${displayName} (${userName}) のポスト`);
    }

    console.log(`✅ Discord投稿テストが正常に完了しました。`);

  } catch (err) {
    console.error(`❌ Discord投稿テスト中にエラーが発生しました:`, err.message);
    if (err.stack) {
      console.error("Stack Trace:", err.stack);
    }
    // Twitter APIからのエラーレスポンスか、axiosのエラーレスポンスかを確認して詳細表示
    if (err.isAxiosError && err.response && err.response.data) {
        console.error('Axios Error Data (Discord Webhook関連の可能性):', JSON.stringify(err.response.data, null, 2));
    } else if (err.data) { // twitter-api-v2 のエラーオブジェクト
        console.error('Twitter API Error Data:', JSON.stringify(err.data, null, 2));
    }
  }
}

// テスト関数を実行
testPostLatestTwoTweetsToDiscord();

/*
// -------------------------------------------------------------------------
// 以下は元の定期実行用のコードの名残です。このテストスクリプトでは使用しません。
// -------------------------------------------------------------------------

// let lastTweetId = null;
// let pauseUntil = 0;

// const keywords = process.env.TWITTER_KEYWORDS.split(',').map(k => k.trim());


// 定期実行（15分30秒ごと）
// const intervalTime = (15 * 60 + 30) * 1000; 
// setInterval(checkTweets, intervalTime); // checkTweets関数は元のコードを参照

// console.log(`✅ Twitter to Discord bot is running... Interval: ${intervalTime / 1000 / 60} minutes.`);
// console.log(`🕒 Current JST time: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);


// Web サーバー起動
// const app = express();
// const PORT = process.env.PORT || 3000;
// app.get('/', (req, res) => {
//   res.send('Bot is running!');
// });
// app.listen(PORT, () => {
//   console.log(`🌐 Listening on port ${PORT}`);
// });
*/