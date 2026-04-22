import React, { useState, useEffect } from 'react';
import { 
  Edit2, 
  Search,
  Plus,
  X,
  Filter,
  ChevronLeft, 
  ChevronRight,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Eye,
  Mail,
  User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../../lib/axios'; 
import { useAuth } from '../../hooks/AuthContext';
import AdminRegister from '../../components/form/AdminRegister'; 

const AdministratorList = () => {
  const navigate = useNavigate();
  const { user } = useAuth(); 

  const [administradores, setAdministradores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const limite = 10;

  const [busquedaAdmin, setBusquedaAdmin] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adminAEditar, setAdminAEditar] = useState(null);

  const [isModalDetalleOpen, setIsModalDetalleOpen] = useState(false);
  const [adminDetalle, setAdminDetalle] = useState(null);

  const fetchAdministradores = async () => {
    try {
      setCargando(true);
      const skip = (pagina - 1) * limite;
      
      const params = new URLSearchParams({ skip, limit: limite });
      const terminoBusqueda = busquedaAdmin.trim().replace(/\s+/g, ' ');

      if (terminoBusqueda) params.append('busqueda', terminoBusqueda);
      if (filtroEstatus) params.append('estatus', filtroEstatus);

      const response = await client.get(`/administradores/listado?${params.toString()}`);
      
      setAdministradores(response.data.data || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error("Error al cargar administradores:", error);
      setAdministradores([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    const retardoBusqueda = setTimeout(() => {
      fetchAdministradores();
    }, 400); 
    return () => clearTimeout(retardoBusqueda);
  }, [pagina, busquedaAdmin, filtroEstatus]);

  const handleCambioFiltro = (setter, valor) => {
    setter(valor);
    setPagina(1); 
  };

  const limpiarFiltros = () => {
    setBusquedaAdmin('');
    setFiltroEstatus('');
    setPagina(1);
  };

  const hayFiltrosActivos = busquedaAdmin || filtroEstatus;

  const renderEstatus = (estatus) => {
    const esActivo = estatus?.toLowerCase() === 'activo';
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
        esActivo 
        ? 'bg-green-50 text-green-700 border-green-200' 
        : 'bg-red-50 text-red-700 border-red-200'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${esActivo ? 'bg-green-500' : 'bg-red-500'}`}></span>
        {esActivo ? 'Activo' : 'Inactivo'}
      </span>
    );
  };

  const handleAgregarAdmin = () => {
    setAdminAEditar(null);
    setIsModalOpen(true);
  };

  const handleEditarAdmin = (admin) => {
    setAdminAEditar(admin);
    setIsModalOpen(true);
  };

  const handleVerDetalles = (admin) => {
    setAdminDetalle(admin);
    setIsModalDetalleOpen(true);
  };

  const handleCerrarModal = () => {
    setIsModalOpen(false);
    setAdminAEditar(null);
    fetchAdministradores(); 
  };

  const inicio = (pagina - 1) * limite + 1;
  const fin = Math.min(pagina * limite, total);
  const totalPaginas = Math.ceil(total / limite);

  return (
    <div className="p-8 bg-gray-50 min-h-screen relative">
      
      {/* --- HEADER --- */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#1a2b4b] flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-[#1A237E]" />
            Control de Administradores
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleAgregarAdmin} 
            className="flex items-center gap-2 bg-[#1A237E] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#283593] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Agregar Administrador
          </button>
        </div>
      </div>

      {/* --- TABLA CON FILTROS --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        
        {/* --- FILTROS --- */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[250px]">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Búsqueda de Administrador</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Nombre, apellidos o ID de empleado..." 
                value={busquedaAdmin}
                onChange={(e) => {
                  const valorLimpio = e.target.value.replace(/[^a-zA-Z0-9 áéíóúÁÉÍÓÚñÑ]/g, '');
                  handleCambioFiltro(setBusquedaAdmin, valorLimpio);
                }}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="w-48">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Estatus</label>
            <div className="relative">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select 
                value={filtroEstatus}
                onChange={(e) => handleCambioFiltro(setFiltroEstatus, e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 appearance-none bg-white cursor-pointer"
              >
                <option value="">Todos los estatus</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
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
              <Loader2 className="w-10 h-10 text-[#1A237E] animate-spin mb-4" />
              <p className="text-gray-500 font-medium">Consultando registros...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-200 text-xs uppercase text-gray-500 font-bold tracking-wider">
                  <th className="p-4 pl-6">ID Empleado</th>
                  <th className="p-4">Nombre Completo</th>
                  <th className="p-4 text-center">Estatus</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {administradores.length > 0 ? (
                  administradores.map((admin, index) => (
                    <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-4 pl-6 font-mono text-sm text-gray-600 font-bold">
                        {admin.numero_empleado}
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-semibold text-[#1a2b4b]">
                          {admin.nombre_completo}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {renderEstatus(admin.estatus)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => handleVerDetalles(admin)} 
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100" 
                            title="Ver Detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleEditarAdmin(admin)} 
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" 
                            title="Editar Perfil"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="p-16 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <ShieldAlert className="w-12 h-12 text-gray-300 mb-3" />
                        <p className="font-semibold text-gray-700">No se encontraron administradores</p>
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
              Mostrando <span className="font-bold text-gray-700">{inicio}-{fin}</span> de <span className="font-bold text-gray-700">{total}</span> administradores
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

      {/* --- MODAL DE DETALLES --- */}
      {isModalDetalleOpen && adminDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative">
            <button 
              onClick={() => setIsModalDetalleOpen(false)} 
              className="absolute top-4 right-4 text-white hover:text-gray-200 focus:outline-none"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="bg-[#1A237E] p-6 text-white text-center">
              <div className="bg-indigo-500/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-indigo-300/50">
                <User className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-lg font-bold tracking-wide">{adminDetalle.nombre_completo}</h2>
              <p className="text-indigo-200 text-sm mt-1 font-mono">{adminDetalle.numero_empleado}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Correo Institucional</p>
                  <p className="text-sm font-medium text-gray-800 break-all">
                    {adminDetalle.email_institucional ? adminDetalle.email_institucional : <span className="text-gray-400 italic">No registrado</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Correo Personal</p>
                  <p className="text-sm font-medium text-gray-800 break-all">
                    {adminDetalle.email_personal ? adminDetalle.email_personal : <span className="text-gray-400 italic">No registrado</span>}
                  </p>
                </div>
              </div>
              <div className="flex justify-center pt-2">
                {renderEstatus(adminDetalle.estatus)}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setIsModalDetalleOpen(false)}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE ALTA/EDICIÓN --- */}
      <AdminRegister 
        isOpen={isModalOpen} 
        onClose={handleCerrarModal} 
        adminAEditar={adminAEditar} 
      />
    </div>
  );
};

export default AdministratorList;