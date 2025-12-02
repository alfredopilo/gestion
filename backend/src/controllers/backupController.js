import { generateDatabaseBackup, deleteBackupFile, restoreDatabaseBackup } from '../utils/backupUtil.js';
import { createReadStream, statSync, unlink } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const unlinkAsync = promisify(unlink);

/**
 * Generar y descargar backup de la base de datos
 */
export const downloadBackup = async (req, res, next) => {
  let backupFilePath = null;

  try {
    // Generar el backup
    const { filePath, fileName } = await generateDatabaseBackup();
    backupFilePath = filePath;

    // Obtener información del archivo
    const fileStats = statSync(filePath);
    const fileSize = fileStats.size;

    // Configurar headers para la descarga
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');

    // Crear stream de lectura y enviar el archivo
    const fileStream = createReadStream(filePath);

    // Manejar errores del stream
    fileStream.on('error', (error) => {
      console.error('Error al leer archivo de backup:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Error al leer archivo de backup.',
        });
      }
    });

    // Enviar el archivo
    fileStream.pipe(res);

    // Limpiar el archivo después de enviarlo
    fileStream.on('end', async () => {
      try {
        await deleteBackupFile(filePath);
      } catch (cleanupError) {
        console.error('Error al limpiar archivo de backup:', cleanupError);
        // No afecta la respuesta si ya se envió
      }
    });

    // Manejar cierre de conexión del cliente
    req.on('close', async () => {
      if (!res.headersSent) {
        // Si el cliente cerró la conexión antes de recibir el archivo, limpiar
        try {
          await deleteBackupFile(filePath);
        } catch (cleanupError) {
          console.error('Error al limpiar archivo después de cierre de conexión:', cleanupError);
        }
      }
    });
  } catch (error) {
    console.error('Error al generar backup:', error);

    // Limpiar archivo si se creó parcialmente
    if (backupFilePath) {
      try {
        await deleteBackupFile(backupFilePath);
      } catch (cleanupError) {
        console.error('Error al limpiar archivo de backup después de error:', cleanupError);
      }
    }

    // Verificar si ya se enviaron headers
    if (!res.headersSent) {
      res.status(500).json({
        error: error.message || 'Error al generar backup de la base de datos.',
      });
    } else {
      // Si ya se enviaron headers, cerrar la conexión
      res.end();
    }
  }
};

/**
 * Subir y restaurar backup de la base de datos
 */
export const uploadBackup = async (req, res, next) => {
  let uploadedFilePath = null;

  try {
    // Verificar que se haya subido un archivo
    if (!req.file) {
      return res.status(400).json({
        error: 'No se ha subido ningún archivo de backup.',
      });
    }

    // Verificar que el archivo sea .sql o .sql.gz
    const fileName = req.file.originalname;
    const isValidFormat = fileName.endsWith('.sql.gz') || fileName.endsWith('.sql');

    if (!isValidFormat) {
      // Eliminar archivo subido si el formato no es válido
      try {
        await unlinkAsync(req.file.path);
      } catch (cleanupError) {
        console.error('Error al limpiar archivo inválido:', cleanupError);
      }

      return res.status(400).json({
        error: 'El archivo debe ser un backup SQL (.sql o .sql.gz).',
      });
    }

    uploadedFilePath = req.file.path;

    console.log(`Restaurando backup desde archivo: ${fileName}`);
    console.log(`Ruta del archivo guardado: ${uploadedFilePath}`);
    console.log(`Nombre original: ${req.file.originalname}`);
    console.log(`Nombre guardado: ${req.file.filename}`);

    // Restaurar el backup
    await restoreDatabaseBackup(uploadedFilePath);

    // Limpiar el archivo subido después de restaurar
    try {
      await unlinkAsync(uploadedFilePath);
    } catch (cleanupError) {
      console.warn('No se pudo eliminar el archivo subido:', cleanupError.message);
    }

    res.json({
      message: 'Backup restaurado exitosamente.',
    });
  } catch (error) {
    console.error('Error al restaurar backup:', error);

    // Limpiar archivo subido en caso de error
    if (uploadedFilePath) {
      try {
        await unlinkAsync(uploadedFilePath);
      } catch (cleanupError) {
        console.error('Error al limpiar archivo después de error:', cleanupError);
      }
    }

    res.status(500).json({
      error: error.message || 'Error al restaurar backup de la base de datos.',
    });
  }
};

