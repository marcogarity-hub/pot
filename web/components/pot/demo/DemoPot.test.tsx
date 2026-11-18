import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { buildDemo, findDemoPlan } from '@/lib/demo/data';
import { DemoFrame } from './DemoFrame';
import { DemoPot } from './DemoPot';

vi.mock('next/navigation', () => ({
  usePathname: () => '/demo',
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

afterEach(cleanup);

const demo = buildDemo(Date.now());

describe('DemoPot', () => {
  it('shows the pay action for a plan Alex still owes, and settles it without any network request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<DemoFrame history={demo.history} hideTabBar><DemoPot status={findDemoPlan(demo, 'lake-house')!} /></DemoFrame>);
    fireEvent.click(screen.getByRole('button', { name: 'Pay $600' }));
    expect(await screen.findByText('You’re in', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('shows the request form to Alex on a plan he organizes', () => {
    render(<DemoFrame history={demo.history} hideTabBar><DemoPot status={findDemoPlan(demo, 'whistler')!} /></DemoFrame>);
    expect(screen.getByLabelText('Receipt or booking reference')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request payout' })).toBeDisabled();
  });

  it('offers no action on a plan that is finished for Alex', () => {
    render(<DemoFrame history={demo.history} hideTabBar><DemoPot status={findDemoPlan(demo, 'camping-permits')!} /></DemoFrame>);
    expect(screen.queryByRole('group', { name: 'Plan actions' })).not.toBeInTheDocument();
  });
});

describe('DemoFrame', () => {
  it('says it is a demo and keeps the sidebar links inside it', () => {
    render(<DemoFrame history={[]}><p>Body</p></DemoFrame>);
    expect(screen.getByRole('note')).toHaveTextContent(/demo/i);
    const sections = screen.getByRole('navigation', { name: 'Sections' });
    const hrefs = Array.from(sections.querySelectorAll('a')).map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(['/demo', '/demo/history', '/demo/wallet', '/demo/help']);
    expect(screen.getByRole('link', { name: 'New plan' })).toHaveAttribute('href', '/demo/new');
  });

  it('has Exit demo instead of Log out, and a Profile that cannot be changed or signed out of', async () => {
    render(<DemoFrame history={[]}><p>Body</p></DemoFrame>);
    fireEvent.click(screen.getByRole('button', { name: /Alex/ }));
    expect(await screen.findByRole('button', { name: 'Exit demo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    expect(await screen.findByDisplayValue('Alex Morgan')).toHaveAttribute('readonly');
    expect(screen.getByText(/nothing here is saved/i)).toBeInTheDocument();
    expect(screen.queryByText('Security')).not.toBeInTheDocument();
  });
});
