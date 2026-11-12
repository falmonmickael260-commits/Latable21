# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
ARG GODOT_VERSION=4.6.3
ENV NEXT_TELEMETRY_DISABLED=1
# Godot and its web template are build tools only.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl unzip libfontconfig1 libgl1 libxcursor1 libxinerama1 libxrandr2 libxi6 libasound2 && rm -rf /var/lib/apt/lists/*
RUN curl -fL --retry 3 "https://github.com/godotengine/godot-builds/releases/download/${GODOT_VERSION}-stable/Godot_v${GODOT_VERSION}-stable_linux.x86_64.zip" -o /tmp/godot.zip && \
    unzip -p /tmp/godot.zip > /usr/local/bin/godot && chmod +x /usr/local/bin/godot && \
    curl -fL --retry 3 "https://github.com/godotengine/godot-builds/releases/download/${GODOT_VERSION}-stable/Godot_v${GODOT_VERSION}-stable_export_templates.tpz" -o /tmp/templates.tpz && \
    mkdir -p /root/.local/share/godot/export_templates/${GODOT_VERSION}.stable && \
    unzip -p /tmp/templates.tpz templates/web_nothreads_release.zip > /root/.local/share/godot/export_templates/${GODOT_VERSION}.stable/web_nothreads_release.zip && \
    rm /tmp/godot.zip /tmp/templates.tpz
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 TABLE21_DATABASE_PATH=/data/table21.sqlite
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build /app/server.ts /app/package.json /app/package-lock.json /app/tsconfig.json /app/next.config.ts ./
RUN mkdir -p /data
EXPOSE 8080
CMD ["npm", "start"]
