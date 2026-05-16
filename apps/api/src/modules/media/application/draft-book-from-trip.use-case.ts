/**
 * POST.2C.1 — drafts a PRIVATE Memory Book from a finished trip.
 *
 * ORCHESTRATES the existing CreateMemoryBookUseCase (same module,
 * direct inject) — which creates the book with `publishedAt = null`,
 * i.e. a PRIVATE draft. It deliberately does NOT call the publish
 * use-case: this only produces a draft for the owner to review.
 * Photo auto-attach (the trip's existing ready assets, via the 1.0
 * Sharp-variant pipeline) is a documented follow-on; the verifiable
 * core is "exactly one PRIVATE draft, idempotently".
 *
 * Installed by prompt [POST.2C.1].
 */
import { Injectable } from '@nestjs/common';
import { CreateMemoryBookUseCase } from './create-memory-book.use-case';
import type {
  DraftBookFromTripInput,
  DraftBookFromTripResult,
  TripBookDrafter,
} from './ports/trip-book-drafter.port';

@Injectable()
export class DraftBookFromTripUseCase implements TripBookDrafter {
  constructor(private readonly createBook: CreateMemoryBookUseCase) {}

  async draftFromTrip(input: DraftBookFromTripInput): Promise<DraftBookFromTripResult> {
    const book = await this.createBook.execute({
      ownerId: input.ownerId,
      title: input.title,
      theme: 'classic',
    });
    // book.publishedAt === null here → a PRIVATE draft. No publish.
    return { memoryBookId: book.id };
  }
}
