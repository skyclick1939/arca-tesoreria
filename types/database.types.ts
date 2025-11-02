/**
 * Tipos de la base de datos El Arca
 * Generados a partir del schema de Supabase
 */

// ============================================
// ENUMS
// ============================================

export type UserRole = 'admin' | 'president';

export type DebtType = 'apoyo' | 'aportacion' | 'multa';

export type DebtStatus = 'pending' | 'overdue' | 'in_review' | 'approved';

export type Regional = 'Centro' | 'Norte' | 'Sur' | 'Este' | 'Occidente' | 'Bajío';

// ============================================
// TABLAS
// ============================================

export interface UserProfile {
  user_id: string;
  role: UserRole;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  name: string;
  regional: Regional;
  president_id: string | null;
  member_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Debt {
  id: string;
  chapter_id: string;
  amount: number;
  due_date: string;
  debt_type: DebtType;
  status: DebtStatus;
  description: string | null;

  // Campos bancarios
  bank_name: string;
  bank_clabe: string | null;
  bank_account: string | null;
  bank_holder: string;

  // Comprobante de pago
  proof_file_url: string | null;
  proof_uploaded_at: string | null;

  // Auditoría
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  user_id: string | null;
  created_at: string;
}

// ============================================
// VISTAS EXTENDIDAS (con JOINs)
// ============================================

export interface DebtWithChapter extends Debt {
  chapter: Chapter;
}

export interface ChapterWithPresident extends Chapter {
  president: UserProfile | null;
}

/**
 * Chapter con información del presidente para listados
 * Incluye email del usuario Auth para mostrar en tablas
 */
export interface ChapterWithPresidentEmail extends Chapter {
  president: {
    user_id: string;
    full_name: string;
  } | null;
  presidentEmail?: string; // Calculado en el frontend desde auth.users si es necesario
}

// ============================================
// FUNCIONES RPC
// ============================================

export interface CreateDebtsBatchParams {
  p_total_amount: number;
  p_due_date: string;
  p_debt_type: DebtType;
  p_description: string;
  p_bank_name: string;
  p_bank_clabe: string | null;
  p_bank_account: string | null;
  p_bank_holder: string;
}

export interface CreateDebtsBatchResult {
  debt_id: string;
  chapter_id: string;
  amount: number;
}

export interface DashboardStatsByRequest {
  request_name: string;
  total_amount: number;
  collected_amount: number;
  pending_amount: number;
  completion_percentage: number;
}

export interface DashboardStatsByChapter {
  chapter_name: string;
  regional: Regional;
  total_assigned: number;
  total_paid: number;
  total_pending: number;
  total_overdue: number;
}

export interface GlobalBalance {
  total_debts: number;
  total_collected: number;
  total_pending: number;
  total_overdue: number;
  completion_percentage: number;
}
