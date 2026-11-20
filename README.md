# Hamad TikTok

> للنشر على **Vercel**: اتبع [VERCEL.md](VERCEL.md). الباقي من الملف بيشرح النشر على Render.

مساحة عمل لصنّاع المحتوى على تيك توك: تختار الفيديو، تضبط التفاصيل والغلاف، تراجع المنشور، ثم تنشره على حسابك عبر واجهات تيك توك الرسمية.

> ⚠️ **حالة النشر:** ربط الحساب (Login Kit) حقيقي بالكامل. **إرسال الفيديو** لسه محاكاة على الواجهة لحد ما تطبيقك يعدّي مراجعة **Content Posting API** — التفاصيل في آخر الملف.

---

## التشغيل محليًا

```bash
cd hamad-tiktok
cp .env.example .env      # اختياري: املأ TIKTOK_CLIENT_KEY و TIKTOK_CLIENT_SECRET
npm start                 # أو npm run dev — بيقرأ .env تلقائيًا
```

بعدها افتح `http://localhost:8899`. مفيش `npm install` مطلوب (مفيش اعتماديات).

على Windows ممكن تستخدم PowerShell بدل `cp`:
```powershell
Copy-Item .env.example .env
npm start
```

بدون مفاتيح، الموقع بيشتغل عادي في **الوضع التجريبي** — كل شاشة فيها شارة صفراء واضحة، ومفيش أي حالة ربط وهمية.

> **مهم:** تيك توك مش بيقبل `localhost` كـ Redirect URI في معظم الحالات. للتجربة الحقيقية استخدم استضافة بعنوان HTTPS (Render / Railway / نفق بـ HTTPS).

---

## الصفحات

| المسار | إيه فيه |
|---|---|
| `/` | الهيرو + الجولة التفاعلية 4 خطوات + أقسام الشرح |
| `/upload.html` | مساحة الرفع: الحساب → الفيديو → التفاصيل → المراجعة والنشر |
| `/setup.html` | حالة التفعيل + الـ Redirect URI + متغيرات البيئة |
| `/faq.html` | 12 سؤال |
| `/privacy.html` · `/terms.html` | الخصوصية والشروط (عربي + ملخص إنجليزي) |

## الـ API

| المسار | الوظيفة |
|---|---|
| `GET /auth/tiktok` | يبدأ OAuth (PKCE + state) ويحوّل على tiktok.com |
| `GET /auth/tiktok/callback` | يبادل الكود بتوكن، يجيب الحساب، يفتح جلسة |
| `GET /api/tiktok/status` | حالة الربط + بيانات الحساب (بدون أي توكن) |
| `POST /api/tiktok/demo` | وضع تجريبي صريح |
| `POST /api/tiktok/disconnect` | فصل الحساب |
| `GET /api/config` | Site URL + Redirect URI + الصلاحيات |
| `GET /healthz` | فحص صحة للاستضافة |

---

## النشر على Render

**1. ارفع المشروع على GitHub**

```bash
git init
git add .
git commit -m "Hamad TikTok"
git branch -M main
git remote add origin https://github.com/<user>/hamad-tiktok.git
git push -u origin main
```

**2. Render → New + → Web Service → Public Git Repository** والصق رابط الريبو.

| الحقل | القيمة |
|---|---|
| Language | `Node` |
| Build Command | `npm install` |
| Start Command | `node local-server.js` |
| Plan | `Free` |
| Health Check Path | `/healthz` |

أو من **New + → Blueprint** و Render هيقرأ `render.yaml` لوحده.

**3. Environment → أضف:**

```
TIKTOK_CLIENT_KEY     = ...
TIKTOK_CLIENT_SECRET  = ...
TIKTOK_REDIRECT_URI   = https://<service>.onrender.com/auth/tiktok/callback
SESSION_SECRET        = (سلسلة عشوائية طويلة)
```

**4. ارجع لتيك توك** وحط نفس الـ Redirect URI في Login Kit، وبعدها `Redeploy`.

> الخطة المجانية على Render بتنام بعد 15 دقيقة خمول؛ أول طلب بعدها بياخد ~30 ثانية. الجلسات محفوظة في `data/sessions.json` فمش هتتفصل بعد إعادة التشغيل (لكن الملف مؤقت على الاستضافات اللي بتعمل rebuild من نضيف — للإنتاج الحقيقي استخدم Postgres/SQLite دائم).

