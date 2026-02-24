import React, { useState } from 'react';
import { User, CheckCircle, XCircle, Upload, FileText, AlertTriangle, Loader2, GraduationCap } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import client from '../../lib/axios';

const CambiarEstatusAlumno = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const alumnoSeleccionado = location.state?.alumno;

    const [nuevoEstatus, setNuevoEstatus] = useState('Activo');
    const [archivo, setArchivo] = useState(null);
    const [guardando, setGuardando] = useState(false);

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

    const requiereArchivo = nuevoEstatus === 'Baja' || nuevoEstatus === 'Baja Temporal';

    const handleConfirmarCambio = async () => {
        try {
            setGuardando(true);
            const estatusFormateado = nuevoEstatus.toLowerCase().replace(' ', '_');

            await client.put(`/alumnos/${alumnoSeleccionado.matricula}/estatus`, {
                estatus: estatusFormateado
            });

            navigate('/alumnos/listado');
        } catch (error) {
            console.error("Error al cambiar estatus:", error);
            alert("Hubo un error al actualizar el estatus.");
        } finally {
            setGuardando(false);
        }
    };

    // Función dinámica para renderizar el mensaje de advertencia según el estatus seleccionado
    const renderAlertaDinamica = () => {
        if (nuevoEstatus === 'Baja' || nuevoEstatus === 'Baja Temporal') {
            return (
                <div className="flex gap-3 p-4 bg-red-50 rounded-xl mb-6 border border-red-100 animate-in fade-in duration-300">
                    <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
                    <p className="text-xs text-red-800 font-medium">
                        <span className="font-bold uppercase block mb-1">Advertencia Académica</span>
                        Este cambio afectará el registro académico. Se liberarán cupos y el alumno será eliminado de las listas vigentes inmediatamente.
                    </p>
                </div>
            );
        }
        if (nuevoEstatus === 'Egresado') {
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

                        {[
                            { id: 'Activo', desc: 'Alumno con inscripción vigente', color: 'text-green-600', activeBg: 'bg-green-50 border-green-500', Icon: CheckCircle },
                            { id: 'Egresado', desc: 'Conclusión satisfactoria de créditos', color: 'text-blue-900', activeBg: 'bg-blue-50 border-blue-900', Icon: GraduationCap },
                            { id: 'Baja Temporal', desc: 'Suspensión temporal de estudios', color: 'text-orange-500', activeBg: 'bg-orange-50 border-orange-500', Icon: AlertTriangle },
                            { id: 'Baja', desc: 'Baja definitiva del sistema', color: 'text-red-600', activeBg: 'bg-red-50 border-red-500', Icon: XCircle }
                        ].map((item) => (
                            <label key={item.id} className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${nuevoEstatus === item.id ? `${item.activeBg} shadow-sm` : 'border-gray-200 hover:bg-gray-50'}`}>
                                <input type="radio" name="estatus" value={item.id} checked={nuevoEstatus === item.id} onChange={(e) => setNuevoEstatus(e.target.value)} className="mr-4 w-4 h-4 text-blue-900 focus:ring-blue-900" />
                                <item.Icon className={`w-5 h-5 mr-3 ${item.color}`} />
                                <div>
                                    <p className="text-sm font-bold text-gray-800">{item.id}</p>
                                    <p className="text-xs text-gray-500 leading-tight">{item.desc}</p>
                                </div>
                            </label>
                        ))}
                    </div>

                    
                    {renderAlertaDinamica()}

                    
                    {requiereArchivo && (
                        <div className="mb-6 animate-in fade-in duration-300">
                            <p className="text-xs font-bold text-gray-700 uppercase mb-2">Carta de No Adeudo <span className="text-red-500">*</span></p>
                            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                                <Upload className="w-5 h-5 text-gray-400 mb-1" />
                                <p className="text-xs text-gray-500 font-medium">Haga clic para adjuntar documento</p>
                                <input type="file" className="hidden" onChange={(e) => setArchivo(e.target.files[0])} accept=".pdf, image/*" />
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