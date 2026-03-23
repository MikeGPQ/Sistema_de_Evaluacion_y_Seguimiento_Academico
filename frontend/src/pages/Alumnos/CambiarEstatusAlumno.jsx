import React, { useState, useEffect } from 'react';
import { User, CheckCircle, XCircle, Upload, FileText, AlertTriangle, Loader2, GraduationCap } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import client from '../../lib/axios';
import { useAuth } from '../../hooks/AuthContext';
import Swal from 'sweetalert2';

const STATUS_UI = {
    'activo':        { label: 'Activo',       desc: 'Alumno con inscripción vigente',         color: 'text-green-600',  activeBg: 'bg-green-50 border-green-500',  Icon: CheckCircle },
    'egresado':      { label: 'Egresado',      desc: 'Conclusión satisfactoria de créditos',   color: 'text-blue-900',   activeBg: 'bg-blue-50 border-blue-900',    Icon: GraduationCap },
    'baja_temporal': { label: 'Baja Temporal', desc: 'Suspensión temporal de estudios',        color: 'text-orange-500', activeBg: 'bg-orange-50 border-orange-500', Icon: AlertTriangle },
    'baja':          { label: 'Baja',          desc: 'Baja definitiva del sistema',            color: 'text-red-600',    activeBg: 'bg-red-50 border-red-500',       Icon: XCircle },
};

