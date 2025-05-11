require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');

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

// Discord投稿テスト用の関数 (最新2件をキーワードフィルタなしで投稿)
async function testPostLatestTwoTweetsToDiscord() {
  // タイムスタンプを追加して、いつ実行されたかわかりやすくする
  const currentTimeForLog = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  console.log(`🔍 [${currentTimeForLog}] Discord投稿テスト (testPostLatestTwoTweetsToDiscord) を開始...`);

  try {
    const requestParams = {
      max_results: 2, // 最新2件を取得
      "tweet.fields": "created_at,text", 
      "expansions": "author_id",
      "user.fields": "name,username"
    };

    const res = await twitterClient.v2.listTweets(listId, requestParams);

    const tweetsToTest = res.data; 
    const usersData = res.includes?.users;

    if (!Array.isArray(tweetsToTest) || tweetsToTest.length === 0) {
      console.log(`📝 [${currentTimeForLog}] APIからテスト用のポストを取得できませんでした。`);
      return;
    }

    console.log(`[${currentTimeForLog}] 取得したポスト数: ${tweetsToTest.length}件。Discordへ投稿します...`);

    const userMap = new Map();
    if (usersData) {
      for (const user of usersData) {
        userMap.set(user.id, user);
      }
    }

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
      console.log(`🔔 [${currentTimeForLog}] Discordへテスト投稿完了: ${displayName} (${userName}) のポスト`);
    }

    console.log(`✅ [${currentTimeForLog}] Discord投稿テスト (testPostLatestTwoTweetsToDiscord) が正常に完了しました。`);

  } catch (err) {
    console.error(`❌ [${currentTimeForLog}] Discord投稿テスト (testPostLatestTwoTweetsToDiscord) 中にエラー:`, err.message);
    if (err.stack) {
      console.error("Stack Trace:", err.stack);
    }
    if (err.isAxiosError && err.response && err.response.data) {
        console.error('Axios Error Data:', JSON.stringify(err.response.data, null, 2));
    } else if (err.data) { 
        console.error('Twitter API Error Data:', JSON.stringify(err.data, null, 2));
    }
  }
}

// --- 定期実行の設定 ---
const intervalTime = (15 * 60 + 30) * 1000; // 15分30秒

console.log(`[テストモード起動] ${intervalTime / 1000 / 60}分ごとに testPostLatestTwoTweetsToDiscord 関数を実行します。`);
console.log(`最初の実行は、約${intervalTime / 1000 / 60}分後です。`);
console.log(`現在の時刻 (JST): ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
console.log('テストを停止するには Ctrl+C を押してください。');

// 15分30秒ごとに testPostLatestTwoTweetsToDiscord 関数を実行
setInterval(testPostLatestTwoTweetsToDiscord, intervalTime);

// もし起動時に「即座に」一度実行したい場合は、以下のコメントを解除してください。
// console.log('[テストモード] 起動時に一度 testPostLatestTwoTweetsToDiscord 関数を即時実行します...');
// testPostLatestTwoTweetsToDiscord();


// --- Render.com 等で安定稼働させるための注意 ---
// このスクリプトはWebサーバーを起動しません。
// もしRender.comのようなホスティング環境で長時間安定して実行させたい場合は、
// 「Background Worker」タイプのサービスとして設定するか、
// または、以前のコードのようにexpressで簡単なWebサーバーを立てることを検討してください。
// Web Serviceタイプでこのスクリプトをそのまま使うと、前回のように再起動ループに入る可能性があります。