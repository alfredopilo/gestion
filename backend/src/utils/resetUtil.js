import prisma from '../config/database.js';
import bcrypt from 'bcryptjs';

/**
 * Elimina todos los registros de un modelo
 */
async function deleteMany(model, name) {
  try {
    if (!model || !model.deleteMany) {
      console.log(`⚠️  Modelo ${name} no disponible`);
      return;
    }
    const count = await model.deleteMany();
    if (count.count > 0) {
      console.log(`✅ Eliminados ${count.count} registros de ${name}`);
    }
  } catch (error) {
    // Si la tabla no existe, ignorar el error
    if (error.code === 'P2021') {
      console.log(`⚠️  Tabla para ${name} no existe, se omite`);
    } else {
      throw error;
    }
  }
}

/**
 * Limpia todas las tablas de la base de datos
 */
async function clearDatabase() {
  console.log('🗑️  Limpiando base de datos...');
  
  // Eliminar todas las tablas en el orden correcto (respetando foreign keys)
  // Primero eliminar relaciones many-to-many y tablas dependientes
  await deleteMany(prisma.userInstitution, 'UserInstitution');
  await deleteMany(prisma.courseSubjectAssignment, 'CourseSubjectAssignment');
  await deleteMany(prisma.grade, 'Grade');
  await deleteMany(prisma.attendance, 'Attendance');
  await deleteMany(prisma.payment, 'Payment');
  await deleteMany(prisma.documento, 'Documento');
  await deleteMany(prisma.mensaje, 'Mensaje');
  await deleteMany(prisma.subject, 'Subject');
  await deleteMany(prisma.course, 'Course');
  await deleteMany(prisma.student, 'Student');
  await deleteMany(prisma.teacher, 'Teacher');
  await deleteMany(prisma.representante, 'Representante');
  await deleteMany(prisma.secretaria, 'Secretaria');
  await deleteMany(prisma.subPeriod, 'SubPeriod');
  await deleteMany(prisma.period, 'Period');
  await deleteMany(prisma.schoolYear, 'SchoolYear');
  await deleteMany(prisma.user, 'User');
  await deleteMany(prisma.institution, 'Institution');
  await deleteMany(prisma.setting, 'Setting');
  
  // También limpiar otras tablas que puedan existir
  try {
    await deleteMany(prisma.enrollment, 'Enrollment');
    await deleteMany(prisma.studentWithdrawal, 'StudentWithdrawal');
    await deleteMany(prisma.gradeScale, 'GradeScale');
    await deleteMany(prisma.gradeScaleDetail, 'GradeScaleDetail');
    await deleteMany(prisma.studentProfileSection, 'StudentProfileSection');
    await deleteMany(prisma.studentProfileField, 'StudentProfileField');
    await deleteMany(prisma.studentProfileValue, 'StudentProfileValue');
    await deleteMany(prisma.assignmentSchedule, 'AssignmentSchedule');
    await deleteMany(prisma.insumo, 'Insumo');
  } catch (error) {
    // Ignorar errores si las tablas no existen
    console.log('⚠️  Algunas tablas no existen, se omiten');
  }
  
  console.log('\n✅ Base de datos limpiada exitosamente!\n');
}

/**
 * Ejecuta el seed de la base de datos
 * Reutiliza la lógica del archivo seed.js
 */
