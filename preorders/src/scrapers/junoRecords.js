const puppeteer = require('puppeteer');

const MONTHS = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };

function parseJunoDate(text) {
  const match = text.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})/);
  if (!match) return null;
  const day = match[1].padStart(2, '0');
  const month = MONTHS[match[2].toLowerCase()];
  const year = match[3].length === 2 ? '20' + match[3] : match[3];
  if (!month) return null;
  return `${year}-${month}-${day}`;
}

function detectFormat(text) {
  if (/\bLP\b/i.test(text)) return { format: 'LP', displayFormat: 'LP' };
  if (/7["\u201d]/.test(text) || /7\s*inch/i.test(text)) return { format: '7"', displayFormat: '7"' };
  if (/12["\u201d]/.test(text) || /12\s*inch/i.test(text)) return { format: '7"', displayFormat: '12"' };
  if (/10["\u201d]/.test(text) || /10\s*inch/i.test(text)) return { format: '7"', displayFormat: '10"' };
  return null;
}

async function scrapeJunoRecords() {
  console.log('Scraping Juno Records...');
  const results = [];
  let browser = null;

  const baseUrl = 'https://www.juno.co.uk/indie/preorders/';
  const params = 'facet%5Bformat_type_norm_facet%5D%5B%5D=LP&facet%5Bformat_type_norm_facet%5D%5B%5D=7%22&facet%5Bformat_type_norm_facet%5D%5B%5D=12%22&facet%5Bformat_type_norm_facet%5D%5B%5D=10%22';

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-GB,en;q=0.9' });

    let pageNum = 1;

    while (true) {
      const pagePath = pageNum === 1 ? '' : `${pageNum}/`;
      const url = `${baseUrl}${pagePath}?${params}`;
      console.log(`  Fetching page ${pageNum}: ${url}`);

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        // アイテムが表示されるまで待機（最大10秒）
        await page.waitForSelector('.dv-item.dv-item-music', { timeout: 10000 }).catch(() => {});

        const { items } = await page.evaluate((MONTHS) => {
          function parseJunoDateInPage(text) {
            const match = text.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})/);
            if (!match) return null;
            const day = match[1].padStart(2, '0');
            const month = MONTHS[match[2].toLowerCase()];
            const year = match[3].length === 2 ? '20' + match[3] : match[3];
            if (!month) return null;
            return `${year}-${month}-${day}`;
          }

          function detectFormatInPage(text) {
            if (/\bLP\b/i.test(text)) return { format: 'LP', displayFormat: 'LP' };
            if (/7["\u201d]/.test(text) || /7\s*inch/i.test(text)) return { format: '7"', displayFormat: '7"' };
            if (/12["\u201d]/.test(text) || /12\s*inch/i.test(text)) return { format: '7"', displayFormat: '12"' };
            if (/10["\u201d]/.test(text) || /10\s*inch/i.test(text)) return { format: '7"', displayFormat: '10"' };
            return null;
          }

          const items = [];
          document.querySelectorAll('.dv-item.dv-item-music').forEach(el => {
            try {
              const productLink = el.querySelector('.dvi-img a[href*="/products/"]');
              if (!productLink) return;
              const productUrl = `https://www.juno.co.uk${productLink.getAttribute('href')}`;
              const imageUrl = el.querySelector('.dvi-img img.img-fluid')?.getAttribute('src') || '';
              const artist = el.querySelector('a.text-md[href*="/artists/"]')?.textContent.trim() || '';
              const title = el.querySelector('a.text-md[href*="/products/"]')?.textContent.trim() || '';
              const formatText = el.querySelector('span.text-primary')?.textContent || '';
              const formatResult = detectFormatInPage(formatText);
              if (!formatResult) return;
              const label = el.querySelector('a.text-md.text-light[href*="/labels/"]')?.textContent.trim() || '';

              let releaseDate = null;
              el.querySelectorAll('.vi-text').forEach(viEl => {
                const text = viEl.textContent;
                if (text.includes('Rel:')) {
                  const dateMatch = text.match(/Rel[:\s\u00a0]+(.+)/);
                  if (dateMatch) releaseDate = parseJunoDateInPage(dateMatch[1].trim());
                }
              });
              if (!releaseDate || !artist || !title) return;

              items.push({ artist, title, ...formatResult, label, releaseDate, url: productUrl, imageUrl });
            } catch (_) {}
          });

          return { items };
        }, MONTHS);

        items.forEach(item => {
          results.push({ ...item, store: 'Juno Records', genre: 'Indie' });
        });

        console.log(`  Page ${pageNum}: ${items.length} items found`);

        if (items.length === 0) break;
        pageNum++;
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (err) {
        console.error(`  Error fetching page ${pageNum}:`, err.message);
        break;
      }
    }
  } catch (err) {
    console.error('Error launching browser:', err.message);
  } finally {
    if (browser) await browser.close();
  }

  console.log(`  Total found from Juno Records: ${results.length} items`);
  return results;
}

module.exports = scrapeJunoRecords;
