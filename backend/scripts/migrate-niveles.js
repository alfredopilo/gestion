/**
 * Migración de datos: crea registros en tabla niveles a partir de Course.nivel (string)
 * y enlaza cada curso al nivel correspondiente.
 * Ejecutar una vez después de aplicar la migración 20260226000000_add_nivel_table_and_course_nivel_id.
 * Uso: node scripts/migrate-niveles.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NUMERO_HORAS_CLASES_DEFAULT = 40;

async function main() {
  const courses = await prisma.course.findMany({
    select: {
      id: true,
      nivel: true,
      nivelId: true,
      anioLectivoId: true,
      anioLectivo: { select: { institucionId: true } },
    },
  });

  const byInstitucionNivel = new Map();
  for (const c of courses) {
    const nombreNivel = (c.nivel || '').trim() || 'Sin nivel';
    const institucionId = c.anioLectivo?.institucionId;
    if (!institucionId) continue;
    const key = `${institucionId}|${nombreNivel}`;
    if (!byInstitucionNivel.has(key)) {
      byInstitucionNivel.set(key, { institucionId, nombreNivel });
    }
  }

  const nivelIds = new Map();
  for (const [, { institucionId, nombreNivel }] of byInstitucionNivel) {
    const nivel = await prisma.nivel.upsert({
      where: {
        institucionId_nombreNivel: { institucionId, nombreNivel },
      },
      create: {
        institucionId,
        nombreNivel,
        numeroHorasClases: NUMERO_HORAS_CLASES_DEFAULT,
      },
      update: {},
    });
    nivelIds.set(`${institucionId}|${nombreNivel}`, nivel.id);
  }

  let updated = 0;
  for (const c of courses) {
    if (c.nivelId) continue;
    const institucionId = c.anioLectivo?.institucionId;
    if (!institucionId) continue;
    const nombreNivel = (c.nivel || '').trim() || 'Sin nivel';
    const nivelId = nivelIds.get(`${institucionId}|${nombreNivel}`);
    if (!nivelId) continue;
    await prisma.course.update({
      where: { id: c.id },
      data: { nivelId },
    });
    updated++;
  }

  console.log(`Niveles creados/actualizados: ${byInstitucionNivel.size}`);
  console.log(`Cursos actualizados con nivelId: ${updated}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
