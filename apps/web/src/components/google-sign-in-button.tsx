/**
 * Google Identity Services (GIS) sign-in button. Loads the GIS
 * script lazily via next/script + renders Google's stock button
 * inside a div ref. Callback receives `{credential}` (the id_token),
 * which we hand to the typed `useAuthControllerOauth` mutation with
 * provider='google'.
 *
 * Behind `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. If the env var is missing
 * (e.g. a dev environment without Google OAuth set up), the button
 * renders nothing — the mock-provider button on /login stays as
 * the dev fallback.
 *
 * Installed by prompt [IV.18.19.42].
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useAuthControllerOauth, type AuthSuccessResponseDto } from '@app/sdk';
import { setAccessToken } from '../lib/auth-store';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

interface GsiCredentialResponse {
  readonly credential: string;
}

interface GsiInitConfig {
  readonly client_id: string;
  readonly callback: (resp: GsiCredentialResponse) => void;
  readonly auto_select?: boolean;
}

interface GsiButtonOptions {
  readonly type?: 'standard' | 'icon';
  readonly theme?: 'outline' | 'filled_blue' | 'filled_black';
  readonly size?: 'small' | 'medium' | 'large';
  readonly text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  readonly width?: number | string;
}

declare global {
  interface Window {
    readonly google?: {
      readonly accounts: {
        readonly id: {
          initialize: (config: GsiInitConfig) => void;
          renderButton: (parent: HTMLElement, options: GsiButtonOptions) => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  readonly onSignedIn?: () => void;
  readonly onError?: (msg: string) => void;
}

export function GoogleSignInButton({ onSignedIn, onError }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const oauthMutation = useAuthControllerOauth({
    mutation: {
      onSuccess: (response: { data?: unknown }) => {
        const body = response.data as AuthSuccessResponseDto;
        setAccessToken(body.accessToken);
        onSignedIn?.();
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        onError?.(e.message || 'Google sign-in failed.');
      },
    },
  });

  useEffect(() => {
    if (!scriptReady || !clientId || !containerRef.current || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (resp) => {
        if (!resp.credential) {
          onError?.('Google returned no credential.');
          return;
        }
        oauthMutation.mutate({
          provider: 'google',
          data: { idToken: resp.credential },
        });
      },
    });
    window.google.accounts.id.renderButton(containerRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      width: 280,
    });
    // Re-render when scriptReady or clientId changes — onError is a
    // stable reference passed by the parent.
  }, [scriptReady, clientId, oauthMutation, onError]);

  if (!clientId) return null;

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div ref={containerRef} aria-busy={oauthMutation.isPending} />
    </>
  );
}
