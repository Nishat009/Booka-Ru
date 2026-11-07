# Booka-Ru API image. Build from the repository root so database/ is included:
#   docker build -f server/Dockerfile -t booka-ru-api .
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY server/package.json server/package-lock.json ./server/
RUN npm --prefix server ci --omit=dev && npm cache clean --force

COPY server/ ./server/
COPY database/ ./database/
# The catalogue seeder reads the cover-image map from the client source.
COPY client/src/bookCovers.json ./client/src/bookCovers.json

WORKDIR /app/server
USER node
EXPOSE 5500
CMD ["node", "index.js"]
