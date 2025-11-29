# Sistema de Respaldo y Restauración de Datos

Este sistema permite guardar y restaurar los datos iniciales de la base de datos.

## Scripts Disponibles

### 1. Guardar Datos Actuales
Guarda todos los datos de la base de datos en archivos JSON en `prisma/seed-data/`:

```bash
npm run save:data
```

Esto exporta todos los registros de todas las tablas a archivos JSON individuales.

### 2. Restaurar Datos Guardados
Restaura los datos previamente guardados en la base de datos:

```bash
npm run restore:data
```

### 3. Resetear Base de Datos
Limpia la base de datos y restaura los datos guardados (si existen), o crea datos iniciales básicos:

```bash
npm run reset:db
```

**Comportamiento:**
- Si existen datos guardados en `prisma/seed-data/`, los restaura automáticamente
- Si no existen datos guardados, crea datos iniciales básicos (institución y admin)

## Flujo de Trabajo Recomendado

1. **Configurar datos iniciales:**
   ```bash
   npm run prisma:seed
   ```

2. **Guardar los datos iniciales:**
   ```bash
   npm run save:data
   ```

3. **Cuando necesites restablecer la base de datos:**
   ```bash
   npm run reset:db
   ```

## Ubicación de los Datos

Los datos se guardan en: `prisma/seed-data/`

Cada tabla tiene su propio archivo JSON:
- `Institution.json`
- `User.json`
- `SchoolYear.json`
- `Course.json`
- etc.

## Notas Importantes

- Los datos se restauran respetando el orden de dependencias entre tablas
- Si un registro ya existe (por claves únicas), se omite automáticamente (`skipDuplicates: true`)
- Los archivos JSON contienen todos los campos de cada registro, incluyendo IDs, fechas, etc.

