/**
 * Storage Helpers para El Arca
 * Utilidades para manejo de archivos en Supabase Storage
 */

// Constantes de configuración
export const STORAGE_CONFIG = {
  BUCKET_NAME: 'arca-comprobantes',
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5 MB en bytes
  ALLOWED_TYPES: ['image/png', 'image/jpeg', 'application/pdf'],
  ALLOWED_EXTENSIONS: ['.png', '.jpg', '.jpeg', '.pdf'],
} as const;

// Tipos de error
export enum StorageErrorType {
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_TYPE = 'INVALID_TYPE',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  DELETE_FAILED = 'DELETE_FAILED',
}

export class StorageError extends Error {
  constructor(public type: StorageErrorType, message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Genera el path completo para almacenar un comprobante
 * Formato: {chapter_id}/{debt_id}/{timestamp}-{filename}
 */
export function generateProofPath(
  chapterId: string,
  debtId: string,
  filename: string
): string {
  const timestamp = Date.now();
  const sanitizedFilename = sanitizeFilename(filename);
  return `${chapterId}/${debtId}/${timestamp}-${sanitizedFilename}`;
}

/**
 * Sanitiza el nombre del archivo removiendo caracteres especiales
 */
export function sanitizeFilename(filename: string): string {
  // Remover caracteres especiales, mantener solo letras, números, puntos y guiones
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Reemplazar caracteres especiales con _
    .toLowerCase();
}

/**
 * Valida que el archivo cumpla con las restricciones de tamaño y tipo
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Validar tamaño
  if (file.size > STORAGE_CONFIG.MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `El archivo es demasiado grande (${sizeMB} MB). Máximo permitido: 5 MB.`,
    };
  }

  // Validar tipo MIME
  if (!STORAGE_CONFIG.ALLOWED_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: `Tipo de archivo no permitido. Solo se aceptan: PNG, JPEG, PDF.`,
    };
  }

  // Validar extensión del archivo
  const extension = getFileExtension(file.name);
  if (!STORAGE_CONFIG.ALLOWED_EXTENSIONS.includes(extension as any)) {
    return {
      valid: false,
      error: `Extensión de archivo no permitida. Solo se aceptan: ${STORAGE_CONFIG.ALLOWED_EXTENSIONS.join(', ')}.`,
    };
  }

  return { valid: true };
}

/**
 * Obtiene la extensión del archivo (incluyendo el punto)
 */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex !== -1 ? filename.slice(lastDotIndex).toLowerCase() : '';
}

/**
 * Formatea el tamaño del archivo a formato legible
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Extrae el chapter_id del path de storage
 * Path format: {chapter_id}/{debt_id}/{timestamp}-{filename}
 */
export function extractChapterIdFromPath(path: string): string | null {
  const parts = path.split('/');
  return parts.length >= 1 ? parts[0] : null;
}

/**
 * Extrae el debt_id del path de storage
 */
export function extractDebtIdFromPath(path: string): string | null {
  const parts = path.split('/');
  return parts.length >= 2 ? parts[1] : null;
}

/**
 * Genera la URL pública firmada para visualizar un comprobante
 * Nota: Requiere autenticación, la URL expira después de expiresIn segundos
 */
export function getPublicUrl(path: string): string {
  // Este método será implementado en el hook useUploadProof
  // ya que requiere acceso al cliente de Supabase
  return path;
}

/**
 * Determina si un archivo es una imagen o PDF
 */
export function isImage(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ['.png', '.jpg', '.jpeg'].includes(ext);
}

export function isPDF(filename: string): boolean {
  return getFileExtension(filename) === '.pdf';
}
