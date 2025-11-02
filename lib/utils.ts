/**
 * Utility Functions
 *
 * Funciones auxiliares reutilizables en toda la aplicación.
 */

/**
 * Convierte un error de tipo unknown a string legible
 *
 * Utilizada principalmente para convertir errores de React Query mutations
 * que son de tipo `unknown` a strings renderizables en la UI.
 *
 * @param error - Error de cualquier tipo (Error, string, unknown)
 * @returns Mensaje de error como string, o null si no hay error
 *
 * @example
 * // En un componente con React Query
 * const mutation = useMutation(...);
 * const errorMsg = getErrorMessage(mutation.error);
 *
 * if (errorMsg) {
 *   return <div className="error">{errorMsg}</div>;
 * }
 */
export function getErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return String(error);
}
