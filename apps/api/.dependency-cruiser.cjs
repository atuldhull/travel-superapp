/**
 * dependency-cruiser — architecture enforcement for the NestJS API.
 *
 * Turns the clean/hexagonal dependency rule (CLAUDE.md #10:
 * `domain ← application ← infrastructure/interface`) from a
 * convention into a CHECK that fails. Run via `pnpm arch` (this
 * package) — wired into the `lint` turbo task so a layer violation
 * or an import cycle breaks the build, not a code review.
 *
 * Type-only imports ARE counted (`tsPreCompilationDeps: true`): in
 * clean architecture a domain layer must not even KNOW the types of
 * an outer layer, so an `import type` across the boundary is still
 * a violation.
 *
 * Layer folders, per module: `src/modules/<m>/{domain,application,
 * infrastructure,interface}/`. The `<m>.module.ts` file sits OUTSIDE
 * those folders — it is the composition root and is allowed to wire
 * infrastructure adapters to application ports.
 */
module.exports = {
  forbidden: [
    {
      name: 'hex-domain-stays-pure',
      comment:
        'A domain layer must not import from application / infrastructure / interface. ' +
        'The domain is the innermost layer — it depends on nothing outward (CLAUDE.md #10).',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: { path: '^src/modules/[^/]+/(application|infrastructure|interface)/' },
    },
    {
      name: 'hex-application-no-infra-or-interface',
      comment:
        'An application layer (use-cases) must not import from infrastructure or interface. ' +
        'It depends only on the domain and on its own ports — adapters are injected.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/application/' },
      to: { path: '^src/modules/[^/]+/(infrastructure|interface)/' },
    },
    {
      name: 'hex-interface-no-direct-infrastructure',
      comment:
        'An interface layer (controllers) must not import infrastructure directly — it goes ' +
        'through application use-cases. Adapter→port wiring belongs in the <m>.module.ts ' +
        'composition root, which is not under interface/.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/interface/' },
      to: { path: '^src/modules/[^/]+/infrastructure/' },
    },
    {
      name: 'no-cross-module-infrastructure',
      comment:
        "A module must not import ANOTHER module's infrastructure layer. Concrete adapters " +
        '(Prisma repos, Redis caches, 3rd-party wrappers) are private implementation detail. ' +
        "Cross-module collaboration goes through the other module's ports / domain / NestJS " +
        'module — never its infrastructure.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/[^/]+/infrastructure/',
        pathNot: '^src/modules/$1/infrastructure/',
      },
    },
    {
      name: 'no-cross-module-interface',
      comment:
        "A module must not import ANOTHER module's interface layer (controllers). A controller " +
        'is an HTTP edge, not a programmatic API surface for sibling modules.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/[^/]+/interface/',
        pathNot: '^src/modules/$1/interface/',
      },
    },
    {
      name: 'no-cross-module-deep-import',
      comment:
        "Every module's public API is its `index.ts` barrel — it re-exports application ports " +
        'plus whatever domain types / use-cases the module has chosen to expose. Cross-module ' +
        "consumers MUST go through the barrel; reaching into another module's domain/application/" +
        "infrastructure/interface bypasses the contract. ONE exception: a sibling module's NestJS " +
        'composition root (`<m>.module.ts`) IS a sanctioned cross-module target — barrel re-exports ' +
        'of the module class trigger a CJS partial-module cycle that bricks AppModule bootstrap ' +
        'with "Cannot read properties of undefined (reading \'provide\')" ([C4]). The barrel ' +
        're-exports CODE; the .module file IS the DI graph entry.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/[^/]+/',
        // Allowed cross-module targets:
        //   - same-module (always)
        //   - the public barrel (`<m>/index.ts`)
        //   - the composition root (`<m>/<m>.module.ts`) — DI-only, [C4]
        pathNot: [
          '^src/modules/$1/',
          '^src/modules/[^/]+/index\\.ts$',
          '^src/modules/[^/]+/[^/]+\\.module\\.ts$',
        ],
      },
    },
    {
      name: 'no-circular',
      comment:
        'A circular import breaks module-init order (esbuild/ESM trips on it where CJS ' +
        'tolerates it — see the payments dev-server incident) and signals a design problem. ' +
        'Two exclusions: (1) the violation FROM is not a `<m>.module.ts` or a per-module ' +
        '`index.ts` barrel — those are composition-root tier; (2) the cycle path passes ' +
        'through at least one `<m>.module.ts`, meaning it is a NestJS module-graph cycle ' +
        'sanctioned by `forwardRef()`. Cycles that touch no module file are still caught.',
      severity: 'error',
      from: { path: '^src/', pathNot: '\\.module\\.ts$|^src/modules/[^/]+/index\\.ts$' },
      to: { circular: true, viaNot: '\\.module\\.ts$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['main', 'types'],
    },
  },
};
