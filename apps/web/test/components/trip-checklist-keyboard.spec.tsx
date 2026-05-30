/**
 * Vitest jsdom spec for <TripChecklist/> keyboard nav (AE121).
 *
 * Covers the rovingtab pattern added in AE121:
 *   - Arrow Up/Down moves focus between rows (with wraparound)
 *   - Space toggles the done flag on the focused row
 *   - Enter also toggles (alias for Space)
 *   - Delete removes the focused row + moves focus to previous neighbour
 *   - Backspace mirrors Delete (mobile + some keyboards)
 *
 * The starter is the 5-item generic STARTER (no destinationSlug), so we
 * know the row order at the top of every test.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AetherProvider } from '@app/aether-core';
import { theme } from '@app/aether-motion';
import { TripChecklist } from '../../src/components/aether/journey/trip-checklist';

const TRIP_ID = 'kbd-trip-1';
const KEY = `aether-checklist:${TRIP_ID}:v1`;

function renderChecklist(): void {
  render(
    <AetherProvider premiumTier={null} audioOptOut={false} theme={theme}>
      <TripChecklist tripId={TRIP_ID} />
    </AetherProvider>,
  );
}

function rowOf(text: string | RegExp): HTMLLIElement {
  // Find the <li> ancestor of the row's text span — rows are the only
  // focusable list items.
  const el = screen.getByText(text);
  const li = el.closest('li');
  if (li === null) throw new Error(`No <li> ancestor for "${String(text)}"`);
  return li as HTMLLIElement;
}

describe('<TripChecklist/> keyboard nav', () => {
  beforeEach(() => {
    window.localStorage.removeItem(KEY);
  });
  afterEach(() => {
    window.localStorage.removeItem(KEY);
  });

  it('renders each row as a focusable tabIndex=0 list item', () => {
    renderChecklist();
    const li = rowOf('Photo ID + photocopy');
    expect(li.getAttribute('tabindex')).toBe('0');
  });

  it('ArrowDown on row N focuses row N+1', () => {
    renderChecklist();
    const row1 = rowOf('Photo ID + photocopy');
    row1.focus();
    expect(document.activeElement).toBe(row1);
    fireEvent.keyDown(row1, { key: 'ArrowDown' });
    const row2 = rowOf(/Cash \+ UPI/);
    expect(document.activeElement).toBe(row2);
  });

  it('ArrowUp on row 1 wraps to the last row', () => {
    renderChecklist();
    const row1 = rowOf('Photo ID + photocopy');
    row1.focus();
    fireEvent.keyDown(row1, { key: 'ArrowUp' });
    // Generic STARTER's last item:
    const last = rowOf(/One book, one notebook/);
    expect(document.activeElement).toBe(last);
  });

  it('Space toggles the focused row (done → undone)', () => {
    renderChecklist();
    // Initial: 5 left
    expect(screen.getByText(/Checklist · 5 left/)).toBeInTheDocument();
    const li = rowOf('Photo ID + photocopy');
    li.focus();
    fireEvent.keyDown(li, { key: ' ' });
    expect(screen.getByText(/Checklist · 4 left/)).toBeInTheDocument();
    fireEvent.keyDown(li, { key: ' ' });
    expect(screen.getByText(/Checklist · 5 left/)).toBeInTheDocument();
  });

  it('Enter also toggles the focused row', () => {
    renderChecklist();
    const li = rowOf(/Cash \+ UPI/);
    li.focus();
    fireEvent.keyDown(li, { key: 'Enter' });
    expect(screen.getByText(/Checklist · 4 left/)).toBeInTheDocument();
  });

  it('Delete removes the focused row and shifts focus to the previous neighbour', async () => {
    renderChecklist();
    const row2 = rowOf(/Cash \+ UPI/);
    row2.focus();
    await act(async () => {
      fireEvent.keyDown(row2, { key: 'Delete' });
      // Let the requestAnimationFrame in the handler tick. jsdom's rAF
      // schedules a microtask; flush it explicitly.
      await new Promise((r) => window.requestAnimationFrame(() => r(undefined)));
    });
    // Item gone from the LIST (the AE129 undo snackbar still references it).
    const list = screen.getByRole('list');
    expect(within(list).queryByText(/Cash \+ UPI/)).not.toBeInTheDocument();
    expect(screen.getByText(/Checklist · 4 left/)).toBeInTheDocument();
    // Focus should have moved to row 1 (previous neighbour).
    const row1 = rowOf('Photo ID + photocopy');
    expect(document.activeElement).toBe(row1);
  });

  it('Backspace mirrors Delete', async () => {
    renderChecklist();
    const target = rowOf(/Power bank/);
    target.focus();
    await act(async () => {
      fireEvent.keyDown(target, { key: 'Backspace' });
      await new Promise((r) => window.requestAnimationFrame(() => r(undefined)));
    });
    const list = screen.getByRole('list');
    expect(within(list).queryByText(/Power bank/)).not.toBeInTheDocument();
  });

  // ─── AE129: undo snackbar after Delete ────────────────────────────
  it('shows an undo snackbar after Delete and restores on click', async () => {
    renderChecklist();
    const row = rowOf('Photo ID + photocopy');
    row.focus();
    await act(async () => {
      fireEvent.keyDown(row, { key: 'Delete' });
      await new Promise((r) => window.requestAnimationFrame(() => r(undefined)));
    });
    // Snackbar is announced via role=status; "Undo" button visible
    const undoBtn = screen.getByRole('button', { name: /Restore "Photo ID \+ photocopy"/ });
    expect(undoBtn).toBeInTheDocument();
    // Item gone from the LIST
    const listAfterRemove = screen.getByRole('list');
    expect(within(listAfterRemove).queryByText('Photo ID + photocopy')).not.toBeInTheDocument();
    // Click undo → row returns
    fireEvent.click(undoBtn);
    const listAfterUndo = screen.getByRole('list');
    expect(within(listAfterUndo).getByText('Photo ID + photocopy')).toBeInTheDocument();
    expect(screen.getByText(/Checklist · 5 left/)).toBeInTheDocument();
  });
});
