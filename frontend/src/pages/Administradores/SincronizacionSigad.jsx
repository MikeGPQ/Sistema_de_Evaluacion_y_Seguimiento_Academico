import React, { useState } from 'react';
import { RefreshCcw, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Database, UserPlus, Mail, MailX, ArrowRight, XCircle } from 'lucide-react';
import client from '../../lib/axios';

const LABEL_MAP = {
  classrooms: 'Aulas',
  academic_periods: 'Periodos Académicos',
  academic_programs: 'Programas Académicos',
  quarter_catalog: 'Catálogo de Cuatrimestres',
  teachers: 'Docentes',
  users_created: 'Cuentas de Usuario',
  subjects: 'Materias',
  sigad_groups: 'Grupos SIGAD',
  academic_groups: 'Grupos Académicos (Asignaciones)',
  assignment_schedules: 'Horarios de Clase',
};

const FIELD_MAP = {
  nombre_codigo: 'Nombre / Código',
  capacidad: 'Capacidad',
  tipo: 'Tipo',
  codigo: 'Código del Periodo',
  anio: 'Año',
  fecha_inicio: 'Fecha de Inicio',
  fecha_fin: 'Fecha de Fin',
  fecha_limite_calif: 'Límite de Calificaciones',
  codigo_unico: 'Código Único',
  name: 'Nombre',
  modalidad: 'Modalidad',
  nivel_academico: 'Nivel Académico',
  nombre: 'Nombre',
  identificador: 'Identificador',
  creditos: 'Créditos',
  cupo_maximo: 'Cupo Máximo',
  tipo_asignatura: 'Tipo de Asignatura',
  subject_id: 'Materia (ID)',
  teacher_id: 'Docente (ID)',
  sigad_group_id: 'Grupo SIGAD (ID)',
  aula_id: 'Aula (ID)',
  period_id: 'Periodo (ID)',
  sesiones: 'Sesiones de Clase'
};

