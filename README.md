# RoXeT BOT — Railway Edition

نسخه Railway از RoXeT BOT با **Node.js + Hono + PostgreSQL** ساخته شده است. لوگوی XR با کیفیت HD داخل پروژه قرار دارد.

## قابلیت‌ها
- ربات تلگرام فارسی و منوی دستورات
- پنل مدیریت `/dashboard`
- کاربران، نقش مدیر، آمار و لاگ
- کیف پول و دفتر تراکنش‌ها
- سکه/امتیاز کاربر
- پلن‌ها و سفارش‌ها
- درخواست خرید و تمدید
- تیکت و پاسخ پشتیبانی از پنل
- عضویت اجباری کانال
- تنظیم متن خوشامد و پشتیبانی
- اتصال قابل تنظیم به API PasarGuard
- PostgreSQL روی Railway
- Health check روی `/health`
- لوگوی XR HD و assetهای پروژه

## نصب با گوشی
1. محتویات این ZIP را در ریشه مخزن GitHub قرار بده؛ پوشه RoXeT-Railway را به صورت پوشه تو در تو نگه ندار.
2. در Railway یک Project بساز.
3. یک **PostgreSQL** به همان Project اضافه کن.
4. سرویس GitHub را به Railway وصل کن. این بسته Dockerfile دارد و Railway باید آن را به‌عنوان روش ساخت انتخاب کند.
5. متغیرهای زیر را در Variables قرار بده. ابتدا PostgreSQL را به همان پروژه اضافه کن:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
BOT_TOKEN=توکن BotFather
TELEGRAM_SECRET=یک رمز طولانی تصادفی
ADMIN_USER=admin
ADMIN_PASSWORD=یک رمز قوی
APP_NAME=RoXeT BOT
PG_BASE_URL=https://آدرس-پاسارگارد
PG_API_KEY=کلید-API-درصورت-وجود
PG_ACCESS_TOKEN=توکن-درصورت-وجود
PG_CREATE_USER_PATH=/api/user
```

6. Deploy را بزن.
7. بعد از Deploy، آدرس Railway را باز کن و `/health` را تست کن.
8. برای وب‌هوک تلگرام، آدرس زیر را به عنوان Webhook تنظیم کن:

```text
https://YOUR-RAILWAY-DOMAIN/telegram/YOUR-TELEGRAM-SECRET
```

## نکته PasarGuard
ساخت و تمدید واقعی کاربر داخل PasarGuard به endpoint و payload دقیق نسخه پنل تو وابسته است. پروژه لایه اتصال API را دارد، ولی قبل از فعال‌سازی خودکار باید `PG_BASE_URL` و روش احراز هویت و endpoint ساخت کاربر مطابق API واقعی پنل تنظیم شود.

## پرداخت
کیف پول داخلی و سفارش‌ها وجود دارد. اتصال درگاه پرداخت خارجی باید با درگاه موردنظر و callback امن آن تنظیم شود؛ پروژه بدون کلید درگاه، پرداخت جعلی یا حدسی انجام نمی‌دهد.
