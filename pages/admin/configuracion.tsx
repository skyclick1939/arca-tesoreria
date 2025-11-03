import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import {
  useSystemConfigs,
  useUpdateSystemConfig,
  parseConfigValue,
  type SystemConfig,
} from '@/hooks/useSystemConfig';

/**
 * Página de Configuración del Sistema (Solo Admin)
 *
 * Permite a los administradores modificar configuraciones globales del sistema:
 * - General: Nombre, email, modo mantenimiento
 * - Deudas: Días de vencimiento, recordatorios
 * - Comprobantes: Tamaño máximo, tipos permitidos
 * - Notificaciones: Emails, activar/desactivar notificaciones
 */

type ConfigCategory = 'general' | 'debts' | 'uploads' | 'notifications';

const CATEGORY_LABELS: Record<ConfigCategory, string> = {
  general: 'General',
  debts: 'Deudas',
  uploads: 'Comprobantes',
  notifications: 'Notificaciones',
};

export default function ConfiguracionPage() {
  const router = useRouter();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { data: configs, isLoading: configsLoading } = useSystemConfigs();
  const updateConfig = useUpdateSystemConfig();

  const [activeTab, setActiveTab] = useState<ConfigCategory>('general');
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Protección: Solo admins pueden acceder
  if (!authLoading && !isAdmin) {
    router.replace('/admin/dashboard');
    return null;
  }

  // Loading states
  if (authLoading || configsLoading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  // Agrupar configuraciones por categoría
  const configsByCategory: Record<ConfigCategory, SystemConfig[]> = {
    general: [],
    debts: [],
    uploads: [],
    notifications: [],
  };

  configs?.forEach((config) => {
    if (config.category in configsByCategory) {
      configsByCategory[config.category as ConfigCategory].push(config);
    }
  });

  // Manejar cambio en input
  const handleInputChange = (key: string, value: any) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
    // Limpiar mensaje de éxito al editar
    if (successMessage) setSuccessMessage(null);
  };

  // Guardar configuración individual
  const handleSave = async (config: SystemConfig) => {
    const editedValue = editedValues[config.key];
    // Si no hay cambios, no hacer nada
    if (editedValue === undefined) return;

    try {
      await updateConfig.mutateAsync({
        key: config.key,
        value: editedValue,
      });

      setSuccessMessage(`✅ ${config.key} actualizado correctamente`);
      // Limpiar valor editado
      setEditedValues((prev) => {
        const newValues = { ...prev };
        delete newValues[config.key];
        return newValues;
      });

      // Auto-ocultar mensaje después de 3 segundos
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      alert(`Error al guardar: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Renderizar input según tipo de dato
  const renderInput = (config: SystemConfig) => {
    const currentValue = editedValues[config.key] ?? parseConfigValue(config.value);

    // Detectar tipo de dato
    const isBoolean = typeof currentValue === 'boolean';
    const isNumber = typeof currentValue === 'number' || !isNaN(Number(currentValue));
    const isArray = Array.isArray(currentValue);

    if (isBoolean) {
      return (
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={currentValue}
            onChange={(e) => handleInputChange(config.key, e.target.checked)}
            className="w-5 h-5 text-primary bg-surface-dark border-border-dark rounded focus:ring-2 focus:ring-primary"
          />
          <span className="text-text-secondary">
            {currentValue ? 'Activado' : 'Desactivado'}
          </span>
        </label>
      );
    }

    if (isArray) {
      return (
        <textarea
          value={JSON.stringify(currentValue, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              handleInputChange(config.key, parsed);
            } catch {
              // Ignorar si no es JSON válido
            }
          }}
          rows={4}
          className="w-full px-4 py-2 bg-surface-dark text-text-primary border border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
        />
      );
    }

    if (isNumber) {
      return (
        <input
          type="number"
          value={currentValue}
          onChange={(e) => handleInputChange(config.key, Number(e.target.value))}
          className="w-full px-4 py-2 bg-surface-dark text-text-primary border border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      );
    }

    // Default: text input
    return (
      <input
        type="text"
        value={currentValue}
        onChange={(e) => handleInputChange(config.key, e.target.value)}
        className="w-full px-4 py-2 bg-surface-dark text-text-primary border border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
      />
    );
  };

  return (
    <>
      <Head>
        <title>Configuración del Sistema - El Arca</title>
        <meta name="description" content="Gestión de configuración del sistema" />
      </Head>

      <div className="min-h-screen bg-background-dark">
        {/* Header */}
        <header className="bg-surface-dark border-b border-border-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-text-primary">
                  ⚙️ Configuración del Sistema
                </h1>
                <p className="text-text-secondary text-sm mt-1">
                  Gestiona las configuraciones globales de la aplicación
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

        {/* Success Message */}
        {successMessage && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
            <div className="bg-primary/20 border border-primary text-primary px-4 py-3 rounded-lg">
              {successMessage}
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Tabs */}
          <div className="flex space-x-2 mb-6 border-b border-border-dark">
            {(Object.keys(CATEGORY_LABELS) as ConfigCategory[]).map((category) => (
              <button
                key={category}
                onClick={() => setActiveTab(category)}
                className={`px-6 py-3 font-medium transition ${
                  activeTab === category
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {CATEGORY_LABELS[category]}
                <span className="ml-2 text-xs bg-surface-dark px-2 py-1 rounded-full">
                  {configsByCategory[category].length}
                </span>
              </button>
            ))}
          </div>

          {/* Configuration Cards */}
          <div className="space-y-4">
            {configsByCategory[activeTab].map((config) => {
              const hasChanges = editedValues[config.key] !== undefined;

              return (
                <div
                  key={config.key}
                  className="bg-surface-dark border border-border-dark rounded-lg p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-text-primary mb-1">
                        {config.key}
                      </h3>
                      <p className="text-text-secondary text-sm">
                        {config.description}
                      </p>
                    </div>
                    {hasChanges && (
                      <button
                        onClick={() => handleSave(config)}
                        disabled={updateConfig.isLoading}
                        className="ml-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-light transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {updateConfig.isLoading ? (
                          <>
                            <span className="animate-spin">⏳</span>
                            <span>Guardando...</span>
                          </>
                        ) : (
                          <>
                            <span>💾</span>
                            <span>Guardar</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Input Field */}
                  <div className="mt-4">{renderInput(config)}</div>

                  {/* Metadata */}
                  <div className="mt-4 pt-4 border-t border-border-dark flex items-center justify-between text-xs text-text-secondary">
                    <span>
                      Última actualización:{' '}
                      {new Date(config.updated_at).toLocaleString('es-MX')}
                    </span>
                    {config.updated_by && (
                      <span>Modificado por: {config.updated_by.slice(0, 8)}...</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {configsByCategory[activeTab].length === 0 && (
            <div className="text-center py-12">
              <p className="text-text-secondary text-lg">
                No hay configuraciones en esta categoría
              </p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
