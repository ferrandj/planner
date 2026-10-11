# syntax=docker/dockerfile:1
FROM node:24-alpine

ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=8080

WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public

# /data holds EVERYTHING the user creates (state, uploads, backups).
# Mount a host folder or named volume here; the image itself is disposable.
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "server/index.js"]
