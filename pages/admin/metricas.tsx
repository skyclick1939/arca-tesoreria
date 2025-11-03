import { useState, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useDebts, useRequestStats, useChapterStats } from '@/hooks/useDebts';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import ViewProofModal from '@/components/modals/ViewProofModal';
import type { Debt } from '@/types/database.types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

/**
 * Dashboard de Métricas - El Arca (Admin)
 *
 * 3 Tabs completos:
 * - Tab 1: Vista General (Total Adeudos, Recabado, Faltante, Gráfica, Últimas Transacciones) ✅
 * - Tab 2: Vista Por Solicitud (Tabla con barras de progreso + drill-down por capítulo) ✅
 * - Tab 3: Vista Por Capítulo (Tabla con métricas + drill-down de deudas) ✅
 *
 * Sprint 3:
 * - T3.1: Tab 1 implementado ✅
 * - T3.3: Tab 2 implementado ✅
 * - T3.5: Tab 3 implementado ✅
 */

type TabType = 'general' | 'solicitud' | 'capitulo';
type FilterType = 'all' | 'pending' | 'overdue' | 'in_review' | 'approved';

export default function MetricasDashboard() {
  const { profile, isLoading: authLoading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);

  // Estado para modal de visualización de comprobante
  const [viewProofModalOpen, setViewProofModalOpen] = useState(false);
  const [viewProofUrl, setViewProofUrl] = useState<string | null>(null);

  // Queries para datos
  const { data: allDebts = [], isLoading: loadingDebts } = useDebts();
  const { data: inReviewDebts = [] } = useDebts({ status: 'in_review' });
  const { data: requestStats = [], isLoading: loadingRequestStats } = useRequestStats();
  const { data: chapterStats = [], isLoading: loadingChapterStats } = useChapterStats();

  // ====================================
  // CÁLCULOS DE MÉTRICAS (Tab 1)
  // ====================================

  const metrics = useMemo(() => {
    const total = allDebts.reduce((sum, debt) => sum + Number(debt.amount), 0);
    const recabado = allDebts
      .filter((d) => d.status === 'approved')
      .reduce((sum, debt) => sum + Number(debt.amount), 0);
    const faltante = total - recabado;
    const percentageCollected = total > 0 ? (recabado / total) * 100 : 0;

    return {
      totalAdeudos: total,
      totalRecabado: recabado,
      faltantePorCobrar: faltante,
      percentageCollected,
    };
  }, [allDebts]);

  // ====================================
  // DATOS PARA GRÁFICA DE CUMPLIMIENTO (últimos 6 meses)
  // ====================================

  const chartData = useMemo(() => {
    // Generar últimos 6 meses
    const months = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });

      // Filtrar deudas del mes
      const debtsInMonth = allDebts.filter((debt) => {
        const dueDate = new Date(debt.due_date);
        return (
          dueDate.getMonth() === date.getMonth() &&
          dueDate.getFullYear() === date.getFullYear()
        );
      });

      const totalMonth = debtsInMonth.reduce((sum, d) => sum + Number(d.amount), 0);
      const approvedMonth = debtsInMonth
        .filter((d) => d.status === 'approved')
        .reduce((sum, d) => sum + Number(d.amount), 0);
      const percentage = totalMonth > 0 ? (approvedMonth / totalMonth) * 100 : 0;

      months.push({
        month: monthName,
        cumplimiento: percentage,
        total: totalMonth,
        recabado: approvedMonth,
      });
    }

    return months;
  }, [allDebts]);

  // ====================================
  // ÚLTIMAS TRANSACCIONES (filtradas)
  // ====================================

  const filteredDebts = useMemo(() => {
    let debts = [...allDebts];

    // Aplicar filtro de status
    if (filter !== 'all') {
      debts = debts.filter((d) => d.status === filter);
    }

    // Ordenar por fecha de creación (más recientes primero)
    debts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Limitar a 10
    return debts.slice(0, 10);
  }, [allDebts, filter]);

  // ====================================
  // HANDLERS
  // ====================================

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
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

  // ====================================
  // RENDERS DE ESTADOS
  // ====================================

  if (authLoading || loadingDebts) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Cargando métricas...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  // ====================================
  // RENDER PRINCIPAL
  // ====================================

  return (
    <>
      <Head>
        <title>Dashboard de Métricas - El Arca</title>
        <meta name="description" content="Métricas del sistema" />
      </Head>

      <div className="min-h-screen bg-background-dark">
        {/* Header */}
        <header className="bg-surface-dark border-b border-border-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-primary">Dashboard de Métricas</h1>
                <p className="text-sm text-text-secondary">Vista general del sistema</p>
              </div>
              <div className="flex items-center gap-4">
                {/* Badge contador de pagos en revisión */}
                {inReviewDebts.length > 0 && (
                  <Link href="/admin/comprobantes">
                    <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary rounded-lg cursor-pointer hover:bg-primary/20 transition-colors">
                      <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm font-medium text-primary">
                        {inReviewDebts.length} pendiente{inReviewDebts.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </Link>
                )}
                <div className="text-right">
                  <p className="text-sm font-medium text-text-primary">{profile?.full_name}</p>
                  <p className="text-xs text-text-muted">Administrador</p>
                </div>
                <button onClick={handleLogout} className="btn-danger text-sm">
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Link href="/admin/dashboard" className="text-primary hover:text-primary-light text-sm">
              ← Volver al Dashboard Principal
            </Link>
          </div>

          {/* Tabs */}
          <div className="card mb-6">
            <div className="flex gap-2 border-b border-border-dark pb-4">
              <button
                onClick={() => setActiveTab('general')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'general'
                    ? 'bg-primary text-white'
                    : 'bg-surface-dark text-text-secondary hover:bg-primary/10 hover:text-primary'
                }`}
              >
                Vista General
              </button>
              <button
                onClick={() => setActiveTab('solicitud')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'solicitud'
                    ? 'bg-primary text-white'
                    : 'bg-surface-dark text-text-secondary hover:bg-primary/10 hover:text-primary'
                }`}
              >
                Por Solicitud
              </button>
              <button
                onClick={() => setActiveTab('capitulo')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'capitulo'
                    ? 'bg-primary text-white'
                    : 'bg-surface-dark text-text-secondary hover:bg-primary/10 hover:text-primary'
                }`}
              >
                Por Capítulo
              </button>
            </div>

            {/* Tab Content */}
            <div className="pt-6">
              {/* TAB 1: VISTA GENERAL */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  {/* Tarjetas de Métricas */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Card: Total Adeudos */}
                    <div className="card bg-primary/5 border-primary">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-text-secondary">Total Adeudos</p>
                        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-2xl font-bold text-primary">{formatCurrency(metrics.totalAdeudos)}</p>
                      <p className="text-xs text-text-muted mt-1">De {allDebts.length} solicitudes</p>
                    </div>

                    {/* Card: Total Recabado */}
                    <div className="card bg-primary-light/5 border-primary-light">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-text-secondary">Total Recabado</p>
                        <svg className="w-5 h-5 text-primary-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-2xl font-bold text-primary-light">{formatCurrency(metrics.totalRecabado)}</p>
                      <p className="text-xs text-text-muted mt-1">{metrics.percentageCollected.toFixed(1)}% del total</p>
                    </div>

                    {/* Card: Faltante por Cobrar */}
                    <div className={`card ${metrics.faltantePorCobrar > metrics.totalAdeudos * 0.5 ? 'bg-danger/5 border-danger' : 'bg-surface-dark border-border-dark'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-text-secondary">Faltante por Cobrar</p>
                        <svg className={`w-5 h-5 ${metrics.faltantePorCobrar > metrics.totalAdeudos * 0.5 ? 'text-danger' : 'text-text-muted'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className={`text-2xl font-bold ${metrics.faltantePorCobrar > metrics.totalAdeudos * 0.5 ? 'text-danger' : 'text-text-primary'}`}>
                        {formatCurrency(metrics.faltantePorCobrar)}
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        {metrics.faltantePorCobrar > metrics.totalAdeudos * 0.5 ? 'Más del 50% pendiente' : 'Menos del 50% pendiente'}
                      </p>
                    </div>
                  </div>

                  {/* Gráfica de Cumplimiento */}
                  <div className="card">
                    <h3 className="text-lg font-bold text-primary mb-4">Cumplimiento de Pago (Últimos 6 Meses)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="month" stroke="#A0A0A0" />
                        <YAxis stroke="#A0A0A0" domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1E1E1E',
                            border: '1px solid #333',
                            borderRadius: '8px',
                          }}
                          labelStyle={{ color: '#FFFFFF' }}
                          itemStyle={{ color: '#4CAF50' }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="cumplimiento"
                          stroke="#4CAF50"
                          strokeWidth={3}
                          name="% Cumplimiento"
                          dot={{ fill: '#4CAF50', r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Últimas Transacciones */}
                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-primary">Últimas Transacciones</h3>

                      {/* Dropdown de Filtros */}
                      <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as FilterType)}
                        className="px-3 py-2 bg-surface-dark border border-border-dark rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary"
                      >
                        <option value="all">Todas</option>
                        <option value="approved">Pagadas</option>
                        <option value="pending">Pendientes</option>
                        <option value="overdue">Atrasadas</option>
                        <option value="in_review">En Revisión</option>
                      </select>
                    </div>

                    {/* Tabla */}
                    {filteredDebts.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-text-muted">No hay transacciones con el filtro seleccionado</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border-dark">
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Capítulo</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Concepto</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Monto</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Estatus</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredDebts.map((debt) => (
                              <tr key={debt.id} className="border-b border-border-dark hover:bg-primary/5 transition-colors">
                                <td className="py-3 px-4 text-sm text-text-primary">
                                  {debt.chapter?.name || 'Sin capítulo'}
                                  <p className="text-xs text-text-muted">{debt.chapter?.regional || 'N/A'}</p>
                                </td>
                                <td className="py-3 px-4 text-sm text-text-primary">
                                  {debt.description}
                                  <p className="text-xs text-text-muted capitalize">{debt.debt_type}</p>
                                </td>
                                <td className="py-3 px-4 text-sm font-medium text-primary">{formatCurrency(Number(debt.amount))}</td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                        debt.status === 'approved'
                                          ? 'bg-primary-light/20 text-primary-light'
                                          : debt.status === 'in_review'
                                          ? 'bg-blue-500/20 text-blue-400'
                                          : debt.status === 'overdue'
                                          ? 'bg-danger/20 text-danger'
                                          : 'bg-yellow-500/20 text-yellow-400'
                                      }`}
                                    >
                                      {debt.status === 'approved' ? 'Aprobado' :
                                       debt.status === 'in_review' ? 'En Revisión' :
                                       debt.status === 'overdue' ? 'Vencido' : 'Pendiente'}
                                    </span>
                                    {debt.proof_file_url && (
                                      <button
                                        onClick={() => handleViewProof(debt)}
                                        className={`transition-colors p-3 -m-3 min-w-[44px] min-h-[44px] inline-flex items-center justify-center ${
                                          debt.status === 'approved'
                                            ? 'text-primary-light hover:text-primary'
                                            : debt.status === 'in_review'
                                            ? 'text-blue-400 hover:text-blue-300'
                                            : 'text-text-secondary hover:text-text-primary'
                                        }`}
                                        title="Ver comprobante"
                                        aria-label="Ver comprobante de pago"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: POR SOLICITUD */}
              {activeTab === 'solicitud' && (
                <div className="space-y-6">
                  <div className="card">
                    <h3 className="text-lg font-bold text-primary mb-4">Análisis por Solicitud</h3>
                    <p className="text-sm text-text-secondary mb-6">
                      Resumen de todas las solicitudes agrupadas por concepto. Click en una fila para ver el desglose por capítulo.
                    </p>

                    {loadingRequestStats ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border-dark">
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Solicitud</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Monto Total</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Recabado</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Pendiente</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">% Cumplimiento</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary"># Deudas</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Detalles</th>
                            </tr>
                          </thead>
                          <tbody>
                            <SkeletonLoader type="table-row" count={5} />
                          </tbody>
                        </table>
                      </div>
                    ) : requestStats.length === 0 ? (
                      <div className="text-center py-8">
                        <svg className="w-12 h-12 mx-auto mb-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-text-muted">No hay solicitudes registradas</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border-dark">
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Solicitud</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Monto Total</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Recabado</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Pendiente</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">% Cumplimiento</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary"># Deudas</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Detalles</th>
                            </tr>
                          </thead>
                          <tbody>
                            {requestStats.map((request) => {
                              const isExpanded = expandedRequest === request.request_name;
                              const requestDebts = allDebts.filter((d) => d.description === request.request_name);

                              return (
                                <>
                                  {/* Fila principal de solicitud */}
                                  <tr
                                    key={request.request_name}
                                    className="border-b border-border-dark hover:bg-primary/5 transition-colors cursor-pointer"
                                    onClick={() => setExpandedRequest(isExpanded ? null : request.request_name)}
                                  >
                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-2">
                                        <svg
                                          className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                        <div>
                                          <p className="text-sm font-medium text-text-primary">{request.request_name}</p>
                                          <p className="text-xs text-text-muted">
                                            Creada: {new Date(request.first_created_at).toLocaleDateString('es-MX')}
                                          </p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-sm font-medium text-primary">
                                      {formatCurrency(Number(request.total_amount))}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-primary-light">
                                      {formatCurrency(Number(request.collected_amount))}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-text-secondary">
                                      {formatCurrency(Number(request.pending_amount))}
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 bg-surface-dark rounded-full h-2 overflow-hidden">
                                            <div
                                              className={`h-full rounded-full transition-all ${
                                                Number(request.completion_percentage) >= 75
                                                  ? 'bg-primary-light'
                                                  : Number(request.completion_percentage) >= 50
                                                  ? 'bg-yellow-500'
                                                  : Number(request.completion_percentage) >= 25
                                                  ? 'bg-orange-500'
                                                  : 'bg-danger'
                                              }`}
                                              style={{ width: `${request.completion_percentage}%` }}
                                            ></div>
                                          </div>
                                          <span className="text-sm font-medium text-text-primary whitespace-nowrap">
                                            {Number(request.completion_percentage).toFixed(1)}%
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary">
                                        {request.debts_count}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <span className="text-xs text-primary">
                                        {isExpanded ? 'Ocultar' : 'Ver'}
                                      </span>
                                    </td>
                                  </tr>

                                  {/* Drill-down: Desglose por capítulo */}
                                  {isExpanded && (
                                    <tr>
                                      <td colSpan={7} className="bg-surface-dark/50 p-4">
                                        <div className="space-y-2">
                                          <h4 className="text-sm font-bold text-primary mb-3">
                                            Desglose por Capítulo ({requestDebts.length} capítulos)
                                          </h4>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {requestDebts.map((debt) => (
                                              <div
                                                key={debt.id}
                                                className="p-3 bg-background-dark rounded-lg border border-border-dark"
                                              >
                                                <div className="flex items-center justify-between mb-2">
                                                  <div>
                                                    <p className="text-sm font-medium text-text-primary">
                                                      {debt.chapter?.name || 'Sin capítulo'}
                                                    </p>
                                                    <p className="text-xs text-text-muted">
                                                      {debt.chapter?.regional || 'N/A'} • {debt.chapter?.member_count || 0} miembros
                                                    </p>
                                                  </div>
                                                  <p className="text-sm font-bold text-primary">
                                                    {formatCurrency(Number(debt.amount))}
                                                  </p>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                  <span
                                                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                                      debt.status === 'approved'
                                                        ? 'bg-primary-light/20 text-primary-light'
                                                        : debt.status === 'in_review'
                                                        ? 'bg-blue-500/20 text-blue-400'
                                                        : debt.status === 'overdue'
                                                        ? 'bg-danger/20 text-danger'
                                                        : 'bg-yellow-500/20 text-yellow-400'
                                                    }`}
                                                  >
                                                    {debt.status === 'approved'
                                                      ? 'Aprobado'
                                                      : debt.status === 'in_review'
                                                      ? 'En Revisión'
                                                      : debt.status === 'overdue'
                                                      ? 'Vencido'
                                                      : 'Pendiente'}
                                                  </span>
                                                  <p className="text-xs text-text-muted">
                                                    Vence: {new Date(debt.due_date).toLocaleDateString('es-MX')}
                                                  </p>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: POR CAPÍTULO */}
              {activeTab === 'capitulo' && (
                <div className="space-y-6">
                  <div className="card">
                    <h3 className="text-lg font-bold text-primary mb-4">Análisis por Capítulo</h3>
                    <p className="text-sm text-text-secondary mb-6">
                      Resumen de todos los capítulos activos con su desempeño de pago. Click en una fila para ver el desglose de deudas.
                    </p>

                    {loadingChapterStats ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border-dark">
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Capítulo</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Total Asignado</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Pagado</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Pendiente</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Vencido</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">% Cumplimiento</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Detalles</th>
                            </tr>
                          </thead>
                          <tbody>
                            <SkeletonLoader type="table-row" count={4} />
                          </tbody>
                        </table>
                      </div>
                    ) : chapterStats.length === 0 ? (
                      <div className="text-center py-8">
                        <svg className="w-12 h-12 mx-auto mb-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p className="text-text-muted">No hay capítulos activos</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border-dark">
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Capítulo</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Total Asignado</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Pagado</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Pendiente</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Vencido</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">% Cumplimiento</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Detalles</th>
                            </tr>
                          </thead>
                          <tbody>
                            {chapterStats.map((chapter) => {
                              const isExpanded = expandedChapter === chapter.chapter_id;
                              const chapterDebts = allDebts.filter((d) => d.chapter_id === chapter.chapter_id);

                              return (
                                <>
                                  {/* Fila principal de capítulo */}
                                  <tr
                                    key={chapter.chapter_id}
                                    className={`border-b border-border-dark hover:bg-primary/5 transition-colors cursor-pointer ${
                                      Number(chapter.total_overdue) > 0 ? 'bg-danger/5' : ''
                                    }`}
                                    onClick={() => setExpandedChapter(isExpanded ? null : chapter.chapter_id)}
                                  >
                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-2">
                                        <svg
                                          className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                        <div>
                                          <p className="text-sm font-medium text-text-primary">{chapter.chapter_name}</p>
                                          <p className="text-xs text-text-muted">
                                            {chapter.regional} • {chapter.member_count} miembros
                                          </p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-sm font-medium text-primary">
                                      {formatCurrency(Number(chapter.total_assigned))}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-primary-light">
                                      {formatCurrency(Number(chapter.total_paid))}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-text-secondary">
                                      {formatCurrency(Number(chapter.total_pending))}
                                    </td>
                                    <td className="py-3 px-4">
                                      <span
                                        className={`text-sm font-medium ${
                                          Number(chapter.total_overdue) > 0 ? 'text-danger' : 'text-text-muted'
                                        }`}
                                      >
                                        {formatCurrency(Number(chapter.total_overdue))}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 bg-surface-dark rounded-full h-2 overflow-hidden">
                                            <div
                                              className={`h-full rounded-full transition-all ${
                                                Number(chapter.completion_percentage) >= 75
                                                  ? 'bg-primary-light'
                                                  : Number(chapter.completion_percentage) >= 50
                                                  ? 'bg-yellow-500'
                                                  : Number(chapter.completion_percentage) >= 25
                                                  ? 'bg-orange-500'
                                                  : 'bg-danger'
                                              }`}
                                              style={{ width: `${chapter.completion_percentage}%` }}
                                            ></div>
                                          </div>
                                          <span className="text-sm font-medium text-text-primary whitespace-nowrap">
                                            {Number(chapter.completion_percentage).toFixed(1)}%
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <span className="text-xs text-primary">
                                        {isExpanded ? 'Ocultar' : 'Ver'}
                                      </span>
                                    </td>
                                  </tr>

                                  {/* Drill-down: Desglose de deudas del capítulo */}
                                  {isExpanded && (
                                    <tr>
                                      <td colSpan={7} className="bg-surface-dark/50 p-4">
                                        <div className="space-y-2">
                                          <h4 className="text-sm font-bold text-primary mb-3">
                                            Deudas del Capítulo ({chapterDebts.length} deudas)
                                          </h4>
                                          {chapterDebts.length === 0 ? (
                                            <p className="text-text-muted text-sm text-center py-4">
                                              No hay deudas asignadas a este capítulo
                                            </p>
                                          ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                              {chapterDebts.map((debt) => (
                                                <div
                                                  key={debt.id}
                                                  className="p-3 bg-background-dark rounded-lg border border-border-dark"
                                                >
                                                  <div className="flex items-center justify-between mb-2">
                                                    <div className="flex-1">
                                                      <p className="text-sm font-medium text-text-primary">
                                                        {debt.description}
                                                      </p>
                                                      <p className="text-xs text-text-muted capitalize">
                                                        {debt.debt_type}
                                                      </p>
                                                    </div>
                                                    <p className="text-sm font-bold text-primary ml-2">
                                                      {formatCurrency(Number(debt.amount))}
                                                    </p>
                                                  </div>
                                                  <div className="flex items-center justify-between">
                                                    <span
                                                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                                        debt.status === 'approved'
                                                          ? 'bg-primary-light/20 text-primary-light'
                                                          : debt.status === 'in_review'
                                                          ? 'bg-blue-500/20 text-blue-400'
                                                          : debt.status === 'overdue'
                                                          ? 'bg-danger/20 text-danger'
                                                          : 'bg-yellow-500/20 text-yellow-400'
                                                      }`}
                                                    >
                                                      {debt.status === 'approved'
                                                        ? 'Aprobado'
                                                        : debt.status === 'in_review'
                                                        ? 'En Revisión'
                                                        : debt.status === 'overdue'
                                                        ? 'Vencido'
                                                        : 'Pendiente'}
                                                    </span>
                                                    <p className="text-xs text-text-muted">
                                                      Vence: {new Date(debt.due_date).toLocaleDateString('es-MX')}
                                                    </p>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Modal de Visualización de Comprobante */}
      <ViewProofModal
        proofUrl={viewProofUrl}
        isOpen={viewProofModalOpen}
        onClose={handleCloseViewProof}
      />
    </>
  );
}
