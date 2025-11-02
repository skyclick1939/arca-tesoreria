import { useState, useRef, FormEvent, useMemo } from 'react';
import type { Debt } from '@/types/database.types';
import { useUploadProof, useReplaceProof } from '@/hooks/useUploadProof';
import { formatCurrency, formatFileSize } from '@/lib/utils/format';
import { validateFile } from '@/lib/storage/storage-helpers';

/**
 * Modal para Subir Comprobante de Pago
 *
 * Características:
 * - Pre-carga datos de la deuda (NO editables)
 * - Input file con validación (PNG, JPEG, PDF, max 5MB)
 * - Preview del archivo seleccionado
 * - Textarea para notas adicionales (opcional)
 * - Integración con hook useUploadProof
 * - Toast de confirmación
 * - Cierre automático y refresh del dashboard
 *
 * @param debt - Deuda completa con todos los campos
 * @param chapterName - Nombre del capítulo del presidente
 * @param isOpen - Estado del modal (abierto/cerrado)
 * @param onClose - Callback para cerrar el modal
 */

interface UploadProofModalProps {
  debt: Debt;
  chapterName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function UploadProofModal({
  debt,
  chapterName,
  isOpen,
  onClose,
}: UploadProofModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hooks para upload y reemplazo
  const { uploadProof, isUploading: isUploadingInitial, error: uploadError } = useUploadProof();
  const { replaceProof, isReplacing, error: replaceError } = useReplaceProof();

  // Detectar si es reemplazo o upload inicial
  const isReplaceMode = useMemo(() => {
    return Boolean(debt.proof_file_url && debt.status === 'in_review');
  }, [debt.proof_file_url, debt.status]);

  // Validar que el status permite reemplazo
  const canReplace = useMemo(() => {
    if (!debt.proof_file_url) return false; // No hay archivo previo
    if (debt.status === 'approved') return false; // Ya aprobado, no se puede modificar
    return debt.status === 'in_review'; // Solo en revisión se puede reemplazar
  }, [debt.proof_file_url, debt.status]);

  // Extraer path del archivo anterior desde la URL
  const oldFilePath = useMemo(() => {
    if (!debt.proof_file_url) return null;

    try {
      // URL format: https://.../storage/v1/object/public/arca-comprobantes/{path}
      const url = new URL(debt.proof_file_url);
      const pathMatch = url.pathname.match(/\/arca-comprobantes\/(.+)$/);
      return pathMatch ? pathMatch[1] : null;
    } catch (e) {
      console.error('Error parsing proof URL:', e);
      return null;
    }
  }, [debt.proof_file_url]);

  // Determinar estado de carga
  const isLoading = isUploadingInitial || isReplacing;
  const error = uploadError || replaceError;

  // Cerrar modal si no está abierto
  if (!isOpen) return null;

  // Manejar selección de archivo con validación usando helper
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Usar validación centralizada del helper
    const validation = validateFile(file);

    if (!validation.valid) {
      setValidationError(validation.error || 'Archivo no válido');
      setSelectedFile(null);
      return;
    }

    // Limpiar error previo y establecer archivo
    setValidationError(null);
    setSelectedFile(file);
  };

