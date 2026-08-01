import { storage } from "./firebase";
import { ref, uploadString, getDownloadURL, uploadBytes } from "firebase/storage";

/**
 * Sube un archivo a Firebase Storage y retorna su URL pública.
 * @param path Ruta completa en el bucket (ej: tenants/ID/drivers/DNI.jpg)
 * @param file El archivo o blob a subir
 */
export async function uploadFile(path: string, file: File | Blob): Promise<string> {
  if (!storage) throw new Error("Storage no inicializado");
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
}

/**
 * Sube una cadena Base64 a Firebase Storage.
 * Útil para imágenes comprimidas o firmas.
 */
export async function uploadBase64(path: string, base64: string): Promise<string> {
  if (!storage) throw new Error("Storage no inicializado");
  
  // Limpiar el prefijo data:image/...;base64,
  const parts = base64.split(',');
  const metadata = parts[0];
  const data = parts[1];
  const contentType = metadata.match(/:(.*?);/)?.[1] || 'image/jpeg';
  
  const storageRef = ref(storage, path);
  const snapshot = await uploadString(storageRef, data, 'base64', { contentType });
  return getDownloadURL(snapshot.ref);
}
