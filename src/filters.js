/**
 * Discogsのコンディション評価
 * M (Mint) = 5, NM (Near Mint) = 4.5, VG+ = 4, VG = 3, G+ = 2, G = 1, P (Poor) = 0
 */
const CONDITION_SCORES = {
  'M': 5,
  'Mint (M)': 5,
  'NM or M-': 4.5,
  'Near Mint (NM or M-)': 4.5,
  'VG+': 4,
  'Very Good Plus (VG+)': 4,
  'VG': 3,
  'Very Good (VG)': 3,
  'G+': 2,
  'Good Plus (G+)': 2,
  'G': 1,
  'Good (G)': 1,
  'F': 0.5,
  'Fair (F)': 0.5,
  'P': 0,
  'Poor (P)': 0,
  'No Cover': 0,
  'Generic': 0.5
};

/**
 * コンディション文字列をスコアに変換
 * @param {string} condition - コンディション文字列
 * @returns {number} スコア（0-5）
 */
export function getConditionScore(condition) {
  if (!condition) return 0;

  // 完全一致を試す
  if (CONDITION_SCORES.hasOwnProperty(condition)) {
    return CONDITION_SCORES[condition];
  }

  // 部分一致を試す（例: "VG+ (Very Good Plus)"のような形式に対応）
  for (const [key, score] of Object.entries(CONDITION_SCORES)) {
    if (condition.includes(key)) {
      return score;
    }
  }

  return 0;
}

/**
 * 日本への配送が可能かチェック
 * @param {Object} listing - 出品情報
 * @returns {boolean} 配送可能ならtrue
 */
export function shipsToJapan(listing) {
  if (!listing.shipping) return false;

  // 日本への配送を確認
  // Discogsでは "ships_to" に国コードが含まれる、または "Worldwide" の場合がある
  const shipsTo = listing.ships_from || '';

  // 日本からの出品、または日本への配送を明示的に許可している場合
  if (shipsTo.includes('Japan') || shipsTo.includes('JP')) {
    return true;
  }

  // 全世界配送の場合
  if (listing.shipping.some(s => s.includes('Worldwide') || s.includes('International'))) {
    return true;
  }

  return false;
}

/**
 * ジャケット（スリーブ）の有無をチェック
 * @param {Object} listing - 出品情報
 * @returns {boolean} ジャケットがある場合true
 */
export function hasSleeve(listing) {
  if (!listing.sleeve_condition) return false;

  const sleeveCondition = listing.sleeve_condition.toLowerCase();

  // "No Cover", "Generic", "Not Graded" などはジャケットなしとみなす
  if (sleeveCondition.includes('no cover') ||
      sleeveCondition.includes('generic') ||
      sleeveCondition === '') {
    return false;
  }

  return true;
}

/**
 * 出品リストをフィルタリング
 * @param {Array} listings - 出品情報の配列
 * @param {Object} options - フィルタオプション
 * @param {boolean} options.requiresJapanShipping - 日本への配送必須
 * @param {boolean} options.requiresSleeve - ジャケット必須
 * @param {string} options.minMediaCondition - 最低盤コンディション
 * @param {string} options.minSleeveCondition - 最低ジャケットコンディション
 * @returns {Array} フィルタリングされた出品情報
 */
export function filterListings(listings, options = {}) {
  const {
    requiresJapanShipping = true,
    requiresSleeve = false,
    minMediaCondition = 'G',
    minSleeveCondition = 'G'
  } = options;

  const minMediaScore = getConditionScore(minMediaCondition);
  const minSleeveScore = getConditionScore(minSleeveCondition);

  return listings.filter(listing => {
    // 日本への配送チェック
    if (requiresJapanShipping && !shipsToJapan(listing)) {
      return false;
    }

    // ジャケット有無チェック
    if (requiresSleeve && !hasSleeve(listing)) {
      return false;
    }

    // 盤コンディションチェック
    const mediaScore = getConditionScore(listing.condition);
    if (mediaScore < minMediaScore) {
      return false;
    }

    // ジャケットコンディションチェック（ジャケットがある場合のみ）
    if (listing.sleeve_condition) {
      const sleeveScore = getConditionScore(listing.sleeve_condition);
      if (sleeveScore < minSleeveScore) {
        return false;
      }
    }

    return true;
  });
}

/**
 * 複数リリースの出品情報を出品者ごとにグループ化
 * @param {Array} multipleListings - 複数のリリースの出品情報
 * @returns {Object} 出品者ごとにグループ化されたデータ
 */
export function groupBySeller(multipleListings) {
  const sellerMap = {};

  for (const { releaseId, data } of multipleListings) {
    if (!data || !data.listings) continue;

    for (const listing of data.listings) {
      const sellerId = listing.seller?.id || listing.seller?.username;
      if (!sellerId) continue;

      if (!sellerMap[sellerId]) {
        sellerMap[sellerId] = {
          seller: listing.seller,
          listings: [],
          releaseIds: new Set()
        };
      }

      sellerMap[sellerId].listings.push({
        ...listing,
        releaseId
      });
      sellerMap[sellerId].releaseIds.add(releaseId);
    }
  }

  return sellerMap;
}
