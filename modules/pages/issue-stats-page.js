(() => {
  "use strict";

  const MONTH_NAMES = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
  ];
  let initialized = false;

  function setOptions(select, options, selectedValue) {
    if (!select) return "";
    select.innerHTML = options.map((option) =>
      '<option value="' + option.value + '">' + option.label + "</option>"
    ).join("");
    const hasValue = options.some((option) => String(option.value) === String(selectedValue));
    select.value = hasValue ? String(selectedValue) : String(options[0]?.value ?? "");
    return select.value;
  }

  function render(context) {
    const {
      elements,
      getActivePeriodId,
      getPeriod,
      getSafetyFilterYears,
      getSafetyRowsForYear,
      getSafetyRecordIssueDate,
      SAFETY_PERIOD_TYPE,
    } = context;
    const { issueStatsYearFilter, issueStatsMonthFilter, issueStatsDayFilter, issueStatsTotal, issueStatsDashboard } = elements;
    if (!issueStatsDashboard || !issueStatsYearFilter || !issueStatsMonthFilter || !issueStatsDayFilter) return;

    const years = getSafetyFilterYears({})
      .filter((year) => getSafetyRowsForYear(year, {}).length > 0);
    const activePeriod = getPeriod(getActivePeriodId(SAFETY_PERIOD_TYPE));
    const safetyYear = Number(elements.safetyYearFilter?.value) || Number(activePeriod?.year);
    const defaultYear = safetyYear || new Date().getFullYear();
    const preferredYear = years.includes(defaultYear) ? defaultYear : years[0];
    const selectedYear = setOptions(
      issueStatsYearFilter,
      years.map((year) => ({ value: year, label: String(year) })),
      initialized ? issueStatsYearFilter.value : preferredYear
    );
    const year = Number(selectedYear) || Number(preferredYear) || defaultYear;
    const yearRows = getSafetyRowsForYear(year, {});
    const availableMonths = [...new Set(yearRows.map((row) => {
      const issueDate = getSafetyRecordIssueDate(row.score, getPeriod(row.score.periodId)) || "";
      return Number(issueDate.slice(5, 7));
    }).filter((month) => Number.isInteger(month) && month >= 1 && month <= 12))]
      .sort((left, right) => right - left);

    const monthOptions = [
      { value: "", label: "Tất cả tháng" },
      ...availableMonths.map((month) => ({ value: month, label: MONTH_NAMES[month - 1] })),
    ];
    const safetyMonth = elements.safetyMonthFilter?.value || "";
    const month = setOptions(
      issueStatsMonthFilter,
      monthOptions,
      initialized ? issueStatsMonthFilter.value : safetyMonth
    );

    const monthRows = month
      ? yearRows.filter((row) => {
        const issueDate = getSafetyRecordIssueDate(row.score, getPeriod(row.score.periodId)) || "";
        return Number(issueDate.slice(5, 7)) === Number(month);
      })
      : [];
    const availableDays = [...new Set(monthRows.map((row) => {
      const issueDate = getSafetyRecordIssueDate(row.score, getPeriod(row.score.periodId)) || "";
      return Number(issueDate.slice(8, 10));
    }).filter((day) => Number.isInteger(day) && day >= 1 && day <= 31))]
      .sort((left, right) => left - right);
    const dayOptions = [
      { value: "", label: "Tất cả ngày" },
      ...availableDays.map((day) => ({ value: day, label: "Ngày " + day })),
    ];
    issueStatsDayFilter.disabled = !month;
    const day = setOptions(
      issueStatsDayFilter,
      dayOptions,
      initialized && month ? issueStatsDayFilter.value : ""
    );

    const rows = yearRows.filter((row) => {
      const issueDate = getSafetyRecordIssueDate(row.score, getPeriod(row.score.periodId)) || "";
      if (month && Number(issueDate.slice(5, 7)) !== Number(month)) return false;
      if (day && Number(issueDate.slice(8, 10)) !== Number(day)) return false;
      return true;
    });

    const periodLabel = day
      ? "Ngày " + String(day).padStart(2, "0") + "/" + String(month).padStart(2, "0") + "/" + year
      : month ? "Tháng " + month + "/" + year : "Năm " + year;
    const totalIssues = rows.reduce((total, row) => total + (Number(context.getIssueCount?.(row)) || 1), 0);

    let closedCount = 0;
    let inProgressCount = 0;
    let openCount = 0;
    let overdueCount = 0;
    let rankACount = 0;

    rows.forEach((row) => {
      const count = Number(context.getIssueCount?.(row)) || 1;
      const status = context.normalizeIssueStatus?.(row?.score?.issueStatus) || "open";
      if (status === "closed") closedCount += count;
      else if (status === "in_progress") inProgressCount += count;
      else if (status === "overdue") overdueCount += count;
      else openCount += count;

      if (context.isSafetyLevelSelected?.(row.score, "A")) {
        rankACount += count;
      }
    });

    const completionRate = totalIssues ? Math.round((closedCount / totalIssues) * 100) : 100;

    if (issueStatsTotal) {
      const escapeHtml = context.escapeHtml || ((str) => String(str || "").replace(/[&<>'"]/g, (tag) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[tag] || tag)));
      issueStatsTotal.className = "issue-stats-kpi-container";
      issueStatsTotal.innerHTML = `
        <div class="issue-stats-overview-header">
          <div class="overview-title-block">
            <div class="overview-icon-badge"><i class="fa-solid fa-chart-pie"></i></div>
            <div>
              <h2 class="overview-heading">Thống Kê An Toàn Nhà Máy</h2>
              <p class="overview-subtext">Tổng hợp chỉ số rủi ro, phân loại mối nguy và tiến độ khắc phục</p>
            </div>
          </div>
          <div class="overview-period-chip">
            <i class="fa-regular fa-calendar-check"></i>
            <span>${escapeHtml(periodLabel)}</span>
          </div>
        </div>

        <div class="issue-stats-kpi-grid">
          <div class="issue-stats-kpi-card is-kpi-total">
            <div class="kpi-card-head">
              <span class="kpi-card-label">Tổng số vấn đề</span>
              <span class="kpi-icon kpi-icon-blue"><i class="fa-solid fa-triangle-exclamation"></i></span>
            </div>
            <div class="kpi-card-main">
              <span class="kpi-number">${totalIssues.toLocaleString("vi-VN")}</span>
              <span class="kpi-tag kpi-tag-neutral"><i class="fa-solid fa-circle-dot"></i> Ghi nhận</span>
            </div>
            <div class="kpi-card-footer">
              <span>Số lượng phát hiện trong kỳ</span>
            </div>
          </div>

          <div class="issue-stats-kpi-card is-kpi-closed">
            <div class="kpi-card-head">
              <span class="kpi-card-label">Đã khắc phục</span>
              <span class="kpi-icon kpi-icon-green"><i class="fa-solid fa-circle-check"></i></span>
            </div>
            <div class="kpi-card-main">
              <span class="kpi-number">${closedCount.toLocaleString("vi-VN")}</span>
              <span class="kpi-tag kpi-tag-success"><i class="fa-solid fa-arrow-trend-up"></i> ${completionRate}%</span>
            </div>
            <div class="kpi-card-footer">
              <div class="kpi-mini-progress">
                <div class="kpi-mini-progress-fill" style="width: ${completionRate}%;"></div>
              </div>
              <span class="kpi-mini-progress-label">Tỷ lệ hoàn thành biện pháp đối sách</span>
            </div>
          </div>

          <div class="issue-stats-kpi-card is-kpi-pending">
            <div class="kpi-card-head">
              <span class="kpi-card-label">Đang & Chờ đối sách</span>
              <span class="kpi-icon kpi-icon-amber"><i class="fa-solid fa-clock-rotate-left"></i></span>
            </div>
            <div class="kpi-card-main">
              <span class="kpi-number">${(openCount + inProgressCount).toLocaleString("vi-VN")}</span>
              <span class="kpi-tag kpi-tag-warning">${openCount} chờ · ${inProgressCount} đang làm</span>
            </div>
            <div class="kpi-card-footer">
              <span>Đang theo dõi xử lý đối sách</span>
            </div>
          </div>

          <div class="issue-stats-kpi-card ${overdueCount > 0 || rankACount > 0 ? "is-kpi-danger" : "is-kpi-safe"}">
            <div class="kpi-card-head">
              <span class="kpi-card-label">Nguy cơ trọng yếu</span>
              <span class="kpi-icon kpi-icon-rose"><i class="fa-solid fa-shield-virus"></i></span>
            </div>
            <div class="kpi-card-main">
              <span class="kpi-number">${rankACount.toLocaleString("vi-VN")} <small>Rank A</small></span>
              <span class="kpi-tag ${overdueCount > 0 ? "kpi-tag-danger" : "kpi-tag-safe"}">${overdueCount > 0 ? `${overdueCount} quá hạn` : "0 quá hạn"}</span>
            </div>
            <div class="kpi-card-footer">
              <span>${overdueCount > 0 ? "Cần ưu tiên xử lý khẩn cấp" : "Tiến độ trong tầm kiểm soát"}</span>
            </div>
          </div>
        </div>
      `;
    }
    issueStatsDashboard.innerHTML = window.SafetyPage.renderStatisticsDashboard(rows, {
      year,
      month,
      day,
      periodLabel,
    }, context);
    initialized = true;
  }

  window.PageRegistry.register({
    id: "issue-stats",
    title: "Thống kê an toàn",
    render,
  });
})();
