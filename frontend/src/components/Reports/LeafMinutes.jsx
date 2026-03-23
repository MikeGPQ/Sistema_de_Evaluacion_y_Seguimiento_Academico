import React from 'react';
import { AlertCircle, Users } from 'lucide-react';

const LeafMinutes = ({ pageId, actaData, alumnosChunk, startIndex, isFirstPage, isLastPage, pageIndex, totalPages, folio, fecha }) => {
  return (
    <div className="bg-white shadow-2xl mb-8 border border-gray-300 mx-auto print:shadow-none print:border-none w-[816px] shrink-0">
      
      {/* CONTENEDOR DE LA HOJA */}
      <div 
        id={pageId} 
        className="bg-white text-black flex flex-col" 
        style={{ width: '816px', height: '1056px', padding: '48px', boxSizing: 'border-box', margin: '0 auto', overflow: 'hidden' }}
      >
        
        {/* ==================== ZONA SUPERIOR ==================== */}
        <div className="w-full shrink-0">
          
          {/* ENCABEZADO */}
          <div className="flex justify-between items-start mb-6 pb-4 border-b-4 border-[#ffc400]">
            <div className="flex items-center gap-4">
              <div className="flex bg-[#000000] text-white font-black text-4xl items-center justify-center w-14 h-16 shadow-sm">
                U
              </div>
              <div>
                <h2 className="text-3xl font-black text-[#0d0d0e] tracking-wide leading-none m-0 mb-1">UNID</h2>
                <p className="text-[10px] text-[#151616] font-bold tracking-widest uppercase leading-tight m-0">
                  UNIVERSIDAD INTERAMERICANA<br/>PARA EL DESARROLLO
                </p>
              </div>
            </div>
            <div className="text-right text-[#1a1b1b]">
              <h1 className="text-2xl font-black uppercase leading-none tracking-wide m-0 mb-1">ACTA OFICIAL DE</h1>
              <h1 className="text-2xl font-black uppercase leading-tight tracking-wide m-0">CALIFICACIONES FINALES</h1>
              <p className="text-[10px] font-bold text-gray-500 mt-2 uppercase tracking-widest m-0">DOCUMENTO OFICIAL HU-28</p>
            </div>
          </div>

          {/* DATOS DE LA MATERIA  */}
          {isFirstPage && (
            <div className="grid bg-gray-50 border border-gray-200 rounded-lg p-5 grid-cols-2 gap-x-12 gap-y-3 mb-6 text-sm shadow-sm">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">CARRERA</span>
                <span className="font-bold text-gray-900 border-b border-gray-300 pb-0.5">{actaData.carrera}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">CÓDIGO DE MATERIA</span>
                <span className="font-bold text-gray-900 border-b border-gray-300 pb-0.5">{actaData.codigo_materia}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">CAMPUS</span>
                <span className="font-bold text-gray-900 border-b border-gray-300 pb-0.5">{actaData.campus}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">CUATRIMESTRE</span>
                <span className="font-bold text-gray-900 border-b border-gray-300 pb-0.5">{actaData.cuatrimestre}° Cuatrimestre</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">PERIODO</span>
                <span className="font-bold text-gray-900 border-b border-gray-300 pb-0.5">{actaData.periodo}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">GRUPO</span>
                <span className="font-bold text-gray-900 border-b border-gray-300 pb-0.5">{actaData.grupo}</span>
              </div>
              <div className="flex flex-col col-span-2 mt-1">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">MATERIA</span>
                <span className="font-bold text-gray-900 border-b border-gray-300 pb-0.5">{actaData.materia_nombre}</span>
              </div>
              <div className="flex flex-col col-span-2 mt-1">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">DOCENTE</span>
                <span className="font-bold text-gray-900 border-b border-gray-300 pb-0.5">{actaData.docente_nombre}</span>
              </div>
            </div>
          )}

          {/* TABLA DE ALUMNOS */}
          {alumnosChunk.length > 0 && (
            <table className="w-full text-sm text-left border-collapse mb-5">
              <thead className="bg-[#E5E7EB] text-gray-700 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-2 px-4 text-center border border-gray-300 w-12 font-bold">No.</th>
                  <th className="py-2 px-5 border border-gray-300 w-36 font-bold">Matrícula</th>
                  <th className="py-2 px-5 border border-gray-300 font-bold">Nombre del Alumno</th>
                  <th className="py-2 px-4 text-center border border-gray-300 w-36 font-bold bg-[#FEF9C3]">Calificación<br/>Final</th>
                </tr>
              </thead>
              <tbody>
                {alumnosChunk.map((alumno, idx) => {
                  const numLista = startIndex + idx + 1;
                  return (
                    <tr key={alumno.matricula} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-200`}>
                      <td className="py-2 px-4 text-center font-mono text-gray-500 text-xs border-x border-gray-200">{(numLista).toString().padStart(2, '0')}</td>
                      <td className="py-2 px-5 font-mono font-bold text-gray-700 border-r border-gray-200">{alumno.matricula}</td>
                      <td className="py-2 px-5 font-bold text-gray-800 uppercase border-r border-gray-200 text-xs">{alumno.nombre}</td>
                      <td className="py-2 px-4 text-center font-black text-base text-[#00205B] border-r border-gray-200 bg-[#FFFEF9]">
                        {alumno.calificacion_final !== null ? alumno.calificacion_final : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* AVISO LEGAL Y TOTALES  */}
          {isLastPage && (
            <div className="mb-2">
              <div className="flex justify-end mb-4 text-[#00205B]">
                <p className="font-bold text-sm bg-gray-50 px-5 py-2 rounded border border-gray-300 shadow-sm m-0">
                  Total de alumnos: <span className="font-black text-lg ml-2">{actaData.alumnos.length}</span>
                </p>
              </div>
              <div className="bg-gray-50 border-l-4 border-[#ffc400] p-4 flex items-center gap-4 rounded-r-md shadow-sm">
                <AlertCircle className="w-5 h-5 text-[#020202] shrink-0" />
                <p className="text-[8px] text-justify text-gray-700 leading-relaxed font-bold uppercase tracking-wide m-0">
                  AL GENERAR LA PRESENTE ACTA, LAS CALIFICACIONES AQUÍ PLASMADAS QUEDAN CERRADAS OFICIALMENTE EN EL SISTEMA Y NO PODRÁN SER MODIFICADAS POSTERIORMENTE SIN UNA SOLICITUD FORMAL ANTE EL CONSEJO ACADÉMICO.
                </p>
              </div>
            </div>
          )}
          
        </div>

        
        {/* Separa el contenido de arriba con las firmas de abajo */}
        <div className="flex-1"></div>

        {/* ==================== ZONA INFERIOR ==================== */}
        <div className="w-full shrink-0 mt-auto pt-4">
          
          {/* FIRMAS Y SELLO */}
          {isLastPage && (
            <div className="grid grid-cols-3 gap-6 text-center items-end mb-4">
              
              <div className="px-2 flex flex-col items-center">
                <div className="h-16 w-full"></div> {/* Espacio para la firma a pluma */}
                <div className="border-b-2 border-gray-400 w-full mb-2"></div>
                <p className="font-bold text-[11px] text-gray-900 leading-tight m-0 w-full truncate">{actaData.docente_nombre}</p>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1 m-0">FIRMA DEL DOCENTE</p>
              </div>
              
              <div className="flex justify-center items-end">
                <div className="w-28 h-24 border-2 border-dashed border-gray-300 rounded-sm flex flex-col items-center justify-center p-2 opacity-50 mb-1">
                  <Users className="w-7 h-7 text-gray-400 mb-1" />
                  <p className="text-[7px] font-black text-gray-400 uppercase leading-tight text-center m-0">
                    SELLO OFICIAL<br/>SERVICIOS ESCOLARES
                  </p>
                </div>
              </div>
              
              <div className="px-2 flex flex-col items-center">
                <div className="h-16 w-full"></div> 
                <div className="border-b-2 border-gray-400 w-full mb-2"></div>
                <p className="font-bold text-[11px] text-gray-900 leading-tight m-0 w-full truncate">Lic. María Fernanda Torres</p>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1 m-0">COORD. SERVICIOS ESCOLARES</p>
              </div>

            </div>
          )}

          {/* PIE DE PÁGINA */}
          <div className="pt-3 border-t border-gray-300 flex justify-between items-center text-[9px] font-bold text-gray-400 uppercase tracking-wider">
            <div>Fecha de emisión: {fecha}</div>
            <div>Folio: {folio}</div>
            <div>Página {pageIndex} de {totalPages}</div>
          </div>
          
        </div>

      </div>
    </div>
  );
};

export default LeafMinutes;