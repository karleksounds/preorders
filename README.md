# Vinyl Tools Hub

レコード収集を快適にするツール集です。

## 📦 含まれるツール

### 1. Discogs Seller Optimizer
Discogsで複数のレコードを一括購入する際に、最もお得な出品者を見つけるツール

### 2. Record Preorders Aggregator
海外レコード店の予約情報を集約し、発売日順に表示するツール

---

## 🚀 クイックスタート

### トップページを開く

```bash
open index.html
```

または、プロジェクトルートでシンプルなHTTPサーバーを起動：

```bash
python3 -m http.server 3000
# ブラウザで http://localhost:3000 を開く
```

### 各ツールの起動

#### Discogs Optimizer

```bash
npm run serve:discogs
# ブラウザで http://localhost:8080 を開く
```

または直接開く：

```bash
open discogs/index.html
```

#### Preorders Aggregator

```bash
npm run serve:preorders
# ブラウザで http://localhost:8080 を開く
```

---

# Discogs Seller Optimizer の詳細

Discogsで複数のレコードを一括購入する際に、最もお得な出品者を見つけるツールです。

## 機能

- 日本への発送対応出品者のフィルタリング
- ジャケット有無でのフィルタリング
- 盤とジャケットの状態による評価
- 商品価格の合計計算（選択した商品のみ）
- コンディションによる絞り込み（Mint, NM, VG+, VG, G+, Generic等）
- 最適な出品者の提案

## ブラウザ版（推奨）

ブラウザで簡単に使えるWebアプリケーション版です。出品者ごとの比較機能も統合されています。

### 使い方

1. **Discogs APIトークンを取得**
   - https://www.discogs.com/settings/developers にアクセス
   - Personal Access Tokenを作成

2. **スクレイピングサーバーとWebサーバーを起動**
   ```bash
   npm install
   npm run dev
   ```

   これにより以下のサーバーが起動します：
   - スクレイピングサーバー: http://localhost:3001
   - Webアプリ: http://localhost:8080

3. **ブラウザでアクセス**
   - http://localhost:8080 を開く
   - APIトークンとアーティスト名を入力して検索
   - 購入したいリリースにチェックを入れる
   - 「選択したリリースで出品者を比較」ボタンをクリック
   - 出品者ごとに整理された結果が新しいウィンドウで表示されます

### 簡易起動（検索機能のみ）

スクレイピング機能を使わず、検索機能だけ使いたい場合：

```bash
npm run serve
# または
cd discogs
python3 -m http.server 8080
```

ブラウザで http://localhost:8080 にアクセス

### スタイル開発

スタイルはSCSSで管理されています：

```bash
# SCSSをコンパイル（1回のみ）
npm run build:css

# SCSSをウォッチモード（自動コンパイル）
npm run watch:css
```

- ソースファイル: `discogs/css/styles.scss`
- 出力ファイル: `discogs/css/styles.min.css`（自動生成、Gitで管理しない）

## マーケットプレイス スクレイパー＆ビューアー（新機能）

Discogsのマーケットプレイスページから出品者情報を取得し、**出品者ごとに整理して表示**できます。

### 使い方

#### 1. データ取得

```bash
# インストール（初回のみ）
npm install

# スクレイピング実行
node scraper.js "https://www.discogs.com/ja/sell/list?artist_id=112154&format_desc=7%22"
```

#### 2. データ表示

```bash
# ビューアーを開く
open viewer.html
# または
python3 -m http.server 8080
# ブラウザで http://localhost:8080/viewer.html にアクセス
```

ビューアーで生成されたJSONファイルを読み込むと：
- 出品者ごとにグループ化して表示
- 各商品にチェックボックスがあり、選択した商品のみ合計金額を計算
- 盤とジャケットのコンディションでフィルタリング可能（Mint, NM, VG+, VG, G+, Generic等）
- 出品数順、合計金額順、名前順で並び替え可能
- 各出品者の詳細をクリックで展開

### 取得できる情報

- 出品者名
- 出品者評価
- 所在地
- リリースタイトル
- メディアコンディション（盤質）
- スリーブコンディション（ジャケット質）
- コメント
- 価格
- 通貨
- 送料

### 出力ファイル

- `discogs_marketplace_YYYY-MM-DD.json` - 出品者ごとにグループ化（JSON形式）

### 注意事項

- このツールはDiscogsの公開ページから情報を取得します
- 大量のリクエストを短時間で行わないでください
- Discogsの利用規約を遵守してください

## CLI版

コマンドラインから使用したい場合

### インストール

```bash
npm install
```

### 環境変数の設定

```bash
# Discogs API Token
export DISCOGS_TOKEN=your_token_here
```

### 実行

```bash
# 基本的な使い方
npm start find 123456 234567 345678

# ジャケット必須で検索
npm start find 123456 234567 --require-sleeve

# より良い盤質を指定（VG+以上）
npm start find 123456 234567 --min-media VG+

# コンディション一覧を表示
npm start conditions
```

## プログラムから使用

```javascript
import { findBestSeller } from './src/optimizer.js';

const releaseIds = [123456, 234567, 345678]; // 購入したいリリースのID

const result = await findBestSeller(releaseIds, {
  token: 'your_token_here',
  requiresJapanShipping: true,
  requiresSleeve: true,
  minMediaCondition: 'VG+',
  minSleeveCondition: 'VG'
});

console.log('最適な出品者:', result);
```
