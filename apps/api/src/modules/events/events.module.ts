/**
 * Events feature module. Clean-hex + decorated provider, same shape
 * Weather/Stays/Food/Places use.
 *
 *   controller (interface)
 *     → SearchEventsUseCase (application)
 *       → EVENT_PROVIDER port
 *         ← CachedEventProvider (infrastructure)
 *             ├── MockEventProvider (fixtures)
 *             └── EVENT_CACHE port → RedisEventCache
 *
 * Installed by prompt [IV.18.9.1].
 */
import { Module } from '@nestjs/common';
import { SearchEventsUseCase } from './application/search-events.use-case';
import { EVENT_CACHE } from './application/ports/event-cache';
import { EVENT_PROVIDER } from './application/ports/event-provider';
import { CachedEventProvider } from './infrastructure/cached-event-provider';
import { MockEventProvider } from './infrastructure/mock-event-provider';
import { RedisEventCache } from './infrastructure/redis-event-cache';
import { EventsController } from './interface/events.controller';

@Module({
  controllers: [EventsController],
  providers: [
    MockEventProvider,
    { provide: EVENT_CACHE, useClass: RedisEventCache },
    { provide: EVENT_PROVIDER, useClass: CachedEventProvider },
    SearchEventsUseCase,
  ],
  exports: [EVENT_PROVIDER, SearchEventsUseCase],
})
export class EventsModule {}
