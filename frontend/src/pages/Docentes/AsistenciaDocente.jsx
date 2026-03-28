import React, { useState, useEffect, useRef } from 'react';
import { Download, Save, Search, MessageSquareText, Users, CalendarDays, CheckCircle, XCircle, BookOpen, ChevronDown, Loader2, Lock, CalendarClock, GraduationCap, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import client from '../../lib/axios'; 
import { useAuth } from '../../hooks/AuthContext'; 

const ESTADOS = {
  P: { label: '✓', color: 'text-green-600', bg: 'bg-green-50 border-green-200', btnHover: 'hover:bg-green-100', desc: 'Presente' },
  F: { label: 'X', color: 'text-red-600', bg: 'bg-red-50 border-red-200', btnHover: 'hover:bg-red-100', desc: 'Falta' },
  R: { label: 'R', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', btnHover: 'hover:bg-amber-100', desc: 'Retardo' },
  J: { label: 'J', color: 'text-slate-600', bg: 'bg-slate-100 border-slate-300', btnHover: 'hover:bg-slate-200', desc: 'Justific.' }
};

const formatearFechaMes = (fechaStr) => {
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const partes = fechaStr.split('-');
  if (partes.length !== 3) return fechaStr;
  return `${parseInt(partes[2], 10)} ${meses[parseInt(partes[1], 10) - 1]}`;
};

const AsistenciaDocente = () => {
  const { user } = useAuth(); 
  
  const [periodosOptions, setPeriodosOptions] = useState([]);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('');
  const [isDropdownPeriodoOpen, setIsDropdownPeriodoOpen] = useState(false);

  const [materiasOptions, setMateriasOptions] = useState([]);
  const [materiaSeleccionada, setMateriaSeleccionada] = useState('');
  const [isDropdownMateriaOpen, setIsDropdownMateriaOpen] = useState(false);

  const [carrerasOptions, setCarrerasOptions] = useState([]);
  const [carreraSeleccionada, setCarreraSeleccionada] = useState('');
  const [isDropdownCarreraOpen, setIsDropdownCarreraOpen] = useState(false);

  const [busqueda, setBusqueda] = useState('');
  
  const dropdownPeriodoRef = useRef(null);
  const dropdownMateriaRef = useRef(null);
  const dropdownCarreraRef = useRef(null);
  
  const [alumnos, setAlumnos] = useState([]);
  const [alumnosOriginales, setAlumnosOriginales] = useState([]); 
  const [fechasClase, setFechasClase] = useState([]); 
  const [actaCerrada, setActaCerrada] = useState(false);
  const [periodoActivo, setPeriodoActivo] = useState(true); 
  const [infoDias, setInfoDias] = useState(''); 
  
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  
  const [cambiosPendientes, setCambiosPendientes] = useState({});
  
  // ESTADOS PARA PAGINACIÓN Y SESIONES
  const [sesionSeleccionada, setSesionSeleccionada] = useState(null);
  const [paginaActual, setPaginaActual] = useState(1);
  const alumnosPorPagina = 10;
  
 const fechaActual = new Date();
  const hoy = new Date(fechaActual.getTime() - (fechaActual.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

  const isSoloLectura = actaCerrada || !periodoActivo;
  const esPeriodoFuturo = fechasClase.length > 0 && fechasClase[0] > hoy;

  const handleBusquedaChange = (e) => {
    let val = e.target.value;
    val = val.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
    val = val.replace(/\s{2,}/g, ' ');
    if (val.startsWith(' ')) val = val.trimStart();
    setBusqueda(val);
    setPaginaActual(1); // Regresa a la página 1 al buscar
  };

  useEffect(() => {
    const fetchInicial = async () => {
      try {
        const resPeriodos = await client.get('/asistencia/periodos');
        setPeriodosOptions(resPeriodos.data);
        const activo = resPeriodos.data.find(p => p.is_active) || resPeriodos.data[0];
        if (activo) setPeriodoSeleccionado(activo.id);
        else setCargando(false);
      } catch (error) { 
        console.error("Error inicial", error); 
        setCargando(false);
      }
    };
    fetchInicial();
  }, []);

  useEffect(() => {
    if (!periodoSeleccionado || !user) return;
    const fetchMaterias = async () => {
      try {
        const numEmpleado = user?.identifier || user?.numero_empleado_matricula || user?.username || user?.numero_empleado || '';
        const tId = user?.teacher_id || user?.id || '';
        const res = await client.get(`/asistencia/mis-grupos?periodo=${periodoSeleccionado}&num_empleado=${numEmpleado}&teacher_id=${tId}`);
        setMateriasOptions(res.data);
        
        const carrerasDelDocente = Array.from(new Set(res.data.map(m => m.carrera))).filter(Boolean);
        setCarrerasOptions(carrerasDelDocente);
        setCarreraSeleccionada(''); 

        if (res.data.length > 0) {
          setMateriaSeleccionada(res.data[0].id);
        } else {
          setMateriaSeleccionada(''); setAlumnos([]); setAlumnosOriginales([]);
          setFechasClase([]); setSesionSeleccionada(null); setCargando(false); 
        }
      } catch (error) { console.error("Error materias", error); setCargando(false); }
    };
    fetchMaterias();
  }, [periodoSeleccionado, user]);

  useEffect(() => {
    if (!materiaSeleccionada || !periodoSeleccionado) return;
    const fetchAlumnos = async () => {
      setCargando(true);
      try {
        const response = await client.get(`/asistencia/grupo/${materiaSeleccionada}?periodo=${periodoSeleccionado}`);
        const fechas = response.data.fechas || [];
        setFechasClase(fechas);
        
        //  Seleccionar inteligentemente la sesión al cargar
        if (fechas.length > 0) {
           const fechaHoy = fechas.find(f => f === hoy);
           const clasesPasadas = fechas.filter(f => f <= hoy);
           setSesionSeleccionada(fechaHoy || (clasesPasadas.length > 0 ? clasesPasadas[clasesPasadas.length - 1] : fechas[0]));
        } else {
           setSesionSeleccionada(null);
        }

        setActaCerrada(response.data.acta_cerrada);
        setPeriodoActivo(response.data.periodo_activo ?? true); 
        setInfoDias(response.data.dias_clase || '');
        
        const alumnosBD = response.data.alumnos || [];
        setAlumnos(alumnosBD);
        setAlumnosOriginales(JSON.parse(JSON.stringify(alumnosBD))); 
        setCambiosPendientes({});
        setPaginaActual(1);

      } catch (error) {
        Swal.fire('Error', 'No se pudieron cargar los datos.', 'error');
      } finally {
        setCargando(false);
      }
    };
    fetchAlumnos();
  }, [materiaSeleccionada, periodoSeleccionado]);

  useEffect(() => {
    const handleClickOutside = (e) => { 
      if (dropdownPeriodoRef.current && !dropdownPeriodoRef.current.contains(e.target)) setIsDropdownPeriodoOpen(false);
      if (dropdownMateriaRef.current && !dropdownMateriaRef.current.contains(e.target)) setIsDropdownMateriaOpen(false);
      if (dropdownCarreraRef.current && !dropdownCarreraRef.current.contains(e.target)) setIsDropdownCarreraOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCarrera = (carreraElegida) => {
    setCarreraSeleccionada(carreraElegida);
    setIsDropdownCarreraOpen(false);
    const materiasVisibles = materiasOptions.filter(m => carreraElegida === '' ? true : m.carrera === carreraElegida);
    if (materiasVisibles.length > 0) setMateriaSeleccionada(materiasVisibles[0].id);
    else setMateriaSeleccionada('');
  };

  const materiasVisiblesMenu = materiasOptions.filter(m => carreraSeleccionada === '' ? true : m.carrera === carreraSeleccionada);

  const alumnosFiltrados = alumnos.filter(a => {
    return a.nombre.toLowerCase().includes(busqueda.toLowerCase()) || a.matricula.includes(busqueda);
  });
  
  const totalAlumnos = alumnosFiltrados.length;
  const totalClases = fechasClase.length;
  
  let asistenciasGlobales = 0, faltasGlobales = 0;
  alumnosFiltrados.forEach(a => {
    fechasClase.forEach(f => {
      if (f <= hoy && a.asistencias[f]) {
        const estFinal = cambiosPendientes[`${a.matricula}_${f}`]?.estado !== undefined 
                         ? cambiosPendientes[`${a.matricula}_${f}`].estado : a.asistencias[f];
        if (estFinal === 'F') faltasGlobales++;
        if (estFinal === 'P') asistenciasGlobales++;
      }
    });
  });

  const tieneCambiosNotas = alumnos.some((a) => {
    const original = alumnosOriginales.find(orig => orig.id === a.id);
    return original && (original.observaciones || '') !== (a.observaciones || '');
  });

  const tieneCambiosAsistencias = Object.values(cambiosPendientes).some(cambio => {
    const alumno = alumnos.find(a => a.matricula === cambio.matricula);
    if (!alumno) return false;
    const estadoBD = alumno.asistencias[cambio.fecha];
    if (estadoBD) return estadoBD !== cambio.estado;
    return true;
  });

  const hayCambiosSinGuardar = tieneCambiosAsistencias || tieneCambiosNotas;

  const registrarCambio = (matricula, fecha, nuevoEstado, notasJustificacion = null) => {
    if (isSoloLectura || fecha > hoy) return;
    setCambiosPendientes(prev => ({
      ...prev,
      [`${matricula}_${fecha}`]: { matricula, fecha, estado: nuevoEstado, notas_justificacion: notasJustificacion }
    }));
  };

  const toggleColumna = (e) => {
    if (isSoloLectura || !sesionSeleccionada || sesionSeleccionada > hoy) return;
    const isChecked = e.target.checked;
    const nuevosCambios = { ...cambiosPendientes };
    
    //  Solo afecta a los alumnos de la página actual o a todos? Mejor a todos los filtrados para no confundir
    alumnosFiltrados.forEach(a => {
      if (!a.asistencias[sesionSeleccionada]) {
        if (isChecked) {
          nuevosCambios[`${a.matricula}_${sesionSeleccionada}`] = { matricula: a.matricula, fecha: sesionSeleccionada, estado: 'P', notas_justificacion: null };
        } else {
          delete nuevosCambios[`${a.matricula}_${sesionSeleccionada}`]; 
        }
      }
    });
    setCambiosPendientes(nuevosCambios);
  };

  const manejarSeleccionEstado = async (alumno, fecha, estadoElegido) => {
    if (isSoloLectura || fecha > hoy) return;
    if (estadoElegido === 'J') {
      const { value: motivo } = await Swal.fire({
        title: 'Falta Justificada',
        input: 'text',
        inputLabel: 'Escriba el motivo (Obligatorio)',
        inputPlaceholder: 'Ej. Receta medica IMSS',
        showCancelButton: true,
        confirmButtonColor: '#1A237E',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => { if (!value || value.trim() === '') return '¡Necesitas escribir un motivo válido!'; }
      });
      if (motivo) {
        registrarCambio(alumno.matricula, fecha, 'J', motivo.trim());
      }
    } else {
      registrarCambio(alumno.matricula, fecha, estadoElegido, null);
    }
  };

  const mostrarObservaciones = (alumno) => {
    if (isSoloLectura) {
      Swal.fire({ title: `Notas de ${alumno.nombre}`, text: alumno.observaciones || "No hay observaciones.", icon: 'info', confirmButtonColor: '#1A237E' });
      return;
    }
    const notaOriginal = alumno.observaciones ? alumno.observaciones.trim() : '';
    Swal.fire({
      title: `Notas del Alumno`,
      html: `<b>${alumno.nombre}</b><br/><span style="font-size:12px; color:gray;">Agrega observaciones para el seguimiento.</span>`,
      input: 'textarea',
      inputValue: notaOriginal,
      showCancelButton: true,
      confirmButtonText: 'Confirmar Nota',
      confirmButtonColor: '#1A237E',
      preConfirm: (value) => value ? value.trim() : ''
    }).then((result) => {
      if (result.isConfirmed) {
        setAlumnos(prev => prev.map(a => a.id === alumno.id ? { ...a, observaciones: result.value } : a));
      }
    });
  };

  const handleGuardar = async () => {
    if (isSoloLectura || !hayCambiosSinGuardar) return;
    let payloadEnvio = [];
    
    fechasClase.forEach(fecha => {
      if (fecha <= hoy) {
        alumnos.forEach(a => {
          if (!a.asistencias[fecha]) {
            const cambioPendiente = cambiosPendientes[`${a.matricula}_${fecha}`];
            const estFinal = cambioPendiente?.estado !== undefined ? cambioPendiente.estado : 'F'; 
            payloadEnvio.push({ matricula: a.matricula, fecha: fecha, estado: estFinal, notas_justificacion: cambioPendiente?.notas_justificacion || null });
          }
        });
      }
    });

    Object.values(cambiosPendientes).forEach(cambio => {
      const alumno = alumnos.find(a => a.matricula === cambio.matricula);
      if (alumno && alumno.asistencias[cambio.fecha]) payloadEnvio.push(cambio);
    });

    const observacionesEnvio = alumnos.map(a => ({ matricula: a.matricula, observaciones: a.observaciones || null }));

    setGuardando(true);
    try {
      const response = await client.post('/asistencia/guardar', {
        academic_group_id: parseInt(materiaSeleccionada),
        periodo: periodoSeleccionado, cambios: payloadEnvio,
        observaciones_alumnos: observacionesEnvio,
        usuario_id: user?.identifier || user?.email || "Docente Local" 
      });
      Swal.fire({ icon: 'success', title: '¡Guardado Exitoso!', text: `Se registraron ${response.data.total_cambios} actualizaciones.`, confirmButtonColor: '#1A237E' });
      setMateriaSeleccionada(prev => { const actual = prev; setMateriaSeleccionada(''); setTimeout(() => setMateriaSeleccionada(actual), 10); return prev; });
    } catch (error) {
      Swal.fire('Error', error.response?.data?.detail || 'Hubo un problema al guardar.', 'error');
    } finally { setGuardando(false); }
  };

  const nombreDocentePDF = user?.full_name || user?.nombre_completo || user?.nombre || "DOCENTE TITULAR";

  
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF('landscape'); const pageWidth = doc.internal.pageSize.getWidth();
      const nombreMateriaStr = materiasOptions.find(o => o.id === materiaSeleccionada)?.label || "";
      const partes = nombreMateriaStr.split(' - ');
      const nombreMatLimpio = partes[0] ? partes[0].trim().toUpperCase() : "S/A";
      const grupoLimpio = partes[1] ? partes[1].trim() : "S/A";
      const codigoMateria = nombreMatLimpio.substring(0, 5);
      const reporteIDStr = `REPORTE-${periodoSeleccionado}-${codigoMateria}`;

      const headersDias = fechasClase.map(f => formatearFechaMes(f));
      const tableColumn = ["MATRÍCULA", "NOMBRE DEL ALUMNO", ...headersDias, "ASIST.", "FALTAS"];
      
      const tableRows = alumnosFiltrados.map(a => {
        let clasesRegistradas = 0, faltasTotales = 0;
        const asistenciasFila = fechasClase.map(fecha => {
          const estadoBD = a.asistencias[fecha];
          if (!estadoBD) return '-'; 
          clasesRegistradas++;
          if (estadoBD === 'F') faltasTotales++;
          return estadoBD; 
        });
        const asistenciasTotal = clasesRegistradas - faltasTotales;
        return [a.matricula, a.nombre, ...asistenciasFila, asistenciasTotal.toString(), faltasTotales.toString()];
      });

      autoTable(doc, {
        head: [tableColumn], body: tableRows, startY: 55, theme: 'plain', horizontalPageBreak: true, horizontalPageBreakRepeat: 0, 
        margin: { bottom: 25, top: 55, left: 10, right: 10 }, 
        styles: { fontSize: 6.5, cellPadding: 1, textColor: [80, 80, 80] }, 
        headStyles: { fillColor: [248, 249, 250], textColor: [26, 35, 126], fontStyle: 'bold', lineWidth: 0.1, lineColor: [230, 230, 230], halign: 'center', valign: 'middle' },
        bodyStyles: { lineWidth: 0.1, lineColor: [240, 240, 240] },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 18, halign: 'center' }, 1: { cellWidth: 45 }, [tableColumn.length - 2]: { fontStyle: 'bold', textColor: [26, 35, 126], halign: 'center', cellWidth: 12 }, [tableColumn.length - 1]: { fontStyle: 'bold', textColor: [220, 38, 38], halign: 'center', cellWidth: 12 } },
        didParseCell: function (data) {
          if (data.section === 'head' && data.column.index >= 2) data.cell.styles.halign = 'center';
          if (data.section === 'body') {
            const rawVal = data.cell.raw;
            if (rawVal === 'P') { data.cell.text = ['4']; data.cell.styles.font = 'zapfdingbats'; data.cell.styles.textColor = [34, 197, 94]; data.cell.styles.halign = 'center'; } 
            else if (rawVal === 'F') { data.cell.text = ['8']; data.cell.styles.font = 'zapfdingbats'; data.cell.styles.textColor = [239, 68, 68]; data.cell.styles.halign = 'center'; }
            else if (rawVal === 'R' || rawVal === 'J') { data.cell.styles.textColor = [100, 100, 100]; data.cell.styles.fillColor = [245, 245, 245]; data.cell.styles.fontStyle = 'bold'; data.cell.styles.halign = 'center'; }
            else if (rawVal === '-') { data.cell.styles.textColor = [200, 200, 200]; data.cell.styles.halign = 'center'; }
            if (data.column.index >= 2 && data.column.index <= tableColumn.length - 3) data.cell.styles.halign = 'center';
          }
        },
        didDrawPage: function (data) {
          doc.setFillColor(11, 23, 42); doc.rect(14, 15, 12, 12, 'F'); doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text("U", 20, 23.5, { align: "center" }); 
          doc.setTextColor(26, 35, 126); doc.setFontSize(16); doc.text("UNID", 30, 20); doc.setFontSize(8); doc.setTextColor(100); doc.setFont("helvetica", "normal"); doc.text("UNIVERSIDAD INTERAMERICANA PARA EL DESARROLLO", 30, 24);
          doc.setTextColor(26, 35, 126); doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("REPORTE DE ASISTENCIA DOCENTE", pageWidth - 14, 20, { align: "right" }); doc.setFontSize(9); doc.setTextColor(100); doc.setFont("helvetica", "normal"); doc.text("Documento Oficial", pageWidth - 14, 24, { align: "right" });
          doc.setDrawColor(242, 169, 0); doc.setLineWidth(0.5); doc.line(14, 28, pageWidth - 14, 28);
          doc.setFontSize(8); doc.setTextColor(150); doc.setFont("helvetica", "bold"); doc.text("MATERIA", 14, 35); doc.text("GRUPO", 120, 35); doc.text("DOCENTE", 200, 35); doc.text("PERIODO ACADÉMICO", 14, 45); doc.text("FECHA DE GENERACIÓN", 120, 45); doc.text("ID REPORTE", 200, 45);
          doc.setTextColor(50); doc.setFont("helvetica", "bold"); doc.text(nombreMatLimpio, 14, 40); doc.text(grupoLimpio, 120, 40); doc.text(nombreDocentePDF.toUpperCase(), 200, 40); doc.text(periodoSeleccionado || "S/A", 14, 50); doc.text(new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase(), 120, 50); doc.setTextColor(100); doc.text(reporteIDStr, 200, 50);
          const footerY = doc.internal.pageSize.getHeight() - 15; doc.setFontSize(8); 
          doc.setFont("zapfdingbats"); doc.setTextColor(34, 197, 94); doc.text("4", 14, footerY); doc.setFont("helvetica", "normal"); doc.setTextColor(150); doc.text(" Asistencia (Presente)", 17, footerY);
          doc.setFont("zapfdingbats"); doc.setTextColor(239, 68, 68); doc.text("8", 60, footerY); doc.setFont("helvetica", "normal"); doc.setTextColor(150); doc.text(" Falta (Ausencia Injustificada)", 63, footerY);
          doc.setFont("helvetica", "bold"); doc.setTextColor(150); doc.text("R", 115, footerY); doc.setFont("helvetica", "normal"); doc.text(" Retardo", 118, footerY);
          doc.setFont("helvetica", "bold"); doc.text("J", 140, footerY); doc.setFont("helvetica", "normal"); doc.text(" Justificante", 143, footerY);
          doc.setTextColor(100); doc.text("Documento generado por Sistema Académico SESA UNID", 14, footerY + 5); doc.text(`Página ${data.pageNumber}`, doc.internal.pageSize.getWidth() - 20, footerY + 5, { align: 'right' });
        }
      });
      doc.save(`Lista_Asistencia_${codigoMateria}.pdf`);
    } catch (error) { Swal.fire('Error', 'No se pudo generar el documento PDF.', 'error'); }
  };

  //  LÓGICA DE PAGINACIÓN
  const indexUltimoAlumno = paginaActual * alumnosPorPagina;
  const indexPrimerAlumno = indexUltimoAlumno - alumnosPorPagina;
  const alumnosPaginados = alumnosFiltrados.slice(indexPrimerAlumno, indexUltimoAlumno);
  const totalPaginas = Math.ceil(alumnosFiltrados.length / alumnosPorPagina);

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-6 font-sans relative">
      <div className="max-w-[1400px] mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative z-10">
        
        {/* MENSAJES DE ADVERTENCIA */}
        {!periodoActivo && !cargando && !esPeriodoFuturo && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center text-amber-800 shadow-sm">
            <AlertTriangle className="w-5 h-5 mr-3 shrink-0" />
            <p className="text-sm font-bold">Este periodo académico ha finalizado. El módulo se encuentra en modo Solo Lectura histórico.</p>
          </div>
        )}
        {!periodoActivo && !cargando && esPeriodoFuturo && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center text-blue-800 shadow-sm">
            <AlertTriangle className="w-5 h-5 mr-3 shrink-0" />
            <p className="text-sm font-bold">Este periodo académico todavía no comienza. El módulo se encuentra en modo Solo Lectura.</p>
          </div>
        )}
        {actaCerrada && periodoActivo && !cargando && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-800 shadow-sm">
            <Lock className="w-5 h-5 mr-3 shrink-0" />
            <p className="text-sm font-bold">Acta Final Generada. El módulo de asistencia se encuentra en modo Solo Lectura.</p>
          </div>
        )}

        {/* FILTROS SUPERIORES */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4 border-b pb-6">
          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            
            {/* Periodo */}
            <div className="flex flex-col relative z-40" ref={dropdownPeriodoRef}>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Periodo</label>
              <div onClick={() => setIsDropdownPeriodoOpen(!isDropdownPeriodoOpen)} className={`relative flex items-center justify-between w-[130px] h-[38px] px-3 py-2 border rounded-lg text-sm bg-white font-bold cursor-pointer transition-all ${isDropdownPeriodoOpen ? 'border-[#1A237E] ring-2 ring-[#1A237E]/20 text-[#1A237E]' : 'border-gray-300 text-gray-800 hover:border-gray-400'}`}>
                <span className="truncate">{periodoSeleccionado || "Cargando..."}</span>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ml-2 ${isDropdownPeriodoOpen ? 'rotate-180 text-[#1A237E]' : ''}`} />
              </div>
              <div className={`absolute top-full mt-1.5 w-[160px] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden transition-all duration-200 origin-top ${isDropdownPeriodoOpen ? 'opacity-100 scale-y-100 visible' : 'opacity-0 scale-y-95 invisible'}`}>
                {periodosOptions.map(opt => (
                  <div key={opt.id} onClick={() => { setPeriodoSeleccionado(opt.id); setIsDropdownPeriodoOpen(false); }} className={`px-4 py-3 text-sm cursor-pointer transition-colors border-b border-gray-50 last:border-none ${periodoSeleccionado === opt.id ? 'bg-blue-50 text-[#1A237E] font-bold' : 'text-gray-700 hover:bg-gray-50 hover:text-blue-700'}`}>
                    {opt.label} {opt.is_active && <span className="text-[9px] text-green-600 ml-1 font-bold">(Actual)</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Carrera */}
            <div className="flex flex-col relative z-30" ref={dropdownCarreraRef}>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Filtro de Carrera</label>
              <div onClick={() => setIsDropdownCarreraOpen(!isDropdownCarreraOpen)} className={`relative flex items-center justify-between w-[200px] h-[38px] px-3 py-2 border rounded-lg text-sm bg-white font-bold cursor-pointer transition-all ${isDropdownCarreraOpen ? 'border-[#1A237E] ring-2 ring-[#1A237E]/20 text-[#1A237E]' : 'border-gray-300 text-gray-800 hover:border-gray-400'}`}>
                <div className="flex items-center gap-2 truncate">
                  <GraduationCap className={`w-4 h-4 flex-shrink-0 ${isDropdownCarreraOpen ? 'text-[#1A237E]' : 'text-gray-400'}`} />
                  <span className="truncate">{carreraSeleccionada === '' ? 'Todas las Carreras' : carreraSeleccionada}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ml-2 ${isDropdownCarreraOpen ? 'rotate-180 text-[#1A237E]' : ''}`} />
              </div>
              <div className={`absolute top-full mt-1.5 w-[250px] max-h-[300px] overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl transition-all duration-200 origin-top ${isDropdownCarreraOpen ? 'opacity-100 scale-y-100 visible' : 'opacity-0 scale-y-95 invisible'} custom-scrollbar`}>
                <div onClick={() => handleSelectCarrera('')} className={`px-4 py-3 text-sm cursor-pointer transition-colors border-b border-gray-50 ${carreraSeleccionada === '' ? 'bg-blue-50 text-[#1A237E] font-bold' : 'text-gray-700 hover:bg-gray-50'}`}>Todas las Carreras</div>
                {carrerasOptions.map(carrera => (
                  <div key={carrera} onClick={() => handleSelectCarrera(carrera)} className={`px-4 py-3 text-sm cursor-pointer transition-colors border-b border-gray-50 last:border-none ${carreraSeleccionada === carrera ? 'bg-blue-50 text-[#1A237E] font-bold' : 'text-gray-700 hover:bg-gray-50'}`}>{carrera}</div>
                ))}
              </div>
            </div>

            {/* Materia */}
            <div className="flex flex-col relative z-20" ref={dropdownMateriaRef}>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Materia y Grupo</label>
              <div onClick={() => setIsDropdownMateriaOpen(!isDropdownMateriaOpen)} className={`relative flex items-center justify-between w-[250px] h-[38px] px-3 py-2 border rounded-lg text-sm bg-white font-bold cursor-pointer transition-all ${isDropdownMateriaOpen ? 'border-[#1A237E] ring-2 ring-[#1A237E]/20 text-[#1A237E]' : 'border-gray-300 text-gray-800 hover:border-gray-400'}`}>
                <div className="flex items-center gap-2 truncate">
                  <BookOpen className={`w-4 h-4 flex-shrink-0 ${isDropdownMateriaOpen ? 'text-[#1A237E]' : 'text-gray-400'}`} />
                  <span className="truncate">{materiasVisiblesMenu.length === 0 ? "Sin grupos en esta carrera" : materiasVisiblesMenu.find(o => o.id === materiaSeleccionada)?.label || "Seleccione"}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ml-2 ${isDropdownMateriaOpen ? 'rotate-180 text-[#1A237E]' : ''}`} />
              </div>
              <div className={`absolute top-full mt-1.5 w-full min-w-[300px] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden transition-all duration-200 origin-top ${isDropdownMateriaOpen ? 'opacity-100 scale-y-100 visible' : 'opacity-0 scale-y-95 invisible'}`}>
                {materiasVisiblesMenu.length === 0 && <div className="p-3 text-sm text-gray-500 text-center">No hay materias asignadas</div>}
                {materiasVisiblesMenu.map(opt => (
                  <div key={opt.id} onClick={() => { setMateriaSeleccionada(opt.id); setIsDropdownMateriaOpen(false); }} className={`px-4 py-3 text-sm cursor-pointer transition-colors border-b border-gray-50 last:border-none ${materiaSeleccionada === opt.id ? 'bg-blue-50 text-[#1A237E] font-bold' : 'text-gray-700 hover:bg-gray-50 hover:text-blue-700'}`}>{opt.label}</div>
                ))}
              </div>
            </div>

            {/* Buscador */}
            <div className="flex flex-col">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Buscar Alumno</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Nombre o matrícula..." value={busqueda} onChange={handleBusquedaChange} className="h-[38px] pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-[#1A237E] focus:border-[#1A237E] w-[200px] transition-all" />
              </div>
            </div>
          </div>
          
          <div className="flex flex-col shrink-0 self-end lg:self-auto mt-2 lg:mt-0">
            <label className="text-[11px] font-bold text-transparent uppercase tracking-wider mb-1 hidden lg:block">.</label>
            <div className="flex gap-3">
              <button onClick={handleExportPDF} disabled={!materiaSeleccionada || alumnos.length === 0 || hayCambiosSinGuardar} title={hayCambiosSinGuardar ? "Guarda los cambios pendientes antes de exportar" : "Exportar lista a PDF"} className="h-[38px] flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 hover:text-[#1A237E] hover:border-[#1A237E] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                <Download className="w-4 h-4 mr-2" /> Exportar PDF
              </button>
              <button onClick={handleGuardar} disabled={guardando || !materiaSeleccionada || isSoloLectura || !hayCambiosSinGuardar} className="h-[38px] flex items-center px-5 py-2 bg-[#1A237E] text-white rounded-lg text-sm font-bold hover:bg-[#283593] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                {guardando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {guardando ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>

        {/* TARJETAS DE MÉTRICAS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-gray-200 p-4 rounded-xl flex justify-between items-center shadow-sm">
            <div><p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Alumnos</p><p className="text-2xl font-black text-gray-800">{totalAlumnos}</p></div>
            <div className="bg-blue-50 p-3 rounded-xl text-[#1A237E]"><Users className="w-6 h-6" /></div>
          </div>
          <div className="bg-white border border-gray-200 p-4 rounded-xl flex justify-between items-center shadow-sm">
            <div><p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Sesiones</p><p className="text-2xl font-black text-gray-800">{totalClases}</p></div>
            <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600"><CalendarDays className="w-6 h-6" /></div>
          </div>
          <div className="bg-white border border-green-100 p-4 rounded-xl flex justify-between items-center shadow-sm">
            <div><p className="text-xs text-green-600/70 font-bold uppercase tracking-wider mb-1">Asistencias</p><p className="text-2xl font-black text-green-600">{asistenciasGlobales}</p></div>
            <div className="bg-green-50 p-3 rounded-xl text-green-500"><CheckCircle className="w-6 h-6" /></div>
          </div>
          <div className="bg-white border border-red-100 p-4 rounded-xl flex justify-between items-center shadow-sm">
            <div><p className="text-xs text-red-600/70 font-bold uppercase tracking-wider mb-1">Faltas</p><p className="text-2xl font-black text-red-600">{faltasGlobales}</p></div>
            <div className="bg-red-50 p-3 rounded-xl text-red-500"><XCircle className="w-6 h-6" /></div>
          </div>
        </div>

        {/*  SELECTOR HORIZONTAL DE SESIONES */}
        <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-gray-800 flex items-center"><CalendarClock className="w-4 h-4 mr-2 text-[#1A237E]"/> Selecciona la sesión a evaluar:</h3>
                <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Horario: {infoDias || "Cargando..."}</span>
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {fechasClase.map((fecha, idx) => {
                    const isSelected = sesionSeleccionada === fecha;
                    const esPasadaODehoy = fecha <= hoy;
                    return (
                        <button
                            key={fecha}
                            onClick={() => { setSesionSeleccionada(fecha); setPaginaActual(1); }}
                            className={`flex flex-col items-center justify-center min-w-[100px] px-4 py-2.5 rounded-xl border transition-all ${isSelected ? 'bg-[#1A237E] border-[#1A237E] text-white shadow-md transform scale-105' : esPasadaODehoy ? 'bg-white border-gray-200 text-gray-700 hover:border-[#1A237E]/50 hover:bg-blue-50' : 'bg-gray-50 border-gray-100 text-gray-400 opacity-70 cursor-not-allowed'}`}
                        >
                            <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>Sesión {idx + 1}</span>
                            <span className="text-sm font-black tracking-wide">{formatearFechaMes(fecha)}</span>
                        </button>
                    );
                })}
            </div>
        </div>

        {/* TABLA PRINCIPAL (REDISEÑADA PARA UNA SOLA SESIÓN) */}
        <div className="border border-gray-200 rounded-xl shadow-sm z-10 relative overflow-hidden bg-white">
          {cargando ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#1A237E]"><Loader2 className="w-10 h-10 animate-spin mb-4" /><p className="font-bold">Cargando datos de la base de datos...</p></div>
          ) : !sesionSeleccionada ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400"><CalendarDays className="w-12 h-12 mb-3 opacity-50" /><p className="font-semibold text-gray-600">Selecciona una sesión de la lista superior para pasar lista.</p></div>
          ) : (
            <>
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 text-[11px] uppercase font-bold border-b border-gray-200">
                <tr>
                  <th className="py-4 px-4 border-r border-gray-200 text-center w-[60px]">No.</th>
                  <th className="py-4 px-4 border-r border-gray-200 w-[120px] tracking-wider">Matrícula</th>
                  <th className="py-4 px-4 border-r border-gray-200 min-w-[250px] tracking-wider">Nombre del Alumno</th>
                  <th className="py-4 px-4 border-r border-gray-200 text-center w-[100px] leading-tight">Faltas<br/>Totales</th>
                  <th className="py-4 px-4 border-r border-gray-200 text-center min-w-[280px]">
                      Pase de Lista ({formatearFechaMes(sesionSeleccionada)})
                      {!isSoloLectura && sesionSeleccionada <= hoy && (
                          <div className="mt-2 flex items-center justify-center gap-2 bg-blue-50 py-1.5 px-3 rounded-lg border border-blue-100 mx-auto w-fit">
                              <input type="checkbox" id="checkAll" onChange={toggleColumna} className="w-3.5 h-3.5 accent-green-600 cursor-pointer" />
                              <label htmlFor="checkAll" className="text-[9px] text-[#1A237E] cursor-pointer">Marcar todos Presente</label>
                          </div>
                      )}
                  </th>
                  <th className="py-4 px-3 text-center w-[80px]">Notas</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 text-gray-700 bg-white">
                {alumnosPaginados.length > 0 ? (
                  alumnosPaginados.map((alumno, idx) => {
                    const numeroListaReal = indexPrimerAlumno + idx + 1;
                    
                    const faltasTotales = fechasClase.filter(f => {
                      if (f <= hoy && alumno.asistencias[f]) {
                        const estFinal = cambiosPendientes[`${alumno.matricula}_${f}`]?.estado !== undefined ? cambiosPendientes[`${alumno.matricula}_${f}`].estado : alumno.asistencias[f];
                        return estFinal === 'F';
                      }
                      return false;
                    }).length;

                    // Datos de la sesión actual
                    const registroBD = alumno.asistencias[sesionSeleccionada];
                    const cambioPendiente = cambiosPendientes[`${alumno.matricula}_${sesionSeleccionada}`]?.estado;
                    let estadoVisual = cambioPendiente !== undefined ? cambioPendiente : registroBD;
                    const esEditable = !isSoloLectura && sesionSeleccionada <= hoy;

                    return (
                      <tr key={alumno.id} className="hover:bg-blue-50/20 transition-colors">
                        <td className="py-3 px-4 text-center border-r border-gray-100 text-gray-400 font-bold align-middle">{numeroListaReal}</td>
                        <td className="py-3 px-4 border-r border-gray-100 font-mono text-gray-500 align-middle">{alumno.matricula}</td>
                        <td className="py-3 px-4 border-r border-gray-100 font-bold text-gray-800 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#1A237E]/10 flex items-center justify-center text-[#1A237E] font-black text-xs shrink-0">{alumno.nombre.charAt(0)}</div>
                            <span className="leading-tight">{alumno.nombre}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 border-r border-gray-100 text-center align-middle">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm ${faltasTotales > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{faltasTotales}</span>
                        </td>

                        {/*  BOTONES DIRECTOS (ADIÓS MODAL FLOTANTE) */}
                        <td className="py-3 px-4 border-r border-gray-100 text-center align-middle">
                           {sesionSeleccionada > hoy ? (
                               <span className="text-xs text-gray-400 font-medium">Clase futura</span>
                           ) : (!registroBD && isSoloLectura) ? (
                               <span className="text-xs text-gray-400 font-medium">Sin registro</span>
                           ) : (
                               <div className="flex items-center justify-center gap-2">
                                  {Object.entries(ESTADOS).map(([key, data]) => {
                                      const isSelected = estadoVisual === key;
                                      return (
                                          <button
                                              key={key}
                                              disabled={!esEditable && !isSelected}
                                              onClick={() => manejarSeleccionEstado(alumno, sesionSeleccionada, key)}
                                              title={data.desc}
                                              className={`w-9 h-9 flex items-center justify-center rounded-xl font-bold text-sm border transition-all ${isSelected ? `ring-2 ring-offset-1 ring-[#1A237E]/30 ${data.bg} ${data.color} shadow-sm transform scale-110 z-10` : !esEditable ? 'bg-gray-50 border-gray-100 text-gray-300 opacity-50 cursor-not-allowed' : `bg-white border-gray-200 text-gray-500 ${data.btnHover} hover:border-gray-400`}`}
                                          >
                                              {data.label}
                                          </button>
                                      );
                                  })}
                                  {estadoVisual === 'J' && (
                                      <button onClick={() => {
                                          const motivo = cambioPendiente !== undefined ? cambiosPendientes[`${alumno.matricula}_${sesionSeleccionada}`]?.notas_justificacion : alumno.justificaciones?.[sesionSeleccionada];
                                          Swal.fire({ title: 'Motivo de Justificación', text: motivo || "Sin motivo registrado.", icon: 'info', confirmButtonColor: '#1A237E' });
                                      }} className="ml-2 text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-1 rounded hover:bg-slate-200 transition-colors">Ver Motivo</button>
                                  )}
                               </div>
                           )}
                        </td>

                        <td className="py-3 px-3 text-center align-middle">
                          <button className={`transition-colors p-2 rounded-lg ${alumno.observaciones ? 'bg-blue-50 text-[#1A237E]' : 'text-gray-400 hover:bg-gray-50 hover:text-[#1A237E]'}`} title="Notas Generales" onClick={() => mostrarObservaciones(alumno)}>
                            <MessageSquareText className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <Search className="w-10 h-10 mb-3 opacity-50" />
                        <p className="font-semibold text-gray-600">No se encontraron alumnos.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            
            {/*  CONTROLES DE PAGINACIÓN */}
            {totalPaginas > 1 && (
                <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <span className="text-xs text-gray-500 font-medium">Mostrando {indexPrimerAlumno + 1} a {Math.min(indexUltimoAlumno, alumnosFiltrados.length)} de {alumnosFiltrados.length} alumnos</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPaginaActual(prev => Math.max(prev - 1, 1))} disabled={paginaActual === 1} className="flex items-center px-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="w-4 h-4 mr-1"/> Anterior</button>
                        <div className="flex gap-1">
                            {Array.from({ length: totalPaginas }, (_, i) => (
                                <button key={i + 1} onClick={() => setPaginaActual(i + 1)} className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg border transition-colors ${paginaActual === i + 1 ? 'bg-[#1A237E] text-white border-[#1A237E]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}>{i + 1}</button>
                            ))}
                        </div>
                        <button onClick={() => setPaginaActual(prev => Math.min(prev + 1, totalPaginas))} disabled={paginaActual === totalPaginas} className="flex items-center px-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Siguiente <ChevronRight className="w-4 h-4 ml-1"/></button>
                    </div>
                </div>
            )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AsistenciaDocente;