import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { linkButton } from '@/components/pot/linkButton';
import { Screen } from '@/components/pot/Screen';

export default function NotFound() {
  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle as="h1" className="font-heading text-xl">Page not found</CardTitle>
          <CardDescription>This page doesn&apos;t exist or has moved.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/" className={linkButton({ variant: 'outline' })}>Go home</Link>
        </CardContent>
      </Card>
    </Screen>
  );
}
