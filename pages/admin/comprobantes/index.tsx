import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useDebts } from '@/hooks/useDebts';
import { useMarkOverdueDebts } from '@/hooks/useMarkOverdueDebts';
import type { Debt } from '@/types/database.types';
import ApprovalModal from '@/components/modals/ApprovalModal';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';

/**
 * Página de Revisión de Comprobantes - El Arca
 *
 * Características:
 * - Lista todos los pagos con status='in_review'
 * - Tabla con columnas: Capítulo, Concepto, Monto, Fecha subida, Botón Revisar
 * - Modal para aprobar/rechazar con preview del comprobante
 * - Badge contador de pagos pendientes
 * - Protegido: solo accesible por role='admin'
 */

export default function ComprobantesPage() {
  const { profile, isAuthenticated, isAdmin, isLoading, logout } = useAuth();
  const { data: debtsInReview = [], isLoading: loadingDebts } = useDebts({ status: 'in_review' });

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);

  // Marcar deudas vencidas al cargar página (ejecuta 1 vez por sesión)
  useMarkOverdueDebts();

  // Mostrar loading mientras verifica autenticación
  if (isLoading) {
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
  if (!isAuthenticated || !isAdmin || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-dark">
        <div className="text-center">
          <p className="text-danger mb-4">Acceso denegado</p>
          <p className="text-text-secondary text-sm">
            Solo administradores pueden acceder a esta página
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

  const handleReview = (debt: Debt) => {
    setSelectedDebt(debt);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedDebt(null);
  };

  return (
    <>
      <Head>
        <title>Revisión de Comprobantes - El Arca</title>
        <meta name="description" content="Aprobar o rechazar comprobantes de pago" />
      </Head>

      <div className="min-h-screen bg-background-dark">
        {/* Header */}
        <header className="bg-surface-dark border-b border-border-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-primary hover:text-primary-light transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <h1 className="text-2xl font-bold">El Arca</h1>
                </Link>
                <p className="text-sm text-text-secondary">Revisión de Comprobantes</p>
              </div>
              <div className="flex items-center gap-4">
                {/* Badge contador */}
                {debtsInReview.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full">
                    <span className="text-blue-400 text-sm font-medium">
                      {debtsInReview.length} en revisión
                    </span>
                  </div>
                )}
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
          {/* Header de sección */}
          <div className="card mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-primary mb-2">
                  🔍 Comprobantes en Revisión
                </h2>
                <p className="text-text-secondary text-sm">
                  Aprueba o rechaza los comprobantes de pago subidos por los presidentes
                </p>
              </div>
              {debtsInReview.length > 0 && (
                <div className="text-right">
                  <p className="text-3xl font-bold text-primary">{debtsInReview.length}</p>
                  <p className="text-text-secondary text-sm">pendientes</p>
                </div>
              )}
            </div>
          </div>

          {/* Tabla de comprobantes */}
          <div className="card">
            {loadingDebts ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-text-secondary">Cargando comprobantes...</p>
              </div>
            ) : debtsInReview.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto mb-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-text-secondary mb-2">
                  No hay comprobantes pendientes de revisión
                </p>
                <p className="text-text-muted text-sm">
                  Todos los pagos han sido procesados
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-dark">
                      <th className="text-left py-3 px-4 text-text-secondary font-medium">Capítulo</th>
                      <th className="text-left py-3 px-4 text-text-secondary font-medium">Concepto</th>
                      <th className="text-right py-3 px-4 text-text-secondary font-medium">Monto</th>
                      <th className="text-left py-3 px-4 text-text-secondary font-medium">Subido el</th>
                      <th className="text-right py-3 px-4 text-text-secondary font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debtsInReview.map((debt) => (
                      <tr key={debt.id} className="border-b border-border-dark/50 hover:bg-surface-dark/30">
                        <td className="py-4 px-4">
                          <p className="text-text-primary font-medium">
                            {(debt as any).chapter?.name || 'Sin información'}
                          </p>
                          <p className="text-text-muted text-xs">
                            {(debt as any).chapter?.regional}
                          </p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-text-primary">{debt.description}</p>
                          <p className="text-text-muted text-xs capitalize">{debt.debt_type}</p>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <p className="text-primary font-bold">{formatCurrency(Number(debt.amount))}</p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-text-secondary">
                            {debt.proof_uploaded_at
                              ? formatDateTime(debt.proof_uploaded_at)
                              : 'Sin fecha'}
                          </p>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            className="btn-primary text-xs"
                            onClick={() => handleReview(debt)}
                          >
                            🔍 Revisar
                          </button>
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
              📋 Instrucciones
            </h3>
            <ol className="text-sm text-text-secondary space-y-2 list-decimal list-inside">
              <li>Haz click en "Revisar" para ver el comprobante de pago</li>
              <li>Verifica que el monto y los datos bancarios coincidan</li>
              <li>Haz click en "Aprobar" si todo está correcto</li>
              <li>Haz click en "Rechazar" si el comprobante no es válido</li>
              <li>El presidente recibirá una notificación del resultado</li>
            </ol>
          </div>
        </main>
      </div>

      {/* Modal de Aprobación */}
      {selectedDebt && (
        <ApprovalModal
          debt={selectedDebt}
          isOpen={modalOpen}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
