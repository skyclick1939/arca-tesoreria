import { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { UserProfile, UserRole } from '@/types/database.types';
import { AuthContext } from './AuthContext';

/**
 * Props del AuthProvider
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider - Componente proveedor de autenticación global
 *
 * Responsabilidades:
 * 1. Mantener estado global de autenticación (user, session, profile)
 * 2. Inicializar sesión al montar la app (getSession)
 * 3. Escuchar cambios de autenticación (onAuthStateChange)
 * 4. Proveer funciones login() y logout()
 * 5. Garantizar que isLoading se marca false cuando la carga termina
 *
 * Este componente NUNCA se desmonta (vive en _app.tsx), por lo que el estado
 * persiste entre navegaciones, resolviendo el anti-patrón de estado local.
 *
 * @example
 * // En pages/_app.tsx:
 * <AuthProvider>
 *   <Component {...pageProps} />
 * </AuthProvider>
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Estados principales
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Inicialmente true

  /**
   * Obtiene el perfil del usuario desde arca_user_profiles
   *
   * @param userId - ID del usuario de Supabase Auth
   * @returns UserProfile o null si no existe o hay error
   */
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('arca_user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('[AuthProvider] Error al obtener perfil:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[AuthProvider] Error inesperado al obtener perfil:', error);
      return null;
    }
  };

  /**
   * useEffect principal: Inicialización y listener de autenticación
   *
   * 1. Al montar: Obtiene sesión actual de Supabase (puede existir de sesión previa)
   * 2. Listener: Escucha cambios (login, logout, refresh de token)
   * 3. Cleanup: Desuscribe listener al desmontar (nunca pasa, pero buena práctica)
   */
  useEffect(() => {
    // 1. Intentar obtener sesión existente (persistida en localStorage por Supabase)
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[AuthProvider] Sesión inicial:', session ? 'Existe' : 'No existe');

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Si hay sesión, obtener perfil
        fetchProfile(session.user.id).then((userProfile) => {
          setProfile(userProfile);
          setIsLoading(false); // Carga completa (con perfil)
        });
      } else {
        // Si no hay sesión, terminar carga inmediatamente
        setIsLoading(false);
      }
    });

    // 2. Escuchar cambios en el estado de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthProvider] Evento de auth:', event);

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Usuario autenticado → obtener perfil
        const userProfile = await fetchProfile(session.user.id);
        setProfile(userProfile);
      } else {
        // Usuario no autenticado → limpiar perfil
        setProfile(null);
      }

      // Marcar carga como completa
      setIsLoading(false);
    });

    // 3. Cleanup: Desuscribir listener al desmontar
    return () => {
      subscription.unsubscribe();
    };
  }, []); // Ejecutar solo al montar

  /**
   * Función de login
   *
   * Flujo:
   * 1. Autenticar con Supabase Auth
   * 2. Obtener perfil de arca_user_profiles
   * 3. Validar que el perfil existe
   * 4. Actualizar estados globales
   * 5. Redirigir según rol
   *
   * Nota: Los estados (user, session, profile) se actualizan automáticamente
   * por el listener onAuthStateChange, PERO también los actualizamos aquí
   * para tener feedback inmediato sin esperar al listener.
   *
   * @param email - Email del usuario
   * @param password - Contraseña del usuario
   * @throws Error si credenciales inválidas o perfil no existe
   */
  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);

    try {
      // 1. Autenticar con Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error('No se pudo autenticar al usuario');
      }

      console.log('[AuthProvider] Login exitoso:', data.user.email);

      // 2. Obtener perfil del usuario
      const userProfile = await fetchProfile(data.user.id);

      if (!userProfile) {
        // Si no existe perfil, hacer logout inmediatamente
        await supabase.auth.signOut();
        throw new Error(
          'Perfil de usuario no encontrado. Contacta al administrador.'
        );
      }

      console.log('[AuthProvider] Perfil obtenido:', userProfile.role);

      // 3. Actualizar estados (también lo hace el listener, pero esto da feedback inmediato)
      setUser(data.user);
      setSession(data.session);
      setProfile(userProfile);

      // 4. CRÍTICO: Forzar sincronización de cookies ANTES de redirigir
      // Esto garantiza que el middleware tenga acceso a la sesión
      console.log('[AuthProvider] Sincronizando cookies...');
      await supabase.auth.getSession(); // Fuerza refresh de cookies

      // 5. Esperar propagación de cookies al navegador (workaround necesario)
      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log('[AuthProvider] Cookies sincronizadas, redirigiendo...');

      // 6. Ahora sí, redirigir con confianza
      redirectByRole(userProfile.role);
    } catch (error) {
      console.error('[AuthProvider] Error en login:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Función de logout
   *
   * Flujo:
   * 1. Llamar a Supabase signOut()
   * 2. Limpiar estados globales de AuthProvider
   * 3. CRÍTICO: Limpiar cache de React Query (seguridad + prevenir bugs)
   * 4. Redirigir a /login
   *
   * Nota sobre queryClient.clear():
   * - Elimina TODA la data cacheada (deudas, capítulos, comprobantes)
   * - Garantiza 0% de data sensible persistente entre usuarios
   * - Previene bugs de cache corrupto al hacer logout→login con otro usuario
   * - Ver issue: Loading infinito después de logout/login
   */
  const logout = async (): Promise<void> => {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      console.log('[AuthProvider] Logout exitoso');

      // Limpiar estados del AuthProvider
      setUser(null);
      setProfile(null);
      setSession(null);

      // CRÍTICO: Limpiar cache de React Query
      // Esto previene que queries del usuario anterior persistan en memoria
      queryClient.clear();
      console.log('[AuthProvider] Cache de React Query limpiado');

      // Redirigir a login
      router.push('/login');
    } catch (error) {
      console.error('[AuthProvider] Error en logout:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Refrescar perfil del usuario actual
   *
   * Útil para actualizar el nombre u otros datos del perfil sin recargar la página.
   * Se usa después de cambiar datos de perfil en modales.
   *
   * Flujo:
   * 1. Verificar que haya usuario autenticado
   * 2. Re-fetch del perfil desde Supabase
   * 3. Actualizar estado global
   *
   * NO recarga la página - solo actualiza el estado del contexto.
   */
  const refreshProfile = async (): Promise<void> => {
    if (!user) {
      console.warn('[AuthProvider] No se puede refrescar perfil: no hay usuario autenticado');
      return;
    }

    try {
      console.log('[AuthProvider] Refrescando perfil del usuario...');
      const updatedProfile = await fetchProfile(user.id);

      if (updatedProfile) {
        setProfile(updatedProfile);
        console.log('[AuthProvider] Perfil actualizado:', updatedProfile.full_name);
      } else {
        console.warn('[AuthProvider] No se pudo obtener el perfil actualizado');
      }
    } catch (error) {
      console.error('[AuthProvider] Error al refrescar perfil:', error);
      throw error;
    }
  };

  /**
   * Redirige al usuario según su rol
   *
   * FIX: Reemplazado window.location.assign() por router.push()
   * Esto elimina el "hard reload" que causaba 3+ min de delay.
   * Ahora redirige directamente al dashboard correcto usando client-side navigation.
   *
   * @param role - Rol del usuario (admin | president)
   */
  const redirectByRole = (role: UserRole) => {
    console.log('[AuthProvider] Redirigiendo con client-side navigation...');

    // Redirigir directamente al dashboard correcto según rol
    // Ya NO pasamos por raíz (/) - navegación directa
    const targetPath = role === 'admin' ? '/admin/dashboard' : '/presidente/dashboard';
    router.push(targetPath);
  };

  // Valor del contexto que se expone a los consumidores
  const value = {
    user,
    session,
    profile,
    isLoading,
    isAuthenticated: !!user && !!profile,
    isAdmin: profile?.role === 'admin',
    isPresident: profile?.role === 'president',
    login,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
