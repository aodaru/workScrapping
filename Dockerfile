# Usa la imagen base de Node.js 22 en Debian Bookworm
FROM node:22-bookworm

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias con npm
RUN npm install

# Instalar navegadores de Playwright (Chromium y Firefox) con sus dependencias
RUN npx playwright install --with-deps chromium firefox

# Copiar el resto del código
COPY . .

# Exponer el puerto
EXPOSE 3000

# Usar el script de inicio que definiste en tu package.json
CMD ["npm", "start"]
