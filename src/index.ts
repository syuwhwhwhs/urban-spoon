
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { DB, pool } from './db.js'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

type Env = {
  DB: DB
  BOT_TOKEN?: string
  TELEGRAM_SECRET?: string
  PG_BASE_URL?: string
  PG_API_KEY?: string
  PG_ACCESS_TOKEN?: string
  PG_USERNAME?: string
  PG_PASSWORD?: string
  PG_CREATE_USER_PATH?: string
  ADMIN_USER: string
  ADMIN_PASSWORD?: string
  APP_NAME: string
}

const app = new Hono<{ Bindings: Env }>()

const json = (c: any, data: any, status = 200) =>
  c.json(data, status as any)

const esc = (s: string) =>
  s.replace(/[&<>"']/g, x =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[x]!
  )

async function sha(s: string) {
  const bytes = new TextEncoder().encode(s)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('')
}

async function tg(env: Env, method: string, payload: any) {
  if (!env.BOT_TOKEN) throw new Error('BOT_TOKEN is not configured')

  const response = await fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }
  )

  const result = await response.json() as any

  if (!response.ok || !result.ok) {
    throw new Error(result.description || 'Telegram API error')
  }

  return result.result
}

async function pg(env: Env, path: string, init: RequestInit = {}) {
  if (!env.PG_BASE_URL) throw new Error('PG_BASE_URL is not configured')

  const headers = new Headers(init.headers)

  if (env.PG_API_KEY) {
    headers.set('X-Api-Key', env.PG_API_KEY)
  } else if (env.PG_ACCESS_TOKEN) {
    headers.set('Authorization', `Bearer ${env.PG_ACCESS_TOKEN}`)
  }

  const response = await fetch(
    env.PG_BASE_URL.replace(/\/$/, '') + path,
    { ...init, headers, redirect: 'manual' }
  )

  const text = await response.text()
  let data: any

  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }

  if (!response.ok) {
    throw new Error(
      `PasarGuard ${response.status}: ${
        typeof data === 'string' ? data : JSON.stringify(data)
      }`
    )
  }

  return data
}

async function isAdmin(c: any) {
  const cookie = getCookie(c, 'pg_admin')
  const expected = await sha(
    `${c.env.ADMIN_USER}:${c.env.ADMIN_PASSWORD || ''}`
  )
  return Boolean(cookie && cookie === expected)
}

const logoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#35e7ff"/>
      <stop offset=".52" stop-color="#7568ff"/>
      <stop offset="1" stop-color="#e44dff"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="100" fill="#080d1b"/>
  <circle cx="256" cy="225" r="164" fill="none"
    stroke="url(#g)" stroke-width="8"/>
  <path d="M155 335V115h106c67 0 101 33 101 88
    0 39-20 67-56 80l67 52h-91l-57-46h-1v46zm69-108h35
    c22 0 34-8 34-24s-12-24-34-24h-35z" fill="url(#g)"/>
  <text x="256" y="438" fill="#f5f7ff" font-family="Arial"
    font-weight="800" font-size="55" text-anchor="middle">RoXeT</text>
</svg>`

function layout(title: string, body: string) {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
body{font-family:system-ui;background:#0b1020;color:#eee;margin:0}
main{max-width:1100px;margin:30px auto;padding:20px}
.card{background:#151c32;border:1px solid #283250;border-radius:18px;padding:18px;margin:12px 0}
a,button{background:#2563eb;color:white;border:0;border-radius:10px;padding:10px 14px;text-decoration:none;cursor:pointer}
input,textarea,select{width:100%;box-sizing:border-box;padding:11px;margin:6px 0;border-radius:10px;border:1px solid #39445f;background:#0f1528;color:white}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
.muted{color:#9aa6c1}
table{border-collapse:collapse}
th,td{padding:8px;border-bottom:1px solid #283250;text-align:right}
</style>
</head>
<body><main>${body}</main></body></html>`
}

app.get('/', c =>
  c.html(layout(c.env.APP_NAME, `
    <div class="card">
      <img src="/logo.svg" alt="RoXeT" style="width:130px">
      <h1>${esc(c.env.APP_NAME)}</h1>
      <p class="muted">ربات تلگرام و داشبورد مدیریت اشتراک</p>
      <a href="/dashboard">ورود به پنل</a>
    </div>
  `))
)

