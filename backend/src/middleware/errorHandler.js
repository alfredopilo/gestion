/**
 * Middleware para manejo de errores
 */
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Errores de validación de Prisma
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'Ya existe un registro con estos datos.',
      details: err.meta?.target,
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Registro no encontrado.',
    });
  }

  // Errores de validación de Zod
  if (err.name === 'ZodError') {
    const firstError = err.issues[0];
    const errorMessage = firstError?.message || 'Error de validación';
    const errorPath = firstError?.path?.join('.') || '';
    
    return res.status(400).json({
      error: errorMessage,
      field: errorPath,
      details: err.issues,
    });
  }

  // Errores de validación generales
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Error de validación',
      details: err.errors || err.issues,
    });
  }

  // Errores JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token inválido.',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expirado.',
    });
  }

  // Error por defecto
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * Middleware para rutas no encontradas
 */
export const notFound = (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada.',
    path: req.originalUrl,
  });
};

