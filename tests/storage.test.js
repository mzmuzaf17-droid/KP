// TZ “Saqlash va moslik” bandlari.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KEYS, SCHEMA_VERSION, migrateState, readSaved, writeSaved, upsertRecord, readDraft,
  buildBackup, parseBackup, mergeSaved, defaultState,
} from '../js/storage.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    dump: () => Object.fromEntries(map),
  };
}

// Eski saytda saqlangan yozuvning aynan shakli (docs/01-repo-tahlili.md).
const LEGACY_DATA = {
  agency: 'Samo Travel', agencyImage: '', logoRemoveBackground: true, owner: 'Ali Valiyev', contact: '+998 90 000 00 00',
  city: 'Toshkent', manager: 'Muzaffar Mirkhamidov', managerPhone: '+998 77 177 13 19', date: '2026-11-03', validDays: '7',
  employees: '4', workDays: '26', leads: '30', missed: '5', recovery: '50', conversion: '25', profit: '800000',
  responseNow: '15', responseAfter: '5', searchNow: '20', searchAfter: '4', searches: '18',
  agents: '4', months: '12', phoneType: 'personal', phones: '3', fx: '11941.65', bonus: '3',
};

test('yangilanishdan oldin saqlangan KP xatosiz ochiladi, chatbot “yo’q”', () => {
  const storage = memoryStorage({
    [KEYS.saved]: JSON.stringify({ saved: [{ id: 'kp-1', agency: 'Samo Travel', updated: '2026-11-03T10:00:00.000Z', data: LEGACY_DATA, rateMeta: { kind: 'official', date: '03.11.2026', manual: false } }] }),
  });
  const [rec] = readSaved(storage);
  assert.equal(rec.id, 'kp-1');
  assert.equal(rec.data.chatbot, 'none');
  assert.equal(rec.data.telephony, 'myzvanki');
  assert.equal(rec.data.lines, '3');
  assert.equal(rec.data.months, '12');
  assert.equal(rec.data.agents, '4');
  assert.equal(rec.data.schemaVersion, SCHEMA_VERSION);
  assert.equal(rec.rateMeta.kind, 'official');
  assert.ok(!('phoneType' in rec.data));
  assert.ok(!('bonus' in rec.data));
  assert.equal(rec.data.sellerName, 'Muzaffar Mirkhamidov', 'eski manager maydoni ijrochiga o’tadi');
  assert.equal(rec.data.sellerPhone, '+998 77 177 13 19');
});

test('yangi KP: ijrochi standart, xodimlar soni bo’sh', () => {
  const d = defaultState();
  assert.equal(d.sellerName, 'Muzaffar Mirkhamidov');
  assert.equal(d.employees, '');
  assert.equal(migrateState({ sellerName: 'Dilnoza', manager: 'Muzaffar Mirkhamidov' }).sellerName, 'Dilnoza');
});

test('UzTel eski qiymati (company) ham o’tadi; buzilgan ma’lumot xato bermaydi', () => {
  assert.equal(migrateState({ phoneType: 'company', phones: '2' }).telephony, 'uztel');
  assert.deepEqual(Object.keys(migrateState(null)).sort(), Object.keys(defaultState()).sort());
  assert.equal(migrateState({ agencyImage: 'javascript:alert(1)' }).agencyImage, '');
  assert.deepEqual(readSaved(memoryStorage({ [KEYS.saved]: '{not json' })), []);
  assert.equal(readDraft(memoryStorage({ [KEYS.draft]: JSON.stringify({ state: LEGACY_DATA }) })).state.telephony, 'myzvanki');
});

test('saqlash schemaVersion: 2 bilan yozadi va qayta o’qiladi', () => {
  const storage = memoryStorage();
  const state = { ...migrateState(LEGACY_DATA), chatbot: 'c1000' };
  const { record, items } = upsertRecord([], { id: null, state, rateMeta: { kind: 'manual', date: '', manual: true }, now: new Date('2026-11-06T09:00:00Z') });
  assert.ok(writeSaved(storage, items));
  const raw = JSON.parse(storage.dump()[KEYS.saved]);
  assert.equal(raw.saved[0].schemaVersion, 2);
  assert.equal(raw.saved[0].data.schemaVersion, 2);
  const [back] = readSaved(storage);
  assert.equal(back.id, record.id);
  assert.equal(back.data.chatbot, 'c1000');
});

test('JSON zaxira yangi maydonlar bilan chiqadi va qayta import qilinadi', () => {
  const state = { ...migrateState(LEGACY_DATA), chatbot: 'c500' };
  const { items } = upsertRecord([], { id: 'kp-9', state, rateMeta: { kind: 'official', date: '06.11.2026', manual: false } });
  const backup = JSON.parse(JSON.stringify(buildBackup({ state, rateMeta: { kind: 'official', date: '06.11.2026', manual: false }, saved: items })));
  const parsed = parseBackup(backup);
  assert.equal(parsed.current.state.chatbot, 'c500');
  assert.equal(parsed.saved[0].id, 'kp-9');
  assert.equal(parsed.saved[0].data.chatbot, 'c500');
});

test('eski sayt eksporti ({version:2, ...state}) ham import qilinadi', () => {
  const parsed = parseBackup(JSON.stringify({ version: 2, exportedAt: '2026-11-03T00:00:00Z', ...LEGACY_DATA }));
  assert.equal(parsed.current.state.agency, 'Samo Travel');
  assert.equal(parsed.current.state.telephony, 'myzvanki');
  assert.equal(parsed.current.state.chatbot, 'none');
  assert.throws(() => parseBackup('{"foo":1}'));
  assert.throws(() => parseBackup('[]'));
});

test('import birlashtirishda yangiroq yozuv qoladi', () => {
  const a = { id: 'x', updated: '2026-11-01T00:00:00Z', data: {} };
  const b = { id: 'x', updated: '2026-11-05T00:00:00Z', data: {} };
  const c = { id: 'y', updated: '2026-11-02T00:00:00Z', data: {} };
  const merged = mergeSaved([a, c], [b]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].updated, b.updated);
});
