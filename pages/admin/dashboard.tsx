import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

/**
 * Dashboard de Administrador - El Arca
 *
 * Características:
 * - Vista general del sistema
 * - Acceso a gestión de capítulos, solicitudes y reportes
 * - Protegido: solo accesible por role='admin'
 *
 * TODO (Sprint 3):
 * - Implementar Tab 1: Vista General
 * - Implementar Tab 2: Vista Por Solicitud
 * - Implementar Tab 3: Vista Por Capítulo
 */

export default function AdminDashboard() {
  const { profile, isAuthenticated, isAdmin, isLoading, logout } = useAuth();

  // Mostrar loading mientras verifica autenticación
  // NOTA: El middleware ya validó autenticación y rol antes de llegar aquí
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Cargando...</p>
        </div>
      </div>
    );
  }

  // Validación defensiva: Asegurar que profile existe antes de renderizar
  // (El middleware ya validó, pero esto previene errores si hay un bug en AuthProvider)
  if (!isAuthenticated || !isAdmin || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary">Error de autenticación. Recargando...</p>
        </div>
      </div>
    );
  }

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
        <title>Dashboard Admin - El Arca</title>
        <meta name="description" content="Panel de administración" />
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
          {/* Bienvenida */}
          <div className="card mb-8">
            <h2 className="text-xl font-bold text-primary mb-2">
              Bienvenido, {profile?.full_name}
            </h2>
            <p className="text-text-secondary">
              Has iniciado sesión exitosamente como Administrador.
            </p>
          </div>

          {/* Grid de secciones disponibles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card: Gestión de Capítulos */}
            <Link href="/admin/capitulos">
              <div className="card hover:border-primary cursor-pointer transition-colors">
                <h3 className="text-lg font-bold text-primary mb-2">
                  Gestión de Capítulos
                </h3>
                <p className="text-text-secondary text-sm mb-4">
                  Crear, editar y administrar los capítulos del club.
                </p>
                <p className="text-xs text-primary-light font-medium">
                  ✅ Disponible → Click para acceder
                </p>
              </div>
            </Link>

            {/* Card: Registro de Solicitudes */}
            <Link href="/admin/solicitudes">
              <div className="card hover:border-primary cursor-pointer transition-colors">
                <h3 className="text-lg font-bold text-primary mb-2">
                  Registro de Solicitudes
                </h3>
                <p className="text-text-secondary text-sm mb-4">
                  Crear solicitudes de apoyo, aportación o multa.
                </p>
                <p className="text-xs text-primary-light font-medium">
                  ✅ Disponible → Click para acceder
                </p>
              </div>
            </Link>

            {/* Card: Revisión de Comprobantes */}
            <Link href="/admin/comprobantes">
              <div className="card hover:border-primary cursor-pointer transition-colors">
                <h3 className="text-lg font-bold text-primary mb-2">
                  Revisión de Comprobantes
                </h3>
                <p className="text-text-secondary text-sm mb-4">
                  Aprobar o rechazar comprobantes de pago.
                </p>
                <p className="text-xs text-primary-light font-medium">
                  ✅ Disponible → Click para acceder
                </p>
              </div>
            </Link>

            {/* Card: Dashboard de Métricas */}
            <Link href="/admin/metricas">
              <div className="card hover:border-primary cursor-pointer transition-colors">
                <h3 className="text-lg font-bold text-primary mb-2">
                  Dashboard de Métricas
                </h3>
                <p className="text-text-secondary text-sm mb-4">
                  Vista general, por solicitud y por capítulo.
                </p>
                <p className="text-xs text-primary-light font-medium">
                  ✅ Disponible → Click para acceder
                </p>
              </div>
            </Link>

            {/* Card: Auditoría */}
            <div className="card hover:border-primary cursor-pointer transition-colors">
              <h3 className="text-lg font-bold text-primary mb-2">
                Registro de Auditoría
              </h3>
              <p className="text-text-secondary text-sm mb-4">
                Historial de cambios en deudas y pagos.
              </p>
              <p className="text-xs text-text-muted">
                Estado: Trigger implementado en DB
              </p>
            </div>

            {/* Card: Configuración */}
            <div className="card hover:border-primary cursor-pointer transition-colors">
              <h3 className="text-lg font-bold text-primary mb-2">
                Configuración
              </h3>
              <p className="text-text-secondary text-sm mb-4">
                Gestionar usuarios y configuración del sistema.
              </p>
              <p className="text-xs text-text-muted">
                Estado: Pendiente (Post-MVP)
              </p>
            </div>
          </div>

          {/* Información del sistema */}
          <div className="mt-8 card">
            <h3 className="text-sm font-medium text-text-muted mb-4">
              Estado del Sistema
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-text-secondary">Base de Datos</p>
                <p className="text-primary-light font-medium">✅ Conectado</p>
              </div>
              <div>
                <p className="text-text-secondary">Storage</p>
                <p className="text-primary-light font-medium">✅ Configurado</p>
              </div>
              <div>
                <p className="text-text-secondary">Autenticación</p>
                <p className="text-primary-light font-medium">✅ Activo</p>
              </div>
              <div>
                <p className="text-text-secondary">Rol Actual</p>
                <p className="text-primary-light font-medium">Admin</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
