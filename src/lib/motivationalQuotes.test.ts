import { describe, expect, it } from 'vitest';
import {
  formatQuoteOfTheDaySection,
  getQuoteIndexForBusinessDate,
  getQuoteOfTheDay,
  motivationalQuotes,
} from '@/lib/motivationalQuotes';

describe('motivationalQuotes', () => {
  it('has at least 50 quotes with text and author', () => {
    expect(motivationalQuotes.length).toBeGreaterThanOrEqual(50);
    for (const q of motivationalQuotes) {
      expect(q.text.trim().length).toBeGreaterThan(0);
      expect(q.author.trim().length).toBeGreaterThan(0);
    }
  });

  it('returns the same quote for the same PR business date', () => {
    const a = getQuoteOfTheDay('2026-08-27');
    const b = getQuoteOfTheDay('2026-08-27');
    expect(a).toEqual(b);
  });

  it('advances one index per consecutive calendar day', () => {
    const i1 = getQuoteIndexForBusinessDate('2026-08-26');
    const i2 = getQuoteIndexForBusinessDate('2026-08-27');
    expect(i2).toBe((i1 + 1) % motivationalQuotes.length);
  });

  it('cycles through the full library before repeating', () => {
    const start = getQuoteIndexForBusinessDate('2026-01-01');
    const afterFullCycle = getQuoteIndexForBusinessDate(
      // 56 days later if library is 56 — use length
      (() => {
        const base = Date.UTC(2026, 0, 1);
        const next = new Date(base + motivationalQuotes.length * 86_400_000);
        const y = next.getUTCFullYear();
        const m = String(next.getUTCMonth() + 1).padStart(2, '0');
        const d = String(next.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      })()
    );
    expect(afterFullCycle).toBe(start);
  });

  it('formats the Quote of the Day section', () => {
    const quote = { text: 'Test quote.', author: 'Test Author' };
    expect(formatQuoteOfTheDaySection(quote)).toBe(
      [
        '━━━━━━━━━━━━━━',
        '',
        '💡 Quote of the Day',
        '“Test quote.”',
        '— Test Author',
      ].join('\n')
    );
  });

  it('falls back to index 0 for invalid dates', () => {
    expect(getQuoteIndexForBusinessDate('not-a-date')).toBe(0);
    expect(getQuoteOfTheDay('not-a-date')).toEqual(motivationalQuotes[0]);
  });
});
