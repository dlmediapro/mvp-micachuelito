/**
 * Mi Cachuelito - Scripts Principales de Aplicación
 * Navegación, Planificador Interactivo en Hero, Tracking y Micro-interacciones.
 */

(function () {
  'use strict';

  // Configuración de endpoints y contacto
  const EP = "https://formspree.io/f/xppplaoo";
  const MAIL = "cmedina.2508@gmail.com";

  // Reemplazar correos en elementos con atributo data-mail
  document.querySelectorAll("[data-mail]").forEach(e => {
    e.textContent = MAIL;
  });

  // Utilitario de búsqueda por ID
  const $ = id => document.getElementById(id);

  // Sistema de analítica (Google Analytics 4)
  const track = (eventName, params) => {
    if (window.gtag) {
      window.gtag("event", eventName, params || {});
    }
  };

  // Tracking de clics en elementos con data-ev
  document.querySelectorAll("[data-ev]").forEach(el => {
    el.addEventListener("click", () => track(el.dataset.ev));
  });

  // Helper de Toast accesible
  let toastTimer = null;
  function showToast(message) {
    const el = $("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("on"), 3500);
  }
  window.showToast = showToast;

  /* ==========================================================================
     PLANIFICADOR INTERACTIVO DEL HERO
     ========================================================================== */
  const D = ["Lun", "Mar", "Mié", "Jue", "Vie"];
  const S = ["Mañana", "Tarde", "Noche"];
  const SH = [
    { d: 0, s: 0, t: "Apoyo en tienda", h: "09:00 – 12:00", m: 4 },
    { d: 1, s: 1, t: "Inventario", h: "14:00 – 17:00", m: 5 },
    { d: 2, s: 1, t: "Atención al cliente", h: "14:00 – 17:00", m: 3 },
    { d: 3, s: 2, t: "Apoyo en cine", h: "18:00 – 21:00", m: 5 },
    { d: 4, s: 1, t: "Reparto en local", h: "15:00 – 18:00", m: 6 },
    { d: 4, s: 2, t: "Atención en restaurante", h: "19:00 – 22:00", m: 4 },
    { d: 1, s: 0, t: "Atención al cliente", h: "08:00 – 11:00", m: 3 }
  ];

  const sel = new Set();
  let plannerUsed = false;
  const gridEl = $("grid");

  if (gridEl) {
    gridEl.innerHTML = "<span></span>" +
      D.map(d => `<span>${d}</span>`).join("") +
      S.map((s, si) =>
        `<span class="r">${s}</span>` +
        D.map((d, di) =>
          `<button type="button" class="cell" aria-pressed="false" aria-label="${d} ${s.toLowerCase()}" data-k="${di}-${si}"></button>`
        ).join("")
      ).join("");

    function renderPlanner() {
      const resEl = $("res");
      const m = SH.map((x, i) => ({ ...x, i })).filter(x => sel.has(x.d + "-" + x.s));

      if (resEl) {
        resEl.innerHTML = m.length
          ? m.map(x =>
            `<div class="sh">
              <div>
                <strong>${x.t}</strong>
                <span class="tag">Ejemplo</span>
                <small>${D[x.d]} · ${x.h} · 3 horas · a ~${x.m} min de tu sede</small>
              </div>
              <button type="button" class="mini" data-i="${x.i}">Me interesa</button>
            </div>`
          ).join("")
          : `<div class="empty">${sel.size ? "Aún no hay turnos de ejemplo para esas horas. Déjanos tu disponibilidad abajo y te avisaremos." : "Marca tus horas libres para ver turnos de ejemplo."}</div>`;
      }

      // Contador y barra del hero
      const cntEl = $("cnt");
      if (cntEl) tween(cntEl, sel.size);
      const barEl = $("bar");
      if (barEl) barEl.style.width = (sel.size / 15 * 100) + "%";

      // Notificar al manejador de formularios si está disponible
      if (window.syncPlannerWithForm) {
        window.syncPlannerWithForm(sel);
      }
    }

    gridEl.addEventListener("click", e => {
      const b = e.target.closest(".cell");
      if (!b) return;
      const k = b.dataset.k;
      const on = !sel.has(k);
      if (on) sel.add(k); else sel.delete(k);
      b.setAttribute("aria-pressed", String(on));
      b.classList.remove("pop");
      void b.offsetWidth;
      b.classList.add("pop");
      gridEl.classList.remove("hint");

      if (!plannerUsed) {
        plannerUsed = true;
        track("planner_use");
      }
      renderPlanner();
    });

    const resEl = $("res");
    if (resEl) {
      resEl.addEventListener("click", e => {
        const b = e.target.closest(".mini");
        if (!b) return;
        const x = SH[b.dataset.i];
        const shiftLabel = `${x.t} (${D[x.d]} ${x.h})`;

        track("shift_interest", { shift: x.t });
        showToast(`Anotamos tu interés en «${x.t}». Completa tu registro abajo para avisarte.`);

        if (window.applyShiftInterest) {
          window.applyShiftInterest(x, shiftLabel);
        }

        const regSec = $("registro");
        if (regSec) {
          regSec.scrollIntoView({ behavior: "smooth" });
          setTimeout(() => {
            const nomInput = $("nombre");
            if (nomInput) nomInput.focus();
          }, 500);
        }
      });
    }

    renderPlanner();
  }

  /* ==========================================================================
     ANIMACIONES, EFECTO TILT Y SCROLL
     ========================================================================== */
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches;

  function tween(el, to) {
    const a = +el.textContent || 0;
    const t0 = performance.now();
    (function f(t) {
      const k = Math.min(1, (t - t0) / 350);
      el.textContent = Math.round(a + (to - a) * k);
      if (k < 1) requestAnimationFrame(f);
    })(t0);
  }

  // Barra de progreso de lectura superior
  const sp = $("sp");
  if (sp) {
    window.addEventListener("scroll", () => {
      const h = document.documentElement;
      const total = h.scrollHeight - window.innerHeight;
      sp.style.width = (total > 0 ? Math.min(100, (window.scrollY / total) * 100) : 0) + "%";
    }, { passive: true });
  }

  // Efecto de inclinación 3D para la tarjeta de prueba
  const tl = $("tilt");
  if (tl && fine && !calm) {
    tl.addEventListener("pointermove", e => {
      const r = tl.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      tl.style.transform = `perspective(900px) rotateY(${(x - 0.5) * 6}deg) rotateX(${(0.5 - y) * 6}deg)`;
      tl.style.setProperty("--mx", (x * 100) + "%");
      tl.style.setProperty("--my", (y * 100) + "%");
    });
    tl.addEventListener("pointerleave", () => {
      tl.style.transform = "";
    });
  }

  // Botón CTA flotante móvil
  const mc = $("mcta");
  if (mc) {
    let inHero = true;
    let inReg = false;
    let registrationDone = false;

    window.setRegistrationDone = val => {
      registrationDone = val;
      syncStickyCta();
    };

    const syncStickyCta = () => {
      mc.classList.toggle("on", !inHero && !inReg && !registrationDone);
    };

    const heroSection = document.querySelector(".hero");
    if (heroSection) {
      new IntersectionObserver(entries => {
        inHero = entries[0].isIntersecting;
        syncStickyCta();
      }).observe(heroSection);
    }

    const regSection = $("registro");
    if (regSection) {
      new IntersectionObserver(entries => {
        inReg = entries[0].isIntersecting;
        syncStickyCta();
      }).observe(regSection);
    }
  }

  /* ==========================================================================
     MODAL DE PRIVACIDAD Y SCROLL REVEAL
     ========================================================================== */
  const dlg = $("dlg");
  const dcl = $("dcl");
  if (dlg && dcl) {
    document.querySelectorAll("[data-priv]").forEach(b => {
      b.addEventListener("click", () => dlg.showModal());
    });
    dcl.addEventListener("click", () => dlg.close());
  }

  // Scroll Reveal para elementos con .rv
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("on");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll(".rv").forEach(el => io.observe(el));

  // Animación de confeti de celebración
  function triggerConfetti() {
    if (calm) return;
    const okEl = $("ok");
    if (!okEl) return;
    const r = okEl.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + 60;
    const colors = ["#F5A524", "#34D399", "#60A5FA", "#F472B6", "#FBBF24"];

    for (let i = 0; i < 40; i++) {
      const p = document.createElement("i");
      p.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:8px;height:12px;background:${colors[i % 5]};z-index:70;pointer-events:none;border-radius:2px`;
      document.body.appendChild(p);
      const a = Math.random() * Math.PI * 2;
      const d = 120 + Math.random() * 220;
      p.animate([
        { transform: "translate(0,0) rotate(0)", opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d + 180}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }
      ], {
        duration: 1300 + Math.random() * 900,
        easing: "cubic-bezier(.2,.7,.3,1)"
      }).onfinish = () => p.remove();
    }
  }
  window.triggerConfetti = triggerConfetti;

})();
