FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

ENV NODE_ENV=production
ENV PORT=80
ENV HOSTNAME=0.0.0.0
ENV VISIT_DATA_DIR=/app/data

RUN mkdir -p /app/data

EXPOSE 80

CMD ["node", "server.js"]
