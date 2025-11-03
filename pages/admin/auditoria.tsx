import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/**
 * Página de Auditoría (Solo Admin)
 *
 * Muestra el registro completo de cambios en el sistema:
 * - Filtros por tabla, acción, usuario, fecha
 * - Paginación
 * - Visualización de cambios (antes/después)
 * - Exportación de logs
 */

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_values: any;
  new_values: any;
  user_id: string;
  changed_by: string;
  timestamp: string;
  user_email: string;
  user_name: string;
  total_count: number;
}

const ITEMS_PER_PAGE = 50;

const ACTION_LABELS: Record<string, string> = {
  INSERT: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
};

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'bg-primary/20 text-primary',
  UPDATE: 'bg-blue-500/20 text-blue-400',
  DELETE: 'bg-danger/20 text-danger',
};

export default function AuditoriaPage() {
  const router = useRouter();
  const { isAdmin, isLoading: authLoading } = useAuth();

  // Estados de filtros
  const [page, setPage] = useState(0);
  const [tableFilter, setTableFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Protección: Solo admins pueden acceder
  if (!authLoading && !isAdmin) {
    router.replace('/admin/dashboard');
    return null;
  }

  // Fetch audit logs con filtros
  const { data: logs, isLoading: logsLoading } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs', page, tableFilter, actionFilter, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_audit_logs_paginated', {
        p_limit: ITEMS_PER_PAGE,
        p_offset: page * ITEMS_PER_PAGE,
        p_table_name: tableFilter || null,
        p_action: actionFilter || null,
        p_from_date: dateFrom ? new Date(dateFrom).toISOString() : null,
        p_to_date: dateTo ? new Date(dateTo).toISOString() : null,
      });

      if (error) {
        console.error('[AuditoriaPage] Error al obtener logs:', error);
        throw new Error(`Error al obtener logs: ${error.message}`);
      }

      return data || [];
    },
    staleTime: 30000, // 30 segundos (logs cambian poco)
  });

  // Loading states
  if (authLoading || logsLoading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Cargando registros de auditoría...</p>
        </div>
      </div>
    );
  }

  const totalCount = logs && logs.length > 0 ? logs[0].total_count : 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Toggle expansión de fila
  const toggleRow = (logId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  // Renderizar diff de valores
  const renderValuesDiff = (log: AuditLog) => {
    if (log.action === 'INSERT') {
      return (
        <div className="bg-surface-dark p-4 rounded border border-border-dark">
          <p className="text-sm font-semibold text-primary mb-2">Valores creados:</p>
          <pre className="text-xs text-text-secondary overflow-x-auto">
            {JSON.stringify(log.new_values, null, 2)}
          </pre>
        </div>
      );
    }

    if (log.action === 'DELETE') {
      return (
        <div className="bg-surface-dark p-4 rounded border border-border-dark">
          <p className="text-sm font-semibold text-danger mb-2">Valores eliminados:</p>
          <pre className="text-xs text-text-secondary overflow-x-auto">
            {JSON.stringify(log.old_values, null, 2)}
          </pre>
        </div>
      );
    }

    if (log.action === 'UPDATE') {
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface-dark p-4 rounded border border-border-dark">
            <p className="text-sm font-semibold text-danger-light mb-2">Antes:</p>
            <pre className="text-xs text-text-secondary overflow-x-auto">
              {JSON.stringify(log.old_values, null, 2)}
            </pre>
          </div>
          <div className="bg-surface-dark p-4 rounded border border-border-dark">
            <p className="text-sm font-semibold text-primary-light mb-2">Después:</p>
            <pre className="text-xs text-text-secondary overflow-x-auto">
              {JSON.stringify(log.new_values, null, 2)}
            </pre>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <Head>
        <title>Registro de Auditoría - El Arca</title>
        <meta name="description" content="Registro completo de cambios en el sistema" />
      </Head>

      <div className="min-h-screen bg-background-dark">
        {/* Header */}
        <header className="bg-surface-dark border-b border-border-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-text-primary">
                  📋 Registro de Auditoría
                </h1>
                <p className="text-text-secondary text-sm mt-1">
                  Historial completo de cambios en el sistema
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Filtro por Tabla */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Tabla
                </label>
                <select
                  value={tableFilter}
                  onChange={(e) => {
                    setTableFilter(e.target.value);
                    setPage(0); // Reset a página 1
                  }}
                  className="w-full px-3 py-2 bg-background-dark text-text-primary border border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Todas las tablas</option>
                  <option value="arca_debts">Deudas</option>
                  <option value="arca_chapters">Capítulos</option>
                  <option value="arca_user_profiles">Perfiles</option>
                  <option value="arca_system_config">Configuración</option>
                </select>
              </div>

              {/* Filtro por Acción */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Acción
                </label>
                <select
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setPage(0);
                  }}
                  className="w-full px-3 py-2 bg-background-dark text-text-primary border border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Todas las acciones</option>
                  <option value="INSERT">Creación</option>
                  <option value="UPDATE">Actualización</option>
                  <option value="DELETE">Eliminación</option>
                </select>
              </div>

              {/* Filtro por Fecha Desde */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Desde
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(0);
                  }}
                  className="w-full px-3 py-2 bg-background-dark text-text-primary border border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Filtro por Fecha Hasta */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Hasta
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(0);
                  }}
                  className="w-full px-3 py-2 bg-background-dark text-text-primary border border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Reset Filters */}
            {(tableFilter || actionFilter || dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setTableFilter('');
                  setActionFilter('');
                  setDateFrom('');
                  setDateTo('');
                  setPage(0);
                }}
                className="mt-4 text-sm text-primary hover:text-primary-light"
              >
                ✕ Limpiar filtros
              </button>
            )}
          </div>

          {/* Tabla de Logs */}
          <div className="bg-surface-dark border border-border-dark rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-dark">
                <thead className="bg-background-dark">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Fecha/Hora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Usuario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Tabla
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Acción
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Registro ID
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Detalles
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-dark">
                  {logs && logs.length > 0 ? (
                    logs.map((log) => (
                      <>
                        <tr
                          key={log.id}
                          className="hover:bg-background-dark transition cursor-pointer"
                          onClick={() => toggleRow(log.id)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                            {new Date(log.timestamp).toLocaleString('es-MX')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="text-text-primary">{log.user_name}</div>
                            <div className="text-text-secondary text-xs">{log.user_email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary font-mono">
                            {log.table_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded ${
                                ACTION_COLORS[log.action] || 'bg-gray-500/20 text-gray-400'
                              }`}
                            >
                              {ACTION_LABELS[log.action] || log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary font-mono">
                            {log.record_id.substring(0, 8)}...
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <button className="text-primary hover:text-primary-light">
                              {expandedRows.has(log.id) ? '▲ Ocultar' : '▼ Ver cambios'}
                            </button>
                          </td>
                        </tr>
                        {expandedRows.has(log.id) && (
                          <tr>
                            <td colSpan={6} className="px-6 py-4 bg-background-dark">
                              {renderValuesDiff(log)}
                            </td>
                          </tr>
                        )}
                      </>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <p className="text-text-secondary text-lg">
                          No se encontraron registros de auditoría
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

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="bg-background-dark px-6 py-4 flex items-center justify-between border-t border-border-dark">
                <div className="text-sm text-text-secondary">
                  Mostrando {page * ITEMS_PER_PAGE + 1} -{' '}
                  {Math.min((page + 1) * ITEMS_PER_PAGE, totalCount)} de {totalCount} registros
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-4 py-2 bg-surface-dark border border-border-dark text-text-primary rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    ← Anterior
                  </button>
                  <span className="px-4 py-2 text-text-secondary">
                    Página {page + 1} de {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-4 py-2 bg-surface-dark border border-border-dark text-text-primary rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