  // Manejar submit (upload inicial o reemplazo)
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      setValidationError('Debes seleccionar un archivo');
      return;
    }

    // Validar que en modo reemplazo tengamos el path anterior
    if (isReplaceMode && !oldFilePath) {
      setValidationError('No se pudo obtener la ruta del archivo anterior');
      return;
    }

    // Validar que el status permite la operación
    if (debt.status === 'approved') {
      setValidationError('No puedes modificar un comprobante ya aprobado');
      return;
    }

    try {
      if (isReplaceMode && oldFilePath) {
        // Modo reemplazo: eliminar anterior y subir nuevo
        await replaceProof({
          file: selectedFile,
          chapterId: debt.chapter_id,
          debtId: debt.id,
          oldPath: oldFilePath,
        });
      } else {
        // Modo upload inicial
        await uploadProof({
          file: selectedFile,
          chapterId: debt.chapter_id,
          debtId: debt.id,
        });
      }

      // Mostrar toast de éxito
      setShowToast(true);

      // Cerrar modal después de 1.5 segundos
      setTimeout(() => {
        setShowToast(false);
        handleClose();
      }, 1500);
    } catch (err) {
      console.error(`[UploadProofModal] Error al ${isReplaceMode ? 'reemplazar' : 'subir'} comprobante:`, err);
      // El error se muestra en el modal (gestionado por los hooks)
    }
  };

  // Extraer nombre del archivo actual desde la URL
  const currentFileName = useMemo(() => {
    if (!debt.proof_file_url) return null;

    try {
      const url = new URL(debt.proof_file_url);
      const pathParts = url.pathname.split('/');
      const fileNameWithTimestamp = pathParts[pathParts.length - 1];
      // Remover el timestamp del inicio: "{timestamp}-{filename}"
      return fileNameWithTimestamp.split('-').slice(1).join('-');
    } catch (e) {
      return 'archivo-actual';
    }
  }, [debt.proof_file_url]);

  // Cerrar modal y limpiar estado
  const handleClose = () => {
    setSelectedFile(null);
    setValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
          className="bg-surface-dark border border-border-dark rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-surface-dark border-b border-border-dark px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-primary">
                {isReplaceMode ? '🔄 Reemplazar Comprobante de Pago' : '📤 Subir Comprobante de Pago'}
              </h2>
              <button
                onClick={handleClose}
                className="text-text-secondary hover:text-text-primary transition-colors"
                disabled={isLoading}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Datos de la Deuda (NO editables) */}
            <div className="card bg-primary/5 border-primary">
              <h3 className="text-sm font-medium text-primary mb-4">
                📋 Detalles de la Solicitud
              </h3>

              <div className="space-y-3 text-sm">
                {/* Solicitud/Concepto */}
                <div>
                  <span className="text-text-secondary">Solicitud:</span>
                  <p className="text-text-primary font-medium">{debt.description}</p>
                </div>

                {/* Mi Capítulo */}
                <div>
                  <span className="text-text-secondary">Mi Capítulo:</span>
                  <p className="text-text-primary font-medium">{chapterName}</p>
                </div>

                {/* Monto que debo */}
                <div>
                  <span className="text-text-secondary">Monto que debo:</span>
                  <p className="text-primary font-bold text-lg">
                    {formatCurrency(Number(debt.amount))}
                  </p>
                </div>

                {/* Datos Bancarios */}
                <div className="pt-3 border-t border-border-dark">
                  <span className="text-text-secondary block mb-2">Depositar a:</span>
                  <div className="bg-surface-dark/50 rounded p-3 space-y-1">
                    <p className="text-text-primary">
                      <span className="text-text-secondary">Banco:</span> {debt.bank_name}
                    </p>
                    {debt.bank_clabe && (
                      <p className="text-text-primary">
                        <span className="text-text-secondary">CLABE:</span> {debt.bank_clabe}
                      </p>
                    )}
                    {debt.bank_account && (
                      <p className="text-text-primary">
                        <span className="text-text-secondary">Cuenta:</span> {debt.bank_account}
                      </p>
                    )}
                    <p className="text-text-primary">
                      <span className="text-text-secondary">Titular:</span> {debt.bank_holder}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Comprobante Actual (solo en modo reemplazo) */}
            {isReplaceMode && debt.proof_file_url && (
              <div className="card bg-blue-500/5 border-blue-500/30">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-blue-400 mb-3">
                      📎 Comprobante Actual
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-text-secondary">Archivo:</span>
                        <p className="text-text-primary font-medium">{currentFileName}</p>
                      </div>
                      {debt.proof_uploaded_at && (
                        <div>
                          <span className="text-text-secondary">Subido:</span>
                          <p className="text-text-primary">
                            {new Date(debt.proof_uploaded_at).toLocaleDateString('es-MX', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <a
                    href={debt.proof_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-xs ml-4"
                  >
                    Ver Archivo
                  </a>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-500/20">
                  <p className="text-blue-300 text-xs">
                    ⚠️ Al subir un nuevo archivo, el anterior será reemplazado permanentemente
                  </p>
                </div>
              </div>
            )}

            {/* Campo: Archivo */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Comprobante de Pago *
                <span className="text-text-muted text-xs ml-2">
                  (PNG, JPEG o PDF - Máximo 5MB)
                </span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id="file-input"
                disabled={isLoading}
              />

              <label
                htmlFor="file-input"
                className={`
                  block w-full px-4 py-3 border-2 border-dashed rounded-lg
                  text-center cursor-pointer transition-colors
                  ${
                    selectedFile
                      ? 'border-primary bg-primary/5'
                      : 'border-border-dark hover:border-primary/50'
                  }
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="text-primary font-medium">
                      ✓ {selectedFile.name}
                    </p>
                    <p className="text-text-muted text-xs">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-text-secondary">
                      Haz click para seleccionar un archivo
                    </p>
                    <p className="text-text-muted text-xs">
                      o arrastra y suelta aquí
                    </p>
                  </div>
                )}
              </label>
            </div>

            {/* Mostrar error de validación */}
            {validationError && (
              <div className="card bg-danger/10 border-danger">
                <p className="text-danger text-sm">
                  ❌ {validationError}
                </p>
              </div>
            )}

            {/* Mostrar error de upload/replace */}
            {error && (
              <div className="card bg-danger/10 border-danger">
                <p className="text-danger text-sm">
                  ❌ Error: {error.message}
                </p>
              </div>
            )}

            {/* Botones */}
            <div className="flex gap-3 pt-4 border-t border-border-dark">
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary flex-1"
                disabled={isLoading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={!selectedFile || isLoading}
              >
                {isLoading
                  ? (isReplaceMode ? 'Reemplazando...' : 'Subiendo...')
                  : (isReplaceMode ? 'Reemplazar Comprobante' : 'Subir Comprobante')
                }
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Toast de éxito */}
      {showToast && (
        <div className="fixed bottom-4 right-4 z-[60] animate-fade-in">
          <div className="card bg-primary border-primary shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="text-primary text-2xl">✓</div>
              <div>
                <p className="text-text-primary font-medium">
                  {isReplaceMode
                    ? 'Comprobante reemplazado exitosamente'
                    : 'Comprobante subido exitosamente'
                  }
                </p>
                <p className="text-text-secondary text-sm">
                  Tu pago está en revisión
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
