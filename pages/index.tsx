import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/hooks/useAuth';

/**
 * Página Principal - El Arca
 *
 * Esta página redirige automáticamente al dashboard correcto según el rol del usuario:
 * - Admin → /admin/dashboard
 * - President → /presidente/dashboard
 * - No autenticado → /login
 *
 * NOTA: Middleware ya NO maneja esta redirection (eliminado para fix de performance)
 * Ver commit: "Fix: Eliminar query bloqueante del middleware"
 */

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, isPresident, isLoading } = useAuth();

  useEffect(() => {
    // Esperar a que termine de cargar el estado de autenticación
    if (isLoading) return;

    // Si no está autenticado, redirigir a login
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    // Redirigir según rol
    if (isAdmin) {
      router.replace('/admin/dashboard');
    } else if (isPresident) {
      router.replace('/presidente/dashboard');
    } else {
      // Fallback: Usuario sin rol válido
      router.replace('/login?error=no_role');
    }
  }, [isLoading, isAuthenticated, isAdmin, isPresident, router]);

  // Mostrar loading mientras se determina la redirection
  return (
    <>
      <Head>
        <title>El Arca - Sistema de Tesorería</title>
        <meta name="description" content="Sistema de tesorería para moto club" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen flex items-center justify-center bg-background-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Cargando...</p>
        </div>
      </main>
    </>
  );
}
