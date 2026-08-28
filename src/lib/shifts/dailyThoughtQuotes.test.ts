import { describe, expect, it } from 'vitest';
import {
  DAILY_THOUGHT_QUOTES,
  appendThoughtOfTheDay,
  formatThoughtOfTheDaySection,
  getDailyQuote,
} from './dailyThoughtQuotes';

describe('DAILY_THOUGHT_QUOTES', () => {
  it('has about 50 short quotes', () => {
    expect(DAILY_THOUGHT_QUOTES.length).toBeGreaterThanOrEqual(45);
    expect(DAILY_THOUGHT_QUOTES.length).toBeLessThanOrEqual(60);
    for (const quote of DAILY_THOUGHT_QUOTES) {
      expect(quote.trim().length).toBeGreaterThan(0);
      expect(quote.split(/\s+/).length).toBeLessThanOrEqual(18);
    }
  });
});

describe('getDailyQuote', () => {
  it('is deterministic for the same date + recipient', () => {
    const a = getDailyQuote('2026-08-26', 'dad');
    const b = getDailyQuote('2026-08-26', 'dad');
    expect(a).toBe(b);
    expect(DAILY_THOUGHT_QUOTES).toContain(a);
  });

  it('can differ across recipients on the same date', () => {
    const derek = getDailyQuote('2026-08-26', 'derek');
    const dad = getDailyQuote('2026-08-26', 'dad');
    // Not guaranteed different for every date, but these seeds should diverge.
    expect(derek).not.toBe(dad);
  });

  it('can change across dates for the same recipient', () => {
    const day1 = getDailyQuote('2026-08-26', 'dad');
    const day2 = getDailyQuote('2026-08-27', 'dad');
    expect(day1).not.toBe(day2);
  });

  it('does not embed the recipient id in the quote text', () => {
    const quote = getDailyQuote('2026-08-26', '+17875551234');
    expect(quote).not.toContain('+17875551234');
    expect(quote).not.toContain('17875551234');
  });
});

describe('formatThoughtOfTheDaySection / appendThoughtOfTheDay', () => {
  it('formats the footer section', () => {
    expect(formatThoughtOfTheDaySection('Stay steady. Steady wins.')).toBe(
      [
        '',
        '━━━━━━━━━━━━━━',
        '',
        '💭 Thought of the Day',
        '“Stay steady. Steady wins.”',
      ].join('\n')
    );
  });

  it('appends after the base summary body', () => {
    const base = '🏨 Linda Vista — Daily Summary\n📅 August 26, 2026';
    const full = appendThoughtOfTheDay(base, 'Keep going.');
    expect(full.startsWith(base)).toBe(true);
    expect(full).toContain('💭 Thought of the Day');
    expect(full).toContain('“Keep going.”');
  });
});
