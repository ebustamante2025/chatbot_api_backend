# 🔧 Solución para Error de Puerto en Uso

Si recibes el error `EADDRINUSE: address already in use :::3001`, significa que otro proceso está usando el puerto 3001.

## Opción 1: Detener el Proceso (Recomendado)

### En PowerShell:
```powershell
# Ver qué proceso está usando el puerto
netstat -ano | findstr :3001

# Detener el proceso (reemplaza PID con el número que aparezca)
taskkill /PID <PID> /F

# O usar el script incluido:
.\scripts\kill-port.ps1
```

### En CMD:
```cmd
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

## Opción 2: Cambiar el Puerto del Backend

1. Edita el archivo `.env` en `apps/api-backend/`:
```env
PORT=3003
```

2. Actualiza la URL del API en el frontend (`.env` en `apps/widget-chatbot/`):
```env
VITE_API_URL=http://localhost:3003/api
```

3. Reinicia ambos servidores.

## Opción 3: Usar npm run dev (Recomendado para desarrollo)

En lugar de `npm start`, usa:
```bash
npm run dev
```

Esto usa `tsx watch` que recarga automáticamente cuando cambias código.

## Verificar que el Puerto Está Libre

```powershell
netstat -ano | findstr :3001
```

Si no muestra nada, el puerto está libre.
