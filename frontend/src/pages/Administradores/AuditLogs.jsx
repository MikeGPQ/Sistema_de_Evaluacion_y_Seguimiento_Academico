import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Download, Calendar, 
  Database, UserCheck, UserX, FileJson, ChevronLeft, ChevronRight 
} from 'lucide-react';
import client from '../../lib/axios';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [kpis, setKpis] = useState({ activos: 0, inactivos: 0 });
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);

  const [filtros, setFiltros] = useState({
    usuario_id: '',
    modulo: '',
    fecha_desde: '',
    fecha_hasta: ''
  });

  const [paginacion, setPaginacion] = useState({ skip: 0, limit: 15 });

  const modulosDisponibles = [
    { id: 'students', label: 'Alumnos' },
    { id: 'administrators', label: 'Administradores' },
    { id: 'users', label: 'Usuarios / Autenticación' },
    { id: 'student_enrollments', label: 'Carga Académica' },
    { id: 'attendance_records', label: 'Asistencia' }
  ];

  const fetchLogs = async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams({
        skip: paginacion.skip,
        limit: paginacion.limit,
        ...(filtros.usuario_id && { usuario_id: filtros.usuario_id }),
        ...(filtros.modulo && { modulo: filtros.modulo }),
        ...(filtros.fecha_desde && { fecha_desde: filtros.fecha_desde }),
        ...(filtros.fecha_hasta && { fecha_hasta: filtros.fecha_hasta }),
      });

      const response = await client.get(`/logs/listado?${params.toString()}`);
      setLogs(response.data.data || []);
      setTotal(response.data.total || 0);
      setKpis({
        activos: response.data.kpis?.activos || 0,
        inactivos: response.data.kpis?.inactivos || 0
      });
    } catch (error) {
      console.error("Error al obtener logs:", error);
    } finally {
      setCargando(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({ ...prev, [name]: value }));
    setPaginacion(prev => ({ ...prev, skip: 0 })); 
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchLogs();
    }, 400); 
    
    return () => clearTimeout(timeoutId);
  }, [paginacion.skip, paginacion.limit, filtros]);

  const limpiarFiltros = () => {
    setFiltros({ usuario_id: '', modulo: '', fecha_desde: '', fecha_hasta: '' });
    setPaginacion(prev => ({ ...prev, skip: 0 }));
  };

const verDetalleJson = (oldValues, newValues) => {
    let htmlContent = '';
    const safeOld = typeof oldValues === 'object' && oldValues !== null ? oldValues : {};
    const safeNew = typeof newValues === 'object' && newValues !== null ? newValues : {};

    const allKeys = Array.from(new Set([...Object.keys(safeOld), ...Object.keys(safeNew)]));
    
    const changes = [];

    allKeys.forEach(key => {
      const oldVal = safeOld[key];
      const newVal = safeNew[key];

      const formatVal = (v) => {
        if (v === null || v === undefined) return '<span style="color: #9ca3af; font-style: italic;">(vacío)</span>';
        if (typeof v === 'boolean') return v ? 'Sí' : 'No';
        if (Array.isArray(v)) return `[${v.join(', ')}]`;
        if (typeof v === 'object') return JSON.stringify(v);
        return v;
      };

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        if (oldVal === undefined) {
          changes.push(`<li>Campo <b>${key}</b> fue agregado con valor: <span style="color: #22c55e;">${formatVal(newVal)}</span></li>`);
        } else if (newVal === undefined) {
           changes.push(`<li>Campo <b>${key}</b> fue eliminado. Valor anterior: <span style="color: #ef4444;">${formatVal(oldVal)}</span></li>`);
        } else {
           changes.push(`<li><b>${key}:</b> cambió de <span style="color: #ef4444; text-decoration: line-through;">${formatVal(oldVal)}</span> a <span style="color: #22c55e; font-weight: bold;">${formatVal(newVal)}</span></li>`);
        }
      }
    });

    if (changes.length > 0) {
      htmlContent = `<ul style="text-align: left; font-size: 14px; line-height: 1.6; padding-left: 20px;">${changes.join('')}</ul>`;
    } else if (Object.keys(safeOld).length === 0 && Object.keys(safeNew).length > 0) {
       htmlContent = `<p style="text-align: left; font-size: 14px;">Se creó el registro con los siguientes datos:</p>
                      <ul style="text-align: left; font-size: 14px; line-height: 1.6; padding-left: 20px;">
                        ${Object.entries(safeNew).map(([k, v]) => `<li><b>${k}:</b> ${formatVal(v)}</li>`).join('')}
                      </ul>`;
    } else if (Object.keys(safeOld).length > 0 && Object.keys(safeNew).length === 0) {
        htmlContent = `<p style="text-align: left; font-size: 14px;">Se eliminó el registro. Datos anteriores:</p>
                      <ul style="text-align: left; font-size: 14px; line-height: 1.6; padding-left: 20px;">
                        ${Object.entries(safeOld).map(([k, v]) => `<li><b>${k}:</b> ${formatVal(v)}</li>`).join('')}
                      </ul>`;
    } else {
      htmlContent = '<p style="text-align: center; color: #6b7280;">No se detectaron cambios en los valores.</p>';
    }
    
    Swal.fire({
      title: 'Detalle de Modificación',
      html: htmlContent,
      width: '600px',
      confirmButtonColor: '#1A237E',
      confirmButtonText: 'Cerrar'
    });
  };

