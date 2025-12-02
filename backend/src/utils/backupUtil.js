import { spawn } from 'child_process';
import { promisify } from 'util';
import { createWriteStream, createReadStream, unlink, existsSync, readFileSync, writeFileSync } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip } from 'zlib';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Parsea la URL de la base de datos para extraer credenciales
 * @param {string} databaseUrl - URL de conexión en formato: postgresql://user:password@host:port/database
 * @returns {Object} - Objeto con host, port, database, username, password
 */
function parseDatabaseUrl(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    return {
      host: url.hostname,
      port: url.port || '5432',
      database: url.pathname.slice(1), // Remover el '/' inicial
      username: url.username,
      password: url.password,
    };
  } catch (error) {
    throw new Error(`Error al parsear DATABASE_URL: ${error.message}`);
  }
}

/**
 * Genera un backup comprimido de la base de datos PostgreSQL
 * @returns {Promise<{filePath: string, fileName: string}>} - Ruta del archivo de backup y nombre del archivo
 */
export async function generateDatabaseBackup() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL no está configurada en las variables de entorno');
  }

  // Parsear la URL de la base de datos
  const dbConfig = parseDatabaseUrl(databaseUrl);

  // Generar nombre de archivo con timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const fileName = `backup_gestion_escolar_${timestamp}.sql.gz`;
  
  // Crear ruta temporal
  const tempDir = tmpdir();
  const filePath = join(tempDir, fileName);

  try {
    // Configurar variables de entorno para pg_dump
    const env = {
      ...process.env,
      PGPASSWORD: dbConfig.password, // pg_dump usa esta variable para la contraseña
    };

    // Crear el comando pg_dump en formato plain SQL
    const sqlFilePath = filePath.replace('.gz', '.sql');
    
    console.log(`Generando backup de la base de datos: ${dbConfig.database}`);

    // Ejecutar pg_dump usando spawn para mejor manejo de argumentos
    const dumpArgs = [
      `--host=${dbConfig.host}`,
      `--port=${dbConfig.port}`,
      `--username=${dbConfig.username}`,
      `--dbname=${dbConfig.database}`,
      '--no-password', // No pedir contraseña, usar PGPASSWORD
      '--verbose', // Para logging
      '--no-owner', // No incluir comandos de ownership
      '--no-acl', // No incluir comandos de permisos
      '--format=plain', // Formato SQL plano
      '-f', sqlFilePath, // Archivo SQL temporal
    ];

    await new Promise((resolve, reject) => {
      const pgDumpProcess = spawn('pg_dump', dumpArgs, { 
        env,
        stdio: ['ignore', 'pipe', 'pipe'], // stdin: ignore, stdout: pipe, stderr: pipe
      });

      let stdoutData = '';
      let stderrData = '';

      pgDumpProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      pgDumpProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      pgDumpProcess.on('close', (code) => {
        if (code !== 0) {
          // pg_dump puede usar stderr para advertencias, verificar si es realmente un error
          const hasRealError = stderrData && 
            !stderrData.includes('NOTICE') && 
            !stderrData.includes('dumping') &&
            !stderrData.includes('WARNING: database owner will not be able to');
          
          if (hasRealError) {
            reject(new Error(`pg_dump falló con código ${code}: ${stderrData || stdoutData}`));
          } else {
            // Advertencias normales, continuar
            if (stderrData && !stderrData.includes('NOTICE')) {
              console.warn('Advertencias de pg_dump:', stderrData);
            }
            resolve();
          }
        } else {
          resolve();
        }
      });

      pgDumpProcess.on('error', (error) => {
        if (error.code === 'ENOENT') {
          reject(new Error('pg_dump no está disponible. Asegúrate de que postgresql-client esté instalado.'));
        } else {
          reject(new Error(`Error al ejecutar pg_dump: ${error.message}`));
        }
      });
    });

    // Comprimir el archivo SQL con gzip
    const compressedFilePath = filePath;
    const readStream = createReadStream(sqlFilePath);
    const writeStream = createWriteStream(compressedFilePath);
    const gzipStream = createGzip();

    await pipeline(readStream, gzipStream, writeStream);

    // Eliminar el archivo SQL sin comprimir
    const unlinkAsync = promisify(unlink);
    await unlinkAsync(sqlFilePath);

    console.log(`Backup generado exitosamente: ${compressedFilePath}`);

    return {
      filePath: compressedFilePath,
      fileName: fileName,
    };
  } catch (error) {
    // Limpiar archivos en caso de error
    try {
      const unlinkAsync = promisify(unlink);
      if (existsSync(filePath)) {
        await unlinkAsync(filePath);
      }
      if (existsSync(filePath.replace('.gz', '.sql'))) {
        await unlinkAsync(filePath.replace('.gz', '.sql'));
      }
    } catch (cleanupError) {
      console.error('Error al limpiar archivos temporales:', cleanupError);
    }

    if (error.message.includes('pg_dump: command not found')) {
      throw new Error('pg_dump no está disponible. Asegúrate de que postgresql-client esté instalado.');
    }

    throw new Error(`Error al generar backup: ${error.message}`);
  }
}

