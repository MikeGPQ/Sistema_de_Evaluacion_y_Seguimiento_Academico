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
  LogOut
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../../lib/axios';
import { useAuth } from '../../hooks/AuthContext';
import ManualRegister from '../../components/form/ManualRegister';

const ListadoAlumnos = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [alumnos, setAlumnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const limite = 10;

  const fetchAlumnos = async () => {
    try {
      setCargando(true);
      const skip = (pagina - 1) * limite;
      const response = await client.get(`/alumnos/listado?skip=${skip}&limit=${limite}`);
      setAlumnos(response.data.data);
      setTotal(response.data.total);
    } catch (error) {
      console.error("Error al cargar alumnos:", error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    fetchAlumnos();
  }, [pagina]);

  const getStatusColor = (status) => {
    const s = status?.toLowerCase() || '';
    if (s === 'activo') return 'bg-green-100 text-green-700 border-green-200';
    if (s === 'baja') return 'bg-red-100 text-red-700 border-red-200';
    if (s.includes('temporal')) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (s === 'egresado') return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const handleCambiarEstatus = (alumno) => {
    
    let estatusFormateado = "Activo"; // Default
    if (alumno.estatus === "baja") estatusFormateado = "Baja";
    if (alumno.estatus === "baja_temporal") estatusFormateado = "Baja Temporal";
    if (alumno.estatus === "egresado") estatusFormateado = "Egresado";
    if (alumno.estatus === "activo") estatusFormateado = "Activo";

    
    navigate('/alumnos/cambiar-estatus', { 
        state: { 
            alumno: alumno,
            estatusActual: estatusFormateado 
        } 
    });
  };

  const inicio = (pagina - 1) * limite + 1;
  const fin = Math.min(pagina * limite, total);
  const totalPaginas = Math.ceil(total / limite);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Listado General de Alumnos</h1>
          <p className="text-gray-500 text-sm">Gestión y visualización de matrícula escolar</p>
        </div>
        
        <button 
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg text-sm font-bold transition-colors shadow-sm border border-red-100"
        >
          <LogOut className="w-4 h-4" />
          Cerrar Sesión
        </button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por matrícula o nombre..."
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A237E] focus:border-[#1A237E] sm:text-sm transition duration-150 ease-in-out shadow-sm"
          />
        </div>

        <div className="flex w-full md:w-auto items-center gap-3">
          <button
            onClick={() => navigate('/alumnos/importar')}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-[#1A237E] text-[#1A237E] px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" />
            Importación
          </button>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#1A237E] text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-[#283593] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Agregar Alumno
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        
        <div className="overflow-x-auto min-h-[400px]">
          {cargando ? (
            <div className="flex flex-col items-center justify-center h-full py-20">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
              <p className="text-gray-500 font-medium">Cargando alumnos...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                  <th className="p-4">Matrícula</th>
                  <th className="p-4">Nombre Completo</th>
                  <th className="p-4">Carrera</th>
                  <th className="p-4 text-center">Estatus</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {alumnos.length > 0 ? (
                  alumnos.map((alumno, index) => (
                    <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-4 font-mono text-sm text-gray-600 font-bold">
                        {alumno.matricula}
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-semibold text-gray-900">
                          {alumno.nombre_completo}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {alumno.carrera}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${getStatusColor(alumno.estatus)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${alumno.estatus?.toLowerCase() === 'activo' ? 'bg-green-500' : alumno.estatus?.toLowerCase() === 'baja' ? 'bg-red-500' : 'bg-gray-500'}`}></span>
                          {alumno.estatus}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Editar información">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          
                          <button 
                            onClick={() => handleCambiarEstatus(alumno)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
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
                    <td colSpan="5" className="p-10 text-center text-gray-500">
                      No se encontraron alumnos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {!cargando && total > 0 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-500">
              Mostrando <span className="font-bold">{inicio}-{fin}</span> de <span className="font-bold">{total}</span> alumnos
            </p>
            <div className="flex gap-2 items-center">
              <button 
                onClick={() => setPagina(p => Math.max(1, p - 1))}
                disabled={pagina === 1}
                className="p-1 border rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <span className="text-xs font-bold px-2">Página {pagina} de {totalPaginas}</span>

              <button 
                onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                disabled={pagina === totalPaginas}
                className="p-1 border rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ManualRegister 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />

    </div>
  );
};

export default ListadoAlumnos;