import Head from 'next/head';

/**
 * Página de inicio - El Arca
 *
 * IMPORTANTE: Esta página NO maneja redirección.
 * El middleware (middleware.ts) se encarga de:
 * 1. Verificar si hay sesión válida
 * 2. Redirigir a /login si no hay sesión
 * 3. Redirigir a /admin/dashboard o /presidente/dashboard según rol
 *
 * Esta página solo muestra un loading spinner mientras el middleware decide.
 */
export default function Home() {
  // NO hay lógica de redirección aquí
  // El middleware maneja TODO

  return (
    <>
      <Head>
        <title>El Arca - Sistema de Tesorería</title>
        <meta name="description" content="Sistema de tesorería para moto club" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Cargando...</p>
        </div>
      </main>
    </>
  );
}
