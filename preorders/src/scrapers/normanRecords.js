const puppeteer = require('puppeteer');

/**
 * Norman Recordsの日付フォーマットを YYYY-MM-DD 形式に変換
 */
function parseNormanDate(dateText) {
  if (!dateText) {
    // 日付情報がない場合は現在の月を使用
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // 様々な日付フォーマットに対応
  // "DD/MM/YYYY", "DD-MM-YYYY", "YYYY-MM-DD" など
  const patterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,  // DD/MM/YYYY or MM/DD/YYYY
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/   // YYYY-MM-DD
  ];

  for (const pattern of patterns) {
    const match = dateText.match(pattern);
    if (match) {
      let day, month, year;
      if (pattern === patterns[1]) {
        // YYYY-MM-DD format
        year = parseInt(match[1]);
        month = parseInt(match[2]);
        day = parseInt(match[3]);
      } else {
        // Assume DD/MM/YYYY format (UK standard)
        day = parseInt(match[1]);
        month = parseInt(match[2]);
        year = parseInt(match[3]);
      }

      const yyyy = String(year);
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  // パースできない場合は現在の月を返す
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function scrapeNormanRecords() {
  console.log('Scraping Norman Records...');
  const results = [];
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    // 7"とLPの両方を取得
    const formats = [
      { name: '7"', url: 'https://www.normanrecords.com/preorders?f%5B%5D=f%3Av%3A7&f%5B%5D=d%3Am' },
      { name: 'LP', url: 'https://www.normanrecords.com/preorders?f%5B%5D=f%3Av%3ALP&f%5B%5D=d%3Am' }
    ];

    for (const format of formats) {
      console.log(`  Loading ${format.name}: ${format.url}`);

      await page.goto(format.url, { waitUntil: 'networkidle2', timeout: 60000 });

    // ページが完全に読み込まれるまで待機
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 商品情報を抽出
    const products = await page.evaluate(() => {
      const items = [];

      // 商品リンクを探す（アーティスト名とタイトルのリンク）
      const links = document.querySelectorAll('a[href*="/records/"]');
      const seenUrls = new Set();

      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.match(/\/records\/\d+/)) {
          const fullUrl = href.startsWith('http') ? href : `https://www.normanrecords.com${href}`;

          // 重複を避ける
          if (!seenUrls.has(fullUrl)) {
            seenUrls.add(fullUrl);
            items.push({ url: fullUrl });
          }
        }
      });

      return items;
    });

    console.log(`  Found ${products.length} product links`);

    // 各商品ページにアクセス
    const limit = products.length;
    for (let i = 0; i < limit; i++) {
      const product = products[i];

      try {
        console.log(`  Fetching product ${i + 1}/${limit}: ${product.url}`);

        await page.goto(product.url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 商品詳細を取得
        const details = await page.evaluate(() => {
          const result = {
            artist: '',
            title: '',
            label: '',
            releaseDate: '',
            imageUrl: '',
            genre: ''
          };

          // アーティスト名とタイトルを取得
          // h1またはh2タグから取得を試みる
          const h1 = document.querySelector('h1');
          const h2 = document.querySelector('h2');

          if (h1) {
            const text = h1.textContent.trim();
            // "Artist - Title" 形式を想定
            if (text.includes(' - ')) {
              const parts = text.split(' - ');
              result.artist = parts[0].trim();
              result.title = parts.slice(1).join(' - ').trim();
            } else {
              result.artist = text;
            }
          }

          // タイトルが別の場所にある場合
          if (!result.title && h2) {
            result.title = h2.textContent.trim();
          }

          // レーベル情報をリンクから取得
          const labelLinks = Array.from(document.querySelectorAll('a[href*="/label/"]'));
          const validLabelLinks = labelLinks.filter(link => {
            const text = link.textContent.trim();
            return text && !text.toLowerCase().includes('browse');
          });
          if (validLabelLinks.length > 0) {
            result.label = validLabelLinks[0].textContent.trim();
          }

          // ジャンル情報をリンクから取得（最初のもののみ）
          const genreLinks = Array.from(document.querySelectorAll('a[href*="/genre/"]'));
          const validGenreLinks = genreLinks.filter(link => {
            const text = link.textContent.trim();
            return text && !text.toLowerCase().includes('browse');
          });
          if (validGenreLinks.length > 0) {
            // 最初のジャンルを取得（複数のジャンルがある場合もあるが、最初のもののみ使用）
            const firstGenre = validGenreLinks[0].textContent.trim();
            // スラッシュやカンマで区切られている場合は最初のものを取得
            result.genre = firstGenre.split(/[,\/]/)[0].trim();
          }

          // リリース日を探す
          const bodyText = document.body.innerText;
          const dateMatch = bodyText.match(/Release Date[:\s]+([^\n]+)/i) ||
                           bodyText.match(/Available[:\s]+([^\n]+)/i) ||
                           bodyText.match(/Ships[:\s]+([^\n]+)/i);
          if (dateMatch) {
            result.releaseDate = dateMatch[1].trim();
          }

          // 画像URLを取得
          const ogImage = document.querySelector('meta[property="og:image"]');
          if (ogImage && ogImage.content) {
            result.imageUrl = ogImage.content;
          } else {
            // 商品画像を探す
            const img = document.querySelector('img[src*="artwork"]') ||
                       document.querySelector('.product-image img') ||
                       document.querySelector('img[alt*="cover"]');
            if (img && img.src) {
              result.imageUrl = img.src;
            }
          }

          return result;
        });

        const releaseDate = parseNormanDate(details.releaseDate);

        if (details.artist && details.title) {
          results.push({
            artist: details.artist,
            title: details.title,
            format: format.name,
            label: details.label || '',
            releaseDate,
            store: 'Norman Records',
            url: product.url,
            imageUrl: details.imageUrl || '',
            genre: details.genre || ''
          });
        }

        // サーバーに負荷をかけないよう待機
        await new Promise(resolve => setTimeout(resolve, 800));
      } catch (error) {
        console.error(`  Error processing product: ${error.message}`);
      }
    }

    console.log(`  Found ${products.length} ${format.name} items`);
  }

  console.log(`  Total found from Norman Records: ${results.length} items`);
  } catch (error) {
    console.error('Error scraping Norman Records:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return results;
}

module.exports = scrapeNormanRecords;
