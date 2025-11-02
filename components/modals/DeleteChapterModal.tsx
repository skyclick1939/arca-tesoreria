import React from 'react';
import { useDeleteChapter } from '@/hooks/useChapters';
import { getErrorMessage } from '@/lib/utils';
import type { ChapterWithPresidentEmail } from '@/types/database.types';

/**
 * Modal de Confirmación de Eliminación de Capítulo
 *
 * Muestra advertencia y valida que el capítulo NO tenga deudas activas antes de eliminar.
 *
 * VALIDACIÓN AUTOMÁTICA:
 * - El hook useDeleteChapter verifica deudas pendientes/atrasadas/en revisión
 * - Si tiene deudas activas: muestra error y NO elimina
 * - Si NO tiene deudas (o solo aprobadas): procede con eliminación
 *
 * FLUJO:
 * 1. Usuario hace click en "Eliminar"
 * 2. Modal muestra nombre del capítulo + advertencia
 * 3. Usuario confirma
 * 4. Hook valida deudas activas en servidor
 * 5. Si pasa: elimina capítulo + refresca lista
 * 6. Si falla: muestra mensaje de error con número de deudas
 *
 * @example
 * <DeleteChapterModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   chapter={selectedChapter}
 * />
 */

interface DeleteChapterModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapter: ChapterWithPresidentEmail | null;
}

export function DeleteChapterModal({ isOpen, onClose, chapter }: DeleteChapterModalProps) {
  const deleteMutation = useDeleteChapter();

  if (!isOpen || !chapter) return null;

  const errorMessage = getErrorMessage(deleteMutation.error);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(chapter.id);
      onClose(); // Solo cierra si la eliminación fue exitosa
    } catch (error) {
      // El error se muestra en el UI, no cerramos el modal
      console.error('Error al eliminar capítulo:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="card max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-danger">Eliminar Capítulo</h2>
          <button
            onClick={onClose}
            disabled={deleteMutation.isLoading}
            className="text-text-muted hover:text-text-primary"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="mb-6">
          <p className="text-text-primary text-center mb-2">
            ¿Estás seguro que deseas eliminar el capítulo?
          </p>
          <p className="text-xl font-bold text-primary text-center mb-4">
            {chapter.name}
          </p>

          <div className="bg-danger/10 border border-danger rounded-md p-3 mb-4">
            <p className="text-sm text-text-secondary text-center">
              <strong className="text-danger">⚠️ Advertencia:</strong> Esta acción no se puede deshacer.
            </p>
          </div>

          <div className="bg-surface-dark rounded-md p-3 space-y-2">
            <p className="text-xs text-text-muted">
              <strong>Regional:</strong> {chapter.regional}
            </p>
            <p className="text-xs text-text-muted">
              <strong>Miembros:</strong> {chapter.member_count}
            </p>
            {chapter.president && (
              <p className="text-xs text-text-muted">
                <strong>Presidente:</strong> {chapter.president.full_name}
              </p>
            )}
          </div>

          <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-md p-3">
            <p className="text-xs text-blue-400">
              <strong>ℹ️ Nota:</strong> Solo se puede eliminar si el capítulo NO tiene deudas pendientes, atrasadas o en revisión.
            </p>
          </div>
        </div>

        {/* Error Display */}
        {errorMessage && (
          <div className="mb-4 p-4 bg-danger/10 border border-danger rounded-md">
            <p className="text-danger text-sm">
              <strong>Error:</strong> {errorMessage}
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleteMutation.isLoading}
            className="btn-secondary flex-1"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isLoading}
            className="btn-danger flex-1"
          >
            {deleteMutation.isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Eliminando...
              </span>
            ) : (
              'Sí, eliminar capítulo'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
