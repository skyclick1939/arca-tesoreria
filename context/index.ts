/**
 * Barrel export para el módulo de autenticación
 *
 * Simplifica las importaciones en componentes:
 *
 * ANTES:
 * import { AuthContext } from '@/context/AuthContext';
 * import { AuthProvider } from '@/context/AuthProvider';
 * import { useAuth } from '@/context/AuthContext';
 *
 * AHORA:
 * import { AuthContext, AuthProvider, useAuth } from '@/context';
 */

export { AuthContext, useAuth } from './AuthContext';
export type { AuthContextType } from './AuthContext';
export { AuthProvider } from './AuthProvider';
