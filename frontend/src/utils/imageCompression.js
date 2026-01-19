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

/**
 * Convierte un File a dataURL (base64)
 * @param {File} file
 * @returns {Promise<string>}
 */
export const fileToDataUrl = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target?.result || ''));
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
};

/**
 * Calcula el tamaño real (bytes) de un dataURL base64
 * @param {string} dataUrl
 * @returns {number}
 */
export const getDataUrlSizeBytes = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;
  const idx = dataUrl.indexOf('base64,');
  const base64 = idx >= 0 ? dataUrl.slice(idx + 'base64,'.length) : dataUrl;
  if (!base64) return 0;
  const cleaned = base64.replace(/\s/g, '');
  const padding = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding);
};

const blobToDataUrl = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target?.result || ''));
    reader.onerror = () => reject(new Error('Error al convertir la imagen'));
    reader.readAsDataURL(blob);
  });
};

/**
 * Comprime una imagen y devuelve dataURL (base64) + tamaño en bytes.
 * No reemplaza `compressImage` (que devuelve File) para no romper usos existentes.
 *
 * @param {File} file
 * @param {{maxWidth?: number, maxHeight?: number, quality?: number, maxSizeKB?: number, mimeType?: string}} options
 * @returns {Promise<{dataUrl: string, bytes: number}>}
 */
export const compressImageToDataUrl = async (
  file,
  {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.8,
    maxSizeKB = 300,
    mimeType,
  } = {}
) => {
  const inputDataUrl = await fileToDataUrl(file);

  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Error al cargar la imagen'));
    image.src = inputDataUrl;
  });

  let width = img.width;
  let height = img.height;

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width *= ratio;
    height *= ratio;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo procesar la imagen');
  }

  const targetMime = mimeType || file.type || 'image/jpeg';
  const maxBytes = maxSizeKB * 1024;

  const draw = () => {
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };

  const toDataUrlWithQuality = async (q) => {
    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), targetMime, q);
    });
    if (!blob) throw new Error('Error al comprimir la imagen');
    const dataUrl = await blobToDataUrl(blob);
    return { dataUrl, bytes: getDataUrlSizeBytes(dataUrl) };
  };

  draw();

  let currentQuality = quality;
  let result = await toDataUrlWithQuality(currentQuality);

  // Reducir calidad hasta cumplir tamaño o llegar a mínimo
  while (result.bytes > maxBytes && currentQuality > 0.1) {
    currentQuality = Math.max(0.1, currentQuality - 0.1);
    result = await toDataUrlWithQuality(currentQuality);
  }

  // Si aún es grande, reducir dimensiones y reintentar con calidad base
  while (result.bytes > maxBytes && (width > 400 || height > 400)) {
    const ratio = Math.min(400 / width, 400 / height);
    width *= ratio;
    height *= ratio;
    draw();
    currentQuality = Math.min(0.8, quality);
    result = await toDataUrlWithQuality(currentQuality);

    while (result.bytes > maxBytes && currentQuality > 0.1) {
      currentQuality = Math.max(0.1, currentQuality - 0.1);
      result = await toDataUrlWithQuality(currentQuality);
    }
  }

  return result;
};
