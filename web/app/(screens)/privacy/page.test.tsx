import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function renderPage() {
  const { default: PrivacyPage } = await import('./page');
  render(<PrivacyPage />);
}

describe('PrivacyPage', () => {
  it('explains what is collected, what is public and who handles it', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy' })).toBeInTheDocument();
    for (const heading of [/what we collect/i, /how we use it/i, /what is public/i, /who handles it/i, /deleting your data/i]) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText(/test network/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to pot/i })).toHaveAttribute('href', '/');
  });

  it('points deletion requests at GitHub when no contact email is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONTACT_EMAIL', '');
    await renderPage();
    expect(screen.getByText(/open an issue on the project's GitHub page/i)).toBeInTheDocument();
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('shows the contact email when one is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONTACT_EMAIL', ' help@example.com ');
    await renderPage();
    expect(screen.getByRole('link', { name: 'help@example.com' })).toHaveAttribute('href', 'mailto:help@example.com');
  });
});
