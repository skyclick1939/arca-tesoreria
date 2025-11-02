import { createContext, useContext } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import type { UserProfile, UserRole } from '@/types/database.types';

/**
 * Interface que define la forma del contexto de autenticación
 *
 * Expone:
 * - Estados: user, session, profile, isLoading
 * - Banderas derivadas: isAuthenticated, isAdmin, isPresident
 * - Funciones: login(), logout()
 */
export interface AuthContextType {
  // Estados principales
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;

  // Banderas derivadas (computadas)
  isAuthenticated: boolean;
  isAdmin: boolean;
  isPresident: boolean;

  // Funciones de autenticación
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * Contexto de autenticación global
 *
 * Proporciona estado de autenticación persistente entre navegaciones.
 * Soluciona el anti-patrón de estado local que se destruye en cada router.push().
 *
 * Uso:
 * 1. En _app.tsx: Envolver app con <AuthProvider>
 * 2. En componentes: const { user, isAuthenticated, login } = useAuth()
 */
export const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isLoading: true, // Inicialmente true hasta que se resuelva la sesión
  isAuthenticated: false,
  isAdmin: false,
  isPresident: false,
  login: async () => {
    throw new Error('AuthProvider no está montado. Envuelve la app con <AuthProvider>.');
  },
  logout: async () => {
    throw new Error('AuthProvider no está montado. Envuelve la app con <AuthProvider>.');
  },
});

/**
 * Hook personalizado para consumir el contexto de autenticación
 *
 * Simplifica el uso del contexto en componentes.
 *
 * @example
 * const { user, profile, isAuthenticated, login, logout } = useAuth();
 *
 * await login('admin@arca.local', 'admin123');
 * if (isAuthenticated) { // redirigir al dashboard }
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth debe ser usado dentro de un AuthProvider. ' +
      'Verifica que _app.tsx esté envuelto con <AuthProvider>.'
    );
  }

  return context;
}