app.get('/health', c =>
  json(c, {
    ok: true,
    app: c.env.APP_NAME,
    time: new Date().toISOString()
  })
)

app.get('/logo.svg', c =>
  c.body(logoSvg, 200, { 'Content-Type': 'image/svg+xml' })
)

app.get('/dashboard', async c => {
  if (!(await isAdmin(c))) {
    return c.html(layout('ورود مدیریت', `
      <div class="card">
        <h2>ورود مدیریت RoXeT BOT</h2>
        <form method="post" action="/dashboard/login">
          <input name="user" placeholder="نام کاربری" required>
          <input name="pass" type="password" placeholder="رمز عبور" required>
          <button>ورود</button>
        </form>
      </div>
    `))
  }

  const [users, plans, orders, services] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<any>(),
    c.env.DB.prepare('SELECT COUNT(*) AS n FROM plans WHERE is_active=TRUE').first<any>(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE status='pending'").first<any>(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM services WHERE status='active'").first<any>()
  ])

  return c.html(layout('داشبورد', `
    <h1>داشبورد RoXeT BOT</h1>
    <div class="grid">
      <div class="card">کاربران<br><b>${users?.n ?? 0}</b></div>
      <div class="card">پلن‌های فعال<br><b>${plans?.n ?? 0}</b></div>
      <div class="card">سفارش‌های معلق<br><b>${orders?.n ?? 0}</b></div>
      <div class="card">سرویس‌های فعال<br><b>${services?.n ?? 0}</b></div>
    </div>
    <div class="card">
      <p><a href="/dashboard/plans">پلن‌ها</a></p>
      <p><a href="/dashboard/users">کاربران و کیف پول</a></p>
      <p><a href="/dashboard/orders">سفارش‌ها</a></p>
      <p><a href="/dashboard/tickets">تیکت‌ها</a></p>
      <p><a href="/dashboard/settings">تنظیمات</a></p>
      <p><a href="/dashboard/pg">اتصال PasarGuard</a></p>
      <form method="post" action="/dashboard/logout"><button>خروج</button></form>
    </div>
  `))
})

app.post('/dashboard/login', async c => {
  const form = await c.req.parseBody()

  if (
    String(form.user || '') !== c.env.ADMIN_USER ||
    String(form.pass || '') !== String(c.env.ADMIN_PASSWORD || '')
  ) {
    return c.html(
      layout('خطا', '<div class="card">نام کاربری یا رمز عبور اشتباه است.</div>'),
      401
    )
  }

  setCookie(c, 'pg_admin', await sha(
    `${c.env.ADMIN_USER}:${c.env.ADMIN_PASSWORD || ''}`
  ), {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 86400
  })

  return c.redirect('/dashboard')
})

app.post('/dashboard/logout', c => {
  deleteCookie(c, 'pg_admin', { path: '/' })
  return c.redirect('/dashboard')
})

app.get('/dashboard/plans', async c => {
  if (!(await isAdmin(c))) return c.redirect('/dashboard')

  const result = await c.env.DB.prepare(
    'SELECT * FROM plans ORDER BY sort_order,id'
  ).all<any>()

  const rows = result.results.map((p: any) => `
    <tr>
      <td>${p.id}</td>
      <td>${esc(p.name)}</td>
      <td>${Number(p.price).toLocaleString()}</td>
      <td>${p.duration_days}</td>
      <td>${p.data_limit_gb ?? 'نامحدود'}</td>
      <td>${p.is_active ? 'فعال' : 'خاموش'}</td>
    </tr>
  `).join('')

  return c.html(layout('پلن‌ها', `
    <h1>پلن‌ها</h1>
    <div class="card">
      <form method="post" action="/api/admin/plans">
        <input name="name" placeholder="نام پلن" required>
        <input name="price" type="number" min="0" placeholder="قیمت تومان" required>
        <input name="duration_days" type="number" min="1" value="30" required>
        <input name="data_limit_gb" type="number" step="0.1" min="0" placeholder="حجم GB؛ خالی یعنی نامحدود">
        <input name="description" placeholder="توضیح">
        <button>افزودن پلن</button>
      </form>
    </div>
    <div class="card">
      <table width="100%">
        <tr><th>ID</th><th>نام</th><th>قیمت</th><th>روز</th><th>حجم</th><th>وضعیت</th></tr>
        ${rows}
      </table>
    </div>
    <a href="/dashboard">بازگشت</a>
  `))
})

