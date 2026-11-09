// Forma, saqlash, takliflar paneli, kurs va PDF. Hisob calculateQuote() da, KP renderKp() da.
import { setupTierLabel, FALLBACK_USD_RATE, TELEPHONY_LABELS, CHATBOT_LABELS } from './pricing.js';
import { calculateQuote, quoteInputFromState, leadForecast } from './quote.js';
import { fmtUzs, fmtUsd, fmtDecimal, fmtDate, pdfFileName, esc, DASH } from './format.js';
import {
  KEYS, defaultState, migrateState, readSaved, writeSaved, upsertRecord, readDraft, writeDraft,
  buildBackup, parseBackup, mergeSaved,
} from './storage.js';
import { validateField } from './validate.js';
import { compressLogo, logoWithoutBackdrop, SAFE_IMAGE } from './logo.js';
import { icon } from './icons.js';
import { logoMark } from './brand.js';
import { renderKp } from './kp.js';

const $ = (id) => document.getElementById(id);
const store = (() => {
  try {
    const k = '__omon_kp_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    const mem = new Map();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  }
})();
const session = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* yo’q */ } },
};

let state = defaultState();
let selectedId = null;
let rateMeta = { kind: 'fallback', date: FALLBACK_USD_RATE.date, manual: false };
let logoSrc = '';
let logoToken = 0;

/* ---------- yordamchi ---------- */
function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 3200);
}

function persistDraft() {
  return writeDraft(store, { state, selectedId, rateMeta });
}

function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) el.outerHTML = icon(el.dataset.icon, { size: 18 });
  for (const el of root.querySelectorAll('[data-logo]')) el.innerHTML = logoMark({ size: 30 });
}

const agencyName = (s) => String(s?.agency ?? '').trim();
const quoteOf = (s) => calculateQuote(quoteInputFromState(s));

/* ---------- saqlangan / saqlanmagan holat ---------- */
/** Taqqoslash uchun holat: USD kursi foydalanuvchi o’zgarishi hisoblanmaydi. */
function snapshot(s) {
  const { schemaVersion, fx, ...rest } = migrateState(s);
  return JSON.stringify(rest);
}
function blankLike(s) {
  return { ...defaultState(), sellerName: s.sellerName, sellerPhone: s.sellerPhone, date: s.date, fx: s.fx };
}
function savedRecord() {
  return selectedId ? readSaved(store).find((x) => x.id === selectedId) ?? null : null;
}
function isDirty() {
  const rec = savedRecord();
  return snapshot(state) !== snapshot(rec ? rec.data : blankLike(state));
}

function fmtSavedAt(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return d.toDateString() === now.toDateString() ? `bugun, ${hm}` : `${fmtDate(d.toISOString().slice(0, 10))}, ${hm}`;
}

function renderStatus() {
  const rec = savedRecord();
  const [kind, text] = isDirty()
    ? ['dirty', 'Saqlanmagan o’zgarishlar']
    : rec ? ['saved', `Saqlangan · ${fmtSavedAt(rec.updated)}`] : ['new', 'Yangi taklif'];
  for (const el of [$('saveStatus'), $('saveStatusInline')]) {
    el.dataset.state = kind;
    el.textContent = text;
  }
  const count = readSaved(store).length;
  $('savedCount').hidden = count === 0;
  $('savedCount').textContent = String(count);
}

/* ---------- logotip ---------- */
async function refreshLogo() {
  const raw = SAFE_IMAGE.test(state.agencyImage) ? state.agencyImage : '';
  const token = ++logoToken;
  $('logoThumb').hidden = !raw;
  $('logoRemove').hidden = !raw;
  $('logoBgRow').hidden = !raw;
  $('logoPickText').textContent = raw ? 'Logotipni almashtirish' : 'Logotip yuklash';
  $('logoRemoveBackground').checked = state.logoRemoveBackground !== false;
  if (raw) $('logoThumbImg').src = raw; else $('logoThumbImg').removeAttribute('src');
  logoSrc = raw;
  if (raw && state.logoRemoveBackground !== false) {
    const clean = await logoWithoutBackdrop(raw);
    if (token !== logoToken) return;
    logoSrc = clean || raw;
  }
  render();
}

