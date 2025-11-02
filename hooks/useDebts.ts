import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Debt, DebtWithChapter } from '@/types/database.types';

/**
 * Hooks para gestión de deudas (arca_debts)
 *
 * Incluye:
 * - useCreateDebtsBatch: Crear múltiples deudas distribuidas proporcionalmente
 * - useDebts: Obtener lista de deudas (con filtros opcionales)
 * - useUpdateDebtProof: Actualizar comprobante de pago
 */

// ============================================
// TIPOS
// ============================================

interface CreateDebtsBatchParams {
  total_amount: number;
  due_date: string; // formato: YYYY-MM-DD
  debt_type: 'apoyo' | 'multa' | 'aportacion';
  description: string;
  category?: string; // Categoría opcional
  bank_name: string;
  bank_clabe?: string;
  bank_account?: string;
  bank_holder: string;
}

interface CreateDebtsBatchResponse {
  success: boolean;
  debts_created: number;
  debt_ids: string[];
  total_amount: number;
  cost_per_member: number;
}

// ============================================
// HOOK: Crear Deudas en Lote (Distribución Proporcional)
// ============================================

/**
 * Hook para crear múltiples deudas distribuidas proporcionalmente
 * entre todos los capítulos activos según su número de miembros.
 *
 * Llama a la función SQL `create_debts_batch()` que:
 * - Calcula la distribución automáticamente
 * - Crea un registro de deuda por cada capítulo activo
 * - Garantiza atomicidad (todo o nada)
 *
 * @example
 * const { createDebts, isLoading, error } = useCreateDebtsBatch();
 *
 * await createDebts({
 *   total_amount: 9000,
 *   due_date: '2025-12-31',
 *   debt_type: 'apoyo',
 *   description: 'Apoyo para reparación de moto',
 *   bank_name: 'BBVA México',
 *   bank_clabe: '012345678901234567',
 *   bank_holder: 'Tesorería Moto Club'
 * });
 */
export function useCreateDebtsBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateDebtsBatchParams) => {
      // Validar que al menos CLABE o Cuenta estén proporcionados
      if (!params.bank_clabe && !params.bank_account) {
        throw new Error('Debes proporcionar al menos la CLABE Interbancaria o el Número de Cuenta');
      }

      // Llamar a función SQL create_debts_batch
      const { data, error } = await supabase.rpc('create_debts_batch', {
        p_total_amount: params.total_amount,
        p_due_date: params.due_date,
        p_debt_type: params.debt_type,
        p_description: params.description,
        p_bank_name: params.bank_name,
        p_bank_clabe: params.bank_clabe || null,
        p_bank_account: params.bank_account || null,
        p_bank_holder: params.bank_holder,
      });

      if (error) {
        console.error('[useCreateDebtsBatch] Error from create_debts_batch:', error);

        // Mapear errores comunes a mensajes amigables
        if (error.message?.includes('no active chapters')) {
          throw new Error('No hay capítulos activos para distribuir la deuda');
        }

        if (error.message?.includes('CLABE')) {
          throw new Error('La CLABE Interbancaria debe tener exactamente 18 dígitos');
        }

        if (error.message?.includes('at least one')) {
          throw new Error('Debes proporcionar al menos la CLABE o el Número de Cuenta');
        }

        // Error genérico
        throw new Error(error.message || 'Error al crear las deudas');
      }

      return data as CreateDebtsBatchResponse;
    },
    onSuccess: (data) => {
      console.log('[useCreateDebtsBatch] Success:', {
        debts_created: data.debts_created,
        total_amount: data.total_amount,
      });

      // Invalidar queries de deudas para refrescar listas
      queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
    onError: (error) => {
      console.error('[useCreateDebtsBatch] Error:', error);
    },
  });
}

// ============================================
// HOOK: Obtener Lista de Deudas
// ============================================

interface UseDebtsOptions {
  chapter_id?: string; // Filtrar por capítulo
  status?: 'pending' | 'overdue' | 'in_review' | 'approved'; // Filtrar por estatus
}

/**
 * Hook para obtener lista de deudas con filtros opcionales
 *
 * RLS se encarga automáticamente de:
 * - Admins: ven TODAS las deudas
 * - Presidentes: solo ven deudas de SU capítulo
 *
 * @example
 * // Obtener todas las deudas (según rol del usuario)
 * const { data: debts, isLoading } = useDebts();
 *
 * // Filtrar por estatus
 * const { data: pendingDebts } = useDebts({ status: 'pending' });
 */
export function useDebts(options?: UseDebtsOptions) {
  return useQuery({
    queryKey: ['debts', options?.chapter_id, options?.status],
    queryFn: async (): Promise<DebtWithChapter[]> => {
      let query = supabase
        .from('arca_debts')
        .select(`
          *,
          chapter:arca_chapters(
            id,
            name,
            regional,
            member_count
          )
        `)
        .order('due_date', { ascending: true });

      // Aplicar filtros opcionales
      if (options?.chapter_id) {
        query = query.eq('chapter_id', options.chapter_id);
      }

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useDebts] Error fetching debts:', error);
        throw error;
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos - optimizado para dashboard (300000ms)
    retry: 2,
  });
}

// ============================================
// HOOK: Actualizar Comprobante de Pago
// ============================================

interface UpdateDebtProofParams {
  debt_id: string;
  proof_file_url: string;
}

/**
 * Hook para actualizar el comprobante de pago de una deuda
 *
 * Solo Presidentes pueden actualizar comprobantes de SU capítulo.
 * RLS previene que presidentes modifiquen deudas de otros capítulos.
 *
 * @example
 * const { updateProof, isLoading } = useUpdateDebtProof();
 *
 * await updateProof({
 *   debt_id: 'uuid-deuda-123',
 *   proof_file_url: 'https://supabase.co/storage/...'
 * });
 */
