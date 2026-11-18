import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';

afterEach(() => cleanup());

const faces = [
  { seat: 1, name: 'Ana', email: null, paid: true },
  { seat: 2, name: 'Bo', email: null, paid: false },
];

describe('ProgressBar', () => {
  it('shows the money in and the total in dollars, with the paid count as text', () => {
    render(<ProgressBar paidCount={1} memberCount={2} collected="$840" total="$1,260" faces={faces} />);
    expect(screen.getByText('$840')).toBeInTheDocument();
    expect(screen.getByText('of $1,260')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 paid')).toHaveClass('money');
    expect(screen.getByRole('img', { name: '1 of 2 paid' })).toBeInTheDocument();
  });

  it('renders the footer slot next to the member strip', () => {
    render(<ProgressBar paidCount={0} memberCount={2} collected="$0" total="$1,260" faces={faces} footer={<p>FOOTER</p>} />);
    expect(screen.getByText('FOOTER')).toBeInTheDocument();
  });
});
