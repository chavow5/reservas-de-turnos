import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

const app = express()
app.use(cors())
app.use(express.json())

console.log("🔥 SERVER NUEVO ACTIVO 🔥")
console.log("MP TOKEN:", process.env.MP_ACCESS_TOKEN)

// Mercado Pago
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
})

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)


// ============================
// CREATE PREFERENCE
// ============================

app.post('/create-preference', async (req, res) => {
  try {

    const { nombre, fecha, hora } = req.body

    if (!nombre || !fecha || !hora) {
      return res.status(400).json({ error: 'Datos incompletos' })
    }

    console.log("BODY:", req.body)

    const preference = new Preference(mpClient)

    const response = await preference.create({
      body: {
        items: [
          {
            title: `Reserva ${fecha} ${hora}`,
            quantity: 1,
            unit_price: 100,
            currency_id: "ARS"
          }
        ],
        metadata: {
          nombre,
          fecha,
          hora
        },
        back_urls: {
          success: 'https://reservas-de-turnos.onrender.com/success',
          failure: 'https://reservas-de-turnos.onrender.com',
          pending: 'https://reservas-de-turnos.onrender.com'
        },
        auto_return: 'approved',
        notification_url: 'https://reservas-de-turnos.onrender.com/webhook'
      }
    })

    console.log("✅ Preference creada")

    res.json({ init_point: response.init_point })

  } catch (error) {
    console.error("❌ ERROR COMPLETO:", error)
    res.status(500).json({ message: error.message })
  }
})


// ============================
// WEBHOOK
// ============================

app.post('/webhook', async (req, res) => {
  try {
    console.log('📩 Webhook recibido:', req.body)

    if (req.body.topic !== 'payment') {
      return res.sendStatus(200)
    }
    const paymentId = req.body?.resource
    if (!paymentId) return res.sendStatus(200)

    const payment = new Payment(mpClient)
    const mpPayment = await payment.get({ id: paymentId })

    console.log('💰 Estado del pago:', mpPayment.status)

    if (mpPayment.status === 'approved') {

      const { nombre, fecha, hora } = mpPayment.metadata

      const { data: existing } = await supabase
        .from('reservas')
        .select('*')
        .eq('fecha', fecha)
        .eq('hora', hora)

      if (!existing || existing.length === 0) {
        await supabase.from('reservas').insert([
          {
            nombre,
            fecha,
            hora,
            pagado: true
          }
        ])

        console.log('✅ Reserva creada correctamente')
      }
    }

    res.sendStatus(200)

  } catch (error) {
    console.error('Webhook error:', error)
    res.sendStatus(500)
  }
})
app.listen(3000, () =>
  console.log('🚀 Backend Mercado Pago activo en puerto 3000')
)
