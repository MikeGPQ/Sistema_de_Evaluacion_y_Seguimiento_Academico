import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, ArrowLeft, BookOpen, Clock, AlertTriangle, 
  CheckCircle, Save, Calendar, User
} from 'lucide-react';
import client from '../../lib/axios';
import Swal from 'sweetalert2';

const GruposYHorarios = () => {
  const navigate = useNavigate();
  const [matriculaBuscada, setMatriculaBuscada] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  
  // Estado de los datos Mockeados
  const [alumnoInfo, setAlumnoInfo] = useState(null);
  const [materiasRegulares, setMateriasRegulares] = useState([]);
  const [materiasRecursamiento, setMateriasRecursamiento] = useState([]);
  
  // Estado de la selección del usuario
  const [seleccion, setSeleccion] = useState({});
  const [inscripcionesOriginales, setInscripcionesOriginales] = useState([]);

  const buscarAlumno = async () => {
    if (!matriculaBuscada) return;
    setCargando(true);
    setAlumnoInfo(null);
    setSeleccion({});
    setInscripcionesOriginales([]); // reseteamos la inscripciones originales para evitar conflictos por si llegamos a buscar a otro alumno

    try {
      const response = await client.get(`/asignacion/${matriculaBuscada}/disponibles`);
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

      // ---AUTO-SELECCIÓN DE MATERIAS YA INSCRITAS ---
      const seleccionInicial = {};
      const gruposQueYaTenia = data.grupos_inscritos || [];

      // Función rápida para escanear el catálogo y armar la selección
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

      // Guardamos la selección inicial y la lista original para protegerla
      setSeleccion(seleccionInicial);
      setInscripcionesOriginales(gruposQueYaTenia);

    } catch (error) {
      Swal.fire({ icon: 'error', title: 'No encontrado', text: 'No se encontraron materias disponibles para esta matrícula.' });
    } finally {
      setCargando(false);
    }
  };

  const handleSeleccionGrupo = async (subjectId, groupId, isRetake) => {
    // Verificar si el administrador está intentando DESELECCIONAR el grupo
    if (seleccion[subjectId]?.group_id === groupId) {
      
      // Si ese grupo venía de la base de datos, lanzamos la advertencia
      if (inscripcionesOriginales.includes(groupId)) {
        const confirmacion = await Swal.fire({
          title: '¿Dar de baja materia?',
          text: 'El alumno ya está inscrito en esta materia oficialmente. ¿Estás seguro de que deseas quitarla de su carga académica?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          cancelButtonColor: '#1A237E',
          confirmButtonText: 'Sí, dar de baja',
          cancelButtonText: 'Cancelar'
        });

        // Si el administrador da clic en "Cancelar", detenemos todo y no lo borramos
        if (!confirmacion.isConfirmed) return;
      }

      // 3. Si aceptó (o si era una materia nueva que apenas iba a meter), la quitamos
      setSeleccion(prev => {
        const nueva = { ...prev };
        delete nueva[subjectId];
        return nueva;
      });

    } else {
      // Si está agregando una materia nueva (o cambiando de grupo)
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
      Swal.fire({ icon: 'warning', title: 'Atención', text: 'Debes seleccionar al menos una materia.' });
      return;
    }

    setGuardando(true);
    try {
      const response = await client.post(`/asignacion/${alumnoInfo.matricula}/guardar`, {
        materias: materiasPayload
      });
      
      Swal.fire({
        icon: 'success',
        title: 'Carga Guardada',
        text: response.data.message,
        confirmButtonColor: '#1A237E'
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error de Validación',
        text: error.response?.data?.detail || 'Ocurrió un error al guardar la carga académica.',
        confirmButtonColor: '#1A237E'
      });
    } finally {
      setGuardando(false);
    }
  };

  // Componente interno para renderizar las tarjetas de materias
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
              onClick={() => {
                if (!isLleno) {
                  handleSeleccionGrupo(materia.subject_id, grupo.group_id, isRetake);
                }
              }}
              className={`flex items-center justify-between p-2.5 rounded-md border cursor-pointer transition-all ${isLleno ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed' : isSelected ? 'bg-blue-50 border-[#1A237E] ring-1 ring-[#1A237E]' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-3">
                {/* Hacemos el input "readOnly" y bloqueamos sus eventos para que el div controle los clics */}
                <input 
                  type="radio" 
                  checked={isSelected}
                  readOnly
                  className="w-4 h-4 text-[#1A237E] focus:ring-[#1A237E] pointer-events-none"
                />
                <div>
                  <p className="text-sm font-bold text-gray-800">Grupo {grupo.nombre}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> {grupo.horario}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-xs font-bold ${isLleno ? 'text-red-500' : 'text-green-600'}`}>
                  {isLleno ? 'Cupo Lleno' : `${grupo.cupo_disponible} lugares`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] font-sans">
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8 shrink-0 shadow-sm">
        <div className="flex items-center text-sm text-gray-500">
           Inicio &gt; 
           <button onClick={() => navigate('/alumnos/listado')} className="mx-1 hover:text-[#1A237E] hover:underline transition-colors focus:outline-none">
             Alumnos
           </button> 
           &gt; <span className="text-[#1A237E] ml-1 font-bold">Asignación de Horarios</span>
        </div>
      </header>

      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <button 
            onClick={() => navigate('/alumnos/listado')}
            className="flex items-center text-sm text-gray-600 hover:text-[#1A237E] font-medium mb-4 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5 group-hover:-translate-x-1 transition-transform" />
            Volver al listado
          </button>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Asignación de Horarios y Grupos</h1>
            <p className="text-gray-500 text-sm">Gestiona la carga académica, recursamientos y validación de cupos.</p>
          </div>

          {/* BUSCADOR */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row items-end gap-4">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Buscar Alumno por Matrícula</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="text" 
                  value={matriculaBuscada}
                  maxLength={8} /* bloque cuando excedes 8 caracteres */
                  onChange={(e) => setMatriculaBuscada(e.target.value.replace(/\D/g, ''))} /* El borra autamaticamente letras, simbolos y espacios */
                  placeholder="Ej. 20240001" 
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#1A237E] font-mono"
                />
              </div>
            </div>
            <button 
              onClick={buscarAlumno}
              disabled={cargando || matriculaBuscada.length !== 8} /* este boton se habilita cuando solo son 8 digitos */
              className="bg-[#1A237E] text-white px-6 py-2.5 rounded-md text-sm font-bold hover:bg-[#283593] disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
            >
              {cargando ? 'Buscando...' : 'Cargar Catálogo'}
            </button>
          </div>

          {/* ÁREA DE TRABAJO */}
          {alumnoInfo && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
              
              {/* COLUMNA IZQUIERDA: MATERIAS DISPONIBLES */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* INFO DEL ALUMNO */}
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
                  {alumnoInfo.bloqueado && (
                    <div className="bg-white px-3 py-1.5 rounded border border-blue-100 text-xs font-bold text-blue-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      Grupo Base Bloqueado ({alumnoInfo.grupoBase})
                    </div>
                  )}
                </div>

                {/* MATERIAS DE RECURSAMIENTO (Prioridad) */}
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

                {/* MATERIAS REGULARES */}
                <div>
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3 border-b border-gray-200 pb-2">
                    <BookOpen className="w-4 h-4 text-blue-600" /> Carga Regular (Periodo Actual)
                  </h3>
                  {materiasRegulares.map(mat => (
                    <TarjetaMateria key={mat.subject_id} materia={mat} isRetake={false} />
                  ))}
                </div>

              </div>

              {/* COLUMNA DERECHA: RESUMEN Y GUARDADO */}
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
                        <p className="text-xs">No hay materias seleccionadas</p>
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
                      disabled={guardando || Object.keys(seleccion).length === 0}
                      className="w-full bg-[#1A237E] text-white py-3 rounded-md text-sm font-bold hover:bg-[#283593] flex justify-center items-center gap-2 disabled:opacity-50 disabled:bg-gray-400 shadow-sm transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      {guardando ? 'Validando y Guardando...' : 'Confirmar Inscripción'}
                    </button>
                    <p className="text-[10px] text-center text-gray-400 mt-3">
                      Al confirmar, el sistema validará cupos y cruces de horario.
                    </p>
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