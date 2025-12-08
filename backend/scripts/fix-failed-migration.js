#!/usr/bin/env node

/**
 * Script para resolver migraciones fallidas de Prisma
 * Uso: node scripts/fix-failed-migration.js <migration-name> <status>
 * 
 * Status puede ser:
 * - "applied": Si la migración ya fue aplicada manualmente
 * - "rolled": Si la migración debe marcarse como revertida
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixFailedMigration(migrationName, status = 'rolled') {
  try {
    console.log(`Resolviendo migración fallida: ${migrationName}`);
    console.log(`Estado: ${status}`);
    
    // Usar Prisma CLI para resolver la migración
    const { execSync } = await import('child_process');
    const command = `npx prisma migrate resolve --${status} ${migrationName}`;
    
    console.log(`Ejecutando: ${command}`);
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    
    console.log('✅ Migración resuelta exitosamente');
    console.log('Ahora puedes ejecutar: npm run prisma:migrate:deploy');
    
  } catch (error) {
    console.error('❌ Error resolviendo migración:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const migrationName = process.argv[2];
const status = process.argv[3] || 'rolled';

if (!migrationName) {
  console.error('❌ Error: Debes proporcionar el nombre de la migración');
  console.log('Uso: node scripts/fix-failed-migration.js <migration-name> [status]');
  console.log('Ejemplo: node scripts/fix-failed-migration.js 20251106114501_add_institution_and_schoolyear_to_subjects rolled');
  process.exit(1);
}

fixFailedMigration(migrationName, status);

