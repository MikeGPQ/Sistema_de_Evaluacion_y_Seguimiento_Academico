import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Download, Calendar, 
  Database, UserCheck, UserX, FileJson, ChevronLeft, ChevronRight, Unlock 
} from 'lucide-react';
import client from '../../lib/axios';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNavigate } from 'react-router-dom';

const AuditLogs = () => {
  // 1. Estados Generales
  const navigate = useNavigate();
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

  // 2. Estados del Modal de Locked Users
  const [showLockedUsersModal, setShowLockedUsersModal] = useState(false);
  const [lockedUsers, setLockedUsers] = useState([]);
  const [searchLockedUser, setSearchLockedUser] = useState('');

  const modulosDisponibles = [
    { id: 'students', label: 'Alumnos' },
    { id: 'administrators', label: 'Administradores' },
    { id: 'users', label: 'Usuarios / Autenticación' },
    { id: 'student_enrollments', label: 'Carga Académica' },
    { id: 'attendance_records', label: 'Asistencia' }
  ];

  // 3. Funciones Principales
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
      setLockedUsers(response.data.locked_users || []); 
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

  // 4. Funciones del Modal
  const fetchLockedUsers = async () => {
    setLoadingLockedUsers(true);
    try {
      const response = await client.get('/logs/locked-users');
      setLockedUsers(response.data.data || []);
    } catch (error) {
      console.error("Error fetching locked users:", error);
    } finally {
      setLoadingLockedUsers(false);
    }
  };

  const handleOpenLockedUsers = () => {
    setShowLockedUsersModal(true);
  };

const handleUnlockUser = async (identifier) => {
    const result = await Swal.fire({
      title: 'Unlock User?',
      text: `ID: ${identifier} will regain access to the system.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#1A237E',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, unlock'
    });

    if (result.isConfirmed) {
      try {
        const userStorage = localStorage.getItem('user');
        const currentAdminId = userStorage ? JSON.parse(userStorage).identifier : 'Sistema';

        await client.put(`/logs/unlock-user/${identifier}`, {
          usuario_id: currentAdminId
        });
        
        setShowLockedUsersModal(false);
        
        await Swal.fire({
          title: 'Unlocked!',
          text: 'Redirigiendo para asignar nueva contraseña...',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });

        navigate('/change-password', { 
          state: { 
            isAdminUnlock: true, 
            targetUser: identifier 
          } 
        });

      } catch (error) {
        Swal.fire('Error', 'There was a problem unlocking the user.', 'error');
      }
    }
  };

  const filteredLockedUsers = lockedUsers.filter(user => 
    (user.identifier && user.identifier.toLowerCase().includes(searchLockedUser.toLowerCase())) || 
    (user.email && user.email.toLowerCase().includes(searchLockedUser.toLowerCase()))
  );

  const verDetalleJson = (oldValues, newValues, action) => {
    let htmlContent = '';
    const safeOld = typeof oldValues === 'object' && oldValues !== null ? oldValues : {};
    const safeNew = typeof newValues === 'object' && newValues !== null ? newValues : {};

    const formatVal = (v) => {
      if (v === null || v === undefined) return '<span style="color: #9ca3af; font-style: italic;">(vacío)</span>';
      if (typeof v === 'boolean') return v ? 'Sí' : 'No';
      if (Array.isArray(v)) return `[${v.join(', ')}]`;
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    };

    const isCreate = action === 'CREATE';
    const isDelete = action === 'DELETE';

    if (isCreate) {
      htmlContent = `
        <div style="text-align: left;">
          <span style="color: #22c55e; font-weight: bold; display: block; margin-bottom: 10px; font-size: 15px;">
            Se dio de alta un registro con los siguientes datos:
          </span>
          <ul style="padding-left: 20px; list-style-type: disc; font-size: 14px; line-height: 1.6;">
            ${Object.entries(safeNew).map(([k, v]) => `<li><b>${k}:</b> ${formatVal(v)}</li>`).join('')}
          </ul>
        </div>`;
        
    } else if (isDelete) {
      htmlContent = `
        <div style="text-align: left;">
          <span style="color: #ef4444; font-weight: bold; display: block; margin-bottom: 10px; font-size: 15px;">
            Se eliminó el registro. Datos anteriores:
          </span>
          <ul style="padding-left: 20px; list-style-type: disc; font-size: 14px; line-height: 1.6;">
            ${Object.entries(safeOld).map(([k, v]) => `<li><b>${k}:</b> ${formatVal(v)}</li>`).join('')}
          </ul>
        </div>`;
        
    } else {
      const allKeys = Array.from(new Set([...Object.keys(safeOld), ...Object.keys(safeNew)]));
      const changes = [];

      allKeys.forEach(key => {
        const oldVal = safeOld[key];
        const newVal = safeNew[key];

        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          let handledCustom = false;
          
          switch (key) {
            case 'is_locked':
              if (oldVal === false && newVal === true) {
                changes.push(`<li><span style="color: #ef4444; font-weight: bold;">El usuario fue bloqueado.</span></li>`);
                handledCustom = true;
              } else if (oldVal === true && newVal === false) {
                changes.push(`<li><span style="color: #22c55e; font-weight: bold;">El usuario fue desbloqueado.</span></li>`);
                handledCustom = true;
              }
              break;
          }

          if (handledCustom) return;

          if (Array.isArray(oldVal) || Array.isArray(newVal)) {
            const oldArray = Array.isArray(oldVal) ? oldVal : [];
            const newArray = Array.isArray(newVal) ? newVal : [];
            const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');

            const renderList = (arr, textColor) => {
              if (arr.length === 0) return `<span style="color: ${textColor}; font-style: italic; font-size: 12px;">(Vacío)</span>`;
              return `<ul style="margin: 0; padding-left: 15px; list-style-type: disc; color: ${textColor}; font-size: 13px; line-height: 1.5;">${arr.map(item => `<li>${item}</li>`).join('')}</ul>`;
            };

            changes.push(`
              <li style="margin-bottom: 16px; list-style: none; margin-left: -20px; width: calc(100% + 20px);">
                <div style="font-weight: bold; color: #374151; margin-bottom: 8px;">${label}</div>
                <div style="display: flex; gap: 12px;">
                  <div style="flex: 1; background-color: #fef2f2; padding: 10px; border-radius: 6px; border-left: 4px solid #ef4444;">
                    <span style="color: #991b1b; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">Valor Anterior</span>
                    ${renderList(oldArray, '#7f1d1d')}
                  </div>
                  <div style="flex: 1; background-color: #f0fdf4; padding: 10px; border-radius: 6px; border-left: 4px solid #22c55e;">
                    <span style="color: #166534; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">Valor Nuevo</span>
                    ${renderList(newArray, '#14532d')}
                  </div>
                </div>
              </li>
            `);
            return; 
          }

          if (oldVal === undefined) {
            let handledAddition = false;
            switch (key) {
              case 'motivo':
              case 'evento':
              case 'Fechas afectadas':
              case 'Total de registros modificados':
              case 'Alumnos con nuevas observaciones':
                const label = key.charAt(0).toUpperCase() + key.slice(1);
                changes.push(`<li><b>${label}:</b> <span style="color: #22c55e;">${formatVal(newVal)}</span></li>`);
                handledAddition = true;
                break;
            }

            if (!handledAddition) {
              changes.push(`<li>Campo <b>${key}</b> fue agregado con valor: <span style="color: #22c55e;">${formatVal(newVal)}</span></li>`);
            }
            
          } else if (newVal === undefined) {
             changes.push(`<li>Campo <b>${key}</b> fue eliminado. Valor anterior: <span style="color: #ef4444;">${formatVal(oldVal)}</span></li>`);
          } else {
             changes.push(`<li><b>${key}:</b> cambió de <span style="color: #ef4444; text-decoration: line-through;">${formatVal(oldVal)}</span> a <span style="color: #22c55e; font-weight: bold;">${formatVal(newVal)}</span></li>`);
          }
        } 
      });

      if (changes.length > 0) {
        htmlContent = `<ul style="text-align: left; font-size: 14px; line-height: 1.6; padding-left: 20px;">${changes.join('')}</ul>`;
      } else {
        htmlContent = '<p style="text-align: center; color: #6b7280;">No se detectaron cambios en los valores.</p>';
      }
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
    const tableColumn = ["Fecha/Hora", "ID Autor", "Rol", "Acción", "Entidad", "Detalles del Cambio"];
    
    const tableRows = logs.map(log => [
      new Date(log.created_at).toLocaleString(),
      log.user_identifier,
      log.user_role || 'SISTEMA',
      log.action,
      log.entity_name,
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
        5: { cellWidth: 157 } 
      }
    });

    doc.save(`Audit_Logs_${filtros.fecha_desde}_${filtros.fecha_hasta}.pdf`);
  };

  const isPdfHabilitado = filtros.fecha_desde && filtros.fecha_hasta && logs.length > 0;

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
          
          {/* KPI Corregido */}
          <div 
            onClick={handleOpenLockedUsers}
            className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-red-300 transition-colors"
          >
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
                  <th className="p-3 text-center">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cargando ? (
                  <tr><td colSpan="6" className="text-center py-10 text-gray-500 font-bold">Cargando registros...</td></tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-16">
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
                      <td className="p-3 text-center">
                        <button 
                          onClick={() => verDetalleJson(log.old_values, log.new_values, log.action)}
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

          {/* Modal: Locked Users */}
          {showLockedUsersModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
                
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                  <h2 className="text-lg font-bold text-[#1A237E] flex items-center gap-2">
                    <UserX className="w-5 h-5 text-red-500" />
                    Locked Users Directory
                  </h2>
                  <button 
                    onClick={() => setShowLockedUsersModal(false)} 
                    className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4 border-b border-gray-200">
                  <input 
                    type="text" 
                    placeholder="Search by ID or Email..." 
                    value={searchLockedUser}
                    onChange={(e) => setSearchLockedUser(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1A237E]"
                  />
                </div>

                <div className="p-4 overflow-y-auto flex-1 bg-gray-50">
                  {filteredLockedUsers.length === 0 ? (
                    <p className="text-center text-gray-500 font-bold py-8">No locked users found.</p>
                  ) : (
                    <div className="space-y-3">
                      {filteredLockedUsers.map(user => (
                        <div key={user.identifier} className="bg-white p-4 rounded-lg border border-gray-200 flex justify-between items-center shadow-sm">
                          <div>
                            <p className="font-bold text-[#1A237E] font-mono text-lg">{user.identifier}</p>
                            <p className="text-xs text-gray-500">{user.email || 'No email registered'}</p>
                          </div>
                          <div className="text-right flex items-center gap-4">
                            <div>
                              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Locked At</p>
                              <p className="text-sm font-medium text-gray-700">
                                {user.locked_at ? new Date(user.locked_at).toLocaleString() : 'Unknown'}
                              </p>
                            </div>
                            <button
                              onClick={() => handleUnlockUser(user.identifier)}
                              className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors"
                              title="Unlock User"
                            >
                              <Unlock className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}
          
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