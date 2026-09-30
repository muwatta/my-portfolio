# C++ executor

Compiles and runs student C++ for the auto-grader. This process is the one place
in the system where code written by children on the internet gets executed, so
most of what follows is about keeping that contained rather than about grading.

## The trust boundary

| Runs student code | Never runs student code |
| --- | --- |
| This service, in a locked-down container | The browser (untrusted, `client_reported` only) |
| | The Supabase edge function (a fetch client, not a runtime) |
| | The app host (no compiler, no executor mounted) |

A browser runner is a teaching aid: it can show a student their output, but it
can be lied to, so its results are stored as `client_reported` and never become a
mark. Everything trusted comes from here.

## Running it

```bash
export EXECUTOR_TOKEN=$(openssl rand -hex 32)
docker compose up --build
```

It listens on `:8080`. Nothing is published to the host, on purpose — see below.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `EXECUTOR_TOKEN` | none, and it refuses to start without it | Bearer token the edge function presents |
| `CXX` | `/usr/bin/g++` | Compiler |
| `TEST_TIMEOUT_MS` | `5000` | Per test wall clock |
| `COMPILE_TIMEOUT_MS` | `15000` | Compilation wall clock |
| `MAX_MEMORY_MB` | `256` | Reported at startup; the real cap is the container's `mem_limit` |
| `PORT` | `8080` | Listen port |

Point Supabase at the same token:

```bash
npx supabase secrets set \
  GRADING_EXECUTOR_URL=https://executor.internal \
  GRADING_EXECUTOR_KEY="$EXECUTOR_TOKEN" \
  GRADING_EXECUTOR_NAME=docker-gpp
npx supabase functions deploy academy-grade-submission
```

## The isolation, and which part matters most

`network_mode: none` is the load-bearing control. A student program that can open
a socket reaches the grading service, the database, and anything else on the
network, and no amount of care inside the process makes up for that. Everything
else is defence in depth:

- **No shell, ever.** `spawn` with an argument array and `shell: false`, so source
  text can never become a command.
- **Process-group kill.** Children are spawned detached and killed with
  `process.kill(-pid, "SIGKILL")` on timeout, so a program that forks cannot
  outlive its test and occupy the pool.
- **No capabilities, no privilege escalation, read-only root filesystem.** The only
  writable path is a `noexec` tmpfs, so a binary cannot be staged and run from it.
- **Unprivileged user**, with no package manager in the final image.
- **Memory, CPU and process-count caps**, and a restart policy so a wedged
  container is replaced rather than left in place.

Two honest caveats. `MAX_MEMORY_MB` is logged for visibility only; the enforced
limit is the container's `mem_limit` (512m). And these are container flags, not a
hardened kernel — for a public deployment, run this on a host with seccomp and
AppArmor active, on a dedicated box with no other workloads, and size the pool for
the concurrency you expect rather than assuming one container absorbs abuse.

## Grading rules

- Output is compared exactly, ignoring trailing spaces and tabs per line and
  trailing newlines. Nothing else is normalised — leading whitespace, extra lines
  and missing lines all fail.
- Verdicts are `completed`, `syntax_error`, `runtime_error`, `timeout`. Compile
  failures come back as `syntax_error` with no test results, so a program that
  does not build is not scored as if it failed every test.
- Marks are per test. A program that is right about 3 of 4 cases earns 3 of 4,
  which is why the tests carry inputs: a hardcoded answer is worth only the cases
  it happens to have been guessed right about.
- A non-zero exit fails the test, so returning nothing and exiting successfully is
  not a way to pass.
- Test names come back unchanged. The edge function correlates on them and refuses
  a result whose names do not line up, so a caller cannot be handed passes for
  tests it never ran.

## Limits and input bounds

The request body is capped (`MAX_SOURCE_BYTES`), the test count is capped, and
every test string is length-checked, because this service accepts input from the
public internet. Exceeding a bound is a `400`, not a crash.

## Tests

`src/__tests__/cpp-executor.test.js` runs this server against the real `g++` and
covers all four verdicts, partial marks, auth rejection, and a crash. It skips
itself where there is no compiler rather than failing for an unrelated reason.
The isolation flags, the exact-comparison rules, and the edge function's
understanding of this contract are asserted as source, so the sandbox cannot be
quietly weakened without a test noticing.
