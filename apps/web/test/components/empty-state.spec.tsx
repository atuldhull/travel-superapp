/**
 * RTL + axe component tests for `<EmptyState>` ([I5]).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { EmptyState } from '../../src/components/ui/empty-state';

describe('<EmptyState> (component)', () => {
  it('renders the title as an h2', () => {
    render(<EmptyState title="No trips yet" />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('No trips yet');
  });

  it('renders the body paragraph when provided', () => {
    render(<EmptyState title="x" body="Plan your first one." />);
    expect(screen.getByText('Plan your first one.')).toBeInTheDocument();
  });

  it('omits the body when missing', () => {
    render(<EmptyState title="x" />);
    expect(screen.queryByText(/Plan your first/)).not.toBeInTheDocument();
  });

  it('renders the CTA as a link', () => {
    render(<EmptyState title="x" cta={{ href: '/trips/new' as never, label: 'New trip →' }} />);
    const link = screen.getByRole('link', { name: /New trip/ });
    expect(link).toHaveAttribute('href', '/trips/new');
  });

  it('omits the CTA when missing', () => {
    render(<EmptyState title="x" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('default emoji ✨ is rendered when neither icon nor emoji is provided', () => {
    render(<EmptyState title="x" />);
    expect(screen.getByText('✨')).toBeInTheDocument();
  });

  it('icon takes precedence over emoji', () => {
    render(<EmptyState title="x" emoji="📦" icon={<span data-testid="icon">!</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.queryByText('📦')).not.toBeInTheDocument();
  });

  it('has no axe a11y violations (with CTA + body)', async () => {
    const { container } = render(
      <EmptyState
        title="No trips yet"
        body="Plan your first one — it takes about 30 seconds."
        emoji="🧳"
        cta={{ href: '/trips/new' as never, label: 'New trip →' }}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
