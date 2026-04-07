import React, { useEffect, useMemo, useCallback } from 'react';
import { X, ArrowRight } from 'lucide-react';

const DIAS = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo' };

function formatCellValue(value, key) {
  if (value === null || value === undefined) return '—';
  if (key === 'dia_semana') return DIAS[Number(value)] || value;
  if (key === 'is_active') return value ? 'Sí' : 'No';
  if (key === 'correo_enviado') return value ? 'Sí' : 'No';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return String(value);
}

function CellValue({ record, col, type, cambios }) {
  const value = record[col.key];
  const fkId = col.fk ? record[col.fkKey] : null;

  if (type === 'updated' && cambios) {
    const cambio = cambios.find(c => c.campo === col.key || (col.fk && c.campo === col.fkKey));
    if (cambio) {
      return (
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <span className="text-gray-400 line-through text-xs">
            {formatCellValue(cambio.anterior, col.key)}
          </span>
          <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
          <span className="text-gray-900 font-medium text-xs">
            {formatCellValue(cambio.nuevo, col.key)}
            {col.fk && fkId != null && (
              <span className="text-gray-400 ml-0.5" style={{ fontSize: '11px' }}>({fkId})</span>
            )}
          </span>
        </span>
      );
    }
  }

  const displayValue = formatCellValue(value, col.key);
  if (col.fk && fkId != null && value != null) {
    return (
      <span>
        {displayValue}
        <span className="text-gray-400 ml-0.5" style={{ fontSize: '11px' }}>({fkId})</span>
      </span>
    );
  }
  return <span>{displayValue}</span>;
}

const DetalleEntidadModal = ({ entityKey, entityLabel, data, columns, onClose, filter, setFilter }) => {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const rows = useMemo(() => {
    const inserted = (data.inserted_details || []).map(record => ({
      type: 'inserted',
      record,
      cambios: null,
    }));
    const updated = (data.updated_details || []).map(detail => ({
      type: 'updated',
      record: detail.record || {},
      cambios: detail.cambios || [],
    }));
    return [...inserted, ...updated];
  }, [data]);

  const filteredRows = useMemo(() => {
    if (filter === 'inserted') return rows.filter(r => r.type === 'inserted');
    if (filter === 'updated') return rows.filter(r => r.type === 'updated');
    return rows;
  }, [rows, filter]);

  const insertedCount = rows.filter(r => r.type === 'inserted').length;
  const updatedCount = rows.filter(r => r.type === 'updated').length;
  const unchangedCount = data.unchanged || 0;
  const totalShown = filteredRows.length;
  const totalWithChanges = rows.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle de ${entityLabel}`}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-bold text-gray-800">{entityLabel}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === 'all'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todos ({totalWithChanges})
          </button>
          <button
            onClick={() => setFilter('inserted')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
              filter === 'inserted'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Nuevos ({insertedCount})
          </button>
          <button
            onClick={() => setFilter('updated')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
              filter === 'updated'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Actualizados ({updatedCount})
          </button>
          {unchangedCount > 0 && (
            <span className="text-xs text-gray-400 ml-2">
              {unchangedCount} registro{unchangedCount !== 1 ? 's' : ''} sin cambios no se muestra{unchangedCount !== 1 ? 'n' : ''}
            </span>
          )}
        </div>

        <div className="overflow-auto flex-1" style={{ maxHeight: '320px' }}>
          <table className="w-full text-xs">
            <thead className="sticky top-0">
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Estado</th>
                {columns.map(col => (
                  <th key={col.key} className="text-left px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-100 ${
                    row.type === 'inserted'
                      ? 'bg-green-500/[0.07]'
                      : 'bg-amber-500/[0.07]'
                  }`}
                >
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        row.type === 'inserted' ? 'bg-green-500' : 'bg-amber-500'
                      }`} />
                      <span className={`text-xs font-medium ${
                        row.type === 'inserted' ? 'text-green-700' : 'text-amber-700'
                      }`}>
                        {row.type === 'inserted' ? 'Nuevo' : 'Actualizado'}
                      </span>
                    </span>
                  </td>
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                      <CellValue
                        record={row.record}
                        col={col}
                        type={row.type}
                        cambios={row.cambios}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No hay registros para mostrar con este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-gray-200 shrink-0">
          <p className="text-xs text-gray-400">
            Mostrando {totalShown} de {totalWithChanges} registros (solo con cambios)
          </p>
        </div>
      </div>
    </div>
  );
};

export default DetalleEntidadModal;
