import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Chapter, ChapterWithPresidentEmail } from '@/types/database.types';

/**
 * Tipo para el resultado de la función RPC get_user_emails
 * Retorna información básica del usuario desde auth.users
 */
interface AuthUserEmail {
  id: string;
  email: string | null;
}

/**
 * Hook para obtener lista de capítulos con información del presidente
 *
 * Incluye:
 * - Datos del capítulo (nombre, regional, miembros, etc.)
 * - Datos del presidente (nombre, email)
 * - Solo capítulos activos por defecto
 *
 * @param options - Opciones de configuración
 * @param options.includeInactive - Si debe incluir capítulos inactivos (default: false)
 *
 * @example
 * const { data: chapters, isLoading, error } = useChapters();
 */
export function useChapters(options?: { includeInactive?: boolean }) {
  return useQuery({
    queryKey: ['chapters', options?.includeInactive ? 'all' : 'active'],
    queryFn: async (): Promise<ChapterWithPresidentEmail[]> => {
      // 1. Obtener capítulos con información del perfil del presidente
      let query = supabase
        .from('arca_chapters')
        .select(`
          *,
          president:arca_user_profiles!president_id (
            user_id,
            full_name
          )
        `)
        .order('name');

      // Filtrar por activos si no se especifica incluir inactivos
      if (!options?.includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data: chapters, error: chaptersError } = await query;

      if (chaptersError) {
        console.error('[useChapters] Error fetching chapters:', chaptersError);
        throw chaptersError;
      }

      if (!chapters) {
        return [];
      }

      // 2. Obtener emails de los presidentes usando función RPC segura
      // Necesitamos los user_ids de todos los presidentes
      const presidentUserIds = chapters
        .map(ch => ch.president?.user_id)
        .filter((id): id is string => !!id);

      // Obtener emails usando función RPC get_user_emails
      // (accede a auth.users de forma segura con SECURITY DEFINER)
      const { data: authUsers, error: authError } = await supabase
        .rpc('get_user_emails', { user_ids: presidentUserIds })
        .returns<AuthUserEmail[]>();

      const emailMap = new Map<string, string>();
      if (authError) {
        // Loguear advertencia para debugging (no es error crítico - continuamos sin emails)
        console.warn('[useChapters] Could not fetch president emails:', {
          error: authError.message,
          code: authError.code,
          presidentCount: presidentUserIds.length,
        });
      } else if (authUsers) {
        authUsers.forEach(user => {
          emailMap.set(user.id, user.email || '');
        });
      }

      // 3. Combinar capítulos con emails de presidentes
      const chaptersWithEmails: ChapterWithPresidentEmail[] = chapters.map(chapter => ({
        ...chapter,
        presidentEmail: chapter.president?.user_id
          ? emailMap.get(chapter.president.user_id)
          : undefined,
      }));

      return chaptersWithEmails;
    },
    staleTime: 60000, // 1 minuto - datos de capítulos son relativamente estáticos
    retry: 2,
  });
}

/**
 * Hook para obtener estadísticas agregadas de capítulos
 *
 * Calcula:
 * - Total de capítulos activos
 * - Total de miembros en todos los capítulos
 *
 * @example
 * const { totalChapters, totalMembers } = useChaptersStats();
 */
export function useChaptersStats() {
  const { data: chapters = [] } = useChapters();

  const totalChapters = chapters.length;
  const totalMembers = chapters.reduce((sum, chapter) => sum + chapter.member_count, 0);

  return {
    totalChapters,
    totalMembers,
  };
}

/**
 * Hook para obtener un capítulo individual por ID
 *
 * @param chapterId - ID del capítulo a buscar
 *
 * @example
 * const { data: chapter, isLoading } = useChapter(chapterId);
 */
