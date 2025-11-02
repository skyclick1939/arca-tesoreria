import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { useCreateDebtsBatch } from '@/hooks/useDebts';
import { getErrorMessage } from '@/lib/utils';
import type { DebtType, Regional } from '@/types/database.types';

/**
 * Página: Crear Solicitud de Deuda (Admin)
 *
 * Permite al administrador crear una nueva solicitud de apoyo/multa que se distribuye
 * proporcionalmente entre todos los capítulos activos según su número de miembros.
 *
 * FLUJO:
 * 1. Admin llena formulario con datos de la deuda + datos bancarios
 * 2. Valida que al menos CLABE o Cuenta estén llenos
 * 3. Click en "Calcular Distribución" → muestra preview sin persistir
 * 4. Click en "Confirmar y Crear Deudas" → abre modal de confirmación
 * 5. En modal: verifica datos bancarios con checkbox
 * 6. Confirma → llama a create_debts_batch() → redirige a lista
 *
 * CAMPOS BANCARIOS CRÍTICOS:
 * - Banco (dropdown con 20 opciones)
 * - CLABE Interbancaria (18 dígitos, opcional pero al menos uno de CLABE/Cuenta)
 * - Número de Cuenta (10-16 dígitos, opcional)
 * - Titular (requerido)
 */

// Lista de bancos en México (top 20)
const BANCOS_MEXICO = [
  'BBVA México',
  'Banamex (Citibanamex)',
  'Santander México',
  'Banorte',
  'HSBC México',
  'Scotiabank México',
  'Inbursa',
  'Azteca',
  'Afirme',
  'Banregio',
  'Invex',
  'Mifel',
  'Bajío',
  'Monex',
  'Ve por Más',
  'Intercam',
  'Banca Multiva',
  'Actinver',
  'Compartamos Banco',
  'Otro',
];

// Categorías de deuda
const DEBT_CATEGORIES = [
  'Accidente',
  'Trámite',
  'Aniversario',
  'Emergencia',
  'Evento',
  'Mantenimiento',
  'Otro',
];

interface FormData {
  debtType: DebtType | '';
  description: string;
  totalAmount: string;
  dueDate: string;
  category: string;
  bankName: string;
  bankClabe: string;
  bankAccount: string;
  bankHolder: string;
}

interface FormErrors {
  debtType?: string;
  description?: string;
  totalAmount?: string;
  dueDate?: string;
  category?: string;
  bankName?: string;
  bankClabe?: string;
  bankAccount?: string;
  bankHolder?: string;
  bankingInfo?: string; // Error general para validación de CLABE/Cuenta
}

interface PreviewItem {
  chapter_name: string;
  chapter_id: string;
  members: number;
  assigned_amount: number;
}

