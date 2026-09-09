import './style.css';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const app = document.querySelector('#app');

app.innerHTML = `
  <header class="topbar">
    <div class="brand"><span class="brand-mark" aria-hidden="true"></span><span>PDF Studio</span></div>
    <label class="filename-wrap"><span class="sr-only">出力ファイル名</span><input id="filename" value="結合ファイル.pdf" /></label>
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
      <div class="dock-divider"></div>
      <label class="option-chip"><input id="pageNumbers" type="checkbox"/><span>ページ番号</span></label>
      <label class="option-chip"><input id="a4Normalize" type="checkbox"/><span>A4に統一</span></label>
    </aside>

    <section class="canvas-shell">
      <div id="dropzone" class="empty-state">
        <button id="heroAdd" class="add-module" aria-label="PDFまたは画像を追加"><span>＋</span></button>
        <h1>ページを、組み立てよう。</h1>
        <p>PDF・JPEG・PNGをここにドロップ</p>
        <button id="chooseBtn" class="text-button">ファイルを選ぶ</button>
      </div>
      <div id="pageGrid" class="page-grid" hidden></div>
      <div id="selectionBar" class="selection-bar" hidden>
        <strong id="selectionCount">0ページ選択中</strong>
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
  <input id="fileInput" type="file" accept="application/pdf,image/jpeg,image/png" multiple hidden />

  <dialog id="separatorDialog">
    <form method="dialog" class="dialog-card">
      <button class="dialog-close" value="cancel" aria-label="閉じる">×</button>
      <h2>区切り表紙を追加</h2>
      <label>タイトル<input id="separatorTitle" maxlength="60" placeholder="付録1　分析記録" /></label>
      <label>補足<input id="separatorSubtitle" maxlength="90" placeholder="必要な場合のみ" /></label>
      <div class="dialog-actions"><button value="cancel" class="secondary">キャンセル</button><button id="addSeparatorBtn" value="default" class="primary">追加する</button></div>
    </form>
  </dialog>

  <dialog id="previewDialog">
    <form method="dialog" class="preview-card">
      <button class="dialog-close" value="cancel" aria-label="閉じる">×</button>
      <img id="previewImage" alt="ページプレビュー" />
      <p id="previewLabel"></p>
    </form>
  </dialog>
`;

