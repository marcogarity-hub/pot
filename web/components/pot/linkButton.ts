import { cn } from 'cn';
import type { VariantProps } from 'class-variance-authority';
import { buttonVariants } from '@/components/ui/button';

/** Button styling for <Link>. Runs through cn() like <Button> so variant classes win conflicts. */
export const linkButton = ({ className, ...variants }: VariantProps<typeof buttonVariants> & { className?: string } = {}) =>
  cn(buttonVariants(variants), className);
