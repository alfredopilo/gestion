/**
 * Comprime una imagen a un tamaño óptimo
 * @param {File} file - Archivo de imagen a comprimir
 * @param {Object} options - Opciones de compresión
 * @returns {Promise<string>} - Base64 de la imagen comprimida
 */
export const compressImage = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    const {
      maxWidth = 600, // Reducido de 800 a 600
      maxHeight = 600, // Reducido de 800 a 600
      quality = 0.7, // Reducido de 0.8 a 0.7
      maxSizeMB = 0.3, // Reducido de 0.5MB a 0.3MB (300KB máximo)
    } = options;

    // Verificar que sea una imagen
    if (!file.type.startsWith('image/')) {
      reject(new Error('El archivo debe ser una imagen'));
      return;
    }

    // Verificar tamaño inicial
    if (file.size > 10 * 1024 * 1024) { // 10MB máximo antes de comprimir
      reject(new Error('La imagen es demasiado grande. Máximo 10MB'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calcular nuevas dimensiones manteniendo la relación de aspecto
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // Dibujar imagen redimensionada en el canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir a base64 con calidad ajustable
        let qualityLevel = quality;
        let compressedBase64 = canvas.toDataURL(file.type, qualityLevel);

        // Si aún es muy grande, reducir más la calidad progresivamente
        while (
          compressedBase64.length > maxSizeMB * 1024 * 1024 &&
          qualityLevel > 0.1
        ) {
          qualityLevel -= 0.1;
          compressedBase64 = canvas.toDataURL(file.type, qualityLevel);
        }

        // Si sigue siendo muy grande después de reducir calidad, reducir dimensiones
        let attempts = 0;
        const maxAttempts = 5;
        while (
          compressedBase64.length > maxSizeMB * 1024 * 1024 &&
          attempts < maxAttempts
        ) {
          width = Math.floor(width * 0.85);
          height = Math.floor(height * 0.85);
          canvas.width = width;
          canvas.height = height;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, width, height);
          
          // Intentar con calidad más baja
          qualityLevel = Math.max(0.3, qualityLevel - 0.1);
          compressedBase64 = canvas.toDataURL(file.type, qualityLevel);
          attempts++;
        }

        // Si aún es muy grande, forzar JPEG con calidad baja
        if (compressedBase64.length > maxSizeMB * 1024 * 1024) {
          compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
        }

        resolve(compressedBase64);
      };

      img.onerror = () => {
        reject(new Error('Error al cargar la imagen'));
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo'));
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Obtiene el tamaño del archivo en formato legible
 * @param {number} bytes - Tamaño en bytes
 * @returns {string} - Tamaño formateado
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

