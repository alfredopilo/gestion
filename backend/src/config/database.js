import { PrismaClient } from '@prisma/client';

// Crear una nueva instancia del cliente de Prisma
// Esto asegura que siempre use la versión más reciente del cliente generado
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Verificar que el cliente tenga los campos correctos al iniciar
if (process.env.NODE_ENV === 'development') {
  console.log('🔍 Cliente de Prisma inicializado');
  console.log('📦 Versión del cliente:', '@prisma/client');
}

// Función para conectar a la base de datos
export async function connectDB() {
  try {
    await prisma.$connect();
    console.log('✅ Conectado a PostgreSQL');
    return prisma;
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error);
    throw error;
  }
}

// Función para desconectar
export async function disconnectDB() {
  await prisma.$disconnect();
}

export default prisma;

