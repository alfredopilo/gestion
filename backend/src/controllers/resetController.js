import { resetDatabase } from '../utils/resetUtil.js';

/**
 * Restablecer la base de datos: eliminar todas las tablas y cargar datos iniciales
 */
export const resetDatabaseEndpoint = async (req, res, next) => {
  try {
    console.log('🔄 Iniciando restablecimiento de base de datos...');
    
    // Ejecutar el reset
    const result = await resetDatabase();
    
    console.log('✅ Base de datos restablecida exitosamente');
    
    res.json({
      message: 'Base de datos restablecida exitosamente.',
      credentials: result.credentials,
      institution: result.institution,
    });
  } catch (error) {
    console.error('❌ Error al restablecer base de datos:', error);
    
    res.status(500).json({
      error: error.message || 'Error al restablecer la base de datos.',
    });
  }
};

