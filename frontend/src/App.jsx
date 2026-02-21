import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import ImportarAlumnos from './pages/Alumnos/ImportarAlumnos'
import CambiarEstatusAlumno from './pages/Alumnos/CambiarEstatusAlumno'
import ListadoAlumnos from './pages/Alumnos/ListadoAlumnos'

function App() {
  
  
  return (
    <Router>
      <Routes>
        
        <Route path="/" element={<Navigate to="/alumnos/listado" replace />} />
        
        
        <Route path="/alumnos/importar" element={<ImportarAlumnos />} />
        
        <Route path="/alumnos/cambiar-estatus" element={<CambiarEstatusAlumno />} />

        <Route path="/alumnos/listado" element={<ListadoAlumnos />} />
        <Route path="estatus" element={<Navigate to="/alumnos/cambiar-estatus" replace />} />
      </Routes>
    </Router>
  )
}

export default App