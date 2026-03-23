import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, Clock, AlertCircle, Download } from 'lucide-react';
import client from '../../lib/axios'; 
import { useAuth } from '../../hooks/AuthContext'; 
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const MisCalificaciones = () => {
  const { user } = useAuth();

  const [calificaciones, setCalificaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodos, setPeriodos] = useState([]);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('');

  useEffect(() => {
    client.get('/alumnos/periodos').then(res => {
      setPeriodos(res.data);
      const activo = res.data.find(p => p.is_active) || res.data[0];
      if (activo) setPeriodoSeleccionado(activo.period_name);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.identifier || !periodoSeleccionado) return;
    const fetchCalificaciones = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await client.get(`/alumnos/mis-calificaciones/${user.identifier}?periodo=${periodoSeleccionado}`);
        setCalificaciones(res.data);
      } catch (err) {
        console.error("Error obteniendo calificaciones:", err);
        setError("No se pudieron cargar tus calificaciones. Intenta más tarde.");
      } finally {
        setLoading(false);
      }
    };
    fetchCalificaciones();
  }, [user, periodoSeleccionado]);
  
  const calcularPromedioPeriodo = () => {
    const conFinal = calificaciones.filter(c => c.calificacion_final !== null && c.calificacion_final !== undefined);
    if (conFinal.length === 0) return "N/A";
    const sum = conFinal.reduce((acc, curr) => acc + curr.calificacion_final, 0);
    return (sum / conFinal.length).toFixed(1);
  };

  const capitalizarNombre = (nombreCrudo) => {
    if (!nombreCrudo) return 'N/A';
    return nombreCrudo
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // --- GENERACIÓN DEL PDF ---
  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const primary = [11, 23, 42];
      const gold = [217, 144, 0];

      // ── 1. ENCABEZADO ──────────────────────────────────────
      // Icono cuadrado "U"
      doc.setFillColor(primary[0], primary[1], primary[2]);
      doc.roundedRect(margin, 12, 13, 13, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text("U", margin + 6.5, 20.5, { align: 'center' });

      // UNID + subtítulo
      doc.setTextColor(primary[0], primary[1], primary[2]);
      doc.setFontSize(15);
      doc.setFont(undefined, 'bold');
      doc.text("UNID", margin + 17, 20);
      doc.setFontSize(6.5);
      doc.setFont(undefined, 'normal');
      doc.text("UNIVERSIDAD INTERAMERICANA", margin + 17, 24.5);
      doc.text("PARA EL DESARROLLO", margin + 17, 28.5);

      // Derecha: título del reporte
      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(primary[0], primary[1], primary[2]);
      doc.text("REPORTE DE CALIFICACIONES", pageWidth - margin, 20, { align: 'right' });
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text("DOCUMENTO OFICIAL", pageWidth - margin, 25.5, { align: 'right' });

  
      doc.setDrawColor(gold[0], gold[1], gold[2]);
      doc.setLineWidth(1.5);
      doc.line(margin, 34, pageWidth - margin, 34);

    
      const boxX = margin;
      const boxY = 40;
      const boxW = pageWidth - margin * 2;
      const boxH = 60;
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.3);
      doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, 'S');

      const col1 = boxX + 6;
      const col2 = boxX + boxW / 2 + 3;

      const drawField = (label, value, x, y) => {
        doc.setFontSize(6.5);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(140, 140, 140);
        doc.text(label, x, y);
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(primary[0], primary[1], primary[2]);
        const lines = doc.splitTextToSize(value, boxW / 2 - 10);
        doc.text(lines, x, y + 5);
      };

      let infoY = boxY + 10;
      drawField("NOMBRE DEL ALUMNO", capitalizarNombre(user?.nombre_completo), col1, infoY);
      drawField("MATRÍCULA", `${user?.identifier || 'N/A'}`, col2, infoY);
      infoY += 18;
      drawField("CARRERA", `${calificaciones[0]?.carrera || 'N/A'}`, col1, infoY);
      drawField("PERIODO ACADÉMICO", `${periodoSeleccionado || 'N/A'}`, col2, infoY);
      infoY += 18;
      drawField("CUATRIMESTRE", `${calificaciones[0]?.cuatrimestre || '4'}° Cuatrimestre`, col1, infoY);
      drawField("CAMPUS", "San Francisco de Campeche", col2, infoY);

    
      let currentY = boxY + boxH + 10;
      doc.setFillColor(primary[0], primary[1], primary[2]);
      doc.rect(margin,       currentY - 4, 3, 3, 'F');
      doc.rect(margin + 4.5, currentY - 4, 3, 3, 'F');
      doc.setFontSize(8.5);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(primary[0], primary[1], primary[2]);
      doc.text("MATERIAS INSCRITAS", margin + 10, currentY - 1);
      currentY += 5;

      
      calificaciones.forEach((materia) => {
        if (currentY > 240) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(primary[0], primary[1], primary[2]);
        doc.text(materia.materia, margin + 4, currentY + 7);

        autoTable(doc, {
          startY: currentY + 10,
          margin: { left: margin, right: margin },
          head: [['PRIMER PARCIAL', 'SEGUNDO PARCIAL', 'EXAMEN FINAL', 'PROMEDIO FINAL']],
          body: [[
            materia.parcial_1 ?? '-',
            materia.parcial_2 ?? '-',
            materia.parcial_3 ?? '-',
            materia.calificacion_final ?? '-',
          ]],
          theme: 'plain',
          headStyles: {
            textColor: [160, 160, 160],
            fontSize: 7,
            halign: 'center',
            fontStyle: 'bold',
            cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
          },
          bodyStyles: {
            textColor: primary,
            fontSize: 15,
            fontStyle: 'bold',
            halign: 'center',
            cellPadding: { top: 3, bottom: 5, left: 1, right: 1 },
          },
          columnStyles: {
            0: { lineColor: [220, 220, 220], lineWidth: { right: 0.2 } },
            1: { lineColor: [220, 220, 220], lineWidth: { right: 0.2 } },
            2: { lineColor: [220, 220, 220], lineWidth: { right: 0.2 } },
          },
        });

       
        const cardEnd = doc.lastAutoTable.finalY;
        doc.setDrawColor(210, 210, 210);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, currentY, pageWidth - margin * 2, cardEnd - currentY + 3, 2, 2, 'S');

        currentY = cardEnd + 10;
      });

      if (currentY > 245) { doc.addPage(); currentY = 20; }
      currentY += 5;

      const labelW = 52;
      const labelH = 16;
      const labelX = pageWidth - margin - labelW - 22;

      doc.setFillColor(primary[0], primary[1], primary[2]);
      doc.roundedRect(labelX, currentY, labelW, labelH, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.text("PROMEDIO GENERAL",  labelX + labelW / 2, currentY + 6,  { align: 'center' });
      doc.text("Del periodo actual", labelX + labelW / 2, currentY + 11, { align: 'center' });

      doc.setTextColor(primary[0], primary[1], primary[2]);
      doc.setFontSize(22);
      doc.setFont(undefined, 'bold');
      doc.text(`${calcularPromedioPeriodo()}`, labelX + labelW + 11, currentY + 12, { align: 'center' });

      currentY += labelH + 14;

      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);
      doc.setFont(undefined, 'bold');
      doc.text("Nota de Validez:", margin, currentY);
      doc.setFont(undefined, 'normal');
      doc.text("Este documento es de carácter informativo y refleja el estado", margin, currentY + 4);
      doc.text("académico del alumno al momento de su emisión. Para trámites oficiales,", margin, currentY + 8);
      doc.text("solicite una versión sellada en Servicios Escolares.", margin, currentY + 12);

      doc.setFont(undefined, 'bold');
      doc.text("Fecha de Emisión", pageWidth - margin, currentY + 4, { align: 'right' });
      doc.setFont(undefined, 'normal');
      doc.text(
        new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }),
        pageWidth - margin, currentY + 9, { align: 'right' }
      );

      currentY += 18;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      doc.setFontSize(6.5);
      doc.setTextColor(140, 140, 140);
      doc.setFont(undefined, 'normal');
      doc.text("ID Sistema 8829-AD-221 | Generado por: Admin. Académica", margin, currentY + 5);

      doc.save(`Reporte_Calificaciones_${user?.identifier || 'alumno'}.pdf`);
    } catch (err) {
      console.error("Error crítico al generar PDF:", err);
      alert("Hubo un problema al generar el PDF. Revisa la consola (F12).");
    }
  };


  const renderStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'aprobada':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
            <CheckCircle size={14} /> Aprobada
          </span>
        );
      case 'reprobada':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
            <AlertCircle size={14} /> Reprobada
          </span>
        );
      default: 
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">
            <Clock size={14} /> Cursando
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#0B172A]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg inline-block font-medium shadow-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B172A]">Mis Calificaciones</h1>
          <p className="text-gray-500 mt-1">Consulta tus calificaciones por periodo</p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleDownloadPDF} 
            disabled={calificaciones.length === 0 || calcularPromedioPeriodo() === 'N/A'}
            className="flex items-center gap-2 bg-[#0B172A] text-white px-4 py-2 rounded-md text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            Descargar PDF
          </button>

          <select
            value={periodoSeleccionado}
            onChange={e => setPeriodoSeleccionado(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0B172A] bg-white shadow-sm"
          >
            {periodos.map(p => (
              <option key={p.period_name} value={p.period_name}>
                {p.period_name}{p.is_active ? ' (Actual)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {calificaciones.length === 0 ? (
        <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center">
          <BookOpen className="mx-auto h-16 w-16 text-gray-200 mb-4" />
          <h3 className="text-xl font-medium text-gray-900">No hay materias registradas</h3>
          <p className="text-gray-500 mt-2">Aún no tienes calificaciones capturadas para este periodo o no estás inscrito en ningún grupo.</p>
        </div>
      ) : (
        <>
          {/* Promedio general del periodo */}
          <div className="mb-6 flex items-center justify-between bg-[#0B172A] rounded-xl px-6 py-4 shadow-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Promedio general del periodo</p>
              <p className="text-gray-300 text-sm mt-0.5">Solo materias con promedio final registrado</p>
            </div>
            <span className={`text-4xl font-black ${calcularPromedioPeriodo() === 'N/A' ? 'text-gray-400' : 'text-[#D99000]'}`}>
              {calcularPromedioPeriodo()}
            </span>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {calificaciones.map((item, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="bg-[#0B172A] p-4 flex justify-between items-center text-white">
                <div className="flex items-center gap-3">
                  <BookOpen size={20} className="text-[#D99000]" />
                  <h2 className="font-bold text-[15px] tracking-wide">{item.materia}</h2>
                </div>
                {renderStatusBadge(item.status)}
              </div>
              <div className="p-0">
                <table className="w-full text-center">
                  <thead className="bg-gray-50 border-b border-gray-100 text-[11px] text-gray-500 uppercase font-bold tracking-wider">
                    <tr>
                      <th className="py-3 px-2 w-1/4">1er Parcial</th>
                      <th className="py-3 px-2 border-l border-gray-100 w-1/4">2do Parcial</th>
                      <th className="py-3 px-2 border-l border-gray-100 w-1/4">Final (3er)</th>
                      <th className="py-3 px-2 border-l border-gray-100 bg-[#D99000]/10 text-[#0B172A] w-1/4">Promedio</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-800">
                    <tr>
                      <td className="py-5 px-2 text-xl font-semibold">
                        {item.parcial_1 !== null ? item.parcial_1 : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="py-5 px-2 text-xl font-semibold border-l border-gray-100">
                        {item.parcial_2 !== null ? item.parcial_2 : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="py-5 px-2 text-xl font-semibold border-l border-gray-100">
                        {item.parcial_3 !== null ? item.parcial_3 : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="py-5 px-2 text-2xl font-black border-l border-gray-100 bg-[#D99000]/5 text-[#0B172A]">
                        {item.calificacion_final !== null ? item.calificacion_final : <span className="text-gray-300 font-medium">-</span>}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
};

export default MisCalificaciones;