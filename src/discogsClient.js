import axios from 'axios';

/**
 * Discogs APIクライアント
 */
export class DiscogsClient {
  constructor(token) {
    if (!token) {
      throw new Error('Discogs API token is required');
    }

    this.token = token;
    this.baseURL = 'https://api.discogs.com';
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Discogs token=${token}`,
        'User-Agent': 'DiscogsSellerOptimizer/1.0'
      }
    });
  }

  /**
   * リリースIDから出品情報を取得
   * @param {number} releaseId - リリースID
   * @returns {Promise<Object>} 出品情報
   */
  async getMarketplaceListing(releaseId) {
    try {
      const response = await this.client.get(`/marketplace/listings?release_id=${releaseId}&status=For Sale`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching listings for release ${releaseId}:`, error.message);
      throw error;
    }
  }

  /**
   * 複数のリリースIDから出品情報を取得
   * @param {number[]} releaseIds - リリースIDの配列
   * @returns {Promise<Object[]>} 出品情報の配列
   */
  async getMultipleListings(releaseIds) {
    const listings = [];

    for (const releaseId of releaseIds) {
      // Rate limit対策: リクエスト間に1秒待機
      await new Promise(resolve => setTimeout(resolve, 1000));

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

  /**
   * 出品者情報を取得
   * @param {string} username - 出品者のユーザー名
   * @returns {Promise<Object>} 出品者情報
   */
  async getSellerInfo(username) {
    try {
      const response = await this.client.get(`/users/${username}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching seller info for ${username}:`, error.message);
      throw error;
    }
  }

  /**
   * 出品者の評価情報を取得
   * @param {string} username - 出品者のユーザー名
   * @returns {Promise<Object>} 評価情報
   */
  async getSellerRating(username) {
    try {
      const response = await this.client.get(`/users/${username}/ratings`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching seller rating for ${username}:`, error.message);
      return null;
    }
  }
}
