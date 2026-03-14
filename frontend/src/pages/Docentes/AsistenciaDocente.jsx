import React, { useState, useEffect, useRef } from 'react';
import { Download, Save, Search, MessageSquareText, Users, CalendarDays, CheckCircle, XCircle, BookOpen, ChevronDown } from 'lucide-react';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const FECHAS_CLASE = ['01', '02', '03', '04', '05', '08', '09', '10', '11', '12', '15', '16'];

const materiasOptions = [
  { id: '1', label: '11607 - Ingeniería de Software II (8vo A)' },
  { id: '2', label: '11608 - Desarrollo de Aplicaciones (8vo B)' }
];

// Opciones de asistencia para iterar con clics
const ESTADOS = {
  P: { label: '✓', color: 'text-green-600', bg: 'bg-green-50 hover:bg-green-100 border-green-200' },
  F: { label: 'X', color: 'text-red-600', bg: 'bg-red-50 hover:bg-red-100 border-red-200' },
  R: { label: 'R', color: 'text-amber-600', bg: 'bg-amber-50 hover:bg-amber-100 border-amber-200' },
  J: { label: 'J', color: 'text-slate-600', bg: 'bg-slate-100 hover:bg-slate-200 border-slate-300' }
};

const AsistenciaDocente = () => {
  const [materiaSeleccionada, setMateriaSeleccionada] = useState('1');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const dropdownRef = useRef(null);
  
  // Datos MOCK actualizados para manejar 4 estados ('P', 'F', 'R', 'J')
  const [alumnos, setAlumnos] = useState([
    { id: 1, matricula: '00349120', nombre: 'ALVARADO PÉREZ, SOFÍA', programa: 'Ing. Software', asistencias: { '01': 'P', '02': 'P', '03': 'P', '04': 'P', '05': 'P', '08': 'F', '09': 'P', '10': 'P', '11': 'P', '12': 'P', '15': 'P', '16': 'P' }, observaciones: '' },
    { id: 2, matricula: '00349125', nombre: 'BENÍTEZ LÓPEZ, CARLOS', programa: 'Ing. Software', asistencias: { '01': 'P', '02': 'P', '03': 'P', '04': 'P', '05': 'P', '08': 'P', '09': 'P', '10': 'P', '11': 'P', '12': 'P', '15': 'P', '16': 'P' }, observaciones: '' },
    { id: 3, matricula: '00349132', nombre: 'CASTILLO MENDOZA, ANA', programa: 'Ing. Software', asistencias: { '01': 'P', '02': 'F', '03': 'P', '04': 'P', '05': 'F', '08': 'P', '09': 'R', '10': 'P', '11': 'P', '12': 'P', '15': 'P', '16': 'J' }, observaciones: 'Justificante médico el 16' },
    { id: 4, matricula: '00349140', nombre: 'DÍAZ RAMÍREZ, JORGE', programa: 'Ing. Software', asistencias: { '01': 'P', '02': 'R', '03': 'P', '04': 'P', '05': 'P', '08': 'P', '09': 'P', '10': 'P', '11': 'P', '12': 'P', '15': 'P', '16': 'P' }, observaciones: '' },
    { id: 5, matricula: '00349145', nombre: 'ESTRADA RUIZ, MARÍA', programa: 'Ing. Software', asistencias: { '01': 'P', '02': 'P', '03': 'P', '04': 'P', '05': 'P', '08': 'P', '09': 'P', '10': 'P', '11': 'P', '12': 'P', '15': 'P', '16': 'P' }, observaciones: '' },
    { id: 6, matricula: '00349150', nombre: 'FERNÁNDEZ GÓMEZ, LUIS', programa: 'Ing. Software', asistencias: { '01': 'F', '02': 'F', '03': 'P', '04': 'P', '05': 'P', '08': 'P', '09': 'P', '10': 'P', '11': 'J', '12': 'P', '15': 'P', '16': 'P' }, observaciones: '' },
    { id: 7, matricula: '00349158', nombre: 'GARCÍA TORRES, PEDRO', programa: 'Ing. Software', asistencias: { '01': 'P', '02': 'P', '03': 'P', '04': 'P', '05': 'P', '08': 'P', '09': 'P', '10': 'P', '11': 'P', '12': 'P', '15': 'P', '16': 'P' }, observaciones: '' },
  ]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const alumnosFiltrados = alumnos.filter(a => a.nombre.toLowerCase().includes(busqueda.toLowerCase()) || a.matricula.includes(busqueda));

  // --- LÓGICA DE INTERACCIÓN ---
  // Solo consideramos como "Falta" (para restar del total) cuando el estado es estrictamente 'F'
  const calcularFaltas = (asistencias) => FECHAS_CLASE.filter(fecha => asistencias[fecha] === 'F').length;

  const totalAlumnos = alumnosFiltrados.length;
  const totalClases = FECHAS_CLASE.length;
  let asistenciasGlobales = 0;
  let faltasGlobales = 0;
  alumnosFiltrados.forEach(a => {
    const faltas = calcularFaltas(a.asistencias);
    faltasGlobales += faltas;
    asistenciasGlobales += (totalClases - faltas);
  });

  // Función para rotar entre los 4 estados al hacer clic
  const cicloAsistencia = (estadoActual) => {
    if (estadoActual === 'P') return 'F';
    if (estadoActual === 'F') return 'R';
    if (estadoActual === 'R') return 'J';
    return 'P';
  };

  const handleToggleCell = (idAlumno, fecha) => {
    setAlumnos(prev => prev.map(a => {
      if (a.id === idAlumno) {
        const estadoActual = a.asistencias[fecha] || 'P';
        return { ...a, asistencias: { ...a.asistencias, [fecha]: cicloAsistencia(estadoActual) } };
      }
      return a;
    }));
  };

  const toggleColumnaDia = (fecha) => {
    const todosPresentes = alumnosFiltrados.every(a => a.asistencias[fecha] === 'P');
    setAlumnos(prev => prev.map(a => ({ ...a, asistencias: { ...a.asistencias, [fecha]: todosPresentes ? 'F' : 'P' } })));
  };

  const mostrarObservaciones = (alumno) => {
    Swal.fire({
      title: `Observaciones`,
      html: `<b>${alumno.nombre}</b><br><br>Ingrese nota o justificante:`,
      input: 'textarea',
      inputValue: alumno.observaciones,
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1A237E'
    }).then((result) => {
      if (result.isConfirmed) {
        setAlumnos(prev => prev.map(a => a.id === alumno.id ? { ...a, observaciones: result.value } : a));
      }
    });
  };

  const handleGuardar = () => {
    Swal.fire({ icon: 'success', title: 'Guardado', text: 'La lista de asistencia se ha sincronizado correctamente.', confirmButtonColor: '#1A237E' });
  };

  // --- PDF CLON EXACTO DEL DISEÑO HU-15 ---
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF('landscape'); 
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      doc.setFillColor(11, 23, 42); 
      doc.rect(14, 15, 10, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("U", 16.5, 22);

      doc.setTextColor(26, 35, 126);
      doc.setFontSize(16);
      doc.text("UNID", 28, 20);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.setFont("helvetica", "normal");
      doc.text("UNIVERSIDAD INTERAMERICANA PARA EL DESARROLLO", 28, 24);

      doc.setTextColor(26, 35, 126);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("REPORTE DE ASISTENCIA DOCENTE", pageWidth - 14, 20, { align: "right" });
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.setFont("helvetica", "normal");
      doc.text("Documento Oficial", pageWidth - 14, 24, { align: "right" });

      doc.setDrawColor(242, 169, 0);
      doc.setLineWidth(0.5);
      doc.line(14, 28, pageWidth - 14, 28);

      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.setFont("helvetica", "bold");
      doc.text("MATERIA", 14, 35);
      doc.text("GRUPO", 100, 35);
      doc.text("DOCENTE", 180, 35);

      doc.text("PERIODO ACADÉMICO", 14, 45);
      doc.text("FECHA DE GENERACIÓN", 100, 45);
      doc.text("ID REPORTE", 180, 45);

      doc.setTextColor(50);
      doc.setFont("helvetica", "bold");
      const nombreMateriaStr = materiasOptions.find(o => o.id === materiaSeleccionada)?.label || "";
      doc.text(nombreMateriaStr.split('-')[1]?.split('(')[0]?.trim().toUpperCase() || "S/A", 14, 40);
      doc.text(nombreMateriaStr.match(/\(([^)]+)\)/)?.[1] || "S/A", 100, 40);
      doc.text("DR. ROBERTO MÉNDEZ GARCÍA", 180, 40);

      doc.text("SEPTIEMBRE - DICIEMBRE 2026", 14, 50);
      doc.text(new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase(), 100, 50);
      doc.setTextColor(180);
      doc.text("REP-2026-8921", 180, 50);

      const tableColumn = ["MATRÍCULA", "NOMBRE DEL ALUMNO", ...FECHAS_CLASE, "ASIST.", "FALTAS"];
      const tableRows = alumnosFiltrados.map(a => {
        // Mapeamos el estado del objeto al símbolo para el PDF
        const asistenciasFila = FECHAS_CLASE.map(fecha => {
          const estado = a.asistencias[fecha] || 'P';
          if (estado === 'P') return '✓';
          if (estado === 'F') return 'X';
          return estado; // 'R' o 'J'
        });
        
        const faltas = calcularFaltas(a.asistencias);
        const asistenciasTotal = FECHAS_CLASE.length - faltas;
        return [a.matricula, a.nombre, ...asistenciasFila, asistenciasTotal.toString(), faltas.toString()];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 55,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 3, textColor: [80, 80, 80] },
        headStyles: { fillColor: [248, 249, 250], textColor: [26, 35, 126], fontStyle: 'bold', lineWidth: 0.1, lineColor: [230, 230, 230] },
        bodyStyles: { lineWidth: 0.1, lineColor: [240, 240, 240] },
        columnStyles: {
          0: { fontStyle: 'bold' },
          [tableColumn.length - 2]: { fontStyle: 'bold', textColor: [26, 35, 126], halign: 'center' }, 
          [tableColumn.length - 1]: { fontStyle: 'bold', textColor: [220, 38, 38], halign: 'center' }  
        },
        didParseCell: function (data) {
          if (data.section === 'head' && data.column.index >= 2) data.cell.styles.halign = 'center';
          if (data.section === 'head' && data.column.index === tableColumn.length - 1) data.cell.styles.textColor = [220, 38, 38];
          
          if (data.section === 'body') {
            if (data.column.index >= 2 && data.column.index <= tableColumn.length - 3) {
               data.cell.styles.halign = 'center';
               // Asignar colores según letra en el PDF
               if (data.cell.raw === '✓') { 
                 data.cell.styles.textColor = [34, 197, 94]; 
               } else if (data.cell.raw === 'X') { 
                 data.cell.styles.textColor = [239, 68, 68]; 
               } else if (data.cell.raw === 'R' || data.cell.raw === 'J') {
                 data.cell.styles.textColor = [100, 100, 100];
                 data.cell.styles.fillColor = [235, 235, 235];
                 data.cell.styles.fontStyle = 'bold';
               }
            }
          }
        }
      });

      const finalY = doc.lastAutoTable.finalY + 8;
      
      doc.setTextColor(34, 197, 94); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text("✓", 14, finalY);
      doc.setTextColor(150); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text("Asistencia (Presente)", 18, finalY);

      doc.setTextColor(239, 68, 68); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text("X", 52, finalY);
      doc.setTextColor(150); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text("Falta (Ausencia Injustificada)", 56, finalY);

      doc.setFillColor(235, 235, 235); doc.rect(102, finalY - 3.5, 4.5, 4.5, 'F');
      doc.setTextColor(100); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
      doc.text("R", 103, finalY);
      doc.setTextColor(150); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text("Retardo", 108, finalY);

      doc.setFillColor(235, 235, 235); doc.rect(125, finalY - 3.5, 4.5, 4.5, 'F');
      doc.setTextColor(100); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
      doc.text("J", 126.2, finalY);
      doc.setTextColor(150); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text("Justificante", 131, finalY);

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.setFont("helvetica", "normal");
        doc.text("Documento generado por el Sistema Académico UNID", 14, pageHeight - 12);
        doc.setFontSize(7);
        doc.setTextColor(180);
        doc.text("La información contenida en este reporte es confidencial y para uso exclusivo de la institución.", 14, pageHeight - 8);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
      }

      doc.save(`Lista_Asistencia_Oficial.pdf`);
    } catch (error) {
      console.error("Error generando PDF:", error);
      Swal.fire('Error', 'No se pudo generar el documento PDF.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-6 font-sans">
      <div className="max-w-[1400px] mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        
        {/* Controles Superiores Modernos */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b pb-6">
          <div className="flex flex-wrap items-center gap-6 w-full md:w-auto">
            
            <div className="flex flex-col">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Periodo</label>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <CalendarDays className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">Sep-Dic 2026</span>
              </div>
            </div>

            <div className="flex flex-col relative z-20" ref={dropdownRef}>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Materia y Grupo</label>
              <div 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`relative flex items-center justify-between w-[320px] px-3 py-2 border rounded-lg text-sm bg-white font-semibold cursor-pointer transition-all ${isDropdownOpen ? 'border-[#1A237E] ring-2 ring-[#1A237E]/20 text-[#1A237E]' : 'border-gray-300 text-gray-800 hover:border-gray-400'}`}
              >
                <div className="flex items-center gap-2 truncate">
                  <BookOpen className={`w-4 h-4 flex-shrink-0 ${isDropdownOpen ? 'text-[#1A237E]' : 'text-gray-400'}`} />
                  <span className="truncate">{materiasOptions.find(o => o.id === materiaSeleccionada)?.label}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ml-2 ${isDropdownOpen ? 'rotate-180 text-[#1A237E]' : ''}`} />
              </div>
              
              <div className={`absolute top-full mt-1.5 w-full bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden transition-all duration-200 origin-top ${isDropdownOpen ? 'opacity-100 scale-y-100 visible' : 'opacity-0 scale-y-95 invisible'}`}>
                {materiasOptions.map(opt => (
                  <div 
                    key={opt.id}
                    onClick={() => { setMateriaSeleccionada(opt.id); setIsDropdownOpen(false); }}
                    className={`px-4 py-3 text-sm cursor-pointer transition-colors border-b border-gray-50 last:border-none ${materiaSeleccionada === opt.id ? 'bg-blue-50 text-[#1A237E] font-bold' : 'text-gray-700 hover:bg-gray-50 hover:text-blue-700'}`}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Buscar Alumno</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Nombre o matrícula..." 
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1A237E] focus:border-[#1A237E] w-64 transition-all" 
                />
              </div>
            </div>

          </div>
          
          <div className="flex gap-3 shrink-0">
            <button onClick={handleExportPDF} className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 hover:text-[#1A237E] hover:border-[#1A237E] transition-all shadow-sm">
              <Download className="w-4 h-4 mr-2" /> Exportar PDF
            </button>
            <button onClick={handleGuardar} className="flex items-center px-5 py-2 bg-[#1A237E] text-white rounded-lg text-sm font-bold hover:bg-[#283593] transition-colors shadow-sm">
              <Save className="w-4 h-4 mr-2" /> Guardar Lista
            </button>
          </div>
        </div>

        {/* Leyenda Visual Integrada */}
        <div className="flex items-center gap-6 mb-4 px-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 flex items-center justify-center rounded bg-green-50 text-green-600 font-bold text-xs border border-green-200">✓</span>
            <span className="text-xs text-gray-600 font-medium">Presente</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 flex items-center justify-center rounded bg-red-50 text-red-600 font-bold text-xs border border-red-200">X</span>
            <span className="text-xs text-gray-600 font-medium">Falta</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 flex items-center justify-center rounded bg-amber-50 text-amber-600 font-bold text-xs border border-amber-200">R</span>
            <span className="text-xs text-gray-600 font-medium">Retardo</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 text-slate-600 font-bold text-xs border border-slate-300">J</span>
            <span className="text-xs text-gray-600 font-medium">Justificante</span>
          </div>
        </div>

        {/* TABLA SÁBANA (DISEÑO MODERNO) */}
        <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm custom-scrollbar z-10 relative">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 text-[11px] uppercase font-bold border-b border-gray-200">
              <tr>
                <th className="py-4 px-4 text-center border-r border-gray-200 w-12">No.</th>
                <th className="py-4 px-4 border-r border-gray-200 w-24 tracking-wider">Matrícula</th>
                <th className="py-4 px-4 border-r border-gray-200 min-w-[250px] tracking-wider">Nombre del Alumno</th>
                <th className="py-4 px-3 border-r border-gray-200 text-center w-20 leading-tight">Faltas<br/>Totales</th>
                <th className="py-4 px-3 border-r border-gray-200 text-center w-16">Notas</th>
                
                {/* Columnas Dinámicas de Fechas */}
                {FECHAS_CLASE.map(fecha => (
                  <th key={fecha} className="py-2 px-2 border-r border-gray-200 text-center min-w-[50px] group bg-white/50 hover:bg-gray-100 transition-colors cursor-pointer select-none" onClick={() => toggleColumnaDia(fecha)} title="Haz clic para marcar/desmarcar toda la columna">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[10px] tracking-widest text-[#1A237E] font-black">{fecha}</span>
                      <span className="text-[8px] text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Alternar</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 text-gray-700 bg-white">
              {alumnosFiltrados.length > 0 ? (
                alumnosFiltrados.map((alumno, idx) => {
                  const faltasTotales = calcularFaltas(alumno.asistencias);

                  return (
                    <tr key={alumno.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3 px-4 text-center border-r border-gray-100 text-gray-400 font-bold">{idx + 1}</td>
                      <td className="py-3 px-4 border-r border-gray-100 font-mono text-gray-500">{alumno.matricula}</td>
                      <td className="py-3 px-4 border-r border-gray-100 font-bold text-gray-800 flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-[#1A237E]/10 flex items-center justify-center text-[#1A237E] font-black text-xs">
                          {alumno.nombre.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span>{alumno.nombre}</span>
                          <span className="text-[9px] text-gray-400 font-medium uppercase tracking-widest mt-0.5">{alumno.programa}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 border-r border-gray-100 text-center">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-bold text-sm ${faltasTotales > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                          {faltasTotales}
                        </span>
                      </td>
                      <td className="py-3 px-3 border-r border-gray-100 text-center">
                        <button 
                          onClick={() => mostrarObservaciones(alumno)}
                          className={`p-2 rounded-lg transition-colors ${alumno.observaciones ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'text-gray-400 hover:bg-gray-100 hover:text-[#1A237E]'}`}
                          title={alumno.observaciones || "Añadir observación"}
                        >
                          <MessageSquareText className="w-4 h-4" />
                        </button>
                      </td>

                      {/* Renderizado Dinámico de las celdas (Ruta entre P, F, R, J) */}
                      {FECHAS_CLASE.map(fecha => {
                        const estadoActual = alumno.asistencias[fecha] || 'P';
                        const estilo = ESTADOS[estadoActual];

                        return (
                          <td key={fecha} className="p-1 border-r border-gray-100 text-center align-middle">
                            <button
                              onClick={() => handleToggleCell(alumno.id, fecha)}
                              className={`w-full h-10 flex items-center justify-center font-bold text-sm rounded border transition-colors ${estilo.bg} ${estilo.color}`}
                              title={`Clic para cambiar estado (Actual: ${estilo.label})`}
                            >
                              {estilo.label}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5 + FECHAS_CLASE.length} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <Search className="w-10 h-10 mb-3 opacity-50" />
                      <p className="font-semibold text-gray-600">No se encontraron alumnos.</p>
                      <p className="text-sm mt-1">Verifica los filtros de búsqueda.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

export default AsistenciaDocente;