/**
 * Scraper Server
 * ブラウザから呼び出せるスクレイピングAPIサーバー
 */

import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

/**
 * マーケットプレイスページから出品情報をスクレイピング
 */
async function scrapeMarketplace(url) {
  console.log('ブラウザを起動中...');
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1280, height: 800 }
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log(`ページにアクセス中: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // ページが正しく読み込まれたか確認
    const hasResults = await page.evaluate(() => {
      return document.querySelector('.shortcut_navigable') !== null;
    });

    if (!hasResults) {
      console.log('出品情報が見つかりませんでした（ページに出品がないか、URLが正しくない可能性があります）');
      return [];
    }

    await page.waitForSelector('.shortcut_navigable', { timeout: 10000 });

    console.log('出品情報を取得中...');

    const listings = await page.evaluate(() => {
      const items = [];
      const rows = document.querySelectorAll('.shortcut_navigable');

      rows.forEach((row) => {
        try {
          const sellerLink = row.querySelector('.seller_info a');
          const sellerName = sellerLink ? sellerLink.textContent.trim() : '';

          const sellerStats = row.querySelector('.seller_info li:nth-child(2)');
          const sellerRating = sellerStats ? sellerStats.textContent.replace(/\s+/g, ' ').trim() : '';

          const locationElement = row.querySelector('.seller_info li:last-child');
          const location = locationElement ? locationElement.textContent.replace(/\s+/g, ' ').trim() : '';

          const titleElement = row.querySelector('.item_description a');
          const title = titleElement ? titleElement.textContent.trim() : '';

          let mediaCondition = '';
          let sleeveCondition = '';
          let comments = '';

          const conditionElement = row.querySelector('.item_description p.item_condition');
          if (conditionElement) {
            const fullText = conditionElement.textContent.replace(/\s+/g, ' ').trim();

            const mediaMatch = fullText.match(/メディア:\s*([A-Za-z\s]+\([A-Z\+\-]+\))/);
            if (mediaMatch) {
              mediaCondition = mediaMatch[1].trim();
            }

            const sleeveMatch = fullText.match(/スリーブ:\s*([A-Za-z\s]+(?:\([A-Z\+\-]+\))?)/);
            if (sleeveMatch) {
              sleeveCondition = sleeveMatch[1].trim();
            }

            const commentMatch = fullText.match(/\([A-Z\+\-]+\)\s+([^\u30B9-\u30FC]+?)\s+スリーブの状態/);
            if (commentMatch) {
              comments = commentMatch[1].trim();
            }
          }

          const priceElement = row.querySelector('.price');
          let price = '';
          let currency = '';
          if (priceElement) {
            const priceText = priceElement.textContent.trim();
            const priceMatch = priceText.match(/([A-Z$€£¥]+)\s*([\d,\.]+)/);
            if (priceMatch) {
              currency = priceMatch[1];
              price = priceMatch[2];
            } else {
              price = priceText;
            }
          }

          const shippingElement = row.querySelector('.item_shipping');
          let shipping = '';
          if (shippingElement) {
            shipping = shippingElement.textContent.replace(/\s+/g, ' ').trim();
          }

          items.push({
            sellerName,
            sellerRating,
            location,
            title,
            mediaCondition,
            sleeveCondition,
            comments,
            price,
            currency,
            shipping
          });
        } catch (error) {
          console.error('行のパース中にエラー:', error);
        }
      });

      return items;
    });

    console.log(`${listings.length}件の出品情報を取得しました`);
    return listings;

  } finally {
    await browser.close();
  }
}

/**
 * 日本への発送が可能かチェック
 */
function canShipToJapan(shipping) {
  if (!shipping) {
    console.log('  ❌ 送料情報なし');
    return false;
  }

  const lowerShipping = shipping.toLowerCase();

  // 「発送不可」または「Does not ship」を含む場合は除外
  if (lowerShipping.includes('発送不可') || lowerShipping.includes('does not ship')) {
    console.log(`  ❌ 発送不可: ${shipping}`);
    return false;
  }

  // 「日本」または「Japan」を含む場合は含む
  if (lowerShipping.includes('日本') || lowerShipping.includes('japan')) {
    console.log(`  ✅ 日本発送可: ${shipping}`);
    return true;
  }

  // 「Worldwide」を含む場合は含む
  if (lowerShipping.includes('worldwide')) {
    console.log(`  ✅ Worldwide: ${shipping}`);
    return true;
  }

  // その他の場合は除外（詳細をログ出力）
  console.log(`  ⚠️  不明な送料: ${shipping}`);
  return false;
}

/**
 * 出品者ごとにグループ化（日本への発送可能な出品のみ）
 */
function groupBySeller(listings, filterJapan = true) {
  const sellerMap = new Map();

  listings.forEach(item => {
    // 日本への発送フィルター
    if (filterJapan && !canShipToJapan(item.shipping)) {
      return;
    }

    // 価格がパースできない、または0円の商品を除外
    const priceValue = parseFloat(item.price.replace(/,/g, ''));
    if (!priceValue || priceValue <= 0) {
      console.log(`価格が無効な商品をスキップ: ${item.title} (価格: ${item.price})`);
      return;
    }

    if (!sellerMap.has(item.sellerName)) {
      sellerMap.set(item.sellerName, {
        sellerName: item.sellerName,
        sellerRating: item.sellerRating,
        location: item.location,
        items: [],
        totalPrice: 0,
        currency: item.currency
      });
    }

    const seller = sellerMap.get(item.sellerName);
    seller.items.push({
      title: item.title,
      mediaCondition: item.mediaCondition,
      sleeveCondition: item.sleeveCondition,
      comments: item.comments,
      price: priceValue,
      currency: item.currency,
      shipping: item.shipping
    });

    seller.totalPrice += priceValue;
  });

  return Array.from(sellerMap.values()).sort((a, b) => b.items.length - a.items.length);
}

/**
 * スクレイピングAPIエンドポイント
 */
app.post('/api/scrape', async (req, res) => {
  try {
    const { url, filterJapan = false } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URLが指定されていません' });
    }

    console.log('スクレイピング開始:', url);
    console.log('日本発送フィルター:', filterJapan ? 'ON' : 'OFF');
    const listings = await scrapeMarketplace(url);

    if (listings.length === 0) {
      return res.json({ sellers: [], message: '出品情報が見つかりませんでした' });
    }

    console.log(`取得した出品数: ${listings.length}件`);
    const groupedBySeller = groupBySeller(listings, filterJapan);
    console.log(`${filterJapan ? '日本へ発送可能な' : ''}出品者数: ${groupedBySeller.length}名`);

    // JSONファイルとして保存（オプション）
    const timestamp = new Date().toISOString().split('T')[0];
    const jsonFilename = path.join(__dirname, `discogs_marketplace_${timestamp}.json`);
    fs.writeFileSync(jsonFilename, JSON.stringify(groupedBySeller, null, 2), 'utf8');

    res.json({
      sellers: groupedBySeller,
      totalItems: listings.length,
      savedFile: jsonFilename
    });

  } catch (error) {
    console.error('スクレイピングエラー:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ヘルスチェック
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`スクレイピングサーバーが起動しました: http://localhost:${PORT}`);
});
