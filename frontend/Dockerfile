# Etapa 1: construir la app
FROM node:18 as build
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build

# Etapa 2: usar nginx
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

