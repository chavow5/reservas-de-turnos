import { Link, useLocation } from 'react-router-dom'

export default function Header() {
  const location = useLocation()

  return (
    <header className="bg-gray-900 text-white px-6 py-4 shadow-md">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        
        <Link to="/" className="text-xl font-bold">
          ⚽ Reservas Fútbol
        </Link>

        <nav className="flex gap-4 text-sm">
          {location.pathname !== '/admin' && location.pathname !== '/dashboard' && (
            <Link to="/admin" className="hover:text-gray-300">
              Admin
            </Link>
          )}
        </nav>

      </div>
    </header>
  )
}