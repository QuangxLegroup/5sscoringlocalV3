(() => {
  "use strict";

  const STORAGE_PREFIX = "legroup_draft_v1_";
  const activeDirtyForms = new Map();

  function buildStorageKey(key) {
    return `${STORAGE_PREFIX}${key}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function pruneOldDrafts() {
    try {
      const now = Date.now();
      const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          try {
            const raw = localStorage.getItem(k);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed.timestamp && now - parsed.timestamp > MAX_AGE_MS) {
                localStorage.removeItem(k);
              }
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  function saveDraft(key, data) {
    if (!key) return false;
    try {
      const payload = {
        timestamp: Date.now(),
        data,
      };
      const serialized = JSON.stringify(payload);
      try {
        localStorage.setItem(buildStorageKey(key), serialized);
        return true;
      } catch (_) {
        pruneOldDrafts();
        try {
          localStorage.setItem(buildStorageKey(key), serialized);
          return true;
        } catch (_) {
          return false;
        }
      }
    } catch (_) {
      return false;
    }
  }

  function getDraft(key) {
    if (!key) return null;
    try {
      const raw = localStorage.getItem(buildStorageKey(key));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && Object.prototype.hasOwnProperty.call(parsed, "data")) {
        return parsed.data;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  function getDraftMeta(key) {
    if (!key) return null;
    try {
      const raw = localStorage.getItem(buildStorageKey(key));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function clearDraft(key) {
    if (!key) return;
    try {
      localStorage.removeItem(buildStorageKey(key));
    } catch (_) {}
  }

  function hasDraft(key) {
    if (!key) return false;
    try {
      return Boolean(localStorage.getItem(buildStorageKey(key)));
    } catch (_) {
      return false;
    }
  }

  function registerDirtyForm(key, handler = {}) {
    if (!key) return;
    activeDirtyForms.set(key, {
      getSnapshot: typeof handler.getSnapshot === "function" ? handler.getSnapshot : null,
      onDiscard: typeof handler.onDiscard === "function" ? handler.onDiscard : null,
      isDirty: typeof handler.isDirty === "function" ? handler.isDirty : () => true,
    });
  }

  function unregisterDirtyForm(key) {
    if (!key) return;
    activeDirtyForms.delete(key);
  }

  function isFormDirty(key) {
    const handler = activeDirtyForms.get(key);
    return handler ? handler.isDirty() : false;
  }

  function hasAnyDirty() {
    for (const [, handler] of activeDirtyForms.entries()) {
      if (handler.isDirty()) return true;
    }
    return false;
  }

  function flushAllDrafts() {
    activeDirtyForms.forEach((handler, key) => {
      if (handler.isDirty() && handler.getSnapshot) {
        try {
          const snapshot = handler.getSnapshot();
          if (snapshot != null) {
            saveDraft(key, snapshot);
          }
        } catch (_) {}
      }
    });
  }

  function discardAllDirty() {
    activeDirtyForms.forEach((handler, key) => {
      try {
        if (typeof handler.onDiscard === "function") {
          handler.onDiscard();
        }
        clearDraft(key);
      } catch (_) {}
    });
    activeDirtyForms.clear();
  }

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", (event) => {
      if (hasAnyDirty()) {
        flushAllDrafts();
        event.preventDefault();
        event.returnValue = "Bạn có thay đổi chưa lưu. Bạn có chắc chắn muốn rời khỏi trang?";
        return event.returnValue;
      }
    });
  }

  function showUnsavedConfirmModal({
    title = "Bạn có thay đổi chưa lưu!",
    onKeepEditing,
    onDiscardAndExit,
  }) {
    const existing = document.getElementById("unsavedChangesModal");
    if (existing) existing.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "unsavedChangesModal";
    const isMobileDark = typeof document !== "undefined" && Boolean(document.querySelector(".mobile-responsive-overlay:not(.is-light-theme), .is-mobile-dark, .findings-issue-modal.is-mobile-dark"));
    backdrop.className = "unsaved-changes-backdrop" + (isMobileDark ? " is-dark-theme" : "");
    backdrop.innerHTML = `
      <div class="unsaved-changes-card" role="dialog" aria-modal="true" aria-labelledby="unsavedModalTitle">
        <div class="unsaved-changes-header">
          <div class="unsaved-warning-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <h3 id="unsavedModalTitle">${escapeHtml(title)}</h3>
        </div>
        <div class="unsaved-changes-actions">
          <button type="button" class="secondary-button unsaved-btn-discard" data-unsaved-action="discard"><i class="fa-solid fa-trash-can"></i> Hủy bản nháp</button>
          <button type="button" class="primary-button unsaved-btn-stay" data-unsaved-action="stay"><i class="fa-solid fa-pen"></i> Tiếp tục chỉnh sửa</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const close = () => backdrop.remove();

    backdrop.querySelector('[data-unsaved-action="stay"]')?.addEventListener("click", () => {
      close();
      onKeepEditing?.();
    });

    backdrop.querySelector('[data-unsaved-action="discard"]')?.addEventListener("click", () => {
      close();
      onDiscardAndExit?.();
    });
  }

  window.FormDraftManager = {
    saveDraft,
    getDraft,
    getDraftMeta,
    clearDraft,
    hasDraft,
    registerDirtyForm,
    unregisterDirtyForm,
    isFormDirty,
    hasAnyDirty,
    flushAllDrafts,
    discardAllDirty,
    showUnsavedConfirmModal,
  };
})();
