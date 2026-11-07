# Booka-Ru storefront image: builds the React app and serves it with nginx.
#   docker build -f client/Dockerfile --build-arg REACT_APP_API_URL=http://localhost:5500 -t booka-ru-web client
# REACT_APP_* values are baked in at build time; rebuild after changing them.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG REACT_APP_API_URL=http://localhost:5500
ARG REACT_APP_GOOGLE_MAPS_API_KEY=
ENV REACT_APP_API_URL=$REACT_APP_API_URL \
    REACT_APP_GOOGLE_MAPS_API_KEY=$REACT_APP_GOOGLE_MAPS_API_KEY
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
