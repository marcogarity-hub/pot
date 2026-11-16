import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Non-interactive placeholder shown until searchParams resolve. It must not submit:
 * a submit before `next` is known would send the magic link with the wrong redirect.
 */
export function SignInFormSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading sign-in form" className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email-loading">Email</Label>
        <Input id="email-loading" type="email" disabled placeholder="Loading…" />
      </div>
      <Button type="button" className="w-full" disabled>Email me a sign-in link</Button>
    </div>
  );
}
