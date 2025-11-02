import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getErrorMessage } from '@/lib/utils';
import type { ChapterWithPresidentEmail, Regional } from '@/types/database.types';

/**
 * Modal de Crear/Editar Capítulo
 *
 * Permite al administrador:
 * - Crear un nuevo capítulo con su presidente
 * - Editar datos de un capítulo existente
 *
 * FLUJO DE CREACIÓN:
 * 1. Admin llena formulario (nombre, regional, miembros, email, password)
 * 2. Se validan datos client-side
 * 3. Se llama a API /api/auth/create-president para crear usuario en Auth
 * 4. Se crea capítulo en arca_chapters con president_id del usuario creado
 * 5. Modal se cierra y lista se refresca
 *
 * FLUJO DE EDICIÓN:
 * 1. Admin modifica datos del capítulo (nombre, regional, miembros)
 * 2. Se actualiza en arca_chapters
 * 3. Email de presidente NO se puede cambiar (feature futura)
 *
 * @example
 * <ChapterModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   mode="create"
 * />
 */

interface ChapterModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  chapter?: ChapterWithPresidentEmail; // Solo para mode='edit'
}

interface FormData {
  name: string;
  regional: Regional | '';
  memberCount: number;
  presidentName: string;
  presidentEmail: string;
  tempPassword: string;
}

interface FormErrors {
  name?: string;
  regional?: string;
  memberCount?: string;
  presidentName?: string;
  presidentEmail?: string;
  tempPassword?: string;
}

const REGIONALS: Regional[] = ['Centro', 'Norte', 'Sur', 'Este', 'Occidente', 'Bajío'];

