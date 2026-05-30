/**
 * Vitest jsdom render spec for <AetherMark/> (AE84). The wordmark
 * is a critical visual element + accessibility surface (it ships
 * the brand title), so the assertions guard:
 *   - size prop drives both width + height
 *   - title prop becomes the aria-label + <title> element
 *   - default fill is currentColor (inheritance from parent)
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AetherMark } from '../../src/components/aether/aether-mark';

describe('<AetherMark/>', () => {
  it('renders with the default size + title', () => {
    render(<AetherMark />);
    const svg = screen.getByRole('img', { name: 'Aether' });
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '18');
    expect(svg).toHaveAttribute('height', '18');
  });

  it('honors the size prop', () => {
    render(<AetherMark size={72} />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('width', '72');
    expect(svg).toHaveAttribute('height', '72');
  });

  it('uses the supplied title as aria-label and <title>', () => {
    render(<AetherMark title="My Aether Mark" />);
    const svg = screen.getByRole('img', { name: 'My Aether Mark' });
    expect(svg).toBeInTheDocument();
    // SVG's <title> child is the accessible-name source.
    expect(svg.querySelector('title')?.textContent).toBe('My Aether Mark');
  });

  it('inherits fill via currentColor by default', () => {
    render(<AetherMark />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('fill', 'currentColor');
  });

  it('renders the four glyph shapes (outer ring + bindu + tail + inner dot)', () => {
    render(<AetherMark />);
    const svg = screen.getByRole('img');
    // 3 circles (outer ring + chandrabindu + inner dot) + 1 path (tail).
    expect(svg.querySelectorAll('circle').length).toBe(3);
    expect(svg.querySelectorAll('path').length).toBe(1);
  });
});
