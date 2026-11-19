/* Hamad TikTok — setup page */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  function copyText(text, btn) {
    var done = function () {
      var old = btn.textContent;
      btn.textContent = 'تم النسخ ✓';
      btn.style.color = 'var(--ok)';
      setTimeout(function () {
        btn.textContent = old;
        btn.style.color = '';
      }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallback(text, done); });
    } else {
      fallback(text, done);
    }
  }

  function fallback(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (_) {}
    document.body.removeChild(ta);
  }

  fetch('/api/config', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      $('siteUrl').value = cfg.siteUrl;
      $('redirectUri').value = cfg.redirectUri;

      var env = [
        'TIKTOK_CLIENT_KEY=' + 'your_client_key',
        'TIKTOK_CLIENT_SECRET=' + 'your_client_secret',
        'TIKTOK_REDIRECT_URI=' + cfg.redirectUri,
        'TIKTOK_SCOPES=' + cfg.scopes.join(','),
        'SESSION_SECRET=' + 'a_long_random_string'
      ].join('\n');
      $('envBlock').textContent = env;

      var strip = $('statusStrip');
      var slot = $('alertSlot');

      if (cfg.configured) {
        strip.innerHTML =
          '<span class="badge badge-ok">مفعّل ✓</span>' +
          '<span style="color:var(--muted)">المفاتيح موجودة على السيرفر — الربط الحقيقي شغّال.</span>';
        slot.innerHTML =
          '<div class="alert alert-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' +
          '<div>كل حاجة متظبطة. اضغط «جرّب الربط الآن» — المفروض تشوف شاشة موافقة تيك توك الرسمية.</div></div>';
      } else {
        strip.innerHTML =
          '<span class="badge badge-demo">مش مفعّل</span>' +
          '<span style="color:var(--muted)">المفاتيح (<code class="inline">TIKTOK_CLIENT_KEY</code> / <code class="inline">TIKTOK_CLIENT_SECRET</code>) مش متظبطة على السيرفر.</span>';
        slot.innerHTML =
          '<div class="alert alert-warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>' +
          '<div>الموقع شغّال بوضع <strong>تجريبي</strong> لحد ما تحط المفتاحين. ضيفهم في متغيرات البيئة على الاستضافة وبعدها اعمل <strong>Redeploy</strong>.</div></div>';
      }

      // warn about localhost / temporary hosts
      var host = cfg.siteUrl.replace(/^https?:\/\//, '').split('/')[0];
      var temporary = /localhost|127\.0\.0\.1|trycloudflare\.com|loca\.lt|ngrok/i.test(host);
      if (temporary) {
        slot.innerHTML +=
          '<div class="alert alert-info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M12 11v5"/></svg>' +
          '<div>انت على <code class="inline">' + host + '</code> — ده عنوان مؤقت. الربط الحقيقي محتاج عنوان ثابت (Render / Railway / دومين خاص).</div></div>';
      }
    })
    .catch(function () {
      $('statusStrip').innerHTML =
        '<span class="badge badge-demo">خطأ</span><span style="color:var(--muted)">مش قادر أقرأ الإعدادات من السيرفر.</span>';
    });

  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = $(btn.dataset.copy);
      if (input) copyText(input.value, btn);
    });
  });

  $('copyEnv').addEventListener('click', function () {
    copyText($('envBlock').textContent, $('copyEnv'));
  });

  $('testBtn').addEventListener('click', function () { /* plain link */ });

  var y = $('year');
  if (y) y.textContent = new Date().getFullYear();
})();
