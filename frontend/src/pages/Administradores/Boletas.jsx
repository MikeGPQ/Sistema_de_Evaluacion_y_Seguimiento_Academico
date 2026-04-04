import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Users, User, BookOpen, ChevronDown,
  AlertCircle, Loader2, FileSpreadsheet, FileText, X
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import client from '../../lib/axios';
import Swal from 'sweetalert2';

// ─── helpers ───────────────────────────────────────────────────────────────

const formatGrade = (val) => (val !== null && val !== undefined ? String(val) : '–');

const isBoletaCompleta = (boleta) =>
  boleta?.materias?.length > 0 &&
  boleta.materias.every((m) => m.acta_status === 'cerrada');

const buildPDF = (boletas, titulo) => {
  const doc  = new jsPDF({ orientation: 'p', unit: 'mm', format: 'letter' });
  const pageW   = doc.internal.pageSize.getWidth();
  const margin  = 14;
  const primary = [11, 23, 42];   // #0B172A  (igual al Kárdex)
  const gold    = [217, 144, 0];  // #D99000

  // ── encabezado estándar (mismo que Kárdex) ──────────────────────────────
  const drawHeader = () => {
    doc.setFillColor(...primary);
    doc.roundedRect(margin, 8, 10, 10, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text('U', margin + 5, 14.5, { align: 'center' });

    doc.setTextColor(...primary);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('UNID', margin + 14, 14);
    doc.setFontSize(5.5);
    doc.setFont(undefined, 'normal');
    doc.text('UNIVERSIDAD INTERAMERICANA PARA EL DESARROLLO', margin + 14, 18);

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primary);
    doc.text('BOLETA DE CALIFICACIONES', pageW - margin, 13, { align: 'right' });
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text('DOCUMENTO OFICIAL', pageW - margin, 18, { align: 'right' });

    doc.setDrawColor(...gold);
    doc.setLineWidth(1.2);
    doc.line(margin, 22, pageW - margin, 22);
  };

  // ── pie de página estándar ──────────────────────────────────────────────
  const drawFooter = (y) => {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.setFont(undefined, 'normal');
    doc.text('Documento generado por el Sistema SESA — Solo para fines informativos.', margin, y + 5);
    doc.text(
      new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }),
      pageW - margin, y + 5, { align: 'right' }
    );
  };

  // ── una boleta por alumno ───────────────────────────────────────────────
  boletas.forEach((boleta, bIdx) => {
    if (bIdx > 0) doc.addPage();

    drawHeader();

    // cuadro datos del alumno
    const boxY = 27;
    const boxH = 36;
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, boxY, pageW - margin * 2, boxH, 2, 2, 'S');

    const col2  = margin + (pageW - margin * 2) / 2 + 3;
    const halfW = col2 - (margin + 5) - 4;

    const drawField = (label, value, x, y, maxW) => {
      doc.setFontSize(6);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(140, 140, 140);
      doc.text(label, x, y);
      doc.setFontSize(8.5);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primary);
      const lines = maxW ? doc.splitTextToSize(value || 'N/A', maxW) : [value || 'N/A'];
      doc.text(lines, x, y + 4.5);
    };

    const { nombre, matricula, carrera, cuatrimestre } = boleta.alumno;
    drawField('NOMBRE DEL ALUMNO', nombre,               margin + 5, boxY + 8,  halfW);
    drawField('MATRÍCULA',         matricula,             col2,       boxY + 8);
    drawField('CARRERA',           carrera,               margin + 5, boxY + 22, halfW);
    drawField('CUATRIMESTRE',      `${cuatrimestre}°`,   col2,       boxY + 22);

    // barra de periodo
    let curY = boxY + boxH + 6;
    const aprobadas  = boleta.materias.filter(m => m.estatus === 'aprobada').length;
    const reprobadas = boleta.materias.filter(m => m.estatus === 'reprobada').length;

    doc.setFillColor(...primary);
    doc.roundedRect(margin, curY, pageW - margin * 2, 7, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.text(`Periodo: ${boleta.periodo}`, margin + 4, curY + 5);
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.text(
      `Aprobadas: ${aprobadas}   Reprobadas: ${reprobadas}`,
      pageW - margin - 4, curY + 5, { align: 'right' }
    );

    curY += 9;

    // tabla — didDrawPage repite el encabezado en páginas nuevas
    autoTable(doc, {
      startY: curY,
      margin: { left: margin, right: margin, top: 28 },
      head: [['MATERIA', 'PARCIAL 1', 'PARCIAL 2', 'PARCIAL 3', 'PROMEDIO FINAL']],
      body: boleta.materias.length
        ? boleta.materias.map(m => [
            m.nombre,
            formatGrade(m.parcial_1),
            formatGrade(m.parcial_2),
            formatGrade(m.parcial_3),
            formatGrade(m.promedio),
          ])
        : [['Sin materias registradas en este periodo', '', '', '', '']],
      theme: 'plain',
      didDrawPage: (d) => { if (d.pageNumber > 1) drawHeader(); },
      headStyles: {
        textColor: [100, 100, 100], fontSize: 7, fontStyle: 'bold',
        halign: 'center', fillColor: [248, 249, 250],
        lineWidth: 0.1, lineColor: [220, 220, 220],
      },
      bodyStyles: { fontSize: 8, textColor: primary, lineWidth: 0.1, lineColor: [230, 230, 230] },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 4) {
          const val = Number(d.cell.raw);
          if (!isNaN(val) && val >= 7) d.cell.styles.textColor = [22, 163, 74];
          if (!isNaN(val) && val < 7)  d.cell.styles.textColor = [220, 38, 38];
        }
      },
    });

    drawFooter(doc.lastAutoTable.finalY + 6);
  });

  doc.save(`${titulo}.pdf`);
};

