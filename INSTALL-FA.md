# آموزش نصب RoXeT BOT روی Railway با گوشی

### مرحله ۱ — GitHub
ZIP را دانلود و از حالت فشرده خارج کن و همه فایل‌ها را داخل یک Repository جدید مثل `roxet-bot-railway` قرار بده.

### مرحله ۲ — Railway
در Railway یک Project بساز و از بخش **Add Service → Database → PostgreSQL** دیتابیس اضافه کن. سپس Repository گیت‌هاب را به عنوان سرویس Deploy کن.

### مرحله ۳ — Variables
در سرویس Bot بخش Variables را باز کن و این موارد را بگذار:

- `DATABASE_URL` = متغیر اتصال PostgreSQL. در Railway معمولاً `${{Postgres.DATABASE_URL}}`
- `BOT_TOKEN` = توکن BotFather
- `TELEGRAM_SECRET` = یک عبارت تصادفی طولانی
- `ADMIN_USER` = نام کاربری پنل
- `ADMIN_PASSWORD` = رمز قوی پنل
- `APP_NAME` = `RoXeT BOT`
- `PG_BASE_URL` = آدرس API پاسارگارد
- `PG_API_KEY` یا `PG_ACCESS_TOKEN` = روش احراز هویت واقعی پنل
- `PG_CREATE_USER_PATH` = endpoint ساخت کاربر واقعی در نسخه PasarGuard تو

### مرحله ۴ — Deploy
Railway خودش `npm ci` و `npm run build` را اجرا می‌کند و سپس `npm start` را اجرا می‌کند.

### مرحله ۵ — تست
در مرورگر گوشی باز کن:

`https://دامنه-Railway/health`

باید JSON با `ok: true` ببینی.

پنل مدیریت:

`https://دامنه-Railway/dashboard`

### مرحله ۶ — Webhook
Webhook را روی این مسیر قرار بده:

`https://دامنه-Railway/telegram/TELEGRAM_SECRET`

ربات باید `POST` را دریافت کند.

### نکته مهم
PasarGuard و پرداخت دو اتصال خارجی هستند. تا زمانی که endpoint واقعی API PasarGuard و مشخصات درگاه وارد نشوند، پروژه اطلاعات ساختگی تولید نمی‌کند و خرید را به اشتباه موفق اعلام نمی‌کند.
