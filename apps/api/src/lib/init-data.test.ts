import { describe, expect, it } from 'vitest';

import { signInitData, validateInitData } from './init-data.js';

const TOKEN = '123456:TEST_TOKEN';
const NOW = new Date('2026-10-10T12:00:00Z');
const authDate = String(Math.floor(NOW.getTime() / 1000) - 60);
const user = JSON.stringify({ id: 42, first_name: 'Тим', username: 'tim_dev' });

describe('validateInitData', () => {
  it('accepts a valid signature', () => {
    const raw = signInitData({ auth_date: authDate, user, query_id: 'AAA' }, TOKEN);
    const result = validateInitData(raw, TOKEN, 3600, NOW);
    expect(result).toMatchObject({ ok: true, user: { id: 42, username: 'tim_dev' } });
  });

  it('rejects a wrong hash', () => {
    const raw = signInitData({ auth_date: authDate, user }, 'other:token');
    expect(validateInitData(raw, TOKEN, 3600, NOW)).toEqual({ ok: false, reason: 'BAD_HASH' });
  });

  it('rejects tampered data', () => {
    const raw = signInitData({ auth_date: authDate, user }, TOKEN).replace('tim_dev', 'admin');
    expect(validateInitData(raw, TOKEN, 3600, NOW)).toEqual({ ok: false, reason: 'BAD_HASH' });
  });

  it('rejects expired data', () => {
    const old = String(Math.floor(NOW.getTime() / 1000) - 7200);
    const raw = signInitData({ auth_date: old, user }, TOKEN);
    expect(validateInitData(raw, TOKEN, 3600, NOW)).toEqual({ ok: false, reason: 'EXPIRED' });
  });

  it('rejects missing hash and bad user', () => {
    expect(validateInitData('auth_date=1', TOKEN, 3600, NOW)).toEqual({
      ok: false,
      reason: 'MISSING_HASH',
    });
    const raw = signInitData({ auth_date: authDate, user: '{"id":"x"}' }, TOKEN);
    expect(validateInitData(raw, TOKEN, 3600, NOW)).toEqual({ ok: false, reason: 'BAD_USER' });
  });

  it('rejects a hash of a different length', () => {
    expect(validateInitData(`auth_date=${authDate}&hash=abcd`, TOKEN, 3600, NOW)).toEqual({
      ok: false,
      reason: 'BAD_HASH',
    });
  });
});
