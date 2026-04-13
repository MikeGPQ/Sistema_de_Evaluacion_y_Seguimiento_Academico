import React, { useState, useEffect, useRef } from 'react';
import { Download, Save, Search, MessageSquareText, Users, CalendarDays, CheckCircle, XCircle, BookOpen, ChevronDown, Loader2, Edit3, Lock, X, CalendarClock, GraduationCap, AlertTriangle } from 'lucide-react';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import client from '../../lib/axios'; 
import { useAuth } from '../../hooks/AuthContext'; 

const NOMBRES_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const ESTADOS = {
  P: { label: '✓', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  F: { label: 'X', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  R: { label: 'R', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  J: { label: 'J', color: 'text-slate-600', bg: 'bg-slate-100 border-slate-300' }
};

const ESTADOS_EDICION = {
  P: { label: '✓', color: 'text-green-600', bg: 'bg-green-50 border-green-200', desc: 'Presente' },
  F: { label: 'X', color: 'text-red-600', bg: 'bg-red-50 border-red-200', desc: 'Falta' },
  R: { label: 'R', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', desc: 'Retardo' },
  J: { label: 'J', color: 'text-slate-600', bg: 'bg-slate-100 border-slate-300', desc: 'Justific.' }
};

const formatearFechaMes = (fechaStr) => {
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const partes = fechaStr.split('-');
  if (partes.length !== 3) return fechaStr;
  return `${parseInt(partes[2], 10)} ${meses[parseInt(partes[1], 10) - 1]}`;
};

const TeacherAttendance = () => {
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
  const tableContainerRef = useRef(null); 
  
  const [alumnos, setAlumnos] = useState([]);
  const [alumnosOriginales, setAlumnosOriginales] = useState([]); 
  const [fechasClase, setFechasClase] = useState([]); 
  const [actaCerrada, setActaCerrada] = useState(false);
  const [periodoActivo, setPeriodoActivo] = useState(true); 
  const [infoDias, setInfoDias] = useState(''); 
  
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  
  const [cambiosPendientes, setCambiosPendientes] = useState({});
  const [modoEdicion, setModoEdicion] = useState(false);
  const [celdaEditando, setCeldaEditando] = useState(null); 

  // 🌟 SPRINT 8: Pestañas por Mes
  const [mesSeleccionado, setMesSeleccionado] = useState('');
  
  const hoy = new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'America/Merida', 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  }).format(new Date());

  const isSoloLectura = actaCerrada || !periodoActivo;
  const esPeriodoFuturo = fechasClase.length > 0 && fechasClase[0] > hoy;

  const handleBusquedaChange = (e) => {
    let val = e.target.value;
    val = val.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
    val = val.replace(/\s{2,}/g, ' ');
    if (val.startsWith(' ')) val = val.trimStart();
    setBusqueda(val);
  };

  useEffect(() => {
    const fetchInicial = async () => {
      try {
        const resPeriodos = await client.get('/asistencia/periodos');
        setPeriodosOptions(resPeriodos.data);
        const activo = resPeriodos.data.find(p => p.is_active) || resPeriodos.data[0];
        if (activo) {
          setPeriodoSeleccionado(activo.id);
        } else {
          setCargando(false);
        }
      } catch (error) { 
        console.error("Error al cargar datos iniciales", error); 
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
          setMateriaSeleccionada('');
          setAlumnos([]);
          setAlumnosOriginales([]);
          setFechasClase([]);
          setMesSeleccionado('');
          setCargando(false); 
        }
      } catch (error) { 
        console.error("Error al cargar materias", error); 
        setCargando(false);
      }
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
        
        // 🌟 Lógica para seleccionar el mes actual por defecto
        if (fechas.length > 0) {
            const mesActualNum = hoy.split('-')[1];
            const mesesDisp = Array.from(new Set(fechas.map(f => f.split('-')[1]))).sort();
            if (mesesDisp.includes(mesActualNum)) {
                setMesSeleccionado(mesActualNum);
            } else {
                setMesSeleccionado(mesesDisp[0]);
            }
        } else {
            setMesSeleccionado('');
        }

        setActaCerrada(response.data.acta_cerrada);
        setPeriodoActivo(response.data.periodo_activo ?? true); 
        setInfoDias(response.data.dias_clase || '');
        
        const alumnosBD = response.data.alumnos || [];
        setAlumnos(alumnosBD);
        setAlumnosOriginales(JSON.parse(JSON.stringify(alumnosBD))); 
        setCambiosPendientes({});
        setModoEdicion(false);

        setTimeout(() => {
          if (tableContainerRef.current) {
            tableContainerRef.current.scrollLeft = tableContainerRef.current.scrollWidth;
          }
        }, 150);

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
    if (materiasVisibles.length > 0) {
      setMateriaSeleccionada(materiasVisibles[0].id);
    } else {
      setMateriaSeleccionada('');
    }
  };

  const materiasVisiblesMenu = materiasOptions.filter(m => 
    carreraSeleccionada === '' ? true : m.carrera === carreraSeleccionada
  );

  const alumnosFiltrados = alumnos.filter(a => {
    return a.nombre.toLowerCase().includes(busqueda.toLowerCase()) || a.matricula.includes(busqueda);
  });
  
  // 🌟 Filtro de Fechas por Mes
  const fechasDelMes = fechasClase.filter(f => f.split('-')[1] === mesSeleccionado);
  const mesesDisponibles = Array.from(new Set(fechasClase.map(f => f.split('-')[1]))).sort();

  const totalAlumnos = alumnosFiltrados.length;
  const totalClases = fechasClase.length;
  
  let asistenciasGlobales = 0, faltasGlobales = 0;
  alumnosFiltrados.forEach(a => {
    fechasClase.forEach(f => {
      if (f <= hoy && a.asistencias[f]) {
        const estFinal = cambiosPendientes[`${a.matricula}_${f}`]?.estado !== undefined 
                         ? cambiosPendientes[`${a.matricula}_${f}`].estado 
                         : a.asistencias[f];
        if (estFinal === 'F') faltasGlobales++;
        if (estFinal === 'P' || estFinal === 'J' || estFinal === 'R') asistenciasGlobales++;
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
    if (isSoloLectura) return;
    setCambiosPendientes(prev => ({
      ...prev,
      [`${matricula}_${fecha}`]: { matricula, fecha, estado: nuevoEstado, notas_justificacion: notasJustificacion }
    }));
  };

  const toggleColumna = (fecha, e) => {
    if (isSoloLectura) return;
    const isChecked = e.target.checked;
    const nuevosCambios = { ...cambiosPendientes };
    alumnosFiltrados.forEach(a => {
      if (!a.asistencias[fecha]) {
        if (isChecked) {
          nuevosCambios[`${a.matricula}_${fecha}`] = { matricula: a.matricula, fecha: fecha, estado: 'P', notas_justificacion: null };
        } else {
          delete nuevosCambios[`${a.matricula}_${fecha}`]; 
        }
      }
    });
    setCambiosPendientes(nuevosCambios);
  };

  const manejarSeleccionEstado = async (alumno, fecha, estadoElegido) => {
    setCeldaEditando(null); 
    if (estadoElegido === 'J') {
      const { value: motivo } = await Swal.fire({
        title: 'Falta Justificada',
        input: 'text',
        inputLabel: 'Escriba el motivo (Obligatorio)',
        inputPlaceholder: 'Ej. Receta medica IMSS',
        showCancelButton: true,
        confirmButtonColor: '#1A237E',
        cancelButtonText: 'Cancelar',
        didOpen: () => {
          const input = Swal.getInput();
          input.addEventListener('input', () => {
            let val = input.value;
            val = val.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
            val = val.replace(/\s{2,}/g, ' ');
            if (val.startsWith(' ')) val = val.trimStart();
            input.value = val;
          });
        },
        inputValidator: (value) => { 
          if (!value || value.trim() === '') return '¡Necesitas escribir un motivo válido!'; 
        }
      });
      if (motivo) {
        registrarCambio(alumno.matricula, fecha, 'J', motivo.trim());
        Swal.fire({
          toast: true, position: 'bottom-end', icon: 'info',
          title: 'Justificante agregado', text: 'Recuerda hacer clic en "Guardar Cambios".',
          showConfirmButton: false, timer: 4500
        });
      }
    } else {
      registrarCambio(alumno.matricula, fecha, estadoElegido, null);
    }
  };

  const mostrarObservaciones = (alumno) => {
    if (isSoloLectura) {
      Swal.fire({
        title: `Notas de ${alumno.nombre}`,
        text: alumno.observaciones || "No hay observaciones registradas.",
        icon: 'info',
        confirmButtonColor: '#1A237E',
        confirmButtonText: 'Cerrar'
      });
      return;
    }

    const notaOriginal = alumno.observaciones ? alumno.observaciones.trim() : '';

    Swal.fire({
      title: `Notas del Alumno`,
      html: `<b>${alumno.nombre}</b><br/><span style="font-size:12px; color:gray; margin-top:5px; display:block;">Agrega observaciones generales para el seguimiento.</span>`,
      input: 'textarea',
      inputValue: notaOriginal,
      showCancelButton: true,
      confirmButtonText: 'Confirmar Nota',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1A237E',
      didOpen: () => {
        const input = Swal.getInput();
        const confirmButton = Swal.getConfirmButton();
        confirmButton.disabled = true;

        input.addEventListener('input', () => {
          let val = input.value;
          val = val.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s.,]/g, ''); 
          val = val.replace(/ {2,}/g, ' '); 
          if (val.startsWith(' ')) val = val.trimStart();
          input.value = val;

          const textoLimpio = val.trim();
          const estaVacio = textoLimpio === '';
          const esIgualAlOriginal = textoLimpio === notaOriginal;

          if (estaVacio || esIgualAlOriginal) {
            confirmButton.disabled = true;
          } else {
            confirmButton.disabled = false;
          }
        });
      },
      preConfirm: (value) => {
        return value ? value.trim() : '';
      }
    }).then((result) => {
      if (result.isConfirmed) {
        const notaLimpia = result.value;
        setAlumnos(prev => prev.map(a => a.id === alumno.id ? { ...a, observaciones: notaLimpia } : a));
        Swal.fire({
          toast: true, position: 'bottom-end', icon: 'info', title: 'Nota agregada', 
          text: 'Recuerda hacer clic en "Guardar Cambios" para confirmar.', showConfirmButton: false, timer: 4500
        });
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
      if (alumno && alumno.asistencias[cambio.fecha]) {
        payloadEnvio.push(cambio);
      }
    });

    const observacionesEnvio = alumnos.map(a => ({
      matricula: a.matricula,
      observaciones: a.observaciones || null
    }));

    setGuardando(true);
    try {
      const response = await client.post('/asistencia/guardar', {
        academic_group_id: parseInt(materiaSeleccionada),
        periodo: periodoSeleccionado, 
        cambios: payloadEnvio,
        observaciones_alumnos: observacionesEnvio,
        usuario_id: user?.identifier || user?.email || "Docente Local" 
      });
      
      Swal.fire({ icon: 'success', title: '¡Guardado Exitoso!', text: `Se registraron ${response.data.total_cambios} actualizaciones en la base de datos.`, confirmButtonColor: '#1A237E' });
      setMateriaSeleccionada(prev => { const actual = prev; setMateriaSeleccionada(''); setTimeout(() => setMateriaSeleccionada(actual), 10); return prev; });
      
    } catch (error) {
      Swal.fire('Error', error.response?.data?.detail || 'Hubo un problema al guardar.', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const nombreDocentePDF = user?.full_name || user?.nombre_completo || user?.nombre || "DOCENTE TITULAR";

const handleExportPDF = () => {
    try {
      const doc = new jsPDF('landscape'); 
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const dibujarEncabezadoSesa = (pdf) => {
        pdf.setFillColor(11, 23, 42); pdf.rect(14, 15, 12, 12, 'F');
        pdf.setTextColor(255, 255, 255); pdf.setFontSize(16); pdf.setFont("helvetica", "bold"); 
        pdf.text("U", 20, 23.5, { align: "center" }); 
        
        pdf.setTextColor(26, 35, 126); pdf.setFontSize(16); pdf.text("UNID", 30, 20);
        pdf.setFontSize(8); pdf.setTextColor(100); pdf.setFont("helvetica", "normal"); 
        pdf.text("UNIVERSIDAD INTERAMERICANA PARA EL DESARROLLO", 30, 24);
        
        pdf.setTextColor(26, 35, 126); pdf.setFontSize(12); pdf.setFont("helvetica", "bold"); 
        pdf.text("REPORTE DE ASISTENCIA DOCENTE", pageWidth - 14, 20, { align: "right" });
        pdf.setFontSize(9); pdf.setTextColor(100); pdf.setFont("helvetica", "normal"); 
        pdf.text("Documento Oficial", pageWidth - 14, 24, { align: "right" });

        pdf.setDrawColor(242, 169, 0); pdf.setLineWidth(0.5); pdf.line(14, 28, pageWidth - 14, 28);
        
        pdf.setFontSize(7.5); pdf.setTextColor(150); pdf.setFont("helvetica", "bold");
        pdf.text("MATERIA", 14, 35); pdf.text("GRUPO", 120, 35); pdf.text("DOCENTE", 200, 35);
        pdf.text("PERIODO ACADÉMICO", 14, 45); pdf.text("FECHA DE GENERACIÓN", 120, 45); pdf.text("ID REPORTE", 200, 45);

        pdf.setTextColor(50); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8.5);
        const nombreMateriaStr = materiasOptions.find(o => o.id === materiaSeleccionada)?.label || "";
        const partes = nombreMateriaStr.split(' - ');
        const nombreMatLimpio = partes[0] ? partes[0].trim().toUpperCase() : "S/A";
        const grupoLimpio = partes[1] ? partes[1].trim() : "S/A";
        const codigoMateria = nombreMatLimpio.substring(0, 5);
        
        pdf.text(nombreMatLimpio, 14, 40);
        pdf.text(grupoLimpio, 120, 40);
        pdf.text(nombreDocentePDF.toUpperCase(), 200, 40);
        pdf.text(periodoSeleccionado || "S/A", 14, 50);
        pdf.text(new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase(), 120, 50);
        
        const reporteIDStr = `REPORTE-${periodoSeleccionado}-${codigoMateria}`;
        pdf.setTextColor(100); pdf.text(reporteIDStr, 200, 50);

        return codigoMateria;
      };

      const codigoMateria = materiasOptions.find(o => o.id === materiaSeleccionada)?.label?.split(' - ')[0]?.substring(0, 5) || "LISTA";
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
        head: [tableColumn], 
        body: tableRows, 
        startY: 55,
        theme: 'plain',
        horizontalPageBreak: true, 
        horizontalPageBreakRepeat: 0,
        margin: { top: 55, bottom: 25, left: 10, right: 10 }, 
        styles: { fontSize: 6.5, cellPadding: 1, textColor: [80, 80, 80] }, 
        headStyles: { 
          fillColor: [248, 249, 250], textColor: [26, 35, 126], fontStyle: 'bold', 
          lineWidth: 0.1, lineColor: [230, 230, 230], halign: 'center', valign: 'middle' 
        },
        bodyStyles: { lineWidth: 0.1, lineColor: [240, 240, 240] },
        columnStyles: { 
          0: { fontStyle: 'bold', cellWidth: 18, halign: 'center' }, 
          1: { cellWidth: 45 }, 
          [tableColumn.length - 2]: { fontStyle: 'bold', textColor: [26, 35, 126], halign: 'center', cellWidth: 12 }, 
          [tableColumn.length - 1]: { fontStyle: 'bold', textColor: [220, 38, 38], halign: 'center', cellWidth: 12 } 
        },
   
        
        didParseCell: function (data) {
          if (data.section === 'head' && data.column.index >= 2) data.cell.styles.halign = 'center';
          if (data.section === 'body') {
            const rawVal = data.cell.raw;
            if (rawVal === 'P') { 
              data.cell.text = ['4']; data.cell.styles.font = 'zapfdingbats'; 
              data.cell.styles.textColor = [34, 197, 94]; data.cell.styles.halign = 'center'; 
            } 
            else if (rawVal === 'F') { 
              data.cell.text = ['8']; data.cell.styles.font = 'zapfdingbats'; 
              data.cell.styles.textColor = [239, 68, 68]; data.cell.styles.halign = 'center'; 
            }
            else if (rawVal === 'R' || rawVal === 'J') { 
              data.cell.styles.textColor = [100, 100, 100]; data.cell.styles.fillColor = [245, 245, 245]; 
              data.cell.styles.fontStyle = 'bold'; data.cell.styles.halign = 'center'; 
            }
            else if (rawVal === '-') { 
              data.cell.styles.textColor = [200, 200, 200]; data.cell.styles.halign = 'center'; 
            }
          }
        },
   
        
        didDrawPage: function (data) {
          dibujarEncabezadoSesa(doc);

          const footerY = pageHeight - 15;
          
          doc.setFontSize(7); 
          doc.setFont("zapfdingbats"); doc.setTextColor(34, 197, 94); doc.text("4", 14, footerY); 
          doc.setFont("helvetica", "normal"); doc.setTextColor(150); doc.text(" Presente", 17, footerY);

          doc.setFont("zapfdingbats"); doc.setTextColor(239, 68, 68); doc.text("8", 35, footerY); 
          doc.setFont("helvetica", "normal"); doc.text(" Falta", 38, footerY);
          
          doc.setFont("helvetica", "bold"); doc.setTextColor(150); doc.text("R", 52, footerY);
          doc.setFont("helvetica", "normal"); doc.text(" Retardo", 55, footerY);

          doc.setFont("helvetica", "bold"); doc.text("J", 72, footerY);
          doc.setFont("helvetica", "normal"); doc.text(" Justificante", 75, footerY);

          doc.setFontSize(7); doc.setTextColor(150);
          doc.text("SISTEMA ACADÉMICO SESA UNID - DOCUMENTO OFICIAL DE CONTROL ESCOLAR", 14, footerY + 5);
          doc.text(`Página ${data.pageNumber}`, pageWidth - 20, footerY + 5, { align: 'right' });
        }
      });

      doc.save(`Lista_Asistencia_${codigoMateria}.pdf`);
    } catch (error) { 
      console.error(error);
      Swal.fire('Error', 'No se pudo generar el documento PDF.', 'error'); 
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-6 font-sans relative">
      
      {celdaEditando && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-[340px] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex justify-between items-start bg-white">
              <div className="pr-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Modificar Asistencia</p>
                <h3 className="text-[15px] font-bold text-[#1A237E] leading-tight">{celdaEditando.alumno.nombre}</h3>
                <p className="text-[11px] text-gray-500 mt-1.5 font-medium">Clase del día <span className="font-bold text-gray-800">{formatearFechaMes(celdaEditando.fecha)}</span></p>
              </div>
              <button onClick={() => setCeldaEditando(null)} className="text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-2 bg-gray-50/50">
              {Object.entries(ESTADOS_EDICION).map(([val, data]) => {
                const isSelected = celdaEditando.estadoActual === val;
                return (
                  <button key={val} onClick={() => manejarSeleccionEstado(celdaEditando.alumno, celdaEditando.fecha, val)} className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${isSelected ? `ring-2 ring-offset-2 ring-[#1A237E]/20 ${data.bg} ${data.color}` : `bg-white border-gray-200 hover:border-[#1A237E]/30 hover:bg-white text-gray-600 shadow-sm`}`}>
                    <span className={`text-lg font-black ${data.color}`}>{data.label}</span>
                    <span className="text-[10px] font-bold">{data.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative z-10">
        
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

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4 border-b pb-6">
          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            
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
                <div onClick={() => handleSelectCarrera('')} className={`px-4 py-3 text-sm cursor-pointer transition-colors border-b border-gray-50 ${carreraSeleccionada === '' ? 'bg-blue-50 text-[#1A237E] font-bold' : 'text-gray-700 hover:bg-gray-50'}`}>
                  Todas las Carreras
                </div>
                {carrerasOptions.map(carrera => (
                  <div key={carrera} onClick={() => handleSelectCarrera(carrera)} className={`px-4 py-3 text-sm cursor-pointer transition-colors border-b border-gray-50 last:border-none ${carreraSeleccionada === carrera ? 'bg-blue-50 text-[#1A237E] font-bold' : 'text-gray-700 hover:bg-gray-50'}`}>
                    {carrera}
                  </div>
                ))}
              </div>
            </div>

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
                  <div key={opt.id} onClick={() => { setMateriaSeleccionada(opt.id); setIsDropdownMateriaOpen(false); }} className={`px-4 py-3 text-sm cursor-pointer transition-colors border-b border-gray-50 last:border-none ${materiaSeleccionada === opt.id ? 'bg-blue-50 text-[#1A237E] font-bold' : 'text-gray-700 hover:bg-gray-50 hover:text-blue-700'}`}>
                    {opt.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Buscar Alumno</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Nombre o matrícula..." value={busqueda} onChange={handleBusquedaChange} className="h-[38px] pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-[#1A237E] focus:border-[#1A237E] w-[200px] transition-all" />
              </div>
            </div>
            
            <div className="flex flex-col">
               <label className="text-[11px] font-bold text-transparent uppercase tracking-wider mb-1 hidden lg:block">.</label>
               <button onClick={() => setModoEdicion(!modoEdicion)} disabled={isSoloLectura || alumnos.length === 0} className={`h-[38px] flex items-center px-4 py-2 text-sm font-bold rounded-lg border transition-all disabled:opacity-50 ${modoEdicion ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-inner' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                 <Edit3 className="w-4 h-4 mr-2" /> {modoEdicion ? 'Cerrar Edición' : 'Editar Lista'}
               </button>
            </div>
          </div>
          
          <div className="flex flex-col shrink-0 self-end lg:self-auto mt-2 lg:mt-0">
            <label className="text-[11px] font-bold text-transparent uppercase tracking-wider mb-1 hidden lg:block">.</label>
            <div className="flex gap-3">
              <button 
                onClick={handleExportPDF} 
                disabled={!materiaSeleccionada || alumnos.length === 0 || hayCambiosSinGuardar} 
                title={hayCambiosSinGuardar ? "Guarda los cambios pendientes antes de exportar" : "Exportar lista a PDF"}
                className="h-[38px] flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 hover:text-[#1A237E] hover:border-[#1A237E] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4 mr-2" /> Exportar PDF
              </button>
              <button onClick={handleGuardar} disabled={guardando || !materiaSeleccionada || isSoloLectura || !hayCambiosSinGuardar} className="h-[38px] flex items-center px-5 py-2 bg-[#1A237E] text-white rounded-lg text-sm font-bold hover:bg-[#283593] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                {guardando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {guardando ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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

        {/* 🌟 SPRINT 8: PESTAÑAS POR MES */}
        <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-gray-800 flex items-center">Selecciona el mes a evaluar:</h3>
                <div className="text-[11px] font-bold text-gray-500 flex items-center gap-1.5"><CalendarClock className="w-4 h-4 text-[#1A237E]" /> Horario: {infoDias || "Cargando..."}</div>
            </div>
            <div className="flex gap-2 border-b border-gray-200 overflow-x-auto custom-scrollbar">
                {mesesDisponibles.map((mesNum) => {
                    const isSelected = mesSeleccionado === mesNum;
                    return (
                        <button key={mesNum} onClick={() => setMesSeleccionado(mesNum)} className={`px-6 py-2.5 text-sm font-bold border-b-2 transition-colors ${isSelected ? 'border-[#1A237E] text-[#1A237E]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                            {NOMBRES_MESES[parseInt(mesNum, 10) - 1]}
                        </button>
                    );
                })}
            </div>
        </div>

        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2"><span className="w-6 h-6 flex items-center justify-center rounded bg-green-50 text-green-600 font-bold text-xs border border-green-200">✓</span><span className="text-xs text-gray-600 font-medium">Presente</span></div>
            <div className="flex items-center gap-2"><span className="w-6 h-6 flex items-center justify-center rounded bg-red-50 text-red-600 font-bold text-xs border border-red-200">X</span><span className="text-xs text-gray-600 font-medium">Falta</span></div>
            <div className="flex items-center gap-2"><span className="w-6 h-6 flex items-center justify-center rounded bg-amber-50 text-amber-600 font-bold text-xs border border-amber-200">R</span><span className="text-xs text-gray-600 font-medium">Retardo</span></div>
            <div className="flex items-center gap-2"><span className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 text-slate-600 font-bold text-xs border border-slate-300">J</span><span className="text-xs text-gray-600 font-medium">Justificante</span></div>
          </div>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm custom-scrollbar z-10 relative max-h-[600px]" ref={tableContainerRef}>
          {cargando ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#1A237E]"><Loader2 className="w-10 h-10 animate-spin mb-4" /><p className="font-bold">Cargando datos de la base de datos...</p></div>
          ) : !mesSeleccionado ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400"><CalendarDays className="w-12 h-12 mb-3 opacity-50" /><p className="font-semibold text-gray-600">No hay clases programadas.</p></div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 text-[11px] uppercase font-bold border-b border-gray-200 sticky top-0 z-30 shadow-sm">
                <tr>
                  <th className="py-4 px-2 border-r border-gray-200 text-center w-[48px] min-w-[48px] max-w-[48px] sticky left-0 z-40 bg-gray-50">No.</th>
                  <th className="py-4 px-4 border-r border-gray-200 w-[96px] min-w-[96px] max-w-[96px] tracking-wider sticky left-[48px] z-40 bg-gray-50">Matrícula</th>
                  <th className="py-4 px-4 border-r border-gray-200 w-[320px] min-w-[320px] max-w-[320px] tracking-wider sticky left-[144px] z-40 bg-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Nombre del Alumno</th>
                  <th className="py-4 px-2 border-r border-gray-200 text-center w-[80px] min-w-[80px] max-w-[80px] leading-tight bg-gray-50">Faltas<br/>Totales</th>
                  
                  {/* 🌟 CELDAS FILTRADAS POR MES */}
                  {fechasDelMes.map((fecha) => {
                    const numSesionReal = fechasClase.indexOf(fecha) + 1;
                    const alumnosPendientes = alumnosFiltrados.filter(a => !a.asistencias[fecha]);
                    const tieneSinGuardar = alumnosPendientes.length > 0;
                    const esActiva = fecha <= hoy && !isSoloLectura && tieneSinGuardar && !modoEdicion;
                    const todosMarcados = esActiva && alumnosPendientes.every(a => cambiosPendientes[`${a.matricula}_${fecha}`]?.estado === 'P');

                    return (
                      <th key={fecha} className={`py-2 px-2 border-r border-gray-200 text-center min-w-[60px] ${esActiva ? 'bg-blue-100/50' : 'bg-gray-50'}`}>
                        <div className="flex flex-col items-center justify-center min-w-[55px]">
                          <span className="text-[8px] font-bold text-gray-400 uppercase mb-0.5 tracking-wider">Sesión {numSesionReal}</span>
                          <span className={`text-[10px] whitespace-nowrap tracking-widest font-black ${esActiva ? 'text-[#1A237E]' : 'text-gray-500'}`}>{formatearFechaMes(fecha)}</span>
                          {esActiva && <input type="checkbox" checked={todosMarcados} onChange={(e) => toggleColumna(fecha, e)} className="mt-1.5 w-4 h-4 accent-green-600 text-green-600 rounded cursor-pointer" />}
                        </div>
                      </th>
                    );
                  })}
                  <th className="py-4 px-3 text-center min-w-[80px] bg-gray-50">Notas</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 text-gray-700 bg-white">
                {alumnosFiltrados.length > 0 ? (
                  alumnosFiltrados.map((alumno, idx) => {
                    
                    const faltasTotales = fechasClase.filter(f => {
                      if (f <= hoy && alumno.asistencias[f]) {
                        const estFinal = cambiosPendientes[`${alumno.matricula}_${f}`]?.estado !== undefined 
                                         ? cambiosPendientes[`${alumno.matricula}_${f}`].estado 
                                         : alumno.asistencias[f];
                        return estFinal === 'F';
                      }
                      return false;
                    }).length;

                    return (
                      <tr key={alumno.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="py-2 px-2 text-center border-r border-gray-100 text-gray-400 font-bold sticky left-0 bg-white z-20 shadow-[1px_0_0_0_#f3f4f6] align-middle w-[48px] min-w-[48px] max-w-[48px] group-hover:bg-blue-50/30">{idx + 1}</td>
                        <td className="py-2 px-4 border-r border-gray-100 font-mono text-gray-500 sticky left-[48px] bg-white z-20 shadow-[1px_0_0_0_#f3f4f6] align-middle w-[96px] min-w-[96px] max-w-[96px] group-hover:bg-blue-50/30">{alumno.matricula}</td>
                        
                        <td className="py-2 px-4 border-r border-gray-100 font-bold text-gray-800 sticky left-[144px] bg-white z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-[320px] min-w-[320px] max-w-[320px] align-middle group-hover:bg-blue-50/30">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-[#1A237E]/10 flex items-center justify-center text-[#1A237E] font-black text-xs shrink-0">
                              {alumno.nombre.charAt(0)}
                            </div>
                            <div className="flex flex-col whitespace-normal break-words py-1 w-full">
                              <span className="leading-tight text-xs sm:text-sm">{alumno.nombre}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-2 px-2 border-r border-gray-100 text-center align-middle w-[80px] min-w-[80px] max-w-[80px]">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-bold text-sm ${faltasTotales > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{faltasTotales}</span>
                        </td>

                        {fechasDelMes.map(fecha => {
                          const registroBD = alumno.asistencias[fecha];
                          const cambioPendiente = cambiosPendientes[`${alumno.matricula}_${fecha}`]?.estado;

                          if (fecha > hoy || (!registroBD && isSoloLectura)) {
                            return <td key={fecha} className="p-1 border-r border-gray-100 text-center align-middle bg-gray-50/30"><div className="w-3 h-px bg-gray-300 mx-auto"></div></td>;
                          }

                          if (!registroBD) {
                            const isChecked = cambioPendiente === 'P'; 
                            return (
                              <td key={fecha} className="p-1 border-r border-gray-100 text-center align-middle bg-blue-50/20">
                                <input 
                                  type="checkbox" 
                                  checked={isChecked} 
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      registrarCambio(alumno.matricula, fecha, 'P');
                                    } else {
                                      setCambiosPendientes(prev => {
                                        const nuevos = { ...prev };
                                        delete nuevos[`${alumno.matricula}_${fecha}`];
                                        return nuevos;
                                      });
                                    }
                                  }} 
                                  className="w-5 h-5 accent-green-600 text-green-600 rounded cursor-pointer shadow-sm" 
                                />
                              </td>
                            );
                          }

                          let estadoVisual = cambioPendiente !== undefined ? cambioPendiente : registroBD;
                          const estilo = ESTADOS[estadoVisual];

                          return (
                            <td key={fecha} className="p-1 border-r border-gray-100 text-center align-middle relative">
                              {modoEdicion ? (
                                <button onClick={() => setCeldaEditando({ alumno, fecha, estadoActual: estadoVisual })} className={`w-full h-8 flex items-center justify-center font-bold text-xs rounded border border-dashed transition-colors hover:border-amber-400 ${estilo.bg} ${estilo.color}`}>
                                  {estilo.label}
                                </button>
                              ) : (
                                <div
                                  onClick={() => {
                                    if (estadoVisual === 'J') {
                                      const motivo = alumno.justificaciones?.[fecha] || "Sin motivo registrado en el sistema.";
                                      Swal.fire({ title: 'Justificación', text: motivo, icon: 'info', confirmButtonColor: '#1A237E' });
                                    }
                                  }}
                                  className={`mx-auto w-8 h-8 flex items-center justify-center font-bold text-xs rounded border ${estilo.bg} ${estilo.color} ${estadoVisual === 'J' ? 'cursor-pointer hover:ring-2 hover:ring-slate-300' : ''}`}
                                  title={estadoVisual === 'J' ? 'Ver motivo' : ''}
                                >
                                  {estilo.label}
                                </div>
                              )}
                            </td>
                          );
                        })}

                        <td className="py-2 px-3 text-center align-middle min-w-[80px]">
                          <button className={`transition-colors ${alumno.observaciones ? 'text-[#1A237E]' : 'text-gray-400 hover:text-[#1A237E]'}`} title="Notas Generales" onClick={() => mostrarObservaciones(alumno)}>
                            <MessageSquareText className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5 + fechasDelMes.length} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <Search className="w-10 h-10 mb-3 opacity-50" />
                        <p className="font-semibold text-gray-600">No se encontraron datos.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherAttendance;