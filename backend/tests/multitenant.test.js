import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'

process.env.PORT = '3008'
const { app, server } = await import('../server.js')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion'
const API_URL = 'http://localhost:3008'

// Helpers para generar tokens de prueba
const createTenantToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })
}

const tokenTenantA = createTenantToken({
  usuario_id: 'user-a',
  negocio_id: '11111111-1111-1111-1111-111111111111',
  rol: 'admin',
  nombre: 'Admin Club A',
  email: 'admin@cluba.com',
  slug: 'pruebas-reservas'
})

const tokenTenantB = createTenantToken({
  usuario_id: 'user-b',
  negocio_id: '22222222-2222-2222-2222-222222222222',
  rol: 'admin',
  nombre: 'Admin Club B',
  email: 'admin@clubb.com',
  slug: 'reservas-futbol'
})

const tokenSuperAdmin = createTenantToken({
  rol: 'superadmin',
  email: 'chavow5@superadmin',
  nombre: 'Super Admin'
})

const tokenColaboradorA = createTenantToken({
  usuario_id: 'colab-a',
  negocio_id: '11111111-1111-1111-1111-111111111111',
  rol: 'colaborador',
  nombre: 'Colab Club A',
  email: 'colab@cluba.com',
  slug: 'pruebas-reservas'
})

test('1. GET /health/db responde con status y tiempoMs (Tarea B)', async () => {
  const res = await fetch(`${API_URL}/health/db`)
  const data = await res.json()

  assert.ok(res.status === 200 || res.status === 503, 'Debe devolver código 200 o 503')
  assert.equal(typeof data.activa, 'boolean', 'data.activa debe ser booleano')
  assert.equal(typeof data.tiempoMs, 'number', 'data.tiempoMs debe ser número')
  assert.ok(data.tiempoMs >= 0, 'tiempoMs debe ser positivo')
})

test('2. Rutas protegidas rechazan requests sin token (401)', async () => {
  const res = await fetch(`${API_URL}/admin/reservas`)
  assert.equal(res.status, 401, 'Debe retornar 401 sin header Authorization')
})

test('3. Rutas protegidas rechazan token inválido (401)', async () => {
  const res = await fetch(`${API_URL}/admin/reservas`, {
    headers: { Authorization: 'Bearer token-falso-invalido' }
  })
  assert.equal(res.status, 401, 'Debe retornar 401 con token inválido')
})

test('4. Endpoint público GET /api/negocios/:slug devuelve metadatos del tenant', async () => {
  const res = await fetch(`${API_URL}/api/negocios/pruebas-reservas`)
  assert.equal(res.status, 200, 'Debe responder 200')
  const data = await res.json()
  assert.equal(data.slug, 'pruebas-reservas')
  assert.equal(data.modo_prueba, true)
})

test('5. Reserva en MODO PRUEBA /api/demo/reservar crea turno sin Mercado Pago', async () => {
  const fechaPrueba = '2026-12-01'
  const horaPrueba = '18:00'
  const canchaPrueba = '2'

  const res = await fetch(`${API_URL}/api/demo/reservar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: 'pruebas-reservas',
      nombre: 'Jugador Test Automatizado',
      fecha: fechaPrueba,
      hora: horaPrueba,
      cancha: canchaPrueba
    })
  })

  assert.ok(res.status === 200 || res.status === 400, 'Debe responder 200 si libre o 400 si ocupado')
  const data = await res.json()
  if (res.status === 200) {
    assert.equal(data.ok, true)
  }
})

test('6. SuperAdmin Login autentica correctamente', async () => {
  const superAdminEmail = process.env.SUPERADMIN_EMAIL || 'chavow5@superadmin'
  const superAdminPassword = process.env.SUPERADMIN_PASSWORD || 'superadmin123'
  const res = await fetch(`${API_URL}/api/superadmin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: superAdminEmail,
      password: superAdminPassword
    })
  })

  assert.equal(res.status, 200)
  const data = await res.json()
  assert.ok(data.token, 'Debe devolver un JWT token')
  assert.equal(data.user.rol, 'superadmin')
})

test('7. SuperAdmin accede a métricas globales', async () => {
  const res = await fetch(`${API_URL}/api/superadmin/metricas`, {
    headers: { Authorization: `Bearer ${tokenSuperAdmin}` }
  })

  assert.equal(res.status, 200)
  const data = await res.json()
  assert.ok(data.totalNegocios >= 0)
  assert.ok(data.totalReservas >= 0)
})

