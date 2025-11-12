import prisma from '../src/config/database.js';

try {
  const count = await prisma.subject.count({
    where: {
      institucionId: '123',
      anioLectivoId: '456',
    },
  });
  console.log('Count:', count);
} catch (error) {
  console.error('Error ejecutando count:', error);
} finally {
  await prisma.$disconnect();
}

