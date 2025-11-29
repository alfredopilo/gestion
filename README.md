# Sistema de Gestión Escolar

Aplicación web completa para la administración integral de una institución educativa (colegio o universidad), inspirada en RosarioSIS.

## 🚀 Características

- **Gestión de Usuarios y Roles**: Administrador, Profesor, Estudiante, Representante, Secretaria
- **Gestión de Estudiantes**: Registro, asignación a cursos, documentos, perfiles personalizados
- **Gestión Académica**: Cursos, materias, períodos lectivos, años escolares
- **Calificaciones**: Registro de notas, promedios automáticos, escalas de calificación personalizables
- **Asistencia**: Control diario, justificaciones, reportes
- **Pagos y Finanzas**: Gestión de pensiones, matrículas, estado de cuenta
- **Comunicación**: Sistema de mensajería interna
- **Reportes**: Generación de reportes en PDF/Excel
- **Insumos Académicos**: Gestión de deberes, tareas y evaluaciones por curso y materia
- **Horarios**: Asignación de horarios a materias y cursos
- **Instituciones Múltiples**: Soporte para múltiples instituciones educativas
- **Perfiles de Estudiante Personalizables**: Campos dinámicos configurables por institución
- **Respaldo y Restauración**: Sistema para guardar y restaurar datos iniciales de la base de datos

## 🛠️ Tecnologías

### Backend
- **Node.js** con **Express.js**
- **Prisma ORM** para PostgreSQL
- **JWT** para autenticación
- **Zod** para validaciones
- **Swagger** para documentación API

### Frontend
- **React 18** con **Vite**
- **TailwindCSS** para estilos
- **React Router** para navegación
- **Axios** para peticiones HTTP
- **Recharts** para gráficos

### Base de Datos
- **PostgreSQL 15**

### DevOps
- **Docker** y **Docker Compose**

## 📋 Requisitos Previos

- Docker y Docker Compose instalados
- Node.js 20+ (si ejecutas localmente)
- PostgreSQL 15 (si ejecutas localmente)

## 🚀 Instalación y Ejecución

### Opción 1: Docker Compose (Recomendado)

1. Clonar el repositorio:
```bash
git clone <url-del-repositorio>
cd gestion-escolar
```

2. Crear archivo `.env` en `backend/`:
```bash
cd backend
cp .env.example .env
# Editar .env con tus configuraciones si es necesario
```

3. Levantar los servicios:
```bash
docker-compose up -d
```

4. Generar el cliente de Prisma y ejecutar migraciones:
```bash
# Ejecutar dentro del contenedor del backend
docker-compose exec backend npm run prisma:generate
docker-compose exec backend npm run prisma:migrate
docker-compose exec backend npm run prisma:seed
```

5. Acceder a la aplicación:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - Documentación API: http://localhost:3000/api-docs

### Opción 2: Instalación Local

#### Backend

1. Navegar a la carpeta backend:
```bash
cd backend
```

2. Instalar dependencias:
```bash
npm install
```

3. Crear archivo `.env`:
```bash
NODE_ENV=development
DATABASE_URL=postgresql://gestionscolar:gestionscolar2024@localhost:5432/gestion_escolar
JWT_SECRET=mi_secreto_jwt_super_seguro_2024
JWT_EXPIRES_IN=7d
PORT=3000
```

4. Generar cliente de Prisma y ejecutar migraciones:
```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

5. Iniciar el servidor:
```bash
npm run dev
```

#### Frontend

1. Navegar a la carpeta frontend:
```bash
cd frontend
```

2. Instalar dependencias:
```bash
npm install
```

3. Crear archivo `.env`:
```bash
VITE_API_URL=http://localhost:3000/api/v1
```

4. Iniciar el servidor de desarrollo:
```bash
npm run dev
```

## 👥 Usuarios de Prueba

El seed crea los siguientes usuarios:

- **Administrador**:
  - Email: `admin@gestionescolar.edu`
  - Contraseña: `admin123`

- **Profesor**:
  - Email: `profesor@gestionescolar.edu`
  - Contraseña: `profesor123`

- **Estudiante**:
  - Email: `estudiante@gestionescolar.edu`
  - Contraseña: `estudiante123`

- **Representante**:
  - Email: `representante@gestionescolar.edu`
  - Contraseña: `representante123`

## 📁 Estructura del Proyecto

```
gestion-escolar/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── userController.js
│   │   │   ├── studentController.js
│   │   │   ├── courseController.js
│   │   │   ├── gradeController.js
│   │   │   ├── attendanceController.js
│   │   │   └── paymentController.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── errorHandler.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── userRoutes.js
│   │   │   ├── studentRoutes.js
│   │   │   ├── courseRoutes.js
│   │   │   ├── gradeRoutes.js
│   │   │   ├── attendanceRoutes.js
│   │   │   ├── paymentRoutes.js
│   │   │   └── index.js
│   │   ├── utils/
│   │   │   ├── jwt.js
│   │   │   └── validators.js
│   │   └── server.js
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── DashboardAdmin.jsx
│   │   │   ├── DashboardProfesor.jsx
│   │   │   ├── DashboardEstudiante.jsx
│   │   │   ├── DashboardRepresentante.jsx
│   │   │   ├── Users.jsx
│   │   │   ├── Students.jsx
│   │   │   ├── Courses.jsx
│   │   │   ├── Grades.jsx
│   │   │   ├── Attendance.jsx
│   │   │   ├── Payments.jsx
│   │   │   └── Profile.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## 🔌 API Endpoints

