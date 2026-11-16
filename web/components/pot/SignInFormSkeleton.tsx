import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseOAuthProviders } from './auth';
import { OAuthButtons } from './OAuthButtons';

/**
 * Non-interactive placeholder shown until searchParams resolve. It must not submit:
 * a submit before `next` is known would send the magic link with the wrong redirect.
 * It mirrors the loaded form (provider buttons, email field, submit, note) so the module does not jump.
 */
export function SignInFormSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading sign-in form" className="space-y-4">
      <OAuthButtons providers={parseOAuthProviders(process.env.NEXT_PUBLIC_AUTH_PROVIDERS)} busy />
      <div className="space-y-2">
        <Label htmlFor="email-loading">Email</Label>
        <Input id="email-loading" type="email" disabled placeholder="Loading…" />
      </div>
      <Button type="button" size="lg" className="w-full" disabled>Email me a sign-in link</Button>
      <p className="text-sm text-muted-foreground">No password. We email you a sign-in code and a link.</p>
    </div>
  );
}