app.post('/api/admin/plans', async c => {
  if (!(await isAdmin(c))) return json(c, { error: 'unauthorized' }, 401)

  const form = await c.req.parseBody()
  const name = String(form.name || '').trim()
  const price = Number(form.price)
  const days = Number(form.duration_days || 30)
  const rawGb = String(form.data_limit_gb ?? '').trim()
  const gb = rawGb === '' ? null : Number(rawGb)

  if (
    !name ||
    !Number.isSafeInteger(price) ||
    price < 0 ||
    !Number.isSafeInteger(days) ||
    days < 1 ||
    (gb !== null && (!Number.isFinite(gb) || gb < 0))
  ) {
    return json(c, { error: 'invalid plan values' }, 400)
  }

  await c.env.DB.prepare(`
    INSERT INTO plans
      (name, description, price, duration_days, data_limit_gb, sort_order)
    VALUES (
      ?, ?, ?, ?, ?,
      COALESCE((SELECT MAX(sort_order)+1 FROM plans), 1)
    )
  `).bind(
    name,
    String(form.description || ''),
    price,
    days,
    gb
  ).run()

  return c.redirect('/dashboard/plans')
})

app.get('/dashboard/users', async c => {
  if (!(await isAdmin(c))) return c.redirect('/dashboard')

  const result = await c.env.DB.prepare(`
    SELECT id,telegram_id,username,full_name,role,wallet_balance,created_at
    FROM users ORDER BY id DESC LIMIT 200
  `).all<any>()

  return c.html(layout('کاربران', `
    <h1>کاربران</h1>
    <div class="card">
      <table width="100%">
        <tr><th>ID</th><th>Telegram ID</th><th>نام</th><th>نقش</th><th>موجودی</th></tr>
        ${result.results.map((u: any) => `
          <tr>
            <td>${u.id}</td>
            <td>${u.telegram_id ?? '-'}</td>
            <td>${esc(u.full_name || u.username || '-')}</td>
            <td>${esc(u.role)}</td>
            <td>${Number(u.wallet_balance).toLocaleString()}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    <a href="/dashboard">بازگشت</a>
  `))
})

app.get('/dashboard/orders', async c => {
  if (!(await isAdmin(c))) return c.redirect('/dashboard')

  const result = await c.env.DB.prepare(`
    SELECT o.id,o.amount,o.status,o.payment_method,o.created_at,
           u.telegram_id,u.full_name,p.name AS plan_name
    FROM orders o
    JOIN users u ON u.id=o.user_id
    JOIN plans p ON p.id=o.plan_id
    ORDER BY o.id DESC LIMIT 100
  `).all<any>()

  return c.html(layout('سفارش‌ها', `
    <h1>سفارش‌ها</h1>
    <div class="card">
      <p>ثبت سفارش به‌تنهایی به معنی پرداخت یا فعال شدن سرویس نیست.</p>
      <table width="100%">
        <tr><th>شماره</th><th>کاربر</th><th>پلن</th><th>مبلغ</th><th>وضعیت</th></tr>
        ${result.results.map((o: any) => `
          <tr>
            <td>#${o.id}</td>
            <td>${esc(o.full_name || String(o.telegram_id))}</td>
            <td>${esc(o.plan_name)}</td>
            <td>${Number(o.amount).toLocaleString()}</td>
            <td>${esc(o.status)}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    <a href="/dashboard">بازگشت</a>
  `))
})

app.get('/dashboard/settings', async c => {
  if (!(await isAdmin(c))) return c.redirect('/dashboard')

  const result = await c.env.DB.prepare(`
    SELECT key,value FROM settings
    WHERE key IN ('welcome_text','membership_channel','support_text')
  `).all<any>()

  const values: Record<string, string> = {}
  for (const item of result.results) values[item.key] = item.value

  return c.html(layout('تنظیمات', `
    <h1>تنظیمات ربات</h1>
    <div class="card">
      <form method="post" action="/dashboard/settings">
        <label>متن خوشامدگویی</label>
        <textarea name="welcome_text">${esc(values.welcome_text || '')}</textarea>
        <label>کانال اجباری</label>
        <input name="membership_channel" value="${esc(values.membership_channel || '')}" placeholder="@YourChannel">
        <label>متن پشتیبانی</label>
        <textarea name="support_text">${esc(values.support_text || '')}</textarea>
        <button>ذخیره</button>
      </form>
    </div>
    <a href="/dashboard">بازگشت</a>
  `))
})

app.post('/dashboard/settings', async c => {
  if (!(await isAdmin(c))) return c.redirect('/dashboard')

  const form = await c.req.parseBody()

  for (const key of ['welcome_text', 'membership_channel', 'support_text']) {
    await c.env.DB.prepare(`
      INSERT INTO settings(key,value) VALUES(?,?)
      ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value
    `).bind(key, String(form[key] || '').slice(0, 2000)).run()
  }

  return c.redirect('/dashboard/settings')
})

app.get('/dashboard/tickets', async c => {
  if (!(await isAdmin(c))) return c.redirect('/dashboard')

  const result = await c.env.DB.prepare(`
    SELECT t.id,t.message,t.status,t.reply,t.created_at,
           u.telegram_id,u.full_name
    FROM tickets t
    JOIN users u ON u.id=t.user_id
    ORDER BY t.id DESC LIMIT 100
  `).all<any>()

  return c.html(layout('تیکت‌ها', `
    <h1>تیکت‌های پشتیبانی</h1>
    <div class="card">
      ${result.results.map((t: any) => `
        <form method="post" action="/dashboard/tickets/${t.id}" class="card">
          <b>#${t.id} — ${esc(t.full_name || String(t.telegram_id))}</b>
          <p>${esc(t.message)}</p>
          <textarea name="reply" placeholder="پاسخ">${esc(t.reply || '')}</textarea>
          <select name="status">
            <option value="open" ${t.status === 'open' ? 'selected' : ''}>باز</option>
            <option value="answered" ${t.status === 'answered' ? 'selected' : ''}>پاسخ داده شد</option>
            <option value="closed" ${t.status === 'closed' ? 'selected' : ''}>بسته</option>
          </select>
          <button>ذخیره پاسخ</button>
        </form>
      `).join('') || 'تیکتی ثبت نشده است.'}
    </div>
    <a href="/dashboard">بازگشت</a>
  `))
})

app.post('/dashboard/tickets/:id', async c => {
  if (!(await isAdmin(c))) return c.redirect('/dashboard')

  const id = Number(c.req.param('id'))
  const form = await c.req.parseBody()
  const reply = String(form.reply || '').slice(0, 4000)
  const status = ['open', 'answered', 'closed'].includes(String(form.status))
    ? String(form.status)
    : 'open'

  const ticket = await c.env.DB.prepare(`
    SELECT t.id,u.telegram_id
    FROM tickets t JOIN users u ON u.id=t.user_id
    WHERE t.id=?
  `).bind(id).first<any>()

  if (!ticket) return c.text('تیکت پیدا نشد', 404)

  await c.env.DB.prepare(
    'UPDATE tickets SET reply=?,status=? WHERE id=?'
  ).bind(reply, status, id).run()

  if (reply && ticket.telegram_id && c.env.BOT_TOKEN) {
    try {
      await tg(c.env, 'sendMessage', {
        chat_id: ticket.telegram_id,
        text: `پاسخ پشتیبانی به تیکت #${id}:\n\n${reply}`
      })
    } catch (error) {
      console.error('Ticket notification failed:', error)
    }
  }

  return c.redirect('/dashboard/tickets')
})

app.get('/dashboard/pg', async c => {
  if (!(await isAdmin(c))) return c.redirect('/dashboard')

  try {
    const [adminInfo, nodes, groups] = await Promise.all([
      pg(c.env, '/api/admin'),
      pg(c.env, '/api/nodes/simple'),
      pg(c.env, '/api/groups/simple')
    ])

    return c.html(layout('PasarGuard', `
      <h1>PasarGuard</h1>
      <div class="card"><b>Admin:</b><pre>${esc(JSON.stringify(adminInfo, null, 2).slice(0, 3000))}</pre></div>
      <div class="card"><b>Nodes:</b><pre>${esc(JSON.stringify(nodes, null, 2).slice(0, 3000))}</pre></div>
      <div class="card"><b>Groups:</b><pre>${esc(JSON.stringify(groups, null, 2).slice(0, 3000))}</pre></div>
      <a href="/dashboard">بازگشت</a>
    `))
  } catch (error) {
    return c.html(layout('خطای PasarGuard', `
      <div class="card">${esc(String(error))}</div>
      <a href="/dashboard">بازگشت</a>
    `), 502)
  }
})

app.get('/api/plans', async c => {
  const result = await c.env.DB.prepare(`
    SELECT id,name,description,price,duration_days,data_limit_gb
    FROM plans WHERE is_active=TRUE ORDER BY sort_order,id
  `).all<any>()

  return json(c, result.results)
})

app.get('/api/users/:id/services', async c => {
  const id = Number(c.req.param('id'))
  if (!Number.isSafeInteger(id) || id <= 0) {
    return json(c, { error: 'invalid user id' }, 400)
  }

  const result = await c.env.DB.prepare(`
    SELECT * FROM services WHERE user_id=? ORDER BY id DESC
  `).bind(id).all<any>()

  return json(c, result.results)
})

app.get('/api/pg/users', async c => {
  if (!(await isAdmin(c))) return json(c, { error: 'unauthorized' }, 401)

  try {
    return json(c, await pg(c.env, '/api/users'))
  } catch (error) {
    return json(c, { error: String(error) }, 502)
  }
})

app.get('/api/pg/user/:id', async c => {
  if (!(await isAdmin(c))) return json(c, { error: 'unauthorized' }, 401)

  const id = Number(c.req.param('id'))
  if (!Number.isSafeInteger(id) || id <= 0) {
    return json(c, { error: 'invalid id' }, 400)
  }

  try {
    return json(c, await pg(c.env, `/api/user/by-id/${id}`))
  } catch (error) {
    return json(c, { error: String(error) }, 502)
  }
})

app.post('/api/pg/user', async c => {
  if (!(await isAdmin(c))) return json(c, { error: 'unauthorized' }, 401)

  try {
    const body = await c.req.json()

    return json(c, await pg(
      c.env,
      c.env.PG_CREATE_USER_PATH || '/api/user',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      }
    ), 201)
  } catch (error) {
    return json(c, { error: String(error) }, 502)
  }
})

app.post('/telegram/:secret', async c => {
  if (c.req.param('secret') !== c.env.TELEGRAM_SECRET) {
    return c.text('not found', 404)
  }

  const update = await c.req.json() as any

  if (update.callback_query) {
    const query = update.callback_query
    const telegramId = Number(query.from?.id)
    const data = String(query.data || '')

    if (data.startsWith('buy:')) {
      const planId = Number(data.slice(4))

      const user = await c.env.DB.prepare(`
        SELECT id,wallet_balance FROM users WHERE telegram_id=?
      `).bind(telegramId).first<any>()

      const plan = await c.env.DB.prepare(`
        SELECT * FROM plans WHERE id=? AND is_active=TRUE
      `).bind(planId).first<any>()

      if (!user || !plan) {
        await tg(c.env, 'answerCallbackQuery', {
          callback_query_id: query.id,
          text: 'پلن یا کاربر پیدا نشد'
        })
      } else {
        const order = await c.env.DB.prepare(`
          INSERT INTO orders(user_id,plan_id,amount,status,payment_method)
          VALUES(?,?,?,'pending','wallet') RETURNING id
        `).bind(user.id, plan.id, plan.price).first<any>()

        await tg(c.env, 'answerCallbackQuery', {
          callback_query_id: query.id,
          text: 'درخواست خرید ثبت شد'
        })

        await tg(c.env, 'sendMessage', {
          chat_id: telegramId,
          text: `🧾 سفارش #${order?.id ?? ''} ثبت شد.
پلن: ${plan.name}
قیمت: ${Number(plan.price).toLocaleString()} تومان

این سفارش هنوز پرداخت نشده و سرویس به‌صورت خودکار فعال نشده است.`
        })
      }
    } else {
      await tg(c.env, 'answerCallbackQuery', {
        callback_query_id: query.id,
        text: 'درخواست نامعتبر'
      })
    }

    return c.json({ ok: true })
  }

  const message = update.message
  if (!message?.chat?.id) return c.json({ ok: true })

  const telegramId = Number(message.from?.id || message.chat.id)
  const fullName = [
    message.from?.first_name,
    message.from?.last_name
  ].filter(Boolean).join('')

  await c.env.DB.prepare(`
    INSERT INTO users(telegram_id,username,full_name)
    VALUES(?,?,?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      username=EXCLUDED.username,
      full_name=EXCLUDED.full_name
  `).bind(
    telegramId,
    message.from?.username || null,
    fullName
  ).run()

  const requiredChannel = (
    await c.env.DB.prepare(`
      SELECT value FROM settings WHERE key='membership_channel'
    `).first<any>()
  )?.value || ''

  if (requiredChannel) {
    try {
      const member = await tg(c.env, 'getChatMember', {
        chat_id: requiredChannel,
        user_id: telegramId
      })

      if (['left', 'kicked'].includes(member.status)) {
        await tg(c.env, 'sendMessage', {
          chat_id: telegramId,
          text: `برای استفاده ابتدا عضو کانال ${requiredChannel} شوید و سپس /start را بزنید.`
        })
        return c.json({ ok: true })
      }
    } catch (error) {
      console.error('Membership check failed:', error)
      await tg(c.env, 'sendMessage', {
        chat_id: telegramId,
        text: 'بررسی عضویت فعلاً انجام نشد؛ لطفاً بعداً تلاش کنید.'
      })
      return c.json({ ok: true })
    }
  }

  const text = String(message.text || '')

  if (text === '/start') {
    const welcome = (
      await c.env.DB.prepare(`
        SELECT value FROM settings WHERE key='welcome_text'
      `).first<any>()
    )?.value || 'سلام 👋 به RoXeT BOT خوش آمدید.'

    await tg(c.env, 'sendMessage', {
      chat_id: telegramId,
      text: `${welcome}\n\n🛒 /plans\n👤 /me\n💰 /wallet\n📦 /services\n🎫 /ticket متن پیام\n📨 /tickets`
    })
  } else if (text === '/plans') {
    const result = await c.env.DB.prepare(`
      SELECT * FROM plans WHERE is_active=TRUE ORDER BY sort_order,id
    `).all<any>()

    await tg(c.env, 'sendMessage', {
      chat_id: telegramId,
      text: result.results.map((plan: any) =>
        `📦 ${plan.name}\n💰 ${Number(plan.price).toLocaleString()} تومان\n⏱ ${plan.duration_days} روز\n📊 ${plan.data_limit_gb ?? 'نامحدود'} GB`
      ).join('\n\n') || 'پلن فعالی وجود ندارد.',
      reply_markup: {
        inline_keyboard: result.results.map((plan: any) => [{
          text: `🛒 درخواست ${plan.name}`,
          callback_data: `buy:${plan.id}`
        }])
      }
    })
  } else if (text === '/me') {
    const user = await c.env.DB.prepare(`
      SELECT * FROM users WHERE telegram_id=?
    `).bind(telegramId).first<any>()

    await tg(c.env, 'sendMessage', {
      chat_id: telegramId,
      text: `👤 ${user?.full_name || user?.username || telegramId}
💰 موجودی: ${Number(user?.wallet_balance || 0).toLocaleString()} تومان
⭐ امتیاز: ${user?.points_balance || 0}`
    })
  } else if (text === '/wallet') {
    const user = await c.env.DB.prepare(`
      SELECT id,wallet_balance,points_balance
      FROM users WHERE telegram_id=?
    `).bind(telegramId).first<any>()

    if (!user) {
      await tg(c.env, 'sendMessage', {
        chat_id: telegramId,
        text: 'کاربر پیدا نشد؛ /start را بزنید.'
      })
      return c.json({ ok: true })
    }

    const transactions = await c.env.DB.prepare(`
      SELECT amount,kind,note,created_at
      FROM wallet_transactions WHERE user_id=?
      ORDER BY id DESC LIMIT 5
    `).bind(user.id).all<any>()

    await tg(c.env, 'sendMessage', {
      chat_id: telegramId,
      text: `💰 کیف پول RoXeT
موجودی: ${Number(user.wallet_balance || 0).toLocaleString()} تومان
🪙 امتیاز: ${user.points_balance || 0}

تراکنش‌های اخیر:
${transactions.results.map((item: any) =>
  `${item.amount > 0 ? '+' : ''}${item.amount} — ${item.note || item.kind}`
).join('\n') || 'تراکنشی ثبت نشده است.'}`
    })
  } else if (text === '/services') {
    const result = await c.env.DB.prepare(`
      SELECT * FROM services
      WHERE user_id=(SELECT id FROM users WHERE telegram_id=?)
      ORDER BY id DESC LIMIT 20
    `).bind(telegramId).all<any>()

    await tg(c.env, 'sendMessage', {
      chat_id: telegramId,
      text: result.results.map((service: any) =>
        `📦 ${service.username}\n⏳ ${service.expires_at || 'نامشخص'}\n🔗 ${service.subscription_url || '—'}`
      ).join('\n\n') || 'سرویسی ندارید.'
    })
  } else if (text.startsWith('/ticket')) {
    const body = text.replace(/^\/ticket\s*/, '').trim()

    if (!body) {
      await tg(c.env, 'sendMessage', {
        chat_id: telegramId,
        text: 'برای ثبت تیکت بنویسید:\n/ticket متن پیام شما'
      })
    } else {
      const user = await c.env.DB.prepare(`
        SELECT id FROM users WHERE telegram_id=?
      `).bind(telegramId).first<any>()

      if (user) {
        await c.env.DB.prepare(`
          INSERT INTO tickets(user_id,message) VALUES(?,?)
        `).bind(user.id, body.slice(0, 4000)).run()
      }

      await tg(c.env, 'sendMessage', {
        chat_id: telegramId,
        text: '✅ تیکت شما ثبت شد.'
      })
    }
  } else if (text === '/tickets') {
    const user = await c.env.DB.prepare(`
      SELECT id FROM users WHERE telegram_id=?
    `).bind(telegramId).first<any>()

    if (!user) {
      await tg(c.env, 'sendMessage', {
        chat_id: telegramId,
        text: 'برای شروع /start را بزنید.'
      })
      return c.json({ ok: true })
    }

    const result = await c.env.DB.prepare(`
      SELECT id,message,status,created_at
      FROM tickets WHERE user_id=?
      ORDER BY id DESC LIMIT 5
    `).bind(user.id).all<any>()

    await tg(c.env, 'sendMessage', {
      chat_id: telegramId,
      text: result.results.map((ticket: any) =>
        `🎫 #${ticket.id} — ${ticket.status}\n${ticket.message}`
      ).join('\n\n') || 'تیکتی ثبت نکرده‌اید.'
    })
  } else if (text.startsWith('/renew')) {
    await tg(c.env, 'sendMessage', {
      chat_id: telegramId,
      text: 'برای تمدید خودکار هنوز اتصال تأییدشده PasarGuard لازم است.'
    })
  } else {
    await tg(c.env, 'sendMessage', {
      chat_id: telegramId,
      text: 'دستورها: /start /plans /me /wallet /services /ticket متن پیام /tickets'
    })
  }

  return c.json({ ok: true })
})

app.all('*', c => c.json({ error: 'not_found' }, 404))

async function main() {
  const db = new DB(pool)
  await db.init()

  const env: Env = {
    DB: db,
    BOT_TOKEN: process.env.BOT_TOKEN,
    TELEGRAM_SECRET: process.env.TELEGRAM_SECRET,
    PG_BASE_URL: process.env.PG_BASE_URL,
    PG_API_KEY: process.env.PG_API_KEY,
    PG_ACCESS_TOKEN: process.env.PG_ACCESS_TOKEN,
    PG_USERNAME: process.env.PG_USERNAME,
    PG_PASSWORD: process.env.PG_PASSWORD,
    PG_CREATE_USER_PATH: process.env.PG_CREATE_USER_PATH,
    ADMIN_USER: process.env.ADMIN_USER || 'admin',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
    APP_NAME: process.env.APP_NAME || 'RoXeT BOT'
  }

  const port = Number(process.env.PORT || 3000)

  serve({
    fetch: (request, serverInfo) => {
      const url = new URL(request.url)

      if (url.pathname.startsWith('/telegram/')) {
        return app.fetch(request, env)
      }

      return app.fetch(request, env)
    },
    port
  })

  console.log(`RoXeT BOT listening on port ${port}`)
}

main().catch(error => {
  console.error('Startup failed:', error)
  process.exit(1)
})
