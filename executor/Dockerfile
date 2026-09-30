# The image that runs untrusted code, so it is built to be boring and small.
#
# No package manager, no build stage, no dependencies: the server is three
# node builtins, so there is nothing to install and nothing to audit but the
# compiler and the base image.
FROM node:22-slim

# g++ and libc are all that is needed. No package manager is kept in the final
# image, because a writable package manager inside a sandbox is one more thing
# to get wrong.
RUN apt-get update \
 && apt-get install -y --no-install-recommends g++ libc6-dev \
 && rm -rf /var/lib/apt/lists/* \
 && apt-get purge -y apt \
 && apt-get autoremove -y

# Never root. A student program that finds a way out of its own process should
# find an unprivileged user with no capabilities instead.
RUN useradd --create-home --uid 10001 executor
USER executor

ENV PORT=8080 \
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
