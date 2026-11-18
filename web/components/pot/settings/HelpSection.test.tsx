import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HELP_FAQ } from '@/lib/help/content';
import { HelpSection } from './HelpSection';

afterEach(cleanup);

describe('HelpSection', () => {
  it('explains the blockchain in plain words and lists the questions collapsed', () => {
    render(<HelpSection />);
    expect(screen.getByRole('heading', { name: 'Splitting costs with Pot' })).toBeInTheDocument();
    expect(screen.getByText(/shared public record/i)).toBeInTheDocument();
    for (const { question } of HELP_FAQ) {
      expect(screen.getByRole('button', { name: question })).toHaveAttribute('aria-expanded', 'false');
    }
  });
  it('drops the title and keeps the subheadings in order when the page supplies its own h1', () => {
    render(<HelpSection hideHeading />);
    expect(screen.queryByRole('heading', { name: 'Splitting costs with Pot' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Where your money goes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Common questions' })).toBeInTheDocument();
  });
  it('opens one answer at a time', () => {
    render(<HelpSection />);
    const first = screen.getByRole('button', { name: HELP_FAQ[0].question });
    const second = screen.getByRole('button', { name: HELP_FAQ[1].question });
    fireEvent.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(HELP_FAQ[0].answer)).toBeVisible();
    fireEvent.click(second);
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(second).toHaveAttribute('aria-expanded', 'true');
  });
});
