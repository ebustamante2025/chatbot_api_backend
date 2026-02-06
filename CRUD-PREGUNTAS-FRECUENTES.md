# Capas para CRUD de Preguntas Frecuentes

Resumen de las capas a crear, siguiendo la estructura actual del proyecto.

---

## Backend (api-backend)

### 1. **Capa de datos – Migración**
- **Archivo:** `src/database/migrations/005_create_preguntas_frecuentes.ts`
- **Qué hace:** Crea la tabla `preguntas_frecuentes` (id, empresa_id, pregunta, respuesta, orden, estado, creado_en, etc.).
- **Cuándo:** Una vez. Luego `npm run migrate:latest`.

### 2. **Capa de servicio (opcional pero recomendada)**
- **Archivo:** `src/services/preguntasFrecuentesService.ts`
- **Qué hace:** Lógica de negocio y acceso a BD: listar, obtener por id, crear, actualizar, eliminar. Usa `db` de `database/connection`.
- **Ventaja:** Las rutas quedan delgadas y la lógica reutilizable y fácil de testear.

### 3. **Capa de rutas (API HTTP)**
- **Archivo:** `src/routes/preguntasFrecuentes.ts`
- **Qué hace:** Endpoints REST:
  - `GET /api/preguntas-frecuentes` – listar (con filtro por empresa_id si aplica)
  - `GET /api/preguntas-frecuentes/:id` – obtener una
  - `POST /api/preguntas-frecuentes` – crear
  - `PUT /api/preguntas-frecuentes/:id` – actualizar
  - `DELETE /api/preguntas-frecuentes/:id` – eliminar
- **Middleware:** Proteger con `authMiddleware` (solo CRM autenticado).
- **Registro:** En `src/index.ts` montar el router en `/api/preguntas-frecuentes`.

---

## Frontend (crm-frontend)

### 4. **Capa de API (cliente HTTP)**
- **Archivo:** `src/services/api.ts` (o `src/services/preguntasFrecuentes.ts`)
- **Qué hace:** Funciones que llaman al backend:
  - `listarPreguntasFrecuentes(empresaId?)`
  - `obtenerPreguntaFrecuente(id)`
  - `crearPreguntaFrecuente(data)`
  - `actualizarPreguntaFrecuente(id, data)`
  - `eliminarPreguntaFrecuente(id)`
- Usar `authHeaders()` para enviar el token.

### 5. **Capa de presentación (componentes)**
- **Carpeta:** `src/components/AdminPreguntasFrecuentes/` (o un solo archivo)
- **Qué hace:**
  - Lista de preguntas frecuentes (tabla o cards).
  - Formulario para crear/editar (pregunta, respuesta, orden, etc.).
  - Botones: Nuevo, Editar, Eliminar (con confirmación).
- **Estado:** React state (useState) para lista, ítem seleccionado y modo edición/creación.
- **Uso:** Este contenido se muestra en el panel que se abre al hacer clic en **Admin Preg. Frec.** en el CRM (sustituir el placeholder actual).

---

## Flujo resumido

```
CRM (React)                          Backend (Express)
─────────────────                    ─────────────────
AdminPreguntasFrecuentes             routes/preguntasFrecuentes.ts
        │                                     │
        │  fetch /api/preguntas-frecuentes    │
        ├────────────────────────────────────►│
        │                                     ├──► services/preguntasFrecuentesService.ts
        │                                     │              │
        │                                     │              └──► db('preguntas_frecuentes')
        │                                     │
        │◄────────────────────────────────────┤
        │  JSON (lista / una / creada / etc.)
```

---

## Orden sugerido para implementar

1. Migración → tabla en BD.
2. Service (backend) → listar, crear, actualizar, eliminar, obtener por id.
3. Route (backend) → GET, POST, PUT, DELETE y registro en `index.ts`.
4. API (frontend) → funciones en `api.ts` (o módulo propio).
5. Componente(s) (frontend) → lista + formulario e integración en el panel Admin Preg. Frec.

Si quieres, el siguiente paso puede ser generar la migración y el esqueleto de rutas + servicio en el backend.
