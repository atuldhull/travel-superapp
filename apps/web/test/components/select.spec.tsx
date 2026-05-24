/**
 * RTL + axe tests for `<Select>` and `<SelectField>` ([K2]).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import { Select, SelectField } from '../../src/components/ui/select';

describe('<Select> (component)', () => {
  it('renders a native <select> with options', () => {
    render(
      <Select aria-label="kind">
        <option value="image">image</option>
        <option value="video">video</option>
      </Select>,
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('user selection fires onChange', async () => {
    const capture = { value: '' };
    const onChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
      capture.value = e.target.value;
    };
    render(
      <Select aria-label="kind" onChange={onChange} defaultValue="image">
        <option value="image">image</option>
        <option value="video">video</option>
      </Select>,
    );
    await userEvent.selectOptions(screen.getByRole('combobox'), 'video');
    expect(capture.value).toBe('video');
  });

  it('forwardRef exposes the underlying <select>', () => {
    const ref = createRef<HTMLSelectElement>();
    render(
      <Select ref={ref} aria-label="kind">
        <option value="x">x</option>
      </Select>,
    );
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });
});

describe('<SelectField> (component)', () => {
  it('label is associated with the select', () => {
    render(
      <SelectField label="Kind">
        <option value="image">image</option>
      </SelectField>,
    );
    expect(screen.getByLabelText('Kind').tagName).toBe('SELECT');
  });

  it('renders help below; error replaces help', () => {
    const { rerender } = render(
      <SelectField label="Kind" help="pick one">
        <option value="x">x</option>
      </SelectField>,
    );
    expect(screen.getByText('pick one')).toBeInTheDocument();

    rerender(
      <SelectField label="Kind" help="pick one" error="required">
        <option value="x">x</option>
      </SelectField>,
    );
    expect(screen.getByText('required')).toBeInTheDocument();
    expect(screen.queryByText('pick one')).not.toBeInTheDocument();
  });

  it('axe-clean', async () => {
    const { container } = render(
      <SelectField label="Kind" help="pick one">
        <option value="image">image</option>
        <option value="video">video</option>
      </SelectField>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