async function runSeed() {
  console.log('🌱 Iniciando seed de la base de datos...');
  
  const { randomUUID } = await import('crypto');

  // Crear institución base
  const institucion = await prisma.institution.upsert({
    where: { codigo: 'IEE-001' },
    update: {
      activa: true,
      updatedAt: new Date(),
    },
    create: {
      id: randomUUID(),
      nombre: 'Institución Educativa Ejemplo',
      codigo: 'IEE-001',
      direccion: 'Av. Principal 123, Quito',
      telefono: '+593 2 1234567',
      email: 'info@gestionescolar.edu',
      activa: true,
      rector: 'Ana Torres',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  console.log('✅ Institución lista:', institucion.nombre);

  // Crear año lectivo activo
  const schoolYear = await prisma.schoolYear.upsert({
    where: {
      institucionId_nombre: {
        institucionId: institucion.id,
        nombre: '2024-2025',
      },
    },
    update: {
      activo: true,
      updatedAt: new Date(),
    },
    create: {
      id: randomUUID(),
      institucionId: institucion.id,
      nombre: '2024-2025',
      ano: 2024,
      fechaInicio: new Date('2024-09-01'),
      fechaFin: new Date('2025-07-15'),
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  console.log('✅ Año lectivo activo:', schoolYear.nombre);

  // Crear usuario administrador
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@gestionescolar.edu' },
    update: { institucionId: institucion.id, numeroIdentificacion: '123456' },
    create: {
      nombre: 'Administrador',
      apellido: 'Sistema',
      email: 'admin@gestionescolar.edu',
      passwordHash: adminPassword,
      rol: 'ADMIN',
      estado: 'ACTIVO',
      institucionId: institucion.id,
      numeroIdentificacion: '123456',
    },
  });

  await prisma.userInstitution.upsert({
    where: {
      userId_institucionId: {
        userId: admin.id,
        institucionId: institucion.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      institucionId: institucion.id,
    },
  });

  console.log('✅ Usuario administrador creado:', admin.email);

  // Crear período académico
  const anioEscolar = '2024-2025';
  let periodoActual = await prisma.period.findFirst({
    where: { 
      anioEscolar: anioEscolar,
      nombre: 'Primer Quimestre',
    },
  });
  
  if (!periodoActual) {
    periodoActual = await prisma.period.create({
      data: {
        id: randomUUID(),
        nombre: 'Primer Quimestre',
        anioEscolar: anioEscolar,
        anioLectivoId: schoolYear.id,
        fechaInicio: new Date('2024-09-01'),
        fechaFin: new Date('2025-01-31'),
        calificacionMinima: 7.0,
        ponderacion: 50.0,
        activo: true,
        orden: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } else {
    periodoActual = await prisma.period.update({
      where: { id: periodoActual.id },
      data: {
        anioLectivoId: schoolYear.id,
        anioEscolar: anioEscolar,
        activo: true,
        updatedAt: new Date(),
      },
    });
  }

  // Crear subperíodos
  const subPeriodosData = [
    {
      id: randomUUID(),
      periodoId: periodoActual.id,
      nombre: 'Primer Parcial',
      ponderacion: 40.0,
      orden: 1,
      fechaInicio: new Date('2024-09-01'),
      fechaFin: new Date('2024-10-31'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: randomUUID(),
      periodoId: periodoActual.id,
      nombre: 'Segundo Parcial',
      ponderacion: 40.0,
      orden: 2,
      fechaInicio: new Date('2024-11-01'),
      fechaFin: new Date('2024-12-15'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: randomUUID(),
      periodoId: periodoActual.id,
      nombre: 'Examen Quimestral',
      ponderacion: 20.0,
      orden: 3,
      fechaInicio: new Date('2025-01-15'),
      fechaFin: new Date('2025-01-31'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await prisma.subPeriod.createMany({
    data: subPeriodosData,
    skipDuplicates: true,
  });
  console.log('✅ Período académico creado:', periodoActual.nombre);

  // Crear profesor de ejemplo
  const profesorPassword = await bcrypt.hash('profesor123', 10);
  const profesorUser = await prisma.user.upsert({
    where: { email: 'profesor@gestionescolar.edu' },
    update: { institucionId: institucion.id, numeroIdentificacion: '654321' },
    create: {
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'profesor@gestionescolar.edu',
      passwordHash: profesorPassword,
      rol: 'PROFESOR',
      estado: 'ACTIVO',
      institucionId: institucion.id,
      numeroIdentificacion: '654321',
    },
  });

  await prisma.userInstitution.upsert({
    where: {
      userId_institucionId: {
        userId: profesorUser.id,
        institucionId: institucion.id,
      },
    },
    update: {},
    create: {
      userId: profesorUser.id,
      institucionId: institucion.id,
    },
  });

  const profesor = await prisma.teacher.upsert({
    where: { userId: profesorUser.id },
    update: {
      updatedAt: new Date(),
    },
    create: {
      userId: profesorUser.id,
      especialidad: 'Matemáticas',
      titulo: 'Licenciado en Matemáticas',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  console.log('✅ Profesor creado:', profesorUser.email);

  // Crear curso
  let curso = await prisma.course.findFirst({
    where: {
      nombre: 'Primero de Bachillerato',
      nivel: 'Bachillerato',
      paralelo: 'A',
      periodoId: periodoActual.id,
    },
  });
  
  if (!curso) {
    curso = await prisma.course.create({
      data: {
        nombre: 'Primero de Bachillerato',
        nivel: 'Bachillerato',
        paralelo: 'A',
        docenteId: profesor.id,
        periodoId: periodoActual.id,
        anioLectivoId: schoolYear.id,
        capacidad: 30,
      },
    });
  } else if (!curso.docenteId) {
    curso = await prisma.course.update({
      where: { id: curso.id },
      data: {
        docenteId: profesor.id,
        anioLectivoId: schoolYear.id,
      },
    });
  } else if (!curso.anioLectivoId) {
    curso = await prisma.course.update({
      where: { id: curso.id },
      data: { anioLectivoId: schoolYear.id },
    });
  }
  console.log('✅ Curso creado:', curso.nombre);

  // Crear materias
  const materias = [
    { nombre: 'Matemáticas', codigo: 'MAT-001' },
    { nombre: 'Lengua y Literatura', codigo: 'LL-001' },
    { nombre: 'Ciencias Naturales', codigo: 'CN-001' },
    { nombre: 'Estudios Sociales', codigo: 'ES-001' },
  ];

  for (const materia of materias) {
    const subject = await prisma.subject.upsert({
      where: {
        codigo_institucionId_anioLectivoId: {
          codigo: materia.codigo,
          institucionId: institucion.id,
          anioLectivoId: schoolYear.id,
        },
      },
      update: {
        nombre: materia.nombre,
        horas: 4,
      },
      create: {
        id: randomUUID(),
        nombre: materia.nombre,
        codigo: materia.codigo,
        creditos: 1,
        horas: 4,
        institucionId: institucion.id,
        anioLectivoId: schoolYear.id,
      },
    });

    await prisma.courseSubjectAssignment.upsert({
      where: {
        materiaId_cursoId: {
          materiaId: subject.id,
          cursoId: curso.id,
        },
      },
      update: {
        docenteId: profesor.id,
      },
      create: {
        materiaId: subject.id,
        cursoId: curso.id,
        docenteId: profesor.id,
      },
    });
  }
  console.log('✅ Materias creadas:', materias.length);

  // Crear estudiante de ejemplo
  const estudiantePassword = await bcrypt.hash('estudiante123', 10);
  const estudianteUser = await prisma.user.upsert({
    where: { email: 'estudiante@gestionescolar.edu' },
    update: { institucionId: institucion.id, numeroIdentificacion: '789012' },
    create: {
      nombre: 'María',
      apellido: 'González',
      email: 'estudiante@gestionescolar.edu',
      passwordHash: estudiantePassword,
      rol: 'ESTUDIANTE',
      estado: 'ACTIVO',
      institucionId: institucion.id,
      numeroIdentificacion: '789012',
    },
  });

  await prisma.userInstitution.upsert({
    where: {
      userId_institucionId: {
        userId: estudianteUser.id,
        institucionId: institucion.id,
      },
    },
    update: {},
    create: {
      userId: estudianteUser.id,
      institucionId: institucion.id,
    },
  });

  const estudiante = await prisma.student.upsert({
    where: { userId: estudianteUser.id },
    update: {
      grupoId: curso.id,
    },
    create: {
      userId: estudianteUser.id,
      fechaNacimiento: new Date('2008-05-15'),
      lugarNacimiento: 'Quito',
      genero: 'Femenino',
      grupoId: curso.id,
    },
  });
  console.log('✅ Estudiante creado:', estudianteUser.email);

  // Crear representante
  const representantePassword = await bcrypt.hash('representante123', 10);
  const representanteUser = await prisma.user.upsert({
    where: { email: 'representante@gestionescolar.edu' },
    update: { institucionId: institucion.id, numeroIdentificacion: '321654' },
    create: {
      nombre: 'Carlos',
      apellido: 'González',
      email: 'representante@gestionescolar.edu',
      passwordHash: representantePassword,
      rol: 'REPRESENTANTE',
      estado: 'ACTIVO',
      institucionId: institucion.id,
      numeroIdentificacion: '321654',
    },
  });

  await prisma.userInstitution.upsert({
    where: {
      userId_institucionId: {
        userId: representanteUser.id,
        institucionId: institucion.id,
      },
    },
    update: {},
    create: {
      userId: representanteUser.id,
      institucionId: institucion.id,
    },
  });

  const representante = await prisma.representante.upsert({
    where: { userId: representanteUser.id },
    update: {
      parentesco: 'Padre',
      ocupacion: 'Ingeniero',
      updatedAt: new Date(),
    },
    create: {
      id: randomUUID(),
      userId: representanteUser.id,
      parentesco: 'Padre',
      ocupacion: 'Ingeniero',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await prisma.student.update({
    where: { id: estudiante.id },
    data: { representanteId: representante.id },
  });
  console.log('✅ Representante creado y asignado');

  // Configuraciones iniciales
  const configuraciones = [
    { clave: 'nombre_institucion', valor: 'Institución Educativa Ejemplo', descripcion: 'Nombre de la institución' },
    { clave: 'direccion', valor: 'Av. Principal 123, Quito', descripcion: 'Dirección de la institución' },
    { clave: 'telefono', valor: '+593 2 1234567', descripcion: 'Teléfono de contacto' },
    { clave: 'email_institucion', valor: 'info@gestionescolar.edu', descripcion: 'Email institucional' },
    { clave: 'escala_notas', valor: '0-10', descripcion: 'Escala de calificaciones' },
  ];

  for (const config of configuraciones) {
    await prisma.setting.upsert({
      where: { clave: config.clave },
      update: {
        valor: config.valor,
        descripcion: config.descripcion,
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        ...config,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
  console.log('✅ Configuraciones iniciales creadas');

  console.log('\n🎉 Seed completado exitosamente!');

  return {
    credentials: {
      admin: {
        email: 'admin@gestionescolar.edu',
        password: 'admin123',
        numeroIdentificacion: '123456',
      },
      profesor: {
        email: 'profesor@gestionescolar.edu',
        password: 'profesor123',
        numeroIdentificacion: '654321',
      },
      estudiante: {
        email: 'estudiante@gestionescolar.edu',
        password: 'estudiante123',
        numeroIdentificacion: '789012',
      },
      representante: {
        email: 'representante@gestionescolar.edu',
        password: 'representante123',
        numeroIdentificacion: '321654',
      },
    },
    institution: {
      nombre: institucion.nombre,
      codigo: institucion.codigo,
    },
  };
}

/**
 * Restablece la base de datos: elimina todas las tablas y carga datos iniciales
 * @returns {Promise<Object>} Información de credenciales y datos creados
 */
export async function resetDatabase() {
  try {
    // Limpiar base de datos
    await clearDatabase();
    
    // Ejecutar seed
    const seedResult = await runSeed();
    
    return seedResult;
  } catch (error) {
    console.error('❌ Error al restablecer base de datos:', error);
    throw error;
  }
}

