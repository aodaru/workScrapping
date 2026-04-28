# Usa una imagen ligera de Node.js con Playwright instalado
FROM mcr.microsoft.com/playwright:v1.41.0-jammy

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
# Si usas pnpm, podrías necesitar instalarlo primero, 
# pero basándome en tus archivos (pnpm-lock.yaml), 
# lo más seguro es que uses pnpm.
RUN npm install -g pnpm

# Instalar dependencias
RUN pnpm install

# Copiar el resto del código
COPY . .

# Compilar el proyecto (ya que usas TypeScript)
RUN pnpm run build || pnpm exec tsc

# Exponer el puerto que use tu servidor (ajusta si es otro)
EXPOSE 3000

# Comando para arrancar la aplicación
CMD ["pnpm", "start"]
