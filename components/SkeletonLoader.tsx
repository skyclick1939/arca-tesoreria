/**
 * SkeletonLoader - Componente de carga animado
 *
 * Proporciona varios tipos de skeletons para diferentes casos de uso:
 * - card: Tarjeta de métrica (dashboard)
 * - table-row: Fila de tabla
 * - chart: Gráfica placeholder
 * - list-item: Item de lista
 *
 * Todos con animación de pulso para mejor UX
 */

import React from 'react';

interface SkeletonLoaderProps {
  type: 'card' | 'table-row' | 'chart' | 'list-item';
  count?: number; // Cuántos skeletons renderizar (default: 1)
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ type, count = 1 }) => {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  if (type === 'card') {
    return (
      <>
        {skeletons.map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 bg-surface-dark rounded w-1/3 mb-4"></div>
            <div className="h-8 bg-surface-dark rounded w-2/3"></div>
          </div>
        ))}
      </>
    );
  }

  if (type === 'table-row') {
    return (
      <>
        {skeletons.map((i) => (
          <tr key={i} className="border-b border-border-dark animate-pulse">
            <td className="py-3 px-4">
              <div className="h-4 bg-surface-dark rounded w-3/4"></div>
            </td>
            <td className="py-3 px-4">
              <div className="h-4 bg-surface-dark rounded w-1/2"></div>
            </td>
            <td className="py-3 px-4">
              <div className="h-4 bg-surface-dark rounded w-1/3"></div>
            </td>
            <td className="py-3 px-4">
              <div className="h-4 bg-surface-dark rounded w-1/4"></div>
            </td>
          </tr>
        ))}
      </>
    );
  }

  if (type === 'chart') {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-surface-dark rounded w-1/4 mb-4"></div>
        <div className="h-64 bg-surface-dark rounded"></div>
      </div>
    );
  }

  if (type === 'list-item') {
    return (
      <>
        {skeletons.map((i) => (
          <div key={i} className="p-4 border border-border-dark rounded-lg animate-pulse">
            <div className="flex items-center justify-between mb-2">
              <div className="h-4 bg-surface-dark rounded w-1/2"></div>
              <div className="h-4 bg-surface-dark rounded w-1/4"></div>
            </div>
            <div className="h-3 bg-surface-dark rounded w-3/4"></div>
          </div>
        ))}
      </>
    );
  }

  return null;
};
