import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Info, CheckCircle, XCircle } from 'lucide-react';
import client from '../../lib/axios';
import { useAuth } from '../../hooks/AuthContext';


const CUATRIMESTRE_LABEL = {
  1: '1er', 2: '2do', 3: '3er', 4: '4to', 5: '5to',
  6: '6to', 7: '7mo', 8: '8vo', 9: '9no', 10: '10mo',
};

// ─── Helpers ───────────────────────────────────────────────
const getProgress = (p1, p2, p3) => {
  const hasValue = (v) => v !== '' && v !== null && v !== undefined;
  let percent = 0;
  if (hasValue(p1)) percent += (parseInt(p1, 10) / 10) * 30;
  if (hasValue(p2)) percent += (parseInt(p2, 10) / 10) * 30;
  if (hasValue(p3)) percent += (parseInt(p3, 10) / 10) * 40;
  percent = Math.round(percent);

  let color = 'bg-gray-200';
  if (percent > 0 && percent < 50)  color = 'bg-yellow-400';
  else if (percent >= 50 && percent < 70) color = 'bg-[#D99000]';
  else if (percent >= 70) color = 'bg-green-600';

  return { percent, color };
};

const getAverage = (p1, p2, p3) => {
  const hasValue = (v) => v !== '' && v !== null && v !== undefined;
  if (!hasValue(p1) && !hasValue(p2) && !hasValue(p3)) return '-';
  const val1 = hasValue(p1) ? parseInt(p1, 10) * 0.3 : 0;
  const val2 = hasValue(p2) ? parseInt(p2, 10) * 0.3 : 0;
  const val3 = hasValue(p3) ? parseInt(p3, 10) * 0.4 : 0;
  const exact = val1 + val2 + val3;
  if (hasValue(p1) && hasValue(p2) && hasValue(p3)) return Math.round(exact);
  return exact.toFixed(2);
};

const normalize = (v) => (v === null || v === undefined ? '' : v);

