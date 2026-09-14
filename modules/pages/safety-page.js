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
    return Boolean(context.isAdminAccount?.(context.currentUser));
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
    setFieldVisible(elements.safetyAreaFilter, isAssessment || isIdentification);
    setFieldVisible(elements.safetyDepartmentFilter, isFactory);

    const isAdmin = Boolean(context.isAdminAccount?.(context.currentUser));
    setButtonVisible(elements.addSafetyRecordButton, isAssessment, context);
    setButtonVisible(elements.editSafetyMetaButton, isAssessment && isAdmin, context);
    setButtonVisible(elements.sendSafetyMailButton, isAssessment && isAdmin, context);
    setButtonVisible(elements.exportSafetyExcelButton, Boolean(reportId) && isAdmin, context);
    const safetyToolbar = elements.safetyPeriodSelect?.closest?.(".safety-toolbar");
    if (safetyToolbar) {
      safetyToolbar.querySelectorAll('[data-action="import-page-json"], [data-action="export-page-json"]').forEach((btn) => {
        btn.hidden = !isAssessment || !isAdmin;
      });
    }
    if (elements.exportSafetyExcelButton) {
      elements.exportSafetyExcelButton.textContent = isFactory
        ? "Xuất tổng hợp nguy cơ"
        : isIdentification
          ? "Xuất tổng hợp nhận diện"
          : "Xuất ĐG AT";
    }
  }

  function syncSafetyFilters(context, period) {
    const { elements, escapeHtml, getSafetyFilterMonths, getSafetyFilterYears, isAdminAccount, currentUser } = context;
    const isAdmin = Boolean(isAdminAccount?.(currentUser));
    const areaId = context.activeSafetyReport === "factory" ? "" : elements.safetyAreaFilter?.value || "";
    const openYear = Number(period?.year) || new Date().getFullYear();
    const openMonth = Number(period?.month) || new Date().getMonth() + 1;

    let years = typeof getSafetyFilterYears === "function" ? getSafetyFilterYears({ areaId }) : [];
    if (!isAdmin) {
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
    if (!isAdmin) {
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
      const visibleMonths = !isAdmin ? [openMonth] : months;
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

  function getVisibleAreas(context, periodId, areaFilter = "") {
    const { getAreasForPeriod } = context;
    const areaIds = getVisibleAreaIds(context, periodId);
    return getAreasForPeriod(periodId).filter((area) => isReportableSafetyArea(area) && areaIds.has(area.id) && (!areaFilter || area.id === areaFilter));
  }

  function getVisibleDepartmentGroups(context, periodId, areaFilter = "") {
    const visibleAreaIds = getVisibleAreaIds(context, periodId);
    return context.getSafetyDepartmentGroups(periodId)
      .map((group) => ({
        ...group,
        areas: group.areas.filter((area) => isReportableSafetyArea(area) && visibleAreaIds.has(area.id) && (!areaFilter || area.id === areaFilter)),
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

  function renderZoneGoalChart(stats, month, year, context) {
    const { escapeHtml } = context;
    if (!stats.length) {
      return '<div class="excel-empty-chart">Chưa có zone để dựng biểu đồ.</div>';
    }
    const left = 44;
    const top = 28;
    const plotHeight = 160;
    const bottom = 58;
    const step = 52;
    const plotWidth = Math.max(1040, stats.length * step);
    const width = left + plotWidth + 28;
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
      return `<g><line x1="${left}" y1="${y}" x2="${left + plotWidth}" y2="${y}" class="excel-grid-line"></line><text x="8" y="${y + 4}" class="excel-axis-label">${escapeHtml(value)}</text></g>`;
    }).join("");

    const bars = stats.map((stat, index) => {
      const x = left + index * step + step / 2;
      const actualHeight = stat.total ? Math.max(3, (stat.total / max) * plotHeight) : 0;
      const closedHeight = stat.countermeasure ? Math.max(3, (stat.countermeasure / max) * plotHeight) : 0;
      const actualY = top + plotHeight - actualHeight;
      const closedY = top + plotHeight - closedHeight;
      const targetY = chartY(stat.target, max, top, plotHeight);
      return `<g>
        <rect x="${x - 12}" y="${actualY}" width="10" height="${actualHeight}" class="zone-bar-open"><title>Zone ${escapeHtml(stat.code)}: ${escapeHtml(stat.total)} vấn đề</title></rect>
        <rect x="${x + 2}" y="${closedY}" width="10" height="${closedHeight}" class="zone-bar-closed"><title>Zone ${escapeHtml(stat.code)}: ${escapeHtml(stat.countermeasure || 0)} đối sách triển khai</title></rect>
        <circle cx="${x}" cy="${targetY}" r="2.6" class="zone-target-dot"></circle>
        <text x="${x}" y="${Math.min(actualY, closedY, targetY) - 5}" class="excel-bar-label">${escapeHtml(stat.total || "")}</text>
        <text x="${x}" y="${height - 38}" class="excel-zone-label">Zone ${escapeHtml(stat.code)}</text>
        <text x="${x}" y="${height - 20}" class="excel-owner-label">${escapeHtml(stat.responsible)}</text>
      </g>`;
    }).join("");

    return `<div class="excel-chart-panel zone-target-panel">
      <h3>MỤC TIÊU VÀ SỐ VẤN ĐỀ PHÁT HIỆN GIẢI QUYẾT THÁNG ${escapeHtml(month)}/${escapeHtml(year)}</h3>
      <div class="excel-chart-scroll">
        <svg class="excel-zone-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Mục tiêu và số vấn đề theo zone">
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
    const left = config.left || 54;
    const top = config.top || 42;
    const plotHeight = config.plotHeight || 220;
    const plotWidth = Math.max(config.plotWidth || 660, 12 * Math.max(52, series.length * 8));
    const width = left + plotWidth + 24;
    const height = config.height || 332;
    const max = Math.max(10, ...series.flatMap((row) => row.monthly));
    const gridValues = Array.from({ length: 6 }, (_, index) => Math.round((max / 5) * index));
    const step = plotWidth / 12;
    const groupWidth = Math.min(step * 0.8, Math.max(34, series.length * 7));
    const barGap = 1.2;
    const barWidth = Math.max(2.5, Math.min(9, (groupWidth - (series.length - 1) * barGap) / series.length));
    const axisTitle = config.yAxisTitle || "Số vụ";
    const monthPrefix = Object.prototype.hasOwnProperty.call(config, "monthPrefix") ? config.monthPrefix : "T";

    const grid = gridValues.map((value) => {
      const y = chartY(value, max, top, plotHeight);
      return '<g><line x1="' + left + '" y1="' + y + '" x2="' + (left + plotWidth) + '" y2="' + y + '" class="excel-grid-line"></line><text x="8" y="' + (y + 4) + '" class="excel-axis-label">' + escapeHtml(value) + '</text></g>';
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
        const rect = value ? '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" fill="' + fill + '"><title>' + escapeHtml(row.name) + ' T' + month + ': ' + escapeHtml(value) + '</title></rect>' : '';
        return rect + '<text x="' + (x + barWidth / 2) + '" y="' + labelY + '" class="clustered-label">' + escapeHtml(value) + '</text>';
      }).join("");
      return '<g>' + monthBars + '<text x="' + (left + monthIndex * step + step / 2) + '" y="' + (height - 28) + '" class="excel-month-label">' + escapeHtml(monthPrefix + month) + '</text></g>';
    }).join("");

    const legend = series.map((row, index) => '<span><i style="background:' + colors[index % colors.length] + '"></i>' + escapeHtml(row.name) + '</span>').join("");
    const svg = '<svg class="' + escapeHtml(config.className || "") + '" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + escapeHtml(config.title || "Biểu đồ tổng hợp") + '">' +
      grid +
      '<text transform="rotate(-90 18 ' + (top + plotHeight / 2) + ')" x="18" y="' + (top + plotHeight / 2) + '" class="excel-axis-title">' + escapeHtml(axisTitle) + '</text>' +
      bars +
      '</svg>';

    if (config.legendSide) {
      return '<div class="excel-chart-panel clustered-chart-panel"><h3>' + escapeHtml(config.title) + '</h3><div class="excel-chart-with-legend"><div class="excel-chart-scroll">' + svg + '</div><div class="excel-chart-legend vertical">' + legend + '</div></div></div>';
    }

    return '<div class="excel-chart-panel clustered-chart-panel"><h3>' + escapeHtml(config.title) + '</h3><div class="excel-chart-scroll">' + svg + '</div><div class="excel-chart-legend">' + legend + '</div></div>';
  }

  function renderClusteredDepartmentChart(matrix, context) {
    return renderGroupedColumnChart(matrix, {
      title: "Tổng hợp số nhận diện nguy hiểm / bộ phận",
      className: "factory-clustered-chart",
      colors: DEPARTMENT_COLORS,
      legendSide: true,
      monthPrefix: "",
      plotHeight: 230,
      plotWidth: 860,
      height: 348,
      yAxisTitle: "Số vụ",
    }, context);
  }

  function renderRankSummaryTable(matrix, context) {
    const escapeHtml = context.escapeHtml;
    const rows = matrix.map((row) => '<tr><th>' + escapeHtml(row.name) + '</th>' + row.monthly.map((value) => '<td>' + countCell(value) + '</td>').join("") + '</tr>').join("");
    return '<div class="dashboard-table-wrap rank-summary-wrap"><table class="rank-summary-table"><thead><tr><th colspan="13" class="factory-summary-title">TỔNG HỢP THEO CẤP ĐỘ NGUY HIỂM</th></tr><tr><th>Nhà máy</th>' + MONTHS.map((month) => '<th>T' + month + '</th>').join("") + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function renderRankChart(matrix, context) {
    return renderGroupedColumnChart(matrix, {
      title: "TỔNG HỢP NHẬN DIỆN THEO RANK",
      className: "rank-summary-chart",
      colors: RANK_COLORS,
      monthPrefix: "T",
      plotHeight: 220,
      plotWidth: 720,
      height: 332,
      yAxisTitle: "SỐ VỤ",
    }, context);
  }

  function renderStop6SummaryTable(matrix, context) {
    const escapeHtml = context.escapeHtml;
    const rows = matrix.map((row) => '<tr><th>' + escapeHtml(row.name) + '</th>' + row.monthly.map((value) => '<td>' + countCell(value) + '</td>').join("") + '<td>' + countCell(row.total) + '</td></tr>').join("");
    return '<div class="dashboard-table-wrap stop6-summary-wrap"><table class="stop6-summary-table"><thead><tr><th colspan="14" class="factory-summary-title">Tổng Hợp loại tai nạn chỉ định STOP 6</th></tr><tr><th>Nhà máy</th>' + MONTHS.map((month) => '<th>T' + month + '</th>').join("") + '<th>TOTAL</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function renderStop6Chart(matrix, context) {
    return renderGroupedColumnChart(matrix, {
      title: "Tổng hợp nhận diện theo loại stop 6",
      className: "stop6-summary-chart",
      colors: STOP6_COLORS,
      monthPrefix: "T",
      plotHeight: 230,
      plotWidth: 840,
      height: 344,
      yAxisTitle: "SỐ VỤ",
    }, context);
  }

  function renderFactorySummaryTable(matrix, context) {
    const { escapeHtml } = context;
    const totals = MONTHS.map((_, index) => matrix.reduce((sum, row) => sum + row.monthly[index], 0));
    const grandTotal = totals.reduce((sum, value) => sum + value, 0);
    return `<div class="dashboard-table-wrap factory-summary-wrap">
      <table class="factory-summary-table">
        <thead>
          <tr><th colspan="14" class="factory-summary-title">TỔNG HỢP THEO SỐ NHẬN DIỆN</th></tr>
          <tr><th>Tháng</th>${MONTHS.map((month) => `<th>${month}</th>`).join("")}<th></th></tr>
        </thead>
        <tbody>
          ${matrix.map((row) => `<tr><th>${escapeHtml(row.name)}</th>${row.monthly.map((value) => `<td>${numberCell(value)}</td>`).join("")}<td>${numberCell(row.total)}</td></tr>`).join("")}
          <tr class="factory-total-row"><th>Tổng</th>${totals.map((value) => `<td>${numberCell(value)}</td>`).join("")}<td>${numberCell(grandTotal)}</td></tr>
        </tbody>
      </table>
    </div>`;
  }

  function renderStackedDepartmentChart(matrix, context) {
    const { escapeHtml } = context;
    const left = 44;
    const top = 34;
    const plotHeight = 210;
    const plotWidth = 640;
    const width = 910;
    const height = 306;
    const monthTotals = MONTHS.map((_, monthIndex) => matrix.reduce((sum, row) => sum + row.monthly[monthIndex], 0));
    const max = Math.max(10, ...monthTotals);
    const gridValues = Array.from({ length: 6 }, (_, index) => Math.round((max / 5) * index));
    const step = plotWidth / 12;
    const barWidth = Math.min(34, step * 0.58);

    const grid = gridValues.map((value) => {
      const y = chartY(value, max, top, plotHeight);
      return `<g><line x1="${left}" y1="${y}" x2="${left + plotWidth}" y2="${y}" class="excel-grid-line"></line><text x="8" y="${y + 4}" class="excel-axis-label">${escapeHtml(value)}</text></g>`;
    }).join("");

    const bars = MONTHS.map((month, monthIndex) => {
      let currentY = top + plotHeight;
      const parts = matrix.map((row, rowIndex) => {
        const value = row.monthly[monthIndex];
        const segmentHeight = value ? Math.max(2, (value / max) * plotHeight) : 0;
        currentY -= segmentHeight;
        return value ? `<rect x="${left + monthIndex * step + (step - barWidth) / 2}" y="${currentY}" width="${barWidth}" height="${segmentHeight}" fill="${DEPARTMENT_COLORS[rowIndex % DEPARTMENT_COLORS.length]}"><title>${escapeHtml(row.name)} T${month}: ${value}</title></rect>${segmentHeight > 15 ? `<text x="${left + monthIndex * step + step / 2}" y="${currentY + segmentHeight / 2 + 4}" class="stacked-label">${value}</text>` : ""}` : "";
      }).join("");
      return `<g>${parts}<text x="${left + monthIndex * step + step / 2}" y="${height - 28}" class="excel-month-label">${month}</text></g>`;
    }).join("");

    const legend = matrix.map((row, index) => `<span><i style="background:${DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length]}"></i>${escapeHtml(row.name)}</span>`).join("");

    return `<div class="excel-chart-panel stacked-chart-panel">
      <h3>Tổng hợp số nhận diện nguy hiểm / bộ phận</h3>
      <div class="excel-chart-with-legend">
        <svg class="factory-stacked-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Stacked bar theo bộ phận">
          ${grid}
          ${bars}
        </svg>
        <div class="excel-chart-legend vertical">${legend}</div>
      </div>
    </div>`;
  }

  function renderProgressTable(monthTotals, closedTotals) {
    let cumulative = 0;
    let cumulativeClosed = 0;
    const rows = MONTHS.map((month, index) => {
      cumulative += monthTotals[index];
      cumulativeClosed += closedTotals[index];
      const ratio = cumulative ? cumulativeClosed / cumulative : 0;
      return `<tr>
        <th>T${month}</th>
        <td>${numberCell(monthTotals[index])}</td>
        <td>${numberCell(closedTotals[index])}</td>
        <td>${numberCell(cumulative)}</td>
        <td>${numberCell(cumulativeClosed)}</td>
        <td>${formatPercent(ratio)}</td>
        <td>100%</td>
      </tr>`;
    }).join("");

    return `<div class="dashboard-table-wrap progress-summary-wrap">
      <table class="factory-progress-table">
        <thead><tr><th>Nhà máy</th><th>Số nhận diện</th><th>Đối sách triển khai</th><th>Tích lũy số nhận diện</th><th>Tích lũy đối sách triển khai</th><th>Tỉ lệ triển khai đối sách</th><th>Mục tiêu</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  function renderProgressChart(monthTotals, closedTotals, context) {
    const escapeHtml = context.escapeHtml;
    const left = 46;
    const top = 26;
    const plotHeight = 196;
    const plotWidth = 640;
    const width = 740;
    const height = 282;
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
    const barWidth = Math.min(16, step * 0.26);
    const grid = gridValues.map((value) => {
      const y = chartY(value, max, top, plotHeight);
      return '<g><line x1="' + left + '" y1="' + y + '" x2="' + (left + plotWidth) + '" y2="' + y + '" class="excel-grid-line"></line><text x="8" y="' + (y + 4) + '" class="excel-axis-label">' + escapeHtml(value) + '</text></g>';
    }).join("");
    const bars = MONTHS.map((month, index) => {
      const x = left + index * step + step / 2;
      const actualH = monthTotals[index] ? Math.max(3, (monthTotals[index] / max) * plotHeight) : 0;
      const closedH = closedTotals[index] ? Math.max(3, (closedTotals[index] / max) * plotHeight) : 0;
      return '<g>' +
        '<rect x="' + (x - barWidth - 2) + '" y="' + (top + plotHeight - actualH) + '" width="' + barWidth + '" height="' + actualH + '" class="progress-actual"><title>T' + month + ': ' + monthTotals[index] + '</title></rect>' +
        '<rect x="' + (x + 2) + '" y="' + (top + plotHeight - closedH) + '" width="' + barWidth + '" height="' + closedH + '" class="progress-closed"><title>T' + month + ': ' + closedTotals[index] + '</title></rect>' +
        '<text x="' + x + '" y="' + (height - 26) + '" class="excel-month-label">T' + month + '</text>' +
      '</g>';
    }).join("");
    const line = cumulative.map((value, index) => (left + index * step + step / 2).toFixed(1) + ',' + chartY(value, max, top, plotHeight).toFixed(1)).join(" ");
    const closedLine = cumulativeClosed.map((value, index) => (left + index * step + step / 2).toFixed(1) + ',' + chartY(value, max, top, plotHeight).toFixed(1)).join(" ");
    const labels = cumulative.map((value, index) => '<text x="' + (left + index * step + step / 2) + '" y="' + (chartY(value, max, top, plotHeight) - 8) + '" class="excel-bar-label">' + (value || '') + '</text>').join("");
    const closedLabels = cumulativeClosed.map((value, index) => '<text x="' + (left + index * step + step / 2) + '" y="' + (chartY(value, max, top, plotHeight) + 14) + '" class="excel-bar-label">' + (value || '') + '</text>').join("");

    return '<div class="excel-chart-panel progress-chart-panel">' +
      '<h3>TỔNG HỢP NHẬN DIỆN VÀ ĐỐI SÁCH TRIỂN KHAI</h3>' +
      '<svg class="factory-progress-chart" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Chart tích lũy số nhận diện và đối sách">' +
        grid + bars +
        '<polyline points="' + line + '" class="progress-cumulative-line"></polyline>' +
        '<polyline points="' + closedLine + '" class="progress-closed-line"></polyline>' +
        labels + closedLabels +
      '</svg>' +
      '<div class="excel-chart-legend">' +
        '<span><i class="legend-actual"></i>Số nhận diện</span>' +
        '<span><i class="legend-counter"></i>Đối sách triển khai</span>' +
        '<span><i class="legend-cumulative"></i>Tích lũy số nhận diện</span>' +
        '<span><i class="legend-cumulative-closed"></i>Tích lũy đối sách triển khai</span>' +
      '</div>' +
    '</div>';
  }

  function renderMonthlyRateChart(monthTotals, closedTotals, year, context) {
    const escapeHtml = context.escapeHtml;
    const left = 46;
    const top = 30;
    const plotHeight = 214;
    const plotWidth = 760;
    const width = 850;
    const height = 330;
    const max = 1.2;
    const gridValues = [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2];
    const step = plotWidth / 12;
    const barWidth = Math.min(22, step * 0.34);
    const targetY = chartY(1, max, top, plotHeight);
    let cumulativeTotal = 0;
    let cumulativeClosed = 0;
    const cumulativeRates = MONTHS.map((month, index) => {
      cumulativeTotal += Number(monthTotals[index] || 0);
      cumulativeClosed += Number(closedTotals[index] || 0);
      return cumulativeTotal ? cumulativeClosed / cumulativeTotal : 0;
    });
    const grid = gridValues.map((value) => {
      const y = chartY(value, max, top, plotHeight);
      return '<g><line x1="' + left + '" y1="' + y + '" x2="' + (left + plotWidth) + '" y2="' + y + '" class="excel-grid-line"></line><text x="8" y="' + (y + 4) + '" class="excel-axis-label">' + formatPercent(value) + '</text></g>';
    }).join("");
    const bars = MONTHS.map((month, index) => {
      const rate = cumulativeRates[index] || 0;
      const x = left + index * step + step / 2;
      const barHeight = rate ? Math.max(3, (Math.min(rate, max) / max) * plotHeight) : 0;
      const fill = index % 2 === 0 ? "#00b0f0" : "#ffff00";
      return '<g>' +
        '<rect x="' + (x - barWidth / 2) + '" y="' + (top + plotHeight - barHeight) + '" width="' + barWidth + '" height="' + barHeight + '" class="rate-actual" style="fill:' + fill + '"><title>T' + month + ': ' + formatPercent(rate) + '</title></rect>' +
        '<text x="' + x + '" y="' + (top + plotHeight - Math.max(barHeight, 3) - 8) + '" class="excel-bar-label">' + formatPercent(rate) + '</text>' +
        '<text x="' + x + '" y="' + (height - 34) + '" class="excel-month-label">T' + month + '</text>' +
      '</g>';
    }).join("");

    return '<div class="excel-chart-panel rate-chart-panel">' +
      '<h3>Tỉ Lệ Triển Khai Đối Sách AT ' + escapeHtml(year) + '</h3>' +
      '<div class="excel-chart-scroll"><svg class="monthly-rate-chart" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Tỉ lệ lũy kế triển khai đối sách theo tháng">' +
        grid + bars + '<line x1="' + left + '" y1="' + targetY + '" x2="' + (left + plotWidth) + '" y2="' + targetY + '" class="rate-target-line"></line>' +
      '</svg></div>' +
      '<div class="excel-chart-legend"><span><i class="legend-rate"></i>Tỉ lệ triển khai đối sách</span><span><i class="legend-target-line"></i>Mục tiêu</span></div>' +
    '</div>';
  }


  function renderDepartmentTabs(groups, selectedDepartment, year, context) {
    const { escapeHtml } = context;
    const summaryLabel = "TỔNG HỢP " + (year || new Date().getFullYear());
    return '<div class="safety-sheet-tabs">' +
      '<button class="safety-sheet-tab summary-tab ' + (!selectedDepartment ? "is-active" : "") + '" style="--tab-color:#00b050" type="button" data-action="set-safety-department-filter" data-id="">' + escapeHtml(summaryLabel) + '</button>' +
      groups.map((group, index) => '<button class="safety-sheet-tab ' + (group.name === selectedDepartment ? "is-active" : "") + '" style="--tab-color:' + TAB_COLORS[index % TAB_COLORS.length] + '" type="button" data-action="set-safety-department-filter" data-id="' + escapeHtml(group.name) + '">' + escapeHtml(group.name) + '</button>').join("") +
    '</div>';
  }

  function renderSafetyMarkCell(selected, context, extraClass = "", value = "1") {
    const className = selected ? `is-marked ${extraClass}` : "";
    return `<td class="safety-mark-cell ${className}">${selected ? context.escapeHtml(value) : ""}</td>`;
  }

  function renderSafetyRow(row, index, context) {
    const {
      SAFETY_FOUND_COLUMNS,
      SAFETY_LEVEL_COLUMNS,
      SAFETY_STOP6_COLUMNS,
      canUseSafety,
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
      isIssueOpen,
      isPeriodArchived,
      isSafetyFoundSelected,
      isSafetyLevelSelected,
      isSafetyStop6Selected,
    } = context;

    const isRecordPeriodOpen = row.score.periodId === context.getActivePeriodId(context.SAFETY_PERIOD_TYPE);
    const canEdit = canUseSafety(context.currentUser) && (Boolean(context.isAdminAccount?.(context.currentUser)) || isRecordPeriodOpen) && !isPeriodArchived(row.score.periodId);
    const statusLabel = getIssueStatusLabel ? getIssueStatusLabel(row.score.issueStatus) : (isIssueOpen(row.score) ? "Chưa xử lý" : "Đã xử lý");
    const completionDate = getCompletionDateDisplay(row.score);
    const actions = canEdit
      ? `<div class="safety-actions">
          <button class="tiny-button" type="button" data-action="edit-safety-record" data-id="${escapeHtml(row.score.id)}">Sửa</button>
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
      ${SAFETY_LEVEL_COLUMNS.map((column) => renderSafetyMarkCell(isSafetyLevelSelected(row.score, column.value), context, "level-mark")).join("")}
      ${SAFETY_FOUND_COLUMNS.map((column) => renderSafetyMarkCell(isSafetyFoundSelected(row.score, column.value), context, "", getIssueFoundBy(row) || "1")).join("")}
      <td>${escapeHtml(getIssueEmployeeCode(row))}</td>
      <td>${escapeHtml(row.score.improvementContent || "")}</td>
      <td>${row.score.afterPhotoDataUrl ? `<img class="safety-thumb" src="${row.score.afterPhotoDataUrl}" alt="Ảnh sau cải tiến">` : ""}</td>
      <td>${escapeHtml(row.score.actionOwner || "")}</td>
      <td>${escapeHtml(row.score.actionPlan || "")}</td>
      <td>${escapeHtml(completionDate)}</td>
      <td>${escapeHtml(row.score.completionLevelConfirm || "")}</td>
      <td>${escapeHtml(row.score.completionStop6Confirm || "")}</td>
    </tr>`;
  }

  function renderSafetyTableHtml(rows, reportPeriod, context, emptyMessage) {
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
          <th rowspan="3">No</th><th rowspan="3">Vị trí</th><th rowspan="3">Ngày</th><th rowspan="3">Tháng</th><th rowspan="3">Mối nguy hiểm phát hiện được .</th><th rowspan="3">Hình Ảnh Minh Họa</th><th rowspan="3">Số lần phát hiện</th>
          <th colspan="13">${escapeHtml(report.instruction || DEFAULT_SAFETY_REPORT.instruction)}</th>
          <th rowspan="3">Mã nhân viên</th><th rowspan="3">Nội dung cải tiến, xử lý</th><th rowspan="3">Hình ảnh sau cải tiến, xử lý</th><th rowspan="3">Đảm nhiệm</th><th rowspan="3">Kế hoạch</th><th colspan="3">Hoàn thành</th>
        </tr>
        <tr class="safety-main-header"><th colspan="${SAFETY_STOP6_COLUMNS.length}">Phân loại STOP 6</th><th colspan="${SAFETY_LEVEL_COLUMNS.length}">Cấp bậc</th><th colspan="${SAFETY_FOUND_COLUMNS.length}">Phát hiện</th><th rowspan="2">Ngày</th><th rowspan="2">Xác nhận theo cấp độ</th><th rowspan="2">Xác nhận theo loại stop 6</th></tr>
        <tr class="safety-main-header safety-vertical-row">
          ${SAFETY_STOP6_COLUMNS.map((column) => `<th><span>${escapeHtml(column.label)}</span></th>`).join("")}
          ${SAFETY_LEVEL_COLUMNS.map((column) => `<th><span>${escapeHtml(column.label)}</span></th>`).join("")}
          ${SAFETY_FOUND_COLUMNS.map((column) => `<th><span>${escapeHtml(column.label)}</span></th>`).join("")}
        </tr>
      </thead>
      <tbody>${rows.length ? rows.map((row, index) => renderSafetyRow(row, index + 1, context)).join("") : `<tr><td colspan="28" class="empty-cell">${escapeHtml(emptyMessage)}</td></tr>`}</tbody>`;
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
    const summaryLabel = selectedGroup ? selectedGroup.name : "Tổng hợp " + filters.year;
    const emptyDetailMessage = selectedGroup
      ? "Chưa có bảng đánh giá an toàn của " + selectedDepartment + " trong năm " + filters.year + "."
      : "Chưa có bảng đánh giá an toàn trong năm " + filters.year + ".";

    const copyPrefix = "factory-" + filters.year + "-";
    const departmentSummaryHtml = '<div class="dashboard-table-wrap department-zone-summary-wrap" data-drag-scroll>' +
      '<table class="department-zone-summary-table">' +
        '<thead><tr><th>Zone</th><th>Bộ phận</th><th>Mục tiêu tháng</th><th>Số nhận diện năm</th><th>Chưa xử lý</th><th>Đã xử lý</th><th>Đang xử lý</th><th>Quá hạn</th><th>Đối sách triển khai</th></tr></thead>' +
        '<tbody>' + (detailTotals.length ? detailTotals.map((stat) => '<tr><th>Zone ' + escapeHtml(stat.code) + '</th><td>' + escapeHtml(stat.department) + '</td><td>' + escapeHtml(stat.target || "") + '</td><td>' + numberCell(stat.total) + '</td><td>' + numberCell(stat.statusCounts.open) + '</td><td>' + numberCell(stat.statusCounts.closed) + '</td><td>' + numberCell(stat.statusCounts.in_progress) + '</td><td>' + numberCell(stat.statusCounts.overdue) + '</td><td>' + numberCell(stat.countermeasure) + '</td></tr>').join("") : '<tr><td colspan="9" class="empty-cell">Chưa có bộ phận để tổng hợp.</td></tr>') + '</tbody>' +
      '</table>' +
    '</div>';
    const departmentDetailHtml = '<div class="table-wrap wide-table-wrap annual-department-table-wrap" data-drag-scroll>' +
      '<table class="safety-table annual-detail-safety-table">' + renderSafetyTableHtml(detailRows, reportPeriod, context, emptyDetailMessage) + '</table>' +
    '</div>';

    return '<section class="dashboard-card wide excel-report-card factory-risk-card">' +
      '<div class="section-heading excel-title-heading"><h2>TỔNG HỢP NGUY CƠ MẤT AN TOÀN NHÀ MÁY</h2><span>Năm ' + escapeHtml(filters.year) + '</span></div>' +
      '<div class="factory-report-layout">' +
        copyableReportBlock(copyPrefix + "summary-table", renderFactorySummaryTable(matrix, context), "Copy", context) +
        copyableReportBlock(copyPrefix + "department-stacked-chart", renderStackedDepartmentChart(matrix, context), "Copy", context) +
      '</div>' +
      '<div class="factory-clustered-layout">' +
        copyableReportBlock(copyPrefix + "department-clustered-chart", renderClusteredDepartmentChart(matrix, context), "Copy", context) +
        copyableReportBlock(copyPrefix + "monthly-rate-chart", renderMonthlyRateChart(monthTotals, countermeasureTotals, filters.year, context), "Copy", context) +
      '</div>' +
      '<div class="annual-chart-grid">' +
        copyableReportBlock(copyPrefix + "progress-table", renderProgressTable(monthTotals, countermeasureTotals), "Copy", context) +
        copyableReportBlock(copyPrefix + "progress-chart", renderProgressChart(monthTotals, countermeasureTotals, context), "Copy", context) +
      '</div>' +
      '<div class="annual-analysis-grid">' +
        copyableReportBlock(copyPrefix + "rank-table", renderRankSummaryTable(rankMatrix, context), "Copy", context) +
        copyableReportBlock(copyPrefix + "rank-chart", renderRankChart(rankMatrix, context), "Copy", context) +
      '</div>' +
      '<div class="annual-analysis-grid stop6-analysis-grid">' +
        copyableReportBlock(copyPrefix + "stop6-table", renderStop6SummaryTable(stop6Matrix, context), "Copy", context) +
        copyableReportBlock(copyPrefix + "stop6-chart", renderStop6Chart(stop6Matrix, context), "Copy", context) +
      '</div>' +
      '<div class="department-year-summary">' +
        '<div class="section-heading"><h3>Tổng hợp từng bộ phận trong năm</h3><span>' + escapeHtml(summaryLabel) + '</span></div>' +
        renderDepartmentTabs(groups, selectedDepartment, filters.year, context) +
        copyableReportBlock(copyPrefix + "department-summary-" + safeDomId(selectedDepartment || "tong-hop"), departmentSummaryHtml, "Copy", context) +
        copyableReportBlock(copyPrefix + "department-detail-" + safeDomId(selectedDepartment || "tong-hop"), departmentDetailHtml, "Copy", context) +
      '</div>' +
    '</section>';
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
    const caption = zoneText + "Tháng " + filters.month + "/" + filters.year + " · " + monthRows.length + " dòng";
    const emptyMessage = "Chưa có báo cáo đánh giá an toàn trong tháng " + filters.month + "/" + filters.year + ".";
    const tableHtml = '<div class="table-wrap wide-table-wrap" data-drag-scroll><table class="safety-table">' + renderSafetyTableHtml(monthRows, reportPeriod, context, emptyMessage) + '</table></div>';
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

    if (!isAdmin && (!activePeriodId || !isCurrentPeriodOpen)) {
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
    const areaFilter = activeReport === "factory" ? "" : elements.safetyAreaFilter?.value || "";
    const reportPeriod = getMonthPeriod(context, filters.year, filters.month, activePeriod);
    const reportPeriodId = reportPeriod?.id || activePeriodId;
    const visibleAreas = getVisibleAreas(context, reportPeriodId, areaFilter);
    const groups = getVisibleDepartmentGroups(context, reportPeriodId, areaFilter);
    const selectedDepartment = syncDepartmentFilter(context, groups, filters.year);
    const visibleAreaIds = new Set(visibleAreas.map((area) => area.id));
    const rawYearRows = getSafetyRowsForYear(filters.year, { areaId: areaFilter }).filter((row) => visibleAreaIds.has(row.area.id));
    const rawMonthRows = filterRowsByMonth(rawYearRows, filters.month, context);
    const yearRows = isAdmin ? rawYearRows : rawYearRows.filter((row) => row.score.periodId === activePeriodId);
    const monthRows = isAdmin ? rawMonthRows : rawMonthRows.filter((row) => row.score.periodId === activePeriodId);
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

  window.PageRegistry.register({
    id: "safety",
    title: "Đánh giá an toàn",
    render,
  });
})();
