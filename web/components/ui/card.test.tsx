import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CardTitle } from './card';

afterEach(() => cleanup());

describe('CardTitle', () => {
  it('renders as the heading level the page asks for', () => {
    render(<CardTitle as="h1">Sign in to Pot</CardTitle>);
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in to Pot' })).toBeInTheDocument();
  });
});