/**
 * Elimina un archivo de backup temporal
 * @param {string} filePath - Ruta del archivo a eliminar
 */
export async function deleteBackupFile(filePath) {
  try {
    const unlinkAsync = promisify(unlink);
    await unlinkAsync(filePath);
    console.log(`Archivo de backup eliminado: ${filePath}`);
  } catch (error) {
    console.error(`Error al eliminar archivo de backup: ${error.message}`);
    // No lanzar error, solo registrar
  }
}

/**
 * Restaura un backup de la base de datos PostgreSQL desde un archivo comprimido
 * @param {string} backupFilePath - Ruta del archivo de backup (.sql.gz)
 * @returns {Promise<void>}
 */
export async function restoreDatabaseBackup(backupFilePath) {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL no está configurada en las variables de entorno');
  }

  // Parsear la URL de la base de datos
  const dbConfig = parseDatabaseUrl(databaseUrl);

  // Verificar que el archivo existe
  if (!existsSync(backupFilePath)) {
    throw new Error('El archivo de backup no existe');
  }

  // Verificar que es un archivo .sql.gz o .sql
  // Convertir a minúsculas para la comparación
  const normalizedPath = backupFilePath.toLowerCase();
  const isValidFormat = normalizedPath.endsWith('.sql.gz') || normalizedPath.endsWith('.sql');
  
  if (!isValidFormat) {
    console.error(`Formato de archivo inválido. Ruta del archivo: ${backupFilePath}`);
    throw new Error('El archivo debe ser un backup SQL (.sql o .sql.gz)');
  }

  const tempDir = tmpdir();
  let sqlFilePath = backupFilePath;
  let originalSqlFilePath = null; // Para limpieza posterior

  try {
    // Si el archivo está comprimido, descomprimirlo
    if (backupFilePath.endsWith('.sql.gz') || backupFilePath.toLowerCase().endsWith('.sql.gz')) {
      sqlFilePath = join(tempDir, `restore_${Date.now()}.sql`);
      
      console.log('Descomprimiendo archivo de backup...');
      
      // Descomprimir el archivo
      const readStream = createReadStream(backupFilePath);
      const writeStream = createWriteStream(sqlFilePath);
      const gunzipStream = createGunzip();

      await pipeline(readStream, gunzipStream, writeStream);
      console.log('Archivo descomprimido exitosamente');
    }

    // Filtrar comandos problemáticos del SQL antes de ejecutarlo
    // Eliminar comandos SET que contienen parámetros no reconocidos
    console.log('Filtrando comandos problemáticos del SQL...');
    let sqlContent = readFileSync(sqlFilePath, 'utf8');
    
    // Lista de parámetros no reconocidos que deben ser filtrados
    const problematicParams = [
      'transaction_timeout',
      'idle_in_transaction_session_timeout', // Otro parámetro común que puede no estar disponible
    ];
    
    // Filtrar líneas que contienen SET con parámetros problemáticos
    const lines = sqlContent.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmedLine = line.trim().toUpperCase();
      // Si es un comando SET, verificar si contiene parámetros problemáticos
      if (trimmedLine.startsWith('SET ') || trimmedLine.startsWith('SELECT SET_CONFIG')) {
        const lowerLine = line.toLowerCase();
        return !problematicParams.some(param => lowerLine.includes(param));
      }
      return true; // Mantener todas las demás líneas
    });
    
    const filteredSqlContent = filteredLines.join('\n');
    const filteredSqlFilePath = join(tempDir, `restore_filtered_${Date.now()}.sql`);
    writeFileSync(filteredSqlFilePath, filteredSqlContent, 'utf8');
    
    // Guardar referencia al archivo original para limpieza posterior
    originalSqlFilePath = sqlFilePath;
    
    // Usar el archivo SQL filtrado en lugar del original
    sqlFilePath = filteredSqlFilePath;
    
    console.log(`SQL filtrado. Líneas originales: ${lines.length}, Líneas filtradas: ${filteredLines.length}`);

    // Configurar variables de entorno para psql
    const env = {
      ...process.env,
      PGPASSWORD: dbConfig.password, // psql usa esta variable para la contraseña
    };

    console.log(`Restaurando backup en la base de datos: ${dbConfig.database}`);

    // Ejecutar psql para restaurar el backup usando stdin
    const psqlArgs = [
      `--host=${dbConfig.host}`,
      `--port=${dbConfig.port}`,
      `--username=${dbConfig.username}`,
      `--dbname=${dbConfig.database}`,
      '--no-password', // No pedir contraseña, usar PGPASSWORD
      '--quiet', // Modo silencioso
      '--set=ON_ERROR_STOP=1', // Detener en caso de error
    ];

    await new Promise((resolve, reject) => {
      const psqlProcess = spawn('psql', psqlArgs, { 
        env,
        stdio: ['pipe', 'pipe', 'pipe'], // stdin: pipe para pasar el archivo SQL
      });

      // Leer el archivo SQL y pasarlo por stdin
      const fileStream = createReadStream(sqlFilePath);
      fileStream.pipe(psqlProcess.stdin);

      let stdoutData = '';
      let stderrData = '';

      psqlProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      psqlProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      psqlProcess.on('close', (code) => {
        if (code !== 0) {
          // psql puede escribir errores en stderr incluso en casos normales
          // Filtrar advertencias comunes y errores de parámetros no reconocidos
          const hasRealError = stderrData && 
            !stderrData.includes('NOTICE') && 
            !stderrData.includes('WARNING') &&
            !stderrData.includes('already exists') &&
            !stderrData.includes('unrecognized configuration parameter'); // Ignorar parámetros no reconocidos
          
          if (hasRealError) {
            reject(new Error(`psql falló con código ${code}: ${stderrData || stdoutData}`));
          } else {
            // Advertencias normales, continuar
            if (stderrData) {
              console.warn('Advertencias de psql:', stderrData);
            }
            resolve();
          }
        } else {
          resolve();
        }
      });

      psqlProcess.on('error', (error) => {
        if (error.code === 'ENOENT') {
          reject(new Error('psql no está disponible. Asegúrate de que postgresql-client esté instalado.'));
        } else {
          reject(new Error(`Error al ejecutar psql: ${error.message}`));
        }
      });

      fileStream.on('error', (error) => {
        reject(new Error(`Error al leer archivo SQL: ${error.message}`));
      });
    });

    console.log('Backup restaurado exitosamente');

    // Limpiar archivos SQL temporales
    const unlinkAsync = promisify(unlink);
    
    // Limpiar archivo SQL filtrado
    if (sqlFilePath !== backupFilePath) {
      try {
        await unlinkAsync(sqlFilePath);
      } catch (cleanupError) {
        console.warn('No se pudo eliminar el archivo SQL filtrado:', cleanupError.message);
      }
    }
    
    // Limpiar archivo SQL original si fue descomprimido
    if (originalSqlFilePath && originalSqlFilePath !== backupFilePath && existsSync(originalSqlFilePath)) {
      try {
        await unlinkAsync(originalSqlFilePath);
      } catch (cleanupError) {
        console.warn('No se pudo eliminar el archivo SQL original:', cleanupError.message);
      }
    }
  } catch (error) {
    // Limpiar archivo SQL temporal si fue descomprimido
    if (sqlFilePath !== backupFilePath && existsSync(sqlFilePath)) {
      try {
        const unlinkAsync = promisify(unlink);
        await unlinkAsync(sqlFilePath);
      } catch (cleanupError) {
        console.error('Error al limpiar archivo temporal:', cleanupError);
      }
    }

    if (error.message.includes('psql: command not found') || error.message.includes('psql no está disponible')) {
      throw new Error('psql no está disponible. Asegúrate de que postgresql-client esté instalado.');
    }

    throw new Error(`Error al restaurar backup: ${error.message}`);
  }
}

