(() => {
  "use strict";

  function setupNavDragScroll(scroller) {
    if (!scroller || scroller.__navDragInitialized) return;
    scroller.__navDragInitialized = true;

    let isDown = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;
    let isDragging = false;
    let suppressClickUntil = 0;

    // Wheel scroll: translate vertical wheel scroll to horizontal scroll
    scroller.addEventListener("wheel", (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        scroller.scrollLeft += e.deltaY * 0.9;
      }
    }, { passive: false });

    // Drag-to-scroll with mouse or touch (2D)
    // Do NOT setPointerCapture on pointerdown — only after drag threshold is crossed
    scroller.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;

      isDown = true;
      isDragging = false;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = scroller.scrollLeft;
      startScrollTop = scroller.scrollTop;
      scroller.style.scrollBehavior = "auto";
    });

    scroller.addEventListener("pointermove", (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!isDragging && Math.hypot(dx, dy) > 4) {
        isDragging = true;
        scroller.classList.add("is-dragging");
        // Only capture pointer once we confirm it's a drag
        try { scroller.setPointerCapture(e.pointerId); } catch (_) {}
      }

      if (isDragging) {
        e.preventDefault();
        scroller.scrollLeft = startScrollLeft - dx;
        scroller.scrollTop = startScrollTop - dy;
      }
    }, { passive: false });


    const onPointerEnd = (e) => {
      if (!isDown) return;
      isDown = false;
      scroller.style.scrollBehavior = "smooth";

      try {
        scroller.releasePointerCapture(e.pointerId);
      } catch (_) {}

      if (isDragging) {
        scroller.classList.remove("is-dragging");
        suppressClickUntil = Date.now() + 120;

        const cancelClick = (ev) => {
          if (Date.now() < suppressClickUntil) {
            ev.stopPropagation();
            ev.preventDefault();
          }
        };
        scroller.addEventListener("click", cancelClick, { capture: true, once: true });
        setTimeout(() => {
          scroller.removeEventListener("click", cancelClick, { capture: true });
          isDragging = false;
        }, 150);
      }
    };

    scroller.addEventListener("pointerup", onPointerEnd);
    scroller.addEventListener("pointercancel", onPointerEnd);
  }

  window.setupNavDragScroll = setupNavDragScroll;



  function render(context) {
    const {
      FIVE_S_PERIOD_TYPE,
      currentUser,
      elements,
      escapeHtml,
      getActivePeriodId,
      getPeriod,
      renderRoleVisibility,
      periodLabel,
    } = context;

    if (!currentUser || !elements.adminHomeCards) {
      return;
    }

    const activeTheme = (typeof window.getAppTheme === "function" ? window.getAppTheme() : (document.documentElement.getAttribute("data-theme") || localStorage.getItem("app_theme") || "dark"));
    const navButton = ({ icon, label, title, tab, classes = "", report }) => {
      const routeAttr = report
        ? `data-go-safety-report="${escapeHtml(report)}"`
        : `data-go-tab="${escapeHtml(tab)}"`;
      return `<button class="tab-button ${classes}" type="button" ${routeAttr} title="${escapeHtml(title)}">
        <span class="tab-icon">${escapeHtml(icon)}</span>
        <span>${escapeHtml(label)}</span>
      </button>`;
    };
    // Keep the same canonical order and visibility classes as #headerQuickNav.
    // renderRoleVisibility applies the active account's permissions after render.
    const cyberNavHtml = [
      navButton({ icon: "📝", label: "Phiếu chấm", title: "Phiếu chấm điểm 5S", tab: "assessor", classes: "assessor-only" }),
      navButton({ icon: "📊", label: "Bảng Điểm 5S", title: "Tổng hợp điểm 5S", tab: "summary", classes: "admin-only five-s-access-only" }),
      navButton({ icon: "📝", label: "Vấn đề 5S", title: "Vấn đề 5S", tab: "five-s-findings" }),
      navButton({ icon: "📋", label: "Phiếu theo zone", title: "Xem phiếu 5S theo zone", tab: "score-sheets", classes: "admin-only" }),
      navButton({ icon: "🛡️", label: "Đánh giá AT", title: "Đánh giá an toàn", report: "assessment", classes: "safety-access-only" }),
      navButton({ icon: "⚠️", label: "Nhận diện", title: "Tổng hợp nhận diện nguy cơ mất an toàn", report: "identification", classes: "admin-only" }),
      navButton({ icon: "🏭", label: "Nguy cơ NM", title: "Tổng hợp nguy cơ mất an toàn nhà máy", report: "factory", classes: "admin-only" }),
      navButton({ icon: "📈", label: "Thống kê AT", title: "Thống kê an toàn", tab: "issue-stats", classes: "admin-only" }),
    ].join("");

    elements.adminHomeCards.classList.add("has-cyber-home");

    const fiveSPeriod = getPeriod(getActivePeriodId(FIVE_S_PERIOD_TYPE));
    const fiveSPeriodText = periodLabel(fiveSPeriod);

    elements.adminHomeCards.innerHTML = `
      <div class="cyber-home-container">
        <!-- Animated 3D Perspective Grid Floor -->
        <div class="cyber-grid-floor">
          <div class="cyber-grid-plane"></div>
        </div>
        <div class="cyber-horizon-glow"></div>
        <div class="cyber-stars"></div>

        <!-- Top Navigation Bar / Cyber HUD Header -->
        <div class="cyber-top-nav app-header">
          <div class="cyber-brand header-left-box">
            <img src="images/Logo.jpg" alt="LeGroup" class="cyber-brand-logo">
            <div class="cyber-brand-text">
              <span class="cyber-brand-subtitle">LeGroup 5S</span>
              <strong class="cyber-brand-title">Control Terminal</strong>
            </div>
          </div>

          <!-- All Sidebar Items as Direct Cyber HUD Buttons with Drag-to-Scroll -->
          <nav class="header-quick-nav" id="cyberNavLinks" aria-label="Điều hướng nhanh">
            ${cyberNavHtml}
          </nav>

          <!-- Right Side: User Profile -->
          <div class="cyber-top-right header-right-tools">
            <div class="issue-notification-control" data-issue-notification-control>
              <button class="issue-notification-button" type="button" data-issue-notification-toggle aria-label="Mở thông báo" aria-expanded="false" title="Thông báo">
                <i class="fa-regular fa-bell" aria-hidden="true"></i>
                <span class="issue-notification-count" data-issue-notification-count hidden></span>
              </button>
              <section class="issue-notification-popover" data-issue-notification-popover hidden aria-label="Thông báo vấn đề"></section>
            </div>
            <div class="cyber-user-box" id="cyberUserBox">
              <button class="cyber-user-pill" id="cyberUserMenuBtn" type="button" aria-haspopup="true" aria-expanded="false" title="Menu tài khoản">
                <span class="cyber-user-avatar">${escapeHtml((currentUser.name || currentUser.username || "A").slice(0, 1).toUpperCase())}</span>
                <span class="cyber-user-name">${escapeHtml(currentUser.name || currentUser.username)}</span>
                <span class="cyber-user-arrow">▾</span>
              </button>
              <div class="account-menu cyber-account-dropdown" id="cyberAccountMenu" hidden>
                <div class="account-menu-profile">
                  <span class="account-avatar large">${escapeHtml((currentUser.name || currentUser.username || "A").slice(0, 1).toUpperCase())}</span>
                  <div>
                    <strong>${escapeHtml(currentUser.name || currentUser.username || "Người dùng")}</strong>
                    <span>${escapeHtml(currentUser.username || "")}</span>
                  </div>
                </div>
                <div class="account-menu-divider admin-only"></div>
                <button class="account-menu-item admin-only" type="button" data-go-tab="accounts">
                  <i class="fa-solid fa-user-plus" aria-hidden="true"></i>
                  Cấp tài khoản
                </button>
                <button class="account-menu-item admin-only" type="button" data-go-tab="catalog">
                  <i class="fa-solid fa-folder-tree" aria-hidden="true"></i>
                  Danh mục
                </button>
                <button class="account-menu-item admin-only" type="button" data-go-tab="guide-setup" data-action="setup-user-guide">
                  <i class="fa-regular fa-circle-question" aria-hidden="true"></i>
                  Thiết lập hướng dẫn
                </button>
                <button class="account-menu-item admin-only" type="button" data-go-tab="audit-log" data-action="show-edit-history">
                  <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>
                  Lịch sử chỉnh sửa
                </button>
                <button class="account-menu-item admin-only" type="button" data-action="show-problem-zone-emails">
                  <i class="fa-regular fa-envelope" aria-hidden="true"></i>
                  Email báo cáo zone có vấn đề
                </button>
                <div class="account-menu-divider safety-live-access-only" hidden></div>
                <button class="account-menu-item safety-live-access-only" type="button" data-go-tab="safety-live" hidden>
                  <i class="fa-solid fa-tv" aria-hidden="true"></i>
                  Safety Live (Trình chiếu)
                </button>
                <div class="account-menu-theme-row">
                  <span class="account-menu-theme-label">
                    <i class="fa-solid fa-circle-half-stroke" aria-hidden="true"></i>
                    Giao diện:
                  </span>
                  <div class="account-menu-theme-toggle" role="group" aria-label="Chọn giao diện">
                    <button type="button" class="theme-toggle-btn ${activeTheme === 'light' ? 'is-active' : ''}" data-theme-set="light" title="Giao diện Sáng">
                      <i class="fa-solid fa-sun" aria-hidden="true"></i>
                      <span>Sáng</span>
                    </button>
                    <button type="button" class="theme-toggle-btn ${activeTheme === 'dark' ? 'is-active' : ''}" data-theme-set="dark" title="Giao diện Tối">
                      <i class="fa-solid fa-moon" aria-hidden="true"></i>
                      <span>Tối</span>
                    </button>
                  </div>
                </div>
                <div class="account-menu-divider"></div>
                <button class="account-menu-logout" id="cyberMenuLogoutBtn" type="button">
                  <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Interactive Cyber Stage -->
        <div class="cyber-stage">
          <div class="cyber-dark-center-worker" aria-hidden="true">
            <img src="images/congnhan.png" alt="">
          </div>
          <div class="cyber-home-actions">
            <div class="cyber-home-guide-card" id="cyberHomeGuideBtn" role="button" tabindex="0" title="Xem hướng dẫn sử dụng">
              <div class="cyber-home-guide-icon">
                <i class="fa-solid fa-book-open" aria-hidden="true"></i>
              </div>
              <span class="cyber-home-guide-title">Hướng dẫn sử dụng</span>
            </div>

            <div class="cyber-cta-wrap">
              <button class="cyber-guide-button cyber-mobile-switch-btn" type="button" id="cyberMobileBtn" title="Chuyển sang giao diện Mobile Prototype">
                <span class="mobile-glow-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                    <line x1="12" y1="18" x2="12.01" y2="18"></line>
                  </svg>
                </span>
                <span class="mobile-btn-text">Chuyển sang Mobile</span>
                <span class="mobile-btn-pulse"></span>
              </button>
            </div>
          </div>
        </div>

        <!-- Company values -->
        <div class="cyber-bottom-flow">
          <div class="cyber-flow-card">
            <strong class="cyber-flow-statement">Quality - Innovation - Performance - Speed</strong>
          </div>
        </div>
      </div>
    `;

    // Bind Mobile Prototype CTA Button
    const mobileBtn = elements.adminHomeCards.querySelector("#cyberMobileBtn");
    if (mobileBtn) {
      mobileBtn.addEventListener("click", () => {
        if (typeof window.openMobilePrototype === "function") {
          const user = context?.currentUser;
          const can5S = typeof context?.isFiveSAssessor === "function" ? context.isFiveSAssessor(user) : true;
          const canSafety = typeof context?.canAddSafetyEvaluation === "function"
            ? context.canAddSafetyEvaluation(user)
            : typeof context?.canUseSafety === "function" ? context.canUseSafety(user) : true;
          const initialTab = can5S ? "5s" : canSafety ? "safety" : "5s";
          window.openMobilePrototype(initialTab, context);
        }
      });
    }

    const homeGuideBtn = elements.adminHomeCards.querySelector("#cyberHomeGuideBtn");
    if (homeGuideBtn) {
      homeGuideBtn.addEventListener("click", () => {
        if (typeof window.openMobilePrototype === "function") {
          window.openMobilePrototype("5s", context, { openHelp: true });
        }
      });
    }

    // Setup Drag-to-scroll and wheel scroll for Cyber Nav Links
    const navLinks = elements.adminHomeCards.querySelector("#cyberNavLinks") || elements.adminHomeCards.querySelector(".cyber-nav-links");
    if (navLinks) {
      setupNavDragScroll(navLinks);
    }

    // Bind Cyber User Dropdown
    const userBtn = elements.adminHomeCards.querySelector("#cyberUserMenuBtn");
    const userMenu = elements.adminHomeCards.querySelector("#cyberAccountMenu");
    const userBox = elements.adminHomeCards.querySelector("#cyberUserBox");
    const menuLogoutBtn = elements.adminHomeCards.querySelector("#cyberMenuLogoutBtn");

    function closeCyberMenu() {
      if (userMenu) {
        userMenu.hidden = true;
        userBtn?.setAttribute("aria-expanded", "false");
      }
    }

    function toggleCyberMenu() {
      if (userMenu) {
        const isOpening = userMenu.hidden;
        if (isOpening) {
          document.querySelectorAll("[data-issue-notification-popover]").forEach((popover) => { popover.hidden = true; });
          document.querySelectorAll("[data-issue-notification-toggle]").forEach((button) => button.setAttribute("aria-expanded", "false"));
        }
        userMenu.hidden = !isOpening;
        userBtn?.setAttribute("aria-expanded", String(isOpening));
      }
    }

    if (userBtn && userMenu) {
      userBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleCyberMenu();
      });

      userMenu.querySelectorAll("[data-go-tab], [data-action]").forEach((item) => {
        item.addEventListener("click", () => {
          closeCyberMenu();
        });
      });

      userMenu.querySelectorAll("[data-theme-set]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const targetTheme = btn.getAttribute("data-theme-set");
          if (typeof window.setAppTheme === "function") {
            window.setAppTheme(targetTheme);
          }
        });
      });

    }

    if (menuLogoutBtn && elements.logoutButton) {
      menuLogoutBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        closeCyberMenu();
        elements.logoutButton.click();
      });
    }

    if (typeof renderRoleVisibility === "function") {
      renderRoleVisibility();
    }
  }

  window.PageRegistry.register({
    id: "home",
    title: "Trang chủ",
    render,
  });
})();
