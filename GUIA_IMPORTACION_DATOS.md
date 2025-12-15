# 📦 Guía de Exportación e Importación de Datos

Esta guía explica cómo exportar datos de ejemplo desde tu base de datos local e importarlos en el VPS.

## 📋 Índice
1. [Exportar Datos desde Local](#1-exportar-datos-desde-local)
2. [Transferir Datos al VPS](#2-transferir-datos-al-vps)
3. [Importar Datos en el VPS](#3-importar-datos-en-el-vps)
4. [Proceso Completo](#proceso-completo)

---

## 1. Exportar Datos desde Local

### Opción A: Usando el Script Automático (Recomendado)

```bash
# Dar permisos de ejecución
chmod +x export-data.sh

# Ejecutar el script
./export-data.sh
```

El script:
- ✅ Verifica que Docker esté corriendo
- ✅ Verifica que el backend esté disponible
- ✅ Exporta todos los datos a `backend/prisma/seed-data/`
- ✅ Muestra un resumen de los archivos exportados

### Opción B: Usando Docker Compose Directamente

```bash
# Asegúrate de que los contenedores estén corriendo
docker-compose up -d

# Exportar datos
docker-compose exec backend npm run save:data
```

### Opción C: Sin Docker (Desarrollo Local)

```bash
cd backend
npm run save:data
```

---

## 2. Transferir Datos al VPS

Después de exportar los datos, necesitas transferirlos al VPS. Tienes varias opciones:

### Opción A: Usando SCP (Recomendado)

```bash
# Comprimir los datos
tar -czf datos-exportados.tar.gz backend/prisma/seed-data

# Transferir al VPS
scp datos-exportados.tar.gz usuario@TU_IP_VPS:/ruta/al/proyecto/GestionEscolar/

# En el VPS, descomprimir
cd ~/GestionEscolar
tar -xzf datos-exportados.tar.gz
```

### Opción B: Usando Git (Si los datos no son sensibles)

```bash
# Agregar los datos al repositorio (temporalmente)
git add backend/prisma/seed-data
git commit -m "Datos de ejemplo para importar"
git push

# En el VPS
git pull
```

**⚠️ Nota:** Solo haz esto si los datos no contienen información sensible.

### Opción C: Usando rsync

```bash
# Sincronizar la carpeta directamente
rsync -avz backend/prisma/seed-data/ usuario@TU_IP_VPS:/ruta/al/proyecto/GestionEscolar/backend/prisma/seed-data/
```

### Opción D: Usando un Servicio de Almacenamiento

1. Sube el archivo comprimido a Google Drive, Dropbox, etc.
2. Descárgalo en el VPS
3. Descomprímelo en la ubicación correcta

---

## 3. Importar Datos en el VPS

### Opción A: Usando el Script Automático (Recomendado)

```bash
# Asegúrate de que los datos estén en: backend/prisma/seed-data/

# Dar permisos de ejecución
chmod +x import-data.sh

# Ejecutar el script
./import-data.sh
```

El script:
- ✅ Verifica que Docker esté corriendo
- ✅ Verifica que el backend esté disponible
- ✅ Verifica que existan archivos de datos
- ✅ Importa todos los datos respetando dependencias
- ✅ Muestra un resumen de los datos importados

### Opción B: Durante la Instalación

El script `install.sh` ahora pregunta si deseas importar datos al final:

```bash
./install.sh
# ... proceso de instalación ...
# Al final preguntará: "¿Deseas importar datos de ejemplo desde archivos exportados? (s/n)"
```

### Opción C: Usando Docker Compose Directamente

```bash
# Asegúrate de que los datos estén en: backend/prisma/seed-data/

# Importar datos
docker-compose exec backend npm run restore:data
```

---

## Proceso Completo

### Paso a Paso Completo

#### En tu Máquina Local:

```bash
# 1. Asegúrate de que tu base local tenga los datos que quieres exportar
docker-compose ps

# 2. Exporta los datos
./export-data.sh

# 3. Comprime los datos
tar -czf datos-exportados.tar.gz backend/prisma/seed-data

# 4. Transfiere al VPS
scp datos-exportados.tar.gz usuario@TU_IP_VPS:~/GestionEscolar/
```

#### En el VPS:

```bash
# 1. Conectarse al VPS
ssh usuario@TU_IP_VPS

# 2. Ir al directorio del proyecto
cd ~/GestionEscolar

# 3. Descomprimir los datos
tar -xzf datos-exportados.tar.gz

# 4. Verificar que los archivos estén en su lugar
ls -la backend/prisma/seed-data/

# 5. Importar los datos
./import-data.sh
```

---

## 📁 Estructura de Archivos Exportados

Los datos se exportan en `backend/prisma/seed-data/` con un archivo JSON por cada tabla:

```
backend/prisma/seed-data/
├── Institution.json
├── User.json
├── SchoolYear.json
├── Period.json
├── Student.json
├── Course.json
├── Subject.json
├── Grade.json
├── Attendance.json
└── ... (más archivos según las tablas)
```

---

## ⚠️ Notas Importantes

### Seguridad
- **No subas datos sensibles a repositorios públicos**
- Los datos exportados incluyen contraseñas hasheadas, pero es mejor mantenerlos privados
- Si los datos contienen información personal, úsalos solo en entornos de desarrollo/prueba

### Duplicados
- El script de importación usa `skipDuplicates: true`
- Si un registro ya existe (por claves únicas), se omite automáticamente
- Esto permite importar datos sin eliminar datos existentes

### Orden de Importación
Los datos se importan en un orden específico que respeta las dependencias:
1. Institution
2. User
3. SchoolYear
4. Period
5. Student
6. Course
7. Subject
8. ... (y así sucesivamente)

### IDs y Relaciones
- Los IDs se mantienen tal como están en la exportación
- Las relaciones entre tablas se preservan
- Si importas en una base de datos nueva, todo funcionará correctamente

---

## 🔧 Solución de Problemas

### Error: "No se encontró el directorio de datos"
- Verifica que la carpeta `backend/prisma/seed-data/` exista
- Verifica que contenga archivos `.json`
- Asegúrate de estar en el directorio raíz del proyecto

### Error: "PostgreSQL no está disponible"
- Verifica que el contenedor de PostgreSQL esté corriendo: `docker-compose ps`
- Verifica los logs: `docker-compose logs postgres`

### Error: "Error al importar datos"
- Verifica los logs del backend: `docker-compose logs backend`
- Algunos errores pueden ser por duplicados (se omiten automáticamente)
- Verifica que las migraciones estén aplicadas: `docker-compose exec backend npx prisma migrate status`

### Los datos no se importan completamente
- Verifica que todos los archivos JSON estén presentes
- Algunos modelos pueden fallar si hay dependencias faltantes
- Revisa los mensajes del script para ver qué modelos fallaron

---

## 📚 Comandos Útiles

### Verificar Datos Exportados
```bash
# Contar archivos exportados
find backend/prisma/seed-data -name "*.json" | wc -l

# Ver tamaño de los archivos
du -sh backend/prisma/seed-data

# Ver contenido de un archivo (ejemplo)
cat backend/prisma/seed-data/User.json | head -20
```

### Verificar Datos Importados
```bash
# Contar registros en tablas principales
docker-compose exec postgres psql -U gestionscolar -d gestion_escolar -c "
SELECT 
  'Institution' as tabla, COUNT(*) as registros FROM \"Institution\"
UNION ALL
SELECT 'User', COUNT(*) FROM \"User\"
UNION ALL
SELECT 'Student', COUNT(*) FROM \"Student\"
UNION ALL
SELECT 'Course', COUNT(*) FROM \"Course\";
"
```

### Limpiar Datos Exportados (si es necesario)
```bash
# Eliminar archivos exportados
rm -rf backend/prisma/seed-data/*.json

# O eliminar todo el directorio
rm -rf backend/prisma/seed-data
```

---

## ✅ Checklist de Importación

- [ ] Datos exportados desde local (`./export-data.sh`)
- [ ] Datos transferidos al VPS (SCP, rsync, etc.)
- [ ] Datos descomprimidos en `backend/prisma/seed-data/`
- [ ] Contenedores Docker corriendo en el VPS
- [ ] Migraciones aplicadas (`npx prisma migrate status`)
- [ ] Datos importados (`./import-data.sh`)
- [ ] Datos verificados en la base de datos
- [ ] Aplicación funcionando correctamente

---

**Última actualización:** 2025-12-13
