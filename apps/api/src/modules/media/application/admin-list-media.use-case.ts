/**
 * Admin media moderation list. Cross-user (no owner scope) with
 * optional filters: `ownerId` (exact match — useful for "show me
 * everything user X uploaded"), `kind` (image | video), `status`
 * (processing | ready | failed — useful for spotting stuck
 * uploads or storage issues).
 *
 * Default limit 50, cap 200 — same shape as every other admin
 * list surface. Most-recent-first.
 *
 * Installed by prompt [IV.18.18.4].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { MediaKind, MediaStatus } from '../domain/media-asset.entity';
import {
  MEDIA_ASSET_REPOSITORY,
  type AdminMediaListResult,
  type MediaAssetRepository,
} from './ports/media-asset.repository';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface AdminListMediaCommand {
  readonly ownerId?: string;
  readonly kind?: MediaKind;
  readonly status?: MediaStatus;
  readonly limit?: number;
  readonly offset?: number;
}

@Injectable()
export class AdminListMediaUseCase {
  constructor(@Inject(MEDIA_ASSET_REPOSITORY) private readonly media: MediaAssetRepository) {}

  async execute(cmd: AdminListMediaCommand): Promise<AdminMediaListResult> {
    const limit =
      cmd.limit === undefined
        ? DEFAULT_LIMIT
        : Math.max(1, Math.min(MAX_LIMIT, Math.floor(cmd.limit)));
    const offset = cmd.offset === undefined ? 0 : Math.max(0, Math.floor(cmd.offset));
    return this.media.adminList({
      ...(cmd.ownerId !== undefined ? { ownerId: cmd.ownerId } : {}),
      ...(cmd.kind !== undefined ? { kind: cmd.kind } : {}),
      ...(cmd.status !== undefined ? { status: cmd.status } : {}),
      limit,
      offset,
    });
  }
}
