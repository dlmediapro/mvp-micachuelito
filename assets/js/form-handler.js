/**
 * Mi Cachuelito - Manejador de Formulario Simplificado y Guardián de Interacción
 * Vinculación con el Cuadro Interactivo Superior (Fuente Única de Verdad),
 * Resumen Visual de Solo Lectura (Badges), Prevención y Recuperación de Errores (WCAG 2.1 AA),
 * Persistencia en LocalStorage y Envío Asíncrono a Formspree.
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
    formEl.querySelectorAll("input, select").forEach(el => {
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
     2. RESUMEN VISUAL DE HORARIO Y SINCRONIZACIÓN REACTIVA
     ========================================================================== */
  function updateScheduleDisplay(state) {
    const warningBanner = $("schedule-warning-banner");
    const summaryCard = $("schedule-summary-card");
    const badgesContainer = $("summary-badges-container");
    const horasHidden = $("horas");
    const turnoHidden = $("turno");

    const hasSelection = state && state.hasSelection;

    if (hasSelection) {
      // Ocultar alerta de advertencia y mostrar tarjeta de resumen
      if (warningBanner) warningBanner.classList.add("hide");
      if (summaryCard) summaryCard.classList.remove("hide");

      const badgesHtml = [];

      // Badges para turnos seleccionados
      if (state.selectedShifts && state.selectedShifts.size > 0) {
        state.selectedShifts.forEach(shift => {
          badgesHtml.push(`<span class="badge-chip badge-shift"><span class="badge-text">${shift}</span><button type="button" class="badge-remove" aria-label="Eliminar turno ${shift}" data-type="shift" data-value="${shift}">×</button></span>`);
        });
      }

      // Badges para días seleccionados
      if (state.selectedDays && state.selectedDays.size > 0) {
        state.selectedDays.forEach(day => {
          badgesHtml.push(`<span class="badge-chip badge-day"><span class="badge-text">${day}</span><button type="button" class="badge-remove" aria-label="Eliminar día ${day}" data-type="day" data-value="${day}">×</button></span>`);
        });
      }

      // Badge para vacante específica si el usuario hizo clic en "Me interesa"
      if (state.interestedShift) {
        badgesHtml.push(`<span class="badge-chip badge-match" title="Turno preferido"><span class="badge-text">⭐ ${state.interestedShift.title}</span></span>`);
        if (turnoHidden) turnoHidden.value = state.interestedShift.label || state.interestedShift.title;
      }

      // Badge de compatibilidad si hay vacantes filtradas
      if (state.vacanciesCount > 0) {
        badgesHtml.push(`<span class="badge-chip badge-match"><span class="badge-text">${state.vacanciesCount} turno(s) compatible(s)</span></span>`);
      }

      if (badgesContainer) {
        badgesContainer.innerHTML = badgesHtml.length > 0 ? badgesHtml.join("") : `<span class="badge-shift">Turno flexible</span>`;
      }

      // Formatear valor consolidado para el input oculto que recibe Formspree
      const summaryParts = [];
      if (state.selectedShifts && state.selectedShifts.size > 0) {
        summaryParts.push(`Turnos: ${Array.from(state.selectedShifts).join(", ")}`);
      }
      if (state.selectedDays && state.selectedDays.size > 0) {
        summaryParts.push(`Días: ${Array.from(state.selectedDays).join(", ")}`);
      }
      if (state.interestedShift) {
        summaryParts.push(`Preferencia: ${state.interestedShift.title}`);
      }

      if (horasHidden) {
        horasHidden.value = summaryParts.join(" | ");
      }
    } else {
      // Sin horario seleccionado: mostrar banner de advertencia y ocultar resumen
      if (warningBanner) warningBanner.classList.remove("hide");
      if (summaryCard) summaryCard.classList.add("hide");
      if (horasHidden) horasHidden.value = "";
    }

    updateProgressBar();
    saveDraft();
  }

  // Notificación reactiva exportada para recibir cambios desde el Hero Planner
  window.onScheduleStateChanged = function (state) {
    updateScheduleDisplay(state);
  };

  /* ==========================================================================
     3. PERSISTENCIA EN LOCALSTORAGE (Borrador de Datos Personales)
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
        consent: $("consent") ? $("consent").checked : false
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch (e) {
      console.warn("No se pudo guardar borrador en localStorage", e);
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.nombre && $("nombre")) $("nombre").value = draft.nombre;
        if (draft.whatsapp && $("whatsapp")) $("whatsapp").value = draft.whatsapp;
        if (draft.email && $("email")) $("email").value = draft.email;
        if (draft.sede && $("sede")) $("sede").value = draft.sede;
        if (draft.trabaja && $("trabaja")) $("trabaja").value = draft.trabaja;
        if (typeof draft.consent === 'boolean' && $("consent")) $("consent").checked = draft.consent;
      }

      // Sincronizar el estado del horario actual
      if (window.scheduleState) {
        updateScheduleDisplay(window.scheduleState);
      }
    } catch (e) {
      console.warn("No se pudo restaurar borrador de localStorage", e);
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
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

    const hasSchedule = window.scheduleState && window.scheduleState.hasSelection;

    const checks = [
      hasSchedule,
      nombreVal.length >= 3,
      /^(\+?51)?9\d{8}$/.test(waVal),
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal),
      sedeVal.length >= 2,
      Boolean(trabajaVal),
      consentVal
    ];

    const completed = checks.filter(Boolean).length;
    fbar.style.width = ((completed / checks.length) * 100) + "%";
  }

  /* ==========================================================================
     5. VALIDACIÓN, GUARDIÁN DE INTERACCIÓN Y ENVÍO
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

    // Conectar botones de redirección y cambio de horario
    const btnGoto = $("btn-goto-schedule");
    if (btnGoto) {
      btnGoto.addEventListener("click", () => {
        if (typeof window.highlightAndScrollToSchedule === "function") {
          window.highlightAndScrollToSchedule();
        }
      });
    }

    const btnChange = $("btn-change-schedule");
    if (btnChange) {
      btnChange.addEventListener("click", () => {
        if (typeof window.highlightAndScrollToSchedule === "function") {
          window.highlightAndScrollToSchedule();
        }
      });
    }

    // Botón de limpiar selección completa en el formulario
    const btnClear = $("btn-clear-schedule");
    if (btnClear) {
      btnClear.addEventListener("click", () => {
        if (typeof window.clearAllSchedules === "function") {
          window.clearAllSchedules(true);
        }
      });
    }

    // Delegación de clics en los botones de cierre (×) de cada chip
    const badgesContainer = $("summary-badges-container");
    if (badgesContainer) {
      badgesContainer.addEventListener("click", (e) => {
        const btn = e.target.closest(".badge-remove");
        if (!btn) return;
        const type = btn.dataset.type;
        const val = btn.dataset.value;
        if (type === "shift" && typeof window.removeScheduleShift === "function") {
          window.removeScheduleShift(val);
        } else if (type === "day" && typeof window.removeScheduleDay === "function") {
          window.removeScheduleDay(val);
        }
      });
    }

    // Guardián en focusin: si intenta interactuar sin haber usado el cuadro superior
    formEl.addEventListener("focusin", (e) => {
      if (!formStarted) {
        formStarted = true;
        track("form_start");
      }

      // Si no ha seleccionado horario arriba y entra a un campo de entrada
      const hasSchedule = window.scheduleState && window.scheduleState.hasSelection;
      if (!hasSchedule && e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
        const warningBanner = $("schedule-warning-banner");
        if (warningBanner) {
          warningBanner.classList.remove("hide");
        }
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

    // Submit handler con regla condicional estricta del Guardián
    formEl.addEventListener("submit", e => {
      e.preventDefault();
      clearAllErrors(formEl);

      // 1. GUARDIÁN ESTRICTO: Verificar si el usuario seleccionó horario en el cuadro superior
      const hasSchedule = window.scheduleState && window.scheduleState.hasSelection;
      if (!hasSchedule) {
        const warningBanner = $("schedule-warning-banner");
        if (warningBanner) {
          warningBanner.classList.remove("hide");
        }
        if (typeof window.highlightAndScrollToSchedule === "function") {
          window.highlightAndScrollToSchedule();
        }
        if (window.showToast) {
          window.showToast("¡Primero selecciona tu disponibilidad en el cuadro interactivo de arriba!");
        }
        return; // Bloqueo total de envío
      }

      let errorsCount = 0;
      let firstInvalidElement = null;

      // 2. Validar Nombre
      const nombreVal = $("nombre").value.trim();
      if (nombreVal.length < 3) {
        errorsCount += setFieldError("nombre", "e-nombre", "Escribe tu nombre completo (mínimo 3 caracteres).");
        firstInvalidElement = firstInvalidElement || $("nombre");
      }

      // 3. Validar WhatsApp
      const rawWa = $("whatsapp").value.replace(/[\s-]/g, "");
      if (!/^(\+?51)?9\d{8}$/.test(rawWa)) {
        errorsCount += setFieldError("whatsapp", "e-whatsapp", "Ingresa un celular válido de 9 dígitos que comience con 9.");
        firstInvalidElement = firstInvalidElement || $("whatsapp");
      }

      // 4. Validar Email
      const emailVal = $("email").value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        errorsCount += setFieldError("email", "e-email", "Ingresa un correo electrónico válido (ej.: nombre@ejemplo.com).");
        firstInvalidElement = firstInvalidElement || $("email");
      }

      // 5. Validar Sede
      const sedeVal = $("sede").value.trim();
      if (sedeVal.length < 2) {
        errorsCount += setFieldError("sede", "e-sede", "Indica tu institución educativa y sede.");
        firstInvalidElement = firstInvalidElement || $("sede");
      }

      // 6. Validar Situación Laboral
      const trabajaVal = $("trabaja").value;
      if (!trabajaVal) {
        errorsCount += setFieldError("trabaja", "e-trabaja", "Elige una opción sobre tu situación laboral actual.");
        firstInvalidElement = firstInvalidElement || $("trabaja");
      }

      // 7. Validar Consentimiento
      const consentVal = $("consent").checked;
      if (!consentVal) {
        errorsCount += setFieldError("consent", "e-consent", "Debes aceptar que te contactemos por WhatsApp.");
        firstInvalidElement = firstInvalidElement || $("consent");
      }

      // Si hay errores de campos personales, enfocar el primero
      if (errorsCount > 0) {
        if (firstInvalidElement) {
          if (typeof firstInvalidElement.focus === 'function') {
            firstInvalidElement.focus();
          }
          firstInvalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (window.showToast) {
          window.showToast("Por favor completa todos tus datos personales obligatorios.");
        }
        return;
      }

      // Todos los datos son válidos y el horario está seleccionado: Proceder con el envío
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
    setupStudentForm();
    setupCompanyForm();
    loadDraft();
  });

})();
