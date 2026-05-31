/** Vitest specs for AE406 <Phase2GenieModal>. */
// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Phase2GenieModal } from '../../src/components/aether/phase2/phase2-genie-modal';

describe('<Phase2GenieModal/>', () => {
  it('does not render when open=false', () => {
    render(<Phase2GenieModal open={false} />);
    expect(document.querySelector('[data-aether-genie-modal]')).toBeNull();
  });

  it('renders with role=dialog + aria-modal when open', () => {
    render(<Phase2GenieModal open />);
    const el = document.querySelector('[data-aether-genie-modal]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('role')).toBe('dialog');
    expect(el?.getAttribute('aria-modal')).toBe('true');
  });

  it('initialState pins headline copy', () => {
    render(<Phase2GenieModal open initialState="listening" />);
    const headline = document.querySelector('[data-aether-genie-headline]')?.textContent;
    expect(headline).toBe('Listening…');
  });

  it('mic button transitions idle → listening on pointerDown', () => {
    render(<Phase2GenieModal open initialState="idle" />);
    const mic = document.querySelector('[data-aether-genie-mic]') as HTMLButtonElement;
    fireEvent.pointerDown(mic);
    expect(
      document.querySelector('[data-aether-genie-modal]')?.getAttribute('data-aether-genie-state'),
    ).toBe('listening');
  });

  it('mic button transitions listening → processing on pointerUp', () => {
    render(<Phase2GenieModal open initialState="listening" />);
    const mic = document.querySelector('[data-aether-genie-mic]') as HTMLButtonElement;
    fireEvent.pointerUp(mic);
    expect(
      document.querySelector('[data-aether-genie-modal]')?.getAttribute('data-aether-genie-state'),
    ).toBe('processing');
  });

  it('Esc closes the modal via onClose', () => {
    const onClose = vi.fn();
    render(<Phase2GenieModal open onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('close button invokes onClose', () => {
    const onClose = vi.fn();
    render(<Phase2GenieModal open onClose={onClose} />);
    const closeBtn = document.querySelectorAll('button')[0] as HTMLButtonElement;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('onStateChange fires on transitions', () => {
    const onStateChange = vi.fn();
    render(<Phase2GenieModal open initialState="idle" onStateChange={onStateChange} />);
    const mic = document.querySelector('[data-aether-genie-mic]') as HTMLButtonElement;
    fireEvent.pointerDown(mic);
    expect(onStateChange).toHaveBeenCalledWith('listening');
  });

  it('transcript appears only in transcribed state', () => {
    const { rerender } = render(
      <Phase2GenieModal open initialState="listening" transcript="hello" />,
    );
    expect(document.querySelector('[data-aether-genie-transcript]')).toBeNull();
    rerender(<Phase2GenieModal open initialState="transcribed" transcript="hello" />);
    expect(document.querySelector('[data-aether-genie-transcript]')?.textContent).toContain(
      'hello',
    );
  });
});
