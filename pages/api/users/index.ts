import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * API Route: GET /api/users
 *
 * Lista todos los usuarios del sistema con sus perfiles
 *
 * Query params:
 * - role: Filtrar por rol (admin | president)
 * - active: Filtrar por estado (true | false)
 *
 * Requiere: Usuario autenticado con rol admin
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Solo GET permitido
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // 1. Crear cliente de Supabase con service role (bypass RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 2. Obtener usuario actual desde header de autorización
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // 3. Verificar que el usuario es admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('arca_user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden listar usuarios' });
    }

    // 4. Construir query con filtros opcionales
    let query = supabaseAdmin
      .from('arca_user_profiles')
      .select(
        `
        user_id,
        role,
        full_name,
        is_active,
        created_at,
        updated_at
      `
      )
      .order('created_at', { ascending: false });

    // Aplicar filtros si existen
    if (req.query.role) {
      query = query.eq('role', req.query.role);
    }

    if (req.query.active !== undefined) {
      query = query.eq('is_active', req.query.active === 'true');
    }

    const { data: profiles, error: queryError } = await query;

    if (queryError) {
      console.error('[GET /api/users] Error al obtener perfiles:', queryError);
      return res.status(500).json({ error: 'Error al obtener usuarios' });
    }

    // 5. Enriquecer con datos de auth.users (email)
    const userIds = profiles.map((p) => p.user_id);

    const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();

    if (authUsersError) {
      console.error('[GET /api/users] Error al obtener auth users:', authUsersError);
      // Continuar sin emails si falla
    }

    // Mapear emails a perfiles
    const usersWithEmails = profiles.map((profile) => {
      const authUser = authUsers?.users.find((u) => u.id === profile.user_id);
      return {
        ...profile,
        email: authUser?.email || 'Sin email',
        last_sign_in: authUser?.last_sign_in_at || null,
      };
    });

    return res.status(200).json({ users: usersWithEmails });
  } catch (error) {
    console.error('[GET /api/users] Error inesperado:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
