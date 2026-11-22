import { describe, expect, it } from 'vitest';
import { accuracy, boxCounts, dailyHistory, daysBetween, dueCards, nextDue, parseImport, parseTags, review, studyStreak, validateCard, validateDeck, type Card } from './srs';

const card = (o: Partial<Card> = {}): Card => ({ id: 'c', deckId: 'd', front: 'hola', back: 'hello', tags: [], box: 1, due: '2026-03-01', history: [], ...o });

describe('Leitner schedule', () => {
  it('promotes on correct answers and resets on mistakes', () => {
    let c = review(card(), true, '2026-03-01');
    expect(c).toMatchObject({ box: 2, due: '2026-03-03' });
    c = review({ ...c, box: 4 }, true, '2026-03-03');
    expect(c).toMatchObject({ box: 5, due: '2026-03-19' });
    c = review(c, true, '2026-03-19');
    expect(c.box).toBe(5);
    c = review(c, false, '2026-04-04');
    expect(c).toMatchObject({ box: 1, due: '2026-04-05' });
    expect(c.history).toHaveLength(4);
  });
  it('finds due cards, lowest box first, and the next due date', () => {
    const cards = [card({ id: 'a', box: 3, due: '2026-03-01' }), card({ id: 'b', box: 1, due: '2026-03-02' }), card({ id: 'c', due: '2026-03-09' })];
    expect(dueCards(cards, '2026-03-02').map((c) => c.id)).toEqual(['b', 'a']);
    expect(nextDue(cards, '2026-03-02')).toBe('2026-03-09');
    expect(daysBetween('2026-02-28', '2026-03-02')).toBe(2);
  });
});

describe('statistics', () => {
  const cards = [card({ box: 2, history: [{ date: '2026-03-01', correct: true }, { date: '2026-03-02', correct: false }] }), card({ box: 5, history: [{ date: '2026-03-02', correct: true }] })];
  it('computes accuracy, daily history, boxes and streaks', () => {
    expect(accuracy(cards)).toBeCloseTo(2 / 3);
    expect(accuracy([])).toBeNull();
    expect(dailyHistory(cards, '2026-03-02', 2)).toEqual([{ date: '2026-03-01', correct: 1, wrong: 0 }, { date: '2026-03-02', correct: 1, wrong: 1 }]);
    expect(boxCounts(cards)).toEqual([0, 1, 0, 0, 1]);
    expect(studyStreak(cards, '2026-03-02')).toBe(2);
    expect(studyStreak(cards, '2026-03-03')).toBe(2);
    expect(studyStreak(cards, '2026-03-05')).toBe(0);
  });
});

describe('validation and import', () => {
  it('validates cards and decks', () => {
    expect(validateCard({ front: '', back: '', tags: '' }, [])).toEqual({ front: expect.any(String), back: expect.any(String) });
    expect(validateCard({ front: 'HOLA', back: 'x', tags: '' }, [card()]).front).toMatch(/same front/);
    expect(validateCard({ front: 'hola', back: 'x', tags: '' }, [card()], 'c')).toEqual({});
    expect(validateDeck('', [])).toBeTruthy();
    expect(validateDeck('Spanish', [{ id: '1', name: 'spanish', description: '' }])).toMatch(/already/);
    expect(parseTags('Verbs, verbs ,  , Food')).toEqual(['verbs', 'food']);
  });
  it('imports tab, dash and comma separated lines', () => {
    expect(parseImport('gato\tcat\nperro - dog\nagua,water\njusttext')).toEqual({ cards: [{ front: 'gato', back: 'cat' }, { front: 'perro', back: 'dog' }, { front: 'agua', back: 'water' }], skipped: [4] });
  });
});
