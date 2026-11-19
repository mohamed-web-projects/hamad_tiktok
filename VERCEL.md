# النشر على Vercel

المشروع شغال كـ **Node Serverless Function** واحدة (`api/index.js`)، وكل المسارات
(الصفحات + الأصول + الـ API + OAuth) بتروح ليها عبر `vercel.json`.

## قبل ما تنشر

الجلسات والـ OAuth state متخزّنين في **كوكي مشفّر** (AES-GCM) مش في ملف أو في
ذاكرة السيرفر — عشان كده يشتغلوا على Vercel حتى لو كل طلب روح لنسخة مختلفة.
شرط أساسي: `SESSION_SECRET` لازم يكون **نفس القيمة** في كل النسخ.

## الطريقة الأولى: من dashboard فيرسال

1. ارفع المشروع على GitHub (المجلد كله، بما فيه `api/` و `views/` و `public/`).
2. في Vercel → **Add New → Project** → اختر الـ repo.
3. Framework Preset: **Other**. أضف Env Vars:

| المتغير | القيمة |
|---|---|
| `TIKTOK_CLIENT_KEY` | من لوحة تيك توك |
| `TIKTOK_CLIENT_SECRET` | من لوحة تيك توك |
| `TIKTOK_REDIRECT_URI` | `https://<project>.vercel.app/auth/tiktok/callback` |
| `SESSION_SECRET` | سلسلة عشوائية طويلة وثابتة (مثال: `openssl rand -hex 32`) |
| `TIKTOK_SCOPES` | `user.info.basic,user.info.profile,user.info.stats,video.publish` |

4. اضغط **Deploy**. مفيش Build Command ولا Start Command مطلوبين (Vercel يكتشف
   الـ function تلقائياً).

> لو عندك دومين خاص، استخدمه في `TIKTOK_REDIRECT_URI` بدل `*.vercel.app`،
> وسجّل نفس القيمة حرفياً في TikTok Login Kit.

## الطريقة التانية: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel            # preview
vercel --prod     # إنتاج
```

## بعد النشر

- `/healthz` لازم يرجّع `{"ok":true,...}`.
- `/setup.html` هيعرض الـ Redirect URI الفعلي من `/api/config`.
- اختبر وضع التجريبي: `POST /api/tiktok/demo` ثم حدّث الصفحة — لازم يفضل متصل.
- لو حصل `state_mismatch`، أكّد إن `SESSION_SECRET` متحطّ في متغيرات البيئة.

## ملاحظات

- النشر على `*.vercel.app` بيشتغل في Sandbox بتاع تيك توك. قبل مراجعة التطبيق
  استخدم دومين خاص.
- `Dockerfile` و `render.yaml` و `Procfile` لسه موجودين للنشر على Render أو
  منصات تانية؛ Vercel بيتجاهلهم.
- للتشغيل المحلي العادي: `node server.js` (المنفذ الافتراضي 8899) — السيرفر
  مش هيفتح منفذ وهو جوه Vercel.
