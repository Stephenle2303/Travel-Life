FROM node:24.21.0-bookworm-slim
# Require the reviewed exact Debian package version at build time. Never accept
# an unpinned apt candidate silently; record image/package digest in deployment.
ARG FFMPEG_DEBIAN_VERSION
RUN test -n "$FFMPEG_DEBIAN_VERSION" && apt-get update && apt-get install --no-install-recommends -y "ffmpeg=$FFMPEG_DEBIAN_VERSION" && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server.mjs validator.mjs ./
USER node
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.mjs"]
