/**
 * v2 value pillars — the app's REAL features (not fake "VIP concierge"
 * claims). Server component.
 */
import { BookOpen, CloudSun, ShieldCheck, Sparkles } from 'lucide-react';

const PILLARS = [
  { icon: Sparkles, title: 'AI Itineraries', body: 'A full day-by-day plan, written in seconds.' },
  {
    icon: ShieldCheck,
    title: 'Live Safety & SOS',
    body: 'Scam alerts, crime layers, one-tap SOS.',
  },
  { icon: BookOpen, title: 'Memory Books', body: 'Your trip becomes a keepsake, automatically.' },
  { icon: CloudSun, title: 'Crowd & Weather Watch', body: 'We track conditions while you travel.' },
] as const;

export function V2ValuePillars(): React.ReactElement {
  return (
    <div className="border-b border-gold-600/10 bg-surface">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        {PILLARS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex items-start gap-3.5">
            <span className="mt-0.5 inline-flex shrink-0 rounded-xl bg-gold-500/12 p-2.5 text-gold-600 dark:text-gold-400">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-surface-foreground">{title}</p>
              <p className="mt-0.5 text-sm leading-snug text-muted">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
