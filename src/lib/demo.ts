import { addDays, toISO, type Card, type Deck } from './srs';

export const DEMO_DECKS: Deck[] = [
  { id: 'demo-es', name: 'Spanish — everyday words', description: 'Common nouns and verbs for a beginner.', demo: true },
  { id: 'demo-bio', name: 'Cell biology basics', description: 'Organelles and what they do.', demo: true },
  { id: 'demo-geo', name: 'Capitals of Europe', description: 'A quick geography refresher.', demo: true },
];

const RAW: [string, string, string, string][] = [
  ['demo-es', 'el gato', 'the cat', 'nouns, animals'],
  ['demo-es', 'el perro', 'the dog', 'nouns, animals'],
  ['demo-es', 'comer', 'to eat', 'verbs'],
  ['demo-es', 'beber', 'to drink', 'verbs'],
  ['demo-es', 'la biblioteca', 'the library', 'nouns, places'],
  ['demo-es', 'mañana', 'tomorrow (also: morning)', 'time'],
  ['demo-es', '¿Dónde está la estación de tren más cercana?', 'Where is the nearest train station?', 'phrases, travel'],
  ['demo-bio', 'Mitochondrion', 'Produces most of the cell’s ATP through aerobic respiration.', 'organelles'],
  ['demo-bio', 'Ribosome', 'Assembles proteins from amino acids using mRNA as a template.', 'organelles'],
  ['demo-bio', 'Golgi apparatus', 'Modifies, sorts and packages proteins for secretion or delivery.', 'organelles'],
  ['demo-bio', 'Lysosome', 'Breaks down waste and worn-out cell parts with digestive enzymes.', 'organelles'],
  ['demo-bio', 'Cell membrane', 'A phospholipid bilayer that controls what enters and leaves the cell.', 'structures'],
  ['demo-geo', 'Portugal', 'Lisbon', 'western'],
  ['demo-geo', 'Austria', 'Vienna', 'central'],
  ['demo-geo', 'Lithuania', 'Vilnius', 'baltic'],
  ['demo-geo', 'Slovenia', 'Ljubljana', 'central'],
  ['demo-geo', 'Norway', 'Oslo', 'nordic'],
];

/** Demo cards with two weeks of plausible review history; a few are due today. */
export function demoCards(today = toISO(new Date())): Card[] {
  return RAW.map(([deckId, front, back, tags], i) => {
    const history = [];
    const pattern = [true, i % 3 !== 0, true, i % 4 !== 1, true];
    let box = 1;
    let day = addDays(today, -14 + (i % 3));
    for (const correct of pattern.slice(0, 2 + (i % 4))) {
      history.push({ date: day, correct });
      box = correct ? Math.min(5, box + 1) : 1;
      day = addDays(day, [0, 1, 2, 4, 8, 16][box]);
    }
    const due = i % 3 === 0 ? today : i % 3 === 1 ? addDays(today, -1) : addDays(today, 1 + (i % 5));
    return { id: `demo-card-${i}`, deckId, front, back, tags: tags.split(', '), box, due, history: history.filter((h) => h.date <= today) };
  });
}
