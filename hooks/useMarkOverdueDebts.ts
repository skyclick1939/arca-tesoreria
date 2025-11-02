import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Hook para marcar deudas vencidas automáticamente
 *
 * Características:
 * - Se ejecuta UNA SOLA VEZ al montar el componente
 * - Usa useRef para evitar ejecuciones múltiples
 * - Llama a la función SQL mark_overdue_debts()
 * - Invalida queries de deudas para refrescar UI
 * - Log en consola con resultados
 *
 * La función SQL mark_overdue_debts() actualiza automáticamente
 * todas las deudas con due_date < NOW() y status='pending'
 * a status='overdue'.
 *
 * @example
 * // En cualquier dashboard
 * useMarkOverdueDebts();
 */
export function useMarkOverdueDebts() {
  const queryClient = useQueryClient();
  const hasRun = useRef(false);

  useEffect(() => {
    // Evitar ejecución múltiple (strict mode ejecuta efectos 2 veces en dev)
    if (hasRun.current) return;

    const markOverdueDebts = async () => {
      try {
        console.log('[useMarkOverdueDebts] Checking for overdue debts...');

        const { data, error } = await supabase.rpc('mark_overdue_debts');

        if (error) {
          console.error('[useMarkOverdueDebts] Error calling mark_overdue_debts:', error);
          return;
        }

        // La función retorna el número de deudas actualizadas
        const count = data || 0;

        if (count > 0) {
          console.log(`[useMarkOverdueDebts] ✓ ${count} debt(s) marked as overdue`);

          // Invalidar queries para refrescar UI
          queryClient.invalidateQueries({ queryKey: ['debts'] });
          queryClient.invalidateQueries({ queryKey: ['president-debts'] });
        } else {
          console.log('[useMarkOverdueDebts] ✓ No overdue debts found');
        }
      } catch (err) {
        console.error('[useMarkOverdueDebts] Unexpected error:', err);
      }
    };

    // Marcar como ejecutado ANTES de llamar (para evitar race conditions)
    hasRun.current = true;

    // Ejecutar función
    markOverdueDebts();
  }, [queryClient]);
}
