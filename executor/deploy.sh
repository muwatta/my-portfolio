

set -euo pipefail

EXECUTOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN_NAME="${TOKEN_NAME:-c0ffee}"
PUBLIC_HOST="${PUBLIC_HOST:?set PUBLIC_HOST to the public hostname of this host, e.g. executor.example.com}"
PROXY_PORT="${PROXY_PORT:-8443}"
UPSTREAM_PORT="${UPSTREAM_PORT:-8080}"

say() { printf '\n=== %s ===\n' "$1"; }
fail() { printf '\nFAILED: %s\n' "$1" >&2; exit 1; }

command -v docker >/dev/null || fail "docker is not installed"
docker info >/dev/null 2>&1 || fail "the docker daemon is not running"

if [ ! -f "$EXECUTOR_DIR/.env" ]; then
  say "generating EXECUTOR_TOKEN"
  ( cd "$EXECUTOR_DIR" && umask 077 && printf 'EXECUTOR_TOKEN=%s\n' "$(openssl rand -hex 32)" > .env )
  echo "wrote executor/.env (mode 600). Add it to .gitignore if it is not already."
fi
# shellcheck disable=SC1091
TOKEN="$(grep '^EXECUTOR_TOKEN=' "$EXECUTOR_DIR/.env" | cut -d= -f2-)"
[ -n "$TOKEN" ] || fail "EXECUTOR_TOKEN is empty in executor/.env"

say "starting the container"
( cd "$EXECUTOR_DIR" && docker compose up -d --build )
sleep 3
docker compose -f "$EXECUTOR_DIR/docker-compose.yml" ps

say "the executor answers locally"
curl -fsS -m 10 -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:${UPSTREAM_PORT}/health" \
  || fail "no answer on 127.0.0.1:${UPSTREAM_PORT}. If the compose file says network_mode: none, that is why: a container with no network interfaces cannot be reached either."

say "it authenticates"
code=$(curl -s -o /dev/null -w '%{http_code}' -m 10 \
  -H "Authorization: Bearer wrong-on-purpose" "http://127.0.0.1:${UPSTREAM_PORT}/grade" \
  || echo 000)
[ "$code" = "401" ] || fail "expected 401 for a bad token, got $code. Check EXECUTOR_TOKEN."
echo "bad token correctly refused"

say "it grades a real program"
result=$(curl -fsS -m 90 -X POST "http://127.0.0.1:${UPSTREAM_PORT}/grade" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data '{"source_code":"#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b<<std::endl;}","tests":[{"name":"2+3","input":["2","3"],"expected":"5"},{"name":"10 + -4","input":["10","-4"],"expected":"6"}],"max_score":10}')
echo "$result"
echo "$result" | grep -q '"passed":true' \
  || fail "the reference program did not pass. If /work is mounted noexec the compile succeeds and the exec is refused, which looks exactly like a wrong answer."

say "TLS proxy in front of it"
if [ ! -f "$EXECUTOR_DIR/Caddyfile" ]; then
  cat > "$EXECUTOR_DIR/Caddyfile" <<CADDY
# TLS terminates here. The executor speaks plain HTTP on loopback and holds the
# bearer token, so it must never be published on a public interface directly.
$PUBLIC_HOST {
  reverse_proxy 127.0.0.1:$UPSTREAM_PORT
}
CADDY
  echo "wrote a Caddyfile for $PUBLIC_HOST"
  echo "Start a proxy in front, for example:  caddy run --config $EXECUTOR_DIR/Caddyfile"
fi
printf 'Is a TLS proxy serving %s on :%s? Enter the public URL, or "skip". ' "$PUBLIC_HOST" "$PROXY_PORT"
read -r PUBLIC_URL

if [ "$PUBLIC_URL" = "skip" ]; then
  say "stopping before Supabase is pointed anywhere"
  cat <<'MSG'
Not finished. Nothing has been set in Supabase, which is the safe state: the
edge function keeps returning grading_unavailable and invents no marks.

Still to do, with a public URL in hand:
  1. Put a TLS proxy in front of 127.0.0.1:8080.
  2. ./firewall-executor.sh apply        <- egress, see below
  3. npx supabase secrets set GRADING_EXECUTOR_URL=<url> GRADING_EXECUTOR_KEY=<token>
MSG
  exit 0
fi

say "egress"
printf 'Has firewall-executor.sh been applied on this host? Enter "yes" if so. '
read -r FIREWALL
if [ "$FIREWALL" = "yes" ]; then
  echo "good: the student's program cannot reach the network"
else
  cat <<'MSG'

STOP. Do not point Supabase at this yet.

Until egress is blocked, a student's compiled program can open a socket and reach
the internet, the database, or anything else reachable from this host. The
container has no network namespace of its own because it has to be reachable, so
the host is the only place that can be cut:

    sudo ./firewall-executor.sh apply

Nothing is set in Supabase, so the grader still returns grading_unavailable.
MSG
  exit 1
fi

say "pointing Supabase at it"
( cd "$EXECUTOR_DIR/.." && npx supabase secrets set \
    "GRADING_EXECUTOR_URL=$PUBLIC_URL" \
    "GRADING_EXECUTOR_KEY=$TOKEN" \
    "GRADING_EXECUTOR_NAME=docker-gpp" )

say "checking the public endpoint"
curl -fsS -m 20 -H "Authorization: Bearer $TOKEN" "$PUBLIC_URL/health" \
  || fail "the public URL did not answer. The token is already set, so submissions will now fail closed with grading_failed until this is fixed."

cat <<MSG

Deployed.

  executor        $PUBLIC_URL
  token           in Supabase secrets and executor/.env, nowhere else
  egress          blocked by firewall-executor.sh

Verified above: reachable, authenticated, and a real program graded correctly.

Worth doing next:
  - Confirm the student path end to end by submitting a graded assignment.
  - The image runs no TLS itself; the proxy does. Renewals and the proxy are now
    part of the availability of grading.
  - firewall-executor.sh does not survive a daemon restart. Re-apply it, or make
    it persistent, before you need it twice.
MSG
