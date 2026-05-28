'use client';

/**
 * Hero scroll indicator — a small chevron + label at the bottom of
 * the hero, gently breathing. Fades out after the first scroll so it
 * doesn't compete on subsequent sections.
 */
import { useEffect, useState } from 'react';
import { useMotionPolicy, useTheme } from '@app/aether-core';

export function ScrollIndicator(): React.ReactElement | null {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();
  const [visible, setVisible] = useState<boolean>(true);

  useEffect(() => {
    const onScroll = (): void => {
      if (window.scrollY > 60) setVisible(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (motionPolicy === 'none') return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: '50%',
        bottom: theme.space.gutter,
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        color: theme.color.surface.base,
        opacity: visible ? 0.78 : 0,
        transition: 'opacity 500ms cubic-bezier(0.42, 0, 0.18, 1)',
        pointerEvents: 'none',
        animation: motionPolicy === 'full' ? 'aether-breathe 3.6s ease-in-out infinite' : 'none',
      }}
    >
      <span
        style={{
          fontFamily: theme.font.ui,
          fontSize: 10,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
        }}
      >
        Scroll
      </span>
      <svg width="14" height="22" viewBox="0 0 14 22" fill="none" aria-hidden>
        <rect x="0.5" y="0.5" width="13" height="21" rx="6.5" stroke="currentColor" />
        <circle cx="7" cy="7" r="1.6" fill="currentColor" />
      </svg>
      <style>{`
        @keyframes aether-breathe {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(6px); }
        }
      `}</style>
    </div>
  );
}
