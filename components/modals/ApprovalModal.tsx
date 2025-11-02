import { useState } from 'react';
import type { Debt } from '@/types/database.types';
import { useApproveDebt } from '@/hooks/useDebts';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';

/**
 * Modal para Aprobar/Rechazar Comprobante de Pago
 *
 * Características:
 * - Muestra todos los detalles de la deuda
 * - Preview del comprobante (imagen/PDF)
 * - Botones Aprobar (verde) / Rechazar (rojo)
 * - Toast de confirmación
 * - Integración con hook useApproveDebt
 *
 * @param debt - Deuda completa con proof_file_url
 * @param isOpen - Estado del modal
 * @param onClose - Callback para cerrar el modal
 */

interface ApprovalModalProps {
  debt: Debt & {
    chapter?: {
      name: string;
      regional: string;
    };
  };
  isOpen: boolean;
  onClose: () => void;
}

export default function ApprovalModal({ debt, isOpen, onClose }: ApprovalModalProps) {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const { mutateAsync: approveDebt, isLoading: isProcessing, error, reset } = useApproveDebt();

  if (!isOpen) return null;

  // Determinar si el comprobante es imagen o PDF
  const isImage = debt.proof_file_url?.match(/\.(jpg|jpeg|png)$/i);

  const handleApprove = async () => {
    try {
      await approveDebt({ debt_id: debt.id, action: 'approve' });

      setToastMessage('Comprobante aprobado exitosamente');
      setShowToast(true);

      setTimeout(() => {
        setShowToast(false);
        onClose();
      }, 1500);
    } catch (err) {
      // El error ya está capturado por React Query en el estado 'error'
      // Solo logueamos para debugging
      console.error('[ApprovalModal] Error al aprobar:', err);

      // El error se mostrará automáticamente en la UI (líneas 255-261)
      // El usuario puede cerrar el modal para reintentar
    }
  };

  const handleReject = async () => {
    if (!confirm('¿Estás seguro de rechazar este comprobante? El presidente deberá subir uno nuevo.')) {
      return;
    }

    try {
      await approveDebt({ debt_id: debt.id, action: 'reject' });

      setToastMessage('Comprobante rechazado. Status: Pendiente');
      setShowToast(true);

      setTimeout(() => {
        setShowToast(false);
        onClose();
      }, 1500);
    } catch (err) {
      // El error ya está capturado por React Query en el estado 'error'
      console.error('[ApprovalModal] Error al rechazar:', err);
    }
  };

  // Función para cerrar modal y resetear errores
  const handleClose = () => {
    reset(); // Resetear estado de React Query
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/70 z-40"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-surface-dark border border-border-dark rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-surface-dark border-b border-border-dark px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-primary">
                🔍 Revisar Comprobante de Pago
              </h2>
              <button
                onClick={onClose}
                className="text-text-secondary hover:text-text-primary transition-colors"
                disabled={isProcessing}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Grid: Detalles + Comprobante */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Columna 1: Detalles de la Deuda */}
              <div className="space-y-4">
                <div className="card bg-primary/5 border-primary">
                  <h3 className="text-sm font-medium text-primary mb-4">
                    📋 Detalles de la Solicitud
                  </h3>

                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-text-secondary">Capítulo:</span>
                      <p className="text-text-primary font-medium">
                        {debt.chapter?.name || 'Sin información'}
                      </p>
                    </div>

                    <div>
                      <span className="text-text-secondary">Regional:</span>
                      <p className="text-text-primary font-medium">
                        {debt.chapter?.regional || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <span className="text-text-secondary">Concepto:</span>
                      <p className="text-text-primary font-medium">{debt.description}</p>
                    </div>

                    <div>
                      <span className="text-text-secondary">Tipo:</span>
                      <p className="text-text-primary capitalize">{debt.debt_type}</p>
                    </div>

                    <div>
                      <span className="text-text-secondary">Monto:</span>
                      <p className="text-primary font-bold text-lg">
                        {formatCurrency(Number(debt.amount))}
                      </p>
                    </div>

                    <div>
                      <span className="text-text-secondary">Fecha límite:</span>
                      <p className="text-text-primary">
                        {new Date(debt.due_date).toLocaleDateString('es-MX', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>

                    {debt.proof_uploaded_at && (
                      <div>
                        <span className="text-text-secondary">Subido el:</span>
                        <p className="text-text-primary">
                          {formatDateTime(debt.proof_uploaded_at)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Datos Bancarios */}
                <div className="card">
                  <h4 className="text-sm font-medium text-text-secondary mb-3">
                    💳 Datos Bancarios
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-text-muted">Banco:</span>
                      <p className="text-text-primary">{debt.bank_name}</p>
                    </div>
                    {debt.bank_clabe && (
                      <div>
                        <span className="text-text-muted">CLABE:</span>
                        <p className="text-text-primary font-mono">{debt.bank_clabe}</p>
                      </div>
                    )}
                    {debt.bank_account && (
                      <div>
                        <span className="text-text-muted">Cuenta:</span>
                        <p className="text-text-primary font-mono">{debt.bank_account}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-text-muted">Titular:</span>
                      <p className="text-text-primary">{debt.bank_holder}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Columna 2: Preview del Comprobante */}
              <div className="card">
                <h3 className="text-sm font-medium text-text-secondary mb-4">
                  📎 Comprobante de Pago
                </h3>

                {debt.proof_file_url ? (
                  <>
                    {isImage ? (
                      // Preview de imagen
                      <div className="rounded-lg overflow-hidden border border-border-dark mb-4">
                        <img
                          src={debt.proof_file_url}
                          alt="Comprobante de pago"
                          className="w-full h-auto"
                        />
                      </div>
                    ) : (
                      // Preview de PDF (icono + link)
                      <div className="flex items-center justify-center p-8 border-2 border-dashed border-border-dark rounded-lg mb-4">
                        <div className="text-center">
                          <svg className="w-16 h-16 mx-auto mb-4 text-danger" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                          </svg>
                          <p className="text-text-primary font-medium">Archivo PDF</p>
                          <p className="text-text-muted text-xs mt-1">
                            Haz click en "Ver Comprobante" para abrir
                          </p>
                        </div>
                      </div>
                    )}

                    <a
                      href={debt.proof_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary w-full text-center"
                    >
                      📥 Ver/Descargar Comprobante
                    </a>
                  </>
                ) : (
                  <p className="text-text-muted text-center py-8">
                    No hay comprobante disponible
                  </p>
                )}
              </div>
            </div>

            {/* Mostrar error */}
            {error && (
              <div className="card bg-danger/10 border-danger">
                <p className="text-danger text-sm">
                  ❌ Error: {error.message}
                </p>
              </div>
            )}

            {/* Botones de Acción */}
            <div className="flex gap-3 pt-4 border-t border-border-dark">
              <button
                type="button"
                onClick={handleReject}
                className="btn-danger flex-1"
                disabled={isProcessing}
              >
                {isProcessing ? 'Procesando...' : '❌ Rechazar'}
              </button>
              <button
                type="button"
                onClick={handleApprove}
                className="btn-primary flex-1"
                disabled={isProcessing}
              >
                {isProcessing ? 'Procesando...' : '✅ Aprobar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast de éxito */}
      {showToast && (
        <div className="fixed bottom-4 right-4 z-[60] animate-fade-in">
          <div className="card bg-primary border-primary shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="text-primary text-2xl">✓</div>
              <p className="text-text-primary font-medium">{toastMessage}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
