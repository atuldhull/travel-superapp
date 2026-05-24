/**
 * RTL + axe tests for `<Card>` and its sub-components ([K2]).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Card, CardBody, CardHeader, CardSubtitle, CardTitle } from '../../src/components/ui/card';

describe('<Card> (component)', () => {
  it('renders as a <div> by default with the children', () => {
    render(<Card>hi</Card>);
    expect(screen.getByText('hi')).toBeInTheDocument();
  });

  it.each(['flat', 'raised', 'floating'] as const)('depth %s renders', (depth) => {
    render(<Card depth={depth}>{depth}</Card>);
    expect(screen.getByText(depth)).toBeInTheDocument();
  });

  it('honors the `as` prop for semantic upgrades (e.g. <article>)', () => {
    render(
      <Card as="article" aria-label="trip-card">
        body
      </Card>,
    );
    const node = screen.getByLabelText('trip-card');
    expect(node.tagName).toBe('ARTICLE');
  });

  it('interactive adds cursor-pointer to the className', () => {
    render(
      <Card interactive aria-label="x">
        c
      </Card>,
    );
    expect(screen.getByLabelText('x').className).toMatch(/cursor-pointer/);
  });

  it('a className override composes onto the depth styles', () => {
    render(
      <Card className="custom-marker" aria-label="x">
        c
      </Card>,
    );
    expect(screen.getByLabelText('x').className).toContain('custom-marker');
  });
});

describe('<CardHeader/Title/Subtitle/Body> (sub-components)', () => {
  it('CardTitle renders an <h2>', () => {
    render(<CardTitle>title</CardTitle>);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('title');
  });

  it('CardHeader is a layout div (no semantic role)', () => {
    render(
      <CardHeader>
        <CardTitle>t</CardTitle>
      </CardHeader>,
    );
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('CardSubtitle + CardBody render their text', () => {
    render(
      <>
        <CardSubtitle>sub</CardSubtitle>
        <CardBody>body</CardBody>
      </>,
    );
    expect(screen.getByText('sub')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('a composed card has no axe violations', async () => {
    const { container } = render(
      <Card as="article" aria-label="trip">
        <CardHeader>
          <CardTitle>Paris</CardTitle>
          <CardSubtitle>4 days</CardSubtitle>
        </CardHeader>
        <CardBody>Itinerary text</CardBody>
      </Card>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
