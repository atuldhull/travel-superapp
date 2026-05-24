/**
 * RTL + axe component tests for `<Input>`, `<Field>`, and
 * `<FloatingField>` ([K2]).
 *
 * Form primitives are the highest-leverage a11y targets in the
 * stack — every page that takes user data hits these components.
 * Tests target the public contract: labels point at inputs,
 * help/error text renders in the right slot, refs forward.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import { Input, Field, FloatingField } from '../../src/components/ui/input';

describe('<Input> (component)', () => {
  it('renders an <input> + forwards extra HTML attrs', () => {
    render(<Input placeholder="email" type="email" />);
    const input = screen.getByPlaceholderText('email') as HTMLInputElement;
    expect(input.type).toBe('email');
  });

  it('forwardRef exposes the underlying <input>', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} placeholder="x" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('user typing fires onChange', async () => {
    const onChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
      capture.value = event.target.value;
    };
    const capture = { value: '' };
    render(<Input placeholder="x" onChange={onChange} />);
    await userEvent.type(screen.getByPlaceholderText('x'), 'abc');
    expect(capture.value).toBe('abc');
  });
});

describe('<Field> (component)', () => {
  it('label points at the input via htmlFor + id (a11y core)', () => {
    render(<Field label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input.tagName).toBe('INPUT');
  });

  it('renders help text when no error', () => {
    render(<Field label="Email" help="we never share it" />);
    expect(screen.getByText('we never share it')).toBeInTheDocument();
  });

  it('error replaces help (precedence)', () => {
    render(<Field label="Email" help="we never share it" error="bad email" />);
    expect(screen.getByText('bad email')).toBeInTheDocument();
    expect(screen.queryByText('we never share it')).not.toBeInTheDocument();
  });

  it('caller-supplied id wins over the autogen one', () => {
    render(<Field label="Email" id="custom-id" />);
    expect(screen.getByLabelText('Email').id).toBe('custom-id');
  });

  it('no axe violations with help', async () => {
    const { container } = render(<Field label="Email" help="optional" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('no axe violations with error', async () => {
    const { container } = render(<Field label="Email" error="invalid" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('<FloatingField> (component)', () => {
  it('label is associated with the input', () => {
    render(<FloatingField label="Name" />);
    expect(screen.getByLabelText('Name').tagName).toBe('INPUT');
  });

  it('renders error slot when set', () => {
    render(<FloatingField label="Name" error="required" />);
    expect(screen.getByText('required')).toBeInTheDocument();
  });

  it('no axe violations', async () => {
    const { container } = render(<FloatingField label="Name" help="given name" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
