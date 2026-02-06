# 📁 Estructura de Capas - API Backend

Este documento explica para qué sirve cada archivo y capa del proyecto API Backend.

## 🗂️ Estructura del Proyecto

```
api-backend/
├── src/                          # Código fuente
│   ├── index.ts                  # 🚀 Punto de entrada del servidor
│   └── database/                 # 🗄️ Capa de base de datos
│       ├── connection.ts         # 🔌 Conexión a PostgreSQL
│       ├── migrations/           # 📊 Migraciones (estructura de tablas)
│       │   └── 001_create_initial_tables.ts
│       └── seeds/                # 🌱 Datos de ejemplo (opcional)
│           └── 001_initial_data.ts
├── scripts/                      # 🛠️ Scripts de utilidad
│   ├── create-db.js             # Crear base de datos
│   └── verify-db.js              # Verificar estado de BD
├── knexfile.ts                   # ⚙️ Configuración de Knex
├── package.json                  # 📦 Dependencias y scripts
├── tsconfig.json                 # 🔧 Configuración TypeScript
├── .env                          # 🔐 Variables de entorno
└── .env.example                  # 📝 Ejemplo de variables
```

---

## 🚀 Capa Principal: Servidor (`src/index.ts`)

**¿Para qué sirve?**
- Punto de entrada de la aplicación
- Crea el servidor Express
- Configura middleware (JSON, URL encoded)
- Define endpoints REST
- Maneja el ciclo de vida del servidor

**Funciones principales:**
- `app.listen()` - Inicia el servidor HTTP
- `testConnection()` - Verifica conexión a BD al iniciar
- `closeConnection()` - Cierra conexión al detener el servidor

**Endpoints actuales:**
- `GET /health` - Verifica que el servidor y BD funcionen
- `GET /api` - Información básica de la API

**Cuándo se usa:**
- Al ejecutar `npm run dev` o `npm run start`
- Es el archivo principal que se ejecuta

---

## 🗄️ Capa de Base de Datos

### 1. Conexión (`src/database/connection.ts`)

**¿Para qué sirve?**
- Establece y gestiona la conexión a PostgreSQL
- Exporta la instancia `db` de Knex para usar en todo el proyecto
- Proporciona funciones de utilidad para verificar/cerrar conexión

**Qué exporta:**
```typescript
export const db          // Instancia de Knex (para hacer queries)
export testConnection()  // Verifica si la BD está conectada
export closeConnection() // Cierra la conexión
```

**Cómo se usa:**
```typescript
import { db } from './database/connection.js';

// Hacer queries
const usuarios = await db('usuarios_soporte').select('*');
```

**Cuándo se usa:**
- Cada vez que necesitas hacer una consulta a la BD
- Al iniciar el servidor (verifica conexión)
- Al cerrar el servidor (cierra conexión)

---

### 2. Migraciones (`src/database/migrations/`)

**¿Para qué sirven?**
- Crean la estructura de las tablas en la base de datos
- Versionan el esquema de la BD (como Git para la estructura)
- Permiten aplicar cambios de forma controlada

**Archivo actual:**
- `001_create_initial_tables.ts` - Crea todas las 14 tablas del sistema

**Funciones:**
- `up()` - Crea las tablas (ejecuta cuando haces `migrate:latest`)
- `down()` - Elimina las tablas (ejecuta cuando haces `migrate:rollback`)

**Cuándo se usa:**
- Primera vez: `npm run migrate:latest` (crea todas las tablas)
- Para crear nuevas tablas: `npm run migrate:make nombre` (crea nueva migración)
- Para revertir: `npm run migrate:rollback` (elimina última migración)

**Ejemplo de lo que hace:**
```typescript
// up() crea esto:
CREATE TABLE empresas (...)
CREATE TABLE usuarios_soporte (...)
CREATE TABLE contactos (...)
// etc...
```

---

### 3. Seeds (`src/database/seeds/`)

**¿Para qué sirven?**
- Poblan la base de datos con datos de ejemplo
- Útiles para desarrollo y pruebas
- **Opcionales** - No son necesarios para producción

**Archivo actual:**
- `001_initial_data.ts` - Inserta empresas, usuarios, contactos, conversaciones de ejemplo

**Cuándo se usa:**
- Solo si necesitas datos de prueba: `npm run seed:run`
- **No se ejecuta automáticamente** - Las tablas quedan vacías por defecto

---

## ⚙️ Configuración

### `knexfile.ts`

**¿Para qué sirve?**
- Configuración centralizada de Knex.js
- Define cómo conectarse a PostgreSQL
- Especifica dónde están las migraciones y seeds
- Tiene configuraciones para `development` y `production`

**Qué contiene:**
- Credenciales de conexión (desde `.env`)
- Ruta de migraciones y seeds
- Configuración del pool de conexiones

**Cuándo se usa:**
- Automáticamente cuando usas `db` desde `connection.ts`
- Cuando ejecutas comandos de migración (`migrate:latest`, etc.)

---

### `.env`

**¿Para qué sirve?**
- Almacena variables de entorno sensibles
- Configuración específica de tu entorno
- **No se commitea** al repositorio (está en `.gitignore`)

**Variables importantes:**
```env
DB_HOST=localhost        # Dónde está PostgreSQL
DB_PORT=5432            # Puerto de PostgreSQL
DB_NAME=crm_chatbot     # Nombre de la BD
DB_USER=postgres        # Usuario de PostgreSQL
DB_PASSWORD=postgres    # Contraseña
PORT=3001               # Puerto del servidor Express
```

