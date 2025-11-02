# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**El Arca** is a treasury management system for a motorcycle club with ~45-100 users (regional chapters). It manages debt assignments (apoyos, multas, aportaciones), payment proof uploads, and approval workflows.

**Key Context:**
- **Mobile-First**: Deployed as webview via webintoapp.com (Chrome Android / Safari iOS)
- **Scale**: 100 users max, designed to stay within Supabase free tier
- **Security Critical**: Presidents can ONLY see/modify their own chapter's data (enforced via RLS)

## Tech Stack

```
Frontend: Next.js 14 (Pages Router) + TypeScript 5
State: React Query v4 (server state) + Context API (UI state)
Styling: Tailwind CSS v3 (custom Mexican flag-inspired palette)
Backend: 100% Supabase (PostgreSQL + Auth + Storage)
Database: All business logic in PL/pgSQL functions + RLS policies
```

**Architectural Principle**: "If you can do it in Supabase, do it in Supabase"

## Common Commands

### Development
```bash
# Start development server (runs on http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint
npm run lint
```

### Database Migrations
Migrations are in `database/migrations/` and must be executed **in order** via Supabase SQL Editor:

```bash
# Migration sequence (CRITICAL - execute in this order):
001_schema_inicial.sql       # ENUMs, tables, indexes
002_rls_policies.sql         # Row Level Security policies
003_functions.sql            # Business logic functions
004_triggers.sql             # Audit triggers
005_update_regional_enum.sql # Regional enum fix
006_storage_bucket.sql       # Storage bucket for payment proofs
007_fix_rls_recursion.sql    # Critical RLS fix
008_fix_rls_policies.sql     # Auth trigger fix
009_create_missing_profiles.sql # Profile creation trigger
seed_dev_data.sql           # Dev users (admin + presidents)
```

**NEVER** skip migrations or run them out of order.

## Architecture Overview

### Backend: 100% Supabase

```
┌─────────────────────────────────────┐
│     NEXT.JS (Presentation Layer)    │
│  - Renders UI                       │
│  - Client-side validation           │
│  - Calls Supabase Client            │
└──────────────┬──────────────────────┘
               │ @supabase/supabase-js
               ↓
┌─────────────────────────────────────┐
│     SUPABASE POSTGRESQL             │
│  1. RLS Policies ← Data firewall    │
│  2. DB Functions ← Business logic   │
│  3. Triggers ← Automation           │
│  4. Tables ← Data storage           │
└─────────────────────────────────────┘
```

**Critical Functions** (in `003_functions.sql`):
- `create_debts_batch()` - Distributes debt proportionally across chapters
- `mark_overdue_debts()` - Updates status of past-due debts (called from client)
- `audit_debt_changes()` - Auto-logs all status/proof changes

### Frontend Structure

```
pages/
├── _app.tsx              # React Query + Auth providers
├── index.tsx             # Home/redirect logic
├── login.tsx             # Email/password auth
├── admin/
│   └── dashboard.tsx     # Admin multi-view dashboard
└── presidente/
    └── dashboard.tsx     # President chapter-filtered view

lib/
├── supabase.ts           # Singleton Supabase client
└── storage/
    └── storage-helpers.ts # File validation utilities

context/
├── AuthContext.tsx       # Auth state context
├── AuthProvider.tsx      # Auth state provider
└── index.ts              # Barrel export

hooks/
├── useAuth.ts            # Auth state hook
└── useUploadProof.ts     # Payment proof upload hooks
```

## Database Schema

### Key Tables (Prefix: `arca_`)

```sql
arca_user_profiles  -- Extends auth.users with role (admin/president)
  ├─ user_id (PK, FK to auth.users)
  ├─ role (user_role enum)
  └─ full_name

arca_chapters      -- Regional chapters
  ├─ id (PK)
  ├─ name (unique)
  ├─ regional (regional_enum)
  ├─ president_id (FK to arca_user_profiles)
  └─ member_count (for proportional debt calculation)

arca_debts         -- Debts assigned to chapters
  ├─ id (PK)
  ├─ chapter_id (FK)
  ├─ amount, due_date, debt_type, status
  ├─ bank_name, bank_clabe, bank_account, bank_holder
  ├─ proof_file_url, proof_uploaded_at
  └─ approved_at, created_by

arca_audit_logs    -- Automatic audit trail
```

**ENUMs:**
- `user_role`: admin, president
- `debt_type_enum`: apoyo, aportacion, multa
- `debt_status_enum`: pending, overdue, in_review, approved
- `regional_enum`: Centro, Norte, Sur, Este, Occidente, Bajío

### Critical RLS Policies

**Presidents MUST ONLY see their own chapter's data:**

```sql
-- Presidents see only their chapter's debts
CREATE POLICY "Presidents view own chapter debts"
ON arca_debts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM arca_chapters c
    WHERE c.id = arca_debts.chapter_id
      AND c.president_id = auth.uid()
  )
);
```

**When modifying RLS:** Always test with both admin and president users to ensure isolation.

## Key Workflows

