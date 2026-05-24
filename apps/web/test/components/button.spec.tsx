/**
 * RTL + axe component tests for `<Button>` ([I5]).
 *
 * Covers the public contract of the Button primitive:
 *   - default render + text content
 *   - every variant + size combination renders without throwing
 *   - `loading` sets aria-busy + disables clicks
 *   - `disabled` blocks the onClick handler
 *   - `forwardRef` exposes the underlying <button>
 *   - axe-core finds no a11y violations on the default render
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import { Button } from '../../src/components/ui/button';

describe('<Button> (component)', () => {
  it('renders the children inside a <button> with type=button by default', () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('fires onClick when not disabled', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled blocks the click handler', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('loading sets aria-busy + disables interaction', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Saving' });
    expect(btn).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each(['primary', 'secondary', 'outline', 'ghost', 'danger', 'royal'] as const)(
    'variant %s renders without throwing',
    (variant) => {
      render(<Button variant={variant}>{variant}</Button>);
      expect(screen.getByRole('button', { name: variant })).toBeInTheDocument();
    },
  );

  it.each(['sm', 'md', 'lg'] as const)('size %s renders without throwing', (size) => {
    render(<Button size={size}>{size}</Button>);
    expect(screen.getByRole('button', { name: size })).toBeInTheDocument();
  });

  it('forwardRef exposes the underlying <button>', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>x</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('has no axe-core a11y violations (default)', async () => {
    const { container } = render(<Button>Save</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe-core a11y violations (loading + disabled)', async () => {
    const { container } = render(
      <Button loading disabled>
        Saving
      </Button>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