const formatPdfDetails = (oldValues, newValues) => {
    const safeOld = typeof oldValues === 'object' && oldValues !== null ? oldValues : {};
    const safeNew = typeof newValues === 'object' && newValues !== null ? newValues : {};
    const allKeys = Array.from(new Set([...Object.keys(safeOld), ...Object.keys(safeNew)]));

    const formatVal = (v) => {
      if (v === null || v === undefined) return 'N/A';
      if (typeof v === 'boolean') return v ? 'Sí' : 'No';
      if (Array.isArray(v)) return `[${v.join(', ')}]`;
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    };

    if (Object.keys(safeOld).length === 0 && Object.keys(safeNew).length > 0) {
      return `NUEVO:\n${Object.entries(safeNew).map(([k, v]) => `${k}: ${formatVal(v)}`).join('\n')}`;
    }
    if (Object.keys(safeOld).length > 0 && Object.keys(safeNew).length === 0) {
      return `ELIMINADO:\n${Object.entries(safeOld).map(([k, v]) => `${k}: ${formatVal(v)}`).join('\n')}`;
    }

    const changes = [];
    allKeys.forEach(key => {
      const oldVal = safeOld[key];
      const newVal = safeNew[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        if (oldVal === undefined) changes.push(`+ ${key}: ${formatVal(newVal)}`);
        else if (newVal === undefined) changes.push(`- ${key}: ${formatVal(oldVal)}`);
        else changes.push(`~ ${key}: ${formatVal(oldVal)} -> ${formatVal(newVal)}`);
      }
    });

    return changes.length > 0 ? changes.join('\n') : 'Sin cambios';
  };

