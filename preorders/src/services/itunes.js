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
 * Deezer APIを使用してプレビューURLを取得（iTunesのフォールバック）
 */
async function getDeezerPreview(artist, title) {
  try {
    const cleanArtist = artist.replace(/\([^)]*\)/g, '').trim();
    const cleanTitle = title.split('/')[0].replace(/\([^)]*\)/g, '').trim();
    const query = `${cleanArtist} ${cleanTitle}`;

    const response = await axios.get('https://api.deezer.com/search', {
      params: { q: query, limit: 1 },
      timeout: 5000
    });

    if (response.data?.data?.length > 0) {
      return response.data.data[0].preview || null;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching Deezer preview for ${artist} - ${title}:`, error.message);
    return null;
  }
}

/**
 * レコードリストにプレビュー情報を追加（iTunes → Deezer フォールバック）
 */
async function addItunesInfo(records) {
  const results = [];
  const total = records.length;
  let processed = 0;
  let itunesCount = 0;
  let deezerCount = 0;

  for (const record of records) {
    processed++;

    // iTunesのURLは長期有効なのでスキップ、DeezerのURLは期限切れになるので再取得
    if (record.itunesPreviewUrl && !record.itunesPreviewUrl.includes('dzcdn.net')) {
      results.push(record);
      itunesCount++;
      continue;
    }

    try {
      let previewUrl = await getItunesPreview(record.artist, record.title);
      let source = 'iTunes';

      if (!previewUrl) {
        await new Promise(resolve => setTimeout(resolve, 100));
        previewUrl = await getDeezerPreview(record.artist, record.title);
        source = 'Deezer';
      }

      results.push({ ...record, itunesPreviewUrl: previewUrl || '' });

      if (previewUrl) {
        console.log(`  [${processed}/${total}] ✓ ${source}: ${record.artist} - ${record.title.substring(0, 40)}`);
        source === 'iTunes' ? itunesCount++ : deezerCount++;
      } else {
        console.log(`  [${processed}/${total}] ✗ No preview for ${record.artist} - ${record.title.substring(0, 40)}`);
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`  Error processing ${record.artist}:`, error.message);
      results.push({ ...record, itunesPreviewUrl: '' });
    }
  }

  const foundCount = results.filter(r => r.itunesPreviewUrl).length;
  console.log(`\nPreview info: ${foundCount}/${total} tracks (iTunes: ${itunesCount}, Deezer: ${deezerCount})`);

  return results;
}

module.exports = { getItunesPreview, getDeezerPreview, addItunesInfo };
