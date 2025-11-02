/**
 * Re-export del hook useAuth desde el contexto de autenticación
 *
 * NOTA IMPORTANTE:
 * Este archivo ahora es solo un alias para mantener compatibilidad con
 * las importaciones existentes en el código.
 *
 * La lógica real de autenticación ahora vive en:
 * - context/AuthContext.tsx (definición del contexto y hook)
 * - context/AuthProvider.tsx (lógica de estado global)
 *
 * MIGRACIÓN ARQUITECTÓNICA:
 * Antes: Estado local en cada componente (se destruía en navegaciones)
 * Ahora: Estado global en AuthProvider (persiste entre navegaciones)
 *
 * USO:
 * import { useAuth } from '@/hooks/useAuth'; // Funciona igual que antes
 * const { user, profile, isAuthenticated, login, logout } = useAuth();
 */

export { useAuth } from '@/context/AuthContext';
export type { AuthContextType as UseAuthReturn } from '@/context/AuthContext';
