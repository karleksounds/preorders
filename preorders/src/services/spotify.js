const axios = require('axios');
require('dotenv').config();

let accessToken = null;
let tokenExpiry = null;

/**
 * Spotify APIのアクセストークンを取得
 */
async function getSpotifyAccessToken() {
  // トークンがまだ有効ならそれを返す
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('Spotify credentials not found in .env file. Skipping Spotify integration.');
    return null;
  }

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
        }
      }
    );

    accessToken = response.data.access_token;
    // トークンの有効期限を設定（通常1時間）
    tokenExpiry = Date.now() + (response.data.expires_in * 1000);

    return accessToken;
  } catch (error) {
    console.error('Error getting Spotify access token:', error.message);
    return null;
  }
}

/**
 * アーティストとタイトルでSpotifyを検索
 */
async function searchSpotify(artist, title) {
  const token = await getSpotifyAccessToken();

  if (!token) {
    return null;
  }

  try {
    // 検索クエリを作成
    const query = `artist:${artist} album:${title}`;

    const response = await axios.get('https://api.spotify.com/v1/search', {
      params: {
        q: query,
        type: 'album',
        limit: 1
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.data.albums && response.data.albums.items.length > 0) {
      const album = response.data.albums.items[0];
      return {
        spotifyUrl: album.external_urls.spotify,
        spotifyUri: album.uri,
        spotifyImage: album.images[0]?.url || null
      };
    }

    return null;
  } catch (error) {
    console.error(`Error searching Spotify for ${artist} - ${title}:`, error.message);
    return null;
  }
}

/**
 * 複数のレコードにSpotify情報を追加
 */
async function addSpotifyInfo(records) {
  console.log('Adding Spotify information...');

  const results = [];

  for (const record of records) {
    const spotifyInfo = await searchSpotify(record.artist, record.title);

    results.push({
      ...record,
      ...(spotifyInfo || {})
    });

    // APIレート制限を避けるため少し待機
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('Spotify information added');
  return results;
}

module.exports = {
  searchSpotify,
  addSpotifyInfo
};