const exportarPDF = () => {
    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.width;

    // 1. Logo
    doc.setFillColor(15, 23, 42); 
    doc.roundedRect(14, 12, 14, 14, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("U", 18.5, 22.5);

    // 2. UNID
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(20);
    doc.text("UNID", 32, 19);
    
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("UNIVERSIDAD INTERAMERICANA PARA EL DESARROLLO", 32, 23.5);

    // 3. Reporte y Fechas
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("REPORTE DE AUDITORÍA", pageWidth - 14, 19, { align: "right" });
    
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Documento Oficial", pageWidth - 14, 24, { align: "right" });

    doc.setFontSize(9);
    doc.text(`DESDE: ${filtros.fecha_desde}   HASTA: ${filtros.fecha_hasta}`, pageWidth - 14, 29, { align: "right" });

    // 4. Línea separadora
    doc.setDrawColor(242, 169, 0); 
    doc.setLineWidth(1.5);
    doc.line(14, 34, pageWidth - 14, 34);

    // 5. Generación de Tabla
    const tableColumn = ["Fecha/Hora", "ID Autor", "Rol", "Acción", "Entidad", "Registro ID", "Detalles del Cambio"];
    const tableRows = logs.map(log => [
      new Date(log.created_at).toLocaleString(),
      log.user_identifier,
      log.user_role || 'SISTEMA',
      log.action,
      log.entity_name,
      log.entity_id,
      formatPdfDetails(log.old_values, log.new_values)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      styles: { 
        fontSize: 7, 
        cellPadding: 3, 
        overflow: 'linebreak',
        textColor: [55, 65, 81], 
        lineColor: [229, 231, 235], 
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [249, 250, 251], 
        textColor: [55, 65, 81],    
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255]
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 20 },
        2: { cellWidth: 22 }, 
        3: { cellWidth: 20 },
        4: { cellWidth: 32 }, 
        5: { cellWidth: 20 }, 
        6: { cellWidth: 137 } 
      }
    });

    doc.save(`Audit_Logs_${filtros.fecha_desde}_${filtros.fecha_hasta}.pdf`);
  };

  const isPdfHabilitado = filtros.fecha_desde && filtros.fecha_hasta;

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 border-b border-gray-200 pb-4">
          <h1 className="text-2xl font-bold text-[#1A237E] flex items-center gap-2">
            <ShieldAlert className="w-6 h-6" /> Auditoría del Sistema
          </h1>
          <p className="text-gray-500 text-sm mt-1">Consulta inmutable del registro de transacciones.</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Usuarios Activos en Sistema</p>
              <p className="text-3xl font-black text-[#1A237E]">{kpis.activos}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl"><UserCheck className="w-8 h-8 text-blue-600" /></div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Usuarios Inactivos / Bloqueados</p>
              <p className="text-3xl font-black text-red-600">{kpis.inactivos}</p>
            </div>
            <div className="bg-red-50 p-3 rounded-xl"><UserX className="w-8 h-8 text-red-500" /></div>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col flex-1 min-w-[150px]">
            <label className="text-[11px] font-bold text-gray-500 uppercase mb-1">ID Usuario</label>
            <input type="text" name="usuario_id" value={filtros.usuario_id} onChange={handleFilterChange} placeholder="Ej. 20240001" className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1A237E]" />
          </div>
          <div className="flex flex-col flex-1 min-w-[180px]">
            <label className="text-[11px] font-bold text-gray-500 uppercase mb-1">Módulo Afectado</label>
            <select name="modulo" value={filtros.modulo} onChange={handleFilterChange} className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1A237E] bg-white">
              <option value="">Todos los módulos</option>
              {modulosDisponibles.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col min-w-[140px]">
            <label className="text-[11px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Calendar className="w-3 h-3"/> Desde</label>
            <input type="date" name="fecha_desde" value={filtros.fecha_desde} onChange={handleFilterChange} className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1A237E]" />
          </div>
          <div className="flex flex-col min-w-[140px]">
            <label className="text-[11px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Calendar className="w-3 h-3"/> Hasta</label>
            <input type="date" name="fecha_hasta" value={filtros.fecha_hasta} onChange={handleFilterChange} className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1A237E]" />
          </div>
          
          <div className="flex gap-2">
            <button onClick={limpiarFiltros} className="px-4 py-2 bg-gray-100 text-gray-600 font-bold rounded-lg text-sm hover:bg-gray-200 transition-colors">
              Limpiar
            </button>
            <button 
              onClick={exportarPDF} 
              disabled={!isPdfHabilitado} 
              className={`px-4 py-2 font-bold rounded-lg text-sm flex items-center gap-2 transition-colors ${isPdfHabilitado ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              title={!isPdfHabilitado ? "Requiere rango de fechas activo" : "Exportar a PDF"}
            >
              <Download className="w-4 h-4" /> PDF
            </button>
          </div>
        </div>

        {/* Tabla de Resultados */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 text-[11px] uppercase font-bold border-b border-gray-200">
                <tr>
                  <th className="p-3">Fecha y Hora</th>
                  <th className="p-3">ID Autor</th>
                  <th className="p-3">Rol</th>
                  <th className="p-3">Acción</th>
                  <th className="p-3">Entidad</th>
                  <th className="p-3">ID Registro</th>
                  <th className="p-3 text-center">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cargando ? (
                  <tr><td colSpan="7" className="text-center py-10 text-gray-500 font-bold">Cargando registros...</td></tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-16">
                      <Database className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500 font-bold">No se encontraron logs con los filtros aplicados.</p>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3 font-medium text-gray-600 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="p-3 font-mono font-bold text-[#1A237E]">{log.user_identifier}</td>
                      <td className="p-3 uppercase text-[10px] font-bold text-gray-500">{log.user_role || 'SISTEMA'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider
                          ${log.action === 'UPDATE' ? 'bg-amber-100 text-amber-700' : 
                            log.action === 'CREATE' ? 'bg-green-100 text-green-700' : 
                            log.action === 'DELETE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-gray-600 text-xs">{log.entity_name}</td>
                      <td className="p-3 font-bold text-gray-700">{log.entity_id}</td>
                      <td className="p-3 text-center">
                        <button 
                          onClick={() => verDetalleJson(log.old_values, log.new_values)}
                          className="text-gray-400 hover:text-[#1A237E] transition-colors"
                          title="Ver cambios exactos"
                        >
                          <FileJson className="w-5 h-5 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Paginación */}
          {!cargando && total > 0 && (
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-500">
                Mostrando {paginacion.skip + 1} a {Math.min(paginacion.skip + paginacion.limit, total)} de {total} registros
              </span>
              <div className="flex gap-2">
                <button 
                  disabled={paginacion.skip === 0}
                  onClick={() => setPaginacion(prev => ({ ...prev, skip: prev.skip - prev.limit }))}
                  className="p-1.5 border border-gray-300 rounded bg-white text-gray-600 disabled:opacity-50 hover:bg-gray-100"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  disabled={paginacion.skip + paginacion.limit >= total}
                  onClick={() => setPaginacion(prev => ({ ...prev, skip: prev.skip + prev.limit }))}
                  className="p-1.5 border border-gray-300 rounded bg-white text-gray-600 disabled:opacity-50 hover:bg-gray-100"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;