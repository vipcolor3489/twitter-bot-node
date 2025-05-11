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
  if (now < pauseUntil) {
    // console.log(`🕒 処理休止中... ${new Date(pauseUntil).toLocaleTimeString('ja-JP')} まで`);
    return;
  }
  console.log(`🔍 ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} - ポストのチェックを開始...`);

  try {
    const requestParams = {
      max_results: 5,
      "tweet.fields": "created_at,text", 
      "expansions": "author_id",
      "user.fields": "name,username"
    };

    if (lastTweetId) {
      requestParams.since_id = lastTweetId;
    }

    const res = await twitterClient.v2.listTweets(listId, requestParams);

    const potentialTweetsArray = res.data; // APIからのレスポンスの data プロパティ
    const usersData = res.includes?.users;

    // potentialTweetsArray が配列であり、かつ要素が存在する場合のみ後続の処理を行う
    if (!Array.isArray(potentialTweetsArray) || potentialTweetsArray.length === 0) {
      console.log('📝 新しいポストはありませんでした。');
    } else {
      // この時点で potentialTweetsArray は空ではない配列であることが保証される
      const tweets = potentialTweetsArray; 
      
      const userMap = new Map();
      if (usersData) {
        for (const user of usersData) {
          userMap.set(user.id, user);
        }
      }

      const orderedTweets = tweets.reverse(); // tweets は配列なので .reverse() が安全に使える

      let newTweetsFound = 0;
      for (const tweet of orderedTweets) {
        const textContent = tweet.text || '';
        const isMatch = keywords.some(keyword => textContent.includes(keyword));

        if (isMatch) {
          newTweetsFound++;
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
          console.log(`🔔 Discordへ通知: ${displayName} のポスト`);
        }
        lastTweetId = tweet.id; 
      }

      if (newTweetsFound > 0) {
        console.log(`✨ ${newTweetsFound}件の新しいポストを処理しました。`);
      } else {
        console.log('📝 キーワードに合致する新しいポストはありませんでした。');
      }
    }
    console.log(`✅ ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} - ポストのチェックが正常に完了`);

  } catch (err) {
    if (err.code === 429 || err?.data?.title === 'Too Many Requests') {
      const resetUnix = err.rateLimit?.reset;
      const resetTime = resetUnix
        ? new Date(resetUnix * 1000 + 9 * 60 * 60 * 1000).toISOString().slice(11, 16) + ' JST'
        : '不明';

      try {
        await axios.post(discordWebhook, {
          content: `⚠️ Twitter APIレート制限中です。処理は ${resetTime} まで休止します。`,
        });
      } catch (discordErr) {
        console.error('❌ Discordへのレート制限通知に失敗しました:', discordErr.message);
      }
      
      if (resetUnix) {
        pauseUntil = (resetUnix + 60) * 1000; 
        console.log(`⏸️ 処理を ${(new Date(pauseUntil)).toLocaleTimeString('ja-JP')} まで休止します。`);
      } else {
        pauseUntil = Date.now() + (15 * 60 * 1000);
        console.log(`⏸️ リセット時刻不明のため、処理を15分間休止します。`);
      }
    } else {
      console.error(`❌ ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} - Error checking tweets:`, err.message);
      if (err.stack) { // エラーのスタックトレースを出力
        console.error(err.stack);
      }
      if (err.data) { // APIからのエラーレスポンス詳細
        console.error('Twitter API Error Data:', JSON.stringify(err.data, null, 2));
      }
    }
  }
};

// 定期実行（15分30秒ごと）
const intervalTime = (10 * 60 + 30) * 1000; 
setInterval(checkTweets, intervalTime);

// 起動時にも一度チェックを実行 (任意)
// console.log('🚀 初回ポストチェックを実行...');
// checkTweets();

console.log(`✅ Twitter to Discord bot is running... Interval: ${intervalTime / 1000 / 60} minutes.`);
console.log(`🕒 Current JST time: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);


// Web サーバー起動
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => {
  res.send('Bot is running!');
});
app.listen(PORT, () => {
  console.log(`🌐 Listening on port ${PORT}`);
});