/* ---------- maydon xatolari ---------- */
function errorEl(input) {
  return document.getElementById(`${input.id}-error`);
}
function showError(input, message) {
  let el = errorEl(input);
  if (!el) {
    el = document.createElement('p');
    el.className = 'field-error';
    el.id = `${input.id}-error`;
    const host = input.closest('.input-with-btn') ?? input;
    host.after(el);
  }
  el.innerHTML = `${icon('circle-alert', { size: 14 })}<span>${esc(message)}</span>`;
  input.setAttribute('aria-invalid', 'true');
  const ids = new Set((input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));
  ids.add(el.id);
  input.setAttribute('aria-describedby', [...ids].join(' '));
}
function clearError(input) {
  const el = errorEl(input);
  if (!el) return;
  el.remove();
  input.removeAttribute('aria-invalid');
  const ids = (input.getAttribute('aria-describedby') || '').split(' ').filter((x) => x && x !== el.id);
  if (ids.length) input.setAttribute('aria-describedby', ids.join(' ')); else input.removeAttribute('aria-describedby');
}
function clearAllErrors() {
  for (const el of document.querySelectorAll('[data-key][aria-invalid="true"]')) clearError(el);
}

/* ---------- forma ↔ holat ---------- */
function fillForm() {
  clearAllErrors();
  for (const el of document.querySelectorAll('[data-key]')) el.value = state[el.dataset.key] ?? '';
  render();
  refreshLogo();
}

function readForm() {
  for (const el of document.querySelectorAll('[data-key]')) state[el.dataset.key] = el.value;
  state = migrateState(state);
  render();
  persistDraft();
}

/* ---------- ko’rsatish ---------- */
function cardSummaries(q) {
  const s = state;
  const filled = (...keys) => keys.some((k) => String(s[k] ?? '').trim() !== '');
  const parts = (...xs) => xs.filter(Boolean).join(' · ');
  const set = (name, text) => { const el = document.querySelector(`[data-sum="${name}"]`); if (el) el.textContent = text; };

  set('client', parts(agencyName(s) || 'Nomi kiritilmagan', s.owner.trim()));
  set('leads', filled('employees', 'leads', 'missed', 'recovery', 'conversion', 'profit')
    ? parts(s.leads && `${s.leads} lid/kun`, s.missed && `${s.missed} ishlanmaydi`, s.employees && `${s.employees} xodim`)
    : 'Bo’sh — KP’ga chiqmaydi');
  set('time', filled('responseNow', 'searchNow', 'searches')
    ? parts(s.responseNow && `javob ${s.responseNow} daq.`, s.searchNow && `qidiruv ${s.searchNow} daq.`)
    : 'Bo’sh — KP’ga chiqmaydi');
  set('plan', parts(q.agents ? `${q.agents} agent` : 'Agentlar kiritilmagan', `${q.months} oy`,
    q.telephonyType !== 'none' && TELEPHONY_LABELS[q.telephonyType], q.chatbotType !== 'none' && 'AI chatbot',
    q.subscriptionTotal !== null && fmtUzs(q.subscriptionTotal)));
}

