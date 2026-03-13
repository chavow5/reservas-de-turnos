export const generateAllowedHours = () => {
  const hours = []
  for (let h = 15; h <= 23; h++) {
    hours.push(`${String(h).padStart(2, '0')}:00`)
  }
  hours.push('00:00', '01:00')
  return hours
}

export const ALLOWED_HOURS = generateAllowedHours()

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
