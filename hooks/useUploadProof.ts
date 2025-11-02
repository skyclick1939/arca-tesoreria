import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  generateProofPath,
  validateFile,
  STORAGE_CONFIG,
  StorageError,
  StorageErrorType,
} from '@/lib/storage/storage-helpers';

// Tipos
interface UploadProofParams {
  file: File;
  chapterId: string;
  debtId: string;
}

interface UploadProofResult {
  path: string;
  publicUrl: string;
}

interface DeleteProofParams {
  path: string;
}

/**
 * Hook para subir comprobantes de pago a Supabase Storage
 *
 * Maneja:
 * - Validación de archivo (tamaño, tipo)
 * - Subida a Storage con path correcto
 * - Actualización de arca_debts con URL y timestamp
 * - Cambio de status a 'in_review'
 * - Invalidación de queries para refrescar UI
 *
 * @example
 * const { uploadProof, isUploading, error } = useUploadProof();
 *
 * await uploadProof({
 *   file: selectedFile,
 *   chapterId: 'uuid-chapter-123',
 *   debtId: 'uuid-debt-456'
 * });
 */
export function useUploadProof() {
  const queryClient = useQueryClient();

  const mutation = useMutation<UploadProofResult, Error, UploadProofParams>({
    mutationFn: async ({ file, chapterId, debtId }) => {
      // 1. Validar archivo
      const validation = validateFile(file);
      if (!validation.valid) {
        throw new StorageError(StorageErrorType.INVALID_TYPE, validation.error!);
      }

      // 2. Generar path
      const path = generateProofPath(chapterId, debtId, file.name);

      // 3. Subir archivo a Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(STORAGE_CONFIG.BUCKET_NAME)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false, // No permitir sobrescribir (usar delete + upload para reemplazar)
        });

      if (uploadError) {
        console.error('Error al subir archivo:', uploadError);
        throw new StorageError(
          StorageErrorType.UPLOAD_FAILED,
          `Error al subir archivo: ${uploadError.message}`
        );
      }

      // 4. Obtener URL pública (con autenticación requerida)
      const { data: urlData } = supabase.storage
        .from(STORAGE_CONFIG.BUCKET_NAME)
        .getPublicUrl(path);

      // 5. Actualizar registro en arca_debts usando RPC atómica
      // Esta función valida permisos y estado antes de actualizar (seguridad + atomicidad)
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'update_debt_proof',
        {
          p_debt_id: debtId,
          p_proof_file_url: urlData.publicUrl,
        }
      );

      if (rpcError || !rpcResult) {
        // Si falla la actualización, intentar eliminar el archivo subido (cleanup)
        console.error('[useUploadProof] RPC error:', rpcError);
        await supabase.storage.from(STORAGE_CONFIG.BUCKET_NAME).remove([path]);

        // Extraer mensaje de error del RPC result si está disponible
        const errorMessage =
          rpcResult && !rpcResult.success
            ? rpcResult.message
            : rpcError?.message || 'Error desconocido al actualizar deuda';

        throw new Error(errorMessage);
      }

      // Verificar que el RPC retornó success=true
      if (!rpcResult.success) {
        // Cleanup del archivo si el RPC retornó error
        await supabase.storage.from(STORAGE_CONFIG.BUCKET_NAME).remove([path]);
        throw new Error(rpcResult.message || 'Error al actualizar comprobante');
      }

      return {
        path: uploadData.path,
        publicUrl: urlData.publicUrl,
      };
    },
    onSuccess: () => {
      // Invalidar queries para refrescar la UI
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['president-debts'] });
    },
  });

  return {
    uploadProof: mutation.mutateAsync,
    isUploading: mutation.isLoading,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook para reemplazar un comprobante existente
 *
 * Elimina el archivo anterior y sube uno nuevo
 *
 * @example
 * const { replaceProof, isReplacing } = useReplaceProof();
 *
 * await replaceProof({
 *   file: newFile,
 *   chapterId: 'uuid-chapter-123',
 *   debtId: 'uuid-debt-456',
 *   oldPath: 'old/path/to/file.pdf'
 * });
 */
export function useReplaceProof() {
  const queryClient = useQueryClient();
  const { uploadProof } = useUploadProof();

  const mutation = useMutation<
    UploadProofResult,
    Error,
    UploadProofParams & { oldPath: string }
  >({
    mutationFn: async ({ file, chapterId, debtId, oldPath }) => {
      // 1. Eliminar archivo anterior
      const { error: deleteError } = await supabase.storage
        .from(STORAGE_CONFIG.BUCKET_NAME)
        .remove([oldPath]);

      if (deleteError) {
        console.error('Error al eliminar archivo anterior:', deleteError);
        // Continuar con la subida aunque falle la eliminación
      }

      // 2. Subir nuevo archivo
      return uploadProof({ file, chapterId, debtId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['president-debts'] });
    },
  });

  return {
    replaceProof: mutation.mutateAsync,
    isReplacing: mutation.isLoading,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook para eliminar un comprobante
 *
 * Solo permitido si el status es 'in_review' (no 'approved')
 *
 * @example
 * const { deleteProof, isDeleting } = useDeleteProof();
 *
 * await deleteProof({
 *   path: 'chapter_id/debt_id/timestamp-file.pdf',
 *   debtId: 'uuid-debt-456'
 * });
 */
export function useDeleteProof() {
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, DeleteProofParams & { debtId: string }>({
    mutationFn: async ({ path, debtId }) => {
      // 1. Eliminar archivo de Storage
      const { error: deleteError } = await supabase.storage
        .from(STORAGE_CONFIG.BUCKET_NAME)
        .remove([path]);

      if (deleteError) {
        throw new StorageError(
          StorageErrorType.DELETE_FAILED,
          `Error al eliminar archivo: ${deleteError.message}`
        );
      }

      // 2. Actualizar registro en arca_debts
      const { error: updateError } = await supabase
        .from('arca_debts')
        .update({
          proof_file_url: null,
          proof_uploaded_at: null,
          status: 'pending', // Volver a pending
        })
        .eq('id', debtId);

      if (updateError) {
        throw new Error(
          `Error al actualizar registro de deuda: ${updateError.message}`
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['president-debts'] });
    },
  });

  return {
    deleteProof: mutation.mutateAsync,
    isDeleting: mutation.isLoading,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook para obtener URL con firma temporal para visualizar comprobante
 *
 * @example
 * const { getSignedUrl } = useGetSignedUrl();
 * const url = await getSignedUrl('chapter_id/debt_id/file.pdf', 3600);
 */
export function useGetSignedUrl() {
  const mutation = useMutation<string, Error, { path: string; expiresIn?: number }>({
    mutationFn: async ({ path, expiresIn = 3600 }) => {
      const { data, error } = await supabase.storage
        .from(STORAGE_CONFIG.BUCKET_NAME)
        .createSignedUrl(path, expiresIn);

      if (error) {
        throw new Error(`Error al generar URL firmada: ${error.message}`);
      }

      return data.signedUrl;
    },
  });

  return {
    getSignedUrl: mutation.mutateAsync,
    isLoading: mutation.isLoading,
    error: mutation.error,
  };
}
