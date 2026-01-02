import { DiscogsClient } from './discogsClient.js';

let client = null;
let selectedReleases = [];
let searchTimeout = null;
let rowCount = 1; // 現在の検索行数
let abortController = null; // スクレイピング処理をキャンセルするためのコントローラー

// フォーマットを正規化する関数（EPを7"に統合）
function normalizeFormats(formats) {
  if (!formats || !Array.isArray(formats)) return [];

  const normalized = formats.map(format => {
    // EPを7"に置き換え
    if (format === 'EP') return '7"';
    return format;
  });

  // 重複を削除
  return [...new Set(normalized)];
}

// 複数行の追加・削除機能
document.getElementById('addRowButton').addEventListener('click', addSearchRow);

function addSearchRow() {
  const container = document.getElementById('searchRowsContainer');
  const newRow = document.createElement('div');
  newRow.className = 'row';
  newRow.setAttribute('data-row-index', rowCount);

  newRow.innerHTML = `
    <div class="autocomplete">
      <input
        type="text"
        id="artistSearch-${rowCount}"
        class="search-input"
        placeholder="ex: Electric Light Orchestra"
        required
        autocomplete="off"
        data-row-index="${rowCount}"
      >
      <div id="artistSuggestions-${rowCount}" class="suggestions"></div>
    </div>

    <button type="button" class="remove-btn" onclick="removeSearchRow(this)">×</button>
  `;

  container.appendChild(newRow);
  setupAutocomplete(rowCount);
  rowCount++;
}

window.removeSearchRow = function(button) {
  const row = button.closest('.row');
  if (document.querySelectorAll('.row').length > 1) {
    row.remove();
  } else {
    alert('最低1つの検索条件が必要です');
  }
};