const buildExcel = async (boletas, titulo) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SESA';
  wb.created = new Date();

  boletas.forEach((boleta) => {
    const sheetName = boleta.alumno.matricula.slice(0, 31);
    const ws = wb.addWorksheet(sheetName);

    ws.mergeCells('A1:E1');
    ws.getCell('A1').value = 'UNID – Boleta de Calificaciones';
    ws.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FF1A237E' } };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    ws.mergeCells('A2:E2');
    ws.getCell('A2').value = `Periodo: ${boleta.periodo}`;
    ws.getCell('A2').alignment = { horizontal: 'center' };
 
    const alumno = boleta.alumno;
    ws.addRow([]);
    ws.addRow(['Nombre:', alumno.nombre]);
    ws.addRow(['Matrícula:', alumno.matricula]);
    ws.addRow(['Carrera:', alumno.carrera]);
    ws.addRow(['Cuatrimestre:', alumno.cuatrimestre]);
    ws.addRow([]);

    const headerRow = ws.addRow(['Materia', 'Parcial 1', 'Parcial 2', 'Parcial 3', 'Promedio Final']);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } };
      cell.alignment = { horizontal: 'center' };
    });

    boleta.materias.forEach((m, i) => {
      const row = ws.addRow([
        m.nombre,
        m.parcial_1 ?? '–',
        m.parcial_2 ?? '–',
        m.parcial_3 ?? '–',
        m.promedio ?? '–',
      ]);
      if (i % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F2FF' } };
        });
      }
      row.getCell(1).alignment = { wrapText: true };
      for (let c = 2; c <= 5; c++) row.getCell(c).alignment = { horizontal: 'center' };
    });

    ws.columns = [
      { width: 45 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 16 },
    ];
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${titulo}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};


