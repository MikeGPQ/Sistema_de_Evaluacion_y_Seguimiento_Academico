import React, { useState } from 'react';
import { RefreshCcw, AlertCircle, ChevronDown, ChevronUp, Database, UserPlus, Mail, MailX, ArrowRight } from 'lucide-react';
import client from '../../lib/axios';
import EntityDetailModal from "./EntityDetailModal";
import { useAuth } from "../../hooks/AuthContext";

export const LABEL_MAP = {
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

export const COLUMNS_MAP = {
  academic_periods: [
    { key: 'external_id', label: 'ID SIGAD' },
    { key: 'codigo', label: 'Código' },
    { key: 'anio', label: 'Año' },
    { key: 'fecha_inicio', label: 'Fecha inicio' },
    { key: 'fecha_fin', label: 'Fecha fin' },
    { key: 'is_active', label: 'Activo' },
  ],
  academic_programs: [
    { key: 'external_id', label: 'ID SIGAD' },
    { key: 'codigo_unico', label: 'Código' },
    { key: 'name', label: 'Nombre' },
    { key: 'modalidad', label: 'Modalidad' },
    { key: 'nivel_academico', label: 'Nivel académico' },
  ],
  quarter_catalog: [
    { key: 'external_id', label: 'ID SIGAD' },
    { key: 'nombre', label: 'Nombre' },
  ],
  classrooms: [
    { key: 'external_id', label: 'ID SIGAD' },
    { key: 'nombre_codigo', label: 'Código' },
    { key: 'capacidad', label: 'Capacidad' },
    { key: 'tipo', label: 'Tipo' },
  ],
  teachers: [
    { key: 'matricula_empleado', label: 'Matrícula' },
    { key: 'nombre_completo', label: 'Nombre completo' },
    { key: 'email_institucional', label: 'Email institucional' },
    { key: 'nivel_academico', label: 'Nivel académico' },
  ],
  users_created: [
    { key: 'identifier', label: 'Identifier' },
    { key: 'email', label: 'Email' },
    { key: 'correo_enviado', label: 'Correo enviado' },
  ],
  subjects: [
    { key: 'external_id', label: 'ID SIGAD' },
    { key: 'codigo_unico', label: 'Código' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'tipo_asignatura', label: 'Tipo' },
    { key: 'cuatrimestre_nombre', label: 'Cuatrimestre', fk: true, fkKey: 'quarter_id' },
    { key: 'programa_codigo', label: 'Programa', fk: true, fkKey: 'career_id' },
  ],
  sigad_groups: [
    { key: 'external_id', label: 'ID SIGAD' },
    { key: 'identificador', label: 'Identificador' },
    { key: 'nivel_academico', label: 'Nivel' },
    { key: 'programa_codigo', label: 'Programa', fk: true, fkKey: 'career_id' },
    { key: 'cuatrimestre_nombre', label: 'Cuatrimestre', fk: true, fkKey: 'quarter_id' },
  ],
  academic_groups: [
    { key: 'external_id', label: 'ID SIGAD' },
    { key: 'materia_nombre', label: 'Materia', fk: true, fkKey: 'subject_id' },
    { key: 'docente_nombre', label: 'Docente', fk: true, fkKey: 'teacher_id' },
    { key: 'grupo_identificador', label: 'Grupo SIGAD', fk: true, fkKey: 'sigad_group_id' },
    { key: 'aula_codigo', label: 'Aula', fk: true, fkKey: 'aula_id' },
    { key: 'periodo_codigo', label: 'Periodo', fk: true, fkKey: 'period_id' },
  ],
  assignment_schedules: [
    { key: 'academic_group_id', label: 'ID grupo' },
    { key: 'dia_semana', label: 'Día' },
    { key: 'hora_inicio', label: 'Hora inicio' },
    { key: 'hora_fin', label: 'Hora fin' },
    { key: 'materia_nombre', label: 'Materia' },
  ],
};

const SigadSync = () => {
  const { user } = useAuth(); 
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [expandedErrors, setExpandedErrors] = useState({});
  const [modalEntity, setModalEntity] = useState(null);
  const [modalFilter, setModalFilter] = useState('all');

  const toggleErrors = (key) => {
    setExpandedErrors(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSync = async () => {
    setLoading(true);
    setResultado(null);
    setError(null);
    try {
      const currentAdminId = user?.identifier || 'Sistema';

      const res = await client.post('/api/sync/sigad', {
        usuario_id: currentAdminId
      });
      
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

  const openModal = (key) => {
    setModalFilter('all');
    setModalEntity(key);
  };

  const closeModal = () => {
    setModalEntity(null);
  };

  const totalInserted = resultado ? Object.values(resultado).reduce((s, v) => s + (v.inserted || 0), 0) : 0;
  const totalUpdated = resultado ? Object.values(resultado).reduce((s, v) => s + (v.updated || 0), 0) : 0;
  const totalErrors = resultado ? Object.values(resultado).reduce((s, v) => s + (v.errors || 0), 0) : 0;
  const nuevosDocentes = resultado?.users_created?.nuevos_docentes ?? [];

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
              <p className="text-3xl font-bold text-green-600">{totalInserted}</p>
              <p className="text-sm text-green-700 mt-1 font-medium">Nuevos registros</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
              <p className="text-3xl font-bold text-amber-600">{totalUpdated}</p>
              <p className="text-sm text-amber-700 mt-1 font-medium">Actualizados</p>
            </div>
            <div className={`rounded-xl p-5 text-center border ${totalErrors > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`text-3xl font-bold ${totalErrors > 0 ? 'text-red-500' : 'text-gray-400'}`}>{totalErrors}</p>
              <p className={`text-sm mt-1 font-medium ${totalErrors > 0 ? 'text-red-700' : 'text-gray-500'}`}>Errores</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Entidad</th>
                  <th className="text-center px-4 py-3 font-semibold text-green-700">Nuevos</th>
                  <th className="text-center px-4 py-3 font-semibold text-amber-700">Actualizados</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-500">Sin cambios</th>
                  <th className="text-center px-4 py-3 font-semibold text-red-600">Errores</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(resultado).map(([key, val]) => {
                  const hasDetails = (val.inserted || 0) > 0 || (val.updated || 0) > 0;
                  return (
                    <React.Fragment key={key}>
                      <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-700">
                          {LABEL_MAP[key] || key}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {(val.inserted || 0) > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                              {val.inserted}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {(val.updated || 0) > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                              {val.updated}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {(val.unchanged || 0) > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                              {val.unchanged}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {(val.errors || 0) > 0 ? (
                            <button
                              onClick={() => toggleErrors(key)}
                              className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200 transition-colors cursor-pointer gap-1"
                            >
                              {val.errors}
                              {expandedErrors[key] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => openModal(key)}
                            disabled={!hasDetails}
                            className={`text-xs font-medium inline-flex items-center gap-1 transition-colors ${
                              hasDetails
                                ? 'text-indigo-600 hover:text-indigo-800 cursor-pointer'
                                : 'text-gray-300 cursor-not-allowed'
                            }`}
                          >
                            Ver detalle <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                      {expandedErrors[key] && val.error_details && val.error_details.length > 0 && (
                        <tr>
                          <td colSpan={6} className="px-5 py-3 bg-red-50">
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
                  );
                })}
              </tbody>
            </table>
          </div>

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

      {modalEntity && resultado?.[modalEntity] && (
        <EntityDetailModal
          entityKey={modalEntity}
          entityLabel={LABEL_MAP[modalEntity] || modalEntity}
          data={resultado[modalEntity]}
          columns={COLUMNS_MAP[modalEntity] || []}
          onClose={closeModal}
          filter={modalFilter}
          setFilter={setModalFilter}
        />
      )}
    </div>
  );
};

export default SigadSync;
