/**
 * Password Validation Helper
 *
 * Valida la fortaleza de contraseñas según las políticas de seguridad
 * del sistema El Arca.
 *
 * Requisitos:
 * - Mínimo 8 caracteres
 * - Al menos 1 letra mayúscula (A-Z)
 * - Al menos 1 letra minúscula (a-z)
 * - Al menos 1 carácter especial de la lista permitida
 *
 * Caracteres especiales permitidos: !@#$%^&*()-_=+[]{}|;:,.<>?/
 */

export interface PasswordStrengthCheck {
  minLength: boolean;      // 8+ caracteres
  hasUppercase: boolean;   // A-Z
  hasLowercase: boolean;   // a-z
  hasSpecial: boolean;     // !@#$%^&*()-_=+[]{}|;:,.<>?/
}

export interface PasswordValidationResult {
  valid: boolean;
  checks: PasswordStrengthCheck;
  errors: string[];
}

/**
 * Caracteres especiales permitidos
 * Nota: Todos son seguros en JSON, SQL (params preparados) y HTML
 */
export const ALLOWED_SPECIAL_CHARS = '!@#$%^&*()-_=+[]{}|;:,.<>?/';

/**
 * Valida la fortaleza de una contraseña
 *
 * @param password - Contraseña a validar
 * @returns Objeto con resultado de validación y detalles de cada check
 *
 * @example
 * const result = validatePasswordStrength('MiPass123!');
 * if (!result.valid) {
 *   console.log(result.errors); // ['La contraseña debe tener...']
 * }
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const checks: PasswordStrengthCheck = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasSpecial: new RegExp(`[${escapeRegex(ALLOWED_SPECIAL_CHARS)}]`).test(password),
  };

  const errors: string[] = [];

  if (!checks.minLength) {
    errors.push('La contraseña debe tener al menos 8 caracteres');
  }
  if (!checks.hasUppercase) {
    errors.push('La contraseña debe contener al menos una letra mayúscula (A-Z)');
  }
  if (!checks.hasLowercase) {
    errors.push('La contraseña debe contener al menos una letra minúscula (a-z)');
  }
  if (!checks.hasSpecial) {
    errors.push(
      `La contraseña debe contener al menos un carácter especial (${ALLOWED_SPECIAL_CHARS})`
    );
  }

  const valid = Object.values(checks).every((check) => check === true);

  return { valid, checks, errors };
}

/**
 * Escapa caracteres especiales para uso en regex
 * Necesario porque algunos chars como [] {} son meta-caracteres en regex
 *
 * @param str - String con caracteres a escapar
 * @returns String escapado para uso seguro en RegExp
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Valida que dos contraseñas coincidan
 * Útil para confirmación de contraseña en formularios
 *
 * @param password - Contraseña principal
 * @param confirmation - Contraseña de confirmación
 * @returns true si coinciden
 */
export function passwordsMatch(password: string, confirmation: string): boolean {
  return password === confirmation && password.length > 0;
}

/**
 * Genera mensaje de error amigable basado en los checks fallidos
 *
 * @param checks - Resultado de checks de validación
 * @returns Array de mensajes de error legibles
 */
export function getPasswordErrorMessages(checks: PasswordStrengthCheck): string[] {
  const messages: string[] = [];

  if (!checks.minLength) messages.push('Mínimo 8 caracteres');
  if (!checks.hasUppercase) messages.push('Al menos una mayúscula');
  if (!checks.hasLowercase) messages.push('Al menos una minúscula');
  if (!checks.hasSpecial) messages.push('Al menos un carácter especial');

  return messages;
}