const BoletaCard = ({ boleta }) => (
  <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">

    <div className="bg-[#1A237E] px-5 py-3">
      <p className="text-white font-bold text-sm">{boleta.alumno.nombre}</p>
      <p className="text-blue-200 text-xs mt-0.5">
        {boleta.alumno.matricula} · {boleta.alumno.carrera} · {boleta.alumno.cuatrimestre}° Cuatrimestre
      </p>
      <p className="text-blue-300 text-xs">Periodo: {boleta.periodo}</p>
    </div>
    {boleta.materias.length === 0 ? (
      <div className="px-5 py-6 text-center text-sm text-gray-400">
        Sin materias registradas en este periodo.
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-gray-200">
              <th className="text-left px-4 py-2 text-gray-600 font-semibold">Materia</th>
              <th className="text-center px-3 py-2 text-gray-600 font-semibold w-16">P1</th>
              <th className="text-center px-3 py-2 text-gray-600 font-semibold w-16">P2</th>
              <th className="text-center px-3 py-2 text-gray-600 font-semibold w-16">P3</th>
              <th className="text-center px-3 py-2 text-gray-600 font-semibold w-20">Promedio</th>
            </tr>
          </thead>
          <tbody>
            {boleta.materias.map((m, i) => {
              const aprobada = m.promedio !== null && m.promedio >= 7;
              const reprobada = m.promedio !== null && m.promedio < 7;
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                  <td className="px-4 py-1.5 text-gray-800">{m.nombre}</td>
                  <td className="text-center px-3 py-1.5 text-gray-700">{formatGrade(m.parcial_1)}</td>
                  <td className="text-center px-3 py-1.5 text-gray-700">{formatGrade(m.parcial_2)}</td>
                  <td className="text-center px-3 py-1.5 text-gray-700">{formatGrade(m.parcial_3)}</td>
                  <td className={`text-center px-3 py-1.5 font-bold ${aprobada ? 'text-green-700' : reprobada ? 'text-red-600' : 'text-gray-500'}`}>
                    {formatGrade(m.promedio)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
);


const Boletas = () => {
  const [modo, setModo] = useState('individual'); 

  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [buscandoSug, setBuscandoSug] = useState(false);
  const [boletaIndividual, setBoletaIndividual] = useState(null);
  const [cargandoBoleta, setCargandoBoleta] = useState(false);
  const searchDebounce = useRef(null);

  const [carreras, setCarreras] = useState([]);
  const [cuatrimestres, setCuatrimestres] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [carreraId, setCarreraId] = useState('');
  const [cuatrimestre, setCuatrimestre] = useState('');
  const [grupoId, setGrupoId] = useState('');
  const [boletasMasivo, setBoletasMasivo] = useState([]);
  const [cargandoMasivo, setCargandoMasivo] = useState(false);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    client.get('/catalogos/programas-academicos').then((r) => setCarreras(r.data)).catch(() => {});
    client.get('/catalogos/cuatrimestres').then((r) => setCuatrimestres(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!carreraId && !cuatrimestre) { setGrupos([]); setGrupoId(''); return; }
    const params = new URLSearchParams();
    if (carreraId) params.append('carrera_id', carreraId);
    if (cuatrimestre) params.append('cuatrimestre', cuatrimestre);
    client.get(`/boletas/grupos-disponibles?${params.toString()}`)
      .then((r) => { setGrupos(r.data); setGrupoId(''); })
      .catch(() => setGrupos([]));
  }, [carreraId, cuatrimestre]);

  const handleBusquedaChange = (val) => {
    setBusqueda(val);
    setBoletaIndividual(null);
    clearTimeout(searchDebounce.current);
    if (val.length < 2) { setSugerencias([]); return; }
    searchDebounce.current = setTimeout(async () => {
      setBuscandoSug(true);
      try {
        const r = await client.get(`/boletas/buscar-alumno?q=${encodeURIComponent(val)}`);
        setSugerencias(r.data);
      } catch { setSugerencias([]); }
      finally { setBuscandoSug(false); }
    }, 350);
  };

  const handleSeleccionarAlumno = async (alumno) => {
    setBusqueda(`${alumno.nombre} (${alumno.matricula})`);
    setSugerencias([]);
    setCargandoBoleta(true);
    try {
      const r = await client.get(`/boletas/alumno/${alumno.matricula}`);
      setBoletaIndividual(r.data);
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: e.response?.data?.detail || 'No se pudo obtener la boleta del alumno.',
        confirmButtonColor: '#1A237E',
      });
    } finally { setCargandoBoleta(false); }
  };

  const handleGenerarMasivo = async () => {
    if (!carreraId || !cuatrimestre) {
      Swal.fire({ icon: 'warning', title: 'Filtros incompletos', text: 'Selecciona al menos Carrera y Cuatrimestre.', confirmButtonColor: '#1A237E' });
      return;
    }
    setCargandoMasivo(true);
    setBoletasMasivo([]);
    try {
      const params = new URLSearchParams({ carrera_id: carreraId, cuatrimestre });
      if (grupoId) params.append('sigad_group_id', grupoId);
      const r = await client.get(`/boletas/masivo?${params.toString()}`);
      setBoletasMasivo(r.data);
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Sin resultados',
        text: e.response?.data?.detail || 'No se encontraron alumnos con los filtros indicados.',
        confirmButtonColor: '#1A237E',
      });
    } finally { setCargandoMasivo(false); }
  };

  const handleExportarPDF = async (boletas, titulo) => {
    setExportando(true);
    try { buildPDF(boletas, titulo); }
    catch { Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo generar el PDF.', confirmButtonColor: '#1A237E' }); }
    finally { setExportando(false); }
  };

  const handleExportarExcel = async (boletas, titulo) => {
    setExportando(true);
    try { await buildExcel(boletas, titulo); }
    catch { Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo generar el Excel.', confirmButtonColor: '#1A237E' }); }
    finally { setExportando(false); }
  };


  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans">
      <header className="bg-white border-b border-gray-200 h-14 flex items-center px-8 shadow-sm">
        <p className="text-sm text-gray-500">
          Administración &gt; <span className="text-[#1A237E] font-bold">Boletas</span>
        </p>
      </header>

      <main className="p-6 md:p-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Generación de Boletas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Consulta y exporta las boletas de calificaciones del periodo activo.
          </p>
        </div>

        <div className="flex gap-2 mb-6 bg-white border border-gray-200 rounded-lg p-1 w-fit shadow-sm">
          <button
            onClick={() => { setModo('individual'); setBoletaIndividual(null); setBusqueda(''); setSugerencias([]); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${modo === 'individual' ? 'bg-[#1A237E] text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <User className="w-4 h-4" /> Individual
          </button>
          <button
            onClick={() => { setModo('masivo'); setBoletasMasivo([]); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${modo === 'masivo' ? 'bg-[#1A237E] text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Users className="w-4 h-4" /> Masivo
          </button>
        </div>

        {modo === 'individual' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Buscar alumno por matrícula o nombre
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  {buscandoSug ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin" /> : <Search className="w-4 h-4 text-gray-400" />}
                </div>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => handleBusquedaChange(e.target.value)}
                  placeholder="Ej: 2021001 o Juan García..."
                  className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A237E] focus:border-transparent"
                />
                {busqueda && (
                  <button
                    onClick={() => { setBusqueda(''); setSugerencias([]); setBoletaIndividual(null); }}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {sugerencias.length > 0 && (
                  <ul className="absolute z-10 w-full top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {sugerencias.map((s) => (
                      <li
                        key={s.matricula}
                        onClick={() => handleSeleccionarAlumno(s)}
                        className="flex justify-between items-center px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm"
                      >
                        <span className="font-medium text-gray-800">{s.nombre}</span>
                        <span className="text-xs text-gray-500 ml-2">{s.matricula}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {cargandoBoleta && (
              <div className="flex justify-center py-10">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A237E]" />
              </div>
            )}

            {boletaIndividual && !cargandoBoleta && (
              <>
                {!isBoletaCompleta(boletaIndividual) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 items-start">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                      {boletaIndividual.materias.length === 0
                        ? 'Este alumno no tiene materias inscritas en el periodo activo.'
                        : 'Una o más actas de este alumno aún no han sido cerradas oficialmente por el docente. La descarga estará disponible cuando todas las actas estén cerradas.'}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    disabled={exportando || !isBoletaCompleta(boletaIndividual)}
                    onClick={() => handleExportarExcel([boletaIndividual], `Boleta_${boletaIndividual.alumno.matricula}`)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-green-600" />
                    Exportar Excel
                  </button>
                  <button
                    disabled={exportando || !isBoletaCompleta(boletaIndividual)}
                    onClick={() => handleExportarPDF([boletaIndividual], `Boleta_${boletaIndividual.alumno.matricula}`)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1A237E] text-white rounded-lg text-sm font-medium hover:bg-[#141a5e] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileText className="w-4 h-4" />
                    Exportar PDF
                  </button>
                </div>
                <BoletaCard boleta={boletaIndividual} />
              </>
            )}

            {!boletaIndividual && !cargandoBoleta && !busqueda && (
              <div className="bg-white border border-gray-200 rounded-lg p-10 text-center shadow-sm">
                <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Busca un alumno para ver su boleta del periodo activo.</p>
              </div>
            )}
          </div>
        )}

        {modo === 'masivo' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Filtros de selección</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Carrera</label>
                  <div className="relative">
                    <select
                      value={carreraId}
                      onChange={(e) => setCarreraId(e.target.value)}
                      className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A237E] pr-8"
                    >
                      <option value="">Todas las carreras</option>
                      {carreras.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cuatrimestre</label>
                  <div className="relative">
                    <select
                      value={cuatrimestre}
                      onChange={(e) => setCuatrimestre(e.target.value)}
                      className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A237E] pr-8"
                    >
                      <option value="">Todos</option>
                      {cuatrimestres.map((c) => (
                        <option key={c.id} value={c.numero}>{c.nombre || `${c.numero}°`}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Grupo</label>
                  <div className="relative">
                    <select
                      value={grupoId}
                      onChange={(e) => setGrupoId(e.target.value)}
                      disabled={grupos.length === 0}
                      className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A237E] pr-8 disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="">Todos los grupos</option>
                      {grupos.map((g) => (
                        <option key={g.id} value={g.id}>{g.identificador}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleGenerarMasivo}
                  disabled={cargandoMasivo || (!carreraId && !cuatrimestre)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#1A237E] text-white rounded-lg text-sm font-medium hover:bg-[#141a5e] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cargandoMasivo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                  {cargandoMasivo ? 'Cargando...' : 'Generar Boletas'}
                </button>
              </div>
            </div>

            {!carreraId && !cuatrimestre && boletasMasivo.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 items-start">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">Selecciona al menos <strong>Carrera</strong> y <strong>Cuatrimestre</strong> para generar las boletas grupales.</p>
              </div>
            )}

            {boletasMasivo.length > 0 && (() => {
              const incompletas = boletasMasivo.filter((b) => !isBoletaCompleta(b));
              const todasCompletas = incompletas.length === 0;
              return (
                <>
                  {!todasCompletas && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 items-start">
                      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800 mb-1">
                          Exportación bloqueada — {incompletas.length} alumno{incompletas.length !== 1 ? 's' : ''} sin acta completa
                        </p>
                        <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                          {incompletas.map((b) => (
                            <li key={b.alumno.matricula}>
                              {b.alumno.nombre} ({b.alumno.matricula})
                              {b.materias.length === 0 ? ' — sin materias inscritas' : ' — actas pendientes de cierre'}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600 font-medium">
                      {boletasMasivo.length} boleta{boletasMasivo.length !== 1 ? 's' : ''} generada{boletasMasivo.length !== 1 ? 's' : ''}
                      {!todasCompletas && (
                        <span className="ml-2 text-amber-600">· {incompletas.length} incompleta{incompletas.length !== 1 ? 's' : ''}</span>
                      )}
                    </p>
                    <div className="flex gap-2">
                      <button
                        disabled={exportando || !todasCompletas}
                        onClick={() => handleExportarExcel(boletasMasivo, 'Boletas_Grupales')}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-green-600" />
                        Exportar Excel
                      </button>
                      <button
                        disabled={exportando || !todasCompletas}
                        onClick={() => handleExportarPDF(boletasMasivo, 'Boletas_Grupales')}
                        className="flex items-center gap-2 px-4 py-2 bg-[#1A237E] text-white rounded-lg text-sm font-medium hover:bg-[#141a5e] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                        Exportar PDF
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {boletasMasivo.map((b) => (
                      <BoletaCard key={b.alumno.matricula} boleta={b} />
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </main>
    </div>
  );
};

export default Boletas;
