import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Página de Gestión de Usuarios (Solo Admin)
 *
 * Permite a los administradores:
 * - Ver lista de todos los usuarios
 * - Cambiar roles (admin <-> president)
 * - Activar/Desactivar usuarios (soft delete)
 * - Ver último inicio de sesión
 */

interface User {
  user_id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'president';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_sign_in: string | null;
}

export default function UsuariosPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAdmin, isLoading: authLoading, session } = useAuth();

  const [roleFilter, setRoleFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('');

  // Estado para modal de cambio de contraseña
  const [passwordModal, setPasswordModal] = useState<{
    isOpen: boolean;
    userId: string | null;
    userName: string | null;
    newPassword: string;
  }>({
    isOpen: false,
    userId: null,
    userName: null,
    newPassword: '',
  });

  // Protección: Solo admins pueden acceder
  if (!authLoading && !isAdmin) {
    router.replace('/admin/dashboard');
    return null;
  }

  // Fetch users con filtros
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['users', roleFilter, activeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (roleFilter) params.append('role', roleFilter);
      if (activeFilter) params.append('active', activeFilter);

      const token = session?.access_token;
      if (!token) throw new Error('No hay token de sesión');

      const res = await fetch(`/api/users?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al obtener usuarios');
      }

      const data = await res.json();
      return data.users;
    },
    enabled: !!session?.access_token,
    staleTime: 30000, // 30 segundos
  });

  // Mutación para actualizar usuario
  const updateUserMutation = useMutation({
    mutationFn: async ({
      userId,
      updates,
    }: {
      userId: string;
      updates: { role?: string; is_active?: boolean };
    }) => {
      const token = session?.access_token;
      if (!token) throw new Error('No hay token de sesión');

      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al actualizar usuario');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  // Mutación para cambiar contraseña
  const changePasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const token = session?.access_token;
      if (!token) throw new Error('No hay token de sesión');

      const res = await fetch(`/api/users/${userId}/password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al cambiar contraseña');
      }

      return res.json();
    },
    onSuccess: () => {
      // Cerrar modal y limpiar estado
      setPasswordModal({
        isOpen: false,
        userId: null,
        userName: null,
        newPassword: '',
      });
    },
  });

  // Handler: Cambiar rol
  const handleChangeRole = async (userId: string, newRole: 'admin' | 'president') => {
    if (!confirm(`¿Estás seguro de cambiar el rol a "${newRole}"?`)) return;

    try {
      await updateUserMutation.mutateAsync({
        userId,
        updates: { role: newRole },
      });
      alert('✅ Rol actualizado exitosamente');
    } catch (error) {
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Handler: Activar/Desactivar usuario
  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    const action = currentActive ? 'desactivar' : 'activar';
    if (!confirm(`¿Estás seguro de ${action} este usuario?`)) return;

    try {
      await updateUserMutation.mutateAsync({
        userId,
        updates: { is_active: !currentActive },
      });
      alert(`✅ Usuario ${action}do exitosamente`);
    } catch (error) {
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Handler: Abrir modal de cambio de contraseña
  const handleOpenPasswordModal = (userId: string, userName: string) => {
    setPasswordModal({
      isOpen: true,
      userId,
      userName,
      newPassword: '',
    });
  };

  // Handler: Cambiar contraseña
  const handleChangePassword = async () => {
    if (!passwordModal.userId || !passwordModal.newPassword) {
      alert('❌ Por favor ingresa una contraseña');
      return;
    }

    if (passwordModal.newPassword.length < 6) {
      alert('❌ La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (!confirm(`¿Estás seguro de cambiar la contraseña de ${passwordModal.userName}?`)) return;

    try {
      await changePasswordMutation.mutateAsync({
        userId: passwordModal.userId,
        password: passwordModal.newPassword,
      });
      alert(`✅ Contraseña actualizada exitosamente para ${passwordModal.userName}`);
    } catch (error) {
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Loading states
  if (authLoading || usersLoading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Gestión de Usuarios - El Arca</title>
        <meta name="description" content="Administración de usuarios del sistema" />
      </Head>

      <div className="min-h-screen bg-background-dark">
        {/* Header */}
        <header className="bg-surface-dark border-b border-border-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-text-primary">
                  👥 Gestión de Usuarios
                </h1>
                <p className="text-text-secondary text-sm mt-1">
                  Administra roles y permisos de usuarios del sistema
                </p>
              </div>
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="px-4 py-2 bg-surface-dark border border-border-dark text-text-primary rounded-lg hover:bg-gray-700 transition"
              >
                ← Volver al Dashboard
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Filtros */}
          <div className="bg-surface-dark border border-border-dark rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Filtros</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Filtro por Rol */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Rol
                </label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-background-dark text-text-primary border border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Todos los roles</option>
                  <option value="admin">Administradores</option>
                  <option value="president">Presidentes</option>
                </select>
              </div>

              {/* Filtro por Estado */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Estado
                </label>
                <select
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-background-dark text-text-primary border border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Todos los estados</option>
                  <option value="true">Activos</option>
                  <option value="false">Inactivos</option>
                </select>
              </div>
            </div>

            {/* Reset Filters */}
            {(roleFilter || activeFilter) && (
              <button
                onClick={() => {
                  setRoleFilter('');
                  setActiveFilter('');
                }}
                className="mt-4 text-sm text-primary hover:text-primary-light"
              >
                ✕ Limpiar filtros
              </button>
            )}
          </div>

          {/* Tabla de Usuarios */}
          <div className="bg-surface-dark border border-border-dark rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-dark">
                <thead className="bg-background-dark">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Usuario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Rol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Último Acceso
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-dark">
                  {users && users.length > 0 ? (
                    users.map((user) => (
                      <tr key={user.user_id} className="hover:bg-background-dark transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-text-primary font-medium">
                            {user.full_name}
                          </div>
                          <div className="text-xs text-text-secondary">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={user.role}
                            onChange={(e) =>
                              handleChangeRole(user.user_id, e.target.value as any)
                            }
                            disabled={updateUserMutation.isLoading}
                            className={`px-3 py-1 text-sm font-semibold rounded-lg border border-border-dark focus:outline-none focus:ring-2 focus:ring-primary ${
                              user.role === 'admin'
                                ? 'bg-primary/20 text-primary'
                                : 'bg-blue-500/20 text-blue-400'
                            }`}
                          >
                            <option value="admin">Admin</option>
                            <option value="president">President</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 text-xs font-semibold rounded-full ${
                              user.is_active
                                ? 'bg-primary/20 text-primary'
                                : 'bg-danger/20 text-danger'
                            }`}
                          >
                            {user.is_active ? '● Activo' : '○ Inactivo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                          {user.last_sign_in
                            ? new Date(user.last_sign_in).toLocaleDateString('es-MX')
                            : 'Nunca'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenPasswordModal(user.user_id, user.full_name)}
                              disabled={changePasswordMutation.isLoading}
                              className="px-3 py-1 rounded-lg transition bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              🔑 Contraseña
                            </button>
                            <button
                              onClick={() => handleToggleActive(user.user_id, user.is_active)}
                              disabled={updateUserMutation.isLoading}
                              className={`px-3 py-1 rounded-lg transition ${
                                user.is_active
                                  ? 'bg-danger/20 text-danger hover:bg-danger/30'
                                  : 'bg-primary/20 text-primary hover:bg-primary/30'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {user.is_active ? '🚫 Desactivar' : '✅ Activar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <p className="text-text-secondary text-lg">
                          No se encontraron usuarios
                        </p>
                        <p className="text-text-secondary text-sm mt-2">
                          Ajusta los filtros para ver más resultados
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <h3 className="text-blue-400 font-semibold mb-2">ℹ️ Información Importante</h3>
            <ul className="text-sm text-text-secondary space-y-1 list-disc list-inside">
              <li>
                <strong>Desactivar usuario</strong>: Cierra automáticamente todas sus sesiones
              </li>
              <li>
                <strong>Cambiar rol</strong>: Aplica inmediatamente, requiere relogin del usuario
              </li>
              <li>
                <strong>No puedes desactivarte a ti mismo</strong>: Protección para evitar bloqueo
              </li>
              <li>
                <strong>Cambiar contraseña</strong>: Usa Supabase Auth API de forma segura
              </li>
            </ul>
          </div>

          {/* Modal de Cambio de Contraseña */}
          {passwordModal.isOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-surface-dark border border-border-dark rounded-lg p-6 max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-text-primary">
                    🔑 Cambiar Contraseña
                  </h3>
                  <button
                    onClick={() =>
                      setPasswordModal({
                        isOpen: false,
                        userId: null,
                        userName: null,
                        newPassword: '',
                      })
                    }
                    className="text-text-secondary hover:text-text-primary"
                  >
                    ✕
                  </button>
                </div>

                {/* Usuario */}
                <div className="mb-4">
                  <p className="text-sm text-text-secondary">
                    Usuario: <span className="text-text-primary font-medium">{passwordModal.userName}</span>
                  </p>
                </div>

                {/* Input de Contraseña */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    value={passwordModal.newPassword}
                    onChange={(e) =>
                      setPasswordModal((prev) => ({ ...prev, newPassword: e.target.value }))
                    }
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-4 py-2 bg-background-dark text-text-primary border border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                  <p className="mt-1 text-xs text-text-secondary">
                    La contraseña debe tener al menos 6 caracteres
                  </p>
                </div>

                {/* Botones */}
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() =>
                      setPasswordModal({
                        isOpen: false,
                        userId: null,
                        userName: null,
                        newPassword: '',
                      })
                    }
                    className="px-4 py-2 bg-surface-dark border border-border-dark text-text-primary rounded-lg hover:bg-gray-700 transition"
                    disabled={changePasswordMutation.isLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleChangePassword}
                    disabled={changePasswordMutation.isLoading}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-light transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {changePasswordMutation.isLoading ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        <span>Cambiando...</span>
                      </>
                    ) : (
                      <>
                        <span>💾</span>
                        <span>Cambiar Contraseña</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
