import { Link, useLocation } from 'react-router-dom'
import { useTenant } from '../context/TenantContext'

export default function Header() {
  const location = useLocation()
  const { slug, nombreNegocio, modoPrueba } = useTenant()

  const isSuperAdminRoute = location.pathname.startsWith('/superadmin')
  const homePath = `/${slug}`
  const sorteoPath = `/${slug}/sorteo`
  const adminPath = `/${slug}/admin`

  return (
    <header className="bg-gray-900 text-white px-6 py-4 shadow-md">
      <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-3">

        <div className="flex items-center gap-3">
          <Link to={homePath} className="text-xl font-bold flex items-center gap-2 hover:text-blue-400 transition-colors">
            <span>⚽</span> {nombreNegocio}
          </Link>

          {modoPrueba && (
            <span className="bg-amber-500 text-slate-950 font-bold text-xs px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
              Modo Demo
            </span>
          )}
        </div>

        <nav className="flex gap-3 text-sm items-center">
          {/* Botón Sorteo */}
          {!isSuperAdminRoute && (
            <Link
              to={sorteoPath}
              className={`px-4 py-2 rounded font-medium transition ${
                location.pathname === sorteoPath
                  ? 'bg-blue-600 text-white text-align-center'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              🎲 Sorteo de Equipos
            </Link>
          )}

          {/* Botón Admin del Negocio */}
          {!location.pathname.includes('/admin') && !location.pathname.includes('/dashboard') && !isSuperAdminRoute && (
            <Link
              to={adminPath}
              className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-800 text-slate-200 transition-colors font-medium"
            >
              🔐 Admin
            </Link>
          )}

          {/* Acceso discreto a SuperAdmin */}
          <Link
            to="/superadmin"
            className="text-slate-400 hover:text-slate-200 text-sm ml-1 p-1.5 rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center justify-center opacity-70 hover:opacity-100"
            title="Acceso Maestro"
          >
            🔒
          </Link>
        </nav>
      </div>
    </header>
  )
}