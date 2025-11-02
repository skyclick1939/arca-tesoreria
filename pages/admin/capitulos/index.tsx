import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useChapters } from '@/hooks/useChapters';
import { ChapterModal } from '@/components/modals/ChapterModal';
import { DeleteChapterModal } from '@/components/modals/DeleteChapterModal';
import type { ChapterWithPresidentEmail, Regional } from '@/types/database.types';

/**
 * Página de Gestión de Capítulos - Admin
 *
 * Permite al administrador:
 * - Ver lista completa de capítulos
 * - Buscar capítulos por nombre
 * - Ver estadísticas (total capítulos, total miembros)
 * - Crear nuevo capítulo (modal T1.9)
 * - Editar capítulo existente (modal T1.9)
 * - Eliminar capítulo (modal T1.10)
 *
 * Protección: Solo accesible por rol='admin' (middleware valida)
 */
export default function ChaptersPage() {
  const { profile, logout } = useAuth();
  const { data: chapters = [], isLoading, error } = useChapters();

  // Calcular estadísticas localmente (evita doble suscripción a React Query)
  const totalChapters = chapters.length;
  const totalMembers = chapters.reduce((sum, chapter) => sum + chapter.member_count, 0);

  // Estado de búsqueda
  const [searchTerm, setSearchTerm] = useState('');

  // Estado de modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<ChapterWithPresidentEmail | null>(null);

  // Filtrar capítulos por término de búsqueda
  const filteredChapters = chapters.filter(chapter =>
    chapter.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handlers de modales
  const handleCreate = () => {
    setIsCreateModalOpen(true);
  };

  const handleEdit = (chapter: ChapterWithPresidentEmail) => {
    setSelectedChapter(chapter);
    setIsEditModalOpen(true);
  };

  const handleDelete = (chapter: ChapterWithPresidentEmail) => {
    setSelectedChapter(chapter);
    setIsDeleteModalOpen(true);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <>
      <Head>
        <title>Gestión de Capítulos - El Arca</title>
        <meta name="description" content="Gestión de capítulos del moto club" />
      </Head>

      <div className="min-h-screen bg-background-dark">
        {/* Header */}
        <header className="bg-surface-dark border-b border-border-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-primary">El Arca</h1>
                <p className="text-sm text-text-secondary">Panel de Administración</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-text-primary">
                    {profile?.full_name}
                  </p>
                  <p className="text-xs text-text-muted">Administrador</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="btn-danger text-sm"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <nav className="mb-6">
            <ol className="flex items-center space-x-2 text-sm">
              <li>
                <Link href="/admin/dashboard" className="text-primary hover:text-primary-light">
                  Dashboard
                </Link>
              </li>
              <li className="text-text-muted">/</li>
              <li className="text-text-primary font-medium">Capítulos</li>
            </ol>
          </nav>

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
            <div>
              <h2 className="text-3xl font-bold text-text-primary mb-2">
                Gestión de Capítulos
              </h2>
              <p className="text-text-secondary">
                Administra los capítulos del moto club
              </p>
            </div>
            <button
              onClick={handleCreate}
              className="btn-primary"
            >
              + Crear Capítulo
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Card: Total Capítulos */}
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted mb-1">Total Capítulos</p>
                  <p className="text-3xl font-bold text-primary">
                    {isLoading ? '...' : totalChapters}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Card: Total Miembros */}
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted mb-1">Total Miembros</p>
                  <p className="text-3xl font-bold text-primary">
                    {isLoading ? '...' : totalMembers}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar capítulo por nombre..."
                className="input w-full pl-10"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Table/Content */}
          {isLoading ? (
            // Loading State
            <div className="card">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-surface-dark rounded w-3/4"></div>
                <div className="h-4 bg-surface-dark rounded w-1/2"></div>
                <div className="h-4 bg-surface-dark rounded w-5/6"></div>
              </div>
            </div>
          ) : error ? (
            // Error State
            <div className="card bg-danger/10 border-danger">
              <p className="text-danger">
                <strong>Error al cargar capítulos:</strong>{' '}
                {error instanceof Error ? error.message : 'Error desconocido'}
              </p>
              <p className="text-sm text-text-secondary mt-2">
                Por favor recarga la página o contacta al soporte técnico.
              </p>
            </div>
          ) : filteredChapters.length === 0 ? (
            // Empty State
            <div className="card text-center py-12">
              {searchTerm ? (
                <>
                  <p className="text-text-secondary mb-2">
                    No se encontraron capítulos que coincidan con "{searchTerm}"
                  </p>
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-primary hover:text-primary-light text-sm"
                  >
                    Limpiar búsqueda
                  </button>
                </>
              ) : (
                <>
                  <p className="text-text-secondary mb-4">
                    No hay capítulos creados todavía.
                  </p>
                  <button
                    onClick={handleCreate}
                    className="btn-primary"
                  >
                    + Crear Primer Capítulo
                  </button>
                </>
              )}
            </div>
          ) : (
            // Table (Desktop) / Cards (Mobile)
            <>
              {/* Desktop Table */}
              <div className="hidden md:block card overflow-hidden">
                <table className="min-w-full divide-y divide-border-dark">
                  <thead className="bg-surface-dark">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Nombre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Regional
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Miembros
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Presidente
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-dark">
                    {filteredChapters.map((chapter) => (
                      <tr key={chapter.id} className="hover:bg-surface-dark/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-text-primary">
                            {chapter.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <RegionalBadge regional={chapter.regional} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-text-secondary">
                            {chapter.member_count}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {chapter.president ? (
                            <div>
                              <div className="text-sm font-medium text-text-primary">
                                {chapter.president.full_name}
                              </div>
                              {chapter.presidentEmail && (
                                <div className="text-xs text-text-muted">
                                  {chapter.presidentEmail}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-text-muted italic">
                              Sin asignar
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleEdit(chapter)}
                            className="text-primary hover:text-primary-light mr-4"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(chapter)}
                            className="text-danger hover:text-danger-light"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {filteredChapters.map((chapter) => (
                  <div key={chapter.id} className="card">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-medium text-text-primary mb-1">
                          {chapter.name}
                        </h3>
                        <RegionalBadge regional={chapter.regional} />
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-text-muted">Miembros</p>
                        <p className="text-xl font-bold text-primary">
                          {chapter.member_count}
                        </p>
                      </div>
                    </div>

                    {chapter.president && (
                      <div className="mb-4 pb-4 border-b border-border-dark">
                        <p className="text-xs text-text-muted mb-1">Presidente</p>
                        <p className="text-sm font-medium text-text-primary">
                          {chapter.president.full_name}
                        </p>
                        {chapter.presidentEmail && (
                          <p className="text-xs text-text-muted">
                            {chapter.presidentEmail}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(chapter)}
                        className="btn-secondary flex-1"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(chapter)}
                        className="btn-danger flex-1"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Modales */}
      <ChapterModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        mode="create"
      />

      <ChapterModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        mode="edit"
        chapter={selectedChapter || undefined}
      />

      <DeleteChapterModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        chapter={selectedChapter}
      />
    </>
  );
}

/**
 * Componente de Badge para Regional
 * Muestra el nombre de la regional con un color distintivo
 */
function RegionalBadge({ regional }: { regional: Regional }) {
  const colors: Record<Regional, string> = {
    Centro: 'bg-blue-500/20 text-blue-400',
    Norte: 'bg-green-500/20 text-green-400',
    Sur: 'bg-yellow-500/20 text-yellow-400',
    Este: 'bg-purple-500/20 text-purple-400',
    Occidente: 'bg-pink-500/20 text-pink-400',
    Bajío: 'bg-orange-500/20 text-orange-400',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[regional]}`}>
      {regional}
    </span>
  );
}
