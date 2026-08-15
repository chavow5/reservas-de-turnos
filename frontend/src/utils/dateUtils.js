export const DEFAULT_HOURS = [
  '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '00:00', '01:00'
]

// Lista completa de franjas horarias disponibles para seleccionar en la configuración
export const ALL_POSSIBLE_HOURS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00', '21:00', '22:00', '23:00', '00:00',
  '01:00', '02:00', '03:00'
]

export const generateAllowedHours = (customHours) => {
  if (Array.isArray(customHours) && customHours.length > 0) {
    return customHours
  }
  return DEFAULT_HOURS
}

export const ALLOWED_HOURS = DEFAULT_HOURS

export const getDiaTexto = (fecha) => {
  if (!fecha) return ''
  const [year, month, day] = fecha.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('es-AR', { weekday: 'long' })
}

export const todayISO = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export const maxWeekISO = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 7)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export const isHoraValida = (hora) => {
  const h = Number(hora.split(':')[0])
  return h >= 15 || h < 2
}

export const isFechaDentroDeSemana = (fechaIso) => {
  if (!fechaIso) return false

  const [year, month, day] = fechaIso.split('-').map(Number)
  const selected = new Date(year, month - 1, day)
  selected.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const max = new Date()
  max.setHours(0, 0, 0, 0)
  max.setDate(max.getDate() + 7)

  return selected >= today && selected <= max
}

export const weekDays = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

export const getCalendarDays = (baseDate = new Date()) => {
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const days = []
  const startDay = firstDay.getDay()

  for (let i = 0; i < startDay; i++) {
    days.push(null)
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d)
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const iso = `${yyyy}-${mm}-${dd}`
    days.push({
      day: d,
      iso
    })
  }

  return days
}

export const buildSelectionDate = (fecha, hora) => {
  const [year, month, day] = fecha.split('-').map(Number)
  const [hh] = hora.split(':')
  const hour = Number(hh)

  return new Date(year, month - 1, day, hour, 0, 0, 0)
}

export const isHoraInvalida = (fecha, hora) => {
  if (!fecha) return false

  const ahora = new Date()
  const seleccion = buildSelectionDate(fecha, hora)
  const diff = seleccion - ahora

  return diff <= 1 * 60 * 60 * 1000
}

export const getTiempoRestante = (fecha, hora) => {
  if (!fecha) return null

  const ahora = new Date()
  const seleccion = buildSelectionDate(fecha, hora)
  const diff = seleccion - ahora

  if (diff <= 0) return 'Horario vencido'

  const horas = Math.floor(diff / (1000 * 60 * 60))
  const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  return `Faltan ${horas}h ${minutos}m`
}
