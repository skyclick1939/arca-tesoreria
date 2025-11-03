/**
 * Storage Helpers para El Arca
 * Utilidades para manejo de archivos en Supabase Storage
 */

import { supabase } from '@/lib/supabase';

// Constantes de configuración (LEGACY - usar getStorageConfig() para valores dinámicos)
export const STORAGE_CONFIG = {
  BUCKET_NAME: 'arca-comprobantes',
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5 MB en bytes (FALLBACK - ver getStorageConfig)
  ALLOWED_TYPES: ['image/png', 'image/jpeg', 'application/pdf'], // FALLBACK
  ALLOWED_EXTENSIONS: ['.png', '.jpg', '.jpeg', '.pdf'],
} as const;

/**
 * Obtiene la configuración de storage desde arca_system_config
 *
 * @returns Configuración dinámica con fallbacks
 */
export async function getStorageConfig(): Promise<{
  maxFileSizeMB: number;
  maxFileSizeBytes: number;
  allowedTypes: string[];
  allowedExtensions: string[];
}> {
  try {
    // Obtener configuraciones en paralelo
    const [sizeConfig, typesConfig] = await Promise.all([
      supabase.rpc('get_system_config', { p_key: 'max_upload_size_mb' }),
      supabase.rpc('get_system_config', { p_key: 'allowed_file_types' }),
    ]);

    // Parse con fallbacks
    const maxFileSizeMB = sizeConfig.data
      ? parseInt(sizeConfig.data.toString(), 10)
      : 5; // Fallback: 5 MB

    const allowedTypes = typesConfig.data
      ? (typeof typesConfig.data === 'string' ? JSON.parse(typesConfig.data) : typesConfig.data)
      : STORAGE_CONFIG.ALLOWED_TYPES; // Fallback

    // Derivar extensiones de tipos MIME
    const allowedExtensions = deriveExtensionsFromMimeTypes(allowedTypes);

    return {
      maxFileSizeMB,
      maxFileSizeBytes: maxFileSizeMB * 1024 * 1024,
      allowedTypes,
      allowedExtensions,
    };
  } catch (error) {
    console.error('[getStorageConfig] Error al obtener configuración:', error);
    // Fallback completo en caso de error
    return {
      maxFileSizeMB: 5,
      maxFileSizeBytes: STORAGE_CONFIG.MAX_FILE_SIZE,
      allowedTypes: [...STORAGE_CONFIG.ALLOWED_TYPES],
      allowedExtensions: [...STORAGE_CONFIG.ALLOWED_EXTENSIONS],
    };
  }
}

/**
 * Deriva extensiones de archivo desde tipos MIME
 */
function deriveExtensionsFromMimeTypes(mimeTypes: string[]): string[] {
  const mimeToExt: Record<string, string[]> = {
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'application/pdf': ['.pdf'],
  };

  const extensions = new Set<string>();
  mimeTypes.forEach((mime) => {
    const exts = mimeToExt[mime];
    if (exts) {
      exts.forEach((ext) => extensions.add(ext));
    }
  });

  return Array.from(extensions);
}

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
 * Genera nombre corto del capítulo para nomenclatura de archivos
 * Ejemplo: "Puerto Vallarta" → "vallarta"
 *
 * SEGURIDAD: Sanitiza ANTES de procesar para prevenir path traversal
 */
export function generateChapterShortName(chapterName: string): string {
  // Paso 1: Sanitización agresiva ANTES de procesar
  const sanitized = chapterName
    .replace(/[./\\]/g, '') // Eliminar . / \ explícitamente (anti path-traversal)
    .trim() // Eliminar espacios al inicio/fin
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remover acentos

  // Paso 2: Tomar última palabra (ciudad principal)
  const words = sanitized.split(/\s+/).filter(w => w.length > 0);
  const lastWord = words.length > 0 ? words[words.length - 1] : '';

  // Paso 3: Asegurar solo caracteres alfanuméricos
  const result = lastWord.replace(/[^a-z0-9]/g, '');

  // Paso 4: Fallback si resultado vacío
  return result.length > 0 ? result : 'chapter';
}

/**
 * Genera ID corto desde UUID (primeros 8 caracteres)
 * Ejemplo: "a1b2c3d4-e5f6-..." → "a1b2c3d4"
 */
export function generateShortId(uuid: string): string {
  return uuid.slice(0, 8);
}

/**
 * Formatea fecha para nomenclatura de archivos
 * Ejemplo: "2025-11-28"
 */
export function formatDateForFilename(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normaliza tipo de deuda para nomenclatura
 * Ejemplo: "apoyo" → "apoyo", "aportacion" → "aportacion", "multa" → "multa"
 *
 * SEGURIDAD: Sanitiza para prevenir path traversal
 */
export function normalizeDebtType(debtType: string): string {
  return debtType
    .replace(/[./\\]/g, '') // Eliminar . / \ explícitamente (anti path-traversal)
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, ''); // Solo letras minúsculas
}

