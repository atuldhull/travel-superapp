/**
 * Vitest jsdom spec for <TripChecklist/> (AE103).
 *
 * Wrapped in <AetherProvider/> so theme hooks resolve. Asserts:
 *   - Starter items render on first mount
 *   - Toggling an item updates the "N left" count
 *   - Adding a custom item appends + clears the input
 *   - Removing an item drops it
 *   - localStorage gets a JSON.stringify of the current items list
 *     under the versioned key
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AetherProvider } from '@app/aether-core';
import { theme } from '@app/aether-motion';
import { TripChecklist } from '../../src/components/aether/journey/trip-checklist';

const TRIP_ID = 'trip-test-1';
const KEY = `aether-checklist:${TRIP_ID}:v1`;

function renderChecklist(): void {
  render(
    <AetherProvider premiumTier={null} audioOptOut={false} theme={theme}>
      <TripChecklist tripId={TRIP_ID} />
    </AetherProvider>,
  );
}

describe('<TripChecklist/>', () => {
  beforeEach(() => {
    window.localStorage.removeItem(KEY);
  });
  afterEach(() => {
    window.localStorage.removeItem(KEY);
  });

  it('renders the 5 starter items on first mount', () => {
    renderChecklist();
    expect(screen.getByText('Photo ID + photocopy')).toBeInTheDocument();
    expect(screen.getByText(/Cash \+ UPI/)).toBeInTheDocument();
    expect(screen.getByText(/Power bank/)).toBeInTheDocument();
    expect(screen.getByText(/long sleeve/)).toBeInTheDocument();
    expect(screen.getByText(/One book, one notebook/)).toBeInTheDocument();
  });

  it('opens with N=5 remaining and decrements when an item is checked', () => {
    renderChecklist();
    expect(screen.getByText(/Checklist · 5 left/)).toBeInTheDocument();
    // Toggle the first checkbox.
    const checkbox = screen.getByLabelText(/Mark "Photo ID \+ photocopy" as done/);
    fireEvent.click(checkbox);
    expect(screen.getByText(/Checklist · 4 left/)).toBeInTheDocument();
  });

  it('appends a custom item when the form is submitted', () => {
    renderChecklist();
    const input = screen.getByLabelText('Add a checklist item') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Sunscreen' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Sunscreen')).toBeInTheDocument();
    expect(input.value).toBe('');
    expect(screen.getByText(/Checklist · 6 left/)).toBeInTheDocument();
  });

  it('removes an item via the × button', () => {
    renderChecklist();
    const removeBtn = screen.getByLabelText('Remove "Photo ID + photocopy" from the list');
    fireEvent.click(removeBtn);
    expect(screen.queryByText('Photo ID + photocopy')).not.toBeInTheDocument();
    expect(screen.getByText(/Checklist · 4 left/)).toBeInTheDocument();
  });

  it('persists the current list to localStorage under the versioned key', () => {
    renderChecklist();
    // Trigger any write by toggling.
    fireEvent.click(screen.getByLabelText(/Mark "One book, one notebook" as done/));
    const raw = window.localStorage.getItem(KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? '[]') as Array<{ text: string; done: boolean }>;
    const notebook = parsed.find((it) => it.text === 'One book, one notebook');
    expect(notebook?.done).toBe(true);
  });

  it('reset-to-starter restores the 5 default items', () => {
    renderChecklist();
    fireEvent.click(screen.getByLabelText('Remove "Photo ID + photocopy" from the list'));
    fireEvent.click(screen.getByRole('button', { name: 'reset to starter' }));
    expect(screen.getByText('Photo ID + photocopy')).toBeInTheDocument();
    const list = screen.getByRole('list') ?? document.querySelector('ul');
    expect(within(list as HTMLElement).getAllByRole('checkbox').length).toBe(5);
  });
});
