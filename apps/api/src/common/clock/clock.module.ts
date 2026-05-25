/**
 * Global `CLOCK` provider ([M2]).
 *
 * Binds the `CLOCK` DI token to the production `SYSTEM_CLOCK` singleton
 * from `@app/clock` so any module can `@Inject(CLOCK)` without listing
 * a per-module import. `@Global()` is right here: there's exactly one
 * clock per process; per-feature clock variants would be a smell.
 *
 * Tests override CLOCK by overriding the provider in the TestingModule
 * builder (`overrideProvider(CLOCK).useValue(makeFakeClock(...))`).
 *
 * Why a Nest module and not just a useValue in AppModule's providers:
 * `@Global()` only takes effect when applied to a `@Module`-decorated
 * class. Inlining the provider in AppModule.providers wouldn't propagate
 * to every feature module via DI — they'd each need to import CLOCK
 * explicitly. The module wrapper is one indirection that saves N
 * per-feature edits.
 *
 * Installed by [M2] — closes #6 of the road-to-10 Test/CI list ("Control
 * time everywhere"). The `@app/clock` package + interface shipped in
 * [L4]; [M2] wires it into the runtime + migrates a representative
 * slice (trip lock/unlock + identity refresh).
 */
import { Global, Module } from '@nestjs/common';
import { CLOCK, SYSTEM_CLOCK } from '@app/clock';

@Global()
@Module({
  providers: [{ provide: CLOCK, useValue: SYSTEM_CLOCK }],
  exports: [CLOCK],
})
export class ClockModule {}
