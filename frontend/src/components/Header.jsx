import { Link, useLocation } from 'react-router-dom'

export default function Header() {
  const location = useLocation()

  return (
    <header className="bg-gray-900 text-white px-6 py-4 shadow-md">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        
        <Link to="/" className="text-xl font-bold">
          ⚽ Reservas Fútbol
        </Link>

        <nav className="flex gap-6 text-sm items-center">

          {/* Sorteo visible siempre */}
          <Link
            to="/sorteo"
            className={`hover:text-gray-300 ${
              location.pathname === '/sorteo' ? 'underline' : ''
            }`}
          >
            Sorteo
          </Link>

          {/* Admin solo si no estás en admin */}
          {location.pathname !== '/admin' && (
            <Link
              to="/admin"
              className={`hover:text-gray-300 ${
                location.pathname === '/admin' ? 'underline' : ''
              }`}
            >
              Admin
            </Link>
          )}

        </nav>
      </div>
    </header>
  )
}