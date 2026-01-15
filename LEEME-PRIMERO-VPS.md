# ⚡ LEE ESTO PRIMERO - Problema: Cambios no se reflejan en VPS

## 🎯 Resumen del Problema

Ejecutaste `update.sh` y `vps-update.sh` pero **los cambios no se ven** porque:

1. Tu sistema está en **modo producción** (sin volúmenes montados)
2. El código está **dentro de las imágenes Docker**, no sincronizado
3. Necesitas **reconstruir las imágenes** para que los cambios se apliquen

## ✅ SOLUCIÓN RÁPIDA (5 minutos)

### Paso 1: Copiar los nuevos scripts al VPS

Sube estos archivos a tu VPS:
- `forzar-actualizacion.sh` ← **Script nuevo de solución**
- `diagnostico-vps.sh` ← **Script de diagnóstico**

### Paso 2: En el VPS, ejecuta:

```bash
# Dale permisos de ejecución
chmod +x forzar-actualizacion.sh
chmod +x diagnostico-vps.sh

# Ejecuta el script de actualización forzada
./forzar-actualizacion.sh
```

**Esto hará:**
- ✅ Detener contenedores
- ✅ Reconstruir imágenes SIN caché (todos los cambios se aplican)
- ✅ Reiniciar servicios
- ✅ Verificar que todo funcione

---

## 🔧 ALTERNATIVA: Usar vps-update.sh correctamente

Si prefieres usar el script que ya tienes:

```bash
./vps-update.sh
```

**IMPORTANTE**: Cuando te pregunte, selecciona:
- **Opción 2** (ACTUALIZACIÓN MEDIA con caché) - Recomendado
- **Opción 3** (ACTUALIZACIÓN COMPLETA sin caché) - Si hay problemas

❌ **NO uses opción 1 (RÁPIDA)** - No funciona en modo producción

---

## 🚨 ¿Sigues sin ver cambios?

### 1. Verifica que el backend esté actualizado:

```bash
# Ver logs del backend
docker compose logs backend --tail=50

# Verificar salud del backend
curl http://localhost:3001/health
```

### 2. Limpia la caché del navegador:

- **Chrome/Edge**: Ctrl+Shift+R (Windows) o Cmd+Shift+R (Mac)
- **Firefox**: Ctrl+F5 (Windows) o Cmd+Shift+R (Mac)
- O abre en **modo incógnito**

### 3. Ejecuta el diagnóstico:

```bash
./diagnostico-vps.sh
```

Esto te dirá exactamente qué está pasando.

---

## 📋 Verificar que la configuración sea correcta

### Archivo `.env` en la raíz del proyecto

Crea o edita el archivo `.env`:

```env
# IMPORTANTE: Usa la IP de tu VPS, NO localhost
VITE_API_URL=http://TU_IP_VPS:3001/api/v1

# Ejemplo con IP real:
# VITE_API_URL=http://142.93.17.71:3001/api/v1
```

**Después de crear/editar `.env`:**

```bash
docker compose down
docker compose up -d --build
```

---

## 📊 Comandos Útiles

```bash
# Ver estado de contenedores
docker compose ps

# Ver logs en tiempo real
docker compose logs -f

# Ver solo logs del backend
docker compose logs -f backend

# Reiniciar un servicio específico
docker compose restart backend

# Reconstruir solo backend
docker compose build --no-cache backend && docker compose up -d backend

# Reconstruir todo desde cero
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## 📚 Documentación Completa

Para más detalles, lee:
- **`SOLUCION-CAMBIOS-NO-SE-REFLEJAN.md`** ← Guía completa paso a paso
- **`CONFIGURACION_VPS.md`** ← Configuración general del VPS
- **`VPS-GUIA-RAPIDA.md`** ← Guía rápida de comandos

---

## 💡 Por Qué Pasa Esto

### Modo Desarrollo (NO es tu caso)
```
Código local ⟷ Volumen Docker ⟷ Contenedor
    ↓
Cambios automáticos (hot reload)
```

### Modo Producción (TU caso actual)
```
Código local ⊗ Contenedor (NO conectados)
    ↓
Necesitas REBUILD para aplicar cambios
```

---

## ✅ Checklist Final

Después de actualizar, verifica:

- [ ] `docker compose ps` - Todos los contenedores en "Up"
- [ ] `curl http://localhost:3001/health` - Backend responde
- [ ] `curl http://localhost` - Frontend responde
- [ ] Abrir navegador (limpia caché) - Ver cambios aplicados
- [ ] `docker compose logs` - No hay errores

---

## 🆘 Ayuda Adicional

**Si después de todo esto los cambios aún no se reflejan:**

1. Ejecuta: `./diagnostico-vps.sh > diagnostico.txt`
2. Revisa el archivo `diagnostico.txt`
3. Busca errores específicos en los logs

**Comandos de emergencia (limpieza completa):**

```bash
# ⚠️ CUIDADO: Esto borra todo y reconstruye desde cero
docker compose down -v
docker images | grep gestion-escolar | awk '{print $3}' | xargs docker rmi -f
docker compose up -d --build --force-recreate
```

---

**¡Listo!** Con estos scripts y comandos deberías poder actualizar tu sistema sin problemas.
