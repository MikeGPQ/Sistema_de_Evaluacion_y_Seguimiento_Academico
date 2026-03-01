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
  LogOut,
  X,
  Filter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../../lib/axios';
import { useAuth } from '../../hooks/AuthContext';
import ManualRegister from '../../components/form/ManualRegister';

const ListadoAlumnos = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // --- ESTADOS DE DATOS Y PAGINACIÓN ---
  const [alumnos, setAlumnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  
  // --- ESTADOS DE MAURICIO (MODAL Y EDICIÓN) ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [alumnoAEditar, setAlumnoAEditar] = useState(null);
  
  const limite = 10;

  // --- ESTADOS DE FILTROS DE JORGE (HU-25a) ---
  const [busquedaAlumno, setBusquedaAlumno] = useState('');
  const [filtroCarrera, setFiltroCarrera] = useState('');
  const [filtroCuatrimestre, setFiltroCuatrimestre] = useState('');

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

  // --- MANEJADORES DE EVENTOS ---
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

  const handleCambiarEstatus = (alumno) => {
    let estatusFormateado = "Activo";
    if (alumno.estatus === "baja") estatusFormateado = "Baja";
    if (alumno.estatus === "baja_temporal") estatusFormateado = "Baja Temporal";
    if (alumno.estatus === "egresado") estatusFormateado = "Egresado";
    if (alumno.estatus === "activo") estatusFormateado = "Activo";

    navigate('/alumnos/cambiar-estatus', { state: { alumno, estatusActual: estatusFormateado } });
  };

  // --- FUNCIONES DE MAURICIO (MODAL) ---
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

  const inicio = (pagina - 1) * limite + 1;
  const fin = Math.min(pagina * limite, total);
  const totalPaginas = Math.ceil(total / limite);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      
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
          <button onClick={logout} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg text-sm font-bold transition-colors shadow-sm border border-red-100">
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        
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
                          <button onClick={() => handleEditarAlumno(alumno)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" title="Editar / Ver Kárdex">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleCambiarEstatus(alumno)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" title="Cambiar Estatus">
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

      <ManualRegister 
        isOpen={isModalOpen} 
        onClose={handleCerrarModal} 
        alumnoAEditar={alumnoAEditar} 
      />

    </div>
  );
};

export default ListadoAlumnos;