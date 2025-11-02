import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

/**
 * Página: Lista de Solicitudes (Admin)
 */

export default function SolicitudesPage() {
  const { profile, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <>
      <Head>
        <title>Solicitudes - El Arca</title>
        <meta name="description" content="Gestión de solicitudes de deuda" />
      </Head>

      <div className="min-h-screen bg-background-dark">
        {/* Header */}
        <header className="bg-surface-dark border-b border-border-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-primary">El Arca</h1>
                <p className="text-sm text-text-secondary">Panel de Administración</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-text-primary">
                    {profile?.full_name}
                  </p>
                  <p className="text-xs text-text-muted">Administrador</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="btn-danger text-sm"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <nav className="mb-6">
            <ol className="flex items-center space-x-2 text-sm">
              <li>
                <Link href="/admin/dashboard" className="text-primary hover:text-primary-light">
                  Dashboard
                </Link>
              </li>
              <li className="text-text-muted">/</li>
              <li className="text-text-primary font-medium">Solicitudes</li>
            </ol>
          </nav>

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
            <div>
              <h2 className="text-3xl font-bold text-text-primary mb-2">
                Solicitudes de Deuda
              </h2>
              <p className="text-text-secondary">
                Administra las solicitudes de apoyo, aportación y multas
              </p>
            </div>
            <Link href="/admin/solicitudes/crear">
              <button className="btn-primary">
                + Nueva Solicitud
              </button>
            </Link>
          </div>

          {/* Placeholder Content */}
          <div className="card text-center py-12">
            <p className="text-text-primary text-lg mb-4">
              ✅ Módulo de Solicitudes Habilitado
            </p>
            <p className="text-text-secondary mb-6">
              La funcionalidad completa de lista se implementará en la siguiente fase.
              <br />
              Por ahora puedes crear nuevas solicitudes usando el botón "+ Nueva Solicitud" arriba.
            </p>
            <Link href="/admin/solicitudes/crear">
              <button className="btn-primary">
                Ir a Crear Solicitud
              </button>
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}
