const checkTweets = async () => {
  const now = Date.now();

  // レート制限による待機中なら処理をスキップ
  if (now < pauseUntil) {
    return;
  }

  try {
    // リスト内のツイートを取得
    const res = await twitterClient.v2.listTweets(listId, {
      'tweet.fields': 'created_at',
      max_results: 5,
      since_id: lastTweetId,
    });

    // エラーの詳細確認
    if (res.errors) {
      console.error('Twitter API errors:', res.errors);
      return;
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
    console.error('❌ Error checking tweets:', err.response ? err.response.data : err.message);
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
    }
  }
};
