'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useMe } from '@/components/pot/useMe';
import { Button } from '@/components/ui/button';

/** Your wallet address with a copy button, and what the money is. Crypto words belong here and in Details. */
export function WalletSection() {
  const { me, loading, retry } = useMe();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copy(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-[22px] font-semibold">Wallet</h2>
      {loading && <p role="status" className="text-[15px] text-muted-foreground">Loading your wallet…</p>}
      {!loading && me?.kind === 'ready' && (
        <div className="space-y-4 rounded-group bg-card p-5">
          <div className="space-y-1">
            <p className="text-[13px] text-muted-foreground">Wallet address</p>
            <p className="break-all font-mono text-[15px]">{me.wallet_address}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => copy(me.wallet_address)}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? 'Copied' : 'Copy address'}
            </Button>
            {copyFailed && <p role="status" className="text-[15px] text-muted-foreground">Copying did not work. Select the address and copy it.</p>}
          </div>
        </div>
      )}
      {!loading && me?.kind === 'no-wallet' && (
        <p className="text-[15px] text-muted-foreground">Your wallet is set up the first time you join or start a pot.</p>
      )}
      {!loading && me && (me.kind === 'error' || me.kind === 'signed-out') && (
        <div className="space-y-3">
          <p role="alert" className="text-[15px]">We could not load your wallet.</p>
          <Button variant="outline" onClick={retry}>Try again</Button>
        </div>
      )}
      <div className="space-y-2 text-[15px]">
        <p>Your money is held in USDC on Arc.</p>
        <p className="text-muted-foreground">This is test money, not real dollars.</p>
      </div>
    </div>
  );
}
