# 🐳 Guía de Docker para API Backend

Esta guía explica cómo usar Docker para gestionar PostgreSQL en el proyecto.

## 📋 Requisitos

- Docker instalado
- Docker Compose instalado

## 🚀 Inicio Rápido

### 1. Iniciar PostgreSQL

Desde la raíz del proyecto:

```bash
docker-compose up -d postgres
```

Esto iniciará PostgreSQL en el puerto 5432.

### 2. Verificar que está corriendo

```bash
docker-compose ps
```

### 3. Ver logs

```bash
docker-compose logs -f postgres
```

### 4. Detener PostgreSQL

```bash
docker-compose down
```

Para eliminar también los volúmenes (⚠️ esto borrará los datos):

```bash
docker-compose down -v
```

## 🔧 Comandos Útiles

### Conectar a PostgreSQL desde la terminal

```bash
docker-compose exec postgres psql -U postgres -d crm_chatbot
```

### Ejecutar comandos SQL directamente

```bash
docker-compose exec postgres psql -U postgres -d crm_chatbot -c "SELECT * FROM conversations;"
```

### Backup de la base de datos

```bash
docker-compose exec postgres pg_dump -U postgres crm_chatbot > backup.sql
```

### Restaurar backup

```bash
docker-compose exec -T postgres psql -U postgres crm_chatbot < backup.sql
```

## 🛠️ pgAdmin (Opcional)

Para usar pgAdmin (interfaz gráfica para administrar PostgreSQL):

```bash
docker-compose --profile tools up -d
```

Luego accede a: `http://localhost:5050`

Credenciales:
- Email: `admin@admin.com`
- Password: `admin`

### Conectar pgAdmin al servidor PostgreSQL

1. Click derecho en "Servers" → "Create" → "Server"
2. En la pestaña "General":
   - Name: `CRM ChatBot DB`
3. En la pestaña "Connection":
   - Host name/address: `postgres` (nombre del servicio en docker-compose)
   - Port: `5432`
   - Maintenance database: `crm_chatbot`
   - Username: `postgres`
   - Password: `postgres`
4. Click "Save"

## 🔍 Troubleshooting

### El contenedor no inicia

```bash
# Ver logs detallados
docker-compose logs postgres

# Reiniciar el contenedor
docker-compose restart postgres
```

### Puerto 5432 ya está en uso

Si tienes PostgreSQL instalado localmente, puedes cambiar el puerto en `docker-compose.yml`:

```yaml
ports:
  - "5433:5432"  # Cambiar 5432 por 5433
```

Y actualizar `.env`:

```env
DB_PORT=5433
```

### Limpiar todo y empezar de nuevo

```bash
# Detener y eliminar contenedores, redes y volúmenes
docker-compose down -v

# Eliminar imágenes (opcional)
docker rmi postgres:16-alpine

# Volver a iniciar
docker-compose up -d postgres
```

## 📊 Persistencia de Datos

Los datos se almacenan en un volumen de Docker llamado `postgres_data`. Esto significa que los datos persisten incluso si detienes el contenedor.

Para ver los volúmenes:

```bash
docker volume ls
```

Para inspeccionar el volumen:

```bash
docker volume inspect crm-chatbot_postgres_data
```

## 🔐 Seguridad

⚠️ **Importante**: La configuración por defecto usa credenciales simples (`postgres/postgres`). En producción:

1. Cambia las contraseñas en `docker-compose.yml`
2. Usa variables de entorno para las credenciales
3. No expongas el puerto 5432 públicamente
4. Configura SSL para las conexiones

## 🌐 Redes Docker

Los servicios están en la red `crm-chatbot-network`. Si necesitas conectar otros servicios, pueden usar el nombre del servicio (`postgres`) como hostname.
