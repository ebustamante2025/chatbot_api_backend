# API Backend - CRM ChatBot

API Backend desarrollada con Node.js, TypeScript, Express y PostgreSQL para el sistema CRM ChatBot.

## 🚀 Características

- ✅ Node.js con TypeScript
- ✅ Express.js para el servidor
- ✅ PostgreSQL como base de datos
- ✅ Knex.js para migraciones y queries
- ✅ Docker Compose para PostgreSQL
- ✅ Sistema de migraciones automatizado

## 📋 Requisitos Previos

- **Node.js v22.18.0** (requerido)
- Docker y Docker Compose
- npm 10+ o yarn

> 💡 **Nota**: Este proyecto requiere Node.js v22.18.0. Si usas `nvm`, ejecuta `nvm use` en la carpeta del proyecto.

## 🛠️ Instalación

0. **Verificar versión de Node.js**:
   ```bash
   node --version
   # Debe ser v22.18.0
   
   # Si no tienes Node.js 22.18.0, instálalo con nvm:
   nvm install 22.18.0
   nvm use 22.18.0
   ```

1. Instalar dependencias:
```bash
cd apps/api-backend
npm install
```

2. Configurar variables de entorno:
```bash
cp .env.example .env
# Editar .env con tus configuraciones si es necesario
```

3. Iniciar PostgreSQL con Docker:
```bash
# Desde la raíz del proyecto
docker-compose up -d postgres
```

4. Ejecutar migraciones:
```bash
npm run migrate:latest
```

Esto creará todas las tablas **vacías** (solo la estructura). Las tablas estarán listas para usar sin datos de ejemplo.

> 💡 **Nota**: Si necesitas datos de prueba, puedes ejecutar `npm run seed:run` después, pero por defecto las tablas estarán vacías.

## 🚀 Desarrollo

Iniciar servidor en modo desarrollo:
```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3001`

## 📦 Scripts Disponibles

- `npm run dev` - Inicia el servidor en modo desarrollo con hot-reload
- `npm run build` - Compila TypeScript a JavaScript
- `npm run start` - Inicia el servidor en producción
- `npm run migrate:latest` - Ejecuta todas las migraciones pendientes
- `npm run migrate:rollback` - Revierte la última migración
- `npm run migrate:make <nombre>` - Crea una nueva migración
- `npm run migrate:status` - Muestra el estado de las migraciones
- `npm run seed:run` - Ejecuta los seeds (opcional)
- `npm run db:create` - Crea la base de datos si no existe
- `npm run db:verify` - Verifica el estado de la base de datos (tablas, migraciones, datos)

## 🗄️ Base de Datos

### Estructura de Tablas

El sistema incluye las siguientes tablas principales:

- **empresas**: Empresas que usan el sistema (multi-tenant)
- **usuarios_soporte**: Agentes y usuarios del CRM
- **contactos**: Clientes y prospectos
- **conversaciones**: Conversaciones entre contactos y agentes
- **mensajes**: Mensajes dentro de las conversaciones
- **adjuntos**: Archivos adjuntos
- **asignaciones**: Historial de asignaciones
- **seguimiento_atenciones**: Auditoría de acciones de agentes
- **agentes_en_linea**: Estado de presencia de agentes
- **llamadas**: Registro de llamadas de audio/video
- **participantes_llamada**: Participantes de llamadas
- **salas, miembros_salas, mensajes_salas**: Chat interno (opcional)

Para más detalles, consulta [MODELO-DATOS.md](./MODELO-DATOS.md)

### Migraciones

Las migraciones se encuentran en `src/database/migrations/`. Para crear una nueva migración:

```bash
npm run migrate:make nombre_de_la_migracion
```

## 🔧 Configuración

Las variables de entorno se configuran en el archivo `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=crm_chatbot
DB_USER=postgres
DB_PASSWORD=postgres
PORT=3001
NODE_ENV=development
```

## 📡 Endpoints

- `GET /health` - Health check del servidor y conexión a BD
- `GET /api` - Información de la API

## 🐳 Docker

### Opción 1: Solo PostgreSQL en Docker (desarrollo local)

Para ejecutar solo PostgreSQL en Docker y el backend localmente:

```bash
# Iniciar PostgreSQL
docker-compose up -d postgres

# Ejecutar backend localmente
npm run dev
```

### Opción 2: Backend completo en Docker (producción)

El backend también puede ejecutarse en Docker. Para iniciar todo:

```bash
# Desde la raíz del proyecto
docker-compose up --build
```

Esto iniciará:
- ✅ PostgreSQL (puerto 5432)
- ✅ API Backend (puerto 3001)

Las migraciones se ejecutan automáticamente al iniciar el contenedor del backend.

**Ver logs:**
```bash
docker-compose logs -f api-backend
```

**Detener servicios:**
```bash
docker-compose down
```

Para más detalles sobre Docker, consulta [DOCKER-BACKEND.md](./DOCKER-BACKEND.md)

## 📝 Estructura del Proyecto

```
api-backend/
├── src/
│   ├── database/
│   │   ├── migrations/      # Migraciones de la BD
│   │   ├── seeds/           # Datos iniciales
│   │   └── connection.ts    # Configuración de conexión
│   └── index.ts             # Punto de entrada
├── knexfile.ts              # Configuración de Knex
├── package.json             # Dependencias y scripts
├── tsconfig.json            # Configuración TypeScript
├── .nvmrc                   # Versión de Node.js para nvm
├── .node-version            # Versión de Node.js para otros gestores
├── .npmrc                   # Configuración npm
└── .env                     # Variables de entorno
```

## 🔐 Seguridad

- Nunca commitees el archivo `.env` al repositorio
- Usa variables de entorno para información sensible
- En producción, configura SSL para la conexión a PostgreSQL
