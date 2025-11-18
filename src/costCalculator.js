import { getConditionScore } from './filters.js';

/**
 * 出品者の全出品アイテムの合計コスト（商品価格 + 送料）を計算
 * @param {Object} sellerData - 出品者データ
 * @param {Array} sellerData.listings - 出品リスト
 * @returns {Object} コスト情報
 */
export function calculateSellerTotalCost(sellerData) {
  const { listings } = sellerData;

  if (!listings || listings.length === 0) {
    return {
      itemsTotal: 0,
      shippingCost: 0,
      totalCost: 0,
      itemCount: 0,
      currency: 'USD'
    };
  }

  // アイテム合計金額を計算
  let itemsTotal = 0;
  let currency = 'USD';

  for (const listing of listings) {
    const price = parseFloat(listing.price?.value || 0);
    itemsTotal += price;

    if (listing.price?.currency) {
      currency = listing.price.currency;
    }
  }

  // 送料を計算（通常、複数購入時は1回分の送料）
  // Discogsでは最初の商品の送料を基準とし、追加商品ごとに追加料金がかかる場合がある
  let shippingCost = 0;

  if (listings[0].shipping && listings[0].shipping.length > 0) {
    // 日本への送料を探す（なければ最初の送料を使用）
    const japanShipping = listings[0].shipping.find(s => s.includes('Japan') || s.includes('International'));
    const shippingInfo = japanShipping || listings[0].shipping[0];

    // 送料の値を抽出（文字列から数値を抽出）
    const shippingMatch = shippingInfo.match(/[\d.]+/);
    if (shippingMatch) {
      shippingCost = parseFloat(shippingMatch[0]);
    }
  }

  // 複数アイテムの追加送料を考慮（簡易計算: 2個目以降は50%の送料）
  if (listings.length > 1) {
    shippingCost += shippingCost * 0.5 * (listings.length - 1);
  }

  const totalCost = itemsTotal + shippingCost;

  return {
    itemsTotal: parseFloat(itemsTotal.toFixed(2)),
    shippingCost: parseFloat(shippingCost.toFixed(2)),
    totalCost: parseFloat(totalCost.toFixed(2)),
    itemCount: listings.length,
    currency
  };
}

/**
 * 出品の品質スコアを計算
 * @param {Object} listing - 出品情報
 * @returns {number} 品質スコア（0-10）
 */
export function calculateQualityScore(listing) {
  const mediaScore = getConditionScore(listing.condition);
  const sleeveScore = listing.sleeve_condition ? getConditionScore(listing.sleeve_condition) : 0;

  // 盤の状態を70%、ジャケットの状態を30%の重み付けで評価
  const qualityScore = (mediaScore * 0.7 + sleeveScore * 0.3) * 2; // 0-10のスケールに変換

  return parseFloat(qualityScore.toFixed(2));
}

/**
 * 出品者の平均品質スコアを計算
 * @param {Object} sellerData - 出品者データ
 * @returns {number} 平均品質スコア
 */
export function calculateAverageQuality(sellerData) {
  const { listings } = sellerData;

  if (!listings || listings.length === 0) return 0;

  const totalQuality = listings.reduce((sum, listing) => {
    return sum + calculateQualityScore(listing);
  }, 0);

  return parseFloat((totalQuality / listings.length).toFixed(2));
}

/**
 * コストパフォーマンススコアを計算（品質 / コスト）
 * 高いほど良い
 * @param {Object} sellerData - 出品者データ
 * @returns {number} コスパスコア
 */
export function calculateValueScore(sellerData) {
  const costInfo = calculateSellerTotalCost(sellerData);
  const qualityScore = calculateAverageQuality(sellerData);

  if (costInfo.totalCost === 0) return 0;

  // 品質スコア / コスト（100ドルあたりで正規化）
  const valueScore = (qualityScore / costInfo.totalCost) * 100;

  return parseFloat(valueScore.toFixed(2));
}

/**
 * 総合評価スコアを計算
 * @param {Object} sellerData - 出品者データ
 * @returns {Object} 評価情報
 */
export function calculateOverallScore(sellerData) {
  const costInfo = calculateSellerTotalCost(sellerData);
  const qualityScore = calculateAverageQuality(sellerData);
  const valueScore = calculateValueScore(sellerData);

  // 出品者評価も考慮（あれば）
  let sellerRating = 100; // デフォルト
  if (sellerData.seller?.stats) {
    const stats = sellerData.seller.stats;
    if (stats.rating) {
      sellerRating = parseFloat(stats.rating);
    }
  }

  // 総合スコア: コスパ40% + 品質30% + 出品者評価30%
  const overallScore = (valueScore * 0.4) + (qualityScore * 3) + (sellerRating * 0.3);

  return {
    overallScore: parseFloat(overallScore.toFixed(2)),
    costInfo,
    qualityScore,
    valueScore,
    sellerRating
  };
}
