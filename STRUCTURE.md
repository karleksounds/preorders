# プロジェクト構造

```
/Users/kae.iguchi/tool/
├── index.html                 # トップページ（ツールナビゲーションハブ）
├── package.json               # 統合されたnpmスクリプト
├── README.md                  # メインドキュメント
│
├── shared/                    # 共通リソース
│   ├── css/
│   │   ├── _variables.scss   # 共通変数（色、フォントサイズ等）
│   │   ├── _base.scss        # ベーススタイル
│   │   └── _mixins.scss      # 共通ミックスイン
│   ├── js/
│   │   └── utils.js          # 共通JSユーティリティ
│   └── images/               # 共通画像ファイル
│
├── discogs/                   # Discogs Optimizer ツール
│   ├── index.html            # メインページ
│   ├── viewer.html           # ビューアーページ
│   ├── css/
│   │   ├── styles.scss       # Discogs固有のスタイル
│   │   └── styles.min.css    # コンパイル済みCSS
│   ├── js/                   # JavaScript ファイル
│   └── images/               # 画像ファイル
│
├── preorders/                 # Preorders Aggregator ツール
│   ├── index.html            # メインページ
│   ├── server.js             # Express サーバー
│   ├── package.json          # preorders専用の依存関係
│   ├── css/
│   │   ├── styles.scss       # Preorders固有のスタイル
│   │   └── styles.min.css    # コンパイル済みCSS
│   ├── scripts/              # JavaScript ファイル
│   ├── data/
│   │   └── records.json      # スクレイピングデータ
│   └── src/                  # スクレイパー・サービス
│       ├── index.js
│       ├── scrapers/
│       │   ├── cargoRecords.js
│       │   └── banquetRecords.js
│       └── services/
│           ├── spotify.js
│           └── itunes.js
│
├── scraper-server.js          # Discogsスクレイピングサーバー
└── src/                       # Discogs CLI関連コード
    ├── cli.js
    ├── optimizer.js
    └── ...
```

## 使用方法

### 開発コマンド

```bash
# 全てのSCSSをビルド
npm run build:css

# Discogs用SCSSをビルド
npm run build:css:discogs

# Preorders用SCSSをビルド
npm run build:css:preorders

# Discogs用SCSSをウォッチ
npm run watch:css:discogs

# Preorders用SCSSをウォッチ
npm run watch:css:preorders

# Discogsツールを起動（スクレイピングサーバー + Webサーバー）
npm run dev:discogs

# Preordersツールを起動
npm run dev:preorders

# Discogsのみ配信
npm run serve:discogs

# Preordersのみ配信
npm run serve:preorders
```

## スタイル開発のワークフロー

### 共通スタイルの変更

1. `shared/css/` 内のファイルを編集
   - `_variables.scss`: 色、フォントサイズなどの変数
   - `_base.scss`: 基本的なリセット、要素スタイル
   - `_mixins.scss`: 再利用可能なミックスイン

2. 各ツールのSCSSで共通スタイルをインポート
   ```scss
   @import '../../shared/css/variables';
   @import '../../shared/css/mixins';
   @import '../../shared/css/base';
   ```

3. ビルドコマンドを実行
   ```bash
   npm run build:css
   ```

### ツール固有のスタイル変更

1. 該当ツールの`css/styles.scss`を編集
2. ウォッチモードで自動コンパイル
   ```bash
   npm run watch:css:discogs
   # または
   npm run watch:css:preorders
   ```

## 新しいツールの追加

1. ルートディレクトリに新しいディレクトリを作成
2. `index.html`、`css/styles.scss`、`js/`などを配置
3. `package.json`にビルド・起動スクリプトを追加
4. トップページの`index.html`にリンクを追加
5. 必要に応じて`shared/`の共通リソースを活用

## 注意事項

- `*.min.css`ファイルは自動生成されるため、Gitにコミットしない
- 共通スタイルを変更した場合は、全てのツールのCSSを再ビルドする
- 各ツールのREADMEも個別に更新する
