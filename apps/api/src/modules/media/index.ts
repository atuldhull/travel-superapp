/**
 * Public API of the Media module. Cross-module CODE consumers
 * (ports, types, public use-cases) MUST import from this barrel —
 * reaching into `./domain/`, `./application/`, `./infrastructure/`,
 * or `./interface/` is forbidden by the `no-cross-module-deep-import`
 * rule in `.dependency-cruiser.cjs`.
 *
 * The ONE exception is the NestJS module class `MediaModule` —
 * cross-module DI imports use `./media.module` directly, not this
 * barrel ([C4]: re-exporting the module class here triggered a CJS
 * partial-module cycle that bricked AppModule bootstrap).
 *
 * Authored by [B1]; module-class re-export removed by [C4].
 */

export * from './application/ports/image-processor.port';
export * from './application/ports/media-asset.repository';
export * from './application/ports/memory-book.repository';
export * from './application/ports/storage-provider';
export * from './application/ports/trip-book-drafter.port';