// ─── Component ─────────────────────────────────────────────
const Calificaciones = () => {
  const { user } = useAuth();

  // Justification catalog (from DB) — filtered (for dropdown) and all (for tooltips)
  const [justificaciones, setJustificaciones] = useState([]);
  const [allStatuses, setAllStatuses] = useState([]);

  // Periods
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [loadingPeriods, setLoadingPeriods] = useState(true);

  // All groups for this teacher
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Which group IDs are expanded
  const [expanded, setExpanded] = useState({});

  // Per-group data: { [groupId]: { loading, students, originalStudents, actaStatus } }
  const [groupData, setGroupData] = useState({});

  // Save / modal state
  const [savingGroupId, setSavingGroupId] = useState(null);
  const [modalGroupId, setModalGroupId] = useState(null);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [notification, setNotification] = useState(null); // { type: 'success'|'error', message: string }

  // Teacher internal ID (needed for audit log in save payload)
  const [teacherId, setTeacherId] = useState(null);

  // ── Fetch periods + justification catalog on mount ─────────
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [periodRes, statusRes, allStatusRes] = await Promise.all([
          client.get('/docente/periodos'),
          client.get('/docente/grade-statuses'),
          client.get('/docente/grade-statuses?all=true'),
        ]);
        setPeriods(periodRes.data);
        const active = periodRes.data.find(p => p.is_active);
        setSelectedPeriod(active ? active.period_name : periodRes.data[0]?.period_name ?? null);
        setJustificaciones(statusRes.data);
        setAllStatuses(allStatusRes.data);
      } catch (err) {
        console.error('Error cargando datos iniciales:', err);
      } finally {
        setLoadingPeriods(false);
      }
    };
    fetchInitialData();
  }, []);

  // ── Fetch teacher groups when period or user changes ───────
  useEffect(() => {
    if (!user?.identifier || !selectedPeriod) return;
    setLoadingGroups(true);
    setGroups([]);
    setExpanded({});
    setGroupData({});
    const fetchGroups = async () => {
      try {
        const res = await client.get(`/docente/${user.identifier}/grupos?periodo=${selectedPeriod}`);
        setGroups(res.data);
        if (res.data.length > 0) setTeacherId(res.data[0].teacher_id);
      } catch (err) {
        console.error('Error cargando grupos:', err);
      } finally {
        setLoadingGroups(false);
      }
    };
    fetchGroups();
  }, [user, selectedPeriod]);

  // ── Toggle expand / fetch students ────────────────────────
  const toggleGroup = async (groupId, actaStatus) => {
    const isOpen = !!expanded[groupId];
    setExpanded(prev => ({ ...prev, [groupId]: !isOpen }));

    if (!isOpen && !groupData[groupId]) {
      setGroupData(prev => ({
        ...prev,
        [groupId]: { loading: true, students: [], originalStudents: [], actaStatus },
      }));
      try {
        const res = await client.get(`/docente/grupos/${groupId}/alumnos`);
        const students = res.data.map(s => ({
          ...s,
          p1: normalize(s.p1),
          p2: normalize(s.p2),
          p3: normalize(s.p3),
        }));
        setGroupData(prev => ({
          ...prev,
          [groupId]: { loading: false, students, originalStudents: students, actaStatus },
        }));
      } catch (err) {
        console.error('Error cargando alumnos:', err);
        setGroupData(prev => ({
          ...prev,
          [groupId]: { loading: false, students: [], originalStudents: [], actaStatus },
        }));
      }
    }
  };

  // ── Grade change handler ───────────────────────────────────
  const handleChange = (groupId, matricula, pKey, value) => {
    if (value === '') {
      updateScore(groupId, matricula, pKey, '');
      return;
    }
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0 && num <= 10) updateScore(groupId, matricula, pKey, num);
  };

  const updateScore = (groupId, matricula, pKey, score) => {
    setGroupData(prev => ({
      ...prev,
      [groupId]: {
        ...prev[groupId],
        students: prev[groupId].students.map(s =>
          s.matricula === matricula ? { ...s, [pKey]: score } : s
        ),
      },
    }));
  };

  const handleKeyDown = (e) => {
    if (['.', ',', '-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
  };

  // ── Save logic ─────────────────────────────────────────────
  const handleSaveClick = (groupId) => {
    const { students, originalStudents } = groupData[groupId];
    const changes = [];

    students.forEach(student => {
      const orig = originalStudents.find(o => o.matricula === student.matricula);
      const check = (pKey, label) => {
        const origVal = orig[pKey];
        const newVal = student[pKey];
        if (origVal !== '' && origVal !== null && newVal !== '' && newVal !== null && origVal !== newVal) {
          changes.push({ id: `${student.matricula}-${pKey}`, name: student.nombre, partialName: label, oldVal: origVal, newVal, code: '' });
        }
      };
      check('p1', '1er Parcial');
      check('p2', '2do Parcial');
      check('p3', '3er Parcial');
    });

    if (changes.length > 0) {
      setPendingChanges(changes);
      setModalGroupId(groupId);
    } else {
      executeBulkSave(groupId, []);
    }
  };

  const executeBulkSave = async (groupId, justifications) => {
    setSavingGroupId(groupId);
    const { students, originalStudents } = groupData[groupId];

    try {
      const payload = {
        docente_id: teacherId || 0,
        students: students.map(s => {
          const orig = originalStudents.find(o => o.matricula === s.matricula);
          const getJust = (pKey) => justifications.find(j => j.id === `${s.matricula}-${pKey}`);
          const resolveStatus = (pKey, sKey) => {
            const just = getJust(pKey);
            if (just) return just.code;
            const isNew = s[pKey] !== '' && s[pKey] !== null && (orig[pKey] === '' || orig[pKey] === null);
            return isNew ? 'OE' : (s[sKey] || 'OE');
          };

          return {
            student_matricula: s.matricula,
            parcial_1: s.p1 === '' ? null : parseInt(s.p1, 10),
            status_parcial_1: resolveStatus('p1', 's1'),
            parcial_2: s.p2 === '' ? null : parseInt(s.p2, 10),
            status_parcial_2: resolveStatus('p2', 's2'),
            parcial_3: s.p3 === '' ? null : parseInt(s.p3, 10),
            status_parcial_3: resolveStatus('p3', 's3'),
          };
        }),
      };

      const res = await client.put(`/docente/grupos/${groupId}/calificaciones`, payload);

      const updated = students.map(s => {
        const ps = payload.students.find(p => p.student_matricula === s.matricula);
        return { ...s, s1: ps.status_parcial_1, s2: ps.status_parcial_2, s3: ps.status_parcial_3 };
      });

      setGroupData(prev => ({
        ...prev,
        [groupId]: { ...prev[groupId], students: updated, originalStudents: updated },
      }));

      setNotification({ type: 'success', message: res.data.message });
    } catch (error) {
      console.error('Error guardando calificaciones:', error);
      setNotification({ type: 'error', message: error.response?.data?.detail || 'Ocurrió un error al conectar con el servidor.' });
    } finally {
      setSavingGroupId(null);
      setModalGroupId(null);
    }
  };

  // ── Period active check ───────────────────────────────────
  const isPeriodActive = periods.find(p => p.period_name === selectedPeriod)?.is_active ?? false;

  // ── Group groups by cuatrimestre ──────────────────────────
  const byCuatrimestre = groups.reduce((acc, g) => {
    const q = g.cuatrimestre;
    if (!acc[q]) acc[q] = [];
    acc[q].push(g);
    return acc;
  }, {});
  const cuatrimestres = Object.keys(byCuatrimestre).sort((a, b) => a - b);

  // ── Render helpers ────────────────────────────────────────
  const renderBadge = (status) => {
    if (!status) return (
      <span className="text-[10px] text-gray-300 border border-dashed border-gray-300 px-2 py-0.5 rounded-full">Sin captura</span>
    );
    const label = allStatuses.find(j => j.code === status)?.label;
    return (
      <span className="relative group inline-flex">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-help ${status === 'OE' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
          {status}
        </span>
        {label && (
          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-none z-10">
            {status} – {label}
          </span>
        )}
      </span>
    );
  };

  const renderPartialCell = (groupId, student, pKey, sKey, isReadOnly) => (
    <td className="py-4 px-2 border-l border-gray-100">
      <div className="flex justify-center items-center gap-4">
        <input
          type="number"
          value={student[pKey]}
          disabled={isReadOnly}
          onKeyDown={handleKeyDown}
          onChange={(e) => handleChange(groupId, student.matricula, pKey, e.target.value)}
          className="w-12 h-8 text-center border border-gray-300 rounded focus:ring-2 focus:ring-[#D99000] outline-none font-semibold text-sm disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
        />
        <div className="w-16 flex justify-center">
          {renderBadge(student[pKey] !== '' && student[pKey] !== null ? student[sKey] : null)}
        </div>
      </div>
    </td>
  );

  // ── Main render ───────────────────────────────────────────
  if (loadingPeriods) {
    return (
      <div className="p-8 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans flex items-center justify-center">
        <p className="text-gray-500">Cargando periodos...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans">

      {/* Period selector */}
      <div className="mb-8 flex items-center gap-4 flex-wrap">
        <label className="text-sm font-semibold text-gray-700">Periodo:</label>
        <select
          value={selectedPeriod ?? ''}
          onChange={e => setSelectedPeriod(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-800 focus:ring-2 focus:ring-[#1A237E] outline-none shadow-sm"
        >
          {periods.map(p => (
            <option key={p.period_name} value={p.period_name}>{p.period_name}</option>
          ))}
        </select>
        {periods.find(p => p.period_name === selectedPeriod)?.is_active && (
          <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-full border border-green-200">
            Periodo actual
          </span>
        )}
      </div>

      {/* Periodo inactivo — banner global */}
      {!loadingPeriods && selectedPeriod && !isPeriodActive && (
        <div className="mb-6 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 flex items-center gap-3 text-amber-800">
          <Info size={16} className="shrink-0" />
          <p className="text-sm font-medium">
            Estás viendo el periodo <strong>{selectedPeriod}</strong>, el cual no es el activo. Solo puedes consultar las calificaciones.
          </p>
        </div>
      )}

      {loadingGroups ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">Cargando grupos...</p>
        </div>
      ) : groups.length === 0 ? (
        <p className="text-gray-500">No tienes grupos asignados para el periodo {selectedPeriod}.</p>
      ) : (
        <>
          {cuatrimestres.map(q => (
        <div key={q} className="mb-8">
          <h1 className="text-xl font-bold text-[#0B172A] mb-6">
            {CUATRIMESTRE_LABEL[Number(q)] || q}° Cuatrimestre
          </h1>

          {byCuatrimestre[q].map(group => {
            const isOpen = !!expanded[group.group_id];
            const gd = groupData[group.group_id];
            const isReadOnly = !isPeriodActive || gd?.actaStatus === 'cerrada' || gd?.actaStatus === 'generada';
            const isSaving = savingGroupId === group.group_id;
            const hasChanges = gd?.students?.some(s => {
              const orig = gd.originalStudents?.find(o => o.matricula === s.matricula);
              return orig && (s.p1 !== orig.p1 || s.p2 !== orig.p2 || s.p3 !== orig.p3);
            }) ?? false;
            const hasInvalidClear = gd?.students?.some(s => {
              const orig = gd.originalStudents?.find(o => o.matricula === s.matricula);
              if (!orig) return false;
              const cleared = (origVal, curVal) =>
                origVal !== '' && origVal !== null && (curVal === '' || curVal === null);
              return cleared(orig.p1, s.p1) || cleared(orig.p2, s.p2) || cleared(orig.p3, s.p3);
            }) ?? false;

            return (
              <div key={group.group_id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.group_id, group.acta_status)}
                  className="w-full p-4 flex items-center justify-between border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#0B172A] text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                      {group.identificador_grupo}
                    </div>
                    <div className="text-left">
                      <h2 className="text-sm font-bold text-[#0B172A]">{group.subject_nombre}</h2>
                      <p className="text-xs text-gray-500">{group.horario}</p>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="text-gray-400 shrink-0" /> : <ChevronDown className="text-gray-400 shrink-0" />}
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <>
                    {isReadOnly && (gd?.actaStatus === 'cerrada' || gd?.actaStatus === 'generada') && (
                      <div className="mx-4 mt-4 bg-red-50 border-l-4 border-red-600 p-4 rounded-r-lg flex gap-3 text-red-800">
                        <Info className="shrink-0" size={16} />
                        <p className="text-sm">
                          <strong>Modo Solo Lectura:</strong>{' '}
                          {`El acta de este grupo está en estado "${gd?.actaStatus}".`}
                        </p>
                      </div>
                    )}

                    {gd?.loading ? (
                      <div className="p-8 text-center text-gray-400 text-sm">Cargando alumnos...</div>
                    ) : gd?.students.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-sm">No hay alumnos inscritos en este grupo.</div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                              <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-100">
                                <th className="py-4 px-6 w-12 text-center">#</th>
                                <th className="py-4 px-6 min-w-[200px]">Alumno</th>
                                {['1er Parcial (30%)', '2do Parcial (30%)', '3er Parcial (40%)'].map((title, idx) => (
                                  <th key={idx} className="py-4 px-2 text-center border-l border-gray-100">
                                    <div className="mb-1 text-black">{title}</div>
                                    <div className="flex justify-center gap-6 text-[10px]">
                                      <span className="w-12 text-center">Cal.</span>
                                      <span className="w-16 text-center">Estado</span>
                                    </div>
                                  </th>
                                ))}
                                <th className="py-4 px-6 text-center border-l border-gray-100 w-24 text-black">Prom.</th>
                                <th className="py-4 px-6 w-32 text-black">Avance</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {gd.students.map((student, index) => {
                                const progress = getProgress(student.p1, student.p2, student.p3);
                                return (
                                  <tr key={student.matricula} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="py-4 px-6 text-sm text-gray-400 text-center">{index + 1}</td>
                                    <td className="py-4 px-6 text-sm text-gray-700 font-medium">{student.nombre}</td>
                                    {renderPartialCell(group.group_id, student, 'p1', 's1', isReadOnly)}
                                    {renderPartialCell(group.group_id, student, 'p2', 's2', isReadOnly || student.p1 === '' || student.p1 === null || student.p1 === undefined)}
                                    {renderPartialCell(group.group_id, student, 'p3', 's3', isReadOnly || student.p2 === '' || student.p2 === null || student.p2 === undefined)}
                                    <td className="py-4 px-6 text-center font-bold text-gray-800 border-l border-gray-100">
                                      {getAverage(student.p1, student.p2, student.p3)}
                                    </td>
                                    <td className="py-4 px-6">
                                      <div className="flex items-center gap-3">
                                        <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                          <div className={`h-full rounded-full transition-all duration-500 ${progress.color}`} style={{ width: `${progress.percent}%` }} />
                                        </div>
                                        <span className="text-xs text-gray-500">{progress.percent}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="bg-white p-6 border-t border-gray-100 flex justify-between items-center">
                          <span className="text-sm text-gray-500">
                            {gd.students.filter(s => s.p1 !== '' || s.p2 !== '' || s.p3 !== '').length}/{gd.students.length} alumnos capturados
                          </span>
                          <button
                            onClick={() => handleSaveClick(group.group_id)}
                            disabled={isReadOnly || isSaving || !hasChanges || hasInvalidClear}
                            className="px-6 py-2.5 bg-[#D99000] hover:bg-[#B37700] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded shadow-sm flex items-center gap-2 transition-colors text-sm"
                          >
                            {isSaving ? 'Guardando...' : 'Guardar cambios'}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
          ))}
        </>
      )}

      {/* Notification modal */}
      {notification && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className={`p-5 text-white ${notification.type === 'success' ? 'bg-[#0B172A]' : 'bg-red-700'}`}>
              <div className="flex items-center gap-3">
                {notification.type === 'success'
                  ? <CheckCircle size={22} className="shrink-0 text-[#D99000]" />
                  : <XCircle size={22} className="shrink-0 text-red-300" />
                }
                <h2 className="font-bold text-lg">
                  {notification.type === 'success' ? '¡Operación exitosa!' : 'Ocurrió un error'}
                </h2>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-700">{notification.message}</p>
            </div>
            <div className="px-6 pb-5 flex justify-end">
              <button
                onClick={() => setNotification(null)}
                className="px-6 py-2.5 bg-[#D99000] hover:bg-[#B37700] text-white font-bold rounded shadow-sm text-sm transition-colors"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Justification modal */}
      {modalGroupId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-[#0B172A] p-5 text-white">
              <h2 className="font-bold text-lg">Justificación de edición</h2>
              <p className="text-sm text-slate-300 mt-1">Asigna el motivo para cada calificación modificada</p>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {pendingChanges.map((change, idx) => (
                <div key={change.id} className={`mb-4 pb-4 ${idx !== pendingChanges.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-sm text-[#0B172A]">{change.name}</span>
                    <span className="text-xs text-gray-500">
                      {change.partialName}: <span className="line-through mx-1">{change.oldVal}</span> → <span className="text-[#D99000] font-bold">{change.newVal}</span>
                    </span>
                  </div>
                  <select
                    value={change.code}
                    onChange={(e) => setPendingChanges(prev => prev.map(c => c.id === change.id ? { ...c, code: e.target.value } : c))}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#0B172A] outline-none"
                  >
                    <option value="" disabled>Selecciona un motivo...</option>
                    {justificaciones.map(j => (
                      <option key={j.code} value={j.code}>{j.code} - {j.label}</option>
                    ))}
                  </select>
                </div>
              ))}
              <div className="bg-blue-50 text-blue-700 p-3 rounded flex gap-2 items-start mt-6">
                <Info size={16} className="mt-0.5 shrink-0" />
                <p className="text-xs">Cada motivo se registrará en el historial de auditoría de manera permanente.</p>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex gap-3 justify-end bg-gray-50">
              <button
                onClick={() => setModalGroupId(null)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-semibold rounded text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => executeBulkSave(modalGroupId, pendingChanges)}
                disabled={pendingChanges.some(c => c.code === '') || !!savingGroupId}
                className="px-4 py-2 bg-[#D99000] disabled:bg-[#D99000]/50 text-white font-bold rounded text-sm hover:bg-[#B37700] transition-colors"
              >
                {savingGroupId ? 'Procesando...' : 'Confirmar y guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calificaciones;
