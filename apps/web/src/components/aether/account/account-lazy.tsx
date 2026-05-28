'use client';

import dynamic from 'next/dynamic';

const AccountShell = dynamic(async () => (await import('./account-shell')).AccountShell, {
  ssr: false,
});

export function AccountLazy(): React.ReactElement {
  return <AccountShell />;
}
