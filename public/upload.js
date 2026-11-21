/* Hamad TikTok — upload workspace logic */
(function () {
  'use strict';

  var state = {
    status: null,
    step: 0,
    file: null,
    videoEl: null,
    objectUrl: null,
    duration: 0,
    width: 0,
    height: 0,
    covers: [],
    coverIndex: 0,
    caption: '',
    visibility: 'public',
    interaction: { comment: true, duet: true, stitch: true },
    publishing: false,
    published: false
  };

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    navUser: $('navUser'),
    navAvatar: $('navAvatar'),
    navUserName: $('navUserName'),
    navSignOut: $('navSignOut'),
    stepper: $('stepper'),
    accountAlert: $('accountAlert'),
    accountBox: $('accountBox'),
    accountAvatar: $('accountAvatar'),
    accountName: $('accountName'),
    accountSub: $('accountSub'),
    accountBadge: $('accountBadge'),
    connectActions: $('connectActions'),
    loginBtn: $('loginBtn'),
    demoBtn: $('demoBtn'),
    dropzone: $('dropzone'),
    fileInput: $('fileInput'),
    fileRow: $('fileRow'),
    fileThumb: $('fileThumb'),
    fileName: $('fileName'),
    fileSpecs: $('fileSpecs'),
    clearFile: $('clearFile'),
    sampleBtn: $('sampleBtn'),
    caption: $('caption'),
    captionCount: $('captionCount'),
    covers: $('covers'),
    coverHint: $('coverHint'),
    visibility: $('visibility'),
    interaction: $('interaction'),
    reviewList: $('reviewList'),
    reviewAlert: $('reviewAlert'),
    publishBtn: $('publishBtn'),
    progress: $('publishProgress'),
    barFill: $('barFill'),
    phaseLabel: $('phaseLabel'),
    phasePct: $('phasePct'),
    phaseList: $('phaseList'),
    successBox: $('successBox'),
    successText: $('successText'),
    restartBtn: $('restartBtn'),
    reviewActions: $('reviewActions'),
    previewBadge: $('previewBadge'),
    previewVideo: $('previewVideo'),
    previewCover: $('previewCover'),
    previewCaption: $('previewCaption'),
    previewUser: $('previewUser'),
    previewAvatar: $('previewAvatar'),
    phonePlaceholder: $('phonePlaceholder'),
    previewNote: $('previewNote')
  };

  /* ------------------------------------------------------------ *
   * helpers
   * ------------------------------------------------------------ */

  function fmtSize(bytes) {
    if (!bytes) return '—';
    var mb = bytes / (1024 * 1024);
    return mb >= 1 ? mb.toFixed(1) + ' MB' : Math.round(bytes / 1024) + ' KB';
  }

  function fmtDuration(sec) {
    if (!sec || !isFinite(sec)) return '—';
    var m = Math.floor(sec / 60);
    var s = Math.round(sec % 60);
    if (s === 60) { m += 1; s = 0; }
    return m + ':' + String(s).padStart(2, '0');
  }

  function initials(name) {
    if (!name) return '?';
    return name.replace(/^@/, '').slice(0, 2).toUpperCase();
  }

  function alertBox(kind, html) {
    var icons = {
      warn: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 8v.01M12 11v5"/>',
      ok: '<path d="M20 6 9 17l-5-5"/>',
      bad: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>'
    };
    return '<div class="alert alert-' + kind + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + icons[kind] + '</svg><div>' + html + '</div></div>';
  }

  /* ------------------------------------------------------------ *
   * server state
   * ------------------------------------------------------------ */

  function loadState() {
    fetch('/api/tiktok/status', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (s) { state.status = s; renderAccount(); })
      .catch(function () {
        els.accountAlert.innerHTML = alertBox('bad', 'مش قادر أوصل للسيرفر. حدّث الصفحة وحاول تاني.');
      });
  }

  function renderAccount() {
    var st = state.status || {};
    var u = st.connected ? st.user : null;
    var label = '@' + ((u && u.username) || 'account');

    // Navbar account area: profile + sign-out only while connected.
    els.navUser.hidden = !u;
    els.navSignOut.hidden = !u;
    if (u) {
      if (u.avatarUrl) {
        els.navAvatar.innerHTML = '<img src="' + u.avatarUrl + '" alt="">';
      } else {
        els.navAvatar.textContent = initials(u.username);
      }
      els.navUserName.textContent = label;
    }

    if (u) {
      if (u.avatarUrl) {
        els.accountAvatar.innerHTML = '<img src="' + u.avatarUrl + '" alt="">';
      } else {
        els.accountAvatar.textContent = initials(u.username);
      }
      els.accountName.textContent = label;
      els.accountSub.textContent = u.demo
        ? 'حساب تجريبي — مفيش اتصال حقيقي بتيك توك'
        : (u.displayName ? u.displayName : 'مربوط بتيك توك');
      els.accountBadge.innerHTML = u.demo
        ? '<span class="badge badge-demo">تجريبي</span>'
        : '<span class="badge badge-ok">متصل</span>';
      els.connectActions.style.display = 'none';
      els.previewUser.textContent = label;
      els.previewAvatar.innerHTML = u.avatarUrl ? '<img src="' + u.avatarUrl + '" alt="">' : initials(u.username);
    } else {
      els.accountAvatar.textContent = '?';
      els.accountName.textContent = 'مش مربوط';
      els.accountSub.textContent = 'اضغط «تسجيل الدخول بتيك توك» للبدء';
      els.accountBadge.innerHTML = '<span class="badge badge-off">غير مربوط</span>';
      els.connectActions.style.display = 'grid';
    }
  }

  /* ------------------------------------------------------------ *
   * steps
   * ------------------------------------------------------------ */

  function goStep(n) {
    if (n === 2 && !state.file) {
      flash($('dropzone'));
      return;
    }
    if (n === 3 && !state.file) {
      goStep(1);
      flash($('dropzone'));
      return;
    }
    if (state.publishing) return;

    state.step = n;
    document.querySelectorAll('.ws-step').forEach(function (s) {
      s.classList.toggle('active', Number(s.dataset.step) === n);
    });
    els.stepper.querySelectorAll('.step-pill').forEach(function (p) {
      var i = Number(p.dataset.step);
      p.classList.toggle('active', i === n);
      p.classList.toggle('done', i < n);
    });
    if (n === 3) renderReview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function flash(el) {
    if (!el) return;
    el.style.borderColor = 'var(--bad)';
    setTimeout(function () { el.style.borderColor = ''; }, 900);
  }

  document.querySelectorAll('[data-next]').forEach(function (b) {
    b.addEventListener('click', function () { goStep(Number(b.dataset.next)); });
  });
  document.querySelectorAll('[data-back]').forEach(function (b) {
    b.addEventListener('click', function () { goStep(Number(b.dataset.back)); });
  });

  /* ------------------------------------------------------------ *
   * account actions
   * ------------------------------------------------------------ */

  els.loginBtn.addEventListener('click', function (e) {
    if (state.status && !state.status.configured) {
      // server will bounce to /setup.html anyway; make it explicit
      e.preventDefault();
      window.location.href = '/setup.html?state=missing-keys';
    }
  });

  els.demoBtn.addEventListener('click', function () {
    els.demoBtn.disabled = true;
    fetch('/api/tiktok/demo', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (s) { state.status = s; renderAccount(); })
      .catch(function () { els.demoBtn.disabled = false; });
  });

  els.navSignOut.addEventListener('click', function () {
    els.navSignOut.disabled = true;
    fetch('/api/tiktok/disconnect', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (s) { state.status = s; renderAccount(); els.navSignOut.disabled = false; })
      .catch(function () { els.navSignOut.disabled = false; });
  });

  /* ------------------------------------------------------------ *
   * file handling
   * ------------------------------------------------------------ */

  els.dropzone.addEventListener('click', function () { els.fileInput.click(); });
  els.dropzone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.fileInput.click(); }
  });

  ['dragenter', 'dragover'].forEach(function (ev) {
    els.dropzone.addEventListener(ev, function (e) {
      e.preventDefault();
      els.dropzone.classList.add('drag');
    });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    els.dropzone.addEventListener(ev, function (e) {
      e.preventDefault();
      els.dropzone.classList.remove('drag');
    });
  });
  els.dropzone.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
  els.fileInput.addEventListener('change', function () {
    if (els.fileInput.files && els.fileInput.files[0]) handleFile(els.fileInput.files[0]);
  });

  els.clearFile.addEventListener('click', function () {
    els.fileInput.value = '';
    resetFile();
    els.dropzone.style.display = '';
    els.fileRow.classList.remove('show');
  });

  function resetFile() {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
    state.file = null;
    state.covers = [];
    state.coverIndex = 0;
    state.duration = 0;
    els.previewVideo.hidden = true;
    els.previewVideo.removeAttribute('src');
    els.previewCover.hidden = true;
    els.previewCover.removeAttribute('src');
    els.phonePlaceholder.style.display = '';
    els.previewBadge.className = 'badge badge-off';
    els.previewBadge.textContent = 'فارغ';
    els.coverHint.textContent = 'الأغلفة بتتسحب من الفيديو نفسه';
    els.covers.querySelectorAll('.cover').forEach(function (c, i) {
      c.classList.remove('active');
      c.innerHTML = '<span class="ph">غلاف ' + (i + 1) + '</span>';
    });
  }

  function handleFile(file) {
    if (!/^video\//.test(file.type) && !/\.(mp4|mov|webm|m4v)$/i.test(file.name)) {
      els.accountAlert.innerHTML = alertBox('bad', 'الملف ده مش فيديو. اختار MP4 أو MOV أو WebM.');
      return;
    }
    resetFile();
    state.file = file;
    els.dropzone.style.display = 'none';
    els.fileRow.classList.add('show');
    els.fileName.textContent = file.name;
    els.fileSpecs.textContent = fmtSize(file.size) + ' · جاري القراءة…';

    state.objectUrl = URL.createObjectURL(file);
    var v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    v.src = state.objectUrl;

    v.addEventListener('loadedmetadata', function () {
      state.videoEl = v;
      state.duration = v.duration || 0;
      state.width = v.videoWidth || 0;
      state.height = v.videoHeight || 0;
      els.fileSpecs.textContent =
        fmtDuration(state.duration) + ' · ' + state.width + '×' + state.height + ' · ' + fmtSize(file.size);

      // thumbnail
      els.fileThumb.innerHTML = '';
      els.fileThumb.appendChild(v);

      // live preview
      els.previewVideo.hidden = false;
      els.previewVideo.src = state.objectUrl;
      els.previewVideo.play().catch(function () {});
      els.phonePlaceholder.style.display = 'none';
      els.previewBadge.className = 'badge badge-ok';
      els.previewBadge.textContent = 'جاهز';
      els.previewNote.textContent = 'المعاينة تقريبية — الشكل النهائي بيتحدد على تيك توك.';

      extractCovers(v);
    });

    v.addEventListener('error', function () {
      els.fileSpecs.textContent = 'مش قادر أقرأ الملف — جرّب صيغة تانية (MP4)';
    });
  }

  function extractCovers(video) {
    var dur = video.duration;
    if (!dur || !isFinite(dur)) return;
    var points = [0.08, 0.3, 0.55, 0.82];
    var W = 270, H = 480;
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');
    var covers = [];

    function grab(i) {
      if (i >= points.length) {
        state.covers = covers;
        paintCovers();
        els.coverHint.textContent = 'اختار الغلاف اللي يظهر قبل التشغيل';
        return;
      }
      var onSeek = function () {
        try {
          var vw = video.videoWidth, vh = video.videoHeight;
          var targetRatio = W / H;
          var srcRatio = vw / vh;
          var sw, sh, sx, sy;
          if (srcRatio > targetRatio) {
            sh = vh; sw = vh * targetRatio;
            sx = (vw - sw) / 2; sy = 0;
          } else {
            sw = vw; sh = vw / targetRatio;
            sx = 0; sy = (vh - sh) / 2;
          }
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
          covers[i] = canvas.toDataURL('image/jpeg', 0.82);
        } catch (_) {
          covers[i] = null;
        }
        video.removeEventListener('seeked', onSeek);
        grab(i + 1);
      };
      video.addEventListener('seeked', onSeek);
      try {
        video.currentTime = Math.max(0.1, dur * points[i]);
      } catch (_) {
        covers[i] = null;
        grab(i + 1);
      }
    }

    grab(0);
  }

  function paintCovers() {
    els.covers.querySelectorAll('.cover').forEach(function (btn, i) {
      var data = state.covers[i];
      btn.innerHTML = data
        ? '<img src="' + data + '" alt="غلاف ' + (i + 1) + '">'
        : '<span class="ph">غلاف ' + (i + 1) + '</span>';
      btn.classList.toggle('active', i === state.coverIndex);
    });
    if (state.covers[state.coverIndex]) applyCover(state.covers[state.coverIndex]);
  }

  els.covers.addEventListener('click', function (e) {
    var btn = e.target.closest('.cover');
    if (!btn) return;
    state.coverIndex = Number(btn.dataset.i);
    els.covers.querySelectorAll('.cover').forEach(function (c, i) {
      c.classList.toggle('active', i === state.coverIndex);
    });
    if (state.covers[state.coverIndex]) applyCover(state.covers[state.coverIndex]);
  });

  function applyCover(data) {
    els.previewVideo.hidden = true;
    els.previewVideo.pause();
    els.previewCover.hidden = false;
    els.previewCover.src = data;
    els.phonePlaceholder.style.display = 'none';
  }

  els.sampleBtn.addEventListener('click', function () {
    resetFile();
    state.file = { name: 'sample-reel.mp4', size: 12.4 * 1024 * 1024, type: 'video/mp4', sample: true };
    state.duration = 24;
    state.width = 1080;
    state.height = 1920;
    els.dropzone.style.display = 'none';
    els.fileRow.classList.add('show');
    els.fileName.textContent = state.file.name;
    els.fileSpecs.textContent = fmtDuration(state.duration) + ' · 1080×1920 · ' + fmtSize(state.file.size);
    els.fileThumb.innerHTML = '<span style="font-size:11px;color:var(--dim)">نموذج</span>';

    // generated placeholder covers
    state.covers = [0, 1, 2, 3].map(function (i) { return gradientCover(i); });
    state.coverIndex = 0;
    paintCovers();

    els.phonePlaceholder.style.display = 'none';
    els.previewBadge.className = 'badge badge-demo';
    els.previewBadge.textContent = 'نموذج';
    els.previewNote.textContent = 'نموذج تجريبي — الأغلفة دي مولّدة، مش من فيديو حقيقي.';
    goStep(2);
  });

  function gradientCover(i) {
    var c = document.createElement('canvas');
    c.width = 270; c.height = 480;
    var g = c.getContext('2d');
    var palettes = [
      ['#0b2a3d', '#38bdf8'], ['#0a2434', '#22d3ee'],
      ['#101b33', '#7dd3fc'], ['#0c1f2e', '#34d399']
    ];
    var p = palettes[i % palettes.length];
    var grad = g.createLinearGradient(0, 0, 270, 480);
    grad.addColorStop(0, p[0]);
    grad.addColorStop(1, p[1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, 270, 480);
    g.globalAlpha = 0.18;
    for (var k = 0; k < 5; k++) {
      g.beginPath();
      g.arc(60 + k * 45, 120 + k * 62, 40 + k * 9, 0, Math.PI * 2);
      g.fillStyle = '#ffffff';
      g.fill();
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 360, 270, 120);
    g.fillStyle = '#eaf6ff';
    g.font = '600 20px Cairo, sans-serif';
    g.textAlign = 'center';
    g.fillText('نموذج ' + (i + 1), 135, 425);
    return c.toDataURL('image/jpeg', 0.85);
  }

  /* ------------------------------------------------------------ *
   * details
   * ------------------------------------------------------------ */

  els.caption.addEventListener('input', function () {
    state.caption = els.caption.value;
    var n = state.caption.length;
    els.captionCount.textContent = n + ' / 2200';
    els.captionCount.classList.toggle('over', n > 2200);
    els.previewCaption.textContent = state.caption || 'وصف الفيديو هيظهر هنا…';
  });

  els.visibility.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    state.visibility = chip.dataset.v;
    els.visibility.querySelectorAll('.chip').forEach(function (c) {
      c.classList.toggle('active', c === chip);
    });
  });

  els.interaction.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    var key = chip.dataset.i;
    state.interaction[key] = !state.interaction[key];
    chip.classList.toggle('active', state.interaction[key]);
  });

  /* ------------------------------------------------------------ *
   * review
   * ------------------------------------------------------------ */

  function visibilityLabel() {
    return { public: 'الجميع', friends: 'الأصدقاء', private: 'خاص' }[state.visibility] || 'الجميع';
  }

  function renderReview() {
    var st = state.status || {};
    var user = st.user || {};
    var rows = [
      ['الحساب', user.username ? '@' + user.username : 'غير مربوط'],
      ['الملف', state.file ? state.file.name : '—'],
      ['المدة والدقة', fmtDuration(state.duration) + ' · ' + state.width + '×' + state.height],
      ['الحجم', state.file ? fmtSize(state.file.size) : '—'],
      ['الوصف', state.caption ? state.caption.slice(0, 60) + (state.caption.length > 60 ? '…' : '') : 'بدون وصف'],
      ['الغلاف', 'غلاف ' + (state.coverIndex + 1)],
      ['الظهور', visibilityLabel()],
      ['التفاعل', [state.interaction.comment ? 'تعليقات' : null, state.interaction.duet ? 'دويتو' : null, state.interaction.stitch ? 'ستيتش' : null].filter(Boolean).join(' · ') || 'مغلق']
    ];

    els.reviewList.innerHTML = rows.map(function (r) {
      // keep Latin/number-only values in their natural order inside an RTL row
      var dir = /[\u0600-\u06FF]/.test(String(r[1])) ? 'rtl' : 'ltr';
      return '<div class="review-row"><span class="k">' + r[0] + '</span><span class="v" dir="' + dir + '">' + escapeHtml(r[1]) + '</span></div>';
    }).join('');

    els.reviewAlert.innerHTML = '';
    if (st.demo) {
      els.reviewAlert.innerHTML = alertBox('warn',
        '<strong>وضع تجريبي.</strong> هتمشي على كل خطوات النشر، لكن مفيش فيديو هيتبعت فعليًا لتيك توك.');
    } else if (!st.connected) {
      els.reviewAlert.innerHTML = alertBox('warn',
        'الحساب مش مربوط. تقدر تكمل التجربة، بس النشر الحقيقي محتاج تسجيل دخول. <a href="#" id="backToAccount" style="color:var(--accent);text-decoration:underline">ارجع للخطوة 1</a>');
      var back = $('backToAccount');
      if (back) back.addEventListener('click', function (e) { e.preventDefault(); goStep(0); });
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* ------------------------------------------------------------ *
   * publish (simulated pipeline)
   * ------------------------------------------------------------ */

  els.publishBtn.addEventListener('click', function () {
    if (state.publishing || state.published) return;
    state.publishing = true;
    els.publishBtn.disabled = true;
    els.publishBtn.textContent = 'جاري النشر…';
    els.progress.classList.add('show');
    els.reviewActions.style.display = 'none';

    var phases = [
      { label: 'تحضير الملف', pct: 12, ms: 700 },
      { label: 'رفع الأجزاء', pct: 55, ms: 1500 },
      { label: 'معالجة على تيك توك', pct: 82, ms: 1200 },
      { label: 'نشر المنشور', pct: 100, ms: 900 }
    ];

    var i = 0;
    function next() {
      if (i >= phases.length) return finish();
      var ph = phases[i];
      els.phaseLabel.textContent = ph.label + '…';
      els.barFill.style.width = ph.pct + '%';
      els.phasePct.textContent = ph.pct + '%';
      els.phaseList.querySelectorAll('li').forEach(function (li) {
        var p = Number(li.dataset.p);
        li.classList.toggle('active', p === i);
        li.classList.toggle('done', p < i);
      });
      setTimeout(function () {
        i += 1;
        next();
      }, ph.ms);
    }
    next();
  });

  function finish() {
    state.publishing = false;
    state.published = true;
    els.phaseList.querySelectorAll('li').forEach(function (li) {
      li.classList.remove('active');
      li.classList.add('done');
    });
    els.phaseLabel.textContent = 'خلص';
    els.progress.style.display = 'none';

    var demo = !state.status || !state.status.connected || state.status.demo;
    els.successText.textContent = demo
      ? 'المنشور جهز بالكامل. في الوضع التجريبي مفيش فيديو بيتبعت فعليًا لتيك توك — الخطوات والشكل بس.'
      : 'المنشور اتبعت لحسابك @' + (state.status.user ? state.status.user.username : '') + '. راجع تيك توك بعد شوية — المعالجة بتاخد وقت.';
    els.successBox.classList.add('show');
  }

  els.restartBtn.addEventListener('click', function () {
    state.published = false;
    els.successBox.classList.remove('show');
    els.progress.classList.remove('show');
    els.progress.style.display = '';
    els.barFill.style.width = '0%';
    els.phasePct.textContent = '0%';
    els.phaseLabel.textContent = 'جاري التحضير…';
    els.phaseList.querySelectorAll('li').forEach(function (li) { li.classList.remove('active', 'done'); });
    els.publishBtn.disabled = false;
    els.publishBtn.textContent = 'نشر الآن';
    els.reviewActions.style.display = '';
    els.caption.value = '';
    state.caption = '';
    els.previewCaption.textContent = 'وصف الفيديو هيظهر هنا…';
    els.captionCount.textContent = '0 / 2200';
    resetFile();
    els.dropzone.style.display = '';
    els.fileRow.classList.remove('show');
    goStep(0);
  });

  /* ------------------------------------------------------------ *
   * query params + boot
   * ------------------------------------------------------------ */

  function handleQuery() {
    var q = new URLSearchParams(window.location.search);
    if (q.get('error')) {
      var msg = q.get('error');
      var friendly = msg === 'state_mismatch'
        ? 'جلسة الربط انتهت أو مش متطابقة. جرّب «تسجيل الدخول بتيك توك» تاني.'
        : msg;
      els.accountAlert.innerHTML = alertBox('bad', '<strong>الربط مكمّلش.</strong> ' + escapeHtml(friendly));
      window.history.replaceState({}, '', '/upload.html');
    }
    if (q.get('connected')) {
      els.accountAlert.innerHTML = alertBox('ok', '<strong>تم ربط الحساب.</strong> تقدر تكمل للخطوة التالية.');
      window.history.replaceState({}, '', '/upload.html');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadState();
    handleQuery();
    goStep(0);
  });
})();
