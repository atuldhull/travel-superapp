'use client';

import dynamic from 'next/dynamic';

const SharedShell = dynamic(async () => (await import('./shared-shell')).SharedShell, {
  ssr: false,
});

export function SharedLazy({ code }: { readonly code: string }): React.ReactElement {
  return <SharedShell code={code} />;
}
