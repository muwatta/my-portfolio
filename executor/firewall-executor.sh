#!/bin/sh
# Cut the executor's egress at the host, which is the only place it can be cut.
#
# Why this is a host script and not a compose setting: the executor container has
# to be reachable, because Supabase edge functions call it over the internet. A
# container that can be reached has a route out, and the student program runs
# inside that container as a child process. Giving the student its own network
# namespace needs CAP_SYS_ADMIN, the one privilege the rest of the sandbox exists
# to withhold. So: no egress from the container's network, enforced here.
#
# Verified on this host: with a plain bridge network the container fetched
# example.com successfully, and with `--network none` the health endpoint could
# not be reached at all. Both facts are why this file exists.
#
# Apply on the host that runs the executor, once, and re-apply after a daemon
# restart or a firewall reload. Run ./firewall-executor.sh status to check.

set -eu

# The executor's container network. Match it to COMPOSE_NETWORK below.
COMPOSE_NETWORK="${COMPOSE_NETWORK:-academy-cpp-executor_default}"
# The port a reverse proxy connects to, on the container.
CONTAINER_PORT="${CONTAINER_PORT:-8080}"

# Comments on the rules, because "DROP" without a reason is how a firewall gets
# turned off during an incident and never turned back on.
#
# Allow loopback inside the container, which the executor needs for itself, and
# established traffic. Then drop everything outbound. The student's compiled
# program cannot reach the internet, Supabase, the database, or the grading
# service's neighbours from inside.
add_rules() {
  iptables -I DOCKER-USER -i "$COMPOSE_NETWORK" -o "$COMPOSE_NETWORK" \
    -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
  iptables -A DOCKER-USER -i "$COMPOSE_NETWORK" ! -d "$COMPOSE_NETWORK" \
    -j DROP
  iptables -A DOCKER-USER -o "$COMPOSE_NETWORK" ! -s "$COMPOSE_NETWORK" \
    -j DROP
}

status() {
  echo "DOCKER-USER rules:"
  iptables -S DOCKER-USER | sed 's/^/  /' || echo "  (cannot read; needs root)"
}

case "${1:-apply}" in
  apply)
    add_rules
    echo "Egress blocked for $COMPOSE_NETWORK."
    echo "Ingress to container port $CONTAINER_PORT still works via DOCKER-USER order."
    status
    ;;
  remove)
    iptables -D DOCKER-USER -i "$COMPOSE_NETWORK" -o "$COMPOSE_NETWORK" \
      -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN 2>/dev/null || true
    iptables -D DOCKER-USER -i "$COMPOSE_NETWORK" ! -d "$COMPOSE_NETWORK" \
      -j DROP 2>/dev/null || true
    iptables -D DOCKER-USER -o "$COMPOSE_NETWORK" ! -s "$COMPOSE_NETWORK" \
      -j DROP 2>/dev/null || true
    echo "Rules removed. Egress is open again."
    ;;
  status)
    status
    ;;
  *)
    echo "usage: $0 {apply|remove|status}" >&2
    exit 2
    ;;
esac