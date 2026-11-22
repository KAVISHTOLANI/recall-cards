import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('Recall Cards workflow', () => {
  it('shows demo decks with due counts', () => {
    window.location.hash = '/decks';
    render(<App />);
    expect(screen.getByText('Spanish — everyday words')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Review \d+ due$/ }).length).toBeGreaterThan(0);
  });

  it('reviews due cards with keyboard shortcuts and shows a summary', async () => {
    window.location.hash = '/review/demo-geo';
    const user = userEvent.setup();
    render(<App />);
    const total = Number(screen.getByTestId('review-pos').textContent!.split('/')[1]);
    for (let i = 0; i < total; i++) {
      fireEvent.keyDown(window, { code: 'Space', key: ' ' });
      fireEvent.keyDown(window, { key: i === 0 ? 'ArrowLeft' : 'ArrowRight' });
    }
    expect(screen.getByText(/Session complete/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(`${total - 1} of ${total} right`);
    expect(screen.getByText(/went back to box 1/)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'See progress' }));
  });

  it('validates and adds cards, then imports a list', async () => {
    window.location.hash = '/deck/demo-es';
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Add card' }));
    expect(screen.getByText('Write the question or prompt.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Front'), 'El Gato');
    await user.type(screen.getByLabelText('Back'), 'cat');
    await user.click(screen.getByRole('button', { name: 'Add card' }));
    expect(screen.getByText(/same front/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Front'));
    await user.type(screen.getByLabelText('Front'), 'la manzana');
    await user.click(screen.getByRole('button', { name: 'Add card' }));
    expect(screen.getByText(/Card added/)).toBeInTheDocument();
    await user.click(screen.getByText('Import many cards'));
    fireEvent.change(screen.getByLabelText('Cards to import'), { target: { value: 'el queso\tthe cheese\nla manzana\tapple\nnonsense' } });
    await user.click(screen.getByRole('button', { name: 'Import' }));
    expect(screen.getByText(/Imported 1 card, 1 duplicate\(s\) skipped, line\(s\) 3 not understood/)).toBeInTheDocument();
  });

  it('shows empty states', async () => {
    window.location.hash = '/decks';
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Remove demo decks' }));
    expect(screen.getByText('No decks yet')).toBeInTheDocument();
    unmount();
    window.location.hash = '/progress';
    render(<App />);
    expect(screen.getByText('No progress yet')).toBeInTheDocument();
  });
});
