import dotenv from 'dotenv'
dotenv.config({ path: '../../.env' })

console.log("ENV DATABASE_URL 👉", process.env.DATABASE_URL)

// ✅ USE RAW POSTGRES
import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // 🔥 REQUIRED for Supabase
})

async function fixServiceImages() {
  console.log("🚀 Fixing booking service images...")

  const { rows: bookings } = await pool.query(
    `SELECT id, services FROM public.bookings WHERE services IS NOT NULL`
  )

  for (const b of bookings) {
    const services = Array.isArray(b.services) ? b.services : []

    const updated = await Promise.all(
      services.map(async (s: any) => {
        if (s.image_url) return s

        const { rows } = await pool.query(
          `SELECT image_url FROM public.platform_services WHERE name = $1 LIMIT 1`,
          [s.name]
        )

        return {
          ...s,
          image_url: rows[0]?.image_url || '',
        }
      })
    )

    await pool.query(
      `UPDATE public.bookings SET services = $1 WHERE id = $2`,
      [JSON.stringify(updated), b.id]
    )
  }

  console.log("✅ DONE: Service images updated")
}

fixServiceImages()
  .catch(err => {
    console.error("❌ ERROR:", err)
  })
  .finally(async () => {
    await pool.end()
  })