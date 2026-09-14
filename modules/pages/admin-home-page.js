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



  const STEPS_DATA = [
    {
      id: "sort",
      badge: "1S",
      badgeLabel: "SÀNG LỌC",
      name: "SORT",
      fullName: "Sàng Lọc (Seiri)",
      desc: "Phân loại vật dụng cần thiết và không cần thiết. Loại bỏ triệt để các vật dụng không còn giá trị sử dụng khỏi khu vực làm việc để tiết kiệm không gian và tránh nhầm lẫn.",
      action: "summary",
    },
    {
      id: "set",
      badge: "2S",
      badgeLabel: "SẮP XẾP",
      name: "SET IN ORDER",
      fullName: "Sắp Xếp (Seiton)",
      desc: "Sắp xếp mọi đồ dùng khoa học, ngăn nắp theo nguyên tắc: dễ tìm, dễ thấy, dễ lấy, dễ trả lại. Đánh dấu vị trí, gắn nhãn nhận diện rõ ràng.",
      action: "summary",
    },
    {
      id: "shine",
      badge: "3S",
      badgeLabel: "SẠCH SẼ",
      name: "SHINE",
      fullName: "Sạch Sẽ (Seiso)",
      desc: "Vệ sinh nơi làm việc, máy móc, trang thiết bị mỗi ngày. Giữ môi trường sản xuất luôn sáng sủa, sạch đẹp, phát hiện sớm nguy cơ hỏng hóc hoặc sự cố rò rỉ.",
      action: "summary",
    },
    {
      id: "standardize",
      badge: "4S",
      badgeLabel: "SĂN SÓC",
      name: "STANDARDIZE",
      fullName: "Săn Sóc (Seiketsu)",
      desc: "Chuẩn hóa các quy trình, xây dựng bảng kiểm và tiêu chuẩn 3S để duy trì liên tục trong toàn bộ các phòng ban, xưởng sản xuất.",
      action: "assessment",
    },
    {
      id: "sustain",
      badge: "5S",
      badgeLabel: "SẴN SÀNG",
      name: "SUSTAIN",
      fullName: "Sẵn Sàng (Shitsuke)",
      desc: "Hình thành thói quen, kỷ luật tự giác và văn hóa an toàn 5S trong toàn thể cán bộ nhân viên nhà máy thông qua đánh giá và cải tiến định kỳ.",
      action: "assessment",
    },
  ];

  function getStepIconSvg(stepId) {
    switch (stepId) {
      case "sort":
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
        </svg>`;
      case "set":
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>`;
      case "shine":
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>`;
      case "standardize":
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="m9 12 2 2 4-4"/>
        </svg>`;
      case "sustain":
      default:
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
        </svg>`;
    }
  }

  function openGuideModal(initialStepId, canScoreFiveS = false) {
    closeGuideModal();

    const backdrop = document.createElement("div");
    backdrop.className = "cyber-modal-backdrop";
    backdrop.id = "cyberGuideModal";

    const stepsHtml = STEPS_DATA.map((step) => `
      <div class="cyber-guide-step-card ${step.id === initialStepId ? 'is-highlighted' : ''}">
        <div class="cyber-guide-step-icon">
          ${getStepIconSvg(step.id)}
        </div>
        <div class="cyber-guide-step-content">
          <strong>${step.badge} • ${step.fullName}</strong>
          <p>${step.desc}</p>
        </div>
      </div>
    `).join("");

    backdrop.innerHTML = `
      <div class="cyber-modal-card">
        <div class="cyber-modal-header">
          <h3 class="cyber-modal-title">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#38bdf8" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Cẩm Nang Tiêu Chuẩn 5S & An Toàn Lao Động
          </h3>
          <button class="cyber-modal-close" type="button" aria-label="Đóng" id="cyberCloseModalBtn">✕</button>
        </div>
        <div class="cyber-modal-body">
          ${stepsHtml}
        </div>
        <div class="cyber-modal-footer">
          ${canScoreFiveS ? `
            <button class="cyber-guide-button assessor-only" type="button" data-go-tab="assessor" style="font-size:0.88rem; padding:8px 20px;">
              📝 Đến Phiếu Chấm 5S
            </button>
          ` : ""}
          <button class="cyber-guide-button five-s-access-only" type="button" data-go-tab="summary" style="font-size:0.88rem; padding:8px 20px;">
            📊 Xem Bảng Điểm 5S
          </button>
          <button class="cyber-guide-button safety-access-only" type="button" data-go-safety-report="assessment" style="font-size:0.88rem; padding:8px 20px;">
            🛡️ Xem Đánh Giá An Toàn
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop || e.target.id === "cyberCloseModalBtn" || e.target.closest("#cyberCloseModalBtn")) {
        closeGuideModal();
      }
    });

    const actionButtons = backdrop.querySelectorAll("[data-go-tab], [data-go-safety-report]");
    actionButtons.forEach((btn) => {
      btn.addEventListener("click", () => closeGuideModal());
    });
  }

  function closeGuideModal() {
    const existing = document.getElementById("cyberGuideModal");
    if (existing) {
      existing.remove();
    }
  }

  function render(context) {
    const {
      SAFETY_PERIOD_TYPE,
      FIVE_S_PERIOD_TYPE,
      currentUser,
      elements,
      escapeHtml,
      getActivePeriodId,
      getPeriod,
      isAdminAccount,
      hasAccountAccessType,
      isFiveSAssessor,
      renderRoleVisibility,
      periodLabel,
    } = context;

    if (!currentUser || !elements.adminHomeCards) {
      return;
    }

    const canScoreFiveS = !isAdminAccount(currentUser) && Boolean(
      typeof hasAccountAccessType === "function"
        ? hasAccountAccessType(currentUser, FIVE_S_PERIOD_TYPE)
        : (typeof isFiveSAssessor === "function" ? isFiveSAssessor(currentUser) : false)
    );

    elements.adminHomeCards.classList.add("has-cyber-home");

    const fiveSPeriod = getPeriod(getActivePeriodId(FIVE_S_PERIOD_TYPE));
    const safetyPeriod = getPeriod(getActivePeriodId(SAFETY_PERIOD_TYPE));
    const fiveSPeriodText = periodLabel(fiveSPeriod);
    const safetyPeriodText = periodLabel(safetyPeriod);

    elements.adminHomeCards.innerHTML = `
      <div class="cyber-home-container">
        <!-- Animated 3D Perspective Grid Floor -->
        <div class="cyber-grid-floor">
          <div class="cyber-grid-plane"></div>
        </div>
        <div class="cyber-horizon-glow"></div>
        <div class="cyber-stars"></div>

        <!-- Glowing Circuit Fiber Cables Overlay with traveling photons -->
        <svg class="cyber-circuit-overlay" viewBox="0 0 1200 800" fill="none" preserveAspectRatio="none">
          <!-- Left badges to Terminal -->
          <path class="cyber-circuit-line" d="M 280 250 L 350 250 L 380 300 L 420 300" />
          <path class="cyber-circuit-pulse" d="M 280 250 L 350 250 L 380 300 L 420 300" />

          <!-- Safety Kit Pedestal to Terminal -->
          <path class="cyber-circuit-line" d="M 240 590 L 330 590 L 380 490 L 420 490" />
          <path class="cyber-circuit-pulse" d="M 240 590 L 330 590 L 380 490 L 420 490" />

          <!-- Terminal to Right Safety Rig -->
          <path class="cyber-circuit-line" d="M 780 310 L 850 310 L 890 270 L 920 270" />
          <path class="cyber-circuit-pulse" d="M 780 310 L 850 310 L 890 270 L 920 270" />

          <!-- Terminal to Telemetry HUD -->
          <path class="cyber-circuit-line" d="M 780 480 L 840 480 L 880 540 L 950 540" />
          <path class="cyber-circuit-pulse" d="M 780 480 L 840 480 L 880 540 L 950 540" />

          <!-- Connecting Node Bulbs -->
          <circle cx="280" cy="250" r="4" fill="#38bdf8" />
          <circle cx="420" cy="300" r="4" fill="#38bdf8" />
          <circle cx="240" cy="590" r="4" fill="#38bdf8" />
          <circle cx="420" cy="490" r="4" fill="#38bdf8" />
          <circle cx="780" cy="310" r="4" fill="#38bdf8" />
          <circle cx="920" cy="270" r="4" fill="#38bdf8" />
          <circle cx="780" cy="480" r="4" fill="#38bdf8" />
          <circle cx="950" cy="540" r="4" fill="#38bdf8" />
        </svg>

        <!-- Top Navigation Bar / Cyber HUD Header -->
        <div class="cyber-top-nav">
          <div class="cyber-brand">
            <img src="images/Logo.jpg" alt="LeGroup" class="cyber-brand-logo">
            <div class="cyber-brand-text">
              <span class="cyber-brand-subtitle">LeGroup 5S</span>
              <strong class="cyber-brand-title">Control Terminal</strong>
            </div>
          </div>

          <!-- All Sidebar Items as Direct Cyber HUD Buttons with Drag-to-Scroll -->
          <div class="cyber-nav-links" id="cyberNavLinks">
            <button class="cyber-nav-btn is-active" type="button" data-go-tab="home" title="Trang chủ Cyber Hub">
              <span>🏠</span> Trang chủ
            </button>
            <span class="cyber-nav-divider"></span>
            ${canScoreFiveS ? `
              <button class="cyber-nav-btn assessor-only" type="button" data-go-tab="assessor" title="Phiếu chấm điểm 5S">
                <span>📝</span> Phiếu chấm
              </button>
            ` : ""}
            <button class="cyber-nav-btn five-s-access-only" type="button" data-go-tab="summary" title="Tổng hợp điểm 5S">
              <span>📊</span> Bảng Điểm 5S
            </button>
            <span class="cyber-nav-divider"></span>
            <button class="cyber-nav-btn safety-access-only" type="button" data-go-safety-report="assessment" title="Đánh giá an toàn">
              <span>🛡️</span> Đánh giá AT
            </button>
            <button class="cyber-nav-btn admin-only" type="button" data-go-safety-report="identification" title="Tổng hợp nhận diện nguy cơ mất an toàn">
              <span>⚠️</span> Nhận diện nguy cơ
            </button>
            <button class="cyber-nav-btn admin-only" type="button" data-go-safety-report="factory" title="Tổng hợp nguy cơ mất an toàn nhà máy">
              <span>🏭</span> Nguy cơ NM
            </button>
            <button class="cyber-nav-btn admin-only" type="button" data-go-tab="issue-stats" title="Thống kê an toàn">
              <span>📈</span> Thống kê AT
            </button>
          </div>

          <!-- Right Side: User Profile -->
          <div class="cyber-top-right">
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
                  <span>👤</span>
                  Cấp tài khoản
                </button>
                <button class="account-menu-item admin-only" type="button" data-go-tab="catalog">
                  <span>🗂</span>
                  Danh mục
                </button>
                <button class="account-menu-item admin-only" type="button" data-action="show-edit-history">
                  <span>🕘</span>
                  Lịch sử chỉnh sửa
                </button>
                <button class="account-menu-item admin-only" type="button" data-action="show-problem-zone-emails">
                  <span>📋</span>
                  Email báo cáo zone có vấn đề
                </button>
                <div class="account-menu-divider"></div>
                <button class="account-menu-logout" id="cyberMenuLogoutBtn" type="button">
                  <span>↪</span>
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Interactive Cyber Stage -->
        <div class="cyber-stage">
          <!-- Left Column: Title, 5S Badges, Safety Kit Pedestal -->
          <div class="cyber-left-col">
            <h1 class="cyber-main-title">
              5S &
              <span>Safety</span>
            </h1>

            <!-- 5S Badges Row (with Red Number Badges) -->
            <div class="cyber-badges-row">
              ${STEPS_DATA.map((step, idx) => `
                <button class="cyber-badge-item" type="button" data-step-id="${step.id}" title="${step.fullName}">
                  <div class="cyber-badge-box">
                    ${getStepIconSvg(step.id)}
                    <span class="cyber-badge-indicator">${idx + 1}</span>
                  </div>
                  <span>${step.badgeLabel}</span>
                </button>
              `).join("")}
            </div>

            <!-- Safety Kit Pedestal with Concentric Animated Ripples -->
            <div class="cyber-safety-kit-pedestal" data-go-safety-report="assessment" role="button" tabindex="0" title="Đến Bảng Đánh Giá An Toàn Lao Động">
              <div class="cyber-kit-ripple">
                <div class="cyber-kit-ring r1"></div>
                <div class="cyber-kit-ring r2"></div>
                <!-- 3D Style First-Aid Box SVG -->
                <div class="cyber-kit-graphic">
                  <svg viewBox="0 0 80 70" width="76" height="66">
                    <defs>
                      <linearGradient id="kitBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#ffffff"/>
                        <stop offset="100%" stop-color="#e2e8f0"/>
                      </linearGradient>
                      <filter id="glowKit" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.5"/>
                      </filter>
                    </defs>
                    <path d="M 28 20 C 28 11, 52 11, 52 20" fill="none" stroke="#ef4444" stroke-width="4.5" stroke-linecap="round"/>
                    <rect x="10" y="18" width="60" height="46" rx="8" fill="url(#kitBodyGrad)" stroke="#94a3b8" stroke-width="2" filter="url(#glowKit)"/>
                    <rect x="22" y="24" width="6" height="8" rx="2" fill="#64748b"/>
                    <rect x="52" y="24" width="6" height="8" rx="2" fill="#64748b"/>
                    <rect x="35" y="31" width="10" height="24" rx="2" fill="#ef4444"/>
                    <rect x="28" y="38" width="24" height="10" rx="2" fill="#ef4444"/>
                  </svg>
                </div>
              </div>
              <span class="cyber-kit-label">Safety Kit</span>
              <small style="font-size:0.75rem; color:#38bdf8; opacity:0.9;">Kỳ AT: ${escapeHtml(safetyPeriodText)}</small>
            </div>
          </div>

          <!-- Central Column: Glassmorphic Terminal Window -->
          <div class="cyber-terminal-wrap">
            <div class="cyber-terminal">
              <!-- Window Traffic Light Control Bar -->
              <div class="cyber-terminal-head">
                <span class="cyber-head-dot dot-red"></span>
                <span class="cyber-head-dot dot-yellow"></span>
                <span class="cyber-head-dot dot-green"></span>
                <span style="margin-left: 8px; font-size: 0.75rem; color: #94a3b8; font-weight: 600;">5S & Safety Protocol Terminal</span>
              </div>

              <!-- 5 Interactive Rows -->
              <div class="cyber-terminal-body">
                ${STEPS_DATA.map((step) => `
                  <div class="cyber-step-row" data-step-id="${step.id}" role="button" tabindex="0" title="Nhấn xem chi tiết tiêu chuẩn ${step.fullName}">
                    <span class="cyber-step-name">${step.name}</span>
                    <div class="cyber-step-visual">
                      ${getStepIconSvg(step.id)}
                      <span style="font-size: 0.8rem; color: #94a3b8;">›</span>
                    </div>
                  </div>
                `).join("")}
              </div>

              <!-- Quick Action Bar Inside Terminal -->
              <div class="cyber-terminal-footer-actions">
                ${canScoreFiveS ? `
                  <button class="cyber-term-btn assessor-only" type="button" data-go-tab="assessor" title="Vào chấm điểm 5S">
                    <span>📝</span> Chấm Điểm 5S
                  </button>
                ` : ""}
                <button class="cyber-term-btn five-s-access-only" type="button" data-go-tab="summary" title="Xem tổng hợp điểm 5S">
                  <span>📊</span> Bảng Điểm 5S
                </button>
                <button class="cyber-term-btn safety-access-only" type="button" data-go-safety-report="assessment" title="Đánh giá an toàn">
                  <span>🛡️</span> Báo Cáo AT
                </button>
              </div>
            </div>

            <!-- Explore Interactive Guide CTA Button -->
            <div class="cyber-cta-wrap">
              <button class="cyber-guide-button" type="button" id="cyberGuideBtn">
                Explore Interactive Guide
              </button>
            </div>
          </div>

          <!-- Right Column: 3D Safety Hardhat, Vest, Orbiting Hologram & Telemetry -->
          <div class="cyber-right-col">
            <div class="cyber-gear-rig">
              <!-- Orbiting Holographic Ring -->
              <div class="cyber-orbit-ring"></div>

              <!-- Vector Art: Industrial Yellow Hardhat with Visor and Earmuffs -->
              <svg viewBox="0 0 160 130" width="160" height="130" style="filter: drop-shadow(0 12px 24px rgba(0,0,0,0.6)); z-index: 5;">
                <defs>
                  <linearGradient id="cyberHelmetGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#fef08a"/>
                    <stop offset="35%" stop-color="#facc15"/>
                    <stop offset="75%" stop-color="#eab308"/>
                    <stop offset="100%" stop-color="#ca8a04"/>
                  </linearGradient>
                  <linearGradient id="cyberVisorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.95"/>
                    <stop offset="100%" stop-color="#0284c7" stop-opacity="0.75"/>
                  </linearGradient>
                </defs>
                <!-- Hardhat Crown and Rim -->
                <path d="M 30 72 C 30 20, 130 20, 130 72 C 140 73, 145 78, 142 84 C 139 88, 125 90, 80 90 C 35 90, 21 88, 18 84 C 15 78, 20 73, 30 72 Z" fill="url(#cyberHelmetGrad)" stroke="#a16207" stroke-width="2"/>
                <!-- Center Ridge -->
                <path d="M 74 24 C 74 20, 86 20, 86 24 L 84 72 L 76 72 Z" fill="#fef9c3" opacity="0.7"/>
                <!-- Front Protective Visor / Goggles -->
                <path d="M 36 66 C 45 56, 115 56, 124 66 C 128 72, 116 80, 80 80 C 44 80, 32 72, 36 66 Z" fill="url(#cyberVisorGrad)" stroke="#38bdf8" stroke-width="1.8"/>
                <ellipse cx="58" cy="69" rx="14" ry="3.5" fill="#ffffff" opacity="0.5"/>
                <!-- Industrial Earmuffs -->
                <rect x="14" y="60" width="13" height="25" rx="6.5" fill="#1e293b" stroke="#64748b" stroke-width="1.5"/>
                <rect x="133" y="60" width="13" height="25" rx="6.5" fill="#1e293b" stroke="#64748b" stroke-width="1.5"/>
                <path d="M 20 60 C 20 36, 140 36, 140 60" fill="none" stroke="#475569" stroke-width="3"/>
              </svg>

              <!-- Vector Art: High-Visibility Reflective Safety Vest -->
              <svg viewBox="0 0 200 180" width="200" height="180" style="margin-top: -24px; filter: drop-shadow(0 16px 30px rgba(0,0,0,0.65)); z-index: 4;">
                <defs>
                  <linearGradient id="cyberVestGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#fb923c"/>
                    <stop offset="45%" stop-color="#f97316"/>
                    <stop offset="100%" stop-color="#ea580c"/>
                  </linearGradient>
                  <linearGradient id="cyberReflectBand" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#e2e8f0"/>
                    <stop offset="50%" stop-color="#ffffff"/>
                    <stop offset="100%" stop-color="#cbd5e1"/>
                  </linearGradient>
                </defs>
                <!-- Vest Silhouette -->
                <path d="M 60 10 L 30 40 L 15 150 L 65 165 L 100 165 L 135 165 L 185 150 L 170 40 L 140 10 L 115 35 C 105 45, 95 45, 85 35 Z" fill="url(#cyberVestGrad)" stroke="#c2410c" stroke-width="2"/>
                <!-- Neck opening & Center Zipper -->
                <path d="M 85 35 L 100 75 L 115 35" fill="none" stroke="#0f172a" stroke-width="3"/>
                <line x1="100" y1="75" x2="100" y2="165" stroke="#0f172a" stroke-width="3.5"/>
                <!-- Silver Reflective Stripes Vertical -->
                <path d="M 52 20 L 52 155" stroke="url(#cyberReflectBand)" stroke-width="14" stroke-linecap="round"/>
                <path d="M 148 20 L 148 155" stroke="url(#cyberReflectBand)" stroke-width="14" stroke-linecap="round"/>
                <!-- Silver Reflective Stripes Horizontal -->
                <path d="M 22 105 L 178 105" stroke="url(#cyberReflectBand)" stroke-width="14"/>
                <path d="M 25 135 L 175 135" stroke="url(#cyberReflectBand)" stroke-width="14"/>
                <!-- ID Badge -->
                <rect x="120" y="60" width="22" height="28" rx="3" fill="#ffffff" stroke="#94a3b8" stroke-width="1"/>
                <rect x="124" y="64" width="14" height="8" fill="#38bdf8"/>
                <line x1="124" y1="76" x2="138" y2="76" stroke="#64748b" stroke-width="1.5"/>
                <line x1="124" y1="81" x2="134" y2="81" stroke="#64748b" stroke-width="1.5"/>
              </svg>

              <!-- Floating Telemetry HUD Widgets -->
              <div class="cyber-hud-card cyber-hud-top-left" title="Khu vực nhà máy">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>295 km</span>
              </div>

              <div class="cyber-hud-card cyber-hud-top-right" title="Điểm TB 5S">
                75
              </div>

              <div class="cyber-hud-card cyber-hud-metric-card" data-go-tab="issue-stats" role="button" tabindex="0" title="Nhấp xem chi tiết Thống Kê An Toàn">
                <span class="cyber-hud-metric-head">95%</span>
                <span class="cyber-hud-metric-sub">Tuân thủ an toàn</span>
                <div class="cyber-hud-bars">
                  <span class="cyber-hud-bar"></span>
                  <span class="cyber-hud-bar"></span>
                  <span class="cyber-hud-bar"></span>
                  <span class="cyber-hud-bar"></span>
                  <span class="cyber-hud-bar"></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Flowchart Sequence & Big Action Buttons -->
        <div class="cyber-bottom-flow">
          <div class="cyber-flow-card">
            <div class="cyber-flow-item">
              <span>SORT</span>
              <small>Sàng Lọc</small>
            </div>
            <span class="cyber-flow-arrow">➔</span>
            <div class="cyber-flow-item">
              <span>SẮP XẾP</span>
              <small>Set in Order</small>
            </div>
            <span class="cyber-flow-arrow">➔</span>
            <div class="cyber-flow-item">
              <span>SHINE</span>
              <small>Sạch Sẽ</small>
            </div>
            <span class="cyber-flow-arrow">➔</span>
            <div class="cyber-flow-item">
              <span>STANDARDIZE</span>
              <small>Săn Sóc</small>
            </div>
            <span class="cyber-flow-arrow">➔</span>
            <div class="cyber-flow-item">
              <span>SUSTAIN</span>
              <small>Sẵn Sàng</small>
            </div>
          </div>

          <div class="cyber-bottom-flow-actions">
            <button class="cyber-learn-button" type="button" data-go-tab="summary" style="padding: 10px 22px; font-weight:700;">
              📊 Bảng Điểm 5S (${escapeHtml(fiveSPeriodText)})
            </button>
            <button class="cyber-learn-button" type="button" data-go-safety-report="assessment" style="padding: 10px 22px; font-weight:700;">
              🛡️ Đánh Giá An Toàn (${escapeHtml(safetyPeriodText)})
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind Guide buttons and step clicks
    const guideBtn = elements.adminHomeCards.querySelector("#cyberGuideBtn");
    if (guideBtn) {
      guideBtn.addEventListener("click", () => openGuideModal(undefined, canScoreFiveS));
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
    }

    if (menuLogoutBtn && elements.logoutButton) {
      menuLogoutBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        closeCyberMenu();
        elements.logoutButton.click();
      });
    }

    const stepRows = elements.adminHomeCards.querySelectorAll(".cyber-step-row, .cyber-badge-item");
    stepRows.forEach((row) => {
      row.addEventListener("click", () => {
        const stepId = row.dataset.stepId;
        openGuideModal(stepId, canScoreFiveS);
      });
    });

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