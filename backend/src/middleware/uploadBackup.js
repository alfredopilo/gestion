import multer from 'multer';
import { join } from 'path';
import { tmpdir } from 'os';

// Configurar multer para guardar archivos temporalmente
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Guardar en el directorio temporal del sistema
    cb(null, tmpdir());
  },
  filename: (req, file, cb) => {
    // Generar nombre único para el archivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Preservar la extensión completa (puede ser .sql o .sql.gz)
    const originalName = file.originalname;
    let ext = '';
    if (originalName.endsWith('.sql.gz')) {
      ext = 'sql.gz';
    } else if (originalName.endsWith('.sql')) {
      ext = 'sql';
    } else {
      ext = originalName.split('.').pop(); // Fallback
    }
    cb(null, `backup_upload_${uniqueSuffix}.${ext}`);
  },
});

// Filtrar solo archivos .sql y .sql.gz
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.sql', '.sql.gz'];
  const fileName = file.originalname.toLowerCase();
  
  const isValid = allowedExtensions.some(ext => fileName.endsWith(ext));
  
  if (isValid) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos .sql o .sql.gz'), false);
  }
};

// Configurar multer
const uploadBackup = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // Límite de 500MB
  },
});

export default uploadBackup;

