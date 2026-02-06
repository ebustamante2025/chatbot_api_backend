# 🐳 Docker - Backend API

Guía para ejecutar el backend API en Docker.

## 📋 Requisitos Previos

- Docker instalado
- Docker Compose instalado

## 🚀 Inicio Rápido

### 1. Construir y ejecutar todos los servicios

```bash
# Desde la raíz del proyecto
docker-compose up --build
```

Esto iniciará:
- ✅ PostgreSQL (puerto 5432)
- ✅ API Backend (puerto 3001)

### 2. Solo ejecutar el backend (si PostgreSQL ya está corriendo)

```bash
docker-compose up api-backend --build
```

### 3. Ejecutar en segundo plano

```bash
docker-compose up -d
```

## 🔧 Configuración

### Variables de Entorno

El backend usa estas variables (definidas en `docker-compose.yml`):

```env
DB_HOST=postgres          # Nombre del servicio en Docker
DB_PORT=5432
DB_NAME=crm_chatbot
DB_USER=postgres
DB_PASSWORD=postgres
PORT=3001
NODE_ENV=production
```

**Nota importante:** En Docker, `DB_HOST` debe ser `postgres` (nombre del servicio), no `localhost`.

### Migraciones Automáticas

El contenedor ejecuta automáticamente las migraciones al iniciar:

```yaml
command: sh -c "npm run migrate:latest && npm start"
```

## 📝 Comandos Útiles

### Ver logs del backend

```bash
docker-compose logs -f api-backend
```

### Ejecutar comandos dentro del contenedor

```bash
# Acceder al shell del contenedor
docker-compose exec api-backend sh

# Ejecutar migraciones manualmente
docker-compose exec api-backend npm run migrate:latest

# Verificar estado de la BD
docker-compose exec api-backend npm run db:verify
```

### Reconstruir el contenedor

```bash
docker-compose up --build api-backend
```

### Detener servicios

```bash
# Detener todos
docker-compose down

# Detener y eliminar volúmenes (⚠️ borra datos de BD)
docker-compose down -v
```

## 🏗️ Estructura del Dockerfile

```
1. Usa Node.js 22.18.0 Alpine (imagen ligera)
2. Copia package.json y tsconfig.json
3. Instala dependencias (npm ci)
4. Copia código fuente
5. Compila TypeScript (npm run build)
6. Expone puerto 3001
7. Ejecuta npm start
```

## 🔍 Verificar que Funciona

1. **Verificar que el contenedor está corriendo:**
   ```bash
   docker-compose ps
   ```

2. **Probar el endpoint de health:**
   ```bash
   curl http://localhost:3001/health
   ```

3. **Probar el endpoint raíz:**
   ```bash
   curl http://localhost:3001/
   ```

## 🐛 Troubleshooting

### El backend no se conecta a PostgreSQL

**Problema:** `Error: connect ECONNREFUSED`

**Solución:** Verifica que:
- PostgreSQL esté corriendo: `docker-compose ps postgres`
- `DB_HOST=postgres` (no `localhost`) en docker-compose.yml
- Ambos servicios estén en la misma red: `crm-chatbot-network`

### Las migraciones fallan

**Problema:** `Error: relation "knex_migrations" does not exist`

**Solución:**
```bash
# Ejecutar migraciones manualmente
docker-compose exec api-backend npm run migrate:latest
```

### El puerto 3001 ya está en uso

**Problema:** `Error: listen EADDRINUSE`

**Solución:** Cambia el puerto en `docker-compose.yml`:
```yaml
ports:
  - "3002:3001"  # Puerto externo:interno
```

## 📊 Desarrollo vs Producción

### Desarrollo (local)

```bash
# Ejecutar sin Docker
npm run dev
```

### Producción (Docker)

```bash
# Ejecutar con Docker
docker-compose up api-backend
```

## 🔄 Actualizar el Backend

Si cambias el código:

```bash
# Reconstruir y reiniciar
docker-compose up --build api-backend
```

## 📦 Volúmenes

Actualmente no se usan volúmenes para el código (se copia en la imagen).
Para desarrollo con hot-reload, puedes agregar:

```yaml
volumes:
  - ./apps/api-backend/src:/app/src
  - ./apps/api-backend/scripts:/app/scripts
```

Y cambiar el comando a:
```yaml
command: sh -c "npm run migrate:latest && npm run dev"
```

## ✅ Checklist

- [ ] Docker y Docker Compose instalados
- [ ] `docker-compose.yml` configurado
- [ ] `Dockerfile` creado
- [ ] Variables de entorno correctas (`DB_HOST=postgres`)
- [ ] Migraciones ejecutándose automáticamente
- [ ] Backend accesible en `http://localhost:3001`
