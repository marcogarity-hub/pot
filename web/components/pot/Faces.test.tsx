import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Faces, FaceDot, initialOf } from './Faces';

describe('initialOf', () => {
  it('prefers the name, then the email, then the seat number', () => {
    expect(initialOf({ seat: 2, name: 'maya', email: 'z@x.co' })).toBe('M');
    expect(initialOf({ seat: 2, name: null, email: 'jon@x.co' })).toBe('J');
    expect(initialOf({ seat: 4, name: ' ', email: null })).toBe('4');
  });
  it('skips leading symbols and handles non-Latin letters', () => {
    expect(initialOf({ seat: 1, name: '"Priya"' })).toBe('P');
    expect(initialOf({ seat: 1, name: 'élodie' })).toBe('É');
  });
});

describe('Faces', () => {
  const faces = [
    { seat: 1, name: 'Marco', paid: true },
    { seat: 2, name: 'Maya', paid: true },
    { seat: 3, name: 'Theo', paid: false },
  ];
  it('announces paid over total as one picture', () => {
    render(<Faces faces={faces} />);
    expect(screen.getByRole('img', { name: '2 of 3 paid' })).toBeInTheDocument();
  });
  it('shows a check badge only for paid faces when asked', () => {
    const { container, rerender } = render(<FaceDot face={faces[0]} showCheck />);
    expect(container.querySelector('svg')).not.toBeNull();
    rerender(<FaceDot face={faces[2]} showCheck />);
    expect(container.querySelector('svg')).toBeNull();
  });
  it('draws unpaid friends dashed and paid friends filled', () => {
    const { container, rerender } = render(<FaceDot face={faces[2]} />);
    expect(container.firstElementChild?.firstElementChild?.className).toMatch(/border-dashed/);
    rerender(<FaceDot face={faces[0]} />);
    expect((container.firstElementChild?.firstElementChild as HTMLElement).style.background).toContain('--face-1');
  });
  it('collapses a big group into a +N chip but still announces everyone', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ seat: i + 1, name: `P${i}`, paid: i < 3 }));
    render(<Faces faces={many} max={6} />);
    expect(screen.getByRole('img', { name: '3 of 8 paid' })).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
  });
});
