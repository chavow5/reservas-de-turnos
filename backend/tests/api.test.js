import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'

process.env.PORT = '3009'
const { app, server } = await import('../server.js')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion'
const API_URL = 'http://localhost:3009'

// Helper para generar tokens de prueba
const createToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })
}

const tokenAdmin = createToken({
  usuario_id: 'admin-1',
  rol: 'admin',
  nombre: 'Admin Principal',
  email: 'admin@test.com'
})

const tokenColaborador = createToken({
  usuario_id: 'colab-1',
  rol: 'colaborador',
  nombre: 'Colaborador Test',
  email: 'colab@test.com'
})

test('1. GET /health/db responde con status y tiempoMs', async () => {
  const res = await fetch(`${API_URL}/health/db`)
  const data = await res.json()

  assert.ok(res.status === 200 || res.status === 503, 'Debe devolver código 200 o 503')
  assert.equal(typeof data.activa, 'boolean', 'data.activa debe ser booleano')
  assert.equal(typeof data.tiempoMs, 'number', 'data.tiempoMs debe ser número')
  assert.ok(data.tiempoMs >= 0, 'tiempoMs debe ser positivo')
})

test('2. GET /health responde con status ok', async () => {
  const res = await fetch(`${API_URL}/health`)
  assert.ok(res.status === 200 || res.status === 500)
})

test('3. GET /api/config devuelve la configuración del negocio único', async () => {
  const res = await fetch(`${API_URL}/api/config`)
  assert.equal(res.status, 200)

  const data = await res.json()
  assert.ok(data.nombre, 'Debe tener nombre de negocio')
  assert.ok(Array.isArray(data.canchas), 'Debe tener arreglo de canchas')
  assert.ok(Array.isArray(data.horarios), 'Debe tener arreglo de horarios')
  assert.ok(data.canchas.length > 0, 'Debe tener al menos una cancha')
})

test('4. GET /api/turnos-ocupados devuelve turnos', async () => {
  const res = await fetch(`${API_URL}/api/turnos-ocupados`)
  assert.equal(res.status, 200)

  const data = await res.json()
  assert.ok(Array.isArray(data), 'Debe ser un array')
})

test('5. Rutas protegidas rechazan requests sin token (401)', async () => {
  const resReservas = await fetch(`${API_URL}/admin/reservas`)
  assert.equal(resReservas.status, 401)

  const resCanchas = await fetch(`${API_URL}/admin/canchas`)
  assert.equal(resCanchas.status, 401)

  const resConfig = await fetch(`${API_URL}/admin/config`)
  assert.equal(resConfig.status, 401)

  const resColaboradores = await fetch(`${API_URL}/admin/colaboradores`)
  assert.equal(resColaboradores.status, 401)
})

test('6. Rutas protegidas rechazan tokens inválidos (401)', async () => {
  const res = await fetch(`${API_URL}/admin/reservas`, {
    headers: { Authorization: 'Bearer token-invalido-o-expirado' }
  })
  assert.equal(res.status, 401)
})

test('7. POST /admin/login autentica correctamente con contraseña', async () => {
  const password = process.env.ADMIN_PASSWORD || 'admin123'
  const res = await fetch(`${API_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@reservas.com', password })
  })

  assert.equal(res.status, 200)
  const data = await res.json()
  assert.ok(data.token, 'Debe devolver un JWT')
  assert.equal(data.user.rol, 'admin')
})

test('8. Admin accede a /admin/reservas, /admin/canchas y /admin/config', async () => {
  const resReservas = await fetch(`${API_URL}/admin/reservas`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` }
  })
  assert.equal(resReservas.status, 200)

  const resCanchas = await fetch(`${API_URL}/admin/canchas`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` }
  })
  assert.equal(resCanchas.status, 200)

  const resConfig = await fetch(`${API_URL}/admin/config`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` }
  })
  assert.equal(resConfig.status, 200)
})

test('9. Colaborador accede a reservas y canchas, pero tiene acceso denegado (403) a config y colaboradores', async () => {
  const resReservas = await fetch(`${API_URL}/admin/reservas`, {
    headers: { Authorization: `Bearer ${tokenColaborador}` }
  })
  assert.equal(resReservas.status, 200)

  const resCanchas = await fetch(`${API_URL}/admin/canchas`, {
    headers: { Authorization: `Bearer ${tokenColaborador}` }
  })
  assert.equal(resCanchas.status, 200)

  const resConfig = await fetch(`${API_URL}/admin/config`, {
    headers: { Authorization: `Bearer ${tokenColaborador}` }
  })
  assert.equal(resConfig.status, 403)

  const resColaboradores = await fetch(`${API_URL}/admin/colaboradores`, {
    headers: { Authorization: `Bearer ${tokenColaborador}` }
  })
  assert.equal(resColaboradores.status, 403)
})

test.after(() => {
  if (server && server.close) {
    server.close()
  }
})

