import { useState, FormEvent, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';

/**
 * Página de Login - El Arca
 *
 * Características:
 * - Formulario con validación en tiempo real
 * - Manejo de errores específicos de Supabase
 * - Loading states durante autenticación
 * - Diseño dark mode con paleta El Arca
 * - Redirección automática según rol
 * - Redirección automática si ya está autenticado (NUEVO)
 *
 * Validaciones:
 * - Email: formato válido
 * - Password: mínimo 8 caracteres
 */

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, isAuthenticated, isAdmin, isPresident } = useAuth();

  // Estado del formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Estado de validación
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Estado de autenticación
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ELIMINADO: useEffect de redirección duplicado
  // La redirección ahora se maneja SOLO en AuthProvider con window.location.assign('/')
  // Esto evita competencia y garantiza que las cookies se envíen correctamente

  // Validar email en tiempo real
  const validateEmail = (value: string): boolean => {
    if (!value) {
      setEmailError('El correo es requerido');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setEmailError('Formato de correo inválido');
      return false;
    }

    setEmailError(null);
    return true;
  };

  // Validar password en tiempo real
  const validatePassword = (value: string): boolean => {
    if (!value) {
      setPasswordError('La contraseña es requerida');
      return false;
    }

    if (value.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres');
      return false;
    }

    setPasswordError(null);
    return true;
  };

  // Manejar cambio de email
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (value) validateEmail(value);
  };

  // Manejar cambio de password
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (value) validatePassword(value);
  };

  // Manejar blur (salir del campo)
  const handleEmailBlur = () => {
    if (email) validateEmail(email);
  };

  const handlePasswordBlur = () => {
    if (password) validatePassword(password);
  };

  // Manejar submit del formulario
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Limpiar error anterior
    setAuthError(null);

    // Validar antes de enviar
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login(email, password);
      // La redirección la maneja el hook useAuth
    } catch (error: any) {
      console.error('Error de autenticación:', error);

      // Mapear errores de Supabase a mensajes amigables
      let errorMessage = 'Error desconocido. Intenta de nuevo.';

      if (error.message) {
        const msg = error.message.toLowerCase();

        if (msg.includes('invalid login credentials')) {
          errorMessage = 'Correo o contraseña incorrectos';
        } else if (msg.includes('email not confirmed')) {
          errorMessage = 'Debes confirmar tu correo antes de iniciar sesión';
        } else if (msg.includes('user not found')) {
          errorMessage = 'Usuario no encontrado';
        } else if (msg.includes('perfil de usuario no encontrado')) {
          errorMessage = 'Tu cuenta no tiene un perfil asignado. Contacta al administrador.';
        } else {
          errorMessage = error.message;
        }
      }

      setAuthError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Estado de carga global
  const isFormDisabled = isLoading || isSubmitting;

  return (
    <>
      <Head>
        <title>Iniciar Sesión - El Arca</title>
        <meta name="description" content="Sistema de tesorería para moto club" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen flex items-center justify-center p-4">
        {/* Contenedor del formulario */}
        <div className="card max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-primary mb-2">El Arca</h1>
            <p className="text-text-secondary text-sm">
              Sistema de Tesorería para Moto Club
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Campo Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Correo Electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                onBlur={handleEmailBlur}
                disabled={isFormDisabled}
                placeholder="tu@correo.com"
                className={`input w-full ${
                  emailError ? 'border-danger focus:ring-danger' : ''
                }`}
                autoComplete="email"
                autoFocus
              />
              {emailError && (
                <p className="text-danger text-sm mt-2">{emailError}</p>
              )}
            </div>

            {/* Campo Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                onBlur={handlePasswordBlur}
                disabled={isFormDisabled}
                placeholder="••••••••"
                className={`input w-full ${
                  passwordError ? 'border-danger focus:ring-danger' : ''
                }`}
                autoComplete="current-password"
              />
              {passwordError && (
                <p className="text-danger text-sm mt-2">{passwordError}</p>
              )}
            </div>

            {/* Error de autenticación */}
            {authError && (
              <div className="p-4 bg-danger/10 border border-danger rounded-md">
                <p className="text-danger text-sm">
                  <strong>Error:</strong> {authError}
                </p>
              </div>
            )}

            {/* Botón de submit */}
            <button
              type="submit"
              disabled={isFormDisabled || !!emailError || !!passwordError}
              className="btn-primary w-full"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Iniciando sesión...
                </span>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-border-dark text-center">
            <p className="text-xs text-text-muted">
              ¿Problemas para acceder? Contacta al administrador.
            </p>
          </div>

          {/* Credenciales de prueba (solo en desarrollo) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 p-4 bg-surface-dark rounded-md border border-border-dark">
              <p className="text-xs text-text-muted font-medium mb-2">
                Credenciales de prueba:
              </p>
              <div className="space-y-1 text-xs text-text-secondary">
                <p>
                  <strong>Admin:</strong> admin@arca.local / admin123
                </p>
                <p>
                  <strong>Presidente:</strong> pres.vallarta@arca.local / pres1234
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
