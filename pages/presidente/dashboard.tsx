import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useMyChapter } from '@/hooks/useChapters';
import { useDebts } from '@/hooks/useDebts';
import { useMarkOverdueDebts } from '@/hooks/useMarkOverdueDebts';
import type { Debt, DebtStatus } from '@/types/database.types';
import UploadProofModal from '@/components/modals/UploadProofModal';
import ViewProofModal from '@/components/modals/ViewProofModal';
import { validatePasswordStrength, type PasswordStrengthCheck } from '@/lib/validation/password';

/**
 * Dashboard de Presidente - El Arca
 *
 * Características Implementadas:
 * - Ver información del capítulo asignado
 * - Lista de deudas del capítulo (protegida por RLS)
 * - Filtros por status (pending, overdue, in_review, approved)
 * - Ver detalles de cada deuda
 * - Subir comprobante de pago (próximamente)
 *
 * Seguridad:
 * - RLS garantiza que solo ve deudas de SU capítulo
 * - Middleware valida rol 'president'
 */

type FilterStatus = DebtStatus | 'all';

export default function PresidentDashboard() {
  const { profile, session, isAuthenticated, isPresident, isLoading, logout, refreshProfile } = useAuth();
  const { data: myChapter, isLoading: loadingChapter } = useMyChapter();

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);

  // Estado para modal de visualización de comprobante
  const [viewProofModalOpen, setViewProofModalOpen] = useState(false);
  const [viewProofUrl, setViewProofUrl] = useState<string | null>(null);

  // Estado para modal de perfil
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordChecks, setPasswordChecks] = useState<PasswordStrengthCheck>({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasSpecial: false,
  });

  // Marcar deudas vencidas al cargar dashboard (ejecuta 1 vez por sesión)
  useMarkOverdueDebts();

  // Obtener deudas del capítulo con filtro opcional
  const { data: debts = [], isLoading: loadingDebts } = useDebts({
    chapter_id: myChapter?.id,
    status: filterStatus === 'all' ? undefined : filterStatus,
  });

  // Forzar cambio de contraseña en primer login
  useEffect(() => {
    // @ts-ignore - must_change_password existe pero TypeScript no lo conoce aún
    if (profile?.must_change_password === true && !profileModalOpen) {
      setProfileModalOpen(true);
    }
  }, [profile, profileModalOpen]);

  // Pre-llenar nombre del usuario al abrir modal
  useEffect(() => {
    if (profileModalOpen && profile?.full_name) {
      setProfileForm((prev) => ({
        ...prev,
        fullName: profile.full_name,
      }));
    }
  }, [profileModalOpen, profile?.full_name]);

  // Validación en tiempo real de contraseña
  useEffect(() => {
    if (profileForm.newPassword) {
      const validation = validatePasswordStrength(profileForm.newPassword);
      setPasswordChecks(validation.checks);
    } else {
      setPasswordChecks({
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasSpecial: false,
      });
    }
  }, [profileForm.newPassword]);

  // Mutation para cambiar contraseña y perfil
  const changeProfileMutation = useMutation({
    mutationFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error('No hay sesión activa');

      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: profileForm.currentPassword,
          newPassword: profileForm.newPassword || undefined,
          fullName: profileForm.fullName,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al actualizar perfil');
      }

      return res.json();
    },
    onSuccess: async () => {
      alert('✅ Perfil actualizado exitosamente');
      setProfileModalOpen(false);
      setProfileForm({
        fullName: '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      // Refrescar perfil SIN recargar la página (actualiza nombre en header)
      await refreshProfile();
    },
    onError: (error: Error) => {
      alert(`❌ Error: ${error.message}`);
    },
  });

  // Mostrar loading mientras verifica autenticación
  if (isLoading || loadingChapter) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Cargando...</p>
        </div>
      </div>
    );
  }

  // Validación defensiva
  if (!isAuthenticated || !isPresident || !profile || !myChapter) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-dark">
        <div className="text-center">
          <p className="text-danger mb-4">Error: No se encontró un capítulo asignado</p>
          <p className="text-text-secondary text-sm">
            Contacta al administrador si eres presidente de capítulo
          </p>
        </div>
      </div>
    );
  }

  // Handler: Abrir modal de perfil
  const handleOpenProfileModal = () => {
    setProfileModalOpen(true);
  };

  // Handler: Cerrar modal de perfil
  const handleCloseProfileModal = () => {
    // @ts-ignore - must_change_password existe pero TypeScript no lo conoce aún
    const mustChangePassword = profile?.must_change_password === true;

    // No permitir cerrar si es cambio forzoso
    if (mustChangePassword) {
      alert('⚠️ Debes cambiar tu contraseña antes de continuar por motivos de seguridad');
      return;
    }

    setProfileModalOpen(false);
    setProfileForm({
      fullName: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  };

  // Handler: Cambiar perfil
  const handleSubmitProfile = async () => {
    // @ts-ignore - must_change_password existe pero TypeScript no lo conoce aún
    const mustChangePassword = profile?.must_change_password === true;

    // Validar campos
    if (!profileForm.fullName || profileForm.fullName.trim().length === 0) {
      alert('❌ El nombre es requerido');
      return;
    }

    // Si es cambio FORZOSO, validar que ingrese contraseña nueva
    if (mustChangePassword && !profileForm.newPassword) {
      alert('❌ Debes cambiar tu contraseña por motivos de seguridad');
      return;
    }

    // Si está cambiando contraseña, validar
    if (profileForm.newPassword) {
      if (!profileForm.currentPassword) {
        alert('❌ Debes ingresar tu contraseña actual para cambiarla');
        return;
      }

      const validation = validatePasswordStrength(profileForm.newPassword);
      if (!validation.valid) {
        alert(`❌ La nueva contraseña no cumple los requisitos:\n${validation.errors.join('\n')}`);
        return;
      }

      if (profileForm.newPassword !== profileForm.confirmPassword) {
        alert('❌ Las contraseñas no coinciden');
        return;
      }
    }

    if (!confirm('¿Estás seguro de actualizar tu perfil?')) return;

    try {
      await changeProfileMutation.mutateAsync();
    } catch (error) {
      // Error ya manejado en onError de la mutation
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Calcular estadísticas
  const totalDebts = debts.length;
  const pendingDebts = debts.filter(d => d.status === 'pending').length;
  const overdueDebts = debts.filter(d => d.status === 'overdue').length;
  const totalAmount = debts.reduce((sum, d) => sum + Number(d.amount), 0);

  // Formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  // Badge de status
  const getStatusBadge = (status: DebtStatus) => {
    const badges = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      overdue: 'bg-danger/20 text-danger border-danger/30',
      in_review: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      approved: 'bg-primary/20 text-primary border-primary/30',
    };

    const labels = {
      pending: 'Pendiente',
      overdue: 'Vencido',
      in_review: 'En Revisión',
      approved: 'Aprobado',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badges[status]}`}>
        {labels[status]}
      </span>
    );
  };

  // Abrir modal de upload
  const handleUploadClick = (debt: Debt) => {
    setSelectedDebt(debt);
    setUploadModalOpen(true);
  };

  // Cerrar modal
  const handleCloseModal = () => {
    setUploadModalOpen(false);
    setSelectedDebt(null);
  };

  // Abrir modal de visualización de comprobante
  const handleViewProof = (debt: Debt) => {
    if (!debt.proof_file_url) {
      alert('⚠️ Este comprobante no tiene archivo adjunto');
      return;
    }
    setViewProofUrl(debt.proof_file_url);
    setViewProofModalOpen(true);
  };

  // Cerrar modal de visualización
  const handleCloseViewProof = () => {
    setViewProofModalOpen(false);
    setViewProofUrl(null);
  };

  return (
    <>
      <Head>
        <title>Dashboard Presidente - El Arca</title>
        <meta name="description" content="Panel de presidente de capítulo" />
      </Head>

      <div className="min-h-screen bg-background-dark">
        {/* Header */}
        <header className="bg-surface-dark border-b border-border-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-primary">El Arca</h1>
                <p className="text-sm text-text-secondary">Panel de Presidente</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-text-primary">
                    {profile?.full_name}
                  </p>
                  <p className="text-xs text-text-muted">
                    {myChapter.name}
                  </p>
                </div>
                <button
                  onClick={handleOpenProfileModal}
                  className="px-4 py-2 bg-primary/20 text-primary hover:bg-primary/30 rounded-lg transition text-sm font-medium"
                >
                  ⚙️ Mi Perfil
                </button>
                <button
                  onClick={handleLogout}
                  className="btn-danger text-sm"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Información del Capítulo */}
          <div className="card mb-8">
            <h2 className="text-xl font-bold text-primary mb-4">
              {myChapter.name}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-text-secondary">Regional</p>
                <p className="text-text-primary font-medium">{myChapter.regional}</p>
              </div>
              <div>
                <p className="text-text-secondary">Miembros</p>
                <p className="text-text-primary font-medium">{myChapter.member_count}</p>
              </div>
              <div>
                <p className="text-text-secondary">Deudas Pendientes</p>
                <p className="text-yellow-400 font-medium">{pendingDebts}</p>
              </div>
              <div>
                <p className="text-text-secondary">Deudas Vencidas</p>
                <p className="text-danger font-medium">{overdueDebts}</p>
              </div>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="card border-primary">
              <p className="text-text-secondary text-sm mb-2">Total Deudas</p>
              <p className="text-3xl font-bold text-primary">{totalDebts}</p>
            </div>
            <div className="card border-yellow-500/30">
              <p className="text-text-secondary text-sm mb-2">Pendientes</p>
              <p className="text-3xl font-bold text-yellow-400">{pendingDebts}</p>
            </div>
            <div className="card border-danger/30">
              <p className="text-text-secondary text-sm mb-2">Vencidas</p>
              <p className="text-3xl font-bold text-danger">{overdueDebts}</p>
            </div>
            <div className="card border-primary/30">
              <p className="text-text-secondary text-sm mb-2">Monto Total</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="card mb-6">
            <h3 className="text-sm font-medium text-text-muted mb-4">Filtrar por Estado</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-primary text-white'
                    : 'bg-surface-dark text-text-secondary hover:bg-surface-dark/70'
                }`}
              >
                Todas ({debts.length})
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'pending'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-surface-dark text-text-secondary hover:bg-surface-dark/70'
                }`}
              >
                Pendientes ({pendingDebts})
              </button>
              <button
                onClick={() => setFilterStatus('overdue')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'overdue'
                    ? 'bg-danger text-white'
                    : 'bg-surface-dark text-text-secondary hover:bg-surface-dark/70'
                }`}
              >
                Vencidas ({overdueDebts})
              </button>
              <button
                onClick={() => setFilterStatus('in_review')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'in_review'
                    ? 'bg-blue-500 text-white'
                    : 'bg-surface-dark text-text-secondary hover:bg-surface-dark/70'
                }`}
              >
                En Revisión
              </button>
              <button
                onClick={() => setFilterStatus('approved')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'approved'
                    ? 'bg-primary text-white'
                    : 'bg-surface-dark text-text-secondary hover:bg-surface-dark/70'
                }`}
              >
                Aprobadas
              </button>
            </div>
          </div>

          {/* Lista de Deudas */}
          <div className="card">
            <h3 className="text-lg font-bold text-primary mb-6">Mis Deudas</h3>

            {loadingDebts ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-text-secondary">Cargando deudas...</p>
              </div>
            ) : debts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-secondary mb-2">
                  {filterStatus === 'all'
                    ? 'No tienes deudas asignadas'
                    : `No hay deudas con estado: ${filterStatus}`
                  }
                </p>
                <p className="text-text-muted text-sm">
                  Las deudas aparecerán aquí cuando el administrador las cree
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-dark">
                      <th className="text-left py-3 px-4 text-text-secondary font-medium">Descripción</th>
                      <th className="text-left py-3 px-4 text-text-secondary font-medium">Tipo</th>
                      <th className="text-right py-3 px-4 text-text-secondary font-medium">Monto</th>
                      <th className="text-left py-3 px-4 text-text-secondary font-medium">Vencimiento</th>
                      <th className="text-left py-3 px-4 text-text-secondary font-medium">Estado</th>
                      <th className="text-right py-3 px-4 text-text-secondary font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debts.map((debt) => (
                      <tr key={debt.id} className="border-b border-border-dark/50 hover:bg-surface-dark/30">
                        <td className="py-4 px-4">
                          <p className="text-text-primary font-medium">{debt.description}</p>
                        </td>
                        <td className="py-4 px-4">
                          <span className="capitalize text-text-secondary">{debt.debt_type}</span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <p className="text-primary font-bold">{formatCurrency(Number(debt.amount))}</p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-text-secondary">{formatDate(debt.due_date)}</p>
                        </td>
                        <td className="py-4 px-4">
                          {getStatusBadge(debt.status)}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {(debt.status === 'pending' || debt.status === 'overdue') && (
                            <button
                              className="btn-primary text-xs"
                              onClick={() => handleUploadClick(debt)}
                            >
                              Subir Comprobante
                            </button>
                          )}
                          {debt.status === 'in_review' && (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-blue-400 text-xs">En revisión...</span>
                              {debt.proof_file_url && (
                                <button
                                  onClick={() => handleViewProof(debt)}
                                  className="text-blue-400 hover:text-blue-300 transition-colors p-3 -m-3 min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
                                  title="Ver comprobante"
                                  aria-label="Ver comprobante subido"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}
                          {debt.status === 'approved' && (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-primary text-xs">✓ Pagado</span>
                              {debt.proof_file_url && (
                                <button
                                  onClick={() => handleViewProof(debt)}
                                  className="text-primary hover:text-primary-light transition-colors p-3 -m-3 min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
                                  title="Ver comprobante"
                                  aria-label="Ver comprobante aprobado"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Instrucciones */}
          <div className="mt-8 card bg-primary/5 border-primary">
            <h3 className="text-sm font-medium text-primary mb-3">
              📋 Instrucciones para Pagar
            </h3>
            <ol className="text-sm text-text-secondary space-y-2 list-decimal list-inside">
              <li>Realiza el pago usando los datos bancarios proporcionados</li>
              <li>Guarda el comprobante de pago (captura de pantalla o PDF)</li>
              <li>Presiona "Subir Comprobante" en la deuda correspondiente</li>
              <li>El status cambiará a "En Revisión"</li>
              <li>El administrador revisará y aprobará tu pago</li>
            </ol>
          </div>
        </main>
      </div>

      {/* Modal de Upload */}
      {selectedDebt && myChapter && (
        <UploadProofModal
          debt={selectedDebt}
          chapterName={myChapter.name}
          isOpen={uploadModalOpen}
          onClose={handleCloseModal}
        />
      )}

      {/* Modal de Visualización de Comprobante */}
      <ViewProofModal
        proofUrl={viewProofUrl}
        isOpen={viewProofModalOpen}
        onClose={handleCloseViewProof}
      />

      {/* Modal de Mi Perfil */}
      {profileModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-dark border border-border-dark rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border-dark">
              <h3 className="text-lg font-semibold text-text-primary">
                ⚙️ Mi Perfil
              </h3>
              <button
                onClick={handleCloseProfileModal}
                className="text-text-secondary hover:text-text-primary"
                disabled={changeProfileMutation.isLoading}
              >
                ✕
              </button>
            </div>

            {/* Mensaje de cambio forzoso */}
            {/* @ts-ignore - must_change_password existe pero TypeScript no lo conoce aún */}
            {profile?.must_change_password === true && (
              <div className="mx-6 mt-6 p-4 bg-danger/10 border border-danger/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🔐</span>
                  <div>
                    <p className="text-sm font-medium text-danger mb-1">
                      Cambio de Contraseña Obligatorio
                    </p>
                    <p className="text-xs text-text-secondary">
                      Por tu seguridad, debes cambiar tu contraseña antes de continuar.
                      Esta es una medida de protección para tu cuenta.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Contenido */}
            <div className="p-6 space-y-6">
              {/* Nombre Completo */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={profileForm.fullName}
                  onChange={(e) =>
                    setProfileForm((prev) => ({ ...prev, fullName: e.target.value }))
                  }
                  placeholder="Tu nombre completo"
                  className="w-full px-4 py-2 bg-background-dark text-text-primary border border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={changeProfileMutation.isLoading}
                />
              </div>

              {/* Separador */}
              <div className="border-t border-border-dark"></div>

              {/* Cambiar Contraseña (opcional) */}
              <div>
                <h4 className="text-sm font-medium text-text-primary mb-3">
                  Cambiar Contraseña (opcional)
                </h4>
                <p className="text-xs text-text-secondary mb-4">
                  Deja estos campos en blanco si no deseas cambiar tu contraseña
                </p>

                {/* Contraseña Actual */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Contraseña Actual
                  </label>
                  <input
                    type="password"
                    value={profileForm.currentPassword}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                    }
                    placeholder="Tu contraseña actual"
                    className="w-full px-4 py-2 bg-background-dark text-text-primary border border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={changeProfileMutation.isLoading}
                  />
                  <p className="mt-1 text-xs text-text-secondary">
                    Solo si cambias tu contraseña
                  </p>
                </div>

                {/* Nueva Contraseña */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    value={profileForm.newPassword}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, newPassword: e.target.value }))
                    }
                    placeholder="Nueva contraseña"
                    className="w-full px-4 py-2 bg-background-dark text-text-primary border border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={changeProfileMutation.isLoading}
                  />

                  {/* Requisitos con checkmarks en tiempo real */}
                  {profileForm.newPassword && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-text-secondary">Requisitos:</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className={passwordChecks.minLength ? 'text-primary' : 'text-text-secondary'}>
                            {passwordChecks.minLength ? '✅' : '❌'}
                          </span>
                          <span className={passwordChecks.minLength ? 'text-primary' : 'text-text-secondary'}>
                            Mínimo 8 caracteres
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={passwordChecks.hasUppercase ? 'text-primary' : 'text-text-secondary'}>
                            {passwordChecks.hasUppercase ? '✅' : '❌'}
                          </span>
                          <span className={passwordChecks.hasUppercase ? 'text-primary' : 'text-text-secondary'}>
                            Al menos 1 mayúscula (A-Z)
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={passwordChecks.hasLowercase ? 'text-primary' : 'text-text-secondary'}>
                            {passwordChecks.hasLowercase ? '✅' : '❌'}
                          </span>
                          <span className={passwordChecks.hasLowercase ? 'text-primary' : 'text-text-secondary'}>
                            Al menos 1 minúscula (a-z)
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={passwordChecks.hasSpecial ? 'text-primary' : 'text-text-secondary'}>
                            {passwordChecks.hasSpecial ? '✅' : '❌'}
                          </span>
                          <span className={passwordChecks.hasSpecial ? 'text-primary' : 'text-text-secondary'}>
                            Al menos 1 carácter especial (!@#$%^&*...)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirmar Nueva Contraseña */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Confirmar Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    value={profileForm.confirmPassword}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                    }
                    placeholder="Confirma tu nueva contraseña"
                    className="w-full px-4 py-2 bg-background-dark text-text-primary border border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={changeProfileMutation.isLoading}
                  />
                  {profileForm.newPassword && profileForm.confirmPassword && (
                    <p className={`mt-1 text-xs ${
                      profileForm.newPassword === profileForm.confirmPassword
                        ? 'text-primary'
                        : 'text-danger'
                    }`}>
                      {profileForm.newPassword === profileForm.confirmPassword
                        ? '✅ Las contraseñas coinciden'
                        : '❌ Las contraseñas no coinciden'
                      }
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border-dark">
              <button
                onClick={handleCloseProfileModal}
                className="px-4 py-2 bg-surface-dark border border-border-dark text-text-primary rounded-lg hover:bg-gray-700 transition"
                disabled={changeProfileMutation.isLoading}
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitProfile}
                disabled={changeProfileMutation.isLoading}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-light transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {changeProfileMutation.isLoading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    <span>Guardar Cambios</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
