/* ── Date helper ─────────────────────────────────────────── */

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Persistence ─────────────────────────────────────────── */

function saveCards() {
  localStorage.setItem('faizal_kanban_cards', JSON.stringify(cards));
}

function loadCards() {
  try {
    const raw = localStorage.getItem('faizal_kanban_cards');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

/* ── Theme ───────────────────────────────────────────────── */

function loadTheme() {
  return localStorage.getItem('faizal_kanban_theme') || 'dark';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('faizal_kanban_theme', theme);
}

/* ── State ───────────────────────────────────────────────── */

let cards = loadCards();
let dragId = null;
let toastTimer = null;

/* ── Bootstrap ───────────────────────────────────────────── */

(function init() {
  applyTheme(loadTheme());
  renderAll();

  document.getElementById('clearDoneBtn').addEventListener('click', clearDone);

  document.getElementById('themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  startClock();
})();

/* ── Live Clock ──────────────────────────────────────────── */

function startClock() {
  function tick() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('clockDate').textContent = dateStr;
    document.getElementById('clockTime').textContent = timeStr;
  }
  tick();
  setInterval(tick, 1000);
}

/* ── Render ──────────────────────────────────────────────── */

function renderAll() {
  ['todo', 'inprog', 'done'].forEach(col => {
    const container = document.getElementById('cards-' + col);
    container.innerHTML = '';
    Object.values(cards).filter(c => c.col === col).forEach(c => container.appendChild(buildCard(c)));
    updateCount(col);
  });
}

function updateCount(col) {
  document.getElementById('count-' + col).textContent =
    Object.values(cards).filter(c => c.col === col).length;
}

/* ── Build card DOM node ─────────────────────────────────── */

function buildCard(data) {
  const el = document.createElement('div');
  el.className = 'card';
  el.id = 'card-' + data.id;
  el.draggable = true;
  el.dataset.id = data.id;

  const descHtml = data.desc
    ? `<p class="card-desc">${escHtml(data.desc)}</p>`
    : '';

  el.innerHTML = `
    <div class="card-top">
      <span class="card-title">${escHtml(data.title)}</span>
      <span class="card-date">${data.date}</span>
    </div>
    ${descHtml}
    <div class="card-footer">
      <button class="card-delete" title="Delete" aria-label="Delete card">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
        Delete
      </button>
    </div>
  `;

  el.querySelector('.card-delete').addEventListener('click', () => deleteCard(data.id));

  el.addEventListener('dragstart', e => {
    dragId = data.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', data.id);
    setTimeout(() => el.classList.add('dragging'), 0);
  });

  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    dragId = null;
    clearDropHighlights();
  });

  return el;
}

/* ── Drag-and-Drop ───────────────────────────────────────── */

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const container = e.currentTarget;
  container.classList.add('drop-target');
  const afterEl = getDragAfterElement(container, e.clientY);
  clearCardDropHighlights();
  if (afterEl) afterEl.classList.add('drop-above');
}

function onDragLeave(e) {
  const container = e.currentTarget;
  if (!container.contains(e.relatedTarget)) {
    container.classList.remove('drop-target');
    clearCardDropHighlights();
  }
}

function onDrop(e, col) {
  e.preventDefault();
  const container = e.currentTarget;
  container.classList.remove('drop-target');
  clearCardDropHighlights();

  if (!dragId || !cards[dragId]) return;

  const prevCol = cards[dragId].col;
  const cardEl  = document.getElementById('card-' + dragId);
  if (!cardEl) return;

  cards[dragId].col = col;
  saveCards();

  const afterEl = getDragAfterElement(container, e.clientY);
  if (afterEl) {
    container.insertBefore(cardEl, afterEl);
  } else {
    container.appendChild(cardEl);
  }

  updateCount(prevCol);
  updateCount(col);

  if (prevCol !== col) {
    const labels = { todo: 'To Do', inprog: 'In Progress', done: 'Done' };
    showToast('Moved to ' + labels[col]);
  }
}

function getDragAfterElement(container, y) {
  const draggables = [...container.querySelectorAll('.card:not(.dragging)')];
  return draggables.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: -Infinity }).element;
}

function clearDropHighlights() {
  document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
  clearCardDropHighlights();
}

function clearCardDropHighlights() {
  document.querySelectorAll('.drop-above, .drop-below').forEach(el => {
    el.classList.remove('drop-above', 'drop-below');
  });
}

/* ── Card Actions ────────────────────────────────────────── */

function deleteCard(id) {
  if (!cards[id]) return;
  const col = cards[id].col;
  delete cards[id];
  saveCards();
  const el = document.getElementById('card-' + id);
  if (el) el.remove();
  updateCount(col);
  showToast('Card deleted');
}

function clearDone() {
  const doneCards = Object.values(cards).filter(c => c.col === 'done');
  if (doneCards.length === 0) { showToast('No done cards to clear'); return; }
  doneCards.forEach(c => {
    delete cards[c.id];
    const el = document.getElementById('card-' + c.id);
    if (el) el.remove();
  });
  saveCards();
  updateCount('done');
  showToast('Cleared ' + doneCards.length + ' card' + (doneCards.length > 1 ? 's' : ''));
}

/* ── Add Card Form ───────────────────────────────────────── */

function openForm(col) {
  const wrap = document.getElementById('formwrap-' + col);
  if (!wrap) return;
  wrap.classList.add('open');
  document.getElementById('input-' + col).focus();
}

function closeForm(col) {
  const wrap = document.getElementById('formwrap-' + col);
  if (!wrap) return;
  wrap.classList.remove('open');
  document.getElementById('input-' + col).value = '';
  document.getElementById('desc-' + col).value = '';
}

function formKey(e, col) {
  if (e.key === 'Escape') closeForm(col);
}

function addCard(col) {
  const titleEl = document.getElementById('input-' + col);
  const descEl  = document.getElementById('desc-' + col);
  const title   = titleEl.value.trim();
  const desc    = descEl.value.trim();

  if (!title) {
    titleEl.focus();
    titleEl.style.borderColor = '#f87171';
    setTimeout(() => { titleEl.style.borderColor = ''; }, 1200);
    return;
  }

  const date = todayLabel();
  const id   = 'c' + Date.now();

  cards[id] = { id, col, title, desc, date };
  saveCards();

  const container = document.getElementById('cards-' + col);
  container.appendChild(buildCard(cards[id]));
  updateCount(col);

  closeForm(col);
  showToast('Card added');
}

/* ── Toast ───────────────────────────────────────────────── */

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

/* ── Utils ───────────────────────────────────────────────── */

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