function render() {
  const q = quoteOf(state);
  const f = leadForecast(state);

  $('lines').disabled = q.telephonyType === 'none';
  $('linesField').classList.toggle('is-off', q.telephonyType === 'none');
  $('setupOut').textContent = q.setupUsd === null
    ? 'Agentlar sonini kiriting'
    : `${fmtUsd(q.setupUsd)} · ${setupTierLabel(q.agents)}${q.setupUzs !== null ? ` · ${fmtUzs(q.setupUzs)}` : ''}`;

  const rows = [
    [`CRM · ${q.months} oy`, fmtUzs(q.crm)],
    q.telephonyType !== 'none' ? [`${TELEPHONY_LABELS[q.telephonyType]} · ${q.lines} raqam`, fmtUzs(q.telephony)] : null,
    ['Obuna jami', fmtUzs(q.subscriptionTotal)],
    ['O’rtacha oyiga', fmtUzs(q.avgMonthly)],
    [`O’rnatish (${fmtUsd(q.setupUsd)})`, q.setupUzs === null ? (q.setupUsd === null ? DASH : 'kurs kiritilmagan') : fmtUzs(q.setupUzs)],
    ['Umumiy', fmtUzs(q.grandTotal), 'grand'],
    q.chatbotType !== 'none' ? [`+ AI chatbot · ${CHATBOT_LABELS[q.chatbotType]}`, `${fmtUzs(q.chatbotMonthly)} / oy`, 'note'] : null,
  ].filter(Boolean);
  $('summary').innerHTML = rows.map(([k, v, c = '']) => `<dt class="${c}">${k}</dt><dd class="${c}">${v}</dd>`).join('');

  cardSummaries(q);
  $('kp').innerHTML = renderKp({ state, quote: q, forecast: f, rateMeta, logoSrc });
  renderStatus();
}

/* ---------- qatlamlar: panel va oyna (fokus ichida qoladi, Esc yopadi, fokus qaytadi) ---------- */
let layer = null;
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea, label.btn, [tabindex]:not([tabindex="-1"])';

