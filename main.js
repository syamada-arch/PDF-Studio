import './style.css';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const app = document.querySelector('#app');

app.innerHTML = `
  <section id="modeGate" class="mode-gate">
    <div class="mode-intro">
      <span class="mini-brand">PAPER PUNCH</span>
      <div class="mascot-stage" aria-hidden="true">
        <div class="mascot-figure rabbit" data-mascot="rabbit"><span class="mascot-fallback">🐇</span></div>
        <div class="mascot-figure turtle" data-mascot="turtle"><span class="mascot-fallback">🐢</span></div>
      </div>
      <h1>PDFを、もっと自由に。</h1>
      <p>編集・OCR・変換・整理まで、ブラウザでサッと。</p>
    </div>
    <div class="mode-pieces">
      <button class="mode-piece organize-piece" data-mode="organize">
        <span class="piece-icon">↕</span><strong>結合・整理</strong><small>ページを並べる、削除する、回転する。複数PDFもひとつに。</small>
      </button>
      <button class="mode-piece edit-piece" data-mode="edit">
        <span class="piece-icon">✎</span><strong>加工・編集</strong><small>文字、線、図形、マーカー。ページをその場で加工。</small>
      </button>
    </div>
    <div class="pp-feature-row" aria-label="主な機能">
      <span>PDF編集</span><span>画像→PDF</span><span>結合・分割</span><span>OCR</span><span>圧縮</span>
    </div>
    <p class="pp-local-note"><strong>ファイルはアップロードしません。</strong> まずブラウザ上で処理します。</p>
  </section>
  <header class="topbar">
    <div class="brand"><span class="brand-mark" aria-hidden="true"></span><span>PAPER PUNCH</span></div>
    <label class="filename-wrap"><span class="sr-only">出力ファイル名</span><input id="filename" value="結合ファイル.pdf" /></label>
    <nav class="mode-tabs"><button data-switch="organize" class="active">結合・整理</button><button data-switch="edit">加工・編集</button></nav>
    <div class="history-actions">
      <button id="undoBtn" class="icon-btn" title="元に戻す" disabled>↶</button>
      <button id="redoBtn" class="icon-btn" title="やり直す" disabled>↷</button>
    </div>
  </header>

  <main class="workspace">
    <aside class="tool-dock" aria-label="ページ操作">
      <button class="tool tool-blue shape-round" data-action="add"><span>＋</span><small>追加</small></button>
      <button class="tool tool-coral shape-key" data-action="rotate"><span>↻</span><small>回転</small></button>
      <button class="tool tool-yellow shape-step" data-action="delete"><span>−</span><small>削除</small></button>
      <button class="tool tool-sage shape-wave" data-action="separator"><span>▤</span><small>区切り</small></button>
      <button class="tool tool-lilac shape-square" data-action="blank"><span>□</span><small>白紙</small></button>
      <button class="tool tool-sage shape-wave" data-action="split"><span>⇱</span><small>分割</small></button>
      <button class="tool tool-lilac shape-square" data-action="ocr"><span>A</span><small>OCR</small></button>
      <button class="tool tool-coral shape-key" data-action="correct"><span>✦</span><small>補正</small></button>
      <button class="tool tool-yellow shape-step" data-action="compress"><span>↓</span><small>圧縮</small></button>
      <button class="tool tool-blue shape-round edit-only" data-action="edit"><span>✎</span><small>編集</small></button>
      <div class="dock-divider"></div>
      <label class="option-chip"><input id="pageNumbers" type="checkbox"/><span>ページ番号</span></label>
      <label class="option-chip"><input id="a4Normalize" type="checkbox"/><span>A4に統一</span></label>
    </aside>

    <section class="canvas-shell">
      <div id="dropzone" class="empty-state">
        <button id="heroAdd" class="add-module" aria-label="PDFまたは画像を追加"><span>＋</span></button>
        <h1>ファイルを放り込んで、はじめよう。</h1>
        <p>PDF・JPEG・PNGをここにドロップ</p>
        <button id="chooseBtn" class="text-button">ファイルを選ぶ</button>
      </div>
      <div id="pageGrid" class="page-grid" hidden></div>
      <div id="selectionBar" class="selection-bar" hidden>
        <strong id="selectionCount">0ページ選択中</strong>
        <button data-selection="all">全選択</button>
        <button data-selection="rotate">↻ 回転</button>
        <button data-selection="delete">− 削除</button>
        <button data-selection="clear">選択解除</button>
      </div>
      <div id="toast" class="toast" role="status" aria-live="polite"></div>
    </section>
  </main>

  <footer class="bottombar">
    <div class="stats"><strong id="pageCount">全0ページ</strong><span>・</span><span id="sizeText">0 MB</span><span id="warningText" class="warning-text"></span></div>
    <button id="exportBtn" class="export-btn" disabled><span class="stack-icon">▱</span><span>PDFを書き出す</span><span>→</span></button>
  </footer>
  <input id="fileInput" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple hidden />

  <dialog id="separatorDialog">
    <form method="dialog" class="dialog-card">
      <button class="dialog-close" value="cancel" aria-label="閉じる">×</button>
      <h2>区切り表紙を追加</h2>
      <label>タイトル<input id="separatorTitle" maxlength="60" placeholder="付録1　分析記録" /></label>
      <label>補足<input id="separatorSubtitle" maxlength="90" placeholder="必要な場合のみ" /></label>
      <div class="dialog-actions"><button value="cancel" class="secondary">キャンセル</button><button id="addSeparatorBtn" value="default" class="primary">追加する</button></div>
    </form>
  </dialog>

  <dialog id="splitDialog">
    <form method="dialog" class="dialog-card">
      <button class="dialog-close" value="cancel" aria-label="閉じる">×</button>
      <h2>分割・変換</h2>
      <p id="splitSummary" class="dialog-note">ページを選択すると、そのページだけを書き出せます。</p>
      <div class="split-actions">
        <button id="splitSelectedPdf" type="button" class="primary">選択ページをPDFにする</button>
        <button id="exportJpg" type="button" class="secondary">表示ページをJPGにする</button>
        <button id="exportPng" type="button" class="secondary">表示ページをPNGにする</button>
      </div>
      <p class="dialog-hint">複数ページのPDFを分けたい場合は、ページを選択して「選択ページをPDFにする」を使います。</p>
    </form>
  </dialog>

  <dialog id="compressDialog">
    <form method="dialog" class="dialog-card correct-card">
      <button class="dialog-close" value="cancel" aria-label="閉じる">×</button>
      <div class="ocr-head"><div><span class="mini-brand">PAPER PUNCH COMPRESS</span><h2>PDFを軽くする</h2></div><div id="compressSize" class="ocr-progress">準備中</div></div>
      <p class="dialog-note">画像を含むPDFを再構成して、ファイルサイズを抑えます。元ファイルは変更しません。</p>
      <div class="correct-controls">
        <label>画質 <input id="compressQuality" type="range" min="45" max="95" value="75"><output id="compressQualityValue">75</output></label>
        <label>解像度 <input id="compressScale" type="range" min="80" max="180" value="120"><output id="compressScaleValue">120</output></label>
      </div>
      <div class="preset-row">
        <button type="button" id="compressSmall" class="secondary">軽量</button>
        <button type="button" id="compressBalanced" class="secondary">バランス</button>
        <button type="button" id="compressQualityPreset" class="secondary">高画質</button>
      </div>
      <div class="dialog-actions"><button id="compressRun" type="button" class="primary">圧縮して保存</button></div>
      <p class="dialog-hint">軽量は小さく、バランスは読みやすさとの両立、高画質は画質優先です。</p>
    </form>
  </dialog>

  <dialog id="correctDialog">
    <form method="dialog" class="dialog-card correct-card">
      <button class="dialog-close" value="cancel" aria-label="閉じる">×</button>
      <div class="ocr-head"><div><span class="mini-brand">PAPER PUNCH SCAN</span><h2>書類をきれいにする</h2></div></div>
      <p id="correctSummary" class="dialog-note">選択したページに画像補正を適用します。</p>
      <div class="preset-row">
        <button type="button" id="correctDocument" class="secondary">書類くっきり</button>
        <button type="button" id="correctReset" class="secondary">元に戻す</button>
        <button type="button" id="correctTrim" class="secondary">自動余白カット</button>
      </div>
      <div class="correct-controls">
        <label>明るさ <input id="correctBrightness" type="range" min="70" max="135" value="100"><output id="correctBrightnessValue">100</output></label>
        <label>コントラスト <input id="correctContrast" type="range" min="70" max="160" value="100"><output id="correctContrastValue">100</output></label>
        <label>白黒寄り <input id="correctGray" type="range" min="0" max="100" value="0"><output id="correctGrayValue">0</output></label>
      </div>
      <p class="dialog-hint">補正はブラウザ上で処理され、元ファイル自体は変更しません。</p>
      <div class="dialog-actions"><button id="correctApply" type="button" class="primary">選択ページに適用</button></div>
    </form>
  </dialog>

  <dialog id="ocrDialog">
    <form method="dialog" class="dialog-card ocr-card">
      <button class="dialog-close" value="cancel" aria-label="閉じる">×</button>
      <div class="ocr-head"><div><span class="mini-brand">PAPER PUNCH OCR</span><h2>画像の文字を読み取る</h2></div><div id="ocrProgress" class="ocr-progress">待機中</div></div>
      <p id="ocrSummary" class="dialog-note">選択したページをOCRします。PDFもページ画像として読み取れます。</p>
      <div class="ocr-result-wrap"><textarea id="ocrResult" placeholder="ここに認識した文字が表示されます。" spellcheck="false"></textarea></div>
      <div class="dialog-actions"><button id="ocrCopy" type="button" class="secondary">コピー</button><button id="ocrDownload" type="button" class="secondary">TXT保存</button><button id="ocrRun" type="button" class="primary">OCRを開始</button></div>
      <p class="dialog-hint">初回だけOCRエンジンと言語データをブラウザへ読み込みます。処理中は少し時間がかかります。</p>
    </form>
  </dialog>

  <dialog id="previewDialog">
    <form method="dialog" class="preview-card">
      <button class="dialog-close" value="cancel" aria-label="閉じる">×</button>
      <img id="previewImage" alt="ページプレビュー" />
      <p id="previewLabel"></p>
    </form>
  </dialog>

  <dialog id="editorDialog" class="editor-dialog">
    <div class="editor-card">
      <header class="editor-head"><div><strong>ページを加工</strong><span id="editorPageLabel"></span></div><button id="closeEditor" class="dialog-close" aria-label="閉じる">×</button></header>
      <div class="editor-body">
        <aside class="editor-tools">
          <button data-edit-tool="select" class="active" title="選択・確認">↖<small>選択</small></button>
          <button data-edit-tool="pen">✎<small>ペン</small></button>
          <button data-edit-tool="highlight">▰<small>マーカー</small></button>
          <button data-edit-tool="rect">□<small>四角</small></button>
          <button data-edit-tool="line">╱<small>直線</small></button>
          <button data-edit-tool="arrow">→<small>矢印</small></button>
          <button data-edit-tool="text" title="入力欄の文字をページに追加">T<small>文字</small></button>
          <button data-edit-tool="crop">⌗<small>A4切取</small></button>
        </aside>
        <section class="editor-stage"><canvas id="editorCanvas"></canvas><div class="editor-mascot mascot-figure turtle" data-mascot="turtle" aria-hidden="true"><span class="mascot-fallback">🐢</span></div><div id="cropBox" class="crop-box" hidden><i></i></div></section>
        <aside class="editor-options">
          <label>色を選択<div class="color-row"><button type="button" data-color="#ef766d" style="--sw:#ef766d"></button><button type="button" data-color="#4c86b3" style="--sw:#4c86b3"></button><button type="button" data-color="#e7c451" style="--sw:#e7c451"></button><button type="button" data-color="#629b7d" style="--sw:#629b7d"></button><button type="button" data-color="#252a2d" style="--sw:#252a2d"></button><input id="editColor" type="color" value="#ef766d" title="自由な色"></div></label>
          <label>太さ<input id="editWidth" type="range" min="2" max="18" value="5"></label>
          <label>透明度<input id="editOpacity" type="range" min="15" max="100" value="80"></label>
          <label id="textOption" hidden>文字<input id="editText" maxlength="80" placeholder="追加する文字"></label>
          <div id="cropOptions" hidden><strong>A4比率固定</strong><label><input type="radio" name="cropOrient" value="portrait" checked>縦A4</label><label><input type="radio" name="cropOrient" value="landscape">横A4</label><button id="resetCrop" class="soft-button">範囲をリセット</button><button id="confirmCrop" class="soft-button primary-soft">この範囲で切り取る</button></div>
          <button id="clearEdits" class="soft-button danger">このページの加工を消す</button>
        </aside>
      </div>
      <footer class="editor-foot"><span id="editorStatus">ツールを選んで、ページ上で操作できます</span><div><button id="finalPreview" class="soft-button">完成プレビュー</button><button id="applyEditor" class="primary">編集内容を保存</button><button id="exportEdited" class="primary export-edit">編集済みPDFを書き出す</button></div></footer>
    </div>
  </dialog>
`;

