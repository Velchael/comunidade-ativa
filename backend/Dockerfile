# ------------------------------
# STAGE 1: Build base
# ------------------------------
FROM node:18

# Establecer directorio de trabajo
WORKDIR /app

# Copiar solo archivos de dependencias primero (para cache)
COPY package*.json ./

# Instalar dependencias de producción por defecto
RUN npm install

# Copiar el resto del código fuente
COPY . .

# Exponer el puerto que usará la API
EXPOSE 3000

# ------------------------------
# STAGE 2: Entorno de ejecución
# ------------------------------
# ⚙️ Cambia este comando en producción:
# CMD ["npm", "start"]

# 🔧 Comando por defecto para desarrollo
CMD ["npx", "nodemon", "server.js"]
