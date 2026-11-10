import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateField } from '../js/validate.js';
import { defaultState } from '../js/storage.js';

const s = (o) => ({ ...defaultState('2026-11-09'), ...o });

test('ixtiyoriy maydon bo’sh bo’lsa xato yo’q', () => {
  for (const k of ['employees', 'leads', 'missed', 'recovery', 'profit', 'responseNow', 'searches']) {
    assert.equal(validateField(k, s({ [k]: '' })), null, k);
  }
});

test('agentlar soni majburiy va butun son', () => {
  assert.match(validateField('agents', s({ agents: '' })), /agentlar sonini kiriting/);
  assert.match(validateField('agents', s({ agents: '0' })), /1 dan 999 gacha butun son/);
  assert.match(validateField('agents', s({ agents: '2.5' })), /butun son/);
  assert.equal(validateField('agents', s({ agents: '5' })), null);
});

test('foiz 0–100, ish kunlari 1–31', () => {
  assert.equal(validateField('recovery', s({ recovery: '120' })), '0 dan 100 gacha son kiriting.');
  assert.equal(validateField('recovery', s({ recovery: '50' })), null);
  assert.match(validateField('workDays', s({ workDays: '40' })), /1 dan 31 gacha/);
});

test('ishlanmay qolgan lidlar kunlik lidlardan oshmaydi', () => {
  assert.match(validateField('missed', s({ leads: '10', missed: '20' })), /oshmasligi kerak/);
  assert.equal(validateField('missed', s({ leads: '10', missed: '5' })), null);
});

test('raqamlar soni faqat telefoniya tanlanganda majburiy', () => {
  assert.equal(validateField('lines', s({ telephony: 'none', lines: '' })), null);
  assert.match(validateField('lines', s({ telephony: 'myzvanki', lines: '' })), /raqamlar sonini kiriting/);
  assert.equal(validateField('lines', s({ telephony: 'utel_optima', lines: '' })), null, 'UTEL uchun raqamlar soni kerak emas');
});

test('turagentlik nomi faqat saqlashda talab qilinadi', () => {
  assert.equal(validateField('agency', s({ agency: '' })), null);
  assert.match(validateField('agency', s({ agency: '  ' }), { onSave: true }), /turagentlik nomini kiriting/);
  assert.equal(validateField('agency', s({ agency: 'Samo' }), { onSave: true }), null);
});

test('xabarlar foydalanuvchini ayblamaydi', () => {
  const msgs = [
    validateField('agents', s({ agents: '' })), validateField('fx', s({ fx: '' })),
    validateField('missed', s({ leads: '1', missed: '9' })), validateField('recovery', s({ recovery: '-1' })),
  ];
  for (const m of msgs) assert.doesNotMatch(m, /noto’g’ri kiritdingiz|siz xato|xato kiritdingiz/i);
});
