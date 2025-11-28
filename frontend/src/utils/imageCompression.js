/**
 * Formatea el tamaño de un archivo en bytes a una representación legible
 * @param {number} bytes - Tamaño en bytes
 * @returns {string} - Tamaño formateado (ej: "150 KB", "2.5 MB")
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Comprime una imagen a un tamaño máximo especificado
 * @param {File} file - Archivo de imagen a comprimir
 * @param {number} maxSizeKB - Tamaño máximo en KB (por defecto 150)
 * @param {number} maxWidth - Ancho máximo en píxeles (por defecto 800)
 * @param {number} maxHeight - Alto máximo en píxeles (por defecto 800)
 * @returns {Promise<File>} - Archivo comprimido
 */
export const compressImage = (file, maxSizeKB = 150, maxWidth = 800, maxHeight = 800) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calcular nuevas dimensiones manteniendo la proporción
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }
        
        // Crear canvas y redimensionar
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Comprimir con calidad ajustable
        const compress = (quality) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Error al comprimir la imagen'));
                return;
              }
              
              const sizeKB = blob.size / 1024;
              
              // Si el tamaño es menor al máximo, retornar
              if (sizeKB <= maxSizeKB) {
                const compressedFile = new File([blob], file.name, {
                  type: blob.type,
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
                return;
              }
              
              // Si aún es muy grande, reducir calidad
              if (quality > 0.1) {
                compress(quality - 0.1);
              } else {
                // Si ya está en calidad mínima y sigue siendo grande, reducir dimensiones
                if (width > 400 || height > 400) {
                  const newRatio = Math.min(400 / width, 400 / height);
                  width = width * newRatio;
                  height = height * newRatio;
                  canvas.width = width;
                  canvas.height = height;
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                  ctx.drawImage(img, 0, 0, width, height);
                  compress(0.7);
                } else {
                  // Último recurso: aceptar el archivo aunque sea más grande
                  const compressedFile = new File([blob], file.name, {
                    type: blob.type,
                    lastModified: Date.now(),
                  });
                  resolve(compressedFile);
                }
              }
            },
            file.type || 'image/jpeg',
            quality
          );
        };
        
        // Empezar con calidad 0.8
        compress(0.8);
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
