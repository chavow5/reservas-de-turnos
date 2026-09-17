import { Link, useLocation } from 'react-router-dom'
import { useTenant } from '../context/TenantContext'

export default function Header() {
  const location = useLocation()
  const { nombreNegocio } = useTenant()

  const isDashboard = location.pathname.includes('/dashboard')
  const isAdminLogin = location.pathname.includes('/admin')
  const isSorteo = location.pathname.includes('/sorteo')

  return (
    <header className="bg-gray-900 text-white px-6 py-4 shadow-md">
      <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-3">

        <div className="flex items-center gap-3">
          <Link to="/" className="text-xl font-bold flex items-center gap-2 hover:text-blue-400 transition-colors">
            {nombreNegocio}
          </Link>
        </div>

        <nav className="flex gap-3 text-sm items-center">
          {/* Botón Reservar si está en sorteo o admin */}
          {(isDashboard || isAdminLogin || isSorteo) && (
            <Link
              to="/"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
            >
              Reservar
            </Link>
          )}

          {/* Botón Sorteo */}
          <Link
            to="/sorteo"
            className={`px-3.5 py-2 rounded-xl font-medium transition ${
              isSorteo
                ? 'bg-blue-600 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            Sorteo de Equipos
          </Link>

          {/* Botón Admin / Panel */}
          {!isAdminLogin && !isDashboard && (
            <Link
              to="/admin"
              className="px-3.5 py-2 rounded-xl bg-gray-700 hover:bg-gray-800 text-slate-200 transition-colors font-medium"
            >
              Admin
            </Link>
          )}

          {isDashboard && (
            <Link
              to="/dashboard"
              className="px-3.5 py-2 rounded-xl bg-blue-600 text-white font-medium"
            >
              Panel
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}