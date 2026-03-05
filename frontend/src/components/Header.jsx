import { Link, useLocation } from 'react-router-dom'

export default function Header() {
  const location = useLocation()

  return (
    <header className="bg-gray-900 text-white px-6 py-4 shadow-md">
      <div className="max-w-6xl mx-auto flex justify-between items-center">

        <Link to="/" className="text-xl font-bold">
          ⚽ Reservas Fútbol
        </Link>

        <nav className="flex gap-3 text-sm items-center">

          {/* Botón reservar */}
          {/* <Link
            to="/"
            className={`px-4 py-2 rounded font-medium transition
      ${location.pathname === '/'
                ? 'bg-green-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'}
    `}
          >
            Reservar cancha
          </Link> */}

          {/* Botón sorteo */}
          <Link
            to="/sorteo"
            className={`px-4 py-2 rounded font-medium transition
      ${location.pathname === '/sorteo'
                ? 'bg-blue-600 text-white text-align-center'
                : 'bg-blue-500 hover:bg-blue-600 text-white'}
    `}
          >
            Sorteo de Equipos
          </Link>

          {/* Admin */}
          {location.pathname !== '/admin' && (
            <Link
              to="/admin"
              className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-800"
            >
              Admin
            </Link>
          )}

        </nav>
      </div>
    </header>
  )
}