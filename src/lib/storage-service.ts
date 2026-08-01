import { storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

/**
 * Convierte una cadena Base64 en un Blob binario.
 * Esto mejora la compatibilidad con las reglas de seguridad y reduce errores 403.
 */
function base64ToBlob(base64: string): Blob {
  const parts = base64.split(',');
  if (parts.length < 2) throw new Error("Formato base64 inválido");
  
  const metadata = parts[0];
  const contentType = metadata.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const byteCharacters = atob(parts[1]);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
}

/**
 * Sube un archivo a Firebase Storage y retorna su URL pública.
 */
export async function uploadFile(path: string, file: File | Blob): Promise<string> {
  if (!storage) throw new Error("Storage no inicializado");
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
}

/**
 * Sube una cadena Base64 a Firebase Storage convirtiéndola primero a Blob.
 * Soluciona problemas de permisos 403 al enviar datos binarios reales.
 */
export async function uploadBase64(path: string, base64: string): Promise<string> {
  if (!storage) throw new Error("Storage no inicializado");
  
  try {
    const blob = base64ToBlob(base64);
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, blob);
    return getDownloadURL(snapshot.ref);
  } catch (error: any) {
    console.error("Error en uploadBase64:", error);
    throw new Error(`Fallo al subir imagen: ${error.message}`);
  }
}