// 各行のオートコンプリートをセットアップ
function setupAutocomplete(index) {
  const artistInput = document.getElementById(`artistSearch-${index}`);
  const suggestionsDropdown = document.getElementById(`artistSuggestions-${index}`);

  artistInput.addEventListener('input', async (e) => {
    const query = e.target.value.trim();

    if (query.length < 2) {
      suggestionsDropdown.classList.remove('show');
      return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const token = document.getElementById('token').value.trim();
      if (!token) return;

      try {
        // 全てのタイプをまとめて検索（type指定なし）
        const params = new URLSearchParams({
          q: query,
          per_page: 10
        });

        const url = `https://api.discogs.com/database/search?${params.toString()}`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Discogs token=${token}`,
            'User-Agent': 'DiscogsSellerOptimizer/1.0'
          }
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        const results = data.results || [];

        console.log('API結果:', results.slice(0, 3)); // 最初の3件を表示

        // 結果をマッピング（type に応じて表示名を設定）
        const combined = results.map(item => {
          let displayType = '';
          if (item.type === 'artist') {
            displayType = 'Artist';
          } else if (item.type === 'release') {
            displayType = 'Release';
          } else if (item.type === 'master') {
            displayType = 'Master';
          } else if (item.type === 'label') {
            displayType = 'Label';
          } else {
            displayType = item.type || '';
          }

          return {
            id: item.id,
            title: item.title,
            thumb: item.thumb || item.cover_image,
            type: item.type,
            displayType: displayType
          };
        });

        console.log('マッピング後:', combined.slice(0, 3)); // 最初の3件を表示

        displayArtistSuggestionsForRow(combined, index);
      } catch (error) {
        console.error('Search error:', error);
        suggestionsDropdown.classList.remove('show');
      }
    }, 500);
  });
}

function displayArtistSuggestionsForRow(items, rowIndex) {
  const suggestionsDropdown = document.getElementById(`artistSuggestions-${rowIndex}`);

  if (items.length === 0) {
    suggestionsDropdown.classList.remove('show');
    return;
  }

  suggestionsDropdown.innerHTML = items.map(item => {
    const thumbnail = item.thumb || item.cover_image || '';
    const displayName = item.title;
    const displayInfo = item.displayType || '';

    return `
      <div class="item"
           data-item-id="${item.id}"
           data-item-name="${item.title}"
           data-item-type="${item.type}">
        ${thumbnail ? `<img src="${thumbnail}" alt="${item.title}" class="thumbnail">` : '<div class="thumbnail"></div>'}
        <div class="content">
          <div class="name">${displayName}</div>
          <div class="info">${displayInfo}</div>
        </div>
      </div>
    `;
  }).join('');

  suggestionsDropdown.classList.add('show');

  // 候補選択イベント
  suggestionsDropdown.querySelectorAll('.item').forEach(item => {
    item.addEventListener('click', () => {
      const itemName = item.dataset.itemName;
      const itemType = item.dataset.itemType;

      document.getElementById(`artistSearch-${rowIndex}`).value = itemName;
      suggestionsDropdown.classList.remove('show');

      // リリースが選択された場合は、そのまま検索可能にする
      // （アーティスト名とタイトルが混在している場合でも動作する）
    });
  });
}

// 初期行のセットアップ
setupAutocomplete(0);

// 旧コードとの互換性のための変数（削除予定）
const artistInput = document.getElementById('artistSearch-0');
const suggestionsDropdown = document.getElementById('artistSuggestions-0');

artistInput.addEventListener('input', async (e) => {
  const query = e.target.value.trim();

  if (query.length < 2) {
    suggestionsDropdown.classList.remove('show');
    return;
  }

  // デバウンス処理
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    const token = document.getElementById('token').value.trim();
    if (!token) {
      console.log('Token not provided yet');
      return;
    }

    try {
      // 全てのタイプをまとめて検索（type指定なし）
      const params = new URLSearchParams({
        q: query,
        per_page: 10
      });

      const url = `https://api.discogs.com/database/search?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Discogs token=${token}`,
          'User-Agent': 'DiscogsSellerOptimizer/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const results = data.results || [];

      console.log('API結果 (row 0):', results.slice(0, 3));

      // 結果をマッピング
      const combined = results.map(item => {
        let displayType = '';
        if (item.type === 'artist') {
          displayType = 'Artist';
        } else if (item.type === 'release') {
          displayType = 'Release';
        } else if (item.type === 'master') {
          displayType = 'Master';
        } else if (item.type === 'label') {
          displayType = 'Label';
        } else {
          displayType = item.type || '';
        }

        return {
          id: item.id,
          title: item.title,
          thumb: item.thumb || item.cover_image,
          type: item.type,
          displayType: displayType
        };
      });

      console.log('マッピング後 (row 0):', combined.slice(0, 3));

      displayArtistSuggestions(combined);
    } catch (error) {
      console.error('Artist search error:', error);
      // トークンが無効な場合はサジェスチョンを非表示
      suggestionsDropdown.classList.remove('show');
    }
  }, 500);
});

// アーティスト候補を表示
function displayArtistSuggestions(items) {
  if (items.length === 0) {
    suggestionsDropdown.classList.remove('show');
    return;
  }

  suggestionsDropdown.innerHTML = items.map(item => {
    const thumbnail = item.thumb || item.cover_image || '';
    const displayName = item.title;
    const displayInfo = item.displayType || '';

    return `
      <div class="item"
           data-item-id="${item.id}"
           data-item-name="${item.title}"
           data-item-type="${item.type}">
        ${thumbnail ? `<img src="${thumbnail}" alt="${item.title}" class="thumbnail">` : '<div class="thumbnail"></div>'}
        <div class="content">
          <div class="name">${displayName}</div>
          <div class="info">${displayInfo}</div>
        </div>
      </div>
    `;
  }).join('');

  // クリックイベントを追加
  suggestionsDropdown.querySelectorAll('.item').forEach(item => {
    item.addEventListener('click', () => {
      artistInput.value = item.dataset.itemName;
      suggestionsDropdown.classList.remove('show');
    });
  });

  suggestionsDropdown.classList.add('show');
}

// 外側をクリックしたらサジェスチョンを閉じる
document.addEventListener('click', (e) => {
  if (!e.target.closest('.autocomplete')) {
    suggestionsDropdown.classList.remove('show');
  }
});