test('8. Colaborador no puede acceder a configuración de admin (403)', async () => {
  const res = await fetch(`${API_URL}/admin/config`, {
    headers: { Authorization: `Bearer ${tokenColaboradorA}` }
  })

  assert.equal(res.status, 403, 'Colaborador debe recibir 403 en /admin/config')
})

test('9. Admin puede acceder a configuración de su negocio', async () => {
  const res = await fetch(`${API_URL}/admin/config`, {
    headers: { Authorization: `Bearer ${tokenTenantA}` }
  })

  assert.equal(res.status, 200)
  const data = await res.json()
  assert.ok(data.monto_sena !== undefined)
})

test('10. Admin y Colaborador pueden ver las canchas de su negocio (GET /admin/canchas)', async () => {
  // Test con Colaborador
  const resColab = await fetch(`${API_URL}/admin/canchas`, {
    headers: { Authorization: `Bearer ${tokenColaboradorA}` }
  })
  assert.equal(resColab.status, 200, 'Colaborador debe poder consultar canchas')
  const dataColab = await resColab.json()
  assert.ok(Array.isArray(dataColab), 'Debe retornar un array de canchas')
  assert.ok(dataColab.length > 0, 'Debe haber al menos 1 cancha')
  assert.ok(dataColab[0].id !== undefined, 'Cancha debe tener id')
  assert.ok(dataColab[0].nombre !== undefined, 'Cancha debe tener nombre')

  // Test con Admin
  const resAdmin = await fetch(`${API_URL}/admin/canchas`, {
    headers: { Authorization: `Bearer ${tokenTenantA}` }
  })
  assert.equal(resAdmin.status, 200, 'Admin debe poder consultar canchas')
})

test('11. Colaborador puede alternar disponibilidad/visibilidad de una cancha (PUT /admin/canchas/:id/disponibilidad)', async () => {
  const res = await fetch(`${API_URL}/admin/canchas/1/disponibilidad`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenColaboradorA}`
    },
    body: JSON.stringify({ activa: false })
  })

  assert.ok(res.status === 200 || res.status === 404, 'Debe responder 200 con éxito')
  if (res.status === 200) {
    const data = await res.json()
    assert.equal(data.ok, true)
    assert.ok(Array.isArray(data.canchas))
  }
})

test('12. SuperAdmin endpoints devuelven y gestionan canchas de los negocios', async () => {
  const res = await fetch(`${API_URL}/api/superadmin/negocios`, {
    headers: { Authorization: `Bearer ${tokenSuperAdmin}` }
  })

  assert.equal(res.status, 200)
  const data = await res.json()
  assert.ok(Array.isArray(data))
  if (data.length > 0) {
    assert.ok(Array.isArray(data[0].canchas), 'Cada negocio debe tener un array canchas normalizado')
  }
})

test('13. Endpoint público y Config de Admin devuelven horarios normalizados', async () => {
  const resPub = await fetch(`${API_URL}/api/negocios/pruebas-reservas`)
  assert.equal(resPub.status, 200)
  const dataPub = await resPub.json()
  assert.ok(Array.isArray(dataPub.horarios), 'Debe devolver array horarios')
  assert.ok(dataPub.horarios.length > 0, 'Debe haber al menos 1 horario disponible')

  const resAdmin = await fetch(`${API_URL}/admin/config`, {
    headers: { Authorization: `Bearer ${tokenTenantA}` }
  })
  assert.equal(resAdmin.status, 200)
  const dataAdmin = await resAdmin.json()
  assert.ok(Array.isArray(dataAdmin.horarios), 'Admin config debe devolver array horarios')
})

test('14. Admin puede actualizar horarios configurados del negocio (PUT /admin/config)', async () => {
  const nuevosHorarios = ['16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00']
  const res = await fetch(`${API_URL}/admin/config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenTenantA}`
    },
    body: JSON.stringify({
      monto_sena: 150,
      horarios: nuevosHorarios
    })
  })

  assert.equal(res.status, 200, 'Debe responder 200 al actualizar config y horarios')
  const data = await res.json()
  assert.equal(data.ok, true)
})

test.after(() => {
  server.close()
})