### 1. Creating Debts (Admin Only)
```typescript
// Call create_debts_batch() from admin dashboard
const { data, error } = await supabase.rpc('create_debts_batch', {
  p_total_amount: 9000,
  p_due_date: '2025-11-30',
  p_debt_type: 'apoyo',
  p_description: 'Apoyo Aniversario Jalisco',
  p_bank_name: 'BBVA',
  p_bank_clabe: '012345678901234567',
  p_bank_account: null,
  p_bank_holder: 'Tesorería Moto Club'
});

// Function automatically:
// 1. Calculates cost per member: $9000 / 45 members = $200
// 2. Creates debt record for each chapter proportional to member_count
// 3. Sets initial status to 'pending'
```

### 2. Uploading Payment Proofs (President)
```typescript
// Use useUploadProof hook
const { uploadProof } = useUploadProof();

await uploadProof({
  file: selectedFile,
  chapterId: 'uuid-chapter-123',
  debtId: 'uuid-debt-456'
});

// Automatically:
// 1. Validates file (max 5MB, types: PNG/JPG/PDF)
// 2. Uploads to: arca-comprobantes/{chapter_id}/{debt_id}/{timestamp}-{filename}
// 3. Updates debt status to 'in_review'
// 4. Sets proof_uploaded_at timestamp
```

### 3. Approving Payments (Admin)
```typescript
// Update debt status to 'approved'
const { error } = await supabase
  .from('arca_debts')
  .update({
    status: 'approved',
    approved_at: new Date().toISOString()
  })
  .eq('id', debtId);

// Audit trigger automatically logs the change
```

## Styling & Design System

### Tailwind Color Palette
Inspired by Mexican flag 🇲🇽 (see `tailwind.config.js`):

```javascript
colors: {
  'primary': '#006847',        // Verde oscuro (main actions)
  'primary-light': '#4CAF50',  // Verde Material (accents)
  'danger': '#CE1126',         // Rojo México (alerts/overdue)
  'danger-light': '#F44336',   // Rojo Material
  'background-dark': '#121212',// Dark mode background
  'surface-dark': '#1E1E1E',   // Cards/elevated surfaces
  'text-primary': '#FFFFFF',
  'text-secondary': '#A0A0A0',
  'border-dark': '#333333'
}
```

**Design Principle**: Dark mode only, mobile-first responsive design.

## Critical Constraints & Rules

### 1. Security
- **NEVER** bypass RLS policies or use service role key in client code
- **ALWAYS** test new features with both admin and president test users
- **File uploads** must validate size (max 5MB) and type (PNG/JPG/PDF) on client AND server

### 2. Database
- **NEVER** add business logic in Next.js API routes - use PL/pgSQL functions
- **ALWAYS** use transactions for multi-table operations (functions use implicit transactions)
- **Bank validation**: At least one of `bank_clabe` OR `bank_account` must be provided

### 3. State Management
- **Server state**: React Query (use `staleTime: 60000` for financial data freshness)
- **UI state**: Context API only (no Zustand/Redux)
- **Auth state**: Context wrapper in `_app.tsx`

### 4. File Storage
```
Path structure: arca-comprobantes/{chapter_id}/{debt_id}/{timestamp}-{filename}.ext
Access: Private bucket, RLS policies enforce chapter isolation
Helpers: Use functions in lib/storage/storage-helpers.ts
```

## Testing Credentials

**Admin:**
- Email: `admin@arca.local`
- Password: `admin123`

**President (Vallarta chapter):**
- Email: `pres.vallarta@arca.local`
- Password: `pres1234`

*(See `seed_dev_data.sql` for full list)*

## Common Issues & Solutions

### 1. RLS Error 500 on Login
**Symptom**: User can authenticate but gets 500 error when loading dashboard
**Cause**: Missing profile in `arca_user_profiles` or RLS policy recursion
**Fix**: Verify trigger in `009_create_missing_profiles.sql` is active

### 2. File Upload Returns 403
**Symptom**: Upload fails with "permission denied" error
**Cause**: RLS policies on Storage bucket or incorrect chapter_id
**Fix**: Verify bucket policies in `006_storage_bucket.sql` match user's chapter

### 3. Debt Calculation Wrong
**Symptom**: create_debts_batch() returns incorrect amounts
**Cause**: Inactive chapters included in total_members calculation
**Fix**: Function filters `WHERE is_active = true` - verify chapter status

## Performance Considerations

- **Dashboard loads**: Call `mark_overdue_debts()` on mount (runs once per session)
- **Indexes**: Pre-built for common queries (chapter_id, status, due_date)
- **File size**: Frontend must compress images >5MB before upload
- **Query limits**: Use pagination for lists >50 items

## Environment Variables

Required in `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Documentation References

- **PRD.md**: Full product requirements (user stories, acceptance criteria)
- **ARQUITECTURA_SIMPLIFICADA.md**: Architectural decisions and rationale
- **README.md**: Setup instructions and project status
- **database/migrations/README.md**: Database schema documentation

## Code Style

- **TypeScript**: Strict mode enabled, no `any` types
- **Naming**: Use descriptive names (`uploadPaymentProof` not `uploadFile`)
- **Comments**: Explain "why" not "what" (code should be self-documenting)
- **Error handling**: Use try/catch with user-friendly error messages in Spanish
