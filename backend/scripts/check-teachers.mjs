import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando docentes en la base de datos...\n');
  
  const teachers = await prisma.teacher.findMany({
    include: {
      user: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true,
          institucionId: true,
          estado: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`Total docentes encontrados: ${teachers.length}\n`);
  
  if (teachers.length === 0) {
    console.log('⚠️  No hay docentes en la base de datos');
  } else {
    teachers.forEach((teacher, index) => {
      console.log(`${index + 1}. ${teacher.user?.nombre || 'N/A'} ${teacher.user?.apellido || 'N/A'}`);
      console.log(`   Email: ${teacher.user?.email || 'N/A'}`);
      console.log(`   Estado: ${teacher.user?.estado || 'N/A'}`);
      console.log(`   Institución ID: ${teacher.user?.institucionId || 'N/A'}`);
      console.log(`   Teacher ID: ${teacher.id}`);
      console.log('');
    });
  }

  // Verificar instituciones
  const institutions = await prisma.institution.findMany({
    select: {
      id: true,
      nombre: true,
      activa: true,
    },
  });

  console.log(`\n📚 Instituciones encontradas: ${institutions.length}\n`);
  institutions.forEach((inst, index) => {
    console.log(`${index + 1}. ${inst.nombre} (${inst.activa ? 'ACTIVA' : 'INACTIVA'})`);
    console.log(`   ID: ${inst.id}`);
    console.log('');
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});

