import { useState } from 'react';
import Head from 'next/head';
import { useAuth } from '@/hooks/useAuth';
import { useMyChapter } from '@/hooks/useChapters';
import { useDebts } from '@/hooks/useDebts';
import { useMarkOverdueDebts } from '@/hooks/useMarkOverdueDebts';
import type { Debt, DebtStatus } from '@/types/database.types';
import UploadProofModal from '@/components/modals/UploadProofModal';

/**
 * Dashboard de Presidente - El Arca
 *
 * Características Implementadas:
 * - Ver información del capítulo asignado
 * - Lista de deudas del capítulo (protegida por RLS)
 * - Filtros por status (pending, overdue, in_review, approved)
 * - Ver detalles de cada deuda
 * - Subir comprobante de pago (próximamente)
 *
 * Seguridad:
 * - RLS garantiza que solo ve deudas de SU capítulo
 * - Middleware valida rol 'president'
 */

type FilterStatus = DebtStatus | 'all';

export default function PresidentDashboard() {
  const { profile, isAuthenticated, isPresident, isLoading, logout } = useAuth();
  const { data: myChapter, isLoading: loadingChapter } = useMyChapter();

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);

  // Marcar deudas vencidas al cargar dashboard (ejecuta 1 vez por sesión)
  useMarkOverdueDebts();

  // Obtener deudas del capítulo con filtro opcional
  const { data: debts = [], isLoading: loadingDebts } = useDebts({
    chapter_id: myChapter?.id,
    status: filterStatus === 'all' ? undefined : filterStatus,
  });

  // Mostrar loading mientras verifica autenticación
  if (isLoading || loadingChapter) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Cargando...</p>
        </div>
      </div>
    );
  }

  // Validación defensiva
  if (!isAuthenticated || !isPresident || !profile || !myChapter) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-dark">
        <div className="text-center">
          <p className="text-danger mb-4">Error: No se encontró un capítulo asignado</p>
          <p className="text-text-secondary text-sm">
            Contacta al administrador si eres presidente de capítulo
          </p>
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

  // Calcular estadísticas
  const totalDebts = debts.length;
  const pendingDebts = debts.filter(d => d.status === 'pending').length;
  const overdueDebts = debts.filter(d => d.status === 'overdue').length;
  const totalAmount = debts.reduce((sum, d) => sum + Number(d.amount), 0);

  // Formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  // Badge de status
  const getStatusBadge = (status: DebtStatus) => {
    const badges = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      overdue: 'bg-danger/20 text-danger border-danger/30',
      in_review: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      approved: 'bg-primary/20 text-primary border-primary/30',
    };

    const labels = {
      pending: 'Pendiente',
      overdue: 'Vencido',
      in_review: 'En Revisión',
      approved: 'Aprobado',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badges[status]}`}>
        {labels[status]}
      </span>
    );
  };

  // Abrir modal de upload
  const handleUploadClick = (debt: Debt) => {
    setSelectedDebt(debt);
    setUploadModalOpen(true);
  };

  // Cerrar modal
  const handleCloseModal = () => {
    setUploadModalOpen(false);
    setSelectedDebt(null);
  };

  return (
    <>
      <Head>
        <title>Dashboard Presidente - El Arca</title>
        <meta name="description" content="Panel de presidente de capítulo" />
      </Head>

      <div className="min-h-screen bg-background-dark">
        {/* Header */}
        <header className="bg-surface-dark border-b border-border-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-primary">El Arca</h1>
                <p className="text-sm text-text-secondary">Panel de Presidente</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-text-primary">
                    {profile?.full_name}
                  </p>
                  <p className="text-xs text-text-muted">
                    {myChapter.name}
                  </p>
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
          {/* Información del Capítulo */}
          <div className="card mb-8">
            <h2 className="text-xl font-bold text-primary mb-4">
              {myChapter.name}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-text-secondary">Regional</p>
                <p className="text-text-primary font-medium">{myChapter.regional}</p>
              </div>
              <div>
                <p className="text-text-secondary">Miembros</p>
                <p className="text-text-primary font-medium">{myChapter.member_count}</p>
              </div>
              <div>
                <p className="text-text-secondary">Deudas Pendientes</p>
                <p className="text-yellow-400 font-medium">{pendingDebts}</p>
              </div>
              <div>
                <p className="text-text-secondary">Deudas Vencidas</p>
                <p className="text-danger font-medium">{overdueDebts}</p>
              </div>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="card border-primary">
              <p className="text-text-secondary text-sm mb-2">Total Deudas</p>
              <p className="text-3xl font-bold text-primary">{totalDebts}</p>
            </div>
            <div className="card border-yellow-500/30">
              <p className="text-text-secondary text-sm mb-2">Pendientes</p>
              <p className="text-3xl font-bold text-yellow-400">{pendingDebts}</p>
            </div>
            <div className="card border-danger/30">
              <p className="text-text-secondary text-sm mb-2">Vencidas</p>
              <p className="text-3xl font-bold text-danger">{overdueDebts}</p>
            </div>
            <div className="card border-primary/30">
              <p className="text-text-secondary text-sm mb-2">Monto Total</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="card mb-6">
            <h3 className="text-sm font-medium text-text-muted mb-4">Filtrar por Estado</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-primary text-white'
                    : 'bg-surface-dark text-text-secondary hover:bg-surface-dark/70'
                }`}
              >
                Todas ({debts.length})
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'pending'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-surface-dark text-text-secondary hover:bg-surface-dark/70'
                }`}
              >
                Pendientes ({pendingDebts})
              </button>
              <button
                onClick={() => setFilterStatus('overdue')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'overdue'
                    ? 'bg-danger text-white'
                    : 'bg-surface-dark text-text-secondary hover:bg-surface-dark/70'
                }`}
              >
                Vencidas ({overdueDebts})
              </button>
              <button
                onClick={() => setFilterStatus('in_review')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'in_review'
                    ? 'bg-blue-500 text-white'
                    : 'bg-surface-dark text-text-secondary hover:bg-surface-dark/70'
                }`}
              >
                En Revisión
              </button>
              <button
                onClick={() => setFilterStatus('approved')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'approved'
                    ? 'bg-primary text-white'
                    : 'bg-surface-dark text-text-secondary hover:bg-surface-dark/70'
                }`}
              >
                Aprobadas
              </button>
            </div>
          </div>

          {/* Lista de Deudas */}
          <div className="card">
            <h3 className="text-lg font-bold text-primary mb-6">Mis Deudas</h3>

            {loadingDebts ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-text-secondary">Cargando deudas...</p>
              </div>
            ) : debts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-secondary mb-2">
                  {filterStatus === 'all'
                    ? 'No tienes deudas asignadas'
                    : `No hay deudas con estado: ${filterStatus}`
                  }
                </p>
                <p className="text-text-muted text-sm">
                  Las deudas aparecerán aquí cuando el administrador las cree
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-dark">
                      <th className="text-left py-3 px-4 text-text-secondary font-medium">Descripción</th>
                      <th className="text-left py-3 px-4 text-text-secondary font-medium">Tipo</th>
                      <th className="text-right py-3 px-4 text-text-secondary font-medium">Monto</th>
                      <th className="text-left py-3 px-4 text-text-secondary font-medium">Vencimiento</th>
                      <th className="text-left py-3 px-4 text-text-secondary font-medium">Estado</th>
                      <th className="text-right py-3 px-4 text-text-secondary font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debts.map((debt) => (
                      <tr key={debt.id} className="border-b border-border-dark/50 hover:bg-surface-dark/30">
                        <td className="py-4 px-4">
                          <p className="text-text-primary font-medium">{debt.description}</p>
                        </td>
                        <td className="py-4 px-4">
                          <span className="capitalize text-text-secondary">{debt.debt_type}</span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <p className="text-primary font-bold">{formatCurrency(Number(debt.amount))}</p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-text-secondary">{formatDate(debt.due_date)}</p>
                        </td>
                        <td className="py-4 px-4">
                          {getStatusBadge(debt.status)}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {(debt.status === 'pending' || debt.status === 'overdue') && (
                            <button
                              className="btn-primary text-xs"
                              onClick={() => handleUploadClick(debt)}
                            >
                              Subir Comprobante
                            </button>
                          )}
                          {debt.status === 'in_review' && (
                            <span className="text-blue-400 text-xs">En revisión...</span>
                          )}
                          {debt.status === 'approved' && (
                            <span className="text-primary text-xs">✓ Pagado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Instrucciones */}
          <div className="mt-8 card bg-primary/5 border-primary">
            <h3 className="text-sm font-medium text-primary mb-3">
              📋 Instrucciones para Pagar
            </h3>
            <ol className="text-sm text-text-secondary space-y-2 list-decimal list-inside">
              <li>Realiza el pago usando los datos bancarios proporcionados</li>
              <li>Guarda el comprobante de pago (captura de pantalla o PDF)</li>
              <li>Presiona "Subir Comprobante" en la deuda correspondiente</li>
              <li>El status cambiará a "En Revisión"</li>
              <li>El administrador revisará y aprobará tu pago</li>
            </ol>
          </div>
        </main>
      </div>

      {/* Modal de Upload */}
      {selectedDebt && myChapter && (
        <UploadProofModal
          debt={selectedDebt}
          chapterName={myChapter.name}
          isOpen={uploadModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
