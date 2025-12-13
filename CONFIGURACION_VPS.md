# 🌐 Configuración para Despliegue en VPS

## ❌ Problema: Error CORS al hacer login

Si ves el error: **"Solicitud de origen cruzado bloqueada"** o **"CORS"**, es porque el frontend está intentando conectarse a `localhost:3000` en lugar de la IP del VPS.

## ✅ Solución

### Paso 1: Configurar la URL del Backend en el Frontend

1. **Crea un archivo `.env` en la carpeta `frontend/`** con el siguiente contenido:

```env
VITE_API_URL=http://TU_IP_VPS:3000/api/v1
```

**Ejemplo** (reemplaza con tu IP real):
```env
VITE_API_URL=http://142.93.17.71:3000/api/v1
```

2. **Si usas un dominio**, puedes usar:
```env
VITE_API_URL=http://tudominio.com:3000/api/v1
```

### Paso 2: Verificar que el Backend escucha en todas las interfaces

El backend ya está configurado para escuchar en `0.0.0.0`, lo que permite conexiones externas. Si necesitas cambiarlo, puedes agregar en el archivo `.env` del backend:

```env
HOST=0.0.0.0
PORT=3000
```

### Paso 3: Reconstruir el Frontend

Después de crear el archivo `.env`, necesitas reconstruir el frontend para que las variables de entorno se incluyan:

```bash
cd frontend
npm run build
```

O si usas Docker:

```bash
docker-compose down
docker-compose up -d --build
```

### Paso 4: Verificar que los puertos estén abiertos

Asegúrate de que los puertos estén abiertos en el firewall de tu VPS:

```bash
# Para Ubuntu/Debian
sudo ufw allow 3000/tcp
sudo ufw allow 5173/tcp
sudo ufw reload
```

### Paso 5: Verificar que el Backend esté corriendo

Verifica que el backend esté accesible desde fuera:

```bash
curl http://TU_IP_VPS:3000/health
```

Deberías recibir una respuesta JSON con el estado "OK".

## 🔍 Verificación

1. **Backend accesible**: Abre en el navegador `http://TU_IP_VPS:3000/health`
2. **Frontend accesible**: Abre en el navegador `http://TU_IP_VPS:5173`
3. **Sin errores CORS**: Abre la consola del navegador (F12) y verifica que no haya errores de CORS

## 📝 Notas Importantes

- **No uses `localhost`** en producción, siempre usa la IP o dominio del VPS
- Las variables de entorno que empiezan con `VITE_` solo están disponibles en el frontend durante el build
- Si cambias el archivo `.env`, debes reconstruir el frontend
- El backend ya tiene CORS configurado para permitir todas las conexiones (`*`)

## 🐛 Solución de Problemas

### Error: "Cannot connect to backend"
- Verifica que el backend esté corriendo: `docker-compose ps`
- Verifica que el puerto 3000 esté abierto en el firewall
- Verifica que la IP en `VITE_API_URL` sea correcta

### Error: "CORS policy"
- Verifica que el backend esté escuchando en `0.0.0.0` (ya configurado)
- Verifica que el backend tenga CORS habilitado (ya configurado)
- Verifica que la URL en `VITE_API_URL` sea correcta y accesible
