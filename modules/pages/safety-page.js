(() => {
  "use strict";

  const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
  const DEPARTMENT_COLORS = [
    "#4f81bd", "#c0504d", "#9bbb59", "#8064a2", "#4bacc6", "#f79646",
    "#1f4e79", "#00b050", "#7030a0", "#7f6000", "#c00000", "#0070c0",
  ];
  const TAB_COLORS = [
    "#c00000", "#ffc000", "#92d050", "#31859b", "#00b050", "#0070c0",
    "#1f4e79", "#e46c0a", "#963634", "#948a54", "#953735", "#7030a0",
  ];
  const RANK_COLUMNS = [
    { value: "", label: "Nhà máy" },
    { value: "A", label: "Rank A" },
    { value: "B", label: "Rank B" },
    { value: "C", label: "Rank C" },
  ];
  const RANK_COLORS = ["#4f81bd", "#c0504d", "#9bbb59", "#8064a2"];
  const STOP6_COLORS = ["#4f81bd", "#c0504d", "#9bbb59", "#8064a2", "#4bacc6", "#f79646", "#1f4e79"];
  const HIDDEN_SAFETY_ZONE_CODES = new Set(["27"]);
  const COUNTERMEASURE_STATUS_VALUES = new Set(["closed", "in_progress"]);
  const SAFETY_REPORT_HIDDEN_CLASS = "safety-report-hidden";
  const SAFETY_DETAIL_PAGE_SIZE = 30;
  const safetyPagination = {
    assessment: { key: "", page: 1 },
    factory: { key: "", page: 1 },
  };
  let activeFactoryTab = "overview";
  let activeDepartmentChartView = "stacked";

  function clampPage(value, totalPages) {
    const page = Number(value);
    if (!Number.isFinite(page)) return 1;
    return Math.min(Math.max(1, Math.trunc(page)), Math.max(1, totalPages));
  }

  function getPaginationState(type, key, totalRows) {
    const state = safetyPagination[type] || safetyPagination.assessment;
    const totalPages = Math.max(1, Math.ceil(totalRows / SAFETY_DETAIL_PAGE_SIZE));
    if (state.key !== key) {
      state.key = key;
      state.page = 1;
    }
    state.page = clampPage(state.page, totalPages);
    const startIndex = (state.page - 1) * SAFETY_DETAIL_PAGE_SIZE;
    return {
      page: state.page,
      totalPages,
      startIndex,
      endIndex: Math.min(startIndex + SAFETY_DETAIL_PAGE_SIZE, totalRows),
    };
  }

  function setSafetyPage(type, page) {
    const state = safetyPagination[type] || null;
    if (!state) return;
    state.page = Math.max(1, Math.trunc(Number(page) || 1));
  }

  function renderSafetyPager(type, pagination, totalRows, context) {
    if (totalRows <= SAFETY_DETAIL_PAGE_SIZE) {
      return "";
    }
    const { escapeHtml } = context;
    const start = pagination.startIndex + 1;
    const end = pagination.endIndex;
    return '<div class="safety-table-pager" data-safety-pager="' + escapeHtml(type) + '">' +
      '<button class="tiny-button" type="button" data-action="set-safety-detail-page" data-page-type="' + escapeHtml(type) + '" data-page="' + escapeHtml(String(pagination.page - 1)) + '" ' + (pagination.page <= 1 ? "disabled" : "") + '>Trước</button>' +
      '<span>Hiển thị ' + escapeHtml(start) + '-' + escapeHtml(end) + ' / ' + escapeHtml(totalRows) + ' vấn đề · Trang ' + escapeHtml(pagination.page) + '/' + escapeHtml(pagination.totalPages) + '</span>' +
      '<button class="tiny-button" type="button" data-action="set-safety-detail-page" data-page-type="' + escapeHtml(type) + '" data-page="' + escapeHtml(String(pagination.page + 1)) + '" ' + (pagination.page >= pagination.totalPages ? "disabled" : "") + '>Sau</button>' +
    '</div>';
  }

  function issueWeight(row, context) {
    const value = Number(context.getIssueCount(row));
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function sumIssueCounts(rows, context) {
    return rows.reduce((sum, row) => sum + issueWeight(row, context), 0);
  }

  function monthOf(row, context) {
    const value = Number(context.getIssueMonth(row, row.score.periodId));
    return Number.isInteger(value) && value >= 1 && value <= 12 ? value : 0;
  }

  function safetyAreaCode(area) {
    return String(area?.templateCode || area?.code || "").trim();
  }

  function isReportableSafetyArea(area) {
    return !HIDDEN_SAFETY_ZONE_CODES.has(safetyAreaCode(area));
  }

  function issueStatusOf(row, context) {
    return context.normalizeIssueStatus?.(row?.score?.issueStatus) || "open";
  }

  function hasCountermeasure(row, context) {
    return COUNTERMEASURE_STATUS_VALUES.has(issueStatusOf(row, context));
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) {
      return "0%";
    }
    return `${Math.round(value * 100)}%`;
  }

  function numberCell(value) {
    return value ? String(value) : "";
  }

  function countCell(value) {
    return Number(value || 0).toLocaleString("vi-VN");
  }

  function chartY(value, max, top, plotHeight) {
    return top + plotHeight - (Number(value || 0) / Math.max(1, max)) * plotHeight;
  }

  function getSafetyReportDefinition(reportId, context) {
    const reports = context.SAFETY_REPORT_OPTIONS || [];
    return reports.find((report) => report.id === reportId) || null;
  }

  function canViewSafetySummaryReports(context) {
    return Boolean(context.currentUser);
  }

  function getAllowedSafetyReports(context) {
    const reports = context.SAFETY_REPORT_OPTIONS || [];
    if (canViewSafetySummaryReports(context)) {
      return reports;
    }

    return reports.filter((report) => report.id === "assessment");
  }

  function normalizeSafetyReportForUser(reportId, context) {
    if (!reportId) {
      return "";
    }

    const allowedReports = getAllowedSafetyReports(context);
    return allowedReports.some((report) => report.id === reportId) ? reportId : allowedReports[0]?.id || "";
  }

  function safeDomId(value) {
    return String(value || "report").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "report";
  }

  function copyableReportBlock(idSeed, html, label, context) {
    const targetId = "copy-" + safeDomId(idSeed);
    const escapeHtml = context.escapeHtml;
    const isTable = /<table/i.test(html);
    const isChart = /<svg/i.test(html);
    const isDashboardTable = /factory-summary-table|factory-progress-table|rank-summary-table|stop6-summary-table|department-zone-summary-table/i.test(html);
    const copyFormat = isChart ? "image" : "html";
    const className = ["copyable-report-block", isTable ? "is-copy-table" : "", isChart ? "is-copy-chart" : "", isDashboardTable ? "is-dashboard-table" : ""].filter(Boolean).join(" ");
    return '<div class="' + escapeHtml(className) + '" data-copy-format="' + escapeHtml(copyFormat) + '">' +
      '<div class="copy-toolbar" data-copy-hidden="true"><button class="tiny-button copy-report-button" type="button" data-action="copy-report-target" data-copy-format="' + escapeHtml(copyFormat) + '" data-copy-target="' + escapeHtml(targetId) + '">' + escapeHtml("Copy") + '</button></div>' +
      '<div class="copyable-report-content" id="' + escapeHtml(targetId) + '" data-copy-format="' + escapeHtml(copyFormat) + '">' + html + '</div>' +
      '</div>';
  }

  function setFieldVisible(element, visible) {
    const wrapper = element?.closest?.("label");
    if (wrapper) {
      wrapper.hidden = !visible;
    }
  }

  function setButtonVisible(button, visible, context) {
    if (!button) {
      return;
    }

    const adminAllowed = !button.classList.contains("admin-only") || context.isAdminAccount(context.currentUser);
    const safetyAllowed = !button.classList.contains("safety-access-only") || context.canUseSafety(context.currentUser);
    button.classList.toggle(SAFETY_REPORT_HIDDEN_CLASS, !visible);
    button.hidden = !visible || !adminAllowed || !safetyAllowed;
  }

  function setSafetyToolbarMode(reportId, context) {
    const { elements } = context;
    const toolbar = elements.safetyPeriodSelect?.closest?.(".safety-toolbar");
    if (toolbar) {
      toolbar.hidden = !reportId;
    }

    const isAssessment = reportId === "assessment";
    const isIdentification = reportId === "identification";
    const isFactory = reportId === "factory";
    setFieldVisible(elements.safetyPeriodSelect, isAssessment);
    setFieldVisible(elements.safetyYearFilter, Boolean(reportId));
    setFieldVisible(elements.safetyMonthFilter, isAssessment || isIdentification);
    setFieldVisible(elements.safetyAreaFilter, isAssessment);
    setFieldVisible(elements.safetyDepartmentFilter, false);

    const isAdmin = Boolean(context.isAdminAccount?.(context.currentUser));
    setButtonVisible(elements.addSafetyRecordButton, isAssessment, context);
    setButtonVisible(elements.editSafetyMetaButton, isAssessment && isAdmin, context);
    setButtonVisible(elements.sendSafetyMailButton, isAssessment && isAdmin, context);
    const canShowExport = Boolean(reportId) && (isAdmin || isIdentification || isFactory);
    if (elements.exportSafetyExcelButton) {
      elements.exportSafetyExcelButton.classList.toggle("admin-only", !(isIdentification || isFactory));
    }
    setButtonVisible(elements.exportSafetyExcelButton, canShowExport, context);
    const safetyToolbar = elements.safetyPeriodSelect?.closest?.(".safety-toolbar");
    if (safetyToolbar) {
      safetyToolbar.querySelectorAll('[data-action="import-page-json"], [data-action="export-page-json"]').forEach((btn) => {
        btn.classList.toggle(SAFETY_REPORT_HIDDEN_CLASS, !isAssessment);
        btn.hidden = !isAssessment || !isAdmin;
      });
    }
    if (elements.exportSafetyExcelButton) {
      const escape = context.escapeHtml || ((str) => str);
      const label = isFactory
        ? "Xuất tổng hợp nguy cơ"
        : isIdentification
          ? "Xuất tổng hợp nhận diện"
          : "Xuất ĐG AT";
      elements.exportSafetyExcelButton.innerHTML = `<i class="fa-solid fa-file-excel"></i> <span>${escape(label)}</span>`;
    }
  }

  function syncSafetyFilters(context, period) {
    const { elements, escapeHtml, getSafetyFilterMonths, getSafetyFilterYears, isAdminAccount, currentUser } = context;
    const isAdmin = Boolean(isAdminAccount?.(currentUser));
    const usesAdminViewScope = context.activeSafetyReport === "assessment" || context.activeSafetyReport === "identification" || context.activeSafetyReport === "factory";
    const areaId = context.activeSafetyReport === "assessment" ? elements.safetyAreaFilter?.value || "" : "";
    const openYear = Number(period?.year) || new Date().getFullYear();
    const openMonth = Number(period?.month) || new Date().getMonth() + 1;

    let years = typeof getSafetyFilterYears === "function" ? getSafetyFilterYears({ areaId }) : [];
    if (!isAdmin && !usesAdminViewScope) {
      years = [openYear];
    }

    let selectedYear = Number(elements.safetyYearFilter?.value) || openYear;
    if (!years.includes(selectedYear)) {
      selectedYear = openYear;
    }
    const months = years.length && typeof getSafetyFilterMonths === "function"
      ? getSafetyFilterMonths(selectedYear, { areaId })
      : [];
    let selectedMonth = Number(elements.safetyMonthFilter?.value) || openMonth;
    if (!isAdmin && !usesAdminViewScope) {
      selectedMonth = openMonth;
    } else if (!months.includes(selectedMonth)) {
      selectedMonth = months.includes(openMonth) ? openMonth : months[0] || openMonth;
    }

    if (elements.safetyYearFilter) {
      elements.safetyYearFilter.innerHTML = years.length
        ? years
          .map((year) => `<option value="${escapeHtml(year)}" ${year === selectedYear ? "selected" : ""}>${escapeHtml(year)}</option>`)
          .join("")
        : '<option value="">Chưa có dữ liệu</option>';
      elements.safetyYearFilter.value = years.length ? String(selectedYear) : "";
    }

    if (elements.safetyMonthFilter) {
      const visibleMonths = !isAdmin && !usesAdminViewScope ? [openMonth] : months;
      elements.safetyMonthFilter.innerHTML = visibleMonths.length
        ? visibleMonths
          .map((month) => `<option value="${month}" ${month === selectedMonth ? "selected" : ""}>Tháng ${month}</option>`)
          .join("")
        : '<option value="">Chưa có dữ liệu</option>';
      elements.safetyMonthFilter.value = visibleMonths.length ? String(selectedMonth) : "";
    }

    return { year: selectedYear, month: selectedMonth };
  }

  function getVisibleAreaIds(context, periodId) {
    const { currentUser, getAllowedAreaIds, getAreasForPeriod, isAdminAccount } = context;
    if (isAdminAccount(currentUser)) {
      return new Set(getAreasForPeriod(periodId).map((area) => area.id));
    }
    return getAllowedAreaIds(currentUser, periodId);
  }

  function getAllReportableAreas(context, periodId, areaFilter = "") {
    return context.getAreasForPeriod(periodId).filter((area) => isReportableSafetyArea(area) && (!areaFilter || area.id === areaFilter));
  }

  function getVisibleAreas(context, periodId, areaFilter = "") {
    const areaIds = getVisibleAreaIds(context, periodId);
    return getAllReportableAreas(context, periodId, areaFilter).filter((area) => areaIds.has(area.id));
  }

  function getAllDepartmentGroups(context, periodId, areaFilter = "") {
    return context.getSafetyDepartmentGroups(periodId)
      .map((group) => ({
        ...group,
        areas: group.areas.filter((area) => isReportableSafetyArea(area) && (!areaFilter || area.id === areaFilter)),
      }))
      .filter((group) => group.areas.length);
  }

  function getVisibleDepartmentGroups(context, periodId, areaFilter = "") {
    const visibleAreaIds = getVisibleAreaIds(context, periodId);
    return getAllDepartmentGroups(context, periodId, areaFilter)
      .map((group) => ({
        ...group,
        areas: group.areas.filter((area) => visibleAreaIds.has(area.id)),
      }))
      .filter((group) => group.areas.length);
  }


  function syncDepartmentFilter(context, groups, year) {
    const { elements, escapeHtml } = context;
    const current = elements.safetyDepartmentFilter?.value || "";
    const selected = !current || groups.some((group) => group.name === current) ? current : "";
    const summaryLabel = "Tổng hợp " + (year || new Date().getFullYear());

    if (elements.safetyDepartmentFilter) {
      elements.safetyDepartmentFilter.innerHTML = '<option value="" ' + (!selected ? "selected" : "") + '>' + escapeHtml(summaryLabel) + '</option>' + (groups.length
        ? groups.map((group) => '<option value="' + escapeHtml(group.name) + '" ' + (group.name === selected ? "selected" : "") + '>' + escapeHtml(group.name) + '</option>').join("")
        : "");
      elements.safetyDepartmentFilter.value = selected;
    }

    return selected;
  }

  function getMonthPeriod(context, year, month, fallbackPeriod) {
    const { SAFETY_PERIOD_TYPE, getPeriodsByType } = context;
    return getPeriodsByType(SAFETY_PERIOD_TYPE)
      .find((period) => Number(period.year) === Number(year) && Number(period.month) === Number(month))
      || fallbackPeriod
      || { id: "", type: SAFETY_PERIOD_TYPE, year, month, label: `Tháng ${month}/${year}` };
  }

  function filterRowsByMonth(rows, month, context) {
    return rows.filter((row) => monthOf(row, context) === Number(month));
  }

  function ownerGroupsFromStats(stats) {
    const groups = [];
    stats.forEach((stat) => {
      const label = stat.owner || "-";
      const current = groups[groups.length - 1];
      if (current && current.label === label) {
        current.stats.push(stat);
      } else {
        groups.push({ label, stats: [stat] });
      }
    });
    return groups;
  }


  function buildZoneStats(rows, areas, periodId, context) {
    const { SAFETY_STOP6_COLUMNS, getAreaResponsibleNameForPeriod, getSafetyDepartmentForArea, getSafetyZoneTarget } = context;
    const statusColumns = context.ISSUE_STATUS_OPTIONS || [];
    return areas.filter(isReportableSafetyArea).map((area) => {
      const areaRows = rows.filter((row) => row.area.id === area.id);
      const stop6Counts = new Map(SAFETY_STOP6_COLUMNS.map((column) => [column.value, 0]));
      const statusCounts = Object.fromEntries(statusColumns.map((column) => [column.value, 0]));
      areaRows.forEach((row) => {
        const key = row.score.issueType || "";
        const weight = issueWeight(row, context);
        stop6Counts.set(key, (stop6Counts.get(key) || 0) + weight);
        const status = issueStatusOf(row, context);
        statusCounts[status] = (statusCounts[status] || 0) + weight;
      });
      const total = sumIssueCounts(areaRows, context);
      const countermeasure = sumIssueCounts(areaRows.filter((row) => hasCountermeasure(row, context)), context);
      return {
        area,
        code: area.code,
        owner: area.departmentHead || "Chưa có",
        responsible: getAreaResponsibleNameForPeriod(periodId, area) || area.scorerName || "-",
        department: getSafetyDepartmentForArea(area, periodId),
        target: Number(getSafetyZoneTarget(area)) || 0,
        total,
        closed: Number(statusCounts.closed || 0),
        countermeasure,
        open: Number(statusCounts.open || 0),
        statusCounts,
        stop6Counts,
      };
    });
  }

  function splitTextToTwoLines(text, maxCharsPerLine = 12) {
    const raw = String(text || "").trim();
    if (!raw) return { line1: "", line2: "" };
    if (raw.length <= maxCharsPerLine || !raw.includes(" ")) {
      return { line1: raw, line2: "" };
    }
    const words = raw.split(" ");
    let line1 = "";
    let line2 = "";
    const targetHalf = Math.ceil(raw.length / 2);
    for (const w of words) {
      if (!line1 || (line1.length + w.length + 1 <= targetHalf + 2 && !line2)) {
        line1 = line1 ? `${line1} ${w}` : w;
      } else {
        line2 = line2 ? `${line2} ${w}` : w;
      }
    }
    return { line1: line1 || raw, line2 };
  }

  function renderZoneGoalChart(stats, month, year, context) {
    const { escapeHtml } = context;
    if (!stats.length) {
      return '<div class="excel-empty-chart">Chưa có zone để dựng biểu đồ.</div>';
    }
    const left = 48;
    const top = 32;
    const plotHeight = 180;
    const bottom = 84;
    const minPlotWidth = 1200;
    const step = stats.length > 0 ? Math.max(96, Math.floor(minPlotWidth / stats.length)) : 96;
    const plotWidth = stats.length * step;
    const width = left + plotWidth + 36;
    const height = top + plotHeight + bottom;
    const max = Math.max(10, ...stats.flatMap((stat) => [stat.target, stat.total, stat.countermeasure || stat.closed || 0]));
    const gridValues = Array.from({ length: 6 }, (_, index) => Math.round((max / 5) * index));
    const linePoints = stats.map((stat, index) => {
      const x = left + index * step + step / 2;
      const y = chartY(stat.target, max, top, plotHeight);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    const grid = gridValues.map((value) => {
      const y = chartY(value, max, top, plotHeight);
      return `<g><line x1="${left}" y1="${y}" x2="${left + plotWidth}" y2="${y}" class="excel-grid-line"></line><text x="10" y="${y + 4}" class="excel-axis-label">${escapeHtml(value)}</text></g>`;
    }).join("");

    const barWidth = 14;
    const bars = stats.map((stat, index) => {
      const x = left + index * step + step / 2;
      const actualHeight = stat.total ? Math.max(4, (stat.total / max) * plotHeight) : 0;
      const closedHeight = stat.countermeasure ? Math.max(4, (stat.countermeasure / max) * plotHeight) : 0;
      const actualY = top + plotHeight - actualHeight;
      const closedY = top + plotHeight - closedHeight;
      const targetY = chartY(stat.target, max, top, plotHeight);
      const topY = Math.min(actualHeight > 0 ? actualY : targetY, closedHeight > 0 ? closedY : targetY, targetY);

      // Zone label
      const zoneCode = String(stat.code || "").trim();
      const zoneFullName = zoneCode.toLowerCase().startsWith("zone") ? zoneCode : `Zone ${zoneCode}`;
      const zoneLines = splitTextToTwoLines(zoneFullName, 13);
      const zoneLabelSvg = zoneLines.line2
        ? `<text x="${x.toFixed(1)}" y="${top + plotHeight + 20}" class="excel-zone-label"><tspan x="${x.toFixed(1)}" dy="0">${escapeHtml(zoneLines.line1)}</tspan><tspan x="${x.toFixed(1)}" dy="12">${escapeHtml(zoneLines.line2)}</tspan></text>`
        : `<text x="${x.toFixed(1)}" y="${top + plotHeight + 24}" class="excel-zone-label">${escapeHtml(zoneLines.line1)}</text>`;

      // Responsible / Owner label
      const ownerText = String(stat.responsible || "").trim() || "-";
      const ownerLines = splitTextToTwoLines(ownerText, 11);
      const ownerLabelSvg = ownerLines.line2
        ? `<text x="${x.toFixed(1)}" y="${top + plotHeight + 52}" class="excel-owner-label"><tspan x="${x.toFixed(1)}" dy="0">${escapeHtml(ownerLines.line1)}</tspan><tspan x="${x.toFixed(1)}" dy="11">${escapeHtml(ownerLines.line2)}</tspan></text>`
        : `<text x="${x.toFixed(1)}" y="${top + plotHeight + 56}" class="excel-owner-label">${escapeHtml(ownerLines.line1)}</text>`;

      return `<g>
        <line x1="${x.toFixed(1)}" y1="${top + plotHeight}" x2="${x.toFixed(1)}" y2="${top + plotHeight + 5}" stroke="#cbd5e1" stroke-width="1"></line>
        <rect x="${(x - barWidth - 2).toFixed(1)}" y="${actualY.toFixed(1)}" width="${barWidth}" height="${actualHeight.toFixed(1)}" rx="2" class="zone-bar-open"><title>Zone ${escapeHtml(stat.code)}: ${escapeHtml(stat.total)} vấn đề</title></rect>
        <rect x="${(x + 2).toFixed(1)}" y="${closedY.toFixed(1)}" width="${barWidth}" height="${closedHeight.toFixed(1)}" rx="2" class="zone-bar-closed"><title>Zone ${escapeHtml(stat.code)}: ${escapeHtml(stat.countermeasure || 0)} đối sách triển khai</title></rect>
        <circle cx="${x.toFixed(1)}" cy="${targetY.toFixed(1)}" r="3.2" class="zone-target-dot"></circle>
        ${stat.total ? `<text x="${x.toFixed(1)}" y="${(topY - 6).toFixed(1)}" class="excel-bar-label">${escapeHtml(stat.total)}</text>` : ""}
        ${zoneLabelSvg}
        ${ownerLabelSvg}
      </g>`;
    }).join("");

    return `<div class="excel-chart-panel zone-target-panel">
      <h3>MỤC TIÊU VÀ SỐ VẤN ĐỀ PHÁT HIỆN GIẢI QUYẾT THÁNG ${escapeHtml(month)}/${escapeHtml(year)}</h3>
      <div class="excel-chart-scroll" data-drag-scroll>
        <svg class="excel-zone-chart" style="min-width: ${width}px; width: 100%; height: auto;" viewBox="0 0 ${width} ${height}" role="img" aria-label="Mục tiêu và số vấn đề theo zone">
          ${grid}
          ${bars}
          <polyline points="${linePoints}" class="zone-target-line"></polyline>
        </svg>
      </div>
      <div class="excel-chart-legend">
        <span><i class="legend-open"></i>Chưa xử lý</span>
        <span><i class="legend-closed"></i>Đối sách triển khai</span>
        <span><i class="legend-target"></i>Tổng số công người (MỤC TIÊU/THÁNG)</span>
      </div>
    </div>`;
  }


  function renderIdentificationTable(stats, monthRows, month, year, periodId, context) {
    const { SAFETY_STOP6_COLUMNS, escapeHtml, isSafetyFoundSelected, normalizeIssueStatus } = context;
    if (!stats.length) {
      return '<div class="empty-cell">Chưa có zone để tổng hợp.</div>';
    }

    const canEditTargets = context.isAdminAccount?.(context.currentUser);
    const ownerHeaders = ownerGroupsFromStats(stats).map((group) => {
      const label = group.label || "Chưa có";
      if (!canEditTargets) {
        return '<th colspan="' + group.stats.length + '">' + escapeHtml(label) + '</th>';
      }

      const areaIds = group.stats.map((stat) => stat.area.id).join(",");
      return '<th class="risk-editable-head" colspan="' + group.stats.length + '">' +
        '<button type="button" data-action="edit-safety-risk-owner" data-id="' + escapeHtml(label) + '" data-period-id="' + escapeHtml(periodId || "") + '" data-area-ids="' + escapeHtml(areaIds) + '" title="Sửa trưởng đơn vị / trưởng phòng">' + escapeHtml(label) + '</button>' +
      '</th>';
    }).join("");
    const targetTotal = stats.reduce((sum, stat) => sum + stat.target, 0);
    const totalActual = stats.reduce((sum, stat) => sum + stat.total, 0);
    const rankRows = [
      { value: "A", label: "Rank A" },
      { value: "B", label: "Rank B" },
    ];
    const workerRows = monthRows.filter((row) => isSafetyFoundSelected(row.score, "worker"));
    const departmentHeadRows = monthRows.filter((row) => isSafetyFoundSelected(row.score, "department-head"));
    const assessorRows = monthRows.filter((row) => isSafetyFoundSelected(row.score, "assessor"));
    const updateText = "Update Ngày: " + new Date().toLocaleDateString("vi-VN");

    function renderHeaderActionCell(label, action, area, title) {
      if (!canEditTargets) {
        return '<th>' + escapeHtml(label) + '</th>';
      }

      return '<th class="risk-editable-head">' +
        '<button type="button" data-action="' + escapeHtml(action) + '" data-id="' + escapeHtml(area.id) + '" data-period-id="' + escapeHtml(periodId || "") + '" title="' + escapeHtml(title) + '">' + escapeHtml(label) + '</button>' +
      '</th>';
    }

    function renderTargetCell(stat) {
      const value = Number(stat.target) || 0;
      if (!canEditTargets) {
        return '<th>' + escapeHtml(value || "") + '</th>';
      }

      return '<th class="risk-target-edit-cell"><input class="risk-target-input" type="number" min="0" step="1" value="' + escapeHtml(value || "") + '" placeholder="0" aria-label="Mục tiêu tháng Zone ' + escapeHtml(stat.code) + '" data-safety-target-input data-period-id="' + escapeHtml(periodId || "") + '" data-area-id="' + escapeHtml(stat.area.id) + '"></th>';
    }

    function rowsForStat(rows, stat) {
      return rows.filter((row) => row.area.id === stat.area.id);
    }

    function countRows(rows, predicate = null) {
      return sumIssueCounts(predicate ? rows.filter(predicate) : rows, context);
    }

    function renderCountCells(rows, predicate = null) {
      return stats.map((stat) => '<td>' + countCell(countRows(rowsForStat(rows, stat), predicate)) + '</td>').join("");
    }

    function renderTotalRow(label, rows, css, predicate = null) {
      return '<tr class="' + css + '"><th colspan="3">' + escapeHtml(label) + '</th>' + renderCountCells(rows, predicate) + '<td><strong>' + countCell(countRows(rows, predicate)) + '</strong></td></tr>';
    }

    function levelPredicate(level) {
      return (row) => String(row.score.issueLevel || "").toUpperCase() === level;
    }

    function renderRankRows(label, rows, css) {
      return rankRows.map((option, rowIndex) => '<tr class="' + css + '">' +
        (rowIndex === 0 ? '<th class="risk-bottom-section" rowspan="' + rankRows.length + '">' + escapeHtml(label) + '</th>' : '') +
        '<th colspan="2">' + escapeHtml(option.label) + '</th>' +
        renderCountCells(rows, levelPredicate(option.value)) +
        '<td><strong>' + countCell(countRows(rows, levelPredicate(option.value))) + '</strong></td>' +
      '</tr>').join("");
    }
    const sourceSections = [
      { label: "Công nhân phát hiện", css: "risk-green-section", rows: workerRows },
      { label: "Tổ trưởng phát hiện", css: "risk-peach-section", rows: departmentHeadRows },
      { label: "Assessor phát hiện", css: "risk-white-section", rows: assessorRows },
    ];
    const updateRowSpan = SAFETY_STOP6_COLUMNS.length * sourceSections.length;
    const sectionRows = sourceSections.map((section, sectionIndex) => SAFETY_STOP6_COLUMNS.map((column, rowIndex) => {
      const cells = stats.map((stat) => {
        const value = sumIssueCounts(section.rows.filter((row) => row.area.id === stat.area.id && row.score.issueType === column.value), context);
        return '<td>' + numberCell(value) + '</td>';
      }).join("");
      const rowTotal = sumIssueCounts(section.rows.filter((row) => row.score.issueType === column.value), context);
      return '<tr class="' + section.css + '">' +
        (sectionIndex === 0 && rowIndex === 0 ? '<th class="risk-update-cell" rowspan="' + updateRowSpan + '">' + escapeHtml(updateText) + '</th>' : '') +
        (rowIndex === 0 ? '<th class="risk-section-label" rowspan="' + SAFETY_STOP6_COLUMNS.length + '"><span>' + escapeHtml(section.label) + '</span></th>' : '') +
        '<th>' + escapeHtml(String.fromCharCode(65 + rowIndex)) + ' (' + escapeHtml(column.label) + ')</th>' +
        cells +
        '<td><strong>' + numberCell(rowTotal) + '</strong></td>' +
      '</tr>';
    }).join("")).join("");

    const countermeasureRowsAll = monthRows.filter((row) => COUNTERMEASURE_STATUS_VALUES.has(normalizeIssueStatus(row.score.issueStatus)));
    const unresolvedRowsAll = monthRows.filter((row) => !COUNTERMEASURE_STATUS_VALUES.has(normalizeIssueStatus(row.score.issueStatus)));
    const footerRows = renderTotalRow("Tổng số vấn đề", monthRows, "risk-total-issues-row") +
      renderRankRows("Vấn đề Phát hiện", monthRows, "risk-detected-rank-row") +
      renderRankRows("Đã Thực hiện", countermeasureRowsAll, "risk-done-rank-row") +
      renderRankRows("Chưa Giải Quyết", unresolvedRowsAll, "risk-unresolved-rank-row") +
      renderTotalRow("Chưa Giải Quyết (Total)", unresolvedRowsAll, "risk-unresolved-total-row") +
      renderTotalRow("Đã Thực hiện (Total)", countermeasureRowsAll, "risk-bottom-total-row") +
      '<tr class="risk-percent-row"><th colspan="3">Tỷ Lệ % nhận diện trên người / Zone</th>' +
        stats.map((stat) => '<td>' + (stat.target ? formatPercent(stat.total / stat.target) : '') + '</td>').join("") +
        '<td><strong>' + (targetTotal ? formatPercent(totalActual / targetTotal) : '') + '</strong></td></tr>';

    return '<div class="dashboard-table-wrap excel-wide-wrap" data-drag-scroll>' +
      '<table class="risk-identification-table">' +
        '<thead>' +
          '<tr><th class="risk-update-head" rowspan="3">Ngày update</th><th colspan="2">Trưởng đơn vị</th>' + ownerHeaders + '<th rowspan="3">Total:</th></tr>' +
          '<tr><th colspan="2">Trưởng Zone</th>' + stats.map((stat) => renderHeaderActionCell(stat.responsible, "edit-area-responsible", stat.area, "Sửa trưởng zone / người phụ trách zone")).join("") + '</tr>' +
          '<tr><th colspan="2">Zone</th>' + stats.map((stat) => renderHeaderActionCell("Zone " + stat.code, "edit-area", stat.area, "Sửa thông tin zone")).join("") + '</tr>' +
          '<tr class="risk-target-row"><th colspan="3">Tổng số công người (MỤC TIÊU/THÁNG)</th>' + stats.map(renderTargetCell).join("") + '<th>' + escapeHtml(targetTotal) + '</th></tr>' +
          '<tr class="risk-actual-row"><th colspan="3">Số vấn đề phát hiện tháng ' + escapeHtml(month) + '/' + escapeHtml(year) + '</th>' + stats.map((stat) => '<th>' + numberCell(stat.total) + '</th>').join("") + '<th>' + escapeHtml(totalActual) + '</th></tr>' +
        '</thead>' +
        '<tbody>' + sectionRows + footerRows + '</tbody>' +
      '</table>' +
    '</div>';
  }

  function renderRiskIdentificationCard(filters, monthRows, visibleAreas, periodId, context) {
    const { escapeHtml } = context;
    const stats = buildZoneStats(monthRows, visibleAreas, periodId, context);
    return `<section class="dashboard-card wide excel-report-card risk-identification-card">
      <div class="section-heading excel-title-heading">
        <h2>TỔNG HỢP NHẬN DIỆN NGUY CƠ MẤT AN TOÀN NHÀ MÁY</h2>
        <span>Tháng ${escapeHtml(filters.month)}/${escapeHtml(filters.year)}</span>
      </div>
      ${copyableReportBlock("risk-zone-chart-" + filters.year + "-" + filters.month, renderZoneGoalChart(stats, filters.month, filters.year, context), "Copy", context)}
      ${copyableReportBlock("risk-identification-table-" + (periodId || filters.year + "-" + filters.month), renderIdentificationTable(stats, monthRows, filters.month, filters.year, periodId, context), "Copy", context)}
    </section>`;
  }


  function buildDepartmentMatrix(groups, yearRows, context) {
    return groups.map((group) => {
      const areaIds = new Set(group.areas.map((area) => area.id));
      const monthly = MONTHS.map((month) => sumIssueCounts(yearRows.filter((row) => areaIds.has(row.area.id) && monthOf(row, context) === month), context));
      const total = monthly.reduce((sum, value) => sum + value, 0);
      const countermeasure = sumIssueCounts(yearRows.filter((row) => areaIds.has(row.area.id) && hasCountermeasure(row, context)), context);
      return { name: group.name, areas: group.areas, monthly, total, closed: countermeasure, countermeasure };
    });
  }

  function buildRankMatrix(yearRows, context) {
    return RANK_COLUMNS.map((column) => {
      const monthly = MONTHS.map((month) => sumIssueCounts(yearRows.filter((row) => {
        return monthOf(row, context) === month && (!column.value || context.isSafetyLevelSelected(row.score, column.value));
      }), context));
      return {
        name: column.label,
        monthly,
        total: monthly.reduce((sum, value) => sum + value, 0),
      };
    });
  }

  function buildStop6Matrix(yearRows, context) {
    return (context.SAFETY_STOP6_COLUMNS || []).map((column, index) => {
      const monthly = MONTHS.map((month) => sumIssueCounts(yearRows.filter((row) => {
        return monthOf(row, context) === month && context.isSafetyStop6Selected(row.score, column.value);
      }), context));
      return {
        name: column.value || column.label || String(index + 1),
        monthly,
        total: monthly.reduce((sum, value) => sum + value, 0),
      };
    });
  }

  function renderGroupedColumnChart(series, config, context) {
    const escapeHtml = context.escapeHtml;
    if (!series.length) {
      return '<div class="excel-empty-chart">Chưa có dữ liệu để dựng biểu đồ.</div>';
    }

    const colors = config.colors || DEPARTMENT_COLORS;
    const left = config.left || 42;
    const top = config.top || 28;
    const plotHeight = config.plotHeight || 200;
    const plotWidth = config.plotWidth || 640;
    const width = left + plotWidth + 24;
    const height = config.height || 268;
    const max = Math.max(10, ...series.flatMap((row) => row.monthly));
    const gridValues = Array.from({ length: 6 }, (_, index) => Math.round((max / 5) * index));
    const step = plotWidth / 12;
    const groupWidth = Math.min(step * 0.82, Math.max(30, series.length * (series.length > 8 ? 3.5 : 7)));
    const barGap = series.length > 8 ? 0.8 : 1.2;
    const barWidth = Math.max(2, (groupWidth - (series.length - 1) * barGap) / series.length);
    const axisTitle = config.yAxisTitle || "Số vụ";
    const monthPrefix = Object.prototype.hasOwnProperty.call(config, "monthPrefix") ? config.monthPrefix : "T";

    const grid = gridValues.map((value) => {
      const y = chartY(value, max, top, plotHeight);
      return '<g><line x1="' + left + '" y1="' + y + '" x2="' + (left + plotWidth) + '" y2="' + y + '" class="excel-grid-line"></line><text x="6" y="' + (y + 4) + '" class="excel-axis-label">' + escapeHtml(value) + '</text></g>';
    }).join("");

    const bars = MONTHS.map((month, monthIndex) => {
      const groupX = left + monthIndex * step + (step - groupWidth) / 2;
      const monthBars = series.map((row, seriesIndex) => {
        const value = row.monthly[monthIndex] || 0;
        const barHeight = value ? Math.max(2, (value / max) * plotHeight) : 0;
        const x = groupX + seriesIndex * (barWidth + barGap);
        const y = top + plotHeight - barHeight;
        const labelY = value ? y - 4 : top + plotHeight - 2;
        const fill = colors[seriesIndex % colors.length];
        const rect = value ? '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" fill="' + fill + '" rx="1.5"><title>' + escapeHtml(row.name) + ' T' + month + ': ' + escapeHtml(value) + '</title></rect>' : '';
        return rect + (value && barWidth >= 6 ? '<text x="' + (x + barWidth / 2) + '" y="' + labelY + '" class="clustered-label">' + escapeHtml(value) + '</text>' : '');
      }).join("");
      return '<g>' + monthBars + '<text x="' + (left + monthIndex * step + step / 2) + '" y="' + (height - 18) + '" class="excel-month-label">' + escapeHtml(monthPrefix + month) + '</text></g>';
    }).join("");

    const legend = series.map((row, index) => '<span class="factory-legend-item"><i style="background:' + colors[index % colors.length] + '"></i><span class="legend-text">' + escapeHtml(row.name) + '</span></span>').join("");
    const svg = '<svg class="factory-chart-svg ' + escapeHtml(config.className || "") + '" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + escapeHtml(config.title || "Biểu đồ") + '">' +
      grid +
      '<text transform="rotate(-90 14 ' + (top + plotHeight / 2) + ')" x="14" y="' + (top + plotHeight / 2) + '" class="excel-axis-title">' + escapeHtml(axisTitle) + '</text>' +
      bars +
      '</svg>';

    return '<div class="factory-chart-panel">' +
      '<div class="factory-chart-canvas-wrap">' + svg + '</div>' +
      '<div class="factory-chart-legend">' + legend + '</div>' +
    '</div>';
  }

  function renderClusteredDepartmentChart(matrix, context) {
    return renderGroupedColumnChart(matrix, {
      title: "Tổng hợp số nhận diện nguy hiểm / bộ phận (Cột nhóm)",
      className: "factory-clustered-chart",
      colors: DEPARTMENT_COLORS,
      monthPrefix: "T",
      plotHeight: 210,
      plotWidth: 740,
      height: 270,
      yAxisTitle: "Số vụ",
    }, context);
  }

  function renderRankSummaryTable(matrix, context) {
    const escapeHtml = context.escapeHtml;
    const totals = MONTHS.map((_, index) => matrix.reduce((sum, row) => sum + row.monthly[index], 0));
    const grandTotal = totals.reduce((sum, value) => sum + value, 0);
    const rows = matrix.map((row) => '<tr><th class="row-label-cell rank-col-label">' + escapeHtml(row.name) + '</th>' + row.monthly.map((value) => '<td>' + countCell(value) + '</td>').join("") + '<td class="col-total-cell">' + countCell(row.total) + '</td></tr>').join("");
    return '<div class="dashboard-table-wrap rank-summary-wrap" data-drag-scroll><table class="rank-summary-table factory-styled-table">' +
      '<colgroup><col style="width: 74px; min-width: 68px;">' + MONTHS.map(() => '<col style="width: 30px; min-width: 25px;">').join("") + '<col style="width: 42px; min-width: 38px;"></colgroup>' +
      '<thead><tr><th class="rank-col-label">Cấp bậc</th>' + MONTHS.map((month) => '<th>T' + month + '</th>').join("") + '<th>Tổng</th></tr></thead><tbody>' + rows + '<tr class="factory-total-row"><th class="row-label-cell rank-col-label">Tổng cộng</th>' + totals.map((v) => '<td>' + countCell(v) + '</td>').join("") + '<td class="col-total-cell">' + countCell(grandTotal) + '</td></tr></tbody></table></div>';
  }

  function renderRankChart(matrix, context) {
    return renderGroupedColumnChart(matrix, {
      title: "TỔNG HỢP NHẬN DIỆN THEO RANK",
      className: "rank-summary-chart",
      colors: RANK_COLORS,
      monthPrefix: "T",
      plotHeight: 200,
      plotWidth: 640,
      height: 265,
      yAxisTitle: "SỐ VỤ",
    }, context);
  }

  function renderStop6SummaryTable(matrix, context) {
    const escapeHtml = context.escapeHtml;
    const totals = MONTHS.map((_, index) => matrix.reduce((sum, row) => sum + row.monthly[index], 0));
    const grandTotal = totals.reduce((sum, value) => sum + value, 0);
    const rows = matrix.map((row) => '<tr><th class="row-label-cell stop6-col-label">' + escapeHtml(row.name) + '</th>' + row.monthly.map((value) => '<td>' + countCell(value) + '</td>').join("") + '<td class="col-total-cell">' + countCell(row.total) + '</td></tr>').join("");
    return '<div class="dashboard-table-wrap stop6-summary-wrap" data-drag-scroll><table class="stop6-summary-table factory-styled-table">' +
      '<colgroup><col style="width: 82px; min-width: 78px;">' + MONTHS.map(() => '<col style="width: 30px; min-width: 25px;">').join("") + '<col style="width: 42px; min-width: 38px;"></colgroup>' +
      '<thead><tr><th class="stop6-col-label">Loại STOP 6</th>' + MONTHS.map((month) => '<th>T' + month + '</th>').join("") + '<th>Tổng</th></tr></thead><tbody>' + rows + '<tr class="factory-total-row"><th class="row-label-cell stop6-col-label">Tổng cộng</th>' + totals.map((v) => '<td>' + countCell(v) + '</td>').join("") + '<td class="col-total-cell">' + countCell(grandTotal) + '</td></tr></tbody></table></div>';
  }

  function renderStop6Chart(matrix, context) {
    return renderGroupedColumnChart(matrix, {
      title: "Tổng hợp nhận diện theo loại STOP 6",
      className: "stop6-summary-chart",
      colors: STOP6_COLORS,
      monthPrefix: "T",
      plotHeight: 200,
      plotWidth: 660,
      height: 265,
      yAxisTitle: "SỐ VỤ",
    }, context);
  }

  function renderFactorySummaryTable(matrix, context) {
    const { escapeHtml } = context;
    const totals = MONTHS.map((_, index) => matrix.reduce((sum, row) => sum + row.monthly[index], 0));
    const grandTotal = totals.reduce((sum, value) => sum + value, 0);
    return `<div class="dashboard-table-wrap factory-summary-wrap" data-drag-scroll>
      <table class="factory-summary-table factory-styled-table">
        <colgroup>
          <col style="width: 140px; min-width: 135px;">
          ${MONTHS.map(() => '<col style="width: 32px; min-width: 28px;">').join("")}
          <col style="width: 44px; min-width: 40px;">
        </colgroup>
        <thead>
          <tr><th>Bộ phận</th>${MONTHS.map((month) => `<th>T${month}</th>`).join("")}<th>Tổng</th></tr>
        </thead>
        <tbody>
          ${matrix.map((row) => `<tr><th class="row-label-cell">${escapeHtml(row.name)}</th>${row.monthly.map((value) => `<td>${numberCell(value)}</td>`).join("")}<td class="col-total-cell">${numberCell(row.total)}</td></tr>`).join("")}
          <tr class="factory-total-row"><th class="row-label-cell">Tổng cộng</th>${totals.map((value) => `<td>${numberCell(value)}</td>`).join("")}<td class="col-total-cell">${numberCell(grandTotal)}</td></tr>
        </tbody>
      </table>
    </div>`;
  }

  function renderStackedDepartmentChart(matrix, context) {
    const { escapeHtml } = context;
    const left = 40;
    const top = 26;
    const plotHeight = 200;
    const plotWidth = 640;
    const width = left + plotWidth + 24;
    const height = 265;
    const monthTotals = MONTHS.map((_, monthIndex) => matrix.reduce((sum, row) => sum + row.monthly[monthIndex], 0));
    const max = Math.max(10, ...monthTotals);
    const gridValues = Array.from({ length: 6 }, (_, index) => Math.round((max / 5) * index));
    const step = plotWidth / 12;
    const barWidth = Math.min(30, step * 0.54);

    const grid = gridValues.map((value) => {
      const y = chartY(value, max, top, plotHeight);
      return `<g><line x1="${left}" y1="${y}" x2="${left + plotWidth}" y2="${y}" class="excel-grid-line"></line><text x="6" y="${y + 4}" class="excel-axis-label">${escapeHtml(value)}</text></g>`;
    }).join("");

    const bars = MONTHS.map((month, monthIndex) => {
      let currentY = top + plotHeight;
      const parts = matrix.map((row, rowIndex) => {
        const value = row.monthly[monthIndex];
        const segmentHeight = value ? Math.max(2, (value / max) * plotHeight) : 0;
        currentY -= segmentHeight;
        return value ? `<rect x="${left + monthIndex * step + (step - barWidth) / 2}" y="${currentY}" width="${barWidth}" height="${segmentHeight}" fill="${DEPARTMENT_COLORS[rowIndex % DEPARTMENT_COLORS.length]}"><title>${escapeHtml(row.name)} T${month}: ${value}</title></rect>${segmentHeight > 14 ? `<text x="${left + monthIndex * step + step / 2}" y="${currentY + segmentHeight / 2 + 4}" class="stacked-label">${value}</text>` : ""}` : "";
      }).join("");
      return `<g>${parts}<text x="${left + monthIndex * step + step / 2}" y="${height - 18}" class="excel-month-label">T${month}</text></g>`;
    }).join("");

    const legend = matrix.map((row, index) => `<span class="factory-legend-item"><i style="background:${DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length]}"></i><span class="legend-text">${escapeHtml(row.name)}</span></span>`).join("");

    return `<div class="factory-chart-panel">
      <div class="factory-chart-canvas-wrap">
        <svg class="factory-chart-svg factory-stacked-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Biểu đồ xếp chồng theo bộ phận">
          ${grid}
          ${bars}
        </svg>
      </div>
      <div class="factory-chart-legend">${legend}</div>
    </div>`;
  }

  function renderProgressTable(monthTotals, closedTotals, year = 2026, context = {}) {
    let lastDataMonth = 0;
    MONTHS.forEach((m, idx) => {
      if (Number(monthTotals[idx] || 0) > 0 || Number(closedTotals[idx] || 0) > 0) {
        lastDataMonth = m;
      }
    });

    let cumulative = 0;
    let cumulativeClosed = 0;
    const rows = MONTHS.map((month, index) => {
      const isPastOrCurrent = month <= (lastDataMonth || 12);
      cumulative += Number(monthTotals[index] || 0);
      cumulativeClosed += Number(closedTotals[index] || 0);
      const ratio = cumulative ? cumulativeClosed / cumulative : 0;
      const rateText = isPastOrCurrent ? formatPercent(ratio) : "0%";
      const targetVal = context?.getSafetyMonthlyTarget ? context.getSafetyMonthlyTarget(year, month) : 100;

      return `<tr>
        <th class="row-label-cell progress-col-month">T${month}</th>
        <td class="progress-col-num">${numberCell(monthTotals[index])}</td>
        <td class="progress-col-num">${numberCell(closedTotals[index])}</td>
        <td class="progress-col-cum">${isPastOrCurrent ? numberCell(cumulative) : ""}</td>
        <td class="progress-col-cum">${isPastOrCurrent ? numberCell(cumulativeClosed) : ""}</td>
        <td class="progress-col-rate col-highlight-rate">${rateText}</td>
        <td class="progress-col-target">
          <div class="progress-target-cell">
            <input class="progress-target-input" type="number" min="0" max="100" step="1" value="${targetVal}" placeholder="100" aria-label="Mục tiêu tháng ${month} năm ${year}" data-progress-target-input data-year="${year}" data-month="${month}">
            <span class="progress-target-unit">%</span>
          </div>
        </td>
      </tr>`;
    }).join("");

    return `<div class="dashboard-table-wrap progress-summary-wrap" data-drag-scroll>
      <table class="factory-progress-table factory-styled-table">
        <thead>
          <tr>
            <th class="progress-col-month">Tháng</th>
            <th class="progress-col-num">Phát hiện</th>
            <th class="progress-col-num">Đối sách</th>
            <th class="progress-col-cum">Tích lũy<br>phát hiện</th>
            <th class="progress-col-cum">Tích lũy<br>đối sách</th>
            <th class="progress-col-rate">Tỉ lệ<br>đối sách</th>
            <th class="progress-col-target">Mục tiêu</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  function renderProgressChart(monthTotals, closedTotals, context) {
    const escapeHtml = context.escapeHtml;
    const left = 42;
    const top = 26;
    const plotHeight = 190;
    const plotWidth = 640;
    const width = left + plotWidth + 24;
    const height = 265;
    let lastDataMonth = 0;
    MONTHS.forEach((m, idx) => {
      if (Number(monthTotals[idx] || 0) > 0 || Number(closedTotals[idx] || 0) > 0) {
        lastDataMonth = m;
      }
    });

    const cumulative = [];
    const cumulativeClosed = [];
    monthTotals.reduce((sum, value, index) => {
      const next = sum + value;
      cumulative[index] = next;
      return next;
    }, 0);
    closedTotals.reduce((sum, value, index) => {
      const next = sum + value;
      cumulativeClosed[index] = next;
      return next;
    }, 0);
    const max = Math.max(10, ...monthTotals, ...closedTotals, ...cumulative, ...cumulativeClosed);
    const gridValues = Array.from({ length: 6 }, (_, index) => Math.round((max / 5) * index));
    const step = plotWidth / 12;
    const barWidth = Math.min(13, step * 0.24);
    const grid = gridValues.map((value) => {
      const y = chartY(value, max, top, plotHeight);
      return '<g><line x1="' + left + '" y1="' + y + '" x2="' + (left + plotWidth) + '" y2="' + y + '" class="excel-grid-line"></line><text x="6" y="' + (y + 4) + '" class="excel-axis-label">' + escapeHtml(value) + '</text></g>';
    }).join("");
    const bars = MONTHS.map((month, index) => {
      const x = left + index * step + step / 2;
      const actualH = monthTotals[index] ? Math.max(3, (monthTotals[index] / max) * plotHeight) : 0;
      const closedH = closedTotals[index] ? Math.max(3, (closedTotals[index] / max) * plotHeight) : 0;
      return '<g>' +
        '<rect x="' + (x - barWidth - 1) + '" y="' + (top + plotHeight - actualH) + '" width="' + barWidth + '" height="' + actualH + '" class="progress-actual" rx="1"><title>T' + month + ' Phát hiện: ' + monthTotals[index] + '</title></rect>' +
        '<rect x="' + (x + 1) + '" y="' + (top + plotHeight - closedH) + '" width="' + barWidth + '" height="' + closedH + '" class="progress-closed" rx="1"><title>T' + month + ' Đã khắc phục: ' + closedTotals[index] + '</title></rect>' +
        '<text x="' + x + '" y="' + (height - 18) + '" class="excel-month-label">T' + month + '</text>' +
      '</g>';
    }).join("");
    const activeIndices = MONTHS.map((m, i) => m <= (lastDataMonth || 12) ? i : -1).filter((i) => i >= 0);
    const line = activeIndices.length ? activeIndices.map((index) => (left + index * step + step / 2).toFixed(1) + ',' + chartY(cumulative[index], max, top, plotHeight).toFixed(1)).join(" ") : "";
    const closedLine = activeIndices.length ? activeIndices.map((index) => (left + index * step + step / 2).toFixed(1) + ',' + chartY(cumulativeClosed[index], max, top, plotHeight).toFixed(1)).join(" ") : "";
    const labels = activeIndices.map((index) => '<text x="' + (left + index * step + step / 2) + '" y="' + (chartY(cumulative[index], max, top, plotHeight) - 7) + '" class="excel-bar-label">' + (cumulative[index] || '') + '</text>').join("");
    const closedLabels = activeIndices.map((index) => '<text x="' + (left + index * step + step / 2) + '" y="' + (chartY(cumulativeClosed[index], max, top, plotHeight) + 13) + '" class="excel-bar-label">' + (cumulativeClosed[index] || '') + '</text>').join("");

    return '<div class="factory-chart-panel">' +
      '<div class="factory-chart-canvas-wrap">' +
        '<svg class="factory-chart-svg factory-progress-chart" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Biểu đồ tiến độ tích lũy">' +
          grid + bars +
          (line ? '<polyline points="' + line + '" class="progress-cumulative-line"></polyline>' : '') +
          (closedLine ? '<polyline points="' + closedLine + '" class="progress-closed-line"></polyline>' : '') +
          labels + closedLabels +
        '</svg>' +
      '</div>' +
      '<div class="factory-chart-legend">' +
        '<span class="factory-legend-item"><i class="legend-actual"></i>Số nhận diện</span>' +
        '<span class="factory-legend-item"><i class="legend-counter"></i>Đối sách triển khai</span>' +
        '<span class="factory-legend-item"><i class="legend-cumulative"></i>Tích lũy số nhận diện</span>' +
        '<span class="factory-legend-item"><i class="legend-cumulative-closed"></i>Tích lũy đối sách</span>' +
      '</div>' +
    '</div>';
  }

  function renderMonthlyRateChart(monthTotals, closedTotals, year, context) {
    const escapeHtml = context.escapeHtml;
    const left = 46;
    const top = 26;
    const plotHeight = 190;
    const plotWidth = 640;
    const width = left + plotWidth + 24;
    const height = 265;
    const max = 1.2;
    const gridValues = [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2];
    const step = plotWidth / 12;
    const barWidth = Math.min(22, step * 0.38);
    let lastDataMonth = 0;
    MONTHS.forEach((m, idx) => {
      if (Number(monthTotals[idx] || 0) > 0 || Number(closedTotals[idx] || 0) > 0) {
        lastDataMonth = m;
      }
    });

    let cumulativeTotal = 0;
    let cumulativeClosed = 0;
    const cumulativeRates = MONTHS.map((month, index) => {
      cumulativeTotal += Number(monthTotals[index] || 0);
      cumulativeClosed += Number(closedTotals[index] || 0);
      return cumulativeTotal ? cumulativeClosed / cumulativeTotal : 0;
    });

    const targetValues = MONTHS.map((m) => {
      return context?.getSafetyMonthlyTarget ? context.getSafetyMonthlyTarget(year, m) : 100;
    });

    const targetPoints = [];
    const firstTargetRatio = (targetValues[0] || 100) / 100;
    targetPoints.push(`${left.toFixed(1)},${chartY(firstTargetRatio, max, top, plotHeight).toFixed(1)}`);
    MONTHS.forEach((m, idx) => {
      const ratio = (targetValues[idx] || 100) / 100;
      const x = left + idx * step + step / 2;
      const y = chartY(ratio, max, top, plotHeight);
      targetPoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    });
    const lastTargetRatio = (targetValues[11] || 100) / 100;
    targetPoints.push(`${(left + plotWidth).toFixed(1)},${chartY(lastTargetRatio, max, top, plotHeight).toFixed(1)}`);

    const targetPolyline = `<polyline points="${targetPoints.join(' ')}" class="rate-target-line"></polyline>`;

    const targetDots = MONTHS.map((month, index) => {
      const val = targetValues[index];
      const ratio = val / 100;
      const x = left + index * step + step / 2;
      const y = chartY(ratio, max, top, plotHeight);
      const isCustom = val !== 100;
      const dot = `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" class="rate-target-dot"><title>Mục tiêu T${month}: ${val}%</title></circle>`;
      const label = isCustom
        ? `<text x="${x.toFixed(1)}" y="${(y - 7).toFixed(1)}" class="excel-bar-label font-bold" style="fill:#ea580c;font-size:11px;" text-anchor="middle">${val}%</text>`
        : '';
      return dot + label;
    }).join("");

    const all100 = targetValues.every((v) => v === 100);
    const legendTargetText = all100 ? "Mục tiêu (100%)" : "Mục tiêu theo tháng (%)";

    const grid = gridValues.map((value) => {
      const y = chartY(value, max, top, plotHeight);
      return '<g><line x1="' + left + '" y1="' + y + '" x2="' + (left + plotWidth) + '" y2="' + y + '" class="excel-grid-line"></line><text x="6" y="' + (y + 4) + '" class="excel-axis-label">' + formatPercent(value) + '</text></g>';
    }).join("");
    const bars = MONTHS.map((month, index) => {
      const rate = cumulativeRates[index] || 0;
      const x = left + index * step + step / 2;
      const barHeight = rate > 0 ? Math.max(3, (Math.min(rate, max) / max) * plotHeight) : 0;
      const fill = index % 2 === 0 ? "#0284c7" : "#38bdf8";

      const barElement =
        (rate > 0 ? '<rect x="' + (x - barWidth / 2) + '" y="' + (top + plotHeight - barHeight) + '" width="' + barWidth + '" height="' + barHeight + '" class="rate-actual" rx="2" style="fill:' + fill + '"><title>T' + month + ': ' + formatPercent(rate) + '</title></rect>' : '') +
        '<text x="' + x + '" y="' + (top + plotHeight - Math.max(barHeight, 3) - 7) + '" class="excel-bar-label font-bold">' + formatPercent(rate) + '</text>';

      return '<g>' +
        barElement +
        '<text x="' + x + '" y="' + (height - 18) + '" class="excel-month-label">T' + month + '</text>' +
      '</g>';
    }).join("");

    return '<div class="factory-chart-panel">' +
      '<div class="factory-chart-canvas-wrap">' +
        '<svg class="factory-chart-svg monthly-rate-chart" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Tỉ lệ lũy kế triển khai đối sách theo tháng">' +
          grid + bars + targetPolyline + targetDots +
        '</svg>' +
      '</div>' +
      '<div class="factory-chart-legend">' +
        '<span class="factory-legend-item"><i class="legend-rate"></i>Tỉ lệ triển khai đối sách (%)</span>' +
        '<span class="factory-legend-item"><i class="legend-target-line"></i>' + escapeHtml(legendTargetText) + '</span>' +
      '</div>' +
    '</div>';
  }

  function renderDepartmentTabs(groups, selectedDepartment, year, context) {
    const { escapeHtml } = context;
    const summaryLabel = "TẤT CẢ BỘ PHẬN (" + (year || new Date().getFullYear()) + ")";
    return '<div class="factory-dept-pills-bar">' +
      '<button class="factory-dept-pill ' + (!selectedDepartment ? "is-active" : "") + '" type="button" data-action="set-safety-department-filter" data-id="">' +
        '<i class="fa-solid fa-layer-group"></i> ' + escapeHtml(summaryLabel) +
      '</button>' +
      groups.map((group) => {
        const areaCount = group.areas ? group.areas.length : 0;
        return '<button class="factory-dept-pill ' + (group.name === selectedDepartment ? "is-active" : "") + '" type="button" data-action="set-safety-department-filter" data-id="' + escapeHtml(group.name) + '">' +
          '<i class="fa-regular fa-building"></i> ' + escapeHtml(group.name) +
          (areaCount ? '<span class="dept-count-badge">' + areaCount + '</span>' : '') +
        '</button>';
      }).join("") +
    '</div>';
  }

  function renderSafetyMarkCell(selected, context, extraClass = "", value = "1") {
    const className = [extraClass, selected ? "is-marked" : ""].filter(Boolean).join(" ");
    return `<td class="safety-mark-cell ${className}">${selected ? context.escapeHtml(value) : ""}</td>`;
  }

  function renderSafetyRow(row, index, context) {
    const {
      SAFETY_FOUND_COLUMNS,
      SAFETY_LEVEL_COLUMNS,
      SAFETY_STOP6_COLUMNS,
      canManageSafetyRecord,
      escapeHtml,
      getCompletionDateDisplay,
      getIssueCount,
      getIssueDay,
      getIssueDescription,
      getIssueFoundBy,
      getIssueEmployeeCode,
      getIssueLocation,
      getIssueMonth,
      getIssueStatusLabel,
      getSafetyLevelConfirm,
      getSafetyStop6Confirm,
      isIssueOpen,
      isPeriodArchived,
      isSafetyFoundSelected,
      isSafetyLevelSelected,
      isSafetyStop6Selected,
    } = context;

    const canEdit = typeof canManageSafetyRecord === "function"
      ? canManageSafetyRecord(row.score, context.currentUser)
      : Boolean(context.isAdminAccount?.(context.currentUser)) && !isPeriodArchived(row.score.periodId);
    const statusLabel = getIssueStatusLabel ? getIssueStatusLabel(row.score.issueStatus) : (isIssueOpen(row.score) ? "Chưa xử lý" : "Đã xử lý");
    const completionDate = getCompletionDateDisplay(row.score);
    const actions = canEdit
      ? `<div class="safety-actions">
          <button class="tiny-button" type="button" data-action="edit-safety-record" data-id="${escapeHtml(row.score.id)}">Sửa</button>
          <button class="tiny-button danger-text-button" type="button" data-action="delete-safety-record" data-id="${escapeHtml(row.score.id)}">Xóa</button>
          <span class="item-meta">${escapeHtml(statusLabel)}</span>
        </div>`
      : `<div class="safety-actions"><span class="item-meta">${escapeHtml(statusLabel)}</span></div>`;

    return `<tr>
      <td class="safety-no-cell"><span>${index}</span>${actions}</td>
      <td>${escapeHtml(getIssueLocation(row))}</td>
      <td>${escapeHtml(getIssueDay(row))}</td>
      <td>${escapeHtml(getIssueMonth(row, row.score.periodId))}</td>
      <td>${escapeHtml(row.score.note || getIssueDescription(row))}</td>
      <td>${row.score.photoDataUrl ? `<img class="safety-thumb" src="${row.score.photoDataUrl}" alt="Ảnh minh họa">` : ""}</td>
      <td>${escapeHtml(getIssueCount(row))}</td>
      ${SAFETY_STOP6_COLUMNS.map((column) => renderSafetyMarkCell(isSafetyStop6Selected(row.score, column.value), context)).join("")}
      ${SAFETY_LEVEL_COLUMNS.map((column) => renderSafetyMarkCell(isSafetyLevelSelected(row.score, column.value), context, column.value === "A" ? "level-a-column" : "level-mark")).join("")}
      ${SAFETY_FOUND_COLUMNS.map((column) => renderSafetyMarkCell(isSafetyFoundSelected(row.score, column.value), context, "", getIssueFoundBy(row) || "1")).join("")}
      <td>${escapeHtml(getIssueEmployeeCode(row))}</td>
      <td>${escapeHtml(row.score.improvementContent || "")}</td>
      <td>${row.score.afterPhotoDataUrl ? `<img class="safety-thumb" src="${row.score.afterPhotoDataUrl}" alt="Ảnh sau cải tiến">` : ""}</td>
      <td>${escapeHtml(row.score.actionOwner || "")}</td>
      <td>${escapeHtml(row.score.actionPlan || "")}</td>
      <td>${escapeHtml(completionDate)}</td>
      <td>${escapeHtml(getSafetyLevelConfirm ? getSafetyLevelConfirm(row.score) : row.score.completionLevelConfirm || "")}</td>
      <td>${escapeHtml(getSafetyStop6Confirm ? getSafetyStop6Confirm(row.score) : row.score.completionStop6Confirm || "")}</td>
    </tr>`;
  }

  function renderSafetyTableHtml(rows, reportPeriod, context, emptyMessage, startIndex = 0) {
    const {
      DEFAULT_SAFETY_REPORT,
      SAFETY_FOUND_COLUMNS,
      SAFETY_LEVEL_COLUMNS,
      SAFETY_STOP6_COLUMNS,
      escapeHtml,
      formatDateDisplay,
      getReportDateValue,
      getSafetyReportForPeriod,
    } = context;
    const report = getSafetyReportForPeriod(reportPeriod?.id || rows[0]?.score.periodId || "");
    const issueDate = formatDateDisplay(getReportDateValue(report, reportPeriod, "issueDate"));
    const reportDate = formatDateDisplay(getReportDateValue(report, reportPeriod, "reportDate"));

    return `
      <colgroup>
        <col style="width: 58px"><col style="width: 120px"><col style="width: 50px"><col style="width: 50px"><col style="width: 280px"><col style="width: 170px"><col style="width: 74px">
        ${Array.from({ length: 13 }, () => '<col style="width: 36px">').join("")}
        <col style="width: 110px"><col style="width: 260px"><col style="width: 170px"><col style="width: 120px"><col style="width: 120px"><col style="width: 92px"><col style="width: 150px"><col style="width: 150px">
      </colgroup>
      <thead>
        <tr class="safety-form-top">
          <th class="safety-logo-cell" colspan="3" rowspan="2"><img src="images/Logo.jpg" alt="LeGroup"></th>
          <th class="safety-title-cell" colspan="19" rowspan="2"><strong>BẢNG THEO DÕI NHẬN DẠNG NGUY HIỂM VÀ KHẮC PHỤC</strong><span>HAZARD IDENTIFICATION &amp; ACTIVITY FOLLOW UP SHEET</span></th>
          <th class="safety-date-label" colspan="3">Issue Date</th><th class="safety-date-value" colspan="3">${escapeHtml(issueDate)}</th>
        </tr>
        <tr class="safety-form-top"><th class="safety-date-label" colspan="3">Report date</th><th class="safety-date-value" colspan="3">${escapeHtml(reportDate)}</th></tr>
        <tr class="safety-meta-row"><td colspan="6"><span>Người Thực Hiện:</span> ${escapeHtml(report.performer)}</td><td colspan="5"><span>Người Kiểm Tra:</span></td><td colspan="17"><strong>${escapeHtml(report.checker)}</strong></td></tr>
        <tr class="safety-meta-row"><td colspan="6"><span>Chức Danh:</span> ${escapeHtml(report.performerTitle || "")}</td><td colspan="5"><span>Chức Danh:</span> ${escapeHtml(report.checkerTitle || "")}</td><td colspan="17"></td></tr>
        <tr class="safety-meta-row"><td colspan="6"><span>Bộ Phận:</span> ${escapeHtml(report.department || "")}</td><td colspan="5"><span>Bộ Phận:</span> ${escapeHtml(report.checkerDepartment || "")}</td><td colspan="17"></td></tr>
        <tr class="safety-main-header">
          <th rowspan="3">No</th><th rowspan="3">Vị trí</th><th rowspan="3">Ngày</th><th rowspan="3">Tháng</th><th rowspan="3">Mối nguy hiểm phát hiện được</th><th rowspan="3">Hình Ảnh Minh Họa</th><th rowspan="3">Số lần phát hiện</th>
          <th colspan="13">${escapeHtml(report.instruction || DEFAULT_SAFETY_REPORT.instruction)}</th>
          <th rowspan="3">Mã nhân viên</th><th rowspan="3">Nội dung cải tiến, xử lý</th><th rowspan="3">Hình ảnh sau cải tiến, xử lý</th><th rowspan="3">Đảm nhiệm</th><th rowspan="3">Kế hoạch</th><th colspan="3">Hoàn thành</th>
        </tr>
        <tr class="safety-main-header"><th colspan="${SAFETY_STOP6_COLUMNS.length}">Phân loại STOP 6</th><th colspan="${SAFETY_LEVEL_COLUMNS.length}">Cấp bậc</th><th colspan="${SAFETY_FOUND_COLUMNS.length}">Phát hiện</th><th rowspan="2">Ngày</th><th rowspan="2">Xác nhận theo cấp độ</th><th rowspan="2">Xác nhận theo loại stop 6</th></tr>
        <tr class="safety-main-header safety-vertical-row">
          ${SAFETY_STOP6_COLUMNS.map((column) => `<th><span>${escapeHtml(column.label)}</span></th>`).join("")}
          ${SAFETY_LEVEL_COLUMNS.map((column) => `<th class="${column.value === "A" ? "level-a-column-head" : ""}"><span>${escapeHtml(column.label)}</span></th>`).join("")}
          ${SAFETY_FOUND_COLUMNS.map((column) => `<th><span>${escapeHtml(column.label)}</span></th>`).join("")}
        </tr>
      </thead>
      <tbody>${rows.length ? rows.map((row, index) => renderSafetyRow(row, startIndex + index + 1, context)).join("") : `<tr><td colspan="28" class="empty-cell">${escapeHtml(emptyMessage)}</td></tr>`}</tbody>`;
  }

  function renderAnnualFactoryCard(filters, yearRows, groups, selectedDepartment, reportPeriod, context) {
    const escapeHtml = context.escapeHtml;
    const matrix = buildDepartmentMatrix(groups, yearRows, context);
    const rankMatrix = buildRankMatrix(yearRows, context);
    const stop6Matrix = buildStop6Matrix(yearRows, context);
    const monthTotals = MONTHS.map((month) => sumIssueCounts(yearRows.filter((row) => monthOf(row, context) === month), context));
    const countermeasureTotals = MONTHS.map((month) => sumIssueCounts(yearRows.filter((row) => monthOf(row, context) === month && hasCountermeasure(row, context)), context));
    const selectedGroup = selectedDepartment ? groups.find((group) => group.name === selectedDepartment) || null : null;
    const selectedAreas = selectedGroup ? selectedGroup.areas : groups.flatMap((group) => group.areas);
    const selectedAreaIds = new Set(selectedAreas.map((area) => area.id));
    const detailRows = selectedAreaIds.size ? yearRows.filter((row) => selectedAreaIds.has(row.area.id)) : [];
    const detailTotals = selectedAreaIds.size ? buildZoneStats(detailRows, selectedAreas, reportPeriod?.id || "", context) : [];
    const summaryLabel = selectedGroup ? selectedGroup.name : "Tất cả bộ phận năm " + filters.year;
    const emptyDetailMessage = selectedGroup
      ? "Chưa có bảng đánh giá an toàn của " + selectedDepartment + " trong năm " + filters.year + "."
      : "Chưa có bảng đánh giá an toàn trong năm " + filters.year + ".";

    const copyPrefix = "factory-" + filters.year + "-";
    const detailPageKey = [filters.year, selectedDepartment || "all", reportPeriod?.id || ""].join("|");
    const detailPagination = getPaginationState("factory", detailPageKey, detailRows.length);
    const pagedDetailRows = detailRows.slice(detailPagination.startIndex, detailPagination.endIndex);
    const detailPager = renderSafetyPager("factory", detailPagination, detailRows.length, context);

    // Calculate Executive KPI summary values
    const totalDetectedYtd = monthTotals.reduce((sum, v) => sum + v, 0);
    const totalCountermeasureYtd = countermeasureTotals.reduce((sum, v) => sum + v, 0);
    const completionRatePct = totalDetectedYtd ? Math.round((totalCountermeasureYtd / totalDetectedYtd) * 100) : 0;
    
    // High Risk Rank A
    const rankARow = rankMatrix.find((r) => String(r.name).toUpperCase().includes("A"));
    const rankACount = rankARow ? rankARow.total : 0;
    
    // Top STOP 6 hazard
    const stop6Sorted = [...stop6Matrix].sort((a, b) => (b.total || 0) - (a.total || 0));
    const topStop6 = stop6Sorted[0]?.total > 0 ? stop6Sorted[0] : null;
    const topStop6Text = topStop6 ? `${topStop6.name} (${topStop6.total} vụ)` : "Không có";

    // Top department
    const deptSorted = [...matrix].sort((a, b) => (b.total || 0) - (a.total || 0));
    const topDept = deptSorted[0]?.total > 0 ? deptSorted[0] : null;
    const topDeptText = topDept ? `${topDept.name} (${topDept.total} vụ)` : "Không có";

    const departmentSummaryHtml = '<div class="dashboard-table-wrap department-zone-summary-wrap" data-drag-scroll>' +
      '<table class="department-zone-summary-table factory-styled-table">' +
        '<thead><tr><th>Zone</th><th style="text-align: left; padding-left: 14px; min-width: 120px;">Bộ phận</th><th>Mục tiêu/tháng</th><th>Số nhận diện năm</th><th>Chưa xử lý</th><th>Đã xử lý</th><th>Đang xử lý</th><th>Quá hạn</th><th>Đối sách</th></tr></thead>' +
        '<tbody>' + (detailTotals.length ? detailTotals.map((stat) => '<tr><th class="row-label-cell">Zone ' + escapeHtml(stat.code) + '</th><td class="dept-name-cell">' + escapeHtml(stat.department) + '</td><td>' + escapeHtml(stat.target || "") + '</td><td><strong>' + numberCell(stat.total) + '</strong></td><td><span class="badge-status-open">' + numberCell(stat.statusCounts.open) + '</span></td><td><span class="badge-status-closed">' + numberCell(stat.statusCounts.closed) + '</span></td><td><span class="badge-status-prog">' + numberCell(stat.statusCounts.in_progress) + '</span></td><td><span class="badge-status-overdue">' + numberCell(stat.statusCounts.overdue) + '</span></td><td>' + numberCell(stat.countermeasure) + '</td></tr>').join("") : '<tr><td colspan="9" class="empty-cell">Chưa có bộ phận để tổng hợp.</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>';

    const departmentDetailHtml = detailPager +
      '<div class="table-wrap wide-table-wrap annual-department-table-wrap" data-drag-scroll>' +
        '<table class="safety-table annual-detail-safety-table">' + renderSafetyTableHtml(pagedDetailRows, reportPeriod, context, emptyDetailMessage, detailPagination.startIndex) + '</table>' +
      '</div>' +
      detailPager;

    let currentTab = activeFactoryTab || "overview";
    if (selectedDepartment && activeFactoryTab !== "all") {
      currentTab = "detail";
    }
    const currentChartView = activeDepartmentChartView || "stacked";

    return `
      <section class="dashboard-card wide excel-report-card factory-risk-dashboard-card">
        
        <!-- Header: Main Title & Action Tools -->
        <div class="factory-dashboard-top-header">
          <div class="top-header-left">
            <span class="top-header-icon"><i class="fa-solid fa-industry"></i></span>
            <div>
              <h2 class="top-header-title">TỔNG HỢP NGUY CƠ MẤT AN TOÀN NHÀ MÁY</h2>
              <span class="top-header-sub">Năm Báo Cáo: <strong class="text-brand-400 font-mono">${escapeHtml(filters.year)}</strong> · Toàn Nhà Máy</span>
            </div>
          </div>
        </div>

        <!-- KPI Summary Cards Row (Executive Metrics) -->
        <div class="factory-kpi-grid">
          <div class="factory-kpi-card">
            <div class="kpi-card-header">
              <span class="kpi-icon-wrap icon-amber"><i class="fa-solid fa-triangle-exclamation"></i></span>
              <span class="kpi-badge">Tổng nguy cơ</span>
            </div>
            <div class="kpi-main">
              <strong class="kpi-value font-mono">${totalDetectedYtd}</strong>
              <span class="kpi-label">Tổng nhận diện nguy cơ</span>
            </div>
            <div class="kpi-subtext"><i class="fa-regular fa-calendar-check"></i> Toàn bộ 12 tháng năm ${escapeHtml(filters.year)}</div>
          </div>

          <div class="factory-kpi-card">
            <div class="kpi-card-header">
              <span class="kpi-icon-wrap icon-blue"><i class="fa-solid fa-shield-halved"></i></span>
              <span class="kpi-badge">Đã xử lý</span>
            </div>
            <div class="kpi-main">
              <strong class="kpi-value font-mono">${totalCountermeasureYtd}</strong>
              <span class="kpi-label">Đối sách đã triển khai</span>
            </div>
            <div class="kpi-subtext"><i class="fa-solid fa-arrows-spin"></i> Biện pháp khắc phục đã duyệt</div>
          </div>

          <div class="factory-kpi-card">
            <div class="kpi-card-header">
              <span class="kpi-icon-wrap icon-green"><i class="fa-solid fa-bullseye"></i></span>
              <span class="kpi-badge">Mục tiêu 100%</span>
            </div>
            <div class="kpi-main">
              <strong class="kpi-value font-mono text-emerald-400">${completionRatePct}%</strong>
              <span class="kpi-label">Tỉ lệ hoàn thành đối sách</span>
            </div>
            <div class="kpi-progress-bar">
              <div class="kpi-progress-fill" style="width: ${Math.min(100, completionRatePct)}%"></div>
            </div>
          </div>

          <div class="factory-kpi-card">
            <div class="kpi-card-header">
              <span class="kpi-icon-wrap icon-rose"><i class="fa-solid fa-circle-exclamation"></i></span>
              <span class="kpi-badge badge-danger">Cấp A</span>
            </div>
            <div class="kpi-main">
              <strong class="kpi-value font-mono text-rose-400">${rankACount}</strong>
              <span class="kpi-label">Nguy cơ nghiêm trọng (Rank A)</span>
            </div>
            <div class="kpi-subtext"><i class="fa-solid fa-bell"></i> Ưu tiên giám sát & giải quyết ngay</div>
          </div>

          <div class="factory-kpi-card">
            <div class="kpi-card-header">
              <span class="kpi-icon-wrap icon-purple"><i class="fa-solid fa-chart-pie"></i></span>
              <span class="kpi-badge">Top STOP 6</span>
            </div>
            <div class="kpi-main">
              <strong class="kpi-value text-sm font-semibold truncate" title="${escapeHtml(topStop6Text)}">${escapeHtml(topStop6Text)}</strong>
              <span class="kpi-label">Nguy cơ STOP 6 nhiều nhất</span>
            </div>
            <div class="kpi-subtext"><i class="fa-solid fa-building"></i> Điểm nóng: ${escapeHtml(topDeptText)}</div>
          </div>
        </div>

        <!-- Main Section Navigation Tabs -->
        <div class="factory-nav-tabs" role="tablist">
          <button type="button" class="factory-nav-pill ${currentTab === 'overview' ? 'is-active' : ''}" data-factory-tab="overview">
            <i class="fa-solid fa-chart-line"></i>
            <span>1. Tổng Quan & Tiến Độ</span>
          </button>
          <button type="button" class="factory-nav-pill ${currentTab === 'analysis' ? 'is-active' : ''}" data-factory-tab="analysis">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>2. Phân Tích Cấp Độ & STOP 6</span>
          </button>
          <button type="button" class="factory-nav-pill ${currentTab === 'detail' ? 'is-active' : ''}" data-factory-tab="detail">
            <i class="fa-solid fa-clipboard-list"></i>
            <span>3. Chi Tiết Bộ Phận & Nhật Ký</span>
          </button>
          <button type="button" class="factory-nav-pill ${currentTab === 'all' ? 'is-active' : ''}" data-factory-tab="all">
            <i class="fa-solid fa-table-cells"></i>
            <span>Xem Toàn Bộ</span>
          </button>
        </div>

        <!-- ══════════════════════════════════════════════════════════════════════════
             TAB PANE 1: TỔNG QUAN BỘ PHẬN & TIẾN ĐỘ
             ══════════════════════════════════════════════════════════════════════════ -->
        <div class="factory-tab-pane ${currentTab !== 'overview' && currentTab !== 'all' ? 'is-hidden' : ''}" data-factory-pane="overview">
          
          <!-- Card 1: Phân bổ Mối nguy theo Bộ phận (Table + Toggleable Chart) -->
          <div class="factory-section-card">
            <div class="factory-card-header">
              <div class="card-header-left">
                <span class="card-header-icon icon-blue"><i class="fa-solid fa-building-user"></i></span>
                <div>
                  <h3 class="card-header-title">Phân Bổ Nhận Diện Nguy Cơ Theo Bộ Phận</h3>
                  <span class="card-header-sub">Tổng hợp số lượng phát hiện 12 tháng theo từng khối / phòng ban</span>
                </div>
              </div>
              <div class="card-header-right">
                <div class="chart-view-toggle">
                  <button type="button" class="view-toggle-btn ${currentChartView === 'stacked' ? 'is-active' : ''}" data-chart-view="stacked" title="Xem dạng cột xếp chồng">
                    <i class="fa-solid fa-layer-group"></i> Xếp chồng
                  </button>
                  <button type="button" class="view-toggle-btn ${currentChartView === 'clustered' ? 'is-active' : ''}" data-chart-view="clustered" title="Xem dạng cột nhóm">
                    <i class="fa-solid fa-chart-column"></i> Cột nhóm
                  </button>
                </div>
                <button type="button" class="btn-card-copy" data-action="copy-report-target" data-copy-format="html" data-copy-target="${copyPrefix}summary-table" title="Copy bảng số liệu">
                  <i class="fa-regular fa-copy"></i> Copy Bảng
                </button>
                <button type="button" class="btn-card-copy" data-action="copy-report-target" data-copy-format="image" data-copy-target="${copyPrefix}department-stacked-chart" title="Copy biểu đồ ảnh">
                  <i class="fa-regular fa-image"></i> Copy Biểu Đồ
                </button>
              </div>
            </div>
            <div class="factory-card-body factory-grid-pair">
              <div class="factory-col-table">
                <div class="copyable-report-content" id="${copyPrefix}summary-table" data-copy-format="html">
                  ${renderFactorySummaryTable(matrix, context)}
                </div>
              </div>
              <div class="factory-col-chart">
                <div class="chart-box-stacked copyable-report-content ${currentChartView === 'stacked' ? '' : 'is-hidden'}" id="${copyPrefix}department-stacked-chart" data-copy-format="image">
                  ${renderStackedDepartmentChart(matrix, context)}
                </div>
                <div class="chart-box-clustered copyable-report-content ${currentChartView === 'clustered' ? '' : 'is-hidden'}" id="${copyPrefix}department-clustered-chart" data-copy-format="image">
                  ${renderClusteredDepartmentChart(matrix, context)}
                </div>
              </div>
            </div>
          </div>

          <!-- Card 2: Tiến độ & Tích lũy Triển khai Đối sách -->
          <div class="factory-section-card">
            <div class="factory-card-header">
              <div class="card-header-left">
                <span class="card-header-icon icon-green"><i class="fa-solid fa-arrow-trend-up"></i></span>
                <div>
                  <h3 class="card-header-title">Tiến Độ & Tích Lũy Triển Khai Đối Sách</h3>
                  <span class="card-header-sub">So sánh số lượng phát hiện, giải pháp đã xử lý và tốc độ tích lũy 12 tháng</span>
                </div>
              </div>
              <div class="card-header-right">
                <button type="button" class="btn-card-copy" data-action="copy-report-target" data-copy-format="html" data-copy-target="${copyPrefix}progress-table" title="Copy bảng số liệu">
                  <i class="fa-regular fa-copy"></i> Copy Bảng
                </button>
                <button type="button" class="btn-card-copy" data-action="copy-report-target" data-copy-format="image" data-copy-target="${copyPrefix}progress-chart" title="Copy biểu đồ ảnh">
                  <i class="fa-regular fa-image"></i> Copy Biểu Đồ
                </button>
              </div>
            </div>
            <div class="factory-card-body factory-grid-pair">
              <div class="factory-col-table">
                <div class="copyable-report-content" id="${copyPrefix}progress-table" data-copy-format="html">
                  ${renderProgressTable(monthTotals, countermeasureTotals, filters.year, context)}
                </div>
              </div>
              <div class="factory-col-chart">
                <div class="copyable-report-content" id="${copyPrefix}progress-chart" data-copy-format="image">
                  ${renderProgressChart(monthTotals, countermeasureTotals, context)}
                </div>
              </div>
            </div>
          </div>

          <!-- Card 3: Tỉ lệ Lũy Kế Hoàn Thành Đối Sách Theo Tháng -->
          <div class="factory-section-card">
            <div class="factory-card-header">
              <div class="card-header-left">
                <span class="card-header-icon icon-amber"><i class="fa-solid fa-percent"></i></span>
                <div>
                  <h3 class="card-header-title">Tỉ Lệ Triển Khai Đối Sách AT Năm ${escapeHtml(filters.year)}</h3>
                  <span class="card-header-sub">Đo lường tỉ lệ phần trăm lũy kế hoàn thành giải pháp so với đường mục tiêu</span>
                </div>
              </div>
              <div class="card-header-right">
                <button type="button" class="btn-card-copy" data-action="copy-report-target" data-copy-format="image" data-copy-target="${copyPrefix}monthly-rate-chart" title="Copy biểu đồ ảnh">
                  <i class="fa-regular fa-image"></i> Copy Biểu Đồ
                </button>
              </div>
            </div>
            <div class="factory-card-body">
              <div class="copyable-report-content" id="${copyPrefix}monthly-rate-chart" data-copy-format="image">
                ${renderMonthlyRateChart(monthTotals, countermeasureTotals, filters.year, context)}
              </div>
            </div>
          </div>

        </div>

        <!-- ══════════════════════════════════════════════════════════════════════════
             TAB PANE 2: PHÂN TÍCH CẤP ĐỘ & STOP 6
             ══════════════════════════════════════════════════════════════════════════ -->
        <div class="factory-tab-pane ${currentTab !== 'analysis' && currentTab !== 'all' ? 'is-hidden' : ''}" data-factory-pane="analysis">
          
          <!-- Card 4: Tổng hợp theo Cấp độ Nguy hiểm (Rank A / B / C) -->
          <div class="factory-section-card">
            <div class="factory-card-header">
              <div class="card-header-left">
                <span class="card-header-icon icon-rose"><i class="fa-solid fa-gauge-high"></i></span>
                <div>
                  <h3 class="card-header-title">Tổng Hợp Phân Bổ Theo Cấp Độ Nguy Hiểm (Rank)</h3>
                  <span class="card-header-sub">Phân tích mức độ rủi ro: Cấp A (Nghiêm trọng), Cấp B (Trung bình), Cấp C (Nhẹ)</span>
                </div>
              </div>
              <div class="card-header-right">
                <button type="button" class="btn-card-copy" data-action="copy-report-target" data-copy-format="html" data-copy-target="${copyPrefix}rank-table" title="Copy bảng số liệu">
                  <i class="fa-regular fa-copy"></i> Copy Bảng
                </button>
                <button type="button" class="btn-card-copy" data-action="copy-report-target" data-copy-format="image" data-copy-target="${copyPrefix}rank-chart" title="Copy biểu đồ ảnh">
                  <i class="fa-regular fa-image"></i> Copy Biểu Đồ
                </button>
              </div>
            </div>
            <div class="factory-card-body factory-grid-pair">
              <div class="factory-col-table">
                <div class="copyable-report-content" id="${copyPrefix}rank-table" data-copy-format="html">
                  ${renderRankSummaryTable(rankMatrix, context)}
                </div>
              </div>
              <div class="factory-col-chart">
                <div class="copyable-report-content" id="${copyPrefix}rank-chart" data-copy-format="image">
                  ${renderRankChart(rankMatrix, context)}
                </div>
              </div>
            </div>
          </div>

          <!-- Card 5: Phân loại Tai nạn Chỉ định STOP 6 -->
          <div class="factory-section-card">
            <div class="factory-card-header">
              <div class="card-header-left">
                <span class="card-header-icon icon-purple"><i class="fa-solid fa-shield-virus"></i></span>
                <div>
                  <h3 class="card-header-title">Tổng Hợp Phân Loại Tai Nạn Chỉ Định STOP 6</h3>
                  <span class="card-header-sub">Thống kê 7 nhóm tai nạn trọng điểm cần kiểm soát tuyệt đối trong nhà máy</span>
                </div>
              </div>
              <div class="card-header-right">
                <button type="button" class="btn-card-copy" data-action="copy-report-target" data-copy-format="html" data-copy-target="${copyPrefix}stop6-table" title="Copy bảng số liệu">
                  <i class="fa-regular fa-copy"></i> Copy Bảng
                </button>
                <button type="button" class="btn-card-copy" data-action="copy-report-target" data-copy-format="image" data-copy-target="${copyPrefix}stop6-chart" title="Copy biểu đồ ảnh">
                  <i class="fa-regular fa-image"></i> Copy Biểu Đồ
                </button>
              </div>
            </div>
            <div class="factory-card-body factory-grid-pair">
              <div class="factory-col-table">
                <div class="copyable-report-content" id="${copyPrefix}stop6-table" data-copy-format="html">
                  ${renderStop6SummaryTable(stop6Matrix, context)}
                </div>
              </div>
              <div class="factory-col-chart">
                <div class="copyable-report-content" id="${copyPrefix}stop6-chart" data-copy-format="image">
                  ${renderStop6Chart(stop6Matrix, context)}
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- ══════════════════════════════════════════════════════════════════════════
             TAB PANE 3: CHI TIẾT BỘ PHẬN & NHẬT KÝ
             ══════════════════════════════════════════════════════════════════════════ -->
        <div class="factory-tab-pane ${currentTab !== 'detail' && currentTab !== 'all' ? 'is-hidden' : ''}" data-factory-pane="detail">
          
          <!-- Card 6: Bảng Tổng Hợp Theo Zone Từng Bộ Phận -->
          <div class="factory-section-card">
            <div class="factory-card-header">
              <div class="card-header-left">
                <span class="card-header-icon icon-blue"><i class="fa-solid fa-sitemap"></i></span>
                <div>
                  <h3 class="card-header-title">Tổng Hợp Từng Bộ Phận Trong Năm</h3>
                  <span class="card-header-sub">${escapeHtml(summaryLabel)} · Thống kê chỉ tiêu và trạng thái xử lý theo Zone</span>
                </div>
              </div>
              <div class="card-header-right">
                <button type="button" class="btn-card-copy" data-action="copy-report-target" data-copy-format="html" data-copy-target="${copyPrefix}department-summary-${safeDomId(selectedDepartment || 'tong-hop')}" title="Copy bảng tổng hợp bộ phận">
                  <i class="fa-regular fa-copy"></i> Copy Bảng
                </button>
              </div>
            </div>
            <div class="factory-card-body">
              ${renderDepartmentTabs(groups, selectedDepartment, filters.year, context)}
              <div class="copyable-report-content mt-3" id="${copyPrefix}department-summary-${safeDomId(selectedDepartment || 'tong-hop')}" data-copy-format="html">
                ${departmentSummaryHtml}
              </div>
            </div>
          </div>

          <!-- Card 7: Bảng Theo Dõi Nhận Dạng Nguy Hiểm & Hoạt Động Khắc Phục -->
          <div class="factory-section-card">
            <div class="factory-card-header">
              <div class="card-header-left">
                <span class="card-header-icon icon-green"><i class="fa-solid fa-list-check"></i></span>
                <div>
                  <h3 class="card-header-title">BẢNG THEO DÕI NHẬN DẠNG NGUY HIỂM VÀ KHẮC PHỤC</h3>
                  <span class="card-header-sub">HAZARD IDENTIFICATION &amp; ACTIVITY FOLLOW UP SHEET · Nhật ký chi tiết kèm ảnh hiện trường</span>
                </div>
              </div>
              <div class="card-header-right">
                <button type="button" class="btn-card-copy" data-action="copy-report-target" data-copy-format="html" data-copy-target="${copyPrefix}department-detail-${safeDomId(selectedDepartment || 'tong-hop')}" title="Copy bảng chi tiết">
                  <i class="fa-regular fa-copy"></i> Copy Nhật Ký
                </button>
              </div>
            </div>
            <div class="factory-card-body">
              <div class="copyable-report-content" id="${copyPrefix}department-detail-${safeDomId(selectedDepartment || 'tong-hop')}" data-copy-format="html">
                ${departmentDetailHtml}
              </div>
            </div>
          </div>

        </div>

      </section>
    `;
  }

  function renderSafetyAssessmentStatusChart(monthRows, context) {
    const escapeHtml = context.escapeHtml;
    const orderedStatuses = ["open", "in_progress", "overdue", "closed"];
    const options = (context.ISSUE_STATUS_OPTIONS || [])
      .filter((option) => orderedStatuses.includes(option.value))
      .sort((a, b) => orderedStatuses.indexOf(a.value) - orderedStatuses.indexOf(b.value));
    const counts = options.map((option) => ({ ...option, count: 0 }));
    const byStatus = new Map(counts.map((item) => [item.value, item]));

    monthRows.forEach((row) => {
      const status = issueStatusOf(row, context);
      const entry = byStatus.get(status) || byStatus.get("open");
      if (entry) {
        entry.count += issueWeight(row, context);
      }
    });

    const total = counts.reduce((sum, item) => sum + item.count, 0);
    if (!total) {
      return '<section class="safety-assessment-chart-panel"><div class="admin-card-chart-empty">Chưa có dữ liệu tình trạng AT.</div></section>';
    }

    return '<section class="safety-assessment-chart-panel">' +
      '<div class="admin-card-chart-head"><strong>Biểu đồ tình trạng AT</strong><span>' + escapeHtml(countCell(total)) + ' nhận diện</span></div>' +
      '<div class="safety-assessment-status-chart">' + counts.map((item) => {
        const percent = total ? Math.round((item.count / total) * 100) : 0;
        return '<div class="safety-assessment-status-row is-' + escapeHtml(item.value) + '">' +
          '<span>' + escapeHtml(item.label) + '</span>' +
          '<i><b style="width:' + escapeHtml(String(percent)) + '%"></b></i>' +
          '<strong>' + escapeHtml(countCell(item.count)) + '</strong>' +
        '</div>';
      }).join("") + '</div>' +
    '</section>';
  }

  function renderSafetyAssessmentMonthlyChart(yearRows, filters, context) {
    const escapeHtml = context.escapeHtml;
    const monthTotals = MONTHS.map((month) => sumIssueCounts(yearRows.filter((row) => monthOf(row, context) === month), context));
    const countermeasureTotals = MONTHS.map((month) => sumIssueCounts(yearRows.filter((row) => monthOf(row, context) === month && hasCountermeasure(row, context)), context));
    const max = Math.max(1, ...monthTotals, ...countermeasureTotals);
    const hasData = monthTotals.some((value) => value) || countermeasureTotals.some((value) => value);

    if (!hasData) {
      return '<section class="safety-assessment-chart-panel"><div class="admin-card-chart-empty">Chưa có dữ liệu AT theo tháng.</div></section>';
    }

    return '<section class="safety-assessment-chart-panel">' +
      '<div class="admin-card-chart-head"><strong>Nhận diện AT theo tháng ' + escapeHtml(filters.year) + '</strong><span>Số nhận diện / Đối sách triển khai</span></div>' +
      '<div class="safety-assessment-month-chart" aria-hidden="true">' + MONTHS.map((month, index) => {
        const detected = monthTotals[index] || 0;
        const countermeasure = countermeasureTotals[index] || 0;
        const detectedHeight = detected ? Math.max(3, Math.round((detected / max) * 158)) : 0;
        const counterHeight = countermeasure ? Math.max(3, Math.round((countermeasure / max) * 158)) : 0;
        return '<span>' +
          '<i class="assessment-month-detected ' + (detected ? '' : 'is-empty') + '" style="height:' + escapeHtml(String(detectedHeight)) + 'px"><b>' + escapeHtml(numberCell(detected)) + '</b></i>' +
          '<i class="assessment-month-counter ' + (countermeasure ? '' : 'is-empty') + '" style="height:' + escapeHtml(String(counterHeight)) + 'px"><b>' + escapeHtml(numberCell(countermeasure)) + '</b></i>' +
          '<em>T' + escapeHtml(String(month)) + '</em>' +
        '</span>';
      }).join("") + '</div>' +
      '<div class="admin-card-chart-legend safety-assessment-month-legend"><span><i></i>Số nhận diện</span><span><i class="assessment-counter-legend"></i>Đối sách triển khai</span></div>' +
    '</section>';
  }

  function renderSafetyAssessmentCharts(filters, monthRows, yearRows, context) {
    if (!context.isAdminAccount?.(context.currentUser)) {
      return "";
    }
    return '<div class="safety-assessment-chart-grid">' +
      renderSafetyAssessmentStatusChart(monthRows, context) +
      renderSafetyAssessmentMonthlyChart(yearRows, filters, context) +
    '</div>';
  }
  function renderSafetyAssessmentCard(filters, monthRows, yearRows, visibleAreas, reportPeriod, context) {
    const { escapeHtml } = context;
    const zoneText = visibleAreas.length === 1 ? "Zone " + visibleAreas[0].code + " · " : "";
    const pageKey = [filters.year, filters.month, visibleAreas.map((area) => area.id).join(","), reportPeriod?.id || ""].join("|");
    const pagination = getPaginationState("assessment", pageKey, monthRows.length);
    const pagedRows = monthRows.slice(pagination.startIndex, pagination.endIndex);
    const pager = renderSafetyPager("assessment", pagination, monthRows.length, context);
    const caption = zoneText + "Tháng " + filters.month + "/" + filters.year + " · " + monthRows.length + " vấn đề";
    const emptyMessage = "Chưa có báo cáo đánh giá an toàn trong tháng " + filters.month + "/" + filters.year + ".";
    const tableHtml = pager +
      '<div class="table-wrap wide-table-wrap" data-drag-scroll><table class="safety-table">' + renderSafetyTableHtml(pagedRows, reportPeriod, context, emptyMessage, pagination.startIndex) + '</table></div>' +
      pager;
    return '<section class="dashboard-card wide safety-report-card safety-assessment-card">' +
      '<div class="section-heading excel-title-heading"><h2>ĐÁNH GIÁ AN TOÀN</h2><span>' + escapeHtml(caption) + '</span></div>' +
      copyableReportBlock("safety-assessment-" + (reportPeriod?.id || filters.year + "-" + filters.month), tableHtml, "Copy", context) +
      renderSafetyAssessmentCharts(filters, monthRows, yearRows, context) +
      '</section>';
  }

  function renderSafetyReportMenu(context) {
    const { elements, escapeHtml, getSafetyReportRoute } = context;
    if (!elements.safetyDashboard) {
      return;
    }

    const cardHtml = getAllowedSafetyReports(context).map((report) => {
      const route = getSafetyReportRoute ? getSafetyReportRoute(report.id) : "/safety";
      return '<a class="safety-report-link-card" href="' + escapeHtml(route) + '" data-go-safety-report="' + escapeHtml(report.id) + '" aria-label="' + escapeHtml(report.title) + '"><strong>' + escapeHtml(report.title) + '</strong></a>';
    }).join("");
    elements.safetyDashboard.innerHTML = '<section class="safety-report-menu" aria-label="Danh sách báo cáo an toàn">' + cardHtml + '</section>';
  }

  function renderSafetyReportRouteBar(reportId, context) {
    return "";
  }

  function renderSafetyDashboard(activeReport, filters, monthRows, yearRows, visibleAreas, groups, selectedDepartment, reportPeriod, context) {
    const { elements } = context;
    if (!elements.safetyDashboard) {
      return;
    }
    if (!activeReport) {
      renderSafetyReportMenu(context);
      return;
    }

    const reportHtml = activeReport === "assessment"
      ? renderSafetyAssessmentCard(filters, monthRows, yearRows, visibleAreas, reportPeriod, context)
      : activeReport === "identification"
        ? renderRiskIdentificationCard(filters, monthRows, visibleAreas, reportPeriod?.id || "", context)
        : renderAnnualFactoryCard(filters, yearRows, groups, selectedDepartment, reportPeriod, context);
    elements.safetyDashboard.innerHTML = reportHtml;
  }

  function render(context) {
    const { SAFETY_PERIOD_TYPE, canUseSafety, elements, escapeHtml, getActivePeriodId, getIssueRecords, getPeriod, getSafetyRowsForYear, isPeriodArchived } = context;
    const requestedReport = getSafetyReportDefinition(context.activeSafetyReport || "assessment", context);
    const activeReport = normalizeSafetyReportForUser(requestedReport?.id || "assessment", context);
    setSafetyToolbarMode(activeReport, context);
    if (!activeReport) {
      renderSafetyReportMenu(context);
      return;
    }

    const activePeriod = getPeriod(elements.safetyPeriodSelect?.value || getActivePeriodId(SAFETY_PERIOD_TYPE));
    const activePeriodId = activePeriod?.id || "";
    const isCurrentPeriodOpen = Boolean(activePeriodId) && activePeriodId === getActivePeriodId(SAFETY_PERIOD_TYPE);
    const isAdmin = Boolean(context.isAdminAccount?.(context.currentUser));
    const shouldUseAdminScope = activeReport === "assessment" || activeReport === "identification" || activeReport === "factory";

    if (!isAdmin && !shouldUseAdminScope && (!activePeriodId || !isCurrentPeriodOpen)) {
      if (elements.safetyDashboard) {
        elements.safetyDashboard.innerHTML = '<section class="dashboard-card wide"><div class="admin-card-chart-empty" style="padding: 40px; text-align: center; color: var(--text-muted, #64748b);">Kỳ đánh giá an toàn này hiện không mở. Bạn chỉ có thể xem và đánh giá kỳ đang mở.</div></section>';
      }
      if (elements.addSafetyRecordButton) {
        elements.addSafetyRecordButton.disabled = true;
        elements.addSafetyRecordButton.title = "Kỳ này không mở";
      }
      if (elements.editSafetyMetaButton) {
        elements.editSafetyMetaButton.disabled = true;
        elements.editSafetyMetaButton.title = "Kỳ này không mở";
      }
      return;
    }

    const filters = syncSafetyFilters(context, activePeriod);
    const areaFilter = activeReport === "assessment" ? elements.safetyAreaFilter?.value || "" : "";
    const reportPeriod = getMonthPeriod(context, filters.year, filters.month, activePeriod);
    const reportPeriodId = reportPeriod?.id || activePeriodId;
    const visibleAreas = shouldUseAdminScope
      ? getAllReportableAreas(context, reportPeriodId, areaFilter)
      : getVisibleAreas(context, reportPeriodId, areaFilter);
    const groups = shouldUseAdminScope
      ? getAllDepartmentGroups(context, reportPeriodId, areaFilter)
      : getVisibleDepartmentGroups(context, reportPeriodId, areaFilter);
    const selectedDepartment = syncDepartmentFilter(context, groups, filters.year);
    const visibleAreaIds = new Set(visibleAreas.map((area) => area.id));
    const rawYearRows = getSafetyRowsForYear(filters.year, { areaId: areaFilter }).filter((row) => visibleAreaIds.has(row.area.id));
    const rawMonthRows = filterRowsByMonth(rawYearRows, filters.month, context);
    const yearRows = isAdmin || shouldUseAdminScope ? rawYearRows : rawYearRows.filter((row) => row.score.periodId === activePeriodId);
    const monthRows = isAdmin || shouldUseAdminScope ? rawMonthRows : rawMonthRows.filter((row) => row.score.periodId === activePeriodId);
    const canAdd = canUseSafety(context.currentUser) && !isPeriodArchived(activePeriodId) && (isAdmin || isCurrentPeriodOpen);

    if (elements.addSafetyRecordButton) {
      elements.addSafetyRecordButton.disabled = !canAdd;
      elements.addSafetyRecordButton.title = canAdd ? "Thêm báo cáo an toàn" : "Chỉ xem";
    }
    if (elements.editSafetyMetaButton) {
      elements.editSafetyMetaButton.disabled = !canAdd;
      elements.editSafetyMetaButton.title = canAdd ? "Thiết lập báo cáo" : "Chỉ xem";
    }

    renderSafetyDashboard(activeReport, filters, monthRows, yearRows, visibleAreas, groups, selectedDepartment, reportPeriod, context);
  }

  document.addEventListener("click", (event) => {
    const navBtn = event.target.closest(".factory-nav-pill");
    if (navBtn) {
      const targetTab = navBtn.dataset.factoryTab;
      if (!targetTab) return;
      activeFactoryTab = targetTab;
      const card = navBtn.closest(".factory-risk-dashboard-card");
      if (!card) return;
      card.querySelectorAll(".factory-nav-pill").forEach((btn) => {
        btn.classList.toggle("is-active", btn === navBtn);
      });
      card.querySelectorAll(".factory-tab-pane").forEach((pane) => {
        if (targetTab === "all") {
          pane.classList.remove("is-hidden");
        } else {
          pane.classList.toggle("is-hidden", pane.dataset.factoryPane !== targetTab);
        }
      });
      return;
    }

    const viewBtn = event.target.closest(".view-toggle-btn");
    if (viewBtn) {
      const viewMode = viewBtn.dataset.chartView;
      if (!viewMode) return;
      activeDepartmentChartView = viewMode;
      const sectionCard = viewBtn.closest(".factory-section-card");
      if (!sectionCard) return;
      sectionCard.querySelectorAll(".view-toggle-btn").forEach((btn) => {
        btn.classList.toggle("is-active", btn === viewBtn);
      });
      const stackedBox = sectionCard.querySelector(".chart-box-stacked");
      const clusteredBox = sectionCard.querySelector(".chart-box-clustered");
      if (stackedBox && clusteredBox) {
        if (viewMode === "stacked") {
          stackedBox.classList.remove("is-hidden");
          clusteredBox.classList.add("is-hidden");
        } else {
          stackedBox.classList.add("is-hidden");
          clusteredBox.classList.remove("is-hidden");
        }
      }
      return;
    }

    const exportBtn = event.target.closest('[data-action="export-safety-excel"]');
    if (exportBtn) {
      document.getElementById("export-safety-excel-button")?.click();
      return;
    }
  });

  window.SafetyPage = {
    setDetailPage(type, page) {
      setSafetyPage(type, page);
    },
  };

  window.PageRegistry.register({
    id: "safety",
    title: "Đánh giá an toàn",
    render,
  });
})();