function setBackgroundInert(on) {
  for (const el of [document.querySelector('.topbar'), document.querySelector('.pane-switch'), document.querySelector('main')]) {
    if (el) el.inert = on;
  }
}
function openLayer(root, { focus, onEscape, onClose } = {}) {
  closeLayer(false);
  const opener = document.activeElement;
  root.hidden = false;
  setBackgroundInert(true);
  layer = { root, opener, onEscape, onClose };
  (focus?.() ?? root.querySelector(FOCUSABLE))?.focus();
}
function closeLayer(restore = true) {
  if (!layer) return;
  const { root, opener, onClose } = layer;
  layer = null;
  root.hidden = true;
  setBackgroundInert(false);
  onClose?.();
  if (restore && opener && document.contains(opener)) opener.focus();
}
document.addEventListener('keydown', (e) => {
  if (!layer) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    if (layer.onEscape?.() === true) return;
    closeLayer();
    return;
  }
  if (e.key !== 'Tab') return;
  const items = [...layer.root.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

/** Tasdiqlash oynasi. Standart fokus — “Bekor qilish”. */
function confirmDialog({ title, body, ok }) {
  return new Promise((resolve) => {
    $('confirmTitle').textContent = title;
    $('confirmBody').textContent = body;
    $('confirmOk').textContent = ok;
    let result = false;
    const finish = (value) => { result = value; closeLayer(); };
    $('confirmOk').onclick = () => finish(true);
    $('confirmCancel').onclick = () => finish(false);
    $('confirm').querySelector('.dialog-backdrop').onclick = () => finish(false);
    openLayer($('confirm'), { focus: () => $('confirmCancel'), onClose: () => resolve(result) });
  });
}

/* ---------- saqlash ---------- */
function focusField(input) {
  const card = input.closest('details');
  if (card && !card.open) card.open = true;
  setPane('form');
  input.scrollIntoView({ block: 'center', behavior: 'instant' });
  input.focus({ preventScroll: true });
}

function saveQuote() {
  const err = validateField('agency', state, { onSave: true });
  if (err) {
    if (layer) closeLayer(false);
    showError($('agency'), err);
    focusField($('agency'));
    toast('Taklif saqlanmadi: turagentlik nomini kiriting');
    return false;
  }
  const { record, items } = upsertRecord(readSaved(store), { id: selectedId, state, rateMeta });
  if (!writeSaved(store, items)) {
    toast('Brauzer xotirasi to’lgan — zaxirani yuklab oling va eski takliflarni o’chiring');
    return false;
  }
  selectedId = record.id;
  persistDraft();
  renderStatus();
  if (layer?.root === $('library')) renderLibrary();
  toast(`“${record.agency}” saqlandi`);
  return true;
}

function loadState(next, { id = null, meta = rateMeta } = {}) {
  selectedId = id;
  state = migrateState(next);
  rateMeta = meta;
  fillForm();
  setFxStatus();
  persistDraft();
}

async function newQuote() {
  if (isDirty()) {
    const ok = await confirmDialog({
      title: 'Saqlanmagan o’zgarishlar bor',
      body: `“${agencyName(state) || 'Joriy taklif'}”dagi o’zgarishlar saqlanmagan. Yangi taklif ochilsa, ular yo’qoladi.`,
      ok: 'O’zgarishlarni tashlash',
    });
    if (!ok) return;
  }
  // Ijrochi o’zgarmaydi: har bir sotuvchi o’z ismini bir marta yozadi.
  loadState({ ...defaultState(), sellerName: state.sellerName, sellerPhone: state.sellerPhone, fx: state.fx });
  setPane('form');
  $('agency').focus();
  toast('Yangi taklif ochildi');
}

/* ---------- takliflar paneli ---------- */
let libraryQuery = '';
let confirmDeleteId = null;
let pendingAction = null; // { type: 'open' | 'copy', id }

const norm = (s) => String(s ?? '').toLowerCase().replace(/[‘’ʻʼ'`]/g, '');

function rowMeta(rec) {
  const q = quoteOf(rec.data);
  return [q.agents ? `${q.agents} agent` : null, `${q.months} oy`, q.subscriptionTotal !== null ? fmtUzs(q.subscriptionTotal) : null]
    .filter(Boolean).join(' · ');
}

function renderLibrary() {
  const all = readSaved(store);
  const q = norm(libraryQuery.trim());
  const items = q ? all.filter((r) => norm(`${r.agency} ${r.data.owner} ${r.data.city}`).includes(q)) : all;

  $('quoteList').innerHTML = items.map((r) => {
    const name = esc(r.agency || 'Nomsiz turagentlik');
    if (r.id === confirmDeleteId) {
      return `<li class="quote-row" data-id="${esc(r.id)}"><div class="q-confirm">
        <p><b>“${name}” taklifi o’chirilsinmi?</b> Bu amalni qaytarib bo’lmaydi.</p>
        <div class="btn-row"><button class="btn ghost" type="button" data-act="cancel-delete">Bekor qilish</button>
        <button class="btn destructive" type="button" data-act="delete">${icon('trash-2', { size: 18 })}Taklifni o’chirish</button></div>
      </div></li>`;
    }
    const current = r.id === selectedId;
    return `<li class="quote-row${current ? ' current' : ''}" data-id="${esc(r.id)}">
      <button class="quote-open" type="button" data-act="open">
        <span class="q-name">${name}${current ? '<span class="q-badge">Ochiq</span>' : ''}</span>
        <span class="q-meta">${esc(rowMeta(r))}</span>
        <span class="q-date">Saqlangan: ${esc(fmtSavedAt(r.updated))}</span>
      </button>
      <div class="q-actions">
        <button class="btn icon-only" type="button" data-act="copy" aria-label="“${name}” nusxasini yaratish" data-tip="Nusxa yaratish">${icon('copy-plus', { size: 18 })}</button>
        <button class="btn icon-only danger" type="button" data-act="ask-delete" aria-label="“${name}” taklifini o’chirish" data-tip="O’chirish">${icon('trash-2', { size: 18 })}</button>
      </div>
    </li>`;
  }).join('');

  const empty = $('libraryEmpty');
  if (!all.length) {
    empty.hidden = false;
    empty.innerHTML = `<h3>Hali saqlangan taklif yo’q</h3>
      <p>Saqlangan taklifni keyin shu yerdan ochib, tahrirlab, qayta PDF qilish mumkin.</p>
      <button class="btn primary" type="button" data-act="save-current">${icon('save', { size: 18 })}Joriy taklifni saqlash</button>`;
  } else if (!items.length) {
    empty.hidden = false;
    empty.innerHTML = `<h3>“${esc(libraryQuery.trim())}” bo’yicha taklif topilmadi</h3>
      <p>Agentlik, rahbar yoki hudud nomini boshqacha yozib ko’ring.</p>
      <button class="btn ghost" type="button" data-act="clear-search">Qidiruvni tozalash</button>`;
  } else {
    empty.hidden = true;
    empty.innerHTML = '';
  }
  renderNotice();
}

function renderNotice() {
  const box = $('libraryNotice');
  if (!pendingAction) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const target = readSaved(store).find((r) => r.id === pendingAction.id);
  const canSave = agencyName(state) !== '';
  box.hidden = false;
  box.innerHTML = `<p><b>Joriy taklifda saqlanmagan o’zgarishlar bor.</b> “${esc(target?.agency || 'Taklif')}”${pendingAction.type === 'copy' ? ' nusxasini' : 'ni'} ochishdan oldin ularni saqlang yoki tashlang.</p>
    <div class="btn-row">
      ${canSave ? '<button class="btn primary" type="button" data-act="save-then">Saqlash va ochish</button>' : ''}
      <button class="btn destructive" type="button" data-act="discard-then">O’zgarishlarni tashlash</button>
      <button class="btn ghost" type="button" data-act="cancel-pending">Bekor qilish</button>
    </div>`;
  box.querySelector('button')?.focus();
}

function openLibrary() {
  libraryQuery = '';
  confirmDeleteId = null;
  pendingAction = null;
  $('librarySearch').value = '';
  renderLibrary();
  openLayer($('library'), {
    focus: () => $('librarySearch'),
    onEscape: () => {
      if (confirmDeleteId || pendingAction) {
        const id = confirmDeleteId ?? pendingAction?.id;
        confirmDeleteId = null;
        pendingAction = null;
        renderLibrary();
        $('quoteList').querySelector(`[data-id="${CSS.escape(id)}"] [data-act="open"]`)?.focus();
        return true;
      }
      return false;
    },
  });
}

function runAction(type, id) {
  const rec = readSaved(store).find((r) => r.id === id);
  if (!rec) return;
  if (type === 'open') {
    loadState(rec.data, { id: rec.id, meta: rec.rateMeta });
    toast(`“${rec.agency || 'Taklif'}” ochildi`);
  } else {
    const copy = { ...rec.data, agency: rec.data.agency ? `${rec.data.agency} (nusxa)` : '' };
    loadState(copy, { id: null, meta: rec.rateMeta });
    toast('Nusxa ochildi — kerakli joylarni o’zgartirib, saqlang');
  }
  closeLayer(false);
  setPane('form');
  $('agency').focus();
}

function requestAction(type, id) {
  if (type === 'open' && id === selectedId && !isDirty()) {
    closeLayer();
    return;
  }
  if (isDirty()) {
    pendingAction = { type, id };
    renderNotice();
    return;
  }
  runAction(type, id);
}

function onLibraryClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = btn.closest('[data-id]')?.dataset.id;
  switch (btn.dataset.act) {
    case 'open': requestAction('open', id); break;
    case 'copy': requestAction('copy', id); break;
    case 'ask-delete':
      confirmDeleteId = id;
      renderLibrary();
      $('quoteList').querySelector('[data-act="cancel-delete"]')?.focus();
      break;
    case 'cancel-delete':
      confirmDeleteId = null;
      renderLibrary();
      $('quoteList').querySelector(`[data-id="${CSS.escape(id)}"] [data-act="open"]`)?.focus();
      break;
    case 'delete': {
      const rec = readSaved(store).find((r) => r.id === id);
      writeSaved(store, readSaved(store).filter((r) => r.id !== id));
      if (id === selectedId) selectedId = null;
      confirmDeleteId = null;
      persistDraft();
      renderLibrary();
      renderStatus();
      $('librarySearch').focus();
      toast(`“${rec?.agency || 'Taklif'}” o’chirildi`);
      break;
    }
    case 'save-current':
      if (saveQuote()) renderLibrary(); else closeLayer(false);
      break;
    case 'clear-search':
      libraryQuery = '';
      $('librarySearch').value = '';
      renderLibrary();
      $('librarySearch').focus();
      break;
    case 'save-then': {
      const next = pendingAction;
      pendingAction = null;
      if (saveQuote()) runAction(next.type, next.id); else closeLayer(false);
      break;
    }
    case 'discard-then': {
      const next = pendingAction;
      pendingAction = null;
      runAction(next.type, next.id);
      break;
    }
    case 'cancel-pending':
      pendingAction = null;
      renderNotice();
      $('librarySearch').focus();
      break;
    default:
  }
}

/* ---------- JSON zaxira ---------- */
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportJson() {
  const backup = buildBackup({ state, rateMeta, saved: readSaved(store) });
  download(`${pdfFileName(state.agency, state.date)}.json`, JSON.stringify(backup, null, 2));
  toast('Zaxira fayli yuklab olindi');
}

async function importJson(file) {
  try {
    const { current, saved } = parseBackup(await file.text());
    if (saved.length && !writeSaved(store, mergeSaved(readSaved(store), saved))) {
      toast('Brauzer xotirasi to’lgan — takliflar ro’yxatga qo’shilmadi. Eski takliflarni o’chirib, qayta urinib ko’ring');
      return;
    }
    if (current) loadState(current.state, { id: null, meta: current.rateMeta });
    renderLibrary();
    renderStatus();
    toast(`Zaxira tiklandi${saved.length ? ` · ${saved.length} ta taklif` : ''}`);
  } catch (err) {
    toast(err instanceof SyntaxError
      ? 'Fayl o’qilmadi: u JSON formatida emas. Omon CRM’dan yuklab olingan zaxira faylini tanlang'
      : `${err.message || 'Zaxirani tiklab bo’lmadi'}. Omon CRM’dan yuklab olingan zaxira faylini tanlang`);
  }
}

/* ---------- USD kursi ---------- */
function setFxStatus(text) {
  if (text) {
    $('fxStatus').textContent = text;
    return;
  }
  const rate = fmtDecimal(Number(state.fx));
  $('fxStatus').textContent = rateMeta.kind === 'official'
    ? `Markaziy bank kursi, ${rateMeta.date}: ${rate} so’m`
    : rateMeta.kind === 'manual'
      ? (Number(state.fx) > 0 ? `Qo’lda kiritilgan kurs: ${rate} so’m` : 'Kursni kiriting — o’rnatish narxi so’mda hisoblanadi')
      : `Markaziy bankka ulanib bo’lmadi, namunaviy kurs ishlatilmoqda (${rateMeta.date}). Kerak bo’lsa qo’lda o’zgartiring.`;
}

let loadingRate = false;
async function updateRate() {
  if (loadingRate) return;
  loadingRate = true;
  const btn = $('refreshRate');
  const spin = setTimeout(() => { btn.setAttribute('aria-busy', 'true'); setFxStatus('Markaziy bank kursi olinmoqda…'); }, 100);
  try {
    const res = await fetch('https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/', { cache: 'no-store' });
    if (!res.ok) throw new Error('bad status');
    const raw = await res.json();
    const row = Array.isArray(raw) ? raw[0] : raw;
    const rate = Number(String(row?.Rate ?? '').replace(',', '.'));
    if (!Number.isFinite(rate) || rate < 1000 || rate > 100000) throw new Error('bad rate');
    if (!rateMeta.manual) {
      state.fx = String(rate);
      rateMeta = { kind: 'official', date: String(row.Date || ''), manual: false };
      $('fx').value = state.fx;
      clearError($('fx'));
      render();
      persistDraft();
    }
    setFxStatus();
  } catch {
    if (!rateMeta.manual && rateMeta.kind !== 'official') rateMeta = { kind: 'fallback', date: FALLBACK_USD_RATE.date, manual: false };
    setFxStatus();
  } finally {
    clearTimeout(spin);
    btn.removeAttribute('aria-busy');
    loadingRate = false;
  }
}

/* ---------- PDF, ko’rsatish, nusxalash, Forma/KP ---------- */
function printPdf() {
  const original = document.title;
  document.title = pdfFileName(state.agency, state.date);
  const restore = () => { document.title = original; };
  window.addEventListener('afterprint', restore, { once: true });
  window.print();
  setTimeout(restore, 1000);
}

function setPresenting(on) {
  document.body.classList.toggle('presenting', on);
  const btn = $('viewToggle');
  const label = on ? 'Tahrirga qaytish' : 'Mijozga ko’rsatish';
  btn.setAttribute('aria-pressed', String(on));
  btn.dataset.tip = label;
  btn.innerHTML = `${icon(on ? 'pencil' : 'eye', { size: 18 })}<span class="btn-label">${label}</span>`;
  btn.setAttribute('aria-label', label);
  session.set(KEYS.present, on ? '1' : '0');
}

function setPane(pane) {
  document.body.dataset.pane = pane;
  $('tabForm').setAttribute('aria-selected', String(pane === 'form'));
  $('tabKp').setAttribute('aria-selected', String(pane === 'kp'));
  $('tabForm').tabIndex = pane === 'form' ? 0 : -1;
  $('tabKp').tabIndex = pane === 'kp' ? 0 : -1;
  session.set('omon-kp-pane', pane);
}

function quoteText() {
  const q = quoteOf(state);
  const lines = [`Omon CRM — tijorat taklifi${agencyName(state) ? ` · ${agencyName(state)}` : ''}`];
  if (state.owner.trim()) lines.push(`Kimga: ${state.owner.trim()}`);
  const from = [state.sellerName.trim(), state.sellerPhone.trim()].filter(Boolean).join(', ');
  lines.push(`Kimdan: ${from || 'Omon CRM'}`, '');
  lines.push(`CRM: 189 000 × ${q.agents ?? DASH} agent × ${q.months} oy = ${fmtUzs(q.crm)} (+${q.bonusMonths} oy bepul, ${q.usageMonths} oy foydalanish)`);
  if (q.telephonyType !== 'none') lines.push(`${TELEPHONY_LABELS[q.telephonyType]}: ${q.lines} raqam × ${q.months} oy = ${fmtUzs(q.telephony)}`);
  if (q.chatbotType !== 'none') lines.push(`AI chatbot (${CHATBOT_LABELS[q.chatbotType]}): ${fmtUzs(q.chatbotMonthly)} / oy, har oy alohida to’lanadi`);
  lines.push(`Obuna jami: ${fmtUzs(q.subscriptionTotal)} · o’rtacha oyiga ${fmtUzs(q.avgMonthly)}`);
  lines.push(`O’rnatish va integratsiya (bir martalik): ${fmtUsd(q.setupUsd)}${q.setupUzs !== null ? ` = ${fmtUzs(q.setupUzs)}` : ''}`);
  lines.push(`Umumiy: ${fmtUzs(q.grandTotal)}`);
  return lines.join('\n');
}

async function copyText() {
  const text = quoteText();
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const box = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(box);
    box.select();
    document.execCommand('copy');
    box.remove();
  }
  toast('Taklif matni nusxalandi — messenjerga joylashtirishingiz mumkin');
}

/* ---------- ishga tushirish ---------- */
function bind() {
  for (const el of document.querySelectorAll('[data-key]')) {
    el.addEventListener('input', () => {
      clearError(el);
      if (el.id === 'fx') rateMeta = { kind: 'manual', date: '', manual: true };
      readForm();
      if (el.id === 'fx') setFxStatus();
    });
    el.addEventListener('blur', () => {
      const msg = validateField(el.dataset.key, state);
      if (msg) showError(el, msg);
      if (el.id === 'leads') {
        const missedMsg = validateField('missed', state);
        if (missedMsg && String(state.missed).trim()) showError($('missed'), missedMsg); else clearError($('missed'));
      }
    });
  }
  $('telephony').addEventListener('change', () => { if (state.telephony === 'none') clearError($('lines')); });
  $('editor').addEventListener('submit', (e) => e.preventDefault());
  $('refreshRate').addEventListener('click', () => {
    rateMeta = { ...rateMeta, manual: false };
    updateRate();
  });
  $('logoFile').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      state.agencyImage = await compressLogo(file);
      await refreshLogo();
      toast(persistDraft() ? 'Logotip qo’shildi' : 'Logotip ko’rinmoqda, lekin brauzer xotirasi to’lgan — zaxirani yuklab oling');
    } catch (err) {
      toast(`${err.message || 'Rasmni yuklab bo’lmadi'}`);
    }
  });
  $('logoRemove').addEventListener('click', () => {
    state.agencyImage = '';
    refreshLogo();
    persistDraft();
    $('logoFile').focus();
    toast('Logotip olib tashlandi');
  });
  $('logoRemoveBackground').addEventListener('change', (e) => {
    state.logoRemoveBackground = e.target.checked;
    refreshLogo();
    persistDraft();
  });

  $('saveTop').addEventListener('click', saveQuote);
  $('newQuote').addEventListener('click', newQuote);
  $('openLibrary').addEventListener('click', openLibrary);
  $('printPdf').addEventListener('click', printPdf);
  $('copyText').addEventListener('click', copyText);
  $('viewToggle').addEventListener('click', () => {
    setPresenting(!document.body.classList.contains('presenting'));
    window.scrollTo({ top: 0 });
  });

  $('library').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeLayer(); });
  $('quoteList').addEventListener('click', onLibraryClick);
  $('libraryEmpty').addEventListener('click', onLibraryClick);
  $('libraryNotice').addEventListener('click', onLibraryClick);
  $('librarySearch').addEventListener('input', (e) => {
    libraryQuery = e.target.value;
    confirmDeleteId = null;
    renderLibrary();
  });
  $('exportJson').addEventListener('click', exportJson);
  $('importJson').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) importJson(file);
  });

  for (const tab of [$('tabForm'), $('tabKp')]) {
    tab.addEventListener('click', () => setPane(tab.id === 'tabKp' ? 'kp' : 'form'));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const next = tab.id === 'tabKp' ? 'form' : 'kp';
      setPane(next);
      $(next === 'kp' ? 'tabKp' : 'tabForm').focus();
    });
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (!layer) saveQuote();
    }
  });
}

/** 600–794 px kenglikda A4 betni kichraytirib sig’diradi; telefonda (≤600) KP o’zi moslashadi. */
function fitPreview() {
  const box = $('kp');
  const apply = () => {
    const w = box.clientWidth;
    const zoom = w > 600 && w < 796 ? Math.max(0.5, (w - 2) / 796) : 1;
    box.style.setProperty('--kp-zoom', zoom.toFixed(4));
  };
  if ('ResizeObserver' in window) new ResizeObserver(apply).observe(box);
  else window.addEventListener('resize', apply);
  apply();
}

function init() {
  hydrateIcons();
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  $('saveTop').dataset.tip = `Saqlash (${mac ? '⌘S' : 'Ctrl+S'})`;
  fitPreview();
  const draft = readDraft(store);
  if (draft) {
    state = draft.state;
    selectedId = draft.selectedId;
    rateMeta = draft.rateMeta;
    if (selectedId && !savedRecord()) selectedId = null;
  }
  bind();
  setPane(session.get('omon-kp-pane') === 'kp' ? 'kp' : 'form');
  fillForm();
  if (session.get(KEYS.present) === '1') setPresenting(true);
  setFxStatus();
  if (!rateMeta.manual) updateRate();
}

init();
