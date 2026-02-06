# 📊 Modelo de Datos - CRM ChatBot

Este documento describe el modelo de datos completo del sistema CRM ChatBot y cómo se relaciona con las funcionalidades del sistema.

## 🏗️ Arquitectura del Sistema

El sistema está dividido en dos partes principales:

1. **CRM (React)** - Para agentes/usuarios internos
2. **Widget/Chatbot (iframe)** - Para contactos/clientes externos

## 📋 Tablas del Sistema

### 1. **empresas**
Almacena las empresas que usan el sistema (multi-tenant).

```sql
- id_empresa (PK)
- nit (UNIQUE)
- nombre_empresa
- estado (activo/inactivo)
- creado_en
```

**Uso**: Cada empresa tiene su propio espacio de datos aislado.

---

### 2. **usuarios_soporte**
Usuarios internos del CRM (agentes, supervisores, administradores).

```sql
- id_usuario (PK)
- username (UNIQUE)
- tipo_documento, documento
- password_hash
- rol (ADMIN, SUPERVISOR, AGENTE)
- nivel (1-10, para permisos)
- estado
- creado_en
```

**Uso en CRM**:
- Autenticación y autorización
- Asignación de conversaciones
- Reportes por usuario

---

### 3. **contactos**
Clientes o prospectos que interactúan con el widget.

```sql
- id_contacto (PK)
- empresa_id (FK → empresas)
- tipo (CLIENTE/PROSPECTO)
- nombre, email, telefono
- tipo_documento, documento
- tags
- creado_en
```

**Índice único**: `(empresa_id, documento)` - Un contacto no puede tener el mismo documento en la misma empresa.

**Uso en Widget**:
- Identificación automática del contacto
- Búsqueda por email/teléfono/documento
- Creación automática si no existe

---

### 4. **conversaciones**
Conversaciones entre contactos y agentes.

```sql
- id_conversacion (PK)
- empresa_id (FK → empresas)
- contacto_id (FK → contactos)
- canal (WEB, WHATSAPP, EMAIL, etc.)
- tema (SOPORTE, VENTAS, COBRANZA, etc.)
- estado (EN_COLA, EN_BOT, ASIGNADA, CERRADA, etc.)
- prioridad (BAJA, MEDIA, ALTA, URGENTE)
- asignada_a_usuario_id (FK → usuarios_soporte)
- asignada_en, bloqueada_hasta
- ultima_actividad_en
- creada_en, cerrada_en
```

**Índice**: `(empresa_id, estado, creada_en)` - Para consultar bandejas eficientemente.

**Estados**:
- `EN_COLA`: Esperando asignación
- `EN_BOT`: Atendida por bot
- `ASIGNADA`: Asignada a un agente
- `CERRADA`: Finalizada

**Uso**:
- **CRM**: Bandejas (En cola, Asignadas a mí, Cerradas)
- **Widget**: Crear conversación si no existe

---

### 5. **mensajes**
Mensajes dentro de las conversaciones.

```sql
- id_mensaje (PK)
- empresa_id (FK → empresas)
- conversacion_id (FK → conversaciones)
- tipo_emisor (CONTACTO/AGENTE/BOT/SISTEMA)
- usuario_id (FK → usuarios_soporte, si es AGENTE)
- contacto_id (FK → contactos, si es CONTACTO)
- contenido
- creado_en
```

**Índice**: `(conversacion_id, creado_en)` - Para ordenar mensajes por fecha.

**Uso**:
- **CRM**: Ver historial y enviar mensajes
- **Widget**: Mostrar historial y enviar mensajes del contacto

---

### 6. **adjuntos**
Archivos adjuntos a mensajes o conversaciones.

```sql
- id_adjunto (PK)
- empresa_id (FK → empresas)
- conversacion_id (FK → conversaciones)
- mensaje_id (FK → mensajes, opcional)
- subido_por_tipo (AGENTE/CONTACTO)
- subido_por_usuario_id (FK → usuarios_soporte)
- subido_por_contacto_id (FK → contactos)
- nombre_original, mime_type, tamano_bytes
- url (ruta del archivo)
- hash_sha256 (para verificación)
- creado_en
```

**Uso**:
- Subir imágenes/documentos desde CRM o Widget
- Validar integridad con hash SHA256

---

### 7. **asignaciones**
Historial de asignaciones de conversaciones (auditoría operativa).

