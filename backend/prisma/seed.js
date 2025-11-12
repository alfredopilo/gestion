import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

  // Crear usuario administrador
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@gestionescolar.edu' },
    update: {},
    create: {
      nombre: 'Administrador',
      apellido: 'Sistema',
      email: 'admin@gestionescolar.edu',
      passwordHash: adminPassword,
      rol: 'ADMIN',
      estado: 'ACTIVO',
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
        nombre: 'Primer Quimestre',
        anioEscolar: anioEscolar,
        fechaInicio: new Date('2024-09-01'),
        fechaFin: new Date('2025-01-31'),
        calificacionMinima: 7.0,
        ponderacion: 50.0,
        activo: true,
        orden: 1,
      },
    });
    
    // Crear subperíodos para el primer quimestre
    await prisma.subPeriod.createMany({
      data: [
        {
          periodoId: periodoActual.id,
          nombre: 'Primer Parcial',
          ponderacion: 40.0,
          orden: 1,
          fechaInicio: new Date('2024-09-01'),
          fechaFin: new Date('2024-10-31'),
        },
        {
          periodoId: periodoActual.id,
          nombre: 'Segundo Parcial',
          ponderacion: 40.0,
          orden: 2,
          fechaInicio: new Date('2024-11-01'),
          fechaFin: new Date('2024-12-15'),
        },
        {
          periodoId: periodoActual.id,
          nombre: 'Examen Quimestral',
          ponderacion: 20.0,
          orden: 3,
          fechaInicio: new Date('2025-01-15'),
          fechaFin: new Date('2025-01-31'),
        },
      ],
    });
  }
  console.log('✅ Período académico creado:', periodoActual.nombre, '-', periodoActual.anioEscolar);

  // Crear profesor de ejemplo
  const profesorPassword = await bcrypt.hash('profesor123', 10);
  const profesorUser = await prisma.user.upsert({
    where: { email: 'profesor@gestionescolar.edu' },
    update: {},
    create: {
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'profesor@gestionescolar.edu',
      passwordHash: profesorPassword,
      rol: 'PROFESOR',
      estado: 'ACTIVO',
    },
  });

  const profesor = await prisma.teacher.upsert({
    where: { userId: profesorUser.id },
    update: {},
    create: {
      userId: profesorUser.id,
      especialidad: 'Matemáticas',
      titulo: 'Licenciado en Matemáticas',
    },
  });
  console.log('✅ Profesor creado:', profesorUser.email);

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
        capacidad: 30,
      },
    });
  } else if (!curso.docenteId) {
    // Actualizar el curso existente si no tiene docente
    curso = await prisma.course.update({
      where: { id: curso.id },
      data: { docenteId: profesor.id },
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
    await prisma.subject.upsert({
      where: { codigo: materia.codigo },
      update: {},
      create: {
        ...materia,
        cursoId: curso.id,
        docenteId: profesor.id,
        creditos: 1,
        horas: 4,
      },
    });
  }
  console.log('✅ Materias creadas:', materias.length);

  // Crear estudiante de ejemplo
  const estudiantePassword = await bcrypt.hash('estudiante123', 10);
  const estudianteUser = await prisma.user.upsert({
    where: { email: 'estudiante@gestionescolar.edu' },
    update: {},
    create: {
      nombre: 'María',
      apellido: 'González',
      email: 'estudiante@gestionescolar.edu',
      passwordHash: estudiantePassword,
      rol: 'ESTUDIANTE',
      estado: 'ACTIVO',
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
    update: {},
    create: {
      nombre: 'Carlos',
      apellido: 'González',
      email: 'representante@gestionescolar.edu',
      passwordHash: representantePassword,
      rol: 'REPRESENTANTE',
      estado: 'ACTIVO',
    },
  });

  const representante = await prisma.representante.upsert({
    where: { userId: representanteUser.id },
    update: {},
    create: {
      userId: representanteUser.id,
      parentesco: 'Padre',
      ocupacion: 'Ingeniero',
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
      update: {},
      create: config,
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

