# Restaurar backup sobre base limpia

Si ya ejecutaste migraciones y luego intentaste restaurar un backup **completo** (con CREATE TABLE), verás errores "already exists" y fallos de foreign key.

**Solución:** Restaurar el backup en una base de datos **vacía** (sin tablas).

## Pasos

### 1. Detener el backend (dejar solo PostgreSQL)

```powershell
cd chatbot_api_backend
docker-compose stop api-backend
```

### 2. Borrar la base de datos y crearla de nuevo (vacía)

```powershell
docker-compose exec postgres psql -U chatbotcrm -d postgres -c "DROP DATABASE crm_chatbot;"
docker-compose exec postgres psql -U chatbotcrm -d postgres -c "CREATE DATABASE crm_chatbot;"
```

### 3. Restaurar el backup (ahora no hay tablas, el .sql las crea y llena los datos)

```powershell
Get-Content backup_crm_chatbot.sql | docker-compose exec -T postgres psql -U chatbotcrm -d crm_chatbot
```

No deberían aparecer errores de "already exists". Si ves algún ERROR, copia el mensaje.

### 4. Volver a levantar el backend

```powershell
docker-compose up -d
```

El backend arranca y ejecuta `migrate:latest`; como las tablas y `knex_migrations` ya vienen del backup, las migraciones aplicadas no se vuelven a ejecutar.

### 5. Comprobar

- http://localhost:3001/health
- Revisar en la app que existan empresas, usuarios, conversaciones, etc.

---

## Si en el futuro quieres solo datos (estructura ya existe)

En el **equipo origen** genera un backup solo de datos:

```powershell
docker-compose exec postgres pg_dump -U chatbotcrm crm_chatbot --data-only > backup_solo_datos.sql
```

En el equipo destino: primero migraciones (estructura), luego restaurar solo datos:

```powershell
Get-Content backup_solo_datos.sql | docker-compose exec -T postgres psql -U chatbotcrm -d crm_chatbot
```
