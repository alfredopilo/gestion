# Implementación Completada: Sistema de Mensajería Mejorado

## Resumen de Cambios

Se ha implementado exitosamente el sistema de mensajería mejorado con las siguientes funcionalidades:

### 1. ✅ Destinatario Unificado (Estudiante, Padre o Ambos)

**Frontend: EnviarMensaje.jsx**
- Nuevo selector "A quién va dirigido" con opciones:
  - Solo al estudiante
  - Solo al representante/padre
  - Al estudiante y al representante
- El cálculo de destinatarios se hace en el frontend según la opción seleccionada
- Si se selecciona "representante" o "ambos", se incluyen los userId de los representantes en la lista de destinatarios

**Backend: mensajeController.js**
- El backend recibe la lista de `destinatarios` (user IDs) y crea mensajes para cada uno
- Los representantes ahora pueden recibir mensajes en su bandeja "Mis Mensajes"

### 2. ✅ Opciones de Canal de Envío (Sistema y/o Email)

**Frontend: EnviarMensaje.jsx**
- Checkbox "Enviar por mensaje del sistema (interno)" - por defecto activado
- Checkbox "Enviar también por correo electrónico" - por defecto desactivado
- Validación: al menos uno debe estar marcado

**Backend: mensajeController.js**
- Nuevo parámetro `enviarPorSistema` (boolean)
- Solo crea registros en la BD si `enviarPorSistema` es true
- Envía emails solo si `enviarEmail` es true
- Validación en backend para asegurar al menos un canal activo

### 3. ✅ Archivo Adjunto (Máximo 5 MB)

**Backend:**
- **Nuevo archivo:** `middleware/uploadMensaje.js`
  - Multer configurado para 5 MB máximo
  - Carpeta: `uploads/mensajes`
  - Tipos permitidos: PDF, DOC, DOCX, TXT, RTF, ODT, imágenes, Excel, ZIP, RAR
  
- **mensajeController.js:**
  - Soporte para recibir archivo en `req.file`
  - Guarda el nombre del archivo en campo `archivoAdjunto`
  - Nueva función `descargarAdjunto()` con validación de permisos (emisor o receptor)
  
- **mensajeRoutes.js:**
  - POST `/enviar` ahora usa `uploadMensaje.single('adjunto')`
  - Nueva ruta GET `/:id/adjunto` para descargar adjuntos
  
- **emailService.js:**
  - Parámetro opcional `attachments` añadido a `sendEmail()`
  - Los adjuntos se envían por email si está activado

**Frontend:**
- **EnviarMensaje.jsx:**
  - Input type="file" con validación de tamaño (5 MB)
  - Envío mediante FormData con multipart/form-data
  - Muestra información del archivo seleccionado
  
- **MisMensajes.jsx:**
  - Indicador visual de adjunto en la lista de mensajes
  - Botón "Descargar archivo adjunto" en el modal de detalle
  - Función `handleDescargarAdjunto()` que descarga el archivo

## Archivos Modificados

### Backend
1. ✅ `middleware/uploadMensaje.js` (NUEVO)
2. ✅ `services/emailService.js`
3. ✅ `controllers/mensajeController.js`
4. ✅ `routes/mensajeRoutes.js`

### Frontend
5. ✅ `pages/EnviarMensaje.jsx`
6. ✅ `pages/MisMensajes.jsx`

### Infraestructura
7. ✅ Directorio `backend/uploads/mensajes/` creado

## Flujo de Datos

```
Usuario → EnviarMensaje.jsx
  ↓
  - Selecciona destinatario (estudiante/representante/ambos)
  - Escribe mensaje + adjunto opcional
  - Elige canal: sistema y/o email
  ↓
POST /api/v1/mensajes/enviar (FormData)
  ↓
uploadMensaje middleware (guarda archivo si existe)
  ↓
mensajeController.enviarMensaje()
  ↓
  Si enviarPorSistema = true:
    - Crea registros Mensaje en BD (uno por destinatario)
    - Guarda archivoAdjunto si existe
  ↓
  Si enviarEmail = true:
    - Envía correos con adjunto si existe
    - Usa destinatario para determinar emails
  ↓
Respuesta → Frontend (mensajes creados + emails enviados)
```

## Descarga de Adjuntos

```
Usuario ve mensaje en MisMensajes.jsx
  ↓
Click en "Descargar archivo adjunto"
  ↓
GET /api/v1/mensajes/:id/adjunto
  ↓
mensajeController.descargarAdjunto()
  - Verifica que user sea emisor o receptor
  - Lee archivo de uploads/mensajes/
  - Envía con Content-Disposition: attachment
  ↓
Frontend descarga el archivo
```

## Validaciones Implementadas

### Frontend
- ✅ Asunto y cuerpo requeridos
- ✅ Al menos un destinatario seleccionado
- ✅ Al menos un canal de envío marcado
- ✅ Archivo adjunto máximo 5 MB

### Backend
- ✅ Validación de destinatarios no vacíos
- ✅ Validación de al menos un canal activo (sistema o email)
- ✅ Multer valida tamaño (5 MB) y tipos de archivo
- ✅ Descarga de adjunto: solo emisor o receptor puede acceder
- ✅ Archivo adjunto debe existir en disco

## Características Destacadas

1. **Flexibilidad de Destinatarios**: Los mensajes pueden ir a estudiantes, padres o ambos, unificando el sistema de notificaciones
2. **Control de Canales**: El usuario decide explícitamente si enviar por sistema interno, email o ambos
3. **Adjuntos Seguros**: Límite de 5 MB, validación de tipos, control de acceso por permisos
4. **UX Mejorada**: Indicadores visuales de adjuntos, validaciones en tiempo real, feedback claro

## Próximos Pasos Sugeridos

Para verificar la implementación:
1. Iniciar el backend: `npm run dev` en carpeta backend
2. Iniciar el frontend: `npm run dev` en carpeta frontend
3. Probar envío de mensajes:
   - Solo a estudiantes
   - Solo a representantes
   - A ambos
4. Probar canales:
   - Solo sistema
   - Solo email
   - Ambos
5. Probar adjuntos:
   - Enviar mensaje con adjunto
   - Verificar recepción
   - Descargar adjunto
6. Verificar en base de datos que el campo `archivoAdjunto` se guarda correctamente

## Notas Técnicas

- El campo `archivoAdjunto` ya existía en el modelo Prisma, no requiere migración
- Los representantes deben tener rol REPRESENTANTE y estar asociados a estudiantes
- El middleware se ejecuta antes del controller, por lo que el archivo ya está guardado cuando llega a `req.file`
- El backend itera sobre la lista de destinatarios, creando un mensaje por cada userId
- Si un estudiante no tiene representante y se selecciona "representante" o "ambos", ese estudiante es omitido del envío
