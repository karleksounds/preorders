# Record Preorders Aggregator

海外レコード店の予約情報を集約し、発売日順に表示するWebアプリケーション。

## 対象ストア

- Norman Records
- Juno Records
- Rough Trade

## 機能

- 複数のレコード店からpreorder情報を自動収集
- 発売日順でソート表示
- Spotify連携（アルバムの試聴リンク）
- フォーマット別フィルター（LP / 12" / 7" / 10"）
- ストア別フィルター
- アーティスト/タイトル検索

## クイックスタート

### 1. 依存関係のインストール

```bash
npm install
```

### 2. SCSSのコンパイル

VS Codeの拡張機能（Live Sass Compilerなど）を使用して、`public/css/styles.scss` → `public/css/styles.min.css` をコンパイルしてください。

### 3. サーバー起動

```bash
npm start
```

ブラウザで `http://localhost:8080` にアクセス。

**これだけです！** 初回アクセス時に自動的にデータを取得します。

---

## 詳細設定

### Spotify API設定（オプション）

Spotify連携を使用する場合は、以下の手順でAPIキーを取得してください：

1. [Spotify for Developers](https://developer.spotify.com/dashboard)にアクセス
2. アプリケーションを作成
3. Client IDとClient Secretを取得
4. プロジェクトルート（`tool/`）に`.env`ファイルを作成：

```bash
cd /Users/kae.iguchi/tool
cp .env.example .env
```

5. `.env`ファイルを編集し、取得したCredentialsを設定：

```
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
```

**注意:**
- `.env`ファイルは`tool/`ディレクトリ（preordersとdiscogsの親ディレクトリ）に配置します
- Spotify APIの設定は必須ではありません。設定しない場合は、Spotify連携機能がスキップされます。

---

## 使い方

### 起動方法

```bash
npm start
```

ブラウザで `http://localhost:8080` にアクセス。

### 自動データ更新

- データは24時間ごとに自動的に更新されます
- 初回アクセス時や、データが古い場合は自動的にスクレイピングを実行します
- スクレイピング中は「数分後に再読み込みしてください」と表示されます

### 手動データ更新

最新のpreorder情報を今すぐ取得したい場合：

```bash
npm run scrape
```

### サーバーの停止

`Ctrl + C` を押してください。

## ディレクトリ構成

```
.
├── src/
│   ├── index.js              # メインスクリプト
│   ├── scrapers/             # 各ストアのスクレイパー
│   │   ├── normanRecords.js
│   │   ├── junoRecords.js
│   │   └── roughTrade.js
│   └── services/
│       └── spotify.js        # Spotify API連携
├── public/
│   ├── index.html           # フロントエンド（HTML）
│   ├── css/
│   │   ├── styles.scss      # スタイルシート（SCSS）
│   │   └── styles.min.css   # コンパイル済みCSS（自動生成）
│   ├── scripts/
│   │   └── main.js          # フロントエンド（JavaScript）
│   └── data/
│       └── records.json     # 生成されたデータ
├── data/
│   └── records.json         # バックアップデータ
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

`public/css/styles.scss`を編集して、デザインをカスタマイズできます。

VS Codeの拡張機能で自動コンパイルが有効になっていれば、保存時に自動的に`styles.min.css`が生成されます。

## トラブルシューティング

### データが取得できない

- ウェブサイトの構造が変更された可能性があります
- スクレイパーのセレクターを更新する必要があります
- ネットワーク接続を確認してください

### Spotifyが動作しない

- `.env`ファイルが正しく設定されているか確認
- Spotify APIの認証情報が有効か確認
- Spotify APIのレート制限に達していないか確認

## 注意事項

- スクレイピングは各サイトの利用規約に従って実行してください
- 過度なリクエストを避け、適切な間隔でスクレイピングを実行してください
- 本ツールは個人利用を想定しています

## ライセンス

MIT
