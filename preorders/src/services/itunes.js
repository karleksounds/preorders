const axios = require('axios');

/**
 * iTunes Search APIを使用してプレビューURLを取得
 * @param {string} artist - アーティスト名
 * @param {string} title - トラックタイトル
 * @returns {Promise<string|null>} プレビューURL（30秒）
 */
async function getItunesPreview(artist, title) {
  try {
    // アーティスト名とタイトルからクエリを作成
    // 括弧内の余分な情報を削除
    const cleanArtist = artist.replace(/\([^)]*\)/g, '').trim();
    const cleanTitle = title.split('/')[0].replace(/\([^)]*\)/g, '').trim(); // 最初のトラックのみ

    const query = `${cleanArtist} ${cleanTitle}`;

    const response = await axios.get('https://itunes.apple.com/search', {
      params: {
        term: query,
        entity: 'song',
        limit: 1,
        country: 'US' // または 'JP' for Japan
      },
      timeout: 5000
    });

    if (response.data && response.data.results && response.data.results.length > 0) {
      const track = response.data.results[0];
      return track.previewUrl || null;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching iTunes preview for ${artist} - ${title}:`, error.message);
    return null;
  }
}

/**
 * レコードリストにiTunesプレビュー情報を追加
 * @param {Array} records - レコードの配列
 * @returns {Promise<Array>} iTunesプレビュー情報を含むレコードの配列
 */
async function addItunesInfo(records) {
  const results = [];
  const total = records.length;
  let processed = 0;

  for (const record of records) {
    processed++;

    try {
      const previewUrl = await getItunesPreview(record.artist, record.title);

      results.push({
        ...record,
        itunesPreviewUrl: previewUrl || ''
      });

      if (previewUrl) {
        console.log(`  [${processed}/${total}] ✓ Found iTunes preview for ${record.artist} - ${record.title.substring(0, 40)}`);
      } else {
        console.log(`  [${processed}/${total}] ✗ No iTunes preview for ${record.artist} - ${record.title.substring(0, 40)}`);
      }

      // APIレート制限を避けるため少し待機
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`  Error processing ${record.artist}:`, error.message);
      results.push({
        ...record,
        itunesPreviewUrl: ''
      });
    }
  }

  const foundCount = results.filter(r => r.itunesPreviewUrl).length;
  console.log(`\niTunes preview info: ${foundCount}/${total} tracks have preview URLs`);

  return results;
}

module.exports = { getItunesPreview, addItunesInfo };
