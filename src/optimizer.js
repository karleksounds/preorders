import { DiscogsClient } from './discogsClient.js';
import { filterListings, groupBySeller } from './filters.js';
import { calculateOverallScore, calculateSellerTotalCost } from './costCalculator.js';

/**
 * 複数のリリースを購入する際の最適な出品者を見つける
 * @param {number[]} releaseIds - リリースIDの配列
 * @param {Object} options - オプション
 * @param {string} options.token - Discogs APIトークン
 * @param {boolean} options.requiresJapanShipping - 日本への配送必須
 * @param {boolean} options.requiresSleeve - ジャケット必須
 * @param {string} options.minMediaCondition - 最低盤コンディション
 * @param {string} options.minSleeveCondition - 最低ジャケットコンディション
 * @param {number} options.topN - 表示する上位の出品者数
 * @returns {Promise<Object>} 最適な出品者の情報
 */
export async function findBestSeller(releaseIds, options = {}) {
  const {
    token,
    requiresJapanShipping = true,
    requiresSleeve = false,
    minMediaCondition = 'VG',
    minSleeveCondition = 'G',
    topN = 5
  } = options;

  if (!token) {
    throw new Error('Discogs API token is required');
  }

  if (!releaseIds || releaseIds.length === 0) {
    throw new Error('At least one release ID is required');
  }

  console.log(`\n検索中: ${releaseIds.length}件のリリース...`);
  console.log(`リリースID: ${releaseIds.join(', ')}\n`);

  // Step 1: Discogs APIから出品情報を取得
  const client = new DiscogsClient(token);
  const allListings = await client.getMultipleListings(releaseIds);

  // Step 2: 出品者ごとにグループ化
  const sellerMap = groupBySeller(allListings);
  const sellerIds = Object.keys(sellerMap);

  console.log(`${sellerIds.length}人の出品者を発見\n`);

  // Step 3: 全てのリリースを持っている出品者のみをフィルタリング
  const sellersWithAllReleases = sellerIds.filter(sellerId => {
    const seller = sellerMap[sellerId];
    return seller.releaseIds.size === releaseIds.length;
  });

  console.log(`全てのリリースを持っている出品者: ${sellersWithAllReleases.length}人\n`);

  if (sellersWithAllReleases.length === 0) {
    return {
      success: false,
      message: '全てのリリースを持っている出品者が見つかりませんでした。',
      availableSellers: analyzeSellersWithPartialItems(sellerMap, releaseIds)
    };
  }

  // Step 4: 条件に合う出品者をフィルタリング
  const filteredSellers = [];

  for (const sellerId of sellersWithAllReleases) {
    const sellerData = sellerMap[sellerId];

    // 各出品をフィルタリング
    const filteredListings = filterListings(sellerData.listings, {
      requiresJapanShipping,
      requiresSleeve,
      minMediaCondition,
      minSleeveCondition
    });

    // フィルタリング後も全てのリリースが残っているか確認
    const remainingReleaseIds = new Set(filteredListings.map(l => l.releaseId));

    if (remainingReleaseIds.size === releaseIds.length) {
      filteredSellers.push({
        ...sellerData,
        listings: filteredListings
      });
    }
  }

  console.log(`条件に合う出品者: ${filteredSellers.length}人\n`);

  if (filteredSellers.length === 0) {
    return {
      success: false,
      message: '条件に合う出品者が見つかりませんでした。',
      suggestion: 'フィルター条件を緩和してみてください。'
    };
  }

  // Step 5: 各出品者のスコアを計算
  const rankedSellers = filteredSellers.map(sellerData => {
    const scores = calculateOverallScore(sellerData);

    return {
      seller: sellerData.seller,
      listings: sellerData.listings,
      scores
    };
  });

  // Step 6: 総合スコアでソート
  rankedSellers.sort((a, b) => b.scores.overallScore - a.scores.overallScore);

  // 上位N人を返す
  const topSellers = rankedSellers.slice(0, topN);

  return {
    success: true,
    bestSeller: topSellers[0],
    topSellers,
    totalAnalyzed: sellerIds.length,
    totalWithAllItems: sellersWithAllReleases.length,
    totalQualified: filteredSellers.length
  };
}

/**
 * 一部のアイテムのみを持っている出品者を分析
 * @param {Object} sellerMap - 出品者マップ
 * @param {number[]} releaseIds - リリースIDの配列
 * @returns {Array} 部分的に持っている出品者のリスト
 */
function analyzeSellersWithPartialItems(sellerMap, releaseIds) {
  const partial = [];

  for (const [sellerId, sellerData] of Object.entries(sellerMap)) {
    const itemCount = sellerData.releaseIds.size;

    if (itemCount > 0 && itemCount < releaseIds.length) {
      const cost = calculateSellerTotalCost(sellerData);

      partial.push({
        seller: sellerData.seller,
        itemCount,
        missingCount: releaseIds.length - itemCount,
        totalCost: cost.totalCost,
        currency: cost.currency,
        releaseIds: Array.from(sellerData.releaseIds)
      });
    }
  }

  // アイテム数でソート
  partial.sort((a, b) => b.itemCount - a.itemCount);

  return partial.slice(0, 10); // 上位10人
}

/**
 * 結果を見やすく表示
 * @param {Object} result - findBestSellerの結果
 */
export function displayResults(result) {
  if (!result.success) {
    console.log(`\n❌ ${result.message}\n`);

    if (result.availableSellers && result.availableSellers.length > 0) {
      console.log('一部のアイテムを持っている出品者:');
      console.log('━'.repeat(80));

      result.availableSellers.forEach((seller, index) => {
        console.log(`\n${index + 1}. ${seller.seller.username}`);
        console.log(`   アイテム数: ${seller.itemCount}/${seller.itemCount + seller.missingCount}`);
        console.log(`   総額: ${seller.totalCost} ${seller.currency}`);
      });
    }

    return;
  }

  console.log('\n✅ 最適な出品者を見つけました!\n');
  console.log('━'.repeat(80));

  result.topSellers.forEach((seller, index) => {
    const { seller: sellerInfo, listings, scores } = seller;

    console.log(`\n${index + 1}位: ${sellerInfo.username}`);
    console.log('─'.repeat(80));
    console.log(`総合スコア: ${scores.overallScore}`);
    console.log(`\n【コスト情報】`);
    console.log(`  商品合計: ${scores.costInfo.itemsTotal} ${scores.costInfo.currency}`);
    console.log(`  送料: ${scores.costInfo.shippingCost} ${scores.costInfo.currency}`);
    console.log(`  総額: ${scores.costInfo.totalCost} ${scores.costInfo.currency}`);
    console.log(`\n【品質情報】`);
    console.log(`  平均品質スコア: ${scores.qualityScore}/10`);
    console.log(`  コスパスコア: ${scores.valueScore}`);
    console.log(`\n【出品詳細】`);

    listings.forEach(listing => {
      console.log(`  • Release ID: ${listing.releaseId}`);
      console.log(`    価格: ${listing.price?.value} ${listing.price?.currency}`);
      console.log(`    盤: ${listing.condition} | ジャケット: ${listing.sleeve_condition || 'なし'}`);
    });
  });

  console.log('\n━'.repeat(80));
  console.log(`\n分析結果: ${result.totalAnalyzed}人中、${result.totalQualified}人が条件に合致`);
}
