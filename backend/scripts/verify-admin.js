import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function verifyAdmin() {
  try {
    console.log('🔍 Verificando usuario admin...');

    // Buscar el usuario admin
    const admin = await prisma.user.findFirst({
      where: {
        numeroIdentificacion: '123456',
      },
      include: {
        institucion: true,
      },
    });

    if (!admin) {
      console.error('❌ Usuario admin no encontrado con número de identificación 123456');
      return;
    }

    console.log('✅ Usuario admin encontrado:');
    console.log(`   ID: ${admin.id}`);
    console.log(`   Nombre: ${admin.nombre} ${admin.apellido}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Número de identificación: ${admin.numeroIdentificacion}`);
    console.log(`   Rol: ${admin.rol}`);
    console.log(`   Estado: ${admin.estado}`);
    console.log(`   Institución: ${admin.institucion?.nombre || 'Sin institución'}`);

    // Verificar contraseña
    const testPassword = '123456';
    const isValid = await bcrypt.compare(testPassword, admin.passwordHash);
    
    if (isValid) {
      console.log('✅ Contraseña válida para: 123456');
    } else {
      console.error('❌ La contraseña no coincide. Actualizando...');
      
      const newPasswordHash = await bcrypt.hash('123456', 10);
      await prisma.user.update({
        where: { id: admin.id },
        data: { passwordHash: newPasswordHash },
      });
      
      console.log('✅ Contraseña actualizada a: 123456');
    }

    // Verificar acceso a institución
    const userInstitution = await prisma.userInstitution.findFirst({
      where: {
        userId: admin.id,
      },
    });

    if (!userInstitution && admin.institucionId) {
      console.log('⚠️  No hay registro en UserInstitution. Creando...');
      await prisma.userInstitution.create({
        data: {
          userId: admin.id,
          institucionId: admin.institucionId,
        },
      });
      console.log('✅ Acceso a institución creado');
    } else if (userInstitution) {
      console.log('✅ Acceso a institución configurado');
    }

    console.log('\n📋 Credenciales para iniciar sesión:');
    console.log(`   Número de identificación: 123456`);
    console.log(`   Contraseña: 123456`);
  } catch (error) {
    console.error('❌ Error al verificar usuario admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAdmin();

