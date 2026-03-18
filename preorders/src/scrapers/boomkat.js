const puppeteer = require('puppeteer');

const MONTHS = {
  'january': '01', 'february': '02', 'march': '03', 'april': '04',
  'may': '05', 'june': '06', 'july': '07', 'august': '08',
  'september': '09', 'october': '10', 'november': '11', 'december': '12'
};

function parseBoomkatDate(text) {
  if (!text) return null;
  const t = text.trim();

  if (/^today$/i.test(t)) {
    return new Date().toISOString().slice(0, 10);
  }
  if (/^tomorrow$/i.test(t)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  // "20 March 2026"
  const match = t.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = MONTHS[match[2].toLowerCase()];
    if (!month) return null;
    return `${match[3]}-${month}-${day}`;
  }

  return null;
}

function detectFormat(formats) {
  for (const f of formats) {
    if (/\bLP\b/i.test(f)) return 'LP';
  }
  for (const f of formats) {
    if (/7["\u201d]|7\s*inch/i.test(f)) return '7"';
    if (/12["\u201d]|12\s*inch/i.test(f)) return '7"';
    if (/10["\u201d]|10\s*inch/i.test(f)) return '7"';
  }
  return null;
}

async function scrapeBoomkat() {
  console.log('Scraping Boomkat...');
  const results = [];

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    let pageNum = 1;

    while (true) {
      const url = pageNum === 1
        ? 'https://boomkat.com/pre-orders?q%5Bformat%5D=Vinyl&q%5Bgenre%5D=49'
        : `https://boomkat.com/pre-orders?page=${pageNum}&q%5Bformat%5D=Vinyl&q%5Bgenre%5D=49`;
      console.log(`  Fetching page ${pageNum}: ${url}`);

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForSelector('.product_item', { timeout: 10000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1500));

        const { items, hasNextPage } = await page.evaluate(() => {
          const parsed = [];

          // 日付ごとに複数の .grid-view が存在するため全て走査
          const gridViews = [...document.querySelectorAll('.grid-view')];

          gridViews.forEach(gridView => {
            const dateText = gridView.querySelector('.header')?.textContent
              .replace('Estimated Release Date:', '')
              .replace(/\s+/g, ' ')
              .trim() || null;

            [...gridView.querySelectorAll('.product_item')].forEach(node => {
              const formats = [...node.querySelectorAll('.formats li')]
                .map(li => li.textContent.trim())
                .filter(f => !['MP3', 'FLAC', 'WAV'].includes(f));

              if (!formats.length) return;

              const link = node.querySelector('a.image-link');
              const href = link ? link.getAttribute('href').split('?')[0] : null;
              if (!href) return;

              parsed.push({
                dateText,
                artist: node.querySelector('.release__artist')?.textContent.trim() || '',
                title: node.querySelector('.release__title')?.textContent.trim() || '',
                label: node.querySelector('.release__label')?.textContent.trim() || '',
                genre: node.querySelector('.release__genre')?.textContent.trim() || '',
                formats,
                url: 'https://boomkat.com' + href,
                imageUrl: node.querySelector('img')?.getAttribute('data-original') || node.querySelector('img')?.src || ''
              });
            });
          });

          const hasNextPage = [...document.querySelectorAll('.pagination a')]
            .some(a => /next/i.test(a.textContent) || a.getAttribute('rel') === 'next');

          return { items: parsed, hasNextPage };
        });

        if (items.length === 0) {
          console.log(`  Page ${pageNum}: 0 items, stopping`);
          break;
        }

        for (const item of items) {
          const releaseDate = parseBoomkatDate(item.dateText);
          if (!releaseDate) continue;

          const format = detectFormat(item.formats);
          if (!format) continue;

          if (item.artist && item.title) {
            results.push({
              artist: item.artist,
              title: item.title,
              format,
              label: item.label,
              releaseDate,
              store: 'Boomkat',
              url: item.url,
              imageUrl: item.imageUrl,
              genre: item.genre || 'Indie'
            });
          }
        }

        console.log(`  Page ${pageNum}: ${items.length} items (${results.length} total so far)`);

        if (!hasNextPage) break;
        pageNum++;
        await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        console.error(`  Error on page ${pageNum}:`, err.message);
        break;
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`  Total found from Boomkat: ${results.length} items`);
  return results;
}

module.exports = scrapeBoomkat;
