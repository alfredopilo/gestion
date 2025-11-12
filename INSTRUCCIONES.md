# 🔧 Solución de Problemas - Frontend No Muestra Nada

Si el frontend no muestra nada en el navegador, sigue estos pasos:

## ✅ Verificación Rápida

1. **Abre las Herramientas de Desarrollador del navegador** (F12)
   - Ve a la pestaña "Console" (Consola)
   - Busca errores en rojo
   - Copia cualquier error que aparezca

2. **Verifica la URL**
   - Debe ser: `http://localhost:5173`
   - No uses `https://` ni otro puerto

3. **Limpia la caché del navegador**
   - Presiona `Ctrl + Shift + R` (Windows/Linux)
   - O `Cmd + Shift + R` (Mac)
   - Esto fuerza una recarga sin caché

## 🔍 Verificación de Servicios

Ejecuta estos comandos para verificar que todo esté funcionando:

```bash
# Ver estado de contenedores
docker-compose ps

# Ver logs del frontend
docker-compose logs frontend --tail 50

# Ver logs del backend
docker-compose logs backend --tail 50

# Reiniciar todo
docker-compose restart
```

## 🌐 Verificar Accesibilidad

1. **Frontend debe estar en**: http://localhost:5173
2. **Backend API debe estar en**: http://localhost:3000
3. **Swagger Docs en**: http://localhost:3000/api-docs

## 🐛 Errores Comunes

### Error: "Cannot GET /"
- **Solución**: Asegúrate de acceder a `http://localhost:5173/login` o `http://localhost:5173/`

### Error: "Failed to fetch" o errores de CORS
- **Solución**: Verifica que el backend esté corriendo en el puerto 3000
- Verifica la variable `VITE_API_URL` en el docker-compose.yml

### Página en blanco sin errores
- Abre la consola del navegador (F12)
- Ve a la pestaña "Network" (Red)
- Recarga la página
- Busca archivos que fallen al cargar (aparecen en rojo)

## 🔄 Reinicio Completo

Si nada funciona, reinicia completamente:

```bash
# Detener todo
docker-compose down

# Eliminar volúmenes (¡CUIDADO! Esto borra la base de datos)
# docker-compose down -v

# Levantar de nuevo
docker-compose up -d --build

# Esperar que inicien los servicios
timeout /t 10

# Verificar logs
docker-compose logs frontend
docker-compose logs backend
```

## 📞 Información para Debug

Si necesitas ayuda, proporciona:

1. **Errores en la consola del navegador** (F12 → Console)
2. **Logs del frontend**: `docker-compose logs frontend`
3. **Logs del backend**: `docker-compose logs backend`
4. **Sistema operativo**: Windows/Mac/Linux
5. **Navegador usado**: Chrome/Firefox/Edge

## ✅ Prueba de Acceso Directo

Prueba acceder directamente a estos endpoints:

1. Backend Health: http://localhost:3000/health
   - Debe devolver: `{"status":"OK",...}`

2. Frontend: http://localhost:5173
   - Debe mostrar la página de login

3. API Docs: http://localhost:3000/api-docs
   - Debe mostrar Swagger UI

Si estos funcionan, el problema está en el código del frontend o en la configuración del navegador.


