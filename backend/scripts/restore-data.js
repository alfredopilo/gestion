import prisma from '../src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../prisma/seed-data');

// Orden de importación respetando dependencias
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

async function restoreData() {
  console.log('📦 Restaurando datos desde archivos guardados...');

  if (!fs.existsSync(DATA_DIR)) {
    console.error('❌ No se encontró el directorio de datos guardados:', DATA_DIR);
    console.log('💡 Ejecuta primero: npm run save:data');
    process.exit(1);
  }

  for (const modelName of importOrder) {
    const filePath = path.join(DATA_DIR, `${modelName}.json`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Archivo no encontrado: ${modelName}.json (se omite)`);
      continue;
    }

    const modelKey = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    
    if (!prisma[modelKey]) {
      console.error(`❌ Modelo ${modelName} (${modelKey}) no encontrado en Prisma Client`);
      continue;
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      if (data.length === 0) {
        console.log(`⏭️  ${modelName}: Sin datos para restaurar`);
        continue;
      }

      // Usar createMany con skipDuplicates para evitar errores de duplicados
      const result = await prisma[modelKey].createMany({
        data: data,
        skipDuplicates: true,
      });
      
      console.log(`✅ ${modelName}: ${result.count} registros restaurados`);
    } catch (error) {
      console.error(`❌ Error restaurando ${modelName}:`, error.message);
      // Continuar con el siguiente modelo aunque falle uno
    }
  }

  console.log('\n🎉 Restauración completada!');
}

restoreData()
  .catch(e => {
    console.error('❌ Error en restauración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

