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

  function mobileControlIcon(name) {
    const paths = {
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
      moon: '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
      help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.3 1.7c-1.1 1.1-1.9 1.4-1.9 3"/><path d="M12 17h.01"/>',
      close: '<path d="m18 6-12 12M6 6l12 12"/>',
      expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
      back: '<path d="m15 18-6-6 6-6M9 12h12"/>',
    };
    const shape = paths[name] || "";
    return `<svg class="mobile-control-icon mobile-control-icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shape}</svg>`;
  }

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

  function photoThumbnailUrl(value) {
    const raw = String(value || "");
    if (!raw.includes("/api/photos/")) return raw;
    try {
      const url = new URL(raw, window.location.href);
      url.searchParams.set("size", "thumb");
      return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : url.toString();
    } catch (_) {
      return raw;
    }
  }

  function scrollMobileTargetIntoView(resolveTarget) {
    const scroll = () => {
      const target = resolveTarget?.();
      if (!target?.isConnected || typeof target.scrollIntoView !== "function") return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => window.requestAnimationFrame(scroll));
    } else {
      window.setTimeout(scroll, 100);
    }
  }

  // State
  let activeTab = "safety"; // "safety" | "5s"
  let isFullWidth = false;
  let currentFiveSZoneId = "";
  let currentSafetyZoneId = "";
  let currentSafetyHistoryPage = 1;
  let currentSafetyMonthKey = "";
  let safetyHistoryPageKey = "";
  let safetyHistoryPageRequestId = 0;
  let safetyHistoryPageData = null;
  let activeSectionFilter = "all";
  let currentFiveSScoreSource = "";
  let currentFiveSScoreSourceUserKey = null;
  let currentFiveSScoreSourceAreaKey = "";
  let currentFiveSScoreDate = "";
  let mobileAccountKey = null;
  let uploadedSafetyPhotoData = "";
  let uploadedSafetyAfterPhotoData = "";
  let editingSafetyRecordId = "";
  let safetyAnnotationDraftId = null;
  let pendingSafetyPhotoAnnotations = [];
  let pendingSafetyAfterPhotoAnnotations = [];
  let currentAppContext = null;

  function openMobileImageModal(imgSrc, annotationOptions = {}) {
    if (!imgSrc || imgSrc === "images/Logo.jpg") return;
    const existing = document.getElementById("mobileImageModal");
    if (existing) existing.remove();

    const modal = document.createElement("dialog");
    modal.id = "mobileImageModal";
    modal.className = "mobile-image-modal-fullscreen";
    modal.innerHTML = `
      <div class="mobile-image-fullscreen-backdrop"></div>
      <button type="button" class="mobile-image-fullscreen-close" aria-label="Đóng">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <div class="mobile-image-fullscreen-container">
        <div class="mobile-image-fullscreen-stage">
          <img src="${imgSrc}" alt="Ảnh xem trước" class="mobile-image-fullscreen-img">
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    if (typeof modal.showModal === "function") {
      try {
        modal.showModal();
      } catch (_) {}
    }

    const stage = modal.querySelector(".mobile-image-fullscreen-stage");
    const image = stage?.querySelector("img");
    let cleanupAnnotation = null;
    let viewerInteractions = null;
    let resizeFullscreenImage = null;
    let annotationMounted = false;
    const initializeFullscreenImage = () => {
      if (!modal.isConnected || !image?.naturalWidth || !image?.naturalHeight || !stage) return;
      if (annotationMounted) {
        resizeFullscreenImage?.();
        return;
      }
      resizeFullscreenImage = () => {
        const maxWidth = Math.max(1, window.innerWidth * 0.95);
        const maxHeight = Math.max(1, window.innerHeight * 0.9);
        const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        stage.style.width = `${width}px`;
        stage.style.height = `${height}px`;
        image.style.width = `${width}px`;
        image.style.height = `${height}px`;
        viewerInteractions?.reset();
      };
      resizeFullscreenImage();
      viewerInteractions = window.mountImageViewerInteractions?.(modal, stage) || null;
      annotationMounted = true;
      cleanupAnnotation = window.mountImageCircleAnnotator?.(
        stage,
        modal,
        {
          ...annotationOptions,
          onError: (error) => {
            annotationOptions.onError?.(error);
            showMobileToast(error?.message || "Không lưu được nét khoanh.", true);
          },
        },
      );
      window.addEventListener("resize", resizeFullscreenImage);
    };
    image?.addEventListener("load", initializeFullscreenImage, { once: true });
    if (image?.complete && image.naturalWidth) initializeFullscreenImage();

    let isClosing = false;
    const closeModal = async () => {
      if (isClosing) return;
      isClosing = true;
      try {
        await cleanupAnnotation?.();
        if (resizeFullscreenImage) window.removeEventListener("resize", resizeFullscreenImage);
        viewerInteractions?.destroy();
        if (typeof modal.close === "function" && modal.open) {
          modal.close();
        }
        modal.remove();
      } catch (error) {
        showMobileToast(error?.message || "Không lưu được nét khoanh. Vui lòng thử lại.", true);
        isClosing = false;
      }
    };
    modal.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeModal();
    });
    modal.querySelector(".mobile-image-fullscreen-backdrop").addEventListener("click", closeModal);
    modal.querySelector(".mobile-image-fullscreen-close").addEventListener("click", closeModal);
    modal.querySelector(".mobile-image-fullscreen-container").addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeModal();
    });
  }

  function buildMobilePhotoAnnotationOptions(context, record, field, options = {}) {
    const isAfterPhoto = field === "afterPhotoAnnotations";
    const editable = options.editable ?? (record
      ? (isAfterPhoto ? canManageSafetyCountermeasure(context, record) : canManageFullSafetyRecord(context, record))
      : checkSafetyPermission(context));
    const pending = isAfterPhoto ? pendingSafetyAfterPhotoAnnotations : pendingSafetyPhotoAnnotations;
    return {
      initialCircles: options.initialCircles ?? record?.[field] ?? pending,
      editable,
      onSave: async (annotations) => {
        options.onChange?.(annotations);
        if (options.localOnly || !record?.id) return true;
        if (typeof context?.saveSafetyPhotoAnnotations !== "function") {
          throw new Error("Không có kết nối lưu nét khoanh.");
        }
        await context.saveSafetyPhotoAnnotations(record.id, field, annotations);
        return true;
      },
      onError: options.onError,
    };
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

  function monthKeyFromDate(value) {
    const text = String(value || "").trim();
    const isoMatch = /^(\d{4})-(\d{1,2})/.exec(text);
    if (isoMatch) return `${isoMatch[1]}-${String(Number(isoMatch[2])).padStart(2, "0")}`;
    const displayMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    if (displayMatch) return `${displayMatch[3]}-${String(Number(displayMatch[2])).padStart(2, "0")}`;
    const monthYearMatch = /^(?:tháng\s*)?(\d{1,2})\/(\d{4})$/i.exec(text);
    if (monthYearMatch) return `${monthYearMatch[2]}-${String(Number(monthYearMatch[1])).padStart(2, "0")}`;
    return "";
  }

  function monthKeyFromPeriod(period) {
    const year = Number(period?.year);
    const month = Number(period?.month);
    if (Number.isInteger(year) && year > 0 && Number.isInteger(month) && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}`;
    }
    const idMatch = /(?:5s|safety)-(\d{4})-(\d{1,2})/i.exec(String(period?.id || ""));
    if (idMatch) return `${idMatch[1]}-${String(Number(idMatch[2])).padStart(2, "0")}`;
    return monthKeyFromDate(period?.label);
  }

  function monthKeyForSafetyRecord(item, context) {
    const explicitDate = context?.getSafetyRecordIssueDate?.(item, context?.getPeriod?.(item?.periodId)) || item?.issueDate || item?.date || "";
    const dateKey = monthKeyFromDate(explicitDate);
    if (dateKey) return dateKey;

    const period = context?.getPeriod?.(item?.periodId);
    const norm = getNormalizedSafetyIssueDate(item, period);
    if (norm?.year && norm?.month) {
      return norm.year + "-" + String(norm.month).padStart(2, "0");
    }
    if (item?.issueMonth && Number.isInteger(Number(item.issueMonth))) {
      const m = Number(item.issueMonth);
      const y = Number(item?.issueYear || norm?.year || period?.year || 2026);
      if (m >= 1 && m <= 12) {
        return y + "-" + String(m).padStart(2, "0");
      }
    }
    if (item?.createdAt || item?.updatedAt) {
      const createdKey = monthKeyFromDate(item.createdAt || item.updatedAt);
      if (createdKey) return createdKey;
    }
    const periodKey = monthKeyFromPeriod(period);
    if (periodKey) return periodKey;
    return "";
  }

  function getNormalizedSafetyIssueDate(item, safetyPeriod) {
    const displayMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(item?.issueDate || item?.date || "").trim());
    if (displayMatch) {
      return { day: Number(displayMatch[1]), month: Number(displayMatch[2]), year: Number(displayMatch[3]) };
    }
    const explicitDate = String(item?.issueDate || item?.date || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(explicitDate) && window.SafetyTimeline?.date(explicitDate)) {
      const [year, month, day] = explicitDate.split("-").map(Number);
      return { day, month, year };
    }
    let day = Number(item?.issueDay) || 0;
    let month = Number(item?.issueMonth) || 0;

    let periodYear = Number(safetyPeriod?.year) || 0;
    let periodMonth = Number(safetyPeriod?.month) || 0;
    let periodDay = 0;

    if (safetyPeriod?.id && String(safetyPeriod.id).includes("-")) {
      const parts = String(safetyPeriod.id).split("-");
      if (parts.length >= 5) {
        periodYear = periodYear || Number(parts[2]) || 0;
        periodMonth = periodMonth || Number(parts[3]) || 0;
        periodDay = Number(parts[4]) || 0;
      }
    }
    if (!periodDay && safetyPeriod?.label && String(safetyPeriod.label).includes("/")) {
      const labelParts = String(safetyPeriod.label).split("/");
      if (labelParts.length === 3) {
        periodDay = Number(labelParts[0]) || 0;
        periodMonth = periodMonth || Number(labelParts[1]) || 0;
        periodYear = periodYear || Number(labelParts[2]) || 0;
      }
    }
    if (!periodMonth && safetyPeriod?.createdAt) {
      const createdDate = new Date(safetyPeriod.createdAt);
      if (!Number.isNaN(createdDate.getTime())) {
        periodMonth = createdDate.getMonth() + 1;
        periodDay = periodDay || createdDate.getDate();
        periodYear = periodYear || createdDate.getFullYear();
      }
    }

    if (day && month) {
      if (periodMonth && day === periodMonth && month !== periodMonth && month <= 31) {
        const temp = day;
        day = month;
        month = temp;
      } else if (day <= 12 && month > 12 && month <= 31) {
        const temp = day;
        day = month;
        month = temp;
      }
    }

    if (!month && periodMonth) month = periodMonth;
    if (!day && periodDay) day = periodDay;

    return { day, month, year: periodYear };
  }

  function parseSafetyIssueDateInput(dateStr, safetyPeriod) {
    if (!dateStr) {
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      return { day: date.slice(8, 10), month: date.slice(5, 7), year: date.slice(0, 4), date };
    }
    const str = String(dateStr).trim();
    let day = 0;
    let month = 0;
    let isIso = false;
    if (str.includes("-")) {
      const parts = str.split("-");
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          month = Number(parts[1]) || 0;
          day = Number(parts[2]) || 0;
          isIso = true;
        } else if (parts[2].length === 4) {
          day = Number(parts[0]) || 0;
          month = Number(parts[1]) || 0;
        }
      }
    } else if (str.includes("/")) {
      const parts = str.split("/").map((p) => p.trim());
      if (parts.length >= 2) {
        if (parts[0].length === 4) {
          month = Number(parts[1]) || 0;
          day = Number(parts[2]) || 0;
          isIso = true;
        } else {
          day = Number(parts[0]) || 0;
          month = Number(parts[1]) || 0;
        }
      }
    } else if (str.includes(".")) {
      const parts = str.split(".").map((p) => p.trim());
      if (parts.length >= 2) {
        if (parts[0].length === 4) {
          month = Number(parts[1]) || 0;
          day = Number(parts[2]) || 0;
          isIso = true;
        } else {
          day = Number(parts[0]) || 0;
          month = Number(parts[1]) || 0;
        }
      }
    } else if (/^\d{1,2}$/.test(str)) {
      day = Number(str) || 0;
    }

    if (isIso && day && month) {
      const year = Number(str.slice(0, 4));
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { day: String(day), month: String(month), year: String(year), date: window.SafetyTimeline?.date(date) || "" };
    }

    const norm = getNormalizedSafetyIssueDate({ issueDay: day, issueMonth: month }, safetyPeriod);
    return {
      day: String(norm.day || day || ""),
      month: String(norm.month || month || ""),
      year: String(norm.year || safetyPeriod?.year || new Date().getFullYear()),
      date: "",
    };
  }

  function parsePositiveIntegerInput(value) {
    const number = Number(String(value ?? "").trim());
    return Number.isInteger(number) && number >= 1 ? number : null;
  }

  function openSafetyDetailModal(item, overlay, context) {
    if (!item) return;
    const existing = document.getElementById("mobileSafetyDetailModal");
    if (existing) existing.remove();

    const isLight = (typeof getMobileTheme === "function" && getMobileTheme() === "light") ||
                    overlay?.classList?.contains("is-light-theme") ||
                    document.querySelector(".mobile-responsive-overlay")?.classList?.contains("is-light-theme");

    const fiveSPeriodId = context?.getActivePeriodId?.(context.SAFETY_PERIOD_TYPE) || "";
    const allAreas = context ? context.getAreasForPeriod(fiveSPeriodId) : [];
    const itemArea = allAreas.find((a) => a.id === item.areaId);
    const zoneLabel = itemArea ? `Zone ${itemArea.code} · ${itemArea.departmentHead || itemArea.responsibleName || ''}` : (item.issueLocation || "Zone");
    const canEditFull = canManageFullSafetyRecord(context, item);
    const canEditCountermeasure = canManageSafetyCountermeasure(context, item);
    const canSave = canEditFull || canEditCountermeasure;
    const countermeasureOnly = canEditCountermeasure && !canEditFull;
    const lockedAttr = !canEditFull ? "disabled" : "";
    const countermeasureLockedAttr = !canEditCountermeasure ? "disabled" : "";
    const todayValue = typeof context?.todayIsoDate === "function" ? context.todayIsoDate() : new Date().toISOString().slice(0, 10);
    const safetyPeriod = context?.getPeriod?.(item.periodId || fiveSPeriodId);
    let defaultIssueDate = "";
    const normItem = getNormalizedSafetyIssueDate(item, safetyPeriod);
    if (normItem.day && normItem.month) {
      const yr = normItem.year || Number(safetyPeriod?.year) || new Date().getFullYear();
      defaultIssueDate = `${yr}-${String(normItem.month).padStart(2, "0")}-${String(normItem.day).padStart(2, "0")}`;
    } else if (item.createdAt && String(item.createdAt).includes("-")) {
      defaultIssueDate = String(item.createdAt).slice(0, 10);
    } else if (safetyPeriod?.year && safetyPeriod?.month) {
      defaultIssueDate = `${safetyPeriod.year}-${String(safetyPeriod.month).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
    } else {
      defaultIssueDate = todayValue;
    }

    let rawLevel = String(item.issueLevel || item.level || item.riskLevel || "").trim().toUpperCase();
    let rawStop6 = String(item.issueType || item.stop6 || item.stop_6 || item.issue_type || "").trim();
    let statusVal = item.issueStatus || "open";

    let modalPhotoUrl = item.photoDataUrl || "";
    let modalAfterPhotoUrl = item.afterPhotoDataUrl || "";
    let modalPhotoAnnotations = [...(item.photoAnnotations || [])];
    let modalAfterPhotoAnnotations = [...(item.afterPhotoAnnotations || [])];
    let modalPhotoWasReplaced = false;
    let modalAfterPhotoWasReplaced = false;

    const modalDraftKey = `mob_safety_detail_${item.id}`;
    const savedModalDraft = window.FormDraftManager?.getDraft(modalDraftKey);
    if (savedModalDraft) {
      if (savedModalDraft.note !== undefined) item.note = savedModalDraft.note;
      if (savedModalDraft.issueStatus) statusVal = savedModalDraft.issueStatus;
      if (savedModalDraft.issueDate) defaultIssueDate = savedModalDraft.issueDate;
      if (savedModalDraft.level !== undefined) rawLevel = savedModalDraft.level;
      if (savedModalDraft.stop6 !== undefined) rawStop6 = savedModalDraft.stop6;
      if (savedModalDraft.issueCount !== undefined) item.issueCount = savedModalDraft.issueCount;
      if (savedModalDraft.foundChannel) item.foundChannel = savedModalDraft.foundChannel;
      if (savedModalDraft.foundBy !== undefined) item.issueFoundBy = savedModalDraft.foundBy;
      if (savedModalDraft.employeeCode !== undefined) item.employeeCode = savedModalDraft.employeeCode;
      if (savedModalDraft.completionDate !== undefined) item.completionDate = savedModalDraft.completionDate;
      if (savedModalDraft.improvementContent !== undefined) item.improvementContent = savedModalDraft.improvementContent;
      if (savedModalDraft.photoDataUrl) {
        modalPhotoUrl = savedModalDraft.photoDataUrl;
        modalPhotoAnnotations = savedModalDraft.photoAnnotations || [];
      }
      if (savedModalDraft.afterPhotoDataUrl) {
        modalAfterPhotoUrl = savedModalDraft.afterPhotoDataUrl;
        modalAfterPhotoAnnotations = savedModalDraft.afterPhotoAnnotations || [];
      }
    }

    const modal = document.createElement("div");
    modal.id = "mobileSafetyDetailModal";
    modal.className = "mobile-safety-detail-modal" + (isLight ? " is-light-theme" : "");
    modal.innerHTML = `
      <div class="detail-modal-backdrop"></div>
      <div class="detail-modal-content">
        
        <div class="detail-modal-header">
          <div class="detail-header-title">
            <span>${!canSave ? "Chi tiết báo cáo mối nguy" : countermeasureOnly ? "Cập Nhật Cải Tiến / Xử Lý" : "Sửa Báo Cáo Mối Nguy"}</span>
          </div>
          <button type="button" class="btn-close-modal" id="closeDetailModalBtn" aria-label="Đóng">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="detail-modal-body">
          <!-- Zone & Status Bar -->
          <div class="detail-meta-top">
            <span class="detail-zone-chip"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(zoneLabel)}</span>
            <div class="modal-status-select-wrap">
              <select id="modalDetailStatus" class="modal-status-select ${statusVal}" ${lockedAttr}>
                <option value="open" ${statusVal === 'open' ? 'selected' : ''}>Chưa xử lý</option>
                <option value="in_progress" ${statusVal === 'in_progress' ? 'selected' : ''}>Đang xử lý</option>
                <option value="overdue" ${statusVal === 'overdue' ? 'selected' : ''}>Quá hạn</option>
                <option value="closed" ${statusVal === 'closed' ? 'selected' : ''}>Đã xử lý</option>
              </select>
            </div>
          </div>

          <!-- Discovery Date (Ngày phát hiện) -->
          <div class="modal-form-group">
            <label class="modal-form-label">Ngày phát hiện</label>
            <div class="date-input-container">
              <input type="text" id="modalDetailIssueDateDisplay" class="modal-form-input date-custom-input" placeholder="dd/mm/yyyy" value="${formatIsoToVnDate(defaultIssueDate)}" readonly ${lockedAttr}>
              <input type="date" id="modalDetailIssueDate" class="native-hidden-date-input" value="${escapeHtml(defaultIssueDate)}" ${lockedAttr}>
              <button type="button" class="btn-calendar-trigger" tabindex="-1" ${lockedAttr}>
                <i class="fa-solid fa-calendar-days"></i>
              </button>
            </div>
          </div>

          <!-- STOP 6 & Level Selection Grid -->
          <div class="modal-form-grid-2">
            <div class="modal-form-group">
              <label class="modal-form-label">Cấp bậc nguy cơ</label>
              <select id="modalDetailLevel" class="modal-form-select" ${lockedAttr}>
                <option value="" ${!rawLevel ? 'selected' : ''}>Chưa phân loại</option>
                <option value="A" ${rawLevel === 'A' ? 'selected' : ''}>Cấp độ A (Nghiêm trọng)</option>
                <option value="B" ${rawLevel === 'B' ? 'selected' : ''}>Cấp độ B</option>
                <option value="C" ${rawLevel === 'C' ? 'selected' : ''}>Cấp độ C (Nhẹ)</option>
              </select>
            </div>
            <div class="modal-form-group">
              <label class="modal-form-label">Phân loại STOP 6</label>
              <select id="modalDetailStop6" class="modal-form-select" ${lockedAttr}>
                <option value="" ${!rawStop6 ? 'selected' : ''}>Chưa phân loại</option>
                <option value="1-Kẹp,kẹt" ${rawStop6 === '1-Kẹp,kẹt' ? 'selected' : ''}>1-Kẹp, kẹt</option>
                <option value="2-Vật nặng" ${rawStop6 === '2-Vật nặng' ? 'selected' : ''}>2-Vật nặng</option>
                <option value="3-Xe cộ" ${rawStop6 === '3-Xe cộ' ? 'selected' : ''}>3-Xe cộ</option>
                <option value="4-Rơi,ngã" ${rawStop6 === '4-Rơi,ngã' ? 'selected' : ''}>4-Rơi, ngã</option>
                <option value="5-Điện giật" ${rawStop6 === '5-Điện giật' ? 'selected' : ''}>5-Điện giật</option>
                <option value="6-Cháy nổ" ${rawStop6 === '6-Cháy nổ' ? 'selected' : ''}>6-Cháy nổ</option>
                <option value="7-Loại khác" ${rawStop6 === '7-Loại khác' ? 'selected' : ''}>7-Loại khác</option>
              </select>
            </div>
          </div>

          <!-- Description (Mô tả mối nguy hiểm) -->
          <div class="modal-form-group">
            <label class="modal-form-label">Mô tả mối nguy hiểm</label>
            <textarea id="modalDetailNote" class="modal-form-textarea" rows="2" placeholder="Nhập mô tả chi tiết mối nguy..." ${lockedAttr}>${escapeHtml(item.note || '')}</textarea>
          </div>

          <!-- Photo 1: Ảnh hiện trường (Edit, Add & Delete) -->
          <div class="modal-form-group">
            <label class="modal-form-label">Ảnh hiện trường</label>
            <div class="modal-photo-upload-box" id="modalPhotoBox1">
              <input type="file" id="modalPhotoInput1" accept="image/*" class="photo-file-input ${modalPhotoUrl ? 'is-hidden' : ''}" ${lockedAttr}>
              
              <div id="modalPhotoPlaceholder1" class="photo-placeholder ${modalPhotoUrl ? 'is-hidden' : ''}">
                <div class="photo-icon-circle">
                  <i class="fa-solid fa-image"></i>
                </div>
                <p class="photo-primary-prompt">Chụp / Đính kèm ảnh hiện trường</p>
                ${canEditFull ? `<div class="photo-action-chip">
                  <i class="fa-solid fa-plus"></i> Thêm / Tải ảnh mới
                </div>` : '<p class="photo-primary-prompt">Chưa có ảnh hiện trường</p>'}
              </div>

              <div id="modalPhotoWrap1" class="photo-preview-wrap ${modalPhotoUrl ? '' : 'is-hidden'}">
                <img id="modalPhotoImg1" src="${modalPhotoUrl || ''}" alt="Ảnh hiện trường" class="photo-preview-img cursor-pointer" data-preview-img="${modalPhotoUrl || ''}" data-safety-annotations="${escapeHtml(JSON.stringify(modalPhotoAnnotations))}" title="Chạm để xem phóng to">
                <div class="photo-preview-actions">
                  <button type="button" id="modalAnnotatePhotoBtn1" class="photo-btn annotate-btn" title="Vẽ nét & chú thích ảnh" aria-label="Vẽ nét & chú thích ảnh" ${modalPhotoUrl && canEditFull ? '' : 'hidden'}>
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                  <button type="button" id="modalOpenPhotoBtn1" class="photo-btn open-btn" title="Mở ảnh lớn" aria-label="Mở ảnh hiện trường" ${modalPhotoUrl ? '' : 'hidden'}>
                    <i class="fa-solid fa-expand"></i>
                  </button>
                  <button type="button" id="modalRetakePhotoBtn1" class="photo-btn retake-btn" title="Đổi ảnh" aria-label="Đổi ảnh hiện trường" ${canEditFull ? "" : "hidden disabled"}>
                    <i class="fa-solid fa-arrows-rotate"></i>
                  </button>
                  <button type="button" id="modalRemovePhotoBtn1" class="photo-btn delete-btn" title="Xóa ảnh" aria-label="Xóa ảnh hiện trường" ${canEditFull ? "" : "hidden disabled"}>
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
                <div class="photo-attached-badge">
                  <i class="fa-solid fa-circle-check"></i> Ảnh hiện trường (Chạm xem)
                </div>
              </div>
            </div>
          </div>

          <div class="modal-form-group">
            <label class="modal-form-label">Số lần phát hiện</label>
            <input type="number" id="modalDetailIssueCount" class="modal-form-input" min="1" step="1" value="${escapeHtml(item.issueCount || 1)}" ${lockedAttr}>
          </div>

          <!-- Info Grid (Finder & Channel) -->
          <div class="modal-form-grid-2">
            <div class="modal-form-group">
              <label class="modal-form-label">Phát hiện bởi (kênh)</label>
              <select id="modalDetailFoundChannel" class="modal-form-select" ${lockedAttr}>
                <option value="worker" ${item.foundChannel === 'worker' ? 'selected' : ''}>Công nhân</option>
                <option value="head" ${item.foundChannel === 'head' ? 'selected' : ''}>Trưởng bộ phận</option>
                <option value="assessor" ${item.foundChannel === 'assessor' ? 'selected' : ''}>Assessor</option>
                <option value="at5s" ${item.foundChannel === 'at5s' ? 'selected' : ''}>Ban AT - 5S</option>
              </select>
            </div>
            <div class="modal-form-group">
              <label class="modal-form-label">Tên người phát hiện</label>
              <input type="text" id="modalDetailFoundBy" class="modal-form-input" value="${escapeHtml(item.issueFoundBy || '')}" placeholder="Tên người phát hiện..." ${lockedAttr}>
            </div>
          </div>

          <div class="modal-form-grid-2">
            <div class="modal-form-group">
              <label class="modal-form-label">Mã nhân viên</label>
              <input type="text" id="modalDetailEmployeeCode" class="modal-form-input" value="${escapeHtml(item.employeeCode || '')}" placeholder="Mã NV..." ${lockedAttr}>
            </div>
            <div class="modal-form-group">
              <label class="modal-form-label">Ngày dự kiến hoàn thành</label>
              <input type="date" id="modalDetailCompletionDate" class="modal-form-input" value="${escapeHtml(item.completionDate ? item.completionDate.split('T')[0] : '')}" ${countermeasureLockedAttr}>
            </div>
          </div>

          <!-- Improvement / Countermeasure Details -->
          <div class="modal-form-group">
            <label class="modal-form-label">Đối sách cải tiến, xử lý</label>
            <textarea id="modalDetailImprovement" class="modal-form-textarea" rows="2" placeholder="Nội dung phương án cải tiến / xử lý..." ${countermeasureLockedAttr}>${escapeHtml(item.improvementContent || '')}</textarea>
          </div>

          <!-- Photo 2: Ảnh sau cải tiến (Edit, Add & Delete) -->
          <div class="modal-form-group">
            <label class="modal-form-label">Ảnh sau cải tiến (nếu có)</label>
            <div class="modal-photo-upload-box" id="modalPhotoBox2">
              <input type="file" id="modalPhotoInput2" accept="image/*" class="photo-file-input ${modalAfterPhotoUrl ? 'is-hidden' : ''}" ${countermeasureLockedAttr}>
              
              <div id="modalPhotoPlaceholder2" class="photo-placeholder ${modalAfterPhotoUrl ? 'is-hidden' : ''}">
                <div class="photo-icon-circle">
                  <i class="fa-solid fa-image"></i>
                </div>
                <p class="photo-primary-prompt">Chụp / Đính kèm ảnh sau cải tiến</p>
                ${canEditCountermeasure ? `<div class="photo-action-chip">
                  <i class="fa-solid fa-plus"></i> Thêm ảnh đối sách
                </div>` : '<p class="photo-primary-prompt">Chưa có ảnh đối sách</p>'}
              </div>

              <div id="modalPhotoWrap2" class="photo-preview-wrap ${modalAfterPhotoUrl ? '' : 'is-hidden'}">
                <img id="modalPhotoImg2" src="${modalAfterPhotoUrl || ''}" alt="Ảnh sau cải tiến" class="photo-preview-img cursor-pointer" data-preview-img="${modalAfterPhotoUrl || ''}" data-safety-annotations="${escapeHtml(JSON.stringify(modalAfterPhotoAnnotations))}" title="Chạm để xem phóng to">
                <div class="photo-preview-actions">
                  <button type="button" id="modalAnnotatePhotoBtn2" class="photo-btn annotate-btn" title="Vẽ nét & chú thích ảnh" aria-label="Vẽ nét & chú thích ảnh" ${modalAfterPhotoUrl && canEditCountermeasure ? '' : 'hidden'}>
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                  <button type="button" id="modalOpenPhotoBtn2" class="photo-btn open-btn" title="Mở ảnh lớn" aria-label="Mở ảnh sau cải tiến" ${modalAfterPhotoUrl ? '' : 'hidden'}>
                    <i class="fa-solid fa-expand"></i>
                  </button>
                  <button type="button" id="modalRetakePhotoBtn2" class="photo-btn retake-btn" title="Đổi ảnh" aria-label="Đổi ảnh sau cải tiến" ${canEditCountermeasure ? "" : "hidden disabled"}>
                    <i class="fa-solid fa-arrows-rotate"></i>
                  </button>
                  <button type="button" id="modalRemovePhotoBtn2" class="photo-btn delete-btn" title="Xóa ảnh sau cải tiến" ${canEditCountermeasure ? "" : "hidden disabled"}>
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
                <div class="photo-attached-badge">
                  <i class="fa-solid fa-circle-check"></i> Ảnh sau cải tiến (Chạm xem)
                </div>
              </div>
            </div>
          </div>

          <div class="modal-form-grid-2">
            <div class="modal-form-group">
              <label class="modal-form-label">Đảm nhiệm (PIC)</label>
              <input type="text" id="modalDetailActionOwner" class="modal-form-input" value="${escapeHtml(item.actionOwner || "")}" placeholder="Người đảm nhiệm..." ${countermeasureLockedAttr}>
            </div>
            <div class="modal-form-group">
              <label class="modal-form-label">Kế hoạch</label>
              <input type="text" id="modalDetailActionPlan" class="modal-form-input" value="${escapeHtml(item.actionPlan || '')}" placeholder="Kế hoạch xử lý..." ${countermeasureLockedAttr}>
            </div>
          </div>

        </div>

        <!-- Action Buttons Footer -->
        ${canSave ? `<div class="detail-modal-footer ${canEditFull ? "has-delete" : "countermeasure-only"}">
          ${canEditFull ? `<button type="button" class="btn-detail-delete" id="btnDetailDelete">
            XÓA BÁO CÁO
          </button>` : ""}
          <button type="button" class="btn-detail-save" id="btnDetailSave">
            LƯU THAY ĐỔI
          </button>
        </div>` : ""}

      </div>
    `;

    document.body.appendChild(modal);
    if (!canSave) {
      modal.querySelector(".detail-modal-body")?.insertAdjacentHTML("beforeend", '<p class="findings-readonly" role="status">Chỉ xem — bạn không có quyền thêm, sửa, xóa báo cáo này.</p>');
    }
    modal.addEventListener("click", (event) => {
      const photoButton = event.target.closest(".photo-btn");
      const photoIsEditable = photoButton?.classList.contains("open-btn")
        || (photoButton?.closest("#modalPhotoWrap1") ? canEditFull : canEditCountermeasure);
      if (photoButton && !photoIsEditable) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showMobileToast("Bạn không có quyền sửa, xóa ảnh này.", true);
      }
    }, true);

    const captureModalSnapshot = () => ({
      note: modal.querySelector("#modalDetailNote")?.value?.trim() || "",
      issueStatus: modal.querySelector("#modalDetailStatus")?.value || "open",
      issueDate: modal.querySelector("#modalDetailIssueDate")?.value || "",
      level: modal.querySelector("#modalDetailLevel")?.value || "",
      stop6: modal.querySelector("#modalDetailStop6")?.value || "",
      issueCount: modal.querySelector("#modalDetailIssueCount")?.value || "1",
      foundChannel: modal.querySelector("#modalDetailFoundChannel")?.value || "worker",
      foundBy: modal.querySelector("#modalDetailFoundBy")?.value?.trim() || "",
      employeeCode: modal.querySelector("#modalDetailEmployeeCode")?.value?.trim() || "",
      completionDate: modal.querySelector("#modalDetailCompletionDate")?.value || "",
      improvementContent: modal.querySelector("#modalDetailImprovement")?.value?.trim() || "",
      photoDataUrl: modalPhotoUrl || "",
      photoAnnotations: modalPhotoAnnotations || [],
      afterPhotoDataUrl: modalAfterPhotoUrl || "",
      afterPhotoAnnotations: modalAfterPhotoAnnotations || [],
    });

    const isModalDirty = () => {
      if (!modal?.isConnected) return false;
      const cur = captureModalSnapshot();
      return Boolean(
        cur.note !== String(item.note || "").trim() ||
        cur.issueStatus !== (item.issueStatus || "open") ||
        cur.improvementContent !== String(item.improvementContent || "").trim() ||
        cur.photoDataUrl !== (item.photoDataUrl || "") ||
        JSON.stringify(cur.photoAnnotations || []) !== JSON.stringify(item.photoAnnotations || []) ||
        cur.afterPhotoDataUrl !== (item.afterPhotoDataUrl || "") ||
        JSON.stringify(cur.afterPhotoAnnotations || []) !== JSON.stringify(item.afterPhotoAnnotations || []) ||
        cur.level !== (item.issueLevel || "") ||
        cur.stop6 !== (item.issueType || "") ||
        cur.foundBy !== String(item.issueFoundBy || "").trim() ||
        cur.employeeCode !== String(item.employeeCode || "").trim() ||
        cur.completionDate !== (item.completionDate ? item.completionDate.split("T")[0] : "")
      );
    };

    const showModalDraftBanner = () => {
      let banner = modal.querySelector("#modalDetailDraftBanner");
      if (!banner) {
        const bodyEl = modal.querySelector(".detail-modal-body");
        if (bodyEl) {
          banner = typeof document !== "undefined" ? document.createElement("div") : null;
          if (!banner) return;
          banner.id = "modalDetailDraftBanner";
          banner.className = "mobile-draft-banner";
          banner.innerHTML = `
            <div class="draft-banner-content">
              <i class="fa-solid fa-clock-rotate-left"></i>
              <span>Nội dung chỉnh sửa mối nguy này đã được lưu tạm trong bộ nhớ (cache).</span>
            </div>
            <button type="button" class="btn-clear-draft-mobile" id="modalDetailClearDraftBtn" title="Xóa bản nháp này">
              <i class="fa-solid fa-trash-can"></i> Xóa nháp
            </button>
          `;
          bodyEl.insertBefore(banner, bodyEl.firstElementChild);
          banner.querySelector("#modalDetailClearDraftBtn")?.addEventListener("click", () => {
            window.FormDraftManager?.clearDraft(modalDraftKey);
            window.FormDraftManager?.unregisterDirtyForm(modalDraftKey);
            modal.remove();
            showMobileToast("Đã xóa bản nháp chỉnh sửa!");
            openSafetyDetailModal(item, overlay, context);
          });
        }
      }
    };

    const markModalDirty = () => {
      if (isModalDirty()) {
        window.FormDraftManager?.saveDraft(modalDraftKey, captureModalSnapshot());
      } else {
        window.FormDraftManager?.clearDraft(modalDraftKey);
      }
    };
    if (savedModalDraft && !isModalDirty()) {
      window.FormDraftManager?.clearDraft(modalDraftKey);
    }

    window.FormDraftManager?.registerDirtyForm(modalDraftKey, {
      isDirty: isModalDirty,
      getSnapshot: captureModalSnapshot,
      onDiscard: () => {
        window.FormDraftManager?.clearDraft(modalDraftKey);
      },
    });

    modal.addEventListener("input", markModalDirty);
    modal.addEventListener("change", markModalDirty);

    modal.querySelector("#modalDetailClearDraftBtn")?.addEventListener("click", () => {
      window.FormDraftManager?.clearDraft(modalDraftKey);
      window.FormDraftManager?.unregisterDirtyForm(modalDraftKey);
      modal.remove();
      showMobileToast("Đã xóa bản nháp chỉnh sửa!");
      openSafetyDetailModal(item, overlay, context);
    });

    const closeModal = (force = false) => {
      const doClose = () => {
        window.FormDraftManager?.unregisterDirtyForm(modalDraftKey);
        modal.remove();
      };
      if (!force && isModalDirty()) {
        window.FormDraftManager.showUnsavedConfirmModal({
          title: "Bạn có thay đổi chưa lưu!",
          message: "Nội dung chỉnh sửa mối nguy đã được lưu tạm vào bộ nhớ (cache). Bạn có muốn tiếp tục chỉnh sửa hay thoát?",
          onKeepEditing: () => {},
          onSaveDraftAndExit: () => {
            window.FormDraftManager?.saveDraft(modalDraftKey, captureModalSnapshot());
            doClose();
          },
          onDiscardAndExit: () => {
            window.FormDraftManager?.clearDraft(modalDraftKey);
            doClose();
          },
        });
        return;
      }
      doClose();
    };

    modal.querySelector(".detail-modal-backdrop").addEventListener("click", () => closeModal());
    modal.querySelector("#closeDetailModalBtn").addEventListener("click", () => closeModal());

    // Lightbox for photos in detail modal
    modal.querySelectorAll("[data-preview-img]").forEach((el) => {
      el.addEventListener("click", (e) => {
        // Only trigger lightbox if user tapped on the image itself, not on action buttons
        if (e.target.closest(".photo-btn")) return;
        e.preventDefault();
        e.stopPropagation();
        const src = el.dataset.previewImg || el.src;
        if (src) {
          const isAfterPhoto = el.id === "modalPhotoImg2";
          const field = isAfterPhoto ? "afterPhotoAnnotations" : "photoAnnotations";
          const photoWasReplaced = () => isAfterPhoto ? modalAfterPhotoWasReplaced : modalPhotoWasReplaced;
          const annotationOptions = buildMobilePhotoAnnotationOptions(context, item, field, {
            initialCircles: isAfterPhoto ? modalAfterPhotoAnnotations : modalPhotoAnnotations,
            editable: isAfterPhoto ? canEditCountermeasure : canEditFull,
            localOnly: photoWasReplaced(),
            onChange: (annotations) => {
              if (isAfterPhoto) modalAfterPhotoAnnotations = annotations;
              else modalPhotoAnnotations = annotations;
              el.dataset.safetyAnnotations = JSON.stringify(annotations);
              window.refreshSafetyPhotoAnnotationThumbnail?.(el, annotations);
              markModalDirty();
            },
          });
          openMobileImageModal(src, annotationOptions);
        }
      });
    });
    [
      ["#modalOpenPhotoBtn1", "#modalPhotoImg1"],
      ["#modalAnnotatePhotoBtn1", "#modalPhotoImg1"],
      ["#modalOpenPhotoBtn2", "#modalPhotoImg2"],
      ["#modalAnnotatePhotoBtn2", "#modalPhotoImg2"],
    ].forEach(([buttonSelector, imageSelector]) => {
      modal.querySelector(buttonSelector)?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        modal.querySelector(imageSelector)?.click();
      });
    });

    // Wire Photo 1 (Ảnh hiện trường) events
    const fileInput1 = modal.querySelector("#modalPhotoInput1");
    const placeholder1 = modal.querySelector("#modalPhotoPlaceholder1");
    const wrap1 = modal.querySelector("#modalPhotoWrap1");
    const img1 = modal.querySelector("#modalPhotoImg1");
    const openButton1 = modal.querySelector("#modalOpenPhotoBtn1");

    if (fileInput1) {
      fileInput1.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            modalPhotoUrl = ev.target.result;
            modalPhotoAnnotations = [];
            modalPhotoWasReplaced = true;
            if (img1) {
              img1.src = modalPhotoUrl;
              img1.dataset.previewImg = modalPhotoUrl;
              img1.dataset.safetyAnnotations = "[]";
            }
            placeholder1?.classList.add("is-hidden");
            wrap1?.classList.remove("is-hidden");
            fileInput1?.classList.add("is-hidden");
            if (openButton1) openButton1.hidden = false;
            markModalDirty();
          };
          reader.readAsDataURL(file);
        }
      });
    }

    modal.querySelector("#modalRetakePhotoBtn1")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileInput1?.click();
    });

    modal.querySelector("#modalRemovePhotoBtn1")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      modalPhotoUrl = "";
      modalPhotoAnnotations = [];
      modalPhotoWasReplaced = true;
      if (fileInput1) fileInput1.value = "";
      if (img1) {
        img1.src = "";
        img1.dataset.previewImg = "";
        img1.dataset.safetyAnnotations = "[]";
      }
      wrap1?.classList.add("is-hidden");
      placeholder1?.classList.remove("is-hidden");
      fileInput1?.classList.remove("is-hidden");
      if (openButton1) openButton1.hidden = true;
      markModalDirty();
    });

    // Wire Photo 2 (Ảnh sau cải tiến) events
    const fileInput2 = modal.querySelector("#modalPhotoInput2");
    const placeholder2 = modal.querySelector("#modalPhotoPlaceholder2");
    const wrap2 = modal.querySelector("#modalPhotoWrap2");
    const img2 = modal.querySelector("#modalPhotoImg2");
    const openButton2 = modal.querySelector("#modalOpenPhotoBtn2");

    if (fileInput2) {
      fileInput2.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            modalAfterPhotoUrl = ev.target.result;
            modalAfterPhotoAnnotations = [];
            modalAfterPhotoWasReplaced = true;
            if (img2) {
              img2.src = modalAfterPhotoUrl;
              img2.dataset.previewImg = modalAfterPhotoUrl;
              img2.dataset.safetyAnnotations = "[]";
            }
            placeholder2?.classList.add("is-hidden");
            wrap2?.classList.remove("is-hidden");
            fileInput2?.classList.add("is-hidden");
            if (openButton2) openButton2.hidden = false;
            markModalDirty();
          };
          reader.readAsDataURL(file);
        }
      });
    }

    modal.querySelector("#modalRetakePhotoBtn2")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileInput2?.click();
    });

    modal.querySelector("#modalRemovePhotoBtn2")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      modalAfterPhotoUrl = "";
      modalAfterPhotoAnnotations = [];
      modalAfterPhotoWasReplaced = true;
      if (fileInput2) fileInput2.value = "";
      if (img2) {
        img2.src = "";
        img2.dataset.previewImg = "";
        img2.dataset.safetyAnnotations = "[]";
      }
      wrap2?.classList.add("is-hidden");
      placeholder2?.classList.remove("is-hidden");
      fileInput2?.classList.remove("is-hidden");
      if (openButton2) openButton2.hidden = true;
      markModalDirty();
    });

    // Wire date picker change sync to display inputs (dd/mm/yyyy)
    modal.querySelectorAll(".date-input-container").forEach((wrap) => {
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
        if (lockedAttr) return;
        try {
          if (typeof nativeDate.showPicker === "function") {
            nativeDate.showPicker();
          }
        } catch (_) {}
      });
    });

    // Save button click inside direct edit modal
    modal.querySelector("#btnDetailSave")?.addEventListener("click", async () => {
      if (!canManageSafetyCountermeasure(context, item) && !canManageFullSafetyRecord(context, item)) {
        showMobileToast("Tài khoản của bạn không có quyền sửa báo cáo mối nguy này!", true);
        return;
      }

      const btnSave = modal.querySelector("#btnDetailSave");
      if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Đang lưu...</span>`;
      }

      const note = modal.querySelector("#modalDetailNote")?.value?.trim() || "";
      const issueStatus = modal.querySelector("#modalDetailStatus")?.value || "open";
      const issueLevel = modal.querySelector("#modalDetailLevel")?.value || "";
      const issueType = modal.querySelector("#modalDetailStop6")?.value || "";
      const issueCount = countermeasureOnly
        ? (parsePositiveIntegerInput(item.issueCount) || 1)
        : parsePositiveIntegerInput(modal.querySelector("#modalDetailIssueCount")?.value);
      const foundChannel = modal.querySelector("#modalDetailFoundChannel")?.value || "worker";
      const issueFoundBy = modal.querySelector("#modalDetailFoundBy")?.value?.trim() || "";
      const employeeCode = modal.querySelector("#modalDetailEmployeeCode")?.value?.trim() || "";
      const improvementContent = modal.querySelector("#modalDetailImprovement")?.value?.trim() || "";
      const actionOwner = modal.querySelector("#modalDetailActionOwner")?.value?.trim() || "";
      const actionPlan = modal.querySelector("#modalDetailActionPlan")?.value?.trim() || "";
      const cleanDateStr = (v) => {
        if (!v) return "";
        const s = String(v).trim();
        const m = s.match(/^\d{4}-\d{2}-\d{2}/);
        return m ? m[0] : "";
      };

      const completionDate = cleanDateStr(modal.querySelector("#modalDetailCompletionDate")?.value);
      const countermeasureDate = cleanDateStr(item.countermeasureDate) || "";
      const completedDate = cleanDateStr(item.completedDate) || "";
      const issueDateValue = modal.querySelector("#modalDetailIssueDate")?.value || "";

      let { day: issueDay, month: issueMonth, date: issueDate } = parseSafetyIssueDateInput(issueDateValue, safetyPeriod);
      if (!issueDay || !issueMonth) {
        const fallbackNorm = getNormalizedSafetyIssueDate(item, safetyPeriod);
        issueDay = issueDay || String(fallbackNorm.day || item.issueDay || "");
        issueMonth = issueMonth || String(fallbackNorm.month || item.issueMonth || "");
      }
      if (!issueDate && !countermeasureOnly) {
        showMobileToast("Ngày đánh giá an toàn không hợp lệ.", true);
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.innerHTML = `<i class="fa-solid fa-floppy-disk"></i><span>Lưu Thay Đổi</span>`;
        }
        return;
      }

      if (!countermeasureOnly && !note) {
        showMobileToast("Vui lòng nhập mô tả Mối nguy hiểm!", true);
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.innerHTML = `<i class="fa-solid fa-floppy-disk"></i><span>Lưu Thay Đổi</span>`;
        }
        return;
      }

      if (!countermeasureOnly && issueCount === null) {
        showMobileToast("Số lần phát hiện phải là số nguyên từ 1 trở lên.", true);
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.innerHTML = `<i class="fa-solid fa-floppy-disk"></i><span>Lưu Thay Đổi</span>`;
        }
        modal.querySelector("#modalDetailIssueCount")?.focus();
        return;
      }

      const now = new Date();

      let finalPhotoDataUrl = modalPhotoUrl;
      let finalPhotoName = item.photoName || "anh-moi-nguy.jpg";
      const file1 = fileInput1?.files?.[0];
      if (file1 && typeof context?.prepareScorePhoto === "function") {
        try {
          const prepared1 = await context.prepareScorePhoto(file1, null, false, fiveSPeriodId, "van-de-5s");
          finalPhotoDataUrl = prepared1.photoDataUrl || finalPhotoDataUrl;
          finalPhotoName = prepared1.photoName || finalPhotoName;
        } catch (_) {}
      }

      let finalAfterPhotoDataUrl = modalAfterPhotoUrl;
      let finalAfterPhotoName = item.afterPhotoName || "anh-sau-cai-tien.jpg";
      const file2 = fileInput2?.files?.[0];
      if (file2 && typeof context?.prepareScorePhoto === "function") {
        try {
          const prepared2 = await context.prepareScorePhoto(file2, null, false, fiveSPeriodId, "van-de-5s");
          finalAfterPhotoDataUrl = prepared2.photoDataUrl || finalAfterPhotoDataUrl;
          finalAfterPhotoName = prepared2.photoName || finalAfterPhotoName;
        } catch (_) {}
      }

      const updatedRecord = countermeasureOnly
        ? {
            ...item,
            createdAt: item.createdAt || item.updatedAt || now.toISOString(),
            improvementContent,
            actionOwner,
            actionPlan,
            completionDate, countermeasureDate, completedDate,
            afterPhotoDataUrl: finalAfterPhotoDataUrl,
            afterPhotoName: finalAfterPhotoName,
            afterPhotoAnnotations: modalAfterPhotoAnnotations,
            updatedAt: now.toISOString(),
          }
        : {
            ...item,
            createdAt: item.createdAt || item.updatedAt || now.toISOString(),
            issueDate,
            issueDay: issueDay || item.issueDay || "",
            issueMonth: issueMonth || item.issueMonth || "",
            note,
            issueCount,
            issueStatus,
            issueLevel,
            issueType,
            foundChannel,
            issueFoundBy,
            employeeCode,
            improvementContent,
            actionOwner,
            actionPlan,
            completionDate, countermeasureDate, completedDate,
            photoDataUrl: finalPhotoDataUrl,
            photoName: finalPhotoName,
            photoAnnotations: modalPhotoAnnotations,
            afterPhotoDataUrl: finalAfterPhotoDataUrl,
            afterPhotoName: finalAfterPhotoName,
            afterPhotoAnnotations: modalAfterPhotoAnnotations,
            updatedAt: now.toISOString(),
          };

      try {
        if (typeof context?.saveSafetyRecord !== "function") throw new Error("Không có kết nối lưu dữ liệu.");
        await context.saveSafetyRecord(updatedRecord);
        if (context?.state?.safetyRecords) {
          const idx = context.state.safetyRecords.findIndex((r) => r.id === item.id);
          if (idx >= 0) {
            context.state.safetyRecords[idx] = updatedRecord;
          }
        }
        if (context?.state?.deletedSafetyRecords) {
          context.state.deletedSafetyRecords = context.state.deletedSafetyRecords.filter((r) => r.id !== item.id);
        }
        currentSafetyHistoryPage = 1;
        safetyHistoryPageKey = "";
        safetyHistoryPageData = null;
        if (typeof context?.tryUnmarkSafetyRecordDeleted === "function") {
          await context.tryUnmarkSafetyRecordDeleted(item.id);
        }

        window.FormDraftManager?.clearDraft(modalDraftKey);
        window.FormDraftManager?.unregisterDirtyForm(modalDraftKey);
        closeModal(true);
        showMobileToast("Đã lưu thay đổi báo cáo thành công!");
        renderSafetyScreen(overlay, context);
      } catch (err) {
        showMobileToast(err?.message || "Không lưu được báo cáo. Vui lòng thử lại.", true);
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.innerHTML = `<i class="fa-solid fa-floppy-disk"></i><span>Lưu Thay Đổi</span>`;
        }
      }
    });

    // Delete button click inside detail modal
    modal.querySelector("#btnDetailDelete")?.addEventListener("click", async () => {
      if (!canManageFullSafetyRecord(context, item)) {
        showMobileToast("Tài khoản của bạn không có quyền xóa báo cáo mối nguy!", true);
        return;
      }
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
          safetyHistoryPageKey = "";
          safetyHistoryPageData = null;
        }
        if (editingSafetyRecordId === item.id) {
          editingSafetyRecordId = "";
          currentSafetyZoneId = "";
          uploadedSafetyPhotoData = "";
          uploadedSafetyAfterPhotoData = "";
        }
        window.FormDraftManager?.clearDraft(modalDraftKey);
        window.FormDraftManager?.unregisterDirtyForm(modalDraftKey);
        closeModal(true);
        showMobileToast("Đã xóa báo cáo mối nguy thành công!");
        renderSafetyScreen(overlay, context);
      } catch (err) {
        showMobileToast("Không xóa được báo cáo. Vui lòng thử lại.", true);
      }
    });
  }

  function getAppContext() {
    if (typeof window.__GET_APP_CONTEXT__ === "function") {
      const fresh = window.__GET_APP_CONTEXT__();
      if (fresh) currentAppContext = fresh;
      return fresh || currentAppContext;
    }
    if (currentAppContext) return currentAppContext;
    if (window.__APP_CONTEXT__) {
      currentAppContext = window.__APP_CONTEXT__;
      return currentAppContext;
    }
    return null;
  }

  function checkFiveSPermission(context) {
    const user = context?.currentUser;
    if (!user) return false;
    if (typeof context?.isAdminAccount === "function" && context.isAdminAccount(user)) return true;
    if (typeof context?.hasAt5sRole === "function" && context.hasAt5sRole(user)) return true;
    if (typeof context?.isDepartmentHeadAccount === "function" && context.isDepartmentHeadAccount(user)) return true;
    if (typeof context?.isFiveSAssessor === "function") {
      return context.isFiveSAssessor(user);
    }
    return true;
  }

  function checkSafetyPermission(context) {
    const user = context?.currentUser;
    if (!user) return false;
    if (typeof context?.canAddSafetyEvaluation === "function") {
      return context.canAddSafetyEvaluation(user);
    }
    if (typeof context?.canUseSafety === "function") {
      return context.canUseSafety(user);
    }
    return true;
  }

  function filterMobileAreasByPermission(areas, allowedAreaIds) {
    if (!allowedAreaIds || typeof allowedAreaIds.has !== "function") return areas;
    return areas.filter((area) => allowedAreaIds.has(area.id));
  }

  function sortMobileAreasByCode(areas) {
    if (typeof window !== "undefined" && window.CustomDropdown?.compareZoneCodesByOrder) {
      return [...(areas || [])].sort(window.CustomDropdown.compareZoneCodesByOrder);
    }
    return [...(areas || [])].sort((left, right) => String(left?.code || left?.templateCode || "")
      .localeCompare(String(right?.code || right?.templateCode || ""), "vi", {
        numeric: true,
        sensitivity: "base",
      }));
  }

  function resolveMobileAreaId(currentAreaId, availableAreas) {
    return availableAreas.some((area) => area.id === currentAreaId)
      ? currentAreaId
      : availableAreas[0]?.id || "";
  }

  function getDefaultMobileFiveSScoreSource(context, user, periodId, areaId) {
    return context?.getDefaultFiveSScoreSource?.(user, periodId, areaId)
      || context?.getScoreSourceForAccount?.(user)
      || context?.SCORE_SOURCE_ASSESSOR
      || "assessor";
  }

  function formatMobileDateDisplay(value) {
    const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
  }

  function parseMobileDateDisplay(value) {
    const match = String(value || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return "";
    const isoDate = `${match[3]}-${match[2]}-${match[1]}`;
    const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    return date.getFullYear() === Number(match[3])
      && date.getMonth() === Number(match[2]) - 1
      && date.getDate() === Number(match[1])
      ? isoDate
      : "";
  }

  function canManageSafetyCountermeasure(context, record) {
    if (!record) return false;
    if (typeof context?.canManageSafetyCountermeasure === "function") {
      return context.canManageSafetyCountermeasure(record, context.currentUser);
    }
    if (typeof context?.canManageSafetyRecord === "function") {
      return context.canManageSafetyRecord(record, context.currentUser);
    }
    return checkSafetyPermission(context);
  }

  function canManageFullSafetyRecord(context, record) {
    if (!record) return false;
    if (typeof context?.canManageSafetyRecord === "function") {
      return context.canManageSafetyRecord(record, context.currentUser);
    }
    return checkSafetyPermission(context);
  }

  function getMobileTheme() {
    return localStorage.getItem("mobile_theme") || "dark";
  }

  function applyMobileTheme(overlay, theme) {
    if (!overlay) return;
    const isLight = theme === "light";
    overlay.classList.add("theme-toggling");
    overlay.classList.toggle("is-light-theme", isLight);
    const themeBtn = overlay.querySelector("#mobileThemeToggleBtn");
    if (themeBtn) {
      themeBtn.title = isLight ? "Chuyển sang giao diện Tối" : "Chuyển sang giao diện Sáng";
      themeBtn.innerHTML = mobileControlIcon(isLight ? "moon" : "sun");
    }
    requestAnimationFrame(() => {
      overlay.classList.remove("theme-toggling");
    });
  }

  function showMobileHelpDialog(overlay, context, sectionId = "5s") {
    const helpDialog = overlay?.querySelector("#mobileHelpDialog");
    if (!helpDialog) return false;

    const currentContext = window.__GET_APP_CONTEXT__?.() || context;
    const guideApi = window.UserGuideContent;
    const guideSection = ["safety", "5s", "findings"].includes(sectionId) ? sectionId : "5s";
    const helpTitle = helpDialog.querySelector("#mobileHelpDialogTitle");
    const helpContent = helpDialog.querySelector("#mobileHelpContent");
    const guide = guideApi?.getGuide(guideSection, currentContext?.state?.userGuides);

    if (helpTitle) {
      helpTitle.textContent = guide?.title ? `Hướng dẫn · ${guide.title}` : "Hướng dẫn phần đang mở";
    }
    if (helpContent && guideApi) {
      helpContent.innerHTML = guideApi.renderGuide(guideSection, currentContext?.state?.userGuides);
      currentContext?.hydrateAuthenticatedPhotos?.(helpContent);
    }
    if (!helpDialog.open) helpDialog.showModal();
    return true;
  }

  // Open Mobile Prototype View
  function openMobilePrototype(initialTab = "safety", passedContext = null, options = {}) {
    if (passedContext) {
      currentAppContext = passedContext;
    }
    const context = getAppContext();
    if (!context?.currentUser) {
      showMobileToast("Vui lòng đăng nhập để xem giao diện Mobile.", true);
      return;
    }
    const nextAccountKey = String(context.currentUser.id || context.currentUser.username || "");
    if (mobileAccountKey !== nextAccountKey) {
      mobileAccountKey = nextAccountKey;
      currentFiveSZoneId = "";
      currentSafetyZoneId = "";
      currentFiveSScoreSource = "";
      currentFiveSScoreSourceUserKey = nextAccountKey;
      currentFiveSScoreSourceAreaKey = "";
    }
    activeTab = ["5s", "findings"].includes(initialTab) ? initialTab : "safety";

    // If overlay is already open in DOM, do NOT tear down and recreate overlay!
    const existingOverlay = document.getElementById("mobileProtoOverlay");
    if (existingOverlay && document.body.contains(existingOverlay)) {
      showMobilePane(existingOverlay, context);
      if (options?.openHelp) showMobileHelpDialog(existingOverlay, context, activeTab);
      return;
    }

    const draftManager = typeof window !== "undefined" ? window.FormDraftManager : null;
    if (!options?.force && draftManager?.hasAnyDirty?.()) {
      draftManager.showUnsavedConfirmModal({
        title: "Bạn có thay đổi chưa lưu!",
        onKeepEditing: () => {},
        onDiscardAndExit: () => {
          draftManager.discardAllDirty?.();
          openMobilePrototype(initialTab, passedContext, { ...options, force: true });
        },
      });
      return;
    }

    // Close existing if open
    closeMobilePrototype();


    const currentTheme = getMobileTheme();
    const overlay = document.createElement("div");
    overlay.className = "mobile-responsive-overlay" + (currentTheme === "light" ? " is-light-theme" : "");
    overlay.id = "mobileProtoOverlay";

    // Render skeleton
    overlay.innerHTML = buildOverlaySkeletonHtml(context);
    document.body.appendChild(overlay);
    document.body.classList.add("mobile-proto-open");

    // Initialize zones & handlers
    initMobilePrototype(overlay, context);
    context?.renderIssueNotificationControls?.();
    if (options?.openHelp) showMobileHelpDialog(overlay, context, activeTab);

    // Update browser URL route
    const targetRoute = activeTab === "findings" ? "/mobile/5s-findings" : activeTab === "5s" ? "/mobile/5s" : "/mobile/safety";
    context?.pushRoute?.(targetRoute);
  }

  // Close Mobile Prototype
  function closeMobilePrototype() {
    const existing = document.getElementById("mobileProtoOverlay");
    if (existing) {
      existing.remove();
    }
    document.body.classList.remove("mobile-proto-open");
  }

  function openMobileIssueEditor(target, recordId, rowIndex, passedContext = null) {
    const context = passedContext || getAppContext();
    if (!context?.currentUser) return false;
    const targetTab = target === "five-s-findings" ? "findings" : "safety";
    openMobilePrototype(targetTab, context);
    const overlay = document.getElementById("mobileProtoOverlay");
    if (!overlay) return false;
    if (targetTab === "safety") {
      const record = (context.state?.safetyRecords || []).find((item) => item.id === recordId);
      if (!record) return false;
      openSafetyDetailModal(record, overlay, context);
      return true;
    }
    const screen = overlay.querySelector("#mobileScreenFindings");
    return Boolean(window.FiveSFindingsPage?.openIssueById?.(screen, recordId, rowIndex));
  }

  // Build Skeleton HTML
  function buildOverlaySkeletonHtml(context) {
    const user = context?.currentUser;
    const assessorName = context?.getAccountDisplayName?.(user, context.FIVE_S_PERIOD_TYPE) || user?.name || user?.username || "Đánh giá viên";
    const fiveSPeriodId = context?.getActivePeriodId?.(context.FIVE_S_PERIOD_TYPE) || "";
    const fiveSPeriod = context?.getPeriod?.(fiveSPeriodId);
    const periodBadgeText = fiveSPeriod ? context.periodLabel(fiveSPeriod) : "Kỳ đang mở";

    const currentTheme = getMobileTheme();

    const isAdmin = typeof context?.isAdminAccount === "function" && context.isAdminAccount(user);
    const isZoneOwner = typeof context?.isZoneOwnerAccount === "function" && context.isZoneOwnerAccount(user);
    const isAt5sMember = typeof context?.hasAt5sRole === "function" && context.hasAt5sRole(user);
    const roleTitle = context?.isViewerAccount?.(user) ? "Người xem" : context?.isDepartmentHeadAccount?.(user) ? "Trưởng bộ phận" : isZoneOwner ? "Quản lý zone" : isAdmin ? "Admin" : isAt5sMember ? "Ban AT - 5S" : "Assessor";

    return `
      <!-- Desktop Top Control Bar (Hidden on small mobile screens) -->
      <header class="mobile-responsive-topbar">
        <div class="topbar-left">
          <span class="topbar-pulse-dot"></span>
          <span class="topbar-title">5S & Safety Industrial Mobile View</span>
        </div>
        <div class="topbar-right">
          <button type="button" id="mobileToggleWidthBtn" class="topbar-btn" title="Chuyển chế độ mở rộng / thu gọn">
            ${mobileControlIcon("expand")}
            <span id="mobileToggleWidthText">Mở rộng</span>
          </button>
          <button type="button" id="mobileReturnDashboardBtn" class="topbar-btn topbar-btn-return" title="Quay lại Trang chủ">
            ${mobileControlIcon("back")}
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
              <img src="images/Logo.jpg" alt="LeGroup Logo" class="nav-header-avatar-img" style="width: 32px; height: 32px; max-width: 32px; max-height: 32px; object-fit: contain; border-radius: 6px; flex-shrink: 0; background: #ffffff; padding: 2px; box-sizing: border-box;">
              <div>
                <h1 class="nav-header-title">LeGroup Factory</h1>
                <p class="nav-header-assessor">
                  <i class="fa-solid ${isZoneOwner ? 'fa-user-gear text-emerald-400' : isAdmin ? 'fa-user-shield text-amber-400' : 'fa-user-check text-sky-400'}"></i>
                  <span>${escapeHtml(roleTitle)}: <strong id="mobileNavAssessorName">${escapeHtml(assessorName)}</strong></span>
                </p>
              </div>
            </div>
            <div class="nav-header-period-pill">
              <span class="period-pill-text">${escapeHtml(periodBadgeText)}</span>
              <div class="issue-notification-control mobile-issue-notification-control" data-issue-notification-control>
                <button type="button" class="issue-notification-button" data-issue-notification-toggle aria-label="Mở thông báo" aria-expanded="false" title="Thông báo">
                  ${mobileControlIcon("bell")}
                  <span class="issue-notification-count" data-issue-notification-count hidden></span>
                </button>
                <section class="issue-notification-popover mobile-issue-notification-popover" data-issue-notification-popover hidden aria-label="Thông báo vấn đề"></section>
              </div>
              <button type="button" id="mobileThemeToggleBtn" class="mobile-theme-toggle-btn" title="${currentTheme === 'light' ? 'Chuyển sang giao diện Tối' : 'Chuyển sang giao diện Sáng'}">
                ${mobileControlIcon(currentTheme === "light" ? "moon" : "sun")}
              </button>
              <button type="button" id="mobileHelpBtn" class="mobile-help-btn" title="Mở hướng dẫn sử dụng" aria-label="Mở hướng dẫn sử dụng" aria-haspopup="dialog" aria-controls="mobileHelpDialog">
                ${mobileControlIcon("help")}
              </button>
              <button type="button" id="mobileNavCloseBtn" class="mobile-nav-close-btn" title="Đóng">
                ${mobileControlIcon("close")}
              </button>
            </div>
          </div>

          <!-- Segmented Tab Switcher -->
          <div class="mobile-tab-switcher mobile-tabs-with-findings">
            <button type="button" id="mobileTabBtnSafety" class="mobile-tab-btn ${activeTab === 'safety' ? 'is-active-safety' : ''} ">
              <i class="fa-solid fa-triangle-exclamation text-amber-400"></i>
              <span>Báo Cáo An Toàn</span>
            </button>
            <button type="button" id="mobileTabBtn5S" class="mobile-tab-btn ${activeTab === '5s' ? 'is-active-fives' : ''} ">
              <i class="fa-solid fa-clipboard-check text-emerald-400"></i>
              <span>Chấm Điểm 5S</span>
            </button>
            <button type="button" id="mobileTabBtnFindings" class="mobile-tab-btn">📝 <span>Vấn đề 5S</span></button>
          </div>
        </div>

        <div id="mobileScreenFindings" class="mobile-screen-pane is-hidden"></div>
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

      <dialog class="mobile-help-dialog" id="mobileHelpDialog" aria-labelledby="mobileHelpDialogTitle">
        <div class="mobile-help-dialog-header">
          <h2 id="mobileHelpDialogTitle">Hướng dẫn sử dụng</h2>
          <button type="button" id="mobileHelpCloseBtn" class="mobile-help-close-btn" aria-label="Đóng hướng dẫn">×</button>
        </div>
        <div class="mobile-help-content" id="mobileHelpContent"></div>
      </dialog>
    `;
  }

  // Initialize listeners and content
  function initMobilePrototype(overlay, context) {
    // Return button
    const returnBtn = overlay.querySelector("#mobileReturnDashboardBtn");
    const closeBtn = overlay.querySelector("#mobileNavCloseBtn");
    const handleClose = () => {
      const doClose = () => {
        closeMobilePrototype();
        if (typeof context?.setActiveTab === "function") {
          context.setActiveTab("home", { force: true });
        } else if (typeof context?.pushRoute === "function") {
          context.pushRoute("/home");
        }
      };
      if (window.FormDraftManager?.hasAnyDirty()) {
        window.FormDraftManager.showUnsavedConfirmModal({
          title: "Bạn có thay đổi chưa lưu!",
          message: "Nội dung đang nhập đã được lưu tạm vào bộ nhớ (cache). Bạn có muốn tiếp tục chỉnh sửa hay thoát?",
          onKeepEditing: () => {},
          onSaveDraftAndExit: () => {
            window.FormDraftManager?.flushAllDrafts();
            doClose();
          },
          onDiscardAndExit: () => {
            window.FormDraftManager?.discardAllDirty();
            doClose();
          },
        });
        return;
      }
      doClose();
    };
    if (returnBtn) returnBtn.addEventListener("click", handleClose);
    if (closeBtn) closeBtn.addEventListener("click", handleClose);

    // Theme toggle button
    const themeBtn = overlay.querySelector("#mobileThemeToggleBtn");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const activeTheme = getMobileTheme();
        const nextTheme = activeTheme === "light" ? "dark" : "light";
        localStorage.setItem("mobile_theme", nextTheme);
        applyMobileTheme(overlay, nextTheme);
      });
    }

    const helpBtn = overlay.querySelector("#mobileHelpBtn");
    const isViewerAccount = Boolean(context?.isViewerAccount?.(context?.currentUser || user));
    if (helpBtn && isViewerAccount) {
      helpBtn.hidden = true;
    }
    const helpDialog = overlay.querySelector("#mobileHelpDialog");
    const helpCloseBtn = overlay.querySelector("#mobileHelpCloseBtn");
    const helpContent = overlay.querySelector("#mobileHelpContent");
    helpBtn?.addEventListener("click", () => {
      showMobileHelpDialog(overlay, context, activeTab);
    });
    helpCloseBtn?.addEventListener("click", () => helpDialog?.close());
    helpDialog?.addEventListener("click", (event) => {
      if (event.target === helpDialog) helpDialog.close();
    });

    const handleGuideImageClick = (event) => {
      const img = event.target.closest("img.mobile-user-guide-image, img");
      if (!img) return;
      const src = img.currentSrc || img.src || img.dataset.photoSrc || "";
      if (!src) return;
      event.preventDefault();
      event.stopPropagation();
      const annotations = (() => {
        try {
          return JSON.parse(img.dataset.guideAnnotations || img.dataset.safetyAnnotations || "[]");
        } catch (_) {
          return [];
        }
      })();
      openMobileImageModal(src, {
        initialCircles: annotations,
        editable: false,
        viewOnly: true,
        showToolbar: false,
      });
    };
    helpContent?.addEventListener("click", handleGuideImageClick);
    helpContent?.addEventListener("dblclick", handleGuideImageClick);

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

    const handleMobileTabSwitch = (targetTab) => {
      if (activeTab === targetTab) return;
      if (window.FormDraftManager?.hasAnyDirty()) {
        window.FormDraftManager.showUnsavedConfirmModal({
          title: "Bạn có thay đổi chưa lưu!",
          message: "Nội dung đang nhập đã được lưu tạm vào bộ nhớ (cache). Bạn có muốn tiếp tục chỉnh sửa hay chuyển mục?",
          onKeepEditing: () => {},
          onSaveDraftAndExit: () => {
            window.FormDraftManager?.flushAllDrafts();
            context.setActiveTab("mobile-" + targetTab);
          },
          onDiscardAndExit: () => {
            window.FormDraftManager?.discardAllDirty();
            context.setActiveTab("mobile-" + targetTab);
          },
        });
        return;
      }
      context.setActiveTab("mobile-" + targetTab);
    };

    overlay.querySelector("#mobileTabBtnSafety")?.addEventListener("click", () => handleMobileTabSwitch("safety"));
    overlay.querySelector("#mobileTabBtn5S")?.addEventListener("click", () => handleMobileTabSwitch("5s"));
    overlay.querySelector("#mobileTabBtnFindings")?.addEventListener("click", () => handleMobileTabSwitch("findings"));
    showMobilePane(overlay, context);
  }

  function showMobilePane(overlay, context) {
    const switched = overlay.dataset.activePane !== activeTab;
    overlay.dataset.activePane = activeTab;
    const periodBadge = overlay.querySelector(".period-pill-text");
    const fiveSPeriodId = context?.getActivePeriodId?.(context.FIVE_S_PERIOD_TYPE) || "";
    const fiveSPeriod = context?.getPeriod?.(fiveSPeriodId);
    const periodType = activeTab === "safety" ? context.SAFETY_PERIOD_TYPE : context.FIVE_S_PERIOD_TYPE;
    const currentPeriod = context?.getPeriod?.(context?.getActivePeriodId?.(periodType));
    if (periodBadge) {
      periodBadge.textContent = (fiveSPeriod ? context?.periodLabel?.(fiveSPeriod) : "")
        || (currentPeriod ? context?.periodLabel?.(currentPeriod) : "")
        || "Kỳ đang mở";
    }
    for (const [tab, suffix] of [["safety", "Safety"], ["5s", "5S"], ["findings", "Findings"]]) {
      const button = overlay.querySelector("#mobileTabBtn" + suffix);
      const pane = overlay.querySelector("#mobileScreen" + suffix);
      button?.classList.toggle("is-active-fives", activeTab === tab && tab !== "safety");
      button?.classList.toggle("is-active-safety", activeTab === tab && tab === "safety");
      pane?.classList.toggle("is-hidden", activeTab !== tab);
    }
    if (activeTab === "findings") window.FiveSFindingsPage.mount(overlay.querySelector("#mobileScreenFindings"), context);
    else if (activeTab === "5s") {
      const scoreScreen = overlay.querySelector("#mobileScreen5S");
      const scrollTop = scoreScreen?.scrollTop || 0;
      renderFiveSScreen(overlay, context);
      if (scoreScreen) scoreScreen.scrollTop = scrollTop;
    } else if (activeTab === "safety") {
      const safetyScreen = overlay.querySelector("#mobileScreenSafety");
      if (switched || !safetyScreen?.firstElementChild) renderSafetyScreen(overlay, context);
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
    const user = context?.currentUser;
    const isAdmin = typeof context?.isAdminAccount === "function" && context.isAdminAccount(user);
    const allowedAreaIds = (!isAdmin && typeof context?.getAllowedAreaIds === "function")
      ? context.getAllowedAreaIds(user, safetyPeriodId)
      : null;
    const allRecords = context?.state?.safetyRecords || [];
    const editingRecord = editingSafetyRecordId ? allRecords.find((r) => r.id === editingSafetyRecordId) || null : null;
    const reportableAreas = allSafetyAreas.filter((a) => {
      const code = String(a.templateCode || a.code || "").trim();
      return code !== "27";
    });
    const areaScope = editingRecord ? allowedAreaIds : null;
    const availableSafetyAreas = sortMobileAreasByCode(filterMobileAreasByPermission(reportableAreas, areaScope));
    const nextAnnotationDraftId = editingRecord?.id || "";
    if (safetyAnnotationDraftId !== nextAnnotationDraftId) {
      safetyAnnotationDraftId = nextAnnotationDraftId;
      pendingSafetyPhotoAnnotations = [...(editingRecord?.photoAnnotations || [])];
      pendingSafetyAfterPhotoAnnotations = [...(editingRecord?.afterPhotoAnnotations || [])];
    }

    if (editingRecord) {
      currentSafetyZoneId = editingRecord.areaId || "";
      if (!uploadedSafetyPhotoData && editingRecord.photoDataUrl) {
        uploadedSafetyPhotoData = editingRecord.photoDataUrl;
      }
      if (!uploadedSafetyAfterPhotoData && editingRecord.afterPhotoDataUrl) {
        uploadedSafetyAfterPhotoData = editingRecord.afterPhotoDataUrl;
      }
    } else {
      currentSafetyZoneId = "";
    }

    const now = new Date();
    const safetyPeriod = context?.getPeriod?.(safetyPeriodId);
    const todayValue = context?.todayIsoDate?.()
      || [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
    let defaultIssueDate = todayValue;
    if (editingRecord) {
      defaultIssueDate = context?.getSafetyRecordIssueDate?.(editingRecord, safetyPeriod)
        || editingRecord.issueDate
        || todayValue;
    }

    const dateStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const defaultFinder = editingRecord ? (editingRecord.issueFoundBy || "") : (context?.getAccountDisplayName?.(user, context.SAFETY_PERIOD_TYPE, safetyPeriodId) || user?.name || "");

    const mobileSafetyDraftKey = editingSafetyRecordId ? (`mob_safety_edit_${editingSafetyRecordId}`) : (`mob_safety_new_${safetyPeriodId}`);
    const draftManager = typeof window !== "undefined" ? window.FormDraftManager : null;
    const savedSafetyDraft = window.FormDraftManager?.getDraft(mobileSafetyDraftKey);
    if (savedSafetyDraft) {
      if (savedSafetyDraft.areaId) currentSafetyZoneId = savedSafetyDraft.areaId;
      if (savedSafetyDraft.issueDate) defaultIssueDate = savedSafetyDraft.issueDate;
      if (savedSafetyDraft.photoDataUrl) {
        uploadedSafetyPhotoData = savedSafetyDraft.photoDataUrl;
        pendingSafetyPhotoAnnotations = savedSafetyDraft.photoAnnotations || [];
      }
      if (savedSafetyDraft.afterPhotoDataUrl) {
        uploadedSafetyAfterPhotoData = savedSafetyDraft.afterPhotoDataUrl;
        pendingSafetyAfterPhotoAnnotations = savedSafetyDraft.afterPhotoAnnotations || [];
      }
    }
    const restoredSafetyZoneId = savedSafetyDraft?.areaId || editingRecord?.areaId || "";
    currentSafetyZoneId = availableSafetyAreas.some((area) => area.id === restoredSafetyZoneId)
      ? restoredSafetyZoneId
      : "";

    const activeStop6 = savedSafetyDraft?.stop6 !== undefined ? savedSafetyDraft.stop6 : (editingRecord?.issueType || "");
    const activeLevel = savedSafetyDraft?.level !== undefined ? savedSafetyDraft.level : (editingRecord?.issueLevel || "");
    const defaultFoundChannel = context?.hasAt5sRole?.(context?.currentUser) ? "at5s" : (!editingRecord ? "assessor" : "worker");
    const activeFoundChannel = savedSafetyDraft?.foundChannel !== undefined ? savedSafetyDraft.foundChannel : (editingRecord?.foundChannel || defaultFoundChannel);
    const activeIssueStatus = savedSafetyDraft?.issueStatus !== undefined ? savedSafetyDraft.issueStatus : (editingRecord?.issueStatus || "open");
    const activeFinder = savedSafetyDraft?.issueFoundBy !== undefined ? savedSafetyDraft.issueFoundBy : defaultFinder;
    const activeEmployeeCode = savedSafetyDraft?.employeeCode !== undefined ? savedSafetyDraft.employeeCode : (editingRecord?.employeeCode || "");
    const activeIssueItemLabel = savedSafetyDraft?.issueItemLabel !== undefined ? savedSafetyDraft.issueItemLabel : (editingRecord?.issueItemLabel || "Nhận diện nguy cơ mất an toàn");
    const activeImprovementContent = savedSafetyDraft?.improvementContent !== undefined ? savedSafetyDraft.improvementContent : (editingRecord?.improvementContent || "");
    const activeActionOwner = savedSafetyDraft?.actionOwner !== undefined ? savedSafetyDraft.actionOwner : (editingRecord?.actionOwner || "");
    const activeActionPlan = savedSafetyDraft?.actionPlan !== undefined ? savedSafetyDraft.actionPlan : (editingRecord?.actionPlan || "");
    const activeCompletionDate = savedSafetyDraft?.completionDate !== undefined ? savedSafetyDraft.completionDate : (editingRecord?.completionDate ? editingRecord.completionDate.split("T")[0] : "");
    const activeIssueCount = savedSafetyDraft?.issueCount !== undefined ? savedSafetyDraft.issueCount : (editingRecord?.issueCount || 1);

    const activeMonthKey = monthKeyFromDate(context?.todayIsoDate?.() || new Date());

    const monthOptions = new Map();
    allRecords.forEach((r) => {
      const key = monthKeyForSafetyRecord(r, context);
      if (key) monthOptions.set(key, key);
    });
    if (activeMonthKey) {
      monthOptions.set(activeMonthKey, activeMonthKey);
    }
    const sortedMonthKeys = [...monthOptions.keys()].sort((a, b) => b.localeCompare(a));
    if (!sortedMonthKeys.includes(currentSafetyMonthKey)) {
      currentSafetyMonthKey = activeMonthKey && sortedMonthKeys.includes(activeMonthKey) ? activeMonthKey : (sortedMonthKeys[0] || "");
    }
    const monthOptionsHtml = sortedMonthKeys.map((key) => {
      const [year, month] = key.split("-");
      return `<option value="${escapeHtml(key)}" ${key === currentSafetyMonthKey ? "selected" : ""}>Tháng ${Number(month)}/${year}</option>`;
    }).join("");

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
        <form id="mobileSafetyForm" class="mobile-safety-form" novalidate>
          
          <!-- Row 1: Zone & Ngày phát hiện -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Khu vực (Zone)<span class="required-star">*</span></label>
              <div class="select-wrapper">
                <select id="mobileSafetyZoneSelect" required class="form-control form-select" ${availableSafetyAreas.length ? "" : "disabled"}>
                  ${availableSafetyAreas.length ? `<option value="" ${currentSafetyZoneId ? "" : "selected"} disabled>Chọn Zone AT</option>` : '<option value="" selected>Chưa được phân quyền Zone</option>'}
                  ${availableSafetyAreas.length ? availableSafetyAreas.map((area) => `
                    <option value="${escapeHtml(area.id)}" ${area.id === currentSafetyZoneId ? 'selected' : ''}>
                      Zone ${escapeHtml(area.code)} · ${escapeHtml(context?.getSafetyDepartmentForArea?.(area, safetyPeriodId) || area.departmentHead || area.responsibleName || "")}
                    </option>
                  `).join("") : ""}
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
              class="form-control form-textarea">${escapeHtml(savedSafetyDraft?.note ?? (editingRecord?.note || ""))}</textarea>
          </div>

          <!-- Row 3: Photo Upload & Camera Component (Ảnh hiện trường) -->
          <div class="form-group">
            <label class="form-label">Hình ảnh minh họa hiện trường</label>
            
            <div id="mobilePhotoUploadBox" class="photo-upload-box ${uploadedSafetyPhotoData ? 'has-photo' : ''}">
              <input type="file" id="mobileSafetyFileInput" accept="image/*" class="photo-file-input ${uploadedSafetyPhotoData ? 'is-hidden' : ''}">
              
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
                <img id="mobileSafetyPreviewImg" src="${uploadedSafetyPhotoData || ''}" alt="Ảnh hiện trường" class="photo-preview-img cursor-pointer" data-preview-img="${uploadedSafetyPhotoData || ''}" data-safety-annotations="${escapeHtml(JSON.stringify(pendingSafetyPhotoAnnotations))}" data-safety-record-id="${escapeHtml(editingRecord?.id || "")}" data-safety-photo-field="photoAnnotations" data-safety-draft-field="photoAnnotations" data-safety-source-pending="false" title="Chạm để phóng to ảnh">
                <div class="photo-preview-actions">
                  <button type="button" id="mobileAnnotatePhotoBtn" class="photo-btn annotate-btn" title="Vẽ nét & chú thích ảnh" aria-label="Vẽ nét & chú thích ảnh">
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                  <button type="button" id="mobileOpenPhotoBtn" class="photo-btn open-btn" title="Mở ảnh" aria-label="Mở ảnh hiện trường">
                    <i class="fa-solid fa-expand"></i>
                  </button>
                  <button type="button" id="mobileRetakePhotoBtn" class="photo-btn retake-btn" title="Đổi ảnh" aria-label="Đổi ảnh hiện trường">
                    <i class="fa-solid fa-arrows-rotate"></i>
                  </button>
                  <button type="button" id="mobileRemovePhotoBtn" class="photo-btn delete-btn" title="Xóa ảnh" aria-label="Xóa ảnh hiện trường">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
                <div class="photo-attached-badge">
                  <i class="fa-solid fa-circle-check"></i> Đã đính kèm ảnh
                </div>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Số lần phát hiện</label>
            <input type="number" id="mobileSafetyIssueCount" class="form-control" min="1" step="1" value="${escapeHtml(activeIssueCount)}">
          </div>

          <!-- Row 4: STOP 6 & Severity Grid (Cấp bậc có Chưa phân loại) -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Phân loại STOP 6</label>
              <div class="select-wrapper">
                <select id="mobileSafetyStop6" class="form-control form-select">
                  <option value="" ${!activeStop6 ? 'selected' : ''}>Chưa phân loại</option>
                  <option value="1-Kẹp,kẹt" ${activeStop6 === '1-Kẹp,kẹt' ? 'selected' : ''}>1-Kẹp, kẹt</option>
                  <option value="2-Vật nặng" ${activeStop6 === '2-Vật nặng' ? 'selected' : ''}>2-Vật nặng</option>
                  <option value="3-Xe cộ" ${activeStop6 === '3-Xe cộ' ? 'selected' : ''}>3-Xe cộ</option>
                  <option value="4-Rơi,ngã" ${activeStop6 === '4-Rơi,ngã' ? 'selected' : ''}>4-Rơi, ngã</option>
                  <option value="5-Điện giật" ${activeStop6 === '5-Điện giật' ? 'selected' : ''}>5-Điện giật</option>
                  <option value="6-Cháy nổ" ${activeStop6 === '6-Cháy nổ' ? 'selected' : ''}>6-Cháy nổ</option>
                  <option value="7-Loại khác" ${activeStop6 === '7-Loại khác' ? 'selected' : ''}>7-Loại khác</option>
                </select>
                <i class="fa-solid fa-chevron-down select-chevron"></i>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Cấp bậc nguy cơ</label>
              <div class="select-wrapper">
                <select id="mobileSafetyLevel" class="form-control form-select">
                  <option value="" ${!activeLevel ? 'selected' : ''}>Chưa phân loại</option>
                  <option value="A" ${activeLevel === 'A' ? 'selected' : ''}>Cấp độ A (Nghiêm trọng)</option>
                  <option value="B" ${activeLevel === 'B' ? 'selected' : ''}>Cấp độ B</option>
                  <option value="C" ${activeLevel === 'C' ? 'selected' : ''}>Cấp độ C (Nhẹ)</option>
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
                  <option value="worker" ${activeFoundChannel === 'worker' ? 'selected' : ''}>Công nhân</option>
                  <option value="head" ${activeFoundChannel === 'head' ? 'selected' : ''}>Trưởng bộ phận</option>
                  <option value="assessor" ${activeFoundChannel === 'assessor' ? 'selected' : ''}>Assessor</option>
                  <option value="at5s" ${activeFoundChannel === 'at5s' ? 'selected' : ''}>Ban AT - 5S</option>
                </select>
                <i class="fa-solid fa-chevron-down select-chevron"></i>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Tình trạng</label>
              <div class="select-wrapper">
                <select id="mobileSafetyIssueStatus" class="form-control form-select">
                  <option value="open" ${activeIssueStatus === 'open' ? 'selected' : ''}>Chưa xử lý</option>
                  <option value="in_progress" ${activeIssueStatus === 'in_progress' ? 'selected' : ''}>Đang xử lý</option>
                  <option value="overdue" ${activeIssueStatus === 'overdue' ? 'selected' : ''}>Quá hạn</option>
                  <option value="closed" ${activeIssueStatus === 'closed' ? 'selected' : ''}>Đã xử lý</option>
                </select>
                <i class="fa-solid fa-chevron-down select-chevron"></i>
              </div>
            </div>
          </div>

          <!-- Row 6: Tên người phát hiện & Mã nhân viên -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Tên người phát hiện</label>
              <input type="text" id="mobileSafetyIssueFoundBy" class="form-control" placeholder="Ghi rõ tên người phát hiện..." value="${escapeHtml(activeFinder)}">
            </div>
            <div class="form-group">
              <label class="form-label">Mã nhân viên</label>
              <input type="text" id="mobileSafetyEmployeeCode" class="form-control" placeholder="Mã NV (nếu có)..." value="${escapeHtml(activeEmployeeCode)}">
            </div>
          </div>

          <!-- Row 7: Hạng mục -->
          <div class="form-group">
            <label class="form-label">Hạng mục</label>
            <input type="text" id="mobileSafetyIssueItemLabel" class="form-control" placeholder="Hạng mục..." value="${escapeHtml(activeIssueItemLabel)}">
          </div>

          <!-- Row 8: Nội dung cải tiến, xử lý -->
          <div class="form-group">
            <label class="form-label">Nội dung cải tiến, xử lý</label>
            <textarea id="mobileSafetyImprovementContent" rows="2"
              placeholder="Giải pháp / biện pháp xử lý hoặc đối sách..."
              class="form-control form-textarea">${escapeHtml(activeImprovementContent)}</textarea>
          </div>

          <!-- Row 9: Ảnh sau cải tiến -->
          <div class="form-group">
            <label class="form-label">Ảnh sau cải tiến (nếu có)</label>
            <div id="mobilePhotoAfterUploadBox" class="photo-upload-box ${uploadedSafetyAfterPhotoData ? 'has-photo' : ''}">
              <input type="file" id="mobileSafetyAfterFileInput" accept="image/*" class="photo-file-input ${uploadedSafetyAfterPhotoData ? 'is-hidden' : ''}">
              
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
                <img id="mobileSafetyAfterPreviewImg" src="${uploadedSafetyAfterPhotoData || ''}" alt="Ảnh sau cải tiến" class="photo-preview-img cursor-pointer" data-preview-img="${uploadedSafetyAfterPhotoData || ''}" data-safety-annotations="${escapeHtml(JSON.stringify(pendingSafetyAfterPhotoAnnotations))}" data-safety-record-id="${escapeHtml(editingRecord?.id || "")}" data-safety-photo-field="afterPhotoAnnotations" data-safety-draft-field="afterPhotoAnnotations" data-safety-source-pending="false" title="Chạm để phóng to ảnh">
                <div class="photo-preview-actions">
                  <button type="button" id="mobileAnnotateAfterPhotoBtn" class="photo-btn annotate-btn" title="Vẽ nét & chú thích ảnh" aria-label="Vẽ nét & chú thích ảnh">
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                  <button type="button" id="mobileOpenAfterPhotoBtn" class="photo-btn open-btn" title="Mở ảnh" aria-label="Mở ảnh sau cải tiến">
                    <i class="fa-solid fa-expand"></i>
                  </button>
                  <button type="button" id="mobileRetakeAfterPhotoBtn" class="photo-btn retake-btn" title="Đổi ảnh" aria-label="Đổi ảnh sau cải tiến">
                    <i class="fa-solid fa-arrows-rotate"></i>
                  </button>
                  <button type="button" id="mobileRemoveAfterPhotoBtn" class="photo-btn delete-btn" title="Xóa ảnh" aria-label="Xóa ảnh sau cải tiến">
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
              <input type="text" id="mobileSafetyActionOwner" class="form-control" placeholder="Người chịu trách nhiệm..." value="${escapeHtml(activeActionOwner)}">
            </div>
            <div class="form-group">
              <label class="form-label">Kế hoạch</label>
              <input type="text" id="mobileSafetyActionPlan" class="form-control" placeholder="Kế hoạch hoàn thành..." value="${escapeHtml(activeActionPlan)}">
            </div>
          </div>

          <!-- Ngày dự kiến hoàn thành -->
          <div class="form-group">
            <label class="form-label">Ngày dự kiến hoàn thành</label>
            <div class="date-input-container">
              <input type="text" id="mobileSafetyCompletionDateDisplay" class="form-control date-custom-input" placeholder="dd/mm/yyyy" value="${formatIsoToVnDate(activeCompletionDate)}" readonly>
              <input type="date" id="mobileSafetyCompletionDate" class="native-hidden-date-input" value="${escapeHtml(activeCompletionDate)}">
              <button type="button" class="btn-calendar-trigger" tabindex="-1">
                <i class="fa-solid fa-calendar-days text-white"></i>
              </button>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="form-submit-row mobile-fixed-save">
            <button type="submit" id="mobileSubmitSafetyBtn" class="btn-primary-gradient">
              <i class="fa-solid ${editingRecord ? 'fa-floppy-disk' : 'fa-paper-plane'}"></i>
              <span>${editingRecord ? 'CẬP NHẬT BÁO CÁO AN TOÀN' : 'LƯU BÁO CÁO AN TOÀN'}</span>
            </button>
          </div>
        </form>

        <!-- Recent Uploads History List -->
        <div class="mobile-history-section">
          <div class="history-section-header">
            <div class="history-heading-filter">
              <h3 class="history-section-title">Danh sách mối nguy đã ghi nhận</h3>
              <label class="history-period-filter">
                <span>Tháng</span>
                <select id="mobileSafetyMonthFilter" aria-label="Lọc mối nguy theo tháng" ${monthOptionsHtml ? "" : "disabled"}>
                  ${monthOptionsHtml || '<option value="">Chưa có dữ liệu</option>'}
                </select>
              </label>
            </div>
            <span class="history-count-badge" id="mobileSafetyHistoryCount"></span>
          </div>

          <div class="history-cards-list" id="mobileSafetyHistoryList"></div>
        </div>

      </div>
    `;

    renderSafetyHistory(screen, context, "", dateStr);
    // Wire up events inside Safety form
    wireSafetyEvents(screen, context, safetyPeriodId, overlay, allowedAreaIds);
    wireSafetyHistory(screen, context, overlay);
  }

  function renderSafetyHistory(screen, context, periodId, dateStr) {
    const list = screen.querySelector("#mobileSafetyHistoryList");
    const count = screen.querySelector("#mobileSafetyHistoryCount");
    if (!list || !count) return;

    const catalogPeriodId = context?.getActivePeriodId?.(context.SAFETY_PERIOD_TYPE) || periodId || "";
    const period = context?.getPeriod?.(catalogPeriodId);
    const periodAreas = context?.getAreasForPeriod?.(catalogPeriodId) || [];
    const reportableAreas = periodAreas.filter((area) => String(area.templateCode || area.code || "").trim() !== "27");
    const sortByAssessmentDate = (a, b) => {
        const dateA = context?.getSafetyRecordIssueDate?.(a, context?.getPeriod?.(a.periodId)) || "";
        const dateB = context?.getSafetyRecordIssueDate?.(b, context?.getPeriod?.(b.periodId)) || "";
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        const timeA = String(a.createdAt || a.updatedAt || "");
        const timeB = String(b.createdAt || b.updatedAt || "");
        if (timeA !== timeB) return timeB.localeCompare(timeA);
        return String(b.id || "").localeCompare(String(a.id || ""));
      };
    const allRecords = (context?.state?.safetyRecords || []).slice().sort(sortByAssessmentDate);
    const allMonthRecords = currentSafetyMonthKey
      ? allRecords.filter((rec) => monthKeyForSafetyRecord(rec, context) === currentSafetyMonthKey)
      : allRecords;

    let selYear = 0;
    let selMonth = 0;
    if (currentSafetyMonthKey && currentSafetyMonthKey.includes("-")) {
      const parts = currentSafetyMonthKey.split("-").map(Number);
      selYear = parts[0] || 0;
      selMonth = parts[1] || 0;
    }

    const pageKey = `${currentSafetyMonthKey || "all"}:${currentSafetyHistoryPage}`;
    if (typeof context?.loadCollectionPage === "function" && safetyHistoryPageKey !== pageKey) {
      const requestId = ++safetyHistoryPageRequestId;
      safetyHistoryPageKey = pageKey;
      const pageFilters = { collection: "safetyRecords", page: currentSafetyHistoryPage, pageSize: 20 };
      if (selYear && selMonth) {
        pageFilters.year = selYear;
        pageFilters.month = selMonth;
      }
      context.loadCollectionPage(pageFilters)
        .then((result) => {
          if (requestId !== safetyHistoryPageRequestId || pageKey !== `${currentSafetyMonthKey || "all"}:${currentSafetyHistoryPage}`) return;
          safetyHistoryPageData = { ...result, key: pageKey };
          renderSafetyHistory(screen, context, periodId, dateStr);
        })
        .catch(() => {
          if (requestId !== safetyHistoryPageRequestId) return;
          safetyHistoryPageKey = "";
        });
    }
    const serverPage = safetyHistoryPageData?.key === pageKey ? safetyHistoryPageData : null;
    const baseItems = serverPage?.items
      ? (currentSafetyMonthKey
          ? serverPage.items.filter((rec) => monthKeyForSafetyRecord(rec, context) === currentSafetyMonthKey)
          : serverPage.items)
      : allMonthRecords.slice((currentSafetyHistoryPage - 1) * 20, currentSafetyHistoryPage * 20);
    const recentRecords = baseItems.slice().sort(sortByAssessmentDate);
    const totalMonthRecords = currentSafetyMonthKey
      ? (allMonthRecords.length || (serverPage?.key === pageKey ? serverPage.total : 0))
      : (serverPage?.total ?? allMonthRecords.length);
    const totalPages = Math.max(1, Math.ceil(totalMonthRecords / 20));
    currentSafetyHistoryPage = Math.min(currentSafetyHistoryPage, totalPages);

    count.textContent = `${totalMonthRecords} Mối nguy`;
    count.title = currentSafetyMonthKey
      ? `${totalMonthRecords} mối nguy trong tháng đã chọn`
      : `${totalMonthRecords} mối nguy`;

    if (!recentRecords.length) {
      list.innerHTML = `
        <div class="history-empty-card">
          <i class="fa-solid fa-shield-check text-slate-500 text-2xl mb-1"></i>
          <p>Chưa có báo cáo mối nguy nào trong tháng này.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = recentRecords.map((item) => {
      const itemArea = reportableAreas.find((area) => area.id === item.areaId) || periodAreas.find((area) => area.id === item.areaId);
      const zoneLabel = itemArea ? `Zone ${itemArea.code}` : (item.issueLocation || "Zone");
      const statusText = item.issueStatus === "closed" ? "Đã xử lý" : item.issueStatus === "in_progress" ? "Đang xử lý" : item.issueStatus === "overdue" ? "Quá hạn" : "Chưa xử lý";
      const statusClass = item.issueStatus === "closed" ? "status-closed" : item.issueStatus === "in_progress" ? "status-progress" : item.issueStatus === "overdue" ? "status-overdue" : "status-open";
      const photoThumb = photoThumbnailUrl(item.photoDataUrl) || "images/Logo.jpg";
      const rawLevel = item.issueLevel || item.level || item.riskLevel || "";
      const issueLevel = String(rawLevel).trim().toUpperCase();
      const levelBadgeClass = issueLevel === "A" ? "pill-level-a" : issueLevel === "B" ? "pill-level-b" : issueLevel === "C" ? "pill-level-c" : "pill-level-none";
      const levelBadgeText = issueLevel ? (issueLevel.startsWith("CẤP") ? issueLevel : `Cấp ${issueLevel}`) : "Chưa phân loại";
      const rawStop6 = item.issueType || item.stop6 || item.stop_6 || item.issue_type || "";
      const stop6Text = String(rawStop6).trim();
      const itemDateIso = context?.getSafetyRecordIssueDate?.(item, context?.getPeriod?.(item.periodId)) || item.issueDate || "";
      const { day: normDay, month: normMonth } = getNormalizedSafetyIssueDate(item, period);
      const itemDate = itemDateIso
        ? formatIsoToVnDate(itemDateIso)
        : normDay && normMonth
          ? `${String(normDay).padStart(2, "0")}/${String(normMonth).padStart(2, "0")}`
          : (item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("vi-VN") : dateStr);

      return `
        <div class="history-card ${editingSafetyRecordId === item.id ? "is-editing" : ""}" data-action="open-safety-card-detail" data-id="${escapeHtml(item.id)}" role="button" tabindex="0" aria-label="Mở chi tiết mối nguy tại ${escapeHtml(zoneLabel)}" title="Chạm để xem chi tiết, sửa hoặc xóa">
          <img src="${photoThumb}" alt="Ảnh mối nguy tại ${escapeHtml(zoneLabel)}" class="history-card-thumb" loading="lazy" decoding="async" onerror="this.src='images/Logo.jpg'">
          <div class="history-card-body">
            <div class="history-card-top">
              <span class="history-zone-chip">${escapeHtml(zoneLabel)}</span>
              <span class="history-status-badge ${statusClass}">${statusText}</span>
            </div>
            <p class="history-hazard-text">${escapeHtml(item.note || "Mối nguy không có mô tả")}</p>
            <div class="history-meta-row">
              <span class="history-date-text"><i class="fa-regular fa-clock"></i> ${escapeHtml(itemDate)}</span>
              <span class="history-pill ${levelBadgeClass}">${escapeHtml(levelBadgeText)}</span>
              ${stop6Text ? `<span class="history-pill pill-stop6"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(stop6Text)}</span>` : ""}
            </div>
            ${item.improvementContent ? `
              <div class="history-countermeasure-note">
                <i class="fa-solid fa-wrench"></i> ${escapeHtml(item.improvementContent)}
              </div>
            ` : ""}
          </div>
          <div class="history-card-chevron">
            <i class="fa-solid fa-chevron-right"></i>
          </div>
        </div>
      `;
    }).join("") + (totalPages > 1 ? `
      <div class="safety-table-pager" aria-label="Phân trang danh sách mối nguy">
        <button type="button" class="tiny-button" data-safety-history-page="${currentSafetyHistoryPage - 1}" ${currentSafetyHistoryPage <= 1 ? "disabled" : ""}>Trước</button>
        <span>${recentRecords.length}/${totalMonthRecords} · Trang ${currentSafetyHistoryPage}/${totalPages}</span>
        <button type="button" class="tiny-button" data-safety-history-page="${currentSafetyHistoryPage + 1}" ${currentSafetyHistoryPage >= totalPages ? "disabled" : ""}>Sau</button>
      </div>` : "");
  }

  function wireSafetyHistory(screen, context, overlay) {
    const list = screen.querySelector("#mobileSafetyHistoryList");
    const monthSelect = screen.querySelector("#mobileSafetyMonthFilter");
    if (!list) return;

    if (monthSelect) {
      monthSelect.addEventListener("change", (event) => {
        currentSafetyMonthKey = event.target.value;
        currentSafetyHistoryPage = 1;
        safetyHistoryPageKey = "";
        safetyHistoryPageData = null;
        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        renderSafetyHistory(screen, context, "", dateStr);
      });
    }

    list.addEventListener("click", (event) => {
      const button = event.target.closest("[data-safety-history-page]");
      if (!button || !list.contains(button) || button.disabled) return;
      currentSafetyHistoryPage = Number(button.dataset.safetyHistoryPage) || 1;
      safetyHistoryPageKey = "";
      safetyHistoryPageData = null;
      const now = new Date();
      const dateStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      renderSafetyHistory(screen, context, "", dateStr);
    });

    const openRecordFromCard = (card) => {
      const record = (safetyHistoryPageData?.items || []).find((item) => item.id === card.dataset.id)
        || (context?.state?.safetyRecords || []).find((item) => item.id === card.dataset.id);
      if (!record) return;
      if (window.FormDraftManager?.hasAnyDirty()) {
        window.FormDraftManager.showUnsavedConfirmModal({
          title: "Bạn có thay đổi chưa lưu!",
          message: "Nội dung đang nhập đã được lưu tạm vào bộ nhớ (cache). Bạn có muốn tiếp tục chỉnh sửa hay xem mối nguy khác?",
          onKeepEditing: () => {},
          onSaveDraftAndExit: () => {
            window.FormDraftManager?.flushAllDrafts();
            openSafetyDetailModal(record, overlay, context);
          },
          onDiscardAndExit: () => {
            window.FormDraftManager?.discardAllDirty();
            openSafetyDetailModal(record, overlay, context);
          },
        });
        return;
      }
      openSafetyDetailModal(record, overlay, context);
    };
    list.addEventListener("click", (event) => {
      const card = event.target.closest('.history-card[data-action="open-safety-card-detail"]');
      if (card && list.contains(card) && !event.target.closest("[data-preview-img]")) openRecordFromCard(card);
    });
    list.addEventListener("keydown", (event) => {
      const card = event.target.closest('.history-card[data-action="open-safety-card-detail"]');
      if (!card || !list.contains(card) || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      openRecordFromCard(card);
    });
  }

  function wireSafetyEvents(screen, context, safetyPeriodId, overlay, allowedAreaIds) {
    const user = context?.currentUser;
    const safetyPeriod = context?.getPeriod?.(safetyPeriodId);
    const todayValue = typeof context?.todayIsoDate === "function" ? context.todayIsoDate() : new Date().toISOString().slice(0, 10);
    const mobileSafetyDraftKey = editingSafetyRecordId ? (`mob_safety_edit_${editingSafetyRecordId}`) : (`mob_safety_new_${safetyPeriodId}`);
    const draftManager = typeof window !== "undefined" ? window.FormDraftManager : null;

    const showSafetyDraftBanner = () => {
      let banner = screen.querySelector("#mobileSafetyDraftBanner");
      if (!banner) {
        const container = screen.querySelector(".mobile-safety-container");
        const formEl = screen.querySelector("#mobileSafetyForm");
        if (container && formEl) {
          banner = document.createElement("div");
          banner.id = "mobileSafetyDraftBanner";
          banner.className = "mobile-draft-banner";
          banner.innerHTML = `
            <div class="draft-banner-content">
              <i class="fa-solid fa-clock-rotate-left"></i>
              <span>Nội dung báo cáo an toàn đang có bản nháp chưa lưu (lưu tạm trong cache).</span>
            </div>
            <button type="button" class="btn-clear-draft-mobile" id="mobileSafetyClearDraftBtn" title="Xóa bản nháp này">
              <i class="fa-solid fa-trash-can"></i> Xóa nháp
            </button>
          `;
          container.insertBefore(banner, formEl);
          banner.querySelector("#mobileSafetyClearDraftBtn")?.addEventListener("click", handleClearDraft);
        }
      }
    };

    const handleClearDraft = () => {
      draftManager?.clearDraft(mobileSafetyDraftKey);
      draftManager?.unregisterDirtyForm(mobileSafetyDraftKey);
      uploadedSafetyPhotoData = "";
      uploadedSafetyAfterPhotoData = "";
      pendingSafetyPhotoAnnotations = [];
      pendingSafetyAfterPhotoAnnotations = [];
      showMobileToast("Đã xóa bản nháp báo cáo an toàn!");
      renderSafetyScreen(overlay, context);
    };

    screen.querySelector("#mobileSafetyClearDraftBtn")?.addEventListener("click", handleClearDraft);

    // Cancel Edit button
    const cancelEditBtn = screen.querySelector("#cancelEditSafetyBtn");
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener("click", () => {
        const doCancelEdit = () => {
          editingSafetyRecordId = "";
          currentSafetyZoneId = "";
          uploadedSafetyPhotoData = "";
          uploadedSafetyAfterPhotoData = "";
          renderSafetyScreen(overlay, context);
        };
        if (draftManager?.isFormDirty(mobileSafetyDraftKey)) {
          window.FormDraftManager.showUnsavedConfirmModal({
            title: "Bạn có thay đổi chưa lưu!",
            message: "Nội dung đang nhập đã được lưu tạm vào bộ nhớ (cache). Bạn có muốn tiếp tục chỉnh sửa hay thoát?",
            onKeepEditing: () => {},
            onSaveDraftAndExit: () => {
              draftManager?.unregisterDirtyForm(mobileSafetyDraftKey);
              doCancelEdit();
            },
            onDiscardAndExit: () => {
              draftManager?.clearDraft(mobileSafetyDraftKey);
              draftManager?.unregisterDirtyForm(mobileSafetyDraftKey);
              doCancelEdit();
            },
          });
          return;
        }
        doCancelEdit();
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
            pendingSafetyPhotoAnnotations = [];
            if (previewImg) {
              previewImg.src = uploadedSafetyPhotoData;
              previewImg.dataset.previewImg = uploadedSafetyPhotoData;
              previewImg.dataset.safetyAnnotations = "[]";
              previewImg.dataset.safetySourcePending = "true";
            }
            placeholder?.classList.add("is-hidden");
            previewWrap?.classList.remove("is-hidden");
            fileInput.classList.add("is-hidden");
            screen.querySelector("#mobilePhotoUploadBox")?.classList.add("has-photo");
            markMobileSafetyDirty();
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
        pendingSafetyPhotoAnnotations = [];
        if (previewImg) previewImg.dataset.safetyAnnotations = "[]";
        fileInput.value = "";
        previewWrap?.classList.add("is-hidden");
        placeholder?.classList.remove("is-hidden");
        fileInput.classList.remove("is-hidden");
        screen.querySelector("#mobilePhotoUploadBox")?.classList.remove("has-photo");
        markMobileSafetyDirty();
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
            pendingSafetyAfterPhotoAnnotations = [];
            if (afterPreviewImg) {
              afterPreviewImg.src = uploadedSafetyAfterPhotoData;
              afterPreviewImg.dataset.previewImg = uploadedSafetyAfterPhotoData;
              afterPreviewImg.dataset.safetyAnnotations = "[]";
              afterPreviewImg.dataset.safetySourcePending = "true";
            }
            afterPlaceholder?.classList.add("is-hidden");
            afterPreviewWrap?.classList.remove("is-hidden");
            afterFileInput.classList.add("is-hidden");
            screen.querySelector("#mobilePhotoAfterUploadBox")?.classList.add("has-photo");
            markMobileSafetyDirty();
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
        pendingSafetyAfterPhotoAnnotations = [];
        if (afterPreviewImg) afterPreviewImg.dataset.safetyAnnotations = "[]";
        afterFileInput.value = "";
        afterPreviewWrap?.classList.add("is-hidden");
        afterPlaceholder?.classList.remove("is-hidden");
        afterFileInput.classList.remove("is-hidden");
        screen.querySelector("#mobilePhotoAfterUploadBox")?.classList.remove("has-photo");
        markMobileSafetyDirty();
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

    // Image quick preview (lightbox)
    const openPhotoPreview = (imgEl, event) => {
      event?.preventDefault();
      event?.stopPropagation();
      if (!imgEl) return;
      const src = imgEl.dataset.previewImg || imgEl.src;
      if (src && src !== "images/Logo.jpg") {
        const field = imgEl.dataset.safetyPhotoField || "photoAnnotations";
        const recordId = imgEl.dataset.safetyRecordId || "";
        const record = recordId
          ? (context?.state?.safetyRecords || []).find((item) => item.id === recordId)
          : null;
        const draftField = imgEl.dataset.safetyDraftField || "";
        const isAfterPhoto = field === "afterPhotoAnnotations";
        const localOnly = imgEl.dataset.safetySourcePending === "true" || !record;
        const annotationOptions = buildMobilePhotoAnnotationOptions(context, record, field, {
          initialCircles: record?.[field] || (isAfterPhoto ? pendingSafetyAfterPhotoAnnotations : pendingSafetyPhotoAnnotations),
          localOnly,
          onChange: draftField
            ? (annotations) => {
                if (draftField === "afterPhotoAnnotations") pendingSafetyAfterPhotoAnnotations = annotations;
                else pendingSafetyPhotoAnnotations = annotations;
                imgEl.dataset.safetyAnnotations = JSON.stringify(annotations);
                (typeof window !== "undefined" ? window.refreshSafetyPhotoAnnotationThumbnail : null)?.(imgEl, annotations);
                markMobileSafetyDirty();
              }
            : undefined,
        });
        openMobileImageModal(src, annotationOptions);
      }
    };

    screen.querySelectorAll("[data-preview-img]").forEach((imgEl) => {
      imgEl.addEventListener("click", (event) => openPhotoPreview(imgEl, event));
    });
    [
      ["#mobileOpenPhotoBtn", previewImg],
      ["#mobileAnnotatePhotoBtn", previewImg],
      ["#mobileOpenAfterPhotoBtn", afterPreviewImg],
      ["#mobileAnnotateAfterPhotoBtn", afterPreviewImg],
    ].forEach(([selector, imgEl]) => {
      screen.querySelector(selector)?.addEventListener("click", (event) => openPhotoPreview(imgEl, event));
    });

    // Form submit handler
    const form = screen.querySelector("#mobileSafetyForm");
    if (form) {
      const captureMobileSafetySnapshot = () => ({
        areaId: screen.querySelector("#mobileSafetyZoneSelect")?.value || "",
        issueDate: screen.querySelector("#mobileSafetyIssueDate")?.value || "",
        note: screen.querySelector("#mobileSafetyDescription")?.value || "",
        photoDataUrl: uploadedSafetyPhotoData || "",
        photoAnnotations: pendingSafetyPhotoAnnotations || [],
        afterPhotoDataUrl: uploadedSafetyAfterPhotoData || "",
        afterPhotoAnnotations: pendingSafetyAfterPhotoAnnotations || [],
        stop6: screen.querySelector("#mobileSafetyStop6")?.value || "",
        level: screen.querySelector("#mobileSafetyLevel")?.value || "",
        foundChannel: screen.querySelector("#mobileSafetyFoundChannel")?.value || "",
        issueStatus: screen.querySelector("#mobileSafetyIssueStatus")?.value || "",
        issueCount: screen.querySelector("#mobileSafetyIssueCount")?.value || "1",
        issueFoundBy: screen.querySelector("#mobileSafetyIssueFoundBy")?.value || "",
        employeeCode: screen.querySelector("#mobileSafetyEmployeeCode")?.value || "",
        issueItemLabel: screen.querySelector("#mobileSafetyIssueItemLabel")?.value || "",
        improvementContent: screen.querySelector("#mobileSafetyImprovementContent")?.value || "",
        actionOwner: screen.querySelector("#mobileSafetyActionOwner")?.value || "",
        actionPlan: screen.querySelector("#mobileSafetyActionPlan")?.value || "",
        completionDate: screen.querySelector("#mobileSafetyCompletionDate")?.value || "",
      });

      const isMobileSafetyDirty = () => {
        if (!form?.isConnected || screen.classList.contains("is-hidden")) return false;
        const cur = captureMobileSafetySnapshot();
        if (editingSafetyRecordId) {
          const existing = (context?.state?.safetyRecords || []).find((r) => r.id === editingSafetyRecordId);
          if (existing) {
            return Boolean(
              cur.note.trim() !== String(existing.note || "").trim() ||
              cur.improvementContent.trim() !== String(existing.improvementContent || "").trim() ||
              cur.photoDataUrl !== (existing.photoDataUrl || "") ||
              JSON.stringify(cur.photoAnnotations || []) !== JSON.stringify(existing.photoAnnotations || []) ||
              cur.afterPhotoDataUrl !== (existing.afterPhotoDataUrl || "") ||
              JSON.stringify(cur.afterPhotoAnnotations || []) !== JSON.stringify(existing.afterPhotoAnnotations || []) ||
              cur.areaId !== (existing.areaId || "") ||
              cur.stop6 !== (existing.issueType || "") ||
              cur.level !== (existing.issueLevel || "") ||
              cur.issueStatus !== (existing.issueStatus || "open")
            );
          }
        }
        return Boolean(
          cur.note.trim() ||
          cur.photoDataUrl ||
          cur.afterPhotoDataUrl ||
          cur.improvementContent.trim()
        );
      };

      const markMobileSafetyDirty = () => {
        if (isMobileSafetyDirty()) {
          draftManager?.saveDraft(mobileSafetyDraftKey, captureMobileSafetySnapshot());
        } else {
          draftManager?.clearDraft(mobileSafetyDraftKey);
        }
      };
      if (!isMobileSafetyDirty()) {
        draftManager?.clearDraft(mobileSafetyDraftKey);
      }

      draftManager?.registerDirtyForm(mobileSafetyDraftKey, {
        isDirty: isMobileSafetyDirty,
        getSnapshot: captureMobileSafetySnapshot,
        onDiscard: () => {
          draftManager?.clearDraft(mobileSafetyDraftKey);
          uploadedSafetyPhotoData = "";
          uploadedSafetyAfterPhotoData = "";
          pendingSafetyPhotoAnnotations = [];
          pendingSafetyAfterPhotoAnnotations = [];
          editingSafetyRecordId = "";
          screen.querySelector("#mobileSafetyDraftBanner")?.remove();
        },
      });

      form.addEventListener("input", markMobileSafetyDirty);
      form.addEventListener("change", markMobileSafetyDirty);
      if (!checkSafetyPermission(context)) {
        form.querySelectorAll("input, select, textarea").forEach((input) => { input.disabled = true; });
        form.querySelector(".form-submit-row")?.remove();
        form.querySelectorAll(".photo-action-chip, .photo-btn:not(.open-btn)").forEach((control) => control.remove());
        form.insertAdjacentHTML("afterbegin", '<p class="findings-readonly" role="status">Chỉ xem — tài khoản người xem không có quyền thêm, sửa, xóa đánh giá an toàn.</p>');
      }
      let isSubmittingSafety = false;
      const handleSafetySubmit = async (e) => {
        if (e) {
          e.preventDefault?.();
          e.stopPropagation?.();
        }
        if (isSubmittingSafety) return;

        if (!checkSafetyPermission(context)) {
          showMobileToast("Tài khoản của bạn không có quyền đánh giá An toàn!", true);
          return;
        }
        if (!safetyPeriodId || context?.isPeriodArchived?.(safetyPeriodId, context.SAFETY_PERIOD_TYPE)
          || (context?.isPeriodOpen && !context.isPeriodOpen(safetyPeriodId, context.SAFETY_PERIOD_TYPE))) {
          showMobileToast("Kỳ đánh giá an toàn này đã khóa hoặc không còn mở.", true);
          return;
        }
        const isEditing = Boolean(editingSafetyRecordId);
        const existingRecord = isEditing ? (context?.state?.safetyRecords || []).find((r) => r.id === editingSafetyRecordId) : null;
        const areaId = screen.querySelector("#mobileSafetyZoneSelect")?.value;
        if (isEditing && areaId && allowedAreaIds && !allowedAreaIds.has(areaId)) {
          showMobileToast("Bạn chỉ có quyền thêm các đối sách liên quan đến Zone của mình.", true);
          return;
        }
        const desc = screen.querySelector("#mobileSafetyDescription")?.value?.trim();
        const issueDate = screen.querySelector("#mobileSafetyIssueDate")?.value || "";
        const stop6 = screen.querySelector("#mobileSafetyStop6")?.value || "";
        const level = screen.querySelector("#mobileSafetyLevel")?.value || "";
        const foundChannel = screen.querySelector("#mobileSafetyFoundChannel")?.value || "worker";
        const issueStatus = screen.querySelector("#mobileSafetyIssueStatus")?.value || "open";
        const parseCount = typeof parsePositiveIntegerInput === "function"
          ? parsePositiveIntegerInput
          : (value) => {
              const number = Number(String(value ?? "").trim());
              return Number.isInteger(number) && number >= 1 ? number : null;
            };
        const issueCount = parseCount(screen.querySelector("#mobileSafetyIssueCount")?.value ?? "1");
        const issueFoundBy = screen.querySelector("#mobileSafetyIssueFoundBy")?.value?.trim() || "";
        const employeeCode = screen.querySelector("#mobileSafetyEmployeeCode")?.value?.trim() || "";
        const issueItemLabel = screen.querySelector("#mobileSafetyIssueItemLabel")?.value?.trim() || "Nhận diện nguy cơ mất an toàn";
        const improvementContent = screen.querySelector("#mobileSafetyImprovementContent")?.value?.trim() || "";
        const actionOwner = screen.querySelector("#mobileSafetyActionOwner")?.value?.trim() || "";
        const actionPlan = screen.querySelector("#mobileSafetyActionPlan")?.value?.trim() || "";
        
        const cleanDateStr = (v) => {
          if (!v) return "";
          const s = String(v).trim();
          const m = s.match(/^\d{4}-\d{2}-\d{2}/);
          return m ? m[0] : "";
        };

        const completionDate = cleanDateStr(screen.querySelector("#mobileSafetyCompletionDate")?.value);
        const countermeasureDate = cleanDateStr(existingRecord?.countermeasureDate) || "";
        const completedDate = cleanDateStr(existingRecord?.completedDate) || "";

        if (!areaId) {
          showMobileToast("Vui lòng chọn Khu vực (Zone)!", true);
          const zoneSelect = screen.querySelector("#mobileSafetyZoneSelect");
          if (zoneSelect) {
            zoneSelect.scrollIntoView({ behavior: "smooth", block: "center" });
            zoneSelect.focus();
          }
          return;
        }
        if (!desc) {
          showMobileToast("Vui lòng nhập mô tả Mối nguy hiểm phát hiện được!", true);
          const descInput = screen.querySelector("#mobileSafetyDescription");
          if (descInput) {
            descInput.scrollIntoView({ behavior: "smooth", block: "center" });
            descInput.focus();
          }
          return;
        }

        if (issueCount === null) {
          showMobileToast("Số lần phát hiện phải là số nguyên từ 1 trở lên.", true);
          const issueCountInput = screen.querySelector("#mobileSafetyIssueCount");
          issueCountInput?.scrollIntoView({ behavior: "smooth", block: "center" });
          issueCountInput?.focus();
          return;
        }

        const now = new Date();
        const user = context?.currentUser;
        const area = context?.getAreasForPeriod?.(safetyPeriodId)?.find((a) => a.id === areaId);

        const { day: issueDay, month: issueMonth, date: normalizedIssueDate } = parseSafetyIssueDateInput(issueDate, safetyPeriod);
        if (!normalizedIssueDate) {
          showMobileToast("Ngày đánh giá an toàn không hợp lệ.", true);
          return;
        }
        isSubmittingSafety = true;
        const submitBtn = screen.querySelector("#mobileSubmitSafetyBtn");
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Đang lưu...</span>`;
        }

        let finalPhotoDataUrl = uploadedSafetyPhotoData;
        let finalPhotoName = "anh-moi-nguy.jpg";
        const file = fileInput?.files?.[0];
        if (file && typeof context?.prepareScorePhoto === "function") {
          try {
            const prepared = await context.prepareScorePhoto(file, null, false, safetyPeriodId, "an-toan");
            finalPhotoDataUrl = prepared.photoDataUrl || finalPhotoDataUrl;
            finalPhotoName = prepared.photoName || finalPhotoName;
          } catch (_) {}
        }

        let finalAfterPhotoDataUrl = uploadedSafetyAfterPhotoData;
        let finalAfterPhotoName = "anh-sau-cai-tien.jpg";
        const afterFile = afterFileInput?.files?.[0];
        if (afterFile && typeof context?.prepareScorePhoto === "function") {
          try {
            const preparedAfter = await context.prepareScorePhoto(afterFile, null, false, safetyPeriodId, "an-toan");
            finalAfterPhotoDataUrl = preparedAfter.photoDataUrl || finalAfterPhotoDataUrl;
            finalAfterPhotoName = preparedAfter.photoName || finalAfterPhotoName;
          } catch (_) {}
        }

        const targetId = isEditing ? editingSafetyRecordId : (context?.makeId ? context.makeId("safety") : `safety-${Date.now()}`);
        const isSafetyRecordOwner = Boolean(existingRecord && context?.canManageSafetyRecord?.(existingRecord, user));
        const ownerUsername = existingRecord && isSafetyRecordOwner && !context?.isAdminAccount?.(user)
          ? (user?.username || existingRecord.accountUsername || "assessor")
          : (existingRecord?.accountUsername || user?.username || "assessor");
        const ownerName = issueFoundBy || context?.getAccountDisplayName?.(user, context.SAFETY_PERIOD_TYPE, safetyPeriodId) || user?.name || ownerUsername;

        const payload = {
          ...(existingRecord || {}),
          id: targetId,
          periodId: safetyPeriodId,
          areaId: areaId,
          issueDate: normalizedIssueDate,
          issueLocation: area ? `Zone ${area.code}` : "Zone",
          issueDay,
          issueMonth,
          note: desc,
          photoDataUrl: finalPhotoDataUrl,
          photoName: finalPhotoName,
          photoAnnotations: pendingSafetyPhotoAnnotations,
          issueCount,
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
          afterPhotoAnnotations: pendingSafetyAfterPhotoAnnotations,
          actionOwner,
          actionPlan,
          completionDate,
          countermeasureDate,
          completedDate,
          completionLevelConfirm: context?.getSafetyLevelConfirm?.({ issueLevel: level }) || "",
          completionStop6Confirm: context?.getSafetyStop6Confirm?.({ issueType: stop6 }) || "",
          scorerName: existingRecord?.scorerName || ownerName,
          accountUsername: existingRecord?.accountUsername || ownerUsername,
          createdBy: existingRecord?.createdBy || ownerUsername,
          createdByAccountId: existingRecord?.createdByAccountId
            || (!existingRecord || (isSafetyRecordOwner && !context?.isAdminAccount?.(user))
              ? String(context?.currentUser?.id || "") : ""),
          createdAt: existingRecord?.createdAt || existingRecord?.updatedAt || now.toISOString(),
          updatedAt: now.toISOString(),
        };

        try {
          if (typeof context?.saveSafetyRecord !== "function") throw new Error("Không có kết nối lưu dữ liệu.");
          await context.saveSafetyRecord(payload);
          if (context?.state?.safetyRecords) {
            const idx = context.state.safetyRecords.findIndex((r) => r.id === targetId);
            if (idx >= 0) {
              context.state.safetyRecords[idx] = payload;
            } else {
              context.state.safetyRecords.unshift(payload);
            }
          }
          if (context?.state?.deletedSafetyRecords) {
            context.state.deletedSafetyRecords = context.state.deletedSafetyRecords.filter((r) => r.id !== targetId);
          }
          const savedMonthKey = monthKeyForSafetyRecord(payload, context);
          currentSafetyHistoryPage = 1;
          if (savedMonthKey) {
            currentSafetyMonthKey = savedMonthKey;
            const savedMonthRecords = (context?.state?.safetyRecords || [])
              .filter((record) => monthKeyForSafetyRecord(record, context) === savedMonthKey)
              .sort((left, right) => {
                const dateLeft = context?.getSafetyRecordIssueDate?.(left, context?.getPeriod?.(left.periodId)) || "";
                const dateRight = context?.getSafetyRecordIssueDate?.(right, context?.getPeriod?.(right.periodId)) || "";
                if (dateLeft !== dateRight) return dateRight.localeCompare(dateLeft);
                const timeLeft = String(left.createdAt || left.updatedAt || "");
                const timeRight = String(right.createdAt || right.updatedAt || "");
                if (timeLeft !== timeRight) return timeRight.localeCompare(timeLeft);
                return String(right.id || "").localeCompare(String(left.id || ""));
              });
            const savedRecordIndex = savedMonthRecords.findIndex((record) => record.id === targetId);
            if (savedRecordIndex >= 0) currentSafetyHistoryPage = Math.floor(savedRecordIndex / 20) + 1;
          }
          safetyHistoryPageKey = "";
          safetyHistoryPageData = null;
          if (typeof context?.tryUnmarkSafetyRecordDeleted === "function") {
            await context.tryUnmarkSafetyRecordDeleted(targetId);
          }

          // Reset form & state
          editingSafetyRecordId = "";
          currentSafetyZoneId = "";
          uploadedSafetyPhotoData = "";
          uploadedSafetyAfterPhotoData = "";
          safetyAnnotationDraftId = null;
          pendingSafetyPhotoAnnotations = [];
          pendingSafetyAfterPhotoAnnotations = [];
          if (fileInput) fileInput.value = "";
          if (afterFileInput) afterFileInput.value = "";

          draftManager?.clearDraft(mobileSafetyDraftKey);
          draftManager?.unregisterDirtyForm(mobileSafetyDraftKey);
          showMobileToast(isEditing ? "Đã cập nhật báo cáo an toàn!" : "Đã lưu báo cáo an toàn thành công!");
          renderSafetyScreen(overlay, context);
          if (!isEditing) {
            scrollMobileTargetIntoView(() => Array.from(screen.querySelectorAll('#mobileSafetyHistoryList .history-card[data-action="open-safety-card-detail"]'))
              .find((card) => card.dataset.id === String(targetId)));
          }
        } catch (err) {
          showMobileToast(err?.message || "Không lưu được báo cáo. Vui lòng thử lại.", true);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid ${isEditing ? 'fa-floppy-disk' : 'fa-paper-plane'}"></i><span>${isEditing ? 'CẬP NHẬT BÁO CÁO AN TOÀN' : 'LƯU BÁO CÁO AN TOÀN'}</span>`;
          }
        } finally {
          isSubmittingSafety = false;
        }
      };

      form.addEventListener("submit", handleSafetySubmit);
      const submitBtn = screen.querySelector("#mobileSubmitSafetyBtn");
      window.bindTouchSubmitBeforeKeyboardDismiss?.(form, submitBtn);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN 2: CHẤM ĐIỂM 5S (5S AUDIT SHEET WITH INLINE ALL 5 LEVELS)
  // ─────────────────────────────────────────────────────────────────────────────
  function renderFiveSScreen(overlay, context) {
    const screen = overlay.querySelector("#mobileScreen5S");
    if (!screen) return;

    const user = context?.currentUser;
    const isAdmin = typeof context?.isAdminAccount === "function" && context.isAdminAccount(user);
    const fiveSPeriodId = context?.getActivePeriodId?.(context.FIVE_S_PERIOD_TYPE) || "";
    const periodOpen = typeof context?.isPeriodOpen === "function"
      ? context.isPeriodOpen(fiveSPeriodId, context.FIVE_S_PERIOD_TYPE)
      : true;

    const allAreas = context ? context.getAreasForPeriod(fiveSPeriodId) : [];
    const allowedAreaIds = (user && !isAdmin && typeof context?.getAllowedAreaIds === "function")
      ? context.getAllowedAreaIds(user, fiveSPeriodId)
      : null;

    const assignedAreas = sortMobileAreasByCode(filterMobileAreasByPermission(allAreas, allowedAreaIds));
    const areaOptions = assignedAreas;
    if (!areaOptions.some((area) => area.id === currentFiveSZoneId)) {
      currentFiveSZoneId = assignedAreas[0]?.id || areaOptions[0]?.id || "";
    }
    const selectedArea = areaOptions.find((area) => area.id === currentFiveSZoneId) || null;
    const isAreaAllowed = !allowedAreaIds || (selectedArea && allowedAreaIds.has(selectedArea.id));
    const scoreSourceAreaKey = `${fiveSPeriodId}:${selectedArea?.id || ""}`;
    const defaultScoreSource = getDefaultMobileFiveSScoreSource(context, user, fiveSPeriodId, selectedArea?.id || "");
    const availableScoreSources = isAdmin
      ? [context?.SCORE_SOURCE_ASSESSOR || "assessor", context?.SCORE_SOURCE_SELF || "self", context?.SCORE_SOURCE_AT5S || "at5s", context?.SCORE_SOURCE_DEPARTMENT_HEAD || "departmentHead"]
      : (context?.getAvailableFiveSScoreSources?.(user, fiveSPeriodId, selectedArea?.id || "") || [defaultScoreSource]);
    const userKey = String(user?.id || user?.username || "");
    if (currentFiveSScoreSourceUserKey !== userKey) {
      currentFiveSScoreSourceUserKey = userKey;
      currentFiveSScoreSource = "";
    }
    if (currentFiveSScoreSourceAreaKey !== scoreSourceAreaKey) {
      currentFiveSScoreSourceAreaKey = scoreSourceAreaKey;
      currentFiveSScoreSource = defaultScoreSource;
    }
    if (!availableScoreSources.includes(currentFiveSScoreSource)) {
      currentFiveSScoreSource = defaultScoreSource;
    }
    const scoreSource = currentFiveSScoreSource;
    const canEditScore = checkFiveSPermission(context)
      && periodOpen
      && Boolean(isAreaAllowed)
      && (typeof context?.canEditFiveSScoreSource !== "function" || context.canEditFiveSScoreSource(user, scoreSource, selectedArea?.id || "", fiveSPeriodId));

    const isMultiDay = Boolean(context?.isMultiDayScoreSource?.(scoreSource));
    const availableDates = isMultiDay ? (context?.getAvailableScoreDates?.(fiveSPeriodId, selectedArea?.id, scoreSource) || []) : [];
    if (isMultiDay && !currentFiveSScoreDate) {
      currentFiveSScoreDate = context?.defaultScoreDateForPeriod?.(fiveSPeriodId) || "";
    }
    const activeScoreDate = isMultiDay ? currentFiveSScoreDate : "";

    // Build flattened items list
    const flattenedCriteria = buildFlattened5SCriteria(context);

    // Calculate score statistics for selected area
    const stat = calculateArea5SScoreStat(selectedArea, flattenedCriteria, context, fiveSPeriodId, scoreSource, activeScoreDate);

    // Notice banner HTML
    let noticeBannerHtml = "";
    if (!checkFiveSPermission(context)) {
      noticeBannerHtml = '<div class="fives-notice-banner warning"><span>Chỉ xem — bạn không có quyền thêm, sửa, xóa điểm 5S.</span></div>';
    } else if (!periodOpen) {
      noticeBannerHtml = `
        <div class="fives-notice-banner warning">
          <i class="fa-solid fa-lock"></i>
          <span>Kỳ đánh giá 5S này hiện không mở. Bạn đang ở chế độ xem, không thể chấm điểm mới.</span>
        </div>
      `;
    } else if (allowedAreaIds && assignedAreas.length === 0) {
      noticeBannerHtml = `
        <div class="fives-notice-banner warning">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>Tài khoản của bạn chưa được phân quyền chấm điểm Zone nào trong kỳ này.</span>
        </div>
      `;
    } else if (!isAreaAllowed && selectedArea) {
      noticeBannerHtml = `
        <div class="fives-notice-banner info">
          <i class="fa-solid fa-eye"></i>
          <span>Bạn đang xem Zone ${escapeHtml(selectedArea.code)} ở chế độ chỉ xem. Các Zone có quyền chấm được ghi rõ vai trò trong danh sách.</span>
        </div>
      `;
    }

    const scoreSourceLabel = context?.getScoreSourceLabel
      ? context.getScoreSourceLabel(scoreSource)
      : (scoreSource === "self" ? "Quản lý Zone tự đánh giá" : (scoreSource === "at5s" ? "Ban AT - 5S chấm" : (scoreSource === "departmentHead" ? "Trưởng phòng chấm" : "Assessor chấm")));
    const scoreSourceFilterHtml = availableScoreSources.length > 1 ? `
      <div class="fives-score-source-filter" role="group" aria-label="Lọc nguồn điểm 5S">
        <span class="fives-score-source-label">Nguồn điểm</span>
        <div class="fives-score-source-options">
          ${availableScoreSources.map((source) => {
            const label = context?.getScoreSourceLabel?.(source) || source;
            const activeClass = scoreSource === source
              ? (source === "self" ? "is-active-manager" : (source === "at5s" ? "is-active-at5s" : (source === "departmentHead" ? "is-active-department-head" : "is-active-assessor")))
              : "";
            return `<button type="button" class="fives-score-source-btn ${activeClass}" data-mobile-score-source="${escapeHtml(source)}" aria-pressed="${scoreSource === source}">${escapeHtml(label)}</button>`;
          }).join("")}
        </div>
      </div>
    ` : "";

    const multiDayBarHtml = isMultiDay ? `
      <div class="mobile-5s-multiday-bar${availableDates.length > 0 ? " has-history" : ""}">
        <div class="mobile-5s-multiday-input-wrap">
          <label for="mobileAuditScoreDate">Ngày chấm</label>
          <div class="mobile-5s-date-entry">
            <input type="text" id="mobileAuditScoreDate" class="mobile-5s-multiday-date" value="${escapeHtml(formatMobileDateDisplay(activeScoreDate))}" placeholder="dd/mm/yyyy" inputmode="numeric" maxlength="10" autocomplete="off">
            <input type="date" id="mobileAuditScoreDateCalendar" class="mobile-5s-date-picker" value="${escapeHtml(activeScoreDate)}" aria-label="Chọn ngày chấm">
            <span class="mobile-5s-calendar-icon" aria-hidden="true">
              <i class="fa-solid fa-calendar-days"></i>
            </span>
          </div>
        </div>
        ${availableDates.length > 0 ? `
          <div class="mobile-5s-multiday-select-wrap">
            <label for="mobileAuditScoredDates">Ngày đã chấm</label>
            <div class="select-wrapper-inline">
              <select id="mobileAuditScoredDates" class="fives-zone-select mobile-5s-multiday-select">
                <option value="">-- Các ngày đã chấm (${availableDates.length}) --</option>
                ${availableDates.map((d) => `<option value="${escapeHtml(d)}" ${d === activeScoreDate ? "selected" : ""}>${escapeHtml(formatMobileDateDisplay(d))}</option>`).join("")}
              </select>
              <i class="fa-solid fa-chevron-down select-chevron-inline" aria-hidden="true"></i>
            </div>
          </div>
        ` : ""}
      </div>
    ` : "";

    screen.innerHTML = `
      <div class="mobile-fives-container">
        
        ${noticeBannerHtml}

        <!-- Sticky Header: Zone Selector & Live Scoring Progress -->
        <div class="fives-sticky-header">
          <div class="fives-header-top">
            <div class="fives-zone-picker">
              <span class="fives-zone-label">Khu vực kiểm tra</span>
              <div class="select-wrapper-inline">
                <select id="mobileAuditZoneSelect" class="fives-zone-select" ${areaOptions.length ? "" : "disabled"}>
                  ${areaOptions.length ? areaOptions.map((area) => {
                    const resp = context?.getAreaResponsibleNameForPeriod?.(fiveSPeriodId, area) || "";
                    const scoringRole = context?.getFiveSAreaScoringRoleLabel?.(user, area.id, fiveSPeriodId) || "";
                    return `
                      <option value="${escapeHtml(area.id)}" ${area.id === currentFiveSZoneId ? 'selected' : ''}>
                        Zone ${escapeHtml(area.code)} · ${escapeHtml(resp)}${scoringRole ? ` · ${escapeHtml(scoringRole)}` : ""}
                      </option>
                    `;
                  }).join("") : '<option value="" selected>Chưa có Zone trong kỳ này</option>'}
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
        ${scoreSourceFilterHtml}
        ${multiDayBarHtml}
        </div>

        <!-- Instruction Tip -->
        <div class="fives-instruction-tip">
          <i class="fa-solid ${canEditScore ? 'fa-hand-pointer text-brand-400' : 'fa-lock text-amber-400'} text-xs"></i>
          <span>${canEditScore ? `Chạm vào tiêu chí để ghi điểm ${escapeHtml(scoreSourceLabel)}.` : `Nguồn đang xem: ${escapeHtml(scoreSourceLabel)}. Khu vực hoặc nguồn điểm này ở chế độ chỉ xem.`}</span>
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
          ${render5SItemCards(selectedArea, flattenedCriteria, context, fiveSPeriodId, scoreSource, canEditScore, activeScoreDate)}
        </div>

      </div>
    `;

    // Wire up events inside 5S view
    wireFiveSEvents(screen, overlay, context, fiveSPeriodId, scoreSource, canEditScore, activeScoreDate);
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
  function calculateArea5SScoreStat(area, criteriaList, context, periodId, scoreSource, scoreDate = "") {
    if (!area) return { completed: 0, total: criteriaList.length, avgText: "--", pct: 0 };
    let totalScore = 0;
    let scoredCount = 0;
    let completedCount = 0;

    criteriaList.forEach((c) => {
      let scoreVal = null;
      let status = "";
      if (context && typeof context.getScoreRecord === "function") {
        const rec = context.getScoreRecord(periodId, area.id, c.itemId, c.criterionId, scoreSource, scoreDate);
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

  // Render Single 5S Category Card
  function renderSingle5SCard(item, area, context, periodId, scoreSource, canEdit = true, scoreDate = "") {
    let record = null;
    let currentScore = null;
    let isNa = false;
    if (context && typeof context.getScoreRecord === "function") {
      record = context.getScoreRecord(periodId, area.id, item.itemId, item.criterionId, scoreSource, scoreDate);
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
          <span class="fives-levels-stack-title">${canEdit ? "Tiêu chuẩn cấp độ (Chạm để chọn / Chạm lại để hủy chọn):" : "Tiêu chuẩn cấp độ:"}</span>
          
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
                <div class="fives-level-row ${levelBoxClass}${canEdit ? "" : " is-readonly"}"
                     data-action-score="${lvl}"
                     data-item-id="${item.itemId}"
                     data-criterion-id="${item.criterionId}"
                     ${canEdit ? 'role="button" tabindex="0"' : 'aria-disabled="true"'}>
                  
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
            <div class="fives-level-row level-na-row ${isNa ? 'level-selected-na' : 'level-unselected'}${canEdit ? "" : " is-readonly"}"
                 data-action-score="na"
                 data-item-id="${item.itemId}"
                 data-criterion-id="${item.criterionId}"
                 ${canEdit ? 'role="button" tabindex="0"' : 'aria-disabled="true"'}>
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
  }

  // Render Category Item Cards
  function render5SItemCards(area, criteriaList, context, periodId, scoreSource, canEdit = true, scoreDate = "") {
    if (!area) return '<div class="p-4 text-center text-slate-400 text-xs">Vui lòng chọn zone để đánh giá.</div>';

    const filtered = activeSectionFilter === "all"
      ? criteriaList
      : criteriaList.filter((c) => c.section === activeSectionFilter);

    return filtered.map((item) => renderSingle5SCard(item, area, context, periodId, scoreSource, canEdit, scoreDate)).join("");
  }

  // Wire up 5S Events
  function wireFiveSEvents(screen, overlay, context, fiveSPeriodId, scoreSource, canEditScore = true, scoreDate = "") {
    // Zone Select Change
    const zoneSelect = screen.querySelector("#mobileAuditZoneSelect");
    if (zoneSelect) {
      zoneSelect.addEventListener("change", (e) => {
        currentFiveSZoneId = e.target.value;
        renderFiveSScreen(overlay, context);
      });
    }

    screen.querySelectorAll("[data-mobile-score-source]").forEach((button) => {
      button.addEventListener("click", () => {
        currentFiveSScoreSource = button.dataset.mobileScoreSource;
        renderFiveSScreen(overlay, context);
      });
    });

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

    const dateInput = screen.querySelector("#mobileAuditScoreDate");
    if (dateInput) {
      dateInput.addEventListener("change", (e) => {
        const parsedDate = parseMobileDateDisplay(e.target.value);
        if (!parsedDate) {
          showMobileToast("Vui lòng nhập ngày theo định dạng dd/mm/yyyy.", true);
          e.target.value = formatMobileDateDisplay(currentFiveSScoreDate);
          return;
        }
        currentFiveSScoreDate = parsedDate;
        renderFiveSScreen(overlay, context);
      });
    }
    const dateCalendar = screen.querySelector("#mobileAuditScoreDateCalendar");
    if (dateCalendar) {
      dateCalendar.addEventListener("change", (e) => {
        if (!e.target.value) return;
        currentFiveSScoreDate = e.target.value;
        renderFiveSScreen(overlay, context);
      });
    }
    const scoredDatesSelect = screen.querySelector("#mobileAuditScoredDates");
    if (scoredDatesSelect) {
      scoredDatesSelect.addEventListener("change", (e) => {
        if (e.target.value) {
          currentFiveSScoreDate = e.target.value;
          renderFiveSScreen(overlay, context);
        }
      });
    }

    const selectedArea = context?.getAreasForPeriod?.(fiveSPeriodId)?.find((a) => a.id === currentFiveSZoneId);
    if (!selectedArea || !canEditScore) return;

    const flattenedCriteria = buildFlattened5SCriteria(context);
    wireCardScoreClickHandlers(screen, overlay, context, fiveSPeriodId, scoreSource, selectedArea, flattenedCriteria, scoreDate);
  }

  // Attach score click handlers to a screen or individual card container
  function wireCardScoreClickHandlers(container, overlay, context, fiveSPeriodId, scoreSource, selectedArea, flattenedCriteria, scoreDate = "") {
    container.querySelectorAll("[data-action-score]").forEach((row) => {
      row.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const user = context?.currentUser;
        const isAdmin = typeof context?.isAdminAccount === "function" && context.isAdminAccount(user);
        const periodOpen = typeof context?.isPeriodOpen === "function"
          ? context.isPeriodOpen(fiveSPeriodId, context.FIVE_S_PERIOD_TYPE)
          : true;

        if (!periodOpen) {
          showMobileToast("Kỳ đánh giá 5S này hiện không mở, không thể chấm điểm!", true);
          return;
        }

        const allowedAreaIds = (user && !isAdmin && typeof context?.getAllowedAreaIds === "function")
          ? context.getAllowedAreaIds(user, fiveSPeriodId)
          : null;

        if (allowedAreaIds && selectedArea && !allowedAreaIds.has(selectedArea.id)) {
          showMobileToast(`Bạn không có quyền chấm điểm cho Zone ${selectedArea.code}! Hãy chọn Zone được phân công.`, true);
          return;
        }

        if (!checkFiveSPermission(context)) {
          showMobileToast("Tài khoản của bạn không có quyền chấm điểm 5S!", true);
          return;
        }

        if (typeof context?.canEditFiveSScoreSource === "function" && !context.canEditFiveSScoreSource(user, scoreSource, selectedArea?.id || "", fiveSPeriodId)) {
          showMobileToast("Tài khoản của bạn không có quyền chỉnh sửa nguồn điểm này!", true);
          return;
        }

        const rawAction = row.dataset.actionScore;
        const itemId = row.dataset.itemId;
        const criterionId = row.dataset.criterionId;
        const item = context?.getItem?.(itemId) || { id: itemId, code: itemId.toUpperCase() };
        const criterion = context?.getCriterion?.(item, criterionId) || { id: criterionId, label: criterionId };
        
        const currentRec = context?.getScoreRecord?.(fiveSPeriodId, selectedArea.id, itemId, criterionId, scoreSource, scoreDate);
        const currentScore = currentRec && Number.isFinite(currentRec.score) ? currentRec.score : null;
        const currentStatus = currentRec?.status || "";

        let newScore = null;
        let newStatus = "";

        if (rawAction === "na") {
          if (currentStatus === "na") {
            newScore = null;
            newStatus = "";
          } else {
            newScore = null;
            newStatus = "na";
          }
        } else {
          const lvl = Number(rawAction);
          if (currentScore === lvl && currentStatus !== "na") {
            newScore = null;
            newStatus = "";
          } else {
            newScore = lvl;
            newStatus = "";
          }
        }

        try {
          // 1. INSTANT OPTIMISTIC UI UPDATE (0ms delay, ZERO layout reflow or frame jerk)
          const cardEl = row.closest(".fives-card");
          if (cardEl) {
            updateCardDOMDirectly(cardEl, newScore, newStatus);
          }

          // 2. Async save to database
          if (typeof context?.setScore === "function") {
            await context.setScore({
              periodId: fiveSPeriodId,
              area: selectedArea,
              item,
              criterion,
              score: newScore,
              status: newStatus,
              scoreSource,
              scoreDate,
            });
          }

          // 3. Update header statistics in-place
          const screen = overlay.querySelector("#mobileScreen5S");
          const stat = calculateArea5SScoreStat(selectedArea, flattenedCriteria, context, fiveSPeriodId, scoreSource, scoreDate);

          const progressValEl = screen?.querySelector("#evaluatedProgressText");
          if (progressValEl) progressValEl.textContent = `${stat.completed} / ${stat.total} Hạng mục`;

          const avgValEl = screen?.querySelector("#overallAvgScoreText");
          if (avgValEl) avgValEl.textContent = `${stat.avgText} / 5.0`;

          const fillBarEl = screen?.querySelector("#scoreProgressBarFill");
          if (fillBarEl) fillBarEl.style.width = `${stat.pct}%`;

        } catch (err) {
          renderFiveSScreen(overlay, context);
          if (err?.offlineDraftSaved) {
            showMobileToast("Mất kết nối: điểm đang lưu tạm trên máy, chưa đồng bộ.", true);
          } else if (err?.scoreConflictPending) {
            showMobileToast("Xung đột dữ liệu: điểm chưa đồng bộ. Kiểm tra trạng thái dữ liệu.", true);
          } else {
            console.error("Lưu điểm 5S trên Mobile thất bại:", err);
            const message = context?.getScoreSaveErrorMessage?.(err)
              || err?.payload?.error
              || err?.message
              || "Không lưu được điểm. Vui lòng thử lại.";
            showMobileToast(message, true);
          }
        }
      });
    });
  }

  // Direct Optimistic DOM Mutation for 5S Category Card (0ms latency, ZERO DOM replacement, ZERO frame jerk)
  function updateCardDOMDirectly(cardEl, newScore, newStatus) {
    if (!cardEl) return;

    // 1. Update Score Badge at top right
    const scoreBadge = cardEl.querySelector(".fives-score-badge");
    if (scoreBadge) {
      if (newStatus === "na") {
        scoreBadge.className = "fives-score-badge text-slate-400 font-semibold";
        scoreBadge.textContent = "Không cần chấm (✕)";
      } else if (newScore !== null && Number.isFinite(newScore)) {
        const lvl = newScore;
        const levelName = LEVEL_NAMES[lvl] || ("Cấp " + lvl);
        let pillColor = lvl <= 2 ? "text-rose-400 font-bold" : (lvl === 3 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold");
        scoreBadge.className = "fives-score-badge " + pillColor;
        scoreBadge.textContent = `Đã chọn: Cấp ${lvl} (${levelName})`;
      } else {
        scoreBadge.className = "fives-score-badge text-slate-400";
        scoreBadge.textContent = "Chưa chấm";
      }
    }

    // 2. Update level rows inside card
    cardEl.querySelectorAll(".fives-level-row").forEach((rowEl) => {
      const actionScore = rowEl.dataset.actionScore;
      const numBadge = rowEl.querySelector(".level-num-badge");
      const titleLine = rowEl.querySelector(".level-title-line");
      const descText = rowEl.querySelector(".level-desc-text");

      const existingTag = titleLine ? titleLine.querySelector(".level-chosen-tag") : null;
      if (existingTag) existingTag.remove();

      if (actionScore === "na") {
        const isNaSelected = newStatus === "na";
        rowEl.className = "fives-level-row level-na-row " + (isNaSelected ? "level-selected-na" : "level-unselected");
        if (numBadge) numBadge.className = "level-num-badge " + (isNaSelected ? "badge-selected-na" : "badge-unselected");
        if (descText) descText.classList.toggle("is-selected-text", isNaSelected);
        if (isNaSelected && titleLine) {
          titleLine.insertAdjacentHTML("beforeend", '<span class="level-chosen-tag tag-na"><i class="fa-solid fa-xmark"></i> Đã gạch chéo</span>');
        }
      } else {
        const lvlNum = Number(actionScore);
        const isLvlSelected = newStatus !== "na" && newScore === lvlNum;
        let boxClass = "level-unselected";
        let badgeClass = "badge-unselected";
        let tagClass = "tag-high";

        if (isLvlSelected) {
          if (lvlNum <= 2) {
            boxClass = "level-selected-low";
            badgeClass = "badge-selected-low";
            tagClass = "tag-low";
          } else if (lvlNum === 3) {
            boxClass = "level-selected-mid";
            badgeClass = "badge-selected-mid";
            tagClass = "tag-mid";
          } else {
            boxClass = "level-selected-high";
            badgeClass = "badge-selected-high";
            tagClass = "tag-high";
          }
        }

        rowEl.className = "fives-level-row " + boxClass;
        if (numBadge) numBadge.className = "level-num-badge " + badgeClass;
        if (descText) descText.classList.toggle("is-selected-text", isLvlSelected);
        if (isLvlSelected && titleLine) {
          titleLine.insertAdjacentHTML("beforeend", `<span class="level-chosen-tag ${tagClass}"><i class="fa-solid fa-circle-check"></i> Đã chọn</span>`);
        }
      }
    });
  }

  // Toast Notification
  function showMobileToast(msg, isError = false) {
    const toast = document.getElementById("mobileToast");
    const toastText = document.getElementById("mobileToastText");
    const toastIcon = toast?.querySelector("i");
    if (!toast || !toastText) {
      const fallbackToast = document.getElementById("toast");
      if (fallbackToast) {
        fallbackToast.textContent = msg;
        fallbackToast.classList.toggle("is-error", Boolean(isError));
        fallbackToast.classList.add("is-visible");
        clearTimeout(fallbackToast.__mobileTimer);
        fallbackToast.__mobileTimer = setTimeout(() => fallbackToast.classList.remove("is-visible"), isError ? 5000 : 3000);
      }
      return;
    }

    toastText.textContent = msg;
    toast.classList.toggle("is-error", Boolean(isError));
    if (toastIcon) {
      toastIcon.className = isError
        ? "fa-solid fa-circle-exclamation text-rose-400"
        : "fa-solid fa-circle-check text-emerald-400";
    }
    toast.classList.add("is-visible");

    clearTimeout(toast.__timer);
    toast.__timer = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, isError ? 5000 : 3000);
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
  window.openMobileIssueEditor = openMobileIssueEditor;
  window.closeMobilePrototype = closeMobilePrototype;
  window.openMobileImageModal = openMobileImageModal;
  window.showMobileToast = showMobileToast;
})();
