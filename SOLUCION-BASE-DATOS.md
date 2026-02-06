# 🔧 Solución para Error de Conexión a Base de Datos

Si recibes el error `ECONNREFUSED` al intentar conectar a PostgreSQL, significa que la base de datos no está corriendo.

## ✅ Solución: Iniciar PostgreSQL con Docker

### Paso 1: Iniciar Docker Desktop

1. Abre **Docker Desktop** desde el menú de inicio
2. Espera a que Docker Desktop esté completamente iniciado (verás el ícono en la bandeja del sistema)

### Paso 2: Iniciar PostgreSQL

Desde la **raíz del proyecto** (donde está `docker-compose.yml`):

```bash
docker-compose up -d postgres
```

Esto iniciará PostgreSQL en un contenedor Docker.

### Paso 3: Verificar que PostgreSQL está corriendo

```bash
docker ps
```

Deberías ver un contenedor llamado `crm-chatbot-postgres` con estado "Up".

### Paso 4: Verificar la conexión

El backend debería poder conectarse automáticamente. Si el servidor ya está corriendo, deberías ver:

```
✅ Conexión a la base de datos establecida correctamente
```

## 🔍 Verificar Configuración

Asegúrate de que el archivo `.env` en `apps/api-backend/` tenga:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=crm_chatbot
DB_USER=postgres
DB_PASSWORD=postgres
```

## 📝 Comandos Útiles

### Ver logs de PostgreSQL:
```bash
docker-compose logs -f postgres
```

### Detener PostgreSQL:
```bash
docker-compose stop postgres
```

### Reiniciar PostgreSQL:
```bash
docker-compose restart postgres
```

### Conectar a PostgreSQL desde terminal:
```bash
docker-compose exec postgres psql -U postgres -d crm_chatbot
```

## ⚠️ Si Docker Desktop no está instalado

Si no tienes Docker Desktop instalado:

1. **Descarga Docker Desktop**: https://www.docker.com/products/docker-desktop
2. **Instálalo** y reinicia tu computadora
3. **Inicia Docker Desktop**
4. **Ejecuta** `docker-compose up -d postgres`

## 🆘 Alternativa: PostgreSQL Local

Si prefieres instalar PostgreSQL localmente en lugar de usar Docker:

1. **Instala PostgreSQL** desde: https://www.postgresql.org/download/windows/
2. **Crea la base de datos**:
   ```sql
   CREATE DATABASE crm_chatbot;
   ```
3. **Asegúrate** de que el servicio de PostgreSQL esté corriendo en Windows