```sql
- id_asignacion (PK)
- empresa_id (FK → empresas)
- conversacion_id (FK → conversaciones)
- usuario_id (FK → usuarios_soporte)
- accion (ASIGNAR/TRANSFERIR/CERRAR/LIBERAR)
- razon
- creado_en
```

**Uso en CRM**:
- Registrar cada cambio de asignación
- Auditoría de quién asignó qué y cuándo
- Historial de transferencias

---

### 8. **seguimiento_atenciones**
Auditoría detallada de acciones de los agentes.

```sql
- id_seguimiento (PK)
- empresa_id (FK → empresas)
- usuario_id (FK → usuarios_soporte)
- contacto_id (FK → contactos)
- conversacion_id (FK → conversaciones)
- accion (ASIGNAR/RESPONDER/TRANSFERIR/CERRAR)
- detalle
- creado_en
```

**Índice**: `(empresa_id, usuario_id, creado_en)` - Para reportes por agente.

**Uso en CRM**:
- Reportes de productividad
- "Qué asesor atendió a qué contacto/empresa"
- Métricas de tiempo de respuesta

---

### 9. **agentes_en_linea**
Estado de presencia de los agentes.

```sql
- id (PK)
- empresa_id (FK → empresas)
- usuario_id (FK → usuarios_soporte)
- estado (DISPONIBLE/OCUPADO/AUSENTE/OFFLINE)
- capacidad_max (conversaciones simultáneas)
- ultima_actividad_en
```

**Índice único**: `(empresa_id, usuario_id)` - Un agente solo puede tener un estado por empresa.

**Uso en CRM**:
- Mostrar quién está disponible
- Distribución automática de conversaciones
- Límite de capacidad por agente

---

### 10. **llamadas**
Registro de llamadas de audio/video.

```sql
- id_llamada (PK)
- empresa_id (FK → empresas)
- conversacion_id (FK → conversaciones)
- tipo (AUDIO/VIDEO)
- estado (INICIADA, EN_CURSO, FINALIZADA, CANCELADA)
- iniciada_por_tipo (AGENTE/CONTACTO)
- iniciada_por_usuario_id (FK → usuarios_soporte)
- iniciada_por_contacto_id (FK → contactos)
- agente_asignado_id (FK → usuarios_soporte)
- webrtc_room_id (ID de la sala WebRTC)
- inicio_en, fin_en
- duracion_seg
- motivo_fin
- creado_en
```

**Uso**:
- Iniciar/recibir llamadas desde conversación
- Registrar duración y motivo de fin

---

### 11. **participantes_llamada**
Participantes de cada llamada.

```sql
- id (PK)
- llamada_id (FK → llamadas)
- tipo_participante (AGENTE/CONTACTO)
- usuario_id (FK → usuarios_soporte)
- contacto_id (FK → contactos)
- estado (CONECTADO, DESCONECTADO)
- join_en, leave_en
```

**Uso**:
- Registrar quién participó en la llamada
- Tiempo de conexión de cada participante

---

### 12. **salas** (Chat Interno - Opcional)
Salas de chat interno entre agentes.

```sql
- id_sala (PK)
- empresa_id (FK → empresas)
- name
- creado_por_usuario_id (FK → usuarios_soporte)
- creado_en
```

---

### 13. **miembros_salas**
Miembros de cada sala.

```sql
- sala_id (FK → salas)
- usuario_id (FK → usuarios_soporte)
- rol_en_sala (ADMIN, MIEMBRO)
- agregado_en
- PRIMARY KEY (sala_id, usuario_id)
```

---

### 14. **mensajes_salas**
Mensajes dentro de las salas.

```sql
- id_mensaje_sala (PK)
- sala_id (FK → salas)
- usuario_envia_id (FK → usuarios_soporte)
- contenido
- creado_en
```

---

## 🔄 Flujos de Auditoría

### Cuando un agente toma un chat (ASIGNAR)

1. **Insert en `asignaciones`**:
   ```sql
   INSERT INTO asignaciones (empresa_id, conversacion_id, usuario_id, accion, razon)
   VALUES (?, ?, ?, 'ASIGNAR', 'Asignación automática');
   ```

2. **Update en `conversaciones`**:
   ```sql
   UPDATE conversaciones 
   SET asignada_a_usuario_id = ?, 
       asignada_en = NOW(),
       estado = 'ASIGNADA'
   WHERE id_conversacion = ?;
   ```

