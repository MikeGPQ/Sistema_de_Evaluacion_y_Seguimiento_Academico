import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, Clock, AlertCircle, Download } from 'lucide-react';
import client from '../../lib/axios'; 
import { useAuth } from '../../hooks/AuthContext'; 
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const MisCalificaciones = () => {
  const { user } = useAuth(); // Obtenemos el usuario autenticado para sacar la matrícula

  // Estados para manejar los datos y el estado de carga/error
  const [calificaciones, setCalificaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodos, setPeriodos] = useState([]);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('');

  // Carga los periodos al montar y establece el activo por defecto
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
    if (calificaciones.length === 0) return "0.0";
    const sum = calificaciones.reduce((acc, curr) => acc + (curr.calificacion_final || 0), 0);
    return (sum / calificaciones.length).toFixed(1);
  };
  const handleDownloadPDF = () => {
  try {
    console.log("Iniciando generación de PDF..."); // Para que veas que sí reacciona
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    // --- 1. ENCABEZADO ---
    doc.setFontSize(18);
    doc.setTextColor(11, 23, 42); 
    doc.text("UNID", margin, 20); // [cite: 2]
    doc.setFontSize(10);
    doc.text("UNIVERSIDAD INTERAMERICANA PARA EL DESARROLLO", margin, 25); // [cite: 2]
    
    doc.setFontSize(8);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, pageWidth - margin, 20, { align: 'right' }); // [cite: 27, 28]

    doc.setLineWidth(0.5);
    doc.line(margin, 30, pageWidth - margin, 30);

    // --- 2. DATOS DEL ALUMNO --- [cite: 3, 6, 8, 12]
    doc.setFont(undefined, 'bold');
    doc.text("NOMBRE DEL ALUMNO:", margin, 40);
    doc.text("MATRÍCULA:", margin + 100, 40);
    
    doc.setFont(undefined, 'normal');
    const nombreFormateado = (user?.nombre_completo || 'N/A')
  .toLowerCase()
  .split(' ')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

doc.text(nombreFormateado, margin, 45);
    doc.text(`${user?.identifier || 'N/A'}`, margin + 100, 45); // [cite: 6]

    doc.setFont(undefined, 'bold');
    doc.text("CARRERA:", margin, 55);
    doc.text("PERIODO ACADÉMICO:", margin + 100, 55);

    doc.setFont(undefined, 'normal');
    doc.text(`${calificaciones[0]?.carrera || 'N/A'}`, margin, 60);
    doc.text(`${periodoSeleccionado || 'N/A'}`, margin + 100, 60);

    doc.setFont(undefined, 'bold');
    doc.text("CAMPUS:", margin, 68);
    doc.setFont(undefined, 'normal');
    doc.text("San Francisco de Campeche", margin, 73);

    // --- 3. TABLAS POR MATERIA --- [cite: 16]
    let currentY = 85;

    calificaciones.forEach((materia) => {
      // Si la tabla se va a salir de la página, agrega una nueva
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont(undefined, 'bold');
      doc.setFillColor(243, 244, 246);
      doc.rect(margin, currentY, pageWidth - (margin * 2), 7, 'F');
      doc.text(materia.materia.toUpperCase(), margin + 2, currentY + 5); // [cite: 17, 18, 19]

      autoTable(doc, {
        startY: currentY + 7,
        margin: { left: margin, right: margin },
        head: [['PRIMER PARCIAL', 'SEGUNDO PARCIAL', 'FINAL', 'PROMEDIO FINAL']], // [cite: 17, 20]
        body: [[
          materia.parcial_1 ?? '-', 
          materia.parcial_2 ?? '-', 
          materia.parcial_3 ?? '-', 
          materia.calificacion_final ?? '-'
        ]],
        theme: 'grid',
        headStyles: { fillColor: [11, 23, 42], fontSize: 8, halign: 'center' },
        styles: { fontSize: 9, halign: 'center' },
      });

      currentY = doc.lastAutoTable.finalY + 10;
    });

    // --- 4. PIE DE PÁGINA --- [cite: 22, 23]
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text(`PROMEDIO GENERAL DEL PERIODO: ${calcularPromedioPeriodo()}`, margin, currentY + 5); // [cite: 26]
    
    doc.setFont(undefined, 'italic');
    doc.setFontSize(7);
    doc.text("Nota de Validez: Documento informativo sin validez oficial sin sello de Servicios Escolares.", margin, currentY + 15); // [cite: 23, 24]

    // DISPARAR DESCARGA
    doc.save(`Reporte_SESA_${user?.identifier || 'alumno'}.pdf`);
    console.log("PDF generado con éxito.");

  } catch (err) {
    console.error("Error crítico al generar PDF:", err);
    alert("Hubo un problema al generar el PDF. Revisa la consola (F12).");
  }
};
  // Función auxiliar para renderizar el badge de estatus
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
      default: // 'cursando'
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">
            <Clock size={14} /> Cursando
          </span>
        );
    }
  };

  // Renderizado en estado de carga
  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#0B172A]"></div>
      </div>
    );
  }

  // Renderizado en caso de error
  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg inline-block font-medium shadow-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans">
      {/* Cabecera dinámica [cite: 5] */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B172A]">Mis Calificaciones</h1>
          <p className="text-gray-500 mt-1">Consulta tus calificaciones por periodo</p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleDownloadPDF} 
            disabled={calificaciones.length === 0}
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
      {/* Si no hay materias */}
      {calificaciones.length === 0 ? (
        <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center">
          <BookOpen className="mx-auto h-16 w-16 text-gray-200 mb-4" />
          <h3 className="text-xl font-medium text-gray-900">No hay materias registradas</h3>
          <p className="text-gray-500 mt-2">Aún no tienes calificaciones capturadas para este periodo o no estás inscrito en ningún grupo.</p>
        </div>
      ) : (
        /* Grid de Materias */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {calificaciones.map((item, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              {/* Header de la Tarjeta */}
              <div className="bg-[#0B172A] p-4 flex justify-between items-center text-white">
                <div className="flex items-center gap-3">
                  <BookOpen size={20} className="text-[#D99000]" />
                  <h2 className="font-bold text-[15px] tracking-wide">{item.materia}</h2>
                </div>
                {renderStatusBadge(item.status)}
              </div>

              {/* Tabla interna */}
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
      )}
    </div>
  );
};

export default MisCalificaciones;