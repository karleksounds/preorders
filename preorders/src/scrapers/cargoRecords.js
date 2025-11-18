const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeCargoRecords() {
  console.log('Scraping Cargo Records...');
  const results = [];

  // 複数のページから取得
  const urls = [
    'https://www.cargo-records.de/en/show/lastweek/katalog.117.html',  // 先週
    'https://www.cargo-records.de/en/show/week/katalog.117.html',      // 今週
    'https://www.cargo-records.de/en/show/nfriday/katalog.117.html',   // 来週
    'https://www.cargo-records.de/en/show/all/katalog.117.html'        // 30日
  ];

  try {
    for (const url of urls) {
      console.log(`Fetching: ${url}`);
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      let pageResults = 0;

      // 商品リストを解析
      // 画像リンクを探し、その親要素（grandparent）の兄弟要素から情報を取得
      const imageLinks = $('a[href*="/item/"]').filter((i, el) => $(el).find('img').length > 0);
      console.log(`  Found ${imageLinks.length} product items with images`);

      // 商品情報を抽出（フェーズ1: 一覧ページ）
      const products = [];
      imageLinks.each((i, imgLink) => {
        try {
          const $imgLink = $(imgLink);

          // 画像URL
          const img = $imgLink.find('img').first();
          const imageSrc = img.attr('src');
          const fullImageUrl = imageSrc && imageSrc.startsWith('http')
            ? imageSrc
            : (imageSrc ? `https://www.cargo-records.de${imageSrc}` : '');

          // 商品URL
          const itemUrl = $imgLink.attr('href');
          const fullUrl = itemUrl && itemUrl.startsWith('http')
            ? itemUrl
            : (itemUrl ? `https://www.cargo-records.de${itemUrl}` : '');

          // 画像リンクの親要素 -> 親要素（grandparent）の次の兄弟要素を取得
          const $grandParent = $imgLink.parent().parent();

          // 次の3つの兄弟要素から情報を取得
          const $artistDiv = $grandParent.next(); // アーティスト名
          const $titleDiv = $artistDiv.next();    // タイトル
          const $infoDiv = $titleDiv.next();      // 日付・レーベル
          const $formatDiv = $infoDiv.next();     // フォーマット・カタログ番号

          // アーティスト名
          const artist = $artistDiv.text().trim();

          // タイトル
          const title = $titleDiv.text().trim();

          // 日付とレーベル（"14.11.25 · BACK ON BLACK"形式）
          const infoText = $infoDiv.text().trim();
          const dateMatch = infoText.match(/(\d{2}\.\d{2}\.\d{2})\s*·\s*(.+)/);
          let releaseDate = dateMatch ? dateMatch[1] : '';
          const label = dateMatch ? dateMatch[2].trim() : '';

          // 日付をYYYY-MM-DD形式に変換
          if (releaseDate) {
            const match = releaseDate.match(/(\d{2})\.(\d{2})\.(\d{2})/);
            if (match) {
              const day = match[1];
              const month = match[2];
              const year = '20' + match[3];
              releaseDate = `${year}-${month}-${day}`;
            }
          }

          // フォーマット（"7" · Kat. Nr: 172739"形式）
          const formatText = $formatDiv.text().trim();
          const formatMatch = formatText.match(/(7"|LP|CD|12"|10"|2 CD|2LP)/);
          const format = formatMatch ? formatMatch[1] : '';

          // 7"のみを商品リストに追加
          if (artist && title && fullUrl && format === '7"' && releaseDate) {
            products.push({
              artist,
              title,
              label,
              releaseDate,
              url: fullUrl,
              imageUrl: fullImageUrl
            });
          }
        } catch (err) {
          console.error('Error parsing item:', err.message);
        }
      });

      console.log(`  Found ${products.length} 7" products on this page`);

      // フェーズ2: 各商品ページからジャンルを取得
      for (const product of products) {
        try {
          const detailResponse = await axios.get(product.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
          });

          const $detail = cheerio.load(detailResponse.data);
          const bodyText = $detail('body').text();
          const genreMatch = bodyText.match(/genre:\s*([^\n]+)/i);
          const genre = genreMatch ? genreMatch[1].trim() : '';

          results.push({
            artist: product.artist,
            title: product.title,
            format: '7"',
            label: product.label || '',
            releaseDate: product.releaseDate,
            store: 'Cargo Records',
            url: product.url,
            imageUrl: product.imageUrl || '',
            genre: genre
          });
          pageResults++;

          // サーバーに負荷をかけないよう少し待機
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          console.error(`Error fetching genre for ${product.artist} - ${product.title}:`, err.message);
          // エラーでもジャンルなしで追加
          results.push({
            artist: product.artist,
            title: product.title,
            format: '7"',
            label: product.label || '',
            releaseDate: product.releaseDate,
            store: 'Cargo Records',
            url: product.url,
            imageUrl: product.imageUrl || '',
            genre: ''
          });
          pageResults++;
        }
      }

      console.log(`  Found ${pageResults} 7" items from this page`);

      // サーバーに負荷をかけないよう少し待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\nTotal found: ${results.length} 7" items from Cargo Records`);
  } catch (error) {
    console.error('Error scraping Cargo Records:', error.message);
  }

  return results;
}

module.exports = scrapeCargoRecords;
