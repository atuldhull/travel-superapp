# test/quarantine

Tests that are KNOWN FLAKY but not yet root-caused. The main `tests`
CI job DOES NOT run them; a separate `tests-quarantine` job runs them
informationally on every PR + nightly so they stay visible.

## Adding a test here

```bash
git mv apps/api/test/foo.e2e-spec.ts apps/api/test/quarantine/foo.e2e-spec.ts
git commit -m "chore(quarantine): foo — symptom: bar (refs #123)"
```

Same commit MUST:

1. Open a tracking issue with the failure log + suspected root cause.
2. Set a follow-up date (≤ 2 weeks); past that the test is either
   fixed + moved back, or deleted with a documented "this isn't
   testable today" reason.

## Removing a test from here

Move the file back to `apps/api/test/`. In the same PR:

1. Show the symptom is gone — paste 10 green CI runs OR a code fix
   that explains why the flake is no longer possible.
2. Close the tracking issue.

The flake-quarantine pattern is the OPPOSITE of the I1/L1 skip-pass
anti-pattern: it makes the broken state LOUD (its own CI job +
tracking issue + deadline) rather than silent (`if (!dbReachable)
return`).
