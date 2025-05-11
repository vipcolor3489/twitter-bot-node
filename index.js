require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');

const twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
const userClient = twitterClient.readOnly;

const keywords = process.env.TWITTER_KEYWORDS.split(',').map(k => k.trim());
const query = keywords.map(k => `"${k}"`).join(' OR ');
const discordWebhook = process.env.DISCORD_WEBHOOK_URL;

let lastTweetId = null;

const checkTweets = async () => {
  try {
    const res = await userClient.v2.search(query, {
      'tweet.fields': 'created_at',
      max_results: 5,
      since_id: lastTweetId,
    });

    if (res.data?.data?.length > 0) {
      const tweets = res.data.data.reverse();
      for (const tweet of tweets) {
        const url = `https://twitter.com/i/web/status/${tweet.id}`;
        await axios.post(discordWebhook, { content: `🔔 ${url}` });
        lastTweetId = tweet.id;
      }
    }
  } catch (err) {
    if (err.code === 429 || err?.data?.title === 'Too Many Requests') {
      const resetTimestamp = err.headers?.get('x-rate-limit-reset');
      const resetTime = resetTimestamp
        ? new Date(Number(resetTimestamp) * 1000).toISOString().slice(11, 16)
        : '不明';

      await axios.post(discordWebhook, {
        content: `⚠️ Twitter APIレート制限中（${resetTime} UTC まで）`,
      });
    } else {
      console.error('❌ Error checking tweets:', err.message);
    }
  }
};

setInterval(checkTweets, 30000);
console.log('✅ Twitter to Discord bot is running...');
