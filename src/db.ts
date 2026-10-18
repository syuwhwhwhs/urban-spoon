
import pg from 'pg'

const { Pool } = pg

export type Row = Record<string, any>

function bindSql(sql: string, params: any[]) {
  let i = 0

  return {
    text: sql.replace(/\?/g, () => `$${++i}`),
    values: params
  }
}

class Query {
  constructor(
    private pool: pg.Pool,
    private sql: string,
    private params: any[] = []
  ) {}

  bind(...params: any[]) {
    return new Query(this.pool, this.sql, params)
  }

  async first<T = Row>(): Promise<T | null> {
    const { text, values } = bindSql(this.sql, this.params)
    const result = await this.pool.query(text, values)

    return (result.rows[0] as T | undefined) ?? null
  }

  async all<T = Row>(): Promise<{ results: T[] }> {
    const { text, values } = bindSql(this.sql, this.params)
    const result = await this.pool.query(text, values)

    return { results: result.rows as T[] }
  }

  async run() {
    let sql = this.sql.trim().replace(/;$/, '')

    const isInsert =
      /^insert\s/i.test(sql) &&
      !/\breturning\b/i.test(sql)

    if (
      isInsert &&
      /\bid\b/i.test(sql.split(/\s+values\s+/i)[0] || '')
    ) {
      sql += ' RETURNING id'
    }

    const { text, values } = bindSql(sql, this.params)
    const result = await this.pool.query(text, values)

    return {
      success: true,
      meta: {
        changes: result.rowCount || 0,
        last_row_id: result.rows?.[0]?.id ?? null
      }
    }
  }
}

export class DB {
  constructor(private pool: pg.Pool) {}

  prepare(sql: string): Query {
    return new Query(this.pool, sql)
  }

  async batch(queries: Query[]) {
    const client = await this.pool.connect()

    try {
      await client.query('BEGIN')

      for (const query of queries) {
        const sql = (query as any).sql as string
        const params = (query as any).params as any[]
        const { text, values } = bindSql(sql, params)

        await client.query(text, values)
      }

      await client.query('COMMIT')
      return { success: true }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async init() {
    await this.pool.query(SCHEMA)

    await this.pool.query(`
      INSERT INTO settings(key, value)
      VALUES ('welcome_text', 'سلام 👋 به RoXeT BOT خوش آمدید.')
      ON CONFLICT(key) DO NOTHING
    `)

    await this.pool.query(`
      INSERT INTO settings(key, value)
      VALUES
        ('membership_channel', ''),
        ('support_text', 'برای پشتیبانی دستور /ticket متن پیام را ارسال کنید.')
      ON CONFLICT(key) DO NOTHING
    `)

    await this.pool.query(`
      INSERT INTO plans
        (id, name, description, price, duration_days, data_limit_gb, sort_order)
      VALUES
        (1, 'ماهانه ۳۰ گیگ', 'پلن شروع', 150000, 30, 30, 1),
        (2, 'ماهانه نامحدود', 'یک ماهه', 250000, 30, NULL, 2)
      ON CONFLICT(id) DO NOTHING
    `)

    await this.pool.query(`
      SELECT setval(
        pg_get_serial_sequence('plans', 'id'),
        GREATEST(COALESCE((SELECT MAX(id) FROM plans), 1), 1),
        EXISTS(SELECT 1 FROM plans)
      )
    `)
  }
}

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured')
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: /localhost|127\.0\.0\.1/.test(databaseUrl)
    ? false
    : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000
})

pool.on('error', error => {
  console.error('PostgreSQL pool error:', error)
})

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE,
  username TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  wallet_balance BIGINT NOT NULL DEFAULT 0,
  points_balance BIGINT NOT NULL DEFAULT 0,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plans (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price BIGINT NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 30,
  data_limit_gb DOUBLE PRECISION,
  pg_template_id BIGINT,
  pg_group_ids TEXT,
  pg_username_prefix TEXT,
  pg_username_suffix TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_trial BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  plan_id BIGINT REFERENCES plans(id),
  pg_user_id BIGINT,
  username TEXT NOT NULL,
  subscription_url TEXT,
  data_limit_gb DOUBLE PRECISION,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  plan_id BIGINT NOT NULL REFERENCES plans(id),
  amount BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  provider_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  amount BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  kind TEXT NOT NULL,
  note TEXT,
  admin_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_tg
  ON users(telegram_id);

CREATE INDEX IF NOT EXISTS idx_services_user
  ON services(user_id);

CREATE INDEX IF NOT EXISTS idx_orders_user
  ON orders(user_id);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user
  ON wallet_transactions(user_id, id DESC);
`
