import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

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
  // Eliminar períodos con IDs inválidos primero
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const allPeriods = await prisma.period.findMany({ select: { id: true } });
  const invalidPeriodIds = allPeriods
    .filter(p => !uuidRegex.test(p.id))
    .map(p => p.id);
  
  if (invalidPeriodIds.length > 0) {
    // Verificar si hay cursos usando estos períodos
    const coursesUsingPeriods = await prisma.course.count({
      where: { periodoId: { in: invalidPeriodIds } },
    });
    
    if (coursesUsingPeriods === 0) {
      await prisma.period.deleteMany({
        where: { id: { in: invalidPeriodIds } },
      });
      console.log(`🗑️  Eliminados ${invalidPeriodIds.length} períodos con IDs inválidos`);
    }
  }
  
  // Buscar período existente o crear uno nuevo (sin ID personalizado para que use UUID)
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

  // Crear subperíodos para el primer quimestre (idempotente)
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
  console.log('✅ Período académico creado:', periodoActual.nombre, '-', periodoActual.anioEscolar);

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

  // Crear docentes adicionales para la institución
  const docentesAdicionales = [
    {
      nombre: 'Ana',
      apellido: 'Martínez',
      email: 'ana.martinez@gestionescolar.edu',
      numeroIdentificacion: '111222',
      especialidad: 'Lengua y Literatura',
      titulo: 'Licenciada en Lengua y Literatura',
    },
    {
      nombre: 'Pedro',
      apellido: 'Rodríguez',
      email: 'pedro.rodriguez@gestionescolar.edu',
      numeroIdentificacion: '222333',
      especialidad: 'Ciencias Naturales',
      titulo: 'Licenciado en Biología',
    },
    {
      nombre: 'Laura',
      apellido: 'Sánchez',
      email: 'laura.sanchez@gestionescolar.edu',
      numeroIdentificacion: '333444',
      especialidad: 'Estudios Sociales',
      titulo: 'Licenciada en Historia',
    },
  ];

  for (const docenteData of docentesAdicionales) {
    const docentePassword = await bcrypt.hash('profesor123', 10);
    const docenteUser = await prisma.user.upsert({
      where: { email: docenteData.email },
      update: { institucionId: institucion.id, numeroIdentificacion: docenteData.numeroIdentificacion },
      create: {
        nombre: docenteData.nombre,
        apellido: docenteData.apellido,
        email: docenteData.email,
        passwordHash: docentePassword,
        rol: 'PROFESOR',
        estado: 'ACTIVO',
        institucionId: institucion.id,
        numeroIdentificacion: docenteData.numeroIdentificacion,
      },
    });

    await prisma.userInstitution.upsert({
      where: {
        userId_institucionId: {
          userId: docenteUser.id,
          institucionId: institucion.id,
        },
      },
      update: {},
      create: {
        userId: docenteUser.id,
        institucionId: institucion.id,
      },
    });

    await prisma.teacher.upsert({
      where: { userId: docenteUser.id },
      update: {
        especialidad: docenteData.especialidad,
        titulo: docenteData.titulo,
        updatedAt: new Date(),
      },
      create: {
        userId: docenteUser.id,
        especialidad: docenteData.especialidad,
        titulo: docenteData.titulo,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log(`✅ Profesor creado: ${docenteUser.email}`);
  }

  // Crear curso
  // Buscar curso existente o crear uno nuevo (sin ID personalizado para que use UUID)
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
    // Actualizar el curso existente si no tiene docente
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
      grupoId: curso.id, // Actualizar grupoId en caso de que el estudiante ya exista
    },
    create: {
      userId: estudianteUser.id,
      fechaNacimiento: new Date('2008-05-15'),
      lugarNacimiento: 'Quito',
      genero: 'Femenino',
      grupoId: curso.id,
      matricula: 'EST-2024-001',
    },
  });
  console.log('✅ Estudiante creado/actualizado:', estudianteUser.email);

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

  // Actualizar estudiante con representante
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
  console.log('\n📋 Credenciales de acceso:');
  console.log('👨‍💼 Admin: admin@gestionescolar.edu / admin123');
  console.log('👨‍🏫 Profesor: profesor@gestionescolar.edu / profesor123');
  console.log('👨‍🎓 Estudiante: estudiante@gestionescolar.edu / estudiante123');
  console.log('👨‍👩‍👧 Representante: representante@gestionescolar.edu / representante123');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

