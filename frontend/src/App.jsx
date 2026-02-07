import { useState, useEffect } from 'react'
import client from './lib/axios'

function App() {
  const [message, setMessage] = useState("Conectando...")

  useEffect(() => {
    client.get('/')
      .then((response) => {
        setMessage(response.data.message)
        console.log("Response:", response.data)
      })
      .catch((error) => {
        setMessage("Error de conexión.")
        console.error("Error de conexión:", error)
      })
  }, [])

  return (
    <>
      <h1 className="text-3xl font-bold underline">
        Test Frontend - Backend
      </h1>
      <p className="text-xl font-medium">
        Response:
      </p>
      <p className="text-2xl font-bold">
        {message}
      </p>
    </>
  )
}

export default App
