/**
 * Vitest jsdom spec for <KeyboardHelp/> (AE104). Asserts:
 *   - Initial render is null (no overlay visible).
 *   - Pressing '?' on window opens the dialog with role + aria-label.
 *   - Pressing Escape closes it.
 *   - Pressing '?' inside an INPUT does NOT open the overlay.
 *   - The shortcut rows render the four registered shortcuts.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AetherProvider } from '@app/aether-core';
import { theme } from '@app/aether-motion';
import { KeyboardHelp } from '../../src/components/aether/keyboard-help';

function renderHelp(extra?: React.ReactNode): void {
  render(
    <AetherProvider premiumTier={null} audioOptOut={false} theme={theme}>
      <KeyboardHelp />
      {extra}
    </AetherProvider>,
  );
}

describe('<KeyboardHelp/>', () => {
  it('renders nothing until "?" is pressed', () => {
    renderHelp();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on "?" with the canonical aria-label', () => {
    renderHelp();
    fireEvent.keyDown(window, { key: '?' });
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(dialog).toBeInTheDocument();
    // The 4 registered shortcuts render.
    expect(screen.getByText('Open Pulse · the AI drawer')).toBeInTheDocument();
    expect(screen.getByText('Close Pulse · this overlay')).toBeInTheDocument();
    expect(screen.getByText(/Slash commands inside Pulse/)).toBeInTheDocument();
    expect(screen.getByText(/Open this shortcut overlay/)).toBeInTheDocument();
  });

  it('closes on Escape after open', () => {
    renderHelp();
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.queryByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does NOT open when "?" is dispatched from an INPUT element', () => {
    renderHelp(<input aria-label="some input" />);
    const input = screen.getByLabelText('some input');
    input.focus();
    fireEvent.keyDown(input, { key: '?' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Close × button dismisses the overlay too', () => {
    renderHelp();
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.queryByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close shortcut overlay' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
