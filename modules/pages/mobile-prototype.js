(() => {
  "use strict";

  // Rapid Hazard Presets for Safety Reporting
  const RAPID_HAZARD_PRESETS = [
    { text: "Cáp điện hở nguy hiểm", label: "+ Cáp điện hở" },
    { text: "Sàn trơn trượt có vệt dầu", label: "+ Sàn trơn trượt" },
    { text: "Hàng hóa xếp vượt chiều cao quy định (>2m)", label: "+ Hàng để cao" },
    { text: "Chắn lối thoát hiểm / Cản trở bình PCCC", label: "+ Chắn lối thoát" },
    { text: "Không mang đầy đủ BHLĐ / PPE", label: "+ Thiếu BHLĐ / PPE" },
    { text: "Rò rỉ dầu mỡ / Hóa chất ra sàn", label: "+ Rò rỉ dầu/hóa chất" },
    { text: "Kẹt cuốn cơ khí / Thiếu tấm che an toàn", label: "+ Kẹt cuốn cơ khí" },
    { text: "Xe nâng chạy nhanh / Điểm mù góc khuất", label: "+ Xe nâng / Va chạm" },
  ];

  // Section categories for 5S navigation filter
  const SECTION_FILTERS = [
    { id: "all", label: "Tất cả" },
    { id: "A", label: "A - Đường đi" },
    { id: "B", label: "B - Hàng hóa" },
    { id: "C", label: "C - Dây chuyền" },
    { id: "D", label: "D - Nghỉ ngơi" },
    { id: "E", label: "E - Tự giác" },
  ];

  // Level names
  const LEVEL_NAMES = {
    1: "Rất xấu",
    2: "Xấu",
    3: "Bình thường",
    4: "Tốt",
    5: "Rất tốt",
  };

  // State
  let activeTab = "safety"; // "safety" | "5s"
  let isFullWidth = false;
  let currentFiveSZoneId = "";
  let currentSafetyZoneId = "";
  let activeSectionFilter = "all";
  let uploadedSafetyPhotoData = "";
  let uploadedSafetyAfterPhotoData = "";
  let editingSafetyRecordId = "";
  let currentAppContext = null;

  function openMobileImageModal(imgSrc, title = "Xem ảnh") {
    if (!imgSrc || imgSrc === "images/Logo.jpg") return;
    const existing = document.getElementById("mobileImageModal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "mobileImageModal";
    modal.className = "mobile-image-modal";
    modal.innerHTML = `
      <div class="mobile-image-modal-backdrop"></div>
      <div class="mobile-image-modal-content">
        <div class="mobile-image-modal-header">
          <span>${title}</span>
          <button type="button" class="btn-close-modal" id="closeMobileImageModalBtn">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="mobile-image-modal-body">
          <img src="${imgSrc}" alt="${title}" class="mobile-modal-full-img">
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector(".mobile-image-modal-backdrop").addEventListener("click", close);
    modal.querySelector("#closeMobileImageModalBtn").addEventListener("click", close);
  }

  function formatIsoToVnDate(isoStr) {
    if (!isoStr) return "";
    const clean = String(isoStr).split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts;
      if (y && m && d) {
        return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
      }
    }
    return clean;
  }

  function openSafetyDetailModal(item, overlay, context) {
    if (!item) return;
    const existing = document.getElementById("mobileSafetyDetailModal");
    if (existing) existing.remove();

    const fiveSPeriodId = context?.getActivePeriodId?.(context.SAFETY_PERIOD_TYPE) || "";
    const allAreas = context ? context.getAreasForPeriod(fiveSPeriodId) : [];
    const itemArea = allAreas.find((a) => a.id === item.areaId);
    const zoneLabel = itemArea ? `Zone ${itemArea.code} · ${itemArea.departmentHead || itemArea.responsibleName || ''}` : (item.issueLocation || "Zone");
    const statusText = item.issueStatus === "closed" ? "Đã khắc phục" : item.issueStatus === "in_progress" ? "Đang xử lý" : "Chờ xử lý";
    const statusClass = item.issueStatus === "closed" ? "status-closed" : item.issueStatus === "in_progress" ? "status-progress" : "status-open";
    
    const issueLevel = String(item.issueLevel || item.level || item.riskLevel || "").trim().toUpperCase();
    const issueType = String(item.issueType || item.stop6 || item.stop_6 || item.issue_type || "").trim();
    const foundChannelText = item.foundChannel === "head" ? "Trưởng bộ phận" : item.foundChannel === "assessor" ? "Assessor" : "Công nhân";
    const itemDate = item.issueDay && item.issueMonth ? `${String(item.issueDay).padStart(2, '0')}/${String(item.issueMonth).padStart(2, '0')}` : (item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("vi-VN") : "");

    const modal = document.createElement("div");
    modal.id = "mobileSafetyDetailModal";
    modal.className = "mobile-safety-detail-modal";
    modal.innerHTML = `
      <div class="detail-modal-backdrop"></div>
      <div class="detail-modal-content">
        
        <div class="detail-modal-header">
          <div class="detail-header-title">
            <i class="fa-solid fa-shield-halved text-brand-400"></i>
            <span>Chi tiết báo cáo mối nguy</span>
          </div>
          <button type="button" class="btn-close-modal" id="closeDetailModalBtn">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="detail-modal-body">
          <!-- Status Banner -->
          <div class="detail-meta-top">
            <span class="detail-zone-chip">${escapeHtml(zoneLabel)}</span>
            <span class="history-status-badge ${statusClass}">${statusText}</span>
          </div>

          <!-- Prominent Tags: Level & STOP 6 -->
          <div class="detail-tags-row">
            <div class="detail-tag-item">
              <span class="detail-tag-label">Cấp bậc:</span>
              <span class="history-pill ${issueLevel === 'A' ? 'pill-level-a' : issueLevel === 'B' ? 'pill-level-b' : issueLevel === 'C' ? 'pill-level-c' : 'pill-level-none'} font-bold">
                ${issueLevel ? `Cấp độ ${escapeHtml(issueLevel)}` : 'Chưa phân loại'}
              </span>
            </div>
            <div class="detail-tag-item">
              <span class="detail-tag-label">STOP 6:</span>
              <span class="history-pill pill-stop6 font-bold">
                <i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(issueType || 'Chưa phân loại')}
              </span>
            </div>
          </div>

          <!-- Description -->
          <div class="detail-section">
            <span class="detail-section-label">Mô tả mối nguy hiểm:</span>
            <p class="detail-description-text">${escapeHtml(item.note || 'Không có mô tả')}</p>
          </div>

          <!-- Info Grid -->
          <div class="detail-info-grid">
            <div class="detail-info-cell">
              <span class="cell-label">Ngày phát hiện</span>
              <span class="cell-val font-mono">${escapeHtml(itemDate || '—')}</span>
            </div>
            <div class="detail-info-cell">
              <span class="cell-label">Phát hiện bởi (Kênh)</span>
              <span class="cell-val">${escapeHtml(foundChannelText)}</span>
            </div>
            <div class="detail-info-cell">
              <span class="cell-label">Tên người phát hiện</span>
              <span class="cell-val">${escapeHtml(item.issueFoundBy || '—')}</span>
            </div>
            <div class="detail-info-cell">
              <span class="cell-label">Mã nhân viên</span>
              <span class="cell-val font-mono">${escapeHtml(item.employeeCode || '—')}</span>
            </div>
          </div>

          <!-- Countermeasure Details (if any) -->
          ${item.improvementContent || item.actionOwner || item.actionPlan || item.completionDate ? `
            <div class="detail-section detail-countermeasure-box">
              <span class="detail-section-label text-emerald-400"><i class="fa-solid fa-wrench"></i> Đối sách cải tiến:</span>
              ${item.improvementContent ? `<p class="detail-countermeasure-text">${escapeHtml(item.improvementContent)}</p>` : ''}
              <div class="detail-info-grid" style="margin-top: 6px;">
                ${item.actionOwner ? `<div class="detail-info-cell"><span class="cell-label">Đảm nhiệm</span><span class="cell-val">${escapeHtml(item.actionOwner)}</span></div>` : ''}
                ${item.actionPlan ? `<div class="detail-info-cell"><span class="cell-label">Kế hoạch</span><span class="cell-val">${escapeHtml(item.actionPlan)}</span></div>` : ''}
                ${item.completionDate ? `<div class="detail-info-cell"><span class="cell-label">Ngày hoàn thành</span><span class="cell-val font-mono">${escapeHtml(formatIsoToVnDate(item.completionDate))}</span></div>` : ''}
              </div>
            </div>
          ` : ''}

          <!-- Photos -->
          ${item.photoDataUrl || item.afterPhotoDataUrl ? `
            <div class="detail-photos-row">
              ${item.photoDataUrl ? `
                <div class="detail-photo-card" data-preview-img="${item.photoDataUrl}">
                  <img src="${item.photoDataUrl}" alt="Ảnh hiện trường">
                  <span>Ảnh hiện trường (Chạm xem)</span>
                </div>
              ` : ''}
              ${item.afterPhotoDataUrl ? `
                <div class="detail-photo-card" data-preview-img="${item.afterPhotoDataUrl}">
                  <img src="${item.afterPhotoDataUrl}" alt="Ảnh sau cải tiến">
                  <span>Ảnh sau cải tiến (Chạm xem)</span>
                </div>
              ` : ''}
            </div>
          ` : ''}

        </div>

        <!-- Action Buttons Footer -->
        <div class="detail-modal-footer">
          <button type="button" class="btn-detail-edit" id="btnDetailEdit">
            <i class="fa-solid fa-pen-to-square"></i> SỬA BÁO CÁO
          </button>
          <button type="button" class="btn-detail-delete" id="btnDetailDelete">
            <i class="fa-solid fa-trash-can"></i> XÓA BÁO CÁO
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector(".detail-modal-backdrop").addEventListener("click", closeModal);
    modal.querySelector("#closeDetailModalBtn").addEventListener("click", closeModal);

    // Lightbox for photos in detail modal
    modal.querySelectorAll("[data-preview-img]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openMobileImageModal(el.dataset.previewImg, "Ảnh báo cáo");
      });
    });

    // Edit button click inside detail modal
    modal.querySelector("#btnDetailEdit")?.addEventListener("click", () => {
      editingSafetyRecordId = item.id;
      uploadedSafetyPhotoData = item.photoDataUrl || "";
      uploadedSafetyAfterPhotoData = item.afterPhotoDataUrl || "";
      closeModal();
      renderSafetyScreen(overlay, context);
      const formEl = overlay.querySelector("#mobileSafetyForm");
      formEl?.scrollIntoView({ behavior: "smooth", block: "start" });
      overlay.querySelector("#mobileSafetyDescription")?.focus();
    });

    // Delete button click inside detail modal
    modal.querySelector("#btnDetailDelete")?.addEventListener("click", async () => {
      if (!confirm("Bạn có chắc chắn muốn xóa báo cáo mối nguy này không?")) {
        return;
      }
      try {
        let deleted = false;
        if (typeof context?.deleteSafetyRecordDirect === "function") {
          deleted = await context.deleteSafetyRecordDirect(item.id);
        }
        if (!deleted && typeof context?.deleteSafetyRecordFromDb === "function") {
          await context.deleteSafetyRecordFromDb(item.id);
          deleted = true;
        }
        if (context?.state?.safetyRecords) {
          context.state.safetyRecords = context.state.safetyRecords.filter((r) => r.id !== item.id);
        }
        if (editingSafetyRecordId === item.id) {
          editingSafetyRecordId = "";
          uploadedSafetyPhotoData = "";
          uploadedSafetyAfterPhotoData = "";
        }
        closeModal();
        showMobileToast("Đã xóa báo cáo mối nguy thành công!");
        renderSafetyScreen(overlay, context);
      } catch (err) {
        console.error("Lỗi khi xóa:", err);
        showMobileToast("Lỗi khi xóa: " + (err.message || err), true);
      }
    });
  }

  function getAppContext() {
    if (currentAppContext) return currentAppContext;
    if (typeof window.__GET_APP_CONTEXT__ === "function") {
      currentAppContext = window.__GET_APP_CONTEXT__();
      return currentAppContext;
    }
    if (window.__APP_CONTEXT__) {
      currentAppContext = window.__APP_CONTEXT__;
      return currentAppContext;
    }
    return null;
  }

  // Open Mobile Prototype View
  function openMobilePrototype(initialTab = "safety", passedContext = null) {
    if (passedContext) {
      currentAppContext = passedContext;
    }
    const context = getAppContext();
    activeTab = initialTab === "5s" ? "5s" : "safety";

    // Close existing if open
    closeMobilePrototype();

    const overlay = document.createElement("div");
    overlay.className = "mobile-responsive-overlay";
    overlay.id = "mobileProtoOverlay";

    // Render skeleton
    overlay.innerHTML = buildOverlaySkeletonHtml(context);
    document.body.appendChild(overlay);
    document.body.classList.add("mobile-proto-open");

    // Initialize zones & handlers
    initMobilePrototype(overlay, context);
  }

  // Close Mobile Prototype
  function closeMobilePrototype() {
    const existing = document.getElementById("mobileProtoOverlay");
    if (existing) {
      existing.classList.add("is-closing");
      setTimeout(() => {
        existing.remove();
        document.body.classList.remove("mobile-proto-open");
      }, 200);
    }
  }

  // Build Skeleton HTML
  function buildOverlaySkeletonHtml(context) {
    const user = context?.currentUser;
    const assessorName = context?.getAccountDisplayName?.(user, context.FIVE_S_PERIOD_TYPE) || user?.name || user?.username || "Đánh giá viên";
    const fiveSPeriodId = context?.getActivePeriodId?.(context.FIVE_S_PERIOD_TYPE) || "";
    const fiveSPeriod = context?.getPeriod?.(fiveSPeriodId);
    const periodBadgeText = fiveSPeriod ? context.periodLabel(fiveSPeriod) : "Kỳ đang mở";

    return `
      <!-- Desktop Top Control Bar (Hidden on small mobile screens) -->
      <header class="mobile-responsive-topbar">
        <div class="topbar-left">
          <span class="topbar-pulse-dot"></span>
          <span class="topbar-title">5S & Safety Industrial Mobile View</span>
        </div>
        <div class="topbar-right">
          <button type="button" id="mobileToggleWidthBtn" class="topbar-btn" title="Chuyển chế độ mở rộng / thu gọn">
            <i class="fa-solid fa-expand"></i>
            <span id="mobileToggleWidthText">Mở rộng</span>
          </button>
          <button type="button" id="mobileReturnDashboardBtn" class="topbar-btn topbar-btn-return" title="Quay lại Trang chủ">
            <i class="fa-solid fa-arrow-left"></i>
            <span>Về trang chủ</span>
          </button>
        </div>
      </header>

      <!-- Main Responsive Shell (Real mobile interface, NO phone bezel) -->
      <main class="mobile-responsive-shell" id="mobileResponsiveShell">
        
        <!-- App Header Inside View -->
        <div class="mobile-nav-header">
          <div class="nav-header-brand-row">
            <div class="nav-header-logo-group">
              <div class="nav-header-avatar">LG</div>
              <div>
                <h1 class="nav-header-title">LeGroup Factory</h1>
                <p class="nav-header-assessor">
                  <i class="fa-solid fa-user-check"></i>
                  <span>Assessor: <strong id="mobileNavAssessorName">${escapeHtml(assessorName)}</strong></span>
                </p>
              </div>
            </div>
            <div class="nav-header-period-pill">
              <span class="period-pill-text">${escapeHtml(periodBadgeText)}</span>
              <button type="button" id="mobileNavCloseBtn" class="mobile-nav-close-btn" title="Đóng">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          <!-- Segmented Tab Switcher -->
          <div class="mobile-tab-switcher">
            <button type="button" id="mobileTabBtnSafety" class="mobile-tab-btn ${activeTab === 'safety' ? 'is-active-safety' : ''}">
              <i class="fa-solid fa-triangle-exclamation text-amber-400"></i>
              <span>Báo Cáo An Toàn</span>
            </button>
            <button type="button" id="mobileTabBtn5S" class="mobile-tab-btn ${activeTab === '5s' ? 'is-active-fives' : ''}">
              <i class="fa-solid fa-clipboard-check text-emerald-400"></i>
              <span>Chấm Điểm 5S</span>
            </button>
          </div>
        </div>

        <!-- SCREEN 1: BÁO CÁO AN TOÀN -->
        <div id="mobileScreenSafety" class="mobile-screen-pane ${activeTab === 'safety' ? '' : 'is-hidden'}">
          <!-- Populated by renderSafetyScreen() -->
        </div>

        <!-- SCREEN 2: CHẤM ĐIỂM 5S -->
        <div id="mobileScreen5S" class="mobile-screen-pane ${activeTab === '5s' ? '' : 'is-hidden'}">
          <!-- Populated by renderFiveSScreen() -->
        </div>

      </main>

      <!-- Toast Notification Container -->
      <div id="mobileToast" class="mobile-toast-popup">
        <i class="fa-solid fa-circle-check text-emerald-400"></i>
        <span id="mobileToastText">Thao tác thành công</span>
      </div>
    `;
  }

  // Initialize listeners and content
  function initMobilePrototype(overlay, context) {
    // Return button
    const returnBtn = overlay.querySelector("#mobileReturnDashboardBtn");
    if (returnBtn) returnBtn.addEventListener("click", closeMobilePrototype);
    const closeBtn = overlay.querySelector("#mobileNavCloseBtn");
    if (closeBtn) closeBtn.addEventListener("click", closeMobilePrototype);

    // Full width toggle
    const toggleWidthBtn = overlay.querySelector("#mobileToggleWidthBtn");
    const toggleWidthText = overlay.querySelector("#mobileToggleWidthText");
    const shell = overlay.querySelector("#mobileResponsiveShell");
    if (toggleWidthBtn && shell) {
      toggleWidthBtn.addEventListener("click", () => {
        isFullWidth = !isFullWidth;
        shell.classList.toggle("is-full-width", isFullWidth);
        if (toggleWidthText) {
          toggleWidthText.textContent = isFullWidth ? "Thu gọn" : "Mở rộng";
        }
      });
    }

    // Tab switcher
    const tabBtnSafety = overlay.querySelector("#mobileTabBtnSafety");
    const tabBtn5S = overlay.querySelector("#mobileTabBtn5S");
    const screenSafety = overlay.querySelector("#mobileScreenSafety");
    const screen5S = overlay.querySelector("#mobileScreen5S");

    function switchMobileTab(tab) {
      activeTab = tab;
      if (tab === "safety") {
        tabBtnSafety.className = "mobile-tab-btn is-active-safety";
        tabBtn5S.className = "mobile-tab-btn";
        screenSafety.classList.remove("is-hidden");
        screen5S.classList.add("is-hidden");
        renderSafetyScreen(overlay, getAppContext());
      } else {
        tabBtn5S.className = "mobile-tab-btn is-active-fives";
        tabBtnSafety.className = "mobile-tab-btn";
        screen5S.classList.remove("is-hidden");
        screenSafety.classList.add("is-hidden");
        renderFiveSScreen(overlay, getAppContext());
      }
    }

    if (tabBtnSafety) tabBtnSafety.addEventListener("click", () => switchMobileTab("safety"));
    if (tabBtn5S) tabBtn5S.addEventListener("click", () => switchMobileTab("5s"));

    // Initial render based on activeTab
    if (activeTab === "safety") {
      renderSafetyScreen(overlay, context);
    } else {
      renderFiveSScreen(overlay, context);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN 1: BÁO CÁO AN TOÀN (SAFETY AUDIT & HAZARD REPORTING)
  // ─────────────────────────────────────────────────────────────────────────────
  function renderSafetyScreen(overlay, context) {
    const screen = overlay.querySelector("#mobileScreenSafety");
    if (!screen) return;

    const safetyPeriodId = context?.getActivePeriodId?.(context.SAFETY_PERIOD_TYPE) || "";
    const allSafetyAreas = context ? context.getAreasForPeriod(safetyPeriodId) : [];
    const reportableAreas = allSafetyAreas.filter((a) => {
      const code = String(a.templateCode || a.code || "").trim();
      return code !== "27";
    });

    const allRecords = context?.state?.safetyRecords || [];
    const editingRecord = editingSafetyRecordId ? allRecords.find((r) => r.id === editingSafetyRecordId) || null : null;

    if (editingRecord) {
      currentSafetyZoneId = editingRecord.areaId || currentSafetyZoneId;
      if (!uploadedSafetyPhotoData && editingRecord.photoDataUrl) {
        uploadedSafetyPhotoData = editingRecord.photoDataUrl;
      }
      if (!uploadedSafetyAfterPhotoData && editingRecord.afterPhotoDataUrl) {
        uploadedSafetyAfterPhotoData = editingRecord.afterPhotoDataUrl;
      }
    } else if (!currentSafetyZoneId && reportableAreas.length > 0) {
      currentSafetyZoneId = reportableAreas[0].id;
    }

    const now = new Date();
    const safetyPeriod = context?.getPeriod?.(safetyPeriodId);
    let defaultIssueDate = "";
    if (editingRecord?.issueDay && editingRecord?.issueMonth && safetyPeriod?.year) {
      defaultIssueDate = `${safetyPeriod.year}-${String(editingRecord.issueMonth).padStart(2, "0")}-${String(editingRecord.issueDay).padStart(2, "0")}`;
    } else if (safetyPeriod?.year && safetyPeriod?.month) {
      const d = String(now.getDate()).padStart(2, "0");
      defaultIssueDate = `${safetyPeriod.year}-${String(safetyPeriod.month).padStart(2, "0")}-${d}`;
    } else {
      defaultIssueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    }

    const dateStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Get current safety records for recent history
    const recentRecords = allRecords
      .filter((r) => !safetyPeriodId || r.periodId === safetyPeriodId)
      .slice(0, 20);

    const user = context?.currentUser;
    const defaultFinder = editingRecord ? (editingRecord.issueFoundBy || "") : (context?.getAccountDisplayName?.(user, context.SAFETY_PERIOD_TYPE, safetyPeriodId) || user?.name || "");

    screen.innerHTML = `
      <div class="mobile-safety-container">
        
        <!-- Metadata Banner -->
        <div class="mobile-info-banner">
          <div class="info-row">
            <span class="info-label"><i class="fa-regular fa-calendar-check text-brand-400"></i> Nguồn phát hiện:</span>
            <span class="info-value">Đánh giá an toàn nhà máy</span>
          </div>
          <div class="info-row">
            <span class="info-label"><i class="fa-regular fa-clock text-brand-400"></i> Thời gian:</span>
            <span class="info-value font-mono">${dateStr}</span>
          </div>
        </div>

        ${editingRecord ? `
          <div class="mobile-editing-alert-banner">
            <div>
              <i class="fa-solid fa-pen-to-square text-amber-400"></i>
              <span>Đang sửa mối nguy: <strong>${escapeHtml(editingRecord.note ? (editingRecord.note.slice(0, 32) + '...') : editingRecord.id)}</strong></span>
            </div>
            <button type="button" id="cancelEditSafetyBtn" class="btn-cancel-edit-mobile">
              <i class="fa-solid fa-xmark"></i> Hủy sửa
            </button>
          </div>
        ` : ''}

        <!-- Safety Form Card -->
        <form id="mobileSafetyForm" class="mobile-safety-form">
          
          <!-- Row 1: Zone & Ngày phát hiện -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Khu vực (Zone)<span class="required-star">*</span></label>
              <div class="select-wrapper">
                <select id="mobileSafetyZoneSelect" required class="form-control form-select">
                  <option value="">-- Chọn Zone --</option>
                  ${reportableAreas.map((area) => `
                    <option value="${escapeHtml(area.id)}" ${area.id === currentSafetyZoneId ? 'selected' : ''}>
                      Zone ${escapeHtml(area.code)} · ${escapeHtml(context?.getSafetyDepartmentForArea?.(area, safetyPeriodId) || area.departmentHead || area.responsibleName || "")}
                    </option>
                  `).join("")}
                </select>
                <i class="fa-solid fa-chevron-down select-chevron"></i>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Ngày phát hiện</label>
              <div class="date-input-container">
                <input type="text" id="mobileSafetyIssueDateDisplay" class="form-control date-custom-input" placeholder="dd/mm/yyyy" value="${formatIsoToVnDate(defaultIssueDate)}" readonly>
                <input type="date" id="mobileSafetyIssueDate" class="native-hidden-date-input" value="${escapeHtml(defaultIssueDate)}">
                <button type="button" class="btn-calendar-trigger" tabindex="-1">
                  <i class="fa-solid fa-calendar-days text-white"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Row 2: Mối nguy hiểm phát hiện được (Mô tả duy nhất bắt buộc) -->
          <div class="form-group">
            <label class="form-label">Mối nguy hiểm phát hiện <span class="required-star">*</span></label>
            <textarea id="mobileSafetyDescription" rows="3" required
              placeholder="Mô tả chi tiết vị trí và nội dung mối nguy hiểm phát hiện..."
              class="form-control form-textarea">${escapeHtml(editingRecord?.note || "")}</textarea>
          </div>

          <!-- Row 3: Photo Upload & Camera Component (Ảnh hiện trường) -->
          <div class="form-group">
            <label class="form-label">Hình ảnh minh họa hiện trường</label>
            
            <div id="mobilePhotoUploadBox" class="photo-upload-box">
              <input type="file" id="mobileSafetyFileInput" accept="image/*" capture="environment" class="photo-file-input">
              
              <div id="photoPlaceholder" class="photo-placeholder ${uploadedSafetyPhotoData ? 'is-hidden' : ''}">
                <div class="photo-icon-circle">
                  <i class="fa-solid fa-camera"></i>
                </div>
                <p class="photo-primary-prompt">Chụp ảnh hoặc Tải lên ảnh</p>
                <p class="photo-sub-prompt">Nhấn vào đây để mở máy ảnh / bộ sưu tập</p>
                <div class="photo-action-chip">
                  <i class="fa-solid fa-plus"></i> Chụp ảnh minh họa
                </div>
              </div>

              <div id="photoPreviewWrap" class="photo-preview-wrap ${uploadedSafetyPhotoData ? '' : 'is-hidden'}">
                <img id="mobileSafetyPreviewImg" src="${uploadedSafetyPhotoData || ''}" alt="Ảnh hiện trường" class="photo-preview-img cursor-pointer" data-preview-img="${uploadedSafetyPhotoData || ''}" title="Chạm để phóng to ảnh">
                <div class="photo-preview-actions">
                  <button type="button" id="mobileRetakePhotoBtn" class="photo-btn retake-btn" title="Đổi/Chụp lại ảnh">
                    <i class="fa-solid fa-arrows-rotate"></i>
                  </button>
                  <button type="button" id="mobileRemovePhotoBtn" class="photo-btn delete-btn" title="Xóa ảnh này">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
                <div class="photo-attached-badge">
                  <i class="fa-solid fa-circle-check"></i> Đã đính kèm ảnh
                </div>
              </div>
            </div>
          </div>

          <!-- Row 4: STOP 6 & Severity Grid (Cấp bậc có Chưa phân loại) -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Phân loại STOP 6</label>
              <div class="select-wrapper">
                <select id="mobileSafetyStop6" class="form-control form-select">
                  <option value="" ${!editingRecord?.issueType ? 'selected' : ''}>Chưa phân loại</option>
                  <option value="1-Kẹp,kẹt" ${editingRecord?.issueType === '1-Kẹp,kẹt' ? 'selected' : ''}>1-Kẹp, kẹt</option>
                  <option value="2-Vật nặng" ${editingRecord?.issueType === '2-Vật nặng' ? 'selected' : ''}>2-Vật nặng</option>
                  <option value="3-Xe cộ" ${editingRecord?.issueType === '3-Xe cộ' ? 'selected' : ''}>3-Xe cộ</option>
                  <option value="4-Rơi,ngã" ${editingRecord?.issueType === '4-Rơi,ngã' ? 'selected' : ''}>4-Rơi, ngã</option>
                  <option value="5-Điện giật" ${editingRecord?.issueType === '5-Điện giật' ? 'selected' : ''}>5-Điện giật</option>
                  <option value="6-Cháy nổ" ${editingRecord?.issueType === '6-Cháy nổ' ? 'selected' : ''}>6-Cháy nổ</option>
                  <option value="7-Loại khác" ${editingRecord?.issueType === '7-Loại khác' ? 'selected' : ''}>7-Loại khác</option>
                </select>
                <i class="fa-solid fa-chevron-down select-chevron"></i>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Cấp bậc nguy cơ</label>
              <div class="select-wrapper">
                <select id="mobileSafetyLevel" class="form-control form-select">
                  <option value="" ${!editingRecord?.issueLevel ? 'selected' : ''}>Chưa phân loại</option>
                  <option value="A" ${editingRecord?.issueLevel === 'A' ? 'selected' : ''}>Cấp độ A (Nghiêm trọng)</option>
                  <option value="B" ${editingRecord?.issueLevel === 'B' ? 'selected' : ''}>Cấp độ B</option>
                  <option value="C" ${editingRecord?.issueLevel === 'C' ? 'selected' : ''}>Cấp độ C (Nhẹ)</option>
                </select>
                <i class="fa-solid fa-chevron-down select-chevron"></i>
              </div>
            </div>
          </div>

          <!-- Row 5: Kênh phát hiện & Tình trạng -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Phát hiện bởi (kênh)</label>
              <div class="select-wrapper">
                <select id="mobileSafetyFoundChannel" class="form-control form-select">
                  <option value="worker" ${editingRecord?.foundChannel === 'worker' ? 'selected' : ''}>Công nhân</option>
                  <option value="head" ${editingRecord?.foundChannel === 'head' ? 'selected' : ''}>Trưởng bộ phận</option>
                  <option value="assessor" ${editingRecord?.foundChannel === 'assessor' || (!editingRecord && true) ? 'selected' : ''}>Assessor</option>
                </select>
                <i class="fa-solid fa-chevron-down select-chevron"></i>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Tình trạng</label>
              <div class="select-wrapper">
                <select id="mobileSafetyIssueStatus" class="form-control form-select">
                  <option value="open" ${editingRecord?.issueStatus === 'open' || (!editingRecord && true) ? 'selected' : ''}>Chờ xử lý</option>
                  <option value="in_progress" ${editingRecord?.issueStatus === 'in_progress' ? 'selected' : ''}>Đang xử lý</option>
                  <option value="closed" ${editingRecord?.issueStatus === 'closed' ? 'selected' : ''}>Đã khắc phục</option>
                </select>
                <i class="fa-solid fa-chevron-down select-chevron"></i>
              </div>
            </div>
          </div>

          <!-- Row 6: Tên người phát hiện & Mã nhân viên -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Tên người phát hiện</label>
              <input type="text" id="mobileSafetyIssueFoundBy" class="form-control" placeholder="Ghi rõ tên người phát hiện..." value="${escapeHtml(defaultFinder)}">
            </div>
            <div class="form-group">
              <label class="form-label">Mã nhân viên</label>
              <input type="text" id="mobileSafetyEmployeeCode" class="form-control" placeholder="Mã NV (nếu có)..." value="${escapeHtml(editingRecord?.employeeCode || '')}">
            </div>
          </div>

          <!-- Row 7: Hạng mục -->
          <div class="form-group">
            <label class="form-label">Hạng mục</label>
            <input type="text" id="mobileSafetyIssueItemLabel" class="form-control" placeholder="Hạng mục..." value="${escapeHtml(editingRecord?.issueItemLabel || 'Nhận diện nguy cơ mất an toàn')}">
          </div>

          <!-- Row 8: Nội dung cải tiến, xử lý -->
          <div class="form-group">
            <label class="form-label">Nội dung cải tiến, xử lý</label>
            <textarea id="mobileSafetyImprovementContent" rows="2"
              placeholder="Giải pháp / biện pháp xử lý hoặc đối sách..."
              class="form-control form-textarea">${escapeHtml(editingRecord?.improvementContent || '')}</textarea>
          </div>

          <!-- Row 9: Ảnh sau cải tiến -->
          <div class="form-group">
            <label class="form-label">Ảnh sau cải tiến (nếu có)</label>
            <div id="mobilePhotoAfterUploadBox" class="photo-upload-box">
              <input type="file" id="mobileSafetyAfterFileInput" accept="image/*" capture="environment" class="photo-file-input">
              
              <div id="photoAfterPlaceholder" class="photo-placeholder ${uploadedSafetyAfterPhotoData ? 'is-hidden' : ''}">
                <div class="photo-icon-circle">
                  <i class="fa-solid fa-image"></i>
                </div>
                <p class="photo-primary-prompt">Chụp / Đính kèm ảnh sau cải tiến</p>
                <div class="photo-action-chip">
                  <i class="fa-solid fa-plus"></i> Tải ảnh đối sách
                </div>
              </div>

              <div id="photoAfterPreviewWrap" class="photo-preview-wrap ${uploadedSafetyAfterPhotoData ? '' : 'is-hidden'}">
                <img id="mobileSafetyAfterPreviewImg" src="${uploadedSafetyAfterPhotoData || ''}" alt="Ảnh sau cải tiến" class="photo-preview-img cursor-pointer" data-preview-img="${uploadedSafetyAfterPhotoData || ''}" title="Chạm để phóng to ảnh">
                <div class="photo-preview-actions">
                  <button type="button" id="mobileRetakeAfterPhotoBtn" class="photo-btn retake-btn" title="Đổi ảnh">
                    <i class="fa-solid fa-arrows-rotate"></i>
                  </button>
                  <button type="button" id="mobileRemoveAfterPhotoBtn" class="photo-btn delete-btn" title="Xóa ảnh này">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
                <div class="photo-attached-badge">
                  <i class="fa-solid fa-circle-check"></i> Đã đính kèm ảnh sau cải tiến
                </div>
              </div>
            </div>
          </div>

          <!-- Row 10: Đảm nhiệm & Kế hoạch -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Đảm nhiệm (PIC)</label>
              <input type="text" id="mobileSafetyActionOwner" class="form-control" placeholder="Người chịu trách nhiệm..." value="${escapeHtml(editingRecord?.actionOwner || '')}">
            </div>
            <div class="form-group">
              <label class="form-label">Kế hoạch</label>
              <input type="text" id="mobileSafetyActionPlan" class="form-control" placeholder="Kế hoạch hoàn thành..." value="${escapeHtml(editingRecord?.actionPlan || '')}">
            </div>
          </div>

          <!-- Row 11: Ngày hoàn thành -->
          <div class="form-group">
            <label class="form-label">Ngày hoàn thành</label>
            <div class="date-input-container">
              <input type="text" id="mobileSafetyCompletionDateDisplay" class="form-control date-custom-input" placeholder="dd/mm/yyyy" value="${formatIsoToVnDate(editingRecord?.completionDate ? editingRecord.completionDate.split('T')[0] : '')}" readonly>
              <input type="date" id="mobileSafetyCompletionDate" class="native-hidden-date-input" value="${escapeHtml(editingRecord?.completionDate ? editingRecord.completionDate.split('T')[0] : '')}">
              <button type="button" class="btn-calendar-trigger" tabindex="-1">
                <i class="fa-solid fa-calendar-days text-white"></i>
              </button>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="form-submit-row">
            <button type="submit" id="mobileSubmitSafetyBtn" class="btn-primary-gradient">
              <i class="fa-solid ${editingRecord ? 'fa-floppy-disk' : 'fa-paper-plane'}"></i>
              <span>${editingRecord ? 'CẬP NHẬT BÁO CÁO AN TOÀN' : 'LƯU BÁO CÁO AN TOÀN'}</span>
            </button>
          </div>
        </form>

        <!-- Recent Uploads History List -->
        <div class="mobile-history-section">
          <div class="history-section-header">
            <h3 class="history-section-title">Danh sách mối nguy đã ghi nhận</h3>
            <span class="history-count-badge">${recentRecords.length} Mối nguy</span>
          </div>

          <div class="history-cards-list">
            ${recentRecords.length === 0 ? `
              <div class="history-empty-card">
                <i class="fa-solid fa-shield-check text-slate-500 text-2xl mb-1"></i>
                <p>Chưa có báo cáo mối nguy nào được ghi nhận trong kỳ này.</p>
              </div>
            ` : recentRecords.map((item) => {
              const itemArea = reportableAreas.find((a) => a.id === item.areaId) || allSafetyAreas.find((a) => a.id === item.areaId);
              const zoneLabel = itemArea ? `Zone ${itemArea.code}` : (item.issueLocation || "Zone");
              const statusText = item.issueStatus === "closed" ? "Đã khắc phục" : item.issueStatus === "in_progress" ? "Đang xử lý" : "Chờ xử lý";
              const statusClass = item.issueStatus === "closed" ? "status-closed" : item.issueStatus === "in_progress" ? "status-progress" : "status-open";
              const photoThumb = item.photoDataUrl || "images/Logo.jpg";
              const hasPhoto = Boolean(item.photoDataUrl);
              const hasAfterPhoto = Boolean(item.afterPhotoDataUrl);
              const rawLevel = item.issueLevel || item.level || item.riskLevel || "";
              const issueLevel = String(rawLevel).trim().toUpperCase();
              const levelBadgeClass = issueLevel === "A" ? "pill-level-a" : issueLevel === "B" ? "pill-level-b" : issueLevel === "C" ? "pill-level-c" : "pill-level-none";
              const levelBadgeText = issueLevel ? (issueLevel.startsWith("CẤP") ? issueLevel : `Cấp ${issueLevel}`) : "Chưa phân loại";

              const rawStop6 = item.issueType || item.stop6 || item.stop_6 || item.issue_type || "";
              const stop6Text = String(rawStop6).trim();

              const itemDate = item.issueDay && item.issueMonth
                ? `${String(item.issueDay).padStart(2, '0')}/${String(item.issueMonth).padStart(2, '0')}`
                : (item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("vi-VN") : dateStr);

              return `
                <div class="history-card ${editingSafetyRecordId === item.id ? 'is-editing' : ''}" data-action="open-safety-card-detail" data-id="${item.id}" title="Chạm để xem chi tiết, sửa hoặc xóa">
                  <img src="${photoThumb}" alt="Thumb" class="history-card-thumb ${hasPhoto ? 'cursor-pointer' : ''}" ${hasPhoto ? `data-preview-img="${photoThumb}" title="Chạm 1 lần để xem ảnh lớn"` : ''} onerror="this.src='images/Logo.jpg'">
                  <div class="history-card-body">
                    <div class="history-card-top">
                      <span class="history-zone-chip">${escapeHtml(zoneLabel)}</span>
                      <span class="history-status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <p class="history-hazard-text">${escapeHtml(item.note || "Mối nguy không có mô tả")}</p>
                    <div class="history-meta-row">
                      <span class="history-date-text"><i class="fa-regular fa-clock"></i> ${escapeHtml(itemDate)}</span>
                      <span class="history-pill ${levelBadgeClass}">${escapeHtml(levelBadgeText)}</span>
                      ${stop6Text ? `<span class="history-pill pill-stop6"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(stop6Text)}</span>` : ''}
                    </div>
                    ${item.improvementContent ? `
                      <div class="history-countermeasure-note">
                        <i class="fa-solid fa-wrench"></i> ${escapeHtml(item.improvementContent)}
                      </div>
                    ` : ''}
                    ${hasAfterPhoto ? `
                      <div class="history-after-photo-tag">
                        <img src="${item.afterPhotoDataUrl}" class="after-photo-mini cursor-pointer" data-preview-img="${item.afterPhotoDataUrl}" title="Ảnh sau cải tiến (chạm để phóng to)">
                        <span>Ảnh sau cải tiến</span>
                      </div>
                    ` : ''}
                  </div>
                  <div class="history-card-chevron">
                    <i class="fa-solid fa-chevron-right"></i>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

      </div>
    `;

    // Wire up events inside Safety form
    wireSafetyEvents(screen, context, safetyPeriodId, overlay);
  }

  function wireSafetyEvents(screen, context, safetyPeriodId, overlay) {
    // Cancel Edit button
    const cancelEditBtn = screen.querySelector("#cancelEditSafetyBtn");
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener("click", () => {
        editingSafetyRecordId = "";
        uploadedSafetyPhotoData = "";
        uploadedSafetyAfterPhotoData = "";
        renderSafetyScreen(overlay, context);
      });
    }

    // Photo 1 (Hiện trường)
    const fileInput = screen.querySelector("#mobileSafetyFileInput");
    const previewWrap = screen.querySelector("#photoPreviewWrap");
    const placeholder = screen.querySelector("#photoPlaceholder");
    const previewImg = screen.querySelector("#mobileSafetyPreviewImg");

    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            uploadedSafetyPhotoData = ev.target.result;
            if (previewImg) {
              previewImg.src = uploadedSafetyPhotoData;
              previewImg.dataset.previewImg = uploadedSafetyPhotoData;
            }
            placeholder?.classList.add("is-hidden");
            previewWrap?.classList.remove("is-hidden");
          };
          reader.readAsDataURL(file);
        }
      });
    }

    const retakeBtn = screen.querySelector("#mobileRetakePhotoBtn");
    if (retakeBtn && fileInput) {
      retakeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
      });
    }

    const removeBtn = screen.querySelector("#mobileRemovePhotoBtn");
    if (removeBtn && fileInput) {
      removeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadedSafetyPhotoData = "";
        fileInput.value = "";
        previewWrap?.classList.add("is-hidden");
        placeholder?.classList.remove("is-hidden");
      });
    }

    // Photo 2 (Sau cải tiến)
    const afterFileInput = screen.querySelector("#mobileSafetyAfterFileInput");
    const afterPreviewWrap = screen.querySelector("#photoAfterPreviewWrap");
    const afterPlaceholder = screen.querySelector("#photoAfterPlaceholder");
    const afterPreviewImg = screen.querySelector("#mobileSafetyAfterPreviewImg");

    if (afterFileInput) {
      afterFileInput.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            uploadedSafetyAfterPhotoData = ev.target.result;
            if (afterPreviewImg) {
              afterPreviewImg.src = uploadedSafetyAfterPhotoData;
              afterPreviewImg.dataset.previewImg = uploadedSafetyAfterPhotoData;
            }
            afterPlaceholder?.classList.add("is-hidden");
            afterPreviewWrap?.classList.remove("is-hidden");
          };
          reader.readAsDataURL(file);
        }
      });
    }

    const retakeAfterBtn = screen.querySelector("#mobileRetakeAfterPhotoBtn");
    if (retakeAfterBtn && afterFileInput) {
      retakeAfterBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        afterFileInput.click();
      });
    }

    const removeAfterBtn = screen.querySelector("#mobileRemoveAfterPhotoBtn");
    if (removeAfterBtn && afterFileInput) {
      removeAfterBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadedSafetyAfterPhotoData = "";
        afterFileInput.value = "";
        afterPreviewWrap?.classList.add("is-hidden");
        afterPlaceholder?.classList.remove("is-hidden");
      });
    }

    // Wire date picker change sync to display inputs (dd/mm/yyyy)
    screen.querySelectorAll(".date-input-container").forEach((wrap) => {
      const nativeDate = wrap.querySelector(".native-hidden-date-input");
      const displayInput = wrap.querySelector(".date-custom-input");
      if (!nativeDate || !displayInput) return;

      nativeDate.addEventListener("change", () => {
        displayInput.value = formatIsoToVnDate(nativeDate.value);
      });
      nativeDate.addEventListener("input", () => {
        displayInput.value = formatIsoToVnDate(nativeDate.value);
      });

      wrap.addEventListener("click", () => {
        try {
          if (typeof nativeDate.showPicker === "function") {
            nativeDate.showPicker();
          }
        } catch (_) {}
      });
    });

    // Image 1-tap quick preview (lightbox)
    screen.querySelectorAll("[data-preview-img]").forEach((imgEl) => {
      imgEl.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const src = imgEl.dataset.previewImg || imgEl.src;
        if (src && src !== "images/Logo.jpg") {
          openMobileImageModal(src, "Ảnh minh họa");
        }
      });
    });

    // Card click: open detail modal (where user can view full info, Edit, or Delete)
    screen.querySelectorAll('.history-card[data-action="open-safety-card-detail"]').forEach((card) => {
      card.addEventListener("click", (e) => {
        // If user tapped directly on an image thumbnail, don't trigger modal (preview lightbox handles it)
        if (e.target.closest("[data-preview-img]")) {
          return;
        }
        const recordId = card.dataset.id;
        const allRecords = context?.state?.safetyRecords || [];
        const record = allRecords.find((r) => r.id === recordId);
        if (record) {
          openSafetyDetailModal(record, overlay, context);
        }
      });
    });

    // Form submit handler
    const form = screen.querySelector("#mobileSafetyForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const areaId = screen.querySelector("#mobileSafetyZoneSelect")?.value;
        const desc = screen.querySelector("#mobileSafetyDescription")?.value?.trim();
        const issueDate = screen.querySelector("#mobileSafetyIssueDate")?.value || "";
        const stop6 = screen.querySelector("#mobileSafetyStop6")?.value || "";
        const level = screen.querySelector("#mobileSafetyLevel")?.value || "";
        const foundChannel = screen.querySelector("#mobileSafetyFoundChannel")?.value || "worker";
        const issueStatus = screen.querySelector("#mobileSafetyIssueStatus")?.value || "open";
        const issueFoundBy = screen.querySelector("#mobileSafetyIssueFoundBy")?.value?.trim() || "";
        const employeeCode = screen.querySelector("#mobileSafetyEmployeeCode")?.value?.trim() || "";
        const issueItemLabel = screen.querySelector("#mobileSafetyIssueItemLabel")?.value?.trim() || "Nhận diện nguy cơ mất an toàn";
        const improvementContent = screen.querySelector("#mobileSafetyImprovementContent")?.value?.trim() || "";
        const actionOwner = screen.querySelector("#mobileSafetyActionOwner")?.value?.trim() || "";
        const actionPlan = screen.querySelector("#mobileSafetyActionPlan")?.value?.trim() || "";
        const completionDate = screen.querySelector("#mobileSafetyCompletionDate")?.value || "";

        if (!areaId) {
          showMobileToast("Vui lòng chọn Khu vực / Zone!", true);
          return;
        }
        if (!desc) {
          showMobileToast("Vui lòng nhập mô tả Mối nguy hiểm phát hiện được!", true);
          return;
        }

        const now = new Date();
        const user = context?.currentUser;
        const area = context?.getAreasForPeriod?.(safetyPeriodId)?.find((a) => a.id === areaId);

        let finalPhotoDataUrl = uploadedSafetyPhotoData;
        let finalPhotoName = "anh-moi-nguy.jpg";
        const file = fileInput?.files?.[0];
        if (file && typeof context?.prepareScorePhoto === "function") {
          try {
            const prepared = await context.prepareScorePhoto(file, null, false, safetyPeriodId);
            finalPhotoDataUrl = prepared.photoDataUrl || finalPhotoDataUrl;
            finalPhotoName = prepared.photoName || finalPhotoName;
          } catch (_) {}
        }

        let finalAfterPhotoDataUrl = uploadedSafetyAfterPhotoData;
        let finalAfterPhotoName = "anh-sau-cai-tien.jpg";
        const afterFile = afterFileInput?.files?.[0];
        if (afterFile && typeof context?.prepareScorePhoto === "function") {
          try {
            const preparedAfter = await context.prepareScorePhoto(afterFile, null, false, safetyPeriodId);
            finalAfterPhotoDataUrl = preparedAfter.photoDataUrl || finalAfterPhotoDataUrl;
            finalAfterPhotoName = preparedAfter.photoName || finalAfterPhotoName;
          } catch (_) {}
        }

        const dateParts = issueDate ? issueDate.split("-") : [String(now.getFullYear()), String(now.getMonth() + 1), String(now.getDate())];
        const issueYear = dateParts[0] || String(now.getFullYear());
        const issueMonth = String(Number(dateParts[1]) || now.getMonth() + 1);
        const issueDay = String(Number(dateParts[2]) || now.getDate());

        const isEditing = Boolean(editingSafetyRecordId);
        const existingRecord = isEditing ? (context?.state?.safetyRecords || []).find((r) => r.id === editingSafetyRecordId) : null;
        const targetId = isEditing ? editingSafetyRecordId : (context?.makeId ? context.makeId("safety") : `safety-${Date.now()}`);
        const ownerUsername = user?.username || "assessor";
        const ownerName = issueFoundBy || context?.getAccountDisplayName?.(user, context.SAFETY_PERIOD_TYPE, safetyPeriodId) || user?.name || ownerUsername;

        const payload = {
          ...(existingRecord || {}),
          id: targetId,
          periodId: safetyPeriodId,
          areaId: areaId,
          issueLocation: area ? `Zone ${area.code}` : "Zone",
          issueDay,
          issueMonth,
          note: desc,
          photoDataUrl: finalPhotoDataUrl,
          photoName: finalPhotoName,
          issueCount: existingRecord?.issueCount || 1,
          issueType: stop6,
          issueLevel: level,
          issueStatus,
          issueFoundBy: ownerName,
          employeeCode,
          issueItemLabel,
          foundChannel,
          improvementContent,
          afterPhotoDataUrl: finalAfterPhotoDataUrl,
          afterPhotoName: finalAfterPhotoName,
          actionOwner,
          actionPlan,
          completionDate,
          completionLevelConfirm: context?.getSafetyLevelConfirm?.({ issueLevel: level }) || "",
          completionStop6Confirm: context?.getSafetyStop6Confirm?.({ issueType: stop6 }) || "",
          scorerName: existingRecord?.scorerName || ownerName,
          accountUsername: existingRecord?.accountUsername || ownerUsername,
          createdBy: existingRecord?.createdBy || ownerUsername,
          createdAt: existingRecord?.createdAt || now.toISOString(),
          updatedAt: now.toISOString(),
        };

        try {
          if (context?.state?.safetyRecords) {
            const idx = context.state.safetyRecords.findIndex((r) => r.id === targetId);
            if (idx >= 0) {
              context.state.safetyRecords[idx] = payload;
            } else {
              context.state.safetyRecords.unshift(payload);
            }
          }
          if (typeof context?.saveSafetyRecord === "function") {
            await context.saveSafetyRecord(payload);
          }

          // Reset form & state
          editingSafetyRecordId = "";
          uploadedSafetyPhotoData = "";
          uploadedSafetyAfterPhotoData = "";
          if (fileInput) fileInput.value = "";
          if (afterFileInput) afterFileInput.value = "";

          showMobileToast(isEditing ? "Đã cập nhật báo cáo an toàn!" : "Đã lưu báo cáo an toàn thành công!");
          renderSafetyScreen(overlay, context);
        } catch (err) {
          console.error("Lỗi khi lưu báo cáo an toàn:", err);
          showMobileToast("Lỗi khi lưu: " + (err.message || err), true);
        }
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN 2: CHẤM ĐIỂM 5S (5S AUDIT SHEET WITH INLINE ALL 5 LEVELS)
  // ─────────────────────────────────────────────────────────────────────────────
  function renderFiveSScreen(overlay, context) {
    const screen = overlay.querySelector("#mobileScreen5S");
    if (!screen) return;

    const fiveSPeriodId = context?.getActivePeriodId?.(context.FIVE_S_PERIOD_TYPE) || "";
    const allAreas = context ? context.getAreasForPeriod(fiveSPeriodId) : [];
    
    if (!currentFiveSZoneId && allAreas.length > 0) {
      currentFiveSZoneId = allAreas[0].id;
    }

    const selectedArea = allAreas.find((a) => a.id === currentFiveSZoneId) || allAreas[0] || null;
    const scoreSource = context ? context.SCORE_SOURCE_ASSESSOR : "assessor";

    // Build flattened items list
    const flattenedCriteria = buildFlattened5SCriteria(context);

    // Calculate score statistics for selected area
    const stat = calculateArea5SScoreStat(selectedArea, flattenedCriteria, context, fiveSPeriodId, scoreSource);

    screen.innerHTML = `
      <div class="mobile-fives-container">
        
        <!-- Sticky Header: Zone Selector & Live Scoring Progress -->
        <div class="fives-sticky-header">
          <div class="fives-header-top">
            <div class="fives-zone-picker">
              <span class="fives-zone-label">Khu vực kiểm tra</span>
              <div class="select-wrapper-inline">
                <select id="mobileAuditZoneSelect" class="fives-zone-select">
                  ${allAreas.map((area) => `
                    <option value="${escapeHtml(area.id)}" ${area.id === currentFiveSZoneId ? 'selected' : ''}>
                      Zone ${escapeHtml(area.code)} · ${escapeHtml(context?.getAreaResponsibleNameForPeriod?.(fiveSPeriodId, area) || "")}
                    </option>
                  `).join("")}
                </select>
                <i class="fa-solid fa-chevron-down select-chevron-inline"></i>
              </div>
            </div>
            <div class="fives-progress-stat">
              <span class="fives-progress-label">Đã đánh giá</span>
              <strong id="evaluatedProgressText" class="fives-progress-val font-mono">${stat.completed} / ${stat.total} Hạng mục</strong>
            </div>
          </div>

          <!-- Overall Score Bar -->
          <div class="fives-score-metric-row">
            <div class="metric-text-row">
              <span class="metric-title">Điểm TB hiện tại:</span>
              <strong id="overallAvgScoreText" class="metric-score-val font-mono">${stat.avgText} / 5.0</strong>
            </div>
            <div class="metric-progress-track">
              <div id="scoreProgressBarFill" class="metric-progress-fill" style="width: ${stat.pct}%;"></div>
            </div>
          </div>
        </div>

        <!-- Instruction Tip -->
        <div class="fives-instruction-tip">
          <i class="fa-solid fa-hand-pointer text-brand-400 text-xs"></i>
          <span>Chạm trực tiếp vào ô mô tả tiêu chí (Cấp 1 - Cấp 5) để chọn điểm đánh giá.</span>
        </div>

        <!-- Section Navigation Filter Pills -->
        <div class="fives-section-nav">
          ${SECTION_FILTERS.map((filter) => `
            <button type="button" class="section-pill-btn ${activeSectionFilter === filter.id ? 'is-active' : ''}" data-section-filter="${filter.id}">
              ${filter.label}
            </button>
          `).join("")}
        </div>

        <!-- 5S Audit Category Items Card List -->
        <div class="fives-items-list" id="fivesItemsListContainer">
          ${render5SItemCards(selectedArea, flattenedCriteria, context, fiveSPeriodId, scoreSource)}
        </div>

      </div>
    `;

    // Wire up events inside 5S view
    wireFiveSEvents(screen, overlay, context, fiveSPeriodId, scoreSource);
  }

  // Build flattened criteria list matching standards.js
  function buildFlattened5SCriteria(context) {
    const standards = window.FIVE_S_STANDARDS || {};
    const criteriaList = [];

    // Define standard categories
    const categories = [
      {
        id: "a1",
        code: "A1",
        category: "Khu vực đường đi (A1)",
        title: "Đường đi bộ, cầu thang, hành lang, các đường border",
        section: "A",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "a2",
        code: "A2",
        category: "Cây nước (A2)",
        title: "Cốc uống & vỏ bình nước",
        section: "A",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "a3",
        code: "A3",
        category: "Khu rửa tay & Vệ sinh (A3)",
        title: "Bồn rửa, khăn lau tay, thiết bị vệ sinh",
        section: "A",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "b1",
        code: "B1",
        category: "Khu để dầu & Hóa chất (B1)",
        title: "Dầu mỡ, sơn, dung môi hóa chất các loại",
        section: "B",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "b2",
        code: "B2",
        category: "Hàng lưu kho & Hàng lỗi (B2)",
        title: "Sản phẩm, thành phẩm, kho spare part, hàng lỗi",
        section: "B",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "b3",
        code: "B3",
        category: "Vật tư & Giẻ lau (B3)",
        title: "Nơi để vật tư, găng tay, giẻ lau dây chuyền",
        section: "B",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "c1",
        code: "C1",
        category: "Nơi làm việc (C1)",
        title: "Mặt sàn khu thao tác trong dây chuyền sản xuất",
        section: "C",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "c2",
        code: "C2",
        category: "Thiết bị & Máy móc (C2)",
        title: "Thiết bị, máy móc sản xuất và khu vực xung quanh",
        section: "C",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "c3",
        code: "C3",
        category: "Bàn thao tác & Dolly (C3)",
        title: "Bàn thao tác, bàn kiểm tra chất lượng, các loại dolly",
        section: "C",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "c4",
        code: "C4",
        category: "Đồ gá Jig & Dụng cụ (C4)",
        title: "Nơi để đồ gá, dưỡng jig, tool, tủ dụng cụ đo",
        section: "C",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "c5",
        code: "C5",
        category: "Bảng quản lý dây chuyền (C5)",
        title: "Bảng thông báo, check sheet, màn hình Andon",
        section: "C",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "d1",
        code: "D1",
        category: "Khu vực nghỉ (D1)",
        title: "Phòng nghỉ giải lao, bàn ghế, tủ để đồ",
        section: "D",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "d2",
        code: "D2",
        category: "Bàn quản lý GL (D2)",
        title: "Khu vực bàn làm việc của Group Leader",
        section: "D",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "d3",
        code: "D3",
        category: "Tư liệu & Bản vẽ (D3)",
        title: "Khu để tư liệu, tài liệu, tủ lưu bản vẽ kỹ thuật",
        section: "D",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "e1",
        code: "E1",
        category: "Tự giác tổ viên (E1)",
        title: "Nhận thức và thực hiện 5S tự giác của tổ viên",
        section: "E",
        criteria: [
          { key: "diem", phase: "Đánh giá" },
        ],
      },
      {
        id: "e2",
        code: "E2",
        category: "Tự giác giám sát (E2)",
        title: "Sự chỉ đạo và tuân thủ 5S của người giám sát",
        section: "E",
        criteria: [
          { key: "diem", phase: "Đánh giá" },
        ],
      },
    ];

    categories.forEach((cat) => {
      cat.criteria.forEach((crit) => {
        const uniqueId = `${cat.id}_${crit.key}`;
        const levelTexts = standards[cat.id]?.[crit.key] || [];
        criteriaList.push({
          id: uniqueId,
          itemId: cat.id,
          criterionId: crit.key,
          code: cat.code,
          category: cat.category,
          title: cat.title,
          phase: crit.phase,
          section: cat.section,
          levels: {
            1: levelTexts[0] || "Tiêu chuẩn Cấp 1",
            2: levelTexts[1] || "Tiêu chuẩn Cấp 2",
            3: levelTexts[2] || "Tiêu chuẩn Cấp 3",
            4: levelTexts[3] || "Tiêu chuẩn Cấp 4",
            5: levelTexts[4] || "Tiêu chuẩn Cấp 5",
          },
        });
      });
    });

    return criteriaList;
  }

  // Calculate stats for selected area
  function calculateArea5SScoreStat(area, criteriaList, context, periodId, scoreSource) {
    if (!area) return { completed: 0, total: criteriaList.length, avgText: "--", pct: 0 };
    let totalScore = 0;
    let scoredCount = 0;
    let completedCount = 0;

    criteriaList.forEach((c) => {
      let scoreVal = null;
      let status = "";
      if (context && typeof context.getScoreRecord === "function") {
        const rec = context.getScoreRecord(periodId, area.id, c.itemId, c.criterionId, scoreSource);
        if (rec) {
          status = rec.status || "";
          if (Number.isFinite(rec.score)) {
            scoreVal = rec.score;
          }
        }
      }
      if (status === "na") {
        completedCount += 1;
      } else if (scoreVal !== null) {
        totalScore += scoreVal;
        scoredCount += 1;
        completedCount += 1;
      }
    });

    const avg = scoredCount > 0 ? (totalScore / scoredCount).toFixed(2) : "--";
    const pct = scoredCount > 0 ? Math.min(100, Math.round(((Number(avg) || 0) / 5) * 100)) : 0;

    return {
      completed: completedCount,
      total: criteriaList.length,
      avgText: avg,
      pct,
    };
  }

  // Render Category Item Cards
  function render5SItemCards(area, criteriaList, context, periodId, scoreSource) {
    if (!area) return '<div class="p-4 text-center text-slate-400 text-xs">Vui lòng chọn zone để đánh giá.</div>';

    const filtered = activeSectionFilter === "all"
      ? criteriaList
      : criteriaList.filter((c) => c.section === activeSectionFilter);

    return filtered.map((item) => {
      let record = null;
      let currentScore = null;
      let isNa = false;
      if (context && typeof context.getScoreRecord === "function") {
        record = context.getScoreRecord(periodId, area.id, item.itemId, item.criterionId, scoreSource);
        if (record) {
          if (record.status === "na") {
            isNa = true;
          } else if (Number.isFinite(record.score)) {
            currentScore = record.score;
          }
        }
      }

      let scorePillClass = "text-slate-400";
      let scorePillText = "Chưa chấm";
      if (isNa) {
        scorePillClass = "text-slate-400 font-semibold";
        scorePillText = "Không cần chấm (✕)";
      } else if (currentScore !== null) {
        if (currentScore <= 2) {
          scorePillClass = "text-rose-400 font-bold";
          scorePillText = `Đã chọn: Cấp ${currentScore} (${LEVEL_NAMES[currentScore]})`;
        } else if (currentScore === 3) {
          scorePillClass = "text-amber-400 font-bold";
          scorePillText = `Đã chọn: Cấp ${currentScore} (${LEVEL_NAMES[currentScore]})`;
        } else {
          scorePillClass = "text-emerald-400 font-bold";
          scorePillText = `Đã chọn: Cấp ${currentScore} (${LEVEL_NAMES[currentScore]})`;
        }
      }

      return `
        <div class="fives-card" data-fives-item-id="${item.id}" data-item-raw-id="${item.itemId}" data-criterion-raw-id="${item.criterionId}">
          
          <!-- Card Header -->
          <div class="fives-card-header">
            <div>
              <span class="fives-card-category-badge">${escapeHtml(item.category)}</span>
              <h4 class="fives-card-title">${escapeHtml(item.title)}</h4>
            </div>
            <div class="fives-card-badges-right">
              <span class="fives-phase-badge">${escapeHtml(item.phase)}</span>
              <span class="fives-score-badge ${scorePillClass}">${scorePillText}</span>
            </div>
          </div>

          <!-- All 5 Inline Level Criteria Rows + Không cần chấm option -->
          <div class="fives-levels-stack">
            <span class="fives-levels-stack-title">Tiêu chuẩn cấp độ (Chạm để chọn / Chạm lại để hủy chọn):</span>
            
            <div class="levels-options-group">
              ${[1, 2, 3, 4, 5].map((lvl) => {
                const isSelected = !isNa && currentScore === lvl;
                const levelDesc = item.levels[lvl] || "Tiêu chuẩn Cấp " + lvl;
                let levelBoxClass = "level-unselected";
                let badgeClass = "badge-unselected";

                if (isSelected) {
                  if (lvl <= 2) {
                    levelBoxClass = "level-selected-low";
                    badgeClass = "badge-selected-low";
                  } else if (lvl === 3) {
                    levelBoxClass = "level-selected-mid";
                    badgeClass = "badge-selected-mid";
                  } else {
                    levelBoxClass = "level-selected-high";
                    badgeClass = "badge-selected-high";
                  }
                }

                return `
                  <div class="fives-level-row ${levelBoxClass}" 
                       data-action-score="${lvl}"
                       data-item-id="${item.itemId}"
                       data-criterion-id="${item.criterionId}"
                       role="button"
                       tabindex="0">
                    
                    <div class="level-badge-wrap">
                      <span class="level-num-badge ${badgeClass}">${lvl}</span>
                    </div>

                    <div class="level-content-wrap">
                      <div class="level-title-line">
                        <span class="level-name-label">Cấp ${lvl} - ${LEVEL_NAMES[lvl]}</span>
                        ${isSelected ? `
                          <span class="level-chosen-tag ${lvl <= 2 ? 'tag-low' : lvl === 3 ? 'tag-mid' : 'tag-high'}">
                            <i class="fa-solid fa-circle-check"></i> Đã chọn
                          </span>
                        ` : ''}
                      </div>
                      <p class="level-desc-text ${isSelected ? 'is-selected-text' : ''}">${escapeHtml(levelDesc)}</p>
                    </div>

                  </div>
                `;
              }).join("")}

              <!-- Không cần chấm (Gạch chéo) option -->
              <div class="fives-level-row level-na-row ${isNa ? 'level-selected-na' : 'level-unselected'}"
                   data-action-score="na"
                   data-item-id="${item.itemId}"
                   data-criterion-id="${item.criterionId}"
                   role="button"
                   tabindex="0">
                <div class="level-badge-wrap">
                  <span class="level-num-badge ${isNa ? 'badge-selected-na' : 'badge-unselected'}">✕</span>
                </div>
                <div class="level-content-wrap">
                  <div class="level-title-line">
                    <span class="level-name-label">Không cần chấm (Gạch chéo)</span>
                    ${isNa ? `
                      <span class="level-chosen-tag tag-na">
                        <i class="fa-solid fa-xmark"></i> Đã gạch chéo
                      </span>
                    ` : ''}
                  </div>
                  <p class="level-desc-text ${isNa ? 'is-selected-text' : ''}">Hạng mục này không áp dụng hoặc không cần đánh giá tại khu vực này.</p>
                </div>
              </div>

            </div>
          </div>

        </div>
      `;
    }).join("");
  }

  // Wire up 5S Events
  function wireFiveSEvents(screen, overlay, context, fiveSPeriodId, scoreSource) {
    // Zone Select Change
    const zoneSelect = screen.querySelector("#mobileAuditZoneSelect");
    if (zoneSelect) {
      zoneSelect.addEventListener("change", (e) => {
        currentFiveSZoneId = e.target.value;
        renderFiveSScreen(overlay, context);
      });
    }

    // Section Filter Pill click
    screen.querySelectorAll("[data-section-filter]").forEach((pill) => {
      pill.addEventListener("click", () => {
        activeSectionFilter = pill.dataset.sectionFilter;
        renderFiveSScreen(overlay, context);
      });
    });

    // Horizontal drag / swipe scroll for section filter pills
    const navContainer = screen.querySelector(".fives-section-nav");
    if (navContainer) {
      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;
      navContainer.addEventListener("mousedown", (e) => {
        isDown = true;
        startX = e.pageX - navContainer.offsetLeft;
        scrollLeft = navContainer.scrollLeft;
      });
      navContainer.addEventListener("mouseleave", () => { isDown = false; });
      navContainer.addEventListener("mouseup", () => { isDown = false; });
      navContainer.addEventListener("mousemove", (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - navContainer.offsetLeft;
        const walk = (x - startX) * 1.5;
        navContainer.scrollLeft = scrollLeft - walk;
      });
    }

    const selectedArea = context?.getAreasForPeriod?.(fiveSPeriodId)?.find((a) => a.id === currentFiveSZoneId);
    if (!selectedArea) return;

    // Tap to score level row or N/A (Supports toggle unselect)
    screen.querySelectorAll("[data-action-score]").forEach((row) => {
      row.addEventListener("click", async (e) => {
        e.preventDefault();
        const rawAction = row.dataset.actionScore;
        const itemId = row.dataset.itemId;
        const criterionId = row.dataset.criterionId;
        const item = context?.getItem?.(itemId) || { id: itemId, code: itemId.toUpperCase() };
        const criterion = context?.getCriterion?.(item, criterionId) || { id: criterionId, label: criterionId };
        
        const currentRec = context?.getScoreRecord?.(fiveSPeriodId, selectedArea.id, itemId, criterionId, scoreSource);
        const currentScore = currentRec && Number.isFinite(currentRec.score) ? currentRec.score : null;
        const currentStatus = currentRec?.status || "";

        let newScore = null;
        let newStatus = "";

        if (rawAction === "na") {
          // If already na, deselect!
          if (currentStatus === "na") {
            newScore = null;
            newStatus = "";
          } else {
            newScore = null;
            newStatus = "na";
          }
        } else {
          const lvl = Number(rawAction);
          // If already this score and not na, deselect!
          if (currentScore === lvl && currentStatus !== "na") {
            newScore = null;
            newStatus = "";
          } else {
            newScore = lvl;
            newStatus = "";
          }
        }

        try {
          if (typeof context?.setScore === "function") {
            await context.setScore({
              periodId: fiveSPeriodId,
              area: selectedArea,
              item,
              criterion,
              score: newScore,
              status: newStatus,
              scoreSource,
            });
          }

          // Re-render
          renderFiveSScreen(overlay, context);
          if (newStatus === "na") {
            showMobileToast(`Đã gạch chéo (Không cần chấm) cho ${item.code} (${criterion.label || criterionId})`);
          } else if (newScore !== null) {
            showMobileToast(`Đã chọn Cấp ${newScore} cho ${item.code} (${criterion.label || criterionId})`);
          } else {
            showMobileToast(`Đã bỏ chọn cho ${item.code} (${criterion.label || criterionId})`);
          }
        } catch (err) {
          console.error("Lỗi khi lưu điểm:", err);
          showMobileToast("Lỗi khi lưu điểm: " + (err.message || err), true);
        }
      });
    });
  }

  // Toast Notification
  function showMobileToast(msg, isError = false) {
    const toast = document.getElementById("mobileToast");
    const toastText = document.getElementById("mobileToastText");
    if (!toast || !toastText) return;

    toastText.textContent = msg;
    toast.classList.toggle("is-error", Boolean(isError));
    toast.classList.add("is-visible");

    clearTimeout(toast.__timer);
    toast.__timer = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2800);
  }

  // Helper: Read file as data URL
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Helper: Escape HTML
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Expose methods globally
  window.openMobilePrototype = openMobilePrototype;
  window.closeMobilePrototype = closeMobilePrototype;
})();
