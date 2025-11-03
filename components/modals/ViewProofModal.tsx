import { useState, useEffect } from 'react';
import { useGetSignedUrl } from '@/hooks/useUploadProof';
import { extractPathFromProofUrl, isPDF, isImage } from '@/lib/storage/storage-helpers';

/**
 * Modal para Visualizar Comprobante de Pago
 *
 * Características:
 * - Genera URL firmada temporal (1 hora)
 * - Detecta tipo de archivo (PNG/JPEG vs PDF)
 * - Imágenes: muestra preview con zoom
 * - PDFs: botón de descarga (mobile-friendly)
 * - Loading state mientras genera URL
 * - Error handling robusto
 *
 * @param proofUrl - URL completa del comprobante en Storage
 * @param isOpen - Estado del modal (abierto/cerrado)
 * @param onClose - Callback para cerrar el modal
 */

interface ViewProofModalProps {
  proofUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ViewProofModal({
  proofUrl,
  isOpen,
  onClose,
}: ViewProofModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { getSignedUrl, isLoading, error } = useGetSignedUrl();

  // Detectar tipo de archivo
  const fileType = proofUrl ? (isPDF(proofUrl) ? 'pdf' : isImage(proofUrl) ? 'image' : 'unknown') : null;

  // Generar URL firmada cuando se abre el modal
  useEffect(() => {
    const generateSignedUrl = async () => {
      if (!isOpen || !proofUrl) return;

      setErrorMessage(null);
      setSignedUrl(null);

      try {
        // Extraer path del archivo
        const path = extractPathFromProofUrl(proofUrl);
        if (!path) {
          setErrorMessage('URL de comprobante inválida');
          return;
        }

        // Generar URL firmada (expira en 1 hora)
        const url = await getSignedUrl({ path, expiresIn: 3600 });
        setSignedUrl(url);
      } catch (err) {
        console.error('[ViewProofModal] Error al generar URL firmada:', err);
        setErrorMessage('No se pudo cargar el comprobante. Es posible que el archivo haya sido eliminado.');
      }
    };

    generateSignedUrl();
  }, [isOpen, proofUrl, getSignedUrl]);

  // Reset al cerrar
  const handleClose = () => {
    setSignedUrl(null);
    setErrorMessage(null);
    onClose();
  };

  // No renderizar si no está abierto
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="card max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-dark pb-4 mb-4">
          <h2 className="text-xl font-bold text-primary">📄 Comprobante de Pago</h2>
          <button
            onClick={handleClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Cerrar modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-text-secondary">Cargando comprobante...</p>
            </div>
          )}

          {/* Error State */}
          {(error || errorMessage) && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-center">
              <svg className="w-12 h-12 text-danger mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-danger font-medium mb-2">Error al cargar comprobante</p>
              <p className="text-text-secondary text-sm">
                {errorMessage || error?.message || 'Ha ocurrido un error desconocido'}
              </p>
            </div>
          )}

          {/* Success State - Image */}
          {signedUrl && fileType === 'image' && !isLoading && !error && !errorMessage && (
            <div className="bg-background-dark/30 rounded-lg p-4">
              <img
                src={signedUrl}
                alt="Comprobante de pago"
                className="w-full h-auto rounded-lg shadow-lg"
                onError={() => setErrorMessage('No se pudo cargar la imagen')}
              />
              <div className="mt-4 text-center">
                <a
                  href={signedUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Descargar Imagen
                </a>
              </div>
            </div>
          )}

          {/* Success State - PDF */}
          {signedUrl && fileType === 'pdf' && !isLoading && !error && !errorMessage && (
            <div className="bg-primary/5 border border-primary/30 rounded-lg p-8 text-center">
              <svg className="w-16 h-16 text-primary mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-bold text-primary mb-2">Comprobante PDF</h3>
              <p className="text-text-secondary mb-6">
                El archivo PDF se descargará automáticamente al hacer clic en el botón
              </p>
              <a
                href={signedUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Descargar PDF
              </a>
            </div>
          )}

          {/* Unknown File Type */}
          {signedUrl && fileType === 'unknown' && !isLoading && !error && !errorMessage && (
            <div className="bg-surface-dark/30 rounded-lg p-8 text-center">
              <svg className="w-16 h-16 text-text-secondary mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-text-primary mb-2">Archivo de Comprobante</h3>
              <p className="text-text-secondary mb-6">
                Tipo de archivo no reconocido. Puedes descargarlo para verlo.
              </p>
              <a
                href={signedUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Descargar Archivo
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border-dark pt-4 mt-4 text-center">
          <button onClick={handleClose} className="btn-secondary">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