const el = Object.fromEntries([
  'fileInput','dropzone','pageGrid','selectionBar','selectionCount','pageCount','sizeText','warningText',
  'undoBtn','redoBtn','exportBtn','filename','toast','separatorDialog','separatorTitle','separatorSubtitle',
  'addSeparatorBtn','previewDialog','previewImage','previewLabel','pageNumbers','a4Normalize'
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

function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function addFiles(files) {
  const accepted = [...files].filter(file => file.type === 'application/pdf' || ['image/jpeg','image/png'].includes(file.type));
  if (!accepted.length) return showToast('PDF・JPEG・PNGを選んでください', 'warn');
  snapshot();
  setBusy(true, 'ページを読み込んでいます…');
  try {
    for (const file of accepted) {
      const sourceId = uid('source');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (file.type === 'application/pdf') await addPdfSource(sourceId, file, bytes);
      else await addImageSource(sourceId, file, bytes);
    }
    render();
    showToast(`${accepted.length}ファイルを追加しました`);
  } catch (error) {
    console.error(error);
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
  state.sources.set(sourceId, { kind: 'image', bytes, mime: file.type, name: file.name, size: file.size, width: image.naturalWidth, height: image.naturalHeight });
  state.pages.push(makePage({ sourceId, sourcePageIndex: 0, thumbnail: url, width: image.naturalWidth, height: image.naturalHeight, label: file.name }));
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
    id: uid(), rotation: 0, kind: 'source', ...data,
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

function toggleSelect(id, additive) {
  if (!additive) state.selected.clear();
  if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
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
    ? `<img src="${page.thumbnail}" alt="" style="transform:rotate(${page.rotation}deg)"/>`
    : page.kind === 'separator'
      ? `<div class="generated-page separator-preview"><span>SECTION</span><h3>${escapeHtml(page.title)}</h3><p>${escapeHtml(page.subtitle || '')}</p></div>`
      : `<div class="generated-page blank-preview"><span>BLANK</span></div>`;
  card.innerHTML = `
    <div class="connector top"></div><div class="connector right"></div><div class="connector bottom"></div><div class="connector left"></div>
    <button class="select-dot" aria-label="ページを選択">${state.selected.has(page.id) ? '✓' : ''}</button>
    <button class="preview-button" title="拡大表示">↗</button>
    <div class="page-paper ${page.width > page.height ? 'landscape' : ''}">${preview}</div>
    <div class="page-meta"><strong>${String(index + 1).padStart(2,'0')}</strong><span title="${escapeHtml(page.label)}">${escapeHtml(shorten(page.label, 18))}</span></div>`;
  card.addEventListener('click', event => {
    if (event.target.closest('.preview-button')) return previewPage(page, index);
    toggleSelect(page.id, event.metaKey || event.ctrlKey || event.shiftKey);
  });
  card.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleSelect(page.id, event.ctrlKey || event.metaKey || event.shiftKey); }
    if (event.key === 'Delete' || event.key === 'Backspace') deleteSelected();
  });
  card.addEventListener('dragstart', () => { state.dragId = page.id; card.classList.add('dragging'); });
  card.addEventListener('dragend', () => { state.dragId = null; card.classList.remove('dragging'); clearDragStyles(); });
  card.addEventListener('dragover', event => { event.preventDefault(); if (state.dragId !== page.id) card.classList.add('magnet-target'); });
  card.addEventListener('dragleave', () => card.classList.remove('magnet-target'));
  card.addEventListener('drop', event => {
    event.preventDefault();
    const from = state.pages.findIndex(item => item.id === state.dragId);
    const to = state.pages.findIndex(item => item.id === page.id);
    if (from < 0 || to < 0 || from === to) return clearDragStyles();
    snapshot();
    const [moved] = state.pages.splice(from, 1);
    state.pages.splice(to, 0, moved);
    render();
    const target = el.pageGrid.children[to];
    target?.classList.add('snap-in');
    showToast('カチッ　ページを接続しました');
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

function setBusy(busy, message = '') {
  state.busy = busy;
  document.body.classList.toggle('busy', busy);
  if (message) showToast(message);
  updateHistoryButtons();
  updateStats();
}

async function exportPdf() {
  if (!state.pages.length) return;
  setBusy(true, 'PDFを組み立てています…');
  try {
    const output = await PDFDocument.create();
    const cache = new Map();
    const font = await output.embedFont(StandardFonts.Helvetica);
    for (const pageData of state.pages) {
      let page;
      if (pageData.kind === 'source') {
        const source = state.sources.get(pageData.sourceId);
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
          const image = source.mime === 'image/png' ? await output.embedPng(source.bytes) : await output.embedJpg(source.bytes);
          const dims = fitToA4(source.width, source.height, pageData.rotation);
          page = output.addPage([dims.pageWidth, dims.pageHeight]);
          page.drawImage(image, { x: dims.x, y: dims.y, width: dims.width, height: dims.height, rotate: degrees(pageData.rotation) });
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
    anchor.download = sanitizeFilename(el.filename.value);
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast('完成！PDFを書き出しました');
  } catch (error) {
    console.error(error);
    showToast('PDFの書き出しに失敗しました', 'error');
  } finally {
    setBusy(false);
  }
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
document.addEventListener('keydown', event => {
  const modifier = navigator.platform.includes('Mac') ? event.metaKey : event.ctrlKey;
  if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
  if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
});
['dragenter','dragover'].forEach(name => document.addEventListener(name, event => { event.preventDefault(); document.body.classList.add('file-hover'); }));
['dragleave','drop'].forEach(name => document.addEventListener(name, event => { event.preventDefault(); if (name === 'drop') addFiles(event.dataTransfer.files); document.body.classList.remove('file-hover'); }));

render();
