/**
 * V.UX.37 — compliance retention dashboard. Aggregates 16 indexed
 * counts in parallel. Uses the same `DEFAULT_RETENTION_DAYS = 7`
 * constant the AccountPurgeScheduler uses, so the
 * "scheduled for purge" count matches what the next sweep tick
 * will actually delete.
 */
import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_RETENTION_DAYS } from '../../account';
import {
  COMPLIANCE_QUERIES_PORT,
  type ComplianceQueries,
  type RetentionStats,
} from './ports/compliance-queries.port';

@Injectable()
export class GetRetentionStatsUseCase {
  constructor(@Inject(COMPLIANCE_QUERIES_PORT) private readonly queries: ComplianceQueries) {}

  async execute(): Promise<RetentionStats> {
    return this.queries.getRetentionStats(DEFAULT_RETENTION_DAYS, new Date());
  }
}
