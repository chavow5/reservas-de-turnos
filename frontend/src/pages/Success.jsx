export default function Success() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded shadow text-center">
        <h1 className="text-2xl font-semibold text-green-600 mb-2">
          ✅ Turno confirmado
        </h1>
        <p className="text-gray-600 mb-4">
          El pago fue aprobado correctamente
        </p>
        <a
          href="/"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Volver
        </a>
      </div>
    </div>
  )
}
