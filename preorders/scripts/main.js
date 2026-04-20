let recordsData = null;
let excludeConfig = { genres: [], labels: [] };
let currentAudio = null; // 現在再生中のオーディオ
let currentMonth = null; // 現在表示中の月
let currentFormat = '7"'; // 現在表示中のフォーマット
let monthlyRecords = {}; // 月ごとのレコードデータ
let currentSearchQuery = ''; // 現在の検索クエリ

// データを読み込み
async function loadRecords() {
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const containerEl = document.getElementById('records-container');

  try {
    const dataFile = window.ARCHIVE_MODE ? 'data/archive.json' : 'data/records.json';
    const response = await fetch(dataFile);

    if (!response.ok) {
      throw new Error('Failed to load records data');
    }

    recordsData = await response.json();

    // 除外リストを読み込み
    try {
      const excludeRes = await fetch('data/exclude.json');
      if (excludeRes.ok) excludeConfig = await excludeRes.json();
    } catch (_) {}



    // Display last update date
    if (recordsData.updatedAt) {
      const updateDate = new Date(recordsData.updatedAt);
      const formattedDate = updateDate.toISOString().split('T')[0]; // yyyy-mm-dd
      document.getElementById('last-update').textContent = `Last update: ${formattedDate}`;
    }

    loadingEl.style.display = 'none';

    // レコードを月ごとにグループ化
    groupRecordsByMonth();

    // フォーマット切り替えボタンを表示
    renderFormatToggle();

    // 最新の月を表示
    const months = Object.keys(monthlyRecords).sort().reverse();
    if (months.length > 0) {
      currentMonth = months[0];
      renderPagination();
      renderRecords();
    }
  } catch (error) {
    loadingEl.style.display = 'none';
    errorEl.innerHTML = `
      <p>データの読み込みに失敗しました。</p>
      <p>サーバーが起動していることを確認してください。</p>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; margin-top: 10px;">
npm start</pre>
      <p>ページを再読み込みしてください。</p>
    `;
    errorEl.style.display = 'block';
    console.error('Error loading records:', error);
  }
}

// レコードを月ごとにグループ化（フォーマットでフィルタリング）
function groupRecordsByMonth() {
  monthlyRecords = {};

  if (!recordsData || !recordsData.records) return;

  // 現在のフォーマット＋除外リストでフィルタリング
  const filteredRecords = recordsData.records.filter(record => {
    if (record.format !== currentFormat) return false;
    if (record.genre && excludeConfig.genres.includes(record.genre)) return false;
    if (record.label && excludeConfig.labels.includes(record.label)) return false;
    return true;
  });

  filteredRecords.forEach(record => {
    if (!record.releaseDate) return;

    // YYYY-MM-DD形式からYYYY-MM を取得
    const month = record.releaseDate.substring(0, 7); // "2025-12" or "2026-01"

    if (!monthlyRecords[month]) {
      monthlyRecords[month] = [];
    }

    monthlyRecords[month].push(record);
  });

  // 各月のレコードをリリース日でソート
  Object.keys(monthlyRecords).forEach(month => {
    monthlyRecords[month].sort((a, b) =>
      a.releaseDate.localeCompare(b.releaseDate)
    );
  });
}

