# 📝 Cambios Realizados para Docker

Este documento resume todos los cambios realizados para que el backend funcione en Docker.

## ✅ Archivos Creados

### 1. `Dockerfile`
- **Ubicación:** `apps/api-backend/Dockerfile`
- **Propósito:** Define cómo construir la imagen Docker del backend
- **Características:**
  - Usa Node.js 22.18.0 Alpine (imagen ligera)
  - Instala dependencias
  - Compila TypeScript
  - Expone puerto 3001

### 2. `.dockerignore`
- **Ubicación:** `apps/api-backend/.dockerignore`
- **Propósito:** Excluye archivos innecesarios de la imagen Docker
- **Excluye:** `node_modules`, `.env`, logs, archivos temporales

### 3. `DOCKER-BACKEND.md`
- **Ubicación:** `apps/api-backend/DOCKER-BACKEND.md`
- **Propósito:** Documentación completa sobre cómo usar Docker con el backend
- **Contenido:** Guía paso a paso, comandos útiles, troubleshooting

## 🔄 Archivos Modificados

### 1. `docker-compose.yml` (raíz del proyecto)
- **Cambio:** Agregado servicio `api-backend`
- **Configuración:**
  - Construye desde `./apps/api-backend/Dockerfile`
  - Variables de entorno configuradas
  - Depende de PostgreSQL (espera que esté saludable)
  - Ejecuta migraciones automáticamente al iniciar
  - Expone puerto 3001

### 2. `.env.example`
- **Cambio:** Agregado comentario sobre `DB_HOST`
- **Nota:** En Docker usar `DB_HOST=postgres`, en local usar `DB_HOST=localhost`

### 3. `README.md`
- **Cambio:** Actualizada sección de Docker
- **Agregado:** Dos opciones de ejecución (solo PostgreSQL vs todo en Docker)
- **Agregado:** Referencia a `DOCKER-BACKEND.md`

## 🎯 Cambios Clave

### Variable de Entorno `DB_HOST`

**Importante:** En Docker, el backend debe conectarse a PostgreSQL usando el nombre del servicio:

```yaml
# En docker-compose.yml
DB_HOST=postgres  # ✅ Nombre del servicio, no "localhost"
```

```env
# En .env (desarrollo local)
DB_HOST=localhost  # ✅ Para desarrollo fuera de Docker
```

### Migraciones Automáticas

El contenedor ejecuta migraciones automáticamente:

```yaml
command: sh -c "npm run migrate:latest && npm start"
```

Esto asegura que las tablas estén creadas antes de iniciar el servidor.

## 🚀 Cómo Usar

### Desarrollo Local (sin Docker para backend)

```bash
# 1. Iniciar solo PostgreSQL
docker-compose up -d postgres

# 2. Ejecutar backend localmente
cd apps/api-backend
npm run dev
```

### Producción/Desarrollo con Docker

```bash
# Desde la raíz del proyecto
docker-compose up --build
```

Esto iniciará PostgreSQL y el backend en contenedores.

## 📊 Estructura de Red Docker

```
┌─────────────────────────────────────┐
│   crm-chatbot-network                │
│                                      │
│  ┌──────────────┐  ┌──────────────┐ │
│  │  postgres    │  │  api-backend │ │
│  │  :5432       │  │  :3001       │ │
│  └──────────────┘  └──────────────┘ │
│                                      │
└─────────────────────────────────────┘
```

Ambos servicios están en la misma red, por eso `api-backend` puede conectarse a `postgres` usando el nombre del servicio.

## ✅ Checklist de Verificación

- [x] Dockerfile creado
- [x] .dockerignore creado
- [x] docker-compose.yml actualizado con servicio api-backend
- [x] Variables de entorno configuradas (DB_HOST=postgres)
- [x] Migraciones automáticas configuradas
- [x] Documentación actualizada
- [x] README.md actualizado

## 🔍 Próximos Pasos

1. **Probar la configuración:**
   ```bash
   docker-compose up --build
   ```

2. **Verificar que funciona:**
   ```bash
   curl http://localhost:3001/health
   ```

3. **Ver logs:**
   ```bash
   docker-compose logs -f api-backend
   ```

## 📚 Documentación Relacionada

- [DOCKER-BACKEND.md](./DOCKER-BACKEND.md) - Guía completa de Docker
- [README.md](./README.md) - Documentación general
- [ESTRUCTURA-CAPAS.md](./ESTRUCTURA-CAPAS.md) - Explicación de 


cuando mirgo tabalas  como recontruir el  contenedor 

PS C:\Users\ebustamante\Desktop\ProyectosDesarrollo\CrmChatBot\apps\api-backend> docker-compose build

PS C:\Users\ebustamante\Desktop\ProyectosDesarrollo\CrmChatBot\apps\api-backend> docker-compose up -d