### Autenticación
- `POST /api/v1/auth/login` - Iniciar sesión
- `GET /api/v1/auth/profile` - Obtener perfil
- `PUT /api/v1/auth/change-password` - Cambiar contraseña

### Usuarios
- `GET /api/v1/users` - Listar usuarios
- `GET /api/v1/users/:id` - Obtener usuario
- `POST /api/v1/users` - Crear usuario
- `PUT /api/v1/users/:id` - Actualizar usuario
- `DELETE /api/v1/users/:id` - Eliminar usuario

### Estudiantes
- `GET /api/v1/students` - Listar estudiantes
- `GET /api/v1/students/:id` - Obtener estudiante
- `POST /api/v1/students` - Crear estudiante
- `PUT /api/v1/students/:id` - Actualizar estudiante
- `DELETE /api/v1/students/:id` - Eliminar estudiante

### Cursos
- `GET /api/v1/courses` - Listar cursos
- `GET /api/v1/courses/:id` - Obtener curso
- `POST /api/v1/courses` - Crear curso
- `PUT /api/v1/courses/:id` - Actualizar curso
- `DELETE /api/v1/courses/:id` - Eliminar curso

### Calificaciones
- `GET /api/v1/grades` - Listar calificaciones
- `GET /api/v1/grades/student/:estudianteId` - Calificaciones por estudiante
- `POST /api/v1/grades` - Crear/actualizar calificación
- `POST /api/v1/grades/bulk` - Carga masiva

### Asistencia
- `GET /api/v1/attendance` - Listar asistencia
- `GET /api/v1/attendance/summary` - Resumen de asistencia
- `POST /api/v1/attendance` - Registrar asistencia
- `POST /api/v1/attendance/bulk` - Carga masiva

### Pagos
- `GET /api/v1/payments` - Listar pagos
- `GET /api/v1/payments/:id` - Obtener pago
- `GET /api/v1/payments/student/:estudianteId` - Estado de cuenta
- `POST /api/v1/payments` - Crear pago
- `PUT /api/v1/payments/:id` - Actualizar pago

La documentación completa está disponible en http://localhost:3000/api-docs

## 🔐 Permisos por Rol

- **ADMIN**: Acceso completo al sistema
- **PROFESOR**: Gestión de cursos, calificaciones y asistencia
- **ESTUDIANTE**: Consulta de calificaciones, asistencia y pagos
- **REPRESENTANTE**: Consulta de información de estudiantes a su cargo
- **SECRETARIA**: Gestión de estudiantes, cursos y pagos

## 🗄️ Base de Datos

El esquema de la base de datos está definido en `backend/prisma/schema.prisma`. Para aplicar cambios:

```bash
npm run prisma:migrate
```

Para abrir Prisma Studio (interfaz visual):
```bash
npm run prisma:studio
```

### 💾 Respaldo y Restauración de Datos

El sistema incluye un sistema de respaldo y restauración para guardar y recuperar los datos iniciales:

1. **Guardar datos actuales**: Después de configurar tu base de datos con datos iniciales, ejecuta:
   ```bash
   npm run save:data
   ```
   Esto guardará todos los datos en `prisma/seed-data/` como archivos JSON.

2. **Restablecer base de datos**: Cuando necesites limpiar y restaurar los datos:
   ```bash
   npm run reset:db
   ```
   Este comando:
   - Limpia toda la base de datos
   - Si encuentra datos guardados, los restaura automáticamente
   - Si no hay datos guardados, crea datos iniciales básicos

3. **Restaurar datos manualmente**: Si solo quieres restaurar sin limpiar:
   ```bash
   npm run restore:data
   ```

Los datos se guardan en `prisma/seed-data/` y cada tabla tiene su propio archivo JSON. Ver `backend/scripts/README-DATA-BACKUP.md` para más detalles.

## 🧪 Desarrollo

### Comandos Backend
- `npm run dev` - Iniciar servidor en modo desarrollo
- `npm run prisma:generate` - Generar cliente de Prisma
- `npm run prisma:migrate` - Ejecutar migraciones
- `npm run prisma:seed` - Ejecutar seed
- `npm run prisma:studio` - Abrir Prisma Studio
- `npm run save:data` - Guardar datos actuales de la base de datos
- `npm run restore:data` - Restaurar datos guardados previamente
- `npm run reset:db` - Limpiar y restablecer base de datos (usa datos guardados si existen)

### Comandos Frontend
- `npm run dev` - Iniciar servidor de desarrollo
- `npm run build` - Construir para producción
- `npm run preview` - Previsualizar build de producción

## 📝 Notas

- Las contraseñas se hashean con bcrypt
- Los tokens JWT expiran en 7 días por defecto
- La API está versionada en `/api/v1`
- El frontend incluye manejo de errores y notificaciones
- Todas las rutas están protegidas según el rol del usuario

## 🐛 Troubleshooting

### Error de conexión a la base de datos
- Verificar que PostgreSQL esté corriendo
- Verificar la URL de conexión en `.env`
- Asegurarse de que las migraciones se hayan ejecutado

### Error al iniciar el frontend
- Verificar que el backend esté corriendo
- Verificar la variable `VITE_API_URL` en `.env`

### Error de permisos en Docker
- En Linux/Mac, puede ser necesario ajustar permisos: `sudo chown -R $USER:$USER .`

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 👨‍💻 Contribución

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📧 Contacto

Para más información, contacta a: info@gestionescolar.edu

