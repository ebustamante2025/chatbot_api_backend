# Usar Node.js 22.18.0
FROM node:22.18.0-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de configuración de dependencias
COPY package*.json ./
COPY tsconfig.json ./
COPY knexfile.ts ./

# Instalar dependencias
RUN npm ci --only=production=false

# Copiar código fuente
COPY src/ ./src/
COPY scripts/ ./scripts/

# Compilar TypeScript
RUN npm run build

# Exponer puerto
EXPOSE 3001

# Comando por defecto (puede ser sobrescrito en docker-compose)
CMD ["npm", "start"]
