// Anchor input for the root solution tsconfig.json.
//
// The root tsconfig exists only to expose the @app/* path aliases to
// editors and tools; it must NOT compile the monorepo. But a tsconfig
// with an empty files[]/include[] trips TS18002 / TS18003. Listing this
// single no-op declaration as its only input gives it a valid project
// (this file declares and imports nothing) so editors stay clean.
//
// Do not delete without updating tsconfig.json ("files").
export {};
