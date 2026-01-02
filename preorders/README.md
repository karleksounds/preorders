# Record Preorders Aggregator

海外レコード店の予約情報を集約し、発売日順に表示するWebアプリケーション。

🌐 **Live Demo**: [https://YOUR_USERNAME.github.io/tool/](https://YOUR_USERNAME.github.io/tool/)
（GitHub Pagesで公開中。毎日自動更新されます）

## 対象ストア

- Norman Records
- Cargo Records
- Banquet Records

## 機能

- 複数のレコード店からpreorder情報を自動収集
- 発売日順でソート表示
- フォーマット別フィルター（7" / LP）
- 月別ページネーション
- iTunes プレビュー再生
- 🤖 GitHub Actionsで毎日自動更新

## クイックスタート

### オンラインで見る（推奨）

[GitHub Pages版](https://YOUR_USERNAME.github.io/tool/)にアクセスするだけ！
データは毎日自動更新されます。

### ローカルで開発する

#### 1. 依存関係のインストール

```bash
cd preorders
npm install
```

#### 2. データの取得

```bash
npm run scrape
```

#### 3. ローカルで表示

静的ファイルなので、`index.html`をブラウザで直接開くか：

```bash
# Pythonのシンプルサーバーで起動
python3 -m http.server 8081

# または、Node.jsサーバーで起動（開発用）
npm start
```

ブラウザで `http://localhost:8081` にアクセス。

---

## GitHub Pagesへのデプロイ

このプロジェクトはGitHub Pagesで自動デプロイされます。

### 初回設定

1. **リポジトリ設定**
   - GitHubリポジトリの Settings → Pages
   - Source: "GitHub Actions" を選択

2. **コミット & プッシュ**
   ```bash
   git add .
   git commit -m "Setup GitHub Pages"
   git push
   ```

3. **自動デプロイ**
   - プッシュ後、GitHub Actionsが自動的に実行されます
   - Actions タブで進行状況を確認できます
   - 完了後、`https://YOUR_USERNAME.github.io/tool/` でアクセス可能

### 自動更新

- **毎日UTC 0:00 (JST 9:00)** に自動スクレイピング実行
- データ更新後、自動的にGitHub Pagesへデプロイ
- Actions タブから手動実行も可能

## 使い方

### ローカル開発

#### サーバー起動（開発用）

```bash
npm start
```

ブラウザで `http://localhost:8081` にアクセス。

#### 手動データ更新

最新のpreorder情報を今すぐ取得したい場合：

```bash
npm run scrape
```

#### サーバーの停止

`Ctrl + C` を押してください。

## ディレクトリ構成

```
.
├── src/
│   ├── index.js              # メインスクリプト
│   ├── scrapers/             # 各ストアのスクレイパー
│   │   ├── normanRecords.js
│   │   ├── cargoRecords.js
│   │   └── banquetRecords.js
│   └── services/
│       └── itunes.js         # iTunes API連携
├── css/
│   ├── styles.scss          # スタイルシート（SCSS）
│   └── styles.min.css       # コンパイル済みCSS（自動生成）
├── scripts/
│   └── main.js              # フロントエンド（JavaScript）
├── data/
│   └── records.json         # 生成されたデータ
├── index.html               # フロントエンド（HTML）
├── server.js                # Expressサーバー
├── package.json
└── README.md
```

## カスタマイズ

### ストアの追加

新しいレコード店を追加する場合：

1. `src/scrapers/`に新しいスクレイパーファイルを作成
2. `src/index.js`でインポートして実行

例：

```javascript
// src/scrapers/newStore.js
const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeNewStore() {
  // スクレイピングロジック
  return results;
}

module.exports = scrapeNewStore;
```

```javascript
// src/index.js に追加
const scrapeNewStore = require('./scrapers/newStore');

// main関数内
const newStoreResults = await scrapeNewStore();
allRecords = [...allRecords, ...newStoreResults];
```

### スタイルの変更

`css/styles.scss`を編集して、デザインをカスタマイズできます。

SCSSをコンパイルするには：

```bash
npm run build:css:preorders
```

## トラブルシューティング

### データが取得できない

- ウェブサイトの構造が変更された可能性があります
- スクレイパーのセレクターを更新する必要があります
- ネットワーク接続を確認してください

## 注意事項

- スクレイピングは各サイトの利用規約に従って実行してください
- 過度なリクエストを避け、適切な間隔でスクレイピングを実行してください
- 本ツールは個人利用を想定しています

## ライセンス

MIT
