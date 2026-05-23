/**
 * Public API of the Media module. Cross-module consumers MUST
 * import only from this barrel — reaching into `./domain/`,
 * `./application/`, `./infrastructure/`, or `./interface/` is
 * forbidden by the `no-cross-module-deep-import` rule in
 * `.dependency-cruiser.cjs` (landing in [B2]).
 *
 * Authored by [B1] — module-boundaries hardening.
 */
export { MediaModule } from './media.module';

export * from './application/ports/image-processor.port';
export * from './application/ports/media-asset.repository';
export * from './application/ports/memory-book.repository';
export * from './application/ports/storage-provider';
export * from './application/ports/trip-book-drafter.port';