export default function CrearSolicitudPage() {
  const { profile, logout } = useAuth();
  const router = useRouter();
  const { mutateAsync: createDebts, isLoading: isMutating } = useCreateDebtsBatch();

  // Estado del formulario
  const [formData, setFormData] = useState<FormData>({
    debtType: '',
    description: '',
    totalAmount: '',
    dueDate: '',
    category: '',
    bankName: '',
    bankClabe: '',
    bankAccount: '',
    bankHolder: '',
  });

  // Estado de errores de validación
  const [errors, setErrors] = useState<FormErrors>({});

  // Estado de preview de distribución
  const [previewData, setPreviewData] = useState<PreviewItem[] | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Estado del modal de confirmación
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);

  // Estado de creación
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Validar formulario
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    // Tipo de deuda
    if (!formData.debtType) {
      newErrors.debtType = 'Selecciona el tipo de deuda';
    }

    // Descripción
    if (!formData.description.trim()) {
      newErrors.description = 'La descripción es requerida';
    } else if (formData.description.trim().length < 5) {
      newErrors.description = 'La descripción debe tener al menos 5 caracteres';
    }

    // Monto total
    const amount = parseFloat(formData.totalAmount);
    if (!formData.totalAmount || isNaN(amount)) {
      newErrors.totalAmount = 'El monto es requerido';
    } else if (amount <= 0) {
      newErrors.totalAmount = 'El monto debe ser mayor a 0';
    } else if (amount > 10000000) {
      newErrors.totalAmount = 'El monto es demasiado alto (máx: $10,000,000)';
    }

    // Fecha de vencimiento
    if (!formData.dueDate) {
      newErrors.dueDate = 'La fecha de vencimiento es requerida';
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(formData.dueDate + 'T00:00:00');

      if (selectedDate < today) {
        newErrors.dueDate = 'La fecha debe ser hoy o en el futuro';
      }
    }

    // Categoría
    if (!formData.category) {
      newErrors.category = 'Selecciona una categoría';
    }

    // Banco
    if (!formData.bankName) {
      newErrors.bankName = 'Selecciona un banco';
    }

    // Validación crítica: Al menos CLABE o Cuenta
    const hasClabe = formData.bankClabe.trim().length > 0;
    const hasAccount = formData.bankAccount.trim().length > 0;

    if (!hasClabe && !hasAccount) {
      newErrors.bankingInfo = 'Debes proporcionar al menos la CLABE Interbancaria o el Número de Cuenta';
    }

    // Validar formato de CLABE (si está lleno)
    if (hasClabe) {
      const clabeClean = formData.bankClabe.replace(/\s/g, '');
      if (!/^\d{18}$/.test(clabeClean)) {
        newErrors.bankClabe = 'La CLABE debe tener exactamente 18 dígitos';
      }
    }

    // Validar formato de Cuenta (si está lleno)
    if (hasAccount) {
      const accountClean = formData.bankAccount.replace(/\s/g, '');
      if (!/^\d{10,16}$/.test(accountClean)) {
        newErrors.bankAccount = 'El número de cuenta debe tener entre 10 y 16 dígitos';
      }
    }

    // Titular
    if (!formData.bankHolder.trim()) {
      newErrors.bankHolder = 'El nombre del titular es requerido';
    } else if (formData.bankHolder.trim().length < 3) {
      newErrors.bankHolder = 'El nombre del titular debe tener al menos 3 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Calcular distribución (preview)
  const handleCalculatePreview = async () => {
    // Validar solo los campos necesarios para el preview
    if (!formData.totalAmount || parseFloat(formData.totalAmount) <= 0) {
      setErrors({ totalAmount: 'Ingresa un monto válido para calcular la distribución' });
      return;
    }

    setIsLoadingPreview(true);
    setPreviewError(null);

    try {
      const response = await fetch(
        `/api/debts/preview-distribution?total_amount=${formData.totalAmount}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.details || data.error || 'Error al calcular distribución');
      }

      // Mapear respuesta del API al formato esperado por el componente
      setPreviewData(
        data.distribution.map((item: any) => ({
          chapter_name: item.chapter_name,
          chapter_id: item.chapter_id,
          members: item.members,
          assigned_amount: item.assigned_amount,
        }))
      );
    } catch (error) {
      console.error('Error calculating preview:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Error al calcular la distribución. Intenta de nuevo.';
      setPreviewError(errorMessage);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Abrir modal de confirmación
  const handleOpenConfirmModal = () => {
    if (!validate()) {
      return;
    }

    if (!previewData) {
      setErrors({ totalAmount: 'Debes calcular la distribución antes de confirmar' });
      return;
    }

    setIsConfirmModalOpen(true);
    setConfirmCheckbox(false);
  };

  // Confirmar y crear deudas
  const handleConfirmCreate = async () => {
    if (!confirmCheckbox) {
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      // Llamar a función SQL create_debts_batch via RPC
      const result = await createDebts({
        total_amount: parseFloat(formData.totalAmount),
        due_date: formData.dueDate,
        debt_type: formData.debtType as 'apoyo' | 'multa' | 'aportacion',
        description: formData.description.trim(),
        category: formData.category,
        bank_name: formData.bankName,
        bank_clabe: formData.bankClabe.trim() || undefined,
        bank_account: formData.bankAccount.trim() || undefined,
        bank_holder: formData.bankHolder.trim(),
      });

      console.log('[crear.tsx] Deudas creadas exitosamente:', {
        debts_created: result.debts_created,
        total_amount: result.total_amount,
        cost_per_member: result.cost_per_member,
      });

      // Redirigir a lista de solicitudes
      router.push('/admin/solicitudes');
    } catch (error) {
      console.error('[crear.tsx] Error creating debts:', error);
      const errorMsg = getErrorMessage(error) || 'Error al crear las deudas. Intenta de nuevo.';
      setCreateError(errorMsg);
      setIsCreating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Formatear monto como MXN
  const formatMXN = (amount: number): string => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  return (
    <>
      <Head>
        <title>Crear Solicitud - El Arca</title>
        <meta name="description" content="Crear nueva solicitud de apoyo o multa" />
      </Head>

      <div className="min-h-screen bg-background-dark">
        {/* Header */}
        <header className="bg-surface-dark border-b border-border-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-primary">El Arca</h1>
                <p className="text-sm text-text-secondary">Panel de Administración</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-text-primary">
                    {profile?.full_name}
                  </p>
                  <p className="text-xs text-text-muted">Administrador</p>
                </div>
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
          {/* Breadcrumb */}
          <nav className="mb-6">
            <ol className="flex items-center space-x-2 text-sm">
              <li>
                <Link href="/admin/dashboard" className="text-primary hover:text-primary-light">
                  Dashboard
                </Link>
              </li>
              <li className="text-text-muted">/</li>
              <li>
                <Link href="/admin/solicitudes" className="text-primary hover:text-primary-light">
                  Solicitudes
                </Link>
              </li>
              <li className="text-text-muted">/</li>
              <li className="text-text-primary font-medium">Crear</li>
            </ol>
          </nav>

          {/* Page Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-text-primary mb-2">
              Nueva Solicitud de Deuda
            </h2>
            <p className="text-text-secondary">
              Crea una nueva solicitud de apoyo o multa que se distribuirá entre todos los capítulos activos
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={(e) => { e.preventDefault(); handleOpenConfirmModal(); }} className="space-y-8">
            {/* Sección 1: Información General */}
            <div className="card">
              <h3 className="text-xl font-bold text-text-primary mb-6">
                1. Información General
              </h3>

              <div className="space-y-6">
                {/* Tipo de Deuda */}
                <div>
                  <label className="block text-sm font-medium mb-3">
                    Tipo de Deuda *
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="debtType"
                        value="apoyo"
                        checked={formData.debtType === 'apoyo'}
                        onChange={(e) => setFormData({ ...formData, debtType: e.target.value as DebtType })}
                        className="mr-2 w-4 h-4 text-primary"
                      />
                      <span className="text-text-primary">Apoyo</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="debtType"
                        value="multa"
                        checked={formData.debtType === 'multa'}
                        onChange={(e) => setFormData({ ...formData, debtType: e.target.value as DebtType })}
                        className="mr-2 w-4 h-4 text-danger"
                      />
                      <span className="text-text-primary">Multa</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="debtType"
                        value="aportacion"
                        checked={formData.debtType === 'aportacion'}
                        onChange={(e) => setFormData({ ...formData, debtType: e.target.value as DebtType })}
                        className="mr-2 w-4 h-4 text-primary-light"
                      />
                      <span className="text-text-primary">Aportación</span>
                    </label>
                  </div>
                  {errors.debtType && <p className="text-danger text-sm mt-1">{errors.debtType}</p>}
                </div>

                {/* Descripción/Concepto */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium mb-2">
                    Descripción / Concepto *
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ej: Apoyo para reparación de moto de hermano accidentado"
                    rows={3}
                    className={`input w-full ${errors.description ? 'border-danger' : ''}`}
                  />
                  {errors.description && <p className="text-danger text-sm mt-1">{errors.description}</p>}
                </div>

                {/* Monto Total y Fecha en Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Monto Total */}
                  <div>
                    <label htmlFor="totalAmount" className="block text-sm font-medium mb-2">
                      Monto Total *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                        $
                      </span>
                      <input
                        id="totalAmount"
                        type="number"
                        step="0.01"
                        min="1"
                        value={formData.totalAmount}
                        onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                        placeholder="0.00"
                        className={`input w-full pl-8 ${errors.totalAmount ? 'border-danger' : ''}`}
                      />
                    </div>
                    {errors.totalAmount && <p className="text-danger text-sm mt-1">{errors.totalAmount}</p>}
                    <p className="text-xs text-text-muted mt-1">
                      Se distribuirá proporcionalmente entre capítulos según número de miembros
                    </p>
                  </div>

                  {/* Fecha Límite */}
                  <div>
                    <label htmlFor="dueDate" className="block text-sm font-medium mb-2">
                      Fecha Límite de Pago *
                    </label>
                    <input
                      id="dueDate"
                      type="date"
                      data-testid="due-date-input"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className={`input w-full ${errors.dueDate ? 'border-danger' : ''}`}
                      required
                    />
                    {errors.dueDate && <p className="text-danger text-sm mt-1">{errors.dueDate}</p>}
                  </div>
                </div>

                {/* Categoría */}
                <div>
                  <label htmlFor="category" className="block text-sm font-medium mb-2">
                    Categoría *
                  </label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className={`input w-full ${errors.category ? 'border-danger' : ''}`}
                  >
                    <option value="">Selecciona una categoría</option>
                    {DEBT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  {errors.category && <p className="text-danger text-sm mt-1">{errors.category}</p>}
                </div>
              </div>
            </div>

            {/* Sección 2: Datos Bancarios */}
            <div className="card">
              <h3 className="text-xl font-bold text-text-primary mb-2">
                2. Datos Bancarios para Depósito
              </h3>
              <p className="text-sm text-text-secondary mb-6">
                Proporciona la cuenta donde los capítulos deben depositar el monto asignado
              </p>

              {errors.bankingInfo && (
                <div className="mb-6 p-4 bg-danger/10 border border-danger rounded-md">
                  <p className="text-danger text-sm">{errors.bankingInfo}</p>
                </div>
              )}

              <div className="space-y-6">
                {/* Banco */}
                <div>
                  <label htmlFor="bankName" className="block text-sm font-medium mb-2">
                    Banco *
                  </label>
                  <select
                    id="bankName"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className={`input w-full ${errors.bankName ? 'border-danger' : ''}`}
                  >
                    <option value="">Selecciona un banco</option>
                    {BANCOS_MEXICO.map((banco) => (
                      <option key={banco} value={banco}>
                        {banco}
                      </option>
                    ))}
                  </select>
                  {errors.bankName && <p className="text-danger text-sm mt-1">{errors.bankName}</p>}
                </div>

                {/* CLABE y Cuenta en Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* CLABE Interbancaria */}
                  <div>
                    <label htmlFor="bankClabe" className="block text-sm font-medium mb-2">
                      CLABE Interbancaria
                    </label>
                    <input
                      id="bankClabe"
                      type="text"
                      maxLength={18}
                      value={formData.bankClabe}
                      onChange={(e) => setFormData({ ...formData, bankClabe: e.target.value.replace(/\D/g, '') })}
                      placeholder="000000000000000000"
                      className={`input w-full font-mono ${errors.bankClabe ? 'border-danger' : ''}`}
                    />
                    {errors.bankClabe && <p className="text-danger text-sm mt-1">{errors.bankClabe}</p>}
                    <p className="text-xs text-text-muted mt-1">
                      18 dígitos (opcional si proporcionas número de cuenta)
                    </p>
                  </div>

                  {/* Número de Cuenta */}
                  <div>
                    <label htmlFor="bankAccount" className="block text-sm font-medium mb-2">
                      Número de Cuenta
                    </label>
                    <input
                      id="bankAccount"
                      type="text"
                      maxLength={16}
                      value={formData.bankAccount}
                      onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value.replace(/\D/g, '') })}
                      placeholder="0000000000"
                      className={`input w-full font-mono ${errors.bankAccount ? 'border-danger' : ''}`}
                    />
                    {errors.bankAccount && <p className="text-danger text-sm mt-1">{errors.bankAccount}</p>}
                    <p className="text-xs text-text-muted mt-1">
                      10-16 dígitos (opcional si proporcionas CLABE)
                    </p>
                  </div>
                </div>

                {/* Titular */}
                <div>
                  <label htmlFor="bankHolder" className="block text-sm font-medium mb-2">
                    Nombre del Titular *
                  </label>
                  <input
                    id="bankHolder"
                    type="text"
                    value={formData.bankHolder}
                    onChange={(e) => setFormData({ ...formData, bankHolder: e.target.value })}
                    placeholder="Ej: Juan Pérez García"
                    className={`input w-full ${errors.bankHolder ? 'border-danger' : ''}`}
                  />
                  {errors.bankHolder && <p className="text-danger text-sm mt-1">{errors.bankHolder}</p>}
                </div>
              </div>
            </div>

            {/* Sección 3: Preview de Distribución */}
            <div className="card">
              <h3 className="text-xl font-bold text-text-primary mb-2">
                3. Distribución por Capítulo
              </h3>
              <p className="text-sm text-text-secondary mb-6">
                Calcula cómo se distribuirá el monto entre los capítulos activos
              </p>

              <button
                type="button"
                onClick={handleCalculatePreview}
                disabled={isLoadingPreview}
                className="btn-secondary mb-6"
              >
                {isLoadingPreview ? 'Calculando...' : 'Calcular Distribución'}
              </button>

              {previewError && (
                <div className="mb-6 p-4 bg-danger/10 border border-danger rounded-md">
                  <p className="text-danger text-sm">{previewError}</p>
                </div>
              )}

              {previewData && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border-dark">
                    <thead className="bg-surface-dark">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">
                          Capítulo
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase">
                          Miembros
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase">
                          Monto Asignado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dark">
                      {previewData.map((item) => (
                        <tr key={item.chapter_id}>
                          <td className="px-6 py-4 text-sm text-text-primary">
                            {item.chapter_name}
                          </td>
                          <td className="px-6 py-4 text-sm text-text-secondary text-right">
                            {item.members}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-primary text-right">
                            {formatMXN(item.assigned_amount)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-surface-dark">
                        <td className="px-6 py-4 text-sm font-bold text-text-primary">
                          TOTAL
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-text-secondary text-right">
                          {previewData.reduce((sum, item) => sum + item.members, 0)}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-primary text-right">
                          {formatMXN(previewData.reduce((sum, item) => sum + item.assigned_amount, 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Botones de acción */}
            <div className="flex gap-4 justify-end">
              <Link href="/admin/solicitudes" className="btn-secondary">
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={!previewData}
                className="btn-primary"
              >
                Confirmar y Crear Deudas
              </button>
            </div>
          </form>
        </main>
      </div>

      {/* Modal de Confirmación */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card max-w-2xl w-full">
            <h2 className="text-2xl font-bold text-text-primary mb-4">
              Confirmar Creación de Deudas
            </h2>

            <div className="mb-6 p-4 bg-primary/10 border border-primary rounded-md">
              <p className="text-sm text-text-primary mb-4">
                <strong>⚠️ Importante:</strong> Verifica que los datos bancarios sean correctos antes de continuar.
              </p>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Banco:</span>
                  <span className="text-text-primary font-medium">{formData.bankName}</span>
                </div>
                {formData.bankClabe && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">CLABE:</span>
                    <span className="text-text-primary font-mono">{formData.bankClabe}</span>
                  </div>
                )}
                {formData.bankAccount && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Cuenta:</span>
                    <span className="text-text-primary font-mono">{formData.bankAccount}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-text-muted">Titular:</span>
                  <span className="text-text-primary font-medium">{formData.bankHolder}</span>
                </div>
              </div>
            </div>

            <label className="flex items-start cursor-pointer mb-6">
              <input
                type="checkbox"
                checked={confirmCheckbox}
                onChange={(e) => setConfirmCheckbox(e.target.checked)}
                className="mr-3 mt-1 w-4 h-4"
              />
              <span className="text-sm text-text-primary">
                He verificado que los datos bancarios son correctos y autorizo la creación de {previewData?.length || 0} deudas
              </span>
            </label>

            {createError && (
              <div className="mb-6 p-4 bg-danger/10 border border-danger rounded-md">
                <p className="text-danger text-sm">{createError}</p>
              </div>
            )}

            <div className="flex gap-4 justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsConfirmModalOpen(false);
                  setConfirmCheckbox(false);
                }}
                disabled={isCreating}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCreate}
                disabled={!confirmCheckbox || isCreating}
                className="btn-primary"
              >
                {isCreating ? 'Creando...' : 'Sí, Crear Deudas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
