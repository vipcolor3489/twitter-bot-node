require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');

const twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
const userClient = twitterClient.readOnly;

const keywords = process.env.TWITTER_KEYWORDS.split(',');
const discordWebhook = process.env.DISCORD_WEBHOOK_URL;

let lastTweetId = null;

const checkTweets = async () => {
  try {
    for (const keyword of keywords) {
      const res = await userClient.v2.search(keyword, {
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
    }
  } catch (err) {
    console.error('❌ Error checking tweets:', err.message);
  }
};

setInterval(checkTweets, 30000); // 30秒間隔でチェック
console.log('✅ Twitter to Discord bot is running...');