// フォーマットボタンのクリックイベント（複数選択対応）
document.getElementById('formatButtons').addEventListener('click', (e) => {
  if (e.target.classList.contains('btn')) {
    const allBtn = document.querySelector('.btn[data-format=""]');
    const formatBtns = document.querySelectorAll('.btn:not([data-format=""])');

    // 「全て」ボタンがクリックされた場合
    if (e.target.dataset.format === '') {
      if (e.target.classList.contains('active')) {
        // 既にアクティブな場合は全て解除
        allBtn.classList.remove('active');
        formatBtns.forEach(btn => btn.classList.remove('active'));
        document.getElementById('vinylFormat').value = '';
      } else {
        // 非アクティブな場合はすべてをアクティブに
        allBtn.classList.add('active');
        formatBtns.forEach(btn => btn.classList.add('active'));
        document.getElementById('vinylFormat').value = '';
      }
    } else {
      // 個別のフォーマットボタンがクリックされた場合
      allBtn.classList.remove('active');
      e.target.classList.toggle('active');

      // アクティブなフォーマットを収集
      const activeFormats = Array.from(formatBtns)
        .filter(btn => btn.classList.contains('active'))
        .map(btn => btn.dataset.format);

      // すべてのフォーマットが選択されている場合は「全て」をアクティブに
      if (activeFormats.length === formatBtns.length) {
        allBtn.classList.add('active');
        document.getElementById('vinylFormat').value = '';
      } else if (activeFormats.length === 0) {
        // 何も選択されていない場合は何もしない（全て非選択状態を許可）
        document.getElementById('vinylFormat').value = '';
      } else {
        // 選択されたフォーマットをカンマ区切りで保存
        document.getElementById('vinylFormat').value = activeFormats.join(',');
      }
    }
  }
});

// フォーム送信
document.getElementById('searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const token = document.getElementById('token').value.trim();
  let format = document.getElementById('vinylFormat').value;
  const year = document.getElementById('releaseYear').value.trim();

  // フォーマットが選択されていない場合は自動的にALLを選択
  const allBtn = document.querySelector('.btn[data-format=""]');
  const formatBtns = document.querySelectorAll('.btn:not([data-format=""])');
  const activeFormats = Array.from(formatBtns).filter(btn => btn.classList.contains('active'));

  if (!format && activeFormats.length === 0 && !allBtn.classList.contains('active')) {
    // 何も選択されていない場合はALLを選択
    allBtn.classList.add('active');
    formatBtns.forEach(btn => btn.classList.add('active'));
    format = '';
  }

  // 全ての検索行からアーティスト名とタイトルを取得
  const searchRows = document.querySelectorAll('.row');
  const searchQueries = [];

  searchRows.forEach((row, index) => {
    const artistName = document.getElementById(`artistSearch-${row.dataset.rowIndex}`).value.trim();
    const titleElement = document.getElementById(`titleSearch-${row.dataset.rowIndex}`);
    const title = titleElement ? titleElement.value.trim() : '';

    if (artistName) {
      searchQueries.push({ artistName, title });
    }
  });

  if (!token || searchQueries.length === 0) {
    alert('APIトークンと少なくとも1つのアーティスト名を入力してください');
    return;
  }

  document.getElementById('searchButton').disabled = true;
  document.getElementById('loading').style.display = 'block';
  document.getElementById('progressBarFill').style.width = '0%';
  document.getElementById('loadingMessage').textContent = 'リリースを検索中...';
  document.getElementById('releaseResults').style.display = 'none';
  document.getElementById('sellerResults').style.display = 'none';

  try {
    if (!client) {
      client = new DiscogsClient(token);
    }

    // フォーマットを配列に変換（複数選択対応）
    const formats = format ? format.split(',').filter(f => f) : [''];

    // 複数の検索を実行してマージ
    let allReleases = [];
    const totalSearches = searchQueries.length * formats.length;
    let searchCount = 0;

    for (const query of searchQueries) {
      for (const singleFormat of formats) {
        searchCount++;
        const progress = (searchCount / totalSearches) * 100;
        document.getElementById('progressBarFill').style.width = `${progress}%`;
        const formatText = singleFormat ? ` (${singleFormat})` : '';
        document.getElementById('loadingMessage').textContent = `「${query.artistName}${query.title ? ` - ${query.title}` : ''}」${formatText}を検索中... (${searchCount}/${totalSearches})`;
        const releases = await client.searchReleases(query.artistName, query.title, { format: singleFormat, year });
        allReleases = allReleases.concat(releases);
      }
    }

    // 重複を削除（同じIDのリリース）
    const uniqueReleases = Array.from(
      new Map(allReleases.map(release => [release.id, release])).values()
    );

    // 検索結果を保存(後で価格表示時に使用)
    window.currentSearchResults = uniqueReleases;

    // リリース一覧を表示（複数のアーティストがいる場合は結合して表示）
    const artistNames = searchQueries.map(q => q.artistName).join(', ');
    displayReleaseResults(uniqueReleases, artistNames);

  } catch (error) {
    displayError(error.message);
  } finally {
    document.getElementById('searchButton').disabled = false;
    document.getElementById('loading').style.display = 'none';
  }
});

