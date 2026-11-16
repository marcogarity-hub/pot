import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemberCells, type CellMember } from './MemberCells';

afterEach(() => cleanup());

const member = (over: Partial<CellMember> = {}): CellMember => ({ has_paid: false, has_refunded: false, active: true, ...over });

describe('MemberCells', () => {
  it('labels the count of paid active members in text', () => {
    render(<MemberCells members={[
      member({ has_paid: true }),
      member(),
      member({ has_paid: true, has_refunded: true }),
    ]} />);
    expect(screen.getByRole('img', { name: '1 of 3 paid' })).toBeInTheDocument();
  });

  it('draws one square per active member and leaves out inactive seats', () => {
    const { container } = render(<MemberCells members={[
      member({ has_paid: true }),
      member(),
      member({ active: false, has_paid: true }),
    ]} />);
    const cells = container.querySelectorAll('span[aria-hidden]');
    expect(cells).toHaveLength(2);
    expect(screen.getByRole('img', { name: '1 of 2 paid' })).toBeInTheDocument();
  });

  it('fills paid cells in primary and leaves unpaid cells as outlines', () => {
    const { container } = render(<MemberCells members={[member({ has_paid: true }), member()]} />);
    const [paid, unpaid] = Array.from(container.querySelectorAll('span[aria-hidden]'));
    expect(paid).toHaveClass('bg-primary');
    expect(unpaid).not.toHaveClass('bg-primary');
    expect(unpaid).toHaveClass('border-input');
  });

  it('marks a refunded member as not paid', () => {
    const { container } = render(<MemberCells members={[member({ has_paid: true, has_refunded: true })]} />);
    expect(screen.getByRole('img', { name: '0 of 1 paid' })).toBeInTheDocument();
    expect(container.querySelector('span[aria-hidden]')).not.toHaveClass('bg-primary');
  });

  it('renders an empty grid for a pot with no active members', () => {
    render(<MemberCells members={[]} />);
    expect(screen.getByRole('img', { name: '0 of 0 paid' })).toBeInTheDocument();
  });
});
