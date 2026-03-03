import React, { useState, useEffect } from 'react';
import { 
  Edit2, UserX, ChevronLeft, ChevronRight, Loader2, Search, Upload, Plus, LogOut,
  User, CheckCircle, XCircle, FileText, AlertTriangle, GraduationCap, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../../lib/axios';
import { useAuth } from '../../hooks/AuthContext';
import ManualRegister from '../../components/form/ManualRegister';
import Swal from 'sweetalert2';

const ListadoAlumnos = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth(); 

  const [alumnos, setAlumnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  
  const [isModalAltaOpen, setIsModalAltaOpen] = useState(false);
  const [modalEstatusOpen, setModalEstatusOpen] = useState(false);
  
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  const [nuevoEstatus, setNuevoEstatus] = useState('');
  const [archivoBaja, setArchivoBaja] = useState(null);
  const [guardandoEstatus, setGuardandoEstatus] = useState(false);
  
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

  const abrirModalEstatus = (alumno) => {
    let estatusActual = "Activo";
    if (alumno.estatus === "baja") estatusActual = "Baja";
    if (alumno.estatus === "baja_temporal") estatusActual = "Baja Temporal";
    if (alumno.estatus === "egresado") estatusActual = "Egresado";
    
    setAlumnoSeleccionado(alumno);
    setNuevoEstatus(estatusActual);
    setArchivoBaja(null);
    setModalEstatusOpen(true);
  };

  const requiereArchivo = nuevoEstatus === 'Baja' || nuevoEstatus === 'Baja Temporal';

  const handleConfirmarCambioEstatus = async () => {
    try {
        setGuardandoEstatus(true);
        const estatusFormateado = nuevoEstatus.toLowerCase().replace(' ', '_');
        
        // CORRECCIÓN 1: Tomamos el identificador único del usuario
        const usuarioActual = user?.identifier || user?.email || "Admin Local";

        // CORRECCIÓN 2: Cambiamos "usuario_accion" por "usuario_id"
        await client.put(`/alumnos/${alumnoSeleccionado.matricula}/estatus`, {
            estatus: estatusFormateado,
            usuario_id: usuarioActual 
        });

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
            text: 'No se pudo cambiar el estatus del alumno.'
        });
    } finally {
        setGuardandoEstatus(false);
    }
  };

  const renderAlertaDinamica = () => {
    if (nuevoEstatus === 'Baja' || nuevoEstatus === 'Baja Temporal') {
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
    if (nuevoEstatus === 'Egresado') {
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
      
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Listado General de Alumnos</h1>
          <p className="text-gray-500 text-sm">Gestión y visualización de matrícula escolar</p>
        </div>
        <button onClick={logout} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg text-sm font-bold transition-colors shadow-sm border border-red-100">
          <LogOut className="w-4 h-4" />
          Cerrar Sesión
        </button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input type="text" placeholder="Buscar por matrícula o nombre..." className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#1A237E] focus:border-[#1A237E]" />
        </div>

        <div className="flex w-full md:w-auto items-center gap-3">
          <button onClick={() => navigate('/alumnos/importar')} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-[#1A237E] text-[#1A237E] px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-50 shadow-sm">
            <Upload className="w-4 h-4" /> Importación
          </button>
          <button onClick={() => setIsModalAltaOpen(true)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#1A237E] text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-[#283593] shadow-sm">
            <Plus className="w-4 h-4" /> Agregar Alumno
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
                      <td className="p-4 font-mono text-sm text-gray-600 font-bold">{alumno.matricula}</td>
                      <td className="p-4"><span className="text-sm font-semibold text-gray-900">{alumno.nombre_completo}</span></td>
                      <td className="p-4 text-sm text-gray-600">{alumno.carrera}</td>
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
                          <button onClick={() => abrirModalEstatus(alumno)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Cambiar Estatus">
                            <UserX className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-10 text-center text-gray-500">No se encontraron alumnos registrados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {!cargando && total > 0 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-500">Mostrando <span className="font-bold">{inicio}-{fin}</span> de <span className="font-bold">{total}</span> alumnos</p>
            <div className="flex gap-2 items-center">
              <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} className="p-1 border rounded hover:bg-white disabled:opacity-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold px-2">Página {pagina} de {totalPaginas}</span>
              <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} className="p-1 border rounded hover:bg-white disabled:opacity-50">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ManualRegister isOpen={isModalAltaOpen} onClose={() => setIsModalAltaOpen(false)} />

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
                    {[
                        { id: 'Activo', desc: 'Inscripción vigente', color: 'text-green-600', activeBg: 'bg-green-50 border-green-500', Icon: CheckCircle },
                        { id: 'Egresado', desc: 'Conclusión de créditos', color: 'text-blue-900', activeBg: 'bg-blue-50 border-blue-900', Icon: GraduationCap },
                        { id: 'Baja Temporal', desc: 'Suspensión temporal', color: 'text-orange-500', activeBg: 'bg-orange-50 border-orange-500', Icon: AlertTriangle },
                        { id: 'Baja', desc: 'Baja definitiva', color: 'text-red-600', activeBg: 'bg-red-50 border-red-500', Icon: XCircle }
                    ].map((item) => (
                        <label key={item.id} className={`flex items-center p-2.5 border rounded-lg cursor-pointer transition-all ${nuevoEstatus === item.id ? `${item.activeBg} shadow-sm` : 'border-gray-200 hover:bg-gray-50'}`}>
                            <input type="radio" name="estatus" value={item.id} checked={nuevoEstatus === item.id} onChange={(e) => setNuevoEstatus(e.target.value)} className="mr-3 w-3.5 h-3.5 text-blue-900 focus:ring-blue-900" />
                            <item.Icon className={`w-4 h-4 mr-2 ${item.color}`} />
                            <div>
                                <p className="text-sm font-bold text-gray-800">{item.id}</p>
                            </div>
                        </label>
                    ))}
                </div>

                {renderAlertaDinamica()}

                {/* --- diseño nuevo para el archivo subido --- */}
                {requiereArchivo && (
                    <div className="mb-5 animate-in fade-in duration-300">
                        <p className="text-xs font-bold text-gray-700 uppercase mb-2">Carta de No Adeudo <span className="text-red-500">*</span></p>
                        
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