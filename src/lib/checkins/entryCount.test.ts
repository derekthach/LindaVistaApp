import { describe, expect, it } from 'vitest';
import {
  getEntryCount,
  parseReceiptsCapturedInput,
  RECEIPTS_CAPTURED_MAX,
} from '@/lib/checkins/entryCount';

describe('getEntryCount', () => {
  it('defaults missing/invalid to 1', () => {
    expect(getEntryCount({})).toBe(1);
    expect(getEntryCount({ receipts_captured: undefined })).toBe(1);
    expect(getEntryCount({ receipts_captured: null })).toBe(1);
    expect(getEntryCount({ receipts_captured: 0 })).toBe(1);
    expect(getEntryCount({ receipts_captured: -3 })).toBe(1);
    expect(getEntryCount({ receipts_captured: 1.5 })).toBe(1);
  });

  it('returns valid integers and clamps above max', () => {
    expect(getEntryCount({ receipts_captured: 1 })).toBe(1);
    expect(getEntryCount({ receipts_captured: 15 })).toBe(15);
    expect(getEntryCount({ receipts_captured: 100 })).toBe(100);
    expect(getEntryCount({ receipts_captured: 101 })).toBe(RECEIPTS_CAPTURED_MAX);
  });
});

describe('parseReceiptsCapturedInput', () => {
  it('accepts blank as omit', () => {
    expect(parseReceiptsCapturedInput('')).toEqual({ ok: true, value: undefined });
    expect(parseReceiptsCapturedInput('   ')).toEqual({ ok: true, value: undefined });
    expect(parseReceiptsCapturedInput(null)).toEqual({ ok: true, value: undefined });
    expect(parseReceiptsCapturedInput(undefined)).toEqual({ ok: true, value: undefined });
  });

  it('accepts integers 1–100', () => {
    expect(parseReceiptsCapturedInput('1')).toEqual({ ok: true, value: 1 });
    expect(parseReceiptsCapturedInput('15')).toEqual({ ok: true, value: 15 });
    expect(parseReceiptsCapturedInput(100)).toEqual({ ok: true, value: 100 });
  });

  it('rejects invalid values', () => {
    expect(parseReceiptsCapturedInput('0').ok).toBe(false);
    expect(parseReceiptsCapturedInput('-1').ok).toBe(false);
    expect(parseReceiptsCapturedInput('1.5').ok).toBe(false);
    expect(parseReceiptsCapturedInput('101').ok).toBe(false);
    expect(parseReceiptsCapturedInput('abc').ok).toBe(false);
  });
});
