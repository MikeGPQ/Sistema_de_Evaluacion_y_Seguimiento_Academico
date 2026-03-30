import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, BookOpen, Clock, AlertTriangle, 
  CheckCircle, Save, Calendar, User, Layers, AlertCircle
} from 'lucide-react';
import client from '../../lib/axios';
import Swal from 'sweetalert2';
import { useAuth } from '../../hooks/AuthContext';

const timeToMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(':');
  return parseInt(h) * 60 + parseInt(m);
};

const MiCargaAcademica = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  
  const [alumnoInfo, setAlumnoInfo] = useState(null);
  const [materiasRegulares, setMateriasRegulares] = useState([]);
  const [materiasRecursamiento, setMateriasRecursamiento] = useState([]);
  // declaracion del estado para almacenar localmente las materias atrasadas no cursadas
  const [materiasPendientes, setMateriasPendientes] = useState([]);
  
  const [seleccion, setSeleccion] = useState({});
  const [seleccionOriginal, setSeleccionOriginal] = useState({}); 
  const [inscripcionesOriginales, setInscripcionesOriginales] = useState([]);

  const seleccionValues = Object.values(seleccion).map(s => s.group_id).sort().join(',');
  const originalValues = [...inscripcionesOriginales].sort().join(',');
  const hayCambios = seleccionValues !== originalValues;

  useEffect(() => {
    const handleBeforeUnload = (evento) => {
      if (hayCambios) {
        evento.preventDefault();
        evento.returnValue = ''; 
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hayCambios]);

  const ejecutarConProteccion = async (accionConfirmada) => {
    if (hayCambios) {
      const confirmacion = await Swal.fire({
        title: '¿Salir sin guardar?',
        text: 'Tienes materias seleccionadas sin confirmar. Si continuas, los cambios en progreso serán descartados.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#1A237E',
        confirmButtonText: 'Sí, descartar cambios',
        cancelButtonText: 'Cancelar'
      });

      if (confirmacion.isConfirmed) {
        setSeleccion(seleccionOriginal);
        accionConfirmada();
      }
    } else {
      accionConfirmada();
    }
  };

  const cargarDatosDelAlumno = useCallback(async (matriculaActiva, recargaSilenciosa = false) => {
    if (!recargaSilenciosa) setCargando(true);
    try {
      const response = await client.get(`/asignacion/autoservicio/${matriculaActiva}/disponibles`);
      const data = response.data;

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
      // volcado de las materias pendientes detectadas por el backend hacia el estado de React
      setMateriasPendientes(data.materias_pendientes || []);

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
      // ejecucion de la busqueda de inscripciones previas tambien sobre la lista de atrasadas
      escanearCatalogo(data.materias_pendientes || [], false);

      setSeleccion(seleccionInicial);
      setSeleccionOriginal(seleccionInicial);
      setInscripcionesOriginales(gruposQueYaTenia);

    } catch (error) {
      if (!Swal.isVisible() && !recargaSilenciosa) {
        Swal.fire({ 
          icon: 'error', 
          title: 'Acceso Restringido', 
          text: error.response?.data?.detail || 'No cuenta con los privilegios para acceder a este módulo.',
          confirmButtonColor: '#1A237E',
          allowOutsideClick: false
        }).then(() => {
          navigate('/alumno/horario'); 
        });
      }
    } finally {
      if (!recargaSilenciosa) setCargando(false);
    }
  }, [navigate]);

  useEffect(() => {
    const matriculaActiva = user?.identifier || user?.matricula || '20240001';
    cargarDatosDelAlumno(matriculaActiva);
  }, [user, cargarDatosDelAlumno]);

  const verificarChoquesFront = (grupoEvaluar, seleccionActual) => {
    const sesionesEvaluar = grupoEvaluar.horario_raw || [];
    const seleccionIds = Object.values(seleccionActual).map(s => s.group_id);

    // integracion de la nueva lista a la iteracion de comprobacion para evitar cruces
    for (const mat of [...materiasRegulares, ...materiasRecursamiento, ...materiasPendientes]) {
      for (const g of mat.grupos_disponibles) {
        if (seleccionIds.includes(g.group_id)) {
           const sesionesSel = g.horario_raw || [];
           for (const s1 of sesionesEvaluar) {
             for (const s2 of sesionesSel) {
               if (s1.dia.toLowerCase() === s2.dia.toLowerCase()) {
                 const ini1 = timeToMinutes(s1.inicio); const fin1 = timeToMinutes(s1.fin);
                 const ini2 = timeToMinutes(s2.inicio); const fin2 = timeToMinutes(s2.fin);
                 if (!(fin1 <= ini2 || ini1 >= fin2)) {
                   return { hayChoque: true, materiaChoque: mat.nombre, dia: s1.dia };
                 }
               }
             }
           }
        }
      }
    }
    return { hayChoque: false };
  };

  const handleSeleccionGrupo = async (subjectId, groupId, isRetake) => {
    if (seleccion[subjectId]?.group_id === groupId) {
      if (inscripcionesOriginales.includes(groupId)) {
        const confirmacion = await Swal.fire({
          title: '¿Confirmar desvinculación?',
          text: 'Esta acción eliminará su registro en esta asignatura de manera inmediata. ¿Desea proceder?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          cancelButtonColor: '#1A237E',
          confirmButtonText: 'Confirmar baja',
          cancelButtonText: 'Cancelar'
        });

        if (!confirmacion.isConfirmed) return;

        const nuevaSeleccion = { ...seleccion };
        delete nuevaSeleccion[subjectId];
        const materiasPayload = Object.entries(nuevaSeleccion).map(([sid, data]) => ({
          subject_id: parseInt(sid),
          group_id: data.group_id,
          is_retake: data.is_retake
        }));
        
        try {
          await client.post(`/asignacion/${alumnoInfo.matricula}/guardar`, { 
              materias: materiasPayload,
              usuario_id: user?.identifier || user?.email || "Autoservicio Alumno"
          });
          
          await Swal.fire({ 
            icon: 'success', 
            title: 'Baja registrada', 
            toast: true, 
            position: 'top-end', 
            showConfirmButton: false, 
            timer: 2000 
          });
          
          await cargarDatosDelAlumno(alumnoInfo.matricula, true);
          
        } catch (error) {
          Swal.fire({ icon: 'error', title: 'Fallo de operación', text: error.response?.data?.detail || 'Imposible completar la transacción.', confirmButtonColor: '#1A237E' });
        }
        return;
      }

      setSeleccion(prev => {
        const nueva = { ...prev };
        delete nueva[subjectId];
        return nueva;
      });

    } else {
      let grupoNuevo = null;
      // recorrido expandido que ahora evalua al hacer click los elementos del catalogo pendiente
      [...materiasRegulares, ...materiasRecursamiento, ...materiasPendientes].forEach(mat => {
        if (mat.subject_id === subjectId) {
          const g = mat.grupos_disponibles.find(x => x.group_id === groupId);
          if (g) grupoNuevo = g;
        }
      });

      if (grupoNuevo) {
        const choque = verificarChoquesFront(grupoNuevo, seleccion);
        if (choque.hayChoque) {
          Swal.fire({
            icon: 'error', title: 'Conflicto de Horarios',
            text: `Incompatibilidad detectada el día ${choque.dia} con la asignatura: '${choque.materiaChoque}'.`,
            confirmButtonColor: '#1A237E'
          });
          return; 
        }
      }

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
      Swal.fire({ icon: 'warning', title: 'Advertencia', text: 'El conjunto de selección se encuentra vacío.' });
      return;
    }

    setGuardando(true);
    try {
      const response = await client.post(`/asignacion/${alumnoInfo.matricula}/guardar`, {
        materias: materiasPayload,
        usuario_id: user?.identifier || user?.email || "Autoservicio Alumno"
      });
      
      await Swal.fire({
        icon: 'success',
        title: 'Transacción Confirmada',
        text: response.data.message,
        confirmButtonColor: '#1A237E'
      });

      await cargarDatosDelAlumno(alumnoInfo.matricula, true);

    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error de Servidor',
        text: error.response?.data?.detail || 'No se pudo sincronizar la transacción de carga académica.',
        confirmButtonColor: '#1A237E'
      });
    } finally {
      setGuardando(false);
    }
  };

  // adicion de la propiedad isPending para inyectar una clase de color naranja al renderizar 
  const TarjetaMateria = ({ materia, isRetake, isPending }) => {
    let colorEtiqueta = 'bg-blue-100 text-blue-800 border-blue-200'; 
    
    if (isRetake) {
      colorEtiqueta = 'bg-red-100 text-red-800 border-red-200'; 
    } else if (isPending) {
      colorEtiqueta = 'bg-orange-100 text-orange-800 border-orange-200';
    } else if (materia.tipo === 'Tronco Común') {
      colorEtiqueta = 'bg-amber-100 text-amber-800 border-amber-300'; 
    }

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-4 hover:border-blue-300 transition-colors">
        <div className="flex justify-between items-start mb-3 border-b pb-2">
          <div>
            <h4 className="font-bold text-gray-800 text-sm">{materia.nombre}</h4>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1 inline-block border ${colorEtiqueta}`}>
              {materia.tipo}
            </span>
          </div>
          <span className="text-xs text-gray-500 font-mono">{materia.subject_id}</span>
        </div>

        <div className="space-y-2">
          {/* validacion condicional: si no hay grupos abiertos, mostramos un mensaje de advertencia con tooltip para informar al usuario de la indisponibilidad y el paso a seguir */}
          {materia.grupos_disponibles.length === 0 ? (
            <div 
              className="p-3 bg-gray-50 border border-dashed border-gray-300 rounded-md text-center cursor-help transition-all hover:bg-gray-100"
              title="Por el momento no hay grupos abiertos para esta materia. Dirígete con la coordinadora académica."
            >
              <p className="text-xs text-gray-500 font-medium flex items-center justify-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-gray-400" />
                Sin grupos disponibles en este periodo
              </p>
            </div>
          ) : (
            // si hay grupos disponibles, renderiza la lista normal con los radio buttons
            materia.grupos_disponibles.map((grupo) => {
              const isLleno = grupo.cupo_disponible === 0;
              const isSelected = seleccion[materia.subject_id]?.group_id === grupo.group_id;

              return (
                <div 
                  key={grupo.group_id} 
                  onClick={() => {
                    if (!isLleno) {
                      handleSeleccionGrupo(materia.subject_id, grupo.group_id, isRetake);
                    }
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-md border cursor-pointer transition-all ${isLleno ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed' : isSelected ? 'bg-blue-50 border-[#1A237E] ring-1 ring-[#1A237E]' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <input 
                      type="radio" 
                      checked={isSelected}
                      readOnly
                      className="w-4 h-4 text-[#1A237E] focus:ring-[#1A237E] pointer-events-none"
                    />
                    <div>
                      <p className="text-sm font-bold text-gray-800">Grupo {grupo.external_id ?? grupo.nombre}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" /> {grupo.horario}
                      </p>
                      {grupo.aula && (
                        <p className="text-xs text-gray-400 mt-0.5">Aula: {grupo.aula}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold ${isLleno ? 'text-red-500' : 'text-green-600'}`}>
                      {isLleno ? 'Cupo Lleno' : `${grupo.cupo_disponible} lugares`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1A237E]"></div>
      </div>
    );
  }

  if (!alumnoInfo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FA] text-gray-500 font-bold gap-4">
        <p>Procesando autorización de acceso al módulo...</p>
        <div className="animate-pulse flex space-x-4">
          <div className="h-2 w-24 bg-blue-300 rounded"></div>
          <div className="h-2 w-24 bg-blue-300 rounded"></div>
        </div>
      </div>
    );
  }

  const materiasTronco = materiasRegulares.filter(m => m.tipo === 'Tronco Común');
  const materiasCarrera = materiasRegulares.filter(m => m.tipo !== 'Tronco Común');

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] font-sans">
      <header className="bg-white border-b border-gray-200 h-16 flex items-center px-8 shadow-sm">
        <h2 className="text-[#1A237E] font-bold text-lg">Portal del Alumno SESA</h2>
      </header>

      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
            <div>
              <button 
                onClick={() => ejecutarConProteccion(() => navigate('/alumno/horario'))}
                className="flex items-center text-sm text-gray-600 hover:text-[#1A237E] font-medium mb-4 transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5 group-hover:-translate-x-1 transition-transform" />
                Volver a Mi Horario
              </button>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Mi Carga Académica</h1>
              <p className="text-gray-500 text-sm">Autoservicio de selección de materias para el periodo en curso.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
            
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-[#1A237E] p-3 rounded-full text-white">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-blue-900">{alumnoInfo.nombre}</h3>
                    <p className="text-xs text-blue-700 font-medium">
                      Matrícula: {alumnoInfo.matricula} | {alumnoInfo.carrera} | Cuatrimestre: {alumnoInfo.cuatrimestre}
                    </p>
                  </div>
                </div>
              </div>

              {materiasRecursamiento.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-red-700 flex items-center gap-2 mb-3 border-b border-red-200 pb-2">
                    <AlertTriangle className="w-4 h-4" /> Materias Pendientes (Recursamiento)
                  </h3>
                  {materiasRecursamiento.map(mat => (
                    <TarjetaMateria key={mat.subject_id} materia={mat} isRetake={true} />
                  ))}
                </div>
              )}

              {/* pintado del nuevo bloque visual para desplegar la coleccion de materias que nunca inscribio */}
              {materiasPendientes.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-orange-700 flex items-center gap-2 mb-3 border-b border-orange-200 pb-2">
                    <Clock className="w-4 h-4" /> Materias Pendientes (No Cursadas)
                  </h3>
                  {materiasPendientes.map(mat => (
                    <TarjetaMateria key={mat.subject_id} materia={mat} isRetake={false} isPending={true} />
                  ))}
                </div>
              )}

              {materiasTronco.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3 border-b border-gray-200 pb-2">
                    <Layers className="w-4 h-4 text-amber-600" /> Materias de Tronco Común
                  </h3>
                  {materiasTronco.map(mat => (
                    <TarjetaMateria key={mat.subject_id} materia={mat} isRetake={false} />
                  ))}
                </div>
              )}

              {materiasCarrera.length > 0 && (
                <div className={materiasTronco.length > 0 ? "mt-8" : ""}>
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3 border-b border-gray-200 pb-2">
                    <BookOpen className="w-4 h-4 text-blue-600" /> Materias de Especialidad (Carrera)
                  </h3>
                  {materiasCarrera.map(mat => (
                    <TarjetaMateria key={mat.subject_id} materia={mat} isRetake={false} />
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-4">
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm sticky top-6">
                <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#1A237E]" />
                    Resumen de Inscripción
                  </h3>
                </div>
                
                <div className="p-4">
                  <div className="flex justify-between items-center mb-4 text-sm">
                    <span className="text-gray-500">Materias seleccionadas:</span>
                    <span className="font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded">
                      {Object.keys(seleccion).length}
                    </span>
                  </div>

                  {Object.keys(seleccion).length === 0 ? (
                    <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-xs">No hay materias en la selección actual.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 mb-6 max-h-60 overflow-auto pr-1">
                      {Object.entries(seleccion).map(([subId, data]) => (
                        <div key={subId} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded border border-gray-100">
                          <span className="font-bold text-gray-700 truncate w-32">{subId}</span>
                          <span className="bg-[#1A237E] text-white px-2 py-0.5 rounded font-mono">ID Grupo: {data.group_id}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button 
                    onClick={handleGuardarCarga}
                    disabled={guardando || Object.keys(seleccion).length === 0 || !hayCambios}
                    className="w-full bg-[#1A237E] text-white py-3 rounded-md text-sm font-bold hover:bg-[#283593] flex justify-center items-center gap-2 disabled:opacity-50 disabled:bg-gray-400 shadow-sm transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {guardando ? 'Procesando...' : (!hayCambios ? 'Carga Sincronizada' : 'Confirmar Selección')}
                  </button>
                  <p className="text-[10px] text-center text-gray-400 mt-3">
                    La validación de la transacción asegura la viabilidad del horario.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default MiCargaAcademica;