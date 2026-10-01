# The image that runs untrusted code, so it is built to be boring and small.
#
# No build stage and no dependencies: the server is three node builtins, so there
# is nothing to install and nothing to audit but the compiler and the base image.
FROM node:22-slim

# g++ and the C library headers it compiles against are all that is needed.
#
# apt itself is left installed. An earlier version purged it, which fails the
# build: apt is an Essential package and removing it needs
# --allow-remove-essential, after which dpkg is left in a state nobody should
# ship. Removing it also buys almost nothing, because the container runs with a
# read-only root filesystem and no capabilities, so there is nothing to install
# into and no privilege to install with. Read-only is the control; deleting apt
# would have been decoration.
RUN apt-get update \
 && apt-get install -y --no-install-recommends g++ libc6-dev \
 && rm -rf /var/lib/apt/lists/*

# Never root. A student program that finds a way out of its own process should
# find an unprivileged user with no capabilities instead.
RUN useradd --create-home --uid 10001 executor

# Owned by the executor user while still root, so the later USER instruction does
# not leave it unwritable. A tmpfs is mounted over /work at run time.
RUN mkdir -p /work && chown executor:executor /work

USER executor

# /work is where compiled binaries are written. It has to be executable, because
# the grader runs the binary it compiles, while /tmp stays noexec so a student
# cannot stage and run anything there. See docker-compose.yml for the mounts.
ENV PORT=8080 \
    WORK_DIR=/work \
    CXX=/usr/bin/g++ \
    TEST_TIMEOUT_MS=5000 \
    COMPILE_TIMEOUT_MS=15000 \
    MAX_MEMORY_MB=256

WORKDIR /app
COPY --chown=executor:executor server.mjs ./

EXPOSE 8080

# No health check hitting the compiler, just liveness.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
