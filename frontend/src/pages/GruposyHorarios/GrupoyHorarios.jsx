import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, ArrowLeft, BookOpen, Clock, AlertTriangle, 
  CheckCircle, Save, Calendar, User, Download, ChevronRight, ChevronLeft
} from 'lucide-react';
import client from '../../lib/axios';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

// Constantes globales de estructura
const HORAS_CLASE = [
  "7:00 - 8:00", "8:00 - 9:00", "9:00 - 10:00", 
  "10:00 - 11:00", "11:00 - 12:00", "12:00 - 13:00", 
  "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00",
  "16:00 - 17:00", "17:00 - 18:00", "18:00 - 19:00",
  "19:00 - 20:00", "20:00 - 21:00"
];

const DIAS_SEMANA = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];

const GruposYHorarios = () => {
  const navigate = useNavigate();
  const [vistaActual, setVistaActual] = useState('asignacion'); 
  
  // Estados dinámicos
  const [matriculaBuscada, setMatriculaBuscada] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  
  const [alumnoInfo, setAlumnoInfo] = useState(null);
  const [materiasRegulares, setMateriasRegulares] = useState([]);
  const [materiasRecursamiento, setMateriasRecursamiento] = useState([]);
  const [horarioReal, setHorarioReal] = useState([]); 

  const [seleccion, setSeleccion] = useState({});
  const [inscripcionesOriginales, setInscripcionesOriginales] = useState([]);
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  // Función principal de búsqueda
  const buscarAlumno = async (matriculaAUsar = matriculaBuscada) => {
    if (!matriculaAUsar) return;
    setCargando(true);
    setAlumnoInfo(null);
    setSeleccion({});
    setHorarioReal([]);

    try {
      const response = await client.get(`/asignacion/${matriculaAUsar}/disponibles`);
      const data = response.data;
      
      try {
        const resHorario = await client.get(`/asignacion/${matriculaAUsar}/horario`);
        setHorarioReal(resHorario.data);
      } catch (errHorario) {
        console.error("Error al cargar el horario de la base de datos", errHorario);
      }

      setAlumnoInfo({
        matricula: data.alumno_matricula,
        nombre: data.alumno_nombre,
        cuatrimestre: data.alumno_cuatrimestre,
        carrera: data.carrera,
        grupoBase: data.grupo_base,
        bloqueado: data.grupo_base_bloqueado
      });
      
      setMateriasRegulares(data.materias_regulares);
      setMateriasRecursamiento(data.materias_recursamiento);

      const seleccionInicial = {};
      const gruposQueYaTenia = data.grupos_inscritos || [];

      const escanearCatalogo = (catalogo, isRetake) => {
        catalogo.forEach(mat => {
          mat.grupos_disponibles.forEach(g => {
            if (gruposQueYaTenia.includes(g.group_id)) {
              seleccionInicial[mat.subject_id] = { group_id: g.group_id, is_retake: isRetake };
            }
          });
        });
      };

      escanearCatalogo(data.materias_regulares, false);
      escanearCatalogo(data.materias_recursamiento, true);

      setSeleccion(seleccionInicial);
      setInscripcionesOriginales(gruposQueYaTenia);
      setVistaActual('asignacion'); 

    } catch (error) {
      Swal.fire({ icon: 'error', title: 'No encontrado', text: 'No se encontraron datos para la matrícula ingresada.' });
    } finally {
      setCargando(false);
    }
  };

  const handleCambioInput = async (e) => {
    const valor = e.target.value.replace(/\D/g, ''); 
    setMatriculaBuscada(valor);
    if (valor.length >= 3 && valor.length < 8) {
      try {
        const res = await client.get(`/asignacion/buscar-alumno?q=${valor}`);
        setSugerencias(res.data);
        setMostrarSugerencias(true);
      } catch (error) { setSugerencias([]); }
    } else { setMostrarSugerencias(false); }
  };

  const handleSeleccionarSugerencia = (matriculaElegida) => {
    setMatriculaBuscada(matriculaElegida);
    setMostrarSugerencias(false); 
    buscarAlumno(matriculaElegida); 
  };

  const handleSeleccionGrupo = async (subjectId, groupId, isRetake) => {
    if (seleccion[subjectId]?.group_id === groupId) {
      if (inscripcionesOriginales.includes(groupId)) {
        const confirmacion = await Swal.fire({
          title: '¿Dar de baja materia?',
          text: 'Esta acción modificará la carga oficial del alumno. ¿Proceder?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Sí, dar de baja',
          cancelButtonText: 'Cancelar'
        });
        if (!confirmacion.isConfirmed) return;
      }
      setSeleccion(prev => {
        const nueva = { ...prev };
        delete nueva[subjectId];
        return nueva;
      });
    } else {
      setSeleccion(prev => ({
        ...prev,
        [subjectId]: { group_id: groupId, is_retake: isRetake }
      }));
    }
  };

  const handleGuardarCarga = async () => {
    const materiasPayload = Object.entries(seleccion).map(([subjectId, data]) => ({
      subject_id: parseInt(subjectId),
      group_id: data.group_id,
      is_retake: data.is_retake
    }));

    if (materiasPayload.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Atención', text: 'Selecciona al menos una materia para guardar.' });
      return;
    }

    setGuardando(true);
    try {
      const response = await client.post(`/asignacion/${alumnoInfo.matricula}/guardar`, { materias: materiasPayload });
      await Swal.fire({ icon: 'success', title: 'Éxito', text: response.data.message });
      const resHorario = await client.get(`/asignacion/${alumnoInfo.matricula}/horario`);
      setHorarioReal(resHorario.data);
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.detail || 'Error al procesar la carga.' });
    } finally { setGuardando(false); }
  };

  const handleDownloadPDF = async () => {
    const input = document.getElementById('horario-imprimible');
    if (!input || !alumnoInfo) return;

    Swal.fire({ 
      title: 'Generando PDF', 
      text: 'Optimizando resolución y escala...', 
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

      // 🌟 PixelRatio 4 para que se vea perfecto al hacer zoom
      const dataUrl = await toPng(input, { 
        quality: 1.0, 
        backgroundColor: '#ffffff', 
        pixelRatio: 4 
      });

      const imgWidthPx = input.offsetWidth;
      const imgHeightPx = input.offsetHeight;
      const pdfWidth = 280; // Ancho base en mm
      const pdfHeight = (imgHeightPx * pdfWidth) / imgWidthPx;

      // 🌟 Creamos el PDF con formato dinámico basado en el contenido
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [pdfWidth + 20, pdfHeight + 60] 
      });

      pdf.setFontSize(22); pdf.setTextColor(26, 35, 126);
      pdf.text(`SESA - HORARIO ESCOLAR`, 15, 20);
      
      pdf.setFontSize(12); pdf.setTextColor(100);
      pdf.text(`Alumno: ${alumnoInfo.nombre} | Matrícula: ${alumnoInfo.matricula}`, 15, 30);
      pdf.text(`Carrera: ${alumnoInfo.carrera} | Periodo: 2026-1`, 15, 38);

      pdf.addImage(dataUrl, 'PNG', 10, 50, pdfWidth, pdfHeight);
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

  const TarjetaMateria = ({ materia, isRetake }) => (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-4 hover:border-blue-300 transition-colors">
      <div className="flex justify-between items-start mb-3 border-b pb-2">
        <div>
          <h4 className="font-bold text-gray-800 text-sm">{materia.nombre}</h4>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1 inline-block ${isRetake ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-800'}`}>
            {materia.tipo}
          </span>
        </div>
        <span className="text-xs text-gray-500 font-mono">{materia.subject_id}</span>
      </div>
      <div className="space-y-2">
        {materia.grupos_disponibles.map((grupo) => {
          const isLleno = grupo.cupo_disponible === 0;
          const isSelected = seleccion[materia.subject_id]?.group_id === grupo.group_id;
          return (
            <div 
              key={grupo.group_id} 
              onClick={() => { if (!isLleno) handleSeleccionGrupo(materia.subject_id, grupo.group_id, isRetake); }}
              className={`flex items-center justify-between p-2.5 rounded-md border cursor-pointer transition-all ${isLleno ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed' : isSelected ? 'bg-blue-50 border-[#1A237E] ring-1 ring-[#1A237E]' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-3">
                <input type="radio" checked={isSelected} readOnly className="w-4 h-4 text-[#1A237E]" />
                <div>
                  <p className="text-sm font-bold text-gray-800">Grupo {grupo.nombre}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3" /> {grupo.horario}</p>
                </div>
              </div>
              <div className="text-right"><span className={`text-xs font-bold ${isLleno ? 'text-red-500' : 'text-green-600'}`}>{isLleno ? 'Lleno' : `${grupo.cupo_disponible} disp.`}</span></div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] font-sans">
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8 shrink-0 shadow-sm">
        <div className="flex items-center text-sm text-gray-500">Inicio &gt; <button onClick={() => navigate('/alumnos/listado')} className="mx-1 hover:text-[#1A237E] hover:underline transition-colors focus:outline-none">Alumnos</button> &gt; <span className="text-[#1A237E] ml-1 font-bold">Asignación y Visualización</span></div>
      </header>

      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
            <div>
              <button onClick={() => navigate('/alumnos/listado')} className="flex items-center text-sm text-gray-600 hover:text-[#1A237E] font-medium mb-4 transition-colors group"><ArrowLeft className="w-4 h-4 mr-1.5 group-hover:-translate-x-1 transition-transform" /> Volver al listado</button>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Gestión de Horarios</h1>
              <p className="text-gray-500 text-sm">Administración de carga académica y horarios por alumno.</p>
            </div>
            {alumnoInfo && (
              <div className="flex bg-gray-200 p-1 rounded-lg shadow-inner">
                <button onClick={() => setVistaActual('asignacion')} className={`flex items-center px-4 py-2 rounded-md text-sm font-bold transition-all ${vistaActual === 'asignacion' ? 'bg-white shadow text-[#1A237E]' : 'text-gray-500 hover:text-gray-700'}`}><ChevronLeft className="w-4 h-4 mr-1" /> Asignar Carga</button>
                <button onClick={() => setVistaActual('horario')} className={`flex items-center px-4 py-2 rounded-md text-sm font-bold transition-all ${vistaActual === 'horario' ? 'bg-white shadow text-[#1A237E]' : 'text-gray-500 hover:text-gray-700'}`}>Ver Horario <ChevronRight className="w-4 h-4 ml-1" /></button>
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row items-end gap-4">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Matrícula del Estudiante</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400" /></div>
                <input type="text" value={matriculaBuscada} maxLength={8} onChange={handleCambioInput} onBlur={() => setTimeout(() => setMostrarSugerencias(false), 200)} placeholder="Ingresa matrícula..." className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#1A237E] font-mono" />
                {mostrarSugerencias && sugerencias.length > 0 && (
                  <ul className="absolute z-50 w-full bg-white border border-gray-200 mt-1 rounded-md shadow-xl max-h-60 overflow-auto divide-y divide-gray-100">
                    {sugerencias.map(s => (
                      <li key={s.matricula} onMouseDown={() => handleSeleccionarSugerencia(s.matricula)} className="px-4 py-3 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors">
                        <span className="font-bold text-[#1A237E] font-mono">{s.matricula}</span><span className="text-xs text-gray-600 truncate ml-3 uppercase font-medium">{s.nombre}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <button onClick={() => buscarAlumno()} disabled={cargando || matriculaBuscada.length < 3} className="bg-[#1A237E] text-white px-6 py-2.5 rounded-md text-sm font-bold hover:bg-[#283593] disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap">{cargando ? 'Buscando...' : 'Cargar Datos'}</button>
          </div>

          {alumnoInfo && vistaActual === 'asignacion' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-[#1A237E] p-3 rounded-full text-white"><User className="w-6 h-6" /></div>
                    <div><h3 className="font-bold text-blue-900">{alumnoInfo.nombre}</h3><p className="text-xs text-blue-700 font-medium">Matrícula: {alumnoInfo.matricula} | {alumnoInfo.carrera} | Cuatrimestre: {alumnoInfo.cuatrimestre}</p></div>
                  </div>
                </div>
                {materiasRecursamiento.length > 0 && (<div><h3 className="text-sm font-bold text-red-700 flex items-center gap-2 mb-3 border-b border-red-200 pb-2"><AlertTriangle className="w-4 h-4" /> Materias Pendientes</h3>{materiasRecursamiento.map(mat => <TarjetaMateria key={mat.subject_id} materia={mat} isRetake={true} />)}</div>)}
                <div><h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3 border-b border-gray-200 pb-2"><BookOpen className="w-4 h-4 text-blue-600" /> Carga Regular</h3>{materiasRegulares.map(mat => <TarjetaMateria key={mat.subject_id} materia={mat} isRetake={false} />)}</div>
              </div>
              <div className="lg:col-span-4">
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm sticky top-6">
                  <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg"><h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Calendar className="w-4 h-4 text-[#1A237E]" /> Resumen de Selección</h3></div>
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-4 text-sm"><span className="text-gray-500">Asignaturas:</span><span className="font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded">{Object.keys(seleccion).length}</span></div>
                   <button onClick={handleGuardarCarga} disabled={guardando || Object.keys(seleccion).length === 0} className="w-full bg-[#1A237E] text-white py-3 rounded-md text-sm font-bold hover:bg-[#283593] disabled:opacity-50 shadow-sm transition-colors flex items-center justify-center gap-2">
                     <Save className="w-4 h-4" /> 
                    {guardando ? 'Guardando...' : 'Confirmar Carga'}
                  </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {alumnoInfo && vistaActual === 'horario' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex gap-4 w-full md:w-auto">
                  <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between min-w-[200px] shadow-sm">
                    <div><p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Asignaturas</p><p className="text-3xl font-bold text-gray-800">{new Set(horarioReal.map(c => c.materia)).size}</p></div>
                    <div className="bg-blue-100 p-3 rounded-lg text-blue-600"><BookOpen className="w-6 h-6" /></div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between min-w-[200px] shadow-sm">
                    <div><p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Hrs semanales</p><p className="text-3xl font-bold text-gray-800">{horarioReal.reduce((sum, clase) => sum + (clase.duracion || 0), 0)}</p></div>
                    <div className="bg-green-100 p-3 rounded-lg text-green-600"><Clock className="w-6 h-6" /></div>
                  </div>
                </div>
                <button onClick={handleDownloadPDF} className="flex items-center px-5 py-2.5 bg-blue-600 text-white rounded-md text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm w-full md:w-auto justify-center"><Download className="w-4 h-4 mr-2" /> Descargar PDF</button>
              </div>

              <div id="horario-imprimible" className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-6">
                <div className="mb-6 border-b pb-4"><h2 className="text-2xl font-bold text-[#1A237E]">Horario de Clases - {alumnoInfo.nombre}</h2><p className="text-gray-500 text-sm">Periodo 2026-1 | {alumnoInfo.carrera}</p></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse min-w-[1000px] table-fixed">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-bold text-center">
                      <tr><th className="py-3 px-4 w-28 border border-gray-200 bg-gray-100">Hora</th>{DIAS_SEMANA.map(dia => (<th key={dia} className="py-3 px-4 border border-gray-200 w-1/6">{dia}</th>))}</tr>
                    </thead>
                    <tbody>
                      {HORAS_CLASE.map((hora, idx) => {
                        const rowHour = parseInt(hora.split(':')[0]);
                        return (
                          <tr key={idx} className="border-b border-gray-200">
                            <td className="py-4 px-2 font-medium text-gray-500 text-center border-r border-gray-200 bg-gray-50">
                              {hora}
                            </td>
                            {DIAS_SEMANA.map(dia => {
                              const claseInicia = horarioReal.find(c => c.dia === dia && c.hora_inicio === rowHour);
                              const claseContinua = horarioReal.find(c => c.dia === dia && c.hora_inicio < rowHour && (c.hora_inicio + c.duracion) > rowHour);
                              if (claseContinua) return null;
                              if (claseInicia) {
                                return (
                                  <td key={`${dia}-${hora}`} rowSpan={claseInicia.duracion} className="p-2 border-r border-gray-200 align-top">
                                    <div className="text-white rounded-md p-3 flex flex-col shadow-sm transition-transform hover:scale-[1.02]" style={{ backgroundColor: claseInicia.color, height: '100%', minHeight: `${claseInicia.duracion * 4.5}rem` }}>
                                      <span className="font-bold text-xs leading-tight uppercase mb-1">{claseInicia.materia}</span>
                                      <div className="mt-auto border-t border-white/20 pt-2">
                                        <span className="block text-[10px] opacity-90 truncate">{claseInicia.profe}</span>
                                        <span className="block text-[10px] font-mono mt-1 bg-black/10 inline-block px-1.5 py-0.5 rounded">
                                          {claseInicia.aula || 'S/A'}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                );
                              }
                              return <td key={`${dia}-${hora}`} className="p-2 border-r border-gray-200 align-top"></td>;
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-8 pt-6 border-t border-gray-100">
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 tracking-widest">Leyenda de Materias</h4>
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    {Array.from(new Set(horarioReal.map(c => c.materia))).map(mat => {
                      const colorMat = horarioReal.find(c => c.materia === mat)?.color;
                      return (<div key={mat} className="flex items-center text-xs text-gray-700 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100"><div className="w-3 h-3 rounded-full mr-2 shadow-sm" style={{ backgroundColor: colorMat }}></div><span className="font-medium">{mat}</span></div>);
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default GruposYHorarios;