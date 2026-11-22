/**
 * Review schedule (Leitner system, five boxes):
 * - New cards start in box 1 and are due immediately.
 * - Answer correctly → the card moves up one box (max 5).
 * - Answer incorrectly → the card goes back to box 1.
 * - A card in box n is next due after INTERVALS[n] days.
 */
export const INTERVALS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

export interface Review {
  date: string; // YYYY-MM-DD
  correct: boolean;
}
export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  tags: string[];
  box: number;
  due: string;
  history: Review[];
}
export interface Deck {
  id: string;
  name: string;
  description: string;
  demo?: boolean;
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toISO(new Date(y, m - 1, d + n));
}
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

export function review(card: Card, correct: boolean, today: string): Card {
  const box = correct ? Math.min(5, card.box + 1) : 1;
  return { ...card, box, due: addDays(today, INTERVALS[box]), history: [...card.history, { date: today, correct }] };
}

export function isDue(c: Card, today: string) {
  return c.due <= today;
}

export function dueCards(cards: Card[], today: string) {
  return cards.filter((c) => isDue(c, today)).sort((a, b) => a.box - b.box || a.due.localeCompare(b.due));
}

export function nextDue(cards: Card[], today: string): string | null {
  const future = cards.filter((c) => c.due > today).map((c) => c.due).sort();
  return future[0] ?? null;
}

export function accuracy(cards: Card[], sinceDays?: number, today?: string): number | null {
  const all = cards.flatMap((c) => c.history).filter((h) => sinceDays == null || !today || daysBetween(h.date, today) < sinceDays);
  return all.length ? all.filter((h) => h.correct).length / all.length : null;
}

export function dailyHistory(cards: Card[], today: string, days = 14) {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1);
    const reviews = cards.flatMap((c) => c.history).filter((h) => h.date === date);
    return { date, correct: reviews.filter((r) => r.correct).length, wrong: reviews.filter((r) => !r.correct).length };
  });
}

export function boxCounts(cards: Card[]): number[] {
  return [1, 2, 3, 4, 5].map((b) => cards.filter((c) => c.box === b).length);
}

export function studyStreak(cards: Card[], today: string): number {
  const dates = new Set(cards.flatMap((c) => c.history.map((h) => h.date)));
  let n = 0;
  let d = dates.has(today) ? today : addDays(today, -1);
  while (dates.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function parseTags(s: string): string[] {
  return [...new Set(s.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 8);
}

export function validateCard(input: { front: string; back: string; tags: string }, deckCards: Card[], editingId?: string) {
  const e: { front?: string; back?: string; tags?: string } = {};
  if (!input.front.trim()) e.front = 'Write the question or prompt.';
  else if (input.front.length > 500) e.front = 'Keep the front under 500 characters.';
  else if (deckCards.some((c) => c.id !== editingId && c.front.trim().toLowerCase() === input.front.trim().toLowerCase())) e.front = 'This deck already has a card with the same front.';
  if (!input.back.trim()) e.back = 'Write the answer.';
  else if (input.back.length > 1000) e.back = 'Keep the back under 1000 characters.';
  if (input.tags.split(',').some((t) => t.trim().length > 24)) e.tags = 'Tags must be 24 characters or fewer.';
  return e;
}

export function validateDeck(name: string, decks: Deck[], editingId?: string): string | null {
  const n = name.trim();
  if (!n) return 'Name the deck.';
  if (n.length > 60) return 'Keep the name under 60 characters.';
  if (decks.some((d) => d.id !== editingId && d.name.toLowerCase() === n.toLowerCase())) return 'You already have a deck with this name.';
  return null;
}

/** Imports “front<TAB>back” or “front,back” lines. */
export function parseImport(text: string): { cards: { front: string; back: string }[]; skipped: number[] } {
  const cards: { front: string; back: string }[] = [];
  const skipped: number[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const sep = line.includes('\t') ? '\t' : line.includes(' - ') ? ' - ' : ',';
    const idx = line.indexOf(sep);
    const front = idx >= 0 ? line.slice(0, idx).trim() : '';
    const back = idx >= 0 ? line.slice(idx + sep.length).trim() : '';
    if (front && back) cards.push({ front, back });
    else skipped.push(i + 1);
  });
  return { cards, skipped };
}
