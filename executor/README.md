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
./firewall-executor.sh apply
```

It listens on `:8080` and the port is published on **127.0.0.1 only**. Put a TLS
reverse proxy in front of it: the service speaks plain HTTP and holds a bearer
token, so it must not be exposed on a public interface.

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

## The isolation, and the one thing that cannot be done here

**The student program can open a socket, and cutting that off is the one part of
this design that does not work inside a single container.** It is stated first
because the original file claimed otherwise, and the claim would have shipped a
grader that could not be called.

Measured on this host, with the image built and started:

| Configuration | Egress | Ingress |
| --- | --- | --- |
| `network_mode: none` | blocked | **unreachable** (`HTTP 000`) |
| `--internal` bridge network | blocked | **unreachable** (`HTTP 000`) |
| default bridge network | **open** | works |

There is no single-container answer, because the service has to be reachable from
Supabase over the internet, and giving the student program its own network
namespace needs `CAP_SYS_ADMIN`, which is exactly the privilege the rest of this
sandbox exists to withhold.

So egress is cut one level up, on the host, by `firewall-executor.sh`, which drops
outbound traffic from the executor's Docker network while leaving published ports
working. That is the only place it can be cut, and it has to be applied on the
host that runs the container.

### Two Docker defaults that silently broke grading

Both were found only by building and starting the image, and both made the
executor useless rather than obviously broken:

- **Docker mounts every `--tmpfs` `noexec` by default.** The grader compiles into
  its work directory and then executes it. With `noexec` the compile succeeded and
  the exec was refused, so a *correct* program scored zero and it looked exactly
  like a student getting the answer wrong. `/work` therefore says `exec`, and `/tmp`
  stays `noexec` so a student cannot stage a binary in scratch space and run it.
- **A `--tmpfs` is mounted root-owned**, and the executor does not run as root, so
  `mkdtemp` failed `EACCES` and every submission errored. `/work` is mounted
  `uid=10001,gid=10001`.

Everything else in the sandbox is defence in depth, and all of it is asserted
against the built image in `src/__tests__/executor-container.test.js`:

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

Verified against the running image: capabilities are zero, the process is uid
10001, the root filesystem refuses writes, `/tmp` refuses execution and `/work`
allows it, and an infinite loop is killed at the timeout rather than hanging.

### What is left

- `MAX_MEMORY_MB` is logged for visibility only; the enforced limit is the
  container's `mem_limit` (512m).
- **The student program shares a network namespace with the executor**, so it can
  reach loopback and read its own `EXECUTOR_TOKEN` from the environment. The token
  grants nothing but grading, and resource caps bound the damage, but this is a
  real limitation rather than a solved problem. The clean fix is a second container
  with no network that does the compiling, reachable only over a shared volume, so
  the untrusted code and the service are never in the same namespace.
- These are container flags, not a hardened kernel. For a public deployment, use a
  host with seccomp and AppArmor active, a dedicated box with no other workloads,
  and size the pool for the concurrency you expect.

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

`src/__tests__/executor-container.test.js` builds nothing but does start the
container and checks the isolation and the grading contract against it. It skips
when there is no Docker daemon or the image is not built.

`src/__tests__/cpp-executor.test.js` runs this server against the real `g++` and
covers all four verdicts, partial marks, auth rejection, and a crash. It skips
itself where there is no compiler rather than failing for an unrelated reason.
The isolation flags, the exact-comparison rules, and the edge function's
understanding of this contract are asserted as source, so the sandbox cannot be
quietly weakened without a test noticing.
