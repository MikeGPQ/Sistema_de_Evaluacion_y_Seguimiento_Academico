import React, { useState, useEffect, useRef } from 'react';
import { Download, BookOpen, ChevronDown, Loader2, CheckCircle, XCircle, CalendarDays, AlertTriangle } from 'lucide-react';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import client from '../../lib/axios'; 
import { useAuth } from '../../hooks/AuthContext'; 

const ATTENDANCE_STATES = {
  P: { label: '✓', color: 'text-green-600', bg: 'bg-green-50 border-green-200', desc: 'Presente' },
  F: { label: 'X', color: 'text-red-600', bg: 'bg-red-50 border-red-200', desc: 'Falta' },
  R: { label: 'R', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', desc: 'Retardo' },
  J: { label: 'J', color: 'text-slate-600', bg: 'bg-slate-100 border-slate-300', desc: 'Justificado' }
};

const formatMonthDate = (dateStr) => {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parseInt(parts[2], 10)} ${months[parseInt(parts[1], 10) - 1]}`;
};

const StudentAttendance = () => {
  const { user } = useAuth(); 
  
  const studentId = user?.matricula || user?.identifier || user?.username || '';

  const [periodsList, setPeriodsList] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);

  const [subjectsList, setSubjectsList] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  
  const periodDropdownRef = useRef(null);
  const subjectDropdownRef = useRef(null);

  const todayDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Merida', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const resPeriods = await client.get('/asistencia/periodos');
        setPeriodsList(resPeriods.data);
        const activePeriod = resPeriods.data.find(p => p.is_active) || resPeriods.data[0];
        if (activePeriod) {
          setSelectedPeriod(activePeriod.id);
        } else {
          setIsLoading(false);
        }
      } catch (error) { 
        console.error("Error loading periods", error); 
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!selectedPeriod || !studentId) return;

    const fetchSubjectsData = async () => {
      setIsLoading(true);
      try {
        const response = await client.get(`/asistencia/student/subjects?student_id=${studentId}&period=${selectedPeriod}`);
        setSubjectsList(response.data);
        if (response.data.length > 0) {
          setSelectedSubject(response.data[0]);
        } else {
          setSelectedSubject(null);
        }
      } catch (error) {
        Swal.fire('Error', 'No se pudieron cargar tus materias.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSubjectsData();
  }, [selectedPeriod, studentId]);

  useEffect(() => {
    const handleClickOutside = (e) => { 
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(e.target)) setIsPeriodDropdownOpen(false);
      if (subjectDropdownRef.current && !subjectDropdownRef.current.contains(e.target)) setIsSubjectDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  let globalAttendances = 0;
  let globalAbsences = 0;
  
  if (selectedSubject) {
    selectedSubject.classDates.forEach(date => {
      if (date <= todayDate) {
        const state = selectedSubject.attendanceData[date];
        if (state === 'F') globalAbsences++;
        if (state === 'P') globalAttendances++;
      }
    });
  }

  const showJustification = (date) => {
    const reason = selectedSubject.justifications?.[date];
    if (reason) {
      Swal.fire({ title: 'Justificación', text: reason, icon: 'info', confirmButtonColor: '#1A237E' });
    }
  };

  const handleExportPDF = () => {
    if (!selectedSubject) return;
    try {
      // 🌟 CAMBIO 1: Formato Vertical (Portrait) por defecto en 'p'
      const doc = new jsPDF('p', 'mm', 'a4'); 
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Header Oficial UNID adaptado a vertical
      doc.setFillColor(11, 23, 42); doc.rect(14, 15, 12, 12, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text("U", 20, 23.5, { align: "center" }); 
      
      doc.setTextColor(26, 35, 126); doc.setFontSize(16); doc.text("UNID", 30, 20);
      doc.setFontSize(9); doc.setTextColor(100); doc.setFont("helvetica", "normal"); doc.text("SISTEMA ACADÉMICO SESA", 30, 24);
      
      doc.setTextColor(26, 35, 126); doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("REPORTE DE ASISTENCIA", pageWidth - 14, 20, { align: "right" });
      doc.setFontSize(10); doc.setTextColor(100); doc.setFont("helvetica", "normal"); doc.text("Historial Individual", pageWidth - 14, 25, { align: "right" });

      doc.setDrawColor(242, 169, 0); doc.setLineWidth(0.5); doc.line(14, 30, pageWidth - 14, 30);
      
      // 🌟 CAMBIO 2: Distribución de datos en bloques
      doc.setFontSize(8); doc.setTextColor(150); doc.setFont("helvetica", "bold");
      doc.text("ALUMNO", 14, 38); doc.text("MATRÍCULA", 110, 38); doc.text("PERIODO", 160, 38);
      
      doc.setTextColor(50); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text(selectedSubject.studentName.toUpperCase(), 14, 43);
      doc.text(studentId, 110, 43);
      doc.text(selectedPeriod, 160, 43);

      doc.setFontSize(8); doc.setTextColor(150); doc.setFont("helvetica", "bold");
      doc.text("MATERIA", 14, 52); doc.text("GRUPO", 110, 52); doc.text("DOCENTE", 140, 52);

      doc.setTextColor(50); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text(selectedSubject.subjectName.toUpperCase(), 14, 57);
      doc.text(selectedSubject.groupCode, 110, 57);
      doc.text(selectedSubject.teacherName.toUpperCase(), 140, 57);

      // Resumen Global de Faltas
      doc.setFillColor(248, 249, 250); doc.rect(14, 63, pageWidth - 28, 10, 'F');
      doc.setFontSize(9); doc.setTextColor(100); doc.setFont("helvetica", "bold");
      doc.text("TOTAL DE ASISTENCIAS:", 18, 70); 
      doc.setTextColor(34, 197, 94); doc.text(globalAttendances.toString(), 62, 70); // Verde
      doc.setTextColor(100); doc.text("FALTAS ACUMULADAS:", 80, 70); 
      doc.setTextColor(239, 68, 68); doc.text(globalAbsences.toString(), 122, 70); // Rojo
      doc.setTextColor(100); doc.text(`FECHA DE CORTE: ${new Date().toLocaleDateString('es-ES')}`, 140, 70);

    
      const tableColumn = ["N° SESIÓN", "FECHA", "ESTADO"];
      
      const tableRows = selectedSubject.classDates.map((date, idx) => {
        const status = selectedSubject.attendanceData[date] || '-';
        // Solo retornamos los 3 datos limpios
        return [`Sesión ${idx + 1}`, formatMonthDate(date), status];
      });

      autoTable(doc, {
        head: [tableColumn], body: tableRows, startY: 78, theme: 'plain',
        margin: { bottom: 25, top: 15, left: 14, right: 14 }, 
        styles: { fontSize: 10, cellPadding: 4, textColor: [50, 50, 50] }, // Letra un poco más grande
        headStyles: { fillColor: [248, 249, 250], textColor: [26, 35, 126], fontStyle: 'bold', lineWidth: 0.1, lineColor: [220, 220, 220], halign: 'center', valign: 'middle' },
        bodyStyles: { lineWidth: 0.1, lineColor: [230, 230, 230], valign: 'middle' },
        columnStyles: { 
          // Repartimos el ancho matemáticamente para que llene la hoja (50mm + 66mm + 66mm = 182mm útiles)
          0: { fontStyle: 'bold', cellWidth: 50, halign: 'center' }, 
          1: { cellWidth: 66, halign: 'center', fontStyle: 'bold', textColor: [26, 35, 126] }, 
          2: { cellWidth: 66, halign: 'center' } 
        },
        didParseCell: function (data) {
          if (data.section === 'body' && data.column.index === 2) {
            const rawVal = data.cell.raw;
            if (rawVal === 'P') { 
              data.cell.text = ['4']; data.cell.styles.font = 'zapfdingbats'; data.cell.styles.textColor = [34, 197, 94]; data.cell.styles.fontSize = 12; 
            } else if (rawVal === 'F') { 
              data.cell.text = ['8']; data.cell.styles.font = 'zapfdingbats'; data.cell.styles.textColor = [239, 68, 68]; data.cell.styles.fontSize = 12; 
            } else if (rawVal === 'R' || rawVal === 'J') { 
              data.cell.styles.textColor = [100, 100, 100]; data.cell.styles.fillColor = [245, 245, 245]; data.cell.styles.fontStyle = 'bold';
            } else if (rawVal === '-') { 
              data.cell.styles.textColor = [200, 200, 200]; 
            }
          }
        },
        didDrawPage: function (data) {
          const footerY = pageHeight - 15;
          doc.setFontSize(9); 
          doc.setFont("zapfdingbats"); doc.setTextColor(34, 197, 94); doc.text("4", 14, footerY); 
          doc.setFont("helvetica", "normal"); doc.setTextColor(150); doc.text(" Asistencia", 18, footerY);
          doc.setFont("zapfdingbats"); doc.setTextColor(239, 68, 68); doc.text("8", 40, footerY); 
          doc.setFont("helvetica", "normal"); doc.setTextColor(150); doc.text(" Falta", 44, footerY);
          doc.setFont("helvetica", "bold"); doc.setTextColor(150); doc.text("R", 60, footerY);
          doc.setFont("helvetica", "normal"); doc.text(" Retardo", 64, footerY);
          doc.setFont("helvetica", "bold"); doc.text("J", 82, footerY);
          doc.setFont("helvetica", "normal"); doc.text(" Justificante", 86, footerY);
          
          doc.setTextColor(150);
          doc.text(`ID: COMP-${studentId}-${selectedSubject.groupCode}`, pageWidth - 14, footerY, { align: 'right' });
          doc.text(`Página ${data.pageNumber}`, pageWidth - 14, footerY + 5, { align: 'right' });
        }
      });

      doc.save(`Historial_Asistencia_${selectedSubject.groupCode}.pdf`);
    } catch (error) { Swal.fire('Error', 'No se pudo generar el documento PDF.', 'error'); }
  };
  return (
    <div className="min-h-screen bg-[#F8F9FA] p-6 font-sans relative">
      <div className="max-w-[1200px] mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative z-10">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b pb-6">
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            
            <div className="flex flex-col relative z-40" ref={periodDropdownRef}>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Periodo</label>
              <div onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)} className={`relative flex items-center justify-between w-[150px] h-[38px] px-3 py-2 border rounded-lg text-sm bg-white font-bold cursor-pointer transition-all ${isPeriodDropdownOpen ? 'border-[#1A237E] ring-2 ring-[#1A237E]/20 text-[#1A237E]' : 'border-gray-300 text-gray-800'}`}>
                <span className="truncate">{selectedPeriod || "Cargando..."}</span>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isPeriodDropdownOpen ? 'rotate-180 text-[#1A237E]' : ''}`} />
              </div>
              <div className={`absolute top-full mt-1.5 w-[180px] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden transition-all duration-200 origin-top ${isPeriodDropdownOpen ? 'opacity-100 scale-y-100 visible' : 'opacity-0 scale-y-95 invisible'}`}>
                {periodsList.map(opt => (
                  <div key={opt.id} onClick={() => { setSelectedPeriod(opt.id); setIsPeriodDropdownOpen(false); }} className={`px-4 py-3 text-sm cursor-pointer border-b border-gray-50 ${selectedPeriod === opt.id ? 'bg-blue-50 text-[#1A237E] font-bold' : 'text-gray-700 hover:bg-gray-50'}`}>
                    {opt.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col relative z-30" ref={subjectDropdownRef}>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Mis Materias</label>
              <div onClick={() => setIsSubjectDropdownOpen(!isSubjectDropdownOpen)} className={`relative flex items-center justify-between w-[280px] h-[38px] px-3 py-2 border rounded-lg text-sm bg-white font-bold cursor-pointer transition-all ${isSubjectDropdownOpen ? 'border-[#1A237E] ring-2 ring-[#1A237E]/20 text-[#1A237E]' : 'border-gray-300 text-gray-800'}`}>
                <div className="flex items-center gap-2 truncate">
                  <BookOpen className={`w-4 h-4 flex-shrink-0 ${isSubjectDropdownOpen ? 'text-[#1A237E]' : 'text-gray-400'}`} />
                  <span className="truncate">{subjectsList.length === 0 ? "Sin materias" : selectedSubject?.subjectName || "Seleccione"}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isSubjectDropdownOpen ? 'rotate-180 text-[#1A237E]' : ''}`} />
              </div>
              <div className={`absolute top-full mt-1.5 w-full min-w-[300px] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden transition-all duration-200 origin-top ${isSubjectDropdownOpen ? 'opacity-100 scale-y-100 visible' : 'opacity-0 scale-y-95 invisible'}`}>
                {subjectsList.length === 0 && <div className="p-3 text-sm text-gray-500 text-center">No estás inscrito a materias</div>}
                {subjectsList.map((m, i) => (
                  <div key={i} onClick={() => { setSelectedSubject(m); setIsSubjectDropdownOpen(false); }} className={`px-4 py-3 text-sm cursor-pointer border-b border-gray-50 ${selectedSubject?.subjectName === m.subjectName ? 'bg-blue-50 text-[#1A237E] font-bold' : 'text-gray-700 hover:bg-gray-50'}`}>
                    {m.subjectName}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col opacity-70">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Corte</label>
              <div className="h-[38px] px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-500 font-bold flex items-center cursor-not-allowed">
                Cuatrimestre Completo
              </div>
            </div>
          </div>
          
          <div className="flex flex-col shrink-0 mt-2 md:mt-0">
            <label className="text-[11px] font-bold text-transparent uppercase tracking-wider mb-1 hidden md:block">.</label>
            <button onClick={handleExportPDF} disabled={!selectedSubject} className="h-[38px] flex items-center px-5 py-2 bg-[#1A237E] text-white rounded-lg text-sm font-bold hover:bg-[#283593] transition-colors shadow-sm disabled:opacity-50">
              <Download className="w-4 h-4 mr-2" /> Descargar PDF
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#1A237E]">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p className="font-bold">Cargando tu información académica...</p>
          </div>
        ) : !selectedSubject ? (
          <div className="py-20 text-center">
            <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-bold text-lg">No hay información de asistencia para mostrar.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white border border-gray-200 p-5 rounded-xl flex justify-between items-center shadow-sm">
                <div><p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Total de Sesiones</p><p className="text-3xl font-black text-gray-800">{selectedSubject.classDates.length}</p></div>
                <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600"><CalendarDays className="w-7 h-7" /></div>
              </div>
              <div className="bg-white border border-green-100 p-5 rounded-xl flex justify-between items-center shadow-sm">
                <div><p className="text-xs text-green-600/70 font-bold uppercase tracking-wider mb-1">Asistencias</p><p className="text-3xl font-black text-green-600">{globalAttendances}</p></div>
                <div className="bg-green-50 p-3 rounded-xl text-green-500"><CheckCircle className="w-7 h-7" /></div>
              </div>
              <div className="bg-white border border-red-100 p-5 rounded-xl flex justify-between items-center shadow-sm">
                <div><p className="text-xs text-red-600/70 font-bold uppercase tracking-wider mb-1">Faltas Acumuladas</p><p className="text-3xl font-black text-red-600">{globalAbsences}</p></div>
                <div className="bg-red-50 p-3 rounded-xl text-red-500"><XCircle className="w-7 h-7" /></div>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-bold text-[#1A237E]">Detalle por Día</h3>
              <p className="text-sm text-gray-500">Docente: {selectedSubject.teacherName}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {selectedSubject.classDates.map((date, idx) => {
                const isFutureDate = date > todayDate;
                const visualState = selectedSubject.attendanceData[date];
                
                if (isFutureDate || !visualState) {
                  return (
                    <div key={date} className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col items-center justify-center opacity-60">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Sesión {idx + 1}</span>
                      <span className="text-xs font-black text-gray-500 mb-2">{formatMonthDate(date)}</span>
                      <div className="w-6 h-6 rounded flex items-center justify-center bg-gray-100 text-gray-400 font-bold text-xs">-</div>
                    </div>
                  );
                }

                const styleDefinition = ATTENDANCE_STATES[visualState];

                return (
                  <div key={date} className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col items-center shadow-sm hover:shadow-md transition-shadow relative">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Sesión {idx + 1}</span>
                    <span className="text-xs font-black text-[#1A237E] mb-2">{formatMonthDate(date)}</span>
                    
                    <div 
                      onClick={() => visualState === 'J' ? showJustification(date) : null}
                      className={`w-8 h-8 flex items-center justify-center font-bold text-sm rounded border ${styleDefinition.bg} ${styleDefinition.color} ${visualState === 'J' ? 'cursor-pointer hover:ring-2 ring-slate-300' : ''}`}
                      title={visualState === 'J' ? 'Ver motivo de justificación' : styleDefinition.desc}
                    >
                      {styleDefinition.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StudentAttendance;