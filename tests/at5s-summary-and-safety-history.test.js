const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Ban AT - 5S has access to Quản lý zone and Điểm trung bình in summary page", () => {
  const summaryCode = fs.readFileSync(path.join(__dirname, "../modules/pages/summary-page.js"), "utf8");

  let registeredPage = null;
  const mockWindow = {
    PageRegistry: { register: (p) => { registeredPage = p; } },
    addEventListener: () => {},
    document: {
      createElement: () => ({ style: {} }),
      getElementById: () => null,
    }
  };
  const mockDocument = mockWindow.document;

  const runSummary = new Function("window", "document", summaryCode);
  runSummary(mockWindow, mockDocument);

  assert.ok(registeredPage, "Summary page must be registered in PageRegistry");

  const summaryPeriodSelect = { value: "p-1" };
  const summaryScoreSource = {
    value: "",
    innerHTML: "",
    closest: () => ({ hidden: false })
  };
  const summaryTitle = { textContent: "" };
  const assignedZoneSummary = { textContent: "" };
  const summaryTable = { innerHTML: "", closest: () => null };

  let builtMatrixOptions = null;
  const mockContext = {
    elements: {
      summaryPeriodSelect,
      summaryScoreSource,
      summaryTitle,
      assignedZoneSummary,
      summaryTable
    },
    currentUser: { id: "lai", username: "lai", name: "Mr Lai", role: "at5s", roles: ["at5s"] },
    isAdminAccount: () => false,
    hasAt5sRole: () => true,
    isViewerAccount: () => false,
    SCORE_SOURCE_ASSESSOR: "assessor",
    SCORE_SOURCE_SELF: "self",
    SCORE_SOURCE_AT5S: "at5s",
    SCORE_SOURCE_DEPARTMENT_HEAD: "departmentHead",
    SCORE_SOURCE_AVERAGE: "average",
    SCORE_SOURCE_OPTIONS: [
      { value: "assessor", label: "Assessor chấm" },
      { value: "self", label: "Quản lý zone tự đánh giá" },
      { value: "at5s", label: "Ban AT - 5S chấm" },
      { value: "departmentHead", label: "Trưởng phòng chấm" },
      { value: "average", label: "Điểm trung bình" },
    ],
    FIVE_S_PERIOD_TYPE: "5s",
    getPeriod: () => ({ id: "p-1", month: 10, year: 2026 }),
    getActivePeriodId: () => "p-1",
    getAllowedAreaIds: () => new Set(["a-1", "a-2"]),
    getAreasForPeriod: () => [{ id: "a-1", code: "1" }, { id: "a-2", code: "2" }],
    getScoreSourceForAccount: () => "assessor",
    getScoreSourceLabel: (s) => s,
    periodLabel: () => "Tháng 10/2026",
    getFiveSScoreSourceAreaIds: (user, periodId, source) => {
      if (source === "at5s") return new Set(["a-1", "a-2"]);
      return new Set();
    },
    buildMatrixTable: (el, opts) => { builtMatrixOptions = opts; },
    escapeHtml: (s) => s,
    areaAverage: () => 4.5,
  };

  registeredPage.render(mockContext);

  // Check that all 5 sources are present in the dropdown for Ban AT - 5S
  assert.ok(summaryScoreSource.innerHTML.includes('value="assessor"'), "Must include Assessor chấm");
  assert.ok(summaryScoreSource.innerHTML.includes('value="self"'), "Must include Quản lý zone tự đánh giá");
  assert.ok(summaryScoreSource.innerHTML.includes('value="at5s"'), "Must include Ban AT - 5S chấm");
  assert.ok(summaryScoreSource.innerHTML.includes('value="departmentHead"'), "Must include Trưởng phòng chấm");
  assert.ok(summaryScoreSource.innerHTML.includes('value="average"'), "Must include Điểm trung bình");
  assert.equal(summaryScoreSource.value, "at5s", "Default source for Ban AT - 5S should be at5s");

  // Check when viewing Quản lý zone tự đánh giá
  summaryScoreSource.value = "self";
  registeredPage.render(mockContext);
  assert.equal(builtMatrixOptions.scoreSource, "self");
  assert.equal(builtMatrixOptions.editableAreaIds.size, 0, "Quản lý zone score source should be read-only for AT5S");
  assert.ok(assignedZoneSummary.textContent.includes("chỉ xem"), "Banner should indicate read-only mode");
});

