(function () {
  "use strict";

  let activeMenu = null;
  let activeTrigger = null;
  let activeCleanup = null;

  function closeActiveMenu() {
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }
    if (activeMenu) {
      activeMenu.remove();
      activeMenu = null;
    }
    if (activeTrigger) {
      activeTrigger.classList.remove("is-open");
      activeTrigger.setAttribute("aria-expanded", "false");
      activeTrigger = null;
    }
  }

  function parseZoneNumberParts(str) {
    const s = String(str || "").trim();
    const m = s.match(/(?:zone\s*)?([0-9]+(?:\.[0-9]+)?)/i);
    if (m) {
      return m[1].split(".").map(Number);
    }
    return null;
  }

  function compareZoneCodesByOrder(left, right) {
    const leftCode = String(left?.code || left?.name || left?.textContent || left || "").trim();
    const rightCode = String(right?.code || right?.name || right?.textContent || right || "").trim();
    const p1 = parseZoneNumberParts(leftCode);
    const p2 = parseZoneNumberParts(rightCode);
    if (p1 && p2) {
      if (p1[0] !== p2[0]) return p1[0] - p2[0];
      if (p1[1] !== undefined || p2[1] !== undefined) {
        return (p1[1] || 0) - (p2[1] || 0);
      }
    } else if (p1 && !p2) {
      return -1;
    } else if (!p1 && p2) {
      return 1;
    }
    const codeOrder = leftCode.localeCompare(rightCode, "vi", {
      numeric: true,
      sensitivity: "base",
    });
    return codeOrder || (Number(left?.order) || 0) - (Number(right?.order) || 0);
  }

  function sortSelectOptions(selectEl) {
    if (!selectEl || !selectEl.options || selectEl.options.length <= 1) return;
    const isZoneSelect = Boolean(
      selectEl.name === "areaId" ||
      selectEl.id === "admin-score-sheet-area" ||
      selectEl.id === "assessor-area-select" ||
      selectEl.id === "safety-area-filter" ||
      selectEl.classList?.contains?.("zone-select") ||
      selectEl.dataset?.sortZone === "true" ||
      Array.from(selectEl.options).some((o) => /zone\s*\d+/i.test(o.textContent))
    );
    if (!isZoneSelect) return;

    const currentVal = selectEl.value;
    const options = Array.from(selectEl.options);

    const placeholder = options.find((o) => !o.value || o.value === "all" || o.textContent.includes("Chọn") || o.textContent.includes("Tất cả"));
    const normalOptions = options.filter((o) => o !== placeholder);

    normalOptions.sort((a, b) => compareZoneCodesByOrder(a.textContent, b.textContent));

    selectEl.innerHTML = "";
    if (placeholder) {
      selectEl.appendChild(placeholder);
    }
    normalOptions.forEach((opt) => selectEl.appendChild(opt));

    selectEl.value = currentVal;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function enhanceCustomDropdown(selectEl) {
    if (!selectEl || selectEl.nodeName !== "SELECT") return;

    sortSelectOptions(selectEl);

    if (selectEl.dataset.customDropdownReady === "true") {
      if (typeof selectEl._customDropdownRefresh === "function") {
        selectEl._customDropdownRefresh();
      }
      return;
    }

    selectEl.dataset.customDropdownReady = "true";
    selectEl.classList.add("custom-dropdown-native-hidden");

    const wrapper = document.createElement("div");
    wrapper.className = "custom-dropdown-wrap";
    if (selectEl.className) {
      wrapper.classList.add(...selectEl.className.split(/\s+/).filter((c) => c && c !== "custom-dropdown-native-hidden"));
    }
    if (selectEl.id) {
      wrapper.dataset.forSelect = selectEl.id;
    }

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-dropdown-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const labelSpan = document.createElement("span");
    labelSpan.className = "custom-dropdown-label";

    const caretIcon = document.createElement("i");
    caretIcon.className = "fa-solid fa-chevron-down custom-dropdown-caret";

    trigger.appendChild(labelSpan);
    trigger.appendChild(caretIcon);
    wrapper.appendChild(trigger);

    selectEl.parentNode.insertBefore(wrapper, selectEl.nextSibling);

    function updateLabel() {
      const selected = selectEl.selectedOptions?.[0] || selectEl.options?.[0];
      labelSpan.textContent = selected ? selected.textContent.trim() : (selectEl.placeholder || "Chọn...");
      trigger.disabled = Boolean(selectEl.disabled);
      if (selectEl.disabled) {
        trigger.classList.add("is-disabled");
      } else {
        trigger.classList.remove("is-disabled");
      }
    }

    // Intercept .value property to keep label synced when .value is set programmatically
    try {
      const origDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
      if (origDescriptor && origDescriptor.set) {
        Object.defineProperty(selectEl, "value", {
          get() {
            return origDescriptor.get.call(this);
          },
          set(newVal) {
            origDescriptor.set.call(this, newVal);
            updateLabel();
          },
          configurable: true,
        });
      }
    } catch (_) {}

    selectEl._customDropdownRefresh = () => {
      sortSelectOptions(selectEl);
      updateLabel();
    };

    updateLabel();

    selectEl.addEventListener("change", updateLabel);
    selectEl.addEventListener("input", updateLabel);

    if (typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver(() => {
        updateLabel();
      });
      observer.observe(selectEl, { childList: true, subtree: true, attributes: true });
    }

    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (selectEl.disabled) return;

      if (activeTrigger === trigger) {
        closeActiveMenu();
        return;
      }

      closeActiveMenu();
      sortSelectOptions(selectEl);
      updateLabel();

      const rect = trigger.getBoundingClientRect();
      const appTheme = (typeof window.getAppTheme === "function" ? window.getAppTheme() : document.documentElement.getAttribute("data-theme")) || "dark";
      const isMobileLight = Boolean(
        selectEl.closest?.(".is-light-theme") ||
        document.querySelector(".mobile-responsive-overlay")?.classList?.contains("is-light-theme")
      );
      const isMobileDark = Boolean(
        selectEl.closest?.(".is-mobile-dark") ||
        (selectEl.closest?.(".findings-mobile") && !selectEl.closest?.(".is-light-theme"))
      );
      const isDark = isMobileLight ? false : (isMobileDark ? true : appTheme === "dark");

      const menu = document.createElement("div");
      menu.className = "custom-dropdown-menu" + (isDark ? " is-dark" : "");
      menu.setAttribute("role", "listbox");

      const options = Array.from(selectEl.options);
      const showSearch = options.length > 7;

      let searchInput = null;
      if (showSearch) {
        const searchWrap = document.createElement("div");
        searchWrap.className = "custom-dropdown-search-wrap";
        searchWrap.innerHTML = '<i class="fa-solid fa-magnifying-glass custom-dropdown-search-icon"></i><input type="text" class="custom-dropdown-search" placeholder="Tìm kiếm nhanh..." autocomplete="off">';
        menu.appendChild(searchWrap);
        searchInput = searchWrap.querySelector("input");
      }

      const list = document.createElement("div");
      list.className = "custom-dropdown-list";

      options.forEach((opt) => {
        const item = document.createElement("div");
        item.className = "custom-dropdown-item" + (opt.selected ? " is-selected" : "") + (opt.disabled ? " is-disabled" : "");
        item.setAttribute("role", "option");
        item.dataset.value = opt.value;
        item.innerHTML = `<span class="custom-dropdown-item-text">${escapeHtml(opt.textContent.trim())}</span>${opt.selected ? '<i class="fa-solid fa-check custom-dropdown-item-check"></i>' : ""}`;

        if (!opt.disabled) {
          item.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            selectEl.value = opt.value;
            updateLabel();
            selectEl.dispatchEvent(new Event("change", { bubbles: true }));
            selectEl.dispatchEvent(new Event("input", { bubbles: true }));
            closeActiveMenu();
            trigger.focus();
          });
        }
        list.appendChild(item);
      });

      menu.appendChild(list);

      const menuWidth = Math.max(rect.width, 220);
      let menuLeft = rect.left;
      if (typeof window !== "undefined" && menuLeft + menuWidth > window.innerWidth - 10) {
        menuLeft = Math.max(10, window.innerWidth - menuWidth - 10);
      }

      menu.style.position = "fixed";
      menu.style.top = `${rect.bottom}px`;
      menu.style.left = `${menuLeft}px`;
      menu.style.width = `${menuWidth}px`;
      menu.style.zIndex = "999999";

      const spaceBelow = Math.max(160, (typeof window !== "undefined" ? window.innerHeight : 800) - rect.bottom - 16);
      menu.style.maxHeight = `${Math.min(320, spaceBelow)}px`;
      list.style.maxHeight = `${Math.min(260, spaceBelow - (showSearch ? 46 : 8))}px`;

      document.body.appendChild(menu);
      trigger.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");

      activeMenu = menu;
      activeTrigger = trigger;

      const selectedItem = list.querySelector(".custom-dropdown-item.is-selected");
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: "nearest" });
      }

      if (searchInput) {
        setTimeout(() => searchInput.focus(), 40);
        searchInput.addEventListener("input", () => {
          const q = searchInput.value.toLowerCase().trim();
          list.querySelectorAll(".custom-dropdown-item").forEach((it) => {
            const match = !q || it.textContent.toLowerCase().includes(q);
            it.style.display = match ? "flex" : "none";
          });
        });
      }

      function updatePos() {
        if (!menu.isConnected) return;
        const curRect = trigger.getBoundingClientRect();
        if (curRect.bottom < 0 || curRect.top > window.innerHeight) {
          closeActiveMenu();
          return;
        }
        const w = Math.max(curRect.width, 220);
        let l = curRect.left;
        if (l + w > window.innerWidth - 10) {
          l = Math.max(10, window.innerWidth - w - 10);
        }
        menu.style.top = `${curRect.bottom}px`;
        menu.style.left = `${l}px`;
        menu.style.width = `${w}px`;
      }

      function onDocClick(ev) {
        if (menu.contains(ev.target) || trigger.contains(ev.target)) return;
        closeActiveMenu();
      }

      function onKeyDown(ev) {
        if (ev.key === "Escape") {
          closeActiveMenu();
          trigger.focus();
        }
      }

      setTimeout(() => document.addEventListener("pointerdown", onDocClick), 20);
      document.addEventListener("keydown", onKeyDown);
      window.addEventListener("resize", updatePos);
      window.addEventListener("scroll", updatePos, true);

      activeCleanup = () => {
        document.removeEventListener("pointerdown", onDocClick);
        document.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("resize", updatePos);
        window.removeEventListener("scroll", updatePos, true);
      };
    });
  }

  function enhanceAllCustomDropdowns(root = document) {
    if (!root || !root.querySelectorAll) return;
    const selector = ".safety-record-entry-table select, .findings-issue-entry-table select, #admin-score-sheet-area, #assessor-area-select, #safety-area-filter, select[data-finding-zone], select[data-custom-dropdown], select[name='areaId']";
    root.querySelectorAll(selector).forEach(enhanceCustomDropdown);
  }

  window.CustomDropdown = {
    enhance: enhanceCustomDropdown,
    enhanceAll: enhanceAllCustomDropdowns,
    compareZoneCodesByOrder,
    parseZoneNumberParts,
    sortSelectOptions,
    closeAll: closeActiveMenu,
  };
})();