3. **Insert en `seguimiento_atenciones`**:
   ```sql
   INSERT INTO seguimiento_atenciones (empresa_id, usuario_id, contacto_id, conversacion_id, accion, detalle)
   VALUES (?, ?, ?, ?, 'ASIGNAR', 'Conversación asignada al agente');
   ```

### Cuando el agente responde (RESPONDER)

1. **Insert en `mensajes`**:
   ```sql
   INSERT INTO mensajes (empresa_id, conversacion_id, tipo_emisor, usuario_id, contenido)
   VALUES (?, ?, 'AGENTE', ?, ?);
   ```

2. **Update en `conversaciones`**:
   ```sql
   UPDATE conversaciones 
   SET ultima_actividad_en = NOW()
   WHERE id_conversacion = ?;
   ```

3. **Insert en `seguimiento_atenciones`**:
   ```sql
   INSERT INTO seguimiento_atenciones (empresa_id, usuario_id, contacto_id, conversacion_id, accion, detalle)
   VALUES (?, ?, ?, ?, 'RESPONDER', 'Agente respondió al contacto');
   ```

### Cuando cierra la conversación (CERRAR)

1. **Update en `conversaciones`**:
   ```sql
   UPDATE conversaciones 
   SET estado = 'CERRADA',
       cerrada_en = NOW()
   WHERE id_conversacion = ?;
   ```

2. **Insert en `asignaciones`**:
   ```sql
   INSERT INTO asignaciones (empresa_id, conversacion_id, usuario_id, accion, razon)
   VALUES (?, ?, ?, 'CERRAR', 'Conversación cerrada por el agente');
   ```

3. **Insert en `seguimiento_atenciones`**:
   ```sql
   INSERT INTO seguimiento_atenciones (empresa_id, usuario_id, contacto_id, conversacion_id, accion, detalle)
   VALUES (?, ?, ?, ?, 'CERRAR', 'Conversación cerrada');
   ```

## 📊 Consultas Útiles

### Bandeja "En Cola"
```sql
SELECT c.*, co.nombre, co.email
FROM conversaciones c
JOIN contactos co ON c.contacto_id = co.id_contacto
WHERE c.empresa_id = ? 
  AND c.estado = 'EN_COLA'
ORDER BY c.creada_en ASC;
```

### Bandeja "Asignadas a Mí"
```sql
SELECT c.*, co.nombre, co.email
FROM conversaciones c
JOIN contactos co ON c.contacto_id = co.id_contacto
WHERE c.empresa_id = ?
  AND c.asignada_a_usuario_id = ?
  AND c.estado = 'ASIGNADA'
ORDER BY c.ultima_actividad_en DESC;
```

### Historial de Mensajes
```sql
SELECT m.*, 
       u.username as usuario_nombre,
       co.nombre as contacto_nombre
FROM mensajes m
LEFT JOIN usuarios_soporte u ON m.usuario_id = u.id_usuario
LEFT JOIN contactos co ON m.contacto_id = co.id_contacto
WHERE m.conversacion_id = ?
ORDER BY m.creado_en ASC;
```

### Reporte de Productividad por Agente
```sql
SELECT 
  u.username,
  COUNT(DISTINCT sa.conversacion_id) as conversaciones_atendidas,
  COUNT(CASE WHEN sa.accion = 'RESPONDER' THEN 1 END) as respuestas_enviadas,
  MIN(sa.creado_en) as primera_atencion,
  MAX(sa.creado_en) as ultima_atencion
FROM seguimiento_atenciones sa
JOIN usuarios_soporte u ON sa.usuario_id = u.id_usuario
WHERE sa.empresa_id = ?
  AND sa.creado_en >= ? -- fecha inicio
  AND sa.creado_en <= ? -- fecha fin
GROUP BY u.id_usuario, u.username;
```

## 🔐 Consideraciones de Seguridad

1. **Multi-tenant**: Todas las consultas deben filtrar por `empresa_id`
2. **Permisos**: Validar `nivel` y `rol` del usuario antes de operaciones sensibles
3. **Auditoría**: Todas las acciones importantes se registran en `seguimiento_atenciones`
4. **Transacciones**: Usar transacciones para operaciones que involucran múltiples tablas (asignaciones, mensajes, etc.)

## 🚀 Próximos Pasos

1. Crear modelos/repositorios en Node.js para cada tabla
2. Implementar validaciones de negocio
3. Agregar índices adicionales según patrones de consulta
4. Configurar backups automáticos
5. Implementar soft deletes si es necesario
