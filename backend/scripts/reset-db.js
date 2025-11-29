import prisma from '../src/config/database.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config();

async function deleteMany(model, name) {
  try {
    if (!model || !model.deleteMany) {
      console.log(`⚠️  Modelo ${name} no disponible`);
      return;
    }
    const count = await model.deleteMany();
    if (count.count > 0) {
      console.log(`✅ Eliminados ${count.count} registros de ${name}`);
    }
  } catch (error) {
    // Si la tabla no existe, ignorar el error
    if (error.code === 'P2021') {
      console.log(`⚠️  Tabla para ${name} no existe, se omite`);
    } else {
      throw error;
    }
  }
}

async function resetDatabase() {
  console.log('🗑️  Limpiando base de datos...');
  
  try {
    // Eliminar todas las tablas en el orden correcto (respetando foreign keys)
    // Manejar errores si las tablas no existen
    
    // Primero eliminar relaciones many-to-many y tablas dependientes
    await deleteMany(prisma.userInstitution, 'UserInstitution');
    await deleteMany(prisma.courseSubjectAssignment, 'CourseSubjectAssignment');
    await deleteMany(prisma.grade, 'Grade');
    await deleteMany(prisma.attendance, 'Attendance');
    await deleteMany(prisma.payment, 'Payment');
    await deleteMany(prisma.documento, 'Documento');
    await deleteMany(prisma.mensaje, 'Mensaje');
    await deleteMany(prisma.subject, 'Subject');
    await deleteMany(prisma.course, 'Course');
    await deleteMany(prisma.student, 'Student');
    await deleteMany(prisma.teacher, 'Teacher');
    await deleteMany(prisma.representante, 'Representante');
    await deleteMany(prisma.secretaria, 'Secretaria');
    await deleteMany(prisma.subPeriod, 'SubPeriod');
    await deleteMany(prisma.period, 'Period');
    await deleteMany(prisma.schoolYear, 'SchoolYear');
    await deleteMany(prisma.user, 'User');
    await deleteMany(prisma.institution, 'Institution');
    await deleteMany(prisma.setting, 'Setting');
    
    console.log('\n✅ Base de datos limpiada exitosamente!\n');
    
    // Verificar si existen datos guardados para restaurar
    const DATA_DIR = path.join(__dirname, '../prisma/seed-data');
    const hasSavedData = fs.existsSync(DATA_DIR) && 
                         fs.readdirSync(DATA_DIR).some(file => file.endsWith('.json'));
    
    if (hasSavedData) {
      console.log('📦 Se encontraron datos guardados. Restaurando...\n');
      
      // Restaurar datos guardados
      const importOrder = [
        'Institution',
        'User',
        'SchoolYear',
        'Period',
        'SubPeriod',
        'UserInstitution',
        'Teacher',
        'Representante',
        'Secretaria',
        'Student',
        'Course',
        'Subject',
        'CourseSubjectAssignment',
        'AssignmentSchedule',
        'Insumo',
        'Grade',
        'Attendance',
        'Payment',
        'Mensaje',
        'Documento',
        'GradeScale',
        'GradeScaleDetail',
        'Setting',
        'StudentProfileSection',
        'StudentProfileField',
        'StudentProfileValue'
      ];

      for (const modelName of importOrder) {
        const filePath = path.join(DATA_DIR, `${modelName}.json`);
        
        if (!fs.existsSync(filePath)) {
          continue;
        }

        const modelKey = modelName.charAt(0).toLowerCase() + modelName.slice(1);
        
        if (!prisma[modelKey]) {
          continue;
        }

        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          
          if (data.length === 0) {
            continue;
          }

          const result = await prisma[modelKey].createMany({
            data: data,
            skipDuplicates: true,
          });
          
          if (result.count > 0) {
            console.log(`✅ ${modelName}: ${result.count} registros restaurados`);
          }
        } catch (error) {
          console.error(`❌ Error restaurando ${modelName}:`, error.message);
        }
      }
      
      console.log('\n🎉 Base de datos restaurada exitosamente!');
    } else {
      console.log('💡 No se encontraron datos guardados. Creando datos iniciales...\n');
      
      // Crear institución de ejemplo
      console.log('🏫 Creando institución...');
      const institution = await prisma.institution.create({
        data: {
          nombre: 'Institución Educativa Ejemplo',
          codigo: 'IEE-001',
          direccion: 'Av. Principal 123, Quito',
          telefono: '+593 2 1234567',
          email: 'info@gestionescolar.edu',
          activa: true,
        },
      });
      console.log('✅ Institución creada:', institution.nombre);
      
      // Crear usuario administrador
      console.log('\n👨‍💼 Creando usuario administrador...');
      const adminPassword = await bcrypt.hash('admin123', 10);
      const admin = await prisma.user.create({
        data: {
          nombre: 'Administrador',
          apellido: 'Sistema',
          email: 'admin@gestionescolar.edu',
          numeroIdentificacion: '9999999999',
          passwordHash: adminPassword,
          rol: 'ADMIN',
          estado: 'ACTIVO',
          institucionId: institution.id,
        },
      });
      console.log('✅ Usuario administrador creado:', admin.email);
      
      // Asignar acceso a la institución a través de UserInstitution
      await prisma.userInstitution.create({
        data: {
          userId: admin.id,
          institucionId: institution.id,
        },
      });
      console.log('✅ Acceso a institución asignado al admin');
      
      console.log('\n🎉 Base de datos reiniciada y configurada exitosamente!');
      console.log('\n📋 Credenciales de acceso:');
      console.log('👨‍💼 Admin: admin@gestionescolar.edu / admin123');
      console.log('📝 Número de Identificación: 9999999999');
      console.log('🏫 Institución:', institution.nombre);
    }
    
  } catch (error) {
    console.error('❌ Error al limpiar/base de datos:', error);
    throw error;
  }
}

resetDatabase()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

