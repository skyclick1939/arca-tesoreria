import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Tipos para configuración del sistema
 */
export interface SystemConfig {
  key: string;
  value: any; // JSONB puede contener cualquier tipo
  description: string;
  category: 'general' | 'debts' | 'uploads' | 'notifications';
  updated_at: string;
  updated_by: string | null;
}

export interface ConfigByCategory {
  key: string;
  value: any;
  description: string;
  updated_at: string;
}

/**
 * Hook para obtener todas las configuraciones del sistema
 *
 * @returns Query con todas las configuraciones
 *
 * @example
 * const { data: configs, isLoading } = useSystemConfigs();
 */
export function useSystemConfigs() {
  return useQuery<SystemConfig[], Error>({
    queryKey: ['system-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arca_system_config')
        .select('*')
        .order('category', { ascending: true })
        .order('key', { ascending: true });

      if (error) {
        throw new Error(`Error al obtener configuraciones: ${error.message}`);
      }

      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos (configuración cambia poco)
  });
}

/**
 * Hook para obtener configuraciones de una categoría específica
 *
 * @param category - Categoría de configuraciones a obtener
 * @returns Query con configuraciones de la categoría
 *
 * @example
 * const { data: debtConfigs } = useConfigsByCategory('debts');
 */
export function useConfigsByCategory(
  category: 'general' | 'debts' | 'uploads' | 'notifications'
) {
  return useQuery<ConfigByCategory[], Error>({
    queryKey: ['system-configs', category],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_config_by_category', {
        p_category: category,
      });

      if (error) {
        throw new Error(
          `Error al obtener configuraciones de ${category}: ${error.message}`
        );
      }

      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

/**
 * Hook para obtener el valor de una configuración específica
 *
 * @param key - Clave de configuración a obtener
 * @returns Query con el valor de la configuración
 *
 * @example
 * const { data: overdueDay } = useSystemConfig('debt_overdue_days');
 * console.log(overdueDays); // 30
 */
export function useSystemConfig(key: string) {
  return useQuery<any, Error>({
    queryKey: ['system-config', key],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_system_config', {
        p_key: key,
      });

      if (error) {
        throw new Error(
          `Error al obtener configuración ${key}: ${error.message}`
        );
      }

      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

/**
 * Hook para actualizar una configuración del sistema
 *
 * Características:
 * - Invalidación optimista de cache
 * - Solo ejecutable por admins (validado en función SQL)
 * - Registra cambios en audit log automáticamente
 *
 * @returns Mutation para actualizar configuración
 *
 * @example
 * const updateConfig = useUpdateSystemConfig();
 *
 * await updateConfig.mutateAsync({
 *   key: 'debt_overdue_days',
 *   value: 45,
 *   description: 'Cambio temporal por festivos'
 * });
 */
export function useUpdateSystemConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      key,
      value,
      description,
    }: {
      key: string;
      value: any;
      description?: string;
    }) => {
      // Convertir value a JSONB string si no es string
      const jsonbValue = typeof value === 'string' ? value : JSON.stringify(value);

      const { data, error } = await supabase.rpc('update_system_config', {
        p_key: key,
        p_value: jsonbValue,
        p_description: description || null,
      });

      if (error) {
        throw new Error(`Error al actualizar configuración: ${error.message}`);
      }

      if (!data) {
        throw new Error(`No se encontró la configuración con clave: ${key}`);
      }

      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidar todas las queries relacionadas con configuración
      queryClient.invalidateQueries({ queryKey: ['system-configs'] });
      queryClient.invalidateQueries({ queryKey: ['system-config', variables.key] });
    },
  });
}

/**
 * Hook para crear una nueva configuración del sistema
 *
 * NOTA: Normalmente no se usa desde UI, solo para casos especiales
 * La mayoría de configuraciones se definen en la migración inicial
 *
 * @returns Mutation para crear configuración
 *
 * @example
 * const createConfig = useCreateSystemConfig();
 *
 * await createConfig.mutateAsync({
 *   key: 'new_feature_enabled',
 *   value: false,
 *   description: 'Habilitar nueva funcionalidad',
 *   category: 'general'
 * });
 */
export function useCreateSystemConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      key,
      value,
      description,
      category = 'general',
    }: {
      key: string;
      value: any;
      description: string;
      category?: 'general' | 'debts' | 'uploads' | 'notifications';
    }) => {
      const jsonbValue = typeof value === 'string' ? value : JSON.stringify(value);

      const { data, error } = await supabase.rpc('create_system_config', {
        p_key: key,
        p_value: jsonbValue,
        p_description: description,
        p_category: category,
      });

      if (error) {
        throw new Error(`Error al crear configuración: ${error.message}`);
      }

      if (!data) {
        throw new Error(`La configuración ${key} ya existe`);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-configs'] });
    },
  });
}

/**
 * Hook para eliminar una configuración del sistema
 *
 * ADVERTENCIA: Elimina permanentemente la configuración (no hay soft delete)
 * Úsalo con precaución
 *
 * @returns Mutation para eliminar configuración
 *
 * @example
 * const deleteConfig = useDeleteSystemConfig();
 *
 * await deleteConfig.mutateAsync({ key: 'temp_config_key' });
 */
export function useDeleteSystemConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key }: { key: string }) => {
      const { data, error } = await supabase.rpc('delete_system_config', {
        p_key: key,
      });

      if (error) {
        throw new Error(`Error al eliminar configuración: ${error.message}`);
      }

      if (!data) {
        throw new Error(`No se encontró la configuración con clave: ${key}`);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-configs'] });
    },
  });
}

/**
 * Helper: Parsear valor JSONB a tipo específico
 *
 * Útil cuando necesitas convertir el valor JSONB a un tipo TypeScript específico
 *
 * @example
 * const allowedTypes = parseConfigValue<string[]>(config.value);
 * const maxSize = parseConfigValue<number>(config.value);
 */
export function parseConfigValue<T>(value: any): T {
  // Si ya es del tipo esperado, retornarlo
  if (typeof value !== 'string') {
    return value as T;
  }

  // Si es string, intentar parsear como JSON
  try {
    return JSON.parse(value) as T;
  } catch {
    // Si falla el parse, retornar como está
    return value as T;
  }
}
