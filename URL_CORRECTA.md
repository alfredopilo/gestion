# ⚠️ IMPORTANTE: Usa HTTP, NO HTTPS

## ❌ Error Común

Si ves el error: **"SSL_ERROR_RX_RECORD_TOO_LONG"**

Es porque estás intentando acceder con **HTTPS** cuando el servidor solo soporta **HTTP**.

## ✅ URL Correcta

**Usa esta URL (con HTTP):**
```
http://localhost:5173
```

**NO uses esta URL (con HTTPS):**
```
https://localhost:5173  ❌
```

## 🔧 Solución

1. **Borra la "s" de "https"** en la barra de direcciones
2. O copia y pega exactamente: `http://localhost:5173`
3. El navegador puede guardar la URL con HTTPS, así que asegúrate de cambiarla

## 🔄 Si el Navegador Redirige Automáticamente

Algunos navegadores intentan usar HTTPS automáticamente. Si pasa esto:

1. **Borra el caché del navegador** para localhost
2. **Escribe manualmente** `http://localhost:5173` (no dejes que el navegador "complete" con HTTPS)
3. Si usas Chrome/Edge, puedes deshabilitar "Always use secure connections" en configuración

## ✅ Servicios Funcionando

Todos los servicios están corriendo:
- ✅ Backend: http://localhost:3000
- ✅ Frontend: http://localhost:5173
- ✅ Base de datos: PostgreSQL en puerto 5432

## 📝 Credenciales de Prueba

- **Admin**: admin@gestionescolar.edu / admin123
- **Profesor**: profesor@gestionescolar.edu / profesor123
- **Estudiante**: estudiante@gestionescolar.edu / estudiante123