const CambiarEstatusAlumno = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();

    const alumnoSeleccionado = location.state?.alumno;
    const estatusActual = location.state?.estatusActual || 'activo';

    const [nuevoEstatus, setNuevoEstatus] = useState(estatusActual);
    const [estatusCatalogo, setEstatusCatalogo] = useState([]);
    const [archivo, setArchivo] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [logEvidencia, setLogEvidencia] = useState(null);

    useEffect(() => {
        client.get('/catalogos/estatus').then(res => setEstatusCatalogo(res.data)).catch(() => {});
    }, []);

    useEffect(() => {
        if ((estatusActual === 'baja' || estatusActual === 'baja_temporal') && alumnoSeleccionado) {
            client.get(`/alumnos/${alumnoSeleccionado.matricula}/ultimo-log-estatus`)
                .then(res => setLogEvidencia(res.data))
                .catch(() => {});
        }
    }, [estatusActual, alumnoSeleccionado]);

    if (!alumnoSeleccionado) {
        return (
            <div className="p-10 text-center flex flex-col items-center">
                <p className="mb-4 text-gray-600">No se ha seleccionado ningún alumno.</p>
                <button onClick={() => navigate('/alumnos/listado')} className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition">
                    Volver al listado
                </button>
            </div>
        );
    }

    const esBaja = nuevoEstatus === 'baja' || nuevoEstatus === 'baja_temporal';
    const requiereArchivo = esBaja && !logEvidencia?.evidence_file_id;

    const handleConfirmarCambio = async () => {
        if (archivo) {
            if (archivo.type !== 'application/pdf') {
                Swal.fire('Formato inválido', 'Solo se permiten archivos PDF como carta de no adeudo.', 'error');
                setArchivo(null);
                return;
            }
            if (archivo.size > 2 * 1024 * 1024) {
                Swal.fire('Archivo muy pesado', 'La carta de no adeudo no debe superar los 2MB.', 'error');
                setArchivo(null);
                return;
            }
        }

        try {
            setGuardando(true);
            const statusSeleccionado = estatusCatalogo.find(s => s.name === nuevoEstatus);

            const formData = new FormData();
            formData.append('status_id', statusSeleccionado.id);
            formData.append('usuario_id', user?.identifier || user?.email || "Admin Local");
            if (archivo) formData.append('evidence_file', archivo);

            await client.put(`/alumnos/${alumnoSeleccionado.matricula}/estatus`, formData);

            navigate('/alumnos/listado');
        } catch (error) {
            console.error("Error al cambiar estatus:", error);
            Swal.fire('Error', error?.response?.data?.detail || 'Hubo un error al actualizar el estatus.', 'error');
        } finally {
            setGuardando(false);
        }
    };

    // Función dinámica para renderizar el mensaje de advertencia según el estatus seleccionado
    const renderAlertaDinamica = () => {
        if (nuevoEstatus === 'baja' || nuevoEstatus === 'baja_temporal') {
            return (
                <div className="flex gap-3 p-4 bg-red-50 rounded-xl mb-6 border border-red-100 animate-in fade-in duration-300">
                    <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
                    <p className="text-xs text-red-800 font-medium">
                        <span className="font-bold uppercase block mb-1">Advertencia Académica</span>
                        Se registrará que TÚ diste de baja a este alumno. Se liberarán cupos y será eliminado de las listas vigentes. HECTOR
                    </p>
                </div>
            );
        }
        if (nuevoEstatus === 'egresado') {
            return (
                <div className="flex gap-3 p-4 bg-blue-50 rounded-xl mb-6 border border-blue-200 animate-in fade-in duration-300">
                    <GraduationCap className="w-8 h-8 text-blue-900 flex-shrink-0" />
                    <p className="text-xs text-blue-900 font-medium">
                        <span className="font-bold uppercase block mb-1">Transferencia a Alumno</span>
                        El alumno será transferido al portal de Egresados UNID. Se revocarán los accesos a materias activas y se iniciará su proceso de titulación.
                    </p>
                </div>
            );
        }
        return null; 
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                
                {/* Encabezado Institucional (Azul UNID) */}
                <div className="bg-blue-900 p-6 text-white text-center">
                    <h2 className="text-xl font-bold tracking-wide">Actualización de Estatus</h2>
                    <p className="text-blue-200 text-xs mt-1">Gestión Académica UNID</p>
                </div>

                <div className="p-6">
                    {/* Info del Alumno */}
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl mb-6 border border-gray-100">
                        <div className="bg-blue-100 p-3 rounded-full">
                            <User className="w-6 h-6 text-blue-900" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Alumno seleccionado</p>
                            <h3 className="font-bold text-gray-900 text-lg leading-tight">{alumnoSeleccionado.nombre_completo}</h3>
                            <p className="text-sm text-blue-700 font-mono font-semibold mt-1">{alumnoSeleccionado.matricula}</p>
                        </div>
                    </div>

                    <div className="space-y-3 mb-6">
                        <p className="text-sm font-bold text-gray-700 mb-3 border-b pb-2">Seleccione el nuevo estatus:</p>

                        {estatusCatalogo.map((estatus) => {
                            const ui = STATUS_UI[estatus.name] || {};
                            const Icon = ui.Icon;
                            return (
                                <label key={estatus.id} className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${nuevoEstatus === estatus.name ? `${ui.activeBg} shadow-sm` : 'border-gray-200 hover:bg-gray-50'}`}>
                                    <input type="radio" name="estatus" value={estatus.name} checked={nuevoEstatus === estatus.name} onChange={(e) => setNuevoEstatus(e.target.value)} className="mr-4 w-4 h-4 text-blue-900 focus:ring-blue-900" />
                                    {Icon && <Icon className={`w-5 h-5 mr-3 ${ui.color}`} />}
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">{ui.label || estatus.name}</p>
                                        <p className="text-xs text-gray-500 leading-tight">{ui.desc || estatus.description}</p>
                                    </div>
                                </label>
                            );
                        })}
                    </div>

                    
                    {renderAlertaDinamica()}

                    
                    {logEvidencia?.evidence_file_name && (
                        <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-200 flex items-center gap-2">
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
                        <div className="mb-6 animate-in fade-in duration-300">
                            <p className="text-xs font-bold text-gray-700 uppercase mb-2">
                                {logEvidencia?.evidence_file_id ? 'Reemplazar Carta de No Adeudo' : 'Carta de No Adeudo'}
                                {requiereArchivo && <span className="text-red-500 ml-1">*</span>}
                                {logEvidencia?.evidence_file_id && <span className="text-gray-400 font-normal normal-case ml-1">(opcional)</span>}
                            </p>
                            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                                <Upload className="w-5 h-5 text-gray-400 mb-1" />
                                <p className="text-xs text-gray-500 font-medium">Haga clic para adjuntar documento</p>
                                <input type="file" className="hidden" onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    if (file.type !== 'application/pdf') {
                                        Swal.fire('Formato inválido', 'Solo se permiten archivos PDF como carta de no adeudo.', 'error');
                                        e.target.value = '';
                                        return;
                                    }
                                    if (file.size > 2 * 1024 * 1024) {
                                        Swal.fire('Archivo muy pesado', 'La carta de no adeudo no debe superar los 2MB.', 'error');
                                        e.target.value = '';
                                        return;
                                    }
                                    setArchivo(file);
                                }} accept="application/pdf" />
                            </label>
                            {archivo && (
                                <div className="mt-3 p-2 bg-green-50 rounded border border-green-200 flex items-center">
                                    <FileText className="w-4 h-4 mr-2 text-green-600" /> 
                                    <p className="text-xs text-green-700 font-bold truncate">{archivo.name}</p>
                                </div>
                            )}
                        </div>
                    )}

                   
                    <div className="flex gap-3 pt-2">
                        <button 
                            onClick={() => navigate('/alumnos/listado')} 
                            className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirmarCambio}
                            disabled={(requiereArchivo && !archivo) || guardando}
                            className={`flex-1 py-2.5 text-sm font-bold text-white rounded-xl shadow-md transition flex justify-center items-center ${(requiereArchivo && !archivo) || guardando ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-900 hover:bg-blue-800'}`}
                        >
                            {guardando ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar Cambios'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CambiarEstatusAlumno;