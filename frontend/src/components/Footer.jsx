export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 text-center text-xs text-gray-500 py-2 shadow-inner">
      Desarrollado por David Ramírez — Reserva de turnos © {new Date().getFullYear()} ·{" "}
      <a
        href="https://wa.me/5493804201334"
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 hover:underline mx-1"
      >
        📞 WhatsApp
      </a>
      |
      <a
        href="https://instagram.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-pink-500 hover:underline mx-1"
      >
        📷 Instagram
      </a>
    </footer>
  )
}