const axios = require('axios');

/**
 * iTunes Search APIを使用してプレビューURLを取得
 */
async function getItunesPreview(artist, title) {
  try {
    const cleanArtist = artist.replace(/\([^)]*\)/g, '').trim();
    const cleanTitle = title.split('/')[0].replace(/\([^)]*\)/g, '').trim();
    const query = `${cleanArtist} ${cleanTitle}`;

    const response = await axios.get('https://itunes.apple.com/search', {
      params: { term: query, entity: 'song', limit: 1, country: 'US' },
      timeout: 5000
    });

    if (response.data?.results?.length > 0) {
      return response.data.results[0].previewUrl || null;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching iTunes preview for ${artist} - ${title}:`, error.message);
    return null;
  }
}

/**
 * Deezerに曲が存在するか確認（URLは保存しない）
 */
async function checkDeezerAvailable(artist, title) {
  try {
    const cleanArtist = artist.replace(/\([^)]*\)/g, '').trim();
    const cleanTitle = title.split('/')[0].replace(/\([^)]*\)/g, '').trim();
    const query = encodeURIComponent(`${cleanArtist} ${cleanTitle}`);

    const response = await axios.get(`https://api.deezer.com/search?q=${query}&limit=1`, {
      timeout: 5000
    });

    return !!(response.data?.data?.length > 0 && response.data.data[0].preview);
  } catch (error) {
    return false;
  }
}

/**
 * レコードリストにiTunes＋Deezer可否情報を追加
 */
async function addItunesInfo(records) {
  const results = [];
  const total = records.length;
  let processed = 0;
  let itunesCount = 0;
  let deezerCount = 0;

  for (const record of records) {
    processed++;

    // 既にチェック済みの場合はスキップ
    if (record.itunesPreviewUrl || record.hasDeezerPreview === true || record.hasDeezerPreview === false) {
      results.push(record);
      if (record.itunesPreviewUrl) itunesCount++;
      else if (record.hasDeezerPreview) deezerCount++;
      continue;
    }

    try {
      const previewUrl = await getItunesPreview(record.artist, record.title);

      if (previewUrl) {
        results.push({ ...record, itunesPreviewUrl: previewUrl, hasDeezerPreview: false });
        console.log(`  [${processed}/${total}] ✓ iTunes: ${record.artist} - ${record.title.substring(0, 40)}`);
        itunesCount++;
      } else {
        const hasDeezer = await checkDeezerAvailable(record.artist, record.title);
        results.push({ ...record, itunesPreviewUrl: '', hasDeezerPreview: hasDeezer });
        if (hasDeezer) {
          console.log(`  [${processed}/${total}] ✓ Deezer: ${record.artist} - ${record.title.substring(0, 40)}`);
          deezerCount++;
        } else {
          console.log(`  [${processed}/${total}] ✗ No preview: ${record.artist} - ${record.title.substring(0, 40)}`);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`  Error processing ${record.artist}:`, error.message);
      results.push({ ...record, itunesPreviewUrl: '', hasDeezerPreview: false });
    }
  }

  const foundCount = results.filter(r => r.itunesPreviewUrl || r.hasDeezerPreview).length;
  console.log(`\nPreview info: ${foundCount}/${total} tracks (iTunes: ${itunesCount}, Deezer: ${deezerCount})`);

  return results;
}

module.exports = { getItunesPreview, checkDeezerAvailable, addItunesInfo };
