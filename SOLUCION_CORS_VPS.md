# 🔧 Solución Error CORS - Restauración de Backup en VPS

## 📋 Problema

Error CORS al intentar restaurar un respaldo desde la aplicación:
- **Error**: "Solicitud de origen cruzado bloqueada"
- **Endpoint afectado**: `http://142.93.17.71:3000/api/v1/backup/upload`
- **Causa**: El navegador bloquea la solicitud porque el frontend (puerto 80) y backend (puerto 3000) son orígenes diferentes

## ✅ Solución Aplicada

Se ha actualizado la configuración CORS en `backend/src/server.js` para:
1. Manejar correctamente las solicitudes OPTIONS (preflight)
2. Incluir headers necesarios para multipart/form-data
3. Permitir credenciales y exponer headers personalizados

## 🚀 Pasos para Aplicar en el VPS

### Opción 1: Si usas Docker Compose (Recomendado)

```bash
# 1. Conectarse al VPS por SSH
ssh usuario@142.93.17.71

# 2. Navegar al directorio del proyecto
cd /ruta/al/proyecto/GestionEscolar

# 3. Detener el contenedor del backend
docker-compose stop backend

# 4. Reconstruir la imagen del backend con los nuevos cambios
docker-compose build backend

# 5. Iniciar el backend
docker-compose up -d backend

# 6. Verificar los logs para asegurar que inició correctamente
docker-compose logs backend --tail 50
```

### Opción 2: Si el código está en el VPS y necesitas actualizarlo

```bash
# 1. Conectarse al VPS por SSH
ssh usuario@142.93.17.71

# 2. Navegar al directorio del proyecto
cd /ruta/al/proyecto/GestionEscolar

# 3. Si usas Git, hacer pull de los cambios
git pull origin main  # o la rama que uses

# 4. Reconstruir y reiniciar
docker-compose build backend
docker-compose up -d backend

# 5. Verificar logs
docker-compose logs backend --tail 50
```

### Opción 3: Si ejecutas Node.js directamente (sin Docker)

```bash
# 1. Conectarse al VPS por SSH
ssh usuario@142.93.17.71

# 2. Navegar al directorio del backend
cd /ruta/al/proyecto/GestionEscolar/backend

# 3. Si usas Git, hacer pull
git pull origin main

# 4. Reiniciar el proceso Node.js
# Si usas PM2:
pm2 restart gestion-escolar-backend

# Si usas systemd:
sudo systemctl restart gestion-escolar-backend

# Si ejecutas directamente:
# Detener el proceso actual (Ctrl+C) y luego:
npm start
```

## 🔍 Verificación

Después de aplicar los cambios, verifica que todo funcione:

### 1. Verificar que el backend responde

```bash
# Desde el VPS o desde tu máquina local
curl http://142.93.17.71:3000/health
```

Debería responder:
```json
{"status":"OK","timestamp":"...","service":"Gestión Escolar API"}
```

### 2. Verificar CORS con una solicitud OPTIONS

```bash
curl -X OPTIONS http://142.93.17.71:3000/api/v1/backup/upload \
  -H "Origin: http://142.93.17.71" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -v
```

Deberías ver en los headers de respuesta:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH`
- `Access-Control-Allow-Headers: ...`

### 3. Probar desde el navegador

1. Abre la aplicación en: `http://142.93.17.71`
2. Intenta restaurar un backup
3. Abre la consola del navegador (F12) y verifica que no haya errores CORS

## 🔥 Verificación de Firewall

Si el problema persiste, verifica el firewall:

```bash
# Si usas UFW
sudo ufw status
sudo ufw allow 3000/tcp

# Si usas firewalld
sudo firewall-cmd --list-ports
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload

# Si usas iptables directamente
sudo iptables -L -n | grep 3000
```

## 📝 Cambios Realizados

Los cambios aplicados en `backend/src/server.js` incluyen:

1. **Headers CORS mejorados**:
   - Agregado `Content-Disposition` a los headers permitidos
   - Configurado `Access-Control-Allow-Credentials: true`
   - Agregado `Access-Control-Expose-Headers`

2. **Manejo mejorado de OPTIONS**:
   - Respuesta más robusta para solicitudes preflight
   - Uso de `res.status(200).end()` en lugar de `res.sendStatus(200)`

3. **Configuración del middleware cors()**:
   - Opciones explícitas para métodos, headers y credenciales
   - Cacheo de preflight con `maxAge: 86400`

## ⚠️ Notas Importantes

- **Seguridad**: La configuración actual permite todos los orígenes (`*`). Para producción, considera restringir a dominios específicos.
- **Credenciales**: Si restringes los orígenes, asegúrate de que `Access-Control-Allow-Credentials` y el origen específico sean compatibles.
- **Reinicio**: Después de aplicar los cambios, siempre reinicia el servicio backend.

## 🆘 Si el Problema Persiste

1. **Verifica los logs del backend**:
   ```bash
   docker-compose logs backend --tail 100
   ```

2. **Verifica la configuración de red**:
   - Asegúrate de que el backend escuche en `0.0.0.0:3000` (no solo `localhost`)
   - Verifica que el puerto 3000 esté abierto

3. **Verifica la URL del frontend**:
   - Asegúrate de que el frontend esté configurado para usar `http://142.93.17.71:3000` como URL base de la API

4. **Revisa la consola del navegador**:
   - Abre F12 → Console
   - Busca errores específicos de CORS o red

## 📞 Soporte

Si después de seguir estos pasos el problema persiste, proporciona:
- Logs del backend (`docker-compose logs backend`)
- Mensaje de error completo de la consola del navegador
- Resultado de `curl http://142.93.17.71:3000/health`
