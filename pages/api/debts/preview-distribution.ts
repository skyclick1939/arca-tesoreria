import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * API Route: Preview de Distribución de Deudas
 *
 * Calcula cómo se distribuiría un monto total entre los capítulos activos
 * de forma proporcional según su número de miembros.
 *
 * NO persiste datos - solo calcula y retorna preview.
 *
 * SEGURIDAD:
 * - Validación de autenticación interna (NO usa middleware para /api/*)
 * - Solo admins pueden acceder
 * - Usa SERVICE_ROLE_KEY para consultar datos (evita restricciones RLS)
 * - No modifica la base de datos
 *
 * LÓGICA DE CÁLCULO:
 * 1. Obtener total de miembros: SUM(member_count) de capítulos activos
 * 2. Calcular costo por miembro: total_amount / total_members
 * 3. Para cada capítulo: assigned_amount = cost_per_member * chapter.member_count
 *
 * @example GET /api/debts/preview-distribution?total_amount=9000
 *
 * Response:
 * {
 *   "success": true,
 *   "total_amount": 9000,
 *   "total_chapters": 4,
 *   "total_members": 44,
 *   "cost_per_member": 204.55,
 *   "distribution": [
 *     {
 *       "chapter_id": "uuid",
 *       "chapter_name": "Guadalajara",
 *       "members": 14,
 *       "assigned_amount": 2863.64
 *     },
 *     ...
 *   ]
 * }
 */

interface Chapter {
  id: string;
  name: string;
  member_count: number;
}

interface DistributionItem {
  chapter_id: string;
  chapter_name: string;
  members: number;
  assigned_amount: number;
}

interface PreviewResponse {
  success: boolean;
  total_amount?: number;
  total_chapters?: number;
  total_members?: number;
  cost_per_member?: number;
  distribution?: DistributionItem[];
  error?: string;
  details?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PreviewResponse>
) {
  // 1. Validar método HTTP
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      details: 'Este endpoint solo acepta GET requests',
    });
  }

  try {
    // 2. Validar autenticación del usuario (API routes NO usan middleware)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[preview-distribution] Missing Supabase credentials');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        details: 'Error de configuración del servidor',
      });
    }

    // Crear cliente para validar sesión (usa anon key + cookies)
    const supabaseAuth = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return req.cookies[name];
          },
          set(name: string, value: string, options: CookieOptions) {
            // FIX: Implementar set para manejar refresh de sesión
            const cookieParts = [
              `${name}=${value}`,
              `Path=${options.path || '/'}`,
              `Max-Age=${options.maxAge}`,
              `SameSite=${options.sameSite || 'Lax'}`,
            ];
            if (options.httpOnly) cookieParts.push('HttpOnly');
            if (options.secure) cookieParts.push('Secure');
            res.setHeader('Set-Cookie', cookieParts.join('; '));
          },
          remove(name: string, options: CookieOptions) {
            // FIX: Implementar remove para manejar logout/limpieza
            const cookieParts = [
              `${name}=`,
              `Path=${options.path || '/'}`,
              `Max-Age=0`,
              `SameSite=${options.sameSite || 'Lax'}`,
            ];
            if (options.httpOnly) cookieParts.push('HttpOnly');
            if (options.secure) cookieParts.push('Secure');
            res.setHeader('Set-Cookie', cookieParts.join('; '));
          },
        },
      }
    );

    // Validar usuario autenticado
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        details: 'Debes iniciar sesión para acceder a este endpoint',
      });
    }

    // Validar que el usuario sea admin
    const { data: profile, error: profileError } = await supabaseAuth
      .from('arca_user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        details: 'Solo administradores pueden acceder a este endpoint',
      });
    }

    // 3. Extraer y validar parámetro total_amount
    const { total_amount } = req.query;

    if (!total_amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing total_amount parameter',
        details: 'Debes proporcionar el parámetro total_amount en la URL',
      });
    }

    const totalAmount = parseFloat(total_amount as string);

    if (isNaN(totalAmount)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid total_amount',
        details: 'El parámetro total_amount debe ser un número válido',
      });
    }

    if (totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid total_amount',
        details: 'El monto total debe ser mayor a 0',
      });
    }

    if (totalAmount > 10000000) {
      return res.status(400).json({
        success: false,
        error: 'Total amount too high',
        details: 'El monto total es demasiado alto (máximo: $10,000,000)',
      });
    }

    // 4. Crear cliente de Supabase con SERVICE_ROLE_KEY (evita restricciones RLS)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      console.error('[preview-distribution] Missing SERVICE_ROLE_KEY');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        details: 'Error de configuración del servidor',
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 5. Obtener capítulos activos con member_count
    const { data: chapters, error: chaptersError } = await supabase
      .from('arca_chapters')
      .select('id, name, member_count')
      .eq('is_active', true)
      .order('name');

    if (chaptersError) {
      console.error('[preview-distribution] Error fetching chapters:', chaptersError);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        details: 'Error al consultar capítulos activos',
      });
    }

    if (!chapters || chapters.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active chapters found',
        details: 'No hay capítulos activos para distribuir la deuda',
      });
    }

    // 6. Calcular distribución proporcional
    const totalMembers = chapters.reduce(
      (sum: number, chapter: Chapter) => sum + chapter.member_count,
      0
    );

    if (totalMembers === 0) {
      return res.status(400).json({
        success: false,
        error: 'No members found',
        details: 'Los capítulos activos no tienen miembros asignados',
      });
    }

    const costPerMember = totalAmount / totalMembers;

    const distribution: DistributionItem[] = chapters.map((chapter: Chapter) => ({
      chapter_id: chapter.id,
      chapter_name: chapter.name,
      members: chapter.member_count,
      assigned_amount: parseFloat((costPerMember * chapter.member_count).toFixed(2)),
    }));

    // 7. Verificar que la suma de montos asignados sea igual al total
    // (puede haber pequeñas diferencias por redondeo)
    const sumAssigned = distribution.reduce((sum, item) => sum + item.assigned_amount, 0);
    const difference = Math.abs(sumAssigned - totalAmount);

    // Si hay diferencia por redondeo (>= 1 centavo), ajustar el primer capítulo
    if (difference >= 0.01) {
      distribution[0].assigned_amount = parseFloat(
        (distribution[0].assigned_amount + (totalAmount - sumAssigned)).toFixed(2)
      );
    }

    // 8. Retornar preview exitoso
    return res.status(200).json({
      success: true,
      total_amount: totalAmount,
      total_chapters: chapters.length,
      total_members: totalMembers,
      cost_per_member: parseFloat(costPerMember.toFixed(2)),
      distribution,
    });
  } catch (error) {
    console.error('[preview-distribution] Unexpected error:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details:
        error instanceof Error
          ? error.message
          : 'Ocurrió un error inesperado al calcular la distribución',
    });
  }
}
