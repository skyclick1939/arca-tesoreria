/**
 * ErrorBoundary - Componente para capturar errores de React
 *
 * Captura errores de JavaScript en el árbol de componentes,
 * los reporta a Sentry y muestra una UI de fallback amigable.
 *
 * Uso:
 * <ErrorBoundary>
 *   <TuComponente />
 * </ErrorBoundary>
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';

interface Props {
  children: ReactNode;
  fallback?: ReactNode; // UI personalizada de fallback (opcional)
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Actualiza el estado para que el siguiente render muestre la UI de fallback
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Reporta el error a Sentry
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });

    console.error('Error capturado por ErrorBoundary:', error, errorInfo);
  }

  handleReset = (): void => {
    // Resetea el estado del error para intentar renderizar de nuevo
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Renderiza UI de fallback personalizada o por defecto
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // UI de fallback por defecto
      return (
        <div className="min-h-screen bg-background-dark flex items-center justify-center p-4">
          <div className="card max-w-md w-full text-center">
            <div className="mb-6">
              <svg
                className="mx-auto h-16 w-16 text-danger"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-text-primary mb-4">
              Algo salió mal
            </h1>

            <p className="text-text-secondary mb-6">
              Lo sentimos, ocurrió un error inesperado. El equipo técnico ha sido notificado
              automáticamente.
            </p>

            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-text-secondary hover:text-text-primary mb-2">
                  Detalles técnicos
                </summary>
                <pre className="text-xs bg-surface-dark p-3 rounded overflow-x-auto text-danger-light">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="btn-secondary"
              >
                Intentar de nuevo
              </button>

              <button
                onClick={() => (window.location.href = '/')}
                className="btn-primary"
              >
                Volver al inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
