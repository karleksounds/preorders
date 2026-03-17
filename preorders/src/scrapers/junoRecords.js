const axios = require('axios');
const cheerio = require('cheerio');

const MONTHS = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };

function parseJunoDate(text) {
  // "29 May 26" or "29 May 2026"
  const match = text.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})/);
  if (!match) return null;
  const day = match[1].padStart(2, '0');
  const month = MONTHS[match[2].toLowerCase()];
  const year = match[3].length === 2 ? '20' + match[3] : match[3];
  if (!month) return null;
  return `${year}-${month}-${day}`;
}

function detectFormat(text) {
  if (/\bLP\b/i.test(text)) return 'LP';
  if (/7["\u201d]/.test(text) || /7\s*inch/i.test(text)) return '7"';
  if (/12["\u201d]/.test(text) || /12\s*inch/i.test(text)) return '7"'; // 12" → 7"セクション
  if (/10["\u201d]/.test(text) || /10\s*inch/i.test(text)) return '7"'; // 10" → 7"セクション
  return null;
}

async function scrapeJunoRecords() {
  console.log('Scraping Juno Records...');
  const results = [];

  const baseUrl = 'https://www.juno.co.uk/indie/preorders/';
  const params = 'facet%5Bformat_type_norm_facet%5D%5B%5D=LP&facet%5Bformat_type_norm_facet%5D%5B%5D=7%22&facet%5Bformat_type_norm_facet%5D%5B%5D=12%22&facet%5Bformat_type_norm_facet%5D%5B%5D=10%22';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-GB,en;q=0.9'
  };

  let page = 1;

  while (true) {
    const pagePath = page === 1 ? '' : `${page}/`;
    const url = `${baseUrl}${pagePath}?${params}`;
    console.log(`  Fetching page ${page}: ${url}`);

    try {
      const response = await axios.get(url, { headers });
      const $ = cheerio.load(response.data);
      const items = $('.dv-item.dv-item-music');

      if (items.length === 0) break;

      items.each((_, el) => {
        try {
          const $el = $(el);

          // 商品URL・画像
          const productLink = $el.find('.dvi-img a[href*="/products/"]').first();
          const productPath = productLink.attr('href');
          if (!productPath) return;
          const productUrl = `https://www.juno.co.uk${productPath}`;
          const imageUrl = $el.find('.dvi-img img.img-fluid').attr('src') || '';

          // アーティスト
          const artist = $el.find('a.text-md[href*="/artists/"]').first().text().trim();

          // タイトル
          const title = $el.find('a.text-md[href*="/products/"]').first().text().trim();

          // フォーマット（span.text-primaryの内容から判定）
          const formatText = $el.find('span.text-primary').first().text();
          const format = detectFormat(formatText);
          if (!format) return;

          // レーベル
          const label = $el.find('a.text-md.text-light[href*="/labels/"]').first().text().trim();

          // リリース日（"Rel: 29 May 26"を含む要素）
          let releaseDate = null;
          $el.find('.vi-text').each((_, viEl) => {
            const text = $(viEl).text();
            if (text.includes('Rel:')) {
              const dateMatch = text.match(/Rel[:\s\u00a0]+(.+)/);
              if (dateMatch) releaseDate = parseJunoDate(dateMatch[1].trim());
            }
          });
          if (!releaseDate) return;

          if (artist && title) {
            results.push({
              artist,
              title,
              format,
              label,
              releaseDate,
              store: 'Juno Records',
              url: productUrl,
              imageUrl,
              genre: 'Indie'
            });
          }
        } catch (err) {
          console.error('  Error parsing item:', err.message);
        }
      });

      console.log(`  Page ${page}: ${items.length} items found`);

      // 次のページがなければ終了（<link rel="next"> で判定）
      const hasNext = $('link[rel="next"]').length > 0;
      if (!hasNext) break;

      page++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error(`  Error fetching page ${page}:`, err.message);
      break;
    }
  }

  console.log(`  Total found from Juno Records: ${results.length} items`);
  return results;
}

module.exports = scrapeJunoRecords;