export function useUpdateDebtProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateDebtProofParams) => {
      const { data, error } = await supabase
        .from('arca_debts')
        .update({
          proof_file_url: params.proof_file_url,
          proof_uploaded_at: new Date().toISOString(),
          status: 'in_review', // Auto-cambiar a "en revisión"
        })
        .eq('id', params.debt_id)
        .select()
        .single();

      if (error) {
        console.error('[useUpdateDebtProof] Error updating proof:', error);

        // Mapear errores RLS
        if (error.code === '42501' || error.message?.includes('permission')) {
          throw new Error('No tienes permiso para actualizar esta deuda');
        }

        throw new Error(error.message || 'Error al actualizar el comprobante');
      }

      return data;
    },
    onSuccess: () => {
      // Invalidar queries de deudas
      queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}

// ============================================
// HOOK: Aprobar/Rechazar Deuda
// ============================================

interface ApproveDebtParams {
  debt_id: string;
  action: 'approve' | 'reject';
}

/**
 * Hook para aprobar o rechazar una deuda en revisión
 *
 * Solo Admins pueden aprobar/rechazar deudas.
 * Al aprobar: status = 'approved', approved_at = timestamp
 * Al rechazar: status = 'pending', proof_file_url = null, proof_uploaded_at = null
 *
 * @example
 * const { approveDebt, isLoading } = useApproveDebt();
 *
 * await approveDebt({
 *   debt_id: 'uuid-deuda-123',
 *   action: 'approve'
 * });
 */
export function useApproveDebt() {
  const queryClient = useQueryClient();

  return useMutation<Debt, Error, ApproveDebtParams>({
    mutationFn: async (params: ApproveDebtParams) => {
      if (params.action === 'approve') {
        // Aprobar: marcar como aprobado
        const { data, error } = await supabase
          .from('arca_debts')
          .update({
            status: 'approved',
            approved_at: new Date().toISOString(),
          })
          .eq('id', params.debt_id)
          .eq('status', 'in_review') // Solo aprobar si está en revisión
          .select()
          .single();

        if (error) {
          console.error('[useApproveDebt] Error approving debt:', error);

          if (error.code === '42501' || error.message?.includes('permission')) {
            throw new Error('No tienes permiso para aprobar deudas');
          }

          throw new Error(error.message || 'Error al aprobar la deuda');
        }

        return data;
      } else {
        // Rechazar: volver a pending y limpiar comprobante
        const { data, error } = await supabase
          .from('arca_debts')
          .update({
            status: 'pending',
            proof_file_url: null,
            proof_uploaded_at: null,
          })
          .eq('id', params.debt_id)
          .eq('status', 'in_review') // Solo rechazar si está en revisión
          .select()
          .single();

        if (error) {
          console.error('[useApproveDebt] Error rejecting debt:', error);

          if (error.code === '42501' || error.message?.includes('permission')) {
            throw new Error('No tienes permiso para rechazar deudas');
          }

          throw new Error(error.message || 'Error al rechazar la deuda');
        }

        return data;
      }
    },
    onSuccess: (data, variables) => {
      console.log(`[useApproveDebt] Debt ${variables.action}d:`, data.id);

      // Invalidar queries de deudas
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['debts-in-review'] });
    },
  });
}

// ============================================
// HOOK: Obtener Estadísticas Por Solicitud
// ============================================

interface RequestStats {
  request_name: string;
  total_amount: number;
  collected_amount: number;
  pending_amount: number;
  completion_percentage: number;
  debts_count: number;
  first_created_at: string;
}

/**
 * Hook para obtener estadísticas agregadas por solicitud
 *
 * Llama a la función SQL `get_dashboard_stats_by_request()`
 * Agrupa deudas por concepto/description y calcula métricas
 *
 * Solo admins pueden ver estas estadísticas
 *
 * @example
 * const { data: requestStats, isLoading } = useRequestStats();
 */
export function useRequestStats() {
  return useQuery({
    queryKey: ['request-stats'],
    queryFn: async (): Promise<RequestStats[]> => {
      const { data, error } = await supabase.rpc('get_dashboard_stats_by_request');

      if (error) {
        console.error('[useRequestStats] Error fetching request stats:', error);
        throw error;
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos - optimizado para dashboard (300000ms)
    retry: 2,
  });
}

// ============================================
// HOOK: Obtener Estadísticas Por Capítulo
// ============================================

interface ChapterStats {
  chapter_id: string;
  chapter_name: string;
  regional: string;
  member_count: number;
  total_assigned: number;
  total_paid: number;
  total_pending: number;
  total_overdue: number;
  total_in_review: number;
  completion_percentage: number;
}

/**
 * Hook para obtener estadísticas agregadas por capítulo
 *
 * Llama a la función SQL `get_dashboard_stats_by_chapter()`
 * Agrupa deudas por capítulo y calcula métricas
 *
 * Solo admins pueden ver estas estadísticas
 *
 * @example
 * const { data: chapterStats, isLoading } = useChapterStats();
 */
export function useChapterStats() {
  return useQuery({
    queryKey: ['chapter-stats'],
    queryFn: async (): Promise<ChapterStats[]> => {
      const { data, error } = await supabase.rpc('get_dashboard_stats_by_chapter');

      if (error) {
        console.error('[useChapterStats] Error fetching chapter stats:', error);
        throw error;
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos - optimizado para dashboard (300000ms)
    retry: 2,
  });
}
