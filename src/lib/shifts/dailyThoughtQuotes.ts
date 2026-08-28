/**
 * Local "Thought of the Day" library for Daily Summary iMessages.
 * Selection is pure and deterministic — no Firestore, no external APIs.
 */

/** Short, work-appropriate motivational quotes (~50). */
export const DAILY_THOUGHT_QUOTES: readonly string[] = [
  'Success comes from consistently doing the little things well.',
  'Small daily improvements lead to lasting results.',
  'Show up, do the work, and keep going.',
  'Teamwork turns good days into great ones.',
  'Discipline beats motivation when it matters most.',
  'Excellence is a habit, not a single act.',
  'Great service starts with caring about the details.',
  'Progress happens one focused step at a time.',
  'Consistency compounds into real success.',
  'Do today\'s work with pride and purpose.',
  'Strong teams lift each other every day.',
  'Quality work earns trust over time.',
  'Stay steady. Steady wins.',
  'Your effort today shapes tomorrow\'s results.',
  'Serve well, and success follows.',
  'Focus on what you can improve right now.',
  'Good systems make hard days easier.',
  'Be reliable — it is a quiet superpower.',
  'Care in the small things builds reputation.',
  'Keep learning. Keep improving. Keep going.',
  'A positive attitude strengthens every shift.',
  'Finish strong, even when the day is long.',
  'Clear goals and steady work get you there.',
  'Respect the craft. Respect the team.',
  'Better is always possible with effort.',
  'Own your role and raise the standard.',
  'Patience and persistence open doors.',
  'Help a teammate, and everyone wins.',
  'The best results come from careful work.',
  'Start where you are. Improve from there.',
  'Hard work done well is never wasted.',
  'Stay curious and keep raising the bar.',
  'Calm focus beats rushed chaos.',
  'Integrity is doing right when no one watches.',
  'Make each guest feel valued.',
  'Practice makes progress, not perfection.',
  'Energy and kindness go a long way.',
  'Plan well, then execute with care.',
  'Every shift is a chance to get better.',
  'Reliable people build lasting businesses.',
  'Celebrate progress, then keep moving.',
  'Accountability turns goals into outcomes.',
  'Do the next right thing, then the next.',
  'Strong habits create strong results.',
  'Listen well. Communicate clearly. Deliver.',
  'Pride in your work shows in every detail.',
  'Support your team and share the win.',
  'Stay humble, stay hungry, stay helpful.',
  'Today\'s discipline is tomorrow\'s advantage.',
  'Keep promises. Keep standards. Keep growing.',
] as const;

/**
 * FNV-1a 32-bit hash for stable pseudo-random indexing.
 * Same seed always yields the same unsigned 32-bit value.
 */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Pick a Thought of the Day from the local library.
 *
 * Deterministic from `summaryDate` + `recipientId` (e.g. recipient key or phone).
 * Different recipients can get different quotes; the same date+id always matches.
 * Never logs or returns the recipient identifier.
 */
export function getDailyQuote(summaryDate: string, recipientId: string): string {
  const date = summaryDate.trim();
  const id = recipientId.trim();
  if (!date || !id || DAILY_THOUGHT_QUOTES.length === 0) {
    return DAILY_THOUGHT_QUOTES[0] ?? 'Keep going — good work adds up.';
  }
  const index = hashSeed(`${date}|${id}`) % DAILY_THOUGHT_QUOTES.length;
  return DAILY_THOUGHT_QUOTES[index]!;
}

/** Plain-text Thought of the Day block appended under the shift summaries. */
export function formatThoughtOfTheDaySection(quote: string): string {
  return ['', '━━━━━━━━━━━━━━', '', '💭 Thought of the Day', `“${quote}”`].join('\n');
}

/** Append a Thought of the Day section to an already-formatted Daily Summary body. */
export function appendThoughtOfTheDay(baseMessage: string, quote: string): string {
  return `${baseMessage}${formatThoughtOfTheDaySection(quote)}`;
}
