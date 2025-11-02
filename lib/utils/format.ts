/**
 * Utilidades de Formateo - El Arca
 *
 * Funciones centralizadas para formatear valores (moneda, archivos, fechas, etc.)
 * Evita duplicación de código en componentes.
 */

/**
 * Formatea un número como moneda mexicana (MXN)
 *
 * @param amount - Cantidad numérica a formatear
 * @returns String formateado como "$1,234.56"
 *
 * @example
 * formatCurrency(4545.45) // "$4,545.45"
 * formatCurrency(1000) // "$1,000.00"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
}

/**
 * Formatea el tamaño de un archivo a formato legible
 *
 * @param bytes - Tamaño en bytes
 * @returns String formateado como "1.5 MB", "500 KB", etc.
 *
 * @example
 * formatFileSize(0) // "0 Bytes"
 * formatFileSize(1024) // "1 KB"
 * formatFileSize(5242880) // "5 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Formatea una fecha ISO 8601 a formato largo en español
 *
 * @param dateString - String de fecha en formato ISO
 * @returns Fecha formateada como "15 de noviembre de 2025"
 *
 * @example
 * formatDate("2025-11-15") // "15 de noviembre de 2025"
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Formatea una fecha ISO 8601 a formato corto en español
 *
 * @param dateString - String de fecha en formato ISO
 * @returns Fecha formateada como "15/11/2025"
 *
 * @example
 * formatDateShort("2025-11-15") // "15/11/2025"
 */
export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-MX');
}

/**
 * Formatea una fecha ISO 8601 a formato con hora
 *
 * @param dateString - String de fecha en formato ISO
 * @returns Fecha formateada como "15/11/2025 14:30"
 *
 * @example
 * formatDateTime("2025-11-15T14:30:00Z") // "15/11/2025 14:30"
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
