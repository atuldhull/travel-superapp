/**
 * Traffic provider that uses real TomTom flow when a key is
 * configured (and we're not in tests), else the deterministic mock.
 * Either way the use-case always gets a usable annotation — the
 * client just sees `trafficSource: 'live' | 'mock'` and labels it.
 *
 * Mirrors the env-gated optional-provider pattern used across the
 * codebase (POST.3/4/9 payments/AI/observability).
 *
 * Installed for the live-navigation feature.
 */
import { Injectable, Optional } from '@nestjs/common';
import { createLogger, type AppLogger } from '@app/logger';
import type {
  TrafficAnnotateInput,
  TrafficAnnotation,
  TrafficProvider,
} from '../application/ports/traffic-provider';
import { MockTrafficProvider } from './mock-traffic-provider';
import { TomTomTrafficProvider } from './tomtom-traffic-provider';

@Injectable()
export class CompositeTrafficProvider implements TrafficProvider {
  private readonly logger: AppLogger = createLogger('transport.traffic.composite');

  constructor(
    private readonly mock: MockTrafficProvider,
    @Optional() private readonly tomtom: TomTomTrafficProvider | null = null,
  ) {}

  async annotate(input: TrafficAnnotateInput): Promise<TrafficAnnotation> {
    if (!this.tomtom || process.env['NODE_ENV'] === 'test') {
      return this.mock.annotate(input);
    }
    try {
      return await this.tomtom.annotate(input);
    } catch {
      // TomTom already logged the cause; fall back to estimated.
      this.logger.warn({ routeId: input.routeId }, 'traffic_fallback_to_mock');
      return this.mock.annotate(input);
    }
  }
}
