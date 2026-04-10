const fs = require('fs');
const path = require('path');
const scrapeCargoRecords = require('./scrapers/cargoRecords');
const scrapeBanquetRecords = require('./scrapers/banquetRecords');
const scrapeNormanRecords = require('./scrapers/normanRecords');
const scrapeJunoRecords = require('./scrapers/junoRecords');
const scrapeBoomkat = require('./scrapers/boomkat');
const { addItunesInfo } = require('./services/itunes');

/**
 * 日付文字列をパースしてDateオブジェクトを返す
 * 対応フォーマット: DD.MM.YY, YYYY-MM-DD
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  // YYYY-MM-DD形式
  let match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const day = parseInt(match[3]);
    return new Date(year, month, day);
  }

  // DD.MM.YY形式（例: 14.11.25）
  match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{2})/);
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const year = 2000 + parseInt(match[3]);
    return new Date(year, month, day);
  }

  return null;
}

/**
 * DD.MM.YY形式の日付をYYYY-MM-DD形式に変換
 */
function formatDateToYYYYMMDD(dateStr) {
  if (!dateStr) return '';

  // 既にYYYY-MM-DD形式の場合はそのまま返す
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }

  const date = parseDate(dateStr);
  if (!date) return dateStr;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * レコードを日付順にソート（新しい順）
 */
function sortByDate(records) {
  return records
    .filter(record => parseDate(record.releaseDate)) // 有効な日付のみ
    .sort((a, b) => {
      const dateA = parseDate(a.releaseDate);
      const dateB = parseDate(b.releaseDate);
      return dateB - dateA; // 降順（新しい順）
    });
}

/**
 * 重複をグループ化（同じアーティスト＆タイトルを1つにまとめ、ストア情報を配列で保持）
 * Norman Recordsを軸にし、Norman Recordsにあるものは他のストアの情報をマージするが、
 * ジャンルはNorman Recordsのものを優先する
 */
function groupDuplicates(records) {
  const grouped = new Map();

  // まずNorman Recordsのレコードを優先的に処理
  const normanRecords = records.filter(r => r.store === 'Norman Records');
  const otherRecords = records.filter(r => r.store !== 'Norman Records');

  // Norman Recordsのレコードを先にマップに追加
  normanRecords.forEach(record => {
    const key = `${record.artist.toLowerCase()}-${record.title.toLowerCase()}-${record.format}`;
    grouped.set(key, {
      ...record,
      stores: [{
        store: record.store,
        url: record.url
      }]
    });
  });

  // 他のストアのレコードを追加（Norman Recordsのジャンルを維持）
  otherRecords.forEach(record => {
    const key = `${record.artist.toLowerCase()}-${record.title.toLowerCase()}-${record.format}`;

    if (grouped.has(key)) {
      // Norman Recordsに既に存在する場合、ストア情報のみを追加
      const existing = grouped.get(key);
      const storeExists = existing.stores.some(s => s.store === record.store && s.url === record.url);

      if (!storeExists) {
        existing.stores.push({
          store: record.store,
          url: record.url
        });
      }
      // ジャンルはNorman Recordsのものを維持（既存のgenreを上書きしない）
    } else {
      // Norman Recordsにない場合は通常通り追加
      grouped.set(key, {
        ...record,
        stores: [{
          store: record.store,
          url: record.url
        }]
      });
    }
  });

  return Array.from(grouped.values());
}

/**
 * メイン処理
 */
async function main() {
  console.log('Starting 7" record scraper...\n');
  const dataDir = path.join(__dirname, '..', 'data');
  const dataPath = path.join(dataDir, 'records.json');

  // Norman Recordsから7"を取得（優先）
  const normanResults = await scrapeNormanRecords();

  // Cargo Recordsから7"を取得
  const cargoResults = await scrapeCargoRecords();

  // Banquet Recordsから7"を取得
  const banquetResults = await scrapeBanquetRecords();

  // Juno Recordsから取得
  const junoResults = await scrapeJunoRecords();

  // Boomkatから取得
  const boomkatResults = await scrapeBoomkat();

  // 結果を結合
  const freshResults = [...normanResults, ...cargoResults, ...banquetResults, ...junoResults, ...boomkatResults];
  console.log(`\nTotal records found: ${freshResults.length} (Norman: ${normanResults.length}, Cargo: ${cargoResults.length}, Banquet: ${banquetResults.length}, Juno: ${junoResults.length}, Boomkat: ${boomkatResults.length})`);

  // 既存ファイルから過去月・現在月レコードとiTunes URLを一括ロード
  const currentYearMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  let pastRecords = [];
  let existingCurrentRecords = [];
  const existingPreviewMap = {};
  if (fs.existsSync(dataPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      const allExisting = existing.records || [];
      // 先月以前
      pastRecords = allExisting.filter(r =>
        r.releaseDate && r.releaseDate.slice(0, 7) < currentYearMonth
      );
      // 今月（スクレイプで消えても保持するため）
      existingCurrentRecords = allExisting.filter(r =>
        r.releaseDate && r.releaseDate.slice(0, 7) >= currentYearMonth
      );
      // iTunes URLキャッシュ
      allExisting.forEach(r => {
        if (r.itunesPreviewUrl) {
          const key = `${r.artist.toLowerCase()}-${r.title.toLowerCase()}`;
          existingPreviewMap[key] = r.itunesPreviewUrl;
        }
      });
      console.log(`Preserved ${pastRecords.length} records from previous months`);
      console.log(`Loaded ${existingCurrentRecords.length} existing current-month records`);
      console.log(`Loaded ${Object.keys(existingPreviewMap).length} existing iTunes preview URLs`);
    } catch (_) {}
  }

  // 過去月・現在月レコードを展開（stores → store形式）
  const expandStores = r =>
    (r.stores || []).map(s => ({ ...r, store: s.store, url: s.url, stores: undefined }));
  const pastExpanded = pastRecords.flatMap(expandStores);
  const currentExpanded = existingCurrentRecords.flatMap(expandStores);

  // 既存データを先に、フレッシュデータを後ろに（フレッシュが優先）
  const allResults = [...pastExpanded, ...currentExpanded, ...freshResults];

  // 重複をグループ化（Norman Recordsを軸に）
  let allRecords = groupDuplicates(allResults);
  console.log(`After grouping duplicates: ${allRecords.length}`);

  // 日付順にソート
  const sortedRecords = sortByDate(allRecords);
  console.log(`Sorted by date: ${sortedRecords.length} records`);

  // 日付をYYYY-MM-DD形式に統一
  sortedRecords.forEach(record => {
    record.releaseDate = formatDateToYYYYMMDD(record.releaseDate);
  });

  // 既存のプレビューURLを適用（未取得のもののみiTunesに問い合わせ）
  sortedRecords.forEach(r => {
    if (!r.itunesPreviewUrl) {
      const key = `${r.artist.toLowerCase()}-${r.title.toLowerCase()}`;
      if (existingPreviewMap[key]) {
        r.itunesPreviewUrl = existingPreviewMap[key];
      }
    }
  });

  // iTunes プレビュー情報を追加
  console.log('\nAdding iTunes preview information...');
  const recordsWithItunes = await addItunesInfo(sortedRecords);
  console.log('iTunes preview information added\n');

  // データディレクトリが存在しない場合は作成
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // データを保存
  const outputData = {
    records: recordsWithItunes,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(dataPath, JSON.stringify(outputData, null, 2));
  console.log(`Data saved to ${dataPath}`);

  console.log('\nScraping completed successfully!');
  return outputData;
}

// スクリプト実行
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main };
