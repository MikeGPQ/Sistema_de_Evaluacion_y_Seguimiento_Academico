import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import ImportarAlumnos from './pages/Alumnos/ImportarAlumnos'
import CambiarEstatusAlumno from './pages/Alumnos/CambiarEstatusAlumno'

function App() {
  // Datos de prueba para la interfaz
  const alumnoPrueba = {
    nombre: "María González Pérez",
    matricula: "2024-0156"
  };

  return (
    <Router>
      <Routes>
        {/* FUERZA LA REDIRECCIÓN A TU NUEVA PANTALLA */}
        <Route path="/" element={<Navigate to="/alumnos/importar" replace />} />
        
        {/* Define las rutas disponibles */}
        <Route path="/alumnos/importar" element={<ImportarAlumnos />} />
        
        <Route 
          path="/alumnos/cambiar-estatus" 
          element={<CambiarEstatusAlumno alumnoSeleccionado={alumnoPrueba} />} 
        />

        {/* Ruta comodín por si escribes algo mal, que te mande a tu nueva pantalla */}
        <Route path="*" element={<Navigate to="/alumnos/cambiar-estatus" replace />} />
      </Routes>
    </Router>
  )
}

export default App