// リリース一覧を表示
function displayReleaseResults(releases, artistName) {
  const resultsDiv = document.getElementById('releaseResults');

  if (releases.length === 0) {
    resultsDiv.innerHTML = `
      <div class="card">
        <div class="error">
          <h3>検索結果が見つかりませんでした</h3>
          <p>「${artistName}」のリリースが見つかりません。アーティスト名を確認してください。</p>
        </div>
      </div>
    `;
    resultsDiv.style.display = 'block';
    return;
  }

  const headerHTML = `
    <div class="info">
      <h3>「${artistName}」のリリース (${releases.length}件)</h3>
      <p>購入したいリリースにチェックを入れて、「選択したリリースで出品者を比較」ボタンをクリックしてください</p>
    </div>
  `;

  const selectAllHTML = `
    <div class="select-all-container">
      <label class="select-all-label">
        <input type="checkbox" id="selectAllCheckbox" class="select-all-checkbox">
        <span>全て選択</span>
      </label>
    </div>
  `;

  // 発売年順にソート（新しい順）
  const sortedReleases = [...releases].sort((a, b) => {
    const yearA = a.year || 0;
    const yearB = b.year || 0;
    return yearB - yearA; // 降順（新しい順）
  });

  const releasesHTML = sortedReleases.map((release, index) => `
    <div class="release-item" data-release-id="${release.id}">
      <input type="checkbox" class="release-checkbox" data-release-id="${release.id}">
      ${release.cover_image ? `<img src="${release.cover_image}" class="release-image" alt="${release.title}">` : '<div class="release-image"></div>'}
      <div class="release-info">
        <div class="release-title">${release.title}</div>
        <div class="release-details">${artistName}</div>
        <div class="release-meta">
          ${release.year ? `<div class="meta-item">📅 ${release.year}</div>` : ''}
          ${release.format ? `<div class="meta-item">💿 ${normalizeFormats(release.format).join(', ')}</div>` : ''}
          ${release.label ? `<div class="meta-item">🏷️ ${release.label.join(', ')}</div>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  const actionsHTML = `
    <div class="selection-actions" id="selectionActions">
      <div class="selection-count">
        <span id="selectedCount">0</span>件のリリースを選択中
      </div>
      <button id="compareButton" type="button">選択したリリースで出品者を比較</button>
    </div>
  `;

  resultsDiv.innerHTML = headerHTML + selectAllHTML + '<div class="release-list">' + releasesHTML + '</div>' + actionsHTML;
  resultsDiv.style.display = 'block';
  resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // チェックボックスのイベント
  setupReleaseCheckboxes();
}

// チェックボックスの設定
function setupReleaseCheckboxes() {
  const checkboxes = document.querySelectorAll('.release-checkbox');
  const selectionActions = document.getElementById('selectionActions');
  const selectedCountSpan = document.getElementById('selectedCount');
  const compareButton = document.getElementById('compareButton');

  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const releaseId = parseInt(checkbox.dataset.releaseId);
      const releaseItem = checkbox.closest('.release-item');

      if (checkbox.checked) {
        releaseItem.classList.add('selected');
        if (!selectedReleases.includes(releaseId)) {
          selectedReleases.push(releaseId);
        }
      } else {
        releaseItem.classList.remove('selected');
        selectedReleases = selectedReleases.filter(id => id !== releaseId);
      }

      // 選択数を更新
      selectedCountSpan.textContent = selectedReleases.length;

      // アクションバーの表示/非表示
      if (selectedReleases.length > 0) {
        selectionActions.classList.add('show');
      } else {
        selectionActions.classList.remove('show');
      }
    });
  });

  compareButton.addEventListener('click', () => {
    if (selectedReleases.length === 0) {
      alert('少なくとも1つのリリースを選択してください');
      return;
    }
    compareSellers(selectedReleases);
  });

  // 全て選択チェックボックスのイベントリスナー
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  selectAllCheckbox.addEventListener('change', () => {
    const checkboxes = document.querySelectorAll('.release-checkbox');
    const isChecked = selectAllCheckbox.checked;

    checkboxes.forEach(checkbox => {
      checkbox.checked = isChecked;
      const releaseId = parseInt(checkbox.dataset.releaseId);
      const releaseItem = checkbox.closest('.release-item');

      if (isChecked) {
        releaseItem.classList.add('selected');
        if (!selectedReleases.includes(releaseId)) {
          selectedReleases.push(releaseId);
        }
      } else {
        releaseItem.classList.remove('selected');
        const index = selectedReleases.indexOf(releaseId);
        if (index > -1) {
          selectedReleases.splice(index, 1);
        }
      }
    });

    selectedCountSpan.textContent = selectedReleases.length;
    if (selectedReleases.length > 0) {
      selectionActions.classList.add('show');
    } else {
      selectionActions.classList.remove('show');
    }
  });
}