const el = Object.fromEntries([
  'fileInput','dropzone','pageGrid','selectionBar','selectionCount','pageCount','sizeText','warningText',
  'undoBtn','redoBtn','exportBtn','filename','toast','separatorDialog','separatorTitle','separatorSubtitle',
  'addSeparatorBtn','splitDialog','splitSummary','splitSelectedPdf','exportJpg','exportPng','correctDialog','correctSummary','correctBrightness','correctBrightnessValue','correctContrast','correctContrastValue','correctGray','correctGrayValue','correctDocument','correctReset','correctTrim','correctApply','compressDialog','compressSize','compressQuality','compressQualityValue','compressScale','compressScaleValue','compressSmall','compressBalanced','compressQualityPreset','compressRun','ocrDialog','ocrSummary','ocrProgress','ocrResult','ocrRun','ocrCopy','ocrDownload','previewDialog','previewImage','previewLabel','pageNumbers','a4Normalize','modeGate','editorDialog',
  'editorCanvas','cropBox','editorPageLabel','closeEditor','applyEditor','editColor','editWidth','editOpacity','editText','textOption','cropOptions','resetCrop','confirmCrop','clearEdits','finalPreview','exportEdited','editorStatus'
].map(id => [id, document.getElementById(id)]));

const state = {
  pages: [],
  sources: new Map(),
  selected: new Set(),
  history: [],
  future: [],
  dragId: null,
  nextId: 1,
  busy: false,
  mode: 'organize',
  editor: { pageId: null, tool: 'select', draft: [], crop: null, drawing: null },
};

const connectorTypes = ['round','square','key','wave','step','dove','soft-zig','half'];
const connectorColors = ['blue','coral','butter','sage','lilac'];

function uid(prefix = 'page') { return `${prefix}-${state.nextId++}`; }
function clonePages() { return state.pages.map(page => ({ ...page })); }
function snapshot() {
  state.history.push(clonePages());
  if (state.history.length > 40) state.history.shift();
  state.future = [];
  updateHistoryButtons();
}
function restore(pages) {
  state.pages = pages.map(page => ({ ...page }));
  state.selected.clear();
  setMascot('idle');
render();
}
function undo() {
  if (!state.history.length) return;
  state.future.push(clonePages());
  restore(state.history.pop());
  updateHistoryButtons();
}
function redo() {
  if (!state.future.length) return;
  state.history.push(clonePages());
  restore(state.future.pop());
  updateHistoryButtons();
}
function updateHistoryButtons() {
  el.undoBtn.disabled = !state.history.length || state.busy;
  el.redoBtn.disabled = !state.future.length || state.busy;
}

function showToast(message, tone = 'normal') {
  el.toast.textContent = message;
  el.toast.dataset.tone = tone;
  el.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.toast.classList.remove('show'), 2400);
}

const mascotFrames = {
  rabbit: { idle: 0, receive: 1, work: 2, done: 3, error: 4, confused: 5, action: 6, calm: 7 },
  turtle: { idle: 8, receive: 9, work: 10, done: 11, calm: 12, happy: 13, celebrate: 14, look: 15 },
};

function setMascot(state = 'idle', { hold = 0 } = {}) {
  document.querySelectorAll('[data-mascot]').forEach(figure => {
    const kind = figure.dataset.mascot;
    const frame = mascotFrames[kind]?.[state] ?? mascotFrames[kind]?.idle ?? 0;
    figure.dataset.state = state;
    figure.style.setProperty('--mascot-frame', frame);
    figure.style.setProperty('--mascot-x', `${(frame % 4) * 33.333333}%`);
    figure.style.setProperty('--mascot-y', `${Math.floor(frame / 4) * 33.333333}%`);
  });
  clearTimeout(setMascot.timer);
  if (hold) setMascot.timer = setTimeout(() => setMascot('idle'), hold);
}


function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function validateFiles(files) {
  const allowed = new Set(['application/pdf','image/jpeg','image/png','image/webp']);
  const maxSize = 100 * 1024 * 1024;
  const accepted=[], rejected=[];
  for (const file of Array.from(files || [])) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const okType = allowed.has(file.type) || ['pdf','jpg','jpeg','png','webp'].includes(ext);
    if (!okType) { rejected.push(`${file.name}: 対応していない形式`); continue; }
    if (file.size > maxSize) { rejected.push(`${file.name}: 100MBを超えています`); continue; }
    accepted.push(file);
  }
  return {accepted,rejected};
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  const units=['B','KB','MB','GB'];
  let value=bytes, i=0;
  while(value>=1024 && i<units.length-1){value/=1024;i++;}
  return `${value.toFixed(value>=10||i===0?0:1)} ${units[i]}`;
}

