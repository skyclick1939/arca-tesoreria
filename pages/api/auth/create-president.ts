import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * API Route: Crear Usuario Presidente en Supabase Auth
 *
 * Este endpoint permite al administrador crear nuevos usuarios presidentes
 * directamente en Supabase Auth sin que el presidente tenga que confirmar su email.
 *
 * SEGURIDAD:
 * - Solo ejecutable desde el servidor (usa Service Role Key)
 * - Validaciones estrictas de input
 * - El middleware ya validó que el usuario es admin
 *
 * FLUJO:
 * 1. Recibe: email, password, fullName
 * 2. Valida datos
 * 3. Crea usuario en Supabase Auth con auto-confirmación
 * 4. El trigger on_auth_user_created crea perfil en arca_user_profiles
 * 5. Retorna: userId del nuevo usuario
 *
 * @example
 * POST /api/auth/create-president
 * {
 *   "email": "pres.nuevo@arca.com",
 *   "password": "passwordSegura123",
 *   "fullName": "Juan Pérez García"
 * }
 *
 * @returns
 * {
 *   "success": true,
 *   "userId": "uuid-del-usuario",
 *   "email": "pres.nuevo@arca.com"
 * }
 */

// Tipos de input
interface CreatePresidentRequest {
  email: string;
  password: string;
  fullName: string;
}

// Tipos de respuesta
interface CreatePresidentResponse {
  success: boolean;
  userId?: string;
  email?: string;
  error?: string;
  details?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreatePresidentResponse>
) {
  // 1. Validar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      details: 'Este endpoint solo acepta POST requests',
    });
  }

  try {
    // 2. Extraer y validar datos del body
    const { email, password, fullName }: CreatePresidentRequest = req.body;

    // Validaciones de campos requeridos
    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        details: 'Se requieren los campos: email, password, fullName',
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
        details: 'El email proporcionado no tiene un formato válido',
      });
    }

    // Validar longitud de contraseña
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password too short',
        details: 'La contraseña debe tener al menos 8 caracteres',
      });
    }

    // Validar longitud de nombre
    if (fullName.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Invalid full name',
        details: 'El nombre completo debe tener al menos 3 caracteres',
      });
    }

    // 3. Verificar que las variables de entorno estén configuradas
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[create-president] Missing environment variables');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        details: 'Faltan variables de entorno del servidor. Contacta al administrador técnico.',
      });
    }

    // 4. Crear cliente de Supabase con Service Role Key (ADMIN)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 5. Crear usuario en Supabase Auth
    // NOTA: Si el email ya existe, Supabase devolverá un error específico
    // que manejamos en el catch. Esto es más robusto que verificar con listUsers().
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmar email (no requiere verificación)
      user_metadata: {
        full_name: fullName,
      },
    });

    if (authError) {
      console.error('[create-president] Error creating user in Auth:', authError);

      // Detectar si el error es por email duplicado
      const isDuplicateEmail = authError.message?.toLowerCase().includes('already')
        || authError.message?.toLowerCase().includes('exists')
        || authError.message?.toLowerCase().includes('duplicate');

      if (isDuplicateEmail) {
        return res.status(409).json({
          success: false,
          error: 'Email already exists',
          details: `El email ${email} ya está registrado. Usa otro email o edita el usuario existente.`,
        });
      }

      // Otros errores de Auth
      return res.status(500).json({
        success: false,
        error: 'Auth creation failed',
        details: `No se pudo crear el usuario en Auth: ${authError.message}`,
      });
    }

    if (!authData.user) {
      console.error('[create-president] User created but no user object returned');
      return res.status(500).json({
        success: false,
        error: 'User creation failed',
        details: 'El usuario se creó pero no se recibió confirmación',
      });
    }

    // 7. El trigger on_auth_user_created creará el perfil automáticamente
    // El trigger está verificado y funcional (HOTFIX 2), no necesitamos verificación adicional
    console.log('[create-president] User created successfully:', {
      userId: authData.user.id,
      email: authData.user.email,
      note: 'Profile will be created automatically by DB trigger',
    });

    // 8. Retornar respuesta exitosa
    return res.status(200).json({
      success: true,
      userId: authData.user.id,
      email: authData.user.email || email,
    });
  } catch (error) {
    console.error('[create-president] Unexpected error:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details:
        error instanceof Error
          ? error.message
          : 'Ocurrió un error inesperado. Por favor intenta de nuevo.',
    });
  }
}
