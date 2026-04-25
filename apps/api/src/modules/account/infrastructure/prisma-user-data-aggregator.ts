/**
 * Prisma adapter for `UserDataAggregator`. Owner-scoped fan-out
 * across every table that holds user-attributable data.
 *
 * Strategy:
 *   - One `Promise.all` over the section queries — each is a
 *     plain Prisma read with `where: { userId | reporterId | ownerId | ... }`
 *     keyed on the caller. PostGIS columns are intentionally
 *     omitted: bringing them back as `{ lng, lat }` requires
 *     `GeoQueries` raw-SQL extraction (CLAUDE.md rule 11) and is
 *     queued for v2.
 *   - The `User` row is fetched FIRST + alone, since the rest of
 *     the bundle is meaningless without it. Returning `null`
 *     short-circuits the use-case to a 404.
 *   - The `ItineraryDay` + `ItineraryItem` reads scope by joining
 *     on the user's own trips (`trip: { userId }`) — Prisma's
 *     relation filter compiles down to a single SQL roundtrip
 *     each.
 *
 * Cross-trip social rows: a user is included in another owner's
 * trip's `splitShare` when the host adds them. v1 only returns
 * rows where the caller is the *paying* user (Expense.paidById)
 * or the *casting* user (Vote.userId) — i.e. rows the caller
 * directly authored. Splits where the caller is just a
 * participant (their userId appears as a key in someone else's
 * Expense.splitShare JSON) are NOT in this bundle. That's a
 * v2 enhancement: it requires JSON-key indexing or a per-user
 * shadow row, neither of which exists today.
 *
 * Installed by prompt [IV.18.16.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/db/prisma.service';
import type { UserDataAggregator, UserDataBundle } from '../application/ports/user-data-aggregator';

@Injectable()
export class PrismaUserDataAggregator implements UserDataAggregator {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async aggregateForUser(userId: string): Promise<UserDataBundle | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    const [
      preferences,
      sessions,
      devices,
      oauthIdentities,
      mfaBackupCodes,
      trips,
      itineraryDays,
      itineraryItems,
      tripVersions,
      tripShares,
      scamReports,
      sosEvents,
      notificationPreference,
      notificationLogs,
      mediaAssets,
      memoryBooks,
      votes,
      expenses,
      reviews,
      dishReports,
      stayBookings,
      subscriptions,
      escrowHolds,
      commissions,
      agentProfile,
      liveEvents,
    ] = await Promise.all([
      this.prisma.preferences.findUnique({ where: { userId } }),
      this.prisma.session.findMany({ where: { userId }, orderBy: { issuedAt: 'desc' } }),
      this.prisma.device.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.userOAuthIdentity.findMany({ where: { userId } }),
      this.prisma.mfaBackupCode.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.trip.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.itineraryDay.findMany({
        where: { trip: { userId } },
        orderBy: [{ tripId: 'asc' }, { dayIndex: 'asc' }],
      }),
      this.prisma.itineraryItem.findMany({
        where: { day: { trip: { userId } } },
        orderBy: [{ dayId: 'asc' }, { position: 'asc' }],
      }),
      this.prisma.tripVersion.findMany({
        where: { authorId: userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tripShare.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.scamReport.findMany({
        where: { reporterId: userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sosEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.notificationPreference.findUnique({ where: { userId } }),
      this.prisma.notificationLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.mediaAsset.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.memoryBook.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vote.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.expense.findMany({ where: { paidById: userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.review.findMany({ where: { authorId: userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.dish.findMany({ where: { reportedBy: userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.stayBooking.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.subscription.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.escrowHold.findMany({ where: { userId }, orderBy: { heldAt: 'desc' } }),
      this.prisma.commission.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.agent.findUnique({ where: { userId } }),
      this.prisma.liveEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);

    return {
      identity: {
        user: {
          id: user.id,
          emailHash: user.emailHash,
          role: user.role,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          locale: user.locale,
          timezone: user.timezone,
          mfaEnabled: user.mfaEnabled,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          deletedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
        },
        preferences: preferences
          ? {
              diet: preferences.diet,
              accessibility: preferences.accessibility,
              travelType: preferences.travelType,
              budgetTier: preferences.budgetTier,
              dnd: preferences.dnd as Readonly<Record<string, unknown>> | null,
            }
          : null,
        sessions: section(sessions, (s) => ({
          id: s.id,
          deviceId: s.deviceId,
          userAgent: s.userAgent,
          issuedAt: s.issuedAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
          revokedAt: s.revokedAt ? s.revokedAt.toISOString() : null,
        })),
        devices: section(devices, (d) => ({
          id: d.id,
          platform: d.platform,
          fingerprint: d.fingerprint,
          lastSeenAt: d.lastSeenAt.toISOString(),
          createdAt: d.createdAt.toISOString(),
        })),
        oauthIdentities: section(oauthIdentities, (o) => ({
          id: o.id,
          provider: o.provider,
          providerEmail: o.providerEmail,
          linkedAt: o.linkedAt.toISOString(),
        })),
        mfaBackupCodes: section(mfaBackupCodes, (c) => ({
          id: c.id,
          used: c.usedAt !== null,
          usedAt: c.usedAt ? c.usedAt.toISOString() : null,
          createdAt: c.createdAt.toISOString(),
        })),
      },
      trips: section(trips, (t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        radiusKm: t.radiusKm,
        startsOn: t.startsOn ? t.startsOn.toISOString() : null,
        endsOn: t.endsOn ? t.endsOn.toISOString() : null,
        version: t.version,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      itineraryDays: section(itineraryDays, (d) => ({
        id: d.id,
        tripId: d.tripId,
        dayIndex: d.dayIndex,
        date: d.date.toISOString(),
        summary: d.summary,
      })),
      itineraryItems: section(itineraryItems, (i) => ({
        id: i.id,
        dayId: i.dayId,
        position: i.position,
        placeId: i.placeId,
        startTime: i.startTime ? i.startTime.toISOString() : null,
        endTime: i.endTime ? i.endTime.toISOString() : null,
        notes: i.notes,
        transportMode: i.transportMode,
      })),
      tripVersions: section(tripVersions, (v) => ({
        id: v.id,
        tripId: v.tripId,
        versionNo: v.versionNo,
        note: v.note,
        createdAt: v.createdAt.toISOString(),
      })),
      tripShares: section(tripShares, (s) => ({
        id: s.id,
        tripId: s.tripId,
        shareCode: s.shareCode,
        publicRead: s.publicRead,
        expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
        createdAt: s.createdAt.toISOString(),
      })),
      scamReports: section(scamReports, (r) => ({
        id: r.id,
        category: r.category,
        severity: r.severity,
        description: r.description,
        evidenceUrls: r.evidenceUrls,
        verified: r.verified,
        createdAt: r.createdAt.toISOString(),
      })),
      sosEvents: section(sosEvents, (s) => ({
        id: s.id,
        trigger: s.trigger,
        resolvedAt: s.resolvedAt ? s.resolvedAt.toISOString() : null,
        resolutionNote: s.resolutionNote,
        createdAt: s.createdAt.toISOString(),
      })),
      notificationPreference: notificationPreference
        ? {
            push: notificationPreference.push,
            email: notificationPreference.email,
            sms: notificationPreference.sms,
            quietHours: notificationPreference.quietHours as Readonly<
              Record<string, unknown>
            > | null,
          }
        : null,
      notificationLogs: section(notificationLogs, (n) => ({
        id: n.id,
        channel: n.channel,
        templateId: n.templateId,
        status: n.status,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
        deliveredAt: n.deliveredAt ? n.deliveredAt.toISOString() : null,
      })),
      mediaAssets: section(mediaAssets, (m) => ({
        id: m.id,
        tripId: m.tripId,
        memoryBookId: m.memoryBookId,
        kind: m.kind,
        status: m.status,
        s3KeyRaw: m.s3KeyRaw,
        takenAt: m.takenAt ? m.takenAt.toISOString() : null,
        createdAt: m.createdAt.toISOString(),
      })),
      memoryBooks: section(memoryBooks, (b) => ({
        id: b.id,
        title: b.title,
        theme: b.theme,
        publishedAt: b.publishedAt ? b.publishedAt.toISOString() : null,
        createdAt: b.createdAt.toISOString(),
      })),
      votes: section(votes, (v) => ({
        id: v.id,
        tripId: v.tripId,
        targetType: v.targetType,
        targetId: v.targetId,
        value: v.value,
        createdAt: v.createdAt.toISOString(),
      })),
      expenses: section(expenses, (e) => ({
        id: e.id,
        tripId: e.tripId,
        amountUsd: e.amountUsd.toFixed(2),
        currency: e.currency,
        note: e.note,
        splitShare: e.splitShare as Readonly<Record<string, unknown>>,
        createdAt: e.createdAt.toISOString(),
      })),
      reviews: section(reviews, (r) => ({
        id: r.id,
        tripId: r.tripId,
        targetType: r.targetType,
        targetId: r.targetId,
        rating: r.rating,
        body: r.body,
        language: r.language,
        verifiedBooking: r.verifiedBooking,
        createdAt: r.createdAt.toISOString(),
      })),
      dishReports: section(dishReports, (d) => ({
        id: d.id,
        eateryId: d.eateryId,
        name: d.name,
        priceUsd: d.priceUsd ? d.priceUsd.toFixed(2) : null,
        createdAt: d.createdAt.toISOString(),
      })),
      stayBookings: section(stayBookings, (b) => ({
        id: b.id,
        stayId: b.stayId,
        provider: b.provider,
        checkIn: b.checkIn.toISOString(),
        checkOut: b.checkOut.toISOString(),
        totalPriceUsd: b.totalPriceUsd.toFixed(2),
        createdAt: b.createdAt.toISOString(),
      })),
      subscriptions: section(subscriptions, (s) => ({
        id: s.id,
        status: s.status,
        priceCents: s.priceCents,
        currency: s.currency,
        currentPeriodEnd: s.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        createdAt: s.createdAt.toISOString(),
      })),
      escrowHolds: section(escrowHolds, (h) => ({
        id: h.id,
        agentId: h.agentId,
        amountUsd: h.amountUsd.toFixed(2),
        currency: h.currency,
        state: h.state,
        heldAt: h.heldAt.toISOString(),
        releasedAt: h.releasedAt ? h.releasedAt.toISOString() : null,
        refundedAt: h.refundedAt ? h.refundedAt.toISOString() : null,
      })),
      commissions: section(commissions, (c) => ({
        id: c.id,
        sourceType: c.sourceType,
        sourceId: c.sourceId,
        amountUsd: c.amountUsd.toFixed(2),
        currency: c.currency,
        paidAt: c.paidAt ? c.paidAt.toISOString() : null,
        createdAt: c.createdAt.toISOString(),
      })),
      agentProfile: agentProfile
        ? {
            id: agentProfile.id,
            displayName: agentProfile.displayName,
            bio: agentProfile.bio,
            kycStatus: agentProfile.kycStatus,
            verifiedAt: agentProfile.verifiedAt ? agentProfile.verifiedAt.toISOString() : null,
            languages: agentProfile.languages,
            regions: agentProfile.regions,
            ratingAverage: agentProfile.ratingAverage,
            ratingCount: agentProfile.ratingCount,
            createdAt: agentProfile.createdAt.toISOString(),
          }
        : null,
      liveEvents: section(liveEvents, (e) => ({
        id: e.id,
        tripId: e.tripId,
        geofenceId: e.geofenceId,
        kind: e.kind,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }
}

function section<TRow, TOut>(
  rows: readonly TRow[],
  map: (row: TRow) => TOut,
): { count: number; rows: readonly TOut[] } {
  return { count: rows.length, rows: rows.map(map) };
}