async function addFiles(files) {
  const validation = validateFiles(files);
  const accepted = validation.accepted;
  if (validation.rejected.length) showToast(validation.rejected.slice(0, 2).join(' / '), 'warn');
  if (!accepted.length) return showToast('PDF・JPEG・PNG・WEBPを選んでください', 'warn');
  snapshot();
  setMascot('receive');
  setBusy(true, 'ページを読み込んでいます…');
  try {
    setMascot('work');
    for (const file of accepted) {
      const sourceId = uid('source');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) await addPdfSource(sourceId, file, bytes);
      else await addImageSource(sourceId, file, bytes);
    }
    render();
    setMascot('done', { hold: 1800 });
    showToast(accepted.length + 'ファイルを追加しました');
  } catch (error) {
    console.error(error);
    setMascot('error', { hold: 2200 });
    showToast('読み込めないファイルがありました', 'error');
  } finally {
    setBusy(false);
  }
}

async function addPdfSource(sourceId, file, bytes) {
  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
  const pdf = await loadingTask.promise;
  state.sources.set(sourceId, { kind: 'pdf', bytes, name: file.name, size: file.size });
  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
    const pdfPage = await pdf.getPage(pageIndex + 1);
    const viewport = pdfPage.getViewport({ scale: 1 });
    const thumbnail = await renderPdfThumbnail(pdfPage);
    state.pages.push(makePage({ sourceId, sourcePageIndex: pageIndex, thumbnail, width: viewport.width, height: viewport.height, label: file.name }));
  }
  await pdf.destroy();
}

async function renderPdfThumbnail(page) {
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(1.25, 300 / base.width);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.8);
}

