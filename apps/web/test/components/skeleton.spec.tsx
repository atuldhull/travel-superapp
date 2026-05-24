/**
 * RTL + axe tests for `<Skeleton>` / `<SkeletonList>` / `<SkeletonCard>` ([K2]).
 *
 * Key a11y assertion: every variant must be `aria-hidden` so screen
 * readers don't read the shimmer placeholders as content.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Skeleton, SkeletonCard, SkeletonList } from '../../src/components/ui/skeleton';

describe('<Skeleton> (component)', () => {
  it('renders 1 bar by default', () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelectorAll('.shimmer').length).toBe(1);
  });

  it('count=N renders N bars', () => {
    const { container } = render(<Skeleton count={4} />);
    expect(container.querySelectorAll('.shimmer').length).toBe(4);
  });

  it('outer container is aria-hidden', () => {
    const { container } = render(<Skeleton />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('<SkeletonList> (component)', () => {
  it('default 3 rows', () => {
    const { container } = render(<SkeletonList />);
    expect(container.querySelectorAll('li').length).toBe(3);
  });

  it('custom rows count', () => {
    const { container } = render(<SkeletonList rows={6} />);
    expect(container.querySelectorAll('li').length).toBe(6);
  });

  it('the <ul> is aria-hidden', () => {
    const { container } = render(<SkeletonList />);
    const ul = container.querySelector('ul');
    expect(ul?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('<SkeletonCard> (component)', () => {
  it('default 1 card', () => {
    const { container } = render(<SkeletonCard />);
    // Card containers are direct children of the aria-hidden grid div.
    const grid = container.firstChild as HTMLElement;
    expect(grid.children.length).toBe(1);
  });

  it('count=N renders N cards', () => {
    const { container } = render(<SkeletonCard count={5} />);
    expect((container.firstChild as HTMLElement).children.length).toBe(5);
  });

  it('outer grid is aria-hidden', () => {
    const { container } = render(<SkeletonCard count={2} />);
    expect((container.firstChild as HTMLElement).getAttribute('aria-hidden')).toBe('true');
  });
});

describe('skeletons — a11y (axe)', () => {
  it('Skeleton has no violations', async () => {
    const { container } = render(<Skeleton count={3} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('SkeletonList has no violations', async () => {
    const { container } = render(<SkeletonList rows={3} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('SkeletonCard has no violations', async () => {
    const { container } = render(<SkeletonCard count={2} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
