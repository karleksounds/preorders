let recordsData = null;
let currentAudio = null; // 現在再生中のオーディオ
let currentMonth = null; // 現在表示中の月
let currentFormat = '7"'; // 現在表示中のフォーマット
let monthlyRecords = {}; // 月ごとのレコードデータ

// データを読み込み
async function loadRecords() {
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const containerEl = document.getElementById('records-container');

  try {
    // データファイルから直接取得（GitHub Pages対応）
    const response = await fetch('data/records.json');

    if (!response.ok) {
      throw new Error('Failed to load records data');
    }

    recordsData = await response.json();

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

  // 現在のフォーマットでフィルタリング
  const filteredRecords = recordsData.records.filter(record =>
    record.format === currentFormat
  );

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
  const toggleEl = document.getElementById('format-toggle');
  toggleEl.style.display = 'flex';
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
  const months = Object.keys(monthlyRecords).sort().reverse();

  if (months.length <= 1) {
    paginationEl.style.display = 'none';
    return;
  }

  const buttons = months.map(month => {
    const isActive = month === currentMonth;
    const displayName = getMonthDisplayName(month);
    const activeClass = isActive ? 'active' : '';
    return `<button class="pagination-btn ${activeClass}" onclick="changePage('${month}')">${displayName}</button>`;
  }).join('');

  paginationEl.innerHTML = buttons;
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

// ストアリストを生成（アコーディオン式）
function createStoresSection(stores, recordId) {
  if (!stores || stores.length === 0) return { button: '', accordion: '' };

  // 全てアコーディオン式
  const storeItems = stores.map(s => `
    <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="link">
      ${escapeHtml(s.store)}
    </a>
  `).join('');

  return {
    button: `<button class="btn btn-store toggle" onclick="toggleStores('${recordId}')">
      Find in Store <span class="icon">▼</span>
    </button>`,
    accordion: `<div class="stores" id="stores-${recordId}">
      ${storeItems}
    </div>`
  };
}

// ストアリストの開閉
function toggleStores(recordId) {
  const accordion = document.getElementById(`stores-${recordId}`);
  const button = document.querySelector(`button[onclick="toggleStores('${recordId}')"]`);

  if (accordion && button) {
    const icon = button.querySelector('.icon');
    accordion.classList.toggle('show');
    if (accordion.classList.contains('show')) {
      icon.textContent = '▲';
    } else {
      icon.textContent = '▼';
    }
  }
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
    format
  } = record;

  // ユニークIDを生成
  const recordId = `${artist}-${title}`.replace(/[^a-zA-Z0-9]/g, '-');

  // 画像URL
  const imgSrc = (imageUrl && imageUrl.trim())
    ? imageUrl
    : 'images/noimage.jpg';

  // プレビューボタン（iTunesプレビューがある場合）
  const previewButton = itunesPreviewUrl
    ? `<button class="btn btn-preview" onclick="playPreview('${itunesPreviewUrl}', this)">▶ Preview</button>`
    : '';

  // ストアセクション
  const storesSection = createStoresSection(stores, recordId);

  return `
    <article class="record">
      <div class="content">
        <img src="${imgSrc}" alt="${artist} - ${title}" class="image" onerror="if(!this.dataset.errorHandled){this.dataset.errorHandled='true';this.src='images/noimage.jpg';}">
        <div class="info">
          <div class="main">
            <div class="artist">${escapeHtml(artist)}</div>
            <div class="title">${escapeHtml(title)} ${format}</div>
            <div class="actions-inline">
              ${storesSection.button}
            </div>
          </div>
          ${genre ? `<div class="genre">${escapeHtml(genre)}</div>` : ''}
          ${releaseDate ? `<div class="date">${escapeHtml(releaseDate)}</div>` : ''}
          ${label ? `<div class="label">${escapeHtml(label)}</div>` : ''}
          <div class="actions">
            ${previewButton}
          </div>
        </div>
      </div>
      ${storesSection.accordion}
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
    buttonElement.innerHTML = '▶ Preview';
    buttonElement.classList.remove('playing');
    return;
  }

  // 他のボタンが再生中の場合は停止
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
    // すべての再生ボタンを元に戻す
    document.querySelectorAll('.btn-preview').forEach(btn => {
      btn.innerHTML = '▶ Preview';
      btn.classList.remove('playing');
    });
  }

  // 新しいオーディオを再生
  currentAudio = new Audio(previewUrl);
  buttonElement.innerHTML = '⏸ Playing...';
  buttonElement.classList.add('playing');

  currentAudio.play().catch(error => {
    console.error('Error playing preview:', error);
    buttonElement.innerHTML = '▶ Preview';
    buttonElement.classList.remove('playing');
  });

  // 再生終了時の処理
  currentAudio.addEventListener('ended', () => {
    buttonElement.innerHTML = '▶ Preview';
    buttonElement.classList.remove('playing');
    currentAudio = null;
  });

  // エラー時の処理
  currentAudio.addEventListener('error', () => {
    buttonElement.innerHTML = '▶ Preview';
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

  // 現在の月のレコードを取得
  const records = currentMonth && monthlyRecords[currentMonth]
    ? monthlyRecords[currentMonth]
    : [];

  if (records.length === 0) {
    containerEl.innerHTML = `<div class="loading">No ${currentFormat} records found for this month.</div>`;
    return;
  }

  const monthDisplay = getMonthDisplayName(currentMonth);

  const html = `
    <section class="releases">
      <h2 class="title">${currentFormat} Releases - ${monthDisplay}</h2>
      <div class="records-grid list-view">
        ${records.map(record => createRecordCard(record)).join('')}
      </div>
    </section>
  `;

  containerEl.innerHTML = html;
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  loadRecords();
});
