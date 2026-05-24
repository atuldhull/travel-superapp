/**
 * RTL + axe component tests for `<Badge>` ([I5]).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Badge } from '../../src/components/ui/badge';

describe('<Badge> (component)', () => {
  it('renders the children inside an inline element', () => {
    render(<Badge>draft</Badge>);
    expect(screen.getByText('draft')).toBeInTheDocument();
  });

  it.each(['neutral', 'brand', 'danger', 'gold', 'success'] as const)(
    'variant %s renders without throwing',
    (variant) => {
      render(<Badge variant={variant}>{variant}</Badge>);
      expect(screen.getByText(variant)).toBeInTheDocument();
    },
  );

  it('honors a className override (composition test)', () => {
    render(
      <Badge className="custom-class" variant="brand">
        x
      </Badge>,
    );
    expect(screen.getByText('x').className).toContain('custom-class');
  });

  it('has no axe a11y violations', async () => {
    const { container } = render(<Badge variant="brand">published</Badge>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