export function ChapterModal({ isOpen, onClose, mode, chapter }: ChapterModalProps) {
  const queryClient = useQueryClient();

  // Estado del formulario
  const [formData, setFormData] = useState<FormData>({
    name: '',
    regional: '',
    memberCount: 1,
    presidentName: '',
    presidentEmail: '',
    tempPassword: '',
  });

  // Estado de validación
  const [errors, setErrors] = useState<FormErrors>({});

  // Cargar datos del capítulo si mode='edit'
  useEffect(() => {
    if (mode === 'edit' && chapter) {
      setFormData({
        name: chapter.name,
        regional: chapter.regional,
        memberCount: chapter.member_count,
        presidentName: chapter.president?.full_name || '',
        presidentEmail: chapter.presidentEmail || '',
        tempPassword: '', // No se puede editar password
      });
    } else {
      // Resetear formulario si mode='create'
      setFormData({
        name: '',
        regional: '',
        memberCount: 1,
        presidentName: '',
        presidentEmail: '',
        tempPassword: '',
      });
    }
    setErrors({});
  }, [mode, chapter]);

  // Mutation para crear capítulo
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // 1. Crear usuario presidente en Auth
      const authRes = await fetch('/api/auth/create-president', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.presidentEmail,
          password: data.tempPassword,
          fullName: data.presidentName,
        }),
      });

      if (!authRes.ok) {
        const error = await authRes.json();
        throw new Error(error.details || error.error || 'Error al crear usuario');
      }

      const { userId } = await authRes.json();

      // 2. Crear capítulo con president_id
      const { data: newChapter, error: chapterError } = await supabase
        .from('arca_chapters')
        .insert({
          name: data.name,
          regional: data.regional as Regional,
          member_count: data.memberCount,
          president_id: userId,
          is_active: true,
        })
        .select()
        .single();

      if (chapterError) throw chapterError;
      return newChapter;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
      onClose();
    },
  });

  // Mutation para editar capítulo
  const editMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!chapter) throw new Error('No chapter selected');

      const { data: updatedChapter, error } = await supabase
        .from('arca_chapters')
        .update({
          name: data.name,
          regional: data.regional as Regional,
          member_count: data.memberCount,
        })
        .eq('id', chapter.id)
        .select()
        .single();

      if (error) throw error;
      return updatedChapter;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
      onClose();
    },
  });

  // Validar formulario
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    // Nombre
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre del capítulo es requerido';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'El nombre debe tener al menos 3 caracteres';
    }

    // Regional
    if (!formData.regional) {
      newErrors.regional = 'Debes seleccionar una regional';
    }

    // Miembros
    if (formData.memberCount < 1) {
      newErrors.memberCount = 'Debe haber al menos 1 miembro';
    } else if (formData.memberCount > 1000) {
      newErrors.memberCount = 'Número de miembros excesivo (máx: 1000)';
    }

    // Validaciones solo para CREATE
    if (mode === 'create') {
      // Nombre del presidente
      if (!formData.presidentName.trim()) {
        newErrors.presidentName = 'El nombre del presidente es requerido';
      } else if (formData.presidentName.trim().length < 3) {
        newErrors.presidentName = 'El nombre debe tener al menos 3 caracteres';
      }

      // Email del presidente
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!formData.presidentEmail.trim()) {
        newErrors.presidentEmail = 'El email es requerido';
      } else if (!emailRegex.test(formData.presidentEmail)) {
        newErrors.presidentEmail = 'Formato de email inválido';
      }

      // Contraseña temporal
      if (!formData.tempPassword) {
        newErrors.tempPassword = 'La contraseña temporal es requerida';
      } else if (formData.tempPassword.length < 8) {
        newErrors.tempPassword = 'La contraseña debe tener al menos 8 caracteres';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handler de submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(formData);
      } else {
        await editMutation.mutateAsync(formData);
      }
    } catch (error) {
      console.error('Error submitting chapter:', error);
    }
  };

  const isLoading = createMutation.isLoading || editMutation.isLoading;
  const submitError = createMutation.error || editMutation.error;
  const errorMessage = getErrorMessage(submitError);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-primary">
            {mode === 'create' ? 'Crear Capítulo' : 'Editar Capítulo'}
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-text-muted hover:text-text-primary"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nombre del Capítulo */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Nombre del Capítulo *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={isLoading}
              placeholder="Ej: Capítulo Guadalajara"
              className={`input w-full ${errors.name ? 'border-danger' : ''}`}
            />
            {errors.name && <p className="text-danger text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Regional */}
          <div>
            <label htmlFor="regional" className="block text-sm font-medium mb-2">
              Regional *
            </label>
            <select
              id="regional"
              value={formData.regional}
              onChange={(e) => setFormData({ ...formData, regional: e.target.value as Regional })}
              disabled={isLoading}
              className={`input w-full ${errors.regional ? 'border-danger' : ''}`}
            >
              <option value="">Selecciona una regional</option>
              {REGIONALS.map((regional) => (
                <option key={regional} value={regional}>
                  {regional}
                </option>
              )) as React.ReactNode}
            </select>
            {errors.regional && <p className="text-danger text-sm mt-1">{errors.regional}</p>}
          </div>

          <div>
            <label htmlFor="memberCount" className="block text-sm font-medium mb-2">
              Numero de Miembros *
            </label>
            <input
              id="memberCount"
              type="number"
              min="1"
              max="1000"
              value={formData.memberCount}
              onChange={(e) => setFormData({ ...formData, memberCount: parseInt(e.target.value) || 1 })}
              disabled={isLoading}
              className={`input w-full ${errors.memberCount ? 'border-danger' : ''}`}
            />
            {errors.memberCount && <p className="text-danger text-sm mt-1">{errors.memberCount}</p>}
            <p className="text-xs text-text-muted mt-1">
              El numero de miembros se usa para calcular la distribucion proporcional de deudas
            </p>
          </div>

          {/* Divider */}
          {mode === 'create' && (
            <div className="border-t border-border-dark pt-6">
              <h3 className="text-lg font-medium text-text-primary mb-4">
                Datos del Presidente
              </h3>

              {/* Nombre del Presidente */}
              <div className="mb-4">
                <label htmlFor="presidentName" className="block text-sm font-medium mb-2">
                  Nombre Completo del Presidente *
                </label>
                <input
                  id="presidentName"
                  type="text"
                  value={formData.presidentName}
                  onChange={(e) => setFormData({ ...formData, presidentName: e.target.value })}
                  disabled={isLoading}
                  placeholder="Ej: Juan Pérez García"
                  className={`input w-full ${errors.presidentName ? 'border-danger' : ''}`}
                />
                {errors.presidentName && (
                  <p className="text-danger text-sm mt-1">{errors.presidentName}</p>
                )}
              </div>

              {/* Email del Presidente */}
              <div className="mb-4">
                <label htmlFor="presidentEmail" className="block text-sm font-medium mb-2">
                  Email del Presidente *
                </label>
                <input
                  id="presidentEmail"
                  type="email"
                  value={formData.presidentEmail}
                  onChange={(e) => setFormData({ ...formData, presidentEmail: e.target.value })}
                  disabled={isLoading}
                  placeholder="presidente@correo.com"
                  className={`input w-full ${errors.presidentEmail ? 'border-danger' : ''}`}
                />
                {errors.presidentEmail && (
                  <p className="text-danger text-sm mt-1">{errors.presidentEmail}</p>
                )}
                <p className="text-xs text-text-muted mt-1">
                  El presidente usará este email para iniciar sesión
                </p>
              </div>

              {/* Contraseña Temporal */}
              <div>
                <label htmlFor="tempPassword" className="block text-sm font-medium mb-2">
                  Contraseña Temporal *
                </label>
                <input
                  id="tempPassword"
                  type="password"
                  value={formData.tempPassword}
                  onChange={(e) => setFormData({ ...formData, tempPassword: e.target.value })}
                  disabled={isLoading}
                  placeholder="Mínimo 8 caracteres"
                  className={`input w-full ${errors.tempPassword ? 'border-danger' : ''}`}
                />
                {errors.tempPassword && (
                  <p className="text-danger text-sm mt-1">{errors.tempPassword}</p>
                )}
                <p className="text-xs text-text-muted mt-1">
                  Esta contraseña será enviada al presidente para su primer login
                </p>
              </div>
            </div>
          )}

          {/* Error de submit */}
          {errorMessage && (
            <div className="p-4 bg-danger/10 border border-danger rounded-md">
              <p className="text-danger text-sm">
                <strong>Error:</strong> {errorMessage}
              </p>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-4 justify-end pt-4 border-t border-border-dark">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {mode === 'create' ? 'Creando...' : 'Guardando...'}
                </span>
              ) : (
                mode === 'create' ? 'Crear Capítulo' : 'Guardar Cambios'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
