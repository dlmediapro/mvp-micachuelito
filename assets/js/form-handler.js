/**
 * Mi Cachuelito - Manejador de Formulario y Validación Estricta
 * Gatekeeping, Selección obligatoria de turnos, Persistencia LocalStorage,
 * Prevención de errores accesible (WCAG 2.1 AA) y comunicación con Formspree.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'mvp_micachuelito_draft';
  const EP = "https://formspree.io/f/xppplaoo";
  const origen = new URLSearchParams(window.location.search).get("utm_source") || "directo";

  const $ = id => document.getElementById(id);

  // Helper para tracking analítico
  const track = (eventName, params) => {
    if (window.gtag) {
      window.gtag("event", eventName, params || {});
    }
  };

  // Estado reactivo de turnos y días seleccionados en el formulario
  const formScheduleState = {
    shifts: new Set(), // 'manana', 'tarde', 'noche'
    days: new Set(),   // 'lun', 'mar', 'mie', 'jue', 'vie'
    specificShift: ''  // Ej: 'Apoyo en tienda (Lun 09:00 - 12:00)'
  };

  /* ==========================================================================
     1. GESTIÓN DE ERRORES ACCESIBLES Y ESTADOS VISUALES (CLS = 0)
     ========================================================================== */
  function setFieldError(fieldId, errorElementId, message) {
    const field = $(fieldId);
    const errEl = $(errorElementId);
    if (field) {
      field.setAttribute("aria-invalid", "true");
    }
    if (errEl) {
      errEl.textContent = message;
    }
    return 1;
  }

  function clearFieldError(fieldId, errorElementId) {
    const field = $(fieldId);
    const errEl = $(errorElementId);
    if (field) {
      field.removeAttribute("aria-invalid");
    }
    if (errEl) {
      errEl.textContent = "";
    }
  }

  function clearAllErrors(formEl) {
    if (!formEl) return;
    formEl.querySelectorAll("input, select, fieldset").forEach(el => {
      el.removeAttribute("aria-invalid");
    });
    formEl.querySelectorAll(".err").forEach(el => {
      el.textContent = "";
    });
  }

  function setButtonBusy(btn, isBusy, busyText) {
    if (!btn) return;
    btn.disabled = isBusy;
    btn.setAttribute("aria-busy", String(isBusy));
    btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
    btn.textContent = isBusy ? busyText : btn.dataset.originalText;
  }

  /* ==========================================================================
     2. SELECTOR DE HORARIOS INTERACTIVO (Chips y Turnos)
     ========================================================================== */
  function updateScheduleSummary() {
    const summaryBadge = $("schedule-summary-text");
    const hiddenHoras = $("horas");
    const fieldset = $("schedule-fieldset");

    const shiftLabels = {
      'manana': 'Mañana (8am - 12pm)',
      'tarde': 'Tarde (2pm - 6pm)',
      'noche': 'Noche (6pm - 10pm)'
    };

    const dayLabels = {
      'lun': 'Lun',
      'mar': 'Mar',
      'mie': 'Mié',
      'jue': 'Jue',
      'vie': 'Vie'
    };

    const selectedShiftsArr = Array.from(formScheduleState.shifts).map(s => shiftLabels[s] || s);
    const selectedDaysArr = Array.from(formScheduleState.days).map(d => dayLabels[d] || d);

    let summaryText = "";
    if (formScheduleState.specificShift) {
      summaryText = formScheduleState.specificShift;
    } else if (selectedShiftsArr.length > 0 || selectedDaysArr.length > 0) {
      const parts = [];
      if (selectedDaysArr.length > 0) parts.push(`Días: ${selectedDaysArr.join(', ')}`);
      if (selectedShiftsArr.length > 0) parts.push(`Turnos: ${selectedShiftsArr.join(' / ')}`);
      summaryText = parts.join(' | ');
    } else {
      summaryText = "Ninguno seleccionado (obligatorio)";
    }

    if (summaryBadge) {
      summaryBadge.textContent = summaryText;
    }

    if (hiddenHoras) {
      hiddenHoras.value = summaryText === "Ninguno seleccionado (obligatorio)" ? "" : summaryText;
    }

    // Si ya seleccionó al menos un turno o día, limpiar error del selector
    if (formScheduleState.shifts.size > 0 || formScheduleState.days.size > 0 || formScheduleState.specificShift) {
      if (fieldset) {
        fieldset.removeAttribute("aria-invalid");
      }
      const errSchedule = $("e-horario");
      if (errSchedule) errSchedule.textContent = "";
    }

    updateProgressBar();
    saveDraft();
  }

  function initScheduleChips() {
    // Chips de Turnos
    document.querySelectorAll(".shift-chip").forEach(chip => {
      const input = chip.querySelector("input[type='checkbox']");
      if (!input) return;

      input.addEventListener("change", () => {
        chip.classList.toggle("selected", input.checked);
        chip.setAttribute("aria-checked", String(input.checked));

        const shiftVal = input.value;
        if (input.checked) {
          formScheduleState.shifts.add(shiftVal);
        } else {
          formScheduleState.shifts.delete(shiftVal);
        }
        updateScheduleSummary();
      });
    });

    // Chips de Días
    document.querySelectorAll(".day-chip").forEach(chip => {
      const input = chip.querySelector("input[type='checkbox']");
      if (!input) return;

      input.addEventListener("change", () => {
        chip.classList.toggle("selected", input.checked);
        chip.setAttribute("aria-checked", String(input.checked));

        const dayVal = input.value;
        if (input.checked) {
          formScheduleState.days.add(dayVal);
        } else {
          formScheduleState.days.delete(dayVal);
        }
        updateScheduleSummary();
      });
    });
  }

  // Sincronización desde el Hero Planner
  window.syncPlannerWithForm = function (plannerSet) {
    if (!plannerSet || plannerSet.size === 0) return;

    // Traducir coordenadas (di-si)
    const dayMap = { 0: 'lun', 1: 'mar', 2: 'mie', 3: 'jue', 4: 'vie' };
    const shiftMap = { 0: 'manana', 1: 'tarde', 2: 'noche' };

    plannerSet.forEach(k => {
      const [d, s] = k.split('-');
      if (dayMap[d]) formScheduleState.days.add(dayMap[d]);
      if (shiftMap[s]) formScheduleState.shifts.add(shiftMap[s]);
    });

    // Actualizar estados visuales de los chips
    document.querySelectorAll(".shift-chip").forEach(chip => {
      const input = chip.querySelector("input[type='checkbox']");
      if (input && formScheduleState.shifts.has(input.value)) {
        input.checked = true;
        chip.classList.add("selected");
        chip.setAttribute("aria-checked", "true");
      }
    });

    document.querySelectorAll(".day-chip").forEach(chip => {
      const input = chip.querySelector("input[type='checkbox']");
      if (input && formScheduleState.days.has(input.value)) {
        input.checked = true;
        chip.classList.add("selected");
        chip.setAttribute("aria-checked", "true");
      }
    });

    updateScheduleSummary();
  };

  // Interés específico en turno de ejemplo del Hero
  window.applyShiftInterest = function (shiftObj, shiftLabel) {
    formScheduleState.specificShift = shiftLabel;
    const turnoInput = $("turno");
    if (turnoInput) {
      turnoInput.value = shiftLabel;
    }

    const dayMap = { 0: 'lun', 1: 'mar', 2: 'mie', 3: 'jue', 4: 'vie' };
    const shiftMap = { 0: 'manana', 1: 'tarde', 2: 'noche' };

    if (dayMap[shiftObj.d]) formScheduleState.days.add(dayMap[shiftObj.d]);
    if (shiftMap[shiftObj.s]) formScheduleState.shifts.add(shiftMap[shiftObj.s]);

    // Actualizar visualmente
    document.querySelectorAll(".shift-chip").forEach(chip => {
      const input = chip.querySelector("input[type='checkbox']");
      if (input && input.value === shiftMap[shiftObj.s]) {
        input.checked = true;
        chip.classList.add("selected");
        chip.setAttribute("aria-checked", "true");
      }
    });

    document.querySelectorAll(".day-chip").forEach(chip => {
      const input = chip.querySelector("input[type='checkbox']");
      if (input && input.value === dayMap[shiftObj.d]) {
        input.checked = true;
        chip.classList.add("selected");
        chip.setAttribute("aria-checked", "true");
      }
    });

    updateScheduleSummary();
  };

  /* ==========================================================================
     3. PERSISTENCIA EN LOCALSTORAGE (Borrador del MVP)
     ========================================================================== */
  function saveDraft() {
    try {
      const formEl = $("f");
      if (!formEl) return;

      const draft = {
        nombre: $("nombre") ? $("nombre").value : "",
        whatsapp: $("whatsapp") ? $("whatsapp").value : "",
        email: $("email") ? $("email").value : "",
        sede: $("sede") ? $("sede").value : "",
        trabaja: $("trabaja") ? $("trabaja").value : "",
        consent: $("consent") ? $("consent").checked : false,
        shifts: Array.from(formScheduleState.shifts),
        days: Array.from(formScheduleState.days),
        specificShift: formScheduleState.specificShift
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch (e) {
      console.warn("No se pudo guardar borrador en localStorage", e);
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);

      if (draft.nombre && $("nombre")) $("nombre").value = draft.nombre;
      if (draft.whatsapp && $("whatsapp")) $("whatsapp").value = draft.whatsapp;
      if (draft.email && $("email")) $("email").value = draft.email;
      if (draft.sede && $("sede")) $("sede").value = draft.sede;
      if (draft.trabaja && $("trabaja")) $("trabaja").value = draft.trabaja;
      if (typeof draft.consent === 'boolean' && $("consent")) $("consent").checked = draft.consent;

      if (Array.isArray(draft.shifts)) {
        draft.shifts.forEach(s => formScheduleState.shifts.add(s));
      }
      if (Array.isArray(draft.days)) {
        draft.days.forEach(d => formScheduleState.days.add(d));
      }
      if (draft.specificShift) {
        formScheduleState.specificShift = draft.specificShift;
        if ($("turno")) $("turno").value = draft.specificShift;
      }

      // Sincronizar checkboxes del formulario
      document.querySelectorAll(".shift-chip").forEach(chip => {
        const input = chip.querySelector("input[type='checkbox']");
        if (input && formScheduleState.shifts.has(input.value)) {
          input.checked = true;
          chip.classList.add("selected");
          chip.setAttribute("aria-checked", "true");
        }
      });

      document.querySelectorAll(".day-chip").forEach(chip => {
        const input = chip.querySelector("input[type='checkbox']");
        if (input && formScheduleState.days.has(input.value)) {
          input.checked = true;
          chip.classList.add("selected");
          chip.setAttribute("aria-checked", "true");
        }
      });

      updateScheduleSummary();
    } catch (e) {
      console.warn("No se pudo restaurar borrador de localStorage", e);
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // Ignorar errores en limpieza
    }
  }

  /* ==========================================================================
     4. BARRA DE PROGRESO DE COMPLETITUD
     ========================================================================== */
  function updateProgressBar() {
    const fbar = $("fbar");
    if (!fbar) return;

    const nombreVal = $("nombre") ? $("nombre").value.trim() : "";
    const waVal = $("whatsapp") ? $("whatsapp").value.replace(/[\s-]/g, "") : "";
    const emailVal = $("email") ? $("email").value.trim() : "";
    const sedeVal = $("sede") ? $("sede").value.trim() : "";
    const trabajaVal = $("trabaja") ? $("trabaja").value : "";
    const consentVal = $("consent") ? $("consent").checked : false;

    const hasSchedule = formScheduleState.shifts.size > 0 ||
      formScheduleState.days.size > 0 ||
      Boolean(formScheduleState.specificShift);

    const checks = [
      nombreVal.length >= 3,
      /^(\+?51)?9\d{8}$/.test(waVal),
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal),
      sedeVal.length >= 2,
      Boolean(trabajaVal),
      hasSchedule,
      consentVal
    ];

    const completed = checks.filter(Boolean).length;
    fbar.style.width = ((completed / checks.length) * 100) + "%";
  }

  /* ==========================================================================
     5. VALIDACIÓN Y GATEKEEPING DE ENVÍO
     ========================================================================== */
  const postData = (formData) => {
    return fetch(EP, {
      method: "POST",
      body: formData,
      headers: { Accept: "application/json" }
    }).then(res => {
      if (!res.ok) throw new Error("Network response was not ok");
      return res;
    });
  };

  let formStarted = false;
  let userWhatsApp = "";

  function setupStudentForm() {
    const formEl = $("f");
    if (!formEl) return;

    formEl.addEventListener("focusin", () => {
      if (!formStarted) {
        formStarted = true;
        track("form_start");
      }
    });

    // Escuchadores para validación en tiempo real y progreso
    formEl.querySelectorAll("input, select").forEach(input => {
      input.addEventListener("input", () => {
        updateProgressBar();
        saveDraft();
        if (input.getAttribute("aria-invalid") === "true") {
          validateSingleField(input.id);
        }
      });
      input.addEventListener("change", () => {
        updateProgressBar();
        saveDraft();
        validateSingleField(input.id);
      });
    });

    function validateSingleField(fieldId) {
      if (fieldId === "nombre") {
        const val = $("nombre").value.trim();
        if (val.length < 3) {
          return setFieldError("nombre", "e-nombre", "Escribe tu nombre completo (mínimo 3 caracteres).");
        }
        clearFieldError("nombre", "e-nombre");
      }

      if (fieldId === "whatsapp") {
        const raw = $("whatsapp").value.replace(/[\s-]/g, "");
        if (!/^(\+?51)?9\d{8}$/.test(raw)) {
          return setFieldError("whatsapp", "e-whatsapp", "Ingresa un celular de 9 dígitos que comience con 9.");
        }
        clearFieldError("whatsapp", "e-whatsapp");
      }

      if (fieldId === "email") {
        const val = $("email").value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          return setFieldError("email", "e-email", "Ingresa un correo electrónico válido (ej.: estudiante@universidad.edu.pe).");
        }
        clearFieldError("email", "e-email");
      }

      if (fieldId === "sede") {
        const val = $("sede").value.trim();
        if (val.length < 2) {
          return setFieldError("sede", "e-sede", "Indica tu instituto o universidad y sede.");
        }
        clearFieldError("sede", "e-sede");
      }

      if (fieldId === "trabaja") {
        const val = $("trabaja").value;
        if (!val) {
          return setFieldError("trabaja", "e-trabaja", "Elige una opción sobre tu situación laboral.");
        }
        clearFieldError("trabaja", "e-trabaja");
      }

      if (fieldId === "consent") {
        const checked = $("consent").checked;
        if (!checked) {
          return setFieldError("consent", "e-consent", "Necesitamos tu autorización para escribirte por WhatsApp.");
        }
        clearFieldError("consent", "e-consent");
      }

      return 0;
    }

    formEl.addEventListener("submit", e => {
      e.preventDefault();
      clearAllErrors(formEl);

      let errorsCount = 0;
      let firstInvalidElement = null;

      // 1. Validar Nombre
      const nombreVal = $("nombre").value.trim();
      if (nombreVal.length < 3) {
        errorsCount += setFieldError("nombre", "e-nombre", "Escribe tu nombre completo (mínimo 3 caracteres).");
        firstInvalidElement = firstInvalidElement || $("nombre");
      }

      // 2. Validar WhatsApp
      const rawWa = $("whatsapp").value.replace(/[\s-]/g, "");
      if (!/^(\+?51)?9\d{8}$/.test(rawWa)) {
        errorsCount += setFieldError("whatsapp", "e-whatsapp", "Ingresa un celular válido de 9 dígitos que comience con 9.");
        firstInvalidElement = firstInvalidElement || $("whatsapp");
      }

      // 3. Validar Email
      const emailVal = $("email").value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        errorsCount += setFieldError("email", "e-email", "Ingresa un correo electrónico válido (ej.: nombre@ejemplo.com).");
        firstInvalidElement = firstInvalidElement || $("email");
      }

      // 4. Validar Sede
      const sedeVal = $("sede").value.trim();
      if (sedeVal.length < 2) {
        errorsCount += setFieldError("sede", "e-sede", "Indica tu institución educativa y sede.");
        firstInvalidElement = firstInvalidElement || $("sede");
      }

      // 5. Validar Situación Laboral
      const trabajaVal = $("trabaja").value;
      if (!trabajaVal) {
        errorsCount += setFieldError("trabaja", "e-trabaja", "Elige una opción sobre tu situación laboral actual.");
        firstInvalidElement = firstInvalidElement || $("trabaja");
      }

      // 6. VALIDACIÓN OBLIGATORIA DE SELECCIÓN DE HORARIOS
      const hasSchedule = formScheduleState.shifts.size > 0 ||
        formScheduleState.days.size > 0 ||
        Boolean(formScheduleState.specificShift);

      if (!hasSchedule) {
        errorsCount += setFieldError("schedule-fieldset", "e-horario", "Debes seleccionar al menos un turno o día libre disponible.");
        firstInvalidElement = firstInvalidElement || $("schedule-fieldset");
      }

      // 7. Validar Consentimiento
      const consentVal = $("consent").checked;
      if (!consentVal) {
        errorsCount += setFieldError("consent", "e-consent", "Debes aceptar que te contactemos por WhatsApp.");
        firstInvalidElement = firstInvalidElement || $("consent");
      }

      // Si hay errores, detener envío y enfocar el primer elemento fallido
      if (errorsCount > 0) {
        if (firstInvalidElement) {
          if (typeof firstInvalidElement.focus === 'function') {
            firstInvalidElement.focus();
          }
          firstInvalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (window.showToast) {
          window.showToast("Por favor completa todos los campos y horarios obligatorios.");
        }
        return;
      }

      // Todos los datos son válidos: Proceder con el envío
      userWhatsApp = rawWa;
      const submitBtn = $("sb");
      setButtonBusy(submitBtn, true, "Enviando tu disponibilidad…");

      const fd = new FormData(formEl);
      fd.set("Tipo", "Estudiante");
      fd.set("Origen", origen);
      fd.delete("consentimiento");
      fd.set("Consentimiento", "Sí");
      fd.set("Horarios_Seleccionados", $("horas").value);

      postData(fd)
        .then(() => {
          track("generate_lead", { tipo: "estudiante", origen });
          formEl.classList.add("hide");

          const okEl = $("ok");
          if (okEl) {
            okEl.classList.remove("hide");
            okEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }

          if (window.triggerConfetti) {
            window.triggerConfetti();
          }

          if (window.setRegistrationDone) {
            window.setRegistrationDone(true);
          }

          clearDraft();
        })
        .catch(() => {
          setButtonBusy(submitBtn, false);
          if (window.showToast) {
            window.showToast("No pudimos enviar tus datos. Verifica tu conexión e intenta de nuevo.");
          }
        });
    });

    // Botón para solicitar turno de prueba post-registro
    const trialBtn = $("trial");
    if (trialBtn) {
      trialBtn.addEventListener("click", () => {
        const fd = new FormData();
        fd.set("Tipo", "Solicita turno de prueba");
        fd.set("WhatsApp", userWhatsApp);
        fd.set("Origen", origen);

        setButtonBusy(trialBtn, true, "Enviando…");
        postData(fd)
          .then(() => {
            track("trial_request");
            trialBtn.textContent = "¡Anotado!";
            if (window.showToast) window.showToast("Te consideraremos para un turno de prueba prioritario.");
          })
          .catch(() => {
            setButtonBusy(trialBtn, false);
            if (window.showToast) window.showToast("No pudimos registrar tu solicitud. Intenta de nuevo.");
          });
      });
    }

    // Botón compartir en WhatsApp
    const shareBtn = $("share");
    if (shareBtn) {
      shareBtn.addEventListener("click", () => {
        track("share");
        const shareUrl = "https://wa.me/?text=" + encodeURIComponent(
          "Mira Mi cachuelito: turnos de 3 horas que calzan con tus clases. " + window.location.origin + window.location.pathname
        );
        window.open(shareUrl, "_blank", "noopener");
      });
    }
  }

  /* ==========================================================================
     6. FORMULARIO PARA EMPRESAS
     ========================================================================== */
  function setupCompanyForm() {
    const companyForm = $("fe");
    if (!companyForm) return;

    companyForm.addEventListener("submit", e => {
      e.preventDefault();
      clearAllErrors(companyForm);

      let errors = 0;
      const empresaVal = $("empresa").value.trim();
      const contactoVal = $("contacto").value.trim();
      const rubroVal = $("rubro").value;

      if (empresaVal.length < 2) {
        errors += setFieldError("empresa", "e-empresa", "Indica el nombre de la empresa.");
      }

      if (contactoVal.length < 6) {
        errors += setFieldError("contacto", "e-contacto", "Déjanos un WhatsApp o correo válido.");
      }

      if (!rubroVal) {
        errors += setFieldError("rubro", "e-rubro", "Elige un rubro para tu empresa.");
      }

      if (errors > 0) return;

      const fd = new FormData(companyForm);
      fd.set("Tipo", "Empresa");
      fd.set("Origen", origen);

      const submitBtn = $("sbe");
      setButtonBusy(submitBtn, true, "Enviando…");

      postData(fd)
        .then(() => {
          track("generate_lead", { tipo: "empresa", origen });
          companyForm.classList.add("hide");
          const okCompany = $("oke");
          if (okCompany) okCompany.classList.remove("hide");
        })
        .catch(() => {
          setButtonBusy(submitBtn, false);
          const errBox = $("e-fe");
          if (errBox) errBox.textContent = "No pudimos enviar tus datos. Intenta de nuevo.";
        });
    });
  }

  /* ==========================================================================
     INICIALIZACIÓN AL CARGAR EL DOM
     ========================================================================== */
  document.addEventListener("DOMContentLoaded", () => {
    initScheduleChips();
    setupStudentForm();
    setupCompanyForm();
    loadDraft();
  });

})();
