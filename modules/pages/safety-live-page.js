/**
 * Safety Live - Màn hình trình chiếu an toàn toàn màn hình cho TV / Kiosk nhà máy
 * Tự động xoay vòng hiển thị các vấn đề an toàn lao động với ảnh minh chứng
 */
(function (root) {
  "use strict";

  const STORAGE_KEY = "legroup_safety_live_settings_v2";

  const DEFAULT_SETTINGS = Object.freeze({
    source: "safety",
    year: "",
    month: "all",
    date: "",
    areaId: "all",
    intervalSeconds: 15,
  });

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const interval = Number(parsed.intervalSeconds);
        return {
          year: parsed.year && parsed.year !== "all" ? String(parsed.year) : "",
          source: ["safety", "fiveS", "all"].includes(parsed.source) ? parsed.source : "safety",
          month: parsed.month || "all",
          date: parsed.date || "",
          areaId: parsed.areaId || "all",
          intervalSeconds: Number.isFinite(interval) && interval > 0 ? Math.round(interval) : 15,
        };
      }
    } catch (_) {}
    return { ...DEFAULT_SETTINGS };
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (_) {}
  }

  function normalizeIssueStatus(status) {
    const value = String(status || "").trim().toLocaleLowerCase("vi").replace(/[\s-]+/g, "_");
    if (["closed", "done", "da_xu_ly", "đã_xử_lý"].includes(value)) return "closed";
    if (["in_progress", "processing", "dang_xu_ly", "đang_xử_lý"].includes(value)) return "in_progress";
    if (["overdue", "qua_han", "quá_hạn"].includes(value)) return "overdue";
    return "open";
  }

  function getStatusPriority(status) {
    switch (normalizeIssueStatus(status)) {
      case "overdue": return 1;
      case "open": return 2;
      case "in_progress": return 3;
      default: return 4;
    }
  }

  function getRankPriority(rank) {
    const r = String(rank || "").trim().toUpperCase();
    if (r === "A") return 1;
    if (r === "B") return 2;
    if (r === "C") return 3;
    return 4;
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function distinctIssueLocation(issue) {
    const location = String(issue?.location || "").trim();
    if (!location) return "";
    const normalize = (value) => String(value || "")
      .trim()
      .toLocaleLowerCase("vi")
      .replace(/^zone\s*/i, "")
      .replace(/\s+/g, " ");
    const locationKey = normalize(location);
    const zoneKeys = [issue?.areaCode, issue?.areaName].map(normalize).filter(Boolean);
    return zoneKeys.includes(locationKey) ? "" : location;
  }

  function formatDisplayDate(isoDate, context) {
    if (!isoDate) return "";
    if (context?.formatDateDisplay) return context.formatDateDisplay(isoDate);
    const parts = String(isoDate).slice(0, 10).split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return String(isoDate);
  }

  function getStop6Label(value, context) {
    if (!value) return "";
    const columns = context?.SAFETY_STOP6_COLUMNS || [
      { value: "1-Kẹp,kẹt", label: "Kẹp, kẹt" },
      { value: "2-Vật nặng", label: "Vật nặng" },
      { value: "3-Xe cộ", label: "Xe cộ" },
      { value: "4-Rơi,ngã", label: "Rơi, ngã" },
      { value: "5-Điện giật", label: "Điện giật" },
      { value: "6-Cháy nổ", label: "Cháy nổ" },
      { value: "7-Loại khác", label: "Loại khác" },
    ];
    const found = columns.find((c) => c.value === value || c.label === value || String(value).startsWith(c.value.split("-")[0]));
    if (found) {
      const name = found.label.charAt(0).toUpperCase() + found.label.slice(1);
      return `STOP 6: ${name}`;
    }
    return `STOP 6: ${value}`;
  }

  function normalizeDate(value) {
    const text = String(value || "").trim();
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
    if (iso) return `${iso[1]}-${String(Number(iso[2])).padStart(2, "0")}-${String(Number(iso[3])).padStart(2, "0")}`;
    const display = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    if (display) return `${display[3]}-${String(Number(display[2])).padStart(2, "0")}-${String(Number(display[1])).padStart(2, "0")}`;
    return "";
  }

  function fiveSFindingRows(context) {
    const sheets = Array.isArray(context?.state?.fiveSFindings) ? context.state.fiveSFindings : [];
    const periods = context?.getPeriodsByType?.(context.FIVE_S_PERIOD_TYPE) || [];
    const result = [];

    for (const sheet of sheets) {
      if (!sheet?.id) continue;
      let period = periods.find((item) => item.id === sheet.periodId) || null;
      if (!period) {
        const date = normalizeDate(sheet.inspectionDate);
        const year = date ? Number(date.slice(0, 4)) : 0;
        const month = date ? Number(date.slice(5, 7)) : 0;
        period = periods.find((item) => Number(item.year) === year && Number(item.month) === month) || null;
      }
      const periodId = period?.id || sheet.periodId || "";
      const areas = context?.getAreasForPeriod?.(periodId) || [];
      const rawArea = String(sheet.areaId || sheet.area || "").replace(/^zone\s*/i, "").split("·")[0].trim();
      const area = areas.find((item) => item.id === sheet.areaId)
        || areas.find((item) => String(item.code || "").trim() === rawArea)
        || areas.find((item) => item.id === rawArea)
        || areas.find((item) => String(item.name || "").trim() === rawArea)
        || null;
      const issueDate = normalizeDate(sheet.inspectionDate);
      const periodYear = Number(period?.year) || (issueDate ? Number(issueDate.slice(0, 4)) : 0);
      const periodMonth = Number(period?.month) || (issueDate ? Number(issueDate.slice(5, 7)) : 0);

      (Array.isArray(sheet.rows) ? sheet.rows : []).forEach((row, rowIndex) => {
        if (!row) return;
        const description = String(row.problem || "").trim();
        const photoDataUrl = String(row.photoDataUrl || "").trim();
        const category = String(row.fiveS || "").trim();
        const hasContent = Boolean(description || photoDataUrl || category || String(row.location || "").trim());
        const isResolved = Boolean(String(row.countermeasure || "").trim()) || Number(row.progress) >= 100;
        if (!hasContent || isResolved) return;

        const areaCode = String(area?.templateCode || area?.code || rawArea || "?").trim();
        if (areaCode === "27") return;
        result.push({
          id: `5s:${sheet.id}:${rowIndex}`,
          sourceType: "fiveS",
          sheet,
          row,
          rowIndex,
          periodId,
          areaId: area?.id || sheet.areaId || "",
          area,
          areaCode,
          areaName: area?.name || "",
          issueDate,
          year: issueDate ? issueDate.slice(0, 4) : periodYear ? String(periodYear) : "",
          month: issueDate ? Number(issueDate.slice(5, 7)) : periodMonth,
          description: description || "Vấn đề 5S",
          category,
          location: String(row.location || "").trim(),
          photoDataUrl,
          photoAnnotations: Array.isArray(row.photoAnnotations) ? row.photoAnnotations : [],
          status: "open",
          statusLabel: "Chưa xử lý",
          rank: "",
          stop6: "",
          department: "",
          pic: "",
          improvementContent: "",
          afterPhotoDataUrl: "",
          countermeasureDate: "",
        });
      });
    }
    return result;
  }

  function getLiveSource(settings = {}) {
    return ["safety", "fiveS", "all"].includes(settings.source) ? settings.source : "safety";
  }

  /**
   * Lấy danh sách các năm, tháng, ngày và zone thực sự có vấn đề an toàn chưa xử lý
   */
  function getAvailableFilterOptions(rawRecords, context, currentSettings = {}) {
    const records = Array.isArray(rawRecords) ? rawRecords : Object.values(rawRecords || {});
    const areasMap = new Map();
    const periodsMap = new Map();

    function getPeriodCached(periodId) {
      if (!periodsMap.has(periodId)) {
        periodsMap.set(periodId, context?.getPeriod ? context.getPeriod(periodId) : null);
      }
      return periodsMap.get(periodId);
    }

    function getAreaCached(periodId, areaId) {
      const key = `${periodId}:${areaId}`;
      if (!areasMap.has(key)) {
        let area = null;
        if (context?.getAreaForPeriod) {
          area = context.getAreaForPeriod(periodId, areaId);
        } else if (context?.getAreasForPeriod) {
          area = (context.getAreasForPeriod(periodId) || []).find((a) => a.id === areaId);
        }
        areasMap.set(key, area);
      }
      return areasMap.get(key);
    }

    // Chỉ lấy các vấn đề chưa xử lý, bỏ qua zone 27.
    const unresolved = [];
    const source = getLiveSource(currentSettings);
    for (const record of source === "fiveS" ? [] : records) {
      if (!record || !record.id) continue;
      const status = normalizeIssueStatus(record.issueStatus);
      if (status === "closed") continue; // KHÔNG hiển thị vấn đề đã xử lý

      const area = getAreaCached(record.periodId, record.areaId);
      const areaCode = String(area?.templateCode || area?.code || "").trim();
      if (areaCode === "27") continue;

      const period = getPeriodCached(record.periodId);
      let issueDate = "";
      if (context?.getSafetyRecordIssueDate) {
        issueDate = context.getSafetyRecordIssueDate(record, period);
      } else {
        issueDate = String(record.issueDate || record.date || record.createdAt || "").slice(0, 10);
      }

      const year = issueDate ? issueDate.slice(0, 4) : period?.year ? String(period.year) : "";
      const month = issueDate ? Number(issueDate.slice(5, 7)) : Number(period?.month) || 0;

      unresolved.push({
        record,
        area,
        areaCode,
        issueDate,
        year,
        month,
        sourceType: "safety",
      });
    }

    if (source === "fiveS" || source === "all") {
      fiveSFindingRows(context).forEach((issue) => unresolved.push(issue));
    }

    // Danh sách năm có vấn đề
    const years = [...new Set(unresolved.map((r) => r.year).filter((y) => /^\d{4}$/.test(y)))].sort((a, b) => b.localeCompare(a));

    // Danh sách tháng có vấn đề (lọc theo năm nếu đang chọn năm)
    const yearFiltered = currentSettings.year && currentSettings.year !== "all"
      ? unresolved.filter((r) => r.year === String(currentSettings.year))
      : unresolved;
    const months = [...new Set(yearFiltered.map((r) => r.month).filter((m) => m >= 1 && m <= 12))].sort((a, b) => b - a);

    // Danh sách ngày có vấn đề (lọc theo năm & tháng nếu đã chọn)
    const monthFiltered = currentSettings.month && currentSettings.month !== "all"
      ? yearFiltered.filter((r) => r.month === Number(currentSettings.month))
      : yearFiltered;

    const dateCounts = new Map();
    const dayCounts = new Map();
    for (const r of monthFiltered) {
      if (r.issueDate) {
        const day = Number(r.issueDate.slice(8, 10));
        if (day >= 1 && day <= 31) {
          dateCounts.set(r.issueDate, (dateCounts.get(r.issueDate) || 0) + 1);
          dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
        }
      }
    }
    const dates = [...dateCounts.keys()].sort((a, b) => b.localeCompare(a)).map((date) => ({
      date,
      day: Number(date.slice(8, 10)),
      count: dateCounts.get(date),
    }));
    const days = [...dayCounts.keys()].sort((a, b) => a - b).map((day) => ({
      day,
      count: dayCounts.get(day),
    }));

    // Danh sách Zone có vấn đề, sắp theo mã tự nhiên (1, 2, ... 18.1, 18.2, 18.10)
    const zoneMap = new Map();
    for (const r of unresolved) {
      const areaId = r.record?.areaId || r.areaId;
      if (!areaId) continue;
      const zoneKey = r.areaCode || areaId;
      if (!zoneMap.has(zoneKey)) {
        zoneMap.set(zoneKey, {
          id: zoneKey,
          code: r.areaCode || "?",
          name: r.area?.name || "",
          areaIds: [],
          count: 0,
        });
      }
      if (!zoneMap.get(zoneKey).areaIds.includes(areaId)) zoneMap.get(zoneKey).areaIds.push(areaId);
      zoneMap.get(zoneKey).count += 1;
    }
    const zones = [...zoneMap.values()].sort((a, b) => {
      if (a.code === "?" || b.code === "?") return a.code === b.code ? 0 : a.code === "?" ? 1 : -1;
      return String(a.code).localeCompare(String(b.code), "vi", { numeric: true, sensitivity: "base" });
    });

    return {
      years,
      months,
      dates,
      days,
      zones,
      unresolvedCount: unresolved.length,
    };
  }

  function filterIssues(rawRecords, filters = {}, context = {}) {
    const records = Array.isArray(rawRecords) ? rawRecords : Object.values(rawRecords || {});
    const yearFilter = filters.year || "all";
    const monthFilter = filters.month || "all";
    const dateFilter = filters.date || "";
    const areaIdFilter = filters.areaId || "all";
    const source = getLiveSource(filters);

    const areasMap = new Map();
    const periodsMap = new Map();

    function getPeriodCached(periodId) {
      if (!periodsMap.has(periodId)) {
        periodsMap.set(periodId, context?.getPeriod ? context.getPeriod(periodId) : null);
      }
      return periodsMap.get(periodId);
    }

    function getAreaCached(periodId, areaId) {
      const key = `${periodId}:${areaId}`;
      if (!areasMap.has(key)) {
        let area = null;
        if (context?.getAreaForPeriod) {
          area = context.getAreaForPeriod(periodId, areaId);
        } else if (context?.getAreasForPeriod) {
          area = (context.getAreasForPeriod(periodId) || []).find((a) => a.id === areaId);
        }
        areasMap.set(key, area);
      }
      return areasMap.get(key);
    }

    const filtered = [];

    for (const record of source === "fiveS" ? [] : records) {
      if (!record || !record.id) continue;

      // 1. TUYỆT ĐỐI KHÔNG hiển thị vấn đề đã xử lý
      const normStatus = normalizeIssueStatus(record.issueStatus);
      if (normStatus === "closed") {
        continue;
      }

      const period = getPeriodCached(record.periodId);
      const area = getAreaCached(record.periodId, record.areaId);

      // Bỏ qua zone ẩn (Zone 27)
      const areaCode = String(area?.templateCode || area?.code || "").trim();
      if (areaCode === "27") continue;

      // Xác định ngày phát hiện
      let issueDate = "";
      if (context?.getSafetyRecordIssueDate) {
        issueDate = context.getSafetyRecordIssueDate(record, period);
      } else {
        issueDate = String(record.issueDate || record.date || record.createdAt || "").slice(0, 10);
      }

      // Hỗ trợ cả giá trị ngày ISO cũ và lựa chọn ngày trong tháng mới.
      if (dateFilter) {
        const dayMatches = /^\d{1,2}$/.test(String(dateFilter))
          ? Number(issueDate.slice(8, 10)) === Number(dateFilter)
          : issueDate === String(dateFilter);
        if (!dayMatches) continue;
      }

      // Lọc theo năm nếu có chọn
      const year = issueDate ? issueDate.slice(0, 4) : period?.year ? String(period.year) : "";
      if (yearFilter !== "all" && year !== String(yearFilter)) {
        continue;
      }

      // Lọc theo tháng nếu có chọn
      const month = issueDate ? Number(issueDate.slice(5, 7)) : Number(period?.month) || 0;
      if (monthFilter !== "all" && month !== Number(monthFilter)) {
        continue;
      }

      // Lọc theo Zone nếu có chọn
      if (areaIdFilter !== "all" && record.areaId !== areaIdFilter && areaCode !== areaIdFilter) {
        continue;
      }

      // Xác định bộ phận
      let department = "";
      if (context?.getSafetyDepartmentForArea && area) {
        department = context.getSafetyDepartmentForArea(area, record.periodId);
      }
      if (!department && area?.departmentName) {
        department = area.departmentName;
      }
      if (!department) {
        department = "Chưa phân bộ phận";
      }

      // Xác định người phụ trách
      const pic = record.actionOwner ||
        (context?.getAreaResponsibleNameForPeriod ? context.getAreaResponsibleNameForPeriod(record.periodId, area) : "") ||
        area?.responsibleName ||
        "Chưa chỉ định";

      // Xác định hạn xử lý / kế hoạch
      const dueDate = record.completionDate || record.countermeasureDate || "";
      const plan = record.actionPlan || "";

      // Mô tả vấn đề
      const description = record.note || record.issueDescription || "Không có mô tả chi tiết";

      // Vị trí
      const location = record.issueLocation || area?.name || "";

      // Rank
      const rank = String(record.issueLevel || "").trim().toUpperCase();

      // STOP 6
      const stop6 = record.issueType || "";

      // Người phát hiện
      const foundBy = record.foundChannel || record.issueFoundBy || record.employeeCode || "";

      filtered.push({
        id: record.id,
        sourceType: "safety",
        record,
        periodId: record.periodId,
        areaId: record.areaId,
        areaCode: areaCode || "?",
        areaName: area?.name || "",
        department,
        issueDate,
        status: normStatus,
        statusLabel: context?.getIssueStatusLabel ? context.getIssueStatusLabel(normStatus) : (normStatus === "overdue" ? "Quá hạn" : normStatus === "in_progress" ? "Đang xử lý" : "Chưa xử lý"),
        pic,
        dueDate,
        plan,
        description,
        location,
        rank,
        rankLabel: rank ? `Rank ${rank}` : "",
        stop6,
        stop6Label: getStop6Label(stop6, context),
        foundBy,
        photoDataUrl: record.photoDataUrl || "",
        photoAnnotations: Array.isArray(record.photoAnnotations) ? record.photoAnnotations : [],
        afterPhotoDataUrl: record.afterPhotoDataUrl || "",
        afterPhotoAnnotations: Array.isArray(record.afterPhotoAnnotations) ? record.afterPhotoAnnotations : [],
        improvementContent: record.improvementContent || "",
        countermeasureDate: record.countermeasureDate || "",
        completedDate: record.completedDate || "",
      });
    }

    if (source === "fiveS" || source === "all") {
      const yearFilter = filters.year || "all";
      const monthFilter = filters.month || "all";
      const dateFilter = filters.date || "";
      const areaIdFilter = filters.areaId || "all";
      for (const issue of fiveSFindingRows(context)) {
        if (dateFilter) {
          const dayMatches = /^\d{1,2}$/.test(String(dateFilter))
            ? Number(issue.issueDate.slice(8, 10)) === Number(dateFilter)
            : issue.issueDate === String(dateFilter);
          if (!dayMatches) continue;
        }
        if (yearFilter !== "all" && issue.year !== String(yearFilter)) continue;
        if (monthFilter !== "all" && issue.month !== Number(monthFilter)) continue;
        if (areaIdFilter !== "all" && issue.areaId !== areaIdFilter && issue.areaCode !== areaIdFilter) continue;
        filtered.push(issue);
      }
    }

    return filtered;
  }

  function sortIssues(issues) {
    const list = [...issues];
    // Sắp xếp ưu tiên: Quá hạn trước -> Chưa xử lý -> Đang xử lý
    // Cùng trạng thái: Rank A -> B -> C -> không rank
    // Cùng rank: Ngày phát hiện mới hơn lên trước
    return list.sort((a, b) => {
      const prioA = getStatusPriority(a.status);
      const prioB = getStatusPriority(b.status);
      if (prioA !== prioB) {
        return prioA - prioB;
      }
      const rankA = getRankPriority(a.rank);
      const rankB = getRankPriority(b.rank);
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      const dateOrder = String(b.issueDate || "").localeCompare(String(a.issueDate || ""));
      if (dateOrder) return dateOrder;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });
  }

  // Quản lý slideshow runtime
  let slideshowInstance = null;

  class SafetyLiveSlideshow {
    constructor(container, context) {
      this.container = container;
      this.context = context;
      this.settings = loadSettings();
      this.issues = [];
      this.currentIndex = 0;
      this.isPaused = false;
      this.currentPhotoView = "before"; // "before" hoặc "after"
      this.elapsedMs = 0;
      this.timerInterval = null;
      this.activeIssueId = "";
      this.isSettingsOpen = false;
      this.tickStepMs = 100;
      this.isFullscreen = false;
      this.mouseIdleTimer = null;
      this.isHoveringControls = false;

      this.boundKeyHandler = this.handleKeyDown.bind(this);
      this.boundFullscreenChange = this.handleFullscreenChange.bind(this);
      this.boundMouseMove = this.handleMouseMove.bind(this);
      this.boundPointerActivity = this.handleMouseMove.bind(this);
    }

    init() {
      this.reloadIssues();
      this.render();
      this.startLoop();

      document.addEventListener("keydown", this.boundKeyHandler);
      document.addEventListener("fullscreenchange", this.boundFullscreenChange);
      document.addEventListener("webkitfullscreenchange", this.boundFullscreenChange);
      this.container.addEventListener("mousemove", this.boundMouseMove);
      this.container.addEventListener("pointermove", this.boundMouseMove);
      this.container.addEventListener("pointerdown", this.boundPointerActivity, { passive: true });
      this.container.addEventListener("touchstart", this.boundPointerActivity, { passive: true });
    }

    destroy() {
      this.stopLoop();
      this.clearMouseIdleTimer();
      document.removeEventListener("keydown", this.boundKeyHandler);
      document.removeEventListener("fullscreenchange", this.boundFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", this.boundFullscreenChange);
      this.container.removeEventListener("mousemove", this.boundMouseMove);
      this.container.removeEventListener("pointermove", this.boundMouseMove);
      this.container.removeEventListener("pointerdown", this.boundPointerActivity);
      this.container.removeEventListener("touchstart", this.boundPointerActivity);
    }

    updateContext(newContext) {
      this.context = newContext;
      const prevActiveId = this.activeIssueId;
      this.reloadIssues();

      // Giữ vị trí vấn đề đang xem nếu vẫn tồn tại trong danh sách
      if (prevActiveId) {
        const foundIdx = this.issues.findIndex((item) => item.id === prevActiveId);
        if (foundIdx >= 0) {
          this.currentIndex = foundIdx;
        } else if (this.currentIndex >= this.issues.length) {
          this.currentIndex = 0;
          this.elapsedMs = 0;
          this.currentPhotoView = "before";
        }
      }

      this.updateSlideContent();
      this.updatePosition();
    }

    reloadIssues() {
      const rawRecords = this.context?.state?.safetyRecords || [];
      this.normalizeSettings(rawRecords);
      const filtered = filterIssues(rawRecords, this.settings, this.context);
      this.issues = sortIssues(filtered);
      if (this.currentIndex >= this.issues.length) {
        this.currentIndex = 0;
      }
      if (this.issues.length > 0 && this.issues[this.currentIndex]) {
        this.activeIssueId = this.issues[this.currentIndex].id;
      } else {
        this.activeIssueId = "";
      }
    }

    normalizeSettings(rawRecords) {
      const before = JSON.stringify(this.settings);
      const allOptions = getAvailableFilterOptions(rawRecords, this.context, this.settings);
      const savedDate = String(this.settings.date || "");
      if (/^\d{4}-\d{2}-\d{2}$/.test(savedDate)) {
        this.settings.date = String(Number(savedDate.slice(8, 10)));
      }
      if (!allOptions.years.includes(String(this.settings.year))) {
        this.settings.year = allOptions.years[0] || "";
        this.settings.month = "all";
        this.settings.date = "";
      }

      const yearOptions = getAvailableFilterOptions(rawRecords, this.context, {
        source: this.settings.source,
        year: this.settings.year,
        month: "all",
      });
      if (this.settings.month !== "all" && !yearOptions.months.includes(Number(this.settings.month))) {
        this.settings.month = "all";
        this.settings.date = "";
      }

      const scopedOptions = getAvailableFilterOptions(rawRecords, this.context, this.settings);
      if (this.settings.date && !scopedOptions.days.some((item) => String(item.day) === String(this.settings.date))) {
        this.settings.date = "";
      }
      if (this.settings.areaId !== "all") {
        const savedZone = allOptions.zones.find((area) => area.id === this.settings.areaId || area.code === this.settings.areaId || area.areaIds?.includes(this.settings.areaId));
        this.settings.areaId = savedZone?.id || "all";
      }
      if (JSON.stringify(this.settings) !== before) saveSettings(this.settings);
    }

    startLoop() {
      this.stopLoop();
      this.timerInterval = setInterval(() => {
        this.tick();
      }, this.tickStepMs);
    }

    stopLoop() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    }

    tick() {
      if (this.isPaused || this.issues.length <= 1) {
        return;
      }

      const totalDurationMs = Math.max(1, (this.settings.intervalSeconds || 15)) * 1000;
      this.elapsedMs += this.tickStepMs;

      // Cập nhật thanh tiến trình
      const pct = Math.min(100, (this.elapsedMs / totalDurationMs) * 100);
      const progressBar = this.container.querySelector("[data-live-progress-fill]");
      if (progressBar) {
        progressBar.style.width = `${pct}%`;
      }

      // Hết thời gian slide -> Chuyển slide tiếp theo
      if (this.elapsedMs >= totalDurationMs) {
        this.nextSlide();
      }
    }

    get currentIssue() {
      if (!this.issues.length) return null;
      return this.issues[this.currentIndex] || this.issues[0];
    }

    nextSlide() {
      if (!this.issues.length) return;
      this.currentIndex = (this.currentIndex + 1) % this.issues.length;
      this.elapsedMs = 0;
      this.currentPhotoView = "before";
      this.activeIssueId = this.currentIssue?.id || "";
      this.updateSlideContent();
      this.updatePosition();
    }

    prevSlide() {
      if (!this.issues.length) return;
      this.currentIndex = (this.currentIndex - 1 + this.issues.length) % this.issues.length;
      this.elapsedMs = 0;
      this.currentPhotoView = "before";
      this.activeIssueId = this.currentIssue?.id || "";
      this.updateSlideContent();
      this.updatePosition();
    }

    togglePlayPause() {
      this.isPaused = !this.isPaused;
      this.updatePlayPauseButton();
    }

    setPhotoView(view) {
      this.currentPhotoView = view;
      this.renderPhotoStage();
    }

    toggleSettings(open) {
      this.isSettingsOpen = typeof open === "boolean" ? open : !this.isSettingsOpen;
      const drawer = this.container.querySelector("[data-live-settings-drawer]");
      if (drawer) {
        drawer.hidden = !this.isSettingsOpen;
        if (this.isSettingsOpen) {
          drawer.classList.add("is-open");
          this.container.classList.remove("controls-hidden");
          this.clearMouseIdleTimer();
          this.populateSettingsForm();
        } else {
          drawer.classList.remove("is-open");
          if (this.isFullscreen) {
            this.resetMouseIdleTimer();
          }
        }
      }
    }

    toggleFullscreen() {
      const el = this.container;
      const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      if (isFs) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        this.setFullscreenState(false);
      } else {
        if (el.requestFullscreen) {
          el.requestFullscreen().catch(() => {});
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        }
        this.setFullscreenState(true);
      }
    }

    setFullscreenState(isFs) {
      this.isFullscreen = isFs;
      this.container.classList.toggle("is-fullscreen", isFs);
      const fsBtn = this.container.querySelector("[data-action='toggle-fullscreen']");
      if (fsBtn) {
        fsBtn.innerHTML = isFs
          ? '<i class="fa-solid fa-compress" aria-hidden="true"></i>'
          : '<i class="fa-solid fa-expand" aria-hidden="true"></i>';
        fsBtn.title = isFs ? "Thu nhỏ" : "Toàn màn hình (F)";
        fsBtn.setAttribute("aria-label", isFs ? "Thu nhỏ" : "Toàn màn hình");
      }

      if (isFs) {
        this.isHoveringControls = false;
        this.container.classList.add("controls-hidden");
        this.resetMouseIdleTimer();
      } else {
        this.clearMouseIdleTimer();
        this.container.classList.remove("controls-hidden");
      }
    }

    handleFullscreenChange() {
      const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      this.setFullscreenState(isFs);
    }

    clearMouseIdleTimer() {
      if (this.mouseIdleTimer) {
        clearTimeout(this.mouseIdleTimer);
        this.mouseIdleTimer = null;
      }
    }

    resetMouseIdleTimer() {
      this.clearMouseIdleTimer();
      if (!this.isFullscreen || this.isSettingsOpen || this.isHoveringControls) {
        return;
      }
      this.mouseIdleTimer = setTimeout(() => {
        if (this.isFullscreen && !this.isSettingsOpen && !this.isHoveringControls) {
          this.container.classList.add("controls-hidden");
        }
      }, 2500);
    }

    handleMouseMove() {
      if (!this.isFullscreen) return;
      this.container.classList.remove("controls-hidden");
      this.resetMouseIdleTimer();
    }

    handleKeyDown(e) {
      if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        return;
      }
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        this.togglePlayPause();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        this.nextSlide();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        this.prevSlide();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        this.toggleFullscreen();
      } else if (e.key === "b" || e.key === "B") {
        this.setPhotoView("before");
      } else if (e.key === "a" || e.key === "A") {
        if (this.currentIssue?.afterPhotoDataUrl) {
          this.setPhotoView("after");
        }
      } else if (e.key === "Escape" && this.isSettingsOpen) {
        this.toggleSettings(false);
      }
    }

    render() {
      this.container.innerHTML = `
        <div class="safety-live-wrapper" data-live-wrapper>
          <!-- HEADER (CHỈ GIỮ SAFETY LIVE VÀ NÚT ĐIỀU KHIỂN) -->
          <header class="safety-live-header" data-live-header>
            <div class="safety-live-header-brand">
              <span class="safety-live-pulse-badge">
                <span class="safety-live-pulse-dot"></span>
                <strong>SAFETY LIVE</strong>
              </span>
            </div>

            <div class="safety-live-header-actions">
              <button class="safety-live-btn safety-live-btn-primary" type="button" data-action="toggle-settings" title="Mở bộ lọc &amp; cài đặt">
                <i class="fa-solid fa-sliders"></i>
                <span>Bộ lọc &amp; Cài đặt</span>
              </button>
              <button class="safety-live-btn safety-live-btn-icon" type="button" data-action="exit-live" title="Về trang chủ">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </div>
          </header>

          <!-- MAIN CONTENT BODY (ẢNH + THÔNG TIN CHÍNH) -->
          <main class="safety-live-main" data-live-main-content>
            ${this.getSlideMainHtml()}
          </main>

          <!-- FOOTER CONTROLS & PROGRESS -->
          <footer class="safety-live-footer" data-live-footer>
            <div class="safety-live-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100">
              <div class="safety-live-progress-fill" data-live-progress-fill style="width: 0%;"></div>
            </div>

            <div class="safety-live-footer-bar">
              <div class="safety-live-controls-left">
                <button class="safety-live-ctrl-btn" type="button" data-action="prev-slide" title="Vấn đề trước (Mũi tên trái)" aria-label="Vấn đề trước">
                  <i class="fa-solid fa-backward-step" aria-hidden="true"></i>
                </button>
                <button class="safety-live-ctrl-btn safety-live-play-btn" type="button" data-action="toggle-play" title="Tạm dừng (Phím Space)" aria-label="Tạm dừng">
                  <i class="fa-solid fa-pause" aria-hidden="true"></i>
                </button>
                <button class="safety-live-ctrl-btn" type="button" data-action="next-slide" title="Vấn đề sau (Mũi tên phải)" aria-label="Vấn đề sau">
                  <i class="fa-solid fa-forward-step" aria-hidden="true"></i>
                </button>
              </div>

              <div class="safety-live-position-indicator" data-live-position>
                ${this.getPositionHtml()}
              </div>

              <div class="safety-live-controls-right">
                <button class="safety-live-ctrl-btn safety-live-fullscreen-btn" type="button" data-action="toggle-fullscreen" title="Toàn màn hình (F)" aria-label="Toàn màn hình">
                  <i class="fa-solid fa-expand" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          </footer>

          <!-- SETTINGS DRAWER MODAL (CHỈ CÒN NĂM, THÁNG, NGÀY, ZONE VÀ THỜI GIAN NHẬP TÙY CHỈNH) -->
          <div class="safety-live-drawer-backdrop" data-live-settings-drawer hidden>
            <div class="safety-live-drawer" role="dialog" aria-modal="true" aria-label="Cài đặt Safety Live">
              <div class="safety-live-drawer-header">
                <h3><i class="fa-solid fa-sliders"></i> Cài đặt &amp; Bộ lọc trình chiếu</h3>
                <button class="safety-live-btn-icon" type="button" data-action="close-settings" title="Đóng">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
              <div class="safety-live-drawer-body" data-live-settings-form>
                <!-- Form controls rendered dynamically -->
              </div>
              <div class="safety-live-drawer-footer">
                <button class="safety-live-btn safety-live-btn-subtle" type="button" data-action="reset-settings">
                  <i class="fa-solid fa-rotate-left"></i> Đặt lại mặc định
                </button>
                <button class="safety-live-btn safety-live-btn-primary" type="button" data-action="apply-settings">
                  <i class="fa-solid fa-check"></i> Áp dụng ngay
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      this.bindEvents();
      this.hydratePhotos();
    }

    bindEvents() {
      const root = this.container;

      // Header actions
      root.querySelector("[data-action='toggle-settings']")?.addEventListener("click", () => this.toggleSettings());
      root.querySelector("[data-action='toggle-fullscreen']")?.addEventListener("click", () => this.toggleFullscreen());
      root.querySelector("[data-action='exit-live']")?.addEventListener("click", () => {
        if (this.context?.setActiveTab) {
          this.context.setActiveTab("home");
        }
      });

      // Footer controls
      root.querySelector("[data-action='prev-slide']")?.addEventListener("click", () => this.prevSlide());
      root.querySelector("[data-action='next-slide']")?.addEventListener("click", () => this.nextSlide());
      root.querySelector("[data-action='toggle-play']")?.addEventListener("click", () => this.togglePlayPause());

      // Drawer actions
      root.querySelector("[data-action='close-settings']")?.addEventListener("click", () => this.toggleSettings(false));
      root.querySelector("[data-action='reset-settings']")?.addEventListener("click", () => this.handleResetSettings());
      root.querySelector("[data-action='apply-settings']")?.addEventListener("click", () => this.handleApplySettings());

      // Hover control tracking for fullscreen auto-hide
      const header = root.querySelector("[data-live-header]");
      const footer = root.querySelector("[data-live-footer]");
      const drawer = root.querySelector("[data-live-settings-drawer]");

      [header, footer, drawer].forEach((el) => {
        if (!el) return;
        el.addEventListener("mouseenter", () => {
          this.isHoveringControls = true;
          this.clearMouseIdleTimer();
          this.container.classList.remove("controls-hidden");
        });
        el.addEventListener("mouseleave", () => {
          this.isHoveringControls = false;
          if (this.isFullscreen) {
            this.resetMouseIdleTimer();
          }
        });
      });

      // Delegate photo switcher tab clicks
      root.addEventListener("click", (e) => {
        const photoTab = e.target.closest("[data-live-photo-tab]");
        if (photoTab) {
          const type = photoTab.dataset.livePhotoTab;
          this.setPhotoView(type);
        }
      });
    }

    getPositionHtml() {
      const total = this.issues.length;
      if (total === 0) return "<span>0 / 0</span>";
      const current = this.currentIndex + 1;
      return `<span class="dot-live">●</span> <strong>${current} / ${total}</strong> <span class="dim">vấn đề</span>`;
    }

    getSlideMainHtml() {
      const issue = this.currentIssue;
      if (!issue) {
        return `
          <div class="safety-live-empty-state">
            <div class="empty-icon"><i class="fa-solid fa-shield-halved"></i></div>
            <h2>Không có vấn đề nào</h2>
            <p>Hiện không có vấn đề AT hoặc 5S chưa xử lý nào phù hợp với bộ lọc đã chọn.</p>
            <div class="empty-actions">
              <button class="safety-live-btn safety-live-btn-primary" type="button" data-action="toggle-settings">
                <i class="fa-solid fa-sliders"></i> Mở bộ lọc &amp; Cài đặt
              </button>
            </div>
          </div>
        `;
      }

      const distinctLocation = distinctIssueLocation(issue);

      if (issue.sourceType === "fiveS") {
        return `
          <div class="safety-live-split-view">
            <section class="safety-live-photo-col" data-live-photo-col>
              ${this.getPhotoStageInnerHtml(issue)}
            </section>
            <section class="safety-live-info-col">
              <div class="safety-live-zone-banner">
                <div class="zone-badge-pill">
                  <i class="fa-solid fa-location-dot"></i>
                  <span>ZONE ${escapeHtml(issue.areaCode)}</span>
                </div>
                <div class="dept-badge-pill"><span>VẤN ĐỀ 5S</span></div>
                ${distinctLocation ? `<div class="location-sub-pill"><i class="fa-regular fa-compass"></i> ${escapeHtml(distinctLocation)}</div>` : ""}
              </div>
              <div class="safety-live-desc-card">
                <div class="desc-card-title">
                  <i class="fa-solid fa-triangle-exclamation"></i>
                  <span>VẤN ĐỀ PHÁT HIỆN</span>
                </div>
                <div class="desc-card-text">${escapeHtml(issue.description)}</div>
              </div>
              <div class="safety-live-meta-grid">
                <div class="meta-item">
                  <span class="meta-label"><i class="fa-regular fa-calendar-days"></i> Ngày phát hiện:</span>
                  <strong class="meta-value">${escapeHtml(formatDisplayDate(issue.issueDate, this.context) || "Chưa có ngày")}</strong>
                </div>
                <div class="meta-item">
                  <span class="meta-label"><i class="fa-solid fa-list-check"></i> Hạng mục:</span>
                  <strong class="meta-value">${escapeHtml(root.FiveSFindingsPage?.findingCategoryLabel?.(issue.category) || issue.category || "Chưa phân loại")}</strong>
                </div>
              </div>
            </section>
          </div>
        `;
      }

      return `
        <div class="safety-live-split-view">
          <!-- CỘT TRÁI: ẢNH MINH CHỨNG LỚN -->
          <section class="safety-live-photo-col" data-live-photo-col>
            ${this.getPhotoStageInnerHtml(issue)}
          </section>

          <!-- CỘT PHẢI: THÔNG TIN CHI TIẾT -->
          <section class="safety-live-info-col">
            <!-- BANNER ZONE & BỘ PHẬN -->
            <div class="safety-live-zone-banner">
              <div class="zone-badge-pill">
                <i class="fa-solid fa-location-dot"></i>
                <span>ZONE ${escapeHtml(issue.areaCode)}</span>
              </div>
              <div class="dept-badge-pill">
                <span>${escapeHtml(issue.department)}</span>
              </div>
              ${distinctLocation ? `<div class="location-sub-pill"><i class="fa-regular fa-compass"></i> ${escapeHtml(distinctLocation)}</div>` : ""}
            </div>

            <!-- NHÃN TRẠNG THÁI, RANK, STOP 6 -->
            <div class="safety-live-badges-row">
              <span class="live-status-badge is-${escapeHtml(issue.status)}">
                <i class="fa-solid ${issue.status === "overdue" ? "fa-circle-exclamation" : issue.status === "in_progress" ? "fa-spinner" : "fa-triangle-exclamation"}"></i>
                ${escapeHtml(issue.statusLabel)}
              </span>

              ${issue.rank ? `
                <span class="live-rank-badge rank-${escapeHtml(issue.rank.toLowerCase())}">
                  <strong>${escapeHtml(issue.rankLabel)}</strong>
                </span>
              ` : ""}

              ${issue.stop6 ? `
                <span class="live-stop6-badge">
                  <i class="fa-solid fa-hand"></i>
                  ${escapeHtml(issue.stop6Label)}
                </span>
              ` : ""}
            </div>

            <!-- MÔ TẢ VẤN ĐỀ -->
            <div class="safety-live-desc-card">
              <div class="desc-card-title">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>VẤN ĐỀ PHÁT HIỆN</span>
              </div>
              <div class="desc-card-text">
                ${escapeHtml(issue.description)}
              </div>
            </div>

            <!-- THÔNG TIN NGƯỜI PHỤ TRÁCH VÀ NGÀY PHÁT HIỆN -->
            <div class="safety-live-meta-grid">
              <div class="meta-item">
                <span class="meta-label"><i class="fa-solid fa-user-gear"></i> Người phụ trách:</span>
                <strong class="meta-value highlight">${escapeHtml(issue.pic)}</strong>
                <span class="meta-sub">${escapeHtml(issue.department)}</span>
              </div>

              <div class="meta-item">
                <span class="meta-label"><i class="fa-regular fa-calendar-days"></i> Ngày phát hiện:</span>
                <strong class="meta-value">${escapeHtml(formatDisplayDate(issue.issueDate, this.context))}</strong>
              </div>
            </div>

            <!-- PHẦN ĐỐI SÁCH KHẮC PHỤC (NẾU CÓ) -->
            ${issue.improvementContent || issue.afterPhotoDataUrl || issue.countermeasureDate ? `
              <div class="safety-live-countermeasure-card">
                <div class="cm-card-title">
                  <i class="fa-solid fa-shield-halved"></i>
                  <span>ĐỐI SÁCH KHẮC PHỤC / CẢI TIẾN</span>
                  ${issue.countermeasureDate ? `<span class="cm-date"><i class="fa-solid fa-calendar-check"></i> ${escapeHtml(formatDisplayDate(issue.countermeasureDate, this.context))}</span>` : ""}
                </div>
                ${issue.improvementContent ? `
                  <div class="cm-card-text">${escapeHtml(issue.improvementContent)}</div>
                ` : ""}
              </div>
            ` : ""}
          </section>
        </div>
      `;
    }

    getPhotoStageInnerHtml(issue) {
      if (!issue) return "";
      const hasAfterPhoto = Boolean(issue.afterPhotoDataUrl);
      const isAfter = this.currentPhotoView === "after" && hasAfterPhoto;
      const photoUrl = isAfter ? issue.afterPhotoDataUrl : issue.photoDataUrl;
      const annotations = isAfter ? issue.afterPhotoAnnotations : issue.photoAnnotations;
      const annotationsJson = JSON.stringify(annotations || []);

      return `
        <div class="safety-live-photo-stage">
          <!-- TAB CHUYỂN ĐỔI ẢNH NẾU CÓ ẢNH SAU XỬ LÝ -->
          ${hasAfterPhoto ? `
            <div class="safety-live-photo-switch-tabs" role="tablist" aria-label="Chuyển đổi ảnh">
              <button class="live-photo-tab ${!isAfter ? "is-active" : ""}" type="button" data-live-photo-tab="before" role="tab" aria-label="Ảnh hiện trường" title="Ảnh hiện trường" aria-selected="${!isAfter}">
                <i class="fa-solid fa-camera" aria-hidden="true"></i>
              </button>
              <button class="live-photo-tab ${isAfter ? "is-active" : ""}" type="button" data-live-photo-tab="after" role="tab" aria-label="Ảnh sau xử lý" title="Ảnh sau xử lý" aria-selected="${isAfter}">
                <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
              </button>
            </div>
          ` : ""}

          <!-- CONTAINER CHỨA ẢNH CHÍNH -->
          <div class="safety-live-photo-box">
            ${photoUrl ? `
              <img
                class="safety-live-img"
                src="${escapeHtml(photoUrl)}"
                alt="${isAfter ? "Ảnh sau xử lý" : "Ảnh hiện trường"}"
                data-safety-annotations="${escapeHtml(annotationsJson)}"
                data-photo-src="${escapeHtml(photoUrl)}"
                loading="eager"
              />
            ` : `
              <div class="safety-live-no-photo">
                <i class="fa-solid fa-image"></i>
                <span>Chưa có ảnh minh chứng</span>
              </div>
            `}
          </div>

        </div>
      `;
    }

    renderPhotoStage() {
      const col = this.container.querySelector("[data-live-photo-col]");
      if (col && this.currentIssue) {
        col.innerHTML = this.getPhotoStageInnerHtml(this.currentIssue);
        this.hydratePhotos();
      }
    }

    updateSlideContent() {
      const main = this.container.querySelector("[data-live-main-content]");
      if (main) {
        main.innerHTML = this.getSlideMainHtml();
        this.hydratePhotos();
      }
    }

    updatePosition() {
      const position = this.container.querySelector("[data-live-position]");
      if (position) {
        position.innerHTML = this.getPositionHtml();
      }
      const progressBar = this.container.querySelector("[data-live-progress-fill]");
      if (progressBar) {
        progressBar.style.width = "0%";
      }
      this.updatePlayPauseButton();
    }

    updatePlayPauseButton() {
      const btn = this.container.querySelector("[data-action='toggle-play']");
      if (btn) {
        btn.innerHTML = this.isPaused
          ? '<i class="fa-solid fa-play" aria-hidden="true"></i>'
          : '<i class="fa-solid fa-pause" aria-hidden="true"></i>';
        btn.title = this.isPaused ? "Tiếp tục (Phím Space)" : "Tạm dừng (Phím Space)";
        btn.setAttribute("aria-label", this.isPaused ? "Tiếp tục" : "Tạm dừng");
      }
    }

    hydratePhotos() {
      if (this.context?.hydrateAuthenticatedPhotos) {
        this.context.hydrateAuthenticatedPhotos(this.container);
      }
      if (typeof window.refreshSafetyPhotoAnnotationThumbnail === "function") {
        this.container.querySelectorAll("img[data-safety-annotations]").forEach((img) => {
          window.refreshSafetyPhotoAnnotationThumbnail(img);
        });
      }
    }

    populateSettingsForm() {
      const form = this.container.querySelector("[data-live-settings-form]");
      if (!form) return;

      const rawRecords = this.context?.state?.safetyRecords || [];
      this.normalizeSettings(rawRecords);
      const filterOptions = getAvailableFilterOptions(rawRecords, this.context, this.settings);

      form.innerHTML = `
        <div class="safety-live-form-grid">
          <div class="safety-live-form-field full-width">
            <label for="live-setting-source">Loại vấn đề trình chiếu:</label>
            <select id="live-setting-source" name="source">
              <option value="safety" ${this.settings.source === "safety" ? "selected" : ""}>Đánh giá AT</option>
              <option value="fiveS" ${this.settings.source === "fiveS" ? "selected" : ""}>Vấn đề 5S</option>
              <option value="all" ${this.settings.source === "all" ? "selected" : ""}>Cả 2</option>
            </select>
          </div>

          <!-- NĂM PHÁT HIỆN (CHỈ HIỂN THỊ NĂM CÓ VẤN ĐỀ) -->
          <div class="safety-live-form-field">
            <label for="live-setting-year">Năm phát hiện:</label>
            <select id="live-setting-year" name="year">
              ${filterOptions.years.map((y) => `
                <option value="${y}" ${String(this.settings.year) === String(y) ? "selected" : ""}>${y}</option>
              `).join("")}
            </select>
          </div>

          <!-- THÁNG PHÁT HIỆN (CHỈ HIỂN THỊ THÁNG CÓ VẤN ĐỀ) -->
          <div class="safety-live-form-field">
            <label for="live-setting-month">Tháng phát hiện:</label>
            <select id="live-setting-month" name="month">
              <option value="all" ${this.settings.month === "all" ? "selected" : ""}>Tất cả tháng</option>
              ${filterOptions.months.map((m) => `
                <option value="${m}" ${Number(this.settings.month) === m ? "selected" : ""}>Tháng ${m}</option>
              `).join("")}
            </select>
          </div>

          <!-- NGÀY PHÁT HIỆN (CHỈ HIỂN THỊ NGÀY CÓ VẤN ĐỀ) -->
          <div class="safety-live-form-field">
            <label for="live-setting-date">Ngày phát hiện:</label>
            <select id="live-setting-date" name="date">
              <option value="" ${!this.settings.date ? "selected" : ""}>Tất cả ngày</option>
              ${filterOptions.days.map((d) => `
                <option value="${d.day}" ${String(this.settings.date) === String(d.day) ? "selected" : ""}>
                  ${d.day}
                </option>
              `).join("")}
            </select>
          </div>

          <!-- LỌC THEO ZONE (CHỈ HIỂN THỊ ZONE CÓ VẤN ĐỀ) -->
          <div class="safety-live-form-field">
            <label for="live-setting-area">Zone:</label>
            <select id="live-setting-area" name="areaId">
              <option value="all" ${this.settings.areaId === "all" ? "selected" : ""}>Tất cả Zone</option>
              ${filterOptions.zones.map((a) => `
                <option value="${a.id}" ${this.settings.areaId === a.id ? "selected" : ""}>
                  Zone ${escapeHtml(a.code)}
                </option>
              `).join("")}
            </select>
          </div>

          <!-- THỜI GIAN MỖI ẢNH (NHẬP TÙY CHỈNH) -->
          <div class="safety-live-form-field full-width">
            <label for="live-setting-interval">Thời gian hiển thị mỗi ảnh (giây):</label>
            <div class="safety-live-custom-interval-wrap">
              <input
                id="live-setting-interval"
                type="number"
                name="intervalSeconds"
                min="1"
                max="3600"
                step="1"
                value="${this.settings.intervalSeconds || 15}"
                placeholder="Nhập số giây, ví dụ: 15"
              />
              <span class="interval-unit-badge">giây / ảnh</span>
            </div>
            <small class="form-hint">Nhập số giây bạn muốn chiếu mỗi vấn đề trước khi tự chuyển tiếp (ví dụ 10, 15, 20, 30...).</small>
          </div>
        </div>
      `;

      // Cập nhật động danh sách tháng & ngày khi người dùng đổi năm hoặc tháng
      const yearSelect = form.querySelector("#live-setting-year");
      const monthSelect = form.querySelector("#live-setting-month");
      const dateSelect = form.querySelector("#live-setting-date");
      const sourceSelect = form.querySelector("#live-setting-source");
      const areaSelect = form.querySelector("#live-setting-area");

      const updateDependentOptions = (yearChanged = false, sourceChanged = false) => {
        const selectedSource = sourceSelect?.value || this.settings.source;
        if (sourceChanged && yearSelect) {
          const sourceOptions = getAvailableFilterOptions(rawRecords, this.context, { source: selectedSource });
          const oldYear = yearSelect.value;
          const year = sourceOptions.years.includes(oldYear) ? oldYear : (sourceOptions.years[0] || "");
          yearSelect.innerHTML = sourceOptions.years.map((y) => `<option value="${y}" ${y === year ? "selected" : ""}>${y}</option>`).join("");
          yearSelect.value = year;
        }
        const selectedYear = yearSelect?.value || "";
        const yearOptions = getAvailableFilterOptions(rawRecords, this.context, {
          source: selectedSource,
          year: selectedYear,
          month: "all",
        });

        if (sourceChanged && areaSelect) {
          const selectedArea = areaSelect.value;
          const matchedZone = yearOptions.zones.find((zone) => zone.id === selectedArea || zone.code === selectedArea || zone.areaIds?.includes(selectedArea));
          const areaValue = matchedZone?.id || "all";
          areaSelect.innerHTML = `<option value="all">Tất cả Zone</option>${yearOptions.zones.map((zone) => `<option value="${escapeHtml(zone.id)}" ${zone.id === areaValue ? "selected" : ""}>Zone ${escapeHtml(zone.code)}</option>`).join("")}`;
          areaSelect.value = areaValue;
        }

        if (monthSelect) {
          let currentMonthVal = yearChanged || sourceChanged ? "all" : (monthSelect.value || "all");
          if (currentMonthVal !== "all" && !yearOptions.months.includes(Number(currentMonthVal))) currentMonthVal = "all";
          monthSelect.innerHTML = `
            <option value="all">Tất cả tháng</option>
            ${yearOptions.months.map((m) => `
              <option value="${m}" ${String(currentMonthVal) === String(m) ? "selected" : ""}>Tháng ${m}</option>
            `).join("")}
          `;
          monthSelect.value = currentMonthVal;
        }

        const currentDateVal = dateSelect?.value || "";
        const freshOptions = getAvailableFilterOptions(rawRecords, this.context, {
          source: selectedSource,
          year: selectedYear,
          month: monthSelect?.value || "all",
        });
        if (dateSelect) {
          const validDate = freshOptions.days.some((item) => String(item.day) === currentDateVal);
          dateSelect.innerHTML = `
            <option value="">Tất cả ngày</option>
            ${freshOptions.days.map((d) => `
              <option value="${d.day}" ${validDate && currentDateVal === String(d.day) ? "selected" : ""}>${d.day}</option>
            `).join("")}
          `;
          dateSelect.value = validDate ? currentDateVal : "";
        }
      };

      yearSelect?.addEventListener("change", () => {
        if (dateSelect) dateSelect.value = "";
        updateDependentOptions(true);
      });
      monthSelect?.addEventListener("change", () => {
        if (dateSelect) dateSelect.value = "";
        updateDependentOptions();
      });
      sourceSelect?.addEventListener("change", () => {
        if (dateSelect) dateSelect.value = "";
        updateDependentOptions(true, true);
      });
    }

    handleApplySettings() {
      const form = this.container.querySelector("[data-live-settings-form]");
      if (!form) return;

      const getVal = (name) => form.querySelector(`[name="${name}"]`)?.value ?? "";

      this.settings.source = getLiveSource({ source: getVal("source") });
      this.settings.year = getVal("year") || "";
      this.settings.month = getVal("month") || "all";
      this.settings.date = getVal("date") || "";
      this.settings.areaId = getVal("areaId") || "all";

      const rawInterval = Number(getVal("intervalSeconds"));
      this.settings.intervalSeconds = Number.isFinite(rawInterval) && rawInterval > 0 ? Math.round(rawInterval) : 15;

      saveSettings(this.settings);
      this.toggleSettings(false);

      this.currentIndex = 0;
      this.elapsedMs = 0;
      this.currentPhotoView = "before";
      this.reloadIssues();
      this.updateSlideContent();
      this.updatePosition();
    }

    handleResetSettings() {
      this.settings = { ...DEFAULT_SETTINGS };
      saveSettings(this.settings);
      this.populateSettingsForm();
    }
  }

  function mount(container, context) {
    if (!container) return;

    // Safety Live là màn hình trình chiếu chỉ đọc dành cho tài khoản đã đăng nhập.
    if (!context?.currentUser) {
      container.innerHTML = `
        <div class="safety-live-forbidden">
          <i class="fa-solid fa-lock"></i>
          <h3>Cần đăng nhập để xem Safety Live</h3>
          <p>Màn hình Safety Live trình chiếu các vấn đề an toàn chưa xử lý.</p>
        </div>
      `;
      return;
    }

    if (!slideshowInstance || slideshowInstance.container !== container) {
      if (slideshowInstance) {
        slideshowInstance.destroy();
      }
      slideshowInstance = new SafetyLiveSlideshow(container, context);
      slideshowInstance.init();
    } else {
      slideshowInstance.updateContext(context);
    }
  }

  function render(context) {
    const container = document.getElementById("tab-safety-live");
    if (container) {
      mount(container, context);
    }
  }

  // Đăng ký trang vào PageRegistry
  if (typeof window === "object" && window.PageRegistry) {
    window.PageRegistry.register({
      id: "safety-live",
      title: "Safety Live",
      render,
    });
  }

  // Export cho Node.js testing và global scope
  const api = {
    DEFAULT_SETTINGS,
    normalizeIssueStatus,
    getStatusPriority,
    getRankPriority,
    getAvailableFilterOptions,
    filterIssues,
    sortIssues,
    mount,
    render,
  };

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.SafetyLive = api;
  }
})(typeof window === "object" ? window : globalThis);