/**
 * Genera el path completo para almacenar un comprobante
 *
 * Formato legacy (sin metadata): {chapter_id}/{debt_id}/{timestamp}-{filename}
 * Formato descriptivo (con metadata): {chapter_id}/{debt_id}/{tipo}-{chapter}-{fecha}-{id_corto}.{ext}
 *
 * @param chapterId - UUID del capítulo
 * @param debtId - UUID de la deuda
 * @param filename - Nombre original del archivo
 * @param metadata - Información adicional para nomenclatura descriptiva (opcional)
 * @returns Path completo para Storage
 *
 * @example
 * // Formato legacy (retrocompatibilidad)
 * generateProofPath('uuid-123', 'uuid-456', 'comprobante.pdf')
 * // => 'uuid-123/uuid-456/1730600000000-comprobante.pdf'
 *
 * // Formato descriptivo (recomendado)
 * generateProofPath('uuid-123', 'uuid-456', 'comprobante.pdf', {
 *   debtType: 'apoyo',
 *   chapterName: 'Puerto Vallarta'
 * })
 * // => 'uuid-123/uuid-456/apoyo-vallarta-2025-11-28-uuid-456.pdf'
 */
export function generateProofPath(
  chapterId: string,
  debtId: string,
  filename: string,
  metadata?: {
    debtType?: string;
    chapterName?: string;
  }
): string {
  const extension = getFileExtension(filename);

  // Si no hay metadata, usar formato legacy (retrocompatibilidad)
  if (!metadata?.debtType || !metadata?.chapterName) {
    const timestamp = Date.now();
    const sanitizedFilename = sanitizeFilename(filename);
    return `${chapterId}/${debtId}/${timestamp}-${sanitizedFilename}`;
  }

  // Formato descriptivo para auditoría
  const tipo = normalizeDebtType(metadata.debtType);
  const chapterShort = generateChapterShortName(metadata.chapterName);
  const fecha = formatDateForFilename();
  const idCorto = generateShortId(debtId);

  const descriptiveName = `${tipo}-${chapterShort}-${fecha}-${idCorto}${extension}`;
  return `${chapterId}/${debtId}/${descriptiveName}`;
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
 * LEGACY: Usa valores hardcodeados. Preferir validateFileWithConfig() para validación dinámica.
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
 * Valida que el archivo cumpla con las restricciones de tamaño y tipo
 * RECOMENDADO: Usa configuración dinámica desde arca_system_config
 *
 * @param file - Archivo a validar
 * @returns Promise con resultado de validación
 *
 * @example
 * const result = await validateFileWithConfig(selectedFile);
 * if (!result.valid) {
 *   alert(result.error);
 * }
 */
export async function validateFileWithConfig(
  file: File
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Obtener configuración dinámica
    const config = await getStorageConfig();

    // Validar tamaño
    if (file.size > config.maxFileSizeBytes) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return {
        valid: false,
        error: `El archivo es demasiado grande (${sizeMB} MB). Máximo permitido: ${config.maxFileSizeMB} MB.`,
      };
    }

    // Validar tipo MIME
    if (!config.allowedTypes.includes(file.type)) {
      // Generar lista legible de tipos
      const typesDisplay = config.allowedTypes
        .map((t) => {
          if (t === 'image/png') return 'PNG';
          if (t === 'image/jpeg') return 'JPEG';
          if (t === 'application/pdf') return 'PDF';
          return t;
        })
        .join(', ');

      return {
        valid: false,
        error: `Tipo de archivo no permitido. Solo se aceptan: ${typesDisplay}.`,
      };
    }

    // Validar extensión del archivo
    const extension = getFileExtension(file.name);
    if (!config.allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `Extensión de archivo no permitida. Solo se aceptan: ${config.allowedExtensions.join(', ')}.`,
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('[validateFileWithConfig] Error al validar archivo:', error);
    // Fallback: usar validación legacy si falla la configuración
    return validateFile(file);
  }
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
 * Extrae el path del archivo desde una URL completa de Supabase Storage
 *
 * SEGURIDAD: Valida que la URL pertenece a un dominio Supabase legítimo
 * antes de extraer el path.
 *
 * @param proofUrl - URL completa del comprobante
 * @returns Path relativo al bucket o null si la URL es inválida
 *
 * @example
 * extractPathFromProofUrl('https://xyz.supabase.co/storage/v1/object/public/arca-comprobantes/chapter-id/debt-id/file.pdf')
 * // => 'chapter-id/debt-id/file.pdf'
 */
export function extractPathFromProofUrl(proofUrl: string): string | null {
  if (!proofUrl) return null;

  try {
    // Paso 1: Validar que es una URL de Supabase (prevenir URLs maliciosas)
    const url = new URL(proofUrl);
    const isSupabaseDomain = url.hostname.endsWith('.supabase.co') ||
                            url.hostname.endsWith('.supabase.in') ||
                            url.hostname.includes('supabase');

    if (!isSupabaseDomain) {
      console.warn('[extractPathFromProofUrl] URL no es de dominio Supabase:', url.hostname);
      return null;
    }

    // Paso 2: Extraer path del bucket
    // URL format: https://.../storage/v1/object/public/arca-comprobantes/{path}
    // o signed URL: https://.../storage/v1/object/sign/arca-comprobantes/{path}?token=...
    const match = proofUrl.match(/\/arca-comprobantes\/(.+?)(?:\?|$)/);
    return match ? match[1] : null;
  } catch (e) {
    console.error('[extractPathFromProofUrl] Error parsing URL:', e);
    return null;
  }
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
