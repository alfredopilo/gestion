import prisma from '../src/config/database.js';

console.log('Versión de Prisma Client:', prisma._clientVersion);
const dmmf = prisma._getDmmf?.();
if (dmmf) {
  console.log('Campos de SubjectCreateInput:', dmmf.modelMap.Subject.fields.map(f => f.name));
} else {
  console.log('No se pudo obtener el DMMF.');
}

await prisma.$disconnect();

