# Etapa 1: Build de la aplicación React
FROM node:18 AS build
WORKDIR /app

# Copiar solo dependencias primero para usar cache
COPY package*.json ./
RUN npm install

# Copiar el resto de la app
COPY . .

# 🟢 ENV para React en tiempo de build (desde docker-compose)
# Pasa variable al build de React
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN npm install @heroicons/react
# Generar la build
RUN npm run build

# Etapa 2: Servir con NGINX
FROM nginx:alpine

# Copiar la build al directorio web de nginx
COPY --from=build /app/build /usr/share/nginx/html

# Reemplazar configuración de NGINX si existe
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Exponer el puerto 80
EXPOSE 80

# Comando por defecto
CMD ["nginx", "-g", "daemon off;"]