async function addImageSource(sourceId, file, bytes) {
  const url = URL.createObjectURL(file);
  const image = await loadImage(url);
  const mime = file.type || ({ jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp' }[file.name.split('.').pop()?.toLowerCase()] || 'application/octet-stream');
  state.sources.set(sourceId, { kind: 'image', bytes, mime, name: file.name, size: file.size, width: image.naturalWidth, height: image.naturalHeight });
  state.pages.push(makePage({ sourceId, sourcePageIndex: 0, thumbnail: url, width: image.naturalWidth, height: image.naturalHeight, label: file.name }));
}

function getAdjust(page) {
  return page.imageAdjust || { brightness:100, contrast:100, grayscale:0, trim:null };
}

function applyImageAdjustments(canvas, adjust) {
  const a = adjust || {};
  const brightness = Number(a.brightness ?? 100);
  const contrast = Number(a.contrast ?? 100);
  const grayscale = Number(a.grayscale ?? 0);
  if (brightness === 100 && contrast === 100 && grayscale === 0) return canvas;
  const out = document.createElement('canvas');
  out.width = canvas.width; out.height = canvas.height;
  const ctx = out.getContext('2d');
  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%)`;
  ctx.drawImage(canvas, 0, 0);
  return out;
}

function autoTrimCanvas(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently:true });
  const { width, height } = canvas;
  const step = Math.max(2, Math.floor(Math.min(width, height) / 500));
  const data = ctx.getImageData(0,0,width,height).data;
  const threshold = 245;
  let minX=width, minY=height, maxX=-1, maxY=-1;
  for (let y=0; y<height; y+=step) {
    for (let x=0; x<width; x+=step) {
      const i=(y*width+x)*4;
      const v=(data[i]+data[i+1]+data[i+2])/3;
      if (v < threshold || data[i+3] < 245) {
        if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y;
      }
    }
  }
  if (maxX < 0) return {x:0,y:0,w:1,h:1};
  const pad = Math.max(2, Math.round(Math.min(width,height)*0.01));
  minX=Math.max(0,minX-pad); minY=Math.max(0,minY-pad);
  maxX=Math.min(width-1,maxX+pad); maxY=Math.min(height-1,maxY+pad);
  return {x:minX/width,y:minY/height,w:(maxX-minX+1)/width,h:(maxY-minY+1)/height};
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function makePage(data) {
  const index = state.pages.length;
  return {
    id: uid(), rotation: 0, kind: 'source', annotations: [], crop: null, ...data,
    connector: connectorTypes[index % connectorTypes.length],
    connectorColor: connectorColors[index % connectorColors.length],
  };
}

function addBlank() {
  snapshot();
  state.pages.push({ id: uid(), kind: 'blank', rotation: 0, width: 595.28, height: 841.89, label: '白紙ページ', connector: connectorTypes[state.pages.length % connectorTypes.length], connectorColor: 'lilac' });
  render();
  animateLastPage();
}

function openSeparatorDialog() {
  el.separatorTitle.value = '';
  el.separatorSubtitle.value = '';
  el.separatorDialog.showModal();
  setTimeout(() => el.separatorTitle.focus(), 50);
}

function addSeparator() {
  const title = el.separatorTitle.value.trim() || '区切り表紙';
  snapshot();
  state.pages.push({ id: uid(), kind: 'separator', rotation: 0, width: 595.28, height: 841.89, label: title, title, subtitle: el.separatorSubtitle.value.trim(), connector: connectorTypes[state.pages.length % connectorTypes.length], connectorColor: 'sage' });
  render();
  animateLastPage();
}

function animateLastPage() {
  requestAnimationFrame(() => el.pageGrid.lastElementChild?.classList.add('snap-in'));
}

function toggleSelect(id, additive, range = false) {
  const index = state.pages.findIndex(page => page.id === id);
  const lastIndex = state.pages.findIndex(page => page.id === state.lastSelectedId);
  const isRange = range && additive && index >= 0 && lastIndex >= 0 && state.lastSelectedId !== id;
  if (isRange) {
    state.selected.clear();
    const [start, end] = index < lastIndex ? [index, lastIndex] : [lastIndex, index];
    state.pages.slice(start, end + 1).forEach(page => state.selected.add(page.id));
  } else if (!additive) {
    state.selected.clear();
    state.selected.add(id);
  } else if (state.selected.has(id)) {
    state.selected.delete(id);
  } else {
    state.selected.add(id);
  }
  state.lastSelectedId = id;
  renderSelection();
}

function rotateSelected() {
  if (!state.selected.size) return showToast('回転するページを選択してください', 'warn');
  snapshot();
  state.pages.forEach(page => { if (state.selected.has(page.id)) page.rotation = (page.rotation + 90) % 360; });
  render();
}

function deleteSelected() {
  if (!state.selected.size) return showToast('削除するページを選択してください', 'warn');
  snapshot();
  state.pages = state.pages.filter(page => !state.selected.has(page.id));
  state.selected.clear();
  render();
  showToast('ページを削除しました');
}

function render() {
  el.dropzone.hidden = state.pages.length > 0;
  el.pageGrid.hidden = state.pages.length === 0;
  el.pageGrid.innerHTML = '';
  state.pages.forEach((page, index) => el.pageGrid.append(makeCard(page, index)));
  renderSelection();
  updateStats();
}

function makeCard(page, index) {
  const card = document.createElement('article');
  card.className = `page-card connector-${page.connector} color-${page.connectorColor}`;
  card.dataset.id = page.id;
  card.draggable = true;
  card.tabIndex = 0;
  card.setAttribute('aria-label', `${index + 1}ページ目 ${page.label}`);
  if (state.selected.has(page.id)) card.classList.add('selected');
  const preview = page.kind === 'source'
    ? `<img src="${page.thumbnail}" alt="" loading="lazy" decoding="async" style="transform:rotate(${page.rotation}deg)"/>`
    : page.kind === 'separator'
      ? `<div class="generated-page separator-preview"><span>SECTION</span><h3>${escapeHtml(page.title)}</h3><p>${escapeHtml(page.subtitle || '')}</p></div>`
      : `<div class="generated-page blank-preview"><span>BLANK</span></div>`;
  card.innerHTML = `
    <div class="connector top"></div><div class="connector right"></div><div class="connector bottom"></div><div class="connector left"></div>
    <button class="select-dot" aria-label="ページを選択">${state.selected.has(page.id) ? '✓' : ''}</button>
    <div class="card-actions"><button class="preview-button" title="拡大表示">↗</button><button class="edit-button" title="加工・編集">✎</button></div>
    <div class="page-paper ${page.width > page.height ? 'landscape' : ''}">${preview}</div>
    <div class="page-meta"><strong>${String(index + 1).padStart(2,'0')}</strong><span title="${escapeHtml(page.label)}">${escapeHtml(shorten(page.label, 18))}</span></div>`;
  card.addEventListener('click', event => {
    if (event.target.closest('.preview-button')) return previewPage(page, index);
    if (event.target.closest('.edit-button')) return openEditor(page, index);
    toggleSelect(page.id, event.metaKey || event.ctrlKey || event.shiftKey, event.shiftKey);
  });
  card.addEventListener('dblclick', () => openEditor(page, index));
  card.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleSelect(page.id, event.ctrlKey || event.metaKey || event.shiftKey, event.shiftKey); }
    if (event.key === 'Delete' || event.key === 'Backspace') deleteSelected();
  });
  card.addEventListener('dragstart', event => {
    state.dragId = page.id;
    if (!state.selected.has(page.id)) {
      state.selected.clear();
      state.selected.add(page.id);
      renderSelection();
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', page.id);
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => { state.dragId = null; card.classList.remove('dragging'); clearDragStyles(); });
  card.addEventListener('dragover', event => { event.preventDefault(); if (state.dragId !== page.id) card.classList.add('magnet-target'); });
  card.addEventListener('dragleave', () => card.classList.remove('magnet-target'));
  card.addEventListener('drop', event => {
    event.preventDefault();
    event.stopPropagation();
    const from = state.pages.findIndex(item => item.id === state.dragId);
    const to = state.pages.findIndex(item => item.id === page.id);
    if (from < 0 || to < 0 || from === to) return clearDragStyles();
    snapshot();
    const movingIds = state.selected.has(state.dragId)
      ? new Set(state.selected)
      : new Set([state.dragId]);
    const moving = state.pages.filter(item => movingIds.has(item.id));
    const remaining = state.pages.filter(item => !movingIds.has(item.id));
    const targetOriginalIndex = state.pages.findIndex(item => item.id === page.id);
    const removedBeforeTarget = state.pages.slice(0, targetOriginalIndex).filter(item => movingIds.has(item.id)).length;
    let insertAt = targetOriginalIndex - removedBeforeTarget;
    insertAt = Math.max(0, Math.min(insertAt, remaining.length));
    remaining.splice(insertAt, 0, ...moving);
    state.pages = remaining;
    render();
    const target = el.pageGrid.children[Math.min(insertAt, el.pageGrid.children.length - 1)];
    target?.classList.add('snap-in');
    showToast(moving.length > 1 ? `${moving.length}ページを移動しました` : 'カチッ　ページを移動しました');
  });
  return card;
}

function renderSelection() {
  [...el.pageGrid.children].forEach(card => card.classList.toggle('selected', state.selected.has(card.dataset.id)));
  el.selectionBar.hidden = state.selected.size === 0;
  el.selectionCount.textContent = `${state.selected.size}ページ選択中`;
}

function updateStats() {
  el.pageCount.textContent = `全${state.pages.length}ページ`;
  const uniqueSources = new Set(state.pages.filter(page => page.sourceId).map(page => page.sourceId));
  const bytes = [...uniqueSources].reduce((sum, id) => sum + (state.sources.get(id)?.size || 0), 0);
  el.sizeText.textContent = formatBytes(bytes);
  const landscapeCount = state.pages.filter(page => ((page.rotation / 90) % 2 === 0 ? page.width > page.height : page.height > page.width)).length;
  el.warningText.textContent = landscapeCount ? `・横向き ${landscapeCount}ページ` : '';
  el.exportBtn.disabled = state.pages.length === 0 || state.busy;
}

function clearDragStyles() { document.querySelectorAll('.magnet-target').forEach(node => node.classList.remove('magnet-target')); }

function setMode(mode, closeGate = true) {
  state.mode = mode;
  document.body.dataset.mode = mode;
  if (closeGate) el.modeGate.classList.add('closed');
  document.querySelectorAll('[data-switch]').forEach(button => button.classList.toggle('active', button.dataset.switch === mode));
}

function previewPage(page, index) {
  if (page.thumbnail) {
    el.previewImage.src = page.thumbnail;
    el.previewImage.style.transform = `rotate(${page.rotation}deg)`;
    el.previewImage.hidden = false;
  } else {
    el.previewImage.hidden = true;
  }
  el.previewLabel.textContent = `${index + 1}ページ目　${page.label}`;
  el.previewDialog.showModal();
}

async function openEditor(page, index) {
  if (!page || page.kind !== 'source') return showToast('元のPDF・画像ページを選んでください', 'warn');
  state.editor.pageId = page.id;
  state.editor.draft = structuredClone(page.annotations || []);
  state.editor.crop = page.crop ? { ...page.crop } : null;
  state.editor.tool = 'select';
  el.editorPageLabel.textContent = `${index + 1}ページ目　${page.label}`;
  document.querySelectorAll('[data-edit-tool]').forEach(button => button.classList.toggle('active', button.dataset.editTool === 'select'));
  el.textOption.hidden = true;
  el.cropOptions.hidden = true;
  el.editorStatus.textContent = 'ツールを選んで、ページ上で操作できます';
  await renderEditorPage(page);
  el.editorDialog.showModal();
}

async function renderEditorPage(page) {
  const canvas = el.editorCanvas;
  const maxW = Math.min(860, window.innerWidth - 430);
  const maxH = Math.min(720, window.innerHeight - 190);
  const image = await loadImage(page.thumbnail);
  const turned = page.rotation % 180 !== 0;
  const sourceRatio = turned ? image.height / image.width : image.width / image.height;
  const full = document.createElement('canvas');
  full.width = Math.round(Math.min(maxW, maxH * sourceRatio));
  full.height = Math.round(full.width / sourceRatio);
  const fctx = full.getContext('2d');
  fctx.fillStyle = '#fff'; fctx.fillRect(0, 0, full.width, full.height);
  fctx.translate(full.width / 2, full.height / 2); fctx.rotate(page.rotation * Math.PI / 180);
  const dw = turned ? full.height : full.width, dh = turned ? full.width : full.height;
  fctx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
  const showCropResult = state.editor.crop && state.editor.tool !== 'crop';
  if (showCropResult) {
    const ratio = state.editor.crop.orientation === 'landscape' ? 297/210 : 210/297;
    canvas.width = Math.round(Math.min(maxW, maxH * ratio)); canvas.height = Math.round(canvas.width / ratio);
    const c = state.editor.crop;
    canvas.getContext('2d').drawImage(full, c.x*full.width, c.y*full.height, c.w*full.width, c.h*full.height, 0, 0, canvas.width, canvas.height);
  } else {
    canvas.width = full.width; canvas.height = full.height; canvas.getContext('2d').drawImage(full, 0, 0);
  }
  drawAnnotations(canvas.getContext('2d'), state.editor.draft, canvas.width, canvas.height);
  syncCropBox();
}

function drawAnnotations(ctx, annotations, width, height) {
  for (const item of annotations) {
    ctx.save(); ctx.strokeStyle = item.color; ctx.fillStyle = item.color; ctx.globalAlpha = item.opacity; ctx.lineWidth = item.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pts = item.points?.map(p => [p.x * width, p.y * height]) || [];
    if ((item.type === 'pen' || item.type === 'highlight') && pts.length) {
      if (item.type === 'highlight') { ctx.globalCompositeOperation = 'multiply'; ctx.lineWidth = item.width * 3; }
      ctx.beginPath(); ctx.moveTo(...pts[0]); pts.slice(1).forEach(p => ctx.lineTo(...p)); ctx.stroke();
    } else if (item.type === 'rect' && pts.length > 1) {
      ctx.strokeRect(pts[0][0], pts[0][1], pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
    } else if (item.type === 'line' && pts.length > 1) {
      ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.lineTo(...pts[1]); ctx.stroke();
    } else if (item.type === 'arrow' && pts.length > 1) {
      drawArrow(ctx, pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
    } else if (item.type === 'text') {
      ctx.globalAlpha = item.opacity; ctx.font = `700 ${Math.max(14, item.width * 4)}px "Noto Sans JP", sans-serif`; ctx.fillText(item.text, item.x * width, item.y * height);
    }
    ctx.restore();
  }
}

function drawArrow(ctx, x1, y1, x2, y2) {
  const angle = Math.atan2(y2-y1, x2-x1), head = 10 + ctx.lineWidth;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2,y2); ctx.lineTo(x2-head*Math.cos(angle-Math.PI/6),y2-head*Math.sin(angle-Math.PI/6)); ctx.lineTo(x2-head*Math.cos(angle+Math.PI/6),y2-head*Math.sin(angle+Math.PI/6)); ctx.closePath(); ctx.fill();
}

function pointerPosition(event) {
  const rect = el.editorCanvas.getBoundingClientRect();
  return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
}

function beginDraw(event) {
  if (state.editor.tool === 'select' || state.editor.tool === 'crop') return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const point = pointerPosition(event);
  if (state.editor.tool === 'text') {
    const text = el.editText.value.trim(); if (!text) return showToast('追加する文字を入力してください', 'warn');
    state.editor.draft.push({ type:'text', text, x:point.x, y:point.y, color:el.editColor.value, width:+el.editWidth.value, opacity:+el.editOpacity.value/100 });
    el.editorStatus.textContent = '文字を追加しました。続けて配置できます';
    return redrawEditor();
  }
  state.editor.drawing = { type:state.editor.tool, points:[point], color:el.editColor.value, width:+el.editWidth.value, opacity:+el.editOpacity.value/100 };
  el.editorCanvas.setPointerCapture(event.pointerId);
}
function moveDraw(event) {
  const item = state.editor.drawing; if (!item) return;
  const point = pointerPosition(event);
  if (item.type === 'pen' || item.type === 'highlight') item.points.push(point); else item.points[1] = point;
  redrawEditor(item);
}
function endDraw() {
  if (!state.editor.drawing) return;
  state.editor.draft.push(state.editor.drawing); state.editor.drawing = null; redrawEditor();
}
async function redrawEditor(extra) {
  const page = state.pages.find(p => p.id === state.editor.pageId); if (!page) return;
  await renderEditorPage(page);
  if (extra) drawAnnotations(el.editorCanvas.getContext('2d'), [extra], el.editorCanvas.width, el.editorCanvas.height);
}

function syncCropBox() {
  if (state.editor.tool !== 'crop') { el.cropBox.hidden = true; return; }
  el.cropBox.hidden = false;
  if (!state.editor.crop) state.editor.crop = defaultCrop();
  const c = state.editor.crop;
  Object.assign(el.cropBox.style, { left:`${c.x*100}%`, top:`${c.y*100}%`, width:`${c.w*100}%`, height:`${c.h*100}%` });
}
function defaultCrop() {
  const canvasRatio = el.editorCanvas.width / el.editorCanvas.height;
  const portrait = document.querySelector('[name="cropOrient"]:checked')?.value !== 'landscape';
  const target = portrait ? 210/297 : 297/210;
  let w=.86,h=.86; if (canvasRatio > target) w = h * target / canvasRatio; else h = w * canvasRatio / target;
  return { x:(1-w)/2, y:(1-h)/2, w, h, orientation:portrait?'portrait':'landscape' };
}

function applyEditor() {
  const page = state.pages.find(p => p.id === state.editor.pageId); if (!page) return;
  snapshot(); page.annotations = structuredClone(state.editor.draft); page.crop = state.editor.crop ? {...state.editor.crop} : null;
  render(); el.editorStatus.textContent = '保存しました。続けて編集できます'; setMascot('done', { hold: 1200 }); showToast('編集内容を保存しました');
}

function setBusy(busy, message = '') {
  state.busy = busy;
  document.body.classList.toggle('busy', busy);
  if (message) showToast(message);
  document.body.dataset.busyMessage = message || '';
  updateHistoryButtons();
  updateStats();
}


function setProgress(current, total, label) {
  const pct = total ? Math.round((current / total) * 100) : 0;
  const message = total ? `${label} ${current} / ${total}（${pct}%）` : label;
  document.body.dataset.progress = message;
  const status = document.querySelector('.busy-message, #busyMessage');
  if (status) status.textContent = message;
  el.toast.textContent = message;
  el.toast.dataset.tone = 'normal';
  el.toast.classList.add('show');
  clearTimeout(showToast.timer);
}

function updateCompressLabels() {
  el.compressQualityValue.textContent = el.compressQuality.value;
  el.compressScaleValue.textContent = el.compressScale.value;
}

function setCompressPreset(kind) {
  const values = { small:[55,90], balanced:[75,120], quality:[90,165] }[kind];
  el.compressQuality.value=values[0];
  el.compressScale.value=values[1];
  updateCompressLabels();
}

async function renderPageForPdfImage(pageData, scaleFactor=1.2) {
  if (pageData.kind !== 'source') return pageToCanvas(pageData);
  const source = state.sources.get(pageData.sourceId);
  if (!source) throw new Error('元ファイルが見つかりません');
  const adjust = getAdjust(pageData);
  const hasEdits = !!(pageData.annotations?.length || pageData.crop || adjust.trim || adjust.brightness !== 100 || adjust.contrast !== 100 || adjust.grayscale);
  if (hasEdits) {
    const dataUrl = await renderEditedPage(pageData, source);
    const image = await loadImage(dataUrl);
    const editedCanvas = document.createElement('canvas');
    editedCanvas.width = image.naturalWidth;
    editedCanvas.height = image.naturalHeight;
    editedCanvas.getContext('2d').drawImage(image, 0, 0);
    return editedCanvas;
  }
  let canvas;
  if (source.kind === 'pdf') {
    const pdf = await pdfjsLib.getDocument({ data: source.bytes.slice() }).promise;
    const pdfPage = await pdf.getPage(pageData.sourcePageIndex + 1);
    const viewport = pdfPage.getViewport({ scale: Math.max(.8, scaleFactor), rotation: pageData.rotation });
    canvas=document.createElement('canvas');
    canvas.width=Math.ceil(viewport.width); canvas.height=Math.ceil(viewport.height);
    await pdfPage.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    await pdf.destroy();
  } else {
    const blob=new Blob([source.bytes],{type:source.mime});
    const url=URL.createObjectURL(blob);
    const image=await loadImage(url);
    const turned=pageData.rotation%180!==0;
    canvas=document.createElement('canvas');
    canvas.width=turned?image.height:image.width; canvas.height=turned?image.width:image.height;
    const ctx=canvas.getContext('2d');
    ctx.translate(canvas.width/2,canvas.height/2);
    ctx.rotate(pageData.rotation*Math.PI/180);
    ctx.drawImage(image,-image.width/2,-image.height/2);
    URL.revokeObjectURL(url);
  }
  const adjust=getAdjust(pageData);
  if (adjust.trim || adjust.brightness!==100 || adjust.contrast!==100 || adjust.grayscale) {
    const adjusted=applyImageAdjustments(canvas,adjust);
    const crop=adjust.trim || {x:0,y:0,w:1,h:1};
    const trimmed=document.createElement('canvas');
    trimmed.width=Math.max(1,Math.round(adjusted.width*crop.w));
    trimmed.height=Math.max(1,Math.round(adjusted.height*crop.h));
    trimmed.getContext('2d').drawImage(adjusted,crop.x*adjusted.width,crop.y*adjusted.height,adjusted.width*crop.w,adjusted.height*crop.h,0,0,trimmed.width,trimmed.height);
    canvas=trimmed;
  }
  return canvas;
}

async function compressPdf() {
  if (!state.pages.length) return showToast('先にPDFまたは画像を追加してください','warn');
  const quality=Number(el.compressQuality.value)/100;
  const scale=Number(el.compressScale.value)/100;
  el.compressRun.disabled=true;
  setBusy(true,'PDFを圧縮しています…');
  setMascot('work');
  try {
    const output=await PDFDocument.create();
    for (let pageIndex = 0; pageIndex < state.pages.length; pageIndex++) {
      const pageData = state.pages[pageIndex];
      setProgress(pageIndex + 1, state.pages.length, 'PDFを圧縮中');
      await new Promise(resolve => setTimeout(resolve, 0));
      const canvas=await renderPageForPdfImage(pageData,scale*1.8);
      const maxPage=841.89;
      const pageScale=Math.min(maxPage/canvas.width, maxPage/canvas.height);
      const pw=Math.max(72, canvas.width*pageScale);
      const ph=Math.max(72, canvas.height*pageScale);
      const page=output.addPage([pw,ph]);
      const jpg=canvas.toDataURL('image/jpeg',quality);
      const embedded=await output.embedJpg(jpg);
      page.drawImage(embedded,{x:0,y:0,width:pw,height:ph});
    }
    const bytes=await output.save({useObjectStreams:true, addDefaultPage:false});
    const blob=new Blob([bytes],{type:'application/pdf'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;
    const original=sanitizeFilename(el.filename.value.replace(/\.pdf$/i,'')) || 'PAPER-PUNCH';
    anchor.download=original+'_compressed.pdf';
    anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    el.compressSize.textContent='完了';
    setMascot('done',{hold:1600});
    showToast('圧縮PDFを書き出しました');
  } catch(error) {
    console.error(error);
    el.compressSize.textContent='エラー';
    setMascot('error',{hold:1800});
    showToast('PDFの圧縮に失敗しました','error');
  } finally {
    el.compressRun.disabled=false;
    setBusy(false);
  }
}

async function exportPdf(pages = state.pages, filename = el.filename.value) {
  if (!pages.length) return;
  const cleanName = sanitizeFilename(filename || 'PAPER-PUNCH.pdf').replace(/\.pdf$/i,'') || 'PAPER-PUNCH';
  filename = cleanName + '.pdf';
  setBusy(true, 'PDFを組み立てています…');
  setMascot('work');
  try {
    const output = await PDFDocument.create();
    const cache = new Map();
    const font = await output.embedFont(StandardFonts.Helvetica);
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const pageData = pages[pageIndex];
      setProgress(pageIndex + 1, pages.length, 'PDFを書き出し中');
      await new Promise(resolve => setTimeout(resolve, 0));
      let page;
      if (pageData.kind === 'source') {
        const source = state.sources.get(pageData.sourceId);
        const hasAdjust = !!pageData.imageAdjust && (pageData.imageAdjust.trim || pageData.imageAdjust.brightness !== 100 || pageData.imageAdjust.contrast !== 100 || pageData.imageAdjust.grayscale);
        if ((pageData.annotations?.length || pageData.crop || hasAdjust) && source) {
          const rendered = await renderEditedPage(pageData, source);
          const embeddedPng = await output.embedPng(rendered);
          const landscape = pageData.crop ? pageData.crop.orientation === 'landscape' : ((pageData.rotation % 180 === 0) ? pageData.width > pageData.height : pageData.height > pageData.width);
          const pw = landscape ? 841.89 : 595.28;
          const ph = landscape ? 595.28 : 841.89;
          page = output.addPage([pw, ph]);
          page.drawImage(embeddedPng, { x: 0, y: 0, width: pw, height: ph });
          continue;
        }
        if (source.kind === 'pdf') {
          if (!cache.has(pageData.sourceId)) cache.set(pageData.sourceId, await PDFDocument.load(source.bytes));
          const sourcePdf = cache.get(pageData.sourceId);
          if (el.a4Normalize.checked) {
            const embedded = await output.embedPage(sourcePdf.getPage(pageData.sourcePageIndex));
            page = drawEmbeddedOnA4(output, embedded, pageData.rotation);
          } else {
            const [copied] = await output.copyPages(sourcePdf, [pageData.sourcePageIndex]);
            output.addPage(copied);
            copied.setRotation(degrees((copied.getRotation().angle + pageData.rotation) % 360));
            page = copied;
          }
        } else {
          if (source.mime === 'image/webp') {
            const canvas = await pageToCanvas(pageData);
            const image = await output.embedJpg(canvas.toDataURL('image/jpeg', 0.92));
            const dims = fitToA4(canvas.width, canvas.height, 0);
            page = output.addPage([dims.pageWidth, dims.pageHeight]);
            page.drawImage(image, { x: dims.x, y: dims.y, width: dims.width, height: dims.height });
          } else {
            const image = source.mime === 'image/png' ? await output.embedPng(source.bytes) : await output.embedJpg(source.bytes);
            const dims = fitToA4(source.width, source.height, pageData.rotation);
            page = output.addPage([dims.pageWidth, dims.pageHeight]);
            page.drawImage(image, { x: dims.x, y: dims.y, width: dims.width, height: dims.height, rotate: degrees(pageData.rotation) });
          }
        }
      } else {
        page = output.addPage([595.28, 841.89]);
        if (pageData.kind === 'separator') {
          const separatorPng = await output.embedPng(makeSeparatorPng(pageData.title, pageData.subtitle));
          page.drawImage(separatorPng, { x: 0, y: 0, width: 595.28, height: 841.89 });
        }
      }
    }
    if (el.pageNumbers.checked) {
      const pages = output.getPages();
      pages.forEach((page, index) => {
        const { width } = page.getSize();
        const label = String(index + 1);
        page.drawText(label, { x: width / 2 - label.length * 3, y: 18, size: 9, font, color: rgb(0.35, 0.38, 0.4) });
      });
    }
    const bytes = await output.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = sanitizeFilename(filename);
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setMascot('done', { hold: 1500 });
    showToast(`完成！ ${filename} を保存しました`);
  } catch (error) {
    console.error(error);
    setMascot('error', { hold: 1800 });
    showToast('PDFの書き出しに失敗しました。元ファイルは変更されていません。', 'error');
  } finally {
    setBusy(false);
  }
}

let ocrWorker = null;

async function getOcrWorker() {
  if (!window.Tesseract) throw new Error('OCRエンジンを読み込めませんでした');
  if (ocrWorker) return ocrWorker;
  setMascot('work');
  el.ocrProgress.textContent = 'OCRエンジンを準備中…';
  ocrWorker = await Tesseract.createWorker('jpn+eng', 1, {
    logger: message => {
      if (message?.status) {
        const percent = typeof message.progress === 'number' ? ` ${Math.round(message.progress * 100)}%` : '';
        el.ocrProgress.textContent = message.status + percent;
      }
    }
  });
  await ocrWorker.setParameters({
    preserve_interword_spaces: '1'
  });
  return ocrWorker;
}

function prepareOcrCanvas(sourceCanvas) {
  const maxSide = 2400;
  const scale = Math.min(1.35, maxSide / Math.max(sourceCanvas.width, sourceCanvas.height));
  if (scale >= 0.99) return sourceCanvas;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
  canvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));
  const ctx = canvas.getContext('2d', { alpha:false });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function pageToCanvas(page) {
  const canvas = document.createElement('canvas');
  if (page.kind !== 'source') {
    canvas.width = 1240; canvas.height = 1754;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (page.kind === 'separator') {
      const image = await loadImage(makeSeparatorPng(page.title, page.subtitle));
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    }
    return canvas;
  }
  const source = state.sources.get(page.sourceId);
  if (!source) throw new Error('元ファイルが見つかりません');
  if (source.kind === 'pdf') {
    const pdf = await pdfjsLib.getDocument({ data: source.bytes.slice() }).promise;
    const pdfPage = await pdf.getPage(page.sourcePageIndex + 1);
    const viewport = pdfPage.getViewport({ scale: 2.5, rotation: page.rotation });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    await pdf.destroy();
    return applyImageAdjustments(canvas, getAdjust(page));
  }
  const blob = new Blob([source.bytes], { type: source.mime });
  const url = URL.createObjectURL(blob);
  const image = await loadImage(url);
  const turned = page.rotation % 180 !== 0;
  canvas.width = turned ? image.height : image.width;
  canvas.height = turned ? image.width : image.height;
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(page.rotation * Math.PI / 180);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  URL.revokeObjectURL(url);
  return applyImageAdjustments(canvas, getAdjust(page));
}

async function openCorrectionDialog() {
  const pages = state.pages.filter(page => state.selected.has(page.id));
  if (!pages.length) return showToast('補正するページを選択してください', 'warn');
  el.correctSummary.textContent = `${pages.length}ページに補正を適用できます。`;
  const a = getAdjust(pages[0]);
  el.correctBrightness.value = a.brightness;
  el.correctContrast.value = a.contrast;
  el.correctGray.value = a.grayscale;
  updateCorrectionLabels();
  el.correctDialog.showModal();
}

function updateCorrectionLabels() {
  el.correctBrightnessValue.textContent = el.correctBrightness.value;
  el.correctContrastValue.textContent = el.correctContrast.value;
  el.correctGrayValue.textContent = el.correctGray.value;
}

async function applyCorrection() {
  const pages = state.pages.filter(page => state.selected.has(page.id));
  if (!pages.length) return showToast('補正するページを選択してください', 'warn');
  const adjust = {
    brightness:Number(el.correctBrightness.value),
    contrast:Number(el.correctContrast.value),
    grayscale:Number(el.correctGray.value),
    trim:null
  };
  pushHistory();
  pages.forEach(page => { page.imageAdjust = {...(page.imageAdjust || {}), ...adjust}; });
  el.correctDialog.close();
  render();
  setMascot('done', { hold: 1200 });
  showToast(`${pages.length}ページに画像補正を適用しました`);
}

async function applyDocumentPreset() {
  el.correctBrightness.value=106; el.correctContrast.value=132; el.correctGray.value=35;
  updateCorrectionLabels();
}

async function applyAutoTrim() {
  const page = state.pages.find(p => state.selected.has(p.id));
  if (!page) return;
  setBusy(true,'余白を解析しています…');
  try {
    const canvas = await pageToCanvas({...page, imageAdjust:{brightness:100,contrast:100,grayscale:0,trim:null}});
    const trim = autoTrimCanvas(canvas);
    pushHistory();
    state.pages.filter(p=>state.selected.has(p.id)).forEach(p => {
      p.imageAdjust={...(p.imageAdjust||{}),trim};
    });
    render();
    showToast('自動余白カットを設定しました');
  } catch(e) {
    console.error(e); showToast('余白の解析に失敗しました','error');
  } finally { setBusy(false); }
}

async function runOcr() {
  const pages = state.pages.filter(page => state.selected.has(page.id));
  if (!pages.length) {
    showToast('OCRするページを選択してください', 'warn');
    return;
  }
  el.ocrResult.value = '';
  el.ocrSummary.textContent = `${pages.length}ページをOCRしています…`;
  el.ocrRun.disabled = true;
  setBusy(true, 'OCRしています…');
  setMascot('work');
  try {
    const worker = await getOcrWorker();
    const chunks = [];
    for (let i = 0; i < pages.length; i++) {
      el.ocrProgress.textContent = `ページ ${i + 1} / ${pages.length}`;
      const canvas = prepareOcrCanvas(await pageToCanvas(pages[i]));
      const { data } = await worker.recognize(canvas, { rotateAuto: true });
      const text = (data.text || '').trim();
      chunks.push(`--- ${i + 1}ページ目 ---\n${text || '（文字を検出できませんでした）'}`);
      el.ocrResult.value = chunks.join('\n\n');
      el.ocrResult.scrollTop = el.ocrResult.scrollHeight;
    }
    el.ocrSummary.textContent = `${pages.length}ページのOCRが完了しました。`;
    el.ocrProgress.textContent = '完了';
    setMascot('done', { hold: 1800 });
    showToast('OCRが完了しました');
  } catch (error) {
    console.error(error);
    el.ocrProgress.textContent = 'エラー';
    el.ocrSummary.textContent = 'OCRに失敗しました。通信状態やページ内容を確認してください。';
    setMascot('error', { hold: 2200 });
    showToast('OCRに失敗しました', 'error');
  } finally {
    el.ocrRun.disabled = false;
    setBusy(false);
  }
}

async function exportSelectedPdf() {
  const pages = state.pages.filter(page => state.selected.has(page.id));
  if (!pages.length) return showToast('PDFにするページを選択してください', 'warn');
  const original = el.filename.value;
  const base = original.replace(/\.pdf$/i, '');
  await exportPdf(pages, `${base}_分割.pdf`);
}

async function exportPageImage(format) {
  const page = state.pages.find(p => state.selected.has(p.id)) || state.pages[0];
  if (!page) return showToast('先にPDFまたは画像を追加してください', 'warn');

  setBusy(true, `${format.toUpperCase()}を作っています…`);
  try {
    let dataUrl;
    if (page.kind === 'source') {
      const source = state.sources.get(page.sourceId);
      const adjust = getAdjust(page);
      const hasAdjust = adjust.trim || adjust.brightness !== 100 || adjust.contrast !== 100 || adjust.grayscale;
      if (page.annotations?.length || page.crop || hasAdjust) {
        dataUrl = await renderEditedPage(page, source);
      } else if (source.kind === 'pdf') {
        const pdf = await pdfjsLib.getDocument({ data: source.bytes.slice() }).promise;
        const pdfPage = await pdf.getPage(page.sourcePageIndex + 1);
        const viewport = pdfPage.getViewport({ scale: 2.2, rotation: page.rotation });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        dataUrl = format === 'png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.92);
        await pdf.destroy();
      } else {
        const blob = new Blob([source.bytes], { type: source.mime });
        const url = URL.createObjectURL(blob);
        const image = await loadImage(url);
        const canvas = document.createElement('canvas');
        const turned = page.rotation % 180 !== 0;
        canvas.width = turned ? image.height : image.width;
        canvas.height = turned ? image.width : image.height;
        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(page.rotation * Math.PI / 180);
        ctx.drawImage(image, -image.width / 2, -image.height / 2);
        dataUrl = format === 'png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.92);
        URL.revokeObjectURL(url);
      }
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = 1240; canvas.height = 1754;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (page.kind === 'separator') {
        const image = await loadImage(makeSeparatorPng(page.title, page.subtitle));
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      }
      dataUrl = format === 'png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.92);
    }

    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = `PAPER-PUNCH-${String(state.pages.indexOf(page) + 1).padStart(2,'0')}.${format === 'png' ? 'png' : 'jpg'}`;
    anchor.click();
    showToast(`${format.toUpperCase()}を書き出しました`);
  } catch (error) {
    console.error(error);
    showToast(`${format.toUpperCase()}の書き出しに失敗しました`, 'error');
  } finally {
    setBusy(false);
  }
}

async function renderEditedPage(pageData, source) {
  const adjust = getAdjust(pageData);
  const crop = pageData.crop || (adjust.trim || { x:0, y:0, w:1, h:1 });
  crop.orientation = crop.orientation || (pageData.width>pageData.height?'landscape':'portrait');
  const outW = crop.orientation === 'landscape' ? 1684 : 1190;
  const outH = crop.orientation === 'landscape' ? 1190 : 1684;
  const base = document.createElement('canvas');
  if (source.kind === 'pdf') {
    const pdf = await pdfjsLib.getDocument({ data: source.bytes.slice() }).promise;
    const sourcePage = await pdf.getPage(pageData.sourcePageIndex + 1);
    const viewport = sourcePage.getViewport({ scale: 2.2, rotation: pageData.rotation });
    base.width = Math.ceil(viewport.width); base.height = Math.ceil(viewport.height);
    await sourcePage.render({ canvasContext: base.getContext('2d'), viewport }).promise;
    await pdf.destroy();
  } else {
    const blob = new Blob([source.bytes], { type: source.mime });
    const url = URL.createObjectURL(blob); const image = await loadImage(url);
    const turned = pageData.rotation % 180 !== 0;
    base.width = turned ? image.height : image.width; base.height = turned ? image.width : image.height;
    const ctx = base.getContext('2d'); ctx.translate(base.width/2, base.height/2); ctx.rotate(pageData.rotation*Math.PI/180); ctx.drawImage(image,-image.width/2,-image.height/2);
    URL.revokeObjectURL(url);
  }
  const adjusted = applyImageAdjustments(base, adjust);
  const result = document.createElement('canvas'); result.width=outW; result.height=outH;
  const resultCtx = result.getContext('2d');
  resultCtx.drawImage(adjusted,crop.x*adjusted.width,crop.y*adjusted.height,crop.w*adjusted.width,crop.h*adjusted.height,0,0,outW,outH);
  drawAnnotations(resultCtx,pageData.annotations||[],outW,outH);
  return result.toDataURL('image/png');
}

function drawEmbeddedOnA4(output, embedded, rotation) {
  const quarterTurn = rotation % 180 !== 0;
  const sourceWidth = quarterTurn ? embedded.height : embedded.width;
  const sourceHeight = quarterTurn ? embedded.width : embedded.height;
  const portrait = sourceHeight >= sourceWidth;
  const pageWidth = portrait ? 595.28 : 841.89;
  const pageHeight = portrait ? 841.89 : 595.28;
  const scale = Math.min((pageWidth - 36) / sourceWidth, (pageHeight - 36) / sourceHeight);
  const drawnWidth = embedded.width * scale;
  const drawnHeight = embedded.height * scale;
  const page = output.addPage([pageWidth, pageHeight]);
  if (rotation === 90) page.drawPage(embedded, { x: (pageWidth + drawnHeight) / 2, y: (pageHeight - drawnWidth) / 2, xScale: scale, yScale: scale, rotate: degrees(90) });
  else if (rotation === 180) page.drawPage(embedded, { x: (pageWidth + drawnWidth) / 2, y: (pageHeight + drawnHeight) / 2, xScale: scale, yScale: scale, rotate: degrees(180) });
  else if (rotation === 270) page.drawPage(embedded, { x: (pageWidth - drawnHeight) / 2, y: (pageHeight + drawnWidth) / 2, xScale: scale, yScale: scale, rotate: degrees(270) });
  else page.drawPage(embedded, { x: (pageWidth - drawnWidth) / 2, y: (pageHeight - drawnHeight) / 2, xScale: scale, yScale: scale });
  return page;
}

function makeSeparatorPng(title, subtitle) {
  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 1754;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f8f8f4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#a9c9b8';
  ctx.fillRect(110, 210, 18, 1050);
  ctx.fillStyle = '#687174';
  ctx.font = '700 26px "Noto Sans JP", sans-serif';
  ctx.fillText('SECTION', 180, 330);
  ctx.fillStyle = '#30363a';
  ctx.font = '700 58px "Noto Sans JP", sans-serif';
  wrapCanvasText(ctx, title, 180, 520, 850, 82);
  if (subtitle) {
    ctx.fillStyle = '#737b7e';
    ctx.font = '400 28px "Noto Sans JP", sans-serif';
    wrapCanvasText(ctx, subtitle, 180, 760, 850, 46);
  }
  return canvas.toDataURL('image/png');
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  let line = '';
  for (const char of text) {
    const candidate = line + char;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = char;
      y += lineHeight;
    } else line = candidate;
  }
  if (line) ctx.fillText(line, x, y);
}

function fitToA4(width, height, rotation) {
  const portrait = (rotation / 90) % 2 === 0 ? height >= width : width >= height;
  const pageWidth = portrait ? 595.28 : 841.89;
  const pageHeight = portrait ? 841.89 : 595.28;
  const scale = Math.min((pageWidth - 48) / width, (pageHeight - 48) / height);
  return { pageWidth, pageHeight, width: width * scale, height: height * scale, x: (pageWidth - width * scale) / 2, y: (pageHeight - height * scale) / 2 };
}

function sanitizeFilename(value) {
  const clean = (value || '結合ファイル.pdf').replace(/[\\/:*?"<>|]/g, '_').trim();
  return clean.toLowerCase().endsWith('.pdf') ? clean : `${clean}.pdf`;
}
function shorten(value, max) { return value.length > max ? `${value.slice(0, max - 1)}…` : value; }
function escapeHtml(value = '') { return value.replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char])); }

document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
  const action = button.dataset.action;
  if (action === 'add') el.fileInput.click();
  if (action === 'rotate') rotateSelected();
  if (action === 'delete') deleteSelected();
  if (action === 'separator') openSeparatorDialog();
  if (action === 'blank') addBlank();
  if (action === 'correct') {
    openCorrectionDialog();
  }
  if (action === 'compress') {
    if (!state.pages.length) return showToast('先にPDFまたは画像を追加してください','warn');
    el.compressSize.textContent='準備完了';
    setCompressPreset('balanced');
    el.compressDialog.showModal();
  }
  if (action === 'ocr') {
    if (!state.selected.size) return showToast('OCRするページを選択してください', 'warn');
    el.ocrSummary.textContent = `${state.selected.size}ページをOCRできます。`;
    el.ocrProgress.textContent = '待機中';
    el.ocrResult.value = '';
    el.ocrDialog.showModal();
  }
  if (action === 'split') {
    el.splitSummary.textContent = state.selected.size
      ? `${state.selected.size}ページ選択中。選択ページをPDFにできます。`
      : 'ページを選択すると、そのページだけを書き出せます。';
    el.splitDialog.showModal();
  }
  if (action === 'edit') {
    const page = state.pages.find(item => state.selected.has(item.id)) || state.pages[0];
    if (page) openEditor(page, state.pages.indexOf(page)); else showToast('先にPDFまたは画像を追加してください', 'warn');
  }
}));
document.querySelectorAll('[data-selection]').forEach(button => button.addEventListener('click', () => {
  const action = button.dataset.selection;
  if (action === 'rotate') rotateSelected();
  if (action === 'delete') deleteSelected();
  if (action === 'clear') { state.selected.clear(); renderSelection(); }
}));
['heroAdd','chooseBtn'].forEach(id => document.getElementById(id).addEventListener('click', () => el.fileInput.click()));
el.fileInput.addEventListener('change', event => { addFiles(event.target.files); event.target.value = ''; });
el.undoBtn.addEventListener('click', undo);
el.redoBtn.addEventListener('click', redo);
el.exportBtn.addEventListener('click', exportPdf);
el.addSeparatorBtn.addEventListener('click', event => { event.preventDefault(); addSeparator(); el.separatorDialog.close(); });
el.splitSelectedPdf.addEventListener('click', async () => { el.splitDialog.close(); await exportSelectedPdf(); });
el.compressQuality.addEventListener('input', updateCompressLabels);
el.compressScale.addEventListener('input', updateCompressLabels);
el.compressSmall.addEventListener('click',()=>setCompressPreset('small'));
el.compressBalanced.addEventListener('click',()=>setCompressPreset('balanced'));
el.compressQualityPreset.addEventListener('click',()=>setCompressPreset('quality'));
el.compressRun.addEventListener('click',async()=>{el.compressDialog.close();await compressPdf();});
el.correctBrightness.addEventListener('input', updateCorrectionLabels);
el.correctContrast.addEventListener('input', updateCorrectionLabels);
el.correctGray.addEventListener('input', updateCorrectionLabels);
el.correctDocument.addEventListener('click', applyDocumentPreset);
el.correctReset.addEventListener('click', () => {
  el.correctBrightness.value=100; el.correctContrast.value=100; el.correctGray.value=0;
  const pages=state.pages.filter(page=>state.selected.has(page.id));
  pushHistory();
  pages.forEach(page=>{ page.imageAdjust={brightness:100,contrast:100,grayscale:0,trim:null}; });
  updateCorrectionLabels();
  render();
  showToast('補正を元に戻しました');
});
el.correctTrim.addEventListener('click', applyAutoTrim);
el.correctApply.addEventListener('click', applyCorrection);
el.ocrRun.addEventListener('click', runOcr);
el.ocrCopy.addEventListener('click', async () => {
  if (!el.ocrResult.value) return showToast('コピーする文字がありません', 'warn');
  await navigator.clipboard.writeText(el.ocrResult.value);
  showToast('OCR結果をコピーしました');
});
el.ocrDownload.addEventListener('click', () => {
  if (!el.ocrResult.value) return showToast('保存する文字がありません', 'warn');
  const blob = new Blob([el.ocrResult.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'PAPER-PUNCH-OCR.txt';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
el.exportJpg.addEventListener('click', async () => { el.splitDialog.close(); await exportPageImage('jpg'); });
el.exportPng.addEventListener('click', async () => { el.splitDialog.close(); await exportPageImage('png'); });
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => { setMascot('action', { hold: 1200 }); setMode(button.dataset.mode); }));
document.querySelectorAll('[data-switch]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.switch)));
document.querySelectorAll('[data-edit-tool]').forEach(button => button.addEventListener('click', () => {
  state.editor.tool = button.dataset.editTool;
  document.querySelectorAll('[data-edit-tool]').forEach(item => item.classList.toggle('active', item === button));
  el.textOption.hidden = state.editor.tool !== 'text';
  el.cropOptions.hidden = state.editor.tool !== 'crop';
  redrawEditor();
}));
document.querySelectorAll('[data-color]').forEach(button => button.addEventListener('click', () => {
  el.editColor.value = button.dataset.color;
  document.querySelectorAll('[data-color]').forEach(item => item.classList.toggle('active', item === button));
}));
el.editorCanvas.addEventListener('pointerdown', beginDraw);
el.editorCanvas.addEventListener('pointermove', moveDraw);
el.editorCanvas.addEventListener('pointerup', endDraw);
el.editorCanvas.addEventListener('pointercancel', endDraw);
el.closeEditor.addEventListener('click', () => el.editorDialog.close());
el.applyEditor.addEventListener('click', applyEditor);
el.confirmCrop.addEventListener('click', () => {
  state.editor.tool = 'select'; el.cropOptions.hidden = true;
  document.querySelectorAll('[data-edit-tool]').forEach(item => item.classList.toggle('active', item.dataset.editTool === 'select'));
  el.editorStatus.textContent = '切り取り後の画面です。この状態へ文字や図を追加できます'; redrawEditor();
});
el.finalPreview.addEventListener('click', () => {
  state.editor.tool = 'select'; el.cropOptions.hidden = true;
  document.querySelectorAll('[data-edit-tool]').forEach(item => item.classList.toggle('active', item.dataset.editTool === 'select'));
  el.editorStatus.textContent = '完成PDFと同じ切り取り・加工表示です'; redrawEditor();
});
el.exportEdited.addEventListener('click', async () => {
  const page=state.pages.find(p=>p.id===state.editor.pageId); if(!page) return;
  page.annotations=structuredClone(state.editor.draft); page.crop=state.editor.crop?{...state.editor.crop}:null;
  await exportPdf(); el.editorStatus.textContent='編集済みPDFを書き出しました。続けて編集できます';
});
el.clearEdits.addEventListener('click', () => { state.editor.draft=[]; state.editor.crop=null; redrawEditor(); });
el.resetCrop.addEventListener('click', () => { state.editor.crop=defaultCrop(); syncCropBox(); });
document.querySelectorAll('[name="cropOrient"]').forEach(radio => radio.addEventListener('change', () => { state.editor.crop=defaultCrop(); syncCropBox(); }));
let cropDrag = null;
el.cropBox.addEventListener('pointerdown', event => {
  event.preventDefault(); const rect=el.editorCanvas.getBoundingClientRect(); cropDrag={x:event.clientX,y:event.clientY,start:{...state.editor.crop},rect,resize:event.target.tagName==='I'}; el.cropBox.setPointerCapture(event.pointerId);
});
el.cropBox.addEventListener('pointermove', event => {
  if (!cropDrag) return; const dx=(event.clientX-cropDrag.x)/cropDrag.rect.width,dy=(event.clientY-cropDrag.y)/cropDrag.rect.height;
  if (cropDrag.resize) {
    const screenRatio = cropDrag.start.w * cropDrag.rect.width / (cropDrag.start.h * cropDrag.rect.height);
    let w=Math.max(.12,Math.min(1-cropDrag.start.x,cropDrag.start.w+dx)); let h=w*cropDrag.rect.width/(screenRatio*cropDrag.rect.height);
    if (h>1-cropDrag.start.y) { h=1-cropDrag.start.y; w=h*screenRatio*cropDrag.rect.height/cropDrag.rect.width; }
    state.editor.crop.w=w; state.editor.crop.h=h;
  } else {
    state.editor.crop.x=Math.max(0,Math.min(1-state.editor.crop.w,cropDrag.start.x+dx)); state.editor.crop.y=Math.max(0,Math.min(1-state.editor.crop.h,cropDrag.start.y+dy));
  }
  syncCropBox();
});
el.cropBox.addEventListener('pointerup',()=>cropDrag=null);
el.cropBox.addEventListener('pointercancel',()=>cropDrag=null);
document.addEventListener('keydown', event => {
  const modifier = navigator.platform.includes('Mac') ? event.metaKey : event.ctrlKey;
  if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
  if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
});
['dragenter','dragover'].forEach(name => document.addEventListener(name, event => { event.preventDefault(); if (event.dataTransfer?.types?.includes('Files')) { document.body.classList.add('file-hover'); setMascot('receive'); } }));
['dragleave','drop'].forEach(name => document.addEventListener(name, event => { event.preventDefault(); if (name === 'drop' && !state.dragId && event.dataTransfer?.files?.length) addFiles(event.dataTransfer.files); document.body.classList.remove('file-hover'); if (name === 'dragleave' && !state.busy) setMascot('idle'); }));

render();
