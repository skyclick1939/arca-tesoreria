/**
 * Página de Prueba de Sentry
 *
 * ADVERTENCIA: Esta página es solo para testing en desarrollo.
 * DEBE SER ELIMINADA antes de deploy a producción.
 *
 * Permite probar que Sentry esté capturando errores correctamente.
 * Acceder desde: http://localhost:3000/sentry-test
 */

import { useState } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function SentryTestPage() {
  const [errorLog, setErrorLog] = useState<string[]>([]);

  const logError = (message: string) => {
    setErrorLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // Test 1: Error de JavaScript simple
  const triggerJavaScriptError = () => {
    logError('Triggering JavaScript Error...');
    throw new Error('🧪 Test: Error de JavaScript intencional');
  };

  // Test 2: Error asíncrono (simulando fetch fallido)
  const triggerAsyncError = async () => {
    logError('Triggering Async Error...');
    try {
      await Promise.reject(new Error('🧪 Test: Error asíncrono (fetch simulado)'));
    } catch (error) {
      Sentry.captureException(error);
      logError('Async error captured and sent to Sentry');
    }
  };

  // Test 3: Error con contexto adicional
  const triggerErrorWithContext = () => {
    logError('Triggering Error with Context...');
    Sentry.captureException(new Error('🧪 Test: Error con contexto adicional'), {
      tags: {
        test_type: 'context_test',
        page: 'sentry-test',
      },
      extra: {
        userAction: 'test_button_click',
        timestamp: new Date().toISOString(),
      },
      level: 'warning',
    });
    logError('Error with context sent to Sentry');
  };

  // Test 4: Mensaje personalizado (no error)
  const triggerCustomMessage = () => {
    logError('Sending Custom Message...');
    Sentry.captureMessage('🧪 Test: Mensaje informativo desde sentry-test', 'info');
    logError('Custom message sent to Sentry');
  };

  // Test 5: Error que renderiza el ErrorBoundary
  const [shouldCrash, setShouldCrash] = useState(false);

  if (shouldCrash) {
    throw new Error('🧪 Test: Error que activa ErrorBoundary');
  }

  return (
    <div className="min-h-screen bg-background-dark p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="card mb-6">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            🧪 Página de Prueba de Sentry
          </h1>
          <p className="text-text-secondary">
            Usa los botones abajo para probar diferentes tipos de errores y verificar que
            Sentry los capture correctamente.
          </p>
          <div className="mt-4 p-3 bg-danger bg-opacity-10 border border-danger rounded">
            <p className="text-danger text-sm">
              ⚠️ <strong>IMPORTANTE:</strong> Esta página es solo para desarrollo. Elimínala
              antes de hacer deploy a producción.
            </p>
          </div>
        </div>

        {/* Test Buttons */}
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-text-primary mb-4">Tests Disponibles</h2>

          <div className="space-y-3">
            {/* Test 1 */}
            <div className="flex items-start gap-3">
              <button
                onClick={triggerJavaScriptError}
                className="btn-danger flex-shrink-0"
              >
                Test 1: JavaScript Error
              </button>
              <p className="text-sm text-text-secondary pt-2">
                Lanza un error de JavaScript simple. Debería activar el ErrorBoundary.
              </p>
            </div>

            {/* Test 2 */}
            <div className="flex items-start gap-3">
              <button
                onClick={triggerAsyncError}
                className="btn-secondary flex-shrink-0"
              >
                Test 2: Async Error
              </button>
              <p className="text-sm text-text-secondary pt-2">
                Simula un error asíncrono (como un fetch fallido). Se captura y envía a
                Sentry sin romper la UI.
              </p>
            </div>

            {/* Test 3 */}
            <div className="flex items-start gap-3">
              <button
                onClick={triggerErrorWithContext}
                className="btn-secondary flex-shrink-0"
              >
                Test 3: Error + Context
              </button>
              <p className="text-sm text-text-secondary pt-2">
                Envía un error con tags y metadata adicional. Útil para debugging con
                contexto.
              </p>
            </div>

            {/* Test 4 */}
            <div className="flex items-start gap-3">
              <button
                onClick={triggerCustomMessage}
                className="btn-primary flex-shrink-0"
              >
                Test 4: Custom Message
              </button>
              <p className="text-sm text-text-secondary pt-2">
                Envía un mensaje informativo (no error). Útil para logs importantes.
              </p>
            </div>

            {/* Test 5 */}
            <div className="flex items-start gap-3">
              <button
                onClick={() => setShouldCrash(true)}
                className="btn-danger flex-shrink-0"
              >
                Test 5: Crash App
              </button>
              <p className="text-sm text-text-secondary pt-2">
                Rompe el componente para activar ErrorBoundary. Puedes volver usando el
                botón "Intentar de nuevo".
              </p>
            </div>
          </div>
        </div>

        {/* Error Log */}
        {errorLog.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-text-primary">Log de Actividad</h2>
              <button
                onClick={() => setErrorLog([])}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Limpiar
              </button>
            </div>
            <div className="bg-surface-dark rounded p-4 font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
              {errorLog.map((log, i) => (
                <div key={i} className="text-primary-light">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="card mt-6">
          <h2 className="text-xl font-bold text-text-primary mb-3">
            Cómo verificar en Sentry
          </h2>
          <ol className="text-text-secondary space-y-2 list-decimal list-inside">
            <li>
              Ve a tu dashboard de Sentry:{' '}
              <a
                href="https://sentry.io/organizations/personal-projects/issues/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-light hover:underline"
              >
                https://sentry.io
              </a>
            </li>
            <li>Selecciona el proyecto "el-arca"</li>
            <li>
              Ve a la sección "Issues" (problemas) - deberías ver los errores generados aquí
            </li>
            <li>
              Haz clic en cualquier error para ver detalles: stack trace, contexto, tags, etc.
            </li>
            <li>
              Si ves los errores con el emoji 🧪, significa que Sentry está funcionando
              correctamente
            </li>
          </ol>
        </div>

        {/* Back Button */}
        <div className="mt-6 text-center">
          <a href="/" className="btn-secondary inline-block">
            ← Volver al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
