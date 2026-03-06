import React, { useState, useEffect } from 'react';
import { 
  Edit2, 
  UserX, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  Search,
  Upload,
  Plus,
  X,
  Filter,
  User, 
  CheckCircle, 
  XCircle, 
  FileText,
  AlertTriangle, 
  GraduationCap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../../lib/axios';
import { useAuth } from '../../hooks/AuthContext';
import ManualRegister from '../../components/form/ManualRegister';
import Swal from 'sweetalert2';

const ListadoAlumnos = () => {
  const navigate = useNavigate();
  const { user } = useAuth(); 

  // --- ESTADOS DE DATOS Y PAGINACIÓN ---
  const [alumnos, setAlumnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  
  // --- ESTADOS DE MAURICIO (MODAL DE EDICIÓN/ALTA) ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [alumnoAEditar, setAlumnoAEditar] = useState(null);

  // --- ESTADOS DE ALEJANDRO (MODAL DE ESTATUS) ---
  const [modalEstatusOpen, setModalEstatusOpen] = useState(false);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  const [nuevoEstatus, setNuevoEstatus] = useState('');
  const [archivoBaja, setArchivoBaja] = useState(null);
  const [guardandoEstatus, setGuardandoEstatus] = useState(false);
  const [estatusCatalogo, setEstatusCatalogo] = useState([]);
  const [logEvidencia, setLogEvidencia] = useState(null);

  const STATUS_UI = {
    'activo':       { label: 'Activo',        desc: 'Inscripción vigente',   color: 'text-green-600',  activeBg: 'bg-green-50 border-green-500',   Icon: CheckCircle },
    'egresado':     { label: 'Egresado',       desc: 'Conclusión de créditos', color: 'text-blue-900',   activeBg: 'bg-blue-50 border-blue-900',     Icon: GraduationCap },
    'baja_temporal':{ label: 'Baja Temporal',  desc: 'Suspensión temporal',   color: 'text-orange-500', activeBg: 'bg-orange-50 border-orange-500',  Icon: AlertTriangle },
    'baja':         { label: 'Baja',           desc: 'Baja definitiva',       color: 'text-red-600',    activeBg: 'bg-red-50 border-red-500',        Icon: XCircle },
  };

  const limite = 10;

  // --- ESTADOS DE FILTROS DE JORGE (HU-25a) ---
  const [busquedaAlumno, setBusquedaAlumno] = useState('');
  const [filtroCarrera, setFiltroCarrera] = useState('');
  const [filtroCuatrimestre, setFiltroCuatrimestre] = useState('');

  // --- CATÁLOGO DE ESTATUS DESDE API ---
  useEffect(() => {
    client.get('/catalogos/estatus').then(res => setEstatusCatalogo(res.data)).catch(() => {});
  }, []);

  // --- FUNCIÓN PARA OBTENER ALUMNOS ---
  const fetchAlumnos = async () => {
    try {
      setCargando(true);
      const skip = (pagina - 1) * limite;
      
      const params = new URLSearchParams({ skip, limit: limite });
      const terminoBusqueda = busquedaAlumno.trim().replace(/\s+/g, ' ');

      if (terminoBusqueda) params.append('busqueda', terminoBusqueda);
      if (filtroCarrera) params.append('carrera_id', filtroCarrera);
      if (filtroCuatrimestre) params.append('cuatrimestre', filtroCuatrimestre);

      const response = await client.get(`/alumnos/listado?${params.toString()}`);
      setAlumnos(response.data.data);
      setTotal(response.data.total);
    } catch (error) {
      console.error("Error al cargar alumnos:", error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    const retardoBusqueda = setTimeout(() => {
      fetchAlumnos();
    }, 400); 
    return () => clearTimeout(retardoBusqueda);
  }, [pagina, busquedaAlumno, filtroCarrera, filtroCuatrimestre]);

  // --- MANEJADORES DE FILTROS (JORGE) ---
  const handleCambioFiltro = (setter, valor) => {
    setter(valor);
    setPagina(1); 
  };

  const limpiarFiltros = () => {
    setBusquedaAlumno('');
    setFiltroCarrera('');
    setFiltroCuatrimestre('');
    setPagina(1);
  };

  const hayFiltrosActivos = busquedaAlumno || filtroCarrera || filtroCuatrimestre;

  const getStatusColor = (status) => {
    const s = status?.toLowerCase() || '';
    if (s === 'activo') return 'bg-green-100 text-green-700 border-green-200';
    if (s === 'baja') return 'bg-red-100 text-red-700 border-red-200';
    if (s.includes('temporal')) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (s === 'egresado') return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  // --- MANEJADORES DE MAURICIO (MODAL EDICIÓN/ALTA) ---
  const handleEditarAlumno = (alumno) => {
    console.log("Datos del alumno al editar:", alumno);
    setAlumnoAEditar(alumno);
    setIsModalOpen(true);
  };

  const handleAgregarAlumno = () => {
    setAlumnoAEditar(null);
    setIsModalOpen(true);
  };

  const handleCerrarModal = () => {
    setIsModalOpen(false);
    setAlumnoAEditar(null);
    fetchAlumnos(); 
  };

  // --- MANEJADORES DE ALEJANDRO (MODAL ESTATUS) ---
  const abrirModalEstatus = async (alumno) => {
    setAlumnoSeleccionado(alumno);
    setNuevoEstatus(alumno.estatus);
    setArchivoBaja(null);
    setLogEvidencia(null);
    setModalEstatusOpen(true);

    if (alumno.estatus === 'baja' || alumno.estatus === 'baja_temporal') {
      try {
        const res = await client.get(`/alumnos/${alumno.matricula}/ultimo-log-estatus`);
        setLogEvidencia(res.data);
      } catch {
        // no hay log previo, ignoramos
      }
    }
  };

  const esBaja = nuevoEstatus === 'baja' || nuevoEstatus === 'baja_temporal';
  const requiereArchivo = esBaja && !logEvidencia?.evidence_file_id;

  const handleConfirmarCambioEstatus = async () => {
    try {
      setGuardandoEstatus(true);
      const usuarioActual = user?.identifier || user?.email || "Admin Local";
      const statusSeleccionado = estatusCatalogo.find(s => s.name === nuevoEstatus);

      const formData = new FormData();
      formData.append('status_id', statusSeleccionado.id);
      formData.append('usuario_id', usuarioActual);
      if (archivoBaja) formData.append('evidence_file', archivoBaja);

      await client.put(`/alumnos/${alumnoSeleccionado.matricula}/estatus`, formData);

      Swal.fire({
        icon: 'success',
        title: 'Estatus Actualizado',
        text: `El alumno ahora está marcado como ${nuevoEstatus}.`,
        timer: 2000,
        showConfirmButton: false
      });

      setModalEstatusOpen(false);
      fetchAlumnos();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error?.response?.data?.detail || 'No se pudo cambiar el estatus del alumno.'
      });
    } finally {
      setGuardandoEstatus(false);
    }
  };

  const renderAlertaDinamica = () => {
    if (nuevoEstatus === 'baja' || nuevoEstatus === 'baja_temporal') {
      return (
        <div className="flex gap-3 p-4 bg-red-50 rounded-lg mb-5 border border-red-100 animate-in fade-in duration-300">
          <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
          <p className="text-xs text-red-800 font-medium">
            <span className="font-bold uppercase block mb-1">Advertencia Académica</span>
            Se registrará que <b>TÚ</b> diste de baja a este alumno. Se liberarán cupos y será eliminado de las listas vigentes.
          </p>
        </div>
      );
    }
    if (nuevoEstatus === 'egresado') {
      return (
        <div className="flex gap-3 p-4 bg-blue-50 rounded-lg mb-5 border border-blue-200 animate-in fade-in duration-300">
          <GraduationCap className="w-8 h-8 text-blue-900 flex-shrink-0" />
          <p className="text-xs text-blue-900 font-medium">
            <span className="font-bold uppercase block mb-1">Transferencia a Egresado</span>
            Se revocarán los accesos a materias activas y se iniciará su proceso de titulación.
          </p>
        </div>
      );
    }
    return null;
  };

  const inicio = (pagina - 1) * limite + 1;
  const fin = Math.min(pagina * limite, total);
  const totalPaginas = Math.ceil(total / limite);

  return (
    <div className="p-8 bg-gray-50 min-h-screen relative">
      
      {/* --- HEADER --- */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#1a2b4b]">Listado General de Alumnos</h1>
          <p className="text-gray-500 text-sm">Gestión y visualización de matrícula escolar</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/alumnos/importar')} className="flex items-center gap-2 bg-white border border-[#1A237E] text-[#1A237E] px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors shadow-sm">
            <Upload className="w-4 h-4" /> Importación
          </button>
          <button onClick={handleAgregarAlumno} className="flex items-center gap-2 bg-[#1A237E] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#283593] transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Agregar Alumno
          </button>
        </div>
      </div>

      {/* --- TABLA CON FILTROS --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        
        {/* --- FILTROS DE JORGE --- */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[250px]">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Búsqueda de Alumno</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Nombre, apellidos o matrícula..." 
                value={busquedaAlumno}
                onChange={(e) => {
                  const valorLimpio = e.target.value.replace(/[^a-zA-Z0-9 áéíóúÁÉÍÓÚñÑüÜ]/g, '');
                  handleCambioFiltro(setBusquedaAlumno, valorLimpio);
                }}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="w-64">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Carrera</label>
            <div className="relative">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select 
                value={filtroCarrera}
                onChange={(e) => handleCambioFiltro(setFiltroCarrera, e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 appearance-none bg-white cursor-pointer"
              >
                <option value="">Todas las carreras</option>
                <option value="1">Licenciatura en Contabilidad y Finanzas (LCF)</option>
                <option value="2">Licenciatura en Derecho y Ciencias Jurídicas (LDCJ)</option>
                <option value="3">Licenciatura en Diseño Gráfico Digital (LDGD)</option>
                <option value="4">Licenciatura en Educación Física, Recreación y Deporte (LEFRD)</option>
                <option value="5">Licenciatura en Mercadotecnia Estratégica (LME)</option>
                <option value="6">Licenciatura en Administración de Empresas (LAE)</option>
                <option value="7">Licenciatura en Contabilidad Financiera (LCFIN)</option>
                <option value="8">Licenciatura en Educación y Tecnologías para el Aprendizaje (LETA)</option>
                <option value="9">Licenciatura en Ingenieria de Software y Sistemas Computacionales (LISSC)</option>
              </select>
            </div>
          </div>

          <div className="w-40">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Cuatrimestre</label>
            <select 
              value={filtroCuatrimestre}
              onChange={(e) => handleCambioFiltro(setFiltroCuatrimestre, e.target.value)}
              className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white cursor-pointer"
            >
              <option value="">Todos</option>
              {[1,2,3,4,5,6,7,8,9].map(num => (
                <option key={num} value={num}>{num}º Cuatrimestre</option>
              ))}
            </select>
          </div>

          {hayFiltrosActivos && (
            <button 
              onClick={limpiarFiltros}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 border border-transparent hover:border-red-200"
            >
              <X className="w-4 h-4" /> Limpiar
            </button>
          )}
        </div>

        {/* --- TABLA --- */}
        <div className="overflow-x-auto min-h-[400px]">
          {cargando ? (
            <div className="flex flex-col items-center justify-center h-full py-20">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
              <p className="text-gray-500 font-medium">Cargando registros...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-200 text-xs uppercase text-gray-500 font-bold tracking-wider">
                  <th className="p-4 pl-6">Matrícula</th>
                  <th className="p-4">Nombre Completo</th>
                  <th className="p-4">Carrera</th>
                  <th className="p-4 text-center">Estatus</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alumnos.length > 0 ? (
                  alumnos.map((alumno, index) => (
                    <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-4 pl-6 font-mono text-sm text-gray-600 font-bold">
                        {alumno.matricula}
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-semibold text-[#1a2b4b]">
                          {alumno.nombre_completo}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-600 font-medium">
                        {alumno.carrera}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${getStatusColor(alumno.estatus)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${alumno.estatus?.toLowerCase() === 'activo' ? 'bg-green-500' : alumno.estatus?.toLowerCase() === 'baja' ? 'bg-red-500' : 'bg-gray-500'}`}></span>
                          {alumno.estatus}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => handleEditarAlumno(alumno)} 
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" 
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => abrirModalEstatus(alumno)} 
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" 
                            title="Cambiar Estatus"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-16 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <Search className="w-12 h-12 text-gray-300 mb-3" />
                        <p className="font-semibold text-gray-700">No se encontraron alumnos</p>
                        <p className="text-sm mt-1">Intenta ajustando los filtros de búsqueda.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* --- PAGINACIÓN --- */}
        {!cargando && total > 0 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-white">
            <p className="text-xs text-gray-500 font-medium">
              Mostrando <span className="font-bold text-gray-700">{inicio}-{fin}</span> de <span className="font-bold text-gray-700">{total}</span> alumnos
            </p>
            <div className="flex gap-1 items-center">
              <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-600">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-gray-700 px-3">Página {pagina} de {totalPaginas}</span>
              <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-600">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- MODAL DE EDICIÓN/ALTA (MAURICIO) --- */}
      <ManualRegister 
        isOpen={isModalOpen} 
        onClose={handleCerrarModal} 
        alumnoAEditar={alumnoAEditar} 
      />

      {/* --- MODAL DE ESTATUS (ALEJANDRO) --- */}
      {modalEstatusOpen && alumnoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative">
            
            <button onClick={() => setModalEstatusOpen(false)} className="absolute top-4 right-4 text-white hover:text-gray-200 focus:outline-none">
              <X className="w-5 h-5" />
            </button>

            <div className="bg-blue-900 p-5 text-white text-center">
              <h2 className="text-lg font-bold tracking-wide">Actualización de Estatus</h2>
              <p className="text-blue-200 text-xs mt-1">Gestión Académica UNID</p>
            </div>

            <div className="p-5">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg mb-5 border border-gray-100">
                <div className="bg-blue-100 p-2 rounded-full">
                  <User className="w-5 h-5 text-blue-900" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm leading-tight">{alumnoSeleccionado.nombre_completo}</h3>
                  <p className="text-xs text-blue-700 font-mono font-semibold">{alumnoSeleccionado.matricula}</p>
                </div>
              </div>

              <div className="space-y-2 mb-5">
                <p className="text-xs font-bold text-gray-700 mb-2 border-b pb-1">Seleccione el nuevo estatus:</p>
                {estatusCatalogo.map((estatus) => {
                  const ui = STATUS_UI[estatus.name] || {};
                  const Icon = ui.Icon;
                  return (
                    <label key={estatus.id} className={`flex items-center p-2.5 border rounded-lg cursor-pointer transition-all ${nuevoEstatus === estatus.name ? `${ui.activeBg} shadow-sm` : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="estatus" value={estatus.name} checked={nuevoEstatus === estatus.name} onChange={(e) => setNuevoEstatus(e.target.value)} className="mr-3 w-3.5 h-3.5 text-blue-900 focus:ring-blue-900" />
                      {Icon && <Icon className={`w-4 h-4 mr-2 ${ui.color}`} />}
                      <div>
                        <p className="text-sm font-bold text-gray-800">{ui.label || estatus.name}</p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {renderAlertaDinamica()}

              {logEvidencia?.evidence_file_name && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-700 flex-shrink-0" />
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Documento registrado</p>
                    <a
                      href={`/api/alumnos/archivos/${logEvidencia.evidence_file_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-blue-900 hover:underline truncate block"
                      title={logEvidencia.evidence_file_name}
                    >
                      {logEvidencia.evidence_file_name}
                    </a>
                  </div>
                </div>
              )}

              {esBaja && (
                <div className="mb-5 animate-in fade-in duration-300">
                  <p className="text-xs font-bold text-gray-700 uppercase mb-2">
                    {logEvidencia?.evidence_file_id ? 'Reemplazar Carta de No Adeudo' : 'Carta de No Adeudo'}
                    {requiereArchivo && <span className="text-red-500 ml-1">*</span>}
                    {logEvidencia?.evidence_file_id && <span className="text-gray-400 font-normal normal-case ml-1">(opcional)</span>}
                  </p>
                  <label className={`relative flex items-center justify-center w-full h-20 border-2 rounded-lg cursor-pointer transition overflow-hidden ${archivoBaja ? 'border-green-500 bg-green-50 shadow-inner' : 'border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100'}`}>
                    <input type="file" className="hidden" onChange={(e) => setArchivoBaja(e.target.files[0])} accept=".pdf, image/*" />
                    {archivoBaja ? (
                      <div className="flex items-center justify-between w-full px-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="bg-green-600 text-white px-2.5 py-1.5 rounded-md font-bold text-[10px] uppercase tracking-wider shadow-sm">
                            {archivoBaja.name.split('.').pop()}
                          </div>
                          <div className="flex flex-col text-left overflow-hidden">
                            <p className="text-sm font-bold text-green-900 truncate pr-2" title={archivoBaja.name}>
                              {archivoBaja.name}
                            </p>
                            <p className="text-[10px] text-green-600 mt-0.5 font-medium">Haz clic para cambiar documento</p>
                          </div>
                        </div>
                        <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <Upload className="w-5 h-5 text-gray-400 mb-1.5" />
                        <p className="text-xs text-gray-500 font-medium">Haga clic para adjuntar documento</p>
                      </div>
                    )}
                  </label>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button onClick={() => setModalEstatusOpen(false)} className="flex-1 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmarCambioEstatus}
                  disabled={(requiereArchivo && !archivoBaja) || guardandoEstatus}
                  className={`flex-1 py-2 text-sm font-bold text-white rounded-lg shadow-md transition flex justify-center items-center ${(requiereArchivo && !archivoBaja) || guardandoEstatus ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-900 hover:bg-blue-800'}`}
                >
                  {guardandoEstatus ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ListadoAlumnos;