// マーケットプレイス統計を表示
async function compareSellers(releaseIds) {
  const token = document.getElementById('token').value.trim();

  // AbortControllerを作成
  abortController = new AbortController();

  // loadingをselection-actionsの前に移動
  const loadingElement = document.getElementById('loading');
  const selectionActions = document.getElementById('selectionActions');
  if (selectionActions && loadingElement) {
    selectionActions.parentNode.insertBefore(loadingElement, selectionActions);
  }

  document.getElementById('loading').style.display = 'block';
  document.getElementById('progressBarFill').style.width = '0%';
  document.getElementById('loadingMessage').textContent = 'マーケットプレイス情報を取得中...';
  document.getElementById('sellerResults').style.display = 'none';

  // ローディング表示が見えるようにスクロール
  setTimeout(() => {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);

  try {
    if (!client) {
      client = new DiscogsClient(token);
    }

    // 選択したリリースIDからマーケットプレイスURLを構築
    // 複数リリースの場合は、各リリースのマーケットプレイスページをスクレイピング
    const allSellers = [];

    for (let i = 0; i < releaseIds.length; i++) {
      const releaseId = releaseIds[i];

      // リリース情報を取得してタイトルを表示
      const release = window.currentSearchResults?.find(r => r.id === releaseId);
      const releaseTitle = release?.title || `Release ${releaseId}`;

      // プログレスバーとメッセージを更新
      const progress = ((i + 1) / releaseIds.length) * 100;
      document.getElementById('progressBarFill').style.width = `${progress}%`;
      document.getElementById('loadingMessage').textContent =
        `出品者情報を取得中... (${i + 1}/${releaseIds.length})\n${releaseTitle}`;

      // リリースIDからマーケットプレイスURLを構築
      const marketplaceUrl = `https://www.discogs.com/ja/sell/release/${releaseId}?ev=rb`;

      console.log(`スクレイピング: ${marketplaceUrl}`);

      // スクレイピングサーバーにリクエスト
      const response = await fetch('http://localhost:3001/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: marketplaceUrl }),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error('スクレイピングサーバーへの接続に失敗しました。サーバーが起動しているか確認してください。');
      }

      const result = await response.json();

      if (result.sellers && result.sellers.length > 0) {
        // 出品者データをマージ
        result.sellers.forEach(seller => {
          const existingSeller = allSellers.find(s => s.sellerName === seller.sellerName);
          if (existingSeller) {
            // 既存の出品者に商品を追加
            existingSeller.items.push(...seller.items);
            existingSeller.totalPrice += seller.totalPrice;
          } else {
            // 新しい出品者を追加
            allSellers.push({...seller});
          }
        });
      }

      // Rate limit対策（複数リリースの場合）
      if (i < releaseIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (allSellers.length > 0) {
      // 出品数でソート
      allSellers.sort((a, b) => b.items.length - a.items.length);

      // ビューアーにデータを渡して新しいウィンドウで開く
      openViewerWithData(allSellers);
    } else {
      displayError('出品情報が見つかりませんでした。');
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      displayError('処理がキャンセルされました');
    } else {
      displayError(error.message);
    }
  } finally {
    document.getElementById('loading').style.display = 'none';
    abortController = null;
  }
}

// マーケットプレイス統計結果を表示
function displayMarketplaceResults(marketplaceData) {
  const resultsDiv = document.getElementById('sellerResults');

  // リリース情報も一緒に取得して表示するため、searchResultsから取得
  const releases = selectedReleases.map(id => {
    const release = window.currentSearchResults?.find(r => r.id === id);
    const stats = marketplaceData.find(m => m.releaseId === id);
    return { release, stats };
  });

  // 出品があるアイテムのみフィルター
  const availableItems = releases.filter(item => item.stats?.num_for_sale > 0);

  if (availableItems.length === 0) {
    resultsDiv.innerHTML = `
      <div class="card">
        <div class="error">
          <h3>❌ 出品が見つかりませんでした</h3>
          <p>選択したリリースはマーケットプレイスに出品されていないようです。</p>
        </div>
      </div>
    `;
    resultsDiv.style.display = 'block';
    return;
  }

  // 合計金額を計算
  const totalLowest = availableItems.reduce((sum, item) => {
    return sum + (item.stats.lowest_price?.value || 0);
  }, 0);

  const totalMedian = availableItems.reduce((sum, item) => {
    return sum + (item.stats.median_price?.value || 0);
  }, 0);

  const currency = availableItems[0]?.stats.lowest_price?.currency || 'USD';

  const summaryHTML = `
    <div class="card summary-card">
      <h3>📊 選択したリリースの価格情報</h3>
      <div class="price-summary">
        <div class="price-box">
          <div class="price-label">最低価格の合計</div>
          <div class="price-value primary">${totalLowest.toFixed(2)} ${currency}</div>
          <div class="price-note">各リリースの最安値を合計</div>
        </div>
        <div class="price-box">
          <div class="price-label">中央値の合計</div>
          <div class="price-value">${totalMedian.toFixed(2)} ${currency}</div>
          <div class="price-note">各リリースの中央値を合計</div>
        </div>
        <div class="price-box">
          <div class="price-label">対象リリース数</div>
          <div class="price-value">${availableItems.length}件</div>
          <div class="price-note">出品中のリリース</div>
        </div>
      </div>
      <div class="export-actions">
        <button onclick="downloadCSV()" class="csv-download-btn">
          📥 CSV形式でダウンロード
        </button>
      </div>
      <div class="info-notice">
        ⚠️ 注意: Discogs APIの制限により、個別の出品者情報は取得できません。<br>
        下記のテーブルから各リリースのマーケットプレイスをご確認ください。
      </div>
    </div>
  `;

  // CSVダウンロード用にデータをグローバルに保存
  window.currentMarketplaceData = releases;

  const tableHTML = `
    <div class="card">
      <h3>📝 リリース詳細</h3>
      <div class="releases-table">
        <table>
          <thead>
            <tr>
              <th style="width: 40%;">タイトル</th>
              <th>出品数</th>
              <th>最低価格</th>
              <th>中央値</th>
              <th>最高価格</th>
              <th>リンク</th>
            </tr>
          </thead>
          <tbody>
            ${releases.map(item => {
              const title = item.release?.title || `Release ${item.stats.releaseId}`;
              const stats = item.stats;
              return `
                <tr class="${stats.num_for_sale > 0 ? 'available' : 'unavailable'}">
                  <td class="release-title-cell">
                    <div class="title-text">${title}</div>
                    ${item.release?.year ? `<div class="title-year">${item.release.year}</div>` : ''}
                  </td>
                  <td class="centered">${stats.num_for_sale || 0}</td>
                  <td class="price-cell">
                    ${stats.lowest_price ? `${stats.lowest_price.value} ${stats.lowest_price.currency}` : '-'}
                  </td>
                  <td class="price-cell">
                    ${stats.median_price ? `${stats.median_price.value} ${stats.median_price.currency}` : '-'}
                  </td>
                  <td class="price-cell">
                    ${stats.highest_price ? `${stats.highest_price.value} ${stats.highest_price.currency}` : '-'}
                  </td>
                  <td class="centered">
                    <a href="${stats.url}" target="_blank" rel="noopener noreferrer" class="table-link">
                      開く →
                    </a>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td><strong>合計</strong></td>
              <td class="centered"><strong>${availableItems.reduce((sum, i) => sum + i.stats.num_for_sale, 0)}</strong></td>
              <td class="price-cell"><strong>${totalLowest.toFixed(2)} ${currency}</strong></td>
              <td class="price-cell"><strong>${totalMedian.toFixed(2)} ${currency}</strong></td>
              <td>-</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;

  resultsDiv.innerHTML = summaryHTML + tableHTML;
  resultsDiv.style.display = 'block';
  resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


function displayError(message) {
  const resultsDiv = document.getElementById('sellerResults');
  resultsDiv.innerHTML = `
    <div class="card">
      <div class="error">
        <h3>エラーが発生しました</h3>
        <p>${message}</p>
      </div>
    </div>
  `;
  resultsDiv.style.display = 'block';
}

// CSVダウンロード機能
window.downloadCSV = function() {
  if (!window.currentMarketplaceData || window.currentMarketplaceData.length === 0) {
    alert('ダウンロードするデータがありません');
    return;
  }

  // CSVヘッダー
  const headers = [
    'タイトル',
    '年',
    'フォーマット',
    'レーベル',
    'リリースID',
    '出品数',
    '最低価格',
    '中央値',
    '最高価格',
    '通貨',
    'Discogsリンク'
  ];

  // CSVデータを作成
  const rows = window.currentMarketplaceData.map(item => {
    const release = item.release;
    const stats = item.stats;

    return [
      release?.title || `Release ${stats.releaseId}`,
      release?.year || '',
      release?.format ? normalizeFormats(release.format).join(', ') : '',
      release?.label ? release.label.join(', ') : '',
      stats.releaseId,
      stats.num_for_sale || 0,
      stats.lowest_price ? stats.lowest_price.value : '',
      stats.median_price ? stats.median_price.value : '',
      stats.highest_price ? stats.highest_price.value : '',
      stats.lowest_price?.currency || stats.median_price?.currency || '',
      stats.url
    ];
  });

  // CSVテキストを作成
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      // セル内にカンマや改行、ダブルクオートがある場合はエスケープ
      const cellStr = String(cell);
      if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(','))
  ].join('\n');

  // UTF-8 BOMを追加（Excelで日本語を正しく表示するため）
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

  // ダウンロードリンクを作成
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);

  // ファイル名に日付を含める
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0];
  const artistName = document.getElementById('artistSearch').value.trim().replace(/[^\w\s-]/g, '');
  link.setAttribute('download', `discogs_${artistName}_${dateStr}.csv`);

  // ダウンロードを実行
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  console.log('CSVダウンロード完了');
};

// ビューアーを新しいウィンドウで開いてデータを渡す
function openViewerWithData(sellers) {
  // データをlocalStorageに保存
  localStorage.setItem('discogsSellerData', JSON.stringify(sellers));

  // 新しいウィンドウでビューアーを開く
  const viewerWindow = window.open('viewer.html', '_blank');

  // ウィンドウが開けなかった場合（ポップアップブロック等）
  if (!viewerWindow) {
    alert('ポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。');
  }
}

// キャンセルボタンのイベントリスナー
document.getElementById('cancelButton').addEventListener('click', (e) => {
  e.preventDefault();
  if (abortController) {
    abortController.abort();
    document.getElementById('loadingMessage').textContent = 'キャンセル中...';
  }
});
