import prisma from '../src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../prisma/seed-data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function main() {
  console.log('📦 Exportando datos actuales...');

  // Orden sugerido para evitar problemas de dependencias al importar, aunque al exportar no importa
  const models = [
    'Institution',
    'User', 
    'SchoolYear',
    'Period',
    'SubPeriod',
    'UserInstitution',
    'Teacher',
    'Student',
    'Representante',
    'Secretaria',
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

  for (const modelName of models) {
    // Convertir primera letra a minuscula para acceder a la propiedad de prisma (e.g. Institution -> institution)
    const modelKey = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    
    // Caso especial para modelos que podrían tener nombres diferentes en el cliente (aunque suelen ser camelCase del modelo)
    if (!prisma[modelKey]) {
      console.error(`❌ Modelo ${modelName} (${modelKey}) no encontrado en Prisma Client`);
      continue;
    }

    try {
      const data = await prisma[modelKey].findMany();
      fs.writeFileSync(
        path.join(DATA_DIR, `${modelName}.json`),
        JSON.stringify(data, null, 2)
      );
      console.log(`✅ ${modelName}: ${data.length} registros exportados.`);
    } catch (error) {
      console.error(`❌ Error exportando ${modelName}:`, error.message);
    }
  }

  console.log('💾 Datos guardados en prisma/seed-data/');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