---

## إعداد تطبيق تيك توك

1. [developers.tiktok.com](https://developers.tiktok.com) → **Manage apps → Connect an app** → **Web** → الاسم `Hamad TikTok`.
2. **Add product → Login Kit** → حط **Redirect URI** بالحرف من `/setup.html`.
3. **Scopes:** `user.info.basic` · `user.info.profile` · `user.info.stats` · `video.publish`.
4. **Sandbox → Add testers** → ضيف حسابك للتجربة.
5. انسخ **Client Key** + **Client Secret** → متغيرات البيئة → Redeploy.

### أصول المراجعة (Review assets)

| الحقل | القيمة |
|---|---|
| Terms of Service | `https://<domain>/terms.html` |
| Privacy Policy | `https://<domain>/privacy.html` |
| App icon | أي صورة 1024×1024 مربعة |

---

## بنية المشروع

```
hamad-tiktok/
├── local-server.js    # نقطة التشغيل المحلية / Render
├── core/app.js        # السيرفر + OAuth + الجلسات + الـ API (بدون اعتماديات)
├── api/index.js       # نقطة دخول Vercel (Serverless Function)
├── vercel.json        # إعادة توجيه كل المسارات للـ function
├── VERCEL.md          # خطوات النشر على Vercel
├── package.json
├── views/             # الصفحات (HTML)
│   ├── index.html
│   ├── upload.html
│   ├── setup.html
│   ├── faq.html
│   ├── privacy.html
│   └── terms.html
├── public/
│   ├── styles.css     # نظام التصميم
│   ├── app.js         # خلفية Canvas + الجولة التفاعلية
│   ├── upload.js      # منطق مساحة الرفع بالكامل
│   ├── setup.js
│   └── favicon.svg
├── render.yaml        # Blueprint لـ Render
├── Dockerfile · Procfile
└── .env.example
```

مفيش `npm install` محتاج أي باكدج — السيرفر بيستخدم `node:http` و`fetch` المدمجين في Node 18+.

---

## اللي لسه محاكاة (وبصراحة)

| الجزء | الحالة |
|---|---|
| تسجيل الدخول / ربط الحساب | ✅ حقيقي (TikTok Login Kit + PKCE) |
| قراءة الفيديو واستخراج الأغلفة | ✅ حقيقي، محليًا في المتصفح |
| المعاينة 9:16 | ✅ حقيقية |
| إرسال الفيديو لتيك توك | ⚠️ محاكاة — محتاج موافقة `video.publish` على مستوى التطبيق |

### تفعيل النشر الحقيقي

1. تقديم التطبيق للمراجعة واختيار **Content Posting API** (Direct Post).
2. بعد الموافقة، أضف في `core/app.js` مسار `POST /api/tiktok/publish`:

```
POST https://open.tiktokapis.com/v2/post/publish/video/init/
Authorization: Bearer <user access_token>
{
  "post_info": { "title": "...", "privacy_level": "PUBLIC_TO_EVERYONE",
                 "disable_comment": false, "disable_duet": false, "disable_stitch": false },
  "source_info": { "source": "FILE_UPLOAD", "video_size": <bytes>,
                   "chunk_size": <bytes>, "total_chunk_count": <n> }
}
```

3. الرد بيرجّع `upload_url` + `publish_id` → ارفع الفيديو بـ `PUT` على `upload_url` في أجزاء.
4. تابع الحالة: `POST /v2/post/publish/status/fetch/` بالـ `publish_id`.

الحساب اللي لسه متمرشّحش بيقدر ينشر بـ `privacy_level: "SELF_ONLY"` بس (مسودة/خاص).

---

## ملاحظات أمان

- الـ `Client Secret` بيقعد على السيرفر بس — مش بيوصل للمتصفح أبدًا.
- التوكنات في الجلسة على السيرفر، والكوكي `HttpOnly` + `SameSite=Lax` + `Secure` على HTTPS.
- `data/` و`.env` مستثنين في `.gitignore`.
- مفيش أي تخزين لملفات الفيديو.
#   h a m a d _ t i k t o k  
 