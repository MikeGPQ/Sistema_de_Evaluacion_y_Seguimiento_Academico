import { useEffect, useState } from "react";

export default function ReporteAsistencia() {
  const [data, setData] = useState([]);
  const [filtros, setFiltros] = useState({
    carrera_id: "",
    cuatrimestre: "",
    grupo_id: "",
    materia_id: "",
  });

  const obtenerReporte = async () => {
    let url = "http://localhost:8000/asistencia/reporte";
    const params = new URLSearchParams(filtros);
    url += `?${params.toString()}`;

    const res = await fetch(url);
    const json = await res.json();
    setData(json);
  };

  const descargarExcel = () => {
    let url = "http://localhost:8000/asistencia/reporte?formato=excel";
    const params = new URLSearchParams(filtros);
    url += `&${params.toString()}`;
    window.open(url, "_blank");
  };

  useEffect(() => {
    obtenerReporte();
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Reporte de Asistencia</h2>

      <div style={{ marginBottom: "20px" }}>
        <input
          placeholder="Carrera ID"
          onChange={(e) => setFiltros({ ...filtros, carrera_id: e.target.value })}
        />
        <input
          placeholder="Cuatrimestre"
          onChange={(e) => setFiltros({ ...filtros, cuatrimestre: e.target.value })}
        />
        <input
          placeholder="Grupo ID"
          onChange={(e) => setFiltros({ ...filtros, grupo_id: e.target.value })}
        />
        <input
          placeholder="Materia ID"
          onChange={(e) => setFiltros({ ...filtros, materia_id: e.target.value })}
        />

        <button onClick={obtenerReporte}>Filtrar</button>
        <button onClick={descargarExcel} style={{ marginLeft: "10px" }}>
          Descargar Excel
        </button>
      </div>

      <table border="1" width="100%">
        <thead>
          <tr>
            <th>Matrícula</th>
            <th>Nombre</th>
            <th>Materia</th>
            <th>Grupo</th>
            <th>Asistencias</th>
            <th>Total</th>
            <th>%</th>
            <th>Riesgo</th>
          </tr>
        </thead>
        <tbody>
          {data.map((alumno, index) => (
            <tr
              key={index}
              style={{
                backgroundColor: alumno.riesgo === "SI" ? "#f8d7da" : "white",
              }}
            >
              <td>{alumno.matricula}</td>
              <td>{alumno.nombre}</td>
              <td>{alumno.materia}</td>
              <td>{alumno.grupo}</td>
              <td>{alumno.asistencias}</td>
              <td>{alumno.total_clases}</td>
              <td>{alumno.porcentaje}%</td>
              <td>{alumno.riesgo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}