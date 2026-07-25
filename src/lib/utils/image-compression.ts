
/**
 * Utilidad para comprimir imágenes en el cliente antes de subirlas a Firestore.
 * Reduce el ancho/alto máximo y ajusta la calidad JPEG.
 */
export async function compressImage(base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> {
  // Si no es una imagen (ej: PDF), devolver tal cual
  if (!base64Str.startsWith('data:image')) {
    return base64Str;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calcular nuevas dimensiones manteniendo la proporción
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      // Convertir a JPEG comprimido
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (err) => {
      console.error("Error al comprimir imagen:", err);
      resolve(base64Str);
    };
  });
}
