# Usa la imagen de Playwright que ya tiene las dependencias del sistema
FROM mcr.microsoft.com/playwright:v1.41.0-jammy

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias con npm
RUN npm install

# Copiar el resto del código
COPY . .

# Exponer el puerto
EXPOSE 3000

# Usar el script de inicio que definiste en tu package.json
CMD ["npm", "start"]
