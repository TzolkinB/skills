# audit-test — Slow-run cap (stop a hung mutation)

Loaded from Step 4. Wrap every mutated single-test run in a time cap. A mutation can make code loop forever, and an uncapped run blocks the session with the mutation still live in the source.

## The cap

- **Normal time** = the wall time of the same single-test command on unmutated code, from a green run you already have (the triage run, CI output, or the baseline run in the [mutation path check](mutation-path-check.md)). Do not add a run just to measure it.
- **Cap** = 2 × normal time, but never under 10 s (process start-up is part of normal time). If you have no normal time, use 120 s. These are starting values, not measured limits. Say which one you used.
- Name the cap in the proof line: `capped at 20 s (2 × 10 s)`.

## Run it

Kill the **whole process group**, not just the wrapper. Test runners start child processes, and killing only the parent leaves the child spinning (seen in the demo: a looping child kept 100% CPU after its parent was killed). `timeout` from GNU coreutils is not on a stock Mac, so this uses Perl, which is:

```bash
perl -e '
use POSIX ();
my $secs = shift @ARGV; my $pid = fork();
if ($pid == 0) { setpgrp(0, 0); exec @ARGV or POSIX::_exit(127) }
$SIG{ALRM} = sub { kill "KILL", -$pid; waitpid($pid, 0); POSIX::_exit(124) };
alarm $secs; waitpid($pid, 0); exit($? >> 8);
' 20 node --test --test-name-pattern='adds' calc.test.js
```

Exit code **124** means the cap fired. Any other code is the test runner's own result (0 passed, 1 failed). If `timeout` or `gtimeout` exists, `timeout -k 2 20 <command>` does the same job. If neither tool can be used, say so and fall back to 🟡 rather than run uncapped.

## What a capped run means

- A hang is **not a kill**. It is not an assertion failure, so it never earns 🟢, and it never earns 🔴 (the test did not stay green).
- Record the result as **🟡 Likely**: "the mutation hung the test, so the test could not judge it." Try **one** smaller mutation that cannot loop (change a value or a condition, not a loop bound). If that also hangs, stop at 🟡.
- **Revert the mutation first, then confirm the tree is clean** with `git status`, exactly as the Safety rule says. Also check nothing from the killed run is still running (`pgrep -f` the test command).
- **Emission:** `runs[]` only holds confirmed 🟢 and 🔴 runs (the schema allows `killed` and `survived` only), so a capped run is not emitted. It counts as 🟡 in the tally. This skill does not change the Gate schema.