test("Mobile prototype safely renders safety history for Ban AT - 5S without reference error", () => {
  const mobileCode = fs.readFileSync(path.join(__dirname, "../modules/pages/mobile-prototype.js"), "utf8");

  const listEl = { id: "mobileSafetyHistoryList", innerHTML: "---", addEventListener: () => {} };
  const countEl = { id: "mobileSafetyHistoryCount", textContent: "---" };
  const monthFilterEl = { id: "mobileSafetyMonthFilter", value: "2026-10", addEventListener: () => {} };
  const toastEl = { classList: { toggle: () => {}, add: () => {}, remove: () => {} }, querySelector: () => ({}) };
  const screenEl = {
    id: "mobileScreenSafety",
    innerHTML: "",
    classList: { toggle: () => {} },
    firstElementChild: null,
    querySelector: (sel) => {
      if (sel === "#mobileSafetyHistoryList") return listEl;
      if (sel === "#mobileSafetyHistoryCount") return countEl;
      if (sel === "#mobileSafetyMonthFilter") return monthFilterEl;
      return { classList: { toggle: () => {} }, querySelector: () => null, addEventListener: () => {}, style: {} };
    },
    querySelectorAll: () => []
  };

  const overlayEl = {
    id: "mobileProtoOverlay",
    dataset: {},
    querySelector: (sel) => {
      if (sel === "#mobileScreenSafety") return screenEl;
      return { classList: { toggle: () => {} }, textContent: "", querySelector: () => null, addEventListener: () => {} };
    },
    querySelectorAll: () => []
  };

  const mockWindow = {
    addEventListener: () => {},
    document: {
      body: { contains: () => true },
      getElementById: (id) => {
        if (id === "mobileProtoOverlay") return overlayEl;
        if (id === "mobileToast") return toastEl;
        return null;
      },
      querySelector: (sel) => {
        if (sel === "#mobileProtoOverlay") return overlayEl;
        if (sel === "#mobileToast") return toastEl;
        return null;
      },
      querySelectorAll: () => []
    }
  };
  const mockDocument = mockWindow.document;

  const runMobile = new Function("window", "document", mobileCode);
  runMobile(mockWindow, mockDocument);

  const mockContext = {
    currentUser: { id: "lai", username: "lai", name: "Mr Lai", role: "at5s", roles: ["at5s"] },
    state: {
      safetyRecords: [
        { id: "sec-1", periodId: "p-1", areaId: "a-1", issueDate: "2026-10-28", note: "Mối nguy số 1" },
        { id: "sec-2", periodId: "p-1", areaId: "a-1", issueDate: "2026-10-29", note: "Mối nguy số 2" }
      ]
    },
    SAFETY_PERIOD_TYPE: "safety",
    FIVE_S_PERIOD_TYPE: "5s",
    hasAt5sRole: () => true,
    isAdminAccount: () => false,
    getPeriod: () => ({ id: "p-1", month: 10, year: 2026 }),
    getActivePeriodId: () => "p-1",
    getAreasForPeriod: () => [{ id: "a-1", code: "1" }],
    getSafetyRecordIssueDate: (r) => r.issueDate,
    periodLabel: () => "Tháng 10/2026",
    todayIsoDate: () => "2026-10-28",
    loadCollectionPage: async () => ({
      items: [
        { id: "sec-1", periodId: "p-1", areaId: "a-1", issueDate: "2026-10-28", note: "Mối nguy số 1" },
        { id: "sec-2", periodId: "p-1", areaId: "a-1", issueDate: "2026-10-29", note: "Mối nguy số 2" }
      ],
      total: 2,
      page: 1,
      pageSize: 20,
      totalPages: 1
    })
  };

  mockWindow.openMobilePrototype("safety", mockContext);

  assert.equal(countEl.textContent, "2 Mối nguy");
  assert.ok(listEl.innerHTML.includes("Mối nguy số 1"));
  assert.ok(listEl.innerHTML.includes("Mối nguy số 2"));
});