const SincronizacionSigad = () => {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [expandedErrors, setExpandedErrors] = useState({});

  const toggleErrors = (key) => {
    setExpandedErrors(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSync = async () => {
    setLoading(true);
    setResultado(null);
    setError(null);
    try {
      const res = await client.post('/api/sync/sigad');
      if (res.data?.error) {
        setError(res.data.error);
      } else {
        setResultado(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const totalInserted = resultado ? Object.values(resultado).reduce((s, v) => s + (v.inserted || 0), 0) : 0;
  const totalUpdated = resultado ? Object.values(resultado).reduce((s, v) => s + (v.updated || 0), 0) : 0;
  const totalErrors = resultado ? Object.values(resultado).reduce((s, v) => s + (v.errors || 0), 0) : 0;
  const nuevosDocentes = resultado?.users_created?.nuevos_docentes ?? [];

  // Procesamiento de listas para las tablas comparativas de resultados 
  const insertedList = [];
  const updatedList = [];

  if (resultado) {
    Object.entries(resultado).forEach(([key, val]) => {
      if (val.inserted_details) {
        val.inserted_details.forEach(d => {
          insertedList.push({ entity: LABEL_MAP[key] || key, record: d.registro });
        });
      }
      if (val.updated_details) {
        val.updated_details.forEach(d => {
          d.cambios.forEach(c => {
            updatedList.push({
              entity: LABEL_MAP[key] || key,
              record: d.registro,
              field: c.campo,
              old: c.anterior,
              new: c.nuevo
            });
          });
        });
      }
    });
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Sincronización con SIGAD</h1>
        </div>
        <p className="text-gray-500 text-sm ml-[52px]">
          Importa y actualiza catálogos, docentes, materias, grupos y horarios desde el sistema SIGAD.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-700">Sincronización completa</h2>
            <p className="text-sm text-gray-400 mt-1">
              Se actualizarán aulas, periodos, programas, cuatrimestres, docentes, materias, grupos y horarios.
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={loading}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium transition-all text-sm shrink-0 ${
              loading
                ? 'bg-indigo-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-sm'
            }`}
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Sincronizando...' : 'Sincronizar con SIGAD'}
          </button>
        </div>

        {loading && (
          <div className="mt-5 flex items-center gap-3 text-indigo-600 bg-indigo-50 rounded-lg px-4 py-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent" />
            <span className="text-sm font-medium">Conectando con SIGAD y procesando datos... esto puede tardar unos segundos.</span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700 text-sm">Error en la sincronización</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {resultado && (
        <div className="space-y-5">
          <div className={`rounded-xl border p-5 flex flex-wrap items-center gap-6 ${
            totalErrors > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
          }`}>
            {totalErrors > 0 ? (
              <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
            ) : (
              <CheckCircle className="w-6 h-6 text-green-500 shrink-0" />
            )}
            <div>
              <p className="font-semibold text-gray-800 text-sm">
                Sincronización completada {totalErrors > 0 ? 'con advertencias' : 'exitosamente'}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">Resumen de cambios aplicados en la base de datos</p>
            </div>
            <div className="flex gap-4 ml-auto flex-wrap">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{totalInserted}</p>
                <p className="text-xs text-gray-500">Nuevos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{totalUpdated}</p>
                <p className="text-xs text-gray-500">Actualizados</p>
              </div>
              {totalErrors > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">{totalErrors}</p>
                  <p className="text-xs text-gray-500">Errores</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Entidad</th>
                  <th className="text-center px-4 py-3 font-semibold text-green-700">Nuevos</th>
                  <th className="text-center px-4 py-3 font-semibold text-blue-700">Actualizados</th>
                  <th className="text-center px-4 py-3 font-semibold text-red-600">Errores</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(resultado).map(([key, val]) => (
                  <React.Fragment key={key}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-700">
                        {LABEL_MAP[key] || key}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-semibold ${
                          (val.inserted || 0) > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {val.inserted ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-semibold ${
                          (val.updated || 0) > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {val.updated ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-semibold ${
                          val.errors > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {val.errors}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {val.error_details && val.error_details.length > 0 && (
                          <button
                            onClick={() => toggleErrors(key)}
                            className="text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1 text-xs font-medium"
                          >
                            {expandedErrors[key] ? (
                              <><ChevronUp className="w-3.5 h-3.5" /> Ocultar</>
                            ) : (
                              <><ChevronDown className="w-3.5 h-3.5" /> Ver ({val.error_details.length})</>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedErrors[key] && val.error_details && val.error_details.length > 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-3 bg-red-50">
                          <ul className="space-y-1">
                            {val.error_details.map((detail, i) => (
                              <li key={i} className="text-xs text-red-700 flex items-start gap-2">
                                <span className="text-red-400 mt-0.5 shrink-0">&#8226;</span>
                                {detail}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tablas Comparativas de Resultados implementadas */}
          {(insertedList.length > 0 || updatedList.length > 0) && (
            <div className="mt-8 space-y-6">
              <h2 className="text-xl font-bold text-gray-800">Detalle de Alteraciones en Base de Datos</h2>

              {/* Tabla Visual de Registros Nuevos (Ahora como comparativa actual al del otro sistema ) */}
              {insertedList.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden">
                  <div className="bg-green-50 px-5 py-4 border-b border-green-100 flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-green-900 text-base">Nuevos Registros (Cruces con SIGAD)</h3>
                      <p className="text-xs text-green-700">Se detectaron {insertedList.length} elementos en SIGAD que no existían en tu base de datos local.</p>
                    </div>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto p-4">
                    <div className="grid grid-cols-1 gap-3">
                      {insertedList.map((item, idx) => (
                        <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-green-300 transition-colors">
                          
                          {/* Información de la Entidad */}
                          <div className="flex-1">
                            <span className="inline-block px-2.5 py-1 bg-green-100 text-green-800 text-[10px] font-bold uppercase tracking-wider rounded-md mb-1.5">
                              Nuevo Registro en {item.entity}
                            </span>
                            <p className="text-xs text-gray-500 mt-0.5">El sistema ha importado exitosamente la siguiente información.</p>
                          </div>

                          {/* Comparativa Visual de Inserción */}
                          <div className="flex items-center gap-3 md:w-[60%] justify-end bg-white p-3 rounded-md border border-gray-100 shadow-sm">
                            <div className="flex-1 text-right">
                              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Antes (Local)</p>
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                <XCircle className="w-3 h-3" /> No Registrado
                              </span>
                            </div>
                            
                            <div className="bg-green-50 p-1.5 rounded-full shrink-0">
                              <ArrowRight className="w-4 h-4 text-green-500" />
                            </div>
                            
                            <div className="flex-1 text-left">
                              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Ahora (SIGAD)</p>
                              <p className="text-sm font-bold text-green-700 bg-green-50/50 truncate max-w-[200px] inline-block" title={item.record}>
                                {item.record}
                              </p>
                            </div>
                          </div>

                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tabla Visual de Registros Modificados */}
              {updatedList.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden">
                  <div className="bg-blue-50 px-5 py-4 border-b border-blue-100 flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <RefreshCcw className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-blue-900 text-base">Registros Existentes Actualizados</h3>
                      <p className="text-xs text-blue-700">Se detectaron {updatedList.length} cambios entre tu base de datos y SIGAD.</p>
                    </div>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto p-4">
                    <div className="grid grid-cols-1 gap-3">
                      {updatedList.map((item, idx) => (
                        <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-blue-300 transition-colors">
                          
                          {/* Información del Registro */}
                          <div className="flex-1">
                            <span className="inline-block px-2.5 py-1 bg-gray-200 text-gray-700 text-[10px] font-bold uppercase tracking-wider rounded-md mb-1.5">
                              {item.entity}
                            </span>
                            <p className="font-bold text-gray-900 text-sm">{item.record}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Atributo modificado: <span className="font-semibold text-gray-700">{FIELD_MAP[item.field] || item.field}</span>
                            </p>
                          </div>

                          {/* Comparativa Visual con Flecha */}
                          <div className="flex items-center gap-3 md:w-[60%] justify-end bg-white p-3 rounded-md border border-gray-100 shadow-sm">
                            <div className="flex-1 text-right">
                              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Antes (Local)</p>
                              <p className="text-sm font-medium text-red-600 line-through truncate max-w-[200px] inline-block" title={item.old}>{item.old}</p>
                            </div>
                            
                            <div className="bg-blue-50 p-1.5 rounded-full shrink-0">
                              <ArrowRight className="w-4 h-4 text-blue-500" />
                            </div>
                            
                            <div className="flex-1 text-left">
                              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Ahora (SIGAD)</p>
                              <p className="text-sm font-bold text-green-600 truncate max-w-[200px] inline-block" title={item.new}>{item.new}</p>
                            </div>
                          </div>

                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {nuevosDocentes.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-indigo-50">
                <UserPlus className="w-4 h-4 text-indigo-600 shrink-0" />
                <h3 className="text-sm font-semibold text-indigo-800">
                  {nuevosDocentes.length} docente{nuevosDocentes.length !== 1 ? 's' : ''} nuevo{nuevosDocentes.length !== 1 ? 's' : ''} — cuenta creada y correo enviado
                </h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Matrícula</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Nombre</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Correo</th>
                    <th className="text-center px-5 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Correo enviado</th>
                  </tr>
                </thead>
                <tbody>
                  {nuevosDocentes.map((d, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors last:border-0">
                      <td className="px-5 py-3 font-mono text-xs text-gray-600">{d.matricula}</td>
                      <td className="px-5 py-3 font-medium text-gray-800">{d.nombre}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{d.email}</td>
                      <td className="px-5 py-3 text-center">
                        {d.correo_enviado ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                            <Mail className="w-3 h-3" /> Enviado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                            <MailX className="w-3 h-3" /> Falló
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SincronizacionSigad;