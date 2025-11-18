let recordsData = null;
let currentAudio = null; // 現在再生中のオーディオ

// データを読み込み
async function loadRecords() {
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const containerEl = document.getElementById('records-container');

  try {
    // APIエンドポイントからデータを取得
    const response = await fetch('/api/records');

    if (response.status === 202) {
      // スクレイピング中
      const data = await response.json();
      loadingEl.textContent = data.message + ' 数分後に再読み込みしてください...';
      setTimeout(() => {
        window.location.reload();
      }, 60000); // 1分後に自動リロード
      return;
    }

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
    renderRecords();
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
    spotifyUrl,
    spotifyImage,
    genre,
    itunesPreviewUrl
  } = record;

  // ユニークIDを生成
  const recordId = `${artist}-${title}`.replace(/[^a-zA-Z0-9]/g, '-');

  // 画像URL（Spotifyの画像を優先、空文字列もチェック）
  const hasValidSpotifyImage = spotifyImage && spotifyImage.trim();
  const hasValidImageUrl = imageUrl && imageUrl.trim();
  const imgSrc = hasValidSpotifyImage || hasValidImageUrl
    ? (hasValidSpotifyImage ? spotifyImage : imageUrl)
    : 'images/noimage.jpg';

  // Spotifyボタン
  const spotifyButton = spotifyUrl
    ? `<a href="${spotifyUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-spotify">Listen on Spotify</a>`
    : '';

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
            <div class="title">${escapeHtml(title)} 7"</div>
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

  const records = recordsData.records || [];

  if (records.length === 0) {
    containerEl.innerHTML = '<div class="loading">No 7" records found.</div>';
    return;
  }

  const html = `
    <section class="releases">
      <h2 class="title">7" Releases</h2>
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
