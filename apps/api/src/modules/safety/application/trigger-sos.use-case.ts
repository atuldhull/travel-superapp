/**
 * Trigger an SOS event at the caller's reported coordinate.
 * Authenticated path; `userId` comes from the JWT.
 *
 * Emits `Safety.SosTriggered` on success so a future notification
 * subscriber can fan out to emergency contacts / ops on-call.
 *
 * V.UX.13 — also fans out a per-contact notification via
 * `CONTACT_NOTIFIER_PORT` to every TrustedContact attached to the
 * caller. Fan-out runs through `Promise.allSettled`: a single
 * failed contact (bad number, provider down) MUST NOT block the
 * others, and MUST NOT bring down the SOS write itself. The DB
 * row is the source of truth — notifications are best-effort.
 *
 * Installed by prompt [IV.18.11.2]; trusted-contact fan-out [V.UX.13].
 */
import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '@app/events';
import { ValidationError } from '@app/errors';
import { createLogger, getTraceContext } from '@app/logger';
import {
  TRUSTED_CONTACT_REPOSITORY,
  type TrustedContactRepository,
} from '../../account/application/ports/trusted-contact.repository';
import type { SosEvent } from '../domain/sos-event.entity';
import { makeSafetyEvent, type SosTriggeredEvent } from '../domain/safety.events';
import { CONTACT_NOTIFIER_PORT, type ContactNotifier } from './ports/contact-notifier.port';
import { SOS_EVENT_REPOSITORY, type SosEventRepository } from './ports/sos-event.repository';

const log = createLogger('safety.sos.trigger');

export interface TriggerSosCommand {
  readonly userId: string;
  readonly trigger: string;
  readonly lat: number;
  readonly lng: number;
}

@Injectable()
export class TriggerSosUseCase {
  constructor(
    @Inject(SOS_EVENT_REPOSITORY) private readonly sos: SosEventRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(TRUSTED_CONTACT_REPOSITORY) private readonly contacts: TrustedContactRepository,
    @Inject(CONTACT_NOTIFIER_PORT) private readonly notifier: ContactNotifier,
  ) {}

  async execute(cmd: TriggerSosCommand): Promise<SosEvent> {
    if (!Number.isFinite(cmd.lat) || cmd.lat < -90 || cmd.lat > 90) {
      throw new ValidationError(
        'Latitude out of range',
        { lat: ['must be between -90 and 90'] },
        { lat: cmd.lat },
        'INVALID_COORDINATES',
      );
    }
    if (!Number.isFinite(cmd.lng) || cmd.lng < -180 || cmd.lng > 180) {
      throw new ValidationError(
        'Longitude out of range',
        { lng: ['must be between -180 and 180'] },
        { lng: cmd.lng },
        'INVALID_COORDINATES',
      );
    }

    const created = await this.sos.create({
      userId: cmd.userId,
      trigger: cmd.trigger,
      lat: cmd.lat,
      lng: cmd.lng,
    });

    const evt: SosTriggeredEvent = makeSafetyEvent(
      'Safety.SosTriggered',
      {
        userId: created.userId,
        sosEventId: created.id,
        trigger: created.trigger,
        lat: cmd.lat,
        lng: cmd.lng,
      },
      getTraceContext()?.traceId ? { traceId: getTraceContext()!.traceId } : {},
    );
    try {
      await this.events.publish(evt);
    } catch (err) {
      // Event publishing must not bring the whole SOS path down —
      // the row is already safely in the DB. Log + continue.
      log.warn(
        { err: err instanceof Error ? err.message : String(err), sosEventId: created.id },
        'sos_event_publish_failed',
      );
    }

    // V.UX.13 — fan out to trusted contacts. Same isolation pattern
    // as the event-bus publish above: log + continue on any failure.
    try {
      const contacts = await this.contacts.listForUser(cmd.userId);
      if (contacts.length > 0) {
        const settled = await Promise.allSettled(
          contacts.map((c) =>
            this.notifier.notify({
              contactName: c.name,
              phone: c.phone,
              email: c.email,
              travelerUserId: cmd.userId,
              trigger: created.trigger,
              lat: cmd.lat,
              lng: cmd.lng,
              sosEventId: created.id,
              triggeredAt: created.createdAt,
            }),
          ),
        );
        const failed = settled.filter((r) => r.status === 'rejected').length;
        if (failed > 0) {
          log.warn(
            { sosEventId: created.id, total: contacts.length, failed },
            'sos_contact_fanout_partial',
          );
        }
      }
    } catch (err) {
      log.warn(
        { err: err instanceof Error ? err.message : String(err), sosEventId: created.id },
        'sos_contact_fanout_failed',
      );
    }

    return created;
  }
}
