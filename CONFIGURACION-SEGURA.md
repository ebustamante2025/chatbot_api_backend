# Configuración segura (contraseñas en .env)

Las contraseñas y secretos ya **no** están en `docker-compose.yml`. Se leen desde el archivo `.env`, que **no se sube a Git** (está en `.gitignore`).

## Pasos

### 1. Crear tu archivo .env

En la carpeta `chatbot_api_backend`:

```powershell
copy .env.example .env
```

### 2. Editar .env con tus valores reales

Abre `.env` y reemplaza los placeholders:

- `POSTGRES_PASSWORD` y `DB_PASSWORD`: misma contraseña segura para PostgreSQL.
- `JWT_SECRET`: una cadena larga y aleatoria para el login del CRM.
- Si usas pgAdmin: `PGADMIN_DEFAULT_EMAIL` y `PGADMIN_DEFAULT_PASSWORD`.

Guarda el archivo.

### 3. Levantar los servicios

```powershell
docker-compose up -d --build
```

Docker Compose leerá `.env` automáticamente y usará esas variables en los contenedores.

## Si el backend falla con "password authentication failed"

Significa que la contraseña en `.env` **no coincide** con la que tiene PostgreSQL. La contraseña de Postgres se fijó cuando se creó el volumen la primera vez.

- Si **no** borraste el volumen de Postgres: en `.env` debes usar **la misma contraseña de antes** (la que tenías en docker-compose cuando todo funcionaba).
- Si la contraseña tiene caracteres especiales (`*`, `#`, `!`, etc.), ponla entre comillas dobles en `.env`:
  ```env
  POSTGRES_PASSWORD="E-58*/ds3+*7"
  DB_PASSWORD="E-58*/ds3+*7"
  ```
- Después: `docker-compose up -d` (el backend se reconectará).

## Reglas de seguridad

- **No** subas `.env` a Git (ya está en `.gitignore`).
- **No** compartas `.env` por correo o chat; solo en el equipo o por canal seguro.
- En producción usa contraseñas fuertes y, si puedes, un gestor de secretos (por ejemplo variables de entorno del servidor o de tu CI/CD).
- `.env.example` sí puede estar en el repo: solo tiene nombres de variables y valores de ejemplo, sin datos reales.