// 月の表示名を取得
function getMonthDisplayName(monthKey) {
  const [year, month] = monthKey.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

// フォーマット切り替えボタンを描画
function renderFormatToggle() {
  document.getElementById('format-toggle').style.display = 'flex';
  document.getElementById('search-bar').style.display = 'flex';
}

// 検索処理
function handleSearch(query) {
  currentSearchQuery = query.trim().toLowerCase();
  renderPagination();
  renderRecords();
}

// フォーマットを変更
function changeFormat(format) {
  currentFormat = format;

  // ボタンのアクティブ状態を更新
  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  // レコードを再グループ化
  groupRecordsByMonth();

  // 最新の月を表示
  const months = Object.keys(monthlyRecords).sort().reverse();
  if (months.length > 0) {
    currentMonth = months[0];
  } else {
    currentMonth = null;
  }

  renderPagination();
  renderRecords();

  // ページトップにスクロール
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ページネーションを描画
function renderPagination() {
  const paginationEl = document.getElementById('pagination');

  // 検索中はページネーションを非表示
  if (currentSearchQuery) {
    paginationEl.style.display = 'none';
    return;
  }

  const months = Object.keys(monthlyRecords).sort().reverse();

  if (months.length <= 1 && window.ARCHIVE_MODE) {
    paginationEl.style.display = 'none';
    return;
  }
  if (months.length <= 1 && !window.ARCHIVE_MODE) {
    const archiveLink = `<a class="pagination-btn" href="archive.html">Archive</a>`;
    paginationEl.innerHTML = archiveLink;
    paginationEl.style.display = 'flex';
    return;
  }

  const buttons = months.map(month => {
    const isActive = month === currentMonth;
    const displayName = getMonthDisplayName(month);
    const activeClass = isActive ? 'active' : '';
    return `<button class="pagination-btn ${activeClass}" onclick="changePage('${month}')">${displayName}</button>`;
  }).join('');

  const archiveLink = window.ARCHIVE_MODE
    ? `<a class="pagination-btn" href="index.html">← Back</a>`
    : `<a class="pagination-btn" href="archive.html">Archive</a>`;

  paginationEl.innerHTML = buttons + archiveLink;
  paginationEl.style.display = 'flex';
}

// ページを変更
function changePage(month) {
  currentMonth = month;
  renderPagination();
  renderRecords();

  // ページトップにスクロール
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ストアリンクを生成
function createStoreLinks(stores) {
  if (!stores || stores.length === 0) return '';

  const items = stores.map(s => `
    <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="btn-store-link">
      ${escapeHtml(s.store.replace(' Records', ''))}
    </a>
  `).join('');

  return `<div class="store-links">${items}</div>`;
}

// レコードカードのHTMLを生成
function createRecordCard(record) {
  const {
    artist,
    title,
    label,
    releaseDate,
    stores = [],
    imageUrl,
    genre,
    itunesPreviewUrl,
    format,
    displayFormat
  } = record;

  // ユニークIDを生成
  const recordId = `${artist}-${title}`.replace(/[^a-zA-Z0-9]/g, '-');

  // 画像URL
  const imgSrc = (imageUrl && imageUrl.trim())
    ? imageUrl
    : 'images/noimage.jpg';

  // プレビューボタン（iTunesプレビューがある場合のみ）
  const previewButton = itunesPreviewUrl
    ? `<button class="btn-preview" onclick="playPreview('${itunesPreviewUrl}', this)" title="Preview"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="6,3 20,12 6,21"/></svg></button>`
    : '';

  // ストアリンク
  const storeLinks = createStoreLinks(stores);

  return `
    <article class="record">
      <div class="content">
        <div class="left-col">
          <img src="${imgSrc}" alt="${artist} - ${title}" class="image" onerror="if(!this.dataset.errorHandled){this.dataset.errorHandled='true';this.src='images/noimage.jpg';}">
          <div class="actions">
            ${previewButton}
          </div>
        </div>
        <div class="info">
          <div class="main">
            <div class="artist">${escapeHtml(artist)}</div>
            <div class="title">${escapeHtml(title)} ${displayFormat || format}</div>
            <div class="meta">
              ${genre ? `<div class="genre">${escapeHtml(genre)}</div>` : ''}
              ${label ? `<div class="label">${escapeHtml(label)}</div>` : ''}
              ${releaseDate ? `<div class="date">${escapeHtml(releaseDate)}</div>` : ''}
            </div>
            ${storeLinks}
          </div>
        </div>
      </div>
    </article>
  `;
}

// HTMLエスケープ
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// プレビュー再生機能
function playPreview(previewUrl, buttonElement) {
  // 同じボタンが再生中の場合は停止
  if (buttonElement.classList.contains('playing')) {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    buttonElement.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="6,3 20,12 6,21"/></svg>';
    buttonElement.classList.remove('playing');
    return;
  }

  // 他のボタンが再生中の場合は停止
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
    // すべての再生ボタンを元に戻す
    document.querySelectorAll('.btn-preview').forEach(btn => {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="6,3 20,12 6,21"/></svg>';
      btn.classList.remove('playing');
    });
  }

  // 新しいオーディオを再生
  currentAudio = new Audio(previewUrl);
  buttonElement.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="5" y="5" width="4" height="14"/><rect x="15" y="5" width="4" height="14"/></svg>';
  buttonElement.classList.add('playing');

  currentAudio.play().catch(error => {
    console.error('Error playing preview:', error);
    buttonElement.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="6,3 20,12 6,21"/></svg>';
    buttonElement.classList.remove('playing');
  });

  // 再生終了時の処理
  currentAudio.addEventListener('ended', () => {
    buttonElement.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="6,3 20,12 6,21"/></svg>';
    buttonElement.classList.remove('playing');
    currentAudio = null;
  });

  // エラー時の処理
  currentAudio.addEventListener('error', () => {
    buttonElement.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="6,3 20,12 6,21"/></svg>';
    buttonElement.classList.remove('playing');
    currentAudio = null;
  });
}

// レコードを表示
function renderRecords() {
  const containerEl = document.getElementById('records-container');

  if (!recordsData) {
    containerEl.innerHTML = '<div class="loading">Loading...</div>';
    return;
  }

  // 検索モード
  if (currentSearchQuery) {
    const q = currentSearchQuery;
    const results = recordsData.records.filter(r => {
      if (r.format !== currentFormat) return false;
      if (r.genre && excludeConfig.genres.includes(r.genre)) return false;
      if (r.label && excludeConfig.labels.includes(r.label)) return false;
      return (r.artist || '').toLowerCase().includes(q) ||
             (r.title || '').toLowerCase().includes(q) ||
             (r.label || '').toLowerCase().includes(q);
    });

    if (results.length === 0) {
      containerEl.innerHTML = `<div class="loading">No results found for "${escapeHtml(currentSearchQuery)}".</div>`;
      return;
    }

    containerEl.innerHTML = `
      <section class="releases">
        <h2 class="title">${results.length} result${results.length > 1 ? 's' : ''} for "${escapeHtml(currentSearchQuery)}"</h2>
        <div class="records-grid list-view">
          ${results.map(record => createRecordCard(record)).join('')}
        </div>
      </section>
    `;
    return;
  }

  // 通常モード: 現在の月のレコードを取得
  const records = currentMonth && monthlyRecords[currentMonth]
    ? monthlyRecords[currentMonth]
    : [];

  if (records.length === 0) {
    containerEl.innerHTML = `<div class="loading">No ${currentFormat} records found for this month.</div>`;
    return;
  }

  const monthDisplay = getMonthDisplayName(currentMonth);

  // Group records by releaseDate
  const byDate = {};
  records.forEach(record => {
    const date = record.releaseDate || '';
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(record);
  });

  const dateGroups = Object.keys(byDate).sort().map(date => {
    const [year, month, day] = date.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const dateDisplay = `${parseInt(day)} ${monthNames[parseInt(month) - 1]} ${year}`;
    return `
      <div class="date-header">${dateDisplay}</div>
      <div class="records-grid list-view">
        ${byDate[date].map(record => createRecordCard(record)).join('')}
      </div>
    `;
  }).join('');

  containerEl.innerHTML = `
    <section class="releases">
      <h2 class="title">${currentFormat} Releases - ${monthDisplay}</h2>
      ${dateGroups}
    </section>
  `;
}

// Back to top button
function initBackToTop() {
  const btn = document.createElement('button');
  btn.id = 'back-to-top';
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5,12 12,5 19,12"/></svg>';
  btn.setAttribute('title', 'Back to top');
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.appendChild(btn);

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  loadRecords();
  initBackToTop();
});
