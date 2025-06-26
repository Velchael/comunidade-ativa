# Usa Node 18 como base
FROM node:18

# Crea el directorio de trabajo
WORKDIR /app

# Copia archivos de dependencias y los instala
COPY package*.json ./

#solo para desarrollo
RUN npm install && npm install -g nodemon

# RUN npm install solo para producion

# Copia el resto de los archivos
COPY . .

# Expone el puerto que usas
EXPOSE 3000

# Comando para arrancar el servidor para producion
#CMD ["npm", "run", "start"]

#comando para desarrollo

CMD ["nodemon", "server.js"]
