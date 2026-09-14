(() => {
  "use strict";

  function renderIssueBreakdown(container, rows, labelFactory, escapeHtml) {
    const counts = new Map();
    rows.forEach((row) => {
      const label = labelFactory(row);
      counts.set(label, (counts.get(label) || 0) + 1);
    });

    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "vi"));
    container.innerHTML = sorted.length
      ? sorted.map(([label, count]) => `<article class="compact-item"><strong>${escapeHtml(label)}</strong><span>${count} vấn đề cần theo dõi</span></article>`).join("")
      : '<article class="compact-item"><strong>Không có vấn đề chưa xử lý</strong><span>Kỳ này chưa có vấn đề cần theo dõi.</span></article>';
  }

  function render(context) {
    const { SAFETY_PERIOD_TYPE, elements, escapeHtml, getActivePeriodId, getIssueLocation, getIssueRecords, getPeriod, normalizeIssueStatus } = context;
    const activePeriodId = getActivePeriodId(SAFETY_PERIOD_TYPE);
    const period = getPeriod(elements.issueStatsPeriodSelect?.value || activePeriodId);

    const rows = getIssueRecords(period?.id || "");
    const statusCounts = rows.reduce((counts, row) => {
      const status = normalizeIssueStatus ? normalizeIssueStatus(row.score.issueStatus) : row.score.issueStatus || "open";
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, { open: 0, closed: 0, in_progress: 0, overdue: 0 });
    const followRows = rows.filter((row) => (normalizeIssueStatus ? normalizeIssueStatus(row.score.issueStatus) : row.score.issueStatus || "open") !== "closed");
    const withPhoto = rows.filter((row) => row.score.photoDataUrl || row.score.afterPhotoDataUrl).length;

    elements.issueStatsGrid.innerHTML = `
      <article class="stat-card"><span>Tổng vấn đề</span><strong>${rows.length}</strong></article>
      <article class="stat-card"><span>Chưa xử lý</span><strong>${statusCounts.open || 0}</strong></article>
      <article class="stat-card"><span>Đang xử lý</span><strong>${statusCounts.in_progress || 0}</strong></article>
      <article class="stat-card"><span>Quá hạn</span><strong>${statusCounts.overdue || 0}</strong></article>
      <article class="stat-card"><span>Đã xử lý</span><strong>${statusCounts.closed || 0}</strong></article>
      <article class="stat-card"><span>Có ảnh</span><strong>${withPhoto}</strong></article>`;
    renderIssueBreakdown(elements.issueZoneStats, followRows, (row) => getIssueLocation(row), escapeHtml);
    renderIssueBreakdown(elements.issueTypeStats, followRows, (row) => row.score.issueType || "Chưa phân loại", escapeHtml);
  }

  window.PageRegistry.register({
    id: "issue-stats",
    title: "Thống kê an toàn",
    render,
  });
})();
