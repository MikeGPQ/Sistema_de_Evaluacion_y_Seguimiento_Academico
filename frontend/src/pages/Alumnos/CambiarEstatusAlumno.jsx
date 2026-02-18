import React, { useState } from 'react';
import { User, CheckCircle, XCircle, Upload, FileText, AlertTriangle } from 'lucide-react';

const CambiarEstatusAlumno = ({ alumnoSeleccionado }) => {
    
    if (!alumnoSeleccionado) return <div className="p-10 text-center">No hay alumno seleccionado</div>;

    const [nuevoEstatus, setNuevoEstatus] = useState('Activo');
    const [archivo, setArchivo] = useState(null);

    const requiereArchivo = nuevoEstatus === 'Baja' || nuevoEstatus === 'Baja Temporal';

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Cambiar Estatus del Alumno</h2>

                {/* Info del Alumno */}
                <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl mb-6">
                    <div className="bg-blue-100 p-3 rounded-full">
                        <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Alumno seleccionado</p>
                        <h3 className="font-bold text-gray-900">{alumnoSeleccionado.nombre}</h3>
                        <p className="text-xs text-gray-400 font-mono">Matrícula: {alumnoSeleccionado.matricula}</p>
                    </div>
                </div>

                
                <div className="space-y-3 mb-6">
                    <p className="text-sm font-semibold text-gray-600 mb-2">Seleccionar nuevo estatus</p>

                    {[
                        { id: 'Activo', desc: 'El alumno continuará inscrito', color: 'text-green-500', Icon: CheckCircle },
                        { id: 'Egresado', desc: 'El alumno ha egresado', color: 'text-blue-500', Icon: CheckCircle },
                        { id: 'Baja Temporal', desc: 'El alumno dejará de estar inscrito temporalmente', color: 'text-yellow-500', Icon: AlertTriangle },
                        { id: 'Baja', desc: 'Baja definitiva del sistema', color: 'text-red-500', Icon: XCircle }
                    ].map((item) => (
                        <label key={item.id} className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${nuevoEstatus === item.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 hover:bg-gray-50'}`}>
                            <input type="radio" name="estatus" value={item.id} checked={nuevoEstatus === item.id} onChange={(e) => setNuevoEstatus(e.target.value)} className="mr-4 w-4 h-4 text-blue-600" />
                            <item.Icon className={`w-5 h-5 mr-3 ${item.color}`} />
                            <div>
                                <p className="text-sm font-bold text-gray-800">{item.id}</p>
                                <p className="text-[10px] text-gray-500 leading-tight">{item.desc}</p>
                            </div>
                        </label>
                    ))}
                </div>

               
                {requiereArchivo && (
                    <div className="mb-6 animate-in slide-in-from-top-2 duration-300">
                        <p className="text-[10px] font-black text-orange-600 uppercase mb-2">Adjuntar No Adeudo (Obligatorio)</p>
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-orange-300 rounded-xl cursor-pointer bg-orange-50/30 hover:bg-orange-50 transition">
                            <Upload className="w-5 h-5 text-orange-500 mb-1" />
                            <p className="text-[10px] text-orange-600">Subir PDF o Imagen</p>
                            <input type="file" className="hidden" onChange={(e) => setArchivo(e.target.files[0])} />
                        </label>
                        {archivo && <p className="mt-2 text-[10px] text-green-600 font-bold flex items-center"><FileText className="w-3 h-3 mr-1" /> {archivo.name}</p>}
                    </div>
                )}

               
                <div className="flex gap-3 p-3 bg-yellow-50 rounded-lg mb-6 border border-yellow-100">
                    <AlertTriangle className="w-8 h-8 text-yellow-600" />
                    <p className="text-[10px] text-yellow-800 italic">
                        Este cambio afectará el registro académico. Se liberarán cupos y se eliminará de listas vigentes.
                    </p>
                </div>

                <div className="flex gap-3">
                    <button className="flex-1 py-2 text-sm font-bold text-gray-400 bg-gray-100 rounded-lg">Cancelar</button>
                    <button
                        disabled={requiereArchivo && !archivo}
                        className={`flex-1 py-2 text-sm font-bold text-white rounded-lg shadow-md transition ${requiereArchivo && !archivo ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        Confirmar Cambio
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CambiarEstatusAlumno;