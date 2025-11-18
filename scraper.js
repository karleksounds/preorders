/**
 * Discogs Marketplace Scraper
 * マーケットプレイスページから出品者情報を取得してCSVに出力
 */

import puppeteer from 'puppeteer';
import fs from 'fs';

/**
 * マーケットプレイスページから出品情報をスクレイピング
 * @param {string} url - DiscogsマーケットプレイスのURL
 * @returns {Promise<Array>} 出品情報の配列
 */
async function scrapeMarketplace(url) {
  console.log('ブラウザを起動中...');
  const browser = await puppeteer.launch({
    headless: true, // バックグラウンドで実行
    defaultViewport: { width: 1280, height: 800 }
  });

  try {
    const page = await browser.newPage();

    // User-Agentを設定
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log(`ページにアクセス中: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // ページが読み込まれるまで待機
    await page.waitForSelector('.shortcut_navigable', { timeout: 10000 });

    console.log('出品情報を取得中...');

    // ページ内のすべての出品情報を取得
    const listings = await page.evaluate(() => {
      const items = [];
      const rows = document.querySelectorAll('.shortcut_navigable');

      rows.forEach((row) => {
        try {
          // 出品者名
          const sellerLink = row.querySelector('.seller_info a');
          const sellerName = sellerLink ? sellerLink.textContent.trim() : '';

          // 出品者の評価（改行を削除）
          const sellerStats = row.querySelector('.seller_info li:nth-child(2)');
          const sellerRating = sellerStats ? sellerStats.textContent.replace(/\s+/g, ' ').trim() : '';

          // 出品者の所在地（改行を削除）
          const locationElement = row.querySelector('.seller_info li:last-child');
          const location = locationElement ? locationElement.textContent.replace(/\s+/g, ' ').trim() : '';

          // リリースタイトル
          const titleElement = row.querySelector('.item_description a');
          const title = titleElement ? titleElement.textContent.trim() : '';

          // コンディション（Media / Sleeve）- 日本語対応版
          let mediaCondition = '';
          let sleeveCondition = '';
          let comments = '';

          // item_conditionからMedia/Sleeveを抽出（日本語・英語両対応）
          const conditionElement = row.querySelector('.item_description p.item_condition');
          if (conditionElement) {
            // 改行や余分な空白を統一
            const fullText = conditionElement.textContent.replace(/\s+/g, ' ').trim();

            // Media（"メディア:" の後、コンディション名 + (略称)）
            // 例: "Very Good Plus (VG+)"
            const mediaMatch = fullText.match(/メディア:\s*([A-Za-z\s]+\([A-Z\+\-]+\))/);
            if (mediaMatch) {
              mediaCondition = mediaMatch[1].trim();
            }

            // Sleeve（"スリーブ:" の後、コンディション名 + (略称) または Generic など）
            // 例: "Very Good (VG)" or "Generic"
            const sleeveMatch = fullText.match(/スリーブ:\s*([A-Za-z\s]+(?:\([A-Z\+\-]+\))?)/);
            if (sleeveMatch) {
              sleeveCondition = sleeveMatch[1].trim();
            }

            // コメント（メディアコンディションの後、"スリーブの状態:"の前のテキスト）
            // 例: "(VG+) 溝の擦れ..." の "溝の擦れ..." 部分
            const commentMatch = fullText.match(/\([A-Z\+\-]+\)\s+([^\u30B9-\u30FC]+?)\s+スリーブの状態/);
            if (commentMatch) {
              comments = commentMatch[1].trim();
            }
          }

          // 価格
          const priceElement = row.querySelector('.price');
          let price = '';
          let currency = '';
          if (priceElement) {
            const priceText = priceElement.textContent.trim();
            // 通貨記号と金額を分離
            const priceMatch = priceText.match(/([A-Z$€£¥]+)\s*([\d,\.]+)/);
            if (priceMatch) {
              currency = priceMatch[1];
              price = priceMatch[2];
            } else {
              price = priceText;
            }
          }

          // 送料（改行と余分なスペースを削除）
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
 * 出品者ごとにグループ化
 * @param {Array} listings - 出品情報の配列
 * @returns {Array} 出品者ごとにグループ化されたデータ
 */
function groupBySeller(listings) {
  const sellerMap = new Map();

  listings.forEach(item => {
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
      price: parseFloat(item.price) || 0,
      currency: item.currency,
      shipping: item.shipping
    });

    // 合計金額を計算
    seller.totalPrice += parseFloat(item.price) || 0;
  });

  // 出品者を配列に変換し、出品数でソート
  return Array.from(sellerMap.values()).sort((a, b) => b.items.length - a.items.length);
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('使い方:');
    console.log('  node scraper.js <Discogs Marketplace URL>');
    console.log('');
    console.log('例:');
    console.log('  node scraper.js "https://www.discogs.com/ja/sell/list?artist_id=112154&format_desc=7%22"');
    process.exit(1);
  }

  const url = args[0];

  try {
    // スクレイピング実行
    const listings = await scrapeMarketplace(url);

    if (listings.length === 0) {
      console.log('出品情報が見つかりませんでした');
      return;
    }

    // 出品者ごとにグループ化
    const groupedBySeller = groupBySeller(listings);
    console.log(`📊 出品者数: ${groupedBySeller.length}名`);

    // ファイル名生成
    const timestamp = new Date().toISOString().split('T')[0];

    // JSON作成（出品者ごとのグループ化データ）
    const jsonFilename = `discogs_marketplace_${timestamp}.json`;
    fs.writeFileSync(jsonFilename, JSON.stringify(groupedBySeller, null, 2), 'utf8');
    console.log(`✅ JSONファイルを保存しました: ${jsonFilename}`);

    console.log(`📊 総出品数: ${listings.length}件`);

  } catch (error) {
    console.error('エラーが発生しました:', error.message);
    process.exit(1);
  }
}

main();
