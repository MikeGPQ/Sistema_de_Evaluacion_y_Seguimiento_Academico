import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Download, User as UserIcon } from 'lucide-react';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import Swal from 'sweetalert2';
import client from '../../lib/axios';
import { useAuth } from '../../hooks/AuthContext';

const HORAS_CLASE = [
  "7:00 - 8:00", "8:00 - 9:00", "9:00 - 10:00",
  "10:00 - 11:00", "11:00 - 12:00", "12:00 - 13:00",
  "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00",
  "16:00 - 17:00", "17:00 - 18:00", "18:00 - 19:00",
  "19:00 - 20:00", "20:00 - 21:00"
];

const DIAS_SEMANA = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];

const MiHorario = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [clasesAsignadas, setClasesAsignadas] = useState([]);
  const [alumnoInfo, setAlumnoInfo] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargarDatosAcademicos = async () => {
      const matriculaActiva = user?.identifier || user?.matricula;

      if (!matriculaActiva) {
        setCargando(false);
        return;
      }

      try {
        const resPerfil = await client.get(`/asignacion/${matriculaActiva}/disponibles`);
        setAlumnoInfo({
          nombre: resPerfil.data.alumno_nombre,
          matricula: resPerfil.data.alumno_matricula,
          carrera: resPerfil.data.carrera,
          cuatrimestre: resPerfil.data.alumno_cuatrimestre,
          es_maestria: resPerfil.data.es_maestria
        });
        const resHorario = await client.get(`/asignacion/${matriculaActiva}/horario`);
        setClasesAsignadas(resHorario.data);
      } catch (error) {
        console.error("Error al cargar datos académicos:", error);
      } finally {
        setCargando(false);
      }
    };

    if (user) cargarDatosAcademicos();
  }, [user]);

  const handleDownloadPDF = async () => {
    const input = document.getElementById('horario-imprimible');
    if (!input || !alumnoInfo) return;

    Swal.fire({
      title: 'Generando PDF',
      text: 'Optimizando dimensiones y resolución espacial...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    window.scrollTo(0, 0);

    const scrollableDiv = input.querySelector('.overflow-x-auto');
    const originalOverflowX = scrollableDiv ? scrollableDiv.style.overflowX : '';
    const originalOverflowY = scrollableDiv ? scrollableDiv.style.overflowY : '';

    if (scrollableDiv) {
      scrollableDiv.style.overflowX = 'hidden';
      scrollableDiv.style.overflowY = 'hidden';
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      const dataUrl = await toPng(input, {
        quality: 1.0,
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });

      const imgWidthPx = input.offsetWidth;
      const imgHeightPx = input.offsetHeight;
      const pdfWidth = 280;
      const pdfHeight = (imgHeightPx * pdfWidth) / imgWidthPx;

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [pdfWidth + 20, pdfHeight + 70]
      });

      pdf.setFillColor(15, 23, 42);
      pdf.roundedRect(15, 15, 14, 14, 2, 2, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text("U", 22, 24.5, { align: "center" });

      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(22);
      pdf.text("UNID", 33, 22);

      pdf.setTextColor(100, 116, 139);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text("Universidad Interamericana para el", 33, 27);
      pdf.text("Desarrollo", 33, 31.5);

      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(15);
      pdf.setFont("helvetica", "bold");
      pdf.text("HORARIO ESCOLAR OFICIAL", pdfWidth + 5, 25, { align: "right" });

      pdf.setDrawColor(242, 169, 0);
      pdf.setLineWidth(1.5);
      pdf.line(15, 36, pdfWidth + 5, 36);

      pdf.setFontSize(11);
      pdf.setTextColor(100, 100, 100);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Alumno: ${alumnoInfo.nombre} | Matrícula: ${alumnoInfo.matricula}`, 15, 45);
      pdf.text(`Carrera: ${alumnoInfo.carrera} | Periodo: 2026-1`, 15, 52);

      pdf.addImage(dataUrl, 'PNG', 10, 58, pdfWidth, pdfHeight);
      pdf.save(`Horario_${alumnoInfo.matricula}.pdf`);

    } catch (error) {
      Swal.fire('Error', 'Fallo al generar el PDF.', 'error');
    } finally {
      if (scrollableDiv) {
        scrollableDiv.style.overflowX = originalOverflowX;
        scrollableDiv.style.overflowY = originalOverflowY;
      }
      Swal.close();
    }
  };

  const totalMaterias = new Set(clasesAsignadas.map(c => c.materia)).size;
  const totalHoras = clasesAsignadas.reduce((sum, clase) => sum + (clase.duracion || 0), 0);

  if (cargando) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
      <p className="text-gray-400 font-medium">Cargando horario...</p>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] font-sans">
      <header className="bg-white border-b border-gray-200 h-16 flex items-center px-8 shrink-0 shadow-sm">
        <div className="flex items-center text-sm text-gray-500">
          Portal del Alumno &gt; <span className="text-[#1A237E] ml-1 font-bold">Mi Horario</span>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">

          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {alumnoInfo?.nombre ? `Hola, ${alumnoInfo.nombre.split(' ')[0]}` : 'Mi Horario'}
              </h1>
              <p className="text-gray-500 text-sm">Ciclo Escolar 2026-1</p>
            </div>

            <div className="flex bg-gray-200 p-1 rounded-lg shadow-inner w-full md:w-auto overflow-x-auto">

              {alumnoInfo && alumnoInfo.cuatrimestre >= 2 && !alumnoInfo.es_maestria && (
                <button
                  onClick={() => navigate('/alumno/carga-academica')}
                  className="flex items-center px-4 py-2 rounded-md text-sm font-bold transition-all text-gray-500 hover:text-gray-700 whitespace-nowrap"
                >
                  Gestionar Carga
                </button>
              )}

              <button
                onClick={handleDownloadPDF}
                disabled={clasesAsignadas.length === 0}
                className="flex items-center px-4 py-2 rounded-md text-sm font-bold transition-all bg-white shadow text-[#1A237E] disabled:opacity-50 disabled:shadow-none whitespace-nowrap"
              >
                <Download className="w-4 h-4 mr-1.5" /> Descargar PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center shadow-sm">
              <div className="bg-blue-50 p-3 rounded-lg text-blue-600 mr-4"><UserIcon className="w-6 h-6" /></div>
              <div><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Matrícula</p><p className="text-lg font-bold text-gray-700 font-mono">{alumnoInfo?.matricula}</p></div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center shadow-sm">
              <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600 mr-4"><BookOpen className="w-6 h-6" /></div>
              <div><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Asignaturas</p><p className="text-lg font-bold text-gray-700">{totalMaterias} Materias</p></div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center shadow-sm">
              <div className="bg-green-50 p-3 rounded-lg text-green-600 mr-4"><Clock className="w-6 h-6" /></div>
              <div><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Carga Semanal</p><p className="text-lg font-bold text-gray-700">{totalHoras} Horas</p></div>
            </div>
          </div>

          <div id="horario-imprimible" className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden p-8">
            <div className="mb-8 flex flex-col md:flex-row justify-between md:items-start border-b-2 border-gray-100 pb-6">
              <div className="flex-1 pr-4">
                <h2 className="text-xl md:text-2xl font-black text-[#1A237E] uppercase tracking-tight leading-tight mb-4">{alumnoInfo?.carrera}</h2>
                <div className="inline-block bg-gray-50 px-4 py-1.5 rounded border border-gray-200">
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">CUATRIMESTRE: <span className="text-[#1A237E] ml-1">{alumnoInfo?.cuatrimestre}</span></p>
                </div>
              </div>
              <div className="shrink-0 mt-4 md:mt-0">
                <span className="bg-blue-50 text-[#1A237E] text-[10px] font-bold px-4 py-2 rounded-full uppercase border border-blue-100 whitespace-nowrap shadow-sm inline-block">SESA - Sistema Escolar</span>
              </div>
            </div>

            {clasesAsignadas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <BookOpen className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-base font-semibold">Sin materias asignadas</p>
                <p className="text-sm mt-1">Aún no tienes materias registradas para este periodo.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse min-w-[1000px] table-fixed">
                  <thead className="bg-gray-50 text-gray-600 text-[11px] uppercase font-black text-center">
                    <tr>
                      <th className="py-4 px-4 w-28 border border-gray-200 bg-gray-100">Hora</th>
                      {DIAS_SEMANA.map(dia => (<th key={dia} className="py-4 px-4 border border-gray-200 w-1/6">{dia}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {HORAS_CLASE.map((hora, idx) => {
                      const rowHour = parseInt(hora.split(':')[0]);
                      return (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="py-4 px-2 font-bold text-gray-400 text-center border-r border-gray-200 bg-gray-50/50 text-[10px]">{hora}</td>
                          {DIAS_SEMANA.map(dia => {
                            const claseInicia = clasesAsignadas.find(c => c.dia === dia && c.hora_inicio === rowHour);
                            const claseContinua = clasesAsignadas.find(c => c.dia === dia && c.hora_inicio < rowHour && (c.hora_inicio + c.duracion) > rowHour);
                            if (claseContinua) return null;
                            if (claseInicia) {
                              return (
                                <td key={`${dia}-${hora}`} rowSpan={claseInicia.duracion} className="p-1.5 border-r border-gray-100 align-top">
                                  <div className="text-white rounded-lg p-3 flex flex-col shadow-sm transition-all hover:scale-[1.02]" style={{ backgroundColor: claseInicia.color, height: '100%', minHeight: `${claseInicia.duracion * 4.5}rem` }}>
                                    <span className="font-black text-[10px] leading-tight uppercase tracking-tight mb-2">{claseInicia.materia}</span>
                                    <div className="mt-auto border-t border-white/20 pt-2">
                                      <span className="block text-[9px] opacity-90 font-medium truncate">{claseInicia.profe}</span>
                                      <span className="text-[9px] font-mono mt-1 bg-black/15 inline-block px-2 py-0.5 rounded whitespace-nowrap">{claseInicia.aula || 'Por Asignar'}</span>
                                    </div>
                                  </div>
                                </td>
                              );
                            }
                            return <td key={`${dia}-${hora}`} className="p-1.5 border-r border-gray-100 align-top"></td>;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default MiHorario;