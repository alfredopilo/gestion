import http from 'http';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

async function startServer() {
  try {
    await connectDB();
    
    // Pre-conectar a la base de datos (warmup) para evitar cold start
    console.log('🔥 Precalentando conexión a base de datos...');
    const prisma = (await import('./config/database.js')).default;
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`; // Query simple para "despertar" la BD
      console.log('✅ Base de datos precalentada');
    } catch (error) {
      console.warn('⚠️  Warmup de BD falló:', error.message);
    }
    
    // Escuchar en todas las interfaces de red (0.0.0.0) para permitir conexiones externas
    const HOST = process.env.HOST || '0.0.0.0';
    server.listen(PORT, HOST, () => {
      console.log(`🚀 Servidor corriendo en http://${HOST}:${PORT}`);
      console.log(`📚 Documentación API en http://${HOST}:${PORT}/api-docs`);
      console.log(`⚡ Keep-alive habilitado para conexiones rápidas`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();

