import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function updateAdmin() {
  try {
    console.log('🔄 Actualizando usuario admin...');

    // Buscar el usuario admin
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@gestionescolar.edu' },
      include: {
        institucion: true,
      },
    });

    if (!admin) {
      console.error('❌ Usuario admin no encontrado');
      return;
    }

    // Obtener la primera institución si no tiene una asignada
    let institucionId = admin.institucionId;
    if (!institucionId) {
      const primeraInstitucion = await prisma.institution.findFirst();
      if (!primeraInstitucion) {
        console.error('❌ No hay instituciones disponibles');
        return;
      }
      institucionId = primeraInstitucion.id;
      console.log(`📌 Usando institución: ${primeraInstitucion.nombre}`);
    }

    // Hashear la nueva contraseña
    const newPasswordHash = await bcrypt.hash('123456', 10);

    // Actualizar el usuario
    const updatedAdmin = await prisma.user.update({
      where: { email: 'admin@gestionescolar.edu' },
      data: {
        numeroIdentificacion: '123456',
        passwordHash: newPasswordHash,
        institucionId: institucionId,
      },
    });

    console.log('✅ Usuario admin actualizado exitosamente');
    console.log(`📋 Número de identificación: ${updatedAdmin.numeroIdentificacion}`);
    console.log(`🔑 Contraseña: 123456`);
    console.log(`🏫 Institución ID: ${updatedAdmin.institucionId}`);

    // Asegurar que el usuario tenga acceso a la institución
    const userInstitution = await prisma.userInstitution.findFirst({
      where: {
        userId: updatedAdmin.id,
        institucionId: institucionId,
      },
    });

    if (!userInstitution) {
      await prisma.userInstitution.create({
        data: {
          userId: updatedAdmin.id,
          institucionId: institucionId,
        },
      });
      console.log('✅ Acceso a institución creado');
    }
  } catch (error) {
    console.error('❌ Error al actualizar usuario admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdmin();

