const puppeteer = require('puppeteer');

/**
 * Banquet Recordsの日付フォーマット（"Expected 7th November 2025"）をパース
 */
function parseBanquetDate(dateText) {
  if (!dateText) return null;

  // "Expected 7th November 2025" 形式
  const match = dateText.match(/Expected\s+(\d{1,2})(?:st|nd|rd|th)\s+(\w+)\s+(\d{4})/i);
  if (match) {
    const day = parseInt(match[1]);
    const monthName = match[2];
    const year = parseInt(match[3]);

    const monthMap = {
      'january': 0, 'february': 1, 'march': 2, 'april': 3,
      'may': 4, 'june': 5, 'july': 6, 'august': 7,
      'september': 8, 'october': 9, 'november': 10, 'december': 11
    };

    const month = monthMap[monthName.toLowerCase()];
    if (month !== undefined) {
      const date = new Date(year, month, day);
      // YYYY-MM-DD形式に変換
      const yyyy = String(date.getFullYear());
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  return null;
}

async function scrapeBanquetRecords() {
  console.log('Scraping Banquet Records...');
  const results = [];
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // 7"とLPの両方を取得
    const formats = [
      { name: '7"', keyword: '7"', url: 'https://www.banquetrecords.com/search?f=seven&t=preOrder&w=480' },
      { name: 'LP', keyword: 'LP', url: 'https://www.banquetrecords.com/search?t=preOrder&f=lp&w=480' }
    ];

    for (const format of formats) {
      let page;
      try {
        console.log(`  Loading ${format.name}: ${format.url}`);

        // 各フォーマットで新しいページを作成
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

        await page.goto(format.url, { waitUntil: 'networkidle2', timeout: 60000 });

        // ページが完全に読み込まれるまで待機
        await new Promise(resolve => setTimeout(resolve, 3000));

      // 商品情報を抽出
      const products = await page.evaluate((formatKeyword) => {
        const items = [];

        // a.card.item セレクタで商品リンクを取得
        const links = document.querySelectorAll('a.card.item');

        links.forEach(link => {
          const href = link.getAttribute('href');
          const text = link.textContent.trim();

          // フォーマット と Pre-Order を含むリンク
          if (text.includes(formatKeyword) && text.includes('Pre-Order') && href) {
            // hrefは相対パス（例: "artist/title/CODE"）なので、ベースURLと結合
            const fullUrl = href.startsWith('http') ? href : `https://www.banquetrecords.com/${href}`;
            items.push({
              url: fullUrl,
              text: text
            });
          }
        });

        return items;
      }, format.keyword);

        console.log(`  Found ${products.length} ${format.name} product links`);

        // 各商品ページにアクセス（全件取得）
        const limit = products.length;
        for (let i = 0; i < limit; i++) {
          const product = products[i];

          try {
            console.log(`  Fetching product ${i + 1}/${limit}`);

            await page.goto(product.url, { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(resolve => setTimeout(resolve, 2000));

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

          // h1がアーティスト名
          const h1 = document.querySelector('h1');
          if (h1) {
            result.artist = h1.textContent.trim();
          }

          // h2がタイトル
          const h2 = document.querySelector('h2');
          if (h2) {
            result.title = h2.textContent.trim();
          }

          // Expected 日付を探す
          const bodyText = document.body.innerText;
          const dateMatch = bodyText.match(/Expected\s+\d{1,2}(?:st|nd|rd|th)\s+\w+\s+\d{4}/i);
          if (dateMatch) {
            result.releaseDate = dateMatch[0];
          }

          // レーベルを探す
          const labelMatch = bodyText.match(/Label:\s*([^\n]+)/i);
          if (labelMatch) {
            result.label = labelMatch[1].trim();
          }

          // Tagsを探す（最初のタグをジャンルとして使用）
          // "Tags" が1行にあり、次の行にタグの値がある形式に対応
          const tagsMatch = bodyText.match(/Tags\s*\n\s*([^\n]+)/i);
          if (tagsMatch) {
            // タグ文字列から "Pre-Order" などの余分な文字を除去
            const tagString = tagsMatch[1].replace(/\s*Pre-Order\s*/gi, '').trim();
            // " / " で分割して最初のタグを取得
            const tags = tagString.split(/\s*\/\s*/).map(t => t.trim());
            if (tags.length > 0 && tags[0]) {
              result.genre = tags[0];
            }
          }

          // 画像URLを取得（複数の方法を試す）
          // 方法1: Open Graph画像（最も信頼性が高い）
          const ogImage = document.querySelector('meta[property="og:image"]');
          if (ogImage && ogImage.content) {
            result.imageUrl = ogImage.content;
          } else {
            // 方法2: 商品画像
            const productImg = document.querySelector('img.product-image, img[itemprop="image"]');
            if (productImg && productImg.src) {
              result.imageUrl = productImg.src;
            } else {
              // 方法3: thumb.png画像
              const img = document.querySelector('img[src*="thumb.png"]');
              if (img && img.src) {
                result.imageUrl = img.src;
              }
            }
          }

          return result;
            });

            const releaseDate = parseBanquetDate(details.releaseDate);

            if (details.artist && details.title && releaseDate) {
              results.push({
                artist: details.artist,
                title: details.title,
                format: format.name,
                label: details.label || '',
                releaseDate,
                store: 'Banquet Records',
                url: product.url,
                imageUrl: details.imageUrl || '',
                genre: details.genre || ''
              });
            }
          } catch (error) {
            console.error(`  Error processing product: ${error.message}`);
          }
        }

        console.log(`  Found ${products.length} ${format.name} items`);
      } catch (formatError) {
        console.error(`  Error scraping ${format.name}: ${formatError.message}`);
        // Continue with next format
      } finally {
        // ページをクローズ
        if (page) {
          await page.close();
        }
      }
    }

  console.log(`  Total found from Banquet Records: ${results.length} items`);
  } catch (error) {
    console.error('Error scraping Banquet Records:', error.message);
    // Continue with partial results
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return results;
}

module.exports = scrapeBanquetRecords;