**Cuándo se usa:**
- Se carga automáticamente al iniciar la aplicación
- Todas las configuraciones la leen desde aquí

---

### `package.json`

**¿Para qué sirve?**
- Define las dependencias del proyecto
- Contiene los scripts npm disponibles
- Metadatos del proyecto

**Scripts importantes:**
- `dev` - Inicia servidor en desarrollo
- `migrate:latest` - Ejecuta migraciones
- `db:create` - Crea la BD

**Cuándo se usa:**
- Al instalar: `npm install` (lee las dependencias)
- Al ejecutar comandos: `npm run dev`

---

## 🛠️ Scripts de Utilidad

### `scripts/create-db.js`

**¿Para qué sirve?**
- Crea la base de datos `crm_chatbot` si no existe
- Se conecta temporalmente a `postgres` (BD por defecto) para crear la nueva

**Cuándo se usa:**
- Solo la primera vez: `npm run db:create`
- Si ya existe la BD, no hace nada

**Nota:** Si ya creaste la BD manualmente o con Docker, este script no es necesario.

---

### `scripts/verify-db.js`

**¿Para qué sirve?**
- Verifica el estado de la base de datos
- Muestra qué tablas existen
- Muestra qué migraciones se ejecutaron
- Muestra cuántos datos hay en cada tabla

**Cuándo se usa:**
- Para debugging: `npm run db:verify`
- Para verificar que todo está bien configurado

---

## 🔧 Archivos de Configuración

### `tsconfig.json`

**¿Para qué sirve?**
- Configuración del compilador TypeScript
- Define cómo compilar el código TypeScript a JavaScript
- Especifica qué archivos incluir/excluir

**Cuándo se usa:**
- Automáticamente al compilar: `npm run build`
- El editor lo usa para autocompletado y validación

---

### `.nvmrc` y `.node-version`

**¿Para qué sirven?**
- Especifican la versión de Node.js requerida (v22.18.0)
- `nvm` y otros gestores de versiones los leen automáticamente

**Cuándo se usa:**
- Al ejecutar `nvm use` en la carpeta del proyecto
- Herramientas de versionado automático

---

### `.npmrc`

**¿Para qué sirve?**
- Configuración de npm
- `engine-strict=true` - Valida que uses la versión correcta de Node.js

**Cuándo se usa:**
- Automáticamente cuando ejecutas `npm install`

---

## 📊 Flujo de Datos

```
1. Usuario ejecuta: npm run dev
   ↓
2. Se carga .env (variables de entorno)
   ↓
3. Se ejecuta src/index.ts
   ↓
4. index.ts importa connection.ts
   ↓
5. connection.ts lee knexfile.ts
   ↓
6. knexfile.ts usa variables de .env
   ↓
7. Se establece conexión a crm_chatbot
   ↓
8. Servidor Express inicia
   ↓
9. testConnection() verifica la BD
   ↓
10. Servidor listo en puerto 3001
```

---

## 🎯 Resumen por Capa

### **Capa de Aplicación** (`src/index.ts`)
- Servidor HTTP
- Endpoints REST
- Lógica de negocio

### **Capa de Base de Datos** (`src/database/`)
- **connection.ts** - Conexión a PostgreSQL
- **migrations/** - Estructura de tablas
- **seeds/** - Datos de ejemplo (opcional)

### **Capa de Configuración**
- **knexfile.ts** - Config de Knex
- **.env** - Variables de entorno
- **package.json** - Dependencias y scripts

### **Capa de Utilidades** (`scripts/`)
- **create-db.js** - Crear BD (solo primera vez)
- **verify-db.js** - Verificar estado (debugging)

---

## ✅ Lo Esencial para Funcionar

**Mínimo necesario:**
1. ✅ `src/index.ts` - Servidor
2. ✅ `src/database/connection.ts` - Conexión
3. ✅ `knexfile.ts` - Configuración
4. ✅ `.env` - Variables de entorno
5. ✅ `src/database/migrations/` - Estructura de tablas

**Opcional:**
- `scripts/` - Solo si necesitas crear/verificar BD
- `seeds/` - Solo si necesitas datos de prueba

---

## 🔄 Cómo Interactúan las Capas

```
┌─────────────────────────────────┐
│   src/index.ts (Servidor)        │
│   - Usa: connection.ts          │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│   connection.ts                 │
│   - Usa: knexfile.ts            │
│   - Exporta: db                 │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│   knexfile.ts                   │
│   - Lee: .env                   │
│   - Configura: migraciones      │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│   .env                          │
│   - Variables de entorno        │
└─────────────────────────────────┘
```

---

## 💡 Ejemplo Práctico: Crear un Endpoint

Si quieres crear un endpoint que consulte la BD:

```typescript
// En src/index.ts
import { db } from './database/connection.js';

app.get('/api/empresas', async (req, res) => {
  const empresas = await db('empresas').select('*');
  res.json(empresas);
});
```

**Flujo:**
1. Endpoint recibe request
2. Usa `db` de `connection.ts`
3. `connection.ts` usa config de `knexfile.ts`
4. `knexfile.ts` lee credenciales de `.env`
5. Se conecta a `crm_chatbot`
6. Ejecuta query
7. Retorna resultado

---

## 🎯 Conclusión

Cada capa tiene un propósito específico:
- **index.ts** = Servidor y endpoints
- **connection.ts** = Conexión a BD
- **migrations/** = Estructura de tablas
- **knexfile.ts** = Configuración
- **.env** = Credenciales y variables

Todo está conectado y apunta a `crm_chatbot`. ✅
