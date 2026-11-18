/* =========================================================
   Üzeyir Hacıbəylinin Ev-Muzeyi — interaktivlik və animasiya
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Preloader ---------- */
  document.body.classList.add('is-loading');
  const finishLoading = () => {
    const pre = $('.preloader');
    pre.classList.add('is-done');
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    setTimeout(() => pre.remove(), 1200);
  };
  // şriftlər hazır olanda (və ya ən geci 3 san. sonra) açılır — xəritə iframe-ini gözləmir
  let loaded = false;
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise(r => setTimeout(r, 3000))]).then(() => {
    if (loaded) return; loaded = true;
    setTimeout(finishLoading, reduceMotion ? 0 : 1300);
  });

  $('#year').textContent = new Date().getFullYear();

  /* ---------- Header ---------- */
  const header = $('#header');
  let lastY = 0;
  const onScroll = () => {
    const y = scrollY;
    header.classList.toggle('is-scrolled', y > 40);
    header.classList.toggle('is-hidden', y > lastY && y > 600 && !$('#nav').classList.contains('is-open'));
    lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobil menyu ---------- */
  const burger = $('#burger'), nav = $('#nav');
  const setMenu = open => {
    burger.setAttribute('aria-expanded', open);
    nav.classList.toggle('is-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  $$('a', nav).forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- Aktiv bölmə ---------- */
  const navLinks = $$('.nav a[href^="#"]');
  const sectionIO = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      navLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach(s => sectionIO.observe(s));

  /* ---------- Scroll reveal ---------- */
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      revealIO.unobserve(en.target);
    });
  }, { threshold: .15, rootMargin: '0px 0px -40px 0px' });

  // qonşu elementlərə ardıcıl gecikmə
  $$('.reveal, .staff-divider').forEach(el => {
    const sibs = $$(':scope > .reveal', el.parentElement);
    const i = sibs.indexOf(el);
    if (i > 0) el.style.setProperty('--d', Math.min(i, 6) * 0.08 + 's');
    revealIO.observe(el);
  });

  /* ---------- Rəqəm sayğacları ---------- */
  const countIO = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target, end = +el.dataset.count, suf = el.dataset.suffix || '';
      const start = end > 1000 ? end - 120 : 0, dur = 1800, t0 = performance.now();
      const tick = t => {
        const p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(start + (end - start) * e) + suf;
        if (p < 1) requestAnimationFrame(tick);
      };
      if (!reduceMotion) requestAnimationFrame(tick);
      countIO.unobserve(el);
    });
  }, { threshold: .6 });
  $$('[data-count]').forEach(el => countIO.observe(el));

  /* =========================================================
     SƏS — tar səsinə yaxın "Karplus-Strong" sintezi
     Şur məqamı (D-də): D E F G A B♭ C D
     ========================================================= */
  const SHUR = [293.66, 329.63, 349.23, 392.0, 440.0, 466.16, 523.25, 587.33];
  let ctx = null, soundOn = false;
  const ensureCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const pluck = (freq, when = 0, gain = .32) => {
    const ac = ensureCtx();
    const sr = ac.sampleRate, len = Math.floor(sr * 1.6), N = Math.floor(sr / freq);
    const buf = ac.createBuffer(1, len, sr), d = buf.getChannelData(0);
    const ring = new Float32Array(N).map(() => Math.random() * 2 - 1);
    for (let i = 0, p = 0; i < len; i++) {
      const next = (p + 1) % N;
      const v = (ring[p] + ring[next]) * 0.5 * 0.996;
      d[i] = ring[p]; ring[p] = v; p = next;
    }
    const src = ac.createBufferSource(); src.buffer = buf;
    const g = ac.createGain(); g.gain.value = gain;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200;
    src.connect(f).connect(g).connect(ac.destination);
    src.start(ac.currentTime + when);
  };
  /* =========================================================
     «KOROĞLU» UVERTÜRASI — YouTube IFrame API (gizli pleyer)
     API yalnız ilk klikdə yüklənir ki, səhifə ağırlaşmasın.
     ========================================================= */
  const OVERTURE_ID = 'ozHmoAlQ9ws';
  const soundBtn = $('#soundToggle'), soundBox = soundBtn.closest('.sound');
  let yt = null, ytReady = null, overturePlaying = false;

  const setPlayingUI = playing => {
    overturePlaying = playing;
    soundBtn.setAttribute('aria-pressed', playing);
    soundBox.classList.toggle('is-playing', playing);
    soundBox.classList.remove('is-loading');
  };

  const loadYouTube = () => ytReady || (ytReady = new Promise((resolve, reject) => {
    const create = () => {
      yt = new YT.Player('ytPlayer', {
        videoId: OVERTURE_ID,
        width: 1, height: 1,
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => resolve(yt),
          onStateChange: e => {
            if (e.data === YT.PlayerState.PLAYING) setPlayingUI(true);
            else if (e.data === YT.PlayerState.PAUSED) setPlayingUI(false);
            else if (e.data === YT.PlayerState.ENDED) { setPlayingUI(false); yt.seekTo(0); yt.pauseVideo(); }
          },
          onError: e => { setPlayingUI(false); console.warn('YouTube pleyer xətası:', e.data); reject(e); }
        }
      });
    };
    if (window.YT && YT.Player) return create();
    window.onYouTubeIframeAPIReady = create;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = reject;
    document.head.appendChild(s);
  }));

  soundBtn.addEventListener('click', async () => {
    if (overturePlaying && yt) { yt.pauseVideo(); setPlayingUI(false); return; }
    soundBox.classList.add('is-loading');
    try {
      const p = await loadYouTube();
      p.setVolume(80);
      p.playVideo();
    } catch {
      soundBox.classList.remove('is-loading');
      // pleyer işləmədisə — videonu yeni pəncərədə aç
      window.open('https://www.youtube.com/watch?v=' + OVERTURE_ID, '_blank', 'noopener');
    }
  });

  // tab gizlədiləndə musiqi davam edir; istəsəniz bu sətri aktiv edin:
  // document.addEventListener('visibilitychange', () => { if (document.hidden && yt && overturePlaying) yt.pauseVideo(); });

  /* ---------- Hero: canlı not xətləri (canvas) ---------- */
  const canvas = $('#heroStaff');
  if (canvas && !reduceMotion) {
    const c = canvas.getContext('2d');
    let w, h, dpr, mouse = { x: -999, y: -999 }, t = 0, running = true;
    const notes = [];
    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize(); addEventListener('resize', resize);
    canvas.parentElement.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    canvas.parentElement.addEventListener('pointerleave', () => { mouse.x = mouse.y = -999; });

    // mobildə xətlər mətnin üstünə düşməsin deyə aşağıya
    const staffY = () => (w < 900 ? h - 150 : h * 0.72);
    const gap = 16;
    const yAt = (x, line) => {
      const base = staffY() + line * gap;
      const wave = Math.sin(x * 0.004 + t * 0.6 + line * 0.35) * 14 + Math.sin(x * 0.011 - t * 0.9) * 4;
      const dx = x - mouse.x, dy = base - mouse.y, dist = Math.hypot(dx, dy);
      const push = dist < 180 ? (1 - dist / 180) * 26 * Math.sin(t * 6 + x * 0.05) : 0;
      return base + wave + push;
    };
    const spawn = () => notes.push({ x: w + 30, line: Math.floor(Math.random() * 9) / 2, s: 0.5 + Math.random() * 0.6, beam: Math.random() < .3, a: 0 });
    for (let i = 0; i < 8; i++) { spawn(); notes[i].x = Math.random() * w; }

    const drawNote = (x, y, n) => {
      c.save(); c.translate(x, y); c.scale(n.s, n.s);
      c.fillStyle = c.strokeStyle = `rgba(232,211,160,${0.55 * n.a})`;
      c.lineWidth = 2;
      c.beginPath(); c.ellipse(0, 0, 8, 5.6, -0.4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(7, -2); c.lineTo(7, -44); c.stroke();
      if (n.beam) { c.beginPath(); c.moveTo(7, -44); c.quadraticCurveTo(18, -34, 14, -20); c.stroke(); }
      c.restore();
    };

    const frame = () => {
      if (!running) return requestAnimationFrame(frame);
      t += 0.016;
      c.clearRect(0, 0, w, h);
      // 5 xətt
      for (let l = 0; l < 5; l++) {
        const grad = c.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, 'rgba(201,164,92,0)');
        grad.addColorStop(.2, 'rgba(201,164,92,.28)');
        grad.addColorStop(.85, 'rgba(201,164,92,.28)');
        grad.addColorStop(1, 'rgba(201,164,92,0)');
        c.strokeStyle = grad; c.lineWidth = 1;
        c.beginPath();
        for (let x = 0; x <= w; x += 8) { const y = yAt(x, l); x ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke();
      }
      // notlar
      for (let i = notes.length - 1; i >= 0; i--) {
        const n = notes[i];
        n.x -= 0.6 * n.s; n.a = Math.min(1, n.a + 0.01);
        drawNote(n.x, yAt(n.x, n.line), n);
        if (n.x < -40) notes.splice(i, 1);
      }
      if (notes.length < 10 && Math.random() < 0.012) spawn();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    new IntersectionObserver(([en]) => { running = en.isIntersecting; }).observe(canvas);
  }

  /* ---------- Hero: kursordan uçan notlar ---------- */
  const trail = $('#cursorNote'), hero = $('#hero');
  if (trail && !reduceMotion && matchMedia('(pointer: fine)').matches) {
    let last = 0;
    hero.addEventListener('pointermove', e => {
      const now = performance.now();
      if (now - last < 140) return;
      last = now;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 40 80');
      svg.innerHTML = '<use href="#note1"/>';
      svg.style.left = e.clientX + 'px'; svg.style.top = e.clientY + 'px';
      svg.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px');
      svg.style.setProperty('--r', (Math.random() * 60 - 30) + 'deg');
      trail.appendChild(svg);
      setTimeout(() => svg.remove(), 1400);
    });
  }

  /* ---------- Həyat yolu: partitura ---------- */
  const score = $('#score'), track = $('#scoreTrack');
  if (score) {
    const events = $$('.event', track);
    events.forEach((ev, i) => {
      ev.style.setProperty('--p', ev.dataset.pitch);
      ev.style.setProperty('--i', i);
      // notlar: kliklə həmişə, hover ilə isə yalnız istifadəçi bir dəfə not çaldıqdan sonra
      // (uvertüra səslənərkən hover səsləri susur ki, musiqiyə qarışmasın)
      const play = () => {
        pluck(SHUR[+ev.dataset.pitch] || SHUR[0]);
        ev.classList.remove('is-playing'); void ev.offsetWidth; ev.classList.add('is-playing');
      };
      ev.addEventListener('pointerenter', e => {
        if (e.pointerType === 'mouse' && soundOn && !overturePlaying) play();
      });
      $('.event__note', ev).addEventListener('click', () => { soundOn = true; play(); });
    });

    new IntersectionObserver(([en], obs) => {
      if (en.isIntersecting) { score.classList.add('is-in'); obs.disconnect(); }
    }, { threshold: .25 }).observe(score);

    // sürüşdürmə ilə idarə
    let down = false, startX = 0, startScroll = 0, moved = false;
    track.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse') return;
      down = true; moved = false; startX = e.clientX; startScroll = track.scrollLeft;
    });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) { moved = true; track.classList.add('is-dragging'); }
      track.scrollLeft = startScroll - dx;
    });
    addEventListener('pointerup', () => { down = false; track.classList.remove('is-dragging'); });
    track.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);

    const bar = $('#scoreBar');
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      bar.style.width = (max > 0 ? (track.scrollLeft / max) * 100 : 100) + '%';
    };
    track.addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update); update();
    const step = () => events[0].getBoundingClientRect().width * 2;
    $('#scorePrev').addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    $('#scoreNext').addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
  }

  /* ---------- Əsərlər filtri ---------- */
  const filters = $$('.filter'), works = $$('.work');
  filters.forEach(btn => btn.addEventListener('click', () => {
    filters.forEach(b => { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-selected', b === btn); });
    const f = btn.dataset.filter;
    let i = 0;
    works.forEach(w => {
      const show = f === 'all' || w.dataset.cat === f;
      w.classList.toggle('is-hidden', !show);
      w.classList.remove('is-entering');
      if (show) { void w.offsetWidth; w.style.animationDelay = (i++ * 50) + 'ms'; w.classList.add('is-entering'); }
    });
  }));

  // kartlarda 3D əyilmə
  if (!reduceMotion && matchMedia('(pointer: fine)').matches) {
    works.forEach(w => {
      w.addEventListener('pointermove', e => {
        const r = w.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        w.style.transform = `translateY(-6px) perspective(800px) rotateX(${-y * 5}deg) rotateY(${x * 6}deg)`;
      });
      w.addEventListener('pointerleave', () => { w.style.transform = ''; });
    });
  }

  /* ---------- Qalereya lightbox ---------- */
  const lb = $('#lightbox'), lbImg = $('#lbImg'), lbCap = $('#lbCap');
  $$('.g-item').forEach(item => item.addEventListener('click', () => {
    lbImg.src = item.dataset.full;
    lbImg.alt = item.dataset.caption;
    lbCap.textContent = item.dataset.caption;
    lb.showModal();
  }));
  $('#lbClose').addEventListener('click', () => lb.close());
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });

  /* ---------- Parallax (portret) ---------- */
  const portrait = $('.hero__portrait');
  if (portrait && !reduceMotion) {
    addEventListener('scroll', () => {
      const y = scrollY;
      if (y < innerHeight) portrait.style.transform = `translateY(${y * 0.12}px)`;
    }, { passive: true });
  }
})();
