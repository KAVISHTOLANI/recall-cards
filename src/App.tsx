import { useEffect, useState } from 'react';
import { DemoTag, EmptyState, Field, Landing, NotFound, Notice, PageHead, Shell, uid, useFlash, usePersistentState, useRoute } from './shared/ui';
import { DEMO_DECKS, demoCards } from './lib/demo';
import { accuracy, boxCounts, dailyHistory, dueCards, INTERVALS, isDue, nextDue, parseImport, parseTags, review, studyStreak, toISO, validateCard, validateDeck, type Card, type Deck } from './lib/srs';

const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/decks', label: 'Decks' },
  { to: '/progress', label: 'Progress' },
  { to: '/how', label: 'How scheduling works' },
];

interface Store {
  decks: Deck[];
  cards: Card[];
}
type SetStore = (fn: (s: Store) => Store) => void;
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function App() {
  const [route, navigate] = useRoute();
  const [store, setRaw] = usePersistentState<Store>('recall:store', () => ({ decks: DEMO_DECKS, cards: demoCards() }));
  const setStore: SetStore = (fn) => setRaw((s) => fn(s));
  const today = toISO(new Date());
  const deckM = route.match(/^\/deck\/(.+)$/);
  const revM = route.match(/^\/review\/(.+)$/);
  let page;
  if (route === '/') page = <Home />;
  else if (route === '/decks') page = <Decks store={store} setStore={setStore} today={today} />;
  else if (route === '/progress') page = <Progress store={store} today={today} />;
  else if (route === '/how') page = <How />;
  else if (deckM) {
    const deck = store.decks.find((d) => d.id === deckM[1]);
    page = deck ? <DeckView deck={deck} store={store} setStore={setStore} today={today} onDeleted={() => navigate('/decks')} /> : <Missing />;
  } else if (revM) {
    const deck = store.decks.find((d) => d.id === revM[1]);
    page = deck ? <ReviewMode key={deck.id} deck={deck} store={store} setStore={setStore} today={today} /> : <Missing />;
  } else page = <NotFound />;
  return (
    <Shell name="Recall Cards" wordmark={['Recall', 'Cards']} nav={NAV} route={route} cta={{ to: '/decks', label: 'Start reviewing' }}>
      {page}
    </Shell>
  );
}

function Missing() {
  return <EmptyState title="Deck not found" actions={<a className="btn btn-primary" href="#/decks">Back to decks</a>}>It may have been deleted.</EmptyState>;
}

function Flashcard({ front, back, flipped, onFlip }: { front: string; back: string; flipped: boolean; onFlip?: () => void }) {
  return (
    <button type="button" className={`flashcard ${flipped ? 'is-flipped' : ''}`} onClick={onFlip} aria-label={flipped ? `Answer: ${back}` : `Question: ${front}. Activate to show the answer.`} aria-live="polite">
      <span className="fc-inner">
        <span className="fc-face fc-front"><span className="label-mono">Question</span><span className="fc-text">{front}</span></span>
        <span className="fc-face fc-back"><span className="label-mono">Answer</span><span className="fc-text">{back}</span></span>
      </span>
    </button>
  );
}

