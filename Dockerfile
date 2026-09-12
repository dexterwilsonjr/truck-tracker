FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY server ./server
ENV NODE_ENV=production
ENV PORT=8080
USER node
EXPOSE 8080
CMD ["node", "--import", "tsx", "server/index.ts"]
