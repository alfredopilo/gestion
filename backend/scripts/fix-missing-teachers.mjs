import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando usuarios PROFESOR sin registro Teacher...\n');
  
  // Obtener todos los usuarios con rol PROFESOR
  const profesores = await prisma.user.findMany({
    where: {
      rol: 'PROFESOR',
      estado: 'ACTIVO',
    },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      institucionId: true,
    },
  });

  console.log(`Total usuarios PROFESOR encontrados: ${profesores.length}\n`);

  // Obtener todos los registros Teacher existentes
  const teachers = await prisma.teacher.findMany({
    select: {
      userId: true,
    },
  });

  const teacherUserIds = new Set(teachers.map(t => t.userId));
  
  // Encontrar profesores sin registro Teacher
  const profesoresSinTeacher = profesores.filter(p => !teacherUserIds.has(p.id));

  console.log(`Profesores sin registro Teacher: ${profesoresSinTeacher.length}\n`);

  if (profesoresSinTeacher.length === 0) {
    console.log('✅ Todos los profesores tienen registro Teacher');
  } else {
    console.log('Profesores que necesitan registro Teacher:');
    profesoresSinTeacher.forEach((profesor, index) => {
      console.log(`${index + 1}. ${profesor.nombre} ${profesor.apellido} (${profesor.email})`);
      console.log(`   Institución ID: ${profesor.institucionId}`);
    });

    console.log('\n🔧 Creando registros Teacher faltantes...\n');

    for (const profesor of profesoresSinTeacher) {
      try {
        await prisma.teacher.create({
          data: {
            userId: profesor.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        console.log(`✅ Registro Teacher creado para: ${profesor.nombre} ${profesor.apellido}`);
      } catch (error) {
        console.error(`❌ Error al crear Teacher para ${profesor.nombre} ${profesor.apellido}:`, error.message);
      }
    }
  }

  // Verificar resultado final
  const finalTeachers = await prisma.teacher.findMany({
    include: {
      user: {
        select: {
          nombre: true,
          apellido: true,
          email: true,
          institucionId: true,
          estado: true,
        },
      },
    },
  });

  console.log(`\n📊 Resumen final:`);
  console.log(`Total registros Teacher: ${finalTeachers.length}`);
  console.log(`Profesores activos con Teacher: ${finalTeachers.filter(t => t.user?.estado === 'ACTIVO').length}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});

