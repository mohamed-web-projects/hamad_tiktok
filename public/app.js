/* Hamad TikTok — shared client script (home page + global chrome) */
(function () {
  'use strict';

  /* ---------- year ---------- */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  /* ---------- mobile menu ---------- */
  var toggle = document.getElementById('menuToggle');
  var nav = document.getElementById('nav');
  var header = document.querySelector('.site-header');
  if (toggle && nav) {
    function setMenu(open) {
      nav.classList.toggle('open', open);
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'القائمة');
    }
    setMenu(false);
    toggle.addEventListener('click', function () {
      setMenu(!nav.classList.contains('open'));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        setMenu(false);
        toggle.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('open') && header && !header.contains(e.target)) setMenu(false);
    });
  }

  /* ---------- interactive tour ---------- */
  var steps = Array.prototype.slice.call(document.querySelectorAll('.tour-step'));
  var dots = Array.prototype.slice.call(document.querySelectorAll('.dot-btn'));
  var nowEl = document.getElementById('tourNow');
  var nextBtn = document.getElementById('tourNext');
  var prevBtn = document.getElementById('tourPrev');
  var current = 0;

  function render(i) {
    current = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach(function (s, idx) { s.classList.toggle('active', idx === current); });
    dots.forEach(function (d, idx) { d.classList.toggle('active', idx === current); });
    if (nowEl) nowEl.textContent = String(current + 1).padStart(2, '0');
    if (prevBtn) prevBtn.disabled = current === 0;
    if (nextBtn) {
      nextBtn.textContent = current === steps.length - 1 ? 'افتح مساحة الرفع' : 'الخطوة التالية';
    }
  }

  if (steps.length) {
    render(0);

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (current === steps.length - 1) {
          window.location.href = '/upload.html';
        } else {
          render(current + 1);
        }
      });
    }
    if (prevBtn) prevBtn.addEventListener('click', function () { render(current - 1); });

    dots.forEach(function (d) {
      d.addEventListener('click', function () { render(Number(d.dataset.go)); });
    });

    document.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') render(current + 1);
      if (e.key === 'ArrowRight') render(current - 1);
    });
  }

  /* ---------- global account state (every page) ---------- */
  (function () {
    var actions = document.querySelector('.header-actions');
    if (!actions || !toggle) return;

    var chip = document.createElement('a');
    chip.className = 'nav-user';
    chip.id = 'navUser';
    chip.hidden = true;
    chip.innerHTML = '<span class="nav-avatar" id="navAvatar">?</span><span class="nav-user-name" id="navUserName"></span>';

    var signOut = document.createElement('button');
    signOut.className = 'icon-btn signout-btn';
    signOut.id = 'navSignOut';
    signOut.type = 'button';
    signOut.hidden = true;
    signOut.setAttribute('aria-label', 'تسجيل الخروج');
    signOut.title = 'تسجيل الخروج';
    signOut.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>';

    actions.insertBefore(chip, toggle);
    actions.insertBefore(signOut, toggle);

    var modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'logoutModal';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="logoutModalTitle" aria-describedby="logoutModalText">' +
      '<h3 id="logoutModalTitle">تأكيد تسجيل الخروج</h3>' +
      '<p id="logoutModalText">هل أنت متأكد من تسجيل الخروج؟</p>' +
      '<div class="modal-actions">' +
      '<button class="btn btn-ghost" id="logoutCancel" type="button">إلغاء</button>' +
      '<button class="btn btn-primary" id="logoutConfirm" type="button">تسجيل الخروج</button>' +
      '</div></div>';
    document.body.appendChild(modal);

    var avatar = document.getElementById('navAvatar');
    var name = document.getElementById('navUserName');
    var cancel = document.getElementById('logoutCancel');
    var confirm = document.getElementById('logoutConfirm');

    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
    }
    function initials(v) {
      if (!v) return '?';
      return String(v).replace(/^@/, '').slice(0, 2).toUpperCase();
    }

    function applyStatus(s) {
      var user = s && s.connected ? s.user : null;
      chip.hidden = !user;
      signOut.hidden = !user;
      if (user) {
        avatar.innerHTML = user.avatarUrl ? '<img src="' + esc(user.avatarUrl) + '" alt="">' : esc(initials(user.username));
        name.textContent = '@' + (user.username || 'account');
        chip.title = name.textContent;
        if (user.profileLink) {
          chip.href = user.profileLink;
          chip.target = '_blank';
          chip.rel = 'noopener noreferrer';
        } else {
          chip.removeAttribute('href');
          chip.removeAttribute('target');
          chip.removeAttribute('rel');
        }
      }
      document.dispatchEvent(new CustomEvent('hamad:authchange', { detail: { status: s, user: user } }));
    }

    fetch('/api/tiktok/status', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(applyStatus)
      .catch(function () { applyStatus(null); });

    function showModal(open) {
      modal.hidden = !open;
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) confirm.focus();
      else if (!signOut.hidden) signOut.focus();
    }
    signOut.addEventListener('click', function () { showModal(true); });
    cancel.addEventListener('click', function () { showModal(false); });
    modal.addEventListener('click', function (e) { if (e.target === modal) showModal(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) showModal(false);
    });

    confirm.addEventListener('click', function () {
      confirm.disabled = true;
      signOut.disabled = true;
      function done() {
        confirm.disabled = false;
        signOut.disabled = false;
        showModal(false);
      }
      fetch('/api/tiktok/disconnect', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (s) { applyStatus(s); done(); })
        .catch(function () { done(); });
    });
  })();

  /* ---------- animated background ---------- */
  var canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ctx = canvas.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w = 0, h = 0, dust = [], rings = [];

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    dust = [];
    var count = Math.min(90, Math.floor((w * h) / 22000));
    for (var i = 0; i < count; i++) {
      dust.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.3,
        a: Math.random() * 0.45 + 0.1,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12
      });
    }

    rings = [
      { cx: w * 0.82, cy: h * 0.22, r: Math.min(w, h) * 0.34, speed: 0.00022, tilt: 0.42 },
      { cx: w * 0.82, cy: h * 0.22, r: Math.min(w, h) * 0.46, speed: -0.00016, tilt: 0.55 },
      { cx: w * 0.16, cy: h * 0.78, r: Math.min(w, h) * 0.3, speed: 0.00013, tilt: 0.5 }
    ];
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    // additive blending: the canvas can only add light, never darken the page
    ctx.globalCompositeOperation = 'lighter';

    // orbital rings
    rings.forEach(function (ring) {
      var phase = t * ring.speed;
      ctx.save();
      ctx.translate(ring.cx, ring.cy);
      ctx.rotate(phase);
      ctx.scale(1, ring.tilt);
      ctx.beginPath();
      ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.10)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // travelling glow on the ring
      var angle = phase * 2.4;
      var px = Math.cos(angle) * ring.r;
      var py = Math.sin(angle) * ring.r;
      var g = ctx.createRadialGradient(px, py, 0, px, py, 26);
      g.addColorStop(0, 'rgba(56, 189, 248, 0.5)');
      g.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.beginPath();
      ctx.arc(px, py, 26, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    });

    // dust
    dust.forEach(function (p) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -5) p.x = w + 5;
      if (p.x > w + 5) p.x = -5;
      if (p.y < -5) p.y = h + 5;
      if (p.y > h + 5) p.y = -5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(160, 210, 255, ' + p.a + ')';
      ctx.fill();
    });

    ctx.globalCompositeOperation = 'source-over';
  }

  var raf = null;
  function loop(t) {
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener('resize', function () {
    resize();
    if (reduce) draw(0);
  });

  if (reduce) {
    draw(0);
  } else {
    raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
      } else if (!raf) {
        raf = requestAnimationFrame(loop);
      }
    });
  }
})();
