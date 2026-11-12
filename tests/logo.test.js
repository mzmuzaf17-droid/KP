import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLogo } from '../js/logo.js';
import { defaultState, migrateState, buildBackup, parseBackup } from '../js/storage.js';

test('logo settings survive saved quote and JSON backup restoration', () => {
  const state = { ...defaultState(), logo: { shape: 'rounded', fit: 'cover', zoom: 1.4, x: -12, y: 7, size: 72, whiteBackground: true } };
  const restored = parseBackup(buildBackup({ state, rateMeta: {}, saved: [] })).current.state;
  assert.deepEqual(restored.logo, state.logo);
  assert.equal(restored.logoRemoveBackground, false);
});

test('damaged imports cannot inject logo CSS or unbounded transforms', () => {
  assert.equal(normalizeLogo(null).shape, 'circle');
  const opt = normalizeLogo({shape: '" style="color:red', zoom: 999, x: -999, y: 'NaN', size: '100px', fit: 'bad'});
  assert.deepEqual(opt, { shape: 'circle', fit: 'contain', zoom: 3, x: -100, y: 0, size: 64, whiteBackground: false });
  assert.equal(migrateState({logo:null}).logo.size, 64);
});

test('new uploads preserve dark backgrounds while explicit old preferences remain readable', () => {
  assert.equal(defaultState().logoRemoveBackground, false);
  assert.equal(migrateState({}).logoRemoveBackground, false);
  assert.equal(migrateState({logoRemoveBackground:true}).logoRemoveBackground, true);
});
