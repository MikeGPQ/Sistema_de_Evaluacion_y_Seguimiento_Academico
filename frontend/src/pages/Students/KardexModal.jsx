import React, { useState, useEffect } from 'react';
import { X, Download, BookOpen, CheckCircle, XCircle, RefreshCw, GraduationCap, Award } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import client from '../../lib/axios';

const KardexModal = ({ matricula, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!matricula) return;
    setLoading(true);
    setError(null);
    client.get(`/alumnos/${matricula}/kardex`)
      .then(res => setData(res.data))
      .catch(() => setError('No se pudo cargar el Kárdex del alumno.'))
      .finally(() => setLoading(false));
  }, [matricula]);

  const getStatusStyle = (status) => {
    if (status === 'aprobada') return 'bg-green-100 text-green-700';
    if (status === 'reprobada') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-500';
  };

  const handleDownloadPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const primary = [11, 23, 42];
    const gold = [217, 144, 0];

    const drawHeader = () => {
      doc.setFillColor(primary[0], primary[1], primary[2]);
      doc.roundedRect(margin, 8, 10, 10, 1.5, 1.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      doc.text('U', margin + 5, 14.5, { align: 'center' });

      doc.setTextColor(primary[0], primary[1], primary[2]);
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('UNID', margin + 14, 14);
      doc.setFontSize(5.5);
      doc.setFont(undefined, 'normal');
      doc.text('UNIVERSIDAD INTERAMERICANA PARA EL DESARROLLO', margin + 14, 18);

      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(primary[0], primary[1], primary[2]);
      doc.text('KÁRDEX ACADÉMICO', pageWidth - margin, 13, { align: 'right' });
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text('DOCUMENTO OFICIAL', pageWidth - margin, 18, { align: 'right' });

      doc.setDrawColor(gold[0], gold[1], gold[2]);
      doc.setLineWidth(1.2);
      doc.line(margin, 22, pageWidth - margin, 22);
    };

    // Página 1 — encabezado completo
    drawHeader();

    // Datos del alumno
    const boxY = 27;
    const boxH = 36;
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, boxY, pageWidth - margin * 2, boxH, 2, 2, 'S');

    const col2 = margin + (pageWidth - margin * 2) / 2 + 3;

    const drawField = (label, value, x, y, maxWidth) => {
      doc.setFontSize(6);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(140, 140, 140);
      doc.text(label, x, y);
      doc.setFontSize(8.5);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(primary[0], primary[1], primary[2]);
      const lines = maxWidth
        ? doc.splitTextToSize(value || 'N/A', maxWidth)
        : [value || 'N/A'];
      doc.text(lines, x, y + 4.5);
    };

    const halfW = col2 - (margin + 5) - 4;
    drawField('NOMBRE DEL ALUMNO', data.nombre_completo, margin + 5, boxY + 8, halfW);
    drawField('MATRÍCULA', data.matricula, col2, boxY + 8);
    drawField('CARRERA', data.carrera, margin + 5, boxY + 22, halfW);
    drawField('NIVEL', data.nivel, col2, boxY + 22);

    // KPIs
    let currentY = boxY + boxH + 6;
    const kpiW = (pageWidth - margin * 2 - 6) / 3;

    const drawKPI = (label, value, x, color) => {
      doc.setFillColor(...color);
      doc.roundedRect(x, currentY, kpiW, 12, 1.5, 1.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.setFont(undefined, 'normal');
      doc.text(label, x + kpiW / 2, currentY + 4, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(String(value), x + kpiW / 2, currentY + 10, { align: 'center' });
    };

    drawKPI('PROMEDIO GENERAL', data.promedio_general, margin, primary);
    drawKPI('CRÉDITOS ACUMULADOS', data.total_creditos_acumulados, margin + kpiW + 3, [26, 55, 126]);
    drawKPI('PERIODOS CURSADOS', data.periodos.length, margin + (kpiW + 3) * 2, [31, 120, 78]);

    currentY += 18;

    // Tabla por periodo
    data.periodos.forEach((periodo) => {
      if (currentY > 245) {
        doc.addPage();
        drawHeader();
        currentY = 28;
      }

      // Encabezado del periodo
      doc.setFillColor(primary[0], primary[1], primary[2]);
      doc.roundedRect(margin, currentY, pageWidth - margin * 2, 7, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.text(`Periodo: ${periodo.periodo}`, margin + 4, currentY + 5);

      const aprobadas = periodo.materias.filter(m => m.status === 'aprobada').length;
      const reprobadas = periodo.materias.filter(m => m.status === 'reprobada').length;
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.text(`Aprobadas: ${aprobadas}   Reprobadas: ${reprobadas}`, pageWidth - margin - 4, currentY + 5, { align: 'right' });

      currentY += 9;

      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin, top: 28 },
        head: [['MATERIA', 'CRÉDITOS', 'CALIFICACIÓN', 'ESTATUS']],
        body: periodo.materias.map(m => [
          m.materia + (m.is_retake ? ' (R)' : ''),
          m.creditos ?? '-',
          m.calificacion_final ?? '-',
          m.status === 'aprobada' ? 'Aprobada' : m.status === 'reprobada' ? 'Reprobada' : 'Cursando',
        ]),
        theme: 'plain',
        didDrawPage: (d) => { if (d.pageNumber > 1) { drawHeader(); } },
        headStyles: { textColor: [100, 100, 100], fontSize: 7, fontStyle: 'bold', halign: 'center', fillColor: [248, 249, 250], lineWidth: 0.1, lineColor: [220, 220, 220] },
        bodyStyles: { fontSize: 8, textColor: primary, lineWidth: 0.1, lineColor: [230, 230, 230] },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
          3: { cellWidth: 28, halign: 'center' },
        },
        didParseCell: (d) => {
          if (d.section === 'body' && d.column.index === 3) {
            if (d.cell.raw === 'Aprobada') d.cell.styles.textColor = [22, 163, 74];
            if (d.cell.raw === 'Reprobada') d.cell.styles.textColor = [220, 38, 38];
          }
        },
      });

      currentY = doc.lastAutoTable.finalY + 6;
    });

    // Pie con fecha
    if (currentY > 250) { doc.addPage(); drawHeader(); currentY = 28; }
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY + 4, pageWidth - margin, currentY + 4);
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.setFont(undefined, 'normal');
    doc.text('Documento generado por el Sistema SESA — Solo para fines informativos.', margin, currentY + 9);
    doc.text(new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }), pageWidth - margin, currentY + 9, { align: 'right' });

    doc.save(`Kardex_${data.matricula}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-[#0B172A] px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">Kárdex Académico</h2>
            {data && <p className="text-slate-400 text-xs mt-0.5">{data.nombre_completo} — {data.matricula}</p>}
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <button
                onClick={handleDownloadPDF}
                disabled={!data.periodos || data.periodos.length === 0}
                title={!data.periodos?.length ? 'Sin historial académico para exportar' : 'Descargar Kárdex en PDF'}
                className="flex items-center gap-2 bg-[#D99000] hover:bg-[#B37700] disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
              >
                <Download size={15} /> Descargar PDF
              </button>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6 bg-gray-50">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-[#0B172A]" />
            </div>
          )}

          {error && (
            <div className="text-center py-16 text-red-600 font-medium">{error}</div>
          )}

          {data && !loading && (
            <>
              {/* Info del alumno */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 col-span-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nombre</p>
                  <p className="text-sm font-bold text-[#0B172A] mt-0.5">{data.nombre_completo}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Matrícula</p>
                  <p className="text-sm font-bold text-[#0B172A] mt-0.5 font-mono">{data.matricula}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nivel</p>
                  <p className="text-sm font-bold text-[#0B172A] mt-0.5">{data.nivel}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 col-span-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Carrera</p>
                  <p className="text-sm font-bold text-[#0B172A] mt-0.5">{data.carrera}</p>
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-[#0B172A] rounded-xl px-5 py-4 flex items-center gap-3">
                  <Award className="w-8 h-8 text-[#D99000] shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Promedio General</p>
                    <p className="text-2xl font-black text-white">{data.promedio_general}</p>
                  </div>
                </div>
                <div className="bg-[#1A237E] rounded-xl px-5 py-4 flex items-center gap-3">
                  <GraduationCap className="w-8 h-8 text-blue-300 shrink-0" />
                  <div>
                    <p className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">Créditos Acumulados</p>
                    <p className="text-2xl font-black text-white">{data.total_creditos_acumulados}</p>
                  </div>
                </div>
                <div className="bg-[#1B6B41] rounded-xl px-5 py-4 flex items-center gap-3">
                  <BookOpen className="w-8 h-8 text-green-300 shrink-0" />
                  <div>
                    <p className="text-[10px] text-green-300 font-bold uppercase tracking-wider">Periodos Cursados</p>
                    <p className="text-2xl font-black text-white">{data.periodos.length}</p>
                  </div>
                </div>
              </div>

              {/* Sin datos */}
              {data.periodos.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                  <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No hay periodos con actas cerradas registrados.</p>
                </div>
              )}

              {/* Periodos */}
              {data.periodos.map((periodo) => {
                const aprobadas = periodo.materias.filter(m => m.status === 'aprobada').length;
                const reprobadas = periodo.materias.filter(m => m.status === 'reprobada').length;
                const promedioP = (() => {
                  const califs = periodo.materias.map(m => m.calificacion_final).filter(c => c !== null);
                  return califs.length ? (califs.reduce((a, b) => a + b, 0) / califs.length).toFixed(1) : 'N/A';
                })();

                return (
                  <div key={periodo.periodo} className="mb-4 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="bg-[#0B172A] px-4 py-2.5 flex items-center justify-between">
                      <span className="text-white font-bold text-sm">{periodo.periodo}</span>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-green-400 font-bold flex items-center gap-1"><CheckCircle size={12} /> {aprobadas} aprobadas</span>
                        <span className="text-red-400 font-bold flex items-center gap-1"><XCircle size={12} /> {reprobadas} reprobadas</span>
                        <span className="text-[#D99000] font-bold">Prom. {promedioP}</span>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          <th className="py-2 px-4 text-left">Materia</th>
                          <th className="py-2 px-3 text-center">Créditos</th>
                          <th className="py-2 px-3 text-center">Calificación</th>
                          <th className="py-2 px-3 text-center">Estatus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {periodo.materias.map((m, i) => (
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-4 font-medium text-[#0B172A]">
                              {m.materia}
                              {m.is_retake && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">Recursada</span>}
                            </td>
                            <td className="py-2.5 px-3 text-center text-gray-600">{m.creditos ?? '-'}</td>
                            <td className="py-2.5 px-3 text-center font-black text-[#0B172A] text-base">{m.calificacion_final ?? '-'}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full capitalize ${getStatusStyle(m.status)}`}>
                                {m.status === 'aprobada' ? 'Aprobada' : m.status === 'reprobada' ? 'Reprobada' : 'Cursando'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default KardexModal;
