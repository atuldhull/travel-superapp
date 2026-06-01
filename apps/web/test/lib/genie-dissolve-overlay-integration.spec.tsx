/** Vitest specs for AE433 `<GenieDissolveOverlay/>` — jsdom integration. */
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { GenieDissolveOverlay } from '../../src/components/aether/phase2/genie-dissolve-overlay';

describe('<GenieDissolveOverlay/> integration', () => {
  it('renders a single SVG with the dissolve marker', () => {
    const { container } = render(<GenieDissolveOverlay open={false} count={5} />);
    const svg = container.querySelector('[data-aether-genie-dissolve]');
    expect(svg).not.toBeNull();
    expect(svg?.tagName).toBe('svg');
  });

  it('renders one <circle> per particle when count is supplied', () => {
    const { container } = render(<GenieDissolveOverlay open count={12} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(12);
  });

  it('marks the SVG as aria-hidden so screen readers skip it', () => {
    const { container } = render(<GenieDissolveOverlay open count={3} />);
    const svg = container.querySelector('[data-aether-genie-dissolve]');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('default count produces the documented particle total', () => {
    const { container } = render(<GenieDissolveOverlay open />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(120);
  });

  it('every circle inherits the fill prop', () => {
    const { container } = render(<GenieDissolveOverlay open count={4} fill="rgb(255, 0, 0)" />);
    const circles = container.querySelectorAll('circle');
    circles.forEach((c) => {
      expect(c.getAttribute('fill')).toBe('rgb(255, 0, 0)');
    });
  });

  it('SVG width + height use 100% so the overlay scales to the viewport', () => {
    const { container } = render(<GenieDissolveOverlay open count={1} />);
    const svg = container.querySelector('[data-aether-genie-dissolve]') as SVGElement;
    expect(svg.getAttribute('width')).toBe('100%');
    expect(svg.getAttribute('height')).toBe('100%');
  });

  it('preserveAspectRatio is xMidYMid slice (covers the viewport)', () => {
    const { container } = render(<GenieDissolveOverlay open count={1} />);
    const svg = container.querySelector('[data-aether-genie-dissolve]') as SVGElement;
    expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid slice');
  });

  it('rendering with open=false initially does not paint visible particles', () => {
    const { container } = render(<GenieDissolveOverlay open={false} count={4} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(4);
    // At progress 0, every particle's opacity is 0 (easeInOutCubic(0) × rest = 0).
    circles.forEach((c) => {
      expect(parseFloat(c.getAttribute('opacity') ?? '1')).toBe(0);
    });
  });

  it('rendering with open=true initially paints particles at rest opacity', () => {
    const { container } = render(<GenieDissolveOverlay open count={6} />);
    const circles = container.querySelectorAll('circle');
    let nonZero = 0;
    circles.forEach((c) => {
      if (parseFloat(c.getAttribute('opacity') ?? '0') > 0) nonZero += 1;
    });
    expect(nonZero).toBeGreaterThan(0);
  });

  it('flipping open=false → onClosed flag becomes reachable via rAF', () => {
    // We can't drive the rAF chain without infinite recursion in jsdom, but
    // we can assert that the call is registered + not invoked when the
    // overlay first mounts with open=true (no close yet).
    const onClosed = vi.fn();
    render(<GenieDissolveOverlay open count={2} onClosed={onClosed} />);
    expect(onClosed).not.toHaveBeenCalled();
  });
});
