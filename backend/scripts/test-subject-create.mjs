import prisma from '../src/config/database.js';

const institucionId = '19baf615-1c0b-44d5-be7c-946bd471ddb3';
const anioLectivoId = '6fe3a89e-867b-4881-9253-ab6d5cb78785';

try {
  const subject = await prisma.subject.create({
    data: {
      nombre: 'Materia de prueba',
      codigo: `TEST-${Date.now()}`,
      creditos: 1,
      horas: 2,
      institucionId,
      anioLectivoId,
    },
  });
  console.log('Materia creada:', subject);

  await prisma.subject.delete({ where: { id: subject.id } });
} catch (error) {
  console.error('Error creando materia:', error);
} finally {
  await prisma.$disconnect();
}

