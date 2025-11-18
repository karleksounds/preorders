const express = require('express');
const fs = require('fs');
const path = require('path');
const { main } = require('./src/index');

const app = express();
const PORT = process.env.PORT || 8081;

// 静的ファイルの配信
app.use(express.static(__dirname, {
  index: 'index.html',
  extensions: ['html']
}));

// データファイルのパス
const dataFilePath = path.join(__dirname, 'data', 'records.json');

// データが古いかチェック（24時間以上経過）
function isDataStale() {
  if (!fs.existsSync(dataFilePath)) {
    return true;
  }

  const stats = fs.statSync(dataFilePath);
  const fileAge = Date.now() - stats.mtimeMs;
  const hours = fileAge / (1000 * 60 * 60);

  return hours > 24;
}

// スクレイピングを実行中かどうかのフラグ
let isScrapingInProgress = false;

// レコードデータAPIエンドポイント
app.get('/api/records', async (req, res) => {
  try {
    // データが存在し、新しい場合はそのまま返す
    if (fs.existsSync(dataFilePath) && !isDataStale()) {
      const data = fs.readFileSync(dataFilePath, 'utf8');
      return res.json(JSON.parse(data));
    }

    // データが古いまたは存在しない場合
    if (isScrapingInProgress) {
      // スクレイピング中の場合は古いデータを返す（あれば）
      if (fs.existsSync(dataFilePath)) {
        const data = fs.readFileSync(dataFilePath, 'utf8');
        return res.json(JSON.parse(data));
      } else {
        return res.status(202).json({
          message: 'Scraping in progress. Please wait and refresh in a few minutes.'
        });
      }
    }

    // スクレイピングを開始
    isScrapingInProgress = true;
    console.log('Starting scraping process...');

    // バックグラウンドでスクレイピングを実行
    main()
      .then(() => {
        console.log('Scraping completed successfully');
        isScrapingInProgress = false;
      })
      .catch(error => {
        console.error('Scraping failed:', error);
        isScrapingInProgress = false;
      });

    // 古いデータがあればそれを返す
    if (fs.existsSync(dataFilePath)) {
      const data = fs.readFileSync(dataFilePath, 'utf8');
      return res.json(JSON.parse(data));
    }

    // データが全くない場合
    return res.status(202).json({
      message: 'First time scraping. Please wait and refresh in a few minutes.'
    });

  } catch (error) {
    console.error('Error in /api/records:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 手動スクレイピングエンドポイント
app.post('/api/scrape', async (req, res) => {
  if (isScrapingInProgress) {
    return res.status(409).json({ message: 'Scraping already in progress' });
  }

  isScrapingInProgress = true;
  console.log('Manual scraping triggered...');

  try {
    await main();
    isScrapingInProgress = false;
    res.json({ message: 'Scraping completed successfully' });
  } catch (error) {
    isScrapingInProgress = false;
    console.error('Manual scraping failed:', error);
    res.status(500).json({ error: 'Scraping failed' });
  }
});

// サーバー起動
app.listen(PORT, async () => {
  console.log(`\n===========================================`);
  console.log(`Record Preorders Server`);
  console.log(`===========================================`);
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`===========================================\n`);

  // 起動時にデータチェック
  if (!fs.existsSync(dataFilePath)) {
    console.log('No data found. Please access http://localhost:' + PORT + ' to start scraping.\n');
  } else if (isDataStale()) {
    console.log('Data is outdated. Will update on next request.\n');
  } else {
    console.log('Data is up to date.\n');
  }
});
