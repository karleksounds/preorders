/**
 * Discogs APIクライアント (ブラウザ版)
 */
export class DiscogsClient {
  constructor(token) {
    if (!token) {
      throw new Error('Discogs API token is required');
    }

    this.token = token;
    this.baseURL = 'https://api.discogs.com';
  }

  /**
   * リリースIDからマーケットプレイス統計を取得
   * 注意: Discogs APIは個別の出品リストを直接取得できません
   */
  async getMarketplaceListing(releaseId) {
    try {
      const url = `${this.baseURL}/marketplace/stats/${releaseId}`;
      console.log('Marketplace stats URL:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Discogs token=${this.token}`,
          'User-Agent': 'DiscogsSellerOptimizer/1.0'
        }
      });

      if (!response.ok) {
        console.warn(`Could not fetch marketplace stats for ${releaseId}`);
        return {
          releaseId,
          num_for_sale: 0,
          lowest_price: null,
          url: `https://www.discogs.com/sell/release/${releaseId}`
        };
      }

      const stats = await response.json();
      console.log(`Release ${releaseId}: ${stats.num_for_sale || 0}件出品中`);

      return {
        releaseId,
        num_for_sale: stats.num_for_sale || 0,
        lowest_price: stats.lowest_price,
        median_price: stats.median,
        highest_price: stats.highest_price,
        url: `https://www.discogs.com/sell/release/${releaseId}`
      };
    } catch (error) {
      console.error(`Error fetching marketplace for release ${releaseId}:`, error.message);
      return {
        releaseId,
        num_for_sale: 0,
        lowest_price: null,
        url: `https://www.discogs.com/sell/release/${releaseId}`
      };
    }
  }

  /**
   * アーティストを検索（サジェスチョン用）
   * @param {string} query - 検索クエリ
   * @returns {Promise<Array>} アーティストのリスト
   */
  async searchArtists(query) {
    try {
      const params = new URLSearchParams({
        q: query,
        type: 'artist'
      });

      const url = `${this.baseURL}/database/search?${params.toString()}`;
      console.log('Artist search URL:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Discogs token=${this.token}`,
          'User-Agent': 'DiscogsSellerOptimizer/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Artist search results:', data.results?.length || 0);
      return data.results || [];
    } catch (error) {
      console.error(`Error searching for artist ${query}:`, error.message);
      throw error;
    }
  }

  /**
   * アーティスト名とタイトルでリリースを検索
   * @param {string} artist - アーティスト名
   * @param {string} title - タイトル（オプション）
   * @param {Object} options - 検索オプション
   * @param {string} options.format - フォーマット（7", 12", LP等）
   * @param {string} options.year - 年代
   * @returns {Promise<Array>} 検索結果
   */
  async searchReleases(artist, title = '', options = {}) {
    try {
      // アーティスト名を正規化（括弧内の数字を削除）
      const cleanArtist = artist.replace(/\s*\(\d+\)\s*$/, '').trim();

      // クエリを構築
      let query = cleanArtist;
      if (title) {
        query += ` ${title}`;
      }

      // URLパラメータを構築
      const params = new URLSearchParams({
        q: query,
        type: 'release',
        artist: cleanArtist
      });

      // フォーマット指定
      if (options.format) {
        params.append('format', options.format);
      } else {
        params.append('format', 'Vinyl');
      }

      // 年代指定
      if (options.year) {
        params.append('year', options.year);
      }

      const url = `${this.baseURL}/database/search?${params.toString()}`;
      console.log('Search URL:', url);
      console.log('Original artist:', artist, '→ Clean artist:', cleanArtist);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Discogs token=${this.token}`,
          'User-Agent': 'DiscogsSellerOptimizer/1.0'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Search results count:', data.results?.length || 0);

      // 結果が0件の場合、さらに緩い検索を試みる
      if (data.results?.length === 0) {
        console.log('No results found, trying broader search...');
        const broaderParams = new URLSearchParams({
          q: cleanArtist,
          type: 'release'
        });

        if (options.format) {
          broaderParams.append('format', options.format);
        }

        const broaderUrl = `${this.baseURL}/database/search?${broaderParams.toString()}`;
        console.log('Broader search URL:', broaderUrl);

        const broaderResponse = await fetch(broaderUrl, {
          headers: {
            'Authorization': `Discogs token=${this.token}`,
            'User-Agent': 'DiscogsSellerOptimizer/1.0'
          }
        });

        if (broaderResponse.ok) {
          const broaderData = await broaderResponse.json();
          console.log('Broader search results count:', broaderData.results?.length || 0);
          return broaderData.results || [];
        }
      }

      return data.results || [];
    } catch (error) {
      console.error(`Error searching for ${artist} - ${title}:`, error.message);
      throw error;
    }
  }

  /**
   * リリース情報を取得
   * @param {number} releaseId - リリースID
   * @returns {Promise<Object>} リリース情報
   */
  async getRelease(releaseId) {
    try {
      const response = await fetch(
        `${this.baseURL}/releases/${releaseId}`,
        {
          headers: {
            'Authorization': `Discogs token=${this.token}`,
            'User-Agent': 'DiscogsSellerOptimizer/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching release ${releaseId}:`, error.message);
      throw error;
    }
  }

  /**
   * 複数のリリースIDから出品情報を取得
   */
  async getMultipleListings(releaseIds, onProgress) {
    const listings = [];
    const total = releaseIds.length;

    for (let i = 0; i < releaseIds.length; i++) {
      const releaseId = releaseIds[i];

      // 進捗を通知
      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          releaseId
        });
      }

      // Rate limit対策: リクエスト間に1秒待機
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      try {
        const listing = await this.getMarketplaceListing(releaseId);
        listings.push({
          releaseId,
          data: listing
        });
      } catch (error) {
        console.error(`Failed to fetch listing for release ${releaseId}`);
        listings.push({
          releaseId,
          data: null,
          error: error.message
        });
      }
    }

    return listings;
  }
}