function Home() {
  const [flipped, setFlipped] = useState(false);
  const cards = demoCards();
  const boxes = boxCounts(cards);
  return (
    <Landing
      eyebrow="Flashcards · spaced review"
      title={<>Remember more, <em>review less.</em></>}
      lead="Make decks of question-and-answer cards, then review only the ones that are due. Cards you know come back less often; cards you miss come back tomorrow. The schedule is simple, visible and explained."
      primary={{ href: '#/decks', label: 'Start reviewing' }}
      secondary={{ href: '#/how', label: 'How scheduling works' }}
      previewLabel="Tap the card · demo deck"
      preview={
        <div className="hero-cards">
          <Flashcard front="el gato" back="the cat" flipped={flipped} onFlip={() => setFlipped(!flipped)} />
          <div className="hc-boxes" aria-label="Cards per Leitner box in the demo decks">
            {boxes.map((n, i) => (
              <div key={i}><span className="hcb-bar" style={{ height: `${(n / Math.max(...boxes, 1)) * 100}%` }} /><span className="label-mono">Box {i + 1}</span><span className="small muted">every {INTERVALS[i + 1]}d</span></div>
            ))}
          </div>
        </div>
      }
      steps={[
        { title: 'Make a deck', body: 'Add cards one by one or paste a list like “gato<tab>cat”. Tag them to stay organised.' },
        { title: 'Review what’s due', body: 'A calm, focused card view. Show the answer, then mark it right or wrong — keyboard shortcuts included.' },
        { title: 'Watch it stick', body: 'Accuracy, daily reviews and how many cards have climbed to the top box.' },
      ]}
      stepsIntro="Recall Cards opens with three labelled demo decks and two weeks of practice history."
      features={[
        { title: 'Leitner schedule', body: 'Five boxes: 1, 2, 4, 8 and 16 days. Right moves a card up, wrong sends it back to box 1.' },
        { title: 'Focused review', body: 'Space to flip, ← or 1 for wrong, → or 2 for right. Nothing else on screen.' },
        { title: 'Tags & search', body: 'Filter a deck by tag or text to edit the cards you need.' },
        { title: 'Progress history', body: 'A 14-day chart of right and wrong answers, box distribution and a study streak.' },
      ]}
      note="This is a simplified spaced-repetition schedule (Leitner boxes), not an adaptive algorithm such as SM-2 or FSRS. It is documented on the “How scheduling works” page."
      closing={{ title: <>Start with <em>ten cards.</em></>, action: { href: '#/decks', label: 'Create a deck' } }}
    />
  );
}

