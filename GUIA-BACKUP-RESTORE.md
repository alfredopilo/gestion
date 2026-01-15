# Guía de Backup y Restauración de Base de Datos

## 📋 Índice

1. [Backup desde la Interfaz Web](#backup-desde-la-interfaz-web)
2. [Backup Manual (Terminal)](#backup-manual-terminal)
3. [Restaurar Backup](#restaurar-backup)
4. [Solución de Problemas](#solución-de-problemas)

---

## 📦 Backup desde la Interfaz Web

### Generar Backup

1. Iniciar sesión como administrador
2. Ir a **Configuración** > **Respaldo de Base de Datos**
3. Click en **"Generar y Descargar Backup"**
4. El archivo `.sql.gz` se descargará automáticamente

**Nombre del archivo**: `backup_gestion_escolar_YYYY-MM-DDTHH-MM-SS.sql.gz`

### Restaurar Backup (desde Web)

⚠️ **ADVERTENCIA**: Restaurar un backup reemplazará TODOS los datos actuales.

1. Ir a **Configuración** > **Respaldo de Base de Datos**
2. Click en **"Seleccionar archivo"**
3. Seleccionar un archivo `.sql.gz` o `.sql`
4. Click en **"Restaurar Backup"**
5. Confirmar la acción
6. Esperar a que se complete (puede tardar varios minutos)

---

## 💻 Backup Manual (Terminal)

### En el VPS o Servidor

```bash
# Conectarse al VPS
ssh usuario@tu-servidor.com

# Ir al directorio del proyecto
cd /ruta/del/proyecto

# Crear backup manualmente
docker compose exec postgres pg_dump -U gestionscolar -d gestion_escolar | gzip > backup_manual_$(date +%Y-%m-%d_%H-%M-%S).sql.gz
```

### Descargar Backup desde VPS

```bash
# Desde tu computadora local
scp usuario@tu-servidor.com:/ruta/del/proyecto/backup_manual_*.sql.gz ./bak/
```

---

## 🔄 Restaurar Backup

### Método 1: Script Automático (Recomendado)

```bash
# Copiar el archivo de backup a la carpeta bak/
cp /ruta/del/backup.sql.gz bak/

# Ejecutar el script de restauración
./restaurar-backup.sh bak/backup.sql.gz

# O para saltar la confirmación (usar con cuidado)
./restaurar-backup.sh bak/backup.sql.gz --force

# Reiniciar backend después de restaurar
docker compose restart backend
```

### Método 2: Manual

```bash
# Si el archivo está comprimido
gunzip -c bak/backup.sql.gz | docker compose exec -T postgres psql -U gestionscolar -d gestion_escolar

# Si el archivo NO está comprimido
cat bak/backup.sql | docker compose exec -T postgres psql -U gestionscolar -d gestion_escolar

# Reiniciar backend
docker compose restart backend
```

### Características del Script `restaurar-backup.sh`

✅ **Limpia la base de datos** antes de restaurar
✅ **Desactiva foreign keys** temporalmente para evitar errores de orden
✅ **Filtra comandos problemáticos** (transaction_timeout, etc.)
✅ **Muestra progreso** en tiempo real
✅ **Detecta errores** y muestra mensajes claros
✅ **Compatible** con archivos `.sql` y `.sql.gz`

---

## 🔧 Solución de Problemas

### Error: "transaction_timeout" no reconocido

**Síntoma**: 
```
ERROR: unrecognized configuration parameter "transaction_timeout"
```

**Solución**: El script `restaurar-backup.sh` ya filtra este error automáticamente.

**Solución manual**:
```bash
gunzip -c backup.sql.gz | grep -v "^SET transaction_timeout" | docker compose exec -T postgres psql -U gestionscolar -d gestion_escolar
```

---

### Error: "multiple primary keys"

**Síntoma**:
```
ERROR: multiple primary keys for table "users" are not allowed
```

**Causa**: Estás intentando restaurar sobre una base de datos que ya tiene datos.

**Solución**: Usar el script `restaurar-backup.sh` que limpia la base de datos antes de restaurar.

---

### Error: Violación de Foreign Key

**Síntoma**:
```
ERROR: insert or update on table "students" violates foreign key constraint
```

**Causa**: Las tablas se están restaurando en el orden incorrecto.

**Solución**: El script `restaurar-backup.sh` desactiva foreign keys temporalmente.

---

### Backup muy grande

**Síntoma**: El backup tarda mucho en generarse o descargarse.

**Solución**:
1. Verificar espacio en disco:
   ```bash
   df -h
   ```

2. Comprimir mejor el backup:
   ```bash
   docker compose exec postgres pg_dump -U gestionscolar -d gestion_escolar | gzip -9 > backup_compressed.sql.gz
   ```

3. Generar backup solo de estructura (sin datos):
   ```bash
   docker compose exec postgres pg_dump -U gestionscolar -d gestion_escolar --schema-only > backup_schema.sql
   ```

---

### Restauración tarda mucho

**Síntoma**: La restauración parece estar colgada.

**Solución**:
1. Verificar si el proceso está activo:
   ```bash
   docker compose exec postgres ps aux | grep psql
   ```

2. Ver logs en tiempo real:
   ```bash
   docker compose logs -f postgres
   ```

3. Aumentar recursos del contenedor (en `docker-compose.yml`):
   ```yaml
   postgres:
     deploy:
       resources:
         limits:
           memory: 2G
   ```

---

## 📊 Verificar Datos Restaurados

Después de restaurar, verificar que los datos se cargaron correctamente:

```bash
docker compose exec postgres psql -U gestionscolar -d gestion_escolar -c "
SELECT 'users' as tabla, COUNT(*) as registros FROM users
UNION ALL SELECT 'students', COUNT(*) FROM students
UNION ALL SELECT 'courses', COUNT(*) FROM courses
UNION ALL SELECT 'institutions', COUNT(*) FROM institutions
UNION ALL SELECT 'school_years', COUNT(*) FROM school_years
ORDER BY tabla;
"
```

**Ejemplo de salida esperada**:
```
    tabla     | registros 
--------------+-----------
 courses      |        55
 institutions |         2
 school_years |         2
 students     |      1987
 users        |      2027
```

---

## 🔐 Seguridad

### Buenas Prácticas

1. **Encriptar backups** si contienen datos sensibles:
   ```bash
   # Generar backup encriptado
   docker compose exec postgres pg_dump -U gestionscolar -d gestion_escolar | gzip | openssl enc -aes-256-cbc -salt -out backup_encrypted.sql.gz.enc
   
   # Restaurar backup encriptado
   openssl enc -d -aes-256-cbc -in backup_encrypted.sql.gz.enc | gunzip | docker compose exec -T postgres psql -U gestionscolar -d gestion_escolar
   ```

2. **Almacenar en ubicación segura**: No dejar backups en carpetas públicas.

3. **Backups automáticos programados** (cron en VPS):
   ```bash
   # Editar crontab
   crontab -e
   
   # Agregar línea para backup diario a las 2 AM
   0 2 * * * cd /ruta/del/proyecto && docker compose exec -T postgres pg_dump -U gestionscolar -d gestion_escolar | gzip > /ruta/backups/backup_$(date +\%Y-\%m-\%d).sql.gz
   ```

4. **Rotar backups antiguos**:
   ```bash
   # Mantener solo los últimos 7 días
   find /ruta/backups -name "backup_*.sql.gz" -mtime +7 -delete
   ```

---

## 📌 Notas Importantes

1. **Siempre hacer backup** antes de actualizaciones importantes
2. **Probar restauración** periódicamente para asegurar que funciona
3. **Guardar múltiples copias** de backups críticos
4. **Documentar cambios** importantes en la base de datos
5. **Verificar integridad** de los datos después de restaurar

---

## 🆘 Soporte

Si tienes problemas con el backup o restauración:

1. Revisar logs del contenedor de PostgreSQL:
   ```bash
   docker compose logs postgres --tail=50
   ```

2. Verificar que PostgreSQL está funcionando:
   ```bash
   docker compose ps postgres
   docker compose exec postgres psql -U gestionscolar -d gestion_escolar -c "SELECT version();"
   ```

3. Verificar espacio en disco:
   ```bash
   df -h
   docker system df
   ```

4. Verificar permisos:
   ```bash
   ls -la bak/
   ```
