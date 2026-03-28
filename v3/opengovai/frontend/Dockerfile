# Stage 1: Build with Vite
FROM node:22-alpine AS builder

WORKDIR /app
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL

COPY package.json .
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:1.27-alpine
COPY --from=builder /app/build /usr/share/nginx/html
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / { try_files $uri $uri/ /index.html; }\n}\n' \
    > /etc/nginx/conf.d/default.conf
EXPOSE 80