function Decks({ store, setStore, today }: { store: Store; setStore: SetStore; today: string }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useFlash();
  const totalDue = dueCards(store.cards, today).length;
  function create(e: React.FormEvent) {
    e.preventDefault();
    const err = validateDeck(name, store.decks);
    setError(err);
    if (err) return;
    const id = uid('deck');
    setStore((s) => ({ ...s, decks: [...s.decks, { id, name: name.trim(), description: desc.trim() }] }));
    setFlash({ kind: 'success', text: `Created “${name.trim()}”. Open it to add cards.` });
    setName('');
    setDesc('');
  }
  return (
    <div className="stack">
      <PageHead
        eyebrow="Workspace · Decks"
        title={<>Your <em>decks</em></>}
        description={totalDue ? `${totalDue} card${totalDue === 1 ? '' : 's'} due across all decks today.` : 'Nothing due today — you’re all caught up.'}
        actions={store.decks.some((d) => d.demo) ? <button type="button" className="btn" onClick={() => setStore((s) => ({ decks: s.decks.filter((d) => !d.demo), cards: s.cards.filter((c) => !c.deckId.startsWith('demo-')) }))}>Remove demo decks</button> : store.decks.length === 0 ? <button type="button" className="btn" onClick={() => setStore(() => ({ decks: DEMO_DECKS, cards: demoCards() }))}>Load demo decks</button> : undefined}
      />
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      <div className="layout-side">
        <form className="card stack" onSubmit={create} noValidate>
          <h2>New deck</h2>
          <Field label="Deck name" error={error}>{(c) => <input type="text" {...c} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Organic chemistry reactions" />}</Field>
          <Field label="Description (optional)">{(c) => <input type="text" {...c} value={desc} onChange={(e) => setDesc(e.target.value)} />}</Field>
          <button type="submit" className="btn btn-primary">Create deck</button>
        </form>
        {store.decks.length === 0 ? (
          <EmptyState title="No decks yet">Create your first deck to start adding cards.</EmptyState>
        ) : (
          <div className="deck-grid">
            {store.decks.map((d, i) => {
              const cards = store.cards.filter((c) => c.deckId === d.id);
              const due = cards.filter((c) => isDue(c, today)).length;
              const mastered = cards.filter((c) => c.box >= 4).length;
              return (
                <article key={d.id} className="card deck" data-reveal style={{ ['--i' as string]: i % 3 }}>
                  <div className="deck-stack" aria-hidden="true"><span /><span /></div>
                  <h3><a href={`#/deck/${d.id}`}>{d.name}</a></h3>
                  <p className="small muted">{d.description || 'No description'} {d.demo && <DemoTag />}</p>
                  <div className="deck-meta small">
                    <span>{cards.length} cards</span>
                    <span>{mastered} in boxes 4–5</span>
                  </div>
                  <div className="progress" aria-hidden="true"><span style={{ width: `${cards.length ? (mastered / cards.length) * 100 : 0}%` }} /></div>
                  <div className="row">
                    {due ? <a className="btn btn-primary btn-sm" href={`#/review/${d.id}`}>Review {due} due</a> : <span className="badge badge-ok">All caught up</span>}
                    <a className="btn btn-sm" href={`#/deck/${d.id}`}>Edit cards</a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DeckView({ deck, store, setStore, today, onDeleted }: { deck: Deck; store: Store; setStore: SetStore; today: string; onDeleted: () => void }) {
  const cards = store.cards.filter((c) => c.deckId === deck.id);
  const [form, setForm] = useState({ front: '', back: '', tags: '' });
  const [editing, setEditing] = useState<string | null>(null);
  const [errors, setErrors] = useState<ReturnType<typeof validateCard>>({});
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('all');
  const [importText, setImportText] = useState('');
  const [flash, setFlash] = useFlash(6000);
  const tags = [...new Set(cards.flatMap((c) => c.tags))].sort();
  const q = query.trim().toLowerCase();
  const shown = cards.filter((c) => (tag === 'all' || c.tags.includes(tag)) && (!q || c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q)));
  const due = cards.filter((c) => isDue(c, today)).length;

  function save(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateCard(form, cards, editing ?? undefined);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (editing) {
      setStore((s) => ({ ...s, cards: s.cards.map((c) => (c.id === editing ? { ...c, front: form.front.trim(), back: form.back.trim(), tags: parseTags(form.tags) } : c)) }));
      setFlash({ kind: 'success', text: 'Card updated. Its schedule is unchanged.' });
    } else {
      setStore((s) => ({ ...s, cards: [...s.cards, { id: uid('card'), deckId: deck.id, front: form.front.trim(), back: form.back.trim(), tags: parseTags(form.tags), box: 1, due: today, history: [] }] }));
      setFlash({ kind: 'success', text: 'Card added — it’s due for review now.' });
    }
    setForm({ front: '', back: '', tags: form.tags });
    setEditing(null);
  }
  function doImport() {
    const { cards: parsed, skipped } = parseImport(importText);
    const existing = new Set(cards.map((c) => c.front.toLowerCase()));
    const fresh = parsed.filter((p) => !existing.has(p.front.toLowerCase()));
    if (!fresh.length) return setFlash({ kind: 'error', text: parsed.length ? 'All of those cards are already in this deck.' : 'Nothing to import. Use one card per line: front, then a tab, “ - ” or comma, then back.' });
    setStore((s) => ({ ...s, cards: [...s.cards, ...fresh.map((p) => ({ id: uid('card'), deckId: deck.id, front: p.front, back: p.back, tags: [], box: 1, due: today, history: [] }))] }));
    setImportText('');
    setFlash({ kind: 'success', text: `Imported ${fresh.length} card${fresh.length === 1 ? '' : 's'}${parsed.length - fresh.length ? `, ${parsed.length - fresh.length} duplicate(s) skipped` : ''}${skipped.length ? `, line(s) ${skipped.join(', ')} not understood` : ''}.` });
  }

  return (
    <div className="stack">
      <PageHead
        eyebrow={<><a href="#/decks">← Decks</a> · {cards.length} cards {deck.demo && <DemoTag />}</>}
        title={deck.name}
        description={deck.description || undefined}
        actions={
          <>
            {due > 0 ? <a className="btn btn-primary" href={`#/review/${deck.id}`}>Review {due} due</a> : <span className="small muted">Next due {nextDue(cards, today) ? fmtDate(nextDue(cards, today)!) : '—'}</span>}
            <button type="button" className="btn btn-danger" onClick={() => { if (window.confirm(`Delete “${deck.name}” and its ${cards.length} cards?`)) { setStore((s) => ({ decks: s.decks.filter((d) => d.id !== deck.id), cards: s.cards.filter((c) => c.deckId !== deck.id) })); onDeleted(); } }}>Delete deck</button>
          </>
        }
      />
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      <div className="layout-side">
        <div className="stack">
          <form className="card stack" onSubmit={save} noValidate>
            <h2>{editing ? 'Edit card' : 'Add a card'}</h2>
            <Field label="Front" error={errors.front}>{(c) => <textarea {...c} rows={2} value={form.front} onChange={(e) => setForm({ ...form, front: e.target.value })} placeholder="Question or prompt" />}</Field>
            <Field label="Back" error={errors.back}>{(c) => <textarea {...c} rows={3} value={form.back} onChange={(e) => setForm({ ...form, back: e.target.value })} placeholder="Answer" />}</Field>
            <Field label="Tags" error={errors.tags} hint="Comma separated">{(c) => <input type="text" {...c} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />}</Field>
            <div className="row">
              <button type="submit" className="btn btn-primary">{editing ? 'Save card' : 'Add card'}</button>
              {editing && <button type="button" className="btn" onClick={() => { setEditing(null); setForm({ front: '', back: '', tags: '' }); setErrors({}); }}>Cancel</button>}
            </div>
          </form>
          <details className="card">
            <summary>Import many cards</summary>
            <div className="stack" style={{ marginTop: 10 }}>
              <textarea aria-label="Cards to import" className="code" rows={5} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={'gato\tcat\nperro - dog\nagua, water'} />
              <button type="button" className="btn" onClick={doImport}>Import</button>
            </div>
          </details>
        </div>
        <section className="card" aria-label="Cards in this deck">
          <div className="toolbar">
            <input type="search" aria-label="Search cards" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search cards" />
            <select aria-label="Filter by tag" value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="all">All tags</option>
              {tags.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          {cards.length === 0 ? (
            <EmptyState title="This deck is empty">Add a card with the form, or paste a list under “Import many cards”.</EmptyState>
          ) : shown.length === 0 ? (
            <p className="muted">No cards match.</p>
          ) : (
            <ul className="list card-list">
              {shown.map((c) => (
                <li key={c.id}>
                  <div className="cl-main">
                    <strong>{c.front}</strong>
                    <span className="muted">{c.back}</span>
                    <span className="row small">
                      <span className={`box box-${c.box}`}>Box {c.box}</span>
                      <span className="muted">{isDue(c, today) ? 'Due now' : `Due ${fmtDate(c.due)}`}</span>
                      {c.tags.map((t) => <span key={t} className="badge">{t}</span>)}
                    </span>
                  </div>
                  <span className="row">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setEditing(c.id); setForm({ front: c.front, back: c.back, tags: c.tags.join(', ') }); }} aria-label={`Edit card ${c.front}`}>Edit</button>
                    <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={() => setStore((s) => ({ ...s, cards: s.cards.filter((x) => x.id !== c.id) }))} aria-label={`Delete card ${c.front}`}>✕</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function ReviewMode({ deck, store, setStore, today }: { deck: Deck; store: Store; setStore: SetStore; today: string }) {
  const [queue] = useState(() => dueCards(store.cards.filter((c) => c.deckId === deck.id), today).map((c) => c.id));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [tally, setTally] = useState({ right: 0, wrong: 0 });
  const current = store.cards.find((c) => c.id === queue[pos]);
  const done = pos >= queue.length;

  function answer(correct: boolean) {
    if (!current || !flipped) return;
    setStore((s) => ({ ...s, cards: s.cards.map((c) => (c.id === current.id ? review(c, correct, today) : c)) }));
    setTally((t) => ({ right: t.right + (correct ? 1 : 0), wrong: t.wrong + (correct ? 0 : 1) }));
    setFlipped(false);
    setPos((p) => p + 1);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) return;
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'BUTTON') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && (e.key === 'ArrowLeft' || e.key === '1')) answer(false);
      else if (flipped && (e.key === 'ArrowRight' || e.key === '2')) answer(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (queue.length === 0)
    return <EmptyState title="Nothing due in this deck" actions={<a className="btn btn-primary" href={`#/deck/${deck.id}`}>Back to the deck</a>}>Next review: {nextDue(store.cards.filter((c) => c.deckId === deck.id), today) ? fmtDate(nextDue(store.cards.filter((c) => c.deckId === deck.id), today)!) : 'add some cards first'}.</EmptyState>;

  if (done) {
    const total = tally.right + tally.wrong;
    return (
      <div className="review-done card">
        <span className="label-mono">Session complete</span>
        <h1>{tally.right} of {total} <em>right</em></h1>
        <p className="muted">{tally.wrong ? `${tally.wrong} card${tally.wrong === 1 ? '' : 's'} went back to box 1 and will return tomorrow.` : 'Every card moved up a box.'}</p>
        <div className="row center">
          <a className="btn btn-primary" href="#/decks">Back to decks</a>
          <a className="btn" href="#/progress">See progress</a>
        </div>
      </div>
    );
  }

  return (
    <div className="review">
      <div className="review-top">
        <a href={`#/deck/${deck.id}`} className="small">← Exit review</a>
        <span className="small muted">{deck.name}</span>
        <span className="small" data-testid="review-pos">{pos + 1} / {queue.length}</span>
      </div>
      <div className="progress"><span style={{ width: `${(pos / queue.length) * 100}%` }} /></div>
      <div className="review-stage">
        <Flashcard key={current!.id} front={current!.front} back={current!.back} flipped={flipped} onFlip={() => setFlipped(!flipped)} />
        <p className="small muted center">Box {current!.box} · {current!.box === 5 ? 'top box' : `right moves it to box ${current!.box + 1} (${INTERVALS[current!.box + 1]} days)`}</p>
      </div>
      <div className="review-actions">
        {!flipped ? (
          <button type="button" className="btn btn-primary btn-lg" onClick={() => setFlipped(true)}>Show answer <kbd>Space</kbd></button>
        ) : (
          <>
            <button type="button" className="btn btn-lg wrong" onClick={() => answer(false)}>Got it wrong <kbd>←</kbd></button>
            <button type="button" className="btn btn-lg right" onClick={() => answer(true)}>Got it right <kbd>→</kbd></button>
          </>
        )}
      </div>
      <p className="small muted center">Right {tally.right} · Wrong {tally.wrong}</p>
    </div>
  );
}

function Progress({ store, today }: { store: Store; today: string }) {
  const days = dailyHistory(store.cards, today, 14);
  const max = Math.max(1, ...days.map((d) => d.correct + d.wrong));
  const boxes = boxCounts(store.cards);
  const acc = accuracy(store.cards);
  const acc7 = accuracy(store.cards, 7, today);
  const reviews = store.cards.reduce((n, c) => n + c.history.length, 0);
  const [tip, setTip] = useState<{ x: number; text: string } | null>(null);
  if (!store.cards.length) return <EmptyState title="No progress yet" actions={<a className="btn btn-primary" href="#/decks">Go to decks</a>}>Add cards and review them to see your history.</EmptyState>;
  return (
    <div className="stack">
      <PageHead eyebrow="Workspace · Progress" title={<>Your <em>progress</em></>} description={`${store.cards.length} cards in ${store.decks.length} decks · ${reviews} reviews recorded`} />
      <div className="stats">
        <div className="stat"><div className="stat-label">Accuracy (all time)</div><div className="stat-value">{acc == null ? '—' : `${Math.round(acc * 100)}%`}</div></div>
        <div className="stat"><div className="stat-label">Last 7 days</div><div className="stat-value">{acc7 == null ? '—' : `${Math.round(acc7 * 100)}%`}</div></div>
        <div className="stat"><div className="stat-label">Study streak</div><div className="stat-value" data-testid="streak">{studyStreak(store.cards, today)} days</div></div>
        <div className="stat"><div className="stat-label">Due today</div><div className="stat-value">{dueCards(store.cards, today).length}</div></div>
      </div>
      <div className="grid-2">
        <section className="card" aria-labelledby="daily-title">
          <div className="card-title-row">
            <h2 id="daily-title">Reviews per day</h2>
            <span className="legend"><span><i style={{ background: 'var(--ok)' }} />Right</span><span><i style={{ background: 'var(--err)' }} />Wrong</span></span>
          </div>
          <div className="daily" role="img" aria-label={`Reviews over the last 14 days: ${days.map((d) => `${fmtDate(d.date)} ${d.correct} right ${d.wrong} wrong`).join('; ')}`} onMouseLeave={() => setTip(null)}>
            {days.map((d, i) => (
              <div key={d.date} className="daily-col" onMouseEnter={(e) => setTip({ x: (e.currentTarget as HTMLElement).offsetLeft + 10, text: `${fmtDate(d.date)} · ${d.correct} right, ${d.wrong} wrong` })}>
                <div className="daily-stack grow-in" style={{ height: `${((d.correct + d.wrong) / max) * 100}%`, ['--i' as string]: i }}>
                  {d.wrong > 0 && <span className="w" style={{ flexGrow: d.wrong }} />}
                  {d.correct > 0 && <span className="r" style={{ flexGrow: d.correct }} />}
                </div>
              </div>
            ))}
            {tip && <span className="chart-tip" style={{ left: tip.x, top: 0 }}>{tip.text}</span>}
          </div>
          <div className="daily-x small muted"><span>{fmtDate(days[0].date)}</span><span>Today</span></div>
        </section>
        <section className="card" aria-labelledby="box-title">
          <h2 id="box-title">Cards per box</h2>
          <ul className="box-bars">
            {boxes.map((n, i) => (
              <li key={i}>
                <span className={`box box-${i + 1}`}>Box {i + 1}</span>
                <span className="bb-track"><span className="bb-fill" style={{ width: `${(n / Math.max(1, store.cards.length)) * 100}%` }} /></span>
                <span className="num">{n}</span>
              </li>
            ))}
          </ul>
          <p className="hint">Higher boxes are reviewed less often (1, 2, 4, 8, 16 days).</p>
        </section>
      </div>
    </div>
  );
}

function How() {
  return (
    <div className="stack narrow">
      <PageHead eyebrow="Reference" title={<>How scheduling <em>works</em></>} description="Recall Cards uses the Leitner box system — simple enough to predict by hand." />
      <div className="card prose">
        <ol>
          <li>Every new card starts in <strong>box 1</strong> and is due straight away.</li>
          <li>When you get a card <strong>right</strong>, it moves up one box. When you get it <strong>wrong</strong>, it goes back to box 1.</li>
          <li>A card’s next review is set from its box:</li>
        </ol>
        <table className="table">
          <thead><tr><th>Box</th><th>Next review after</th></tr></thead>
          <tbody>{[1, 2, 3, 4, 5].map((b) => <tr key={b}><td>Box {b}</td><td>{INTERVALS[b]} day{INTERVALS[b] === 1 ? '' : 's'}</td></tr>)}</tbody>
        </table>
        <p>Cards that are due are shown lowest box first, so the ones you know least come first. Box 5 is the top: correct answers keep it there, reviewed every 16 days.</p>
        <h2>What this is not</h2>
        <p>It doesn’t adapt intervals to how hard each card is (as SM-2 or FSRS do), and missing a day doesn’t penalise you — overdue cards simply stay due until you review them.</p>
      </div>
    </div>
  );
}
