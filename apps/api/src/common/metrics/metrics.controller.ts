/**
 * `GET /metrics` — Prometheus scrape endpoint.
 *
 * `@Public()` because Prometheus scrapers don't carry user JWTs.
 * In a hardened deploy, network-level controls (k8s NetworkPolicy,
 * VPC SG, or a sidecar) gate this — the route stays public from
 * the app's POV but only the prom scraper can reach the port.
 *
 * Returns text-format per the prom-client default content-type
 * (`text/plain; version=0.0.4; charset=utf-8`).
 *
 * Installed by prompt [IV.18.10.6].
 */
import { Controller, Get, Header, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Public } from '../auth';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async scrape(@Res() reply: FastifyReply): Promise<void> {
    const body = await this.metrics.render();
    reply.header('content-type', this.metrics.contentType()).send(body);
  }
}
