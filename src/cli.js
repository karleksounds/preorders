#!/usr/bin/env node

import { Command } from 'commander';
import { findBestSeller, displayResults } from './optimizer.js';

const program = new Command();

program
  .name('discogs-optimizer')
  .description('Discogsで複数のレコードを一括購入する際に最もお得な出品者を見つけるツール')
  .version('1.0.0');

program
  .command('find')
  .description('最適な出品者を探す')
  .argument('<releaseIds...>', 'リリースID（スペース区切りで複数指定可能）')
  .option('-t, --token <token>', 'Discogs APIトークン（環境変数DISCOGS_TOKENからも取得可能）')
  .option('--no-japan-shipping', '日本への配送を必須としない')
  .option('--require-sleeve', 'ジャケット必須')
  .option('--min-media <condition>', '最低盤コンディション', 'VG')
  .option('--min-sleeve <condition>', '最低ジャケットコンディション', 'G')
  .option('--top <number>', '表示する上位の出品者数', '5')
  .action(async (releaseIds, options) => {
    try {
      // トークンの取得
      const token = options.token || process.env.DISCOGS_TOKEN;

      if (!token) {
        console.error('エラー: Discogs APIトークンが必要です。');
        console.error('--token オプションで指定するか、環境変数DISCOGS_TOKENを設定してください。');
        console.error('\nトークンの取得方法: https://www.discogs.com/settings/developers');
        process.exit(1);
      }

      // リリースIDを数値に変換
      const releaseIdNumbers = releaseIds.map(id => {
        const num = parseInt(id, 10);
        if (isNaN(num)) {
          throw new Error(`無効なリリースID: ${id}`);
        }
        return num;
      });

      // オプションの設定
      const searchOptions = {
        token,
        requiresJapanShipping: options.japanShipping !== false,
        requiresSleeve: options.requireSleeve || false,
        minMediaCondition: options.minMedia,
        minSleeveCondition: options.minSleeve,
        topN: parseInt(options.top, 10)
      };

      console.log('\n🎵 Discogs Seller Optimizer 🎵');
      console.log('━'.repeat(80));
      console.log('\n設定:');
      console.log(`  日本への配送: ${searchOptions.requiresJapanShipping ? '必須' : '不要'}`);
      console.log(`  ジャケット: ${searchOptions.requiresSleeve ? '必須' : 'オプション'}`);
      console.log(`  最低盤コンディション: ${searchOptions.minMediaCondition}`);
      console.log(`  最低ジャケットコンディション: ${searchOptions.minSleeveCondition}`);

      // 検索実行
      const result = await findBestSeller(releaseIdNumbers, searchOptions);

      // 結果表示
      displayResults(result);

    } catch (error) {
      console.error('\nエラーが発生しました:', error.message);
      process.exit(1);
    }
  });

program
  .command('conditions')
  .description('Discogsのコンディション一覧を表示')
  .action(() => {
    console.log('\n📀 Discogsのコンディション基準\n');
    console.log('━'.repeat(80));
    console.log('\n【盤・ジャケット共通】');
    console.log('  M (Mint)              : 完璧な状態（未開封）');
    console.log('  NM (Near Mint)        : ほぼ完璧な状態');
    console.log('  VG+ (Very Good Plus)  : 多少の使用感はあるが良好');
    console.log('  VG (Very Good)        : 使用感はあるが問題なく再生可能');
    console.log('  G+ (Good Plus)        : かなりの使用感あり');
    console.log('  G (Good)              : 明確なダメージあり');
    console.log('  F (Fair)              : 大きなダメージあり');
    console.log('  P (Poor)              : 状態が非常に悪い');
    console.log('\n【ジャケットのみ】');
    console.log('  No Cover              : ジャケットなし');
    console.log('  Generic               : 汎用スリーブのみ');
    console.log('\n━'.repeat(80));
  });

// ヘルプテキストをカスタマイズ
program.addHelpText('after', `

使用例:
  $ discogs-optimizer find 123456 234567 345678
  $ discogs-optimizer find 123456 --require-sleeve --min-media VG+
  $ discogs-optimizer find 123456 234567 --no-japan-shipping
  $ discogs-optimizer conditions

環境変数:
  DISCOGS_TOKEN    Discogs APIトークン

詳細情報:
  https://github.com/yourusername/discogs-seller-optimizer
`);

program.parse();
