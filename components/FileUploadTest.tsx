import { useState } from 'react';
import { useUploadProof, useReplaceProof, useDeleteProof } from '@/hooks/useUploadProof';
import {
  validateFile,
  formatFileSize,
  isImage,
  isPDF,
} from '@/lib/storage/storage-helpers';

/**
 * Componente de prueba para funcionalidad de upload de archivos
 *
 * Este componente demuestra el uso de:
 * - useUploadProof: Subir comprobante nuevo
 * - useReplaceProof: Reemplazar comprobante existente
 * - useDeleteProof: Eliminar comprobante
 * - Validación de archivos
 * - Preview de archivos seleccionados
 *
 * @example
 * <FileUploadTest chapterId="uuid-123" debtId="uuid-456" />
 */
interface FileUploadTestProps {
  chapterId: string;
  debtId: string;
  existingProofPath?: string | null;
}

export default function FileUploadTest({
  chapterId,
  debtId,
  existingProofPath,
}: FileUploadTestProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(
    existingProofPath || null
  );

  const { uploadProof, isUploading, error: uploadError } = useUploadProof();
  const { replaceProof, isReplacing } = useReplaceProof();
  const { deleteProof, isDeleting } = useDeleteProof();

  // Manejar selección de archivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar archivo
    const validation = validateFile(file);
    if (!validation.valid) {
      setValidationError(validation.error || 'Archivo inválido');
      setSelectedFile(null);
      return;
    }

    setValidationError(null);
    setSelectedFile(file);
  };

  // Manejar subida
  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      const result = await uploadProof({
        file: selectedFile,
        chapterId,
        debtId,
      });

      setUploadedPath(result.path);
      setSelectedFile(null);
      alert(`✅ Archivo subido exitosamente: ${result.path}`);
    } catch (error) {
      console.error('Error al subir:', error);
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Desconocido'}`);
    }
  };

  // Manejar reemplazo
  const handleReplace = async () => {
    if (!selectedFile || !uploadedPath) return;

    try {
      const result = await replaceProof({
        file: selectedFile,
        chapterId,
        debtId,
        oldPath: uploadedPath,
      });

      setUploadedPath(result.path);
      setSelectedFile(null);
      alert(`✅ Archivo reemplazado exitosamente: ${result.path}`);
    } catch (error) {
      console.error('Error al reemplazar:', error);
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Desconocido'}`);
    }
  };

  // Manejar eliminación
  const handleDelete = async () => {
    if (!uploadedPath) return;

    if (!confirm('¿Seguro que deseas eliminar este comprobante?')) {
      return;
    }

    try {
      await deleteProof({
        path: uploadedPath,
        debtId,
      });

      setUploadedPath(null);
      alert('✅ Archivo eliminado exitosamente');
    } catch (error) {
      console.error('Error al eliminar:', error);
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Desconocido'}`);
    }
  };

  const isProcessing = isUploading || isReplacing || isDeleting;

  return (
    <div className="card max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-primary mb-6">
        Prueba de Upload de Comprobantes
      </h2>

      {/* Información de contexto */}
      <div className="mb-6 p-4 bg-surface-dark rounded-md border border-border-dark">
        <p className="text-sm text-text-secondary">
          <strong>Chapter ID:</strong> {chapterId}
        </p>
        <p className="text-sm text-text-secondary">
          <strong>Debt ID:</strong> {debtId}
        </p>
        {uploadedPath && (
          <p className="text-sm text-text-secondary mt-2">
            <strong>Archivo actual:</strong> {uploadedPath}
          </p>
        )}
      </div>

      {/* Selector de archivo */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Seleccionar archivo (PNG, JPEG, PDF - máx 5MB)
        </label>
        <input
          type="file"
          accept=".png,.jpg,.jpeg,.pdf"
          onChange={handleFileChange}
          disabled={isProcessing}
          className="input w-full"
        />
        {validationError && (
          <p className="text-danger text-sm mt-2">{validationError}</p>
        )}
      </div>

      {/* Preview del archivo seleccionado */}
      {selectedFile && (
        <div className="mb-6 p-4 bg-surface-dark rounded-md border border-primary">
          <h3 className="text-sm font-medium mb-2 text-primary-light">
            Archivo seleccionado:
          </h3>
          <div className="space-y-1 text-sm text-text-secondary">
            <p>
              <strong>Nombre:</strong> {selectedFile.name}
            </p>
            <p>
              <strong>Tamaño:</strong> {formatFileSize(selectedFile.size)}
            </p>
            <p>
              <strong>Tipo:</strong> {selectedFile.type}
            </p>
            <p>
              <strong>Formato:</strong>{' '}
              {isImage(selectedFile.name)
                ? 'Imagen'
                : isPDF(selectedFile.name)
                ? 'PDF'
                : 'Otro'}
            </p>
          </div>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex gap-4">
        {!uploadedPath ? (
          <button
            onClick={handleUpload}
            disabled={!selectedFile || isProcessing}
            className="btn-primary flex-1"
          >
            {isUploading ? 'Subiendo...' : 'Subir Comprobante'}
          </button>
        ) : (
          <>
            <button
              onClick={handleReplace}
              disabled={!selectedFile || isProcessing}
              className="btn-primary flex-1"
            >
              {isReplacing ? 'Reemplazando...' : 'Reemplazar Comprobante'}
            </button>
            <button
              onClick={handleDelete}
              disabled={isProcessing}
              className="btn-danger flex-1"
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar Comprobante'}
            </button>
          </>
        )}
      </div>

      {/* Errores de upload */}
      {uploadError && (
        <div className="mt-4 p-4 bg-danger/10 border border-danger rounded-md">
          <p className="text-danger text-sm">
            <strong>Error:</strong> {uploadError.message}
          </p>
        </div>
      )}

      {/* Instrucciones */}
      <div className="mt-8 p-4 bg-surface-dark rounded-md border border-border-dark">
        <h3 className="text-sm font-medium mb-2 text-text-muted">
          Instrucciones de prueba:
        </h3>
        <ol className="text-xs text-text-secondary space-y-1 list-decimal list-inside">
          <li>Selecciona un archivo (PNG, JPEG o PDF de máximo 5MB)</li>
          <li>Haz clic en "Subir Comprobante" para subirlo a Storage</li>
          <li>El archivo se guardará en: {`{chapter_id}/{debt_id}/{timestamp}-{filename}`}</li>
          <li>El registro en arca_debts se actualizará automáticamente</li>
          <li>El status cambiará a "in_review"</li>
          <li>Puedes reemplazar el archivo seleccionando uno nuevo</li>
          <li>Puedes eliminar el archivo con el botón "Eliminar"</li>
        </ol>
      </div>
    </div>
  );
}
