/**
 * V.UX.39 — dynamic OG image for memory books at
 * `/og/memory-book/:id`. Renders a 1200x630 PNG via @vercel/og's
 * Edge runtime. Falls back to a generic card if the api fetch
 * fails.
 *
 * @vercel/og uses Satori under the hood — JSX-in-Workers. Inline
 * styles only; no Tailwind.
 */
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface PublicMemoryBook {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string | null;
  readonly description?: string | null;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<ImageResponse> {
  const { id } = await context.params;
  let book: PublicMemoryBook | null = null;
  try {
    const res = await fetch(`${API_BASE}/api/v1/memory-books/public/${id}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const body = (await res.json()) as { book?: PublicMemoryBook };
      book = body.book ?? null;
    }
  } catch {
    book = null;
  }

  const title = book?.title ?? 'Memory book';
  const subtitle = book?.subtitle ?? book?.description ?? 'Travel stories on TravelSuperApp';

  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '60px',
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          style={{
            fontSize: 36,
            fontWeight: 700,
            background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          ✈ TravelSuperApp
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ fontSize: 80, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
          {title.length > 60 ? `${title.slice(0, 60)}…` : title}
        </div>
        <div style={{ fontSize: 32, color: '#cbd5e1', maxWidth: 1000 }}>
          {subtitle.length > 120 ? `${subtitle.slice(0, 120)}…` : subtitle}
        </div>
      </div>
      <div style={{ fontSize: 22, color: '#64748b', display: 'flex' }}>
        travelsuperapp · memory book
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