export function useChapter(chapterId: string | null) {
  return useQuery({
    queryKey: ['chapter', chapterId],
    queryFn: async (): Promise<ChapterWithPresidentEmail | null> => {
      if (!chapterId) return null;

      const { data, error } = await supabase
        .from('arca_chapters')
        .select(`
          *,
          president:arca_user_profiles!president_id (
            user_id,
            full_name
          )
        `)
        .eq('id', chapterId)
        .single();

      if (error) {
        console.error('[useChapter] Error fetching chapter:', error);
        throw error;
      }

      // Obtener email del presidente si existe usando función RPC segura
      if (data.president?.user_id) {
        const { data: authUsers, error: emailError } = await supabase
          .rpc('get_user_emails', { user_ids: [data.president.user_id] })
          .returns<AuthUserEmail[]>();

        if (emailError) {
          console.warn('[useChapter] Could not fetch president email:', {
            error: emailError.message,
            userId: data.president.user_id,
          });
        }

        return {
          ...data,
          presidentEmail: authUsers?.[0]?.email,
        };
      }

      return data;
    },
    enabled: !!chapterId, // Solo ejecutar si hay chapterId
    staleTime: 60000,
  });
}

/**
 * Hook para crear un nuevo capítulo
 *
 * NOTA: Este hook NO crea el usuario presidente en Auth.
 * Eso se maneja en T1.9 mediante un API route separado.
 *
 * @example
 * const { createChapter, isLoading } = useCreateChapter();
 * await createChapter({
 *   name: 'Capítulo Nuevo',
 *   regional: 'Centro',
 *   member_count: 15,
 *   president_id: 'uuid-del-presidente'
 * });
 */
export function useCreateChapter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chapter: Omit<Chapter, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('arca_chapters')
        .insert(chapter)
        .select()
        .single();

      if (error) {
        console.error('[useCreateChapter] Error creating chapter:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      // Invalidar queries para refrescar la lista
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
    },
  });
}

/**
 * Hook para actualizar un capítulo existente
 *
 * @example
 * const { updateChapter, isLoading } = useUpdateChapter();
 * await updateChapter({
 *   id: 'uuid-capitulo',
 *   name: 'Nuevo Nombre',
 *   member_count: 20
 * });
 */
export function useUpdateChapter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Chapter> & { id: string }) => {
      const { data, error } = await supabase
        .from('arca_chapters')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[useUpdateChapter] Error updating chapter:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
    },
  });
}

/**
 * Hook para eliminar un capítulo de forma ATÓMICA
 *
 * Usa la función SQL delete_chapter_safe() que:
 * - Verifica deudas activas con FOR UPDATE lock (previene race conditions)
 * - Elimina el capítulo en la MISMA transacción
 * - Garantiza atomicidad: o todo ocurre o nada
 *
 * @example
 * const { deleteChapter, isLoading } = useDeleteChapter();
 * try {
 *   await deleteChapter(chapterId);
 * } catch (error) {
 *   // Manejar error (ej. tiene deudas pendientes)
 * }
 */
export function useDeleteChapter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chapterId: string) => {
      // Llamar a función SQL atómica (resuelve race condition)
      const { data, error } = await supabase
        .rpc('delete_chapter_safe', {
          p_chapter_id: chapterId,
        });

      if (error) {
        console.error('[useDeleteChapter] Error from delete_chapter_safe:', error);
        // La función SQL lanza excepciones con mensajes amigables
        throw new Error(error.message || 'Error al eliminar capítulo');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
    },
  });
}

/**
 * Hook para obtener el capítulo del presidente autenticado
 *
 * Solo accesible para usuarios con rol 'president'.
 * Retorna el capítulo donde el usuario es el presidente.
 *
 * @example
 * const { data: myChapter, isLoading } = useMyChapter();
 */
export function useMyChapter() {
  return useQuery({
    queryKey: ['my-chapter'],
    queryFn: async (): Promise<ChapterWithPresidentEmail | null> => {
      // Obtener el user_id del usuario autenticado
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      // Buscar el capítulo donde este usuario es el presidente
      const { data, error } = await supabase
        .from('arca_chapters')
        .select(`
          *,
          president:arca_user_profiles!president_id (
            user_id,
            full_name
          )
        `)
        .eq('president_id', user.id)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('[useMyChapter] Error fetching chapter:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No se encontró un capítulo asignado a este presidente');
      }

      return data;
    },
    staleTime: 300000, // 5 minutos - el capítulo del presidente no cambia frecuentemente
    retry: 1,
  });
}
