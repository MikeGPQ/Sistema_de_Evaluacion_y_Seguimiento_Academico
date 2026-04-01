import { useState, useEffect, useRef } from 'react';
import { Search, Users, AlertTriangle, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, Loader2, GraduationCap, BookOpen, CalendarDays, FileSpreadsheet, FileText, Filter } from 'lucide-react';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import client from '../lib/axios';

export default function ReporteAsistencia() {
  const [filtrosData, setFiltrosData] = useState(null);
  const [materiasGruposOptions, setMateriasGruposOptions] = useState([]);

  const [nivelSeleccionado, setNivelSeleccionado] = useState('');
  const [programaSeleccionado, setProgramaSeleccionado] = useState('');
  const [cuatrimestreSeleccionado, setCuatrimestreSeleccionado] = useState('');
  const [materiaGrupoSeleccionado, setMateriaGrupoSeleccionado] = useState('');
  const [cuatrimestreBloqueado, setCuatrimestreBloqueado] = useState(false);

  const [isDropdownNivelOpen, setIsDropdownNivelOpen] = useState(false);
  const [isDropdownProgramaOpen, setIsDropdownProgramaOpen] = useState(false);
  const [isDropdownCuatrimestreOpen, setIsDropdownCuatrimestreOpen] = useState(false);
  const [isDropdownMateriaOpen, setIsDropdownMateriaOpen] = useState(false);

  const dropdownNivelRef = useRef(null);
  const dropdownProgramaRef = useRef(null);
  const dropdownCuatrimestreRef = useRef(null);
  const dropdownMateriaRef = useRef(null);

  const [data, setData] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [cargandoFiltros, setCargandoFiltros] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    const fetchFiltros = async () => {
      try {
        const res = await client.get('/asistencia/reporte/filtros');
        setFiltrosData(res.data);
      } catch (error) {
        console.error('Error al cargar filtros:', error);
        Swal.fire('Error', 'No se pudieron cargar los filtros del reporte.', 'error');
      } finally {
        setCargando(false);
      }
    };
    fetchFiltros();
  }, []);

  useEffect(() => {
    if (!filtrosData) return;
    const fetchMateriasGrupos = async () => {
      setCargandoFiltros(true);
      try {
        const params = {};
        if (nivelSeleccionado) params.nivel_academico = nivelSeleccionado;
        if (programaSeleccionado === 'tronco_comun') {
          params.tronco_comun = true;
        } else if (programaSeleccionado && programaSeleccionado !== '') {
          params.carrera_id = programaSeleccionado;
        }
        if (cuatrimestreSeleccionado && !cuatrimestreBloqueado) {
          params.cuatrimestre_id = cuatrimestreSeleccionado;
        }
        const res = await client.get('/asistencia/reporte/materias-grupos', { params });
        setMateriasGruposOptions(res.data);
      } catch (error) {
        console.error('Error al cargar materias-grupos:', error);
      } finally {
        setCargandoFiltros(false);
      }
    };
    fetchMateriasGrupos();
  }, [nivelSeleccionado, programaSeleccionado, cuatrimestreSeleccionado, filtrosData]);

  useEffect(() => {
    if (!filtrosData) return;
    obtenerReporte();
  }, [filtrosData]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownNivelRef.current && !dropdownNivelRef.current.contains(e.target)) setIsDropdownNivelOpen(false);
      if (dropdownProgramaRef.current && !dropdownProgramaRef.current.contains(e.target)) setIsDropdownProgramaOpen(false);
      if (dropdownCuatrimestreRef.current && !dropdownCuatrimestreRef.current.contains(e.target)) setIsDropdownCuatrimestreOpen(false);
      if (dropdownMateriaRef.current && !dropdownMateriaRef.current.contains(e.target)) setIsDropdownMateriaOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const obtenerReporte = async () => {
    setCargando(true);
    try {
      const params = {};
      if (nivelSeleccionado) params.nivel_academico = nivelSeleccionado;
      if (programaSeleccionado === 'tronco_comun') {
        params.tronco_comun = true;
      } else if (programaSeleccionado && programaSeleccionado !== '') {
        params.carrera_id = programaSeleccionado;
      }
      if (cuatrimestreSeleccionado) params.cuatrimestre = cuatrimestreSeleccionado;
      if (materiaGrupoSeleccionado) params.grupo_id = materiaGrupoSeleccionado;
      params.formato = 'json';

      const res = await client.get('/asistencia/reporte', { params });
      setData(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error al obtener reporte:', error);
      setData([]);
    } finally {
      setCargando(false);
    }
  };

  const handleNivelChange = (nivel) => {
    setNivelSeleccionado(nivel);
    setProgramaSeleccionado('');
    setMateriaGrupoSeleccionado('');
    setCuatrimestreSeleccionado('');
    setCuatrimestreBloqueado(false);
    setIsDropdownNivelOpen(false);
  };

  const handleProgramaChange = (programa) => {
    setProgramaSeleccionado(programa);
    setMateriaGrupoSeleccionado('');
    setCuatrimestreSeleccionado('');
    setCuatrimestreBloqueado(false);
    setIsDropdownProgramaOpen(false);
  };

  const handleCuatrimestreChange = (cuatrimestre) => {
    if (cuatrimestreBloqueado) return;
    setCuatrimestreSeleccionado(cuatrimestre);
    setMateriaGrupoSeleccionado('');
    setIsDropdownCuatrimestreOpen(false);
  };

  const handleMateriaGrupoChange = (id) => {
    setMateriaGrupoSeleccionado(id);
    setIsDropdownMateriaOpen(false);
    const selected = materiasGruposOptions.find(m => m.id === id);
    if (selected && selected.cuatrimestre_id) {
      setCuatrimestreSeleccionado(selected.cuatrimestre_id);
      setCuatrimestreBloqueado(true);
    }
  };

  const limpiarMateriaGrupo = () => {
    setMateriaGrupoSeleccionado('');
    setCuatrimestreBloqueado(false);
  };

  const programasFiltrados = filtrosData ? filtrosData.programas.filter(p => {
    if (!nivelSeleccionado) return true;
    if (p.id === null) {
      return nivelSeleccionado !== 'maestria';
    }
    return p.nivel_academico === nivelSeleccionado;
  }) : [];

  const handleBusquedaChange = (e) => {
    let val = e.target.value;
    val = val.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
    val = val.replace(/\s{2,}/g, ' ');
    if (val.startsWith(' ')) val = val.trimStart();
    setBusqueda(val);
  };

  const datosFiltrados = data.filter(alumno => {
    if (!busqueda) return true;
    const b = busqueda.toLowerCase();
    return (
      (alumno['Matricula'] || '').toLowerCase().includes(b) ||
      (alumno['Nombre Completo'] || '').toLowerCase().includes(b)
    );
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [datosFiltrados.length, busqueda]);

  const totalPages = Math.max(1, Math.ceil(datosFiltrados.length / itemsPerPage));
  const datosPaginados = datosFiltrados.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalAlumnos = datosFiltrados.length;
  const alumnosEnRiesgo = datosFiltrados.filter(a => a['Riesgo'] === 'SI').length;
  const promedioAsistencia = totalAlumnos > 0
    ? (datosFiltrados.reduce((sum, a) => sum + (a['Porcentaje'] || 0), 0) / totalAlumnos).toFixed(0)
    : 0;

  const descargarExcel = () => {
    const params = new URLSearchParams({ formato: 'excel' });
    if (nivelSeleccionado) params.append('nivel_academico', nivelSeleccionado);
    if (programaSeleccionado === 'tronco_comun') {
      params.append('tronco_comun', 'true');
    } else if (programaSeleccionado) {
      params.append('carrera_id', programaSeleccionado);
    }
    if (cuatrimestreSeleccionado) params.append('cuatrimestre', cuatrimestreSeleccionado);
    if (materiaGrupoSeleccionado) params.append('grupo_id', materiaGrupoSeleccionado);
    window.open(`${import.meta.env.VITE_API_URL}/asistencia/reporte?${params.toString()}`, '_blank');
  };

  const handleExportPDF = () => {
    if (datosFiltrados.length === 0) {
      Swal.fire('Sin datos', 'No hay datos para generar el reporte PDF.', 'warning');
      return;
    }
    try {
      const doc = new jsPDF('landscape');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const periodoLabel = filtrosData?.periodo_activo?.codigo || 'N/A';
      const nivelLabel = nivelSeleccionado ? (nivelSeleccionado === 'licenciatura' ? 'Licenciatura' : 'Maestría') : 'Todos los niveles';

      let programaLabel = 'Todos los programas';
      if (programaSeleccionado === 'tronco_comun') {
        programaLabel = 'Tronco Común';
      } else if (programaSeleccionado) {
        const prog = filtrosData?.programas?.find(p => p.id == programaSeleccionado);
        programaLabel = prog?.name || 'Programa seleccionado';
      }

      let materiaLabel = 'Todas las materias';
      if (materiaGrupoSeleccionado) {
        const mat = materiasGruposOptions.find(m => m.id === materiaGrupoSeleccionado);
        materiaLabel = mat?.label || '';
      }

      const dibujarEncabezado = (pdf) => {
        pdf.setFillColor(11, 23, 42);
        pdf.rect(14, 10, 12, 12, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('U', 20, 18.5, { align: 'center' });

        pdf.setTextColor(26, 35, 126);
        pdf.setFontSize(16);
        pdf.text('UNID', 30, 15);
        pdf.setFontSize(8);
        pdf.setTextColor(100);
        pdf.setFont('helvetica', 'normal');
        pdf.text('UNIVERSIDAD INTERAMERICANA PARA EL DESARROLLO', 30, 19);

        pdf.setTextColor(26, 35, 126);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('REPORTE DE ASISTENCIA ACUMULADA', pageWidth - 14, 15, { align: 'right' });
        pdf.setFontSize(9);
        pdf.setTextColor(100);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Documento Oficial', pageWidth - 14, 19, { align: 'right' });

        pdf.setDrawColor(242, 169, 0);
        pdf.setLineWidth(0.5);
        pdf.line(14, 23, pageWidth - 14, 23);

        pdf.setFontSize(7.5);
        pdf.setTextColor(150);
        pdf.setFont('helvetica', 'bold');
        pdf.text('NIVEL ACADÉMICO', 14, 29);
        pdf.text('PROGRAMA', 100, 29);
        pdf.text('MATERIA / GRUPO', 200, 29);
        pdf.text('PERIODO ACADÉMICO', 14, 39);
        pdf.text('FECHA DE GENERACIÓN', 100, 39);
        pdf.text('ALUMNOS EN RIESGO', 200, 39);

        pdf.setTextColor(50);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.text(nivelLabel.toUpperCase(), 14, 34);
        pdf.text(programaLabel.toUpperCase(), 100, 34);
        pdf.text(materiaLabel.toUpperCase().substring(0, 50), 200, 34);
        pdf.text(periodoLabel, 14, 44);
        pdf.text(new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase(), 100, 44);

        const riesgoText = `${alumnosEnRiesgo} DE ${totalAlumnos}`;
        if (alumnosEnRiesgo > 0) {
          pdf.setTextColor(220, 38, 38);
        } else {
          pdf.setTextColor(34, 197, 94);
        }
        pdf.text(riesgoText, 200, 44);
      };

      const tableColumn = ['#', 'MATRÍCULA', 'NOMBRE COMPLETO', 'CARRERA', 'MATERIA', 'GRUPO', 'ASIST.', 'FALTAS', 'TOTAL', '% ASIST.', 'RIESGO'];
      const tableRows = datosFiltrados.map((a, idx) => [
        (idx + 1).toString(),
        a['Matricula'] || '',
        a['Nombre Completo'] || '',
        a['Carrera'] || '',
        a['Materia'] || '',
        a['Grupo'] || '',
        (a['Asistencias'] ?? 0).toString(),
        (a['Faltas'] ?? 0).toString(),
        (a['Total Clases'] ?? 0).toString(),
        `${Math.round(a['Porcentaje'] ?? 0)}%`,
        a['Riesgo'] === 'SI' ? 'EN RIESGO' : 'OK',
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 48,
        theme: 'plain',
        margin: { top: 48, bottom: 25, left: 10, right: 10 },
        styles: { fontSize: 7, cellPadding: 2, textColor: [80, 80, 80] },
        headStyles: {
          fillColor: [248, 249, 250],
          textColor: [26, 35, 126],
          fontStyle: 'bold',
          lineWidth: 0.1,
          lineColor: [230, 230, 230],
          halign: 'center',
          valign: 'middle',
        },
        bodyStyles: { lineWidth: 0.1, lineColor: [240, 240, 240] },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center', textColor: [150, 150, 150] },
          1: { fontStyle: 'bold', cellWidth: 22, halign: 'center' },
          2: { cellWidth: 50 },
          3: { cellWidth: 35 },
          4: { cellWidth: 40 },
          5: { cellWidth: 25, halign: 'center' },
          6: { halign: 'center', cellWidth: 14, textColor: [26, 35, 126] },
          7: { halign: 'center', cellWidth: 14, textColor: [220, 38, 38] },
          8: { halign: 'center', cellWidth: 14 },
          9: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
          10: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
        },
        didParseCell: function (hookData) {
          if (hookData.section === 'body') {
            const riesgoCol = tableColumn.length - 1;
            if (hookData.column.index === riesgoCol) {
              if (hookData.cell.raw === 'EN RIESGO') {
                hookData.cell.styles.textColor = [220, 38, 38];
                hookData.cell.styles.fillColor = [254, 242, 242];
                hookData.cell.styles.fontStyle = 'bold';
              } else {
                hookData.cell.styles.textColor = [34, 197, 94];
              }
            }
            const rowData = hookData.row.raw;
            if (rowData && rowData[riesgoCol] === 'EN RIESGO' && hookData.column.index !== riesgoCol) {
              hookData.cell.styles.fillColor = [255, 250, 250];
            }
          }
        },
        didDrawPage: function (hookData) {
          dibujarEncabezado(doc);
          const footerY = pageHeight - 12;
          doc.setFontSize(7);
          doc.setTextColor(150);
          doc.setFont('helvetica', 'normal');
          doc.text('SISTEMA ACADÉMICO SESA UNID - DOCUMENTO OFICIAL DE CONTROL ESCOLAR', 14, footerY);
          doc.text(`Página ${hookData.pageNumber}`, pageWidth - 20, footerY, { align: 'right' });
        },
      });

      const nombreArchivo = `Reporte_Asistencia_${periodoLabel}${materiaGrupoSeleccionado ? '_Grupo' + materiaGrupoSeleccionado : ''}.pdf`;
      doc.save(nombreArchivo);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', 'No se pudo generar el documento PDF.', 'error');
    }
  };

  const getNivelLabel = () => {
    if (!nivelSeleccionado) return 'Todos los niveles';
    const nivel = filtrosData?.niveles?.find(n => n.name === nivelSeleccionado);
    return nivel ? (nivel.name === 'licenciatura' ? 'Licenciatura' : 'Maestría') : nivelSeleccionado;
  };

  const getProgramaLabel = () => {
    if (!programaSeleccionado) return 'Todos los programas';
    if (programaSeleccionado === 'tronco_comun') return 'Tronco Común';
    const prog = filtrosData?.programas?.find(p => String(p.id) === String(programaSeleccionado));
    return prog?.name || 'Programa';
  };

  const getCuatrimestreLabel = () => {
    if (!cuatrimestreSeleccionado) return 'Todos';
    const q = filtrosData?.cuatrimestres?.find(c => c.id == cuatrimestreSeleccionado);
    return q?.nombre || 'Cuatrimestre';
  };

  const getMateriaGrupoLabel = () => {
    if (!materiaGrupoSeleccionado) return 'Todas las materias';
    const m = materiasGruposOptions.find(o => o.id === materiaGrupoSeleccionado);
    return m?.label || 'Seleccione';
  };

  if (cargando && !filtrosData) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] p-6 font-sans flex items-center justify-center">
        <div className="flex flex-col items-center text-[#1A237E]">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p className="font-bold">Cargando reporte de asistencia...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-6 font-sans">
      <div className="max-w-[1500px] mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6">

        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 pb-5 border-b border-gray-200">
          <div>
            <h1 className="text-xl font-black text-[#1A237E] tracking-tight">Reporte de Asistencia Acumulada</h1>
            <p className="text-sm text-gray-500 mt-1">
              Periodo activo: <span className="font-bold text-gray-700">{filtrosData?.periodo_activo?.codigo || 'N/A'}</span>
              {filtrosData?.periodo_activo?.fecha_inicio && filtrosData?.periodo_activo?.fecha_fin && (
                <span className="ml-2 text-gray-400">
                  ({new Date(filtrosData.periodo_activo.fecha_inicio + 'T00:00:00').toLocaleDateString('es-MX')} - {new Date(filtrosData.periodo_activo.fecha_fin + 'T00:00:00').toLocaleDateString('es-MX')})
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-3 mt-3 lg:mt-0">
            <button
              onClick={handleExportPDF}
              disabled={datosFiltrados.length === 0}
              className="h-[38px] flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 hover:text-[#1A237E] hover:border-[#1A237E] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4 mr-2" /> Exportar PDF
            </button>
            <button
              onClick={descargarExcel}
              disabled={datosFiltrados.length === 0}
              className="h-[38px] flex items-center px-4 py-2 bg-[#1A237E] text-white rounded-lg text-sm font-bold hover:bg-[#283593] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar Excel
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 mb-6 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-2 text-gray-400 self-end pb-1">
            <Filter className="w-4 h-4" />
          </div>

          {/* Nivel Académico */}
          <div className="flex flex-col relative z-50" ref={dropdownNivelRef}>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nivel Académico</label>
            <div
              onClick={() => setIsDropdownNivelOpen(!isDropdownNivelOpen)}
              className={`relative flex items-center justify-between w-[180px] h-[38px] px-3 py-2 border rounded-lg text-sm bg-white font-bold cursor-pointer transition-all ${isDropdownNivelOpen ? 'border-[#1A237E] ring-2 ring-[#1A237E]/20 text-[#1A237E]' : 'border-gray-300 text-gray-800 hover:border-gray-400'}`}
            >
              <span className="truncate">{getNivelLabel()}</span>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ml-2 ${isDropdownNivelOpen ? 'rotate-180 text-[#1A237E]' : ''}`} />
            </div>
            <div className={`absolute top-full mt-1.5 w-[200px] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden transition-all duration-200 origin-top ${isDropdownNivelOpen ? 'opacity-100 scale-y-100 visible' : 'opacity-0 scale-y-95 invisible'}`}>
              <div
                onClick={() => handleNivelChange('')}
                className={`px-4 py-3 text-sm cursor-pointer transition-colors border-b border-gray-50 ${!nivelSeleccionado ? 'bg-blue-50 text-[#1A237E] font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                Todos los niveles
              </div>
              {(filtrosData?.niveles || []).map(nivel => (
                <div
                  key={nivel.id}
                  onClick={() => handleNivelChange(nivel.name)}
                  className={`px-4 py-3 text-sm cursor-pointer transition-colors border-b border-gray-50 last:border-none capitalize ${nivelSeleccionado === nivel.name ? 'bg-blue-50 text-[#1A237E] font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  {nivel.name === 'licenciatura' ? 'Licenciatura' : nivel.name === 'maestria' ? 'Maestría' : nivel.name}
                </div>
              ))}
            </div>
          </div>

          {/* Programa Académico */}
          <div className="flex flex-col relative z-40" ref={dropdownProgramaRef}>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Programa Académico</label>
            <div
              onClick={() => setIsDropdownProgramaOpen(!isDropdownProgramaOpen)}
              className={`relative flex items-center justify-between w-[240px] h-[38px] px-3 py-2 border rounded-lg text-sm bg-white font-bold cursor-pointer transition-all ${isDropdownProgramaOpen ? 'border-[#1A237E] ring-2 ring-[#1A237E]/20 text-[#1A237E]' : 'border-gray-300 text-gray-800 hover:border-gray-400'}`}
            >
              <div className="flex items-center gap-2 truncate">
                <GraduationCap className={`w-4 h-4 flex-shrink-0 ${isDropdownProgramaOpen ? 'text-[#1A237E]' : 'text-gray-400'}`} />
                <span className="truncate">{getProgramaLabel()}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ml-2 ${isDropdownProgramaOpen ? 'rotate-180 text-[#1A237E]' : ''}`} />
            </div>
            <div className={`absolute top-full mt-1.5 w-[280px] max-h-[300px] overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl transition-all duration-200 origin-top ${isDropdownProgramaOpen ? 'opacity-100 scale-y-100 visible' : 'opacity-0 scale-y-95 invisible'} custom-scrollbar`}>
              <div
                onClick={() => handleProgramaChange('')}
                className={`px-4 py-3 text-sm cursor-pointer transition-colors border-b border-gray-50 ${!programaSeleccionado ? 'bg-blue-50 text-[#1A237E] font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                Todos los programas
              </div>
              {programasFiltrados.map(prog => (
                <div
                  key={prog.id === null ? 'tronco_comun' : prog.id}
                  onClick={() => handleProgramaChange(prog.id === null ? 'tronco_comun' : String(prog.id))}
                  className={`px-4 py-3 text-sm cursor-pointer transition-colors border-b border-gray-50 last:border-none ${(prog.id === null ? 'tronco_comun' : String(prog.id)) === String(programaSeleccionado) ? 'bg-blue-50 text-[#1A237E] font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  {prog.name}
                  {prog.nivel_academico && (
                    <span className="text-[10px] text-gray-400 ml-2 capitalize">({prog.nivel_academico})</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Cuatrimestre */}
          <div className="flex flex-col relative z-30" ref={dropdownCuatrimestreRef}>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Cuatrimestre
            </label>
            <div
              onClick={() => !cuatrimestreBloqueado && setIsDropdownCuatrimestreOpen(!isDropdownCuatrimestreOpen)}
              className={`relative flex items-center justify-between w-[200px] h-[38px] px-3 py-2 border rounded-lg text-sm bg-white font-bold transition-all ${cuatrimestreBloqueado ? 'cursor-not-allowed bg-gray-50 border-gray-200 text-gray-500' : 'cursor-pointer'} ${isDropdownCuatrimestreOpen ? 'border-[#1A237E] ring-2 ring-[#1A237E]/20 text-[#1A237E]' : 'border-gray-300 text-gray-800 hover:border-gray-400'}`}
            >
              <div className="flex items-center gap-2 truncate">
                <CalendarDays className={`w-4 h-4 flex-shrink-0 ${isDropdownCuatrimestreOpen ? 'text-[#1A237E]' : 'text-gray-400'}`} />
                <span className="truncate">{getCuatrimestreLabel()}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ml-2 ${isDropdownCuatrimestreOpen ? 'rotate-180 text-[#1A237E]' : ''}`} />
            </div>
            {!cuatrimestreBloqueado && (
              <div className={`absolute top-full mt-1.5 w-[220px] max-h-[300px] overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl transition-all duration-200 origin-top ${isDropdownCuatrimestreOpen ? 'opacity-100 scale-y-100 visible' : 'opacity-0 scale-y-95 invisible'} custom-scrollbar`}>
                <div
                  onClick={() => handleCuatrimestreChange('')}
                  className={`px-4 py-3 text-sm cursor-pointer transition-colors border-b border-gray-50 ${!cuatrimestreSeleccionado ? 'bg-blue-50 text-[#1A237E] font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  Todos
                </div>
                {(filtrosData?.cuatrimestres || []).map(q => (
                  <div
                    key={q.id}
                    onClick={() => handleCuatrimestreChange(q.id)}
                    className={`px-4 py-3 text-sm cursor-pointer transition-colors border-b border-gray-50 last:border-none ${cuatrimestreSeleccionado == q.id ? 'bg-blue-50 text-[#1A237E] font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    {q.nombre}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Materia y Grupo */}
          <div className="flex flex-col relative z-20" ref={dropdownMateriaRef}>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Materia y Grupo</label>
            <div
              onClick={() => setIsDropdownMateriaOpen(!isDropdownMateriaOpen)}
              className={`relative flex items-center justify-between w-[280px] h-[38px] px-3 py-2 border rounded-lg text-sm bg-white font-bold cursor-pointer transition-all ${isDropdownMateriaOpen ? 'border-[#1A237E] ring-2 ring-[#1A237E]/20 text-[#1A237E]' : 'border-gray-300 text-gray-800 hover:border-gray-400'}`}
            >
              <div className="flex items-center gap-2 truncate">
                <BookOpen className={`w-4 h-4 flex-shrink-0 ${isDropdownMateriaOpen ? 'text-[#1A237E]' : 'text-gray-400'}`} />
                <span className="truncate">{getMateriaGrupoLabel()}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ml-2 ${isDropdownMateriaOpen ? 'rotate-180 text-[#1A237E]' : ''}`} />
            </div>
            <div className={`absolute top-full mt-1.5 w-full min-w-[320px] max-h-[300px] overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl transition-all duration-200 origin-top ${isDropdownMateriaOpen ? 'opacity-100 scale-y-100 visible' : 'opacity-0 scale-y-95 invisible'} custom-scrollbar`}>
              <div
                onClick={() => { limpiarMateriaGrupo(); setIsDropdownMateriaOpen(false); }}
                className={`px-4 py-3 text-sm cursor-pointer transition-colors border-b border-gray-50 ${!materiaGrupoSeleccionado ? 'bg-blue-50 text-[#1A237E] font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                Todas las materias
              </div>
              {cargandoFiltros ? (
                <div className="p-4 text-center text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Cargando...
                </div>
              ) : materiasGruposOptions.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-400">No hay materias disponibles</div>
              ) : (
                materiasGruposOptions.map(opt => (
                  <div
                    key={opt.id}
                    onClick={() => handleMateriaGrupoChange(opt.id)}
                    className={`px-4 py-3 text-sm cursor-pointer transition-colors border-b border-gray-50 last:border-none ${materiaGrupoSeleccionado === opt.id ? 'bg-blue-50 text-[#1A237E] font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <div>{opt.label}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{opt.carrera_nombre} &middot; {opt.cuatrimestre_nombre}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Buscar */}
          <div className="flex flex-col">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Buscar Alumno</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Nombre o matrícula..."
                value={busqueda}
                onChange={handleBusquedaChange}
                className="h-[38px] pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-[#1A237E] focus:border-[#1A237E] w-[200px] transition-all"
              />
            </div>
          </div>

          {/* Aplicar Filtros */}
          <div className="flex flex-col">
            <label className="text-[11px] font-bold text-transparent uppercase tracking-wider mb-1 hidden lg:block">.</label>
            <button
              onClick={obtenerReporte}
              disabled={cargando}
              className="h-[38px] flex items-center px-5 py-2 bg-[#1A237E] text-white rounded-lg text-sm font-bold hover:bg-[#283593] transition-colors shadow-sm disabled:opacity-50"
            >
              {cargando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Filter className="w-4 h-4 mr-2" />}
              Aplicar
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 p-4 rounded-xl flex justify-between items-center shadow-sm">
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Total Alumnos</p>
              <p className="text-2xl font-black text-gray-800">{totalAlumnos}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl text-[#1A237E]"><Users className="w-6 h-6" /></div>
          </div>
          <div className="bg-white border border-red-100 p-4 rounded-xl flex justify-between items-center shadow-sm">
            <div>
              <p className="text-xs text-red-600/70 font-bold uppercase tracking-wider mb-1">En Riesgo</p>
              <p className="text-2xl font-black text-red-600">{alumnosEnRiesgo}</p>
            </div>
            <div className="bg-red-50 p-3 rounded-xl text-red-500"><AlertTriangle className="w-6 h-6" /></div>
          </div>
          <div className="bg-white border border-green-100 p-4 rounded-xl flex justify-between items-center shadow-sm">
            <div>
              <p className="text-xs text-green-600/70 font-bold uppercase tracking-wider mb-1">Sin Riesgo</p>
              <p className="text-2xl font-black text-green-600">{totalAlumnos - alumnosEnRiesgo}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-xl text-green-500"><CheckCircle className="w-6 h-6" /></div>
          </div>
          <div className="bg-white border border-indigo-100 p-4 rounded-xl flex justify-between items-center shadow-sm">
            <div>
              <p className="text-xs text-indigo-600/70 font-bold uppercase tracking-wider mb-1">% Asistencia Prom.</p>
              <p className="text-2xl font-black text-indigo-600">{promedioAsistencia}%</p>
            </div>
            <div className="bg-indigo-50 p-3 rounded-xl text-indigo-500"><CalendarDays className="w-6 h-6" /></div>
          </div>
        </div>

        {/* Table */}
        <div className={`overflow-x-auto border border-gray-200 rounded-xl shadow-sm ${itemsPerPage >= 25 ? 'max-h-[600px] overflow-y-auto' : ''}`}>
          {cargando ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#1A237E]">
              <Loader2 className="w-10 h-10 animate-spin mb-4" />
              <p className="font-bold">Cargando datos...</p>
            </div>
          ) : datosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Users className="w-12 h-12 mb-3 opacity-50" />
              <p className="font-semibold text-gray-600">No se encontraron registros.</p>
              <p className="text-sm text-gray-400 mt-1">Ajusta los filtros o haz clic en "Aplicar" para cargar datos.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-3 text-[11px] font-bold text-[#1A237E] uppercase tracking-wider text-center w-10">#</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-[#1A237E] uppercase tracking-wider">Matrícula</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-[#1A237E] uppercase tracking-wider">Nombre Completo</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-[#1A237E] uppercase tracking-wider">Carrera</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-[#1A237E] uppercase tracking-wider">Cuatrimestre</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-[#1A237E] uppercase tracking-wider">Materia</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-[#1A237E] uppercase tracking-wider text-center">Grupo</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-[#1A237E] uppercase tracking-wider text-center">Asist.</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-[#1A237E] uppercase tracking-wider text-center">Faltas</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-[#1A237E] uppercase tracking-wider text-center">Total</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-[#1A237E] uppercase tracking-wider text-center">% Asist.</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-[#1A237E] uppercase tracking-wider text-center">Riesgo</th>
                </tr>
              </thead>
              <tbody>
                {datosPaginados.map((alumno, index) => {
                  const enRiesgo = alumno['Riesgo'] === 'SI';
                  const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                  return (
                    <tr
                      key={index}
                      className={`border-b border-gray-100 transition-colors ${enRiesgo ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-3 py-2.5 text-center text-gray-400 text-xs">{globalIndex}</td>
                      <td className="px-3 py-2.5 font-bold text-gray-800">{alumno['Matricula']}</td>
                      <td className="px-3 py-2.5 text-gray-700">{alumno['Nombre Completo']}</td>
                      <td className="px-3 py-2.5 text-gray-600 text-xs">{alumno['Carrera']}</td>
                      <td className="px-3 py-2.5 text-gray-600 text-xs">{alumno['Cuatrimestre']}</td>
                      <td className="px-3 py-2.5 text-gray-700">{alumno['Materia']}</td>
                      <td className="px-3 py-2.5 text-center text-gray-600 font-medium">{alumno['Grupo']}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-[#1A237E]">{alumno['Asistencias']}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-red-600">{alumno['Faltas']}</td>
                      <td className="px-3 py-2.5 text-center text-gray-600">{alumno['Total Clases']}</td>
                      <td className="px-3 py-2.5 text-center font-bold">
                        <span className={alumno['Porcentaje'] < 80 ? 'text-amber-600' : 'text-green-600'}>
                          {Math.round(alumno['Porcentaje'])}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {enRiesgo ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                            <AlertTriangle className="w-3 h-3" /> EN RIESGO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
                            <CheckCircle className="w-3 h-3" /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination controls */}
        {datosFiltrados.length > 0 && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                Mostrando {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, datosFiltrados.length)} de {datosFiltrados.length} registros
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">Filas:</span>
                <select
                  value={itemsPerPage}
                  onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="border border-gray-300 rounded-md px-2 py-1 text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-[#1A237E] focus:border-[#1A237E]"
                >
                  {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1.5 rounded-md border border-gray-200 text-gray-500 text-xs font-bold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >«</button>
              <button
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              ><ChevronLeft className="w-4 h-4" /></button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === '...'
                    ? <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs text-gray-400">…</span>
                    : <button
                        key={item}
                        onClick={() => setCurrentPage(item)}
                        className={`px-3 py-1.5 rounded-md border text-xs font-bold transition-colors ${currentPage === item ? 'bg-[#1A237E] border-[#1A237E] text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >{item}</button>
                )}
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              ><ChevronRight className="w-4 h-4" /></button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1.5 rounded-md border border-gray-200 text-gray-500 text-xs font-bold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >»</button>
            </div>
          </div>
        )}

        {/* Footer note */}
        {datosFiltrados.length > 0 && (
          <p className="mt-2 text-xs text-gray-400">Los alumnos en riesgo superan el límite de faltas permitidas (3 faltas si la clase es 1 vez/semana, 6 si es 2 veces/semana)</p>
        )}
      </div>
    </div>
  );
}
