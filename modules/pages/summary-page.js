(() => {
  "use strict";

  const MIN_SVG_WIDTH = 980;
  const DEFAULT_SVG_HEIGHT = 360;
  const ROTATED_SVG_HEIGHT = 440;
  const PLOT_TOP = 42;
  const GROUPED_PLOT_TOP = 60;
  const PLOT_RIGHT = 30;
  const PLOT_BOTTOM = 76;
  const ROTATED_LABEL_PLOT_BOTTOM = 190;
  const PLOT_LEFT = 48;
  const MAX_SCORE = 5;

  function scoreToY(score, plotTop, plotHeight) {
    return plotTop + ((MAX_SCORE - score) / MAX_SCORE) * plotHeight;
  }

  function compactLabel(value, fallback = "-", maxLength = 16) {
    const text = String(value || "").trim();
    if (!text) {
      return fallback;
    }
    return text.length > maxLength ? text.slice(0, Math.max(1, maxLength - 1)) + "..." : text;
  }

  function buildGroupedRanges(rows) {
    return rows.reduce((ranges, row, index) => {
      const label = compactLabel(row.group || row.head || "Khác", "Khác");
      const last = ranges[ranges.length - 1];
      if (last && last.label === label) {
        last.end = index;
      } else {
        ranges.push({ label, start: index, end: index });
      }
      return ranges;
    }, []);
  }

  function chartSvg({ rows, target, escapeHtml, valueDigits = 2, grouped = false, rotateLabels = false, emptyMessage = "Chưa có dữ liệu điểm" }) {
    if (!rows.length) {
      return `<div class="admin-card-chart-empty">${escapeHtml(emptyMessage)}</div>`;
    }

    const svgHeight = rotateLabels ? ROTATED_SVG_HEIGHT : DEFAULT_SVG_HEIGHT;
    const labelStep = grouped ? 88 : rotateLabels ? 132 : 62;
    const svgWidth = Math.max(MIN_SVG_WIDTH, Math.ceil(PLOT_LEFT + PLOT_RIGHT + rows.length * labelStep));
    const plotTop = grouped ? GROUPED_PLOT_TOP : PLOT_TOP;
    const plotBottom = rotateLabels ? ROTATED_LABEL_PLOT_BOTTOM : PLOT_BOTTOM;
    const plotHeight = svgHeight - plotTop - plotBottom;
    const axisY = plotTop + plotHeight;
    const plotWidth = svgWidth - PLOT_LEFT - PLOT_RIGHT;
    const step = plotWidth / rows.length;
    const barWidth = Math.max(12, Math.min(22, step * 0.45));
    const targetY = scoreToY(target, plotTop, plotHeight);
    const gridLines = [0, 1, 2, 3, 4, 5].map((score) => {
      const y = scoreToY(score, plotTop, plotHeight);
      return `<line class="admin-chart-grid-line" stroke="#e2e8f0" stroke-width="1" x1="${PLOT_LEFT}" y1="${y.toFixed(1)}" x2="${svgWidth - PLOT_RIGHT}" y2="${y.toFixed(1)}"></line><text class="admin-chart-y-label" fill="#64748b" font-family="Arial, Helvetica, sans-serif" font-size="10" text-anchor="end" x="${PLOT_LEFT - 8}" y="${(y + 4).toFixed(1)}">${score.toFixed(1)}</text>`;
    }).join("");

    const bars = rows.map((row, index) => {
      const score = Number.isFinite(row.value) ? Math.max(0, Math.min(MAX_SCORE, row.value)) : 0;
      const height = (score / MAX_SCORE) * plotHeight;
      const x = PLOT_LEFT + index * step + (step - barWidth) / 2;
      const y = plotTop + plotHeight - height;
      const valueLabel = Number.isFinite(row.value) ? row.value.toFixed(valueDigits) : "-";
      const xCenter = x + barWidth / 2;

      let labelX = xCenter;
      let labelY = axisY + 30;
      let labelTransform = "";
      let labelAnchor = "middle";

      if (rotateLabels) {
        labelX = xCenter - 4;
        labelY = axisY + 14;
        labelTransform = ` transform="rotate(-38 ${labelX.toFixed(1)} ${labelY.toFixed(1)})"`;
        labelAnchor = "end";
      }

      return `<g>
        <rect class="admin-chart-bar" fill="#12a8e8" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(2, height).toFixed(1)}" rx="2"></rect>
        <text class="admin-chart-value" fill="#1f2937" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="750" text-anchor="middle" x="${xCenter.toFixed(1)}" y="${Math.max(plotTop + 12, y - 5).toFixed(1)}">${escapeHtml(valueLabel)}</text>
        <text class="admin-chart-x-label" fill="#1f2937" font-family="Arial, Helvetica, sans-serif" font-size="10" x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="${labelAnchor}"${labelTransform}>${escapeHtml(compactLabel(row.label, "-", rotateLabels ? 42 : 18))}</text>
      </g>`;
    }).join("");

    const groups = grouped ? buildGroupedRanges(rows).map((group) => {
      const startX = PLOT_LEFT + group.start * step + step * 0.18;
      const endX = PLOT_LEFT + (group.end + 1) * step - step * 0.18;
      const centerX = (startX + endX) / 2;
      return `<g class="admin-chart-group">
        <line stroke="#60a5fa" stroke-width="1" x1="${startX.toFixed(1)}" y1="22" x2="${endX.toFixed(1)}" y2="22"></line>
        <line stroke="#60a5fa" stroke-width="1" x1="${startX.toFixed(1)}" y1="22" x2="${startX.toFixed(1)}" y2="29"></line>
        <line stroke="#60a5fa" stroke-width="1" x1="${endX.toFixed(1)}" y1="22" x2="${endX.toFixed(1)}" y2="29"></line>
        <text fill="#1f2937" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="750" text-anchor="middle" x="${centerX.toFixed(1)}" y="15">${escapeHtml(group.label)}</text>
      </g>`;
    }).join("") : "";

    return `<svg class="admin-card-chart-svg" style="width:${svgWidth}px;height:${svgHeight}px" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-hidden="true" preserveAspectRatio="xMinYMin meet">
      ${groups}
      ${gridLines}
      <line class="admin-chart-axis" stroke="#94a3b8" stroke-width="1" x1="${PLOT_LEFT}" y1="${axisY}" x2="${svgWidth - PLOT_RIGHT}" y2="${axisY}"></line>
      <line class="admin-chart-target" stroke="#e11d48" stroke-width="1.8" stroke-dasharray="6 4" x1="${PLOT_LEFT}" y1="${targetY.toFixed(1)}" x2="${svgWidth - PLOT_RIGHT}" y2="${targetY.toFixed(1)}"></line>
      ${bars}
    </svg>`;
  }

  function chartBlock({ title, periodText, sourceLabel, rows, target, targetKey, chartKey, canEditTarget, escapeHtml, valueDigits, grouped, rotateLabels }) {
    const chartId = `copy-five-s-chart-${chartKey || targetKey}`;
    return `<section class="admin-card-chart-block copyable-report-block is-copy-chart" id="${chartId}" data-copy-format="image">
      <div class="admin-card-chart-head">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(periodText)}</span>
        </div>
        <div class="admin-card-chart-head-actions">
          <button class="tiny-button copy-report-button" type="button" data-action="copy-report-target" data-copy-format="image" data-copy-target="${chartId}">Copy</button>
          ${canEditTarget ? `<button class="tiny-button five-s-target-edit-button" type="button" data-action="edit-five-s-chart-target" data-id="${escapeHtml(targetKey)}">Sửa target</button>` : ""}
        </div>
      </div>
      <div class="admin-card-chart-scroll">
        ${chartSvg({ rows, target, escapeHtml, valueDigits, grouped, rotateLabels })}
      </div>
      <div class="admin-card-chart-legend">
        <span><i style="background: #12a8e8"></i>${escapeHtml(sourceLabel)}</span>
        <span class="legend-target"><b style="background: #e11d48"></b>Target ${escapeHtml(target.toFixed(1))}</span>
      </div>
    </section>`;
  }

  function getFiveSChartRows(context, period, scoreSource) {
    const {
      BENCHMARK,
      DEFAULT_ITEMS,
      areaAverage,
      getAreasForPeriod,
      itemAverage,
    } = context;
    const periodId = period?.id || "";
    const areas = getAreasForPeriod(periodId);
    const zoneRows = areas.map((area) => ({
      label: area.code || "-",
      group: area.summaryGroup || area.departmentHead || "Khác",
      head: area.departmentHead || "",
      value: areaAverage(periodId, area, scoreSource),
    })).filter((row) => Number.isFinite(row.value));
    const itemRows = DEFAULT_ITEMS.map((item) => ({
      label: `${item.code.replace(/[()]/g, "")} ${item.name}`,
      value: itemAverage(periodId, item, areas, scoreSource),
    })).filter((row) => Number.isFinite(row.value));
    return {
      itemRows,
      itemTarget: context.getFiveSChartTarget ? context.getFiveSChartTarget("item") : Number.isFinite(BENCHMARK) ? BENCHMARK : 3.3,
      zoneRows,
      zoneTarget: context.getFiveSChartTarget ? context.getFiveSChartTarget("zone") : 3.5,
    };
  }

  function averageValues(values) {
    const numbers = values.filter((value) => Number.isFinite(value));
    if (!numbers.length) {
      return null;
    }
    return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  }

  function buildConsecutiveGroups(areas) {
    return areas.reduce((groups, area, index) => {
      const label = area.summaryGroup || area.departmentHead || "";
      const current = groups[groups.length - 1];
      if (current && current.label === label) {
        current.areas.push(area);
      } else {
        groups.push({ label, startIndex: index, areas: [area] });
      }
      return groups;
    }, []);
  }

  function renderAverageScoreTable(context, period) {
    const {
      SCORE_SOURCE_ASSESSOR,
      SCORE_SOURCE_SELF,
      areaAverage,
      escapeHtml,
      formatNumber,
      getAreaResponsibleNameForPeriod,
      getAreasForPeriod,
    } = context;
    const periodId = period?.id || "";
    const areas = getAreasForPeriod(periodId);
    const areaRows = areas.map((area) => {
      const selfAverage = areaAverage(periodId, area, SCORE_SOURCE_SELF);
      const assessorAverage = areaAverage(periodId, area, SCORE_SOURCE_ASSESSOR);
      return {
        area,
        selfAverage,
        assessorAverage,
        average: averageValues([selfAverage, assessorAverage]),
      };
    });
    const rowByAreaId = new Map(areaRows.map((row) => [row.area.id, row]));
    const valueCell = (value) => Number.isFinite(value)
      ? `<td>${escapeHtml(formatNumber(value, 2))}</td>`
      : '<td class="summary-average-empty"></td>';
    const zoneCells = areas.map((area) => `<th class="${area.highlight ? "is-highlight" : ""}">${escapeHtml(area.code || "")}</th>`).join("");
    const picCells = areas.map((area) => `<td>${escapeHtml(getAreaResponsibleNameForPeriod(periodId, area) || "")}</td>`).join("");
    const selfCells = areaRows.map((row) => valueCell(row.selfAverage)).join("");
    const assessorCells = areaRows.map((row) => valueCell(row.assessorAverage)).join("");
    const averageCells = areaRows.map((row) => valueCell(row.average)).join("");
    const groups = buildConsecutiveGroups(areas);
    const groupAverageCells = groups.map((group) => {
      const value = averageValues(group.areas.map((area) => rowByAreaId.get(area.id)?.average));
      const colspan = group.areas.length > 1 ? ` colspan="${group.areas.length}"` : "";
      return Number.isFinite(value)
        ? `<td${colspan}>${escapeHtml(formatNumber(value, 2))}</td>`
        : `<td${colspan} class="summary-average-empty"></td>`;
    }).join("");
    const groupLabelCells = groups.map((group) => {
      const colspan = group.areas.length > 1 ? ` colspan="${group.areas.length}"` : "";
      return `<td${colspan}>${escapeHtml(group.label || "")}</td>`;
    }).join("");

    return `
      <thead>
        <tr><th class="summary-average-title" colspan="${areas.length + 1}">Điểm số trung bình tính KPI các bộ phận</th></tr>
        <tr><th>Zone</th>${zoneCells}</tr>
        <tr><th>PIC</th>${picCells}</tr>
      </thead>
      <tbody>
        <tr><th>Điểm tự Đ.giá lần 1</th>${selfCells}</tr>
        <tr><th>Điểm Đ.G theo lịch</th>${assessorCells}</tr>
        <tr><th>Điểm trung bình</th>${averageCells}</tr>
        <tr class="summary-average-group-score-row"><th></th>${groupAverageCells}</tr>
        <tr class="summary-average-group-label-row"><th></th>${groupLabelCells}</tr>
      </tbody>
    `;
  }

  function syncSummaryAverageCopyButton(context, isAverageMode) {
    const heading = context.elements.summaryTitle?.closest?.(".section-heading");
    if (!heading) {
      return;
    }
    let button = heading.querySelector(".summary-average-copy-button");
    if (!isAverageMode) {
      button?.remove();
      return;
    }
    if (!button) {
      button = document.createElement("button");
      button.className = "tiny-button summary-average-copy-button";
      button.type = "button";
      button.dataset.action = "copy-report-target";
      button.dataset.copyTarget = "summary-average-copy-target";
      button.textContent = "Copy";
      heading.appendChild(button);
    }
  }

  function renderAverageSummaryTable(context, period) {
    const { elements } = context;
    const wrapper = elements.summaryTable?.closest?.(".summary-matrix-wrap");
    if (wrapper) {
      wrapper.id = "summary-average-copy-target";
      wrapper.dataset.copyFormat = "html";
    }
    elements.summaryTable.className = "summary-average-table";
    elements.summaryTable.innerHTML = renderAverageScoreTable(context, period);
    syncSummaryAverageCopyButton(context, true);
  }

  function renderFiveSCharts(context, period) {
    const {
      SCORE_SOURCE_ASSESSOR,
      SCORE_SOURCE_SELF,
      currentUser,
      escapeHtml,
      getScoreSourceLabel,
      isAdminAccount,
      periodLabel,
    } = context;
    const periodText = periodLabel(period);
    const canEditTarget = Boolean(isAdminAccount?.(currentUser));
    const chartGroups = [
      {
        source: SCORE_SOURCE_ASSESSOR,
        title: "Điểm Assessor chấm",
        zoneTitle: "Tổng hợp điểm các zone - Assessor chấm",
        itemTitle: "Điểm 5S các hạng mục - Assessor chấm",
      },
      {
        source: SCORE_SOURCE_SELF,
        title: "Điểm quản lý zone tự đánh giá",
        zoneTitle: "Tổng hợp điểm các zone tự đánh giá",
        itemTitle: "Điểm 5S các hạng mục - Quản lý zone tự đánh giá",
      },
    ];
    return `<section class="five-s-summary-chart-panel" id="summary-chart-dashboard">
      <div class="section-heading">
        <h2>Biểu đồ 5S</h2>
        <span>${escapeHtml(periodText)}</span>
      </div>
      ${chartGroups.map((group) => {
        const rows = getFiveSChartRows(context, period, group.source);
        const sourceLabel = getScoreSourceLabel(group.source);
        return `<section class="five-s-chart-source-group">
          <div class="five-s-chart-source-heading">
            <h3>${escapeHtml(group.title)}</h3>
            <span>${escapeHtml(periodText)}</span>
          </div>
          <div class="admin-card-chart-grid five-s-summary-chart-grid">
            ${chartBlock({
              title: group.zoneTitle,
              periodText,
              sourceLabel,
              rows: rows.zoneRows,
              target: rows.zoneTarget,
              targetKey: "zone",
              chartKey: `zone-${group.source}`,
              canEditTarget,
              escapeHtml,
              valueDigits: 2,
              grouped: true,
              rotateLabels: false,
            })}
            ${chartBlock({
              title: group.itemTitle,
              periodText,
              sourceLabel,
              rows: rows.itemRows,
              target: rows.itemTarget,
              targetKey: "item",
              chartKey: `item-${group.source}`,
              canEditTarget,
              escapeHtml,
              valueDigits: 2,
              grouped: false,
              rotateLabels: true,
            })}
          </div>
        </section>`;
      }).join("")}
    </section>`;
  }

  function clearSummaryCharts() {
    document.getElementById("summary-chart-dashboard")?.remove();
  }

  function renderSummaryCharts(context, period) {
    clearSummaryCharts();
    const sheetPanel = context.elements.summaryTable?.closest?.(".sheet-panel");
    if (!sheetPanel) {
      return;
    }
    sheetPanel.insertAdjacentHTML("afterend", renderFiveSCharts(context, period));
  }

  function render(context) {
    const {
      SCORE_SOURCE_ASSESSOR,
      SCORE_SOURCE_AVERAGE,
      SCORE_SOURCE_OPTIONS,
      buildMatrixTable,
      currentUser,
      elements,
      escapeHtml,
      getActivePeriodId,
      getAllowedAreaIds,
      getAreasForPeriod,
      getPeriod,
      getScoreSourceForAccount,
      getScoreSourceLabel,
      isAdminAccount,
      periodLabel,
      renderStandardReferenceTable,
      FIVE_S_PERIOD_TYPE,
    } = context;

    clearSummaryCharts();
    const period = getPeriod(elements.summaryPeriodSelect?.value || getActivePeriodId(FIVE_S_PERIOD_TYPE));
    const periodId = period?.id || "";
    const isAdmin = isAdminAccount(currentUser);
    const userScoreSource = typeof getScoreSourceForAccount === "function"
      ? getScoreSourceForAccount(currentUser)
      : SCORE_SOURCE_ASSESSOR;
    const scoreSource = isAdmin
      ? elements.summaryScoreSource?.value || SCORE_SOURCE_ASSESSOR
      : userScoreSource;
    const isAverageMode = isAdmin && scoreSource === SCORE_SOURCE_AVERAGE;
    const allowedAreaIds = getAllowedAreaIds(currentUser, periodId);
    const assignedAreas = getAreasForPeriod(periodId).filter((area) => allowedAreaIds.has(area.id));

    if (elements.summaryScoreSource) {
      const currentSource = isAdmin ? elements.summaryScoreSource.value || scoreSource : scoreSource;
      elements.summaryScoreSource.innerHTML = SCORE_SOURCE_OPTIONS
        .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === currentSource ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
        .join("");
      elements.summaryScoreSource.value = SCORE_SOURCE_OPTIONS.some((option) => option.value === currentSource) ? currentSource : SCORE_SOURCE_ASSESSOR;
    }

    elements.summaryTitle.textContent = isAverageMode
      ? `Điểm số trung bình tính KPI các bộ phận - ${periodLabel(period)}`
      : `Điểm Chi Tiết Theo Từng Hạng Mục - ${getScoreSourceLabel(scoreSource)} - ${periodLabel(period)}`;
    if (elements.assignedZoneSummary) {
      elements.assignedZoneSummary.textContent = isAdmin
        ? ""
        : assignedAreas.length
          ? `Zone được phép chấm: ${assignedAreas.map((area) => area.code).join(", ")}`
          : "Tài khoản này chưa được phân quyền chấm zone 5S.";
    }

    if (isAverageMode) {
      renderAverageSummaryTable(context, period);
    } else {
      const wrapper = elements.summaryTable?.closest?.(".summary-matrix-wrap");
      if (wrapper) {
        wrapper.id = "";
        delete wrapper.dataset.copyFormat;
      }
      syncSummaryAverageCopyButton(context, false);
      buildMatrixTable(elements.summaryTable, {
        periodId,
        scoreSource,
        editable: true,
        editableAreaIds: allowedAreaIds,
        adminMode: isAdmin,
      });
    }
    renderSummaryCharts(context, period);
  }

  window.PageRegistry.register({
    id: "summary",
    title: "Tổng hợp điểm",
    render,
  });
})();
