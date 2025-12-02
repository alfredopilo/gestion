import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateMatriculas() {
  try {
    console.log('🔄 Iniciando migración de matrículas...');

    // Obtener todos los estudiantes con matrícula y curso asignado
    const students = await prisma.$queryRaw`
      SELECT s.id, s.user_id, s.grupo_id, s.matricula, c.anio_lectivo_id, u.institucion_id
      FROM students s
      INNER JOIN users u ON s.user_id = u.id
      LEFT JOIN courses c ON s.grupo_id = c.id
      WHERE s.matricula IS NOT NULL AND s.matricula != ''
    `;

    console.log(`📊 Encontrados ${students.length} estudiantes con matrícula`);

    // Primero, asegurarnos de que las tablas nuevas existen
    // Crear tablas si no existen (esto se hará con la migración)
    
    // Por ahora, solo mostrar qué se migrará
    for (const student of students) {
      if (student.grupo_id && student.anio_lectivo_id) {
        console.log(`  - Estudiante ${student.id}: Matrícula ${student.matricula}, Curso: ${student.grupo_id}, Año Lectivo: ${student.anio_lectivo_id}`);
      } else {
        console.log(`  ⚠️  Estudiante ${student.id}: Matrícula ${student.matricula} pero sin curso/año lectivo - se perderá`);
      }
    }

    console.log('✅ Migración preparada. Ejecuta prisma db push --accept-data-loss para aplicar los cambios.');
  } catch (error) {
    console.error('❌ Error en la migración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateMatriculas();

