(() => {
  "use strict";

  const DATA_VERSION = 4;
  const PAGE_JSON_FORMAT = "legroup-5s-page-json";
  const PAGE_JSON_VERSION = 1;
  const BENCHMARK = 3.3;
  const DEFAULT_FIVE_S_CHART_TARGETS = Object.freeze({
    zone: 3.5,
    item: BENCHMARK,
  });
  const PAGE_SIZE = 10;
  const SCORE_CROSSED = "na";
  const XLSX_ROW_OFFSET = 1;
  const XLSX_COLUMN_OFFSET = 1;
  const XLSX_LEADING_COLUMN_WIDTH = 2.89;
  const XLSX_AREA_COLUMN_WIDTHS = [
    3.11, 2.78, 2.78, 3.22, 2.78, 3.22, 2.78, 2.89, 2.78, 2.78,
    3.22, 3.33, 3.33, 3.56, 3.11, 3.11, 2.78, 3.33, 3.56, 2.78,
    3.11, 3.11, 3.22, 2.78, 3.22, 3.33, 2.89, 2.22, 2.22,
  ];
  const ADMIN_USERNAME = "duongbichngoc";
  const PHOTO_MAX_SIZE = 980;
  const PHOTO_JPEG_QUALITY = 0.72;
  const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      table[index] = value >>> 0;
    }
    return table;
  })();

  const CRITERIA_3S = [
    { id: "phan-loai", label: "Phân loại" },
    { id: "sap-xep", label: "Sắp xếp" },
    { id: "lau-don", label: "Lau dọn" },
  ];

  const SCORE_LEVEL_LABELS = window.FIVE_S_LEVEL_LABELS || [
    "Rất xấu (Cấp 1)",
    "Xấu (Cấp 2)",
    "Bình thường (Cấp 3)",
    "Tốt (Cấp 4)",
    "Rất tốt (Cấp 5)",
  ];
  const SCORE_GUIDE = window.FIVE_S_STANDARDS || {};
  const STOP6_OPTIONS = [
    { value: "", label: "Chưa phân loại" },
    { value: "1-Kẹp,kẹt", label: "1-Kẹp,kẹt" },
    { value: "2-Vật nặng", label: "2-Vật nặng" },
    { value: "3-Xe cộ", label: "3-Xe cộ" },
    { value: "4-Rơi,ngã", label: "4-Rơi,ngã" },
    { value: "5-Điện giật", label: "5-Điện giật" },
    { value: "6-Cháy nổ", label: "6-Cháy nổ" },
    { value: "7-Loại khác", label: "7-Loại khác" },
  ];
  const SAFETY_STOP6_COLUMNS = [
    { value: "1-Kẹp,kẹt", label: "kẹp kẹt" },
    { value: "2-Vật nặng", label: "vật nặng" },
    { value: "3-Xe cộ", label: "xe cộ" },
    { value: "4-Rơi,ngã", label: "rơi ngã" },
    { value: "5-Điện giật", label: "điện giật" },
    { value: "6-Cháy nổ", label: "cháy nổ" },
    { value: "7-Loại khác", label: "loại khác" },
  ];
  const ISSUE_LEVEL_OPTIONS = [
    { value: "", label: "Chưa chọn cấp" },
    { value: "A", label: "Cấp độ A" },
    { value: "B", label: "Cấp độ B" },
    { value: "C", label: "Cấp độ C" },
  ];
  const SAFETY_LEVEL_COLUMNS = [
    { value: "A", label: "độ A" },
    { value: "B", label: "độ B" },
    { value: "C", label: "độ C" },
  ];
  const SAFETY_FOUND_OPTIONS = [
    { value: "", label: "Chưa chọn" },
    { value: "worker", label: "Công nhân" },
    { value: "department-head", label: "Trưởng bộ phận" },
    { value: "assessor", label: "Assessor" },
  ];
  const SAFETY_FOUND_COLUMNS = SAFETY_FOUND_OPTIONS.filter((option) => option.value);
  const ISSUE_STATUS_OPTIONS = [
    { value: "open", label: "Chưa xử lý" },
    { value: "closed", label: "Đã xử lý" },
    { value: "in_progress", label: "Đang xử lý" },
    { value: "overdue", label: "Quá hạn" },
  ];
  const ISSUE_STATUS_LABELS = Object.freeze(Object.fromEntries(ISSUE_STATUS_OPTIONS.map((option) => [option.value, option.label])));
  const DEFAULT_SAFETY_REPORT = {
    performer: "Assessor AT",
    performerTitle: "Assessor",
    checker: "BGĐ Nhà máy, Các TBP, LEAN",
    department: "An toàn",
    checkerTitle: "",
    checkerDepartment: "",
    instruction: 'Đánh dấu "1" vào mục chọn',
    issueDate: "",
    reportDate: "",
  };

  const ROLE_ADMIN = "admin";
  const ROLE_ASSESSOR_5S = "assessor5s";
  const ROLE_ASSESSOR_SAFETY = "assessorSafety";
  const ROLE_ZONE_OWNER = "zoneOwner";
  const ROLE_VIEWER = "viewer";
  const ROLE_DEPARTMENT_HEAD = "departmentHead";
  const ACCOUNT_VIEWER_SCOPE = "viewer";
  const ACCOUNT_DEPARTMENT_HEAD_SCOPE = "departmentHead";
  const FIVE_S_PERIOD_TYPE = "5s";
  const SAFETY_PERIOD_TYPE = "safety";
  const LEGACY_PERIOD_TYPE = "both";
  const ACCOUNT_SCOPE_OPTIONS = [
    { value: FIVE_S_PERIOD_TYPE, label: "5S", title: "Danh mục 5S" },
    { value: SAFETY_PERIOD_TYPE, label: "AT", title: "Danh mục AT" },
  ];
  const PERIOD_CATALOG_TEMPLATE_COPY = "copy";
  const PERIOD_CATALOG_TEMPLATE_RESET_PEOPLE = "reset-people";
  const SCORE_SOURCE_ASSESSOR = "assessor";
  const SCORE_SOURCE_SELF = "self";
  const SCORE_SOURCE_AVERAGE = "average";
  const SCORE_SOURCE_OPTIONS = [
    { value: SCORE_SOURCE_ASSESSOR, label: "Assessor chấm" },
    { value: SCORE_SOURCE_SELF, label: "Quản lý zone tự đánh giá" },
    { value: SCORE_SOURCE_AVERAGE, label: "Điểm trung bình" },
  ];
  const SAFETY_DEPARTMENT_GROUPS = [
    { name: "Cơ khí", zoneCodes: ["1", "4", "5", "6", "7", "26"] },
    { name: "Hàn", zoneCodes: ["12", "12.1", "12.2", "13", "14", "14.1", "15"] },
    { name: "PMV", zoneCodes: ["18", "18.1", "18.2", "19", "25"] },
    { name: "sxCNC", zoneCodes: ["23"] },
    { name: "Cơ điện", zoneCodes: ["11"] },
    { name: "KLK", zoneCodes: ["16"] },
    { name: "Kho VT", zoneCodes: ["2", "3"] },
    { name: "KTCT", zoneCodes: ["8", "9", "10"] },
    { name: "Kho xuất", zoneCodes: ["17"] },
    { name: "HC", zoneCodes: ["21"] },
    { name: "QC", zoneCodes: ["22"] },
    { name: "New Model", zoneCodes: ["24"] },
    { name: "Quản lý sản xuất", zoneCodes: ["20"] },
  ];
  const HIDDEN_SAFETY_ZONE_CODES = new Set(["27"]);
  const SAFETY_ZONE_TARGETS = {
    "1": 22, "2": 5, "3": 4, "4": 12, "5": 24, "6": 18, "7": 14, "8": 10, "9": 11,
    "10": 16, "11": 30, "12": 44, "12.1": 44, "12.2": 44, "13": 26, "14": 51, "14.1": 51,
    "15": 22, "16": 18, "17": 16, "18": 19, "18.1": 19, "18.2": 19, "19": 60,
    "20": 6, "21": 19, "22": 32, "23": 40, "24": 10, "25": 14, "26": 12,
  };
  const EXTRA_SAFETY_AREA_COLUMNS = [
    { code: "Nhà sắt", departmentHead: "", summaryGroup: "Nhà sắt", scorerName: "", highlight: false, safetyTarget: 0 },
    { code: "Kế toán", departmentHead: "", summaryGroup: "Kế toán", scorerName: "", highlight: false, safetyTarget: 0 },
  ];

  const DEFAULT_ITEMS = [
    { id: "a1", code: "(A1)", name: "Đường đi bộ", criteria: CRITERIA_3S },
    { id: "a2", code: "(A2)", name: "Cây nước", criteria: CRITERIA_3S },
    { id: "a3", code: "(A3)", name: "Khu vực rửa tay, nhà vệ sinh", criteria: CRITERIA_3S },
    { id: "b1", code: "(B1)", name: "Khu để dầu, hóa chất, sơn (các loại dd hóa chất)", criteria: CRITERIA_3S },
    { id: "b2", code: "(B2)", name: "Hàng lưu kho, hàng lỗi", criteria: CRITERIA_3S },
    { id: "b3", code: "(B3)", name: "Nơi để vật tư, vật liệu, găng tay, giẻ lau", criteria: CRITERIA_3S },
    { id: "c1", code: "(C1)", name: "Nơi làm việc", criteria: CRITERIA_3S },
    { id: "c2", code: "(C2)", name: "Thiết bị máy móc sản xuất", criteria: CRITERIA_3S },
    { id: "c3", code: "(C3)", name: "Bàn thao tác", criteria: CRITERIA_3S },
    { id: "c4", code: "(C4)", name: "Nơi để đồ giá, Jig, tủ dụng cụ", criteria: CRITERIA_3S },
    { id: "c5", code: "(C5)", name: "Bảng quản lý trong dây chuyền", criteria: CRITERIA_3S },
    { id: "d1", code: "(D1)", name: "Khu vực nghỉ", criteria: CRITERIA_3S },
    { id: "d2", code: "(D2)", name: "Bàn quản lý (GL)", criteria: CRITERIA_3S },
    { id: "d3", code: "(D3)", name: "Khu để tư liệu, tài liệu", criteria: CRITERIA_3S },
    { id: "e1", code: "(E1)", name: "Tự giác của tổ viên", criteria: [{ id: "diem", label: "Điểm" }] },
    { id: "e2", code: "(E2)", name: "Tự giác của người giám sát", criteria: [{ id: "diem", label: "Điểm" }] },
  ];

  const STANDARD_REFERENCE_SECTIONS = [
    {
      label: "Khu vực đường đi (A)",
      items: [
        { id: "a1", location: "Đường đi bộ, cầu thang, hành lang, các đường border.\n(A1)" },
        { id: "a2", location: "Cây nước \n(A2)" },
        { id: "a3", location: "Khu vực rửa tay, nhà vệ sinh.\n(A3)" },
      ],
    },
    {
      label: "Khu vực để hàng hóa \n(B)",
      items: [
        { id: "b1", location: "Khu vực để dầu, hóa chất, sơn (Tất cả các loại hóa chất và dung dịch) \n(B1)" },
        { id: "b2", location: "Hàng lưu kho, hàng lỗi \n(Kho dùng khi khẩn cấp, thay thế, spare,...), Khu vực để sản phẩm, thành phẩm, kho dùng khi khẩn cấp, nguyên vật liệu, khu để hàng lỗi...\n(B2)" },
        { id: "b3", location: "Nơi để vật tư, vật liệu (găng tay, giẻ lau, dụng cụ trong dây chuyền...)\n(B3)" },
      ],
    },
    {
      label: "Trong dây chuyền (C )",
      items: [
        { id: "c1", location: "Nơi làm việc\n(C1)" },
        { id: "c2", location: "Thiết bị, máy móc sản xuất và khu vực xung quanh \n(C2)" },
        { id: "c3", location: "Bàn thao tác, bàn kiểm tra chất lượng, các loại dolly. \n(C3)" },
        { id: "c4", location: "Nơi để đồ gá, dưỡng jig, tool, dụng cụ đo đạc\n (Bàn, tủ dụng cụ, master work)\n(C4)" },
        { id: "c5", location: "Bảng thông báo, Bảng quản lý trong dây chuyền\n( Check sheet, Andon...)\n(C5)" },
      ],
    },
    {
      label: "Phòng nghỉ giải lao \n(D)",
      items: [
        { id: "d1", location: "Khu vực nghỉ \n(D1)" },
        { id: "d2", location: "Khu vực bàn GL\n(D2)" },
        { id: "d3", location: "Khu vực để tư liệu,tài liệu, bao gồm cả bản vẽ" },
      ],
    },
    {
      label: "Tự giác 1 (E1)",
      items: [{ id: "e1", location: "Tự giác của tổ viên", hideCriterion: true }],
    },
    {
      label: "Tự giác 2 (E2)",
      items: [{ id: "e2", location: "Tự giác của người giám sát", hideCriterion: true }],
    },
  ];

  const DEFAULT_AREA_COLUMNS = [
    { code: "25", departmentHead: "Mr Phong", summaryGroup: "Mr Việt Anh", scorerName: "Mr Trần Anh", highlight: true },
    { code: "19", departmentHead: "Mr Phong", summaryGroup: "Mr Việt Anh", scorerName: "Mr Nghinh", highlight: false },
    { code: "18.1", departmentHead: "Mr Phong", summaryGroup: "Mr Việt Anh", scorerName: "Mr Thao", highlight: false },
    { code: "18.2", departmentHead: "Mr Phong", summaryGroup: "Mr Việt Anh", scorerName: "Mr Thao", highlight: true },
    { code: "5", departmentHead: "Mr Lĩnh", summaryGroup: "Mr Lĩnh", scorerName: "Mr Vũ", highlight: false },
    { code: "1", departmentHead: "Mr Lĩnh", summaryGroup: "Mr Lĩnh", scorerName: "Mr Thông", highlight: false },
    { code: "6", departmentHead: "Mr Lĩnh", summaryGroup: "Mr Lĩnh", scorerName: "Mr Cường", highlight: false },
    { code: "7", departmentHead: "Mr Lĩnh", summaryGroup: "Mr Lĩnh", scorerName: "Mr Xiêm", highlight: false },
    { code: "26", departmentHead: "Mr Lĩnh", summaryGroup: "Mr Lĩnh", scorerName: "Mr Hùng", highlight: false },
    { code: "4", departmentHead: "Mr Lĩnh", summaryGroup: "Mr Lĩnh", scorerName: "Mr The", highlight: false },
    { code: "15", departmentHead: "Mr Cương", summaryGroup: "Mr Cương", scorerName: "Mr Hùng", highlight: false },
    { code: "12.1", departmentHead: "Mr Cương", summaryGroup: "Mr Cương", scorerName: "Tiến 201", highlight: false },
    { code: "12.2", departmentHead: "Mr Cương", summaryGroup: "Mr Cương", scorerName: "Mr Ut Tiến", highlight: true },
    { code: "13", departmentHead: "Mr Cương", summaryGroup: "Mr Cương", scorerName: "Mr Cương", highlight: false },
    { code: "14", departmentHead: "Mr Cương", summaryGroup: "Mr Cương", scorerName: "Mr Cương", highlight: false },
    { code: "10", departmentHead: "Mr Cương", summaryGroup: "Mr Cương", scorerName: "Mr Quyết", highlight: true },
    { code: "8", departmentHead: "Mr Trọng", summaryGroup: "Mr Trọng", scorerName: "Mr Quyền", highlight: false },
    { code: "9", departmentHead: "Mr Trọng", summaryGroup: "Mr Trọng", scorerName: "Mr Huy", highlight: false },
    { code: "16", departmentHead: "Mrs Nga", summaryGroup: "Mr Trung", scorerName: "Mr Trung", highlight: false },
    { code: "17", departmentHead: "Mrs Nga", summaryGroup: "Mr Trung", scorerName: "Mrs Nga", highlight: false },
    { code: "2", departmentHead: "Mrs Duyên", summaryGroup: "Mrs Liên", scorerName: "Mr Hương", highlight: false },
    { code: "3", departmentHead: "Mrs Duyên", summaryGroup: "Mrs Liên", scorerName: "Mrs Thắng", highlight: false },
    { code: "24", departmentHead: "", summaryGroup: "Mr Long", scorerName: "Mr Long", highlight: false },
    { code: "21", departmentHead: "", summaryGroup: "Ms Dương", scorerName: "Mrs Dương", highlight: false },
    { code: "22", departmentHead: "", summaryGroup: "Mr Việt", scorerName: "Mr Việt", highlight: true },
    { code: "11", departmentHead: "", summaryGroup: "Mr Văn", scorerName: "Mr Văn", highlight: false },
    { code: "23", departmentHead: "", summaryGroup: "Mr Công", scorerName: "Mr Công", highlight: false },
    { code: "20", departmentHead: "", summaryGroup: "", scorerName: "Mr Ánh", highlight: false },
    { code: "27", departmentHead: "", summaryGroup: "", scorerName: "Mr Đạt", highlight: false },
  ];

  const elements = {
    loginScreen: document.getElementById("login-screen"),
    loginForm: document.getElementById("login-form"),
    loginUsername: document.getElementById("login-username"),
    loginPassword: document.getElementById("login-password"),
    appShell: document.getElementById("app-shell"),
    appTitle: document.getElementById("app-title"),
    adminHomeCards: document.getElementById("admin-home-cards"),
    undoButton: document.getElementById("undo-button"),
    redoButton: document.getElementById("redo-button"),
    userBox: document.getElementById("user-box"),
    accountMenuButton: document.getElementById("account-menu-button"),
    accountMenu: document.getElementById("account-menu"),
    accountAvatar: document.getElementById("account-avatar"),
    accountMenuAvatar: document.getElementById("account-menu-avatar"),
    accountMenuName: document.getElementById("account-menu-name"),
    accountMenuUsername: document.getElementById("account-menu-username"),
    currentUserName: document.getElementById("current-user-name"),
    currentUserRole: document.getElementById("current-user-role"),
    logoutButton: document.getElementById("logout-button"),
    assessorPeriodSelect: document.getElementById("assessor-period-select"),
    assessorAreaSelect: document.getElementById("assessor-area-select"),
    assessorProgress: document.getElementById("assessor-progress"),
    assessorTitle: document.getElementById("assessor-title"),
    assessorSheet: document.getElementById("assessor-sheet"),
    summaryPeriodSelect: document.getElementById("summary-period-select"),
    summaryScoreSource: document.getElementById("summary-score-source"),
    summaryTable: document.getElementById("summary-table"),
    summaryTitle: document.getElementById("summary-title"),
    exportExcelButton: document.getElementById("export-excel-button"),
    safetyPeriodSelect: document.getElementById("safety-period-select"),
    safetyYearFilter: document.getElementById("safety-year-filter"),
    safetyMonthFilter: document.getElementById("safety-month-filter"),
    safetyAreaFilter: document.getElementById("safety-area-filter"),
    safetyDepartmentFilter: document.getElementById("safety-department-filter"),
    safetyDashboard: document.getElementById("safety-dashboard"),
    safetyTable: document.getElementById("safety-table"),
    safetyAssessmentCaption: document.getElementById("safety-assessment-caption"),
    addSafetyRecordButton: document.getElementById("add-safety-record-button"),
    editSafetyMetaButton: document.getElementById("edit-safety-meta-button"),
    exportSafetyExcelButton: document.getElementById("export-safety-excel-button"),
    sendSafetyMailButton: document.getElementById("send-safety-mail-button"),
    issueStatsPeriodSelect: document.getElementById("issue-stats-period-select"),
    issueStatsGrid: document.getElementById("issue-stats-grid"),
    issueZoneStats: document.getElementById("issue-zone-stats"),
    issueTypeStats: document.getElementById("issue-type-stats"),
    periodForm: document.getElementById("period-5s-form"),
    periodMonth: document.getElementById("period-5s-month"),
    periodYear: document.getElementById("period-5s-year"),
    periodList: document.getElementById("period-5s-list"),
    archivedPeriodList: null,
    period5SForm: document.getElementById("period-5s-form"),
    period5SMonth: document.getElementById("period-5s-month"),
    period5SYear: document.getElementById("period-5s-year"),
    period5SCatalogMode: document.getElementById("period-5s-catalog-mode"),
    period5SList: document.getElementById("period-5s-list"),
    periodSafetyForm: document.getElementById("period-safety-form"),
    periodSafetyDate: document.getElementById("period-safety-date"),
    periodSafetyDateCalendar: document.getElementById("period-safety-date-calendar"),
    periodSafetyCatalogMode: document.getElementById("period-safety-catalog-mode"),
    periodSafetyList: document.getElementById("period-safety-list"),
    catalogScopeSwitch: document.getElementById("catalog-scope-switch"),
    catalogScopeDetail: document.getElementById("catalog-scope-detail"),
    accountScopeSwitch: document.getElementById("account-scope-switch"),
    accountScopeDetail: document.getElementById("account-scope-detail"),
    scorerForm: document.getElementById("scorer-form"),
    scorerName: document.getElementById("scorer-name"),
    scorerList: document.getElementById("scorer-list"),
    departmentHeadEmailForm: document.getElementById("department-head-email-form"),
    departmentHeadEmailName: document.getElementById("department-head-email-name"),
    departmentHeadEmails: document.getElementById("department-head-emails"),
    departmentHeadEmailList: document.getElementById("department-head-email-list"),
    catalogAssessorForm: document.getElementById("catalog-assessor-form"),
    catalogAssessorName: document.getElementById("catalog-assessor-name"),
    catalogAssessorZoneList: document.getElementById("catalog-assessor-zone-list"),
    catalogAssessorList: document.getElementById("catalog-assessor-list"),
    areaForm: document.getElementById("area-form"),
    areaCode: document.getElementById("area-code"),
    areaHead: document.getElementById("area-head"),
    areaSummaryGroup: document.getElementById("area-summary-group"),
    areaSummaryGroupField: document.getElementById("area-summary-group-field"),
    areaScorer: document.getElementById("area-scorer"),
    areaAssessor: document.getElementById("area-assessor"),
    areaAssessorField: document.getElementById("area-assessor-field"),
    areaAssessorsCheckboxField: document.getElementById("area-assessors-checkbox-field"),
    areaAssessorsCheckList: document.getElementById("area-assessors-check-list"),
    areaHighlight: document.getElementById("area-highlight"),
    areaHighlightField: document.getElementById("area-highlight-field"),
    areaList: document.getElementById("area-list"),
    safetyDepartmentGroupsPanel: document.getElementById("safety-department-groups-panel"),
    safetyDepartmentGroupsForm: document.getElementById("safety-department-groups-form"),
    safetyDepartmentGroupsEditor: document.getElementById("safety-department-groups-editor"),
    itemList: document.getElementById("item-list"),
    accountForm: document.getElementById("account-form"),
    accountRole: document.getElementById("account-role"),
    viewerAccountDetail: document.getElementById("viewer-account-detail"),
    departmentHeadAccountDetail: document.getElementById("department-head-account-detail"),
    accountAssessorField: document.getElementById("account-assessor-field"),
    accountManagerField: document.getElementById("account-manager-field"),
    accountAssessor: document.getElementById("account-assessor"),
    accountManager: document.getElementById("account-manager"),
    accountZoneField: document.getElementById("account-zone-field"),
    accountZoneList: document.getElementById("account-zone-list"),
    accountZoneLabel: document.getElementById("account-zone-label"),
    accountUsername: document.getElementById("account-username"),
    accountDisplayName: document.getElementById("account-display-name"),
    accountPassword: document.getElementById("account-password"),
    accountList: document.getElementById("account-list"),
    viewerAccountForm: document.getElementById("viewer-account-form"),
    viewerAccountName: document.getElementById("viewer-account-name"),
    viewerAccountPosition: document.getElementById("viewer-account-position"),
    viewerAccountUsername: document.getElementById("viewer-account-username"),
    viewerAccountDisplayName: document.getElementById("viewer-account-display-name"),
    viewerAccountPassword: document.getElementById("viewer-account-password"),
    viewerAccountList: document.getElementById("viewer-account-list"),
    departmentHeadAccountForm: document.getElementById("department-head-account-form"),
    departmentHeadAccountSource: document.getElementById("department-head-account-source"),
    departmentHeadAccountName: document.getElementById("department-head-account-name"),
    departmentHeadAccountUsername: document.getElementById("department-head-account-username"),
    departmentHeadAccountDisplayName: document.getElementById("department-head-account-display-name"),
    departmentHeadAccountPassword: document.getElementById("department-head-account-password"),
    departmentHeadAccountList: document.getElementById("department-head-account-list"),
    modalBackdrop: document.getElementById("modal-backdrop"),
    modalTitle: document.getElementById("modal-title"),
    modalBody: document.getElementById("modal-body"),
    modalActions: document.getElementById("modal-actions"),
    modalCloseButton: document.getElementById("modal-close-button"),
    toast: document.getElementById("toast"),
  };

  let state = null;
  let currentUser = null;
  let activeTab = "home";
  let pendingRouteTab = null;
  let activeSafetyReport = "";
  let pendingSafetyReport = "";
  let toastTimer = 0;
  let lastOfflinePending = 0;
  let lastOfflineSyncing = false;
  let modalPreviewDirty = false;
  let modalSubmitSucceeded = false;
  let snapshotSeedPromise = null;
  let scoreRecordIndex = null;
  let activeCatalogScope = FIVE_S_PERIOD_TYPE;
  let activeAccountScope = FIVE_S_PERIOD_TYPE;
  let expandedCatalogScope = "";
  let expandedAccountScope = "";
  let activeHistoryScope = FIVE_S_PERIOD_TYPE;
  const HISTORY_RETENTION_MONTHS = 3;

  function isHistoryEntryExpired(entry, months = HISTORY_RETENTION_MONTHS) {
    if (!entry) {
      return false;
    }
    const rawTime = entry.timestamp || entry.sessionStartedAt || entry.sessionLastChangedAt;
    if (!rawTime) {
      return false;
    }
    const timeMs = Date.parse(rawTime);
    if (!Number.isFinite(timeMs)) {
      return false;
    }
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return timeMs < cutoff.getTime();
  }
  let currentSessionId = "";
  let currentSessionStartedAt = "";
  let currentSessionHistoryId = "";
  let currentAuthToken = "";
  const authenticatedPhotoUrlCache = new Map();
  const authenticatedPhotoUrlPromises = new Map();
  let dataUnsubscribe = null;
  let sessionHeartbeatTimer = 0;
  let suppressNextDataWatchRender = 0;
  let activeInlineScoreCell = null;
  let activeInlineScoreRestoreRaf = null;
  let pendingScoreUiRefreshRaf = null;
  const SESSION_STORAGE_KEY = "legroup-5s-session";
  const SESSION_HEARTBEAT_MS = 30 * 1000;
  const LOGIN_ROUTE = "/login";
  const TAB_ROUTES = Object.freeze({
    home: "/home",
    assessor: "/assessor",
    summary: "/summary",
    safety: "/safety",
    "issue-stats": "/issue-stats",
    catalog: "/catalog",
    accounts: "/accounts",
    "mobile-5s": "/mobile/5s",
    "mobile-safety": "/mobile/safety",
  });
  const SAFETY_REPORT_OPTIONS = Object.freeze([
    { id: "assessment", route: "/safety/danh-gia-an-toan", title: "ĐÁNH GIÁ AN TOÀN" },
    { id: "identification", route: "/safety/tong-hop-nhan-dien-nguy-co", title: "TỔNG HỢP NHẬN DIỆN NGUY CƠ MẤT AN TOÀN NHÀ MÁY" },
    { id: "factory", route: "/safety/tong-hop-nguy-co-nha-may", title: "TỔNG HỢP NGUY CƠ MẤT AN TOÀN NHÀ MÁY" },
  ]);
  const SAFETY_REPORT_BY_ID = Object.freeze(Object.fromEntries(SAFETY_REPORT_OPTIONS.map((report) => [report.id, report])));
  const SAFETY_REPORT_BY_ROUTE = Object.freeze(Object.fromEntries(SAFETY_REPORT_OPTIONS.map((report) => [report.route, report])));
  const ROUTE_TABS = Object.freeze(Object.fromEntries(Object.entries(TAB_ROUTES).map(([tab, route]) => [route, tab])));
  const dataStore = window.LocalDataStore;
  const pageRegistry = window.PageRegistry;

  // ─── Local data helpers ─────────────────────────────────────────────────────

  function dbRef(path) {
    if (!dataStore?.ref) {
      throw new Error("Chưa nạp module dữ liệu nội bộ.");
    }
    return dataStore.ref(path);
  }

  function cloneValue(value) {
    if (value === undefined) {
      return null;
    }
    return JSON.parse(JSON.stringify(value));
  }

  // Convert persisted collections (object keyed by id) → sorted array
  function snapshotToArray(snapshot) {
    if (Array.isArray(snapshot)) {
      return snapshot.filter((item) => item && typeof item === "object");
    }

    const result = [];
    if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
      Object.entries(snapshot).forEach(([key, item]) => {
        if (item && typeof item === "object") {
          result.push({ id: item.id || key, ...item });
        }
      });
    }
    return result;
  }

  function normalizeTextOverrideMap(snapshot) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return {};
    }

    return Object.fromEntries(Object.entries(snapshot).map(([periodKey, cells]) => [
      String(periodKey),
      cells && typeof cells === "object" && !Array.isArray(cells)
        ? Object.fromEntries(Object.entries(cells).map(([cellId, value]) => [String(cellId), String(value ?? "")]))
        : {},
    ]));
  }
  // ─── Default / normalize state ───────────────────────────────────────────────

  function createDefaultState() {
    const now = new Date().toISOString();
    const managers = [];
    const managerIdsByName = new Map();

    DEFAULT_AREA_COLUMNS.forEach((column) => {
      if (!managerIdsByName.has(column.scorerName)) {
        const id = `scorer-${managers.length + 1}`;
        managerIdsByName.set(column.scorerName, id);
        managers.push({ id, name: column.scorerName, emails: [], createdAt: now });
      }
    });

    const areas = DEFAULT_AREA_COLUMNS.map((column, index) => ({
      id: `area-${index + 1}`,
      order: index + 1,
      code: column.code,
      templateCode: column.code,
      departmentHead: column.departmentHead,
      summaryGroup: column.summaryGroup,
      scorerId: managerIdsByName.get(column.scorerName),
      assessorName: "",
      highlight: column.highlight,
      createdAt: now,
    }));
    const departmentHeadContacts = createDepartmentHeadContactsFromAreas(areas, now);
    const safetyManagers = managers.map((manager) => ({ ...manager }));
    const safetyAreas = ensureSafetyDefaultAreas(areas.map((area) => ({ ...area })), now);
    const safetyDepartmentGroups = normalizeSafetyDepartmentGroups(SAFETY_DEPARTMENT_GROUPS, safetyAreas);
    const safetyDepartmentHeadContacts = createDepartmentHeadContactsFromAreas(safetyAreas, now);

    const defaultState = {
      version: DATA_VERSION,
      benchmark: BENCHMARK,
      fiveSChartTargets: { ...DEFAULT_FIVE_S_CHART_TARGETS },
      activePeriodId: "",
      activeFiveSPeriodId: "",
      activeSafetyPeriodId: "",
      periods: [],
      managers,
      departmentHeadContacts,
      areas,
      safetyManagers,
      safetyDepartmentHeadContacts,
      safetyAreas,
      safetyDepartmentGroups,
      accounts: [
        {
          id: "admin",
          username: ADMIN_USERNAME,
          role: ROLE_ADMIN,
          name: "Đường Bích Ngọc",
          createdAt: now,
        },
      ],
      assessors: [],
      safetyAssessors: [],
      safetyReport: { ...DEFAULT_SAFETY_REPORT },
      safetyMonthlyTargets: {},
      safetyIdentificationOverrides: {},
      scores: [],
      safetyRecords: [],
      deletedSafetyRecords: [],
      history: [],
    };

    return defaultState;
  }

  // Convert raw persisted data (nested objects) → normalised state with arrays
  function normalizePeriodType(type) {
    if (type === SAFETY_PERIOD_TYPE) return SAFETY_PERIOD_TYPE;
    if (type === FIVE_S_PERIOD_TYPE) return FIVE_S_PERIOD_TYPE;
    return LEGACY_PERIOD_TYPE;
  }

  function normalizeScoreSource(source) {
    return source === SCORE_SOURCE_SELF ? SCORE_SOURCE_SELF : SCORE_SOURCE_ASSESSOR;
  }

  function getScoreSourceLabel(source) {
    return SCORE_SOURCE_OPTIONS.find((option) => option.value === source)?.label
      || SCORE_SOURCE_OPTIONS.find((option) => option.value === normalizeScoreSource(source))?.label
      || SCORE_SOURCE_OPTIONS[0].label;
  }

  function normalizeCatalogType(type) {
    return normalizePeriodType(type) === SAFETY_PERIOD_TYPE ? SAFETY_PERIOD_TYPE : FIVE_S_PERIOD_TYPE;
  }

  function normalizeFiveSChartTargetValue(value, fallback = BENCHMARK) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return Math.max(0, Math.min(5, Math.round(numeric * 100) / 100));
  }

  function normalizeFiveSChartTargets(targets = {}) {
    return {
      zone: normalizeFiveSChartTargetValue(targets.zone, DEFAULT_FIVE_S_CHART_TARGETS.zone),
      item: normalizeFiveSChartTargetValue(targets.item, DEFAULT_FIVE_S_CHART_TARGETS.item),
    };
  }

  function normalizeAccountAccessTypes(accessTypes, role = "") {
    const normalizedRole = normalizeAccountRole(role);
    if (normalizedRole === ROLE_ADMIN || normalizedRole === ROLE_VIEWER || normalizedRole === ROLE_DEPARTMENT_HEAD) {
      return [FIVE_S_PERIOD_TYPE, SAFETY_PERIOD_TYPE];
    }

    const rawValues = Array.isArray(accessTypes)
      ? accessTypes
      : String(accessTypes || "").split(/[\s,|]+/g);
    const values = rawValues
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .map((value) => normalizeCatalogType(value));

    if (!values.length) {
      values.push(normalizedRole === ROLE_ASSESSOR_SAFETY ? SAFETY_PERIOD_TYPE : FIVE_S_PERIOD_TYPE);
    }

    return [...new Set(values)];
  }

  function normalizeScopedAccountRole(role, type = FIVE_S_PERIOD_TYPE) {
    const normalizedRole = normalizeAccountRole(role);
    if (normalizedRole === ROLE_VIEWER) {
      return ROLE_VIEWER;
    }
    if (normalizedRole === ROLE_DEPARTMENT_HEAD) {
      return ROLE_DEPARTMENT_HEAD;
    }
    if (normalizedRole === ROLE_ZONE_OWNER) {
      return ROLE_ZONE_OWNER;
    }
    return normalizeCatalogType(type) === SAFETY_PERIOD_TYPE ? ROLE_ASSESSOR_SAFETY : ROLE_ASSESSOR_5S;
  }

  function normalizeAccountRolesByType(account) {
    const accessTypes = normalizeAccountAccessTypes(account?.accessTypes, account?.role);
    const rawRoles = account?.rolesByType || account?.accessRoles || {};
    return accessTypes.reduce((roles, type) => {
      roles[type] = normalizeScopedAccountRole(rawRoles[type] || account?.role, type);
      return roles;
    }, {});
  }

  function hasAccountAccessType(account, type = FIVE_S_PERIOD_TYPE) {
    if (!account) {
      return false;
    }
    if (normalizeAccountRole(account.role) === ROLE_ADMIN) {
      return true;
    }
    return normalizeAccountAccessTypes(account.accessTypes, account.role).includes(normalizeCatalogType(type));
  }

  function getAccountRoleForType(account, type = FIVE_S_PERIOD_TYPE) {
    if (!account) {
      return "";
    }
    if (normalizeAccountRole(account.role) === ROLE_ADMIN) {
      return ROLE_ADMIN;
    }
    return normalizeAccountRolesByType(account)[normalizeCatalogType(type)] || "";
  }

  function getAccountAreaIds(account, type = FIVE_S_PERIOD_TYPE) {
    if (!account) {
      return [];
    }
    const normalizedType = normalizeCatalogType(type);
    const typedKey = normalizedType === SAFETY_PERIOD_TYPE ? "safetyAreaIds" : "fiveSAreaIds";
    if (Array.isArray(account[typedKey])) {
      return [...new Set(account[typedKey].filter(Boolean))];
    }

    const legacyIds = Array.isArray(account.areaIds) ? account.areaIds.filter(Boolean) : [];
    if (normalizedType === FIVE_S_PERIOD_TYPE || normalizeAccountRole(account.role) === ROLE_ASSESSOR_SAFETY) {
      return [...new Set(legacyIds)];
    }
    return [];
  }

  function setAccountAreaIds(account, type = FIVE_S_PERIOD_TYPE, areaIds = []) {
    const normalizedType = normalizeCatalogType(type);
    const cleanIds = [...new Set((areaIds || []).filter(Boolean))];
    if (normalizedType === SAFETY_PERIOD_TYPE) {
      account.safetyAreaIds = cleanIds;
      if (!hasAccountAccessType(account, FIVE_S_PERIOD_TYPE)) {
        account.areaIds = cleanIds;
      }
    } else {
      account.fiveSAreaIds = cleanIds;
      account.areaIds = cleanIds;
    }
  }

  function getAccountPersonId(account, type = FIVE_S_PERIOD_TYPE) {
    if ([ROLE_VIEWER, ROLE_DEPARTMENT_HEAD].includes(normalizeAccountRole(account?.role))) {
      return "";
    }
    const normalizedType = normalizeCatalogType(type);
    const role = getAccountRoleForType(account, normalizedType);
    if (role === ROLE_ZONE_OWNER) {
      return normalizedType === SAFETY_PERIOD_TYPE ? account?.safetyScorerId || account?.scorerId || "" : account?.fiveSScorerId || account?.scorerId || "";
    }
    return normalizedType === SAFETY_PERIOD_TYPE ? account?.safetyAssessorId || account?.assessorId || "" : account?.fiveSAssessorId || account?.assessorId || "";
  }

  function setAccountPersonForType(account, type = FIVE_S_PERIOD_TYPE, role = ROLE_ASSESSOR_5S, personId = "") {
    const normalizedType = normalizeCatalogType(type);
    const scopedRole = normalizeScopedAccountRole(role, normalizedType);
    const rolesByType = { ...(account.rolesByType || {}) };
    rolesByType[normalizedType] = scopedRole;
    account.rolesByType = rolesByType;
    if (scopedRole === ROLE_VIEWER || scopedRole === ROLE_DEPARTMENT_HEAD) {
      delete account.fiveSScorerId;
      delete account.fiveSAssessorId;
      delete account.safetyScorerId;
      delete account.safetyAssessorId;
      delete account.scorerId;
      delete account.assessorId;
      return;
    }
    if (scopedRole === ROLE_ZONE_OWNER) {
      if (normalizedType === SAFETY_PERIOD_TYPE) {
        account.safetyScorerId = personId;
        delete account.safetyAssessorId;
      } else {
        account.fiveSScorerId = personId;
        account.scorerId = personId;
        delete account.fiveSAssessorId;
      }
    } else if (normalizedType === SAFETY_PERIOD_TYPE) {
      account.safetyAssessorId = personId;
      delete account.safetyScorerId;
    } else {
      account.fiveSAssessorId = personId;
      account.assessorId = personId;
      delete account.fiveSScorerId;
    }
  }

  function normalizeAccountRole(role) {
    const value = String(role || "").trim();
    if (value === ROLE_ADMIN) return ROLE_ADMIN;
    if (["viewer", ROLE_VIEWER].includes(value)) return ROLE_VIEWER;
    if (["departmentHead", "deptHead", ROLE_DEPARTMENT_HEAD].includes(value)) return ROLE_DEPARTMENT_HEAD;
    if (["safetyAssessor", ROLE_ASSESSOR_SAFETY].includes(value)) return ROLE_ASSESSOR_SAFETY;
    if (["manager", "scorer", ROLE_ZONE_OWNER].includes(value)) return ROLE_ZONE_OWNER;
    return ROLE_ASSESSOR_5S;
  }

  function normalizeIssueStatus(status) {
    const value = String(status || "").trim();
    const normalizedText = value.toLocaleLowerCase("vi").replace(/[\s-]+/g, "_");
    if (["closed", "done", "da_xu_ly", "đã_xử_lý"].includes(normalizedText)) return "closed";
    if (["in_progress", "processing", "dang_xu_ly", "đang_xử_lý"].includes(normalizedText)) return "in_progress";
    if (["overdue", "qua_han", "quá_hạn"].includes(normalizedText)) return "overdue";
    return "open";
  }

  function getIssueStatusLabel(status) {
    return ISSUE_STATUS_LABELS[normalizeIssueStatus(status)] || ISSUE_STATUS_LABELS.open;
  }

  function normalizeFoundChannel(channel) {
    const normalizedText = String(channel || "")
      .trim()
      .toLocaleLowerCase("vi")
      .replace(/[\s_]+/g, "-");
    if (["worker", "member", "cong-nhan", "công-nhân"].includes(normalizedText)) return "worker";
    if (["department-head", "internal-audit", "audit", "truong-bo-phan", "trưởng-bộ-phận", "to-truong", "tổ-trưởng"].includes(normalizedText)) return "department-head";
    if (["assessor", "lean", "(lean)"].includes(normalizedText)) return "assessor";
    return "";
  }

  function normalizeSafetyRecord(record) {
    const now = new Date().toISOString();
    return {
      id: record.id || makeId("safety"),
      periodId: record.periodId || "",
      areaId: record.areaId || "",
      issueLocation: record.issueLocation || "",
      issueDay: record.issueDay || "",
      issueMonth: record.issueMonth || "",
      note: record.note || record.issueDescription || "",
      photoDataUrl: record.photoDataUrl || "",
      photoName: record.photoName || "",
      issueCount: normalizeIssueCount(record.issueCount),
      issueType: record.issueType || "",
      issueLevel: record.issueLevel || "",
      issueStatus: normalizeIssueStatus(record.issueStatus),
      issueFoundBy: record.issueFoundBy || "",
      employeeCode: record.employeeCode || record.foundEmployeeCode || "",
      issueItemLabel: record.issueItemLabel || "",
      foundChannel: normalizeFoundChannel(record.foundChannel || record.issueFoundChannel || ""),
      improvementContent: record.improvementContent || "",
      afterPhotoDataUrl: record.afterPhotoDataUrl || "",
      afterPhotoName: record.afterPhotoName || "",
      actionOwner: record.actionOwner || "",
      actionPlan: record.actionPlan || "",
      completionDate: record.completionDate || "",
      completionLevelConfirm: record.completionLevelConfirm || "",
      completionStop6Confirm: record.completionStop6Confirm || "",
      scorerName: record.scorerName || "",
      accountUsername: record.accountUsername || "",
      createdAt: record.createdAt || record.updatedAt || now,
      updatedAt: record.updatedAt || record.createdAt || now,
    };
  }

  function hasSafetyRecordChanged(existing, next) {
    if (!existing) {
      return true;
    }

    const before = normalizeSafetyRecord(existing);
    const after = normalizeSafetyRecord(next);
    const fields = [
      "periodId",
      "areaId",
      "issueLocation",
      "issueDay",
      "issueMonth",
      "note",
      "photoDataUrl",
      "photoName",
      "issueCount",
      "issueType",
      "issueLevel",
      "issueStatus",
      "issueFoundBy",
      "employeeCode",
      "issueItemLabel",
      "foundChannel",
      "improvementContent",
      "afterPhotoDataUrl",
      "afterPhotoName",
      "actionOwner",
      "actionPlan",
      "completionDate",
      "completionLevelConfirm",
      "completionStop6Confirm",
    ];

    return fields.some((field) => String(before[field] ?? "") !== String(after[field] ?? ""));
  }

  function hasSafetyRecordContent(record) {
    return Boolean(record?.periodId && record?.areaId && (record.note || record.photoDataUrl || record.afterPhotoDataUrl || record.issueType || record.issueLevel || record.issueLocation || record.improvementContent || record.actionOwner || record.actionPlan || record.issueItemLabel || record.employeeCode));
  }

  function legacyScoreToSafetyRecord(score) {
    if (!score || !hasSafetyRecordContent({ ...score, periodId: score.periodId, areaId: score.areaId })) return null;
    const item = getItem(score.itemId);
    const criterion = getCriterion(item, score.criterionId);
    const itemLabel = score.issueItemLabel || [item?.code, item?.name, criterion?.label].filter(Boolean).join(" · ");
    return normalizeSafetyRecord({ ...score, id: score.id ? "safety-" + score.id : makeId("safety"), issueItemLabel: itemLabel, note: score.note || itemLabel || "Mối nguy an toàn", issueStatus: normalizeIssueStatus(score.issueStatus) });
  }

  function normalizeState(raw) {
    const normalized = {
      ...raw,
      version: DATA_VERSION,
      benchmark: Number(raw.benchmark) || BENCHMARK,
      fiveSChartTargets: normalizeFiveSChartTargets(raw.fiveSChartTargets),
      periods: snapshotToArray(raw.periods),
      managers: snapshotToArray(raw.managers),
      departmentHeadContacts: snapshotToArray(raw.departmentHeadContacts),
      assessors: snapshotToArray(raw.assessors),
      areas: snapshotToArray(raw.areas),
      safetyManagers: snapshotToArray(raw.safetyManagers),
      safetyDepartmentHeadContacts: snapshotToArray(raw.safetyDepartmentHeadContacts),
      safetyAssessors: snapshotToArray(raw.safetyAssessors),
      safetyAreas: snapshotToArray(raw.safetyAreas),
      safetyDepartmentGroups: snapshotToArray(raw.safetyDepartmentGroups),
      accounts: snapshotToArray(raw.accounts),
      safetyReport: { ...DEFAULT_SAFETY_REPORT, ...(raw.safetyReport || {}) },
      safetyMonthlyTargets: raw.safetyMonthlyTargets || {},
      safetyIdentificationOverrides: normalizeTextOverrideMap(raw.safetyIdentificationOverrides),
      scores: snapshotToArray(raw.scores),
      safetyRecords: snapshotToArray(raw.safetyRecords),
      deletedSafetyRecords: snapshotToArray(raw.deletedSafetyRecords),
      history: snapshotToArray(raw.history).filter((entry) => !isHistoryEntryExpired(entry)),
    };

    normalized.periods = normalized.periods.map((period) => {
      let normType = normalizePeriodType(period.type);
      let month = Number(period.month);
      let year = Number(period.year);
      if (!Number.isInteger(month) || !Number.isInteger(year) || normType === LEGACY_PERIOD_TYPE) {
        const match = /(5s|safety)-(\d{4})-(\d{1,2})/i.exec(period.id || "");
        if (match) {
          if (normType === LEGACY_PERIOD_TYPE) {
            normType = match[1].toLowerCase() === "safety" ? SAFETY_PERIOD_TYPE : FIVE_S_PERIOD_TYPE;
          }
          if (!Number.isInteger(year)) year = Number(match[2]);
          if (!Number.isInteger(month)) month = Number(match[3]);
        }
      }
      return {
        ...period,
        month: Number.isInteger(month) ? month : undefined,
        year: Number.isInteger(year) ? year : undefined,
        type: normType,
        archived: Boolean(period.archived),
        settingsSnapshot: normalizeSettingsSnapshot(period.settingsSnapshot),
      };
    });

    normalized.managers = normalized.managers
      .map((manager) => {
        const name = String(manager.name || "").trim();
        return {
          id: manager.id || makeStableId("scorer", name),
          name,
          emails: mergeEmailLists(manager.emails, manager.email, manager.managerEmail, manager.managerEmails),
          createdAt: manager.createdAt || "",
        };
      })
      .filter((manager) => manager.id && manager.name);

    const existingAdmin = normalized.accounts.find((account) => account.username === ADMIN_USERNAME || account.role === "admin");
    if (!existingAdmin) {
      normalized.accounts.unshift({
        id: "admin",
        username: ADMIN_USERNAME,
        role: "admin",
        name: "Đường Bích Ngọc",
        createdAt: new Date().toISOString(),
      });
    } else if (existingAdmin.name === "Dương Bích Ngọc" || !existingAdmin.name) {
      existingAdmin.name = "Đường Bích Ngọc";
    }

    const periodExists = (periodId) => normalized.periods.some((period) => period.id === periodId);
    const periodFromList = (periodId) => normalized.periods.find((period) => period.id === periodId) || null;
    const firstFiveSPeriod = normalized.periods.find((period) => [FIVE_S_PERIOD_TYPE, LEGACY_PERIOD_TYPE].includes(normalizePeriodType(period.type)));
    const firstSafetyPeriod = normalized.periods.find((period) => [SAFETY_PERIOD_TYPE, LEGACY_PERIOD_TYPE].includes(normalizePeriodType(period.type)));

    if (!normalized.activePeriodId || !periodExists(normalized.activePeriodId)) {
      normalized.activePeriodId = firstFiveSPeriod?.id || firstSafetyPeriod?.id || "";
    }
    if (!normalized.activeFiveSPeriodId || !periodExists(normalized.activeFiveSPeriodId)) {
      normalized.activeFiveSPeriodId = [FIVE_S_PERIOD_TYPE, LEGACY_PERIOD_TYPE].includes(normalizePeriodType(periodFromList(normalized.activePeriodId)?.type)) ? normalized.activePeriodId : firstFiveSPeriod?.id || "";
    }
    if (!normalized.activeSafetyPeriodId || !periodExists(normalized.activeSafetyPeriodId)) {
      normalized.activeSafetyPeriodId = [SAFETY_PERIOD_TYPE, LEGACY_PERIOD_TYPE].includes(normalizePeriodType(periodFromList(normalized.activePeriodId)?.type)) ? normalized.activePeriodId : firstSafetyPeriod?.id || "";
    }
    normalized.activePeriodId = normalized.activeFiveSPeriodId || normalized.activeSafetyPeriodId || normalized.activePeriodId;

    const defaultAreaByCode = new Map(DEFAULT_AREA_COLUMNS.map((area) => [area.code, area]));
    normalized.areas = normalized.areas
      .map((area, index) => ({
        ...area,
        order: Number.isFinite(area.order) ? area.order : index + 1,
        templateCode: area.templateCode || area.code,
        departmentHead: area.departmentHead ?? defaultAreaByCode.get(area.templateCode || area.code)?.departmentHead ?? "",
        summaryGroup: area.summaryGroup ?? defaultAreaByCode.get(area.templateCode || area.code)?.summaryGroup ?? area.departmentHead ?? "",
        managerEmails: normalizeEmailList(area.managerEmails || area.managerEmail || ""),
        assessorName: area.assessorName || "",
        assessorId: area.assessorId || "",
        safetyTarget: area.safetyTarget === "" || area.safetyTarget == null ? "" : Math.max(0, Math.round(Number(area.safetyTarget) || 0)),
        highlight: area.highlight ?? Boolean(defaultAreaByCode.get(area.templateCode || area.code)?.highlight),
      }))
      .sort((a, b) => a.order - b.order);

    const legacyEmailsByManagerId = new Map();
    normalized.areas.forEach((area) => {
      const emails = normalizeEmailList(area.managerEmails || area.managerEmail || "");
      if (!area.scorerId || !emails.length) {
        return;
      }

      legacyEmailsByManagerId.set(area.scorerId, mergeEmailLists(legacyEmailsByManagerId.get(area.scorerId), emails));
    });
    normalized.managers = normalized.managers.map((manager) => ({
      ...manager,
      emails: mergeEmailLists(manager.emails, legacyEmailsByManagerId.get(manager.id)),
    }));
    normalized.areas = normalized.areas.map((area) => {
      const { managerEmail, managerEmails, ...areaWithoutLegacyEmails } = area;
      return areaWithoutLegacyEmails;
    });
    normalized.departmentHeadContacts = normalizeDepartmentHeadContacts(
      normalized.departmentHeadContacts,
      normalized.areas,
      normalized.managers,
    );

    let assessorByName = new Map(normalized.assessors.map((assessor) => [String(assessor.name || "").trim().toLocaleLowerCase("vi"), assessor]));
    const ensureAssessor = (name) => {
      const cleanName = String(name || "").trim();
      if (!cleanName) {
        return null;
      }

      const key = cleanName.toLocaleLowerCase("vi");
      if (assessorByName.has(key)) {
        return assessorByName.get(key);
      }

      const assessor = {
        id: makeStableId("assessor", cleanName),
        name: cleanName,
        createdAt: new Date().toISOString(),
      };
      normalized.assessors.push(assessor);
      assessorByName.set(key, assessor);
      return assessor;
    };

    normalized.areas.forEach((area) => ensureAssessor(area.assessorName));
    normalized.accounts
      .filter((account) => [ROLE_ASSESSOR_5S, ROLE_ASSESSOR_SAFETY].includes(normalizeAccountRole(account.role)))
      .forEach((account) => ensureAssessor(account.name));
    assessorByName = new Map(normalized.assessors.map((assessor) => [String(assessor.name || "").trim().toLocaleLowerCase("vi"), assessor]));
    const assessorById = new Map(normalized.assessors.map((assessor) => [assessor.id, assessor]));
    normalized.areas = normalized.areas.map((area) => {
      const matchedByName = assessorByName.get(String(area.assessorName || "").trim().toLocaleLowerCase("vi"));
      const assessorId = area.assessorId || matchedByName?.id || "";
      return {
        ...area,
        assessorId,
        assessorName: assessorById.get(assessorId)?.name || area.assessorName || "",
      };
    });

    normalized.safetyManagers = (normalized.safetyManagers.length ? normalized.safetyManagers : normalized.managers.map((manager) => ({ ...manager })))
      .map((manager) => {
        const name = String(manager.name || "").trim();
        return {
          id: manager.id || makeStableId("safety-scorer", name),
          name,
          emails: mergeEmailLists(manager.emails, manager.email, manager.managerEmail, manager.managerEmails),
          createdAt: manager.createdAt || "",
        };
      })
      .filter((manager) => manager.id && manager.name);
    normalized.safetyAssessors = (normalized.safetyAssessors.length ? normalized.safetyAssessors : normalized.assessors.map((assessor) => ({ ...assessor })))
      .map((assessor) => ({
        id: assessor.id || makeStableId("safety-assessor", assessor.name),
        name: String(assessor.name || "").trim(),
        createdAt: assessor.createdAt || "",
      }))
      .filter((assessor) => assessor.id && assessor.name);
    const safetyManagerById = new Map(normalized.safetyManagers.map((manager) => [manager.id, manager]));
    const safetyAssessorById = new Map(normalized.safetyAssessors.map((assessor) => [assessor.id, assessor]));
    normalized.safetyAreas = ensureSafetyDefaultAreas(
      (normalized.safetyAreas.length ? normalized.safetyAreas : normalized.areas.map((area) => ({ ...area })))
        .map((area, index) => ({
          ...area,
          id: area.id || makeStableId("safety-area", area.code || String(index + 1)),
          order: Number.isFinite(area.order) ? area.order : index + 1,
          templateCode: area.templateCode || area.code,
          departmentHead: area.departmentHead ?? defaultAreaByCode.get(area.templateCode || area.code)?.departmentHead ?? "",
          summaryGroup: area.summaryGroup ?? defaultAreaByCode.get(area.templateCode || area.code)?.summaryGroup ?? area.departmentHead ?? area.code ?? "",
          scorerId: area.scorerId || "",
          responsibleName: area.responsibleName || safetyManagerById.get(area.scorerId)?.name || area.scorerName || "",
          assessorId: area.assessorId || "",
          assessorName: safetyAssessorById.get(area.assessorId)?.name || area.assessorName || "",
          safetyTarget: area.safetyTarget === "" || area.safetyTarget == null ? "" : Math.max(0, Math.round(Number(area.safetyTarget) || 0)),
          highlight: area.highlight ?? Boolean(defaultAreaByCode.get(area.templateCode || area.code)?.highlight),
        }))
        .filter((area) => area.id && area.code),
      new Date().toISOString(),
    );
    normalized.safetyDepartmentHeadContacts = normalizeDepartmentHeadContacts(
      normalized.safetyDepartmentHeadContacts.length ? normalized.safetyDepartmentHeadContacts : normalized.departmentHeadContacts,
      normalized.safetyAreas,
      normalized.safetyManagers,
    );
    normalized.safetyDepartmentGroups = normalizeSafetyDepartmentGroups(
      normalized.safetyDepartmentGroups.length ? normalized.safetyDepartmentGroups : SAFETY_DEPARTMENT_GROUPS,
      normalized.safetyAreas,
    );

    const managerById = new Map(normalized.managers.map((manager) => [manager.id, manager]));
    const managerByName = new Map(normalized.managers.map((manager) => [String(manager.name || "").trim().toLocaleLowerCase("vi"), manager]));
    const safetyManagerByName = new Map(normalized.safetyManagers.map((manager) => [String(manager.name || "").trim().toLocaleLowerCase("vi"), manager]));
    const safetyAssessorByName = new Map(normalized.safetyAssessors.map((assessor) => [String(assessor.name || "").trim().toLocaleLowerCase("vi"), assessor]));
    normalized.accounts = normalized.accounts.map((account) => {
      const { email, senderEmail, ...accountWithoutEmail } = account;
      const role = normalizeAccountRole(account.role);
      if (role === ROLE_ADMIN) {
        return {
          ...accountWithoutEmail,
          role: ROLE_ADMIN,
          accessTypes: [FIVE_S_PERIOD_TYPE, SAFETY_PERIOD_TYPE],
          rolesByType: { [FIVE_S_PERIOD_TYPE]: ROLE_ADMIN, [SAFETY_PERIOD_TYPE]: ROLE_ADMIN },
        };
      }

      const accessTypes = normalizeAccountAccessTypes(account.accessTypes, role);
      const rolesByType = normalizeAccountRolesByType({ ...account, accessTypes });
      const explicitLegacyAreaIds = Array.isArray(account.areaIds) ? account.areaIds.filter(Boolean) : [];
      const nextAccount = {
        ...accountWithoutEmail,
        role,
        accessTypes,
        rolesByType,
        name: account.name || account.username || "",
        areaIds: [],
      };

      const resolveAreaIds = (type, scopedRole, personId) => {
        const typedKey = type === SAFETY_PERIOD_TYPE ? "safetyAreaIds" : "fiveSAreaIds";
        const typedIds = Array.isArray(account[typedKey]) ? account[typedKey].filter(Boolean) : [];
        if (typedIds.length) {
          return [...new Set(typedIds)];
        }

        const areas = type === SAFETY_PERIOD_TYPE ? normalized.safetyAreas : normalized.areas;
        const shouldUseLegacyIds = explicitLegacyAreaIds.length && (type === FIVE_S_PERIOD_TYPE || role === ROLE_ASSESSOR_SAFETY);
        if (shouldUseLegacyIds) {
          return [...new Set(explicitLegacyAreaIds)];
        }

        if (type === SAFETY_PERIOD_TYPE && role === ROLE_ASSESSOR_SAFETY && !typedIds.length && !explicitLegacyAreaIds.length) {
          return areas.map((area) => area.id);
        }

        if (scopedRole === ROLE_ZONE_OWNER) {
          return areas.filter((area) => personId && area.scorerId === personId).map((area) => area.id);
        }
        return areas.filter((area) => personId && area.assessorId === personId).map((area) => area.id);
      };

      accessTypes.forEach((type) => {
        const scopedRole = rolesByType[type] || normalizeScopedAccountRole(role, type);
        if (scopedRole === ROLE_ZONE_OWNER) {
          const managersForType = type === SAFETY_PERIOD_TYPE ? normalized.safetyManagers : normalized.managers;
          const managersByNameForType = type === SAFETY_PERIOD_TYPE ? safetyManagerByName : managerByName;
          const existingScorerId = type === SAFETY_PERIOD_TYPE ? account.safetyScorerId || account.scorerId : account.fiveSScorerId || account.scorerId;
          const matchedScorerId = existingScorerId || managersByNameForType.get(String(account.name || "").trim().toLocaleLowerCase("vi"))?.id || "";
          setAccountPersonForType(nextAccount, type, scopedRole, matchedScorerId);
          setAccountAreaIds(nextAccount, type, resolveAreaIds(type, scopedRole, matchedScorerId));
          nextAccount.name = managersForType.find((manager) => manager.id === matchedScorerId)?.name || nextAccount.name || account.username || "";
        } else {
          const assessorsForType = type === SAFETY_PERIOD_TYPE ? normalized.safetyAssessors : normalized.assessors;
          const assessorsByNameForType = type === SAFETY_PERIOD_TYPE ? safetyAssessorByName : assessorByName;
          const existingAssessorId = type === SAFETY_PERIOD_TYPE ? account.safetyAssessorId || account.assessorId : account.fiveSAssessorId || account.assessorId;
          const matchedAssessorId = existingAssessorId || assessorsByNameForType.get(String(account.name || "").trim().toLocaleLowerCase("vi"))?.id || "";
          setAccountPersonForType(nextAccount, type, scopedRole, matchedAssessorId);
          setAccountAreaIds(nextAccount, type, resolveAreaIds(type, scopedRole, matchedAssessorId));
          nextAccount.name = assessorsForType.find((assessor) => assessor.id === matchedAssessorId)?.name || nextAccount.name || account.username || "";
        }
      });

      return nextAccount;
    });

    normalized.scores = normalized.scores.map((score) => ({
      ...score,
      status: score.status === SCORE_CROSSED ? SCORE_CROSSED : "",
      scoreSource: normalizeScoreSource(score.scoreSource),
      note: score.note || "",
      photoDataUrl: score.photoDataUrl || "",
      photoName: score.photoName || "",
      issueType: score.issueType || "",
      issueLevel: score.issueLevel || "",
      issueStatus: score.issueStatus ? normalizeIssueStatus(score.issueStatus) : score.note || score.photoDataUrl ? "open" : "",
      issueLocation: score.issueLocation || "",
      issueDay: score.issueDay || "",
      issueMonth: score.issueMonth || "",
      issueCount: normalizeIssueCount(score.issueCount),
      issueFoundBy: score.issueFoundBy || "",
      employeeCode: score.employeeCode || score.foundEmployeeCode || "",
      issueItemLabel: score.issueItemLabel || "",
      foundChannel: normalizeFoundChannel(score.foundChannel || score.issueFoundChannel || ""),
      improvementContent: score.improvementContent || "",
      afterPhotoDataUrl: score.afterPhotoDataUrl || "",
      afterPhotoName: score.afterPhotoName || "",
      actionOwner: score.actionOwner || "",
      actionPlan: score.actionPlan || "",
      completionDate: score.completionDate || "",
      completionLevelConfirm: score.completionLevelConfirm || "",
      completionStop6Confirm: score.completionStop6Confirm || "",
    }));
    const scoreIds = new Set(normalized.scores.map((score) => score.id).filter(Boolean));
    normalized.deletedSafetyRecords = normalized.deletedSafetyRecords.filter((record) => {
      const sourceScoreId = record.sourceScoreId || (String(record.id || "").startsWith("safety-") ? String(record.id).slice("safety-".length) : "");
      return Boolean(sourceScoreId && scoreIds.has(sourceScoreId));
    });
    const deletedSafetyRecordIds = new Set(normalized.deletedSafetyRecords.map((record) => record.id).filter(Boolean));
    normalized.safetyRecords = normalized.safetyRecords
      .map(normalizeSafetyRecord)
      .filter((record) => hasSafetyRecordContent(record) && !deletedSafetyRecordIds.has(record.id));
    if (!normalized.safetyRecords.length) {
      normalized.safetyRecords = normalized.scores
        .map(legacyScoreToSafetyRecord)
        .filter((record) => record && !deletedSafetyRecordIds.has(record.id));
    }

    return normalized;
  }

  // Convert arrays → keyed objects for compact local storage
  function stateToStorage(s) {
    function compactForStorage(item) {
      const compact = {};
      Object.entries(item || {}).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          compact[key] = value;
        }
      });
      return compact;
    }

    function toObj(arr) {
      if (!Array.isArray(arr) || arr.length === 0) return null;
      const obj = {};
      arr.forEach((item) => {
        if (item?.id) obj[item.id] = item;
      });
      return obj;
    }

    const managers = (s.managers || []).map((manager) => ({
      id: manager.id,
      name: manager.name || "",
      emails: normalizeEmailList(manager.emails),
      createdAt: manager.createdAt || "",
    }));
    const safetyManagers = (s.safetyManagers || []).map((manager) => ({
      id: manager.id,
      name: manager.name || "",
      emails: normalizeEmailList(manager.emails),
      createdAt: manager.createdAt || "",
    }));
    const departmentHeadContacts = normalizeDepartmentHeadContacts(s.departmentHeadContacts, s.areas, s.managers)
      .map((contact) => ({
        id: contact.id,
        name: contact.name || "",
        emails: normalizeEmailList(contact.emails),
        createdAt: contact.createdAt || "",
      }));
    const safetyDepartmentHeadContacts = normalizeDepartmentHeadContacts(s.safetyDepartmentHeadContacts, s.safetyAreas, s.safetyManagers)
      .map((contact) => ({
        id: contact.id,
        name: contact.name || "",
        emails: normalizeEmailList(contact.emails),
        createdAt: contact.createdAt || "",
      }));
    const areas = (s.areas || []).map((area) => {
      const { managerEmail, managerEmails, ...areaWithoutLegacyEmails } = area;
      return areaWithoutLegacyEmails;
    });
    const safetyAreas = (s.safetyAreas || []).map((area) => {
      const { managerEmail, managerEmails, ...areaWithoutLegacyEmails } = area;
      return areaWithoutLegacyEmails;
    });
    const safetyDepartmentGroups = normalizeSafetyDepartmentGroups(s.safetyDepartmentGroups, safetyAreas);
    const accounts = (s.accounts || []).map((account) => {
      const { email, senderEmail, ...accountWithoutEmail } = account;
      return accountWithoutEmail;
    });

    return {
      version: s.version,
      benchmark: s.benchmark,
      fiveSChartTargets: normalizeFiveSChartTargets(s.fiveSChartTargets),
      activePeriodId: s.activePeriodId || "",
      activeFiveSPeriodId: s.activeFiveSPeriodId || "",
      activeSafetyPeriodId: s.activeSafetyPeriodId || "",
      periods: toObj(s.periods),
      managers: toObj(managers),
      departmentHeadContacts: toObj(departmentHeadContacts),
      assessors: toObj(s.assessors),
      areas: toObj(areas),
      safetyManagers: toObj(safetyManagers),
      safetyDepartmentHeadContacts: toObj(safetyDepartmentHeadContacts),
      safetyAssessors: toObj(s.safetyAssessors),
      safetyAreas: toObj(safetyAreas),
      safetyDepartmentGroups: toObj(safetyDepartmentGroups),
      accounts: toObj(accounts),
      safetyReport: s.safetyReport || DEFAULT_SAFETY_REPORT,
      safetyMonthlyTargets: s.safetyMonthlyTargets || {},
      safetyIdentificationOverrides: s.safetyIdentificationOverrides || {},
      scores: toObj((s.scores || []).map(compactForStorage)),
      safetyRecords: toObj((s.safetyRecords || []).map(compactForStorage)),
      deletedSafetyRecords: toObj((s.deletedSafetyRecords || []).map(compactForStorage)),
      history: toObj((s.history || []).filter((entry) => !isHistoryEntryExpired(entry))),
    };
  }

  // ─── Load from local storage (once on startup) ──────────────────────────────

  async function loadStateFromStorage() {
    const snapshot = await dbRef().once("value");
    const raw = snapshot.val();

    if (raw) {
      const normalized = normalizeState(raw);
      cleanupDeprecatedEmailStorage(raw, normalized).catch((error) => {
        console.warn("Không dọn được dữ liệu email cũ:", error);
      });
      cleanupExpiredHistoryStorage(raw).catch((error) => {
        console.warn("Không dọn được lịch sử cũ quá hạn:", error);
      });
      if (raw.version !== DATA_VERSION) {
        dbRef().set(stateToStorage(normalized)).catch((error) => {
          console.warn("Không nâng cấp được version dữ liệu:", error);
        });
      }
      return normalized;
    }

    // First run or version mismatch → seed default data
    const defaultState = createDefaultState();
    await dbRef().set(stateToStorage(defaultState));
    return defaultState;
  }

  async function cleanupExpiredHistoryStorage(raw) {
    const rawHistory = snapshotToArray(raw?.history);
    const expired = rawHistory.filter((entry) => isHistoryEntryExpired(entry));
    if (!expired.length) {
      return;
    }
    const updates = {};
    expired.forEach((entry) => {
      if (entry?.id) {
        updates[`history/${entry.id}`] = null;
      }
    });
    try {
      await dbRef().update(updates);
    } catch (error) {
      console.warn("Không dọn được log lịch sử cũ quá hạn 3 tháng:", error);
    }
  }

  async function cleanupDeprecatedEmailStorage(raw, normalized) {
    const updates = {};
    const rawAccounts = snapshotToArray(raw?.accounts);
    rawAccounts.forEach((account) => {
      if (!account?.id) {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(account, "email")) {
        updates[`accounts/${account.id}/email`] = null;
      }
      if (Object.prototype.hasOwnProperty.call(account, "senderEmail")) {
        updates[`accounts/${account.id}/senderEmail`] = null;
      }
    });

    const rawAreas = snapshotToArray(raw?.areas);
    rawAreas.forEach((area) => {
      if (!area?.id) {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(area, "managerEmails")) {
        updates[`areas/${area.id}/managerEmails`] = null;
      }
      if (Object.prototype.hasOwnProperty.call(area, "managerEmail")) {
        updates[`areas/${area.id}/managerEmail`] = null;
      }
    });

    const rawManagerById = new Map(snapshotToArray(raw?.managers).map((manager) => [manager.id, manager]));
    (normalized.managers || []).forEach((manager) => {
      const rawManager = rawManagerById.get(manager.id) || {};
      if (!areEmailListsEqual(rawManager.emails, manager.emails) && normalizeEmailList(manager.emails).length) {
        updates[`managers/${manager.id}/emails`] = normalizeEmailList(manager.emails);
      }
      ["email", "managerEmail", "managerEmails"].forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(rawManager, field)) {
          updates[`managers/${manager.id}/${field}`] = null;
        }
      });
    });

    if (Object.keys(updates).length) {
      await dbRef().update(updates);
    }
  }

  // ─── Save helpers (granular writes to local storage) ─────────────────────────

  async function saveState() {
    await dbRef().set(stateToStorage(state));
  }

  async function saveScore(score) {
    await dbRef(`scores/${score.id}`).set(score);
  }

  async function saveSafetyRecord(record) {
    await dbRef(`safetyRecords/${record.id}`).set(record);
  }

  async function deleteScoreFromDb(scoreId) {
    await dbRef(`scores/${scoreId}`).remove();
  }

  async function deleteSafetyRecordFromDb(recordId) {
    await dbRef(`safetyRecords/${recordId}`).remove();
  }

  async function deleteSafetyRecordDirect(recordId) {
    const record = state.safetyRecords.find((item) => item.id === recordId);
    if (!record) return false;
    const deletedMarker = getDeletedSafetyRecordMarker(record);
    const keepDeletedMarker = shouldKeepDeletedSafetyRecordMarker(record);
    state.safetyRecords = state.safetyRecords.filter((item) => item.id !== record.id);
    state.deletedSafetyRecords = keepDeletedMarker
      ? [
          ...(state.deletedSafetyRecords || []).filter((item) => item.id !== deletedMarker.id),
          deletedMarker,
        ]
      : (state.deletedSafetyRecords || []).filter((item) => item.id !== deletedMarker.id);
    const updates = {
      [`safetyRecords/${record.id}`]: null,
      [`deletedSafetyRecords/${deletedMarker.id}`]: keepDeletedMarker ? deletedMarker : null,
    };
    await updateRootWithOptionalRenderSuppression(updates, { suppressRender: true });
    await deleteSafetyRecordFromDb(record.id);
    return true;
  }

  function getDeletedSafetyRecordMarker(record) {
    const id = String(record?.id || "");
    return {
      id,
      sourceScoreId: id.startsWith("safety-") ? id.slice("safety-".length) : "",
      periodId: record?.periodId || "",
      areaId: record?.areaId || "",
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser?.username || "",
    };
  }

  function shouldKeepDeletedSafetyRecordMarker(record) {
    const marker = getDeletedSafetyRecordMarker(record);
    return Boolean(marker.sourceScoreId && (state.scores || []).some((score) => score.id === marker.sourceScoreId));
  }

  async function markSafetyRecordDeleted(record) {
    const marker = getDeletedSafetyRecordMarker(record);
    if (!marker.id || !shouldKeepDeletedSafetyRecordMarker(record)) {
      return;
    }
    await dbRef(`deletedSafetyRecords/${marker.id}`).set(marker);
  }

  async function tryMarkSafetyRecordDeleted(record) {
    try {
      await markSafetyRecordDeleted(record);
      return true;
    } catch (error) {
      console.warn("Không đánh dấu được báo cáo AT đã xóa:", error);
      return false;
    }
  }

  async function unmarkSafetyRecordDeleted(recordId) {
    if (!recordId) {
      return;
    }
    await dbRef(`deletedSafetyRecords/${recordId}`).remove();
  }

  async function tryUnmarkSafetyRecordDeleted(recordId) {
    try {
      await unmarkSafetyRecordDeleted(recordId);
    } catch (error) {
      console.warn("Không gỡ được đánh dấu xóa báo cáo AT:", error);
    }
  }

  async function tryLogAdminChange(change) {
    try {
      await logAdminChange(change);
    } catch (error) {
      console.warn("Không ghi được lịch sử thay đổi:", error);
    }
  }

  function isMeaningfulHistoryChange(entry) {
    if (!entry) {
      return false;
    }

    const beforeLabel = String(entry.beforeLabel || "");
    const afterLabel = String(entry.afterLabel || "");
    if (beforeLabel && afterLabel && beforeLabel === afterLabel) {
      return false;
    }

    return Boolean(entry.changeLabel || entry.subjectLabel || beforeLabel || afterLabel || entry.note);
  }

  function getHistoryChangeText(entry) {
    if (entry.changeLabel) {
      return entry.changeLabel;
    }
    if (entry.subjectLabel) {
      return entry.subjectLabel;
    }
    return [entry.beforeLabel, entry.afterLabel].filter(Boolean).join(" → ") || "Cập nhật dữ liệu";
  }

  function stageHistoryEntry(entry) {
    if (!isMeaningfulHistoryChange(entry)) {
      if (entry?.id) {
        state.history = (state.history || []).filter((item) => item.id !== entry.id);
      }
      return;
    }

    const timestamp = entry.timestamp || new Date().toISOString();
    const normalizedEntry = { ...entry, timestamp };
    if (!currentUser || !currentSessionId) {
      if (!state.history.some((item) => item.id === normalizedEntry.id)) {
        state.history.unshift(normalizedEntry);
      }
      return normalizedEntry;
    }

    const sessionHistoryId = currentSessionHistoryId || normalizedEntry.id || makeId("history");
    currentSessionHistoryId = sessionHistoryId;
    saveSession(currentUser);
    const existing = (state.history || []).find((item) => item.id === sessionHistoryId || item.sessionId === currentSessionId);
    const changeCount = Number(existing?.changeCount || 0) + 1;
    const latestChange = getHistoryChangeText(normalizedEntry);
    state.history = (state.history || []).filter((item) => item.id !== normalizedEntry.id && item.id !== sessionHistoryId && item.sessionId !== currentSessionId);

    const sessionPeriodId = normalizedEntry.periodId || existing?.periodId || "";
    const sessionScope = normalizedEntry.scope || existing?.scope || (sessionPeriodId ? getCatalogTypeForPeriod(sessionPeriodId) : "");
    const sessionEntry = {
      ...(existing || {}),
      id: sessionHistoryId,
      timestamp,
      periodId: sessionPeriodId,
      periodLabel: normalizedEntry.periodLabel || existing?.periodLabel || "",
      userName: getAccountDisplayName(currentUser, sessionScope, sessionPeriodId),
      username: currentUser?.username || "",
      areaId: normalizedEntry.areaId || existing?.areaId || "",
      areaCode: normalizedEntry.areaCode || existing?.areaCode || "",
      itemId: normalizedEntry.itemId || existing?.itemId || "",
      itemCode: normalizedEntry.itemCode || existing?.itemCode || "",
      itemName: normalizedEntry.itemName || existing?.itemName || "",
      criterionId: normalizedEntry.criterionId || existing?.criterionId || "",
      criterionLabel: normalizedEntry.criterionLabel || existing?.criterionLabel || "",
      subjectLabel: "Phiên đăng nhập",
      beforeLabel: existing?.beforeLabel || normalizedEntry.beforeLabel || "",
      afterLabel: normalizedEntry.afterLabel || existing?.afterLabel || "",
      scoreSource: normalizedEntry.scoreSource || existing?.scoreSource || "",
      source: normalizedEntry.source || existing?.source || "",
      sessionId: currentSessionId,
      sessionStartedAt: currentSessionStartedAt || existing?.sessionStartedAt || timestamp,
      sessionLastChangedAt: timestamp,
      changeCount,
      latestChange,
      changeLabel: `Phiên đăng nhập có ${changeCount} thay đổi`,
      note: changeCount === 1 ? latestChange : `Thay đổi gần nhất: ${latestChange}`,
    };

    state.history.unshift(sessionEntry);
    return sessionEntry;
  }

  async function saveHistoryEntry(entry) {
    const stagedEntry = stageHistoryEntry(entry);
    if (!stagedEntry) {
      return;
    }

    const expired = (state.history || []).filter((item) => isHistoryEntryExpired(item));
    if (expired.length) {
      state.history = (state.history || []).filter((item) => !isHistoryEntryExpired(item));
      if (!currentUser || isAdminAccount(currentUser)) {
        const cleanupUpdates = {};
        expired.forEach((item) => {
          if (item?.id) {
            cleanupUpdates[`history/${item.id}`] = null;
          }
        });
        cleanupUpdates[`history/${stagedEntry.id}`] = stagedEntry;
        await dbRef().update(cleanupUpdates);
        return;
      }
    }

    await dbRef(`history/${stagedEntry.id}`).set(stagedEntry);
  }

  async function updateRootWithOptionalRenderSuppression(updates, { suppressRender = false } = {}) {
    const shouldSuppress = suppressRender && Boolean(dataUnsubscribe);
    if (shouldSuppress) {
      suppressNextDataWatchRender += 1;
    }

    try {
      await dbRef().update(updates);
    } catch (error) {
      if (shouldSuppress) {
        suppressNextDataWatchRender = Math.max(0, suppressNextDataWatchRender - 1);
      }
      throw error;
    }
  }
  async function saveDepartmentHeadContact(contact, type = FIVE_S_PERIOD_TYPE) {
    await dbRef(`${catalogDbPath(type, "departmentHeadContacts")}/${contact.id}`).set(contact);
  }

  async function saveMeta() {
    await dbRef().update({
      activePeriodId: state.activePeriodId || "",
      activeFiveSPeriodId: state.activeFiveSPeriodId || "",
      activeSafetyPeriodId: state.activeSafetyPeriodId || "",
      benchmark: state.benchmark,
      fiveSChartTargets: normalizeFiveSChartTargets(state.fiveSChartTargets),
    });
  }

  async function saveSafetyReport() {
    await dbRef("safetyReport").set(state.safetyReport || DEFAULT_SAFETY_REPORT);
  }

  async function saveSafetyDepartmentGroups(groups = state.safetyDepartmentGroups) {
    const normalizedGroups = normalizeSafetyDepartmentGroups(groups, state.safetyAreas);
    const payload = normalizedGroups.length
      ? Object.fromEntries(normalizedGroups.map((group) => [group.id, group]))
      : null;
    await dbRef("safetyDepartmentGroups").set(payload);
  }

  async function savePeriodSnapshot(period) {
    if (!period?.id || !period.settingsSnapshot) {
      return;
    }

    await dbRef(`periods/${period.id}/settingsSnapshot`).set(period.settingsSnapshot);
  }

  async function ensurePeriodSnapshot(periodId) {
    const period = getPeriod(periodId);
    if (!period || period.settingsSnapshot) {
      return period?.settingsSnapshot || null;
    }

    period.settingsSnapshot = makeSettingsSnapshot(state, normalizeCatalogType(period.type));
    await savePeriodSnapshot(period);
    return period.settingsSnapshot;
  }

  function ensurePeriodSnapshotLocal(periodId) {
    const period = getPeriod(periodId);
    if (!period) {
      return null;
    }

    if (!period.settingsSnapshot) {
      period.settingsSnapshot = makeSettingsSnapshot(state, normalizeCatalogType(period.type));
    }

    return period.settingsSnapshot;
  }

  async function refreshLatestPeriodSnapshot(type = FIVE_S_PERIOD_TYPE) {
    const latest = getLatestWritablePeriod(type);
    if (!latest) {
      return;
    }

    latest.settingsSnapshot = makeSettingsSnapshot(state, normalizeCatalogType(type));
    await savePeriodSnapshot(latest);
  }

  function ensureAllPeriodSnapshots() {
    if (snapshotSeedPromise) {
      return snapshotSeedPromise;
    }

    const missingPeriods = state.periods.filter((period) => !period.settingsSnapshot);
    if (!missingPeriods.length) {
      return Promise.resolve();
    }

    missingPeriods.forEach((period) => {
      period.settingsSnapshot = makeSettingsSnapshot(state, normalizeCatalogType(period.type));
    });

    snapshotSeedPromise = Promise.all(missingPeriods.map((period) => savePeriodSnapshot(period)))
      .catch((error) => {
        console.warn("Không tạo được snapshot cho toàn bộ kỳ:", error);
      })
      .finally(() => {
        snapshotSeedPromise = null;
      });

    return snapshotSeedPromise;
  }

  function makeId(prefix) {
    const randomPart = Math.random().toString(36).slice(2, 8);
    return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
  }

  function makeStableId(prefix, value) {
    const text = String(value || "").trim().toLocaleLowerCase("vi");
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return `${prefix}-${Math.abs(hash).toString(36) || "0"}`;
  }

  function safetyAreaCodeKey(value) {
    return String(value || "").trim().toLocaleLowerCase("vi");
  }

  function getSafetyAreaCode(area) {
    return String(area?.templateCode || area?.code || "").trim();
  }

  function isReportableSafetyArea(area) {
    return !HIDDEN_SAFETY_ZONE_CODES.has(getSafetyAreaCode(area));
  }

  function normalizeSafetyDepartmentGroups(groups = [], areas = []) {
    const inputGroups = Array.isArray(groups) && groups.length ? groups : SAFETY_DEPARTMENT_GROUPS;
    const allowedCodes = new Set((areas || []).filter(isReportableSafetyArea).map(getSafetyAreaCode).filter(Boolean));
    const usedCodes = new Set();
    const normalizedGroups = [];

    inputGroups.forEach((group, index) => {
      const name = String(group?.name || "").trim();
      const rawCodes = Array.isArray(group?.zoneCodes) ? group.zoneCodes : [];
      const zoneCodes = [];
      rawCodes.forEach((codeValue) => {
        const code = String(codeValue || "").trim();
        if (!code || HIDDEN_SAFETY_ZONE_CODES.has(code) || usedCodes.has(code) || (allowedCodes.size && !allowedCodes.has(code))) {
          return;
        }
        zoneCodes.push(code);
        usedCodes.add(code);
      });
      if (!name && !zoneCodes.length) {
        return;
      }
      const groupName = name || "Nhóm " + (index + 1);
      normalizedGroups.push({
        id: group?.id || makeStableId("safety-department-group", groupName),
        name: groupName,
        zoneCodes,
        createdAt: group?.createdAt || "",
      });
    });

    return normalizedGroups;
  }

  function safetyDepartmentGroupsSignature(groups = []) {
    return JSON.stringify((groups || []).map((group) => ({
      name: String(group?.name || "").trim(),
      zoneCodes: [...new Set((group?.zoneCodes || []).map((code) => String(code || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")),
    })));
  }

  function describeSafetyDepartmentGroups(groups = []) {
    return (groups || []).map((group) => group.name + ": " + ((group.zoneCodes || []).join(", ") || "chưa chọn zone")).join(" | ") || "Chưa có nhóm";
  }

  function getSafetyDepartmentGroupConfigs(periodId = getActivePeriodId(SAFETY_PERIOD_TYPE)) {
    if (!state) {
      return normalizeSafetyDepartmentGroups(SAFETY_DEPARTMENT_GROUPS, []);
    }
    if (periodId && shouldUsePeriodSnapshot(periodId)) {
      const snapshot = getPeriodSnapshot(periodId);
      return normalizeSafetyDepartmentGroups(snapshot?.safetyDepartmentGroups, snapshot?.areas || []);
    }

    const areas = getAreasForPeriod(periodId || getActivePeriodId(SAFETY_PERIOD_TYPE));
    return normalizeSafetyDepartmentGroups(state.safetyDepartmentGroups, areas);
  }

  function getSafetyDepartmentNameFromGroups(area, groups = []) {
    const code = getSafetyAreaCode(area);
    const group = (groups || []).find((entry) => entry.zoneCodes.includes(code));
    return group?.name || area?.summaryGroup || area?.departmentHead || (area?.code ? "Zone " + area.code : "Khác");
  }

  function safetyDepartmentGroupZoneListHtml(index, selectedCodes = [], areas = [], periodId = getActivePeriodId(SAFETY_PERIOD_TYPE)) {
    const selected = new Set(selectedCodes.map((code) => String(code || "").trim()).filter(Boolean));
    const areaList = (areas || []).filter(isReportableSafetyArea);
    if (!areaList.length) {
      return '<p class="field-hint">Chưa có zone AT để chọn.</p>';
    }

    return areaList.map((area) => {
      const code = getSafetyAreaCode(area);
      return '<label class="check-line zone-check-item">' +
        '<input name="safetyGroupZoneCodes-' + index + '" type="checkbox" value="' + escapeHtml(code) + '" ' + (selected.has(code) ? "checked" : "") + '>' +
        '<span>Zone ' + escapeHtml(area.code) + ' · ' + escapeHtml(getAreaResponsibleNameForPeriod(periodId, area)) + '</span>' +
      '</label>';
    }).join("");
  }

  function safetyDepartmentGroupSettingsHtml(groups = [], areas = [], periodId = getActivePeriodId(SAFETY_PERIOD_TYPE)) {
    const normalizedGroups = normalizeSafetyDepartmentGroups(groups, areas);
    const cards = normalizedGroups.map((group, index) => '<article class="safety-group-config">' +
      '<input name="safetyGroupId-' + index + '" type="hidden" value="' + escapeHtml(group.id) + '">' +
      '<div class="safety-group-header">' +
        '<label><span>Tên nhóm</span><input name="safetyGroupName-' + index + '" type="text" value="' + escapeHtml(group.name) + '" placeholder="Ví dụ: Hàn"></label>' +
        '<label class="check-line safety-group-remove"><input name="safetyGroupRemove-' + index + '" type="checkbox"><span>Bỏ nhóm</span></label>' +
      '</div>' +
      '<div class="safety-group-zone-list">' + safetyDepartmentGroupZoneListHtml(index, group.zoneCodes, areas, periodId) + '</div>' +
    '</article>').join("");
    const newIndex = normalizedGroups.length;
    const newCard = '<article class="safety-group-config is-new">' +
      '<div class="safety-group-header">' +
        '<label><span>Nhóm mới</span><input name="safetyGroupNameNew" type="text" placeholder="Ví dụ: Cơ khí"></label>' +
      '</div>' +
      '<div class="safety-group-zone-list">' + safetyDepartmentGroupZoneListHtml(newIndex, [], areas, periodId) + '</div>' +
    '</article>';

    return '<div class="form-field full-span safety-group-settings">' +
      '<span>Thiết lập nhóm bộ phận AT</span>' +
      '<input name="safetyGroupCount" type="hidden" value="' + normalizedGroups.length + '">' +
      '<div class="safety-group-list">' + cards + newCard + '</div>' +
    '</div>';
  }

  function parseSafetyDepartmentGroupsFromForm(formData, areas = []) {
    const count = Math.max(0, Number(formData.get("safetyGroupCount")) || 0);
    const groups = [];
    for (let index = 0; index < count; index += 1) {
      if (formData.get("safetyGroupRemove-" + index) === "on") {
        continue;
      }
      const name = String(formData.get("safetyGroupName-" + index) || "").trim();
      const zoneCodes = formData.getAll("safetyGroupZoneCodes-" + index).map((value) => String(value || "").trim()).filter(Boolean);
      if (!name && !zoneCodes.length) {
        continue;
      }
      groups.push({
        id: String(formData.get("safetyGroupId-" + index) || "").trim() || makeStableId("safety-department-group", name || String(index + 1)),
        name,
        zoneCodes,
      });
    }

    const newName = String(formData.get("safetyGroupNameNew") || "").trim();
    const newZoneCodes = formData.getAll("safetyGroupZoneCodes-" + count).map((value) => String(value || "").trim()).filter(Boolean);
    if (newName || newZoneCodes.length) {
      groups.push({
        id: makeStableId("safety-department-group", newName || "nhom-moi-" + Date.now()),
        name: newName || "Nhóm mới",
        zoneCodes: newZoneCodes,
      });
    }

    return normalizeSafetyDepartmentGroups(groups, areas);
  }

  function findSafetyDepartmentGroupConflicts(formData) {
    const count = Math.max(0, Number(formData.get("safetyGroupCount")) || 0);
    const seen = new Map();
    const conflicts = [];

    function groupNameForIndex(index) {
      const fieldName = index < count ? "safetyGroupName-" + index : "safetyGroupNameNew";
      return String(formData.get(fieldName) || "").trim() || (index < count ? "Nhóm " + (index + 1) : "Nhóm mới");
    }

    for (let index = 0; index <= count; index += 1) {
      if (index < count && formData.get("safetyGroupRemove-" + index) === "on") {
        continue;
      }

      const groupName = groupNameForIndex(index);
      const fieldName = "safetyGroupZoneCodes-" + index;
      const groupCodes = [...new Set(formData.getAll(fieldName).map((value) => String(value || "").trim()).filter(Boolean))];
      groupCodes.forEach((code) => {
        const key = safetyAreaCodeKey(code);
        if (!key) {
          return;
        }
        if (seen.has(key)) {
          conflicts.push({ code, groups: [seen.get(key), groupName] });
          return;
        }
        seen.set(key, groupName);
      });
    }

    return conflicts;
  }

  function ensureSafetyDefaultAreas(areas = [], timestamp = "") {
    const usedCodes = new Set((areas || []).map((area) => safetyAreaCodeKey(area?.code)));
    let nextOrder = Math.max(0, ...(areas || []).map((area) => Number(area.order) || 0));
    EXTRA_SAFETY_AREA_COLUMNS.forEach((column) => {
      const key = safetyAreaCodeKey(column.code);
      if (!key || usedCodes.has(key)) {
        return;
      }
      nextOrder += 1;
      areas.push({
        id: makeStableId("area-safety", column.code),
        order: nextOrder,
        code: column.code,
        templateCode: column.code,
        departmentHead: column.departmentHead || "",
        summaryGroup: column.summaryGroup || column.departmentHead || column.code,
        scorerId: "",
        responsibleName: "",
        assessorId: "",
        assessorName: "",
        safetyTarget: Math.max(0, Math.round(Number(column.safetyTarget) || 0)),
        highlight: Boolean(column.highlight),
        createdAt: timestamp || new Date().toISOString(),
      });
      usedCodes.add(key);
    });
    return areas.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }


  function normalizeDepartmentHeadName(value) {
    return String(value || "").trim();
  }

  function departmentHeadKey(name) {
    return normalizeDepartmentHeadName(name).toLocaleLowerCase("vi");
  }

  function createDepartmentHeadContactsFromAreas(areas, timestamp = "") {
    return normalizeDepartmentHeadContacts([], areas, []).map((contact) => ({
      ...contact,
      createdAt: contact.createdAt || timestamp,
    }));
  }

  function normalizeDepartmentHeadContacts(contacts = [], areas = []) {
    const byKey = new Map();

    const upsert = (name, emails = [], createdAt = "", id = "") => {
      const cleanName = normalizeDepartmentHeadName(name);
      const key = departmentHeadKey(cleanName);
      if (!key) {
        return;
      }

      const existing = byKey.get(key);
      byKey.set(key, {
        id: existing?.id || id || makeStableId("department-head", cleanName),
        name: cleanName,
        emails: mergeEmailLists(existing?.emails, emails),
        createdAt: existing?.createdAt || createdAt || "",
      });
    };

    snapshotToArray(contacts).forEach((contact) => {
      upsert(
        contact?.name,
        mergeEmailLists(contact?.emails, contact?.email, contact?.managerEmail, contact?.managerEmails),
        contact?.createdAt || "",
        contact?.id || "",
      );
    });

    (areas || []).forEach((area) => {
      upsert(area?.departmentHead, [], area?.createdAt || "");
    });

    const now = new Date().toISOString();
    return [...byKey.values()]
      .map((contact) => ({
        ...contact,
        emails: normalizeEmailList(contact.emails),
        createdAt: contact.createdAt || now,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }


  function moveDepartmentHeadEmails(beforeName, afterName, contacts = [], areas = [], managers = []) {
    const beforeKey = departmentHeadKey(beforeName);
    const afterKey = departmentHeadKey(afterName);
    const normalized = normalizeDepartmentHeadContacts(contacts, areas, managers);
    if (!beforeKey || !afterKey || beforeKey === afterKey) {
      return normalized;
    }

    const beforeContact = normalized.find((contact) => departmentHeadKey(contact.name) === beforeKey);
    const beforeEmails = normalizeEmailList(beforeContact?.emails);
    if (!beforeEmails.length) {
      return normalized;
    }

    let afterContact = normalized.find((contact) => departmentHeadKey(contact.name) === afterKey);
    if (!afterContact) {
      afterContact = {
        id: makeStableId("department-head", afterName),
        name: normalizeDepartmentHeadName(afterName),
        emails: [],
        createdAt: beforeContact?.createdAt || new Date().toISOString(),
      };
      normalized.push(afterContact);
    }

    afterContact.emails = mergeEmailLists(afterContact.emails, beforeEmails);
    const beforeStillUsed = (areas || []).some((area) => departmentHeadKey(area?.departmentHead) === beforeKey);
    if (beforeContact && !beforeStillUsed) {
      beforeContact.emails = [];
    }

    return normalized.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }

  function getPeriods() {
    return [...state.periods].sort((a, b) => b.year - a.year || b.month - a.month || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }

  function getPeriodsByType(type) {
    const normalizedType = normalizePeriodType(type);
    return getPeriods().filter((period) => {
      const periodType = normalizePeriodType(period.type);
      return periodType === normalizedType || periodType === LEGACY_PERIOD_TYPE;
    });
  }

  function getActivePeriodId(type = FIVE_S_PERIOD_TYPE) {
    const normalizedType = normalizePeriodType(type);
    if (normalizedType === SAFETY_PERIOD_TYPE) {
      if (state.activeSafetyPeriodId && getPeriod(state.activeSafetyPeriodId)) {
        return state.activeSafetyPeriodId;
      }
      const activePeriod = getPeriod(state.activePeriodId);
      if (activePeriod && normalizePeriodType(activePeriod.type) === SAFETY_PERIOD_TYPE) {
        return state.activePeriodId;
      }
      return getPeriodsByType(SAFETY_PERIOD_TYPE)[0]?.id || "";
    }
    if (state.activeFiveSPeriodId && getPeriod(state.activeFiveSPeriodId)) {
      return state.activeFiveSPeriodId;
    }
    const activePeriod = getPeriod(state.activePeriodId);
    if (activePeriod && (normalizePeriodType(activePeriod.type) === FIVE_S_PERIOD_TYPE || normalizePeriodType(activePeriod.type) === LEGACY_PERIOD_TYPE)) {
      return state.activePeriodId;
    }
    return getPeriodsByType(FIVE_S_PERIOD_TYPE)[0]?.id || "";
  }

  function setActivePeriodId(type, id) {
    const normalizedType = normalizePeriodType(type);
    if (normalizedType === SAFETY_PERIOD_TYPE) {
      state.activeSafetyPeriodId = id;
    } else {
      state.activeFiveSPeriodId = id;
      state.activePeriodId = id;
    }
  }

  function getArchivedPeriods() {
    return [];
  }

  function isPeriodOpen(periodId, type = "") {
    if (!periodId) return false;
    const period = getPeriod(periodId);
    const normalizedType = normalizePeriodType(type || period?.type || FIVE_S_PERIOD_TYPE);
    return getActivePeriodId(normalizedType) === periodId;
  }

  function isPeriodArchived(periodId, type = "") {
    if (!periodId) return false;
    if (isAdminAccount(currentUser)) {
      return Boolean(getPeriod(periodId)?.archived);
    }
    return !isPeriodOpen(periodId, type);
  }

  function blockIfArchivedPeriod(periodId, type = "") {
    if (isAdminAccount(currentUser)) {
      return Boolean(getPeriod(periodId)?.archived);
    }
    if (!isPeriodOpen(periodId, type)) {
      showToast("Kỳ đánh giá này hiện không mở. Bạn không có quyền thao tác.", true);
      return true;
    }
    return false;
  }

  function getLatestPeriod(type = FIVE_S_PERIOD_TYPE) {
    return getPeriodsByType(type)[0] || getPeriods()[0] || null;
  }
  function getLatestWritablePeriod(type = FIVE_S_PERIOD_TYPE) {
    return getLatestPeriod(type);
  }
  function catalogDbPath(type = FIVE_S_PERIOD_TYPE, collection = "") {
    if (normalizeCatalogType(type) !== SAFETY_PERIOD_TYPE) {
      return collection;
    }
    return {
      managers: "safetyManagers",
      departmentHeadContacts: "safetyDepartmentHeadContacts",
      assessors: "safetyAssessors",
      areas: "safetyAreas",
    }[collection] || collection;
  }

  function getCatalogArrays(type = FIVE_S_PERIOD_TYPE, source = state) {
    const isSafety = normalizeCatalogType(type) === SAFETY_PERIOD_TYPE;
    return {
      managers: isSafety ? source?.safetyManagers || source?.managers || [] : source?.managers || [],
      departmentHeadContacts: isSafety ? source?.safetyDepartmentHeadContacts || source?.departmentHeadContacts || [] : source?.departmentHeadContacts || [],
      assessors: isSafety ? source?.safetyAssessors || source?.assessors || [] : source?.assessors || [],
      areas: isSafety ? source?.safetyAreas || source?.areas || [] : source?.areas || [],
      safetyDepartmentGroups: isSafety ? source?.safetyDepartmentGroups || [] : [],
    };
  }

  function getCatalogTypeForPeriod(periodId) {
    return normalizeCatalogType(getPeriod(periodId)?.type);
  }

  function getMutableManagers(type = FIVE_S_PERIOD_TYPE) {
    return normalizeCatalogType(type) === SAFETY_PERIOD_TYPE ? state.safetyManagers : state.managers;
  }

  function getMutableAssessors(type = FIVE_S_PERIOD_TYPE) {
    return normalizeCatalogType(type) === SAFETY_PERIOD_TYPE ? state.safetyAssessors : state.assessors;
  }

  function getMutableAreas(type = FIVE_S_PERIOD_TYPE) {
    return normalizeCatalogType(type) === SAFETY_PERIOD_TYPE ? state.safetyAreas : state.areas;
  }

  function getActiveCatalogPeriodId(type = activeCatalogScope) {
    return getActivePeriodId(type);
  }

  function ensureSnapshotArray(snapshot, key) {
    if (!Array.isArray(snapshot?.[key])) {
      snapshot[key] = [];
    }
    return snapshot[key];
  }

  function getMutableCatalogSnapshot(type = activeCatalogScope, periodId = getActiveCatalogPeriodId(type)) {
    const period = getPeriod(periodId);
    return period ? ensurePeriodSnapshotLocal(period.id) : null;
  }

  function getPeriodCatalogArrays(type = activeCatalogScope, periodId = getActiveCatalogPeriodId(type)) {
    const snapshot = periodId ? getPeriodSnapshot(periodId) || ensurePeriodSnapshotLocal(periodId) : null;
    return snapshot ? getCatalogArrays(type, snapshot) : getCatalogArrays(type);
  }

  function getMutablePeriodManagers(type = activeCatalogScope, periodId = getActiveCatalogPeriodId(type)) {
    const snapshot = getMutableCatalogSnapshot(type, periodId);
    return snapshot ? ensureSnapshotArray(snapshot, "managers") : getMutableManagers(type);
  }

  function getMutablePeriodAssessors(type = activeCatalogScope, periodId = getActiveCatalogPeriodId(type)) {
    const snapshot = getMutableCatalogSnapshot(type, periodId);
    return snapshot ? ensureSnapshotArray(snapshot, "assessors") : getMutableAssessors(type);
  }

  function getMutablePeriodAreas(type = activeCatalogScope, periodId = getActiveCatalogPeriodId(type)) {
    const snapshot = getMutableCatalogSnapshot(type, periodId);
    return snapshot ? ensureSnapshotArray(snapshot, "areas") : getMutableAreas(type);
  }

  function getPeriodCatalogAreas(type = activeCatalogScope, periodId = getActiveCatalogPeriodId(type)) {
    return [...getPeriodCatalogArrays(type, periodId).areas]
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }

  function getPeriodCatalogManagers(type = activeCatalogScope, periodId = getActiveCatalogPeriodId(type)) {
    return [...getPeriodCatalogArrays(type, periodId).managers]
      .filter((manager) => manager?.id && manager?.name)
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }

  function getPeriodCatalogAssessors(type = activeCatalogScope, periodId = getActiveCatalogPeriodId(type)) {
    return [...getPeriodCatalogArrays(type, periodId).assessors]
      .filter((assessor) => assessor?.id && assessor?.name)
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }

  function getPeriodCatalogManager(periodId, scorerId) {
    if (!periodId || !scorerId) {
      return null;
    }

    return getPeriodCatalogManagers(getCatalogTypeForPeriod(periodId), periodId).find((manager) => manager.id === scorerId) || null;
  }

  function getPeriodCatalogAssessor(periodId, assessorId) {
    if (!periodId || !assessorId) {
      return null;
    }

    return getPeriodCatalogAssessors(getCatalogTypeForPeriod(periodId), periodId).find((assessor) => assessor.id === assessorId) || null;
  }

  async function saveCatalogPeriodSnapshot(type = activeCatalogScope, periodId = getActiveCatalogPeriodId(type)) {
    const period = getPeriod(periodId);
    if (!period) {
      return;
    }

    ensurePeriodSnapshotLocal(period.id);
    await savePeriodSnapshot(period);
  }

  function getAreas(type = FIVE_S_PERIOD_TYPE) {
    return [...getCatalogArrays(type).areas].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }

  function getManagers(type = FIVE_S_PERIOD_TYPE) {
    return [...getCatalogArrays(type).managers].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }

  function getAssessors(type = FIVE_S_PERIOD_TYPE) {
    return [...(getCatalogArrays(type).assessors || [])]
      .filter((assessor) => assessor?.id && assessor?.name)
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }


  function getDepartmentHeadContacts(type = FIVE_S_PERIOD_TYPE) {
    const catalog = getCatalogArrays(type);
    const contacts = normalizeDepartmentHeadContacts(catalog.departmentHeadContacts, catalog.areas, catalog.managers);
    if (normalizeCatalogType(type) === SAFETY_PERIOD_TYPE) {
      state.safetyDepartmentHeadContacts = contacts;
    } else {
      state.departmentHeadContacts = contacts;
    }
    return contacts;
  }

  function getDepartmentHeadContactsForPeriod(periodId) {
    if (shouldUsePeriodSnapshot(periodId)) {
      const snapshot = getPeriodSnapshot(periodId);
      return normalizeDepartmentHeadContacts(snapshot?.departmentHeadContacts, snapshot?.areas, snapshot?.managers);
    }

    return getDepartmentHeadContacts(getCatalogTypeForPeriod(periodId));
  }

  function getDepartmentHeadContact(name, type = FIVE_S_PERIOD_TYPE) {
    const key = departmentHeadKey(name);
    if (!key) {
      return null;
    }

    return getDepartmentHeadContacts(type).find((contact) => departmentHeadKey(contact.name) === key) || null;
  }

  function ensureDepartmentHeadContact(name, type = FIVE_S_PERIOD_TYPE) {
    const cleanName = normalizeDepartmentHeadName(name);
    if (!cleanName) {
      return null;
    }

    const contacts = getDepartmentHeadContacts(type);
    let contact = getDepartmentHeadContact(cleanName, type);
    if (!contact) {
      contact = {
        id: makeStableId(normalizeCatalogType(type) === SAFETY_PERIOD_TYPE ? "safety-department-head" : "department-head", cleanName),
        name: cleanName,
        emails: [],
        createdAt: new Date().toISOString(),
      };
      contacts.push(contact);
      if (normalizeCatalogType(type) === SAFETY_PERIOD_TYPE) {
        state.safetyDepartmentHeadContacts = contacts;
      } else {
        state.departmentHeadContacts = contacts;
      }
    }

    return contact;
  }

  function getDepartmentHeadRows(periodId = getActivePeriodId(FIVE_S_PERIOD_TYPE)) {
    const areas = getAreasForPeriod(periodId);
    const contacts = getDepartmentHeadContactsForPeriod(periodId);
    const byKey = new Map();

    const upsert = (name, emails = []) => {
      const cleanName = normalizeDepartmentHeadName(name);
      const key = departmentHeadKey(cleanName);
      if (!key) {
        return null;
      }

      if (!byKey.has(key)) {
        byKey.set(key, { name: cleanName, emails: [], areaCodes: [] });
      }

      const row = byKey.get(key);
      row.name = cleanName;
      row.emails = mergeEmailLists(row.emails, emails);
      return row;
    };

    contacts.forEach((contact) => upsert(contact.name, contact.emails));
    areas.forEach((area) => {
      const row = upsert(area.departmentHead);
      if (row && area.code) {
        row.areaCodes.push(area.code);
      }
    });

    return [...byKey.values()]
      .map((row) => ({
        ...row,
        emails: normalizeEmailList(row.emails),
        areaCodes: [...new Set(row.areaCodes)].sort((a, b) => a.localeCompare(b, "vi")),
      }))
      .filter((row) => row.areaCodes.length || row.emails.length)
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }

  function getDepartmentHeadEmailsForPeriod(periodId, name) {
    const key = departmentHeadKey(name);
    if (!key) {
      return [];
    }

    const contact = getDepartmentHeadContactsForPeriod(periodId)
      .find((item) => departmentHeadKey(item.name) === key);
    return normalizeEmailList(contact?.emails);
  }

  function normalizeSettingsSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return null;
    }
    const rawAreas = snapshotToArray(snapshot.areas);
    if (!rawAreas.length) {
      return null;
    }

    let managers = snapshotToArray(snapshot.managers)
      .map((manager) => ({
        id: manager.id || makeStableId("scorer", manager.name),
        name: String(manager.name || "").trim(),
        emails: mergeEmailLists(manager.emails, manager.email, manager.managerEmail, manager.managerEmails),
        createdAt: manager.createdAt || "",
      }))
      .filter((manager) => manager.id && manager.name);
    const assessors = snapshotToArray(snapshot.assessors)
      .map((assessor) => ({
        id: assessor.id || makeStableId("assessor", assessor.name),
        name: String(assessor.name || "").trim(),
        createdAt: assessor.createdAt || "",
      }))
      .filter((assessor) => assessor.id && assessor.name);
    const managerById = new Map(managers.map((manager) => [manager.id, manager]));
    const assessorById = new Map(assessors.map((assessor) => [assessor.id, assessor]));
    const areas = snapshotToArray(snapshot.areas)
      .map((area, index) => ({
        id: area.id || makeStableId("area", area.code || String(index + 1)),
        order: Number.isFinite(Number(area.order)) ? Number(area.order) : index + 1,
        code: String(area.code || "").trim(),
        templateCode: area.templateCode || area.code || "",
        departmentHead: area.departmentHead || "",
        summaryGroup: area.summaryGroup || "",
        managerEmails: normalizeEmailList(area.managerEmails || area.managerEmail || ""),
        scorerId: area.scorerId || "",
        responsibleName: area.responsibleName || managerById.get(area.scorerId)?.name || area.scorerName || "",
        assessorId: area.assessorId || "",
        assessorIds: Array.isArray(area.assessorIds) ? [...new Set(area.assessorIds.filter(Boolean))] : [area.assessorId].filter(Boolean),
        assessorName: area.assessorName || assessorById.get(area.assessorId)?.name || "",
        safetyTarget: area.safetyTarget === "" || area.safetyTarget == null ? "" : Math.max(0, Math.round(Number(area.safetyTarget) || 0)),
        highlight: Boolean(area.highlight),
        createdAt: area.createdAt || "",
      }))
      .filter((area) => area.id && area.code)
      .sort((a, b) => a.order - b.order);
    const legacyEmailsByManagerId = new Map();
    areas.forEach((area) => {
      const emails = normalizeEmailList(area.managerEmails || area.managerEmail || "");
      if (area.scorerId && emails.length) {
        legacyEmailsByManagerId.set(area.scorerId, mergeEmailLists(legacyEmailsByManagerId.get(area.scorerId), emails));
      }
    });
    managers = managers.map((manager) => ({
      ...manager,
      emails: mergeEmailLists(manager.emails, legacyEmailsByManagerId.get(manager.id)),
    }));
    const areasWithoutLegacyEmails = areas.map((area) => {
      const { managerEmail, managerEmails, ...areaWithoutLegacyEmails } = area;
      return areaWithoutLegacyEmails;
    });
    const departmentHeadContacts = normalizeDepartmentHeadContacts(snapshot.departmentHeadContacts, areasWithoutLegacyEmails, managers);
    const safetyDepartmentGroups = normalizeSafetyDepartmentGroups(snapshot.safetyDepartmentGroups, areasWithoutLegacyEmails);

    return {
      version: Number(snapshot.version) || 1,
      capturedAt: snapshot.capturedAt || "",
      managers,
      departmentHeadContacts,
      assessors,
      areas: areasWithoutLegacyEmails,
      safetyDepartmentGroups,
      safetyReport: { ...DEFAULT_SAFETY_REPORT, ...(snapshot.safetyReport || {}) },
    };
  }

  function makeSettingsSnapshot(source = state, type = FIVE_S_PERIOD_TYPE) {
    const catalog = getCatalogArrays(type, source);
    const managers = [...(catalog.managers || [])].map((manager) => ({
      id: manager.id,
      name: manager.name || "",
      emails: normalizeEmailList(manager.emails),
      createdAt: manager.createdAt || "",
    }));
    const assessors = [...(catalog.assessors || [])].map((assessor) => ({
      id: assessor.id,
      name: assessor.name || "",
      createdAt: assessor.createdAt || "",
    }));
    const managerById = new Map(managers.map((manager) => [manager.id, manager]));
    const assessorById = new Map(assessors.map((assessor) => [assessor.id, assessor]));
    const areas = [...(catalog.areas || [])]
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
      .map((area, index) => ({
        id: area.id,
        order: Number.isFinite(Number(area.order)) ? Number(area.order) : index + 1,
        code: area.code || "",
        templateCode: area.templateCode || area.code || "",
        departmentHead: area.departmentHead || "",
        summaryGroup: area.summaryGroup || "",
        scorerId: area.scorerId || "",
        responsibleName: area.responsibleName || managerById.get(area.scorerId)?.name || area.scorerName || "",
        assessorId: area.assessorId || "",
        assessorIds: Array.isArray(area.assessorIds) ? [...new Set(area.assessorIds.filter(Boolean))] : [area.assessorId].filter(Boolean),
        assessorName: assessorById.get(area.assessorId)?.name || area.assessorName || "",
        safetyTarget: area.safetyTarget === "" || area.safetyTarget == null ? "" : Math.max(0, Math.round(Number(area.safetyTarget) || 0)),
        highlight: Boolean(area.highlight),
        createdAt: area.createdAt || "",
      }));
    const departmentHeadContacts = normalizeDepartmentHeadContacts(catalog.departmentHeadContacts, areas, managers);
    const safetyDepartmentGroups = normalizeCatalogType(type) === SAFETY_PERIOD_TYPE
      ? normalizeSafetyDepartmentGroups(source?.safetyDepartmentGroups, areas)
      : [];

    return {
      version: 1,
      capturedAt: new Date().toISOString(),
      managers,
      departmentHeadContacts,
      assessors,
      areas,
      safetyDepartmentGroups,
      safetyReport: { ...DEFAULT_SAFETY_REPORT, ...(source?.safetyReport || {}) },
    };
  }

  function resetPeopleInSettingsSnapshot(snapshot) {
    const areas = (snapshot?.areas || []).map((area) => ({
      ...area,
      departmentHead: "",
      scorerId: "",
      responsibleName: "",
      assessorId: "",
      assessorName: "",
    }));

    return {
      ...snapshot,
      capturedAt: new Date().toISOString(),
      managers: [],
      departmentHeadContacts: [],
      assessors: [],
      areas,
      safetyDepartmentGroups: normalizeSafetyDepartmentGroups(snapshot?.safetyDepartmentGroups, areas),
    };
  }

  function getNewPeriodCatalogTemplateMode(type = FIVE_S_PERIOD_TYPE) {
    const catalogType = normalizeCatalogType(type);
    const value = catalogType === SAFETY_PERIOD_TYPE
      ? elements.periodSafetyCatalogMode?.value
      : elements.period5SCatalogMode?.value;
    return value === PERIOD_CATALOG_TEMPLATE_RESET_PEOPLE
      ? PERIOD_CATALOG_TEMPLATE_RESET_PEOPLE
      : PERIOD_CATALOG_TEMPLATE_COPY;
  }

  function makeNewPeriodSettingsSnapshot(type = FIVE_S_PERIOD_TYPE, sourcePeriodId = "", templateMode = PERIOD_CATALOG_TEMPLATE_COPY) {
    const catalogType = normalizeCatalogType(type);
    const sourcePeriod = getPeriod(sourcePeriodId);
    const source = sourcePeriod?.settingsSnapshot || state;
    const snapshot = makeSettingsSnapshot(source, catalogType);
    return templateMode === PERIOD_CATALOG_TEMPLATE_RESET_PEOPLE
      ? resetPeopleInSettingsSnapshot(snapshot)
      : snapshot;
  }

  function getPeriodSnapshot(periodId) {
    const period = getPeriod(periodId);
    return period?.settingsSnapshot && typeof period.settingsSnapshot === "object" ? period.settingsSnapshot : null;
  }

  function shouldUsePeriodSnapshot(periodId) {
    if (!periodId) {
      return false;
    }

    return Boolean(getPeriodSnapshot(periodId));
  }

  function shouldEditPeriodSnapshot(periodId) {
    return shouldUsePeriodSnapshot(periodId);
  }

  function getAreasForPeriod(periodId) {
    if (shouldUsePeriodSnapshot(periodId)) {
      return [...getPeriodSnapshot(periodId).areas].sort((a, b) => a.order - b.order);
    }

    return getAreas(getCatalogTypeForPeriod(periodId));
  }

  function getManagersForPeriod(periodId) {
    if (shouldUsePeriodSnapshot(periodId)) {
      return [...(getPeriodSnapshot(periodId)?.managers || [])].sort((a, b) => a.name.localeCompare(b.name, "vi"));
    }

    return getManagers(getCatalogTypeForPeriod(periodId));
  }

  function getAssessorsForPeriod(periodId) {
    if (shouldUsePeriodSnapshot(periodId)) {
      return [...(getPeriodSnapshot(periodId)?.assessors || [])].sort((a, b) => a.name.localeCompare(b.name, "vi"));
    }

    return getAssessors(getCatalogTypeForPeriod(periodId));
  }

  function getPeriod(periodId) {
    if (arguments.length === 0) {
      const activePeriodId = getActivePeriodId(FIVE_S_PERIOD_TYPE);
      return state.periods.find((period) => period.id === activePeriodId) || null;
    }
    if (!periodId) {
      return null;
    }
    return state.periods.find((period) => period.id === periodId) || null;
  }

  function getArea(areaId, type = FIVE_S_PERIOD_TYPE) {
    return getAreas(type).find((area) => area.id === areaId) || null;
  }

  function getManager(scorerId, type = FIVE_S_PERIOD_TYPE) {
    return getManagers(type).find((manager) => manager.id === scorerId) || null;
  }

  function getAssessor(assessorId, type = FIVE_S_PERIOD_TYPE) {
    return getAssessors(type).find((assessor) => assessor.id === assessorId) || null;
  }

  function getAreaForPeriod(periodId, areaId) {
    return getAreasForPeriod(periodId).find((area) => area.id === areaId) || null;
  }

  function getManagerForPeriod(periodId, scorerId) {
    return getManagersForPeriod(periodId).find((manager) => manager.id === scorerId) || null;
  }

  function getAssessorForPeriod(periodId, assessorId) {
    return getAssessorsForPeriod(periodId).find((assessor) => assessor.id === assessorId) || null;
  }

  function getItem(itemId) {
    return DEFAULT_ITEMS.find((item) => item.id === itemId) || null;
  }

  function getCriterion(item, criterionId) {
    return item?.criteria.find((criterion) => criterion.id === criterionId) || null;
  }

  function stripSafetyPeriodLabelPrefix(label = "") {
    return String(label || "")
      .trim()
      .replace(/^(?:Đánh giá AT|Danh gia AT)\s*/i, "")
      .trim();
  }

  function safetyPeriodDateLabel(period) {
    const isoDate = toIsoDate(period?.createdAt);
    if (isoDate) {
      const [year, month, day] = isoDate.split("-");
      return `${day}/${month}/${year}`;
    }
    return period?.month && period?.year ? `Tháng ${period.month}/${period.year}` : "";
  }

  function safetyPeriodInputDate(period) {
    const createdAtDate = toIsoDate(period?.createdAt);
    if (createdAtDate) {
      return createdAtDate;
    }
    const label = stripSafetyPeriodLabelPrefix(period?.label || "");
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(label);
    if (match) {
      return `${match[3]}-${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
    }
    if (period?.year && period?.month) {
      return `${period.year}-${String(Number(period.month)).padStart(2, "0")}-01`;
    }
    return todayIsoDate();
  }

  function periodLabel(period) {
    if (!period) {
      return "Chưa có kỳ đánh giá";
    }
    if (normalizePeriodType(period.type) === SAFETY_PERIOD_TYPE) {
      const safetyLabel = stripSafetyPeriodLabelPrefix(period.label) || safetyPeriodDateLabel(period);
      if (safetyLabel) return safetyLabel;
    }
    if (period.label && !period.label.includes("undefined")) {
      return period.label;
    }
    if (period.month && period.year) {
      return `Tháng ${period.month}/${period.year}`;
    }
    const match = /(?:5s|safety)-(\d{4})-(\d{1,2})/i.exec(period.id || "");
    if (match) {
      return `Tháng ${Number(match[2])}/${match[1]}`;
    }
    return period.id || "Chưa có kỳ đánh giá";
  }

  function isAdminAccount(account) {
    return normalizeAccountRole(account?.role) === ROLE_ADMIN;
  }

  function isViewerAccount(account) {
    return normalizeAccountRole(account?.role) === ROLE_VIEWER;
  }

  function isDepartmentHeadAccount(account) {
    return normalizeAccountRole(account?.role) === ROLE_DEPARTMENT_HEAD;
  }

  function isZoneOwnerAccount(account, type = FIVE_S_PERIOD_TYPE) {
    return getAccountRoleForType(account, type) === ROLE_ZONE_OWNER;
  }

  function isFiveSAssessor(account) {
    return !isViewerAccount(account) && !isDepartmentHeadAccount(account) && (isAdminAccount(account) || hasAccountAccessType(account, FIVE_S_PERIOD_TYPE));
  }

  function isSafetyAssessor(account) {
    return !isViewerAccount(account) && !isDepartmentHeadAccount(account) && hasAccountAccessType(account, SAFETY_PERIOD_TYPE);
  }

  function canUseSafety(account) {
    return !isViewerAccount(account) && (isAdminAccount(account) || isDepartmentHeadAccount(account) || hasAccountAccessType(account, SAFETY_PERIOD_TYPE));
  }

  function sameNormalizedText(left, right) {
    return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
  }

  function safetyRecordTextMatchesName(value, name) {
    const cleanName = String(name || "").trim();
    const cleanValue = String(value || "").trim();
    if (!cleanName || !cleanValue) {
      return false;
    }
    return sameNormalizedText(cleanValue, cleanName) || cleanValue
      .split(/[,;\n]+/g)
      .map((part) => part.trim())
      .filter(Boolean)
      .some((part) => sameNormalizedText(part, cleanName));
  }

  function isSafetyRecordOwnedByAccount(record, account = currentUser) {
    if (!record || !account) {
      return false;
    }
    if (isAdminAccount(account)) {
      return true;
    }
    const username = String(account.username || "").trim();
    const recordUsername = String(record.accountUsername || record.createdBy || "").trim();
    if (recordUsername) {
      return sameNormalizedText(recordUsername, username);
    }
    const displayName = getAccountDisplayName(account, SAFETY_PERIOD_TYPE, record.periodId || getActivePeriodId(SAFETY_PERIOD_TYPE));
    const personId = getAccountPersonId(account, SAFETY_PERIOD_TYPE);
    const assessor = personId ? getPeriodCatalogAssessor(record.periodId || getActivePeriodId(SAFETY_PERIOD_TYPE), personId) : null;
    const assessorName = assessor?.name || "";

    if (record.scorerName) {
      return Boolean(
        (displayName && sameNormalizedText(record.scorerName, displayName)) ||
        (assessorName && sameNormalizedText(record.scorerName, assessorName)) ||
        (username && sameNormalizedText(record.scorerName, username))
      );
    }

    return Boolean(displayName) && (
      safetyRecordTextMatchesName(record.issueFoundBy, displayName) ||
      safetyRecordTextMatchesName(record.issueFoundBy, username)
    );
  }

  function getSafetyRecordOwnerAccount(record) {
    if (!record) {
      return null;
    }
    const recordUsername = String(record.accountUsername || "").trim();
    if (recordUsername) {
      return state.accounts.find((account) => sameNormalizedText(account.username, recordUsername)) || null;
    }
    return state.accounts.find((account) => (
      !isAdminAccount(account) &&
      canUseSafety(account) &&
      isSafetyRecordOwnedByAccount(record, account)
    )) || null;
  }

  function canManageSafetyRecord(record, account = currentUser) {
    if (!record || !account || isPeriodArchived(record.periodId)) {
      return false;
    }
    if (isAdminAccount(account)) {
      return true;
    }
    return canUseSafety(account) && isSafetyRecordOwnedByAccount(record, account);
  }

  function getDepartmentHeadAccountName(account) {
    if (!account) {
      return "";
    }
    return normalizeDepartmentHeadName(account.departmentHeadName || account.name || account.displayName || account.username);
  }

  function isAreaManagedByDepartmentHead(area, account) {
    const key = departmentHeadKey(getDepartmentHeadAccountName(account));
    return Boolean(key && departmentHeadKey(area?.departmentHead) === key);
  }

  function getDepartmentHeadManagedAreaIds(account = currentUser, periodId = getActivePeriodId(SAFETY_PERIOD_TYPE)) {
    if (!isDepartmentHeadAccount(account)) {
      return new Set();
    }
    return new Set(
      getAreasForPeriod(periodId)
        .filter((area) => isAreaManagedByDepartmentHead(area, account))
        .map((area) => area.id)
        .filter(Boolean),
    );
  }

  function canManageSafetyCountermeasure(record, account = currentUser) {
    if (!record || !account || isPeriodArchived(record.periodId, SAFETY_PERIOD_TYPE)) {
      return false;
    }
    if (isAdminAccount(account) || canManageSafetyRecord(record, account)) {
      return true;
    }
    if (isDepartmentHeadAccount(account)) {
      return getDepartmentHeadManagedAreaIds(account, record.periodId).has(record.areaId);
    }
    if (isZoneOwnerAccount(account, SAFETY_PERIOD_TYPE)) {
      return getAllowedAreaIds(account, record.periodId).has(record.areaId);
    }
    return false;
  }

  function requireAdminAction(message = "Chỉ admin được thực hiện thao tác này.") {
    if (isAdminAccount(currentUser)) {
      return true;
    }
    showToast(message, true);
    return false;
  }

  function canExportReports(account = currentUser) {
    return Boolean(account) && (
      isAdminAccount(account) ||
      isViewerAccount(account) ||
      isDepartmentHeadAccount(account) ||
      hasAccountAccessType(account, FIVE_S_PERIOD_TYPE) ||
      hasAccountAccessType(account, SAFETY_PERIOD_TYPE)
    );
  }

  function requireExportAction(message = "Bạn không có quyền xuất file Excel.") {
    if (canExportReports(currentUser)) {
      return true;
    }
    showToast(message, true);
    return false;
  }

  function getScoreSourceForAccount(account = currentUser) {
    return isZoneOwnerAccount(account, FIVE_S_PERIOD_TYPE) ? SCORE_SOURCE_SELF : SCORE_SOURCE_ASSESSOR;
  }

  function canEditFiveSScoreSource(account, scoreSource) {
    return isAdminAccount(account) || normalizeScoreSource(scoreSource) === getScoreSourceForAccount(account);
  }

  function getRoleLabel(role) {
    const normalizedRole = normalizeAccountRole(role);
    if (normalizedRole === ROLE_ADMIN) return "Admin hệ thống";
    if (normalizedRole === ROLE_VIEWER) return "Người xem";
    if (normalizedRole === ROLE_DEPARTMENT_HEAD) return "Trưởng phòng";
    if (normalizedRole === ROLE_ASSESSOR_SAFETY) return "Assessor an toàn";
    if (normalizedRole === ROLE_ZONE_OWNER) return "Người phụ trách zone";
    return "Assessor 5S";
  }

  function getScopedRoleLabel(role, type = FIVE_S_PERIOD_TYPE) {
    const scopedRole = normalizeScopedAccountRole(role, type);
    if (scopedRole === ROLE_VIEWER) return "Người xem";
    if (scopedRole === ROLE_DEPARTMENT_HEAD) return "Trưởng phòng";
    if (scopedRole === ROLE_ZONE_OWNER) return "Người phụ trách zone";
    return normalizeCatalogType(type) === SAFETY_PERIOD_TYPE ? "Assessor AT" : "Assessor 5S";
  }

  function getAccountAccessLabel(account, type = "") {
    if (isAdminAccount(account)) return "Admin hệ thống";
    if (isViewerAccount(account)) return "Người xem";
    if (isDepartmentHeadAccount(account)) return "Trưởng phòng";
    const accessTypes = type ? [normalizeCatalogType(type)] : normalizeAccountAccessTypes(account?.accessTypes, account?.role);
    return accessTypes
      .filter((accessType) => hasAccountAccessType(account, accessType))
      .map((accessType) => getScopedRoleLabel(getAccountRoleForType(account, accessType), accessType))
      .join(" + ") || getRoleLabel(account?.role);
  }

  function getAccountDisplayName(account, type = "", periodId = "") {
    if (!account) {
      return "";
    }

    if (isAdminAccount(account)) {
      return account.name || account.username;
    }
    if (isViewerAccount(account)) {
      return account.name || account.displayName || account.username;
    }
    if (isDepartmentHeadAccount(account)) {
      return account.departmentHeadName || account.name || account.displayName || account.username;
    }

    const catalogType = type ? normalizeCatalogType(type) : normalizeAccountRole(account.role) === ROLE_ASSESSOR_SAFETY ? SAFETY_PERIOD_TYPE : FIVE_S_PERIOD_TYPE;
    const catalogPeriodId = periodId || getActivePeriodId(catalogType);
    const personId = getAccountPersonId(account, catalogType);
    if (isZoneOwnerAccount(account, catalogType)) {
      return getPeriodCatalogManager(catalogPeriodId, personId)?.name || getManager(personId, catalogType)?.name || account.name || account.username;
    }

    return getPeriodCatalogAssessor(catalogPeriodId, personId)?.name || getAssessor(personId, catalogType)?.name || account.name || account.username;
  }

  function getAccountProfileName(account) {
    if (!account) {
      return "";
    }

    if (isAdminAccount(account)) {
      return account.displayName || account.name || account.username || "";
    }
    if (isViewerAccount(account)) {
      return account.name || account.displayName || account.username || "";
    }
    if (isDepartmentHeadAccount(account)) {
      return account.displayName || account.departmentHeadName || account.name || account.username || "";
    }

    return account.displayName || account.username || "";
  }

  function getAreaResponsibleName(area, type = FIVE_S_PERIOD_TYPE) {
    return getAreaResponsibleNameForPeriod(getActivePeriodId(type), area);
  }

  function getAreaConfiguredAssessorName(area, type = FIVE_S_PERIOD_TYPE) {
    return getAreaConfiguredAssessorNameForPeriod(getActivePeriodId(type), area);
  }

  function getAreaResponsibleNameForPeriod(periodId, area) {
    return area?.responsibleName || getManagerForPeriod(periodId, area?.scorerId)?.name || "Chưa phân quyền";
  }

  function getAreaDepartmentHeadEmailsForPeriod(periodId, area) {
    return getDepartmentHeadEmailsForPeriod(periodId, area?.departmentHead);
  }

  function getAreaConfiguredAssessorNameForPeriod(periodId, area) {
    return area?.assessorName || getAssessorForPeriod(periodId, area?.assessorId)?.name || "";
  }


  function getSafetyDepartmentForArea(area, periodId = getActivePeriodId(SAFETY_PERIOD_TYPE)) {
    return getSafetyDepartmentNameFromGroups(area, getSafetyDepartmentGroupConfigs(periodId));
  }

  function normalizeSafetyTargetValue(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
  }

  function getSafetyZoneTarget(area) {
    const explicitTarget = area?.safetyTarget;
    if (explicitTarget !== "" && explicitTarget != null) {
      const numericTarget = Number(explicitTarget);
      if (Number.isFinite(numericTarget) && numericTarget > 0) {
        return Math.round(numericTarget);
      }
    }

    const code = String(area?.templateCode || area?.code || "").trim();
    return SAFETY_ZONE_TARGETS[code] || 0;
  }

  function getSafetyMonthlyTarget(year, month) {
    const y = String(year || "");
    const m = String(month || "");
    const targetMap = state?.safetyMonthlyTargets || {};
    const val = targetMap[y]?.[m] ?? targetMap[`${y}-${m}`];
    if (val !== undefined && val !== null && val !== "") {
      const num = Number(val);
      if (Number.isFinite(num) && num >= 0) {
        return num;
      }
    }
    try {
      const raw = window.localStorage?.getItem("safetyMonthlyTargets");
      if (raw) {
        const parsed = JSON.parse(raw);
        const lVal = parsed[y]?.[m] ?? parsed[`${y}-${m}`];
        if (lVal !== undefined && lVal !== null && lVal !== "") {
          const num = Number(lVal);
          if (Number.isFinite(num) && num >= 0) return num;
        }
      }
    } catch {}
    return 100;
  }

  async function updateSafetyMonthlyTarget(year, month, value) {
    const y = String(year || "");
    const m = String(month || "");
    if (!y || !m) return 100;
    const num = value === "" || value === null ? 100 : Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    if (!state.safetyMonthlyTargets) {
      state.safetyMonthlyTargets = {};
    }
    if (!state.safetyMonthlyTargets[y]) {
      state.safetyMonthlyTargets[y] = {};
    }
    state.safetyMonthlyTargets[y][m] = num;
    try {
      window.localStorage?.setItem("safetyMonthlyTargets", JSON.stringify(state.safetyMonthlyTargets));
    } catch {}
    try {
      await dbRef(`safetyMonthlyTargets/${y}/${m}`).set(num);
    } catch (e) {
      console.warn("Could not sync safetyMonthlyTargets to db:", e);
    }
    showToast(`Đã lưu mục tiêu T${m}/${y}: ${num}%`);
    renderActiveTab();
    return num;
  }

  function getFiveSChartTargets() {
    return normalizeFiveSChartTargets(state?.fiveSChartTargets);
  }

  function getFiveSChartTarget(targetKey = "zone") {
    const targets = getFiveSChartTargets();
    return targetKey === "item" ? targets.item : targets.zone;
  }

  async function updateFiveSChartTarget(targetKey = "zone", value = "") {
    if (!isAdminAccount(currentUser)) {
      showToast("Chỉ admin được sửa target biểu đồ 5S.", true);
      return false;
    }

    const key = targetKey === "item" ? "item" : "zone";
    const rawValue = String(value ?? "").trim();
    const numeric = Number(rawValue);
    if (!rawValue || !Number.isFinite(numeric) || numeric < 0 || numeric > 5) {
      showToast("Target 5S phải là số từ 0 đến 5.", true);
      return false;
    }

    const targets = getFiveSChartTargets();
    const beforeValue = targets[key];
    const nextValue = normalizeFiveSChartTargetValue(numeric, beforeValue);
    if (beforeValue === nextValue) {
      showToast("Không có thay đổi mới.");
      return true;
    }

    targets[key] = nextValue;
    state.fiveSChartTargets = targets;
    await Promise.all([
      saveMeta(),
      logAdminChange({
        subjectLabel: "Target biểu đồ 5S",
        beforeLabel: key === "item" ? "Hạng mục: " + beforeValue : "Zone: " + beforeValue,
        afterLabel: key === "item" ? "Hạng mục: " + nextValue : "Zone: " + nextValue,
        changeLabel: key === "item" ? "Sửa target biểu đồ hạng mục 5S" : "Sửa target biểu đồ zone 5S",
        scope: FIVE_S_PERIOD_TYPE,
      }),
    ]);
    showToast("Đã cập nhật target biểu đồ 5S.");
    renderActiveTab();
    return true;
  }

  async function updateSafetyZoneTarget(periodId, areaId, value, isUndoRedo = false) {
    if (!isAdminAccount(currentUser)) {
      showToast("Chỉ admin được sửa mục tiêu/tháng.", true);
      renderActiveTab();
      return;
    }

    const cleanAreaId = String(areaId || "");
    const period = getPeriod(periodId || getActivePeriodId(SAFETY_PERIOD_TYPE));
    if (!period || !cleanAreaId) {
      showToast("Không tìm thấy kỳ hoặc zone để cập nhật.", true);
      return;
    }

    const isReset = value === "" || value === null || value === undefined;
    const numeric = Number(value);
    const target = isReset || !Number.isFinite(numeric) || numeric <= 0 ? "" : Math.round(numeric);
    let oldSafetyTarget = "";
    let oldDisplayTarget = 0;
    let targetAreaCode = "";

    if (shouldEditPeriodSnapshot(period.id)) {
      const snapshot = ensurePeriodSnapshotLocal(period.id);
      const snapshotArea = snapshot?.areas?.find((area) => area.id === cleanAreaId);
      if (!snapshotArea) {
        showToast("Không tìm thấy zone trong kỳ này.", true);
        renderActiveTab();
        return;
      }

      oldSafetyTarget = snapshotArea.safetyTarget !== undefined && snapshotArea.safetyTarget !== null ? snapshotArea.safetyTarget : "";
      oldDisplayTarget = getSafetyZoneTarget(snapshotArea);
      targetAreaCode = snapshotArea.code || "";
      snapshotArea.safetyTarget = target;
      await savePeriodSnapshot(period);
    } else {
      const area = getArea(cleanAreaId, SAFETY_PERIOD_TYPE);
      if (!area) {
        showToast("Không tìm thấy zone để cập nhật.", true);
        renderActiveTab();
        return;
      }

      oldSafetyTarget = area.safetyTarget !== undefined && area.safetyTarget !== null ? area.safetyTarget : "";
      oldDisplayTarget = getSafetyZoneTarget(area);
      targetAreaCode = area.code || "";
      area.safetyTarget = target;
      await dbRef(`${catalogDbPath(SAFETY_PERIOD_TYPE, "areas")}/${area.id}`).update({ safetyTarget: target });
      const snapshotArea = period.settingsSnapshot?.areas?.find((item) => item.id === cleanAreaId);
      if (snapshotArea) {
        snapshotArea.safetyTarget = target;
        await savePeriodSnapshot(period);
      }
    }

    const newDisplayTarget = target === "" ? (SAFETY_ZONE_TARGETS[targetAreaCode] || 0) : target;

    if (!isUndoRedo && oldDisplayTarget !== newDisplayTarget) {
      pushUndoAction({
        type: "safetyTarget",
        description: `Mục tiêu AT Zone ${targetAreaCode}: ${oldDisplayTarget} → ${newDisplayTarget}`,
        periodId: period.id,
        areaId: cleanAreaId,
        areaCode: targetAreaCode,
        before: oldSafetyTarget,
        after: target,
      });
    }

    showToast("Đã cập nhật mục tiêu/tháng.");
    renderActiveTab();
  }


  function getSafetyDepartmentGroups(periodId = getActivePeriodId(SAFETY_PERIOD_TYPE)) {
    const areas = getAreasForPeriod(periodId).filter(isReportableSafetyArea);
    const configuredGroups = getSafetyDepartmentGroupConfigs(periodId);
    const byName = new Map(configuredGroups.map((group) => [group.name, { name: group.name, areas: [] }]));
    areas.forEach((area) => {
      const name = getSafetyDepartmentNameFromGroups(area, configuredGroups);
      if (!byName.has(name)) byName.set(name, { name, areas: [] });
      byName.get(name).areas.push(area);
    });
    return [...byName.values()].filter((group) => group.areas.length);
  }

  function getAreaScorerName(area, periodId = getActivePeriodId(FIVE_S_PERIOD_TYPE)) {
    return getAreaResponsibleNameForPeriod(periodId, area);
  }

  function getAllowedAreaIds(account = currentUser, periodId = getActivePeriodId(FIVE_S_PERIOD_TYPE)) {
    if (!account) {
      return new Set();
    }

    const periodAreas = getAreasForPeriod(periodId);
    const catalogType = getCatalogTypeForPeriod(periodId);
    if (isAdminAccount(account) || isViewerAccount(account)) {
      return new Set(periodAreas.map((area) => area.id));
    }
    if (isDepartmentHeadAccount(account)) {
      return new Set(periodAreas
        .filter((area) => isAreaManagedByDepartmentHead(area, account))
        .map((area) => area.id));
    }
    if (!hasAccountAccessType(account, catalogType)) {
      return new Set();
    }

    const scopedRole = getAccountRoleForType(account, catalogType);
    const personId = getAccountPersonId(account, catalogType);
    const explicitIds = getAccountAreaIds(account, catalogType);
    const byPerson = periodAreas
      .filter((area) => scopedRole === ROLE_ZONE_OWNER
        ? personId && area.scorerId === personId
        : personId && (area.assessorId === personId || (Array.isArray(area.assessorIds) && area.assessorIds.includes(personId)))
      )
      .map((area) => area.id);

    return new Set([...explicitIds, ...byPerson]);
  }

  function isNotApplicable(itemId, criterionId, area) {
    return false;
  }

  function invalidateScoreRecordIndex() {
    scoreRecordIndex = null;
  }

  function scoreRecordKey(periodId, areaId, itemId, criterionId, scoreSource = SCORE_SOURCE_ASSESSOR) {
    return [
      String(periodId || ""),
      String(areaId || ""),
      String(itemId || ""),
      String(criterionId || ""),
      normalizeScoreSource(scoreSource),
    ].join("\u001f");
  }

  function getScoreRecordIndex() {
    if (!scoreRecordIndex) {
      scoreRecordIndex = new Map();
      (state.scores || []).forEach((score) => {
        const key = scoreRecordKey(score.periodId, score.areaId, score.itemId, score.criterionId, score.scoreSource);
        if (!scoreRecordIndex.has(key)) {
          scoreRecordIndex.set(key, score);
        }
      });
    }
    return scoreRecordIndex;
  }

  function getScoreRecord(periodId, areaId, itemId, criterionId, scoreSource = SCORE_SOURCE_ASSESSOR) {
    return getScoreRecordIndex().get(scoreRecordKey(periodId, areaId, itemId, criterionId, scoreSource)) || null;
  }

  function getScoreValue(periodId, areaId, itemId, criterionId, scoreSource = SCORE_SOURCE_ASSESSOR) {
    const record = getScoreRecord(periodId, areaId, itemId, criterionId, scoreSource);
    return Number.isFinite(record?.score) ? record.score : null;
  }

  function isScoreCrossed(record) {
    return record?.status === SCORE_CROSSED;
  }

  function getRequiredCellsForArea(area) {
    let count = 0;
    DEFAULT_ITEMS.forEach((item) => {
      item.criteria.forEach((criterion) => {
        if (!isNotApplicable(item.id, criterion.id, area)) {
          count += 1;
        }
      });
    });
    return count;
  }

  function average(values) {
    const numbers = values.filter((value) => Number.isFinite(value));
    if (!numbers.length) {
      return null;
    }

    return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  }

  function areaAverage(periodId, area, scoreSource = SCORE_SOURCE_ASSESSOR) {
    const values = [];
    DEFAULT_ITEMS.forEach((item) => {
      item.criteria.forEach((criterion) => {
        if (!isNotApplicable(item.id, criterion.id, area)) {
          values.push(getScoreValue(periodId, area.id, item.id, criterion.id, scoreSource));
        }
      });
    });
    return average(values);
  }

  function itemAverage(periodId, item, areas = getAreasForPeriod(periodId), scoreSource = SCORE_SOURCE_ASSESSOR) {
    const values = [];
    areas.forEach((area) => {
      item.criteria.forEach((criterion) => {
        if (!isNotApplicable(item.id, criterion.id, area)) {
          values.push(getScoreValue(periodId, area.id, item.id, criterion.id, scoreSource));
        }
      });
    });
    return average(values);
  }

  function groupAverage(periodId, areas, scoreSource = SCORE_SOURCE_ASSESSOR) {
    return average(areas.map((area) => areaAverage(periodId, area, scoreSource)));
  }

  function overallAverage(periodId, areas = getAreasForPeriod(periodId), scoreSource = SCORE_SOURCE_ASSESSOR) {
    return average(areas.map((area) => areaAverage(periodId, area, scoreSource)));
  }

  function getCompletedCellCount(periodId, area, scoreSource = SCORE_SOURCE_ASSESSOR) {
    let count = 0;
    DEFAULT_ITEMS.forEach((item) => {
      item.criteria.forEach((criterion) => {
        const record = getScoreRecord(periodId, area.id, item.id, criterion.id, scoreSource);
        if (!isNotApplicable(item.id, criterion.id, area) && (Number.isFinite(record?.score) || isScoreCrossed(record))) {
          count += 1;
        }
      });
    });
    return count;
  }

  function getPeriodStats(periodId, scoreSource = SCORE_SOURCE_ASSESSOR) {
    const areas = getAreasForPeriod(periodId);
    const areaAverages = areas.map((area) => ({ area, average: areaAverage(periodId, area, scoreSource) }));
    const completedAreas = areas.filter((area) => {
      const required = getRequiredCellsForArea(area);
      return required > 0 && getCompletedCellCount(periodId, area, scoreSource) >= required;
    });

    return {
      overall: overallAverage(periodId, areas, scoreSource),
      completedAreas: completedAreas.length,
      totalAreas: areas.length,
      belowTarget: areaAverages.filter((row) => Number.isFinite(row.average) && row.average < state.benchmark).length,
      editCount: state.history.filter((entry) => normalizeScoreSource(entry.scoreSource) === normalizeScoreSource(scoreSource)).length,
    };
  }

  function formatNumber(value, digits = 1) {
    return Number.isFinite(value) ? value.toFixed(digits) : "-";
  }

  function formatScore(value) {
    return Number.isFinite(value) ? String(value) : "";
  }

  function formatScoreRecord(record) {
    if (isScoreCrossed(record)) {
      return "Gạch chéo";
    }

    return Number.isFinite(record?.score) ? String(record.score) : "";
  }

  function normalizeEmailList(value) {
    const values = Array.isArray(value) ? value : String(value || "").split(/[,\n;]/);
    return [...new Set(values.map((email) => String(email).trim()).filter(Boolean))];
  }

  function mergeEmailLists(...values) {
    return normalizeEmailList(values.flatMap((value) => normalizeEmailList(value)));
  }

  function areEmailListsEqual(a, b) {
    const left = normalizeEmailList(a).map((email) => email.toLocaleLowerCase()).sort();
    const right = normalizeEmailList(b).map((email) => email.toLocaleLowerCase()).sort();
    return left.length === right.length && left.every((email, index) => email === right[index]);
  }

  function formatEmailList(emails) {
    return normalizeEmailList(emails).join(", ");
  }

  function normalizeIssueCount(value) {
    if (value === "" || value === null || value === undefined) {
      return "";
    }

    const number = Number(value);
    return Number.isInteger(number) && number >= 1 ? number : "";
  }

  function formatDateParts(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
      return { day: "", month: "", display: "" };
    }

    return {
      day: date.getDate(),
      month: date.getMonth() + 1,
      display: date.toLocaleDateString("vi-VN"),
    };
  }

  function todayIsoDate() {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function toIsoDate(value) {
    if (!value) {
      return "";
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      return String(value);
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function isValidIsoDate(value) {
    const isoDate = String(value || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return false;
    }
    const date = new Date(isoDate + "T00:00:00");
    return !Number.isNaN(date.getTime()) && toIsoDate(date) === isoDate;
  }

  function parseDisplayDateToIso(value) {
    const match = String(value || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) {
      return "";
    }
    const isoDate = `${match[3]}-${match[2]}-${match[1]}`;
    return isValidIsoDate(isoDate) ? isoDate : "";
  }

  function formatDateDisplay(value) {
    const iso = toIsoDate(value);
    if (!iso) {
      return "";
    }

    const [year, month, day] = iso.split("-");
    return `${day}/${month}/${year}`;
  }

  function currentDateDisplay() {
    return formatDateDisplay(todayIsoDate());
  }

  function formatDateTimeDisplay(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString("vi-VN", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function getReportDateValue(report, period, fieldName) {
    return toIsoDate(report?.[fieldName]) || toIsoDate(period?.createdAt) || todayIsoDate();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function optionHtml(options, selectedValue) {
    return options
      .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
      .join("");
  }

  function refreshSelectAllStates(root = document) {
    if (!root) return;
    root.querySelectorAll?.("input[data-select-all]").forEach((selectAll) => {
      const targetName = selectAll.getAttribute("data-select-all");
      const container = selectAll.closest(".zone-check-list, form, .modal-body, .form-field");
      if (container) {
        const checkboxes = [...container.querySelectorAll(`input[name="${targetName}"]`)];
        const allChecked = checkboxes.length > 0 && checkboxes.every((cb) => cb.checked);
        const someChecked = checkboxes.some((cb) => cb.checked);
        selectAll.checked = allChecked;
        selectAll.indeterminate = !allChecked && someChecked;
      }
    });
  }

  function areaCheckboxListHtml(selectedIds = [], type = activeAccountScope, periodId = getActivePeriodId(type)) {
    const catalogType = normalizeCatalogType(type);
    const selected = new Set((selectedIds || []).filter(Boolean));
    const areas = getAreasForPeriod(periodId).filter((area) => catalogType !== SAFETY_PERIOD_TYPE || isReportableSafetyArea(area));
    if (!areas.length) {
      return '<p class="field-hint" style="padding: 10px 12px; margin: 0;">Chưa có zone. Hãy thêm zone ở Danh mục trước.</p>';
    }

    const allChecked = areas.length > 0 && areas.every((area) => selected.has(area.id));
    const headerHtml = `
      <div class="zone-check-header">
        <label class="check-line zone-select-all-label">
          <input type="checkbox" data-select-all="areaIds" ${allChecked ? "checked" : ""}>
          <span>Chọn tất cả</span>
        </label>
      </div>
    `;

    const itemsHtml = areas
      .map((area) => `<label class="check-line zone-check-item">
        <input name="areaIds" type="checkbox" value="${escapeHtml(area.id)}" ${selected.has(area.id) ? "checked" : ""}>
        <span>Zone ${escapeHtml(area.code)} · ${escapeHtml(catalogType === SAFETY_PERIOD_TYPE ? getSafetyDepartmentForArea(area, periodId) : getAreaResponsibleNameForPeriod(periodId, area))}</span>
      </label>`)
      .join("");

    return headerHtml + `<div class="zone-check-items">${itemsHtml}</div>`;
  }

  function getCheckedAreaIds(container) {
    return [...container.querySelectorAll('input[name="areaIds"]:checked')].map((input) => input.value);
  }

  function assessorCheckboxListHtml(selectedIds = [], type = activeCatalogScope, periodId = getActivePeriodId(type)) {
    const catalogType = normalizeCatalogType(type);
    const selected = new Set((selectedIds || []).filter(Boolean));
    const assessors = getPeriodCatalogAssessors(catalogType, periodId);
    if (!assessors.length) {
      return '<p class="field-hint" style="padding: 10px 12px; margin: 0;">Chưa có assessor. Hãy thêm assessor ở Bước 3 trước.</p>';
    }

    const allChecked = assessors.length > 0 && assessors.every((a) => selected.has(a.id));
    const headerHtml = `
      <div class="zone-check-header">
        <label class="check-line zone-select-all-label">
          <input type="checkbox" data-select-all="assessorIds" ${allChecked ? "checked" : ""}>
          <span>Chọn tất cả</span>
        </label>
      </div>
    `;

    const itemsHtml = assessors
      .map((assessor) => `<label class="check-line zone-check-item">
        <input name="assessorIds" type="checkbox" value="${escapeHtml(assessor.id)}" ${selected.has(assessor.id) ? "checked" : ""}>
        <span>${escapeHtml(assessor.name)}</span>
      </label>`)
      .join("");

    return headerHtml + `<div class="zone-check-items">${itemsHtml}</div>`;
  }

  function getCheckedAssessorIds(container) {
    return [...container.querySelectorAll('input[name="assessorIds"]:checked')].map((input) => input.value);
  }

  function getAssessorAreaIds(assessorId, type = activeCatalogScope, periodId = getActivePeriodId(type)) {
    if (!assessorId) {
      return [];
    }
    const catalogType = normalizeCatalogType(type);
    const areas = getAreasForPeriod(periodId);
    const areaIdsFromAreas = areas
      .filter((area) => area.assessorId === assessorId || (Array.isArray(area.assessorIds) && area.assessorIds.includes(assessorId)))
      .map((area) => area.id);

    const linkedAccounts = (state.accounts || [])
      .filter((account) => hasAccountAccessType(account, catalogType) && getAccountPersonId(account, catalogType) === assessorId);
    const areaIdsFromAccounts = linkedAccounts.flatMap((acc) => getAccountAreaIds(acc, catalogType));

    return [...new Set([...areaIdsFromAreas, ...areaIdsFromAccounts])];
  }

  async function setAssessorAreaIds(assessorId, targetAreaIds, type = activeCatalogScope, periodId = getActivePeriodId(type)) {
    if (!assessorId) {
      return;
    }
    const catalogType = normalizeCatalogType(type);
    const targetSet = new Set((targetAreaIds || []).filter(Boolean));
    const assessor = getPeriodCatalogAssessor(periodId, assessorId) || getAssessor(assessorId, catalogType);
    const assessorName = assessor?.name || "";

    const applyToArea = (area, pId) => {
      const currentAssessorIds = new Set(Array.isArray(area.assessorIds) ? area.assessorIds : (area.assessorId ? [area.assessorId] : []));
      if (targetSet.has(area.id)) {
        currentAssessorIds.add(assessorId);
        if (!area.assessorId) {
          area.assessorId = assessorId;
          area.assessorName = assessorName;
        }
      } else {
        currentAssessorIds.delete(assessorId);
        if (area.assessorId === assessorId) {
          const remaining = [...currentAssessorIds];
          area.assessorId = remaining[0] || "";
          area.assessorName = remaining[0] ? (getPeriodCatalogAssessor(pId || periodId, remaining[0])?.name || "") : "";
        }
      }
      area.assessorIds = [...currentAssessorIds];
    };

    // 1. Update active period snapshot areas
    const mutableAreas = getMutablePeriodAreas(catalogType, periodId);
    mutableAreas.forEach((area) => applyToArea(area, periodId));

    // 2. Update root catalog areas
    const rootAreas = getMutableAreas(catalogType);
    if (Array.isArray(rootAreas)) {
      rootAreas.forEach((area) => applyToArea(area, ""));
    }

    // 3. Update all other period snapshots of the same catalog type
    const periodsToSave = [];
    (state.periods || []).forEach((period) => {
      if (normalizeCatalogType(period.type) === catalogType && period.settingsSnapshot?.areas) {
        period.settingsSnapshot.areas.forEach((area) => applyToArea(area, period.id));
        periodsToSave.push(period);
      }
    });

    // 4. Update affected accounts
    const affectedAccounts = (state.accounts || []).filter((acc) => (
      hasAccountAccessType(acc, catalogType) && getAccountPersonId(acc, catalogType) === assessorId
    ));
    const normalizedTargetAreaIds = [...targetSet];
    affectedAccounts.forEach((account) => {
      setAccountAreaIds(account, catalogType, normalizedTargetAreaIds);
      if (catalogType === SAFETY_PERIOD_TYPE) {
        account.safetyAreaIds = normalizedTargetAreaIds;
        if (Array.isArray(account.areaIds)) {
          account.areaIds = account.areaIds.filter((aid) => targetSet.has(aid) || (account.fiveSAreaIds || []).includes(aid));
        }
      } else {
        account.fiveSAreaIds = normalizedTargetAreaIds;
        account.areaIds = normalizedTargetAreaIds;
      }
    });

    // 5. Persist everything to database
    const dbWrites = [
      saveCatalogPeriodSnapshot(catalogType, periodId),
      ...periodsToSave.map((p) => savePeriodSnapshot(p)),
      ...affectedAccounts.map((account) => dbRef(`accounts/${account.id}`).set(account)),
    ];
    if (Array.isArray(rootAreas)) {
      rootAreas.forEach((a) => {
        dbWrites.push(dbRef(`${catalogDbPath(catalogType, "areas")}/${a.id}`).set(a));
      });
    }

    await Promise.all(dbWrites);
  }

  function scoreGuideHtml(item, criterion) {
    const levels = SCORE_GUIDE[item.id]?.[criterion.id] || [];
    if (!levels.length) {
      return "";
    }

    return `<div class="score-guide">
      ${levels
        .map((text, index) => `<article class="score-guide-level">
          <strong>${index + 1}. ${escapeHtml(SCORE_LEVEL_LABELS[index] || `Cấp ${index + 1}`)}</strong>
          <span>${escapeHtml(text)}</span>
        </article>`)
        .join("")}
    </div>`;
  }

  function getIssueRecords(periodId, options = {}) {
    const areaId = options.areaId || "";
    return (state.safetyRecords || [])
      .filter((record) => record.periodId === periodId)
      .map((record) => ({
        score: record,
        area: getAreaForPeriod(record.periodId, record.areaId),
        item: getItem(record.itemId),
      }))
      .filter((row) => row.area && isReportableSafetyArea(row.area) && (!areaId || row.area.id === areaId))
      .sort((a, b) => String(b.score.updatedAt || b.score.createdAt || "").localeCompare(String(a.score.updatedAt || a.score.createdAt || "")));
  }

  function getSafetyRowsForYear(year, options = {}) {
    return getPeriodsByType(SAFETY_PERIOD_TYPE)
      .filter((period) => Number(period.year) === Number(year))
      .flatMap((period) => getIssueRecords(period.id, options));
  }

  function getSafetyFilterYears(options = {}) {
    const years = getPeriodsByType(SAFETY_PERIOD_TYPE)
      .filter((period) => getIssueRecords(period.id, { areaId: options.areaId || "" }).length)
      .map((period) => Number(period.year))
      .filter((year) => Number.isInteger(year));
    return [...new Set(years)].sort((a, b) => b - a);
  }

  function getSafetyFilterMonths(year, options = {}) {
    const months = getSafetyRowsForYear(year, { areaId: options.areaId || "" })
      .map((row) => getSafetyIssueMonth(row))
      .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12);
    return [...new Set(months)].sort((a, b) => a - b);
  }

  function getSafetyReportForPeriod(periodId) {
    const snapshot = shouldUsePeriodSnapshot(periodId) ? getPeriodSnapshot(periodId) : null;
    return { ...DEFAULT_SAFETY_REPORT, ...((snapshot?.safetyReport || state.safetyReport) || {}) };
  }

  function isIssueOpen(score) {
    return normalizeIssueStatus(score.issueStatus) !== "closed";
  }

  function getIssueLocation(row) {
    return row.score.issueLocation || `Zone ${row.area.code}`;
  }

  function getIssueDescription(row) {
    const criterion = getCriterion(row.item, row.score.criterionId);
    const prefix = row.item
      ? [row.item.code, row.item.name, criterion?.label].filter(Boolean).join(" ")
      : row.score.issueItemLabel || "Mối nguy an toàn";
    return row.score.note ? (prefix ? prefix + ": " + row.score.note : row.score.note) : prefix;
  }
  function getIssueDay(row) {
    return row.score.issueDay || formatDateParts(row.score.updatedAt).day || "";
  }

  function getIssueMonth(row, periodId) {
    if (row.score.issueMonth) {
      return row.score.issueMonth;
    }

    const parts = formatDateParts(row.score.updatedAt);
    const period = getPeriod(periodId);
    return parts.month || period?.month || "";
  }

  function getIssueCount(row) {
    return normalizeIssueCount(row.score.issueCount) || 1;
  }

  function getIssueLevelLabel(score) {
    return score.issueLevel ? `Cấp độ ${score.issueLevel}` : "";
  }

  function getSafetyStop6Confirm(score) {
    const value = String(score?.issueType || "").trim();
    if (!value) {
      return "";
    }
    const leadingNumber = value.match(/^\s*([1-7])\b|^\s*([1-7])\s*[-.]/);
    if (leadingNumber) {
      return leadingNumber[1] || leadingNumber[2] || "";
    }
    const normalized = value.toLowerCase();
    if (normalized.includes("kẹp") || normalized.includes("kẹt")) return "1";
    if (normalized.includes("vật nặng")) return "2";
    if (normalized.includes("xe cộ")) return "3";
    if (normalized.includes("rơi") || normalized.includes("ngã")) return "4";
    if (normalized.includes("điện giật")) return "5";
    if (normalized.includes("cháy") || normalized.includes("nổ")) return "6";
    if (normalized.includes("khác")) return "7";
    return "";
  }

  function getSafetyLevelConfirm(score) {
    const value = String(score?.issueLevel || "").trim().toUpperCase();
    return ["A", "B", "C"].includes(value) ? value.toLowerCase() : "";
  }

  function getCompletionDateDisplay(score) {
    return formatDateDisplay(score.completionDate) || score.completionDate || "";
  }

  function getIssueFoundBy(row) {
    return row.score.issueFoundBy || row.score.scorerName || row.score.accountUsername || "";
  }

  function getIssueEmployeeCode(row) {
    return row.score.employeeCode || "";
  }

  function getIssueItemLabel(row) {
    const criterion = getCriterion(row.item, row.score.criterionId);
    if (row.score.issueItemLabel) {
      return row.score.issueItemLabel;
    }
    if (row.item) {
      return [row.item.code, row.item.name, criterion?.label].filter(Boolean).join(" · ");
    }
    return row.score.note || "Mối nguy an toàn";
  }
  function isSafetyStop6Selected(score, value) {
    return String(score.issueType || "") === value;
  }

  function isSafetyLevelSelected(score, value) {
    return String(score.issueLevel || "") === value;
  }

  function isSafetyFoundSelected(score, value) {
    const fallback = score.issueFoundBy || score.scorerName || score.accountUsername ? "worker" : "";
    return normalizeFoundChannel(score.foundChannel || fallback) === value;
  }

  function safetyMarkCell(selected, extraClass = "", value = "1") {
    return `<td class="safety-mark-cell ${selected ? `is-marked ${extraClass}` : ""}">${selected ? escapeHtml(value) : ""}</td>`;
  }

  function createCell(tagName, text, className = "") {
    const cell = document.createElement(tagName);
    if (className) {
      cell.className = className;
    }
    cell.textContent = text ?? "";
    return cell;
  }

  function setColSpan(cell, value) {
    cell.colSpan = value;
    return cell;
  }

  function setRowSpan(cell, value) {
    cell.rowSpan = value;
    return cell;
  }

  function excelColumnName(index) {
    let name = "";
    let n = index;
    while (n > 0) {
      const remainder = (n - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      n = Math.floor((n - 1) / 26);
    }
    return name;
  }

  function buildConsecutiveGroups(areas, propertyName, mergeBlankGroups = true) {
    const groups = [];

    areas.forEach((area) => {
      const label = area[propertyName] || "";
      const current = groups[groups.length - 1];
      if (current && current.label === label && (label || mergeBlankGroups)) {
        current.areas.push(area);
      } else {
        groups.push({ label, areas: [area] });
      }
    });

    return groups;
  }

  function getDepartmentHeadSummaryGroup(deptHead, areasList = []) {
    const cleanDeptHead = String(deptHead || "").trim();
    if (!cleanDeptHead) {
      return "";
    }
    const match = (areasList || []).find((a) => (
      a && a.departmentHead && a.departmentHead.trim() === cleanDeptHead && String(a.summaryGroup || "").trim()
    ));
    if (match && match.summaryGroup) {
      return match.summaryGroup.trim();
    }
    return cleanDeptHead;
  }

  function buildDepartmentSummaryGroups(areas) {
    const deptGroups = buildConsecutiveGroups(areas, "departmentHead", false);
    return deptGroups.map((group) => {
      const explicitSummary = group.areas.find((area) => String(area.summaryGroup || "").trim())?.summaryGroup?.trim();
      const label = explicitSummary || group.label || "";
      return {
        label,
        departmentHead: group.label,
        areas: group.areas,
      };
    });
  }

  function renderStandardReferenceTable(table) {
    table.className = "matrix-table standard-reference-table";
    table.innerHTML = "";
    table.removeAttribute("data-period-id");

    const colgroup = document.createElement("colgroup");
    ["150px", "330px", "88px", "70px", "220px", "220px", "245px", "220px", "220px"].forEach((width) => {
      const col = document.createElement("col");
      col.style.width = width;
      colgroup.appendChild(col);
    });
    table.appendChild(colgroup);

    const titleRow = document.createElement("tr");
    titleRow.appendChild(setColSpan(createCell("th", "BẢNG ĐÁNH GIÁ HOẠT ĐỘNG SHITSUKE + 4S NƠI LÀM VIỆC", "standard-reference-title"), 9));
    table.appendChild(titleRow);

    const metaRow = document.createElement("tr");
    metaRow.appendChild(setColSpan(createCell("td", "", "standard-reference-blank"), 4));
    metaRow.appendChild(createCell("td", "Đánh giá viên:", "standard-reference-meta-cell"));
    metaRow.appendChild(createCell("td", "", "standard-reference-blank"));
    metaRow.appendChild(createCell("td", "Người được đánh giá:", "standard-reference-meta-cell"));
    metaRow.appendChild(createCell("td", "Bộ phận:", "standard-reference-meta-cell"));
    metaRow.appendChild(createCell("td", "", "standard-reference-blank"));
    table.appendChild(metaRow);

    const scoreRow = document.createElement("tr");
    ["", "", "", "Điểm đánh giá", "", "", "Đồng", "Bạc", "Vàng"].forEach((label, index) => {
      scoreRow.appendChild(createCell("td", label, index >= 6 ? `standard-reference-medal standard-reference-medal-${index - 5}` : "standard-reference-score-head"));
    });
    table.appendChild(scoreRow);

    const headerRow = document.createElement("tr");
    ["Hạng mục", "Vị trí kiểm tra", "Khoản mục", "Ngày", ...SCORE_LEVEL_LABELS].forEach((label, index) => {
      headerRow.appendChild(createCell("th", label, `standard-reference-column-head standard-reference-head-${index + 1}`));
    });
    table.appendChild(headerRow);

    STANDARD_REFERENCE_SECTIONS.forEach((section) => {
      const sectionSpan = section.items.reduce((total, entry) => total + (getItem(entry.id)?.criteria.length || 0), 0);
      let isFirstSectionRow = true;

      section.items.forEach((entry) => {
        const item = getItem(entry.id);
        if (!item) {
          return;
        }

        item.criteria.forEach((criterion, criterionIndex) => {
          const row = document.createElement("tr");
          if (isFirstSectionRow) {
            row.appendChild(setRowSpan(createCell("td", section.label, "standard-reference-section-cell"), sectionSpan));
            isFirstSectionRow = false;
          }
          if (criterionIndex === 0) {
            row.appendChild(setRowSpan(createCell("td", entry.location || item.name, "standard-reference-location-cell"), item.criteria.length));
          }

          row.appendChild(createCell("td", entry.hideCriterion ? "" : criterion.label, "standard-reference-criterion-cell"));
          row.appendChild(createCell("td", "", "standard-reference-date-cell"));

          const levels = SCORE_GUIDE[item.id]?.[criterion.id] || [];
          for (let levelIndex = 0; levelIndex < 5; levelIndex += 1) {
            row.appendChild(createCell("td", levels[levelIndex] || "", `standard-reference-level-cell standard-reference-level-${levelIndex + 1}`));
          }
          table.appendChild(row);
        });
      });
    });

    const averageRow = document.createElement("tr");
    averageRow.appendChild(createCell("td", "", "standard-reference-blank"));
    averageRow.appendChild(setColSpan(createCell("td", "Điểm trung bình", "standard-reference-average-label"), 8));
    table.appendChild(averageRow);
  }

  function buildMatrixTable(table, options) {
    const period = getPeriod(options.periodId);
    const periodId = period?.id || "";
    const scoreSource = normalizeScoreSource(options.scoreSource);
    const areas = getAreasForPeriod(periodId);
    const editableAreaIds = options.editableAreaIds || new Set();
    const hasOpenPeriod = Boolean(periodId) && isPeriodOpen(periodId, FIVE_S_PERIOD_TYPE);
    const adminMode = Boolean(options.adminMode) && hasOpenPeriod && !isPeriodArchived(periodId);
    const canEdit = Boolean(options.editable) && hasOpenPeriod && !isPeriodArchived(periodId);
    const includeFormulas = Boolean(options.formulas);
    const firstScoreRow = 5;
    const lastAreaColumn = excelColumnName(3 + areas.length);

    table.className = "matrix-table";
    table.innerHTML = "";
    table.dataset.periodId = periodId;

    const colgroup = document.createElement("colgroup");
    [["46px"], ["112px"], ["88px"], ...areas.map(() => ["43px"]), ["66px"]].forEach(([width]) => {
      const col = document.createElement("col");
      col.style.width = width;
      colgroup.appendChild(col);
    });
    table.appendChild(colgroup);

    const titleRow = document.createElement("tr");
    const titleText = "Điểm Chi Tiết Theo Từng Hạng Mục - " + getScoreSourceLabel(scoreSource) + " (" + periodLabel(period) + ")";
    titleRow.appendChild(setColSpan(createCell("th", titleText, "matrix-title"), areas.length + 4));
    table.appendChild(titleRow);

    const zoneRow = document.createElement("tr");
    zoneRow.appendChild(setRowSpan(setColSpan(createCell("th", "Tiêu Chuẩn\nĐánh Giá", "standard-head"), 2), 2));
    zoneRow.appendChild(createCell("th", "Zone", "zone-title"));
    areas.forEach((area) => {
      const cell = createCell("th", "", `${area.highlight ? "zone-code is-highlight" : "zone-code"}${adminMode ? " editable-header" : ""}`);
      if (adminMode) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = area.code;
        button.dataset.action = "edit-area";
        button.dataset.id = area.id;
        button.dataset.periodId = periodId;
        button.title = "Sửa thông tin zone";
        cell.appendChild(button);
      } else {
        cell.textContent = area.code;
      }
      zoneRow.appendChild(cell);
    });
    zoneRow.appendChild(setRowSpan(createCell("th", "AVER", "aver-head"), 3));
    table.appendChild(zoneRow);

    const departmentRow = document.createElement("tr");
    departmentRow.appendChild(createCell("th", "T.Phòng", "zone-title"));
    buildConsecutiveGroups(areas, "departmentHead", false).forEach((group) => {
      const cell = createCell("th", "", `department-head${adminMode ? " editable-header" : ""}`);
      if (adminMode) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = group.label || "Chưa có";
        button.dataset.action = "edit-department-head";
        button.dataset.id = group.label || "";
        button.dataset.periodId = periodId;
        button.dataset.areaIds = group.areas.map((area) => area.id).join(",");
        button.title = "Sửa trưởng phòng cho nhóm zone này";
        cell.appendChild(button);
      } else {
        cell.textContent = group.label;
      }
      departmentRow.appendChild(setColSpan(cell, group.areas.length));
    });
    table.appendChild(departmentRow);

    const picRow = document.createElement("tr");
    picRow.appendChild(setColSpan(createCell("th", "ITEMS", "items-head"), 2));
    picRow.appendChild(createCell("th", "Point", "point-head"));
    areas.forEach((area) => {
      const cell = createCell("th", "", `pic-name${adminMode ? " editable-header" : ""}`);
      if (adminMode) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = getAreaResponsibleNameForPeriod(periodId, area);
        button.dataset.action = "edit-area-responsible";
        button.dataset.id = area.id;
        button.dataset.periodId = periodId;
        button.title = "Sửa người phụ trách zone / người được đánh giá";
        cell.appendChild(button);
      } else {
        cell.textContent = getAreaResponsibleNameForPeriod(periodId, area);
      }
      picRow.appendChild(cell);
    });
    table.appendChild(picRow);

    let rowNumber = firstScoreRow;
    let scoreGridRowIndex = 0;
    DEFAULT_ITEMS.forEach((item) => {
      const itemStartRow = rowNumber;
      const itemEndRow = itemStartRow + item.criteria.length - 1;
      item.criteria.forEach((criterion, criterionIndex) => {
        const row = document.createElement("tr");

        if (criterionIndex === 0) {
          row.appendChild(setRowSpan(createCell("td", item.code, "item-code"), item.criteria.length));
          row.appendChild(setRowSpan(createCell("td", item.name, "item-name"), item.criteria.length));
        }

        row.appendChild(createCell("td", criterion.label, "criteria-cell"));

        areas.forEach((area, areaIndex) => {
          const isNa = isNotApplicable(item.id, criterion.id, area);
          const record = getScoreRecord(periodId, area.id, item.id, criterion.id, scoreSource);
          const value = Number.isFinite(record?.score) ? record.score : null;
          const isCrossed = isScoreCrossed(record);
          const isEditable = canEdit && editableAreaIds.has(area.id) && !isNa;
          const classNames = ["score-cell"];

          if (isNa || isCrossed) {
            classNames.push("score-na");
          } else if (!Number.isFinite(value)) {
            classNames.push("score-empty");
          } else if (value <= 2) {
            classNames.push("score-low");
          }

          if (isEditable) {
            classNames.push("editable");
          }

          const cell = createCell("td", "", classNames.join(" "));
          if (isNa) {
            cell.setAttribute("aria-label", "Không áp dụng");
          } else if (isEditable) {
            const input = document.createElement("input");
            input.className = "inline-score-input";
            input.type = "text";
            input.inputMode = "numeric";
            input.maxLength = 1;
            input.autocomplete = "off";
            input.draggable = false;
            input.spellcheck = false;
            input.value = isCrossed ? "" : formatScore(value);
            input.dataset.inlineScoreInput = "true";
            input.dataset.periodId = periodId;
            input.dataset.areaId = area.id;
            input.dataset.itemId = item.id;
            input.dataset.criterionId = criterion.id;
            input.dataset.scoreSource = scoreSource;
            input.dataset.scoreRowIndex = String(scoreGridRowIndex);
            input.dataset.scoreColIndex = String(areaIndex);
            input.title = formatScoreRecord(record) || "Nhập điểm";
            input.setAttribute("aria-label", `Điểm Zone ${area.code} ${item.code} ${criterion.label}`);
            cell.appendChild(input);
          } else {
            cell.textContent = isCrossed ? "" : formatScore(value);
          }
          row.appendChild(cell);
        });

        if (criterionIndex === 0) {
          const averageCell = setRowSpan(createCell("td", formatNumber(itemAverage(periodId, item, areas, scoreSource), 2), "item-average"), item.criteria.length);
          averageCell.dataset.averageKind = "item";
          averageCell.dataset.periodId = periodId;
          averageCell.dataset.itemId = item.id;
          averageCell.dataset.scoreSource = normalizeScoreSource(scoreSource);
          averageCell.dataset.decimals = "2";
          if (includeFormulas) {
            averageCell.setAttribute("x:fmla", `=IFERROR(AVERAGE(D${itemStartRow}:${lastAreaColumn}${itemEndRow}),"")`);
          }
          row.appendChild(averageCell);
        }

        table.appendChild(row);
        rowNumber += 1;
        scoreGridRowIndex += 1;
      });
    });

    appendTotalRows(table, periodId, areas, {
      includeFormulas,
      firstScoreRow,
      lastScoreRow: rowNumber - 1,
      totalRowNumber: rowNumber,
      lastAreaColumn,
      adminMode,
      scoreSource,
    });
  }

  function appendTotalRows(table, periodId, areas, options = {}) {
    const scoreSource = normalizeScoreSource(options.scoreSource);
    const areaTotalRow = document.createElement("tr");
    areaTotalRow.appendChild(setRowSpan(setColSpan(createCell("td", "TOTAL SCORE:", "total-left"), 3), 3));

    areas.forEach((area, index) => {
      const totalCell = createCell("td", formatNumber(areaAverage(periodId, area, scoreSource), 2), "area-total");
      totalCell.dataset.averageKind = "area";
      totalCell.dataset.periodId = periodId;
      totalCell.dataset.areaId = area.id;
      totalCell.dataset.scoreSource = scoreSource;
      totalCell.dataset.decimals = "2";
      if (options.includeFormulas) {
        const column = excelColumnName(4 + index);
        totalCell.setAttribute("x:fmla", `=IFERROR(AVERAGE(${column}${options.firstScoreRow}:${column}${options.lastScoreRow}),"")`);
      }
      areaTotalRow.appendChild(totalCell);
    });

    const overallCell = setRowSpan(createCell("td", formatNumber(overallAverage(periodId, areas, scoreSource), 1), "overall-total"), 3);
    overallCell.dataset.averageKind = "overall";
    overallCell.dataset.periodId = periodId;
    overallCell.dataset.scoreSource = scoreSource;
    overallCell.dataset.decimals = "1";
    if (options.includeFormulas) {
      overallCell.setAttribute("x:fmla", `=IFERROR(AVERAGE(D${options.totalRowNumber}:${options.lastAreaColumn}${options.totalRowNumber}),"")`);
    }
    areaTotalRow.appendChild(overallCell);
    table.appendChild(areaTotalRow);

    const summaryGroups = buildDepartmentSummaryGroups(areas);
    const groupAverageRow = document.createElement("tr");
    const groupLabelRow = document.createElement("tr");

    function createSummaryGroupCell(group) {
      const cell = createCell("td", "", `group-label${options.adminMode ? " editable-header" : ""}`);
      if (options.adminMode) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = group.label || "Chưa có";
        button.dataset.action = "edit-summary-group";
        button.dataset.id = group.label || "";
        button.dataset.periodId = periodId;
        button.dataset.areaIds = group.areas.map((area) => area.id).join(",");
        button.dataset.deptHead = group.departmentHead || "";
        button.title = "Sửa nhóm tổng điểm cho các zone này";
        cell.appendChild(button);
      } else {
        cell.textContent = group.label;
      }
      return cell;
    }

    summaryGroups.forEach((group) => {
      const span = group.areas.length;
      if (span > 1) {
        const averageCell = setColSpan(createCell("td", (group.label || group.departmentHead) ? formatNumber(groupAverage(periodId, group.areas, scoreSource), 2) : "", "group-average"), span);
        averageCell.dataset.averageKind = "group";
        averageCell.dataset.periodId = periodId;
        averageCell.dataset.areaIds = group.areas.map((area) => area.id).join(",");
        averageCell.dataset.scoreSource = scoreSource;
        averageCell.dataset.decimals = "2";
        if (options.includeFormulas && (group.label || group.departmentHead)) {
          const startColumn = excelColumnName(4 + areas.indexOf(group.areas[0]));
          const endColumn = excelColumnName(4 + areas.indexOf(group.areas[group.areas.length - 1]));
          averageCell.setAttribute("x:fmla", `=IFERROR(AVERAGE(${startColumn}${options.totalRowNumber}:${endColumn}${options.totalRowNumber}),"")`);
        }
        groupAverageRow.appendChild(averageCell);
        groupLabelRow.appendChild(setColSpan(createSummaryGroupCell(group), span));
      } else {
        groupAverageRow.appendChild(setRowSpan(createSummaryGroupCell(group), 2));
      }
    });

    table.appendChild(groupAverageRow);
    table.appendChild(groupLabelRow);

    const signatureRow = document.createElement("tr");
    signatureRow.appendChild(setColSpan(createCell("td", "Người đánh giá", "signature-label"), 3));
    areas.forEach((area) => {
      const cell = createCell("td", "", `signature-cell${options.adminMode ? " editable-header" : ""}`);
      if (options.adminMode) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = getSignatureName(periodId, area, scoreSource) || "Chưa có";
        button.dataset.action = "edit-area-assessor";
        button.dataset.id = area.id;
        button.dataset.periodId = periodId;
        button.title = "Sửa assessor hiển thị ở dòng cuối";
        cell.appendChild(button);
      } else {
        cell.textContent = getSignatureName(periodId, area, scoreSource);
      }
      signatureRow.appendChild(cell);
    });
    signatureRow.appendChild(createCell("td", "", "signature-cell"));
    table.appendChild(signatureRow);
  }

  function getSignatureName(periodId, area, scoreSource = SCORE_SOURCE_ASSESSOR) {
    const configuredAssessor = getAreaConfiguredAssessorNameForPeriod(periodId, area);
    if (configuredAssessor) {
      return configuredAssessor;
    }

    const normalizedSource = normalizeScoreSource(scoreSource);
    const latest = state.scores
      .filter((score) => score.periodId === periodId && score.areaId === area.id && Number.isFinite(score.score) && normalizeScoreSource(score.scoreSource) === normalizedSource)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];

    if (latest?.scorerName) {
      return latest.scorerName;
    }

    return "";
  }
  function getUserInitials(account = currentUser) {
    const displayName = getAccountProfileName(account) || account?.username || "A";
    return displayName.trim().slice(0, 1).toLocaleUpperCase("vi");
  }

  function normalizeRoutePath(pathname = window.location.pathname) {
    const cleanPath = String(pathname || "/").replace(/\/+$/, "") || "/";
    return cleanPath === "/" ? LOGIN_ROUTE : cleanPath;
  }

  function getRoutePathFromLocation() {
    const hash = String(window.location.hash || "");
    if (hash.startsWith("#/")) {
      return normalizeRoutePath(hash.slice(1));
    }
    return normalizeRoutePath(window.location.pathname);
  }

  function routeUrlForPath(routePath) {
    return "/#" + normalizeRoutePath(routePath);
  }

  function normalizeSafetyReportId(reportId) {
    const normalized = String(reportId || "").trim();
    return SAFETY_REPORT_BY_ID[normalized] ? normalized : "";
  }

  function getSafetyReportRoute(reportId = "") {
    const report = SAFETY_REPORT_BY_ID[normalizeSafetyReportId(reportId)];
    return report?.route || TAB_ROUTES.safety;
  }

  function getRouteTarget(pathname = "") {
    const routePath = pathname ? normalizeRoutePath(pathname) : getRoutePathFromLocation();
    if (routePath === LOGIN_ROUTE) {
      return { type: "login" };
    }

    const tab = ROUTE_TABS[routePath];
    if (tab) {
      return { type: "tab", tab, safetyReport: tab === "safety" ? "assessment" : "" };
    }

    const safetyReport = SAFETY_REPORT_BY_ROUTE[routePath];
    return safetyReport ? { type: "tab", tab: "safety", safetyReport: safetyReport.id } : { type: "unknown" };
  }

  function replaceRoute(routePath) {
    const targetRoute = routeUrlForPath(routePath);
    if (window.location.pathname + window.location.hash !== targetRoute) {
      window.history.replaceState(null, "", targetRoute);
    }
  }

  function pushRoute(routePath) {
    const targetRoute = routeUrlForPath(routePath);
    if (window.location.pathname + window.location.hash !== targetRoute) {
      window.history.pushState(null, "", targetRoute);
    }
  }

  function isSessionFresh(account) {
    const expiresAt = Date.parse(account?.activeSessionExpiresAt || "");
    return Number.isFinite(expiresAt) && expiresAt > Date.now();
  }

  function hasOtherActiveSession(account, sessionId = currentSessionId) {
    const activeSessionId = String(account?.activeSessionId || "");
    if (!activeSessionId || activeSessionId === String(sessionId || "")) {
      return false;
    }
    return isSessionFresh(account);
  }

  function saveSession(account) {
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        accountId: account.id || "",
        username: account.username || "",
        sessionId: currentSessionId,
        sessionStartedAt: currentSessionStartedAt,
        sessionHistoryId: currentSessionHistoryId,
        authToken: currentAuthToken,
        savedAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.warn("Không lưu được phiên đăng nhập.", error);
    }
  }

  function isAuthRequestError(error) {
    return error?.status === 401 || error?.status === 403;
  }

  function applyAuthenticatedPayload(payload = {}, options = {}) {
    if (payload.root) {
      state = normalizeState(payload.root);
      invalidateScoreRecordIndex();
    }

    currentAuthToken = payload.token || currentAuthToken || "";
    dataStore?.setAuthToken?.(currentAuthToken);

    const accountId = payload.account?.id || payload.accountId || "";
    const username = payload.account?.username || payload.username || "";
    const account = state?.accounts?.find((item) => accountId && item.id === accountId)
      || state?.accounts?.find((item) => username && item.username === username)
      || payload.account
      || null;

    if (!account) {
      throw new Error("Không tìm thấy tài khoản trong dữ liệu trả về.");
    }

    if (isAdminAccount(account) && (account.name === "Dương Bích Ngọc" || !account.name)) {
      account.name = "Đường Bích Ngọc";
    }

    currentUser = account;
    currentSessionId = payload.sessionId || account.activeSessionId || currentSessionId || "";
    currentSessionStartedAt = payload.sessionStartedAt
      || account.activeSessionStartedAt
      || currentSessionStartedAt
      || new Date().toISOString();
    currentSessionHistoryId = options.keepHistory
      ? currentSessionHistoryId || payload.sessionHistoryId || makeId("history")
      : payload.sessionHistoryId || currentSessionHistoryId || makeId("history");
    saveSession(currentUser);
    restorePersistedImportUndoAction();
    return currentUser;
  }

  function stopSessionHeartbeat() {
    if (sessionHeartbeatTimer) {
      window.clearInterval(sessionHeartbeatTimer);
      sessionHeartbeatTimer = 0;
    }
  }

  async function touchAccountSession(account = currentUser) {
    if (!account?.id || !currentSessionId || !currentAuthToken) {
      return;
    }

    const payload = await dataStore.touchSession();
    applyAuthenticatedPayload(payload, { keepHistory: true });
  }

  function handleSessionRevoked(message = "") {
    if (!currentUser && !currentSessionId && !currentAuthToken) {
      return;
    }
    showToast(message || "Phiên đăng nhập đã được đăng nhập ở nơi khác. Vui lòng đăng nhập lại nếu cần.", true);
    clearSession();
    showLoginScreen();
  }

  function startSessionHeartbeat() {
    stopSessionHeartbeat();
    sessionHeartbeatTimer = window.setInterval(() => {
      touchAccountSession().catch((error) => {
        console.warn("Không cập nhật được phiên đăng nhập.", error);
        if (isAuthRequestError(error)) {
          handleSessionRevoked(error.message);
        }
      });
    }, SESSION_HEARTBEAT_MS);
  }

  async function releaseCurrentSession() {
    if (!currentSessionId && !currentAuthToken) {
      stopSessionHeartbeat();
      return;
    }

    await dataStore.logout();
    stopSessionHeartbeat();
  }

  function clearSession() {
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.warn("Không xóa được phiên đăng nhập.", error);
    }
    if (typeof window.closeMobilePrototype === "function") {
      window.closeMobilePrototype();
    }
    stopSessionHeartbeat();
    stopDataWatch();
    dataStore?.clearAuthToken?.();
    clearAuthenticatedPhotoUrlCache();
    currentSessionId = "";
    currentSessionStartedAt = "";
    currentSessionHistoryId = "";
    currentAuthToken = "";
  }

  async function restoreSessionUser() {
    try {
      const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (!rawSession) {
        return false;
      }

      const session = JSON.parse(rawSession);
      if (!session.authToken) {
        clearSession();
        return false;
      }

      currentSessionId = session.sessionId || "";
      currentSessionStartedAt = session.sessionStartedAt || "";
      currentSessionHistoryId = session.sessionHistoryId || makeId("history");
      currentAuthToken = session.authToken || "";
      const payload = await dataStore.restoreSession(currentAuthToken);
      applyAuthenticatedPayload(payload, { keepHistory: true });
      activeTab = getFallbackTab();
      startSessionHeartbeat();
      return true;
    } catch (error) {
      console.warn("Không khôi phục được phiên đăng nhập.", error);
      clearSession();
      return false;
    }
  }

  function showLoginScreen({ updateRoute = true } = {}) {
    currentUser = null;
    activeTab = "home";
    activeSafetyReport = "";
    closeModal();
    closeAccountMenu();
    if (typeof window.closeMobilePrototype === "function") {
      window.closeMobilePrototype();
    }
    document.body.classList.add("login-mode");
    document.body.classList.remove("app-mode");
    elements.appShell.hidden = true;
    elements.loginScreen.hidden = false;
    if (updateRoute) {
      replaceRoute(LOGIN_ROUTE);
    }
    window.setTimeout(() => elements.loginUsername?.focus(), 0);
  }

  function showAppScreen() {
    document.body.classList.add("app-mode");
    document.body.classList.remove("login-mode");
    elements.loginScreen.hidden = true;
    elements.appShell.hidden = false;
  }

  function syncRouteFromLocation() {
    const routeTarget = getRouteTarget();
    if (!currentUser) {
      if (routeTarget.type === "tab") {
        pendingRouteTab = routeTarget.tab;
        pendingSafetyReport = routeTarget.safetyReport || "";
      }
      showLoginScreen();
      return;
    }

    if (routeTarget.type === "tab") {
      if (routeTarget.tab === "mobile-5s" || routeTarget.tab === "mobile-safety") {
        if (!isTabAllowed(routeTarget.tab)) {
          const deniedMsg = routeTarget.tab === "mobile-5s" ? "Tài khoản của bạn không có quyền chấm 5S Mobile." : "Tài khoản của bạn không có quyền đánh giá An toàn Mobile.";
          showToast(deniedMsg, true);
          const fallbackTab = isFiveSAssessor(currentUser) ? "mobile-5s" : canUseSafety(currentUser) ? "mobile-safety" : getFallbackTab();
          activeTab = fallbackTab;
        } else {
          activeTab = routeTarget.tab;
        }
      } else {
        activeTab = isTabAllowed(routeTarget.tab) ? routeTarget.tab : getFallbackTab();
      }
      activeSafetyReport = activeTab === "safety" ? (normalizeSafetyReportId(routeTarget.safetyReport) || "assessment") : "";
    } else {
      activeTab = getFallbackTab();
      activeSafetyReport = "";
    }

    showAppScreen();
    if (activeTab === "mobile-5s" || activeTab === "mobile-safety") {
      const initialTab = activeTab === "mobile-5s" ? "5s" : "safety";
      if (typeof window.openMobilePrototype === "function") {
        window.openMobilePrototype(initialTab, createPageContext());
      }
    } else {
      if (typeof window.closeMobilePrototype === "function") {
        window.closeMobilePrototype();
      }
    }
    renderAll({ replaceRoute: true });
  }

  function getAppTitle() {
    if (activeTab === "safety" || activeTab === "mobile-safety") {
      const report = SAFETY_REPORT_BY_ID[activeSafetyReport];
      if (report?.id === "identification") {
        return "Tổng hợp nhận diện nguy cơ";
      }
      if (report?.id === "factory") {
        return "Tổng hợp nguy cơ nhà máy";
      }
      return "Đánh giá An toàn";
    }
    if (activeTab === "issue-stats") {
      return "Thống kê AT";
    }
    if (activeTab === "catalog") {
      return normalizeCatalogType(activeCatalogScope) === SAFETY_PERIOD_TYPE ? "Thiết lập An toàn" : "Thiết lập 5S";
    }
    if (activeTab === "accounts") {
      return normalizeCatalogType(activeAccountScope) === SAFETY_PERIOD_TYPE ? "Cấp tài khoản An toàn" : "Cấp tài khoản 5S";
    }
    if (["assessor", "summary", "mobile-5s"].includes(activeTab)) {
      return "Chấm điểm 5S";
    }
    return "Đánh giá 5S/An toàn";
  }

  function renderAppTitle() {
    const title = getAppTitle();
    if (elements.appTitle) {
      elements.appTitle.textContent = title;
    }
    document.title = title + " - LeGroup";
  }

  function renderCurrentUser() {
    const displayName = getAccountProfileName(currentUser);
    const roleText = getRoleLabel(currentUser?.role);
    const initials = getUserInitials(currentUser);
    elements.currentUserName.textContent = displayName;
    elements.currentUserRole.textContent = roleText;
    if (elements.accountAvatar) {
      elements.accountAvatar.textContent = initials;
    }
    if (elements.accountMenuAvatar) {
      elements.accountMenuAvatar.textContent = initials;
    }
    if (elements.accountMenuName) {
      elements.accountMenuName.textContent = displayName || "Người dùng";
    }
    if (elements.accountMenuUsername) {
      elements.accountMenuUsername.textContent = currentUser?.username || roleText;
    }
  }
  function closeAccountMenu() {
    if (elements.accountMenu) {
      elements.accountMenu.hidden = true;
      elements.accountMenuButton?.setAttribute("aria-expanded", "false");
    }
    document.querySelectorAll(".cyber-account-dropdown").forEach((el) => {
      el.hidden = true;
      const btn = el.parentElement?.querySelector("[aria-expanded]");
      btn?.setAttribute("aria-expanded", "false");
    });
  }

  function toggleAccountMenu() {
    if (!elements.accountMenu) {
      return;
    }

    const nextOpen = elements.accountMenu.hidden;
    elements.accountMenu.hidden = !nextOpen;
    elements.accountMenuButton?.setAttribute("aria-expanded", String(nextOpen));
  }

  function goToTab(tab) {
    if (!isTabAllowed(tab)) {
      showToast("Bạn không có quyền mở trang này.", true);
      return;
    }

    if (tab === "catalog") {
      expandedCatalogScope = "";
    } else if (tab === "accounts") {
      expandedAccountScope = "";
    }

    setActiveTab(tab, { safetyReport: tab === "safety" ? "assessment" : "" });
  }

  function goToSafetyReport(reportId) {
    if (!isTabAllowed("safety")) {
      showToast("Bạn không có quyền mở trang này.", true);
      return;
    }

    setActiveTab("safety", { safetyReport: reportId || "assessment" });
  }

  function goHome() {
    setActiveTab(getFallbackTab(), { safetyReport: "assessment" });
  }
  function renderRoleVisibility() {
    const isAdmin = isAdminAccount(currentUser);
    const isViewer = isViewerAccount(currentUser);
    const isDepartmentHead = isDepartmentHeadAccount(currentUser);
    const hasFiveSAccess = !isAdmin && Boolean(hasAccountAccessType(currentUser, FIVE_S_PERIOD_TYPE));
    const hasSafetyAccess = !isAdmin && Boolean(hasAccountAccessType(currentUser, SAFETY_PERIOD_TYPE));
    const isReadOnlyPageAccess = (element) => element.matches(".tab-button, .tab-panel, .nav-group, .account-menu-divider") ||
      Boolean(element.closest(".sidebar-nav, .header-quick-nav"));

    elements.appShell.classList.toggle("admin-mode", isAdmin);

    // 1. Admin-only: non-admin vẫn thấy điều hướng/trang, nhưng không thấy nút thao tác ghi.
    document.querySelectorAll(".admin-only").forEach((element) => {
      if (element.classList.contains("safety-report-hidden")) {
        element.hidden = true;
        return;
      }
      element.hidden = !isAdmin && !isReadOnlyPageAccess(element);
    });

    // 2. 5S: điều hướng được mở để xem, thao tác nghiệp vụ vẫn theo quyền.
    document.querySelectorAll(".five-s-access-only").forEach((element) => {
      element.hidden = !isAdmin && !isReadOnlyPageAccess(element);
    });

    // 3. Phiếu chấm 5S: mở điều hướng xem, giữ quyền chấm theo role.
    document.querySelectorAll(".assessor-only").forEach((element) => {
      element.hidden = isAdmin || isViewer || isDepartmentHead || (!isReadOnlyPageAccess(element) && !hasFiveSAccess);
    });

    // 4. An toàn lao động: mở điều hướng xem, giữ quyền đánh giá theo role.
    document.querySelectorAll(".safety-access-only").forEach((element) => {
      if (element.classList.contains("safety-report-hidden")) {
        element.hidden = true;
        return;
      }
      element.hidden = !isReadOnlyPageAccess(element) && !isAdmin && (isViewer || !hasSafetyAccess);
    });

    document.querySelectorAll(".mobile-launch-tab-btn, #mobileSwitchHeaderBtn").forEach((element) => {
      element.hidden = isViewer;
    });

    if (isViewer || isDepartmentHead) {
      document.querySelectorAll("[data-tab='catalog'], [data-tab='accounts'], [data-go-tab='catalog'], [data-go-tab='accounts'], #tab-catalog, #tab-accounts").forEach((element) => {
        element.hidden = true;
      });
    }

    // 5. Non-admin cũng được xem các nhóm trang.
    const navGroup5S = document.querySelector(".nav-group-5s");
    if (navGroup5S) {
      navGroup5S.hidden = false;
    }

    // 6. Nhóm an toàn luôn hiển thị; thao tác ghi được chặn riêng.
    const navGroupSafety = document.querySelector(".nav-group-safety");
    if (navGroupSafety) {
      navGroupSafety.hidden = false;
    }

    if (!isAdmin) {
      document.querySelectorAll("#tab-catalog [data-action]:not([data-action='set-catalog-scope']), #tab-accounts [data-action]:not([data-action='set-account-scope'])").forEach((element) => {
        element.hidden = true;
      });
      document.querySelectorAll("#tab-catalog input, #tab-catalog select, #tab-catalog textarea, #tab-accounts input, #tab-accounts select, #tab-accounts textarea").forEach((element) => {
        element.disabled = true;
      });
    }
  }

  function isTabAllowed(tab) {
    if (!currentUser) {
      return false;
    }

    if (isViewerAccount(currentUser)) {
      return ["home", "summary", "safety", "issue-stats"].includes(tab);
    }
    if (isDepartmentHeadAccount(currentUser)) {
      return ["home", "summary", "safety", "issue-stats", "mobile-safety"].includes(tab);
    }

    if (tab === "assessor" && isAdminAccount(currentUser)) {
      return false;
    }
    if (tab === "mobile-5s") {
      return isFiveSAssessor(currentUser);
    }
    if (tab === "mobile-safety") {
      return canUseSafety(currentUser);
    }
    return ["home", "assessor", "summary", "safety", "issue-stats", "catalog", "accounts", "mobile-5s", "mobile-safety"].includes(tab);
  }

  function getFallbackTab() {
    return "home";
  }

  function setActiveTab(tab, options = {}) {
    const previousTab = activeTab;
    activeTab = isTabAllowed(tab) ? tab : getFallbackTab();
    if (activeTab !== previousTab) {
      if (activeTab === "catalog") {
        expandedCatalogScope = "";
      }
      if (activeTab === "accounts") {
        expandedAccountScope = "";
      }
    }
    if (activeTab === "safety") {
      if (Object.prototype.hasOwnProperty.call(options, "safetyReport")) {
        activeSafetyReport = normalizeSafetyReportId(options.safetyReport) || "assessment";
      } else if (!options.preserveSafetyReport) {
        activeSafetyReport = "assessment";
      }
    } else {
      activeSafetyReport = "";
    }

    if (activeTab === "mobile-5s" || activeTab === "mobile-safety") {
      const initialTab = activeTab === "mobile-5s" ? "5s" : "safety";
      if (typeof window.openMobilePrototype === "function") {
        window.openMobilePrototype(initialTab, createPageContext());
      }
    } else if (previousTab === "mobile-5s" || previousTab === "mobile-safety") {
      if (typeof window.closeMobilePrototype === "function") {
        window.closeMobilePrototype();
      }
    }

    closeAccountMenu();
    document.querySelectorAll(".tab-button").forEach((button) => {
      const isSafetyTab = button.dataset.tab === "safety";
      const matchesReport = !isSafetyTab || !button.dataset.safetyReport || button.dataset.safetyReport === activeSafetyReport;
      const isActive = button.dataset.tab === activeTab && matchesReport;
      button.classList.toggle("is-active", isActive);
      button.classList.toggle("active", isActive);
      if (isActive && button.closest(".header-quick-nav") && !options.preserveScroll) {
        try {
          button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        } catch (_) {}
      }
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("is-active", panel.id === "tab-" + activeTab);
    });
    renderAppTitle();
    renderActiveTab();

    const routePath = activeTab === "safety"
      ? getSafetyReportRoute(activeSafetyReport)
      : TAB_ROUTES[activeTab] || TAB_ROUTES[getFallbackTab()];
    if (options.updateRoute !== false && routePath) {
      if (options.replaceRoute) {
        replaceRoute(routePath);
      } else {
        pushRoute(routePath);
      }
    }
  }

  function renderAll(options = {}) {
    if (!currentUser) {
      return;
    }

    const freshCurrentUser = state.accounts.find((account) => account.id === currentUser.id)
      || state.accounts.find((account) => account.username === currentUser.username);
    if (freshCurrentUser) {
      currentUser = freshCurrentUser;
    }

    renderRoleVisibility();
    ensureAllPeriodSnapshots();
    renderCurrentUser();
    populatePeriodSelects();
    populateManagerSelects();
    populateDepartmentHeadEmailSelect();
    populateAssessorSelects();
    populateAreaSelects();
    updateUndoRedoButtons();
    setActiveTab(activeTab, {
      replaceRoute: Boolean(options.replaceRoute),
      updateRoute: options.updateRoute,
      preserveScroll: Boolean(options.preserveScroll),
      preserveSafetyReport: true,
    });
    scheduleInlineScoreFocusRestore();
  }

  function createPageContext() {
    return {
      get currentUser() {
        return currentUser;
      },
      get state() {
        return state;
      },
      get activeSafetyReport() {
        return activeSafetyReport;
      },
      BENCHMARK,
      DEFAULT_ITEMS,
      DEFAULT_SAFETY_REPORT,
      ISSUE_STATUS_OPTIONS,
      FIVE_S_PERIOD_TYPE,
      SAFETY_FOUND_COLUMNS,
      SAFETY_LEVEL_COLUMNS,
      SAFETY_PERIOD_TYPE,
      SAFETY_REPORT_OPTIONS,
      SAFETY_STOP6_COLUMNS,
      SCORE_SOURCE_ASSESSOR,
      SCORE_SOURCE_SELF,
      SCORE_SOURCE_AVERAGE,
      SCORE_SOURCE_OPTIONS,
      areaAverage,
      buildMatrixTable,
      canUseSafety,
      isFiveSAssessor,
      isTabAllowed,
      pushRoute,
      replaceRoute,
      setActiveTab,
      showToast,
      TAB_ROUTES,
      canManageSafetyRecord,
      canManageSafetyCountermeasure,
      elements,
      escapeHtml,
      formatDateDisplay,
      formatNumber,
      getActivePeriodId,
      getAllowedAreaIds,
      getAreaResponsibleNameForPeriod,
      getAreasForPeriod,
      getCompletionDateDisplay,
      getIssueCount,
      getIssueDay,
      getIssueDescription,
      getIssueFoundBy,
      getIssueEmployeeCode,
      getIssueItemLabel,
      getIssueLocation,
      getIssueMonth,
      getIssueStatusLabel,
      getIssueRecords,
      getSafetyLevelConfirm,
      getSafetyStop6Confirm,
      itemAverage,
      getPeriod,
      getPeriodStats,
      getPeriodsByType,
      getReportDateValue,
      getSafetyDepartmentForArea,
      getSafetyDepartmentGroups,
      getSafetyFilterMonths,
      getSafetyFilterYears,
      getSafetyReportForPeriod,
      getSafetyRowsForYear,
      getSafetyReportRoute,
      getSafetyZoneTarget,
      getSafetyMonthlyTarget,
      updateSafetyMonthlyTarget,
      getFiveSChartTarget,
      getFiveSChartTargets,
      getScoreSourceLabel,
      getScoreSourceForAccount,
      goToSafetyReport,
      updateSafetyZoneTarget,
      isAdminAccount,
      isDepartmentHeadAccount,
      hasAccountAccessType,
      renderRoleVisibility,
      isFiveSAssessor,
      isIssueOpen,
      normalizeIssueStatus,
      isPeriodArchived,
      isPeriodOpen,
      isSafetyAssessor,
      isZoneOwnerAccount,
      isSafetyFoundSelected,
      isSafetyLevelSelected,
      isSafetyStop6Selected,
      periodLabel,
      renderStandardReferenceTable,
      setScore,
      getScoreRecord,
      saveSafetyRecord,
      deleteSafetyRecord,
      deleteSafetyRecordDirect,
      deleteSafetyRecordFromDb,
      showToast,
      prepareScorePhoto,
      normalizeSafetyRecord,
      getAreaForPeriod,
      getArea,
      getItem,
      getCriterion,
      getAccountDisplayName,
      canEditFiveSScoreSource,
      todayIsoDate,
      saveScore,
      makeId,
      legacyRenderers: {
        accounts: renderAccountsTab,
        assessor: renderAssessorTab,
        catalog: renderCatalogTab,
        data: renderDataTab,
      },
    };
  }
  window.__GET_APP_CONTEXT__ = createPageContext;

  function renderActiveTab() {
    const context = createPageContext();
    window.__APP_CONTEXT__ = context;
    if (pageRegistry?.render?.(activeTab, context)) {
      renderRoleVisibility();
      hydrateAuthenticatedPhotos(elements.appShell);
      return;
    }

    context.legacyRenderers[activeTab]?.();
    renderRoleVisibility();
    hydrateAuthenticatedPhotos(elements.appShell);
  }

  function populatePeriodSelects() {
    const makeOptions = (periods) => periods.length
      ? periods
        .map((period) => "<option value=\"" + escapeHtml(period.id) + "\">" + escapeHtml(periodLabel(period)) + "</option>")
        .join("")
      : "<option value=\"\">Không có kỳ đánh giá đang mở</option>";
    const fiveSPeriods = getPeriodsByType(FIVE_S_PERIOD_TYPE);
    const safetyPeriods = getPeriodsByType(SAFETY_PERIOD_TYPE);
    const fiveSActive = getActivePeriodId(FIVE_S_PERIOD_TYPE);
    const safetyActive = getActivePeriodId(SAFETY_PERIOD_TYPE);
    const isAdmin = isAdminAccount(currentUser);
    const canViewAllPeriods = isAdmin || isViewerAccount(currentUser) || isDepartmentHeadAccount(currentUser);

    const visibleFiveSPeriods = canViewAllPeriods
      ? fiveSPeriods
      : fiveSPeriods.filter((period) => period.id === fiveSActive);
    const visibleSafetyPeriods = canViewAllPeriods
      ? safetyPeriods
      : safetyPeriods.filter((period) => period.id === safetyActive);
    const currentSafetyPeriods = safetyPeriods.filter((period) => period.id === safetyActive);

    [elements.assessorPeriodSelect, elements.summaryPeriodSelect].forEach((select) => {
      if (!select) return;
      select.innerHTML = makeOptions(visibleFiveSPeriods);
      select.value = visibleFiveSPeriods.some((period) => period.id === fiveSActive) ? fiveSActive : visibleFiveSPeriods[0]?.id || "";
    });
    if (elements.safetyPeriodSelect) {
      const safetySelectPeriods = canViewAllPeriods ? visibleSafetyPeriods : currentSafetyPeriods;
      elements.safetyPeriodSelect.innerHTML = safetySelectPeriods.length
        ? makeOptions(safetySelectPeriods)
        : "<option value=\"\">" + escapeHtml(currentDateDisplay()) + "</option>";
      elements.safetyPeriodSelect.value = safetySelectPeriods.some((period) => period.id === safetyActive) ? safetyActive : safetySelectPeriods[0]?.id || "";
      elements.safetyPeriodSelect.disabled = !canViewAllPeriods;
      elements.safetyPeriodSelect.title = canViewAllPeriods
        ? "Chọn kỳ đánh giá an toàn để xem"
        : currentSafetyPeriods[0]
          ? "Kỳ đánh giá an toàn đang mở hiện tại"
          : "Chưa có kỳ đánh giá an toàn đang mở";
    }
    if (elements.issueStatsPeriodSelect) {
      elements.issueStatsPeriodSelect.innerHTML = makeOptions(visibleSafetyPeriods);
      elements.issueStatsPeriodSelect.value = visibleSafetyPeriods.some((period) => period.id === safetyActive) ? safetyActive : visibleSafetyPeriods[0]?.id || "";
    }

    const today = todayIsoDate();
    const todayParts = today.split("-");
    if (elements.period5SMonth && !elements.period5SMonth.value) elements.period5SMonth.value = String(Number(todayParts[1]));
    if (elements.period5SYear && !elements.period5SYear.value) elements.period5SYear.value = todayParts[0];
    if (elements.periodSafetyDate && !elements.periodSafetyDate.value) elements.periodSafetyDate.value = formatDateDisplay(today);
    if (elements.periodSafetyDateCalendar && !elements.periodSafetyDateCalendar.value) elements.periodSafetyDateCalendar.value = today;
  }
  function populateAreaSelects() {
    const fiveSPeriodId = getActivePeriodId(FIVE_S_PERIOD_TYPE);
    const fiveSAreas = getAreasForPeriod(fiveSPeriodId);
    const allowedAreaIds = getAllowedAreaIds(currentUser, fiveSPeriodId);
    const assignedAreas = fiveSAreas.filter((area) => allowedAreaIds.has(area.id));
    if (elements.assessorAreaSelect) {
      const current = elements.assessorAreaSelect.value;
      elements.assessorAreaSelect.innerHTML = assignedAreas
        .map((area) => "<option value=\"" + escapeHtml(area.id) + "\">Zone " + escapeHtml(area.code) + " · " + escapeHtml(getAreaResponsibleNameForPeriod(fiveSPeriodId, area)) + "</option>")
        .join("");
      elements.assessorAreaSelect.value = assignedAreas.some((area) => area.id === current) ? current : assignedAreas[0]?.id || "";
    }

    if (elements.safetyAreaFilter) {
      const safetyPeriodId = getActivePeriodId(SAFETY_PERIOD_TYPE);
      const current = elements.safetyAreaFilter.value;
      const periodAreas = getAreasForPeriod(safetyPeriodId).filter(isReportableSafetyArea);
      elements.safetyAreaFilter.innerHTML = "<option value=\"\">Tất cả zone</option>" + periodAreas
        .map((area) => "<option value=\"" + escapeHtml(area.id) + "\">Zone " + escapeHtml(area.code) + " · " + escapeHtml(getSafetyDepartmentForArea(area, safetyPeriodId)) + "</option>")
        .join("");
      elements.safetyAreaFilter.value = periodAreas.some((area) => area.id === current) ? current : "";
    }
  }
  function populateManagerSelects() {
    const catalogPeriodId = getActivePeriodId(activeCatalogScope);
    const accountPeriodId = getActivePeriodId(activeAccountScope);
    const accountHtml = managerOptions(elements.accountManager?.value || "", true, activeAccountScope, accountPeriodId);

    if (elements.areaScorer) {
      const current = elements.areaScorer.value;
      const catalogManagers = getPeriodCatalogManagers(activeCatalogScope, catalogPeriodId);
      elements.areaScorer.innerHTML = catalogManagers
        .map((manager) => `<option value="${escapeHtml(manager.id)}">${escapeHtml(manager.name)}</option>`)
        .join("");
      elements.areaScorer.value = catalogManagers.some((manager) => manager.id === current) ? current : catalogManagers[0]?.id || "";
    }

    if (elements.accountManager) {
      const current = elements.accountManager.value;
      elements.accountManager.innerHTML = accountHtml;
      elements.accountManager.value = getPeriodCatalogManagers(activeAccountScope, accountPeriodId).some((manager) => manager.id === current) ? current : "";
    }
  }


  function populateDepartmentHeadEmailSelect() {
    if (!elements.departmentHeadEmailName) {
      return;
    }

    const rows = getDepartmentHeadRows(getActivePeriodId(activeCatalogScope));
    const current = elements.departmentHeadEmailName.value;
    elements.departmentHeadEmailName.innerHTML = rows
      .map((row) => "<option value=\"" + escapeHtml(row.name) + "\">" + escapeHtml(row.name) + "</option>")
      .join("") || "<option value=\"\">Chưa có trưởng phòng</option>";
    elements.departmentHeadEmailName.value = rows.some((row) => row.name === current) ? current : rows[0]?.name || "";
    fillDepartmentHeadEmailForm(elements.departmentHeadEmailName.value);
  }

  function fillDepartmentHeadEmailForm(name) {
    if (!elements.departmentHeadEmails) {
      return;
    }

    elements.departmentHeadEmails.value = formatEmailList(getDepartmentHeadEmailsForPeriod(getActivePeriodId(activeCatalogScope), name));
  }

  function refreshDepartmentHeadEmailUi() {
    populateDepartmentHeadEmailSelect();
    renderDepartmentHeadEmailList();
  }

  function populateAssessorSelects() {
    const catalogPeriodId = getActivePeriodId(activeCatalogScope);
    const accountPeriodId = getActivePeriodId(activeAccountScope);
    const areaHtml = assessorOptions("", true, activeCatalogScope, catalogPeriodId);
    const accountHtml = assessorOptions("", true, activeAccountScope, accountPeriodId);

    if (elements.areaAssessor) {
      const current = elements.areaAssessor.value;
      elements.areaAssessor.innerHTML = areaHtml;
      elements.areaAssessor.value = getPeriodCatalogAssessors(activeCatalogScope, catalogPeriodId).some((assessor) => assessor.id === current) ? current : "";
    }

    if (elements.accountAssessor) {
      const current = elements.accountAssessor.value;
      elements.accountAssessor.innerHTML = accountHtml;
      elements.accountAssessor.value = getPeriodCatalogAssessors(activeAccountScope, accountPeriodId).some((assessor) => assessor.id === current) ? current : "";
    }
  }

  function syncCatalogAreaFormFields() {
    const isSafety = normalizeCatalogType(activeCatalogScope) === SAFETY_PERIOD_TYPE;
    const periodId = getActivePeriodId(activeCatalogScope);

    if (elements.areaSummaryGroupField) elements.areaSummaryGroupField.hidden = isSafety;
    if (elements.areaAssessorField) elements.areaAssessorField.hidden = isSafety;
    if (elements.areaHighlightField) elements.areaHighlightField.hidden = isSafety;
    if (elements.areaAssessorsCheckboxField) elements.areaAssessorsCheckboxField.hidden = !isSafety;

    if (elements.areaAssessor) {
      elements.areaAssessor.required = !isSafety;
    }

    if (isSafety && elements.areaAssessorsCheckList) {
      elements.areaAssessorsCheckList.innerHTML = assessorCheckboxListHtml([], activeCatalogScope, periodId);
      refreshSelectAllStates(elements.areaAssessorsCheckList);
    }
  }

  function renderCatalogAssessorZoneList() {
    if (!elements.catalogAssessorZoneList) {
      return;
    }
    const catalogType = activeCatalogScope;
    const periodId = getActivePeriodId(catalogType);
    elements.catalogAssessorZoneList.innerHTML = areaCheckboxListHtml([], catalogType, periodId);
    refreshSelectAllStates(elements.catalogAssessorZoneList);
  }

  function renderAccountZoneList(selectedIds = []) {
    if (!elements.accountZoneList) {
      return;
    }

    elements.accountZoneList.innerHTML = areaCheckboxListHtml(selectedIds, activeAccountScope);
    refreshSelectAllStates(elements.accountZoneList);
    syncAccountRoleFields();
  }

  function syncAccountRoleFields(roleValue = elements.accountRole?.value, root = elements.accountForm, scope = activeAccountScope) {
    const catalogType = normalizeCatalogType(scope);
    const role = normalizeScopedAccountRole(roleValue, catalogType);
    const isZoneOwnerRole = role === ROLE_ZONE_OWNER;
    const isViewerRole = role === ROLE_VIEWER;
    const assessorField = root?.querySelector?.("#account-assessor-field, [data-account-assessor-field]");
    const managerField = root?.querySelector?.("#account-manager-field, [data-account-manager-field]");
    const viewerNameField = root?.querySelector?.("#account-viewer-name-field, [data-account-viewer-name-field]");
    const viewerPositionField = root?.querySelector?.("#account-viewer-position-field, [data-account-viewer-position-field]");
    const viewerNameInput = root?.querySelector?.("#account-viewer-name, input[name='viewerName']");
    const viewerPositionInput = root?.querySelector?.("#account-viewer-position, input[name='viewerPosition']");
    const assessorSelect = root?.querySelector?.("#account-assessor, select[name='assessorId']");
    const managerSelect = root?.querySelector?.("#account-manager, select[name='scorerId']");
    const zoneField = root?.querySelector?.("#account-zone-field, [data-account-zone-field]");
    const zoneLabel = root?.querySelector?.("#account-zone-label, [data-account-zone-label]");
    const zoneList = root?.querySelector?.("#account-zone-list, .zone-check-list");

    if (assessorField) {
      assessorField.hidden = isZoneOwnerRole || isViewerRole;
    }
    if (managerField) {
      managerField.hidden = !isZoneOwnerRole || isViewerRole;
    }
    if (viewerNameField) {
      viewerNameField.hidden = !isViewerRole;
    }
    if (viewerPositionField) {
      viewerPositionField.hidden = !isViewerRole;
    }
    if (viewerNameInput) {
      viewerNameInput.required = isViewerRole;
    }
    if (viewerPositionInput) {
      viewerPositionInput.required = isViewerRole;
    }
    if (assessorSelect) {
      assessorSelect.required = !isZoneOwnerRole && !isViewerRole;
      assessorSelect.disabled = isZoneOwnerRole || isViewerRole;
    }
    if (managerSelect) {
      managerSelect.required = isZoneOwnerRole && !isViewerRole;
      managerSelect.disabled = !isZoneOwnerRole || isViewerRole;
    }
    if (zoneField) {
      zoneField.hidden = !isZoneOwnerRole || isViewerRole;
    } else {
      if (zoneLabel) zoneLabel.hidden = !isZoneOwnerRole || isViewerRole;
      if (zoneList) zoneList.hidden = !isZoneOwnerRole || isViewerRole;
    }
    if (zoneLabel) {
      zoneLabel.textContent = "Zone người được cấp tài khoản phụ trách";
    }
  }

  function syncAccountAssignedZones(form = elements.accountForm) {
    if (!form) {
      return;
    }
    const zoneList = form.querySelector("#account-zone-list, .zone-check-list");
    if (!zoneList) {
      return;
    }
    const scope = activeAccountScope;
    const periodId = getActivePeriodId(scope);
    const roleSelect = form.querySelector("#account-role, select[name='role']");
    const role = normalizeScopedAccountRole(roleSelect?.value, scope);
    if (role === ROLE_VIEWER) {
      zoneList.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
        checkbox.checked = false;
      });
      refreshSelectAllStates(zoneList);
      return;
    }
    const isZoneOwnerRole = role === ROLE_ZONE_OWNER;
    const areas = getAreasForPeriod(periodId);

    let matchingAreaIds = [];
    if (isZoneOwnerRole) {
      const managerSelect = form.querySelector("#account-manager, select[name='scorerId']");
      const selectedManagerId = managerSelect?.value || "";
      if (selectedManagerId) {
        matchingAreaIds = areas.filter((a) => a.scorerId === selectedManagerId).map((a) => a.id);
      }
    } else {
      const assessorSelect = form.querySelector("#account-assessor, select[name='assessorId']");
      const selectedAssessorId = assessorSelect?.value || "";
      if (selectedAssessorId) {
        const areaIdsFromAreas = areas
          .filter((a) => a.assessorId === selectedAssessorId || (Array.isArray(a.assessorIds) && a.assessorIds.includes(selectedAssessorId)))
          .map((a) => a.id);
        const areaIdsFromAccounts = (state.accounts || [])
          .filter((acc) => hasAccountAccessType(acc, scope) && getAccountPersonId(acc, scope) === selectedAssessorId)
          .flatMap((acc) => getAccountAreaIds(acc, scope));
        matchingAreaIds = [...new Set([...areaIdsFromAreas, ...areaIdsFromAccounts])];
      }
    }

    if (matchingAreaIds.length > 0) {
      const set = new Set(matchingAreaIds);
      zoneList.querySelectorAll('input[name="areaIds"]').forEach((input) => {
        if (set.has(input.value)) {
          input.checked = true;
        }
      });
      refreshSelectAllStates(zoneList);
    }
  }

  function scoreButtonAttrs(periodId, area, item, criterion, scoreSource = SCORE_SOURCE_ASSESSOR) {
    return "data-edit-score=\"true\" data-period-id=\"" + escapeHtml(periodId) + "\" data-area-id=\"" + escapeHtml(area.id) + "\" data-item-id=\"" + escapeHtml(item.id) + "\" data-criterion-id=\"" + escapeHtml(criterion.id) + "\" data-score-source=\"" + escapeHtml(normalizeScoreSource(scoreSource)) + "\"";
  }

  function cssSelectorValue(value) {
    if (window.CSS?.escape) {
      return CSS.escape(String(value));
    }

    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function applyScorePreview({ periodId, areaId, itemId, criterionId, rawScore, scoreSource = SCORE_SOURCE_ASSESSOR, dirty = true }) {
    const normalizedSource = normalizeScoreSource(scoreSource);
    const selector = `[data-edit-score="true"][data-period-id="${cssSelectorValue(periodId)}"][data-area-id="${cssSelectorValue(areaId)}"][data-item-id="${cssSelectorValue(itemId)}"][data-criterion-id="${cssSelectorValue(criterionId)}"][data-score-source="${cssSelectorValue(normalizedSource)}"]`;
    const isCrossed = rawScore === SCORE_CROSSED;
    const nextScore = rawScore === "" || isCrossed ? null : Number(rawScore);
    const isLow = Number.isFinite(nextScore) && nextScore <= 2;
    const label = isCrossed ? "Gạch chéo" : Number.isFinite(nextScore) ? String(nextScore) : "Chấm điểm";

    document.querySelectorAll(selector).forEach((button) => {
      const scoreCell = button.closest(".score-cell");
      if (scoreCell) {
        scoreCell.classList.toggle("score-na", isCrossed);
        scoreCell.classList.toggle("score-low", !isCrossed && isLow);
        scoreCell.classList.toggle("score-empty", rawScore === "");
        button.textContent = isCrossed ? "" : Number.isFinite(nextScore) ? String(nextScore) : "";
        button.title = isCrossed ? "Gạch chéo" : Number.isFinite(nextScore) ? String(nextScore) : "Sửa điểm";
      }

      const criterionCard = button.closest(".assessment-criterion");
      if (criterionCard) {
        criterionCard.classList.toggle("is-crossed", isCrossed);
        criterionCard.classList.toggle("is-low", !isCrossed && isLow);
        button.textContent = label;
        button.title = label;
      }
    });

    if (dirty) {
      modalPreviewDirty = true;
    }
  }

  function applyInlineScorePreview({ periodId, areaId, itemId, criterionId, rawScore, scoreSource = SCORE_SOURCE_ASSESSOR }) {
    const normalizedSource = normalizeScoreSource(scoreSource);
    const selector = `[data-inline-score-input="true"][data-period-id="${cssSelectorValue(periodId)}"][data-area-id="${cssSelectorValue(areaId)}"][data-item-id="${cssSelectorValue(itemId)}"][data-criterion-id="${cssSelectorValue(criterionId)}"][data-score-source="${cssSelectorValue(normalizedSource)}"]`;
    const isCrossed = rawScore === SCORE_CROSSED;
    const nextScore = rawScore === "" || isCrossed ? null : Number(rawScore);
    const isLow = Number.isFinite(nextScore) && nextScore <= 2;

    document.querySelectorAll(selector).forEach((input) => {
      const scoreCell = input.closest(".score-cell");
      if (scoreCell) {
        scoreCell.classList.toggle("score-na", isCrossed);
        scoreCell.classList.toggle("score-low", isLow);
        scoreCell.classList.toggle("score-empty", rawScore === "");
      }
      input.value = isCrossed ? "" : Number.isFinite(nextScore) ? String(nextScore) : "";
      input.title = isCrossed ? "Gạch chéo" : Number.isFinite(nextScore) ? String(nextScore) : "Nhập điểm";
    });
  }

  function setAverageCellText(cell, value) {
    const decimals = Number(cell.dataset.decimals);
    const formatted = formatNumber(value, Number.isFinite(decimals) ? decimals : 2);
    cell.textContent = (cell.dataset.averagePrefix || "") + formatted;
  }

  function refreshAveragePreview({ periodId, areaId = "", itemId = "", scoreSource = SCORE_SOURCE_ASSESSOR }) {
    const normalizedSource = normalizeScoreSource(scoreSource);
    const areas = getAreasForPeriod(periodId);
    const sourceSelector = `[data-period-id="${cssSelectorValue(periodId)}"][data-score-source="${cssSelectorValue(normalizedSource)}"]`;

    if (itemId) {
      const item = getItem(itemId);
      if (item) {
        document.querySelectorAll(`[data-average-kind="item"]${sourceSelector}[data-item-id="${cssSelectorValue(itemId)}"]`).forEach((cell) => {
          setAverageCellText(cell, itemAverage(periodId, item, areas, normalizedSource));
        });
      }
    }

    if (areaId) {
      const area = getAreaForPeriod(periodId, areaId);
      if (area) {
        const areaValue = areaAverage(periodId, area, normalizedSource);
        document.querySelectorAll(`[data-average-kind="area"]${sourceSelector}[data-area-id="${cssSelectorValue(areaId)}"]`).forEach((cell) => {
          setAverageCellText(cell, areaValue);
        });
        if (elements.assessorProgress && activeTab === "assessor" && elements.assessorAreaSelect?.value === areaId) {
          const completed = getCompletedCellCount(periodId, area, normalizedSource);
          const required = getRequiredCellsForArea(area);
          elements.assessorProgress.textContent = `Đã chấm ${completed}/${required} ô. Điểm TB zone: ${formatNumber(areaValue, 2)}`;
        }
      }
    }

    document.querySelectorAll(`[data-average-kind="overall"]${sourceSelector}`).forEach((cell) => {
      setAverageCellText(cell, overallAverage(periodId, areas, normalizedSource));
    });

    document.querySelectorAll(`[data-average-kind="group"]${sourceSelector}`).forEach((cell) => {
      const groupAreas = String(cell.dataset.areaIds || "")
        .split(",")
        .map((id) => areas.find((area) => area.id === id))
        .filter(Boolean);
      setAverageCellText(cell, groupAreas.length ? groupAverage(periodId, groupAreas, normalizedSource) : null);
    });
  }

  function renderAssessorTab() {
    const period = getPeriod(elements.assessorPeriodSelect?.value || getActivePeriodId(FIVE_S_PERIOD_TYPE));
    const periodId = period?.id || "";

    if (!isAdminAccount(currentUser) && (!periodId || !isPeriodOpen(periodId, FIVE_S_PERIOD_TYPE))) {
      elements.assessorTitle.textContent = "Phiếu chấm 5S";
      elements.assessorProgress.textContent = "Kỳ đánh giá này hiện không mở. Bạn chỉ có thể xem và chấm điểm kỳ đang mở.";
      elements.assessorSheet.innerHTML = '<div class="admin-card-chart-empty" style="padding: 40px; text-align: center; color: var(--text-muted, #64748b);">Kỳ đánh giá này hiện không mở. Bạn chỉ có thể xem và chấm điểm kỳ đang mở.</div>';
      return;
    }

    const scoreSource = getScoreSourceForAccount(currentUser);
    const allowedAreaIds = getAllowedAreaIds(currentUser, periodId);
    const assignedAreas = getAreasForPeriod(periodId).filter((area) => allowedAreaIds.has(area.id));
    const selectedArea = assignedAreas.find((area) => area.id === elements.assessorAreaSelect?.value) || assignedAreas[0] || null;

    if (!selectedArea) {
      elements.assessorTitle.textContent = "Phiếu chấm 5S";
      elements.assessorProgress.textContent = "Tài khoản này chưa được phân quyền zone.";
      elements.assessorSheet.innerHTML = "";
      return;
    }

    elements.assessorAreaSelect.value = selectedArea.id;
    const completed = getCompletedCellCount(periodId, selectedArea, scoreSource);
    const required = getRequiredCellsForArea(selectedArea);
    elements.assessorTitle.textContent = `Phiếu chấm 5S - Zone ${selectedArea.code} - ${periodLabel(period)}`;
    elements.assessorProgress.textContent = `Đã chấm ${completed}/${required} ô. Điểm TB zone: ${formatNumber(areaAverage(periodId, selectedArea, scoreSource), 2)}`;
    elements.assessorSheet.innerHTML = '<div class="assessor-4m-wrap" data-drag-scroll><table class="matrix-table standard-reference-table assessor-4m-table"></table></div>';
    renderAssessorFourMTable(elements.assessorSheet.querySelector(".assessor-4m-table"), {
      periodId,
      area: selectedArea,
      scoreSource,
      editable: canEditFiveSScoreSource(currentUser, scoreSource) && !isPeriodArchived(periodId),
    });
  }

  function renderAssessorFourMTable(table, { periodId, area, scoreSource = SCORE_SOURCE_ASSESSOR, editable = false }) {
    if (!table || !area) {
      return;
    }

    const period = getPeriod(periodId);
    const normalizedSource = normalizeScoreSource(scoreSource);
    const canEditTable = Boolean(editable) && getAllowedAreaIds(currentUser, periodId).has(area.id);
    table.innerHTML = "";
    table.dataset.periodId = periodId;
    table.dataset.areaId = area.id;
    table.dataset.scoreSource = normalizedSource;

    const colgroup = document.createElement("colgroup");
    ["76px", "148px", "68px", "58px", "154px", "154px", "170px", "154px", "154px"].forEach((width) => {
      const col = document.createElement("col");
      col.style.width = width;
      colgroup.appendChild(col);
    });
    table.appendChild(colgroup);

    const titleRow = document.createElement("tr");
    titleRow.appendChild(setColSpan(createCell("th", "BẢNG ĐÁNH GIÁ HOẠT ĐỘNG SHITSUKE + 4S NƠI LÀM VIỆC", "standard-reference-title assessor-4m-title"), 9));
    table.appendChild(titleRow);

    const metaRow = document.createElement("tr");
    metaRow.appendChild(setColSpan(createCell("td", "Zone: " + area.code + "\n" + getAreaResponsibleNameForPeriod(periodId, area), "standard-reference-meta-cell assessor-4m-meta"), 2));
    metaRow.appendChild(setColSpan(createCell("td", "Kỳ: " + periodLabel(period) + "\nNguồn: " + getScoreSourceLabel(normalizedSource), "standard-reference-meta-cell assessor-4m-meta"), 2));
    metaRow.appendChild(setColSpan(createCell("td", "Đánh giá viên:\n" + getAccountDisplayName(currentUser, FIVE_S_PERIOD_TYPE, periodId), "standard-reference-meta-cell assessor-4m-meta"), 3));
    const metaAverageCell = setColSpan(createCell("td", "Điểm TB:\n" + formatNumber(areaAverage(periodId, area, normalizedSource), 2), "standard-reference-meta-cell assessor-4m-meta assessor-4m-average"), 2);
    metaAverageCell.dataset.averageKind = "area";
    metaAverageCell.dataset.periodId = periodId;
    metaAverageCell.dataset.areaId = area.id;
    metaAverageCell.dataset.scoreSource = normalizedSource;
    metaAverageCell.dataset.decimals = "2";
    metaAverageCell.dataset.averagePrefix = "Điểm TB:\n";
    metaRow.appendChild(metaAverageCell);
    table.appendChild(metaRow);

    const headerRow = document.createElement("tr");
    ["Hạng mục", "Vị trí kiểm tra", "Khoản mục", "Điểm", ...SCORE_LEVEL_LABELS].forEach((label, index) => {
      headerRow.appendChild(createCell("th", label, `standard-reference-column-head standard-reference-head-${index + 1}`));
    });
    table.appendChild(headerRow);

    STANDARD_REFERENCE_SECTIONS.forEach((section) => {
      const sectionSpan = section.items.reduce((total, entry) => total + (getItem(entry.id)?.criteria.length || 0), 0);
      let isFirstSectionRow = true;

      section.items.forEach((entry) => {
        const item = getItem(entry.id);
        if (!item) {
          return;
        }

        item.criteria.forEach((criterion, criterionIndex) => {
          const row = document.createElement("tr");
          const record = getScoreRecord(periodId, area.id, item.id, criterion.id, normalizedSource);
          const selectedScore = isScoreCrossed(record) ? SCORE_CROSSED : Number.isFinite(record?.score) ? String(record.score) : "";
          const isNa = isNotApplicable(item.id, criterion.id, area);
          const canEditCell = canEditTable && !isNa;

          if (isFirstSectionRow) {
            row.appendChild(setRowSpan(createCell("td", section.label, "standard-reference-section-cell"), sectionSpan));
            isFirstSectionRow = false;
          }
          if (criterionIndex === 0) {
            row.appendChild(setRowSpan(createCell("td", entry.location || item.name, "standard-reference-location-cell"), item.criteria.length));
          }

          row.appendChild(createCell("td", entry.hideCriterion ? "" : criterion.label, "standard-reference-criterion-cell"));
          row.appendChild(createAssessorScoreInputCell({ periodId, area, item, criterion, scoreSource: normalizedSource, selectedScore, canEdit: canEditCell }));

          const levels = SCORE_GUIDE[item.id]?.[criterion.id] || [];
          for (let levelIndex = 0; levelIndex < 5; levelIndex += 1) {
            const scoreValue = String(levelIndex + 1);
            const className = `standard-reference-level-cell standard-reference-level-${levelIndex + 1}${selectedScore === scoreValue ? " is-selected-score" : ""}`;
            row.appendChild(createCell("td", levels[levelIndex] || "", className));
          }
          table.appendChild(row);
        });
      });
    });

    const averageRow = document.createElement("tr");
    averageRow.appendChild(createCell("td", "", "standard-reference-blank"));
    const zoneAverageCell = setColSpan(createCell("td", "Điểm trung bình Zone " + area.code + ": " + formatNumber(areaAverage(periodId, area, normalizedSource), 2), "standard-reference-average-label"), 8);
    zoneAverageCell.dataset.averageKind = "area";
    zoneAverageCell.dataset.periodId = periodId;
    zoneAverageCell.dataset.areaId = area.id;
    zoneAverageCell.dataset.scoreSource = normalizedSource;
    zoneAverageCell.dataset.decimals = "2";
    zoneAverageCell.dataset.averagePrefix = "Điểm trung bình Zone " + area.code + ": ";
    averageRow.appendChild(zoneAverageCell);
    table.appendChild(averageRow);
  }

  function createAssessorScoreInputCell({ periodId, area, item, criterion, scoreSource, selectedScore, canEdit }) {
    const cell = createCell("td", "", "standard-reference-score-input-cell");
    if (!canEdit) {
      cell.textContent = selectedScore === SCORE_CROSSED ? "X" : selectedScore || "-";
      return cell;
    }

    const select = document.createElement("select");
    select.className = "assessor-score-select";
    select.dataset.assessorScoreSelect = "true";
    select.dataset.periodId = periodId;
    select.dataset.areaId = area.id;
    select.dataset.itemId = item.id;
    select.dataset.criterionId = criterion.id;
    select.dataset.scoreSource = normalizeScoreSource(scoreSource);
    select.dataset.savedValue = selectedScore;
    [
      { value: "", label: "-" },
      { value: "1", label: "1" },
      { value: "2", label: "2" },
      { value: "3", label: "3" },
      { value: "4", label: "4" },
      { value: "5", label: "5" },
      { value: SCORE_CROSSED, label: "X" },
    ].forEach((option) => {
      const itemOption = document.createElement("option");
      itemOption.value = option.value;
      itemOption.textContent = option.label;
      itemOption.selected = option.value === selectedScore;
      itemOption.toggleAttribute("selected", option.value === selectedScore);
      select.appendChild(itemOption);
    });
    select.value = selectedScore;
    cell.classList.toggle("score-low", selectedScore === "1" || selectedScore === "2");
    cell.classList.toggle("score-na", selectedScore === SCORE_CROSSED);
    cell.appendChild(select);
    return cell;
  }

  function renderAssessorItem(periodId, area, item, scoreSource = SCORE_SOURCE_ASSESSOR) {
    return `<article class="assessment-item">
      <div class="assessment-item-head">
        <strong>${escapeHtml(item.code)} ${escapeHtml(item.name)}</strong>
        <span>Điểm TB: ${formatNumber(itemAverageForArea(periodId, area, item, scoreSource), 1)}</span>
      </div>
      <div class="assessment-criteria">
        ${item.criteria.map((criterion) => renderAssessorCriterion(periodId, area, item, criterion, scoreSource)).join("")}
      </div>
    </article>`;
  }

  function itemAverageForArea(periodId, area, item, scoreSource = SCORE_SOURCE_ASSESSOR) {
    return average(item.criteria.map((criterion) => getScoreValue(periodId, area.id, item.id, criterion.id, scoreSource)));
  }
  function renderAssessorCriterion(periodId, area, item, criterion, scoreSource = SCORE_SOURCE_ASSESSOR) {
    const record = getScoreRecord(periodId, area.id, item.id, criterion.id, scoreSource);
    const scoreText = formatScoreRecord(record) || "Chấm điểm";
    const stateClass = isScoreCrossed(record) ? "is-crossed" : Number.isFinite(record?.score) && record.score <= 2 ? "is-low" : "";

    return `<section class="assessment-criterion ${stateClass}">
      <div class="assessment-criterion-head">
        <h3>${escapeHtml(criterion.label)}</h3>
        ${
          isPeriodArchived(periodId)
            ? `<span class="score-readonly-pill">${escapeHtml(scoreText)}</span>`
            : `<button class="tiny-button" type="button" ${scoreButtonAttrs(periodId, area, item, criterion, scoreSource)}>${escapeHtml(scoreText)}</button>`
        }
      </div>
      ${scoreGuideHtml(item, criterion)}
    </section>`;
  }

  function normalizeScopeCardValue(scope) {
    if (scope === ACCOUNT_DEPARTMENT_HEAD_SCOPE) return ACCOUNT_DEPARTMENT_HEAD_SCOPE;
    return scope === ACCOUNT_VIEWER_SCOPE ? ACCOUNT_VIEWER_SCOPE : normalizeCatalogType(scope);
  }

  function scopeCardHtml(activeScope, action, titlePrefix, scopeOptions = ACCOUNT_SCOPE_OPTIONS) {
    const normalizedActiveScope = activeScope ? normalizeScopeCardValue(activeScope) : "";
    const options = normalizedActiveScope
      ? [
          ...scopeOptions.filter((option) => normalizeScopeCardValue(option.value) === normalizedActiveScope),
          ...scopeOptions.filter((option) => normalizeScopeCardValue(option.value) !== normalizedActiveScope),
        ]
      : scopeOptions;

    return options.map((option) => {
      const scope = normalizeScopeCardValue(option.value);
      const isViewerScope = scope === ACCOUNT_VIEWER_SCOPE;
      const isDepartmentHeadScope = scope === ACCOUNT_DEPARTMENT_HEAD_SCOPE;
      const period = isViewerScope ? null : getPeriod(getActivePeriodId(scope));
      const isActive = scope === normalizedActiveScope;
      const activeClass = isActive ? " is-active" : "";
      const title = titlePrefix + " " + option.label;
      const periodText = isViewerScope || isDepartmentHeadScope ? "Toàn bộ bảng biểu" : period ? periodLabel(period) : currentDateDisplay();
      const iconText = option.icon || option.label;
      const cardClass = isDepartmentHeadScope ? "department-head-card" : isViewerScope ? "viewer-card" : scope === SAFETY_PERIOD_TYPE ? "safety-card" : "score-card";
      return `<article class="admin-home-card dashboard-home-card simple-home-card scope-card ${cardClass}${activeClass}">
        <button class="scope-card-toggle" type="button" data-action="${escapeHtml(action)}" data-id="${escapeHtml(scope)}" aria-label="${escapeHtml(title)}" aria-expanded="${isActive ? "true" : "false"}">
          <span class="admin-home-card-icon">${escapeHtml(iconText)}</span>
          <span class="scope-card-copy"><span class="scope-card-kicker">${escapeHtml(titlePrefix)}</span><strong>${escapeHtml(option.label)}</strong></span>
          <span class="scope-card-period">${escapeHtml(periodText)}</span>
        </button>
        <div class="scope-card-detail-slot" data-scope-detail-slot="${escapeHtml(scope)}"></div>
      </article>`;
    }).join("");
  }

  function mountScopeDetail(container, detailCard, activeScope) {
    if (!container || !detailCard) {
      return;
    }

    if (!activeScope) {
      if (container.contains(detailCard)) {
        container.after(detailCard);
      }
      detailCard.hidden = true;
      return;
    }

    const scope = normalizeScopeCardValue(activeScope);
    const slot = container.querySelector(`[data-scope-detail-slot="${scope}"]`);
    if (!slot) {
      if (container.contains(detailCard)) {
        container.after(detailCard);
      }
      detailCard.hidden = true;
      return;
    }

    slot.appendChild(detailCard);
    detailCard.hidden = false;
  }

  function renderScopeSwitch(container, activeScope, action, titlePrefix, detailCard = null, scopeOptions = ACCOUNT_SCOPE_OPTIONS) {
    if (!container) {
      return;
    }
    if (detailCard && container.contains(detailCard)) {
      container.after(detailCard);
      detailCard.hidden = true;
    }
    container.innerHTML = scopeCardHtml(activeScope, action, titlePrefix, scopeOptions);
  }

  function setCatalogScope(scope) {
    const nextScope = normalizeCatalogType(scope);
    expandedCatalogScope = expandedCatalogScope === nextScope ? "" : nextScope;
    activeCatalogScope = nextScope;
    renderAll();
  }

  function setAccountScope(scope) {
    const nextScope = normalizeScopeCardValue(scope);
    expandedAccountScope = expandedAccountScope === nextScope ? "" : nextScope;
    if (![ACCOUNT_VIEWER_SCOPE, ACCOUNT_DEPARTMENT_HEAD_SCOPE].includes(nextScope)) {
      activeAccountScope = nextScope;
    }
    renderAll();
  }

  function setHistoryScope(scope) {
    if (!requireAdminAction()) {
      return;
    }

    activeHistoryScope = normalizeCatalogType(scope);
    openEditHistoryModal(activeHistoryScope);
  }

  function renderCatalogTab() {
    renderScopeSwitch(elements.catalogScopeSwitch, expandedCatalogScope, "set-catalog-scope", "Danh mục", elements.catalogScopeDetail);
    mountScopeDetail(elements.catalogScopeSwitch, elements.catalogScopeDetail, expandedCatalogScope);
    syncCatalogPeriodFields();
    renderPeriodList();
    renderScorerList();
    populateDepartmentHeadEmailSelect();
    renderDepartmentHeadEmailList();
    renderCatalogAssessorZoneList();
    renderAssessorList();
    syncCatalogAreaFormFields();
    renderAreaList();
    renderSafetyDepartmentGroupCatalogPanel();
    renderItemList();
  }

  function syncCatalogPeriodFields() {
    const isSafetyScope = normalizeCatalogType(activeCatalogScope) === SAFETY_PERIOD_TYPE;
    if (elements.period5SForm) elements.period5SForm.hidden = isSafetyScope;
    if (elements.period5SList) elements.period5SList.hidden = isSafetyScope;
    if (elements.periodSafetyForm) elements.periodSafetyForm.hidden = !isSafetyScope;
    if (elements.periodSafetyList) elements.periodSafetyList.hidden = !isSafetyScope;
  }

  function renderPeriodList() {
    const renderList = (container, type, emptyMessage) => {
      if (!container) return;
      const periods = getPeriodsByType(type);
      const activeId = getActivePeriodId(type);
      container.innerHTML = periods
        .map((period) => {
          const isActive = period.id === activeId;
          const activeBtnClass = isActive ? "tiny-button active-period-btn" : "tiny-button";
          const activeText = isActive ? "Đang mở" : "Mở kỳ";
          const periodType = normalizePeriodType(period.type) === SAFETY_PERIOD_TYPE ? SAFETY_PERIOD_TYPE : FIVE_S_PERIOD_TYPE;
          const meta = periodType === SAFETY_PERIOD_TYPE ? "Đánh giá an toàn" : "Chấm 5S";
          const editAction = periodType === SAFETY_PERIOD_TYPE ? "edit-safety-period-date" : "edit-five-s-period-date";
          const editLabel = "Sửa";
          const editDateButton = "<button class=\"tiny-button\" type=\"button\" data-action=\"" + escapeHtml(editAction) + "\" data-id=\"" + escapeHtml(period.id) + "\">" + escapeHtml(editLabel) + "</button>";
          return `<article class="compact-item catalog-period-item ${isActive ? "period-item-active" : ""}">
            <div class="compact-main">
              <div class="compact-title-row">
                <strong>${escapeHtml(periodLabel(period))}</strong>
                <span class="catalog-meta-pill ${isActive ? "pill-active" : "pill-muted"}">${escapeHtml(meta)}</span>
              </div>
            </div>
            <div class="compact-actions">
              <button class="${activeBtnClass}" type="button" data-action="activate-period" data-period-type="${escapeHtml(type)}" data-id="${escapeHtml(period.id)}">${activeText}</button>
              ${editDateButton}
              <button class="tiny-button danger-text-button" type="button" data-action="delete-period" data-id="${escapeHtml(period.id)}">Xóa</button>
            </div>
          </article>`;
        })
        .join("") || "<article class=\"compact-item\"><strong>" + escapeHtml(emptyMessage) + "</strong></article>";
    };

    renderList(elements.period5SList || elements.periodList, FIVE_S_PERIOD_TYPE, "Chưa có kỳ chấm 5S.");
    renderList(elements.periodSafetyList, SAFETY_PERIOD_TYPE, "Chưa có kỳ đánh giá an toàn.");
  }
  function renderDataTab() {}

  function renderScorerList() {
    const catalogType = activeCatalogScope;
    const periodId = getActivePeriodId(catalogType);
    const areas = getAreasForPeriod(periodId);
    elements.scorerList.innerHTML = getPeriodCatalogManagers(catalogType, periodId)
      .map((manager) => {
        const zones = areas
          .filter((area) => area.scorerId === manager.id)
          .map((area) => area.code);
        let zoneSummaryHtml = "";
        const allZonesStr = zones.join(", ");
        if (!zones.length) {
          zoneSummaryHtml = '<span class="catalog-meta-pill text-muted">Chưa gán zone</span>';
        } else if (zones.length > 5) {
          const head = zones.slice(0, 4).join(", ");
          const remain = zones.length - 4;
          zoneSummaryHtml = `<span class="catalog-meta-pill pill-zone" title="${escapeHtml(allZonesStr)}">Zone: ${escapeHtml(head)} <span class="pill-more">+${remain} zone</span></span>`;
        } else {
          zoneSummaryHtml = `<span class="catalog-meta-pill pill-zone">Zone: ${escapeHtml(allZonesStr)}</span>`;
        }
        return `<article class="compact-item catalog-scorer-item">
          <div class="compact-main">
            <div class="compact-title-row">
              <strong>${escapeHtml(manager.name)}</strong>
              ${zoneSummaryHtml}
            </div>
          </div>
          <div class="compact-actions">
            <button class="tiny-button" type="button" data-action="edit-scorer" data-id="${escapeHtml(manager.id)}">Sửa</button>
            <button class="tiny-button danger-text-button" type="button" data-action="delete-scorer" data-id="${escapeHtml(manager.id)}">Xóa</button>
          </div>
        </article>`;
      })
      .join("") || '<article class="compact-item"><strong>Chưa có người phụ trách</strong><span>Thêm người phụ trách zone trước khi gán zone.</span></article>';
  }


  function renderDepartmentHeadEmailList() {
    if (!elements.departmentHeadEmailList) {
      return;
    }

    const rows = getDepartmentHeadRows(getActivePeriodId(activeCatalogScope));
    elements.departmentHeadEmailList.innerHTML = rows
      .map((row) => {
        const emails = formatEmailList(row.emails);
        const clearButton = emails
          ? "<button class=\"tiny-button danger-text-button\" type=\"button\" data-action=\"clear-department-head-email\" data-id=\"" + escapeHtml(row.name) + "\">Xóa email</button>"
          : "";
        const areaCodes = row.areaCodes || [];
        let zoneSummaryHtml = "";
        const allZonesStr = areaCodes.join(", ");
        if (!areaCodes.length) {
          zoneSummaryHtml = '<span class="catalog-meta-pill text-muted">Chưa gán zone</span>';
        } else if (areaCodes.length > 5) {
          const head = areaCodes.slice(0, 4).join(", ");
          const remain = areaCodes.length - 4;
          zoneSummaryHtml = `<span class="catalog-meta-pill pill-zone" title="${escapeHtml(allZonesStr)}">Zone: ${escapeHtml(head)} <span class="pill-more">+${remain}</span></span>`;
        } else {
          zoneSummaryHtml = `<span class="catalog-meta-pill pill-zone">Zone: ${escapeHtml(allZonesStr)}</span>`;
        }

        return `<article class="compact-item department-head-email-item">
          <div class="compact-main">
            <div class="compact-title-row">
              <strong>${escapeHtml(row.name)}</strong>
              ${zoneSummaryHtml}
            </div>
            <div class="compact-meta-row">
              <span class="meta-label">Email:</span> <span class="email-address-text">${escapeHtml(emails || "chưa cấu hình email")}</span>
            </div>
          </div>
          <div class="compact-actions">
            <button class="tiny-button" type="button" data-action="edit-department-head-email" data-id="${escapeHtml(row.name)}">Sửa email</button>
            ${clearButton}
          </div>
        </article>`;
      })
      .join("") || "<article class=\"compact-item department-head-email-item\"><div><strong>Chưa có trưởng phòng</strong><span>Nhập trưởng phòng trong danh mục zone trước khi thiết lập email.</span></div></article>";
  }

  function renderAssessorList() {
    if (!elements.catalogAssessorList) {
      return;
    }

    const catalogType = activeCatalogScope;
    const periodId = getActivePeriodId(catalogType);
    const areas = getAreasForPeriod(periodId);
    elements.catalogAssessorList.innerHTML = getPeriodCatalogAssessors(catalogType, periodId)
      .map((assessor) => {
        const linkedAccounts = state.accounts
          .filter((account) => hasAccountAccessType(account, catalogType) && getAccountPersonId(account, catalogType) === assessor.id);
        const assignedAreaIds = new Set(getAssessorAreaIds(assessor.id, catalogType, periodId));
        const zones = areas
          .filter((area) => assignedAreaIds.has(area.id))
          .map((area) => area.code);
        const accounts = linkedAccounts.map((account) => account.username);

        let zoneSummaryHtml = "";
        const allZonesStr = zones.join(", ");
        if (!zones.length) {
          zoneSummaryHtml = '<span class="catalog-meta-pill text-muted">Chưa gán zone</span>';
        } else if (areas.length > 0 && zones.length === areas.length) {
          zoneSummaryHtml = `<span class="catalog-meta-pill pill-all" title="Toàn bộ ${zones.length} zone: ${escapeHtml(allZonesStr)}">Tất cả zone (${zones.length})</span>`;
        } else if (zones.length > 4) {
          const head = zones.slice(0, 4).join(", ");
          const remain = zones.length - 4;
          zoneSummaryHtml = `<span class="catalog-meta-pill" title="${escapeHtml(allZonesStr)}">${escapeHtml(head)} <span class="pill-more">+${remain} zone</span></span>`;
        } else {
          zoneSummaryHtml = `<span class="catalog-meta-pill">${escapeHtml(allZonesStr)}</span>`;
        }

        const accountHtml = accounts.length
          ? `<span class="catalog-meta-pill pill-user" title="Tài khoản đăng nhập">👤 ${escapeHtml(accounts.join(", "))}</span>`
          : '<span class="catalog-meta-pill text-muted">Chưa có TK</span>';

        return `<article class="compact-item catalog-assessor-item">
          <div class="compact-main">
            <div class="compact-title-row">
              <strong>${escapeHtml(assessor.name)}</strong>
              ${accountHtml}
            </div>
            <div class="compact-meta-row">
              <span class="meta-label">Zone chấm:</span> ${zoneSummaryHtml}
            </div>
          </div>
          <div class="compact-actions">
            <button class="tiny-button" type="button" data-action="edit-assessor" data-id="${escapeHtml(assessor.id)}">Sửa</button>
            <button class="tiny-button danger-text-button" type="button" data-action="delete-assessor" data-id="${escapeHtml(assessor.id)}">Xóa</button>
          </div>
        </article>`;
      })
      .join("") || '<article class="compact-item"><strong>Chưa có assessor</strong><span>Thêm assessor trước khi tạo zone hoặc tài khoản chấm.</span></article>';
  }

  function getAreaAllAssessorNamesForPeriod(periodId, area, catalogType = activeCatalogScope) {
    if (!area) return [];
    const type = normalizeCatalogType(catalogType || getCatalogTypeForPeriod(periodId));
    const periodAssessors = getPeriodCatalogAssessors(type, periodId);
    const assessorMap = new Map(periodAssessors.map((a) => [a.id, a.name]));

    const names = new Set();
    if (area.assessorName) names.add(area.assessorName);
    if (area.assessorId && assessorMap.has(area.assessorId)) {
      names.add(assessorMap.get(area.assessorId));
    }
    if (Array.isArray(area.assessorIds)) {
      area.assessorIds.forEach((aid) => {
        if (assessorMap.has(aid)) names.add(assessorMap.get(aid));
      });
    }
    (state.accounts || []).forEach((acc) => {
      if (hasAccountAccessType(acc, type) && getAccountRoleForType(acc, type) !== ROLE_ZONE_OWNER) {
        const accAreaIds = getAccountAreaIds(acc, type);
        if (accAreaIds.includes(area.id)) {
          const personId = getAccountPersonId(acc, type);
          const name = (personId && assessorMap.get(personId)) || getAccountDisplayName(acc, type, periodId) || acc.name || acc.username;
          if (name) names.add(name);
        }
      }
    });

    return [...names].filter(Boolean);
  }

  function renderAreaList() {
    const catalogType = activeCatalogScope;
    const periodId = getActivePeriodId(catalogType);
    const isSafety = normalizeCatalogType(catalogType) === SAFETY_PERIOD_TYPE;
    elements.areaList.innerHTML = getAreasForPeriod(periodId)
      .map((area) => {
        const assessorNames = getAreaAllAssessorNamesForPeriod(periodId, area, catalogType);
        const configuredName = getAreaConfiguredAssessorNameForPeriod(periodId, area);
        const assessorSummary = assessorNames.length
          ? assessorNames.join(", ")
          : (configuredName || "chưa phân quyền");
        const scorerName = getAreaResponsibleNameForPeriod(periodId, area) || "—";
        const deptHeadName = area.departmentHead || "—";

        const summaryGroupTag = (!isSafety && area.summaryGroup)
          ? `<span class="catalog-meta-pill pill-group" title="Nhóm tổng điểm">🏷️ ${escapeHtml(area.summaryGroup)}</span>`
          : "";

        return `<article class="compact-item catalog-area-item">
          <div class="compact-main">
            <div class="compact-title-row">
              <span class="area-code-badge">Zone ${escapeHtml(area.code)}</span>
              ${summaryGroupTag}
            </div>
            <div class="area-meta-grid">
              <div class="area-meta-chip"><span class="meta-label">Trưởng phòng:</span> <strong>${escapeHtml(deptHeadName)}</strong></div>
              <div class="area-meta-chip"><span class="meta-label">Phụ trách:</span> <strong>${escapeHtml(scorerName)}</strong></div>
              <div class="area-meta-chip area-meta-assessor full-span"><span class="meta-label">Assessor:</span> <span>${escapeHtml(assessorSummary)}</span></div>
            </div>
          </div>
          <div class="compact-actions">
            <button class="tiny-button" type="button" data-action="edit-area" data-id="${escapeHtml(area.id)}">Sửa</button>
            <button class="tiny-button danger-text-button" type="button" data-action="delete-area" data-id="${escapeHtml(area.id)}">Xóa</button>
          </div>
        </article>`;
      })
      .join("");
  }

  function renderSafetyDepartmentGroupCatalogPanel() {
    const panel = elements.safetyDepartmentGroupsPanel;
    const editor = elements.safetyDepartmentGroupsEditor;
    if (!panel || !editor) {
      return;
    }

    const isSafetyScope = activeCatalogScope === SAFETY_PERIOD_TYPE;
    panel.hidden = !isSafetyScope;
    if (!isSafetyScope) {
      editor.innerHTML = "";
      return;
    }

    const periodId = getActivePeriodId(SAFETY_PERIOD_TYPE);
    const snapshot = ensurePeriodSnapshotLocal(periodId);
    editor.innerHTML = safetyDepartmentGroupSettingsHtml(
      snapshot?.safetyDepartmentGroups || state.safetyDepartmentGroups,
      getAreasForPeriod(periodId),
      periodId,
    );
  }

  function renderItemList() {
    const panel = elements.itemList?.closest?.(".catalog-items-panel");
    if (panel) {
      panel.hidden = activeCatalogScope === SAFETY_PERIOD_TYPE;
    }
    if (activeCatalogScope === SAFETY_PERIOD_TYPE) {
      elements.itemList.innerHTML = "";
      return;
    }
    elements.itemList.innerHTML = DEFAULT_ITEMS.map((item) => `<article class="item-card">
      <div>
        <strong>${escapeHtml(item.code)} ${escapeHtml(item.name)}</strong>
        <ul>${item.criteria.map((criterion) => `<li>${escapeHtml(criterion.label)}</li>`).join("")}</ul>
      </div>
      <span class="item-meta">Cố định theo cấu hình hệ thống</span>
    </article>`).join("");
  }

  function getAccountScopeLabel(type = FIVE_S_PERIOD_TYPE) {
    return normalizeCatalogType(type) === SAFETY_PERIOD_TYPE ? "AT" : "5S";
  }

  function getAssessorRoleForScope(type = FIVE_S_PERIOD_TYPE) {
    return normalizeCatalogType(type) === SAFETY_PERIOD_TYPE ? ROLE_ASSESSOR_SAFETY : ROLE_ASSESSOR_5S;
  }

  function accountRoleOptionsHtml(selectedRole = "", type = activeAccountScope, options = {}) {
    const assessorRole = getAssessorRoleForScope(type);
    const normalizedRole = normalizeScopedAccountRole(selectedRole || assessorRole, type);
    const choices = [
      { value: assessorRole, label: "Assessor" },
      { value: ROLE_ZONE_OWNER, label: "Người phụ trách zone" },
    ];
    if (options.includeViewer !== false) {
      choices.push({ value: ROLE_VIEWER, label: "Người xem" });
    }
    return choices.map((option) => `<option value="${escapeHtml(option.value)}" ${normalizeScopedAccountRole(option.value, type) === normalizedRole ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
  }

  function populateAccountRoleOptions(selectedRole = elements.accountRole?.value || "") {
    if (!elements.accountRole) {
      return;
    }
    elements.accountRole.innerHTML = accountRoleOptionsHtml(selectedRole, activeAccountScope, { includeViewer: false });
  }


  function accountZoneCodesForScope(account, type = activeAccountScope) {
    if (isViewerAccount(account)) {
      return ["Toàn bộ bảng biểu"];
    }
    if (isDepartmentHeadAccount(account)) {
      return getAreasForPeriod(getActivePeriodId(type))
        .filter((area) => (normalizeCatalogType(type) !== SAFETY_PERIOD_TYPE || isReportableSafetyArea(area)) && isAreaManagedByDepartmentHead(area, account))
        .map((area) => area.code)
        .filter(Boolean);
    }
    const periodId = getActivePeriodId(type);
    const catalogType = normalizeCatalogType(type);
    return getAreasForPeriod(periodId)
      .filter((area) => (catalogType !== SAFETY_PERIOD_TYPE || isReportableSafetyArea(area)) && getAllowedAreaIds(account, periodId).has(area.id))
      .map((area) => area.code)
      .filter(Boolean);
  }

  function describeAccountForScope(account, type = activeAccountScope) {
    if (isAdminAccount(account)) {
      return `${account.username} · Admin hệ thống · Toàn quyền`;
    }
    if (isViewerAccount(account)) {
      return `${account.username} · Người xem · ${account.name || account.displayName || account.username}${account.position ? ` · ${account.position}` : ""}`;
    }
    if (isDepartmentHeadAccount(account)) {
      const headName = getDepartmentHeadAccountName(account);
      const zones = [FIVE_S_PERIOD_TYPE, SAFETY_PERIOD_TYPE]
        .flatMap((scope) => accountZoneCodesForScope(account, scope))
        .filter(Boolean);
      return `${account.username} · Trưởng phòng · ${headName || account.username} · Zone ${[...new Set(zones)].join(", ") || "chưa có zone"}`;
    }
    const zones = accountZoneCodesForScope(account, type).join(", ") || "chưa có zone";
    return `${account.username} · ${getAccountAccessLabel(account, type)} · ${getAccountDisplayName(account, type) || account.username} · Zone ${zones}`;
  }

  function removeAccountScope(account, type = activeAccountScope) {
    const scope = normalizeCatalogType(type);
    account.accessTypes = normalizeAccountAccessTypes(account.accessTypes, account.role).filter((accessType) => accessType !== scope);
    const rolesByType = { ...(account.rolesByType || {}) };
    delete rolesByType[scope];
    account.rolesByType = rolesByType;
    if (scope === SAFETY_PERIOD_TYPE) {
      delete account.safetyAreaIds;
      delete account.safetyScorerId;
      delete account.safetyAssessorId;
    } else {
      delete account.fiveSAreaIds;
      delete account.fiveSScorerId;
      delete account.fiveSAssessorId;
      account.areaIds = [];
    }
    const remainingScope = account.accessTypes[0] || FIVE_S_PERIOD_TYPE;
    account.role = getAccountRoleForType(account, remainingScope) || account.role;
  }

  function missingAccountAccessTypes(account) {
    if (!account || isAdminAccount(account) || isViewerAccount(account) || isDepartmentHeadAccount(account)) {
      return [];
    }

    const accessTypes = new Set(normalizeAccountAccessTypes(account.accessTypes, account.role));
    return [FIVE_S_PERIOD_TYPE, SAFETY_PERIOD_TYPE].filter((type) => !accessTypes.has(type));
  }

  function existingAccountAccessTypes(account) {
    if (!account) {
      return [];
    }
    if (isAdminAccount(account)) {
      return [FIVE_S_PERIOD_TYPE, SAFETY_PERIOD_TYPE];
    }
    if (isViewerAccount(account)) {
      return [];
    }
    if (isDepartmentHeadAccount(account)) {
      return [FIVE_S_PERIOD_TYPE, SAFETY_PERIOD_TYPE];
    }

    return normalizeAccountAccessTypes(account.accessTypes, account.role)
      .filter((type) => [FIVE_S_PERIOD_TYPE, SAFETY_PERIOD_TYPE].includes(type));
  }

  function accountAccessSummary(account) {
    const accessTypes = existingAccountAccessTypes(account);
    const labels = accessTypes.map((type) => getAccountScopeLabel(type));
    if (isAdminAccount(account)) {
      return "Quyền hiện có: " + labels.join(", ") + " · Admin hệ thống";
    }
    if (isViewerAccount(account)) {
      return "Quyền hiện có: Người xem · toàn bộ bảng biểu";
    }
    if (isDepartmentHeadAccount(account)) {
      return "Quyền hiện có: Trưởng phòng · xem toàn bộ bảng biểu · nhập xử lý theo zone quản lý";
    }

    return "Quyền hiện có: " + (labels.join(", ") || "chưa có") + " · " + accessTypes.length + " quyền";
  }

  function viewerAccountCardHtml(account) {
    return `<article class="account-card">
      <div>
        <strong>${escapeHtml(account.username)}</strong>
        <span>Tên: ${escapeHtml(account.name || account.displayName || account.username)}</span>
        <span>Chức vụ: ${escapeHtml(account.position || "Chưa có")}</span>
        <span>Quyền hiện có: Người xem · toàn bộ bảng biểu</span>
      </div>
      <div class="account-actions">
        <button class="tiny-button" type="button" data-action="edit-account" data-id="${escapeHtml(account.id)}">Sửa</button>
        <button class="tiny-button danger-text-button" type="button" data-action="delete-viewer-account" data-id="${escapeHtml(account.id)}">Xóa</button>
      </div>
    </article>`;
  }

  function departmentHeadAccountSourceRows(source = elements.departmentHeadAccountSource?.value || FIVE_S_PERIOD_TYPE) {
    const scope = normalizeCatalogType(source);
    return getDepartmentHeadRows(getActivePeriodId(scope));
  }

  function populateDepartmentHeadAccountSelect() {
    if (!elements.departmentHeadAccountName) {
      return;
    }
    const rows = departmentHeadAccountSourceRows();
    const current = elements.departmentHeadAccountName.value;
    elements.departmentHeadAccountName.innerHTML = rows
      .map((row) => `<option value="${escapeHtml(row.name)}">${escapeHtml(row.name)} · Zone ${escapeHtml(row.areaCodes.join(", ") || "chưa có")}</option>`)
      .join("") || '<option value="">Chưa có trưởng phòng trong danh mục</option>';
    elements.departmentHeadAccountName.value = rows.some((row) => row.name === current) ? current : rows[0]?.name || "";
  }

  function departmentHeadAccountZoneSummary(account) {
    const fiveSZones = accountZoneCodesForScope(account, FIVE_S_PERIOD_TYPE);
    const safetyZones = accountZoneCodesForScope(account, SAFETY_PERIOD_TYPE);
    const fiveSText = fiveSZones.join(", ") || "chưa có";
    const safetyText = safetyZones.join(", ") || "chưa có";
    return `5S: ${fiveSText} · AT: ${safetyText}`;
  }

  function departmentHeadAccountCardHtml(account) {
    const name = getDepartmentHeadAccountName(account) || account.username;
    return `<article class="account-card">
      <div>
        <strong>${escapeHtml(account.username)}</strong>
        <span>Trưởng phòng: ${escapeHtml(name)}</span>
        <span>Hiển thị: ${escapeHtml(getAccountProfileName(account) || name)}</span>
        <span>Quyền hiện có: Trưởng phòng · xem toàn bộ bảng biểu</span>
        <span>Zone nhập xử lý: ${escapeHtml(departmentHeadAccountZoneSummary(account))}</span>
      </div>
      <div class="account-actions">
        <button class="tiny-button" type="button" data-action="edit-account" data-id="${escapeHtml(account.id)}">Sửa</button>
        <button class="tiny-button danger-text-button" type="button" data-action="delete-department-head-account" data-id="${escapeHtml(account.id)}">Xóa</button>
      </div>
    </article>`;
  }

  function renderAccountsTab() {
    const accountScopeOptions = [
      ...ACCOUNT_SCOPE_OPTIONS,
      { value: ACCOUNT_VIEWER_SCOPE, label: "Người xem", icon: "Xem" },
      { value: ACCOUNT_DEPARTMENT_HEAD_SCOPE, label: "Trưởng phòng", icon: "TP" },
    ];
    renderScopeSwitch(elements.accountScopeSwitch, expandedAccountScope, "set-account-scope", "Cấp tài khoản", null, accountScopeOptions);
    if (expandedAccountScope === ACCOUNT_VIEWER_SCOPE || expandedAccountScope === ACCOUNT_DEPARTMENT_HEAD_SCOPE) {
      if (elements.accountScopeDetail) {
        if (elements.accountScopeSwitch?.contains(elements.accountScopeDetail)) {
          elements.accountScopeSwitch.after(elements.accountScopeDetail);
        }
        elements.accountScopeDetail.hidden = true;
      }
      const detailCard = expandedAccountScope === ACCOUNT_VIEWER_SCOPE ? elements.viewerAccountDetail : elements.departmentHeadAccountDetail;
      const otherDetailCard = expandedAccountScope === ACCOUNT_VIEWER_SCOPE ? elements.departmentHeadAccountDetail : elements.viewerAccountDetail;
      if (otherDetailCard) {
        if (elements.accountScopeSwitch?.contains(otherDetailCard)) {
          elements.accountScopeSwitch.after(otherDetailCard);
        }
        otherDetailCard.hidden = true;
      }
      mountScopeDetail(elements.accountScopeSwitch, detailCard, expandedAccountScope);
    } else {
      if (elements.viewerAccountDetail) {
        if (elements.accountScopeSwitch?.contains(elements.viewerAccountDetail)) {
          elements.accountScopeSwitch.after(elements.viewerAccountDetail);
        }
        elements.viewerAccountDetail.hidden = true;
      }
      if (elements.departmentHeadAccountDetail) {
        if (elements.accountScopeSwitch?.contains(elements.departmentHeadAccountDetail)) {
          elements.accountScopeSwitch.after(elements.departmentHeadAccountDetail);
        }
        elements.departmentHeadAccountDetail.hidden = true;
      }
      mountScopeDetail(elements.accountScopeSwitch, elements.accountScopeDetail, expandedAccountScope);
    }
    populateDepartmentHeadAccountSelect();
    populateAccountRoleOptions();
    populateAssessorSelects();
    populateManagerSelects();
    renderAccountZoneList();
    syncAccountAssignedZones();
    const scopedAccounts = state.accounts.filter((account) => !isViewerAccount(account) && !isDepartmentHeadAccount(account) && (isAdminAccount(account) || hasAccountAccessType(account, activeAccountScope)));
    elements.accountList.innerHTML = scopedAccounts
      .map((account) => {
        const isAdmin = isAdminAccount(account);
        const zones = isAdmin ? "Toàn quyền" : accountZoneCodesForScope(account, activeAccountScope).join(", ") || "chưa có zone";
        const addAccessButtons = missingAccountAccessTypes(account)
          .map((type) => `<button class="tiny-button" type="button" data-action="add-account-access" data-id="${escapeHtml(account.id)}" data-account-scope="${escapeHtml(type)}">Thêm quyền ${escapeHtml(getAccountScopeLabel(type))}</button>`)
          .join("");
        const removeAccessButtons = existingAccountAccessTypes(account)
          .map((type) => `<button class="tiny-button danger-text-button" type="button" data-action="remove-account-access" data-id="${escapeHtml(account.id)}" data-account-scope="${escapeHtml(type)}">Xóa quyền ${escapeHtml(getAccountScopeLabel(type))}</button>`)
          .join("");

        return `<article class="account-card">
          <div>
            <strong>${escapeHtml(account.username)}</strong>
            <span>Hiển thị: ${escapeHtml(getAccountProfileName(account) || account.username)}</span>
            ${account.position ? `<span>Chức vụ: ${escapeHtml(account.position)}</span>` : ""}
            <span>${escapeHtml(getAccountAccessLabel(account, activeAccountScope))} · ${escapeHtml(getAccountDisplayName(account, activeAccountScope) || account.username)} · ${escapeHtml(zones)}</span>
            <span>${escapeHtml(accountAccessSummary(account))}</span>
          </div>
          <div class="account-actions">
            ${
              isAdmin
                ? `<button class="tiny-button" type="button" data-action="edit-account" data-id="${escapeHtml(account.id)}">Sửa</button>`
                : `${addAccessButtons}
                   <button class="tiny-button" type="button" data-action="edit-account" data-id="${escapeHtml(account.id)}">Sửa</button>
                   ${removeAccessButtons}`
            }
          </div>
        </article>`;
      })
      .join("") || `<article class="account-card account-empty-card"><div><strong>Chưa có tài khoản ${escapeHtml(getAccountScopeLabel(activeAccountScope))}</strong><span>Tạo tài khoản assessor hoặc người phụ trách zone cho luồng này.</span></div></article>`;

    if (elements.viewerAccountList) {
      const viewerAccounts = state.accounts.filter(isViewerAccount);
      elements.viewerAccountList.innerHTML = viewerAccounts
        .map(viewerAccountCardHtml)
        .join("") || `<article class="account-card account-empty-card"><div><strong>Chưa có tài khoản người xem</strong><span>Tạo tài khoản người xem để theo dõi toàn bộ bảng biểu.</span></div></article>`;
    }
    if (elements.departmentHeadAccountList) {
      const departmentHeadAccounts = state.accounts.filter(isDepartmentHeadAccount);
      elements.departmentHeadAccountList.innerHTML = departmentHeadAccounts
        .map(departmentHeadAccountCardHtml)
        .join("") || `<article class="account-card account-empty-card"><div><strong>Chưa có tài khoản trưởng phòng</strong><span>Tạo tài khoản trưởng phòng để nhập phần cải tiến/xử lý theo zone quản lý.</span></div></article>`;
    }
  }

  let isLoggingIn = false;

  async function handleLogin(event) {
    event.preventDefault();
    if (isLoggingIn) {
      return;
    }

    const username = elements.loginUsername.value.trim();
    const rawPassword = elements.loginPassword.value;
    const cleanPassword = rawPassword.trim();

    if (!username || !cleanPassword) {
      showToast("Vui lòng nhập tài khoản và mật khẩu.", true);
      return;
    }

    isLoggingIn = true;
    const submitBtn = elements.loginForm?.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Đang kiểm tra...";
    }

    try {
      // Try with cleanPassword first, fallback handled by server
      const payload = await dataStore.login(username, cleanPassword);
      const account = applyAuthenticatedPayload(payload);
      startSessionHeartbeat();

      const routeTarget = getRouteTarget();
      const requestedTab = pendingRouteTab || (routeTarget.type === "tab" ? routeTarget.tab : "");
      const requestedSafetyReport = pendingRouteTab ? pendingSafetyReport : (routeTarget.type === "tab" ? routeTarget.safetyReport || "" : "");
      activeTab = requestedTab && isTabAllowed(requestedTab) ? requestedTab : getFallbackTab();
      activeSafetyReport = activeTab === "safety" ? normalizeSafetyReportId(requestedSafetyReport) : "";
      pendingRouteTab = null;
      pendingSafetyReport = "";
      saveSession(account);
      showAppScreen();
      elements.loginForm.reset();

      const capsWarning = document.getElementById("login-caps-warning");
      if (capsWarning) capsWarning.hidden = true;

      startDataWatch();
      renderAll({ replaceRoute: true });
    } catch (error) {
      console.error(error);
      if (error?.status === 401) {
        showToast("Sai tài khoản hoặc mật khẩu.", true);
      } else {
        showToast(error?.message || "Không đăng nhập được.", true);
      }
      return;
    } finally {
      isLoggingIn = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    }
  }

  async function handleLogout() {
    try {
      await releaseCurrentSession();
    } catch (error) {
      console.warn("Không giải phóng được phiên đăng nhập.", error);
    }
    clearSession();
    undoStack.length = 0;
    redoStack.length = 0;
    updateUndoRedoButtons();
    pendingRouteTab = null;
    pendingSafetyReport = "";
    showLoginScreen();
  }

  function openScoreModal(button) {
    const periodId = button.dataset.periodId;
    const area = getAreaForPeriod(periodId, button.dataset.areaId);
    const item = getItem(button.dataset.itemId);
    const criterion = getCriterion(item, button.dataset.criterionId);
    const scoreSource = normalizeScoreSource(button.dataset.scoreSource);

    if (blockIfArchivedPeriod(periodId)) {
      return;
    }

    if (!canEditFiveSScoreSource(currentUser, scoreSource)) {
      showToast("Bạn không có quyền sửa bảng điểm này.", true);
      return;
    }

    if (!area || !item || !criterion || !getAllowedAreaIds(currentUser, periodId).has(area.id) || isNotApplicable(item.id, criterion.id, area)) {
      showToast("Bạn không có quyền sửa ô này.", true);
      return;
    }

    const isAdmin = currentUser?.role === "admin";
    const record = getScoreRecord(periodId, area.id, item.id, criterion.id, scoreSource);
    const hasRecord = Boolean(record);
    const selectedScore = isScoreCrossed(record) ? SCORE_CROSSED : Number.isFinite(record?.score) ? String(record.score) : "";
    const options = [
      { value: "", label: "Chưa chấm" },
      { value: SCORE_CROSSED, label: "Gạch chéo" },
      { value: "1", label: "1" },
      { value: "2", label: "2" },
      { value: "3", label: "3" },
      { value: "4", label: "4" },
      { value: "5", label: "5" },
    ]
      .map((score) => `<option value="${score.value}" ${score.value === selectedScore ? "selected" : ""}>${score.label}</option>`)
      .join("");

    const deleteBtn = isAdmin && hasRecord
      ? `<button class="danger-button" type="button" id="modal-delete-score-btn">Xóa điểm này</button>`
      : "";

    openFormModal({
      title: "Sửa điểm",
      submitText: "Lưu điểm",
      extraActions: deleteBtn,
      html: `
        <div class="modal-context">
          <span><strong>Zone:</strong> ${escapeHtml(area.code)} · ${escapeHtml(getAreaResponsibleNameForPeriod(periodId, area))}</span>
          <span><strong>Hạng mục:</strong> ${escapeHtml(item.code)} ${escapeHtml(item.name)}</span>
          <span><strong>Point:</strong> ${escapeHtml(criterion.label)}</span>
        </div>
        ${scoreGuideHtml(item, criterion)}
        <label>
          <span>Điểm</span>
          <select name="score">${options}</select>
        </label>
      `,
      async onSubmit(formData) {
        if (blockIfArchivedPeriod(periodId)) {
          return false;
        }

        if (!canEditFiveSScoreSource(currentUser, scoreSource)) {
          showToast("Bạn không có quyền sửa bảng điểm này.", true);
          return false;
        }

        const rawScore = formData.get("score");
        const isCrossed = rawScore === SCORE_CROSSED;
        const nextScore = rawScore === "" || isCrossed ? null : Number(rawScore);
        if (nextScore !== null && (!Number.isInteger(nextScore) || nextScore < 1 || nextScore > 5)) {
          showToast("Điểm phải từ 1 đến 5.", true);
          return false;
        }

        applyScorePreview({
          periodId,
          areaId: area.id,
          itemId: item.id,
          criterionId: criterion.id,
          rawScore,
          scoreSource,
        });
        await setScore({
          periodId,
          area,
          item,
          criterion,
          score: nextScore,
          status: isCrossed ? SCORE_CROSSED : "",
          scoreSource,
        });
        showToast("Đã lưu điểm.");
        renderAll();
        return true;
      },
    });

    const scoreSelect = elements.modalBody.querySelector('select[name="score"]');
    scoreSelect?.addEventListener("change", () => {
      applyScorePreview({
        periodId,
        areaId: area.id,
        itemId: item.id,
        criterionId: criterion.id,
        rawScore: scoreSelect.value,
        scoreSource,
      });
    });

    // Wire up the admin delete button after modal is rendered
    if (isAdmin && hasRecord) {
      setTimeout(() => {
        const deleteScoreBtn = document.getElementById("modal-delete-score-btn");
        if (deleteScoreBtn) {
          deleteScoreBtn.addEventListener("click", () => {
            closeModal();
            openConfirmModal({
              title: "Xóa điểm",
              message: `Xóa điểm của Zone ${area.code} – ${item.code} (${criterion.label})?`,
              confirmText: "Xóa điểm",
              danger: true,
              onConfirm() {
                deleteScore({ periodId, area, item, criterion, record })
                  .then(() => {
                    showToast("Đã xóa điểm.");
                    renderAll();
                  })
                  .catch(() => showToast("Lỗi khi xóa điểm.", true));
              },
            });
          });
        }
      }, 0);
    }
  }

  async function handleAssessorScoreSelectChange(select) {
    const periodId = select.dataset.periodId || "";
    const area = getAreaForPeriod(periodId, select.dataset.areaId || "");
    const item = getItem(select.dataset.itemId || "");
    const criterion = getCriterion(item, select.dataset.criterionId || "");
    const scoreSource = normalizeScoreSource(select.dataset.scoreSource || "");
    const rawScore = select.value;
    if (select.dataset.savingValue === rawScore || select.dataset.savedValue === rawScore) {
      return;
    }

    const focusContext = getAssessorScoreSelectContext(select);
    const isCrossed = rawScore === SCORE_CROSSED;
    const nextScore = rawScore === "" || isCrossed ? null : Number(rawScore);

    if (!periodId || !isPeriodOpen(periodId, FIVE_S_PERIOD_TYPE)) {
      showToast("Không có kỳ đánh giá 5S đang mở nên không thể nhập dữ liệu.", true);
      renderActiveTab();
      return;
    }
    if (!area || !item || !criterion) {
      showToast("Không tìm thấy ô chấm điểm.", true);
      renderActiveTab();
      return;
    }
    if (nextScore !== null && (!Number.isInteger(nextScore) || nextScore < 1 || nextScore > 5)) {
      showToast("Điểm phải từ 1 đến 5.", true);
      renderActiveTab();
      return;
    }

    syncAssessorScoreSelectPreview({
      periodId,
      areaId: area.id,
      itemId: item.id,
      criterionId: criterion.id,
      rawScore,
      scoreSource,
    });
    document.querySelectorAll(assessorScoreSelectSelector({
      periodId,
      areaId: area.id,
      itemId: item.id,
      criterionId: criterion.id,
      scoreSource,
    })).forEach((matchingSelect) => {
      matchingSelect.dataset.savingValue = rawScore;
    });
    select.disabled = true;
    try {
      await setScore({
        periodId,
        area,
        item,
        criterion,
        score: nextScore,
        status: isCrossed ? SCORE_CROSSED : "",
        scoreSource,
      });
      document.querySelectorAll(assessorScoreSelectSelector({
        periodId,
        areaId: area.id,
        itemId: item.id,
        criterionId: criterion.id,
        scoreSource,
      })).forEach((matchingSelect) => {
        matchingSelect.dataset.savedValue = rawScore;
      });
      refreshAveragePreview({
        periodId,
        areaId: area.id,
        itemId: item.id,
        scoreSource,
      });
      scheduleAssessorScoreFocusRestore(focusContext);
      showToast("Đã lưu điểm.");
    } catch (error) {
      console.error(error);
      showToast(error?.message || "Lỗi khi lưu điểm.", true);
      renderActiveTab();
    } finally {
      document.querySelectorAll(assessorScoreSelectSelector({
        periodId,
        areaId: area.id,
        itemId: item.id,
        criterionId: criterion.id,
        scoreSource,
      })).forEach((matchingSelect) => {
        matchingSelect.disabled = false;
        delete matchingSelect.dataset.savingValue;
      });
    }
  }

  function assessorScoreSelectSelector({ periodId, areaId, itemId, criterionId, scoreSource }) {
    const normalizedSource = normalizeScoreSource(scoreSource);
    return `[data-assessor-score-select="true"][data-period-id="${cssSelectorValue(periodId)}"][data-area-id="${cssSelectorValue(areaId)}"][data-item-id="${cssSelectorValue(itemId)}"][data-criterion-id="${cssSelectorValue(criterionId)}"][data-score-source="${cssSelectorValue(normalizedSource)}"]`;
  }

  function syncAssessorScoreSelectPreview({ periodId, areaId, itemId, criterionId, rawScore, scoreSource }) {
    const selector = assessorScoreSelectSelector({ periodId, areaId, itemId, criterionId, scoreSource });
    const isCrossed = rawScore === SCORE_CROSSED;
    const nextScore = rawScore === "" || isCrossed ? null : Number(rawScore);
    const isLow = Number.isFinite(nextScore) && nextScore <= 2;

    document.querySelectorAll(selector).forEach((matchingSelect) => {
      matchingSelect.value = rawScore;
      const scoreCell = matchingSelect.closest(".standard-reference-score-input-cell");
      scoreCell?.classList.toggle("score-low", isLow);
      scoreCell?.classList.toggle("score-na", isCrossed);

      const row = matchingSelect.closest("tr");
      row?.querySelectorAll(".standard-reference-level-cell").forEach((levelCell, index) => {
        levelCell.classList.toggle("is-selected-score", rawScore === String(index + 1));
      });
    });
  }

  function getAssessorScoreSelectContext(select) {
    if (!select?.matches?.("[data-assessor-score-select]")) {
      return null;
    }
    return {
      periodId: select.dataset.periodId || "",
      areaId: select.dataset.areaId || "",
      itemId: select.dataset.itemId || "",
      criterionId: select.dataset.criterionId || "",
      scoreSource: normalizeScoreSource(select.dataset.scoreSource || ""),
      inModal: Boolean(select.closest("#modal-backdrop") && !elements.modalBackdrop?.hidden),
    };
  }

  function findAssessorScoreSelectByContext(context) {
    if (!context) {
      return null;
    }
    const selector = assessorScoreSelectSelector(context);
    const candidates = Array.from(document.querySelectorAll(selector));
    if (!candidates.length) {
      return null;
    }
    const modalOpen = Boolean(elements.modalBackdrop && !elements.modalBackdrop.hidden);
    if (context.inModal && modalOpen) {
      return candidates.find((select) => select.closest("#modal-backdrop") === elements.modalBackdrop) || candidates[0];
    }
    return candidates.find((select) => !select.closest("#modal-backdrop")) || candidates[0];
  }

  function focusAssessorScoreSelect(select) {
    if (!select?.matches?.("[data-assessor-score-select]")) {
      return false;
    }
    select.focus({ preventScroll: true });
    return true;
  }

  function scheduleAssessorScoreFocusRestore(context) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const currentSelect = findAssessorScoreSelectByContext(context);
        if (!currentSelect) {
          return;
        }
        focusAssessorScoreSelect(currentSelect);
      });
    });
  }

  function getInlineScoreContext(input) {
    const periodId = input?.dataset.periodId || "";
    const area = getAreaForPeriod(periodId, input?.dataset.areaId || "");
    const item = getItem(input?.dataset.itemId || "");
    const criterion = getCriterion(item, input?.dataset.criterionId || "");
    const scoreSource = normalizeScoreSource(input?.dataset.scoreSource || "");
    return { periodId, area, item, criterion, scoreSource };
  }

  function cleanInlineScoreInputValue(input, nextValue = input?.value || "") {
    const raw = String(nextValue || "").trim().toLowerCase();
    const clean = raw === "0" || raw === "x" ? SCORE_CROSSED : /^[1-5]$/.test(raw) ? raw : "";
    const displayValue = clean === SCORE_CROSSED ? "" : clean;
    if (input && input.value !== displayValue) {
      input.value = displayValue;
    }
    return clean;
  }

  function rememberActiveInlineScoreInput(input) {
    if (!input?.matches?.("[data-inline-score-input]")) {
      return;
    }

    activeInlineScoreCell = {
      periodId: input.dataset.periodId || "",
      areaId: input.dataset.areaId || "",
      itemId: input.dataset.itemId || "",
      criterionId: input.dataset.criterionId || "",
      scoreSource: normalizeScoreSource(input.dataset.scoreSource || ""),
      scoreRowIndex: input.dataset.scoreRowIndex || "",
      scoreColIndex: input.dataset.scoreColIndex || "",
      inModal: Boolean(input.closest("#modal-backdrop") && !elements.modalBackdrop?.hidden),
      expiresAt: Date.now() + 8000,
    };
  }

  function findInlineScoreInputByMemory(memory = activeInlineScoreCell) {
    if (!memory || Date.now() > memory.expiresAt) {
      return null;
    }

    const selector = `[data-inline-score-input="true"][data-period-id="${cssSelectorValue(memory.periodId)}"][data-area-id="${cssSelectorValue(memory.areaId)}"][data-item-id="${cssSelectorValue(memory.itemId)}"][data-criterion-id="${cssSelectorValue(memory.criterionId)}"][data-score-source="${cssSelectorValue(memory.scoreSource)}"]`;
    const fallbackSelector = `[data-inline-score-input="true"][data-score-row-index="${cssSelectorValue(memory.scoreRowIndex)}"][data-score-col-index="${cssSelectorValue(memory.scoreColIndex)}"][data-score-source="${cssSelectorValue(memory.scoreSource)}"]`;
    const candidates = [...document.querySelectorAll(selector), ...document.querySelectorAll(fallbackSelector)];
    if (!candidates.length) {
      return null;
    }

    const modalOpen = Boolean(elements.modalBackdrop && !elements.modalBackdrop.hidden);
    if (memory.inModal && modalOpen) {
      return candidates.find((input) => input.closest("#modal-backdrop") === elements.modalBackdrop) || candidates[0];
    }
    return candidates.find((input) => !input.closest("#modal-backdrop")) || candidates[0];
  }

  function scheduleInlineScoreFocusRestore() {
    if (!activeInlineScoreCell || Date.now() > activeInlineScoreCell.expiresAt) {
      return;
    }

    if (activeInlineScoreRestoreRaf) {
      cancelAnimationFrame(activeInlineScoreRestoreRaf);
    }

    activeInlineScoreRestoreRaf = requestAnimationFrame(() => {
      activeInlineScoreRestoreRaf = null;
      const input = findInlineScoreInputByMemory();
      if (input) {
        focusInlineScoreInput(input);
      }
    });
  }

  function captureScoreScrollState() {
    const scrollItems = [];
    const addScrollItem = (element, selector = "") => {
      if (!element || scrollItems.some((item) => item.element === element)) {
        return;
      }
      scrollItems.push({
        element,
        selector,
        left: element === document.scrollingElement ? window.scrollX : element.scrollLeft,
        top: element === document.scrollingElement ? window.scrollY : element.scrollTop,
      });
    };

    addScrollItem(document.scrollingElement || document.documentElement);
    document.querySelectorAll(
      "#tab-assessor .assessor-4m-wrap, #tab-summary .summary-matrix-wrap, #tab-summary .wide-table-wrap, #tab-summary .table-wrap",
    ).forEach((element) => {
      const selector = element.classList.contains("assessor-4m-wrap")
        ? "#tab-assessor .assessor-4m-wrap"
        : element.classList.contains("summary-matrix-wrap")
          ? "#tab-summary .summary-matrix-wrap"
          : element.classList.contains("wide-table-wrap")
            ? "#tab-summary .wide-table-wrap"
            : "#tab-summary .table-wrap";
      addScrollItem(element, selector);
    });

    const focusedScoreControl = document.activeElement?.closest?.("[data-inline-score-input],[data-assessor-score-select]");
    let cursor = focusedScoreControl;
    while (cursor && cursor !== document.body) {
      if (cursor.scrollWidth > cursor.clientWidth + 1 || cursor.scrollHeight > cursor.clientHeight + 1) {
        addScrollItem(cursor);
      }
      cursor = cursor.parentElement;
    }
    return scrollItems;
  }

  function restoreScoreScrollState(scrollItems = []) {
    scrollItems.forEach(({ element, selector, left, top }) => {
      const target = element && (element === document.scrollingElement || element.isConnected)
        ? element
        : selector
          ? document.querySelector(selector)
          : null;
      if (!target) {
        return;
      }
      if (target === document.scrollingElement) {
        window.scrollTo(left, top);
      } else {
        target.scrollLeft = left;
        target.scrollTop = top;
      }
    });
  }

  function scheduleScoreUiRefresh() {
    if (!currentUser) {
      return;
    }

    if (pendingScoreUiRefreshRaf) {
      cancelAnimationFrame(pendingScoreUiRefreshRaf);
    }

    if (activeTab === "assessor") {
      pendingScoreUiRefreshRaf = requestAnimationFrame(() => {
        pendingScoreUiRefreshRaf = null;
        scheduleInlineScoreFocusRestore();
      });
      return;
    }

    const scrollState = captureScoreScrollState();
    pendingScoreUiRefreshRaf = requestAnimationFrame(() => {
      pendingScoreUiRefreshRaf = null;
      renderAll({ updateRoute: false, preserveScroll: true });
      restoreScoreScrollState(scrollState);
      scheduleInlineScoreFocusRestore();
      requestAnimationFrame(() => {
        restoreScoreScrollState(scrollState);
        scheduleInlineScoreFocusRestore();
      });
    });
  }

  async function commitInlineScoreInput(input, rawScoreOverride = undefined) {
    if (!input?.matches?.("[data-inline-score-input]")) {
      return false;
    }

    rememberActiveInlineScoreInput(input);
    const rawScore = rawScoreOverride === undefined ? cleanInlineScoreInputValue(input) : rawScoreOverride;
    const { periodId, area, item, criterion, scoreSource } = getInlineScoreContext(input);
    if (!periodId || !area || !item || !criterion) {
      showToast("Không tìm thấy ô chấm điểm.", true);
      return false;
    }

    input.dataset.saving = "true";
    try {
      await setScore({
        periodId,
        area,
        item,
        criterion,
        score: rawScore === "" || rawScore === SCORE_CROSSED ? null : Number(rawScore),
        status: rawScore === SCORE_CROSSED ? SCORE_CROSSED : "",
        scoreSource,
      });
      applyInlineScorePreview({
        periodId,
        areaId: area.id,
        itemId: item.id,
        criterionId: criterion.id,
        rawScore,
        scoreSource,
      });
      refreshAveragePreview({
        periodId,
        areaId: area.id,
        itemId: item.id,
        scoreSource,
      });
      input.dataset.savedValue = rawScore;
      if (document.activeElement === input) {
        focusInlineScoreInput(input);
      }
      return true;
    } catch (error) {
      console.error(error);
      showToast(error?.message || "Lỗi khi lưu điểm.", true);
      return false;
    } finally {
      delete input.dataset.saving;
    }
  }

  function focusInlineScoreByOffset(input, offset) {
    const { area, scoreSource } = getInlineScoreContext(input);
    if (!area) {
      return;
    }

    const table = input.closest("table");
    const inputs = Array.from(table?.querySelectorAll(`[data-inline-score-input][data-area-id="${cssSelectorValue(area.id)}"][data-score-source="${cssSelectorValue(scoreSource)}"]`) || []);
    const currentIndex = inputs.indexOf(input);
    const nextInput = inputs[currentIndex + offset];
    if (nextInput) {
      focusInlineScoreInput(nextInput);
    }
  }

  function focusInlineScoreInput(input) {
    if (!input?.matches?.("[data-inline-score-input]")) {
      return false;
    }

    rememberActiveInlineScoreInput(input);
    input.focus({ preventScroll: true });
    input.setSelectionRange?.(0, input.value.length);
    scrollInlineScoreInputIntoView(input);
    requestAnimationFrame(() => {
      if (!input.isConnected) {
        scheduleInlineScoreFocusRestore();
        return;
      }
      if (document.activeElement !== input) {
        input.focus({ preventScroll: true });
      }
      input.setSelectionRange?.(0, input.value.length);
      scrollInlineScoreInputIntoView(input);
    });
    return true;
  }

  function isScrollableElement(element) {
    if (!element || element === document.body || element === document.documentElement) {
      return false;
    }
    const style = window.getComputedStyle(element);
    const canScrollX = element.scrollWidth > element.clientWidth + 1 && /(auto|scroll|overlay)/.test(style.overflowX);
    const canScrollY = element.scrollHeight > element.clientHeight + 1 && /(auto|scroll|overlay)/.test(style.overflowY);
    return canScrollX || canScrollY;
  }

  function scrollElementIntoViewWithinContainer(target, container, padding = 28) {
    if (!target || !container) {
      return;
    }

    const targetRect = target.getBoundingClientRect();
    const isDocument = container === document.scrollingElement || container === document.documentElement || container === document.body;
    const containerRect = isDocument
      ? { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight }
      : container.getBoundingClientRect();
    const topPadding = isDocument && !target.closest("#modal-backdrop") ? 96 : padding;
    const bottomPadding = padding;
    let deltaX = 0;
    let deltaY = 0;

    if (targetRect.left < containerRect.left + padding) {
      deltaX = targetRect.left - containerRect.left - padding;
    } else if (targetRect.right > containerRect.right - padding) {
      deltaX = targetRect.right - containerRect.right + padding;
    }

    if (targetRect.top < containerRect.top + topPadding) {
      deltaY = targetRect.top - containerRect.top - topPadding;
    } else if (targetRect.bottom > containerRect.bottom - bottomPadding) {
      deltaY = targetRect.bottom - containerRect.bottom + bottomPadding;
    }

    if (!deltaX && !deltaY) {
      return;
    }

    if (isDocument) {
      window.scrollBy({ left: deltaX, top: deltaY, behavior: "auto" });
      return;
    }

    container.scrollLeft += deltaX;
    container.scrollTop += deltaY;
  }

  function scrollInlineScoreInputIntoView(input) {
    if (!input?.matches?.("[data-inline-score-input]")) {
      return;
    }

    const target = input.closest(".score-cell") || input.closest("td") || input;
    const containers = [];
    let cursor = target.parentElement;
    while (cursor && cursor !== document.body) {
      if (isScrollableElement(cursor) && !containers.includes(cursor)) {
        containers.push(cursor);
      }
      cursor = cursor.parentElement;
    }

    const documentScroller = document.scrollingElement || document.documentElement;
    if (documentScroller && !containers.includes(documentScroller)) {
      containers.push(documentScroller);
    }

    containers.forEach((container) => scrollElementIntoViewWithinContainer(target, container));
  }

  function focusInlineScoreByGridOffset(input, rowOffset = 0, colOffset = 0) {
    const table = input?.closest?.("table");
    if (!table) {
      return;
    }

    const currentRow = Number(input.dataset.scoreRowIndex);
    const currentCol = Number(input.dataset.scoreColIndex);
    if (!Number.isInteger(currentRow) || !Number.isInteger(currentCol)) {
      return;
    }

    const maxSteps = table.querySelectorAll("[data-inline-score-input]").length;
    let targetRow = currentRow + rowOffset;
    let targetCol = currentCol + colOffset;
    for (let step = 0; step < maxSteps; step += 1) {
      if (targetRow < 0 || targetCol < 0) {
        return;
      }

      const targetInput = table.querySelector(`[data-inline-score-input][data-score-row-index="${targetRow}"][data-score-col-index="${targetCol}"]`);
      if (targetInput) {
        focusInlineScoreInput(targetInput);
        return;
      }

      targetRow += rowOffset;
      targetCol += colOffset;
    }
  }

  function getInlineScoreInputFromEvent(event) {
    const targetInput = event.target?.closest?.("[data-inline-score-input]");
    if (targetInput) {
      return targetInput;
    }

    const activeInput = document.activeElement?.closest?.("[data-inline-score-input]");
    return activeInput || null;
  }

  function stopInlineScoreKey(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  function handleInlineScoreKeydown(event) {
    const input = getInlineScoreInputFromEvent(event);
    if (!input) {
      return;
    }

    if (event.key === " ") {
      stopInlineScoreKey(event);
      return;
    }

    if (/^[0-5]$/.test(event.key)) {
      stopInlineScoreKey(event);
      rememberActiveInlineScoreInput(input);
      const rawScore = cleanInlineScoreInputValue(input, event.key);
      focusInlineScoreInput(input);
      const { periodId, area, item, criterion, scoreSource } = getInlineScoreContext(input);
      if (area && item && criterion) {
        applyInlineScorePreview({
          periodId,
          areaId: area.id,
          itemId: item.id,
          criterionId: criterion.id,
          rawScore,
          scoreSource,
        });
      }
      commitInlineScoreInput(input, rawScore);
      return;
    }

    if (event.key === "Backspace" || event.key === "Delete") {
      stopInlineScoreKey(event);
      rememberActiveInlineScoreInput(input);
      const rawScore = cleanInlineScoreInputValue(input, "");
      focusInlineScoreInput(input);
      commitInlineScoreInput(input, rawScore);
      return;
    }

    if (event.key === "Enter") {
      stopInlineScoreKey(event);
      commitInlineScoreInput(input).finally(() => {
        focusInlineScoreByOffset(input, event.shiftKey ? -1 : 1);
      });
      return;
    }

    if (event.key === "ArrowUp") {
      stopInlineScoreKey(event);
      focusInlineScoreByGridOffset(input, -1, 0);
      return;
    }

    if (event.key === "ArrowDown") {
      stopInlineScoreKey(event);
      focusInlineScoreByGridOffset(input, 1, 0);
      return;
    }

    if (event.key === "ArrowLeft") {
      stopInlineScoreKey(event);
      focusInlineScoreByGridOffset(input, 0, -1);
      return;
    }

    if (event.key === "ArrowRight") {
      stopInlineScoreKey(event);
      focusInlineScoreByGridOffset(input, 0, 1);
      return;
    }

    const allowedKeys = new Set(["Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Escape"]);
    if (!allowedKeys.has(event.key) && !event.ctrlKey && !event.metaKey) {
      stopInlineScoreKey(event);
    }
  }

  function handleInlineScorePaste(event) {
    const input = event.target?.closest?.("[data-inline-score-input]");
    if (!input) {
      return;
    }
    event.preventDefault();
    const pasted = event.clipboardData?.getData("text") || "";
    const value = (pasted.match(/[0-5xX]/) || [""])[0];
    const rawScore = cleanInlineScoreInputValue(input, value);
    commitInlineScoreInput(input, rawScore);
  }

  function handleInlineScoreDragDrop(event) {
    const input = event.target?.closest?.("[data-inline-score-input]");
    if (!input) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  function handleInlineScoreBeforeInput(event) {
    const input = event.target?.closest?.("[data-inline-score-input]");
    if (!input) {
      return;
    }

    if (event.inputType === "insertFromDrop") {
      handleInlineScoreDragDrop(event);
    }
  }

  async function deleteScore({ periodId, area, item, criterion, record }) {
    if (!record) return;
    if (!requireAdminAction("Chỉ admin được xóa điểm.")) {
      return;
    }
    if (isPeriodArchived(periodId)) {
      throw new Error("Archived period is read-only");
    }

    const recordCopy = cloneValue(record);
    const beforeLabel = formatScoreRecord(record);

    // Remove from local state
    state.scores = state.scores.filter((s) => s.id !== record.id);
    invalidateScoreRecordIndex();

    // Remove from local storage
    await deleteScoreFromDb(record.id);
    await deleteUnusedPhotoFiles(collectPhotoUrls([recordCopy]));

    pushUndoAction({
      type: "score",
      description: `Xóa điểm Zone ${area.code} · ${item.code} (${criterion.label}): ${beforeLabel}`,
      periodId,
      areaId: area.id,
      itemId: item.id,
      criterionId: criterion.id,
      scoreSource: normalizeScoreSource(record.scoreSource),
      areaCode: area.code,
      itemCode: item.code,
      criterionLabel: criterion.label,
      before: recordCopy,
      after: null,
      beforeLabel,
      afterLabel: "Đã xóa",
    });

    // Log history
    const historyEntry = {
      id: makeId("history"),
      timestamp: new Date().toISOString(),
      periodId,
      periodLabel: periodLabel(getPeriod(periodId)),
      userName: getAccountDisplayName(currentUser, FIVE_S_PERIOD_TYPE, periodId),
      username: currentUser?.username || "",
      areaId: area.id,
      areaCode: area.code,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      criterionId: criterion.id,
      criterionLabel: criterion.label,
      beforeLabel: formatScoreRecord(record),
      afterLabel: "Đã xóa",
      note: "Admin xóa điểm",
      scoreSource: normalizeScoreSource(record.scoreSource),
      scope: FIVE_S_PERIOD_TYPE,
    };
    state.history.unshift(historyEntry);
    await saveHistoryEntry(historyEntry);
  }

  async function setScore({ periodId, area, item, criterion, score, status, scoreSource = SCORE_SOURCE_ASSESSOR, note = undefined, photoDataUrl = undefined, photoName = undefined }) {
    const normalizedSource = normalizeScoreSource(scoreSource);
    if (!periodId || !isPeriodOpen(periodId, FIVE_S_PERIOD_TYPE)) {
      showToast("Không có kỳ đánh giá 5S đang mở nên không thể nhập dữ liệu.", true);
      return;
    }
    if (!canEditFiveSScoreSource(currentUser, normalizedSource) || !getAllowedAreaIds(currentUser, periodId).has(area.id)) {
      showToast("Bạn không có quyền sửa ô này.", true);
      return;
    }

    const existingIndex = state.scores.findIndex(
      (record) =>
        record.periodId === periodId &&
        record.areaId === area.id &&
        record.itemId === item.id &&
        record.criterionId === criterion.id &&
        normalizeScoreSource(record.scoreSource) === normalizedSource,
    );
    const existing = existingIndex >= 0 ? state.scores[existingIndex] : null;
    const existingCopy = cloneValue(existing);
    const beforeLabel = formatScoreRecord(existing);
    const afterLabel = status === SCORE_CROSSED ? "Gạch chéo" : Number.isFinite(score) ? String(score) : "";
    const noteChanged = note !== undefined && note !== (existing?.note || "");
    const photoChanged = photoDataUrl !== undefined && photoDataUrl !== (existing?.photoDataUrl || "");
    const changed = beforeLabel !== afterLabel || noteChanged || photoChanged;

    if (!changed) {
      return;
    }

    let savedPayload = null;
    const historyEntry = {
      id: makeId("history"),
      timestamp: new Date().toISOString(),
      periodId,
      periodLabel: periodLabel(getPeriod(periodId)),
      userName: getAccountDisplayName(currentUser, FIVE_S_PERIOD_TYPE, periodId),
      username: currentUser?.username || "",
      areaId: area.id,
      areaCode: area.code,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      criterionId: criterion.id,
      criterionLabel: criterion.label,
      scoreSource: normalizedSource,
      beforeLabel,
      afterLabel,
      note: note !== undefined ? note : (existing?.note || ""),
      scope: FIVE_S_PERIOD_TYPE,
    };
    state.history.unshift(historyEntry);

    const dbWrites = [saveHistoryEntry(historyEntry)];
    if (score === null && !status) {
      if (existingIndex >= 0) {
        const removedId = state.scores[existingIndex].id;
        state.scores.splice(existingIndex, 1);
        invalidateScoreRecordIndex();
        dbWrites.push(deleteScoreFromDb(removedId));
      }
    } else {
      const payload = {
        id: existing?.id || makeId("score"),
        periodId,
        areaId: area.id,
        itemId: item.id,
        criterionId: criterion.id,
        scoreSource: normalizedSource,
        score,
        status,
        note: note !== undefined ? note : (existing?.note || ""),
        photoDataUrl: photoDataUrl !== undefined ? photoDataUrl : (existing?.photoDataUrl || ""),
        photoName: photoName !== undefined ? photoName : (existing?.photoName || ""),
        issueType: existing?.issueType || "",
        issueLevel: existing?.issueLevel || "",
        issueStatus: existing?.issueStatus || "",
        issueLocation: existing?.issueLocation || "",
        issueDay: existing?.issueDay || "",
        issueMonth: existing?.issueMonth || "",
        issueCount: normalizeIssueCount(existing?.issueCount),
        issueFoundBy: existing?.issueFoundBy || "",
        employeeCode: existing?.employeeCode || "",
        issueItemLabel: existing?.issueItemLabel || "",
        foundChannel: normalizeFoundChannel(existing?.foundChannel || ""),
        improvementContent: existing?.improvementContent || "",
        afterPhotoDataUrl: existing?.afterPhotoDataUrl || "",
        afterPhotoName: existing?.afterPhotoName || "",
        actionOwner: existing?.actionOwner || "",
        actionPlan: existing?.actionPlan || "",
        completionDate: existing?.completionDate || "",
        completionLevelConfirm: existing?.completionLevelConfirm || "",
        completionStop6Confirm: existing?.completionStop6Confirm || "",
        scorerName: getAccountDisplayName(currentUser, FIVE_S_PERIOD_TYPE, periodId),
        accountUsername: currentUser?.username || "",
        updatedAt: new Date().toISOString(),
      };

      savedPayload = cloneValue(payload);
      if (existingIndex >= 0) {
        state.scores[existingIndex] = payload;
      } else {
        state.scores.push(payload);
      }
      invalidateScoreRecordIndex();
      dbWrites.push(saveScore(payload));
    }

    pushUndoAction({
      type: "score",
      description: `Điểm Zone ${area.code} · ${item.code} (${criterion.label}): ${beforeLabel || "Chưa chấm"} → ${afterLabel || "Chưa chấm"}`,
      periodId,
      areaId: area.id,
      itemId: item.id,
      criterionId: criterion.id,
      scoreSource: normalizedSource,
      areaCode: area.code,
      itemCode: item.code,
      criterionLabel: criterion.label,
      before: existingCopy,
      after: savedPayload,
      beforeLabel: beforeLabel || "Chưa chấm",
      afterLabel: afterLabel || "Chưa chấm",
    });

    suppressNextDataWatchRender += dbWrites.length;
    scheduleScoreUiRefresh();
    await Promise.all(dbWrites);
  }

  async function logAdminChange({ subjectLabel, beforeLabel = "", afterLabel = "", changeLabel = "", areaCode = "", note = "", scope = "", periodId = "" }) {
    const normalizedScope = scope ? normalizeCatalogType(scope) : "";
    const period = getPeriod(periodId || (normalizedScope ? getActivePeriodId(normalizedScope) : undefined));
    const historyScope = normalizedScope || (period?.id ? getCatalogTypeForPeriod(period.id) : "");
    const historyEntry = {
      id: makeId("history"),
      timestamp: new Date().toISOString(),
      periodId: period?.id || "",
      periodLabel: periodLabel(period),
      userName: getAccountDisplayName(currentUser, historyScope, period?.id || ""),
      username: currentUser?.username || "",
      areaCode,
      subjectLabel,
      beforeLabel,
      afterLabel,
      changeLabel: changeLabel || `${beforeLabel || "-"} → ${afterLabel || "-"}`,
      note,
      source: "admin",
      scope: normalizedScope,
    };
    state.history.unshift(historyEntry);
    await saveHistoryEntry(historyEntry);
  }

  // ─── Undo / Redo Manager ────────────────────────────────────────────────────
  const undoStack = [];
  const redoStack = [];
  const MAX_UNDO_STACK = 50;
  const IMPORT_UNDO_STORAGE_KEY = "legroup-5s-last-import-undo";
  let isExecutingUndoRedo = false;

  function pushUndoAction(action) {
    if (isExecutingUndoRedo) {
      return;
    }
    undoStack.push(action);
    if (undoStack.length > MAX_UNDO_STACK) {
      undoStack.shift();
    }
    redoStack.length = 0;
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    const undoBtn = elements.undoButton || document.getElementById("undo-button");
    const redoBtn = elements.redoButton || document.getElementById("redo-button");
    if (undoBtn) {
      undoBtn.disabled = undoStack.length === 0;
      if (undoStack.length > 0) {
        const top = undoStack[undoStack.length - 1];
        undoBtn.title = `Hoàn tác: ${top.description || top.beforeLabel || ""} (Ctrl+Z)`;
      } else {
        undoBtn.title = "Hoàn tác (Ctrl+Z)";
      }
    }
    if (redoBtn) {
      redoBtn.disabled = redoStack.length === 0;
      if (redoStack.length > 0) {
        const top = redoStack[redoStack.length - 1];
        redoBtn.title = `Làm lại: ${top.description || top.afterLabel || ""} (Ctrl+Y)`;
      } else {
        redoBtn.title = "Làm lại (Ctrl+Y)";
      }
    }
  }

  function capturePeriodSnapshot(periodId) {
    if (!periodId) return null;
    const period = getPeriod(periodId);
    return period?.settingsSnapshot ? cloneValue(period.settingsSnapshot) : null;
  }

  async function restorePeriodSnapshot(periodId, snapshot) {
    if (!periodId || !snapshot) return;
    const period = getPeriod(periodId);
    if (period) {
      period.settingsSnapshot = cloneValue(snapshot);
      await savePeriodSnapshot(period);
    }
  }

  function captureCatalogState(catalogType) {
    const type = catalogType || activeCatalogScope || FIVE_S_PERIOD_TYPE;
    return {
      areas: cloneValue(getMutableAreas(type)),
      managers: cloneValue(getMutableManagers(type)),
      assessors: cloneValue(getMutableAssessors(type)),
      departmentHeadContacts: cloneValue(getDepartmentHeadContacts(type)),
    };
  }

  async function restoreCatalogState(catalogType, catalogData) {
    if (!catalogData) return;
    const type = catalogType || activeCatalogScope || FIVE_S_PERIOD_TYPE;
    const isSafety = normalizeCatalogType(type) === SAFETY_PERIOD_TYPE;
    const writes = [];
    if (catalogData.areas) {
      if (isSafety) state.safetyAreas = cloneValue(catalogData.areas);
      else state.areas = cloneValue(catalogData.areas);
      writes.push(dbRef(catalogDbPath(type, "areas")).set(catalogData.areas));
    }
    if (catalogData.managers) {
      if (isSafety) state.safetyManagers = cloneValue(catalogData.managers);
      else state.managers = cloneValue(catalogData.managers);
      writes.push(dbRef(catalogDbPath(type, "managers")).set(catalogData.managers));
    }
    if (catalogData.assessors) {
      if (isSafety) state.safetyAssessors = cloneValue(catalogData.assessors);
      else state.assessors = cloneValue(catalogData.assessors);
      writes.push(dbRef(catalogDbPath(type, "assessors")).set(catalogData.assessors));
    }
    if (catalogData.departmentHeadContacts) {
      if (isSafety) state.safetyDepartmentHeadContacts = cloneValue(catalogData.departmentHeadContacts);
      else state.departmentHeadContacts = cloneValue(catalogData.departmentHeadContacts);
      writes.push(dbRef(catalogDbPath(type, "departmentHeadContacts")).set(catalogData.departmentHeadContacts));
    }
    await Promise.all(writes);
  }

  function storageMap(value) {
    if (Array.isArray(value)) {
      return Object.fromEntries(value.filter((item) => item?.id).map((item) => [item.id, item]));
    }
    return value && typeof value === "object" ? cloneValue(value) : {};
  }

  function buildImportSnapshotUpdates(targetSnapshot, oppositeSnapshot) {
    const target = targetSnapshot && typeof targetSnapshot === "object" ? targetSnapshot : {};
    const opposite = oppositeSnapshot && typeof oppositeSnapshot === "object" ? oppositeSnapshot : {};
    const updates = {};
    const scalarKeys = [
      "version",
      "benchmark",
      "fiveSChartTargets",
      "activePeriodId",
      "activeFiveSPeriodId",
      "activeSafetyPeriodId",
      "safetyReport",
      "safetyIdentificationOverrides",
    ];
    const collectionKeys = [
      "periods",
      "managers",
      "departmentHeadContacts",
      "assessors",
      "areas",
      "safetyManagers",
      "safetyDepartmentHeadContacts",
      "safetyAssessors",
      "safetyAreas",
      "safetyDepartmentGroups",
      "scores",
      "safetyRecords",
      "deletedSafetyRecords",
      "history",
    ];

    scalarKeys.forEach((key) => {
      updates[key] = Object.prototype.hasOwnProperty.call(target, key) ? cloneValue(target[key]) : null;
    });

    collectionKeys.forEach((key) => {
      const targetMap = storageMap(target[key]);
      const oppositeMap = storageMap(opposite[key]);
      const ids = new Set([...Object.keys(targetMap), ...Object.keys(oppositeMap)]);
      ids.forEach((id) => {
        updates[`${key}/${id}`] = Object.prototype.hasOwnProperty.call(targetMap, id) ? cloneValue(targetMap[id]) : null;
      });
    });

    return updates;
  }

  async function restoreStateSnapshot(targetSnapshot, oppositeSnapshot) {
    if (!targetSnapshot || typeof targetSnapshot !== "object") return;
    const updates = buildImportSnapshotUpdates(targetSnapshot, oppositeSnapshot || {});
    await updateRootWithOptionalRenderSuppression(updates, { suppressRender: true });
    state = normalizeState(cloneValue(targetSnapshot));
    invalidateScoreRecordIndex();
  }

  function persistImportUndoAction(action) {
    try {
      window.sessionStorage.setItem(IMPORT_UNDO_STORAGE_KEY, JSON.stringify(action));
    } catch (error) {
      console.warn("Không lưu được mốc hoàn tác import:", error);
    }
  }

  function clearPersistedImportUndoAction() {
    try {
      window.sessionStorage.removeItem(IMPORT_UNDO_STORAGE_KEY);
    } catch (error) {
      console.warn("Không xóa được mốc hoàn tác import:", error);
    }
  }

  function restorePersistedImportUndoAction() {
    try {
      const raw = window.sessionStorage.getItem(IMPORT_UNDO_STORAGE_KEY);
      if (!raw) return;
      const action = JSON.parse(raw);
      if (action?.type !== "importJson" || !action.beforeState || !action.afterState) return;
      if (!undoStack.some((item) => item.type === "importJson" && item.fileName === action.fileName && item.importedAt === action.importedAt)) {
        undoStack.push(action);
        if (undoStack.length > MAX_UNDO_STACK) {
          undoStack.shift();
        }
        updateUndoRedoButtons();
      }
    } catch (error) {
      console.warn("Không khôi phục được mốc hoàn tác import:", error);
    }
  }

  async function executeUndo() {
    if (undoStack.length === 0) {
      showToast("Không có thao tác nào để hoàn tác.");
      return;
    }
    const action = undoStack.pop();
    isExecutingUndoRedo = true;
    try {
      if (action.type === "score") {
        const { periodId, areaId, itemId, criterionId, scoreSource, before, after } = action;
        if (isPeriodArchived(periodId)) {
          showToast("Kỳ này đã lưu trữ, không thể hoàn tác.", true);
          return;
        }
        const normalizedSource = normalizeScoreSource(scoreSource);
        const existingIndex = state.scores.findIndex(
          (r) =>
            r.periodId === periodId &&
            r.areaId === areaId &&
            r.itemId === itemId &&
            r.criterionId === criterionId &&
            normalizeScoreSource(r.scoreSource) === normalizedSource,
        );
        if (!before) {
          if (existingIndex >= 0) {
            const removedId = state.scores[existingIndex].id;
            state.scores.splice(existingIndex, 1);
            invalidateScoreRecordIndex();
            await deleteScoreFromDb(removedId);
          }
        } else {
          const beforeCopy = cloneValue(before);
          if (existingIndex >= 0) {
            state.scores[existingIndex] = beforeCopy;
          } else {
            state.scores.push(beforeCopy);
          }
          invalidateScoreRecordIndex();
          await saveScore(beforeCopy);
        }
        redoStack.push(action);
        showToast(`Hoàn tác: ${action.description || "Điểm 5S"}`);
        renderAll();
      } else if (action.type === "safetyRecord") {
        const { recordId, before, after, areaCode, periodId } = action;
        if (isPeriodArchived(periodId)) {
          showToast("Kỳ này đã lưu trữ, không thể hoàn tác.", true);
          return;
        }
        const targetId = after?.id || recordId;
        const existingIndex = state.safetyRecords.findIndex((r) => r.id === targetId);
        if (!before) {
          if (existingIndex >= 0) {
            state.safetyRecords.splice(existingIndex, 1);
            await deleteSafetyRecordFromDb(targetId);
          }
        } else {
          const beforeCopy = cloneValue(before);
          state.deletedSafetyRecords = (state.deletedSafetyRecords || []).filter((item) => item.id !== beforeCopy.id);
          if (existingIndex >= 0) {
            state.safetyRecords[existingIndex] = beforeCopy;
          } else {
            state.safetyRecords.push(beforeCopy);
          }
          await saveSafetyRecord(beforeCopy);
          await tryUnmarkSafetyRecordDeleted(beforeCopy.id);
        }
        redoStack.push(action);
        showToast(`Hoàn tác: ${action.description || "Báo cáo AT"}`);
        renderAll();
      } else if (action.type === "safetyTarget") {
        const { periodId, areaId, before } = action;
        await updateSafetyZoneTarget(periodId, areaId, before, true);
        redoStack.push(action);
        showToast(`Hoàn tác: ${action.description || "Mục tiêu AT"}`);
        renderAll();
      } else if (action.type === "catalogOrSettings") {
        const { targetPeriodId, catalogType, beforeSnapshot, beforeCatalog } = action;
        if (targetPeriodId && beforeSnapshot) {
          await restorePeriodSnapshot(targetPeriodId, beforeSnapshot);
        }
        if (beforeCatalog) {
          await restoreCatalogState(catalogType, beforeCatalog);
        }
        redoStack.push(action);
        showToast(`Hoàn tác: ${action.description || "Thông tin danh mục/tên"}`);
        renderAll();
      } else if (action.type === "importJson") {
        await restoreStateSnapshot(action.beforeState, action.afterState);
        redoStack.push(action);
        clearPersistedImportUndoAction();
        showToast(`Đã hoàn tác import: ${action.description || "Import JSON"}`);
        renderAll();
      }
    } catch (error) {
      console.error("Lỗi khi hoàn tác:", error);
      showToast("Lỗi khi hoàn tác.", true);
    } finally {
      isExecutingUndoRedo = false;
      updateUndoRedoButtons();
    }
  }

  async function executeRedo() {
    if (redoStack.length === 0) {
      showToast("Không có thao tác nào để làm lại.");
      return;
    }
    const action = redoStack.pop();
    isExecutingUndoRedo = true;
    try {
      if (action.type === "score") {
        const { periodId, areaId, itemId, criterionId, scoreSource, before, after } = action;
        if (isPeriodArchived(periodId)) {
          showToast("Kỳ này đã lưu trữ, không thể làm lại.", true);
          return;
        }
        const normalizedSource = normalizeScoreSource(scoreSource);
        const existingIndex = state.scores.findIndex(
          (r) =>
            r.periodId === periodId &&
            r.areaId === areaId &&
            r.itemId === itemId &&
            r.criterionId === criterionId &&
            normalizeScoreSource(r.scoreSource) === normalizedSource,
        );
        if (!after) {
          if (existingIndex >= 0) {
            const removedId = state.scores[existingIndex].id;
            state.scores.splice(existingIndex, 1);
            invalidateScoreRecordIndex();
            await deleteScoreFromDb(removedId);
          }
        } else {
          const afterCopy = cloneValue(after);
          if (existingIndex >= 0) {
            state.scores[existingIndex] = afterCopy;
          } else {
            state.scores.push(afterCopy);
          }
          invalidateScoreRecordIndex();
          await saveScore(afterCopy);
        }
        undoStack.push(action);
        showToast(`Làm lại: ${action.description || "Điểm 5S"}`);
        renderAll();
      } else if (action.type === "safetyRecord") {
        const { recordId, before, after, areaCode, periodId } = action;
        if (isPeriodArchived(periodId)) {
          showToast("Kỳ này đã lưu trữ, không thể làm lại.", true);
          return;
        }
        const targetId = after?.id || recordId;
        const existingIndex = state.safetyRecords.findIndex((r) => r.id === targetId);
        if (!after) {
          const deletedSource = before || { id: targetId, periodId };
          const deletedMarker = getDeletedSafetyRecordMarker(deletedSource);
          if (existingIndex >= 0) {
            state.safetyRecords.splice(existingIndex, 1);
          }
          if (shouldKeepDeletedSafetyRecordMarker(deletedSource)) {
            state.deletedSafetyRecords = [
              ...(state.deletedSafetyRecords || []).filter((item) => item.id !== deletedMarker.id),
              deletedMarker,
            ];
            await markSafetyRecordDeleted(deletedSource);
          } else {
            state.deletedSafetyRecords = (state.deletedSafetyRecords || []).filter((item) => item.id !== deletedMarker.id);
            await tryUnmarkSafetyRecordDeleted(deletedMarker.id);
          }
          await deleteSafetyRecordFromDb(targetId);
        } else {
          const afterCopy = cloneValue(after);
          state.deletedSafetyRecords = (state.deletedSafetyRecords || []).filter((item) => item.id !== afterCopy.id);
          if (existingIndex >= 0) {
            state.safetyRecords[existingIndex] = afterCopy;
          } else {
            state.safetyRecords.push(afterCopy);
          }
          await saveSafetyRecord(afterCopy);
          await tryUnmarkSafetyRecordDeleted(afterCopy.id);
        }
        undoStack.push(action);
        showToast(`Làm lại: ${action.description || "Báo cáo AT"}`);
        renderAll();
      } else if (action.type === "safetyTarget") {
        const { periodId, areaId, after } = action;
        await updateSafetyZoneTarget(periodId, areaId, after, true);
        undoStack.push(action);
        showToast(`Làm lại: ${action.description || "Mục tiêu AT"}`);
        renderAll();
      } else if (action.type === "catalogOrSettings") {
        const { targetPeriodId, catalogType, afterSnapshot, afterCatalog } = action;
        if (targetPeriodId && afterSnapshot) {
          await restorePeriodSnapshot(targetPeriodId, afterSnapshot);
        }
        if (afterCatalog) {
          await restoreCatalogState(catalogType, afterCatalog);
        }
        undoStack.push(action);
        showToast(`Làm lại: ${action.description || "Thông tin danh mục/tên"}`);
        renderAll();
      } else if (action.type === "importJson") {
        await restoreStateSnapshot(action.afterState, action.beforeState);
        undoStack.push(action);
        persistImportUndoAction(action);
        showToast(`Đã làm lại import: ${action.description || "Import JSON"}`);
        renderAll();
      }
    } catch (error) {
      console.error("Lỗi khi làm lại:", error);
      showToast("Lỗi khi làm lại.", true);
    } finally {
      isExecutingUndoRedo = false;
      updateUndoRedoButtons();
    }
  }

  function openFormModal({ title, html, submitText = "Lưu", submitClass = "primary-button", extraActions = "", extraRightActions = "", modalClass = "", onSubmit }) {
    modalPreviewDirty = false;
    modalSubmitSucceeded = false;
    const isTableFullscreen = modalClass === "table-fullscreen-modal";
    setModalScrollLock(true, { tableFullscreen: isTableFullscreen });
    elements.modalBackdrop.classList.toggle("table-fullscreen-backdrop", isTableFullscreen);
    elements.modalTitle.textContent = title;
    const modalCard = elements.modalBackdrop.querySelector(".modal-card");
    if (modalCard) {
      modalCard.className = ["modal-card", modalClass].filter(Boolean).join(" ");
    }
    elements.modalBody.innerHTML = `<form class="modal-form" id="modal-form">${html}</form>`;
    refreshSelectAllStates(elements.modalBody);
    elements.modalActions.innerHTML = `
      ${extraActions ? `<div class="modal-actions-left">${extraActions}</div>` : ""}
      <div class="modal-actions-right">
        <button class="secondary-button" type="button" data-action="modal-cancel">Hủy</button>
        <button class="${submitClass}" type="submit" form="modal-form">${escapeHtml(submitText)}</button>
        ${extraRightActions}
      </div>
    `;

    const form = document.getElementById("modal-form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const shouldClose = await onSubmit(new FormData(form), form);
        if (shouldClose !== false) {
          modalSubmitSucceeded = true;
          closeModal();
        }
      } catch (error) {
        console.error(error);
        showToast(error?.message || "Lỗi khi lưu dữ liệu.", true);
      }
    });

    elements.modalBackdrop.hidden = false;
    const firstInput = elements.modalBody.querySelector("input, select, textarea, button");
    firstInput?.focus();
  }

  function openConfirmModal({ title, message, confirmText = "Xác nhận", danger = false, renderAfter = true, onConfirm }) {
    openFormModal({
      title,
      submitText: confirmText,
      submitClass: danger ? "danger-button" : "primary-button",
      html: `<p>${escapeHtml(message)}</p>`,
      async onSubmit() {
        await onConfirm();
        if (renderAfter) {
          renderAll();
        }
        return true;
      },
    });
  }

  function openImageFullscreenModal(image) {
    const src = image?.currentSrc || image?.src || image?.dataset?.photoSrc || "";
    if (!src) {
      return;
    }

    modalPreviewDirty = false;
    modalSubmitSucceeded = true;
    setModalScrollLock(true);
    elements.modalBackdrop.classList.remove("table-fullscreen-backdrop");
    elements.modalBackdrop.classList.add("image-fullscreen-backdrop");
    elements.modalTitle.textContent = "";
    const modalCard = elements.modalBackdrop.querySelector(".modal-card");
    if (modalCard) {
      modalCard.className = "modal-card image-fullscreen-modal";
    }
    elements.modalBody.innerHTML = '<div class="image-fullscreen-view"><img src="' + escapeHtml(src) + '" alt="' + escapeHtml(image?.alt || "Ảnh phóng to") + '"></div>';
    elements.modalActions.innerHTML = "";
    elements.modalBody.querySelector(".image-fullscreen-view")?.addEventListener("click", closeModal);
    elements.modalBackdrop.hidden = false;
  }

  function closeModal() {
    const shouldRefreshPreview = modalPreviewDirty && !modalSubmitSucceeded && currentUser && state;
    elements.modalBackdrop.hidden = true;
    elements.modalBackdrop.classList.remove("table-fullscreen-backdrop");
    elements.modalBackdrop.classList.remove("image-fullscreen-backdrop");
    setModalScrollLock(false, { tableFullscreen: true });
    elements.modalTitle.textContent = "";
    elements.modalBody.innerHTML = "";
    elements.modalActions.innerHTML = "";
    const modalCard = elements.modalBackdrop.querySelector(".modal-card");
    if (modalCard) {
      modalCard.className = "modal-card";
    }
    modalPreviewDirty = false;
    modalSubmitSucceeded = false;
    if (shouldRefreshPreview) {
      renderActiveTab();
    }
  }

  function setModalScrollLock(isLocked, options = {}) {
    document.documentElement.classList.toggle("modal-open", isLocked);
    document.body.classList.toggle("modal-open", isLocked);
    if (options.tableFullscreen) {
      document.documentElement.classList.toggle("table-fullscreen-open", isLocked);
      document.body.classList.toggle("table-fullscreen-open", isLocked);
    }
  }

  async function prepareScorePhoto(file, existingRecord, removePhoto, periodId) {
    if (removePhoto) {
      return { photoDataUrl: "", photoName: "" };
    }

    if (!file) {
      return {
        photoDataUrl: existingRecord?.photoDataUrl || "",
        photoName: existingRecord?.photoName || "",
      };
    }

    const compressedDataUrl = await resizeImageFile(file, PHOTO_MAX_SIZE, PHOTO_JPEG_QUALITY);
    return savePhotoFile(compressedDataUrl, file.name || "anh-minh-hoa.jpg", periodId);
  }

  async function savePhotoFile(dataUrl, fileName, periodId) {
    if (!dataStore?.savePhoto) {
      throw new Error("Ứng dụng cần chạy bằng npm start để lưu ảnh vào thư mục data/photos.");
    }

    const period = getPeriod(periodId);
    const savedPhoto = await dataStore.savePhoto({
      dataUrl,
      fileName,
      month: period?.month,
      year: period?.year,
    });

    return {
      photoDataUrl: savedPhoto.url || "",
      photoName: savedPhoto.fileName || fileName || "anh-minh-hoa.jpg",
    };
  }

  function isPhotoUrlReferenced(photoUrl = "") {
    const url = String(photoUrl || "");
    if (!url) {
      return false;
    }
    return [...(state.scores || []), ...(state.safetyRecords || [])].some((record) => (
      record?.photoDataUrl === url || record?.afterPhotoDataUrl === url
    ));
  }

  async function deleteUnusedPhotoFile(photoUrl = "") {
    const url = String(photoUrl || "");
    if (!url || isPhotoUrlReferenced(url) || !dataStore?.deletePhoto) {
      return;
    }
    try {
      await dataStore.deletePhoto({ url });
    } catch (error) {
      console.warn("Không xóa được file ảnh không còn sử dụng:", error);
    }
  }

  async function deleteUnusedPhotoFiles(photoUrls = []) {
    const uniqueUrls = [...new Set(photoUrls.filter(Boolean))];
    await Promise.all(uniqueUrls.map((url) => deleteUnusedPhotoFile(url)));
  }

  function collectPhotoUrls(records = []) {
    return records.flatMap((record) => [
      record?.photoDataUrl || "",
      record?.afterPhotoDataUrl || "",
    ]).filter(Boolean);
  }

  function isInternalPhotoUrl(url = "") {
    const value = String(url || "");
    return value.startsWith("/api/photos/") || value.includes("/api/photos/");
  }

  function clearAuthenticatedPhotoUrlCache() {
    authenticatedPhotoUrlCache.forEach((objectUrl) => {
      if (String(objectUrl || "").startsWith("blob:")) {
        URL.revokeObjectURL(objectUrl);
      }
    });
    authenticatedPhotoUrlCache.clear();
    authenticatedPhotoUrlPromises.clear();
  }

  async function getAuthenticatedPhotoObjectUrl(photoUrl = "") {
    const url = String(photoUrl || "");
    if (!isInternalPhotoUrl(url)) {
      return url;
    }

    if (authenticatedPhotoUrlCache.has(url)) {
      return authenticatedPhotoUrlCache.get(url);
    }

    if (authenticatedPhotoUrlPromises.has(url)) {
      return authenticatedPhotoUrlPromises.get(url);
    }

    const promise = fetch(url, {
      credentials: "include",
      headers: currentAuthToken ? { Authorization: `Bearer ${currentAuthToken}` } : {},
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Không tải được ảnh (${response.status}).`);
        }
        return response.blob();
      })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        authenticatedPhotoUrlCache.set(url, objectUrl);
        authenticatedPhotoUrlPromises.delete(url);
        return objectUrl;
      })
      .catch((error) => {
        authenticatedPhotoUrlPromises.delete(url);
        console.warn("Không tải được ảnh minh họa:", error);
        return url;
      });

    authenticatedPhotoUrlPromises.set(url, promise);
    return promise;
  }

  function hydrateAuthenticatedPhotos(root = document) {
    root.querySelectorAll?.("img").forEach((image) => {
      const originalUrl = image.dataset.photoSrc || image.getAttribute("src") || "";
      if (!isInternalPhotoUrl(originalUrl)) {
        return;
      }

      image.dataset.photoSrc = originalUrl;
      getAuthenticatedPhotoObjectUrl(originalUrl).then((objectUrl) => {
        if (image.isConnected && image.dataset.photoSrc === originalUrl && objectUrl) {
          image.src = objectUrl;
        }
      });
    });
  }

  function resizeImageFile(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Không đọc được ảnh."));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("Ảnh không hợp lệ."));
        image.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext("2d");
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        image.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  async function handlePeriodSubmit(event, type = FIVE_S_PERIOD_TYPE) {
    event.preventDefault();
    if (!requireAdminAction()) {
      return;
    }

    const normalizedType = normalizePeriodType(type) === SAFETY_PERIOD_TYPE ? SAFETY_PERIOD_TYPE : FIVE_S_PERIOD_TYPE;
    const isSafetyPeriod = normalizedType === SAFETY_PERIOD_TYPE;
    let month = 0;
    let year = 0;
    let label = "";
    let id = "";
    let createdAt = new Date().toISOString();
    let period = null;

    if (isSafetyPeriod) {
      const isoDate = parseDisplayDateToIso(elements.periodSafetyDate?.value);
      const date = new Date(isoDate + "T00:00:00");
      if (Number.isNaN(date.getTime())) {
        showToast("Ngày đánh giá an toàn không hợp lệ.", true);
        return;
      }
      month = date.getMonth() + 1;
      year = date.getFullYear();
      const day = String(date.getDate()).padStart(2, "0");
      const paddedMonth = String(month).padStart(2, "0");
      id = "period-safety-" + year + "-" + paddedMonth + "-" + day;
      label = day + "/" + paddedMonth + "/" + year;
      createdAt = date.toISOString();
      period = getPeriodsByType(SAFETY_PERIOD_TYPE).find((item) => item.id === id || toIsoDate(item.createdAt) === isoDate) || null;
    } else {
      month = Number(elements.period5SMonth?.value || elements.periodMonth?.value);
      year = Number(elements.period5SYear?.value || elements.periodYear?.value);
      if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2020 || year > 2100) {
        showToast("Tháng hoặc năm không hợp lệ.", true);
        return;
      }
      const paddedMonth = String(month).padStart(2, "0");
      id = "period-5s-" + year + "-" + paddedMonth;
      label = "Tháng " + month + "/" + year;
      period = getPeriodsByType(FIVE_S_PERIOD_TYPE).find((item) => item.id === id || (Number(item.month) === month && Number(item.year) === year)) || null;
    }

    if (period) {
      showToast(isSafetyPeriod ? "Đã có kỳ đánh giá an toàn này." : "Đã có kỳ chấm 5S này.", true);
      return;
    }

    const sourcePeriodId = getActivePeriodId(normalizedType);
    const templateMode = getNewPeriodCatalogTemplateMode(normalizedType);
    await ensurePeriodSnapshot(sourcePeriodId);
    period = {
      id,
      month,
      year,
      type: normalizedType,
      label,
      createdAt,
      archived: false,
      settingsSnapshot: makeNewPeriodSettingsSnapshot(normalizedType, sourcePeriodId, templateMode),
    };
    state.periods.push(period);
    await dbRef("periods/" + period.id).set(period);

    setActivePeriodId(normalizedType, period.id);
    await saveMeta();
    await logAdminChange({
      subjectLabel: isSafetyPeriod ? "Kỳ đánh giá an toàn" : "Kỳ chấm 5S",
      afterLabel: periodLabel(period),
      changeLabel: "Tạo kỳ mới " + periodLabel(period),
      note: templateMode === PERIOD_CATALOG_TEMPLATE_RESET_PEOPLE
        ? "Kỳ mới bắt đầu trống dữ liệu; danh mục người được thiết lập lại"
        : "Kỳ mới bắt đầu trống dữ liệu; danh mục người copy từ kỳ đang mở",
      scope: normalizedType,
      periodId: period.id,
    });
    (isSafetyPeriod ? elements.periodSafetyForm : elements.period5SForm || elements.periodForm)?.reset();
    showToast("Đã tạo kỳ mới.");
    renderAll();
  }
  async function handleScorerSubmit(event) {
    event.preventDefault();
    if (!requireAdminAction()) {
      return;
    }

    const name = elements.scorerName.value.trim();
    if (!name) {
      showToast("Vui lòng nhập tên người phụ trách zone.", true);
      return;
    }

    const catalogType = activeCatalogScope;
    const periodId = getActivePeriodId(catalogType);
    if (getPeriodCatalogManagers(catalogType, periodId).some((manager) => manager.name.toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi"))) {
      showToast("Người phụ trách zone này đã tồn tại trong kỳ đang mở.", true);
      return;
    }

    const beforeSnapshot = capturePeriodSnapshot(periodId);
    const beforeCatalog = captureCatalogState(catalogType);
    const managers = getMutablePeriodManagers(catalogType, periodId);
    const newManager = { id: makeId(catalogType === SAFETY_PERIOD_TYPE ? "safety-scorer" : "scorer"), name, emails: [], createdAt: new Date().toISOString() };
    managers.push(newManager);
    await Promise.all([
      saveCatalogPeriodSnapshot(catalogType, periodId),
      logAdminChange({
        subjectLabel: "Người phụ trách zone",
        afterLabel: name,
        changeLabel: `Thêm người phụ trách zone ${name}`,
        scope: catalogType,
        periodId,
      }),
    ]);
    const afterSnapshot = capturePeriodSnapshot(periodId);
    const afterCatalog = captureCatalogState(catalogType);
    pushUndoAction({
      type: "catalogOrSettings",
      description: `Thêm người phụ trách zone: ${name}`,
      targetPeriodId: periodId,
      catalogType,
      beforeSnapshot,
      afterSnapshot,
      beforeCatalog,
      afterCatalog,
    });
    elements.scorerForm.reset();
    showToast("Đã thêm người phụ trách zone.");
    renderAll();
  }


  function getMutableDepartmentHeadContactsForPeriod(type = activeCatalogScope, periodId = getActivePeriodId(type)) {
    const snapshot = getMutableCatalogSnapshot(type, periodId);
    if (!snapshot) {
      return getDepartmentHeadContacts(type);
    }

    snapshot.departmentHeadContacts = normalizeDepartmentHeadContacts(
      snapshot.departmentHeadContacts,
      snapshot.areas,
      snapshot.managers,
    );
    return snapshot.departmentHeadContacts;
  }

  function ensureDepartmentHeadContactForPeriod(name, type = activeCatalogScope, periodId = getActivePeriodId(type)) {
    const cleanName = normalizeDepartmentHeadName(name);
    if (!cleanName) {
      return null;
    }

    const contacts = getMutableDepartmentHeadContactsForPeriod(type, periodId);
    let contact = contacts.find((item) => departmentHeadKey(item.name) === departmentHeadKey(cleanName)) || null;
    if (!contact) {
      contact = {
        id: makeStableId(normalizeCatalogType(type) === SAFETY_PERIOD_TYPE ? "safety-department-head" : "department-head", cleanName),
        name: cleanName,
        emails: [],
        createdAt: new Date().toISOString(),
      };
      contacts.push(contact);
    }
    return contact;
  }

  async function saveDepartmentHeadEmails(name, emails, type = activeCatalogScope, periodId = getActivePeriodId(type)) {
    const catalogType = normalizeCatalogType(type);
    const period = getPeriod(periodId);
    const cleanName = normalizeDepartmentHeadName(name);
    const headKey = departmentHeadKey(cleanName);
    const contact = period?.settingsSnapshot
      ? ensureDepartmentHeadContactForPeriod(cleanName, catalogType, period.id)
      : ensureDepartmentHeadContact(cleanName, catalogType);
    if (!contact) {
      showToast("Vui lòng chọn trưởng phòng.", true);
      return { ok: false, changed: false };
    }

    const beforeLabel = cleanName + " · " + (formatEmailList(contact.emails) || "chưa có email");
    const nextEmails = normalizeEmailList(emails);
    if (areEmailListsEqual(contact.emails, nextEmails)) {
      contact.emails = nextEmails;
      return { ok: true, changed: false };
    }

    contact.emails = nextEmails;

    // 1. Đồng bộ danh mục gốc (cả 5S và An toàn) để khi tạo kỳ mới hoặc fallback không bị mang email cũ
    const root5sContact = ensureDepartmentHeadContact(cleanName, FIVE_S_PERIOD_TYPE);
    if (root5sContact) {
      root5sContact.emails = nextEmails;
    }
    const rootSafetyContact = ensureDepartmentHeadContact(cleanName, SAFETY_PERIOD_TYPE);
    if (rootSafetyContact) {
      rootSafetyContact.emails = nextEmails;
    }

    const updates = {};
    if (root5sContact) {
      updates[`${catalogDbPath(FIVE_S_PERIOD_TYPE, "departmentHeadContacts")}/${root5sContact.id}`] = root5sContact;
    }
    if (rootSafetyContact) {
      updates[`${catalogDbPath(SAFETY_PERIOD_TYPE, "departmentHeadContacts")}/${rootSafetyContact.id}`] = rootSafetyContact;
    }

    // 2. Đồng bộ qua tất cả các kỳ đang có snapshot để không bị tình trạng xóa ở kỳ này nhưng kỳ khác vẫn còn
    const allPeriods = Array.isArray(state.periods)
      ? state.periods
      : (state.periods && typeof state.periods === "object" ? Object.values(state.periods) : []);

    allPeriods.forEach((p) => {
      if (!p?.settingsSnapshot) return;
      let matched = false;
      const pContacts = p.settingsSnapshot.departmentHeadContacts;
      if (Array.isArray(pContacts)) {
        pContacts.forEach((c) => {
          if (departmentHeadKey(c?.name) === headKey) {
            c.emails = nextEmails;
            matched = true;
          }
        });
      } else if (pContacts && typeof pContacts === "object") {
        Object.values(pContacts).forEach((c) => {
          if (departmentHeadKey(c?.name) === headKey) {
            c.emails = nextEmails;
            matched = true;
          }
        });
      }
      if (matched || p.id === period?.id) {
        updates[`periods/${p.id}/settingsSnapshot`] = p.settingsSnapshot;
      }
    });

    if (period?.settingsSnapshot && !updates[`periods/${period.id}/settingsSnapshot`]) {
      updates[`periods/${period.id}/settingsSnapshot`] = period.settingsSnapshot;
    }

    const historyPeriod = period || getPeriod(getActivePeriodId(catalogType));
    const historyEntry = stageHistoryEntry({
      id: makeId("history"),
      timestamp: new Date().toISOString(),
      periodId: historyPeriod?.id || "",
      periodLabel: periodLabel(historyPeriod),
      userName: getAccountDisplayName(currentUser, catalogType, historyPeriod?.id || ""),
      username: currentUser?.username || "",
      subjectLabel: "Email trưởng phòng",
      beforeLabel,
      afterLabel: cleanName + " · " + (formatEmailList(nextEmails) || "chưa có email"),
      changeLabel: "Sửa email trưởng phòng " + cleanName,
      note: "",
      source: "admin",
      scope: catalogType,
    });

    if (historyEntry) {
      updates[`history/${historyEntry.id}`] = historyEntry;
    }

    await updateRootWithOptionalRenderSuppression(updates, { suppressRender: true });
    return { ok: true, changed: true };
  }

  async function handleDepartmentHeadEmailSubmit(event) {
    event.preventDefault();
    if (!requireAdminAction()) {
      return;
    }

    const name = elements.departmentHeadEmailName?.value || "";
    const emails = elements.departmentHeadEmails?.value || "";
    const result = await saveDepartmentHeadEmails(name, emails, activeCatalogScope);
    if (!result.ok) {
      return;
    }

    showToast(result.changed ? "Đã lưu email trưởng phòng." : "Email trưởng phòng không thay đổi.");
    refreshDepartmentHeadEmailUi();
  }

  async function handleSafetyDepartmentGroupsSubmit(event) {
    event.preventDefault();
    if (!requireAdminAction()) {
      return;
    }

    if (activeCatalogScope !== SAFETY_PERIOD_TYPE) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const conflicts = findSafetyDepartmentGroupConflicts(formData);
    if (conflicts.length) {
      const conflictText = conflicts
        .slice(0, 3)
        .map((conflict) => "Zone " + conflict.code + " đang nằm trong " + conflict.groups.join(" và "))
        .join("; ");
      showToast(conflictText + ". Vui lòng bỏ trùng trước khi lưu.", true);
      return;
    }

    const periodId = getActivePeriodId(SAFETY_PERIOD_TYPE);
    const period = getPeriod(periodId);
    const snapshot = ensurePeriodSnapshotLocal(periodId);
    const periodAreas = getAreasForPeriod(periodId);
    const beforeGroups = normalizeSafetyDepartmentGroups(snapshot?.safetyDepartmentGroups || state.safetyDepartmentGroups, periodAreas);
    const nextGroups = parseSafetyDepartmentGroupsFromForm(formData, periodAreas);
    const beforeSignature = safetyDepartmentGroupsSignature(beforeGroups);
    const afterSignature = safetyDepartmentGroupsSignature(nextGroups);
    if (beforeSignature === afterSignature) {
      showToast("Không có thay đổi mới.");
      return;
    }

    if (snapshot) {
      snapshot.safetyDepartmentGroups = nextGroups;
    } else {
      state.safetyDepartmentGroups = nextGroups;
    }
    await Promise.all([
      snapshot ? savePeriodSnapshot(period) : saveSafetyDepartmentGroups(nextGroups),
      logAdminChange({
        subjectLabel: "Nhóm bộ phận AT",
        beforeLabel: describeSafetyDepartmentGroups(beforeGroups),
        afterLabel: describeSafetyDepartmentGroups(nextGroups),
        changeLabel: "Sửa nhóm bộ phận AT",
        scope: SAFETY_PERIOD_TYPE,
        periodId,
      }),
    ]);
    showToast("Đã lưu nhóm bộ phận AT.");
    renderAll();
  }

  async function handleAssessorSubmit(event) {
    event.preventDefault();
    if (!requireAdminAction()) {
      return;
    }

    const name = elements.catalogAssessorName.value.trim();
    if (!name) {
      showToast("Vui lòng nhập tên assessor.", true);
      return;
    }

    const catalogType = activeCatalogScope;
    const periodId = getActivePeriodId(catalogType);
    if (getPeriodCatalogAssessors(catalogType, periodId).some((assessor) => assessor.name.toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi"))) {
      showToast("Assessor này đã tồn tại trong kỳ đang mở.", true);
      return;
    }

    const checkedAreaIds = getCheckedAreaIds(elements.catalogAssessorForm);
    const beforeSnapshot = capturePeriodSnapshot(periodId);
    const beforeCatalog = captureCatalogState(catalogType);
    const assessors = getMutablePeriodAssessors(catalogType, periodId);
    const newAssessor = { id: makeId(catalogType === SAFETY_PERIOD_TYPE ? "safety-assessor" : "assessor"), name, createdAt: new Date().toISOString() };
    assessors.push(newAssessor);

    const rootAssessors = getMutableAssessors(catalogType);
    if (!rootAssessors.some((a) => a.id === newAssessor.id)) {
      rootAssessors.push({ ...newAssessor });
    }

    if (checkedAreaIds.length) {
      await setAssessorAreaIds(newAssessor.id, checkedAreaIds, catalogType, periodId);
    }

    await Promise.all([
      saveCatalogPeriodSnapshot(catalogType, periodId),
      dbRef(`${catalogDbPath(catalogType, "assessors")}/${newAssessor.id}`).set(newAssessor),
      logAdminChange({
        subjectLabel: "Assessor",
        afterLabel: name,
        changeLabel: `Thêm assessor ${name}`,
        scope: catalogType,
        periodId,
      }),
    ]);
    const afterSnapshot = capturePeriodSnapshot(periodId);
    const afterCatalog = captureCatalogState(catalogType);
    pushUndoAction({
      type: "catalogOrSettings",
      description: `Thêm assessor: ${name}`,
      targetPeriodId: periodId,
      catalogType,
      beforeSnapshot,
      afterSnapshot,
      beforeCatalog,
      afterCatalog,
    });
    elements.catalogAssessorForm.reset();
    renderCatalogAssessorZoneList();
    showToast("Đã thêm assessor.");
    renderAll();
  }

  async function handleAreaSubmit(event) {
    event.preventDefault();
    if (!requireAdminAction()) {
      return;
    }

    const catalogType = activeCatalogScope;
    const isSafety = normalizeCatalogType(catalogType) === SAFETY_PERIOD_TYPE;
    const periodId = getActivePeriodId(catalogType);
    const areas = getMutablePeriodAreas(catalogType, periodId);
    const code = elements.areaCode.value.trim();
    const scorerId = elements.areaScorer.value;
    const assessorId = isSafety ? "" : elements.areaAssessor.value;
    const checkedAssessorIds = isSafety ? getCheckedAssessorIds(elements.areaForm) : (assessorId ? [assessorId] : []);

    if (!code || !scorerId || (!isSafety && !assessorId)) {
      showToast(isSafety ? "Vui lòng nhập đủ mã zone và người phụ trách zone." : "Vui lòng nhập đủ mã zone, người phụ trách zone và assessor.", true);
      return;
    }

    if (areas.some((area) => String(area.code || "").trim().toLocaleLowerCase("vi") === code.toLocaleLowerCase("vi"))) {
      showToast("Mã zone này đã tồn tại trong kỳ đang mở.", true);
      return;
    }

    const primaryAssessorId = isSafety ? (checkedAssessorIds[0] || "") : assessorId;
    const primaryAssessor = primaryAssessorId ? getPeriodCatalogAssessor(periodId, primaryAssessorId) : null;
    const primaryAssessorName = primaryAssessor?.name || "";

    const beforeSnapshot = capturePeriodSnapshot(periodId);
    const beforeCatalog = captureCatalogState(catalogType);

    const newArea = {
      id: makeId("area"),
      order: Math.max(0, ...areas.map((area) => Number(area.order) || 0)) + 1,
      code,
      templateCode: code,
      departmentHead: elements.areaHead.value.trim(),
      summaryGroup: elements.areaSummaryGroup?.value?.trim() || getDepartmentHeadSummaryGroup(elements.areaHead.value.trim(), areas),
      scorerId,
      assessorId: primaryAssessorId,
      assessorIds: checkedAssessorIds,
      responsibleName: getPeriodCatalogManager(periodId, scorerId)?.name || "",
      assessorName: primaryAssessorName,
      highlight: isSafety ? false : elements.areaHighlight.checked,
      createdAt: new Date().toISOString(),
    };
    areas.push(newArea);

    const affectedAccounts = [];
    if (checkedAssessorIds.length) {
      const checkedSet = new Set(checkedAssessorIds);
      (state.accounts || []).forEach((account) => {
        if (hasAccountAccessType(account, catalogType)) {
          const personId = getAccountPersonId(account, catalogType);
          if (personId && checkedSet.has(personId)) {
            const accAreaIds = new Set(getAccountAreaIds(account, catalogType));
            accAreaIds.add(newArea.id);
            setAccountAreaIds(account, catalogType, [...accAreaIds]);
            affectedAccounts.push(account);
          }
        }
      });
    }

    const snapshot = getMutableCatalogSnapshot(catalogType, periodId);
    if (snapshot) {
      snapshot.departmentHeadContacts = normalizeDepartmentHeadContacts(snapshot.departmentHeadContacts, snapshot.areas, snapshot.managers);
    } else if (catalogType === SAFETY_PERIOD_TYPE) {
      state.safetyDepartmentHeadContacts = normalizeDepartmentHeadContacts(state.safetyDepartmentHeadContacts, state.safetyAreas, state.safetyManagers);
    } else {
      state.departmentHeadContacts = normalizeDepartmentHeadContacts(state.departmentHeadContacts, state.areas, state.managers);
    }
    await Promise.all([
      saveCatalogPeriodSnapshot(catalogType, periodId),
      ...affectedAccounts.map((acc) => dbRef(`accounts/${acc.id}`).set(acc)),
      logAdminChange({
        subjectLabel: "Zone",
        areaCode: code,
        afterLabel: `${code} · ${elements.areaHead.value.trim() || "-"} · ${newArea.responsibleName || ""} · Assessor: ${newArea.assessorName || "-"}`,
        changeLabel: `Thêm zone ${code}`,
        scope: catalogType,
        periodId,
      }),
    ]);

    const afterSnapshot = capturePeriodSnapshot(periodId);
    const afterCatalog = captureCatalogState(catalogType);
    pushUndoAction({
      type: "catalogOrSettings",
      description: `Thêm zone: ${code}`,
      targetPeriodId: periodId,
      catalogType,
      beforeSnapshot,
      afterSnapshot,
      beforeCatalog,
      afterCatalog,
    });

    elements.areaForm.reset();
    syncCatalogAreaFormFields();
    showToast("Đã thêm zone.");
    renderAll();
  }

  async function syncCatalogAreasForAccount(scope, areaIds, personId, role) {
    if (role === ROLE_ZONE_OWNER || !personId) {
      return;
    }
    const periodId = getActivePeriodId(scope);
    const period = getPeriod(periodId);
    if (!period) return;

    const snapshot = ensurePeriodSnapshotLocal(periodId);
    const areas = snapshot?.areas || getAreas(scope);
    if (!areas || !areas.length) return;
    const checkedSet = new Set(areaIds || []);
    let changed = false;

    if (snapshot?.assessors && !snapshot.assessors.some((a) => a.id === personId)) {
      const rootAssessor = getAssessor(personId, scope);
      if (rootAssessor) {
        snapshot.assessors.push({ ...rootAssessor });
        changed = true;
      }
    }

    const assessor = getPeriodCatalogAssessor(periodId, personId) || getAssessor(personId, scope);
    const assessorName = assessor?.name || "";

    if (assessor && scope === SAFETY_PERIOD_TYPE) {
      if (!state.safetyAssessors || typeof state.safetyAssessors !== "object") {
        state.safetyAssessors = {};
      }
      if (!state.safetyAssessors[personId]) {
        state.safetyAssessors[personId] = { id: personId, name: assessorName, createdAt: new Date().toISOString() };
        await dbRef(`safetyAssessors/${personId}`).set(state.safetyAssessors[personId]);
      }
    }

    areas.forEach((area) => {
      const currentIds = new Set(Array.isArray(area.assessorIds) ? area.assessorIds : [area.assessorId].filter(Boolean));
      if (checkedSet.has(area.id)) {
        if (!currentIds.has(personId)) {
          currentIds.add(personId);
          area.assessorIds = [...currentIds];
          if (!area.assessorId) {
            area.assessorId = personId;
            area.assessorName = assessorName;
          }
          changed = true;
        }
      } else {
        if (currentIds.has(personId)) {
          currentIds.delete(personId);
          area.assessorIds = [...currentIds];
          if (area.assessorId === personId) {
            area.assessorId = area.assessorIds[0] || "";
            area.assessorName = getPeriodCatalogAssessor(periodId, area.assessorId)?.name || "";
          }
          changed = true;
        }
      }
    });

    if (changed) {
      if (snapshot) {
        await savePeriodSnapshot(period);
      } else {
        await Promise.all([
          dbRef(`${catalogDbPath(scope, "areas")}`).set(areas),
          refreshLatestPeriodSnapshot(scope),
        ]);
      }
    }
  }

  async function handleAccountSubmit(event) {
    event.preventDefault();
    if (!requireAdminAction()) {
      return;
    }

    const scope = activeAccountScope;
    const periodId = getActivePeriodId(scope);
    const role = normalizeScopedAccountRole(elements.accountRole?.value, scope);
    const isZoneOwnerRole = role === ROLE_ZONE_OWNER;
    let areaIds = [];
    const username = elements.accountUsername.value.trim();
    const displayName = (elements.accountDisplayName?.value || "").trim();
    const password = elements.accountPassword.value;
    const existing = state.accounts.find((account) => account.username === username);
    let personId = "";
    let name = "";

    if (!username || (!password && !existing)) {
      showToast("Vui lòng nhập đủ thông tin tài khoản.", true);
      return;
    }
    if (password && password.length < 4) {
      showToast("Mật khẩu phải có ít nhất 4 ký tự.", true);
      return;
    }

    if (isZoneOwnerRole) {
      personId = elements.accountManager?.value || "";
      const manager = getPeriodCatalogManager(periodId, personId);
      name = manager?.name || "";
      if (!manager) {
        showToast("Vui lòng chọn người phụ trách zone.", true);
        return;
      }
      areaIds = getCheckedAreaIds(elements.accountForm);
      if (!areaIds.length) {
        showToast("Vui lòng chọn ít nhất một zone phụ trách.", true);
        return;
      }
    } else {
      personId = elements.accountAssessor.value;
      const assessor = getPeriodCatalogAssessor(periodId, personId);
      name = assessor?.name || "";
      if (!assessor) {
        showToast("Vui lòng chọn assessor.", true);
        return;
      }
      areaIds = getAssessorAreaIds(personId, scope, periodId);
    }

    const applyScopeAssignment = (account) => {
      const accessTypes = new Set(normalizeAccountAccessTypes(account.accessTypes, account.role));
      accessTypes.add(scope);
      account.accessTypes = [...accessTypes];
      account.rolesByType = { ...normalizeAccountRolesByType(account), [scope]: role };
      account.name = name || account.name || username;
      account.displayName = displayName || username;
      setAccountPersonForType(account, scope, role, personId);
      setAccountAreaIds(account, scope, areaIds);
      if (!account.role || !normalizeAccountAccessTypes(account.accessTypes, account.role).includes(FIVE_S_PERIOD_TYPE)) {
        account.role = role;
      }
      delete account.position;
      if (password) {
        account.password = password;
      }
      delete account.email;
      delete account.senderEmail;
    };

    if (existing) {
      if (isAdminAccount(existing)) {
        showToast("Không thể cấp thêm quyền bằng tài khoản admin cố định.", true);
        return;
      }
      if (isViewerAccount(existing)) {
        showToast("Tài khoản người xem được quản lý ở khu riêng bên dưới.", true);
        return;
      }
      if (isDepartmentHeadAccount(existing)) {
        showToast("Tài khoản trưởng phòng được quản lý ở khu riêng.", true);
        return;
      }
      if (hasAccountAccessType(existing, scope)) {
        showToast("Tên tài khoản đã tồn tại trong luồng này.", true);
        return;
      }

      const beforeLabel = `${existing.username} · Chưa có quyền ${getAccountScopeLabel(scope)}`;
      applyScopeAssignment(existing);
      await dbRef(`accounts/${existing.id}`).set(existing);
      await syncCatalogAreasForAccount(scope, areaIds, personId, role);
      await logAdminChange({
        subjectLabel: isZoneOwnerRole ? "Tài khoản người phụ trách zone" : "Tài khoản assessor",
        beforeLabel,
        afterLabel: describeAccountForScope(existing, scope),
        changeLabel: `Cấp thêm quyền ${getAccountScopeLabel(scope)} cho ${username}`,
        scope,
      });
      elements.accountForm.reset();
      populateAccountRoleOptions();
      syncAccountRoleFields();
      showToast("Đã cấp thêm quyền cho tài khoản.");
      renderAll();
      return;
    }

    const newAccount = {
      id: makeId("account"),
      role,
      name,
      accessTypes: [scope],
      rolesByType: {},
      username,
      password,
      createdAt: new Date().toISOString(),
    };
    applyScopeAssignment(newAccount);

    state.accounts.push(newAccount);
    await dbRef(`accounts/${newAccount.id}`).set(newAccount);
    await syncCatalogAreasForAccount(scope, areaIds, personId, role);
    await logAdminChange({
      subjectLabel: isZoneOwnerRole ? "Tài khoản người phụ trách zone" : "Tài khoản assessor",
      afterLabel: describeAccountForScope(newAccount, scope),
      changeLabel: `Thêm tài khoản ${username}`,
      scope,
    });

    elements.accountForm.reset();
    populateAccountRoleOptions();
    syncAccountRoleFields();
    showToast("Đã thêm tài khoản.");
    renderAll();
  }

  async function handleViewerAccountSubmit(event) {
    event.preventDefault();
    if (!requireAdminAction()) {
      return;
    }

    const name = (elements.viewerAccountName?.value || "").trim();
    const position = (elements.viewerAccountPosition?.value || "").trim();
    const username = (elements.viewerAccountUsername?.value || "").trim();
    const displayName = (elements.viewerAccountDisplayName?.value || "").trim();
    const password = elements.viewerAccountPassword?.value || "";

    if (!name || !position || !username || !password) {
      showToast("Vui lòng nhập đủ thông tin người xem.", true);
      return;
    }
    if (password.length < 4) {
      showToast("Mật khẩu phải có ít nhất 4 ký tự.", true);
      return;
    }
    if (state.accounts.some((account) => account.username === username)) {
      showToast("Tên tài khoản đã tồn tại.", true);
      return;
    }

    const account = {
      id: makeId("account"),
      role: ROLE_VIEWER,
      accessTypes: [FIVE_S_PERIOD_TYPE, SAFETY_PERIOD_TYPE],
      rolesByType: { [FIVE_S_PERIOD_TYPE]: ROLE_VIEWER, [SAFETY_PERIOD_TYPE]: ROLE_VIEWER },
      name,
      position,
      displayName: displayName || name,
      username,
      password,
      areaIds: [],
      fiveSAreaIds: [],
      safetyAreaIds: [],
      createdAt: new Date().toISOString(),
    };

    state.accounts.push(account);
    await Promise.all([
      dbRef(`accounts/${account.id}`).set(account),
      logAdminChange({
        subjectLabel: "Tài khoản người xem",
        afterLabel: describeAccountForScope(account, activeAccountScope),
        changeLabel: `Thêm tài khoản người xem ${username}`,
        scope: "",
      }),
    ]);

    elements.viewerAccountForm?.reset();
    showToast("Đã thêm tài khoản người xem.");
    renderAll();
  }

  async function handleDepartmentHeadAccountSubmit(event) {
    event.preventDefault();
    if (!requireAdminAction()) {
      return;
    }

    const source = normalizeCatalogType(elements.departmentHeadAccountSource?.value || FIVE_S_PERIOD_TYPE);
    const name = normalizeDepartmentHeadName(elements.departmentHeadAccountName?.value || "");
    const username = (elements.departmentHeadAccountUsername?.value || "").trim();
    const displayName = (elements.departmentHeadAccountDisplayName?.value || "").trim();
    const password = elements.departmentHeadAccountPassword?.value || "";
    const rows = departmentHeadAccountSourceRows(source);

    if (!name || !username || !password) {
      showToast("Vui lòng nhập đủ thông tin trưởng phòng.", true);
      return;
    }
    if (!rows.some((row) => departmentHeadKey(row.name) === departmentHeadKey(name))) {
      showToast("Vui lòng chọn trưởng phòng có sẵn trong danh mục.", true);
      return;
    }
    if (password.length < 4) {
      showToast("Mật khẩu phải có ít nhất 4 ký tự.", true);
      return;
    }
    if (state.accounts.some((account) => account.username === username)) {
      showToast("Tên tài khoản đã tồn tại.", true);
      return;
    }

    const account = {
      id: makeId("account"),
      role: ROLE_DEPARTMENT_HEAD,
      accessTypes: [FIVE_S_PERIOD_TYPE, SAFETY_PERIOD_TYPE],
      rolesByType: { [FIVE_S_PERIOD_TYPE]: ROLE_DEPARTMENT_HEAD, [SAFETY_PERIOD_TYPE]: ROLE_DEPARTMENT_HEAD },
      name,
      departmentHeadName: name,
      departmentHeadSource: source,
      displayName: displayName || name,
      username,
      password,
      areaIds: [],
      fiveSAreaIds: [],
      safetyAreaIds: [],
      createdAt: new Date().toISOString(),
    };

    state.accounts.push(account);
    await Promise.all([
      dbRef(`accounts/${account.id}`).set(account),
      logAdminChange({
        subjectLabel: "Tài khoản trưởng phòng",
        afterLabel: describeAccountForScope(account, activeAccountScope),
        changeLabel: `Thêm tài khoản trưởng phòng ${username}`,
        scope: "",
      }),
    ]);

    elements.departmentHeadAccountForm?.reset();
    populateDepartmentHeadAccountSelect();
    showToast("Đã thêm tài khoản trưởng phòng.");
    renderAll();
  }

  function editScorer(id) {
    if (!requireAdminAction()) {
      return;
    }

    const catalogType = activeCatalogScope;
    const periodId = getActivePeriodId(catalogType);
    const manager = getMutablePeriodManagers(catalogType, periodId).find((item) => item.id === id) || null;
    if (!manager) {
      return;
    }

    openFormModal({
      title: "Sửa người phụ trách zone",
      html: "<label>" +
        "<span>Tên người phụ trách zone / người được đánh giá</span>" +
        "<input name=\"name\" type=\"text\" value=\"" + escapeHtml(manager.name) + "\" required>" +
      "</label>",
      async onSubmit(formData) {
        const name = String(formData.get("name") || "").trim();
        if (!name) {
          showToast("Tên người phụ trách zone không được trống.", true);
          return false;
        }

        const beforeSnapshot = capturePeriodSnapshot(periodId);
        const beforeCatalog = captureCatalogState(catalogType);
        const beforeName = manager.name;
        manager.name = name;
        getMutablePeriodAreas(catalogType, periodId)
          .filter((area) => area.scorerId === manager.id)
          .forEach((area) => {
            area.responsibleName = name;
          });
        await Promise.all([
          saveCatalogPeriodSnapshot(catalogType, periodId),
          logAdminChange({
            subjectLabel: "Người phụ trách zone",
            beforeLabel: beforeName,
            afterLabel: name,
            changeLabel: "Sửa người phụ trách zone " + beforeName,
            scope: catalogType,
            periodId,
          }),
        ]);
        const afterSnapshot = capturePeriodSnapshot(periodId);
        const afterCatalog = captureCatalogState(catalogType);
        pushUndoAction({
          type: "catalogOrSettings",
          description: `Sửa người phụ trách: ${beforeName} → ${name}`,
          targetPeriodId: periodId,
          catalogType,
          beforeSnapshot,
          afterSnapshot,
          beforeCatalog,
          afterCatalog,
        });
        showToast("Đã cập nhật người phụ trách zone.");
        renderAll();
        return true;
      },
    });
  }

  function editDepartmentHeadEmail(name) {
    if (!requireAdminAction()) {
      return;
    }

    const cleanName = normalizeDepartmentHeadName(name);
    if (!cleanName) {
      return;
    }

    const row = getDepartmentHeadRows(getActivePeriodId(activeCatalogScope)).find((item) => departmentHeadKey(item.name) === departmentHeadKey(cleanName));
    openFormModal({
      title: "Email trưởng phòng",
      html: "<div class=\"modal-context\">" +
        "<span><strong>Trưởng phòng:</strong> " + escapeHtml(cleanName) + "</span>" +
        "<span><strong>Zone:</strong> " + escapeHtml(row?.areaCodes?.join(", ") || "chưa gán zone") + "</span>" +
      "</div>" +
      "<label>" +
        "<span>Email trưởng phòng</span>" +
        "<textarea name=\"emails\" placeholder=\"Mỗi email cách nhau bằng dấu phẩy hoặc xuống dòng\">" + escapeHtml(formatEmailList(row?.emails)) + "</textarea>" +
      "</label>",
      async onSubmit(formData) {
        const result = await saveDepartmentHeadEmails(cleanName, formData.get("emails"), activeCatalogScope);
        if (result.ok) {
          showToast(result.changed ? "Đã lưu email trưởng phòng." : "Email trưởng phòng không thay đổi.");
          refreshDepartmentHeadEmailUi();
        }
        return result.ok;
      },
    });
  }

  function clearDepartmentHeadEmail(name) {
    if (!requireAdminAction()) {
      return;
    }

    const cleanName = normalizeDepartmentHeadName(name);
    if (!cleanName) {
      return;
    }

    openConfirmModal({
      title: "Xóa email trưởng phòng",
      message: "Xóa toàn bộ email của trưởng phòng " + cleanName + "?",
      confirmText: "Xóa email",
      danger: true,
      renderAfter: false,
      async onConfirm() {
        const result = await saveDepartmentHeadEmails(cleanName, [], activeCatalogScope);
        if (result.ok) {
          showToast(result.changed ? "Đã xóa email trưởng phòng." : "Email trưởng phòng đã trống.");
          refreshDepartmentHeadEmailUi();
        }
      },
    });
  }

  function deleteScorer(id) {
    if (!requireAdminAction()) {
      return;
    }

    const catalogType = activeCatalogScope;
    const periodId = getActivePeriodId(catalogType);
    const managers = getMutablePeriodManagers(catalogType, periodId);
    const manager = managers.find((item) => item.id === id) || null;
    if (!manager) {
      return;
    }

    if (getAreasForPeriod(periodId).some((area) => area.scorerId === id)) {
      showToast("Người phụ trách zone đang được gán zone trong kỳ này, hãy đổi zone trước khi xóa.", true);
      return;
    }

    openConfirmModal({
      title: "Xóa người phụ trách zone",
      message: `Xóa ${manager.name}?`,
      confirmText: "Xóa",
      danger: true,
      async onConfirm() {
        const beforeSnapshot = capturePeriodSnapshot(periodId);
        const beforeCatalog = captureCatalogState(catalogType);
        const index = managers.findIndex((item) => item.id === id);
        if (index >= 0) {
          managers.splice(index, 1);
        }
        await Promise.all([
          saveCatalogPeriodSnapshot(catalogType, periodId),
          logAdminChange({
            subjectLabel: "Người phụ trách zone",
            beforeLabel: manager.name,
            afterLabel: "Đã xóa",
            changeLabel: `Xóa người phụ trách zone ${manager.name}`,
            scope: catalogType,
            periodId,
          }),
        ]);
        const afterSnapshot = capturePeriodSnapshot(periodId);
        const afterCatalog = captureCatalogState(catalogType);
        pushUndoAction({
          type: "catalogOrSettings",
          description: `Xóa người phụ trách: ${manager.name}`,
          targetPeriodId: periodId,
          catalogType,
          beforeSnapshot,
          afterSnapshot,
          beforeCatalog,
          afterCatalog,
        });
        showToast("Đã xóa người phụ trách zone.");
      },
    });
  }

  function editAssessor(id) {
    if (!requireAdminAction()) {
      return;
    }

    const catalogType = activeCatalogScope;
    const periodId = getActivePeriodId(catalogType);
    const assessor = getMutablePeriodAssessors(catalogType, periodId).find((item) => item.id === id) || null;
    if (!assessor) {
      return;
    }

    const currentAssignedAreaIds = getAssessorAreaIds(assessor.id, catalogType, periodId);

    openFormModal({
      title: "Sửa assessor",
      html: `
        <label>
          <span>Tên assessor</span>
          <input name="name" type="text" value="${escapeHtml(assessor.name)}" required>
        </label>
        <div class="form-field">
          <span style="font-weight: 600;">Zone ${escapeHtml(getAccountScopeLabel(catalogType))} được chấm</span>
          <div class="zone-check-list" style="max-height: 200px; overflow-y: auto;">
            ${areaCheckboxListHtml(currentAssignedAreaIds, catalogType, periodId)}
          </div>
        </div>
      `,
      async onSubmit(formData, form) {
        const name = String(formData.get("name") || "").trim();
        if (!name) {
          showToast("Tên assessor không được trống.", true);
          return false;
        }

        if (getPeriodCatalogAssessors(catalogType, periodId).some((item) => item.id !== id && item.name.toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi"))) {
          showToast("Assessor này đã tồn tại trong kỳ đang mở.", true);
          return false;
        }

        const checkedAreaIds = getCheckedAreaIds(form);
        const beforeSnapshot = capturePeriodSnapshot(periodId);
        const beforeCatalog = captureCatalogState(catalogType);
        const beforeName = assessor.name;
        assessor.name = name;

        const rootAssessors = getMutableAssessors(catalogType);
        const rootAssessor = rootAssessors.find((item) => item.id === id);
        if (rootAssessor) {
          rootAssessor.name = name;
        }

        await setAssessorAreaIds(assessor.id, checkedAreaIds, catalogType, periodId);

        const areas = getMutablePeriodAreas(catalogType, periodId);
        areas.forEach((area) => {
          if (area.assessorId === assessor.id) {
            area.assessorName = name;
          }
        });

        const rootAreas = getMutableAreas(catalogType);
        if (Array.isArray(rootAreas)) {
          rootAreas.forEach((area) => {
            if (area.assessorId === assessor.id) {
              area.assessorName = name;
            }
          });
        }

        const affectedAccounts = state.accounts.filter((account) => hasAccountAccessType(account, catalogType) && getAccountPersonId(account, catalogType) === assessor.id);
        affectedAccounts.forEach((account) => {
          account.name = name;
        });

        const dbWrites = [
          saveCatalogPeriodSnapshot(catalogType, periodId),
          ...affectedAccounts.map((account) => dbRef(`accounts/${account.id}`).set(account)),
          logAdminChange({
            subjectLabel: "Assessor",
            beforeLabel: beforeName,
            afterLabel: name,
            changeLabel: `Sửa assessor ${beforeName}`,
            scope: catalogType,
            periodId,
          }),
        ];
        if (rootAssessor) {
          dbWrites.push(dbRef(`${catalogDbPath(catalogType, "assessors")}/${id}`).set(rootAssessor));
        }
        if (Array.isArray(rootAreas)) {
          rootAreas.forEach((a) => {
            if (a.assessorId === assessor.id) {
              dbWrites.push(dbRef(`${catalogDbPath(catalogType, "areas")}/${a.id}`).set(a));
            }
          });
        }

        await Promise.all(dbWrites);
        const afterSnapshot = capturePeriodSnapshot(periodId);
        const afterCatalog = captureCatalogState(catalogType);
        pushUndoAction({
          type: "catalogOrSettings",
          description: `Sửa assessor: ${beforeName} → ${name}`,
          targetPeriodId: periodId,
          catalogType,
          beforeSnapshot,
          afterSnapshot,
          beforeCatalog,
          afterCatalog,
        });
        showToast("Đã cập nhật assessor.");
        renderAll();
        return true;
      },
    });
  }

  function deleteAssessor(id) {
    if (!requireAdminAction()) {
      return;
    }

    const catalogType = activeCatalogScope;
    const periodId = getActivePeriodId(catalogType);
    const assessors = getMutablePeriodAssessors(catalogType, periodId);
    const assessor = assessors.find((item) => item.id === id) || null;
    if (!assessor) {
      return;
    }

    const usedByZones = getAreasForPeriod(periodId).filter((area) => area.assessorId === id);
    const usedByAccounts = state.accounts.filter((account) => hasAccountAccessType(account, catalogType) && getAccountPersonId(account, catalogType) === id);
    if (usedByZones.length || usedByAccounts.length) {
      const zones = usedByZones.map((area) => area.code).join(", ") || "không có";
      const accounts = usedByAccounts.map((account) => account.username).join(", ") || "không có";
      showToast(`Assessor đang được dùng. Zone: ${zones}; tài khoản: ${accounts}.`, true);
      return;
    }

    openConfirmModal({
      title: "Xóa assessor",
      message: `Xóa assessor ${assessor.name}?`,
      confirmText: "Xóa",
      danger: true,
      async onConfirm() {
        const beforeSnapshot = capturePeriodSnapshot(periodId);
        const beforeCatalog = captureCatalogState(catalogType);
        const index = assessors.findIndex((item) => item.id === id);
        if (index >= 0) {
          assessors.splice(index, 1);
        }
        const rootAssessors = getMutableAssessors(catalogType);
        const rootIndex = rootAssessors.findIndex((item) => item.id === id);
        if (rootIndex >= 0) {
          rootAssessors.splice(rootIndex, 1);
        }
        await Promise.all([
          saveCatalogPeriodSnapshot(catalogType, periodId),
          dbRef(`${catalogDbPath(catalogType, "assessors")}/${id}`).remove(),
          logAdminChange({
            subjectLabel: "Assessor",
            beforeLabel: assessor.name,
            afterLabel: "Đã xóa",
            changeLabel: `Xóa assessor ${assessor.name}`,
            scope: catalogType,
            periodId,
          }),
        ]);
        const afterSnapshot = capturePeriodSnapshot(periodId);
        const afterCatalog = captureCatalogState(catalogType);
        pushUndoAction({
          type: "catalogOrSettings",
          description: `Xóa assessor: ${assessor.name}`,
          targetPeriodId: periodId,
          catalogType,
          beforeSnapshot,
          afterSnapshot,
          beforeCatalog,
          afterCatalog,
        });
        showToast("Đã xóa assessor.");
      },
    });
  }

  function editArea(id, periodId = "") {
    if (!requireAdminAction()) {
      return;
    }

    const targetPeriodId = periodId || getActivePeriodId(activeCatalogScope);
    if (blockIfArchivedPeriod(targetPeriodId)) {
      return;
    }

    const catalogType = targetPeriodId ? getCatalogTypeForPeriod(targetPeriodId) : activeCatalogScope;
    const isSnapshotEdit = shouldEditPeriodSnapshot(targetPeriodId);
    const useCatalogSelectors = !periodId;
    const area = isSnapshotEdit ? getAreaForPeriod(targetPeriodId, id) : getArea(id, catalogType);
    const period = getPeriod(targetPeriodId);
    if (!area) {
      return;
    }

    const deptHeadRows = getDepartmentHeadRows(targetPeriodId);
    const currentDeptHeadClean = normalizeDepartmentHeadName(area.departmentHead);
    const hasCatalogDeptHead = Boolean(currentDeptHeadClean && deptHeadRows.some((row) => departmentHeadKey(row.name) === departmentHeadKey(currentDeptHeadClean)));
    const initialDeptHeadMode = hasCatalogDeptHead ? "catalog" : (currentDeptHeadClean ? "custom" : "catalog");

    const hasCatalogScorer = Boolean(area.scorerId && getPeriodCatalogManager(targetPeriodId, area.scorerId));
    const initialScorerMode = hasCatalogScorer ? "catalog" : "custom";

    const hasCatalogAssessor = Boolean(area.assessorId && getPeriodCatalogAssessor(targetPeriodId, area.assessorId));
    const initialAssessorMode = hasCatalogAssessor ? "catalog" : (getAreaConfiguredAssessorNameForPeriod(targetPeriodId, area) ? "custom" : "catalog");

    const isSafety = catalogType === SAFETY_PERIOD_TYPE;

    openFormModal({
      title: "Sửa zone",
      html: `
        ${isSnapshotEdit ? `<div class="modal-context"><span>${useCatalogSelectors ? `Đang sửa danh mục riêng của ${escapeHtml(periodLabel(period))}.` : `Đang sửa trực tiếp trên bảng ${escapeHtml(periodLabel(period))}; có thể chọn từ danh mục hoặc nhập tên mới.`}</span></div>` : ""}
        <label>
          <span>Mã zone</span>
          <input name="code" type="text" value="${escapeHtml(area.code)}" required>
        </label>

        <div class="form-field" style="display: flex; flex-direction: column; gap: 6px;">
          <span style="font-weight: 600;">Trưởng phòng</span>
          <div style="display: flex; gap: 16px; margin: 2px 0 6px;">
            <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.9rem;">
              <input type="radio" name="deptHeadMode" value="catalog" class="mode-radio" ${initialDeptHeadMode === "catalog" ? "checked" : ""} style="width: 14px; height: 14px; min-height: 14px; margin: 0; cursor: pointer; accent-color: #0b7f87; vertical-align: middle; flex-shrink: 0;">
              <span>Chọn từ danh mục có sẵn</span>
            </label>
            <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.9rem;">
              <input type="radio" name="deptHeadMode" value="custom" class="mode-radio" ${initialDeptHeadMode === "custom" ? "checked" : ""} style="width: 14px; height: 14px; min-height: 14px; margin: 0; cursor: pointer; accent-color: #0b7f87; vertical-align: middle; flex-shrink: 0;">
              <span>Nhập / sửa tên mới</span>
            </label>
          </div>
          <select name="departmentHeadSelect" id="edit-area-depthead-select" style="${initialDeptHeadMode === 'catalog' ? '' : 'display: none;'}">
            ${departmentHeadOptions(area.departmentHead, true, targetPeriodId)}
          </select>
          <input name="departmentHeadCustom" id="edit-area-depthead-name" type="text" value="${escapeHtml(area.departmentHead || "")}" placeholder="Nhập tên trưởng phòng mới..." style="${initialDeptHeadMode === 'custom' ? '' : 'display: none;'}">
        </div>

        ${!isSafety ? `
        <label>
          <span>Nhóm tổng điểm cuối bảng</span>
          <input name="summaryGroup" type="text" value="${escapeHtml(area.summaryGroup || "")}">
        </label>
        ` : ""}

        <div class="form-field" style="display: flex; flex-direction: column; gap: 6px;">
          <span style="font-weight: 600;">Người phụ trách zone / người được đánh giá</span>
          <div style="display: flex; gap: 16px; margin: 2px 0 6px;">
            <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.9rem;">
              <input type="radio" name="scorerMode" value="catalog" class="mode-radio" ${initialScorerMode === "catalog" ? "checked" : ""} style="width: 14px; height: 14px; min-height: 14px; margin: 0; cursor: pointer; accent-color: #0b7f87; vertical-align: middle; flex-shrink: 0;">
              <span>Chọn từ danh mục có sẵn</span>
            </label>
            <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.9rem;">
              <input type="radio" name="scorerMode" value="custom" class="mode-radio" ${initialScorerMode === "custom" ? "checked" : ""} style="width: 14px; height: 14px; min-height: 14px; margin: 0; cursor: pointer; accent-color: #0b7f87; vertical-align: middle; flex-shrink: 0;">
              <span>Nhập / sửa tên mới</span>
            </label>
          </div>
          <select name="scorerId" id="edit-area-scorer-id" style="${initialScorerMode === 'catalog' ? '' : 'display: none;'}">
            ${managerOptions(area.scorerId, true, catalogType, targetPeriodId)}
          </select>
          <input name="responsibleName" id="edit-area-responsible-name" type="text" value="${escapeHtml(getAreaResponsibleNameForPeriod(targetPeriodId, area))}" placeholder="Nhập tên người phụ trách mới..." style="${initialScorerMode === 'custom' ? '' : 'display: none;'}">
        </div>

        ${isSafety ? `
        <div class="form-field" style="display: flex; flex-direction: column; gap: 6px;">
          <span style="font-weight: 600;">Danh sách assessor đang chấm zone này</span>
          <div class="zone-check-list" style="max-height: 200px; overflow-y: auto;">
            ${assessorCheckboxListHtml(area.assessorIds || (area.assessorId ? [area.assessorId] : []), catalogType, targetPeriodId)}
          </div>
        </div>
        ` : `
        <div class="form-field" style="display: flex; flex-direction: column; gap: 6px;">
          <span style="font-weight: 600;">Assessor mặc định trên dòng cuối</span>
          <div style="display: flex; gap: 16px; margin: 2px 0 6px;">
            <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.9rem;">
              <input type="radio" name="assessorMode" value="catalog" class="mode-radio" ${initialAssessorMode === "catalog" ? "checked" : ""} style="width: 14px; height: 14px; min-height: 14px; margin: 0; cursor: pointer; accent-color: #0b7f87; vertical-align: middle; flex-shrink: 0;">
              <span>Chọn từ danh mục có sẵn</span>
            </label>
            <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.9rem;">
              <input type="radio" name="assessorMode" value="custom" class="mode-radio" ${initialAssessorMode === "custom" ? "checked" : ""} style="width: 14px; height: 14px; min-height: 14px; margin: 0; cursor: pointer; accent-color: #0b7f87; vertical-align: middle; flex-shrink: 0;">
              <span>Nhập / sửa tên mới</span>
            </label>
          </div>
          <select name="assessorId" id="edit-area-assessor-id" style="${initialAssessorMode === 'catalog' ? '' : 'display: none;'}">
            ${assessorOptions(area.assessorId, true, catalogType, targetPeriodId)}
          </select>
          <input name="assessorName" id="edit-area-assessor-name" type="text" value="${escapeHtml(getAreaConfiguredAssessorNameForPeriod(targetPeriodId, area))}" placeholder="Nhập tên assessor mới..." style="${initialAssessorMode === 'custom' ? '' : 'display: none;'}">
        </div>

        <label class="check-line">
          <input name="highlight" type="checkbox" ${area.highlight ? "checked" : ""}>
          <span>Tô vàng mã zone</span>
        </label>
        `}
      `,
      async onSubmit(formData, form) {
        const beforeSnapshot = capturePeriodSnapshot(targetPeriodId);
        const beforeCatalog = captureCatalogState(catalogType);
        const previousDepartmentHead = String(area.departmentHead || "").trim();
        const previousSummaryGroup = String(area.summaryGroup || "").trim();
        const beforeLabel = `${area.code} · ${area.departmentHead || "-"} · ${area.summaryGroup || "-"} · ${getAreaResponsibleNameForPeriod(targetPeriodId, area)} · Assessor: ${getAreaConfiguredAssessorNameForPeriod(targetPeriodId, area) || "-"}`;
        area.code = String(formData.get("code") || "").trim();

        const deptHeadMode = String(formData.get("deptHeadMode") || "catalog");
        let nextDepartmentHead = "";
        if (deptHeadMode === "catalog") {
          nextDepartmentHead = normalizeDepartmentHeadName(String(formData.get("departmentHeadSelect") || "").trim());
        } else {
          nextDepartmentHead = normalizeDepartmentHeadName(String(formData.get("departmentHeadCustom") || "").trim());
        }
        area.departmentHead = nextDepartmentHead;

        if (nextDepartmentHead) {
          ensureDepartmentHeadContactForPeriod(nextDepartmentHead, catalogType, targetPeriodId);
          ensureDepartmentHeadContact(nextDepartmentHead, catalogType);
        }

        const submittedSummaryGroup = String(formData.get("summaryGroup") || "").trim();
        const allPeriodAreas = isSnapshotEdit ? getAreasForPeriod(targetPeriodId) : getAreas(catalogType);
        const otherPeerAreas = allPeriodAreas.filter((a) => a.id !== area.id);

        if (nextDepartmentHead) {
          const peerAreasOfNextDept = otherPeerAreas.filter((a) => (
            a.departmentHead && a.departmentHead.trim() === nextDepartmentHead
          ));
          const existingSummaryOfNextDept = peerAreasOfNextDept.find((a) => String(a.summaryGroup || "").trim())?.summaryGroup?.trim();

          if (nextDepartmentHead !== previousDepartmentHead) {
            if (existingSummaryOfNextDept) {
              if (!submittedSummaryGroup || submittedSummaryGroup === previousSummaryGroup || submittedSummaryGroup === existingSummaryOfNextDept) {
                area.summaryGroup = existingSummaryOfNextDept;
              } else {
                area.summaryGroup = submittedSummaryGroup;
                peerAreasOfNextDept.forEach((peer) => {
                  peer.summaryGroup = submittedSummaryGroup;
                });
              }
            } else {
              area.summaryGroup = submittedSummaryGroup || nextDepartmentHead;
            }
          } else {
            area.summaryGroup = submittedSummaryGroup || existingSummaryOfNextDept || nextDepartmentHead;
            peerAreasOfNextDept.forEach((peer) => {
              peer.summaryGroup = area.summaryGroup;
            });
          }
        } else {
          area.summaryGroup = submittedSummaryGroup;
        }

        const scorerMode = String(formData.get("scorerMode") || "catalog");
        const managers = getMutablePeriodManagers(catalogType, targetPeriodId);

        if (scorerMode === "catalog") {
          const selectedScorerId = String(formData.get("scorerId") || "").trim();
          const selectedManager = selectedScorerId ? managers.find((m) => m.id === selectedScorerId) : null;
          if (selectedManager) {
            area.scorerId = selectedManager.id;
            area.responsibleName = selectedManager.name;
          } else {
            area.scorerId = "";
            area.responsibleName = "";
          }
        } else {
          const customName = String(formData.get("responsibleName") || "").trim();
          if (customName) {
            const matchedManager = managers.find((m) => m.name.toLocaleLowerCase("vi") === customName.toLocaleLowerCase("vi"));
            if (matchedManager) {
              area.scorerId = matchedManager.id;
              area.responsibleName = matchedManager.name;
            } else {
              const newManager = {
                id: makeId(catalogType === SAFETY_PERIOD_TYPE ? "safety-scorer" : "scorer"),
                name: customName,
                emails: [],
                createdAt: new Date().toISOString(),
              };
              managers.push(newManager);
              const rootManagers = getMutableManagers(catalogType);
              if (!rootManagers.some((m) => m.name.toLocaleLowerCase("vi") === customName.toLocaleLowerCase("vi"))) {
                rootManagers.push({ ...newManager });
              }
              area.scorerId = newManager.id;
              area.responsibleName = customName;
            }
          } else {
            area.scorerId = "";
            area.responsibleName = "";
          }
        }

        if (isSafety) {
          const checkedAssessorIds = getCheckedAssessorIds(form);
          area.assessorIds = checkedAssessorIds;
          if (!checkedAssessorIds.includes(area.assessorId)) {
            area.assessorId = checkedAssessorIds[0] || "";
            area.assessorName = checkedAssessorIds[0] ? (getPeriodCatalogAssessor(targetPeriodId, checkedAssessorIds[0])?.name || "") : "";
          }
          area.highlight = false;

          const checkedSet = new Set(checkedAssessorIds);
          const affectedAccounts = [];
          (state.accounts || []).forEach((account) => {
            if (hasAccountAccessType(account, catalogType)) {
              const personId = getAccountPersonId(account, catalogType);
              if (personId) {
                const accAreaIds = new Set(getAccountAreaIds(account, catalogType));
                const hadArea = accAreaIds.has(area.id);
                if (checkedSet.has(personId)) {
                  if (!hadArea) {
                    accAreaIds.add(area.id);
                    setAccountAreaIds(account, catalogType, [...accAreaIds]);
                    affectedAccounts.push(account);
                  }
                } else {
                  if (hadArea) {
                    accAreaIds.delete(area.id);
                    setAccountAreaIds(account, catalogType, [...accAreaIds]);
                    affectedAccounts.push(account);
                  }
                }
              }
            }
          });
          if (affectedAccounts.length) {
            await Promise.all(affectedAccounts.map((acc) => dbRef(`accounts/${acc.id}`).set(acc)));
          }
        } else {
          const assessorMode = String(formData.get("assessorMode") || "catalog");
          const assessors = getMutablePeriodAssessors(catalogType, targetPeriodId);

          if (assessorMode === "catalog") {
            const selectedAssessorId = String(formData.get("assessorId") || "").trim();
            const selectedAssessor = selectedAssessorId ? assessors.find((a) => a.id === selectedAssessorId) : null;
            if (selectedAssessor) {
              area.assessorId = selectedAssessor.id;
              area.assessorName = selectedAssessor.name;
            } else {
              area.assessorId = "";
              area.assessorName = "";
            }
          } else {
            const customAssessorName = String(formData.get("assessorName") || "").trim();
            if (customAssessorName) {
              const matchedAssessor = assessors.find((a) => a.name.toLocaleLowerCase("vi") === customAssessorName.toLocaleLowerCase("vi"));
              if (matchedAssessor) {
                area.assessorId = matchedAssessor.id;
                area.assessorName = matchedAssessor.name;
              } else {
                const newAssessor = {
                  id: makeId(catalogType === SAFETY_PERIOD_TYPE ? "safety-assessor" : "assessor"),
                  name: customAssessorName,
                  emails: [],
                  createdAt: new Date().toISOString(),
                };
                assessors.push(newAssessor);
                const rootAssessors = getMutableAssessors(catalogType);
                if (!rootAssessors.some((a) => a.name.toLocaleLowerCase("vi") === customAssessorName.toLocaleLowerCase("vi"))) {
                  rootAssessors.push({ ...newAssessor });
                }
                area.assessorId = newAssessor.id;
                area.assessorName = customAssessorName;
              }
            } else {
              area.assessorId = "";
              area.assessorName = "";
            }
          }

          area.highlight = formData.get("highlight") === "on";
        }

        if (isSnapshotEdit) {
          const targetPeriod = getPeriod(targetPeriodId);
          targetPeriod.settingsSnapshot.departmentHeadContacts = moveDepartmentHeadEmails(
            previousDepartmentHead,
            area.departmentHead,
            targetPeriod.settingsSnapshot?.departmentHeadContacts,
            targetPeriod.settingsSnapshot?.areas,
            targetPeriod.settingsSnapshot?.managers,
          );
          await savePeriodSnapshot(targetPeriod);
          const rootManagerWrites = getManagers(catalogType).map((m) => dbRef(`${catalogDbPath(catalogType, "managers")}/${m.id}`).set(m));
          const rootAssessorWrites = getAssessors(catalogType).map((a) => dbRef(`${catalogDbPath(catalogType, "assessors")}/${a.id}`).set(a));
          const rootDeptHeadWrites = getDepartmentHeadContacts(catalogType).map((contact) => saveDepartmentHeadContact(contact, catalogType));
          await Promise.all([...rootManagerWrites, ...rootAssessorWrites, ...rootDeptHeadWrites]);
        } else {
          if (catalogType === SAFETY_PERIOD_TYPE) {
            state.safetyDepartmentHeadContacts = moveDepartmentHeadEmails(previousDepartmentHead, area.departmentHead, state.safetyDepartmentHeadContacts, state.safetyAreas, state.safetyManagers);
          } else {
            state.departmentHeadContacts = moveDepartmentHeadEmails(previousDepartmentHead, area.departmentHead, state.departmentHeadContacts, state.areas, state.managers);
          }
          const departmentHeadContactWrites = getDepartmentHeadContacts(catalogType).map((contact) => saveDepartmentHeadContact(contact, catalogType));
          const managerWrites = getManagers(catalogType).map((m) => dbRef(`${catalogDbPath(catalogType, "managers")}/${m.id}`).set(m));
          const assessorWrites = getAssessors(catalogType).map((a) => dbRef(`${catalogDbPath(catalogType, "assessors")}/${a.id}`).set(a));
          const peerWrites = !isSnapshotEdit && deptHead
            ? allPeriodAreas.filter((a) => a.id !== area.id && a.departmentHead === deptHead).map((a) => dbRef(`${catalogDbPath(catalogType, "areas")}/${a.id}`).set(a))
            : [];
          await Promise.all([
            dbRef(`${catalogDbPath(catalogType, "areas")}/${area.id}`).set(area),
            ...peerWrites,
            ...managerWrites,
            ...assessorWrites,
            ...departmentHeadContactWrites,
            refreshLatestPeriodSnapshot(catalogType),
          ]);
        }
        await Promise.all([
          logAdminChange({
            subjectLabel: "Zone",
            areaCode: area.code,
            beforeLabel,
            afterLabel: `${area.code} · ${area.departmentHead || "-"} · ${area.summaryGroup || "-"} · ${getAreaResponsibleNameForPeriod(targetPeriodId, area)} · Assessor: ${getAreaConfiguredAssessorNameForPeriod(targetPeriodId, area) || "-"}`,
            changeLabel: `Sửa zone ${area.code}`,
            note: isSnapshotEdit ? `Chỉ áp dụng cho ${periodLabel(period)}` : "",
            scope: catalogType,
            periodId: targetPeriodId,
          }),
        ]);

        const afterSnapshot = capturePeriodSnapshot(targetPeriodId);
        const afterCatalog = captureCatalogState(catalogType);
        pushUndoAction({
          type: "catalogOrSettings",
          description: `Zone ${area.code}: Sửa thông tin zone`,
          targetPeriodId: isSnapshotEdit ? targetPeriodId : null,
          catalogType,
          beforeSnapshot,
          afterSnapshot,
          beforeCatalog,
          afterCatalog,
        });

        showToast("Đã cập nhật zone.");
        renderAll();
        return true;
      },
    });

    const deptHeadRadios = elements.modalBody.querySelectorAll('input[name="deptHeadMode"]');
    const deptHeadSelect = elements.modalBody.querySelector("#edit-area-depthead-select");
    const deptHeadInput = elements.modalBody.querySelector("#edit-area-depthead-name");
    const summaryGroupInput = elements.modalBody.querySelector('input[name="summaryGroup"]');

    function syncSummaryGroupFromDeptHead(deptName) {
      if (!summaryGroupInput) return;
      const cleanName = String(deptName || "").trim();
      if (!cleanName) return;
      const allPeriodAreas = isSnapshotEdit ? getAreasForPeriod(targetPeriodId) : getAreas(catalogType);
      const otherAreas = allPeriodAreas.filter((a) => a.id !== area.id);
      const existingSummary = getDepartmentHeadSummaryGroup(cleanName, otherAreas);
      if (existingSummary) {
        summaryGroupInput.value = existingSummary;
      }
    }

    deptHeadRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (radio.value === "catalog") {
          deptHeadSelect.style.display = "";
          deptHeadInput.style.display = "none";
          syncSummaryGroupFromDeptHead(deptHeadSelect.value);
        } else {
          deptHeadSelect.style.display = "none";
          deptHeadInput.style.display = "";
          if (!deptHeadInput.value && deptHeadSelect.value) {
            deptHeadInput.value = deptHeadSelect.value;
          }
          syncSummaryGroupFromDeptHead(deptHeadInput.value);
        }
      });
    });

    deptHeadSelect?.addEventListener("change", () => {
      if (deptHeadSelect.value) {
        deptHeadInput.value = deptHeadSelect.value;
        syncSummaryGroupFromDeptHead(deptHeadSelect.value);
      }
    });

    deptHeadInput?.addEventListener("input", () => {
      syncSummaryGroupFromDeptHead(deptHeadInput.value);
    });

    const scorerRadios = elements.modalBody.querySelectorAll('input[name="scorerMode"]');
    const scorerSelect = elements.modalBody.querySelector("#edit-area-scorer-id");
    const responsibleInput = elements.modalBody.querySelector("#edit-area-responsible-name");

    scorerRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (radio.value === "catalog") {
          scorerSelect.style.display = "";
          responsibleInput.style.display = "none";
          responsibleInput.required = false;
        } else {
          scorerSelect.style.display = "none";
          responsibleInput.style.display = "";
          responsibleInput.required = true;
          if (!responsibleInput.value && scorerSelect.value) {
            const opt = scorerSelect.options[scorerSelect.selectedIndex];
            if (opt && opt.textContent && scorerSelect.value) {
              responsibleInput.value = opt.textContent.trim();
            }
          }
        }
      });
    });

    scorerSelect?.addEventListener("change", () => {
      const opt = scorerSelect.options[scorerSelect.selectedIndex];
      if (opt && scorerSelect.value) {
        responsibleInput.value = opt.textContent.trim();
      }
    });

    const assessorRadios = elements.modalBody.querySelectorAll('input[name="assessorMode"]');
    const assessorSelect = elements.modalBody.querySelector("#edit-area-assessor-id");
    const assessorInput = elements.modalBody.querySelector("#edit-area-assessor-name");

    assessorRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (radio.value === "catalog") {
          assessorSelect.style.display = "";
          assessorInput.style.display = "none";
        } else {
          assessorSelect.style.display = "none";
          assessorInput.style.display = "";
          if (!assessorInput.value && assessorSelect.value) {
            const opt = assessorSelect.options[assessorSelect.selectedIndex];
            if (opt && opt.textContent && assessorSelect.value) {
              assessorInput.value = opt.textContent.trim();
            }
          }
        }
      });
    });

    assessorSelect?.addEventListener("change", () => {
      const opt = assessorSelect.options[assessorSelect.selectedIndex];
      if (opt && assessorSelect.value) {
        assessorInput.value = opt.textContent.trim();
      }
    });
  }

  function deleteArea(id) {
    if (!requireAdminAction()) {
      return;
    }

    const catalogType = activeCatalogScope;
    const periodId = getActivePeriodId(catalogType);
    const areas = getMutablePeriodAreas(catalogType, periodId);
    const area = areas.find((item) => item.id === id) || null;
    if (!area) {
      return;
    }

    openConfirmModal({
      title: "Xóa zone",
      message: `Xóa zone ${area.code}? Điểm của zone này trong dữ liệu nội bộ cũng sẽ bị xóa.`,
      confirmText: "Xóa",
      danger: true,
      async onConfirm() {
        const beforeSnapshot = capturePeriodSnapshot(periodId);
        const beforeCatalog = captureCatalogState(catalogType);
        const removedScores = catalogType === FIVE_S_PERIOD_TYPE ? state.scores.filter((score) => score.periodId === periodId && score.areaId === id) : [];
        const removedSafetyRecords = catalogType === SAFETY_PERIOD_TYPE ? state.safetyRecords.filter((record) => record.periodId === periodId && record.areaId === id) : [];
        const removedDeletedMarkers = catalogType === SAFETY_PERIOD_TYPE ? (state.deletedSafetyRecords || []).filter((marker) => marker.periodId === periodId && marker.areaId === id) : [];
        const areaIndex = areas.findIndex((item) => item.id === id);
        if (areaIndex >= 0) {
          areas.splice(areaIndex, 1);
        }
        if (catalogType === FIVE_S_PERIOD_TYPE) {
          state.scores = state.scores.filter((score) => score.periodId !== periodId || score.areaId !== id);
          invalidateScoreRecordIndex();
        } else {
          state.safetyRecords = state.safetyRecords.filter((record) => record.periodId !== periodId || record.areaId !== id);
          state.deletedSafetyRecords = (state.deletedSafetyRecords || []).filter((marker) => marker.periodId !== periodId || marker.areaId !== id);
        }
        const deleteUpdates = {};
        removedScores.forEach((score) => {
          deleteUpdates[`scores/${score.id}`] = null;
        });
        removedSafetyRecords.forEach((record) => {
          deleteUpdates[`safetyRecords/${record.id}`] = null;
        });
        removedDeletedMarkers.forEach((marker) => {
          deleteUpdates[`deletedSafetyRecords/${marker.id}`] = null;
        });
        await saveCatalogPeriodSnapshot(catalogType, periodId);
        if (Object.keys(deleteUpdates).length) {
          await updateRootWithOptionalRenderSuppression(deleteUpdates, { suppressRender: true });
        }
        await deleteUnusedPhotoFiles(collectPhotoUrls([...removedScores, ...removedSafetyRecords]));
        await logAdminChange({
          subjectLabel: "Zone",
          areaCode: area.code,
          beforeLabel: `${area.code} · ${area.departmentHead || "-"} · ${area.summaryGroup || "-"} · ${getAreaResponsibleNameForPeriod(periodId, area)}`,
          afterLabel: "Đã xóa",
          changeLabel: `Xóa zone ${area.code}`,
          note: catalogType === SAFETY_PERIOD_TYPE ? "Chỉ xóa dữ liệu AT của zone trong kỳ đang mở" : "Chỉ xóa điểm 5S của zone trong kỳ đang mở",
          scope: catalogType,
          periodId,
        });
        const afterSnapshot = capturePeriodSnapshot(periodId);
        const afterCatalog = captureCatalogState(catalogType);
        pushUndoAction({
          type: "catalogOrSettings",
          description: `Xóa zone: ${area.code}`,
          targetPeriodId: periodId,
          catalogType,
          beforeSnapshot,
          afterSnapshot,
          beforeCatalog,
          afterCatalog,
        });
        showToast("Đã xóa zone.");
      },
    });
  }

  function editDepartmentHeadAreas(affectedAreas = [], periodId = "", fallbackName = "") {
    if (!requireAdminAction()) {
      return;
    }

    const targetPeriodId = periodId || getActivePeriodId(activeCatalogScope);
    if (blockIfArchivedPeriod(targetPeriodId)) {
      return;
    }

    const catalogType = targetPeriodId ? getCatalogTypeForPeriod(targetPeriodId) : activeCatalogScope;
    const isSnapshotEdit = shouldEditPeriodSnapshot(targetPeriodId);
    const period = getPeriod(targetPeriodId);
    const areaIds = new Set((affectedAreas || []).map((area) => area?.id).filter(Boolean));
    const areas = (isSnapshotEdit ? getAreasForPeriod(targetPeriodId) : getAreas(catalogType))
      .filter((area) => areaIds.has(area.id));
    if (!areas.length) {
      return;
    }
    const headNames = [...new Set(areas.map((area) => area.departmentHead || ""))];
    const currentName = headNames.length === 1 ? headNames[0] : String(fallbackName || "").trim();

    const deptHeadRows = getDepartmentHeadRows(targetPeriodId);
    const currentDeptHeadClean = normalizeDepartmentHeadName(currentName);
    const hasCatalogDeptHead = Boolean(currentDeptHeadClean && deptHeadRows.some((row) => departmentHeadKey(row.name) === departmentHeadKey(currentDeptHeadClean)));
    const initialDeptHeadMode = hasCatalogDeptHead ? "catalog" : (currentDeptHeadClean ? "custom" : "catalog");

    openFormModal({
      title: "Sửa trưởng phòng",
      html: `
        <div class="modal-context">
          <span>Áp dụng cho zone: ${escapeHtml(areas.map((area) => area.code).join(", "))}</span>
          ${isSnapshotEdit ? `<span>Chỉ áp dụng cho ${escapeHtml(periodLabel(period))}; kỳ khác không bị đổi.</span>` : ""}
        </div>

        <div class="form-field" style="display: flex; flex-direction: column; gap: 6px;">
          <span style="font-weight: 600;">Tên trưởng phòng</span>
          <div style="display: flex; gap: 16px; margin: 2px 0 6px;">
            <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.9rem;">
              <input type="radio" name="deptHeadMode" value="catalog" class="mode-radio" ${initialDeptHeadMode === "catalog" ? "checked" : ""} style="width: 14px; height: 14px; min-height: 14px; margin: 0; cursor: pointer; accent-color: #0b7f87; vertical-align: middle; flex-shrink: 0;">
              <span>Chọn từ danh mục có sẵn</span>
            </label>
            <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.9rem;">
              <input type="radio" name="deptHeadMode" value="custom" class="mode-radio" ${initialDeptHeadMode === "custom" ? "checked" : ""} style="width: 14px; height: 14px; min-height: 14px; margin: 0; cursor: pointer; accent-color: #0b7f87; vertical-align: middle; flex-shrink: 0;">
              <span>Nhập / sửa tên mới</span>
            </label>
          </div>
          <select name="departmentHeadSelect" id="edit-depthead-group-select" style="${initialDeptHeadMode === 'catalog' ? '' : 'display: none;'}">
            ${departmentHeadOptions(currentName, true, targetPeriodId)}
          </select>
          <input name="departmentHeadCustom" id="edit-depthead-group-input" type="text" value="${escapeHtml(currentName)}" placeholder="Nhập tên trưởng phòng mới..." style="${initialDeptHeadMode === 'custom' ? '' : 'display: none;'}">
        </div>
      `,
      async onSubmit(formData) {
        const beforeSnapshot = capturePeriodSnapshot(targetPeriodId);
        const beforeCatalog = captureCatalogState(catalogType);
        const deptHeadMode = String(formData.get("deptHeadMode") || "catalog");
        let nextName = "";
        if (deptHeadMode === "catalog") {
          nextName = normalizeDepartmentHeadName(String(formData.get("departmentHeadSelect") || "").trim());
        } else {
          nextName = normalizeDepartmentHeadName(String(formData.get("departmentHeadCustom") || "").trim());
        }
        const beforeLabel = currentName || "Chưa có";
        const allPeriodAreas = isSnapshotEdit ? getAreasForPeriod(targetPeriodId) : getAreas(catalogType);
        const otherPeerAreas = allPeriodAreas.filter((a) => !areas.some((target) => target.id === a.id));
        const targetSummary = nextName ? getDepartmentHeadSummaryGroup(nextName, otherPeerAreas) : "";

        areas.forEach((area) => {
          area.departmentHead = nextName;
          if (nextName) {
            area.summaryGroup = targetSummary || nextName;
          }
        });

        if (nextName && targetSummary) {
          allPeriodAreas
            .filter((a) => a.departmentHead && a.departmentHead.trim() === nextName.trim())
            .forEach((peer) => {
              peer.summaryGroup = targetSummary;
            });
        }

        if (nextName) {
          ensureDepartmentHeadContactForPeriod(nextName, catalogType, targetPeriodId);
          ensureDepartmentHeadContact(nextName, catalogType);
        }

        if (isSnapshotEdit) {
          const targetPeriod = getPeriod(targetPeriodId);
          targetPeriod.settingsSnapshot.departmentHeadContacts = moveDepartmentHeadEmails(
            currentName,
            nextName,
            targetPeriod.settingsSnapshot?.departmentHeadContacts,
            targetPeriod.settingsSnapshot?.areas,
            targetPeriod.settingsSnapshot?.managers,
          );
          await savePeriodSnapshot(targetPeriod);
          const rootDeptHeadWrites = getDepartmentHeadContacts(catalogType).map((contact) => saveDepartmentHeadContact(contact, catalogType));
          await Promise.all(rootDeptHeadWrites);
        } else {
          if (catalogType === SAFETY_PERIOD_TYPE) {
            state.safetyDepartmentHeadContacts = moveDepartmentHeadEmails(currentName, nextName, state.safetyDepartmentHeadContacts, state.safetyAreas, state.safetyManagers);
          } else {
            state.departmentHeadContacts = moveDepartmentHeadEmails(currentName, nextName, state.departmentHeadContacts, state.areas, state.managers);
          }
          const departmentHeadContactWrites = getDepartmentHeadContacts(catalogType).map((contact) => saveDepartmentHeadContact(contact, catalogType));
          await Promise.all([
            ...areas.map((area) => dbRef(`${catalogDbPath(catalogType, "areas")}/${area.id}`).set(area)),
            ...departmentHeadContactWrites,
            refreshLatestPeriodSnapshot(catalogType),
          ]);
        }
        await Promise.all([
          logAdminChange({
            subjectLabel: "Trưởng phòng",
            beforeLabel,
            afterLabel: nextName || "Chưa có",
            changeLabel: `Sửa trưởng phòng ${beforeLabel}`,
            note: `${isSnapshotEdit ? `${periodLabel(period)} · ` : ""}Áp dụng zone ${areas.map((area) => area.code).join(", ")}`,
            scope: catalogType,
            periodId: targetPeriodId,
          }),
        ]);

        const afterSnapshot = capturePeriodSnapshot(targetPeriodId);
        const afterCatalog = captureCatalogState(catalogType);
        pushUndoAction({
          type: "catalogOrSettings",
          description: `Trưởng phòng Zone ${areas.map((area) => area.code).join(", ")}: ${beforeLabel} → ${nextName || "Chưa có"}`,
          targetPeriodId: isSnapshotEdit ? targetPeriodId : null,
          catalogType,
          beforeSnapshot,
          afterSnapshot,
          beforeCatalog,
          afterCatalog,
        });

        showToast("Đã cập nhật trưởng phòng.");
        renderAll();
        return true;
      },
    });

    const deptHeadRadios = elements.modalBody.querySelectorAll('input[name="deptHeadMode"]');
    const deptHeadSelect = elements.modalBody.querySelector("#edit-depthead-group-select");
    const deptHeadInput = elements.modalBody.querySelector("#edit-depthead-group-input");

    deptHeadRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (radio.value === "catalog") {
          deptHeadSelect.style.display = "";
          deptHeadInput.style.display = "none";
        } else {
          deptHeadSelect.style.display = "none";
          deptHeadInput.style.display = "";
          if (!deptHeadInput.value && deptHeadSelect.value) {
            deptHeadInput.value = deptHeadSelect.value;
          }
        }
      });
    });

    deptHeadSelect?.addEventListener("change", () => {
      if (deptHeadSelect.value) {
        deptHeadInput.value = deptHeadSelect.value;
      }
    });
  }

  function editDepartmentHeadGroup(currentName = "", periodId = "", areaIdsText = "") {
    const targetPeriodId = periodId || getActivePeriodId(activeCatalogScope);
    const allAreas = getAreasForPeriod(targetPeriodId);
    let affectedAreas = [];
    if (areaIdsText) {
      const ids = new Set(String(areaIdsText || "").split(",").map((value) => value.trim()).filter(Boolean));
      affectedAreas = allAreas.filter((area) => ids.has(area.id));
    }
    if (!affectedAreas.length) {
      affectedAreas = allAreas.filter((area) => (area.departmentHead || "") === currentName);
    }
    editDepartmentHeadAreas(affectedAreas, targetPeriodId, currentName);
  }

  function editSafetyRiskOwnerGroup(areaIdsText = "", periodId = "", fallbackName = "") {
    const targetPeriodId = periodId || getActivePeriodId(SAFETY_PERIOD_TYPE);
    const ids = new Set(String(areaIdsText || "").split(",").map((value) => value.trim()).filter(Boolean));
    const areas = getAreasForPeriod(targetPeriodId).filter((area) => ids.has(area.id));
    editDepartmentHeadAreas(areas, targetPeriodId, fallbackName);
  }

  function editSummaryGroup(currentName = "", periodId = "", areaIdsText = "", deptHead = "") {
    if (!requireAdminAction()) {
      return;
    }

    const targetPeriodId = periodId || getActivePeriodId(activeCatalogScope);
    if (blockIfArchivedPeriod(targetPeriodId)) {
      return;
    }

    const catalogType = targetPeriodId ? getCatalogTypeForPeriod(targetPeriodId) : activeCatalogScope;
    const isSnapshotEdit = shouldEditPeriodSnapshot(targetPeriodId);
    const period = getPeriod(targetPeriodId);
    const allAreas = isSnapshotEdit ? getAreasForPeriod(targetPeriodId) : getAreas(catalogType);
    let affectedAreas = [];
    if (areaIdsText) {
      const ids = new Set(String(areaIdsText || "").split(",").map((value) => value.trim()).filter(Boolean));
      affectedAreas = allAreas.filter((area) => ids.has(area.id));
    } else if (deptHead) {
      affectedAreas = allAreas.filter((area) => (area.departmentHead || "") === deptHead);
    } else if (currentName) {
      affectedAreas = allAreas.filter((area) => (area.summaryGroup || "") === currentName);
    }
    if (!affectedAreas.length) {
      return;
    }

    const deptHeads = new Set(affectedAreas.map((a) => a.departmentHead).filter(Boolean));
    if (deptHeads.size > 0) {
      affectedAreas = allAreas.filter((area) => (area.departmentHead && deptHeads.has(area.departmentHead)) || affectedAreas.includes(area));
    }

    openFormModal({
      title: "Sửa nhóm tổng điểm",
      html: `
        <div class="modal-context">
          <span>Áp dụng cho zone: ${escapeHtml(affectedAreas.map((area) => area.code).join(", "))}</span>
          ${isSnapshotEdit ? `<span>Chỉ áp dụng cho ${escapeHtml(periodLabel(period))}; kỳ khác không bị đổi.</span>` : ""}
        </div>
        <label>
          <span>Tên nhóm tổng điểm</span>
          <input name="summaryGroup" type="text" value="${escapeHtml(currentName)}" placeholder="vd: Mr/Ms ...">
        </label>
      `,
      async onSubmit(formData) {
        const beforeSnapshot = capturePeriodSnapshot(targetPeriodId);
        const beforeCatalog = captureCatalogState(catalogType);
        const nextName = String(formData.get("summaryGroup") || "").trim();
        const beforeLabel = currentName || "Chưa có";
        affectedAreas.forEach((area) => {
          area.summaryGroup = nextName;
        });
        if (isSnapshotEdit) {
          await savePeriodSnapshot(getPeriod(targetPeriodId));
        } else {
          await Promise.all([
            ...affectedAreas.map((area) => dbRef(`${catalogDbPath(catalogType, "areas")}/${area.id}`).set(area)),
            refreshLatestPeriodSnapshot(catalogType),
          ]);
        }
        await Promise.all([
          logAdminChange({
            subjectLabel: "Nhóm tổng điểm",
            beforeLabel,
            afterLabel: nextName || "Chưa có",
            changeLabel: `Sửa nhóm tổng điểm ${beforeLabel}`,
            note: `${isSnapshotEdit ? `${periodLabel(period)} · ` : ""}Áp dụng zone ${affectedAreas.map((area) => area.code).join(", ")}`,
            scope: catalogType,
            periodId: targetPeriodId,
          }),
        ]);
        const afterSnapshot = capturePeriodSnapshot(targetPeriodId);
        const afterCatalog = captureCatalogState(catalogType);
        pushUndoAction({
          type: "catalogOrSettings",
          description: `Nhóm tổng điểm Zone ${affectedAreas.map((area) => area.code).join(", ")}: ${beforeLabel} → ${nextName || "Chưa có"}`,
          targetPeriodId: isSnapshotEdit ? targetPeriodId : null,
          catalogType,
          beforeSnapshot,
          afterSnapshot,
          beforeCatalog,
          afterCatalog,
        });
        showToast("Đã cập nhật nhóm tổng điểm.");
        renderAll();
        return true;
      },
    });
  }

  function editAreaResponsible(id, periodId = "") {
    editArea(id, periodId);
  }

  function editAreaAssessor(id, periodId = "") {
    if (!requireAdminAction()) {
      return;
    }

    const targetPeriodId = periodId || getActivePeriodId(activeCatalogScope);
    if (blockIfArchivedPeriod(targetPeriodId)) {
      return;
    }

    const catalogType = targetPeriodId ? getCatalogTypeForPeriod(targetPeriodId) : activeCatalogScope;
    const isSnapshotEdit = shouldEditPeriodSnapshot(targetPeriodId);
    const useCatalogSelectors = !periodId;
    const period = getPeriod(targetPeriodId);
    const area = isSnapshotEdit ? getAreaForPeriod(targetPeriodId, id) : getArea(id, catalogType);
    if (!area) {
      return;
    }

    openFormModal({
      title: `Sửa assessor Zone ${area.code}`,
      html: `
        ${isSnapshotEdit ? `<div class="modal-context"><span>Chỉ áp dụng cho ${escapeHtml(periodLabel(period))}; kỳ khác không bị đổi.</span></div>` : ""}
        <label>
          <span>Assessor hiển thị ở dòng cuối</span>
          ${
            isSnapshotEdit && !useCatalogSelectors
              ? `<input name="assessorName" type="text" value="${escapeHtml(getAreaConfiguredAssessorNameForPeriod(targetPeriodId, area))}">`
              : `<select name="assessorId">${assessorOptions(area.assessorId, true, catalogType, targetPeriodId)}</select>`
          }
        </label>
      `,
      async onSubmit(formData) {
        const beforeSnapshot = capturePeriodSnapshot(targetPeriodId);
        const beforeCatalog = captureCatalogState(catalogType);
        const beforeLabel = getAreaConfiguredAssessorNameForPeriod(targetPeriodId, area) || "Chưa có";
        if (isSnapshotEdit && !useCatalogSelectors) {
          area.assessorName = String(formData.get("assessorName") || "").trim();
          await savePeriodSnapshot(getPeriod(targetPeriodId));
        } else if (isSnapshotEdit) {
          area.assessorId = String(formData.get("assessorId") || "");
          area.assessorName = getPeriodCatalogAssessor(targetPeriodId, area.assessorId)?.name || "";
          await savePeriodSnapshot(getPeriod(targetPeriodId));
        } else {
          area.assessorId = String(formData.get("assessorId") || "");
          area.assessorName = getAssessor(area.assessorId, catalogType)?.name || "";
          await Promise.all([
            dbRef(`${catalogDbPath(catalogType, "areas")}/${area.id}`).set(area),
            refreshLatestPeriodSnapshot(catalogType),
          ]);
        }
        await Promise.all([
          logAdminChange({
            subjectLabel: "Assessor",
            areaCode: area.code,
            beforeLabel,
            afterLabel: getAreaConfiguredAssessorNameForPeriod(targetPeriodId, area) || "Chưa có",
            changeLabel: `Sửa assessor Zone ${area.code}`,
            note: isSnapshotEdit ? `Chỉ áp dụng cho ${periodLabel(period)}` : "",
            scope: catalogType,
            periodId: targetPeriodId,
          }),
        ]);

        const afterSnapshot = capturePeriodSnapshot(targetPeriodId);
        const afterCatalog = captureCatalogState(catalogType);
        pushUndoAction({
          type: "catalogOrSettings",
          description: `Assessor Zone ${area.code}: ${beforeLabel} → ${getAreaConfiguredAssessorNameForPeriod(targetPeriodId, area) || "Chưa có"}`,
          targetPeriodId: isSnapshotEdit ? targetPeriodId : null,
          catalogType,
          beforeSnapshot,
          afterSnapshot,
          beforeCatalog,
          afterCatalog,
        });

        showToast("Đã cập nhật assessor.");
        renderAll();
        return true;
      },
    });
  }

  function editAccount(id) {
    if (!requireAdminAction()) {
      return;
    }

    const scope = activeAccountScope;
    const periodId = getActivePeriodId(scope);
    const account = state.accounts.find((item) => item.id === id);
    if (!account) {
      return;
    }

    if (isAdminAccount(account)) {
      openFormModal({
        title: "Sửa tên Admin",
        html: `
          <div style="margin-bottom: 14px; padding: 10px 12px; background: rgba(0, 240, 255, 0.05); border: 1px solid rgba(0, 240, 255, 0.2); border-radius: 6px; font-size: 13px;">
            <div style="margin-bottom: 4px;"><strong>Tài khoản đăng nhập:</strong> <span class="cyber-badge">${escapeHtml(account.username || "admin")}</span></div>
            <div style="color: #94a3b8; font-size: 12px;">(Tài khoản và mật khẩu Admin được cố định để bảo mật hệ thống, chỉ cho phép chỉnh sửa tên hiển thị)</div>
          </div>
          <label>
            <span>Tên hiển thị người quản trị</span>
            <input name="name" type="text" value="${escapeHtml(account.name || "")}" required placeholder="Họ và tên admin">
          </label>
        `,
        async onSubmit(formData) {
          if (!requireAdminAction()) {
            return false;
          }
          const name = String(formData.get("name") || "").trim();

          if (!name) {
            showToast("Vui lòng nhập tên hiển thị người quản trị.", true);
            return false;
          }

          const beforeLabel = describeAccountForScope(account, scope);
          account.name = name;
          account.displayName = name;

          if (currentUser && (currentUser.id === account.id || currentUser.role === "admin")) {
            currentUser.name = name;
            currentUser.displayName = name;
            saveSession(currentUser);
          }

          await Promise.all([
            dbRef(`accounts/${account.id}`).set(account),
            logAdminChange({
              subjectLabel: "Tài khoản Admin hệ thống",
              beforeLabel,
              afterLabel: describeAccountForScope(account, scope),
              changeLabel: `Sửa tên hiển thị tài khoản Admin thành ${account.name}`,
              scope,
            }),
          ]);

          showToast("Đã cập nhật tên Admin thành công.");
          renderAll();
          return true;
        },
      });
      return;
    }

    if (isViewerAccount(account)) {
      openFormModal({
        title: "Sửa tài khoản người xem",
        html: `
          <label>
            <span>Tên người xem</span>
            <input name="viewerName" type="text" value="${escapeHtml(account.name || account.displayName || "")}" required>
          </label>
          <label>
            <span>Chức vụ</span>
            <input name="viewerPosition" type="text" value="${escapeHtml(account.position || "")}" required>
          </label>
          <label>
            <span>Tài khoản</span>
            <input name="username" type="text" value="${escapeHtml(account.username)}" required>
          </label>
          <label>
            <span>Tên hiển thị</span>
            <input name="displayName" type="text" value="${escapeHtml(account.displayName || "")}" placeholder="Mặc định theo tên người xem">
          </label>
          <label>
            <span>Mật khẩu</span>
            <input name="password" type="password" value="" minlength="4" placeholder="Để trống nếu không đổi">
          </label>
        `,
        async onSubmit(formData) {
          if (!requireAdminAction()) {
            return false;
          }

          const name = String(formData.get("viewerName") || "").trim();
          const position = String(formData.get("viewerPosition") || "").trim();
          const username = String(formData.get("username") || "").trim();
          const displayName = String(formData.get("displayName") || "").trim();
          const password = String(formData.get("password") || "");

          if (!name || !position || !username) {
            showToast("Vui lòng nhập đủ thông tin người xem.", true);
            return false;
          }
          if (password && password.length < 4) {
            showToast("Mật khẩu mới phải có ít nhất 4 ký tự.", true);
            return false;
          }
          if (state.accounts.some((item) => item.id !== id && item.username === username)) {
            showToast("Tên tài khoản đã tồn tại.", true);
            return false;
          }

          const beforeLabel = describeAccountForScope(account, scope);
          account.role = ROLE_VIEWER;
          account.accessTypes = [FIVE_S_PERIOD_TYPE, SAFETY_PERIOD_TYPE];
          account.rolesByType = { [FIVE_S_PERIOD_TYPE]: ROLE_VIEWER, [SAFETY_PERIOD_TYPE]: ROLE_VIEWER };
          account.name = name;
          account.position = position;
          account.displayName = displayName || name;
          account.username = username;
          account.areaIds = [];
          account.fiveSAreaIds = [];
          account.safetyAreaIds = [];
          setAccountPersonForType(account, FIVE_S_PERIOD_TYPE, ROLE_VIEWER, "");
          setAccountPersonForType(account, SAFETY_PERIOD_TYPE, ROLE_VIEWER, "");
          if (password) {
            account.password = password;
          } else {
            delete account.password;
          }
          delete account.email;
          delete account.senderEmail;

          await Promise.all([
            dbRef(`accounts/${account.id}`).set(account),
            logAdminChange({
              subjectLabel: "Tài khoản người xem",
              beforeLabel,
              afterLabel: describeAccountForScope(account, scope),
              changeLabel: `Sửa tài khoản người xem ${account.username}`,
              scope: "",
            }),
          ]);

          showToast("Đã cập nhật tài khoản người xem.");
          renderAll();
          return true;
        },
      });
      return;
    }

    if (isDepartmentHeadAccount(account)) {
      const allHeadRows = [
        ...getDepartmentHeadRows(getActivePeriodId(FIVE_S_PERIOD_TYPE)).map((row) => ({ ...row, source: FIVE_S_PERIOD_TYPE, sourceLabel: "5S" })),
        ...getDepartmentHeadRows(getActivePeriodId(SAFETY_PERIOD_TYPE)).map((row) => ({ ...row, source: SAFETY_PERIOD_TYPE, sourceLabel: "AT" })),
      ];
      const uniqueRows = [...new Map(allHeadRows.map((row) => [departmentHeadKey(row.name), row])).values()];
      const selectedName = getDepartmentHeadAccountName(account);
      openFormModal({
        title: "Sửa tài khoản trưởng phòng",
        html: `
          <label>
            <span>Trưởng phòng</span>
            <select name="departmentHeadName" required>
              ${uniqueRows.map((row) => `<option value="${escapeHtml(row.name)}" ${departmentHeadKey(row.name) === departmentHeadKey(selectedName) ? "selected" : ""}>${escapeHtml(row.name)} · ${escapeHtml(row.sourceLabel)} · Zone ${escapeHtml(row.areaCodes.join(", ") || "chưa có")}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Tài khoản</span>
            <input name="username" type="text" value="${escapeHtml(account.username)}" required>
          </label>
          <label>
            <span>Tên hiển thị</span>
            <input name="displayName" type="text" value="${escapeHtml(account.displayName || "")}" placeholder="Mặc định theo tên trưởng phòng">
          </label>
          <label>
            <span>Mật khẩu</span>
            <input name="password" type="password" value="" minlength="4" placeholder="Để trống nếu không đổi">
          </label>
        `,
        async onSubmit(formData) {
          if (!requireAdminAction()) {
            return false;
          }

          const name = normalizeDepartmentHeadName(formData.get("departmentHeadName"));
          const username = String(formData.get("username") || "").trim();
          const displayName = String(formData.get("displayName") || "").trim();
          const password = String(formData.get("password") || "");

          if (!name || !username) {
            showToast("Vui lòng nhập đủ thông tin trưởng phòng.", true);
            return false;
          }
          if (password && password.length < 4) {
            showToast("Mật khẩu mới phải có ít nhất 4 ký tự.", true);
            return false;
          }
          if (!uniqueRows.some((row) => departmentHeadKey(row.name) === departmentHeadKey(name))) {
            showToast("Vui lòng chọn trưởng phòng có sẵn trong danh mục.", true);
            return false;
          }
          if (state.accounts.some((item) => item.id !== id && item.username === username)) {
            showToast("Tên tài khoản đã tồn tại.", true);
            return false;
          }

          const beforeLabel = describeAccountForScope(account, scope);
          const isEditingCurrentAccount = currentUser && (currentUser.id === account.id || currentUser.username === account.username);
          account.role = ROLE_DEPARTMENT_HEAD;
          account.accessTypes = [FIVE_S_PERIOD_TYPE, SAFETY_PERIOD_TYPE];
          account.rolesByType = { [FIVE_S_PERIOD_TYPE]: ROLE_DEPARTMENT_HEAD, [SAFETY_PERIOD_TYPE]: ROLE_DEPARTMENT_HEAD };
          account.name = name;
          account.departmentHeadName = name;
          account.displayName = displayName || name;
          account.username = username;
          account.areaIds = [];
          account.fiveSAreaIds = [];
          account.safetyAreaIds = [];
          setAccountPersonForType(account, FIVE_S_PERIOD_TYPE, ROLE_DEPARTMENT_HEAD, "");
          setAccountPersonForType(account, SAFETY_PERIOD_TYPE, ROLE_DEPARTMENT_HEAD, "");
          if (password) {
            account.password = password;
          } else {
            delete account.password;
          }
          delete account.position;
          delete account.email;
          delete account.senderEmail;
          if (isEditingCurrentAccount) {
            currentUser = account;
            saveSession(currentUser);
          }

          await Promise.all([
            dbRef(`accounts/${account.id}`).set(account),
            logAdminChange({
              subjectLabel: "Tài khoản trưởng phòng",
              beforeLabel,
              afterLabel: describeAccountForScope(account, scope),
              changeLabel: `Sửa tài khoản trưởng phòng ${account.username}`,
              scope: "",
            }),
          ]);

          showToast("Đã cập nhật tài khoản trưởng phòng.");
          renderAll();
          return true;
        },
      });
      return;
    }

    if (!hasAccountAccessType(account, scope)) {
      return;
    }

    const selectedRole = getAccountRoleForType(account, scope) || getAssessorRoleForScope(scope);
    const selectedPersonId = getAccountPersonId(account, scope);
    openFormModal({
      title: "Sửa tài khoản " + getAccountScopeLabel(scope),
      html: `
        <label>
          <span>Loại quyền</span>
          <select name="role" required>
            ${accountRoleOptionsHtml(selectedRole, scope, { includeViewer: false })}
          </select>
        </label>
        <label data-account-assessor-field>
          <span>Assessor</span>
          <select name="assessorId">${assessorOptions(selectedRole === ROLE_ZONE_OWNER ? "" : selectedPersonId, true, scope)}</select>
        </label>
        <label data-account-manager-field hidden>
          <span>Người phụ trách zone</span>
          <select name="scorerId">${managerOptions(selectedRole === ROLE_ZONE_OWNER ? selectedPersonId : "", true, scope)}</select>
        </label>
        <div class="form-field" data-account-zone-field ${selectedRole === ROLE_ZONE_OWNER ? "" : "hidden"}>
          <span data-account-zone-label>Zone người được cấp tài khoản phụ trách</span>
          <div class="zone-check-list">${areaCheckboxListHtml(getAccountAreaIds(account, scope), scope)}</div>
        </div>
        <label>
          <span>Tài khoản</span>
          <input name="username" type="text" value="${escapeHtml(account.username)}" required>
        </label>
        <label>
          <span>Tên hiển thị</span>
          <input name="displayName" type="text" value="${escapeHtml(account.displayName || "")}" placeholder="Mặc định theo tài khoản">
        </label>
        <label>
          <span>Mật khẩu</span>
          <input name="password" type="password" value="" minlength="4" placeholder="Để trống nếu không đổi">
        </label>
      `,
      async onSubmit(formData, form) {
        if (!requireAdminAction()) {
          return false;
        }

        const role = normalizeScopedAccountRole(formData.get("role"), scope);
        const isZoneOwnerRole = role === ROLE_ZONE_OWNER;
        let areaIds = [];
        const username = String(formData.get("username") || "").trim();
        const displayName = String(formData.get("displayName") || "").trim();
        const password = String(formData.get("password") || "");
        let personId = "";
        let name = "";

        if (!username) {
          showToast("Vui lòng nhập đủ thông tin tài khoản.", true);
          return false;
        }
        if (password && password.length < 4) {
          showToast("Mật khẩu mới phải có ít nhất 4 ký tự.", true);
          return false;
        }

        if (isZoneOwnerRole) {
          personId = String(formData.get("scorerId") || "");
          const manager = getPeriodCatalogManager(periodId, personId);
          name = manager?.name || "";
          if (!manager) {
            showToast("Vui lòng chọn người phụ trách zone.", true);
            return false;
          }
          areaIds = getCheckedAreaIds(form);
          if (!areaIds.length) {
            showToast("Vui lòng chọn ít nhất một zone phụ trách.", true);
            return false;
          }
        } else {
          personId = String(formData.get("assessorId") || "");
          const assessor = getPeriodCatalogAssessor(periodId, personId);
          name = assessor?.name || "";
          if (!assessor) {
            showToast("Vui lòng chọn assessor.", true);
            return false;
          }
          areaIds = getAssessorAreaIds(personId, scope, periodId);
        }

        if (state.accounts.some((item) => item.id !== id && item.username === username)) {
          showToast("Tên tài khoản đã tồn tại.", true);
          return false;
        }

        const beforeLabel = describeAccountForScope(account, scope);
        const isEditingCurrentAccount = currentUser && (currentUser.id === account.id || currentUser.username === account.username);
        account.accessTypes = [...new Set([...normalizeAccountAccessTypes(account.accessTypes, account.role), scope])];
        account.rolesByType = { ...normalizeAccountRolesByType(account), [scope]: role };
        account.name = name || account.name || username;
        account.displayName = displayName || username;
        setAccountPersonForType(account, scope, role, personId);
        setAccountAreaIds(account, scope, areaIds);
        if (!hasAccountAccessType(account, FIVE_S_PERIOD_TYPE)) {
          account.role = getAccountRoleForType(account, SAFETY_PERIOD_TYPE) || role;
        } else if (scope === FIVE_S_PERIOD_TYPE) {
          account.role = role;
        }
        delete account.position;
        account.username = username;
        if (password) {
          account.password = password;
        } else {
          delete account.password;
        }
        delete account.email;
        delete account.senderEmail;
        if (isEditingCurrentAccount) {
          currentUser = account;
          saveSession(currentUser);
        }
        await Promise.all([
          dbRef(`accounts/${account.id}`).set(account),
          logAdminChange({
            subjectLabel: isZoneOwnerRole ? "Tài khoản người phụ trách zone" : "Tài khoản assessor",
            beforeLabel,
            afterLabel: describeAccountForScope(account, scope),
            changeLabel: `Sửa tài khoản ${account.username}`,
            scope,
          }),
        ]);
        await syncCatalogAreasForAccount(scope, areaIds, personId, role);
        showToast("Đã cập nhật tài khoản.");
        renderAll();
        return true;
      },
    });

    const form = document.getElementById("modal-form");
    const roleSelect = form?.elements.role;
    roleSelect?.addEventListener("change", () => syncAccountRoleFields(roleSelect.value, form, scope));
    syncAccountRoleFields(roleSelect?.value || selectedRole, form, scope);
  }

  function addAccountAccess(id, type = "") {
    if (!requireAdminAction()) {
      return;
    }

    const scope = normalizeCatalogType(type);
    const periodId = getActivePeriodId(scope);
    const account = state.accounts.find((item) => item.id === id && item.role !== "admin");
    if (!account) {
      return;
    }
    if (hasAccountAccessType(account, scope)) {
      showToast("Tài khoản này đã có quyền " + getAccountScopeLabel(scope) + ".", true);
      renderAll();
      return;
    }

    const selectedRole = getAssessorRoleForScope(scope);
    openFormModal({
      title: "Thêm quyền " + getAccountScopeLabel(scope),
      submitText: "Thêm quyền",
      html: `
        <div class="modal-context">
          <span>Tài khoản: <strong>${escapeHtml(account.username)}</strong></span>
        </div>
        <label>
          <span>Loại quyền</span>
          <select name="role" required>
            ${accountRoleOptionsHtml(selectedRole, scope, { includeViewer: false })}
          </select>
        </label>
        <label data-account-assessor-field ${selectedRole === ROLE_ZONE_OWNER ? "hidden" : ""}>
          <span>Assessor</span>
          <select name="assessorId">${assessorOptions("", true, scope)}</select>
        </label>
        <label data-account-manager-field ${selectedRole === ROLE_ZONE_OWNER ? "" : "hidden"}>
          <span>Người phụ trách zone</span>
          <select name="scorerId">${managerOptions("", true, scope)}</select>
        </label>
        <div class="form-field" data-account-zone-field ${selectedRole === ROLE_ZONE_OWNER ? "" : "hidden"}>
          <span data-account-zone-label>Zone ${escapeHtml(getAccountScopeLabel(scope))} phụ trách</span>
          <div class="zone-check-list">${areaCheckboxListHtml([], scope)}</div>
        </div>
      `,
      async onSubmit(formData, form) {
        if (!requireAdminAction()) {
          return false;
        }

        if (hasAccountAccessType(account, scope)) {
          showToast("Tài khoản này đã có quyền " + getAccountScopeLabel(scope) + ".", true);
          return true;
        }

        const role = normalizeScopedAccountRole(formData.get("role"), scope);
        const isZoneOwnerRole = role === ROLE_ZONE_OWNER;
        let areaIds = [];
        let personId = "";
        let name = "";

        if (isZoneOwnerRole) {
          personId = String(formData.get("scorerId") || "");
          const manager = getPeriodCatalogManager(periodId, personId);
          name = manager?.name || "";
          if (!manager) {
            showToast("Vui lòng chọn người phụ trách zone.", true);
            return false;
          }
          areaIds = getCheckedAreaIds(form);
          if (!areaIds.length) {
            showToast("Vui lòng chọn ít nhất một zone phụ trách.", true);
            return false;
          }
        } else {
          personId = String(formData.get("assessorId") || "");
          const assessor = getPeriodCatalogAssessor(periodId, personId);
          name = assessor?.name || "";
          if (!assessor) {
            showToast("Vui lòng chọn assessor.", true);
            return false;
          }
          areaIds = getAssessorAreaIds(personId, scope, periodId);
        }

        const beforeLabel = describeAccountForScope(account, account.accessTypes?.[0] || activeAccountScope);
        account.accessTypes = [...new Set([...normalizeAccountAccessTypes(account.accessTypes, account.role), scope])];
        account.rolesByType = { ...normalizeAccountRolesByType(account), [scope]: role };
        account.name = name || account.name || account.username;
        setAccountPersonForType(account, scope, role, personId);
        setAccountAreaIds(account, scope, areaIds);
        if (!hasAccountAccessType(account, FIVE_S_PERIOD_TYPE)) {
          account.role = getAccountRoleForType(account, SAFETY_PERIOD_TYPE) || role;
        } else if (scope === FIVE_S_PERIOD_TYPE) {
          account.role = role;
        }
        delete account.email;
        delete account.senderEmail;

        await Promise.all([
          dbRef(`accounts/${account.id}`).set(account),
          logAdminChange({
            subjectLabel: isZoneOwnerRole ? "Tài khoản người phụ trách zone" : "Tài khoản assessor",
            beforeLabel,
            afterLabel: describeAccountForScope(account, scope),
            changeLabel: `Cấp thêm quyền ${getAccountScopeLabel(scope)} cho ${account.username}`,
            scope,
          }),
        ]);
        await syncCatalogAreasForAccount(scope, areaIds, personId, role);
        showToast("Đã cấp thêm quyền " + getAccountScopeLabel(scope) + ".");
        renderAll();
        return true;
      },
    });

    const form = document.getElementById("modal-form");
    const roleSelect = form?.elements.role;
    roleSelect?.addEventListener("change", () => syncAccountRoleFields(roleSelect.value, form, scope));
    syncAccountRoleFields(roleSelect?.value || selectedRole, form, scope);
  }

  function removeAccountAccess(id, type = activeAccountScope) {
    if (!requireAdminAction()) {
      return;
    }

    const scope = normalizeCatalogType(type);
    const account = state.accounts.find((item) => item.id === id && item.role !== "admin" && hasAccountAccessType(item, scope));
    if (!account) {
      return;
    }

    const accessTypes = normalizeAccountAccessTypes(account.accessTypes, account.role);
    const removeOnlyScope = accessTypes.length > 1;
    openConfirmModal({
      title: removeOnlyScope ? "Xóa quyền tài khoản" : "Xóa quyền cuối cùng",
      message: removeOnlyScope
        ? `Xóa quyền ${getAccountScopeLabel(scope)} khỏi tài khoản ${account.username}?`
        : `Tài khoản ${account.username} chỉ còn quyền ${getAccountScopeLabel(scope)}. Xóa quyền này sẽ xóa luôn tài khoản.`,
      confirmText: removeOnlyScope ? "Xóa quyền" : "Xóa tài khoản",
      danger: true,
      onConfirm() {
        const beforeLabel = describeAccountForScope(account, scope);
        if (removeOnlyScope) {
          removeAccountScope(account, scope);
          Promise.all([
            dbRef(`accounts/${id}`).set(account),
            logAdminChange({
              subjectLabel: "Tài khoản",
              beforeLabel,
              afterLabel: `Đã gỡ quyền ${getAccountScopeLabel(scope)}`,
              changeLabel: `Gỡ quyền ${getAccountScopeLabel(scope)} khỏi ${account.username}`,
              scope,
            }),
          ]).then(() => {
            showToast("Đã xóa quyền tài khoản.");
            renderAll();
          }).catch(() => showToast("Lỗi khi xóa quyền.", true));
          return;
        }

        state.accounts = state.accounts.filter((item) => item.id !== id);
        Promise.all([
          dbRef(`accounts/${id}`).remove(),
          logAdminChange({
            subjectLabel: "Tài khoản",
            beforeLabel,
            afterLabel: "Đã xóa",
            changeLabel: `Xóa tài khoản ${account.username}`,
            scope,
          }),
        ]).then(() => {
          showToast("Đã xóa tài khoản.");
          renderAll();
        }).catch(() => showToast("Lỗi khi xóa.", true));
      },
    });
  }

  function deleteAccount(id) {
    removeAccountAccess(id, activeAccountScope);
  }

  function deleteViewerAccount(id) {
    if (!requireAdminAction()) {
      return;
    }

    const account = state.accounts.find((item) => item.id === id && isViewerAccount(item));
    if (!account) {
      return;
    }

    openConfirmModal({
      title: "Xóa tài khoản người xem",
      message: `Xóa tài khoản người xem ${account.username}?`,
      confirmText: "Xóa tài khoản",
      danger: true,
      onConfirm() {
        const beforeLabel = describeAccountForScope(account, activeAccountScope);
        state.accounts = state.accounts.filter((item) => item.id !== id);
        Promise.all([
          dbRef(`accounts/${id}`).remove(),
          logAdminChange({
            subjectLabel: "Tài khoản người xem",
            beforeLabel,
            afterLabel: "Đã xóa",
            changeLabel: `Xóa tài khoản người xem ${account.username}`,
            scope: "",
          }),
        ]).then(() => {
          showToast("Đã xóa tài khoản người xem.");
          renderAll();
        }).catch(() => showToast("Lỗi khi xóa tài khoản người xem.", true));
      },
    });
  }

  function deleteDepartmentHeadAccount(id) {
    if (!requireAdminAction()) {
      return;
    }

    const account = state.accounts.find((item) => item.id === id && isDepartmentHeadAccount(item));
    if (!account) {
      return;
    }

    openConfirmModal({
      title: "Xóa tài khoản trưởng phòng",
      message: `Xóa tài khoản trưởng phòng ${account.username}?`,
      confirmText: "Xóa tài khoản",
      danger: true,
      onConfirm() {
        const beforeLabel = describeAccountForScope(account, activeAccountScope);
        state.accounts = state.accounts.filter((item) => item.id !== id);
        Promise.all([
          dbRef(`accounts/${id}`).remove(),
          logAdminChange({
            subjectLabel: "Tài khoản trưởng phòng",
            beforeLabel,
            afterLabel: "Đã xóa",
            changeLabel: `Xóa tài khoản trưởng phòng ${account.username}`,
            scope: "",
          }),
        ]).then(() => {
          showToast("Đã xóa tài khoản trưởng phòng.");
          renderAll();
        }).catch(() => showToast("Lỗi khi xóa tài khoản trưởng phòng.", true));
      },
    });
  }

  function managerOptions(selectedId, includeBlank = true, type = activeCatalogScope, periodId = getActivePeriodId(type)) {
    const options = getPeriodCatalogManagers(type, periodId)
      .map((manager) => `<option value="${escapeHtml(manager.id)}" ${manager.id === selectedId ? "selected" : ""}>${escapeHtml(manager.name)}</option>`)
      .join("");
    return `${includeBlank ? '<option value="">Chọn người phụ trách zone</option>' : ""}${options}`;
  }
  function assessorOptions(selectedId, includeBlank = true, type = activeCatalogScope, periodId = getActivePeriodId(type)) {
    const options = getPeriodCatalogAssessors(type, periodId)
      .map((assessor) => `<option value="${escapeHtml(assessor.id)}" ${assessor.id === selectedId ? "selected" : ""}>${escapeHtml(assessor.name)}</option>`)
      .join("");
    return `${includeBlank ? '<option value="">Chọn assessor</option>' : ""}${options}`;
  }
  function departmentHeadOptions(selectedName, includeBlank = true, periodId = getActivePeriodId(activeCatalogScope)) {
    const selectedKey = departmentHeadKey(selectedName);
    const rows = getDepartmentHeadRows(periodId);
    const options = rows
      .map((row) => `<option value="${escapeHtml(row.name)}" ${departmentHeadKey(row.name) === selectedKey ? "selected" : ""}>${escapeHtml(row.name)}</option>`)
      .join("");
    return `${includeBlank ? '<option value="">Chọn trưởng phòng có sẵn</option>' : ""}${options}`;
  }

  async function activatePeriod(id, type = "") {
    const period = state.periods.find((item) => item.id === id);
    if (!period) {
      return;
    }

    const periodType = normalizePeriodType(type || period.type) === SAFETY_PERIOD_TYPE ? SAFETY_PERIOD_TYPE : FIVE_S_PERIOD_TYPE;
    if (!isAdminAccount(currentUser)) {
      if (!isViewerAccount(currentUser) && id !== getActivePeriodId(periodType)) {
        showToast("Kỳ đánh giá này hiện không mở. Bạn chỉ có thể xem kỳ đang mở.", true);
        return;
      }
      setActivePeriodId(periodType, id);
      renderAll();
      return;
    }

    try {
      await ensurePeriodSnapshot(id);
      setActivePeriodId(periodType, id);
      await saveMeta();
      showToast("Đã đổi kỳ đánh giá.");
      renderAll();
    } catch (error) {
      console.error(error);
      showToast("Lỗi khi lưu kỳ đánh giá.", true);
    }
  }

  function editSafetyPeriodDate(id) {
    if (!requireAdminAction()) {
      return;
    }

    const period = getPeriod(id);
    if (!period || normalizePeriodType(period.type) !== SAFETY_PERIOD_TYPE) {
      showToast("Không tìm thấy kỳ đánh giá an toàn.", true);
      return;
    }

    const currentDate = safetyPeriodInputDate(period);
    openFormModal({
      title: "Sửa ngày chấm an toàn",
      submitText: "Lưu ngày",
      html: "<div class=\"modal-context\">" +
          "<span><strong>Kỳ hiện tại:</strong> " + escapeHtml(periodLabel(period)) + "</span>" +
        "</div>" +
        "<label>" +
          "<span>Ngày đánh giá an toàn</span>" +
          "<span class=\"safety-date-editor\">" +
            "<input name=\"safetyDate\" type=\"text\" placeholder=\"dd/mm/yyyy\" pattern=\"[0-9]{2}/[0-9]{2}/[0-9]{4}\" maxlength=\"10\" value=\"" + escapeHtml(formatDateDisplay(currentDate)) + "\" required>" +
            "<input class=\"safety-date-calendar\" aria-label=\"Chọn ngày đánh giá an toàn\" type=\"date\" value=\"" + escapeHtml(currentDate) + "\">" +
          "</span>" +
        "</label>",
      async onSubmit(formData) {
        const isoDate = parseDisplayDateToIso(formData.get("safetyDate"));
        if (!isoDate) {
          showToast("Ngày đánh giá an toàn không hợp lệ.", true);
          return false;
        }

        const date = new Date(isoDate + "T00:00:00");
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const day = String(date.getDate()).padStart(2, "0");
        const paddedMonth = String(month).padStart(2, "0");
        const nextId = "period-safety-" + year + "-" + paddedMonth + "-" + day;

        const duplicate = getPeriodsByType(SAFETY_PERIOD_TYPE).find((item) => (
          item.id !== period.id && (item.id === nextId || safetyPeriodInputDate(item) === isoDate)
        ));
        if (duplicate) {
          showToast("Đã có kỳ đánh giá an toàn cùng ngày này.", true);
          return false;
        }

        const oldId = period.id;
        const beforeLabel = periodLabel(period);
        period.type = SAFETY_PERIOD_TYPE;
        period.month = month;
        period.year = year;
        period.label = day + "/" + paddedMonth + "/" + year;
        period.createdAt = date.toISOString();
        period.updatedAt = new Date().toISOString();

        if (nextId !== oldId) {
          period.id = nextId;

          const affectedSafetyRecords = (state.safetyRecords || []).filter((record) => record.periodId === oldId);
          affectedSafetyRecords.forEach((record) => {
            record.periodId = nextId;
          });

          const affectedDeletedMarkers = (state.deletedSafetyRecords || []).filter((marker) => marker.periodId === oldId);
          affectedDeletedMarkers.forEach((marker) => {
            marker.periodId = nextId;
          });

          let migratedOverrides = false;
          if (state.safetyIdentificationOverrides && state.safetyIdentificationOverrides[oldId]) {
            state.safetyIdentificationOverrides[nextId] = state.safetyIdentificationOverrides[oldId];
            delete state.safetyIdentificationOverrides[oldId];
            migratedOverrides = true;
          }

          if (state.activeSafetyPeriodId === oldId) {
            state.activeSafetyPeriodId = nextId;
          }
          if (state.activePeriodId === oldId) {
            state.activePeriodId = nextId;
          }

          const updates = {
            ["periods/" + oldId]: null,
            ["periods/" + nextId]: period,
            activePeriodId: state.activePeriodId || "",
            activeFiveSPeriodId: state.activeFiveSPeriodId || "",
            activeSafetyPeriodId: state.activeSafetyPeriodId || "",
            benchmark: state.benchmark,
            fiveSChartTargets: normalizeFiveSChartTargets(state.fiveSChartTargets),
          };
          affectedSafetyRecords.forEach((record) => {
            updates["safetyRecords/" + record.id] = record;
          });
          affectedDeletedMarkers.forEach((marker) => {
            updates["deletedSafetyRecords/" + marker.id] = marker;
          });
          if (migratedOverrides) {
            updates["safetyIdentificationOverrides/" + oldId] = null;
            updates["safetyIdentificationOverrides/" + nextId] = state.safetyIdentificationOverrides[nextId];
          }
          (state.history || []).forEach((entry) => {
            if (entry && entry.periodId === oldId) {
              entry.periodId = nextId;
              entry.periodLabel = periodLabel(period);
              updates["history/" + entry.id] = entry;
            }
          });

          await updateRootWithOptionalRenderSuppression(updates, { suppressRender: true });
        } else {
          await dbRef("periods/" + period.id).set(period);
        }

        await logAdminChange({
          subjectLabel: "Kỳ đánh giá an toàn",
          beforeLabel,
          afterLabel: periodLabel(period),
          changeLabel: "Sửa ngày chấm an toàn",
          note: "Cập nhật ngày đánh giá trong phần danh mục",
          scope: SAFETY_PERIOD_TYPE,
          periodId: period.id,
        });
        showToast("Đã cập nhật ngày chấm an toàn.");
        renderAll();
        return true;
      },
    });
    const dateText = elements.modalBody.querySelector('[name="safetyDate"]');
    const calendar = elements.modalBody.querySelector(".safety-date-calendar");
    calendar.addEventListener("change", () => {
      dateText.value = formatDateDisplay(calendar.value);
    });
    dateText.addEventListener("input", () => {
      const parts = dateText.value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      calendar.value = parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : "";
    });
  }

  function editFiveSPeriodDate(id) {
    if (!requireAdminAction()) {
      return;
    }

    const period = getPeriod(id);
    if (!period || ![FIVE_S_PERIOD_TYPE, LEGACY_PERIOD_TYPE].includes(normalizePeriodType(period.type))) {
      showToast("Không tìm thấy kỳ chấm 5S.", true);
      return;
    }

    const currentMonth = Number(period.month) || new Date().getMonth() + 1;
    const currentYear = Number(period.year) || new Date().getFullYear();
    openFormModal({
      title: "Sửa kỳ chấm 5S",
      submitText: "Lưu kỳ",
      html: "<div class=\"modal-context\">" +
          "<span><strong>Kỳ hiện tại:</strong> " + escapeHtml(periodLabel(period)) + "</span>" +
        "</div>" +
        "<div class=\"form-grid\">" +
          "<label>" +
            "<span>Tháng 5S</span>" +
            "<input name=\"month\" type=\"number\" min=\"1\" max=\"12\" value=\"" + escapeHtml(currentMonth) + "\" required>" +
          "</label>" +
          "<label>" +
            "<span>Năm 5S</span>" +
            "<input name=\"year\" type=\"number\" min=\"2020\" max=\"2100\" value=\"" + escapeHtml(currentYear) + "\" required>" +
          "</label>" +
        "</div>",
      async onSubmit(formData) {
        const month = Number(formData.get("month"));
        const year = Number(formData.get("year"));
        if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2020 || year > 2100) {
          showToast("Tháng hoặc năm không hợp lệ.", true);
          return false;
        }

        const paddedMonth = String(month).padStart(2, "0");
        const nextId = "period-5s-" + year + "-" + paddedMonth;

        const duplicate = getPeriodsByType(FIVE_S_PERIOD_TYPE).find((item) => (
          item.id !== period.id && (item.id === nextId || (Number(item.month) === month && Number(item.year) === year))
        ));
        if (duplicate) {
          showToast("Đã có kỳ chấm 5S cùng tháng/năm này.", true);
          return false;
        }

        const oldId = period.id;
        const beforeLabel = periodLabel(period);
        period.type = FIVE_S_PERIOD_TYPE;
        period.month = month;
        period.year = year;
        period.label = "Tháng " + month + "/" + year;
        period.updatedAt = new Date().toISOString();

        if (nextId !== oldId) {
          period.id = nextId;

          const affectedScores = (state.scores || []).filter((score) => score.periodId === oldId);
          affectedScores.forEach((score) => {
            score.periodId = nextId;
          });
          if (affectedScores.length) {
            invalidateScoreRecordIndex();
          }

          if (state.activePeriodId === oldId) {
            state.activePeriodId = nextId;
          }
          if (state.activeFiveSPeriodId === oldId) {
            state.activeFiveSPeriodId = nextId;
          }

          const updates = {
            ["periods/" + oldId]: null,
            ["periods/" + nextId]: period,
            activePeriodId: state.activePeriodId || "",
            activeFiveSPeriodId: state.activeFiveSPeriodId || "",
            activeSafetyPeriodId: state.activeSafetyPeriodId || "",
            benchmark: state.benchmark,
            fiveSChartTargets: normalizeFiveSChartTargets(state.fiveSChartTargets),
          };
          affectedScores.forEach((score) => {
            updates["scores/" + score.id] = score;
          });
          (state.history || []).forEach((entry) => {
            if (entry && entry.periodId === oldId) {
              entry.periodId = nextId;
              entry.periodLabel = periodLabel(period);
              updates["history/" + entry.id] = entry;
            }
          });

          await updateRootWithOptionalRenderSuppression(updates, { suppressRender: true });
        } else {
          await dbRef("periods/" + period.id).set(period);
        }

        await logAdminChange({
          subjectLabel: "Kỳ chấm 5S",
          beforeLabel,
          afterLabel: periodLabel(period),
          changeLabel: "Sửa kỳ chấm 5S",
          note: "Cập nhật tháng/năm chấm 5S trong phần danh mục",
          scope: FIVE_S_PERIOD_TYPE,
          periodId: period.id,
        });
        showToast("Đã cập nhật kỳ chấm 5S.");
        renderAll();
        return true;
      },
    });
  }

  function deletePeriod(id) {
    if (!requireAdminAction()) {
      return;
    }

    const period = getPeriod(id);
    if (!period) {
      return;
    }

    const periodType = normalizePeriodType(period.type) === SAFETY_PERIOD_TYPE ? SAFETY_PERIOD_TYPE : FIVE_S_PERIOD_TYPE;

    openConfirmModal({
      title: "Xóa kỳ đánh giá",
      message: "Xóa " + periodLabel(period) + " trong dữ liệu nội bộ?",
      confirmText: "Xóa",
      danger: true,
      async onConfirm() {
        const removedScores = state.scores.filter((score) => score.periodId === id);
        const removedSafetyRecords = state.safetyRecords.filter((record) => record.periodId === id);
        const removedDeletedMarkers = (state.deletedSafetyRecords || []).filter((marker) => marker.periodId === id);
        state.periods = state.periods.filter((item) => item.id !== id);
        state.scores = state.scores.filter((score) => score.periodId !== id);
        invalidateScoreRecordIndex();
        state.safetyRecords = state.safetyRecords.filter((record) => record.periodId !== id);
        state.deletedSafetyRecords = (state.deletedSafetyRecords || []).filter((marker) => marker.periodId !== id);
        if (
          (periodType === SAFETY_PERIOD_TYPE && state.activeSafetyPeriodId === id)
          || (periodType === FIVE_S_PERIOD_TYPE && (state.activeFiveSPeriodId === id || state.activePeriodId === id))
        ) {
          setActivePeriodId(periodType, getPeriodsByType(periodType)[0]?.id || "");
        }
        if (state.activePeriodId === id) {
          state.activePeriodId = state.activeFiveSPeriodId || getPeriodsByType(FIVE_S_PERIOD_TYPE)[0]?.id || "";
        }

        const updates = {
          ["periods/" + id]: null,
          activePeriodId: state.activePeriodId || "",
          activeFiveSPeriodId: state.activeFiveSPeriodId || "",
          activeSafetyPeriodId: state.activeSafetyPeriodId || "",
          benchmark: state.benchmark,
          fiveSChartTargets: normalizeFiveSChartTargets(state.fiveSChartTargets),
        };
        removedScores.forEach((score) => {
          updates["scores/" + score.id] = null;
        });
        removedSafetyRecords.forEach((record) => {
          updates["safetyRecords/" + record.id] = null;
        });
        removedDeletedMarkers.forEach((marker) => {
          updates["deletedSafetyRecords/" + marker.id] = null;
        });

        try {
          await updateRootWithOptionalRenderSuppression(updates, { suppressRender: true });
          await deleteUnusedPhotoFiles(collectPhotoUrls([...removedScores, ...removedSafetyRecords]));
          await logAdminChange({
            subjectLabel: periodType === SAFETY_PERIOD_TYPE ? "Kỳ đánh giá an toàn" : "Kỳ chấm 5S",
            beforeLabel: periodLabel(period),
            afterLabel: "Đã xóa",
            changeLabel: "Xóa kỳ " + periodLabel(period),
            note: "Dữ liệu của kỳ đã bị xóa khỏi dữ liệu nội bộ",
          });
          showToast("Đã xóa kỳ đánh giá.");
          renderAll();
        } catch (error) {
          console.error(error);
          showToast("Lỗi khi xóa.", true);
        }
      },
    });
  }
  function toggleIssueStatus(recordId) {
    const record = state.safetyRecords.find((item) => item.id === recordId);
    if (!record) {
      return;
    }

    if (blockIfArchivedPeriod(record.periodId)) {
      return;
    }

    record.issueStatus = isIssueOpen(record) ? "closed" : "open";
    record.updatedAt = new Date().toISOString();
    saveSafetyRecord(record)
      .then(() => {
        showToast(record.issueStatus === "closed" ? "Đã đóng vấn đề." : "Đã mở lại vấn đề.");
        renderAll();
      })
      .catch(() => showToast("Lỗi khi cập nhật trạng thái.", true));
  }

  function editSafetyMeta() {
    if (!requireAdminAction()) {
      return;
    }

    const period = getPeriod(getActivePeriodId(SAFETY_PERIOD_TYPE));
    const periodId = period?.id || "";
    if (blockIfArchivedPeriod(periodId)) {
      return;
    }

    ensurePeriodSnapshotLocal(periodId);
    const report = getSafetyReportForPeriod(periodId);
    const beforeSignature = JSON.stringify(report);
    const isSnapshotEdit = shouldEditPeriodSnapshot(periodId);
    openFormModal({
      title: "Thiết lập báo cáo đánh giá an toàn",
      submitText: "Lưu thiết lập",
      html: (isSnapshotEdit ? '<div class="modal-context"><span>Đang sửa riêng cho ' + escapeHtml(periodLabel(period)) + '; danh mục/kỳ mới nhất không bị đổi.</span></div>' : "") +
        '<label>' +
          '<span>Người thực hiện</span>' +
          '<input name="performer" type="text" value="' + escapeHtml(report.performer) + '">' +
        '</label>' +
        '<label>' +
          '<span>Chức danh người thực hiện</span>' +
          '<input name="performerTitle" type="text" value="' + escapeHtml(report.performerTitle || "") + '">' +
        '</label>' +
        '<label>' +
          '<span>Người kiểm tra</span>' +
          '<input name="checker" type="text" value="' + escapeHtml(report.checker) + '">' +
        '</label>' +
        '<label>' +
          '<span>Chức danh người kiểm tra</span>' +
          '<input name="checkerTitle" type="text" value="' + escapeHtml(report.checkerTitle || "") + '">' +
        '</label>' +
        '<label>' +
          '<span>Bộ phận người thực hiện</span>' +
          '<input name="department" type="text" value="' + escapeHtml(report.department) + '">' +
        '</label>' +
        '<label>' +
          '<span>Bộ phận người kiểm tra</span>' +
          '<input name="checkerDepartment" type="text" value="' + escapeHtml(report.checkerDepartment || "") + '">' +
        '</label>' +
        '<label>' +
          '<span>Dòng hướng dẫn</span>' +
          '<input name="instruction" type="text" value="' + escapeHtml(report.instruction) + '">' +
        '</label>' +
        '<div class="form-grid">' +
          '<label>' +
            '<span>Issue Date</span>' +
            '<input name="issueDate" type="date" value="' + escapeHtml(getReportDateValue(report, period, "issueDate")) + '">' +
          '</label>' +
          '<label>' +
            '<span>Report date</span>' +
            '<input name="reportDate" type="date" value="' + escapeHtml(getReportDateValue(report, period, "reportDate")) + '">' +
          '</label>' +
        '</div>',
      async onSubmit(formData) {
        const beforeLabel = report.performer + " · " + report.checker + " · " + report.department;
        const nextReport = {
          performer: String(formData.get("performer") || "").trim() || DEFAULT_SAFETY_REPORT.performer,
          performerTitle: String(formData.get("performerTitle") || "").trim(),
          checker: String(formData.get("checker") || "").trim() || DEFAULT_SAFETY_REPORT.checker,
          department: String(formData.get("department") || "").trim() || DEFAULT_SAFETY_REPORT.department,
          checkerTitle: String(formData.get("checkerTitle") || "").trim(),
          checkerDepartment: String(formData.get("checkerDepartment") || "").trim(),
          instruction: String(formData.get("instruction") || "").trim() || DEFAULT_SAFETY_REPORT.instruction,
          issueDate: String(formData.get("issueDate") || "").trim(),
          reportDate: String(formData.get("reportDate") || "").trim(),
        };
        const afterSignature = JSON.stringify(nextReport);
        if (beforeSignature === afterSignature) {
          showToast("Không có thay đổi mới.");
          return true;
        }

        if (isSnapshotEdit) {
          const targetPeriod = getPeriod(periodId);
          const snapshot = ensurePeriodSnapshotLocal(periodId);
          snapshot.safetyReport = nextReport;
          await savePeriodSnapshot(targetPeriod);
        } else {
          state.safetyReport = nextReport;
          await Promise.all([
            saveSafetyReport(),
            refreshLatestPeriodSnapshot(SAFETY_PERIOD_TYPE),
          ]);
        }
        await logAdminChange({
          subjectLabel: "Thiết lập ĐG AT",
          beforeLabel,
          afterLabel: nextReport.performer + " · " + nextReport.checker + " · " + nextReport.department,
          changeLabel: "Sửa thiết lập báo cáo ĐG AT",
          note: isSnapshotEdit ? "Chỉ áp dụng cho " + periodLabel(period) : "Áp dụng cho kỳ mới nhất/danh mục AT hiện tại",
          scope: SAFETY_PERIOD_TYPE,
        });
        showToast("Đã lưu thiết lập báo cáo.");
        renderAll();
        return true;
      },
    });
  }

  function getSafetyAreaOptions(periodId, selectedAreaId = "") {
    const allowedIds = getAllowedAreaIds(currentUser, periodId);
    return getAreasForPeriod(periodId)
      .filter((area) => isReportableSafetyArea(area) && allowedIds.has(area.id))
      .map((area) => "<option value=\"" + escapeHtml(area.id) + "\" " + (area.id === selectedAreaId ? "selected" : "") + ">Zone " + escapeHtml(area.code) + " · " + escapeHtml(getSafetyDepartmentForArea(area, periodId)) + "</option>")
      .join("");
  }

  function getSafetyRecordIssueDate(record, period) {
    if (record?.issueDay && record?.issueMonth) {
      const year = Number(period?.year) || new Date().getFullYear();
      const month = String(record.issueMonth).padStart(2, "0");
      const day = String(record.issueDay).padStart(2, "0");
      return year + "-" + month + "-" + day;
    }
    return toIsoDate(record?.createdAt) || toIsoDate(period?.createdAt) || todayIsoDate();
  }

  function addSafetyRecord() {
    if (!canUseSafety(currentUser)) {
      showToast("Bạn không có quyền thêm đánh giá an toàn.", true);
      return;
    }
    if (isDepartmentHeadAccount(currentUser)) {
      showToast("Trưởng phòng chỉ cập nhật phần cải tiến/xử lý trên các mối nguy đã ghi nhận.", true);
      return;
    }

    const activeSafetyPeriodId = getActivePeriodId(SAFETY_PERIOD_TYPE);
    if (!activeSafetyPeriodId || !isPeriodOpen(activeSafetyPeriodId, SAFETY_PERIOD_TYPE)) {
      showToast("Hiện không có kỳ đánh giá an toàn nào đang mở.", true);
      return;
    }

    openSafetyRecordForm(null);
  }

  function editSafetyRecord(recordId) {
    if (!canUseSafety(currentUser)) {
      showToast("Bạn không có quyền sửa đánh giá an toàn.", true);
      return;
    }

    const record = state.safetyRecords.find((item) => item.id === recordId);
    if (!record) {
      return;
    }
    if (!canManageSafetyCountermeasure(record)) {
      showToast("Bạn chỉ được cập nhật báo cáo thuộc zone được phân quyền.", true);
      return;
    }
    openSafetyRecordForm(record);
  }

  function deleteSafetyRecord(recordId) {
    const record = state.safetyRecords.find((item) => item.id === recordId);
    if (!record) {
      showToast("Không tìm thấy báo cáo đánh giá an toàn.", true);
      return;
    }
    if (!canManageSafetyRecord(record)) {
      showToast("Bạn chỉ được xóa nhiệm vụ đánh giá an toàn của mình.", true);
      return;
    }

    const period = getPeriod(record.periodId);
    const area = getAreaForPeriod(record.periodId, record.areaId);
    openConfirmModal({
      title: "Xóa báo cáo đánh giá an toàn",
      message: "Bạn có chắc muốn xóa báo cáo này không?",
      confirmText: "Xóa",
      danger: true,
      renderAfter: false,
      async onConfirm() {
        const recordCopy = cloneValue(record);
        const deletedMarker = getDeletedSafetyRecordMarker(record);
        const keepDeletedMarker = shouldKeepDeletedSafetyRecordMarker(record);
        state.safetyRecords = state.safetyRecords.filter((item) => item.id !== record.id);
        state.deletedSafetyRecords = keepDeletedMarker
          ? [
              ...(state.deletedSafetyRecords || []).filter((item) => item.id !== deletedMarker.id),
              deletedMarker,
            ]
          : (state.deletedSafetyRecords || []).filter((item) => item.id !== deletedMarker.id);
        const updates = {
          [`safetyRecords/${record.id}`]: null,
          [`deletedSafetyRecords/${deletedMarker.id}`]: keepDeletedMarker ? deletedMarker : null,
        };
        await updateRootWithOptionalRenderSuppression(updates, { suppressRender: true });
        await Promise.all([
          tryLogAdminChange({
            subjectLabel: "Đánh giá an toàn",
            areaCode: area?.code || "",
            beforeLabel: (record.issueLocation || "") + " · " + (record.note || ""),
            afterLabel: "Đã xóa",
            changeLabel: "Xóa báo cáo AT" + (area?.code ? " Zone " + area.code : ""),
            scope: SAFETY_PERIOD_TYPE,
            periodId: record.periodId,
          }),
        ]);
        await deleteUnusedPhotoFiles(collectPhotoUrls([recordCopy]));
        pushUndoAction({
          type: "safetyRecord",
          description: `Xóa báo cáo AT${area?.code ? " Zone " + area.code : ""}: ${record.note || ""}`,
          recordId: record.id,
          periodId: record.periodId,
          areaCode: area?.code || "",
          before: recordCopy,
          after: null,
          deletedMarker,
          isNew: false,
        });
        showToast("Đã xóa báo cáo an toàn.");
        renderAll();
      },
    });
  }

  function openSafetyRecordForm(record = null) {
    const isNew = !record;
    const period = getPeriod(isNew ? getActivePeriodId(SAFETY_PERIOD_TYPE) : record.periodId);
    const periodId = period?.id || "";
    if (!periodId) {
      showToast("Hiện không có kỳ đánh giá an toàn nào đang mở.", true);
      return;
    }
    if (blockIfArchivedPeriod(periodId, SAFETY_PERIOD_TYPE)) {
      return;
    }
    if (!canUseSafety(currentUser)) {
      showToast("Bạn không có quyền cập nhật đánh giá an toàn.", true);
      return;
    }
    const countermeasureOnly = Boolean(record) && !canManageSafetyRecord(record) && canManageSafetyCountermeasure(record);
    if (record && !canManageSafetyRecord(record) && !countermeasureOnly) {
      showToast("Bạn chỉ được sửa nhiệm vụ đánh giá an toàn của mình.", true);
      return;
    }

    const allowedIds = getAllowedAreaIds(currentUser, periodId);
    const selectedArea = record ? getAreaForPeriod(periodId, record.areaId) : getAreasForPeriod(periodId).find((area) => isReportableSafetyArea(area) && allowedIds.has(area.id));
    if (!selectedArea || !allowedIds.has(selectedArea.id)) {
      showToast("Tài khoản này chưa được phân quyền zone an toàn.", true);
      return;
    }

    const row = { score: record || {}, area: selectedArea, item: getItem(record?.itemId) };
    const afterPhotoPreview = record?.afterPhotoDataUrl
      ? "<div class=\"photo-preview\"><img src=\"" + record.afterPhotoDataUrl + "\" alt=\"Ảnh sau cải tiến hiện tại\"><label class=\"check-line\"><input name=\"removeAfterPhoto\" type=\"checkbox\"><span>Xóa ảnh sau cải tiến hiện tại</span></label></div>"
      : "";
    const defaultActionOwner = getAccountDisplayName(currentUser, SAFETY_PERIOD_TYPE, periodId) || currentUser?.name || currentUser?.username || "";
    const defaultCompletionDate = toIsoDate(record?.completionDate) || todayIsoDate();

    if (countermeasureOnly) {
      openFormModal({
        title: "Cập nhật cải tiến / xử lý",
        submitText: "Lưu xử lý",
        modalClass: "safety-record-modal",
        html: "<div class=\"modal-context\">" +
            "<span><strong>Kỳ:</strong> " + escapeHtml(periodLabel(period)) + "</span>" +
            "<span><strong>Zone:</strong> " + escapeHtml(selectedArea.code || "") + "</span>" +
            "<span><strong>Mối nguy:</strong> " + escapeHtml(record?.note || "") + "</span>" +
          "</div>" +
          "<label><span>Nội dung cải tiến, xử lý</span><textarea name=\"improvementContent\">" + escapeHtml(record?.improvementContent || "") + "</textarea></label>" +
          "<label><span>Ảnh sau cải tiến, xử lý</span><input name=\"afterPhoto\" type=\"file\" accept=\"image/*\">" + afterPhotoPreview + "</label>" +
          "<label><span>Đảm nhiệm</span><input name=\"actionOwner\" type=\"text\" value=\"" + escapeHtml(record?.actionOwner || defaultActionOwner) + "\"></label>" +
          "<label><span>Kế hoạch</span><input name=\"actionPlan\" type=\"text\" value=\"" + escapeHtml(record?.actionPlan || "") + "\"></label>" +
          "<label><span>Ngày</span><input name=\"completionDate\" type=\"date\" value=\"" + escapeHtml(defaultCompletionDate) + "\"></label>",
        async onSubmit(formData, form) {
          if (blockIfArchivedPeriod(periodId, SAFETY_PERIOD_TYPE)) {
            return false;
          }
          if (!canManageSafetyCountermeasure(record)) {
            showToast("Bạn không có quyền cập nhật phần xử lý cho zone này.", true);
            return false;
          }
          const afterPhotoInput = form.elements.afterPhoto;
          const nextAfterPhoto = await prepareScorePhoto(
            afterPhotoInput?.files?.[0],
            { photoDataUrl: record?.afterPhotoDataUrl, photoName: record?.afterPhotoName },
            formData.get("removeAfterPhoto") === "on",
            periodId,
          );
          const payload = normalizeSafetyRecord({
            ...record,
            improvementContent: String(formData.get("improvementContent") || "").trim(),
            afterPhotoDataUrl: nextAfterPhoto.photoDataUrl,
            afterPhotoName: nextAfterPhoto.photoName,
            actionOwner: String(formData.get("actionOwner") || "").trim() || defaultActionOwner,
            actionPlan: String(formData.get("actionPlan") || "").trim(),
            completionDate: String(formData.get("completionDate") || "").trim() || defaultCompletionDate,
            updatedAt: new Date().toISOString(),
          });
          if (!hasSafetyRecordChanged(record, payload)) {
            showToast("Không có thay đổi mới.");
            return true;
          }
          const existingIndex = state.safetyRecords.findIndex((item) => item.id === payload.id);
          const existingRecordCopy = existingIndex >= 0 ? cloneValue(state.safetyRecords[existingIndex]) : cloneValue(record);
          if (existingIndex >= 0) {
            state.safetyRecords[existingIndex] = payload;
          }
          await saveSafetyRecord(payload);
          await deleteUnusedPhotoFiles([
            existingRecordCopy?.afterPhotoDataUrl && existingRecordCopy.afterPhotoDataUrl !== payload.afterPhotoDataUrl ? existingRecordCopy.afterPhotoDataUrl : "",
          ]);
          showToast("Đã cập nhật phần cải tiến/xử lý.");
          renderAll();
          return true;
        },
      });
      return;
    }

    const issueDate = getSafetyRecordIssueDate(record, period);
    const photoPreview = record?.photoDataUrl
      ? "<div class=\"photo-preview\"><img src=\"" + record.photoDataUrl + "\" alt=\"Ảnh minh họa hiện tại\"><label class=\"check-line\"><input name=\"removePhoto\" type=\"checkbox\"><span>Xóa ảnh hiện tại</span></label></div>"
      : "";

    openFormModal({
      title: isNew ? "Thêm báo cáo đánh giá an toàn" : "Sửa báo cáo đánh giá an toàn",
      submitText: "Lưu báo cáo",
      extraActions: !isNew && canManageSafetyRecord(record)
        ? "<button class=\"danger-button\" type=\"button\" data-action=\"delete-safety-record\" data-id=\"" + escapeHtml(record.id) + "\">Xóa</button>"
        : "",
      modalClass: "safety-record-modal",
      html: "<div class=\"modal-context\">" +
          "<span><strong>Kỳ:</strong> " + escapeHtml(periodLabel(period)) + "</span>" +
          "<span><strong>Nguồn:</strong> Đánh giá an toàn nhà máy</span>" +
        "</div>" +
        "<div class=\"safety-record-entry-wrap\"><table class=\"safety-record-entry-table\">" +
          "<thead><tr>" +
            "<th>Zone</th><th>Ngày phát hiện</th><th>Mối nguy hiểm phát hiện được</th><th>Ảnh minh họa</th><th>Số lần</th><th>STOP 6</th><th>Cấp bậc</th><th>Phát hiện</th><th>Tình trạng</th><th>Phát hiện bởi</th><th>Mã nhân viên</th><th>Hạng mục</th><th>Nội dung cải tiến, xử lý</th><th>Ảnh sau cải tiến</th><th>Đảm nhiệm</th><th>Kế hoạch</th><th>Ngày hoàn thành</th>" +
          "</tr></thead>" +
          "<tbody><tr>" +
            "<td><select name=\"areaId\" required>" + getSafetyAreaOptions(periodId, selectedArea.id) + "</select></td>" +
            "<td><input name=\"issueDate\" type=\"date\" value=\"" + escapeHtml(issueDate) + "\" required></td>" +
            "<td><textarea name=\"note\" required>" + escapeHtml(record?.note || "") + "</textarea></td>" +
            "<td><input name=\"photo\" type=\"file\" accept=\"image/*\">" + photoPreview + "</td>" +
            "<td><input name=\"issueCount\" type=\"number\" min=\"1\" step=\"1\" value=\"" + escapeHtml(record ? getIssueCount(row) : 1) + "\"></td>" +
            "<td><select name=\"issueType\">" + optionHtml(STOP6_OPTIONS, record?.issueType || "") + "</select></td>" +
            "<td><select name=\"issueLevel\">" + optionHtml(ISSUE_LEVEL_OPTIONS, record?.issueLevel || "") + "</select></td>" +
            "<td><select name=\"foundChannel\">" + optionHtml(SAFETY_FOUND_OPTIONS, normalizeFoundChannel(record?.foundChannel || (record ? (getIssueFoundBy(row) ? "worker" : "") : "worker"))) + "</select></td>" +
            "<td><select name=\"issueStatus\">" + optionHtml(ISSUE_STATUS_OPTIONS, normalizeIssueStatus(record?.issueStatus || "open")) + "</select></td>" +
            "<td><input name=\"issueFoundBy\" type=\"text\" value=\"" + escapeHtml(record ? getIssueFoundBy(row) : getAccountDisplayName(currentUser, SAFETY_PERIOD_TYPE, periodId)) + "\"></td>" +
            "<td><input name=\"employeeCode\" type=\"text\" value=\"" + escapeHtml(record ? getIssueEmployeeCode(row) : "") + "\"></td>" +
            "<td><input name=\"issueItemLabel\" type=\"text\" value=\"" + escapeHtml(record ? getIssueItemLabel(row) : "Nhận diện nguy cơ mất an toàn") + "\"></td>" +
            "<td><textarea name=\"improvementContent\">" + escapeHtml(record?.improvementContent || "") + "</textarea></td>" +
            "<td><input name=\"afterPhoto\" type=\"file\" accept=\"image/*\">" + afterPhotoPreview + "</td>" +
            "<td><input name=\"actionOwner\" type=\"text\" value=\"" + escapeHtml(record?.actionOwner || defaultActionOwner) + "\"></td>" +
            "<td><input name=\"actionPlan\" type=\"text\" value=\"" + escapeHtml(record?.actionPlan || "") + "\"></td>" +
            "<td><input name=\"completionDate\" type=\"date\" value=\"" + escapeHtml(defaultCompletionDate) + "\"></td>" +
          "</tr></tbody>" +
        "</table></div>",
      async onSubmit(formData, form) {
        if (blockIfArchivedPeriod(periodId, SAFETY_PERIOD_TYPE)) {
          return false;
        }
        const selected = getAreaForPeriod(periodId, String(formData.get("areaId") || ""));
        if (!selected || !allowedIds.has(selected.id)) {
          showToast("Bạn không có quyền cập nhật zone này.", true);
          return false;
        }
        const issueDateValue = toIsoDate(formData.get("issueDate")) || todayIsoDate();
        const dateParts = issueDateValue.split("-");
        const issueCountInput = String(formData.get("issueCount") || "").trim();
        const issueCount = normalizeIssueCount(issueCountInput || 1);
        const note = String(formData.get("note") || "").trim();
        if (!note) {
          showToast("Vui lòng nhập nội dung vấn đề.", true);
          return false;
        }
        if (issueCountInput && issueCount === "") {
          showToast("Số lần phát hiện không hợp lệ.", true);
          return false;
        }

        const beforeLabel = record ? getIssueLocation(row) + " · " + (record.note || "") : "Tạo mới";
        const photoInput = form.elements.photo;
        const afterPhotoInput = form.elements.afterPhoto;
        const nextPhoto = await prepareScorePhoto(photoInput?.files?.[0], record, formData.get("removePhoto") === "on", periodId);
        const nextAfterPhoto = await prepareScorePhoto(
          afterPhotoInput?.files?.[0],
          { photoDataUrl: record?.afterPhotoDataUrl, photoName: record?.afterPhotoName },
          formData.get("removeAfterPhoto") === "on",
          periodId,
        );
        const issueType = String(formData.get("issueType") || "");
        const issueLevel = String(formData.get("issueLevel") || "");
        const now = new Date().toISOString();
        const ownerAccount = record ? getSafetyRecordOwnerAccount(record) : currentUser;
        const ownerUsername = record
          ? String(record.accountUsername || ownerAccount?.username || currentUser?.username || "").trim()
          : String(currentUser?.username || "").trim();
        const ownerName = record
          ? String(record.scorerName || getAccountDisplayName(ownerAccount, SAFETY_PERIOD_TYPE, periodId) || getAccountDisplayName(currentUser, SAFETY_PERIOD_TYPE, periodId)).trim()
          : getAccountDisplayName(currentUser, SAFETY_PERIOD_TYPE, periodId);
        const payload = normalizeSafetyRecord({
          ...(record || {}),
          id: record?.id || makeId("safety"),
          periodId,
          areaId: selected.id,
          issueLocation: "Zone " + selected.code,
          issueDay: String(Number(dateParts[2]) || ""),
          issueMonth: String(Number(dateParts[1]) || period.month || ""),
          note,
          photoDataUrl: nextPhoto.photoDataUrl,
          photoName: nextPhoto.photoName,
          issueCount,
          issueType,
          issueLevel,
          issueStatus: normalizeIssueStatus(formData.get("issueStatus")),
          issueFoundBy: String(formData.get("issueFoundBy") || "").trim(),
          employeeCode: String(formData.get("employeeCode") || "").trim(),
          issueItemLabel: String(formData.get("issueItemLabel") || "").trim(),
          foundChannel: normalizeFoundChannel(formData.get("foundChannel")),
          improvementContent: String(formData.get("improvementContent") || "").trim(),
          afterPhotoDataUrl: nextAfterPhoto.photoDataUrl,
          afterPhotoName: nextAfterPhoto.photoName,
          actionOwner: String(formData.get("actionOwner") || "").trim() || defaultActionOwner,
          actionPlan: String(formData.get("actionPlan") || "").trim(),
          completionDate: String(formData.get("completionDate") || "").trim() || defaultCompletionDate,
          completionLevelConfirm: getSafetyLevelConfirm({ issueLevel }),
          completionStop6Confirm: getSafetyStop6Confirm({ issueType }),
          scorerName: ownerName,
          accountUsername: ownerUsername,
          createdBy: record?.createdBy || ownerUsername,
          createdAt: record?.createdAt || now,
          updatedAt: now,
        });
        if (!hasSafetyRecordChanged(record, payload)) {
          showToast("Không có thay đổi mới.");
          return true;
        }

        const existingIndex = state.safetyRecords.findIndex((item) => item.id === payload.id);
        const existingRecordCopy = existingIndex >= 0 ? cloneValue(state.safetyRecords[existingIndex]) : (record ? cloneValue(record) : null);
        const payloadCopy = cloneValue(payload);

        if (existingIndex >= 0) {
          state.safetyRecords[existingIndex] = payload;
        } else {
          state.safetyRecords.push(payload);
        }
        state.deletedSafetyRecords = (state.deletedSafetyRecords || []).filter((item) => item.id !== payload.id);
        await saveSafetyRecord(payload);
        await Promise.all([
          tryUnmarkSafetyRecordDeleted(payload.id),
          tryLogAdminChange({
            subjectLabel: "Đánh giá an toàn",
            areaCode: selected.code,
            beforeLabel,
            afterLabel: payload.issueLocation + " · " + payload.note,
            changeLabel: (isNew ? "Thêm" : "Sửa") + " báo cáo AT Zone " + selected.code,
            scope: SAFETY_PERIOD_TYPE,
            periodId,
          }),
        ]);
        await deleteUnusedPhotoFiles([
          existingRecordCopy?.photoDataUrl && existingRecordCopy.photoDataUrl !== payload.photoDataUrl ? existingRecordCopy.photoDataUrl : "",
          existingRecordCopy?.afterPhotoDataUrl && existingRecordCopy.afterPhotoDataUrl !== payload.afterPhotoDataUrl ? existingRecordCopy.afterPhotoDataUrl : "",
        ]);
        pushUndoAction({
          type: "safetyRecord",
          description: `Báo cáo AT Zone ${selected.code}: ${payload.note || ""}`,
          recordId: payload.id,
          periodId,
          areaCode: selected.code,
          before: existingRecordCopy,
          after: payloadCopy,
          isNew,
        });
        showToast(isNew ? "Đã thêm báo cáo an toàn." : "Đã cập nhật báo cáo an toàn.");
        renderAll();
        return true;
      },
    });
  }
  function exportExcel(periodId) {
    if (!requireExportAction("Bạn không có quyền xuất file chấm 5S.")) {
      return;
    }

    const period = getPeriod(periodId);
    const bytes = buildXlsxWorkbook(periodId);
    const safeName = `bang-diem-5s-thang-${period?.month || "x"}-${period?.year || "x"}.xlsx`;
    downloadFile(safeName, bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  function confirmExportExcel(periodId) {
    if (!requireExportAction("Bạn không có quyền xuất file chấm 5S.")) {
      return;
    }

    const period = getPeriod(periodId);
    openConfirmModal({
      title: "Xác nhận xuất Excel",
      message: `Xuất file Excel chấm điểm 5S cho ${periodLabel(period)}?`,
      confirmText: "Xuất Excel",
      onConfirm() {
        exportExcel(periodId);
      },
    });
  }

  async function exportSafetyExcel(periodId, options = {}) {
    if (!requireExportAction("Bạn không có quyền xuất file đánh giá an toàn.")) {
      return;
    }

    const period = getPeriod(periodId);
    const areaId = Object.prototype.hasOwnProperty.call(options, "areaId")
      ? options.areaId
      : elements.safetyAreaFilter?.value || "";
    const rows = getIssueRecords(periodId, { areaId });
    const logoImage = await loadWorkbookImage("images/Logo.jpg", "legroup-logo.jpg", 1, 1, 3, 2);
    const bytes = await buildSafetyXlsxWorkbook(periodId, rows, logoImage);
    const safeName = `danh-gia-an-toan-thang-${period?.month || "x"}-${period?.year || "x"}.xlsx`;
    downloadFile(safeName, bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  function confirmExportSafetyExcel(periodId, options = {}) {
    if (!requireExportAction("Bạn không có quyền xuất file đánh giá an toàn.")) {
      return;
    }

    const period = getPeriod(periodId);
    openConfirmModal({
      title: "Xác nhận xuất Excel",
      message: `Xuất file Excel đánh giá an toàn cho ${periodLabel(period)}?`,
      confirmText: "Xuất Excel",
      async onConfirm() {
        await exportSafetyExcel(periodId, options);
      },
    });
  }

  async function exportActiveSafetyReportExcel() {
    const reportId = activeSafetyReport || "assessment";
    if (reportId === "identification") {
      exportRiskIdentificationExcel();
      return;
    }
    if (reportId === "factory") {
      await exportFactoryRiskExcel();
      return;
    }
    await exportSafetyAssessmentExcel();
  }

  function getActiveSafetyExcelExportLabel() {
    const reportId = activeSafetyReport || "assessment";
    if (reportId === "identification") return "tổng hợp nhận diện nguy cơ";
    if (reportId === "factory") return "tổng hợp nguy cơ nhà máy";
    return "đánh giá an toàn";
  }

  function confirmExportActiveSafetyReportExcel() {
    openConfirmModal({
      title: "Xác nhận xuất Excel",
      message: `Xuất file Excel ${getActiveSafetyExcelExportLabel()} của trang đang mở?`,
      confirmText: "Xuất Excel",
      async onConfirm() {
        await exportActiveSafetyReportExcel();
      },
    });
  }

  async function exportSafetyAssessmentExcel() {
    if (!requireExportAction("Bạn không có quyền xuất file đánh giá an toàn.")) {
      return;
    }

    const safetyPeriod = getPeriod(getActivePeriodId(SAFETY_PERIOD_TYPE));
    const filters = getSafetyExcelFilters(safetyPeriod);
    const reportPeriod = getSafetyPeriodForMonth(filters.year, filters.month) || safetyPeriod;
    await exportSafetyExcel(reportPeriod?.id || getActivePeriodId(SAFETY_PERIOD_TYPE), {
      areaId: elements.safetyAreaFilter?.value || "",
    });
  }

  function exportRiskIdentificationExcel() {
    const safetyPeriod = getPeriod(getActivePeriodId(SAFETY_PERIOD_TYPE));
    const filters = getSafetyExcelFilters(safetyPeriod);
    const reportPeriod = getSafetyPeriodForMonth(filters.year, filters.month) || safetyPeriod;
    const reportPeriodId = reportPeriod?.id || getActivePeriodId(SAFETY_PERIOD_TYPE);
    const areaId = elements.safetyAreaFilter?.value || "";
    const monthRows = getSafetyRowsForYear(filters.year, { areaId }).filter((row) => getSafetyIssueMonth(row) === filters.month);
    const areas = getAreasForPeriod(reportPeriodId).filter((area) => isReportableSafetyArea(area) && (!areaId || area.id === areaId));
    const sheetName = `Tháng.${filters.month}.${filters.year}`;
    const model = buildRiskIdentificationWorksheetModel(reportPeriodId, monthRows, filters, sheetName, areas);
    const bytes = buildWorkbookFromSheets([{ name: sheetName, xml: buildWorksheetXml(model), charts: model.charts || [] }]);
    const safeName = `tong-hop-nhan-dien-nguy-co-thang-${filters.month}-${filters.year}.xlsx`;
    downloadFile(safeName, bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  async function exportFactoryRiskExcel() {
    const safetyPeriod = getPeriod(getActivePeriodId(SAFETY_PERIOD_TYPE));
    const year = Number(elements.safetyYearFilter?.value) || Number(safetyPeriod?.year) || new Date().getFullYear();
    const reportPeriodId = safetyPeriod?.id || getActivePeriodId(SAFETY_PERIOD_TYPE);
    const bytes = await buildFactoryRiskXlsxWorkbook(reportPeriodId, year);
    const safeName = `tong-hop-nguy-co-nha-may-${year}.xlsx`;
    downloadFile(safeName, bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  function normalizePageJsonPage(page = "") {
    const value = String(page || "").trim();
    if (["five-s", "5s", "assessor", "summary"].includes(value)) return "five-s";
    if (["safety-assessment", "assessment", "danh-gia-an-toan"].includes(value)) return "safety-assessment";
    if (["risk-identification", "identification", "tong-hop-nhan-dien-nguy-co"].includes(value)) return "risk-identification";
    if (["factory-risk", "factory", "tong-hop-nguy-co-nha-may"].includes(value)) return "factory-risk";
    return "";
  }

  function getActivePageJsonPage(sourceElement = null) {
    const requestedPage = normalizePageJsonPage(sourceElement?.dataset.page || "");
    if (requestedPage) {
      return requestedPage;
    }
    if (activeTab === "safety") {
      if (activeSafetyReport === "identification") return "risk-identification";
      if (activeSafetyReport === "factory") return "factory-risk";
      return "safety-assessment";
    }
    return "five-s";
  }

  function getPageJsonLabel(page) {
    return {
      "five-s": "chấm điểm 5S",
      "safety-assessment": "đánh giá an toàn",
      "risk-identification": "tổng hợp nhận diện nguy cơ",
      "factory-risk": "tổng hợp nguy cơ nhà máy",
    }[normalizePageJsonPage(page)] || "trang hiện tại";
  }

  function getPageJsonScope(page) {
    return normalizePageJsonPage(page) === "five-s" ? FIVE_S_PERIOD_TYPE : SAFETY_PERIOD_TYPE;
  }

  function cloneArray(items = []) {
    return (items || []).map((item) => cloneValue(item));
  }

  function toImportedArray(value) {
    return snapshotToArray(value).filter((item) => item && typeof item === "object");
  }

  function periodListForIds(periodIds = []) {
    const idSet = new Set(periodIds.filter(Boolean));
    return cloneArray(state.periods.filter((period) => idSet.has(period.id)));
  }

  function getSafetyOverridesForPeriods(periodIds = []) {
    const overrides = {};
    periodIds.forEach((periodId) => {
      if (state.safetyIdentificationOverrides?.[periodId]) {
        overrides[periodId] = cloneValue(state.safetyIdentificationOverrides[periodId]);
      }
    });
    return overrides;
  }

  function getSafetyPageJsonSelection(page) {
    const safetyPeriod = getPeriod(getActivePeriodId(SAFETY_PERIOD_TYPE));
    const filters = getSafetyExcelFilters(safetyPeriod);
    const areaId = page === "factory-risk" ? "" : elements.safetyAreaFilter?.value || "";
    const yearRows = getSafetyRowsForYear(filters.year, { areaId });
    const monthRows = yearRows.filter((row) => getSafetyIssueMonth(row) === filters.month);
    const reportPeriod = page === "factory-risk"
      ? safetyPeriod
      : getSafetyPeriodForMonth(filters.year, filters.month) || safetyPeriod;
    return {
      filters: {
        year: filters.year,
        month: filters.month,
        areaId,
        department: page === "factory-risk" ? elements.safetyDepartmentFilter?.value || "" : "",
      },
      reportPeriod,
      rows: page === "factory-risk" ? yearRows : monthRows,
    };
  }

  function buildPageJsonBundle(page) {
    const normalizedPage = normalizePageJsonPage(page);
    if (!normalizedPage) {
      throw new Error("Không xác định được trang để export JSON.");
    }

    let filters = {};
    let payload = {};
    if (normalizedPage === "five-s") {
      const period = getPeriod(elements.summaryPeriodSelect?.value || getActivePeriodId(FIVE_S_PERIOD_TYPE));
      const periodId = period?.id || "";
      filters = {
        periodId,
        month: Number(period?.month) || "",
        year: Number(period?.year) || "",
        label: periodLabel(period),
        scoreSource: elements.summaryScoreSource?.value || "",
      };
      payload = {
        periods: periodId ? periodListForIds([periodId]) : [],
        managers: cloneArray(state.managers),
        departmentHeadContacts: cloneArray(state.departmentHeadContacts),
        assessors: cloneArray(state.assessors),
        areas: cloneArray(state.areas),
        fiveSChartTargets: cloneValue(getFiveSChartTargets()),
        scores: cloneArray((state.scores || []).filter((score) => score.periodId === periodId)),
      };
    } else {
      const selection = getSafetyPageJsonSelection(normalizedPage);
      const periodIds = [...new Set([
        ...selection.rows.map((row) => row.score?.periodId).filter(Boolean),
        selection.reportPeriod?.id || "",
      ].filter(Boolean))];
      filters = selection.filters;
      payload = {
        periods: periodListForIds(periodIds),
        safetyManagers: cloneArray(state.safetyManagers),
        safetyDepartmentHeadContacts: cloneArray(state.safetyDepartmentHeadContacts),
        safetyAssessors: cloneArray(state.safetyAssessors),
        safetyAreas: cloneArray(state.safetyAreas),
        safetyDepartmentGroups: cloneArray(state.safetyDepartmentGroups),
        safetyReport: cloneValue(state.safetyReport || DEFAULT_SAFETY_REPORT),
        safetyIdentificationOverrides: getSafetyOverridesForPeriods(periodIds),
        safetyRecords: cloneArray(selection.rows.map((row) => row.score).filter(Boolean)),
      };
    }

    return {
      format: PAGE_JSON_FORMAT,
      version: PAGE_JSON_VERSION,
      dataVersion: DATA_VERSION,
      page: normalizedPage,
      exportedAt: new Date().toISOString(),
      filters,
      payload,
    };
  }

  function getPageJsonFilename(page, bundle) {
    const filters = bundle?.filters || {};
    if (page === "five-s") {
      return `5s-${makeSafeFilenamePart(filters.label || "ky-danh-gia")}.json`;
    }
    if (page === "safety-assessment") {
      return `danh-gia-an-toan-thang-${filters.month || "x"}-${filters.year || "x"}.json`;
    }
    if (page === "risk-identification") {
      return `tong-hop-nhan-dien-nguy-co-thang-${filters.month || "x"}-${filters.year || "x"}.json`;
    }
    return `tong-hop-nguy-co-nha-may-${filters.year || "x"}.json`;
  }

  function exportPageJson(sourceElement = null) {
    if (!requireAdminAction("Chỉ admin được export dữ liệu JSON.")) {
      return;
    }

    try {
      const page = getActivePageJsonPage(sourceElement);
      const bundle = buildPageJsonBundle(page);
      downloadFile(getPageJsonFilename(page, bundle), JSON.stringify(bundle, null, 2), "application/json;charset=utf-8");
      showToast("Đã export dữ liệu JSON.");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Lỗi khi export dữ liệu JSON.", true);
    }
  }

  function confirmExportPageJson(sourceElement = null) {
    if (!requireAdminAction("Chỉ admin được export dữ liệu JSON.")) {
      return;
    }

    const page = getActivePageJsonPage(sourceElement);
    openConfirmModal({
      title: "Xác nhận Export",
      message: `Export dữ liệu JSON của trang ${getPageJsonLabel(page)} đang mở?`,
      confirmText: "Export",
      onConfirm() {
        exportPageJson(sourceElement);
      },
    });
  }

  function requireOpenPeriodForPageJson(page) {
    const scope = getPageJsonScope(page);
    const activePeriodId = getActivePeriodId(scope);
    if (activePeriodId && isPeriodOpen(activePeriodId, scope)) {
      return true;
    }
    showToast(scope === FIVE_S_PERIOD_TYPE
      ? "Không có kỳ đánh giá 5S đang mở nên không thể import dữ liệu."
      : "Không có kỳ đánh giá an toàn đang mở nên không thể import dữ liệu.", true);
    return false;
  }

  function pickJsonImportFile() {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.hidden = true;
      input.addEventListener("change", () => {
        const file = input.files?.[0] || null;
        input.remove();
        resolve(file);
      }, { once: true });
      input.addEventListener("cancel", () => {
        input.remove();
        resolve(null);
      }, { once: true });
      document.body.appendChild(input);
      input.click();
    });
  }

  async function readJsonImportFile(file) {
    const text = await file.text();
    const bundle = JSON.parse(text);
    if (!bundle || typeof bundle !== "object" || bundle.format !== PAGE_JSON_FORMAT) {
      throw new Error("File JSON không đúng định dạng export của hệ thống.");
    }
    const page = normalizePageJsonPage(bundle.page);
    if (!page) {
      throw new Error("File JSON không xác định được trang dữ liệu.");
    }
    return { ...bundle, page, payload: bundle.payload || {} };
  }

  function mergeCollectionById(current = [], incoming = [], normalizer = null) {
    const rows = [];
    const indexById = new Map();
    (current || []).forEach((item) => {
      if (!item?.id) {
        return;
      }
      indexById.set(String(item.id), rows.length);
      rows.push(item);
    });

    toImportedArray(incoming).forEach((raw) => {
      const normalized = normalizer ? normalizer(raw) : { ...raw };
      if (!normalized?.id) {
        return;
      }
      const key = String(normalized.id);
      if (indexById.has(key)) {
        const index = indexById.get(key);
        rows[index] = { ...rows[index], ...normalized };
      } else {
        indexById.set(key, rows.length);
        rows.push(normalized);
      }
    });
    return rows;
  }

  function normalizeImportedScore(score) {
    const numericScore = Number(score.score);
    return {
      ...score,
      status: score.status === SCORE_CROSSED ? SCORE_CROSSED : "",
      score: Number.isFinite(numericScore) ? numericScore : null,
      scoreSource: normalizeScoreSource(score.scoreSource),
      updatedAt: score.updatedAt || new Date().toISOString(),
    };
  }

  function applyFiveSPageJsonImport(payload = {}) {
    state.periods = mergeCollectionById(state.periods, payload.periods);
    state.managers = mergeCollectionById(state.managers, payload.managers);
    state.departmentHeadContacts = mergeCollectionById(state.departmentHeadContacts, payload.departmentHeadContacts);
    state.assessors = mergeCollectionById(state.assessors, payload.assessors);
    state.areas = mergeCollectionById(state.areas, payload.areas);
    state.scores = mergeCollectionById(state.scores, payload.scores, normalizeImportedScore);
    invalidateScoreRecordIndex();
    if (payload.fiveSChartTargets && typeof payload.fiveSChartTargets === "object") {
      state.fiveSChartTargets = normalizeFiveSChartTargets({
        ...state.fiveSChartTargets,
        ...payload.fiveSChartTargets,
      });
    }
    return toImportedArray(payload.scores).length;
  }

  function applySafetyPageJsonImport(payload = {}) {
    state.periods = mergeCollectionById(state.periods, payload.periods);
    state.safetyManagers = mergeCollectionById(state.safetyManagers, payload.safetyManagers);
    state.safetyDepartmentHeadContacts = mergeCollectionById(state.safetyDepartmentHeadContacts, payload.safetyDepartmentHeadContacts);
    state.safetyAssessors = mergeCollectionById(state.safetyAssessors, payload.safetyAssessors);
    state.safetyAreas = mergeCollectionById(state.safetyAreas, payload.safetyAreas);
    state.safetyDepartmentGroups = mergeCollectionById(state.safetyDepartmentGroups, payload.safetyDepartmentGroups);
    state.safetyRecords = mergeCollectionById(state.safetyRecords, payload.safetyRecords, normalizeSafetyRecord).filter(hasSafetyRecordContent);
    if (payload.safetyReport && typeof payload.safetyReport === "object") {
      state.safetyReport = { ...DEFAULT_SAFETY_REPORT, ...state.safetyReport, ...payload.safetyReport };
    }
    if (payload.safetyIdentificationOverrides && typeof payload.safetyIdentificationOverrides === "object") {
      state.safetyIdentificationOverrides = normalizeTextOverrideMap({
        ...state.safetyIdentificationOverrides,
        ...payload.safetyIdentificationOverrides,
      });
    }
    return toImportedArray(payload.safetyRecords).length;
  }

  async function importPageJson(sourceElement = null) {
    if (!requireAdminAction("Chỉ admin được import dữ liệu JSON.")) {
      return;
    }

    const targetPage = getActivePageJsonPage(sourceElement);
    if (!requireOpenPeriodForPageJson(targetPage)) {
      return;
    }
    const file = await pickJsonImportFile();
    if (!file) {
      return;
    }

    try {
      const bundle = await readJsonImportFile(file);
      if (bundle.page !== targetPage) {
        showToast(`File này thuộc trang ${getPageJsonLabel(bundle.page)}. Hãy mở đúng trang rồi import.`, true);
        return;
      }

      const beforeImportState = stateToStorage(state);
      const importedRows = targetPage === "five-s"
        ? applyFiveSPageJsonImport(bundle.payload)
        : applySafetyPageJsonImport(bundle.payload);
      state = normalizeState(stateToStorage(state));
      invalidateScoreRecordIndex();
      await saveState();
      await logAdminChange({
        subjectLabel: "Import JSON",
        beforeLabel: file.name,
        afterLabel: `${importedRows} bản ghi`,
        changeLabel: `Import JSON ${getPageJsonLabel(targetPage)}`,
        scope: getPageJsonScope(targetPage),
      });
      const importUndoAction = {
        type: "importJson",
        description: `Import JSON ${getPageJsonLabel(targetPage)} từ ${file.name}`,
        page: targetPage,
        fileName: file.name,
        importedRows,
        importedAt: new Date().toISOString(),
        beforeState: beforeImportState,
        afterState: stateToStorage(state),
      };
      pushUndoAction(importUndoAction);
      persistImportUndoAction(importUndoAction);
      showToast(`Đã import ${importedRows} bản ghi JSON. Có thể bấm Hoàn tác nếu import nhầm.`);
      renderAll();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Lỗi khi import dữ liệu JSON.", true);
    }
  }

  function confirmImportPageJson(sourceElement = null) {
    if (!requireAdminAction("Chỉ admin được import dữ liệu JSON.")) {
      return;
    }

    const page = getActivePageJsonPage(sourceElement);
    if (!requireOpenPeriodForPageJson(page)) {
      return;
    }
    openConfirmModal({
      title: "Xác nhận Import",
      message: `Import file JSON vào trang ${getPageJsonLabel(page)}? Dữ liệu trùng ID sẽ được cập nhật, dữ liệu mới sẽ được thêm. Sau khi import có thể bấm Hoàn tác hoặc Ctrl+Z nếu import nhầm.`,
      confirmText: "Import",
      async onConfirm() {
        await importPageJson(sourceElement);
      },
    });
  }

  function openSendSafetyMailModal(periodId, options = {}) {
    if (!requireAdminAction("Chỉ admin được gửi báo cáo an toàn.")) {
      return;
    }

    const areaId = Object.prototype.hasOwnProperty.call(options, "areaId")
      ? options.areaId
      : elements.safetyAreaFilter?.value || "";
    const reportRows = getIssueRecords(periodId, { areaId });
    const openRows = reportRows.filter((row) => isIssueOpen(row.score));
    const { recipients, missingAreaCodes } = collectSafetyRecipients(reportRows, periodId);
    const recipientEmails = recipients.map((recipient) => recipient.email).join(", ");
    const issueAreaCodes = [...new Set(reportRows.map((row) => row.area?.code).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "vi"));
    if (!reportRows.length) {
      showToast("Không có dữ liệu ĐG AT để gửi báo cáo.", true);
      return;
    }

    function resolveSafetyDepartmentHeadName(area) {
      if (area?.departmentHead && String(area.departmentHead).trim()) {
        return String(area.departmentHead).trim();
      }
      const safetyDept = getSafetyDepartmentForArea(area, periodId);
      if (safetyDept && !/^zone\b/i.test(safetyDept) && safetyDept !== "Khác") {
        return String(safetyDept).trim();
      }
      if (area?.summaryGroup && String(area.summaryGroup).trim()) {
        return String(area.summaryGroup).trim();
      }
      return "Chưa có trưởng phòng";
    }

    function resolveSafetyZoneName(area, rows = []) {
      const rawCode = String(area?.code || (rows[0] ? getIssueLocation(rows[0]) : "") || "").trim();
      if (!rawCode) {
        return "Zone chưa xác định";
      }
      if (/^zone\s*/i.test(rawCode)) {
        return `Zone ${rawCode.replace(/^zone\s*/i, "").trim()}`;
      }
      return `Zone ${rawCode}`;
    }

    const zoneIssuesMap = new Map();
    reportRows.forEach((row) => {
      const area = row.area;
      const key = area?.id || area?.code || (row.score?.areaId || "unknown");
      if (!zoneIssuesMap.has(key)) {
        zoneIssuesMap.set(key, {
          area,
          rows: [],
        });
      }
      zoneIssuesMap.get(key).rows.push(row);
    });

    const sortedZones = [...zoneIssuesMap.values()].sort((a, b) => {
      const orderA = a.area?.order != null ? Number(a.area.order) : 9999;
      const orderB = b.area?.order != null ? Number(b.area.order) : 9999;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      const codeA = String(a.area?.code || "");
      const codeB = String(b.area?.code || "");
      return codeA.localeCompare(codeB, "vi", { numeric: true });
    });

    const reportSummaryLines = sortedZones.map((entry, index) => {
      const deptHead = resolveSafetyDepartmentHeadName(entry.area);
      const zoneName = resolveSafetyZoneName(entry.area, entry.rows);
      const count = entry.rows.length;
      return `${index + 1}. ${deptHead} - ${zoneName} - ${count} vấn đề`;
    });
    const reportSummaryText = reportSummaryLines.join("\n");

    openFormModal({
      title: "Gửi báo cáo ĐG AT cho trưởng phòng",
      submitText: "Copy email",
      extraActions: `<button class="primary-button" type="button" data-action="send-safety-report-mail" data-period-id="${escapeHtml(periodId)}" data-area-id="${escapeHtml(areaId)}" ${recipients.length ? "" : "disabled"}>Gửi riêng từng trưởng phòng</button>`,
      extraRightActions: `<button class="primary-button" type="button" id="copy-safety-report-summary-btn" data-action="copy-safety-report-summary">Copy báo cáo</button>`,
      html: `
        <div class="modal-context">
          <span><strong>${recipients.length}</strong> email trưởng phòng · <strong>${issueAreaCodes.length}</strong> zone · <strong>${reportRows.length}</strong> vấn đề trong file.</span>
          <span><strong>${openRows.length}</strong> vấn đề chưa xử lý hoặc đang theo dõi. Hệ thống sẽ gửi từng email riêng, mỗi file chỉ gồm zone của trưởng phòng đó.</span>
          ${missingAreaCodes.length ? `<span class="missing-email-note">Zone trong báo cáo chưa có email trưởng phòng: ${escapeHtml(missingAreaCodes.join(", "))}</span>` : ""}
        </div>
        <label class="email-copy-field">
          <span>Nội dung báo cáo (các zone có vấn đề)</span>
          <textarea id="safety-report-summary-text" readonly rows="4">${escapeHtml(reportSummaryText)}</textarea>
          <small>Số thứ tự các zone có vấn đề an toàn để gửi báo cáo nhanh.</small>
        </label>
        <label class="email-copy-field">
          <span>Email nhận báo cáo</span>
          <textarea id="safety-recipient-emails" readonly>${escapeHtml(recipientEmails)}</textarea>
          <small>Có thể copy để gửi thủ công nếu SMTP chưa được cấu hình.</small>
        </label>
        <div class="recipient-list email-recipient-list">
          ${recipients
            .map((recipient) => `<div class="recipient-card">
              <strong>${escapeHtml(recipient.email)}</strong>
              <span>${escapeHtml(recipient.departmentHeads.join(", ") || "Chưa có trưởng phòng")} · Zone ${escapeHtml(recipient.areaCodes.join(", "))} · ${recipient.issueCount} vấn đề</span>
            </div>`)
            .join("") || '<div class="recipient-card muted-card">Chưa có email trưởng phòng cho các zone trong báo cáo.</div>'}
        </div>
      `,
      async onSubmit() {
        await copyTextToClipboard(recipientEmails, "Đã copy toàn bộ email.");
        return false;
      },
    });

    document.getElementById("copy-safety-report-summary-btn")?.addEventListener("click", async () => {
      await copyTextToClipboard(reportSummaryText, "Đã copy nội dung báo cáo.");
    });
  }

  function makeSafeFilenamePart(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "truong-phong";
  }

  function buildSafetyReportMailBody() {
    return "file excel";
  }

  async function sendSafetyReportMail(periodId, options = {}) {
    if (!requireAdminAction("Chỉ admin được gửi báo cáo an toàn.")) {
      return;
    }

    const period = getPeriod(periodId);
    const areaId = Object.prototype.hasOwnProperty.call(options, "areaId")
      ? options.areaId
      : elements.safetyAreaFilter?.value || "";
    const reportRows = getIssueRecords(periodId, { areaId });
    const openRows = reportRows.filter((row) => isIssueOpen(row.score));
    const { recipients, missingAreaCodes } = collectSafetyRecipients(reportRows, periodId);

    if (!reportRows.length) {
      showToast("Không có dữ liệu ĐG AT để gửi báo cáo.", true);
      return;
    }

    if (!recipients.length) {
      showToast("Chưa có email trưởng phòng cho các zone trong báo cáo.", true);
      return;
    }

    showToast("Đang tạo file Excel riêng và gửi từng trưởng phòng...");
    const logoImage = await loadWorkbookImage("images/Logo.jpg", "legroup-logo.jpg", 1, 1, 3, 2);
    const recipientEmails = recipients.map((recipient) => recipient.email);
    const messages = await Promise.all(recipients.map(async (recipient) => {
      const areaCodeSet = new Set(recipient.areaCodes);
      const recipientRows = reportRows.filter((row) => areaCodeSet.has(row.area?.code));
      const recipientOpenRows = recipientRows.filter((row) => isIssueOpen(row.score));
      const bytes = await buildSafetyXlsxWorkbook(periodId, recipientRows, logoImage);
      const headPart = makeSafeFilenamePart(recipient.departmentHeads.join("-") || recipient.email);
      const zonePart = makeSafeFilenamePart(recipient.areaCodes.join("-"));
      const safeName = `danh-gia-an-toan-${period?.month || "x"}-${period?.year || "x"}-${headPart}-${zonePart}.xlsx`;

      return {
        recipient: recipient.email,
        subject: `[LeGroup 5S] Báo cáo đánh giá an toàn ${period ? periodLabel(period) : ""}`.trim(),
        body: buildSafetyReportMailBody(period, recipientRows, recipientOpenRows, [], recipient),
        filename: safeName,
        attachmentMime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        attachmentBase64: bytesToBase64(bytes),
      };
    }));
    const isDemoMailRun = dataStore?.isDemoMode?.();
    let result = { recipientCount: recipientEmails.length };
    if (!isDemoMailRun) {
      const response = await fetch("/api/send-safety-report", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: recipientEmails, messages }),
      });
      result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Không gửi được báo cáo.");
      }
    }

    closeModal();
    showToast(isDemoMailRun
      ? `Demo: đã tạo ${result.recipientCount || recipientEmails.length} email trưởng phòng (không gửi thật).`
      : `Đã gửi riêng ${result.recipientCount || recipientEmails.length} email trưởng phòng.`);
  }

  function collectSafetyRecipients(rows, periodId) {
    const byEmail = new Map();
    const missingAreaCodes = new Set();
    rows.forEach((row) => {
      const emails = getAreaDepartmentHeadEmailsForPeriod(periodId, row.area);
      if (!emails.length) {
        missingAreaCodes.add(row.area?.code || getIssueLocation(row));
      }

      emails.forEach((email) => {
        const key = email.toLocaleLowerCase();
        if (!byEmail.has(key)) {
          byEmail.set(key, { email, departmentHeads: new Set(), areaCodes: new Set(), issueCount: 0 });
        }
        const recipient = byEmail.get(key);
        if (row.area?.departmentHead) {
          recipient.departmentHeads.add(row.area.departmentHead);
        }
        if (row.area?.code) {
          recipient.areaCodes.add(row.area.code);
        }
        recipient.issueCount += 1;
      });
    });

    return {
      recipients: [...byEmail.values()]
        .map((recipient) => ({
          ...recipient,
          departmentHeads: [...recipient.departmentHeads].sort((a, b) => a.localeCompare(b, "vi")),
          areaCodes: [...recipient.areaCodes].sort((a, b) => a.localeCompare(b, "vi")),
        }))
        .sort((a, b) => a.email.localeCompare(b.email)),
      missingAreaCodes: [...missingAreaCodes].sort((a, b) => a.localeCompare(b, "vi")),
    };
  }

  async function buildSafetyXlsxWorkbook(periodId, issueRows, logoImage = null) {
    const images = [];
    if (logoImage) {
      images.push(logoImage);
    }

    for (const [index, row] of issueRows.entries()) {
      const rowNumber = 9 + index;
      const beforeImage = await photoSourceToImage(row.score.photoDataUrl, images.length + 1, rowNumber, 6);
      if (beforeImage) {
        images.push(beforeImage);
      }
      const afterImage = await photoSourceToImage(row.score.afterPhotoDataUrl, images.length + 1, rowNumber, 23);
      if (afterImage) {
        images.push(afterImage);
      }
    }

    const model = buildSafetyWorksheetModel(periodId, issueRows);
    const files = {
      "[Content_Types].xml": buildSafetyContentTypesXml(images),
      "_rels/.rels": buildRootRelationshipsXml(),
      "xl/workbook.xml": buildWorkbookXml("Đánh giá an toàn"),
      "xl/_rels/workbook.xml.rels": buildWorkbookRelationshipsXml(),
      "xl/styles.xml": buildXlsxStylesXml(),
      "xl/worksheets/sheet1.xml": buildSafetyWorksheetXml(model, images.length > 0),
    };

    if (images.length) {
      files["xl/worksheets/_rels/sheet1.xml.rels"] = buildSafetyWorksheetRelationshipsXml();
      files["xl/drawings/drawing1.xml"] = buildSafetyDrawingXml(images);
      files["xl/drawings/_rels/drawing1.xml.rels"] = buildSafetyDrawingRelationshipsXml(images);
      images.forEach((image) => {
        files[`xl/media/${image.name}`] = image.bytes;
      });
    }

    return zipFiles(files);
  }

  function buildSafetyWorksheetModel(periodId, issueRows, options = {}) {
    const period = getPeriod(periodId);
    const report = getSafetyReportForPeriod(periodId);
    const departmentLabel = String(options.departmentName || report.department || "").trim();
    const issueDate = formatDateDisplay(getReportDateValue(report, period, "issueDate"));
    const reportDate = formatDateDisplay(getReportDateValue(report, period, "reportDate"));
    const rows = new Map();
    const rowHeights = new Map();
    const merges = [];
    const maxColumn = 28;

    function addCell(row, column, value, style, options = {}) {
      if (!rows.has(row)) {
        rows.set(row, []);
      }
      rows.get(row).push({ row, column, value, style, ...options });
    }

    function merge(rowStart, columnStart, rowEnd, columnEnd) {
      merges.push(`${cellRef(rowStart, columnStart)}:${cellRef(rowEnd, columnEnd)}`);
    }

    rowHeights.set(1, 34);
    rowHeights.set(2, 22);
    rowHeights.set(3, 20);
    rowHeights.set(4, 20);
    rowHeights.set(5, 20);
    rowHeights.set(6, 36);
    rowHeights.set(7, 32);
    rowHeights.set(8, 70);

    addCell(1, 1, "LeGroup", 2);
    merge(1, 1, 2, 3);
    addCell(1, 4, "BẢNG THEO DÕI NHẬN DẠNG NGUY HIỂM VÀ KHẮC PHỤC\nHAZARD IDENTIFICATION & ACTIVITY FOLLOW UP SHEET", 1);
    merge(1, 4, 2, 22);
    addCell(1, 23, "Issue Date", 13);
    merge(1, 23, 1, 25);
    addCell(1, 26, issueDate, 14);
    merge(1, 26, 1, 28);
    addCell(2, 23, "Report date", 13);
    merge(2, 23, 2, 25);
    addCell(2, 26, reportDate, 14);
    merge(2, 26, 2, 28);

    addCell(3, 1, `Người Thực Hiện: ${report.performer}`, 13);
    merge(3, 1, 3, 6);
    addCell(3, 7, "Người Kiểm Tra:", 13);
    merge(3, 7, 3, 11);
    addCell(3, 12, report.checker, 13);
    merge(3, 12, 3, 28);
    addCell(4, 1, `Chức Danh: ${report.performerTitle || ""}`, 13);
    merge(4, 1, 4, 6);
    addCell(4, 7, `Chức Danh: ${report.checkerTitle || ""}`, 13);
    merge(4, 7, 4, 11);
    addCell(4, 12, "", 13);
    merge(4, 12, 4, 28);
    addCell(5, 1, `Bộ Phận: ${departmentLabel}`, 13);
    merge(5, 1, 5, 6);
    addCell(5, 7, `Bộ Phận: ${report.checkerDepartment || ""}`, 13);
    merge(5, 7, 5, 11);
    addCell(5, 12, "", 13);
    merge(5, 12, 5, 28);

    [
      [1, "No"],
      [2, "Vị trí"],
      [3, "Ngày"],
      [4, "Tháng"],
      [5, "Mối nguy hiểm phát hiện được ."],
      [6, "Hình Ảnh Minh Họa"],
      [7, "Số lần phát hiện"],
      [21, "Mã nhân viên"],
      [22, "Nội dung cải tiến, xử lý"],
      [23, "Hình ảnh sau cải tiến, xử lý"],
      [24, "Đảm nhiệm"],
      [25, "Kế hoạch"],
    ].forEach(([column, label]) => {
      addCell(6, column, label, 2);
      merge(6, column, 8, column);
    });

    addCell(6, 8, report.instruction || DEFAULT_SAFETY_REPORT.instruction, 2);
    merge(6, 8, 6, 20);
    addCell(6, 26, "Hoàn thành", 2);
    merge(6, 26, 6, 28);
    addCell(7, 8, "Phân loại STOP 6", 2);
    merge(7, 8, 7, 14);
    addCell(7, 15, "Cấp bậc", 2);
    merge(7, 15, 7, 17);
    addCell(7, 18, "Phát hiện", 2);
    merge(7, 18, 7, 20);
    addCell(7, 26, "Ngày", 2);
    merge(7, 26, 8, 26);
    addCell(7, 27, "Xác nhận theo cấp độ", 2);
    merge(7, 27, 8, 27);
    addCell(7, 28, "Xác nhận theo loại stop 6", 2);
    merge(7, 28, 8, 28);
    SAFETY_STOP6_COLUMNS.forEach((column, index) => addCell(8, 8 + index, column.label, 26));
    SAFETY_LEVEL_COLUMNS.forEach((column, index) => addCell(8, 15 + index, column.label, 26));
    SAFETY_FOUND_COLUMNS.forEach((column, index) => addCell(8, 18 + index, column.label, 26));

    issueRows.forEach((row, index) => {
      const rowNumber = 9 + index;
      rowHeights.set(rowNumber, row.score.photoDataUrl || row.score.afterPhotoDataUrl ? 92 : 44);
      addCell(rowNumber, 1, index + 1, 14);
      addCell(rowNumber, 2, getIssueLocation(row), 24);
      addCell(rowNumber, 3, getIssueDay(row), 14);
      addCell(rowNumber, 4, getIssueMonth(row, periodId), 14);
      addCell(rowNumber, 5, row.score.note || getIssueDescription(row), 24);
      addCell(rowNumber, 6, "", 24);
      addCell(rowNumber, 7, getIssueCount(row), 14);
      SAFETY_STOP6_COLUMNS.forEach((column, columnIndex) => {
        const selected = isSafetyStop6Selected(row.score, column.value);
        addCell(rowNumber, 8 + columnIndex, selected ? 1 : "", 14);
      });
      SAFETY_LEVEL_COLUMNS.forEach((column, columnIndex) => {
        const selected = isSafetyLevelSelected(row.score, column.value);
        addCell(rowNumber, 15 + columnIndex, selected ? 1 : "", column.value === "A" ? 27 : 14);
      });
      SAFETY_FOUND_COLUMNS.forEach((column, columnIndex) => {
        const selected = isSafetyFoundSelected(row.score, column.value);
        addCell(rowNumber, 18 + columnIndex, selected ? getIssueFoundBy(row) || 1 : "", selected ? 24 : 14);
      });
      addCell(rowNumber, 21, row.score.employeeCode || "", 14);
      addCell(rowNumber, 22, row.score.improvementContent || "", 24);
      addCell(rowNumber, 23, "", 24);
      addCell(rowNumber, 24, row.score.actionOwner || "", 24);
      addCell(rowNumber, 25, row.score.actionPlan || "", 24);
      addCell(rowNumber, 26, getCompletionDateDisplay(row.score), 14);
      addCell(rowNumber, 27, getSafetyLevelConfirm(row.score), 24);
      addCell(rowNumber, 28, getSafetyStop6Confirm(row.score), 24);
    });

    let summaryEndRow = 0;
    if (options.includeFactorySummary) {
      const summaryStartRow = Math.max(61, 11 + issueRows.length + 2);
      summaryEndRow = appendSafetyDepartmentSummaryRows(issueRows, addCell, merge, rowHeights, summaryStartRow);
    }

    const result = {
      rows,
      rowHeights,
      merges,
      tabColor: options.tabColor || "",
      maxColumn,
      maxRow: Math.max(9, 8 + issueRows.length, summaryEndRow),
    };
    fillModelBorders(result);
    return result;
  }

  function appendSafetyDepartmentSummaryRows(issueRows, addCell, merge, rowHeights, startRow) {
    const openRows = issueRows.filter((row) => !hasSafetyCountermeasure(row));
    const countRows = (rows, predicate = null) => sumSafetyIssueCounts(predicate ? rows.filter(predicate) : rows);
    const memberPredicate = (row) => isSafetyFoundSelected(row.score, "worker") || isSafetyFoundSelected(row.score, "department-head");
    const leanPredicate = (row) => isSafetyFoundSelected(row.score, "assessor");
    const setHeight = (row, height = 24) => rowHeights.set(row, height);
    const addMerged = (row, columnStart, columnEnd, value, style = 2) => {
      addCell(row, columnStart, value, style);
      if (columnEnd > columnStart) {
        merge(row, columnStart, row, columnEnd);
      }
    };

    setHeight(startRow, 24);
    setHeight(startRow + 1, 24);
    addCell(startRow, 1, "Ghi tổng số theo tiêu chí", 2);
    merge(startRow, 1, startRow + 1, 4);
    addMerged(startRow, 6, 7, "Số lần phát hiện", 2);
    addMerged(startRow, 8, 9, "LEAN", 2);
    addMerged(startRow, 10, 12, "Member", 2);
    addMerged(startRow, 13, 15, "Tổng", 2);
    addMerged(startRow + 1, 6, 7, "Số nguy hiểm nhận dạng", 24);
    addMerged(startRow + 1, 8, 9, countRows(issueRows, leanPredicate), 14);
    addMerged(startRow + 1, 10, 12, countRows(issueRows, memberPredicate), 14);
    addMerged(startRow + 1, 13, 15, countRows(issueRows), 14);

    const rankStart = startRow + 3;
    [rankStart, rankStart + 1, rankStart + 2].forEach((row) => setHeight(row, 24));
    addCell(rankStart, 1, "Ghi tổng số theo cấp độ", 2);
    merge(rankStart, 1, rankStart + 2, 4);
    addMerged(rankStart, 6, 7, "Phân Loại", 2);
    const rankColumns = [
      { value: "A", label: "Rank A", start: 8, end: 10 },
      { value: "B", label: "Rank B", start: 11, end: 14 },
      { value: "C", label: "Rank C", start: 15, end: 17 },
      { value: "", label: "Tổng", start: 18, end: 20 },
    ];
    rankColumns.forEach((column) => addMerged(rankStart, column.start, column.end, column.label, 2));
    addMerged(rankStart + 1, 6, 7, "Số nguy hiểm nhận dạng", 24);
    addMerged(rankStart + 2, 6, 7, "Số nguy hiểm còn tồn đọng", 24);
    rankColumns.forEach((column) => {
      const predicate = column.value ? (row) => isSafetyLevelSelected(row.score, column.value) : null;
      addMerged(rankStart + 1, column.start, column.end, countRows(issueRows, predicate), 14);
      addMerged(rankStart + 2, column.start, column.end, countRows(openRows, predicate), 14);
    });

    const stopStart = rankStart + 4;
    [stopStart, stopStart + 1, stopStart + 2].forEach((row) => setHeight(row, 24));
    addCell(stopStart, 1, "Ghi tổng số theo loại tai nạn chỉ định STOP 6", 2);
    merge(stopStart, 1, stopStart + 2, 4);
    addMerged(stopStart, 6, 7, "Phân Loại", 2);
    const stopColumns = [
      { column: SAFETY_STOP6_COLUMNS[0], start: 8, end: 10 },
      { column: SAFETY_STOP6_COLUMNS[1], start: 11, end: 14 },
      { column: SAFETY_STOP6_COLUMNS[2], start: 15, end: 16 },
      { column: SAFETY_STOP6_COLUMNS[3], start: 17, end: 18 },
      { column: SAFETY_STOP6_COLUMNS[4], start: 19, end: 20 },
      { column: SAFETY_STOP6_COLUMNS[5], start: 21, end: 23 },
      { column: SAFETY_STOP6_COLUMNS[6], start: 24, end: 26 },
      { column: null, start: 27, end: 28, label: "Tổng" },
    ];
    stopColumns.forEach((column) => addMerged(stopStart, column.start, column.end, column.label || column.column?.value || "", 2));
    addMerged(stopStart + 1, 6, 7, "Số nguy hiểm nhận dạng", 24);
    addMerged(stopStart + 2, 6, 7, "Số nguy hiểm còn tồn đọng", 24);
    stopColumns.forEach((column) => {
      const predicate = column.column ? (row) => isSafetyStop6Selected(row.score, column.column.value) : null;
      addMerged(stopStart + 1, column.start, column.end, countRows(issueRows, predicate), 14);
      addMerged(stopStart + 2, column.start, column.end, countRows(openRows, predicate), 14);
    });

    return stopStart + 2;
  }

  function buildSafetyWorksheetXml(model, hasImages) {
    const sortedRows = [...model.rows.entries()].sort((a, b) => a[0] - b[0]);
    const rowXml = sortedRows
      .map(([rowNumber, cells]) => {
        const height = model.rowHeights.get(rowNumber);
        const heightAttrs = height ? ` ht="${height}" customHeight="1"` : "";
        const cellsXml = cells
          .sort((a, b) => a.column - b.column)
          .map((cell) => buildCellXml(cell))
          .join("");
        return `<row r="${rowNumber}"${heightAttrs}>${cellsXml}</row>`;
      })
      .join("");
    const mergeXml = model.merges.length
      ? `<mergeCells count="${model.merges.length}">${model.merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`
      : "";
    const drawingXml = hasImages ? '<drawing r:id="rId1"/>' : "";
    const sheetPrXml = model.tabColor ? `<sheetPr><tabColor rgb="${escapeXml(model.tabColor)}"/></sheetPr>` : "";

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${sheetPrXml}
  <dimension ref="A1:${excelColumnName(model.maxColumn)}${model.maxRow}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="5" customWidth="1"/>
    <col min="2" max="2" width="14" customWidth="1"/>
    <col min="3" max="4" width="7" customWidth="1"/>
    <col min="5" max="5" width="34" customWidth="1"/>
    <col min="6" max="6" width="24" customWidth="1"/>
    <col min="7" max="7" width="9" customWidth="1"/>
    <col min="8" max="20" width="4.2" customWidth="1"/>
    <col min="21" max="21" width="14" customWidth="1"/>
    <col min="22" max="22" width="28" customWidth="1"/>
    <col min="23" max="23" width="24" customWidth="1"/>
    <col min="24" max="25" width="13" customWidth="1"/>
    <col min="26" max="26" width="11" customWidth="1"/>
    <col min="27" max="28" width="18" customWidth="1"/>
  </cols>
  <sheetData>${rowXml}</sheetData>
  ${mergeXml}
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
  ${drawingXml}
</worksheet>`;
  }

  async function photoSourceToImage(source, index, rowNumber, columnNumber = 6) {
    const dataUrlImage = dataUrlToImage(source, index, rowNumber, columnNumber);
    if (dataUrlImage || !source) {
      return dataUrlImage;
    }

    const cleanSource = String(source);
    const urlExtension = cleanSource.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase();
    const extension = urlExtension === "jpeg" ? "jpg" : ["jpg", "png", "webp"].includes(urlExtension) ? urlExtension : "jpg";
    return loadWorkbookImage(cleanSource, `image${index}.${extension}`, rowNumber, columnNumber);
  }

  function dataUrlToImage(dataUrl, index, rowNumber, columnNumber = 6) {
    const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl || "");
    if (!match) {
      return null;
    }

    const extension = match[1].toLowerCase().startsWith("jp") ? "jpg" : "png";
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return {
      name: `image${index}.${extension}`,
      bytes,
      rowNumber,
      columnNumber,
      extension,
    };
  }

  async function loadWorkbookImage(src, name, rowNumber, columnNumber, toColumnNumber, toRowNumber) {
    try {
      const response = await fetch(src, {
        credentials: "include",
        headers: isInternalPhotoUrl(src) && currentAuthToken ? { Authorization: `Bearer ${currentAuthToken}` } : {},
      });
      if (!response.ok) {
        return null;
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      const extension = String(name).split(".").pop()?.toLowerCase() || "jpg";
      return { name, bytes, rowNumber, columnNumber, toColumnNumber, toRowNumber, extension };
    } catch (error) {
      console.warn("Không nhúng được ảnh vào Excel:", error);
      return null;
    }
  }

  function buildSafetyContentTypesXml(images) {
    const imageDefaults = [...new Set(images.map((image) => image.extension))]
      .map((extension) => `<Default Extension="${extension}" ContentType="image/${extension === "jpg" ? "jpeg" : extension}"/>`)
      .join("");
    const drawingOverride = images.length
      ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>'
      : "";

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${imageDefaults}
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${drawingOverride}
</Types>`;
  }

  function buildSafetyWorksheetRelationshipsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`;
  }

  function buildSafetyDrawingXml(images) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${images.map((image, index) => buildSafetyImageAnchorXml(image, index + 1)).join("")}
</xdr:wsDr>`;
  }

  function buildSafetyImageAnchorXml(image, relationshipIndex, shapeId = relationshipIndex) {
    const row = image.rowNumber - 1;
    const column = image.columnNumber - 1;
    const toColumn = Number.isFinite(image.toColumnNumber) ? image.toColumnNumber : column + 1;
    const toRow = Number.isFinite(image.toRowNumber) ? image.toRowNumber : row;
    const toColumnOffset = Number.isFinite(image.toColumnNumber) ? 0 : 457200;
    const toRowOffset = Number.isFinite(image.toRowNumber) ? 0 : 914400;
    return `<xdr:twoCellAnchor editAs="oneCell">
  <xdr:from><xdr:col>${column}</xdr:col><xdr:colOff>91440</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>91440</xdr:rowOff></xdr:from>
  <xdr:to><xdr:col>${toColumn}</xdr:col><xdr:colOff>${toColumnOffset}</xdr:colOff><xdr:row>${toRow}</xdr:row><xdr:rowOff>${toRowOffset}</xdr:rowOff></xdr:to>
  <xdr:pic>
    <xdr:nvPicPr><xdr:cNvPr id="${shapeId}" name="Ảnh minh họa ${shapeId}"/><xdr:cNvPicPr/></xdr:nvPicPr>
    <xdr:blipFill><a:blip r:embed="rId${relationshipIndex}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
    <xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>
  </xdr:pic>
  <xdr:clientData/>
</xdr:twoCellAnchor>`;
  }

  function buildSafetyDrawingRelationshipsXml(images) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${images.map((image, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${image.name}"/>`).join("")}
</Relationships>`;
  }

  function buildXlsxWorkbook(periodId) {
    const period = getPeriod(periodId);
    const monthSuffix = period?.month ? ` T${period.month}` : "";
    const usedNames = new Set();
    const assessorSheetName = uniqueWorksheetName(`Assessor chấm${monthSuffix}`, usedNames);
    const selfSheetName = uniqueWorksheetName(`Tự đánh giá${monthSuffix}`, usedNames);
    const averageSheetName = uniqueWorksheetName(`Điểm trung bình${monthSuffix}`, usedNames);
    const assessorModel = buildWorksheetModel(periodId, {
      scoreSource: SCORE_SOURCE_ASSESSOR,
      title: `Điểm Chi Tiết Theo Từng Hạng Mục (${periodLabel(period)})`,
      titleColumn: 1,
      titleRow: 2,
      headerTopRow: 3,
      tabColor: "FF00B050",
    });
    const selfModel = buildWorksheetModel(periodId, {
      scoreSource: SCORE_SOURCE_SELF,
      title: `Điểm Chi Tiết Theo Từng Hạng Mục BP Tự Đánh giá (${periodLabel(period)})`,
      titleColumn: 1,
      titleRow: 2,
      headerTopRow: 3,
      tabColor: "FFFFC000",
    });
    const averageModel = buildAverageScoreWorksheetModel(periodId, {
      tabColor: "FF92D050",
    });
    attachFiveSChartsToWorksheetModel(assessorModel, periodId, assessorSheetName, SCORE_SOURCE_ASSESSOR);
    attachFiveSChartsToWorksheetModel(selfModel, periodId, selfSheetName, SCORE_SOURCE_SELF);
    return buildWorkbookFromSheets([
      { name: assessorSheetName, xml: buildWorksheetXml(assessorModel), charts: assessorModel.charts || [] },
      { name: selfSheetName, xml: buildWorksheetXml(selfModel), charts: selfModel.charts || [] },
      { name: averageSheetName, xml: buildWorksheetXml(averageModel), charts: averageModel.charts || [] },
    ]);
  }

  function getSafetyExcelFilters(safetyPeriod) {
    const fallbackYear = Number(safetyPeriod?.year) || new Date().getFullYear();
    const fallbackMonth = Number(safetyPeriod?.month) || new Date().getMonth() + 1;
    const selectedYear = Number(elements.safetyYearFilter?.value) || fallbackYear;
    const selectedMonth = Number(elements.safetyMonthFilter?.value) || fallbackMonth;
    return {
      year: Number.isInteger(selectedYear) ? selectedYear : fallbackYear,
      month: Number.isInteger(selectedMonth) && selectedMonth >= 1 && selectedMonth <= 12 ? selectedMonth : fallbackMonth,
    };
  }

  function getSafetyPeriodForMonth(year, month) {
    return getPeriodsByType(SAFETY_PERIOD_TYPE)
      .find((period) => Number(period.year) === Number(year) && Number(period.month) === Number(month)) || null;
  }

  function getSafetyIssueWeight(row) {
    const value = Number(getIssueCount(row));
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function sumSafetyIssueCounts(rows) {
    return rows.reduce((sum, row) => sum + getSafetyIssueWeight(row), 0);
  }

  function isSafetyRowForArea(row, area) {
    const rowCode = getSafetyAreaCode(row?.area);
    const areaCode = getSafetyAreaCode(area);
    return row?.area?.id === area?.id || (rowCode && areaCode && rowCode === areaCode);
  }

  function getSafetyIssueMonth(row) {
    const value = Number(getIssueMonth(row, row.score.periodId));
    return Number.isInteger(value) && value >= 1 && value <= 12 ? value : 0;
  }

  function hasSafetyCountermeasure(row) {
    return ["closed", "in_progress"].includes(normalizeIssueStatus(row?.score?.issueStatus));
  }

  function buildSafetyZoneStatsForExport(rows, areas, periodId) {
    const statusColumns = ISSUE_STATUS_OPTIONS || [];
    return areas.filter(isReportableSafetyArea).map((area) => {
      const areaRows = rows.filter((row) => isSafetyRowForArea(row, area));
      const statusCounts = Object.fromEntries(statusColumns.map((column) => [column.value, 0]));
      const stop6Counts = Object.fromEntries(SAFETY_STOP6_COLUMNS.map((column) => [column.value, 0]));
      areaRows.forEach((row) => {
        const weight = getSafetyIssueWeight(row);
        const status = normalizeIssueStatus(row.score.issueStatus);
        statusCounts[status] = (statusCounts[status] || 0) + weight;
        const stop6Key = row.score.issueType || "";
        stop6Counts[stop6Key] = (stop6Counts[stop6Key] || 0) + weight;
      });
      return {
        area,
        code: area.code,
        owner: area.departmentHead || "Chưa có",
        responsible: getAreaResponsibleNameForPeriod(periodId, area) || area.scorerName || "",
        department: getSafetyDepartmentForArea(area, periodId),
        target: Number(getSafetyZoneTarget(area)) || 0,
        total: sumSafetyIssueCounts(areaRows),
        countermeasure: sumSafetyIssueCounts(areaRows.filter(hasSafetyCountermeasure)),
        statusCounts,
        stop6Counts,
      };
    });
  }

  function buildSafetyDepartmentMatrixForExport(groups, yearRows) {
    return groups.map((group) => {
      const areaCodes = new Set(group.areas.map(getSafetyAreaCode).filter(Boolean));
      const monthly = Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        return sumSafetyIssueCounts(yearRows.filter((row) => areaCodes.has(getSafetyAreaCode(row.area)) && getSafetyIssueMonth(row) === month));
      });
      const groupRows = yearRows.filter((row) => areaCodes.has(getSafetyAreaCode(row.area)));
      return {
        name: group.name,
        areas: group.areas,
        monthly,
        total: monthly.reduce((sum, value) => sum + value, 0),
        countermeasure: sumSafetyIssueCounts(groupRows.filter(hasSafetyCountermeasure)),
      };
    });
  }

  function buildSafetyRankMatrixForExport(yearRows) {
    const rankColumns = [
      { value: "", label: "Nhà máy" },
      { value: "A", label: "Rank A" },
      { value: "B", label: "Rank B" },
      { value: "C", label: "Rank C" },
    ];
    return rankColumns.map((column) => {
      const monthly = Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        return sumSafetyIssueCounts(yearRows.filter((row) => {
          return getSafetyIssueMonth(row) === month && (!column.value || isSafetyLevelSelected(row.score, column.value));
        }));
      });
      return { name: column.label, monthly, total: monthly.reduce((sum, value) => sum + value, 0) };
    });
  }

  function buildSafetyStop6MatrixForExport(yearRows) {
    return SAFETY_STOP6_COLUMNS.map((column, index) => {
      const monthly = Array.from({ length: 12 }, (_, monthIndex) => {
        const month = monthIndex + 1;
        return sumSafetyIssueCounts(yearRows.filter((row) => getSafetyIssueMonth(row) === month && isSafetyStop6Selected(row.score, column.value)));
      });
      return { name: column.value || column.label || String(index + 1), monthly, total: monthly.reduce((sum, value) => sum + value, 0) };
    });
  }

  function buildRiskIdentificationWorksheetModel(periodId, monthRows, filters, sheetName = "Tổng hợp nhận diện", exportAreas = null) {
    const areas = (exportAreas || getAreasForPeriod(periodId)).filter(isReportableSafetyArea);
    const stats = buildSafetyZoneStatsForExport(monthRows, areas, periodId);
    const targetTotal = stats.reduce((sum, stat) => sum + stat.target, 0);
    const actualTotal = stats.reduce((sum, stat) => sum + stat.total, 0);
    const countermeasureRows = monthRows.filter(hasSafetyCountermeasure);
    const unresolvedRows = monthRows.filter((row) => !hasSafetyCountermeasure(row));
    const totalColumn = Math.max(4, 4 + stats.length);
    const model = {
      rows: new Map(),
      rowHeights: new Map(),
      merges: [],
      maxColumn: totalColumn,
      maxRow: 1,
      lastTableColumn: totalColumn,
      tabColor: "FF00B050",
      columnsXml: Array.from({ length: totalColumn }, (_, index) => {
        const column = index + 1;
        const width = column === 1 ? 22 : column === 2 ? 18 : column === 3 ? 17 : 11;
        return `<col min="${column}" max="${column}" width="${width}" customWidth="1"/>`;
      }).join(""),
    };
    const merge = (rowStart, columnStart, rowEnd, columnEnd) => {
      if (rowStart !== rowEnd || columnStart !== columnEnd) {
        model.merges.push(`${cellRef(rowStart, columnStart)}:${cellRef(rowEnd, columnEnd)}`);
      }
    };
    const add = (row, column, value, style = 14) => addModelCell(model, row, column, value, style);
    const rowsForStat = (rows, stat) => rows.filter((row) => isSafetyRowForArea(row, stat.area));
    const countForStat = (rows, stat, predicate = null) => sumSafetyIssueCounts(rowsForStat(predicate ? rows.filter(predicate) : rows, stat));
    const countTotal = (rows, predicate = null) => sumSafetyIssueCounts(predicate ? rows.filter(predicate) : rows);
    const percentText = (value) => Number.isFinite(value) ? `${Math.round(value * 100)}%` : "";

    model.rowHeights.set(1, 34);
    add(1, 1, `BẢNG TỔNG HỢP VẤN ĐỀ TRIỂN KHAI STOP6 TẠI ${stats.length || areas.length} ZONE`, 1);
    merge(1, 1, 1, totalColumn);
    add(3, 1, `TỔNG HỢP NHẬN DIỆN NGUY CƠ MẤT AN TOÀN THÁNG ${filters.month}/${filters.year}`, 2);
    merge(3, 1, 3, totalColumn);

    add(5, 1, "Ngày update", 2);
    add(5, 2, "Trưởng đơn vị", 2);
    merge(5, 2, 5, 3);
    const ownerGroups = [];
    stats.forEach((stat) => {
      const current = ownerGroups[ownerGroups.length - 1];
      if (current && current.label === stat.owner) {
        current.stats.push(stat);
      } else {
        ownerGroups.push({ label: stat.owner || "Chưa có", stats: [stat] });
      }
    });
    let groupStartColumn = 4;
    ownerGroups.forEach((group) => {
      const groupEndColumn = groupStartColumn + group.stats.length - 1;
      add(5, groupStartColumn, group.label, 2);
      merge(5, groupStartColumn, 5, groupEndColumn);
      groupStartColumn = groupEndColumn + 1;
    });
    add(5, totalColumn, "Total:", 2);

    add(6, 2, "Trưởng Zone", 2);
    merge(6, 2, 6, 3);
    stats.forEach((stat, index) => add(6, 4 + index, stat.responsible || "-", 2));
    add(6, totalColumn, "", 2);

    add(7, 2, "Zone", 2);
    merge(7, 2, 7, 3);
    stats.forEach((stat, index) => add(7, 4 + index, "Zone " + stat.code, 2));
    add(7, totalColumn, "", 2);

    add(8, 1, "Tổng số công người (MỤC TIÊU/THÁNG)", 2);
    merge(8, 1, 8, 3);
    stats.forEach((stat, index) => add(8, 4 + index, stat.target, 14));
    add(8, totalColumn, targetTotal, 2);

    add(9, 1, `Số vấn đề phát hiện tháng ${filters.month}/${filters.year}`, 2);
    merge(9, 1, 9, 3);
    stats.forEach((stat, index) => add(9, 4 + index, stat.total, 14));
    add(9, totalColumn, actualTotal, 2);

    const sourceSections = [
      { label: "Công nhân phát hiện", source: "worker" },
      { label: "Tổ trưởng phát hiện", source: "department-head" },
      { label: "Assessor phát hiện", source: "assessor" },
    ];
    let rowNumber = 10;
    const sourceRowSpan = sourceSections.length * SAFETY_STOP6_COLUMNS.length;
    add(rowNumber, 1, "Update Ngày: " + new Date().toLocaleDateString("vi-VN"), 24);
    merge(rowNumber, 1, rowNumber + sourceRowSpan - 1, 1);
    sourceSections.forEach((section) => {
      const sectionStartRow = rowNumber;
      SAFETY_STOP6_COLUMNS.forEach((column, stopIndex) => {
        const sourcePredicate = (row) => isSafetyFoundSelected(row.score, section.source) && isSafetyStop6Selected(row.score, column.value);
        if (stopIndex === 0) {
          add(rowNumber, 2, section.label, 24);
          merge(sectionStartRow, 2, sectionStartRow + SAFETY_STOP6_COLUMNS.length - 1, 2);
        }
        add(rowNumber, 3, `${String.fromCharCode(65 + stopIndex)} (${column.label})`, 24);
        stats.forEach((stat, index) => add(rowNumber, 4 + index, countForStat(monthRows, stat, sourcePredicate), 14));
        add(rowNumber, totalColumn, countTotal(monthRows, sourcePredicate), 2);
        rowNumber += 1;
      });
    });

    rowNumber += 1;
    const footerRows = [
      { label: "Tổng số vấn đề", rows: monthRows },
      { label: "Rank A phát hiện", rows: monthRows, predicate: (row) => isSafetyLevelSelected(row.score, "A") },
      { label: "Rank B phát hiện", rows: monthRows, predicate: (row) => isSafetyLevelSelected(row.score, "B") },
      { label: "Rank C phát hiện", rows: monthRows, predicate: (row) => isSafetyLevelSelected(row.score, "C") },
      { label: "Đã thực hiện", rows: countermeasureRows },
      { label: "Chưa giải quyết", rows: unresolvedRows },
    ];
    footerRows.forEach((footer) => {
      add(rowNumber, 1, footer.label, 2);
      merge(rowNumber, 1, rowNumber, 3);
      stats.forEach((stat, index) => add(rowNumber, 4 + index, countForStat(footer.rows, stat, footer.predicate), 14));
      add(rowNumber, totalColumn, countTotal(footer.rows, footer.predicate), 2);
      rowNumber += 1;
    });
    add(rowNumber, 1, "Tỷ lệ % nhận diện trên người / Zone", 2);
    merge(rowNumber, 1, rowNumber, 3);
    stats.forEach((stat, index) => add(rowNumber, 4 + index, stat.target ? percentText(stat.total / stat.target) : "", 24));
    add(rowNumber, totalColumn, targetTotal ? percentText(actualTotal / targetTotal) : "", 2);

    model.maxRow = rowNumber;
    fillRangeBorders(model, 5, 1, rowNumber, totalColumn);
    attachWorksheetCharts(model, sheetName, [
      {
        title: `Mục tiêu và số vấn đề phát hiện tháng ${filters.month}/${filters.year}`,
        categories: stats.map((stat) => "Zone " + stat.code),
        series: [
          { name: "Số vấn đề", values: stats.map((stat) => stat.total), color: "00B0F0", type: "bar" },
          { name: "Đối sách triển khai", values: stats.map((stat) => stat.countermeasure), color: "92D050", type: "bar" },
          { name: "Mục tiêu tháng", values: stats.map((stat) => stat.target), color: "FF0000", type: "line" },
        ],
        from: { row: model.maxRow + 2, column: 1 },
        to: { row: model.maxRow + 20, column: Math.min(16, Math.max(8, stats.length + 4)) },
        axisFormat: "0",
        labelFormat: "0",
      },
    ]);
    return model;
  }

  async function buildFactoryRiskXlsxWorkbook(periodId, year) {
    const summarySheetName = uniqueWorksheetName(`TỔNG HỢP ${year}`);
    const groups = getSafetyDepartmentGroups(periodId);
    const yearRows = getSafetyRowsForYear(year);
    const summaryModel = buildFactoryRiskWorksheetModel(periodId, year, summarySheetName);
    const usedNames = new Set([summarySheetName.toLocaleLowerCase("vi")]);
    const sheets = [{ name: summarySheetName, xml: buildWorksheetXml(summaryModel), charts: summaryModel.charts || [] }];

    for (const [index, group] of groups.entries()) {
      const areaCodes = new Set(group.areas.map(getSafetyAreaCode).filter(Boolean));
      const groupRows = yearRows.filter((row) => areaCodes.has(getSafetyAreaCode(row.area)));
      const sheetName = uniqueWorksheetName(group.name, usedNames);
      const model = buildSafetyWorksheetModel(periodId, groupRows, {
        departmentName: group.name,
        includeFactorySummary: true,
        tabColor: excelTabColor(index + 1),
      });
      const images = await buildFactoryDepartmentSheetImages(groupRows, index + 2);
      sheets.push({ name: sheetName, xml: buildSafetyWorksheetXml(model, Boolean(images.length)), charts: [], images });
    }

    return buildWorkbookFromSheets(sheets);
  }

  async function buildFactoryDepartmentSheetImages(issueRows, sheetNumber) {
    const images = [];
    const logoImage = await loadWorkbookImage("images/Logo.jpg", `factory-s${sheetNumber}-logo.jpg`, 1, 1, 3, 2);
    if (logoImage) {
      images.push(logoImage);
    }

    let imageIndex = 1;
    for (const [index, row] of issueRows.entries()) {
      const rowNumber = 9 + index;
      const beforeImage = await photoSourceToImage(row.score.photoDataUrl, imageIndex, rowNumber, 6);
      if (beforeImage) {
        images.push(renameWorkbookImage(beforeImage, `factory-s${sheetNumber}-before-${imageIndex}`));
        imageIndex += 1;
      }

      const afterImage = await photoSourceToImage(row.score.afterPhotoDataUrl, imageIndex, rowNumber, 23);
      if (afterImage) {
        images.push(renameWorkbookImage(afterImage, `factory-s${sheetNumber}-after-${imageIndex}`));
        imageIndex += 1;
      }
    }

    return images;
  }

  function renameWorkbookImage(image, baseName) {
    const rawExtension = String(image.extension || image.name?.split(".").pop() || "jpg").toLowerCase();
    const extension = rawExtension === "jpeg" ? "jpg" : rawExtension;
    return { ...image, extension, name: `${baseName}.${extension}` };
  }

  function buildFactoryRiskWorksheetModel(periodId, year, sheetName = "Tổng hợp nguy cơ NM") {
    const period = getPeriod(periodId);
    const report = getSafetyReportForPeriod(periodId);
    const groups = getSafetyDepartmentGroups(periodId);
    const yearRows = getSafetyRowsForYear(year);
    const matrix = buildSafetyDepartmentMatrixForExport(groups, yearRows);
    const rankMatrix = buildSafetyRankMatrixForExport(yearRows);
    const stop6Matrix = buildSafetyStop6MatrixForExport(yearRows);
    const monthTotals = Array.from({ length: 12 }, (_, index) => sumSafetyIssueCounts(yearRows.filter((row) => getSafetyIssueMonth(row) === index + 1)));
    const countermeasureTotals = Array.from({ length: 12 }, (_, index) => {
      return sumSafetyIssueCounts(yearRows.filter((row) => getSafetyIssueMonth(row) === index + 1 && hasSafetyCountermeasure(row)));
    });
    const cumulativeTotals = [];
    const cumulativeCountermeasures = [];
    monthTotals.reduce((sum, value, index) => {
      const next = sum + value;
      cumulativeTotals[index] = next;
      return next;
    }, 0);
    countermeasureTotals.reduce((sum, value, index) => {
      const next = sum + value;
      cumulativeCountermeasures[index] = next;
      return next;
    }, 0);
    const monthHeaders = Array.from({ length: 12 }, (_, index) => "T" + (index + 1));
    const zoneStats = buildSafetyZoneStatsForExport(yearRows, groups.flatMap((group) => group.areas), periodId);
    const totalIdentified = monthTotals.reduce((sum, value) => sum + value, 0);
    const totalCountermeasures = countermeasureTotals.reduce((sum, value) => sum + value, 0);
    const monthlyRates = monthTotals.map((value, index) => value ? countermeasureTotals[index] / value : 0);
    const model = {
      rows: new Map(),
      rowHeights: new Map(),
      merges: [],
      maxColumn: 28,
      maxRow: 1,
      lastTableColumn: 28,
      tabColor: "FF00B050",
      columnsXml: [
        '<col min="1" max="1" width="18" customWidth="1"/>',
        '<col min="2" max="13" width="9.5" customWidth="1"/>',
        '<col min="14" max="14" width="11" customWidth="1"/>',
        '<col min="15" max="15" width="3" customWidth="1"/>',
        '<col min="16" max="28" width="10.5" customWidth="1"/>',
      ].join(""),
    };
    const merge = (rowStart, columnStart, rowEnd, columnEnd) => {
      if (rowStart !== rowEnd || columnStart !== columnEnd) {
        model.merges.push(`${cellRef(rowStart, columnStart)}:${cellRef(rowEnd, columnEnd)}`);
      }
    };
    const add = (row, column, value, style = 14, options = {}) => addModelCell(model, row, column, value, style, options);
    const addMerged = (row, columnStart, columnEnd, value, style = 2) => {
      add(row, columnStart, value, style);
      if (columnEnd > columnStart) {
        merge(row, columnStart, row, columnEnd);
      }
    };
    const addMonthHeader = (row, firstColumn = 2, style = 2) => {
      monthHeaders.forEach((label, index) => add(row, firstColumn + index, label, style));
    };

    model.rowHeights.set(1, 34);
    model.rowHeights.set(2, 22);
    [3, 4, 5, 6, 7].forEach((row) => model.rowHeights.set(row, 20));
    addMerged(1, 1, 14, "TỔNG HỢP NGUY CƠ MẤT AN TOÀN NHÀ MÁY", 1);
    addMerged(2, 1, 14, `Năm ${year}`, 13);
    addMerged(3, 19, 20, "Issue Date", 13);
    addMerged(3, 21, 23, formatDateDisplay(getReportDateValue(report, period, "issueDate")), 14);
    addMerged(4, 19, 20, "Report date", 13);
    addMerged(4, 21, 23, formatDateDisplay(getReportDateValue(report, period, "reportDate")), 14);
    addMerged(5, 1, 2, "Người Báo Cáo:", 13);
    addMerged(5, 3, 5, report.performer || "LEAN", 13);
    addMerged(5, 6, 6, "Người Kiểm Tra:", 13);
    addMerged(5, 7, 14, report.checker || "BGĐ Nhà máy, Các TBP, LEAN", 13);
    addMerged(6, 1, 2, "Chức Danh:", 13);
    addMerged(6, 3, 5, report.performerTitle || "LEAN Business Partner", 13);
    addMerged(6, 6, 6, "Chức Danh:", 13);
    addMerged(6, 7, 14, report.checkerTitle || "BGĐ Nhà máy, Các TBP, LEAN", 13);
    addMerged(7, 1, 2, "Bộ Phận:", 13);
    addMerged(7, 3, 5, report.department || "LEAN", 13);
    addMerged(7, 6, 6, "Bộ Phận:", 13);
    addMerged(7, 7, 14, report.checkerDepartment || "Nhà máy", 13);

    const departmentTitleRow = 10;
    const departmentHeaderRow = departmentTitleRow + 1;
    const departmentFirstRow = departmentHeaderRow + 1;
    const departmentTotalRow = departmentFirstRow + matrix.length;
    addMerged(departmentTitleRow, 1, 14, "Tổng hợp theo số nhận diện", 2);
    add(departmentHeaderRow, 1, "Bộ phận", 2);
    addMonthHeader(departmentHeaderRow, 2, 2);
    add(departmentHeaderRow, 14, "TOTAL", 2);
    matrix.forEach((row, index) => {
      const rowNumber = departmentFirstRow + index;
      add(rowNumber, 1, row.name, 24);
      row.monthly.forEach((value, monthIndex) => add(rowNumber, 2 + monthIndex, value, 14));
      add(rowNumber, 14, row.total, 14);
    });
    add(departmentTotalRow, 1, "Tổng", 2);
    monthTotals.forEach((value, index) => add(departmentTotalRow, 2 + index, value, 2));
    add(departmentTotalRow, 14, totalIdentified, 2);

    const progressHeaderRow = Math.max(26, departmentTotalRow + 3);
    const progressFirstRow = progressHeaderRow + 1;
    ["Nhà máy", "Số nhận diện", "Đối sách triển khai", "Tích lũy số nhận diện", "Tích lũy đối sách triển khai", "Tỉ lệ triển khai đối sách", "Mục tiêu"].forEach((label, index) => add(progressHeaderRow, 1 + index, label, 2));
    monthHeaders.forEach((label, index) => {
      const rowNumber = progressFirstRow + index;
      const cumulative = cumulativeTotals[index] || 0;
      const cumulativeCountermeasure = cumulativeCountermeasures[index] || 0;
      add(rowNumber, 1, label, 24);
      add(rowNumber, 2, monthTotals[index], 14);
      add(rowNumber, 3, countermeasureTotals[index], 14);
      add(rowNumber, 4, cumulative, 14);
      add(rowNumber, 5, cumulativeCountermeasure, 14);
      add(rowNumber, 6, cumulative ? cumulativeCountermeasure / cumulative : 0, 28);
      add(rowNumber, 7, 1, 28);
    });

    const rankTitleRow = Math.max(43, progressFirstRow + 15);
    const rankHeaderRow = rankTitleRow + 1;
    const rankFirstRow = rankHeaderRow + 1;
    addMerged(rankTitleRow, 1, 14, "TỔNG HỢP THEO CẤP ĐỘ NGUY HIỂM", 2);
    add(rankHeaderRow, 1, "Nhà máy", 2);
    addMonthHeader(rankHeaderRow, 2, 2);
    add(rankHeaderRow, 14, "TOTAL", 2);
    rankMatrix.forEach((row, index) => {
      const rowNumber = rankFirstRow + index;
      add(rowNumber, 1, row.name, 24);
      row.monthly.forEach((value, monthIndex) => add(rowNumber, 2 + monthIndex, value, 14));
      add(rowNumber, 14, row.total, 14);
    });

    const stopTitleRow = Math.max(61, rankFirstRow + rankMatrix.length + 4);
    const stopHeaderRow = stopTitleRow + 1;
    const stopFirstRow = stopHeaderRow + 1;
    addMerged(stopTitleRow, 1, 14, "Tổng Hợp loại tai nạn chỉ định STOP 6", 2);
    add(stopHeaderRow, 1, "Nhà máy", 2);
    addMonthHeader(stopHeaderRow, 2, 2);
    add(stopHeaderRow, 14, "TOTAL", 2);
    stop6Matrix.forEach((row, index) => {
      const rowNumber = stopFirstRow + index;
      add(rowNumber, 1, row.name, 24);
      row.monthly.forEach((value, monthIndex) => add(rowNumber, 2 + monthIndex, value, 14));
      add(rowNumber, 14, row.total, 14);
    });

    const zoneTitleRow = Math.max(82, stopFirstRow + stop6Matrix.length + 4);
    const zoneHeaderRow = zoneTitleRow + 1;
    const zoneFirstRow = zoneHeaderRow + 1;
    addMerged(zoneTitleRow, 1, 9, "Tổng hợp từng Zone", 2);
    ["Zone", "Bộ phận", "Mục tiêu tháng", "Số nhận diện năm", "Chưa xử lý", "Đã xử lý", "Đang xử lý", "Quá hạn", "Đối sách triển khai"].forEach((label, index) => {
      add(zoneHeaderRow, 1 + index, label, 2);
    });
    zoneStats.forEach((stat, index) => {
      const rowNumber = zoneFirstRow + index;
      add(rowNumber, 1, "Zone " + stat.code, 24);
      add(rowNumber, 2, stat.department, 24);
      add(rowNumber, 3, stat.target, 14);
      add(rowNumber, 4, stat.total, 14);
      add(rowNumber, 5, stat.statusCounts.open || 0, 14);
      add(rowNumber, 6, stat.statusCounts.closed || 0, 14);
      add(rowNumber, 7, stat.statusCounts.in_progress || 0, 14);
      add(rowNumber, 8, stat.statusCounts.overdue || 0, 14);
      add(rowNumber, 9, stat.countermeasure, 14);
    });

    fillRangeBorders(model, departmentTitleRow, 1, departmentTotalRow, 14);
    fillRangeBorders(model, progressHeaderRow, 1, progressFirstRow + monthHeaders.length - 1, 7);
    fillRangeBorders(model, rankTitleRow, 1, rankFirstRow + rankMatrix.length - 1, 14);
    fillRangeBorders(model, stopTitleRow, 1, stopFirstRow + stop6Matrix.length - 1, 14);
    fillRangeBorders(model, zoneTitleRow, 1, zoneFirstRow + zoneStats.length - 1, 9);
    const departmentColors = ["4F81BD", "C0504D", "9BBB59", "8064A2", "4BACC6", "F79646", "1F4E79", "E46C0A", "963634", "948A54", "953735", "7030A0", "70AD47", "FFC000"];
    attachWorksheetCharts(model, sheetName, [
      {
        title: `Tổng hợp nhận diện nguy hiểm / bộ phận ${year}`,
        categories: monthHeaders,
        series: matrix.map((row, index) => ({ name: row.name, values: row.monthly, color: departmentColors[index % departmentColors.length], type: "bar" })),
        from: { row: departmentTitleRow, column: 16 },
        to: { row: departmentTitleRow + 15, column: 28 },
        axisFormat: "0",
        labelFormat: "0",
        showDataLabels: false,
      },
      {
        title: `So sánh tổng số nhận diện theo bộ phận ${year}`,
        categories: matrix.map((row) => row.name),
        series: [
          { name: "Số nhận diện", values: matrix.map((row) => row.total), color: "4F81BD", type: "bar" },
          { name: "Đối sách triển khai", values: matrix.map((row) => row.countermeasure), color: "92D050", type: "bar" },
        ],
        from: { row: progressHeaderRow, column: 16 },
        to: { row: progressHeaderRow + 14, column: 28 },
        axisFormat: "0",
        labelFormat: "0",
        showDataLabels: false,
      },
      {
        title: `Tỉ lệ triển khai đối sách theo tháng ${year}`,
        categories: monthHeaders,
        series: [
          { name: "Tỉ lệ triển khai", values: monthlyRates, color: "00B0F0", type: "bar" },
          { name: "Mục tiêu", values: monthHeaders.map(() => 1), color: "FF0000", type: "line" },
        ],
        from: { row: zoneTitleRow, column: 10 },
        to: { row: zoneTitleRow + 15, column: 23 },
        yMin: 0,
        yMax: 1,
        axisFormat: "0%",
        labelFormat: "0%",
      },
      {
        title: `Nhận diện và đối sách theo tháng ${year}`,
        categories: monthHeaders,
        series: [
          { name: "Số nhận diện", values: monthTotals, color: "00B0F0", type: "bar" },
          { name: "Đối sách triển khai", values: countermeasureTotals, color: "92D050", type: "bar" },
          { name: "Tích lũy số nhận diện", values: cumulativeTotals, color: "C00000", type: "line" },
          { name: "Tích lũy đối sách triển khai", values: cumulativeCountermeasures, color: "7030A0", type: "line" },
        ],
        from: { row: zoneTitleRow + 17, column: 10 },
        to: { row: zoneTitleRow + 33, column: 23 },
        axisFormat: "0",
        labelFormat: "0",
        showDataLabels: false,
      },
      {
        title: `Tổng hợp cấp độ nguy hiểm ${year}`,
        categories: monthHeaders,
        series: rankMatrix.slice(1).map((row, index) => ({ name: row.name, values: row.monthly, color: ["C0504D", "9BBB59", "8064A2"][index] || "4F81BD", type: "bar" })),
        from: { row: rankTitleRow, column: 16 },
        to: { row: rankTitleRow + 15, column: 28 },
        axisFormat: "0",
        labelFormat: "0",
      },
      {
        title: `Tổng hợp STOP 6 ${year}`,
        categories: monthHeaders,
        series: stop6Matrix.map((row, index) => ({ name: row.name, values: row.monthly, color: ["4F81BD", "C0504D", "9BBB59", "8064A2", "4BACC6", "F79646", "1F4E79"][index] || "4F81BD", type: "bar" })),
        from: { row: stopTitleRow, column: 16 },
        to: { row: stopTitleRow + 16, column: 28 },
        axisFormat: "0",
        labelFormat: "0",
        showDataLabels: false,
      },
    ]);
    return model;
  }

  function buildWorksheetModel(periodId, options = {}) {
    const period = getPeriod(periodId);
    const areas = getAreasForPeriod(periodId);
    const scoreSource = normalizeScoreSource(options.scoreSource);
    const titleRow = Math.max(1, Number(options.titleRow) || 1);
    const headerTopRow = Math.max(titleRow + 1, Number(options.headerTopRow) || titleRow + 1);
    const departmentHeaderRow = headerTopRow + 1;
    const itemHeaderRow = headerTopRow + 2;
    const firstScoreRow = headerTopRow + 3;
    const titleColumn = Math.max(1, Number(options.titleColumn) || 1);
    const defaultTitle = scoreSource === SCORE_SOURCE_SELF
      ? `Điểm Chi Tiết Theo Từng Hạng Mục BP Tự Đánh giá (${periodLabel(period)})`
      : `Điểm Chi Tiết Theo Từng Hạng Mục (${periodLabel(period)})`;
    const title = options.title || defaultTitle;
    const rows = new Map();
    const rowHeights = new Map();
    const merges = [];

    function addCell(row, column, value, style, options = {}) {
      if (!rows.has(row)) {
        rows.set(row, []);
      }
      rows.get(row).push({ row, column, value, style, ...options });
    }

    function merge(rowStart, columnStart, rowEnd, columnEnd) {
      merges.push(`${cellRef(rowStart, columnStart)}:${cellRef(rowEnd, columnEnd)}`);
    }

    const lastTableColumn = 4 + areas.length - 1;
    const averageColumn = lastTableColumn + 1;
    rowHeights.set(titleRow, 38);
    rowHeights.set(headerTopRow, 22);
    rowHeights.set(departmentHeaderRow, 22);
    rowHeights.set(itemHeaderRow, 26);

    addCell(titleRow, titleColumn, title, 1);
    merge(titleRow, titleColumn, titleRow, averageColumn);

    addCell(headerTopRow, 1, "Tiêu Chuẩn / Đánh Giá", 2);
    merge(headerTopRow, 1, departmentHeaderRow, 2);
    addCell(headerTopRow, 3, "Zone", 3);
    areas.forEach((area, index) => addCell(headerTopRow, 4 + index, area.code, area.highlight ? 5 : 4));
    addCell(headerTopRow, averageColumn, "AVER", 6);
    merge(headerTopRow, averageColumn, itemHeaderRow, averageColumn);

    addCell(departmentHeaderRow, 3, "T.Phòng", 3);
    buildGroupedSpans(areas, "departmentHead", false).forEach((group) => {
      const start = 4 + group.startIndex;
      const end = start + group.areas.length - 1;
      addCell(departmentHeaderRow, start, group.label, 7);
      if (group.areas.length > 1) {
        merge(departmentHeaderRow, start, departmentHeaderRow, end);
      }
    });

    addCell(itemHeaderRow, 1, "ITEMS", 8);
    merge(itemHeaderRow, 1, itemHeaderRow, 2);
    addCell(itemHeaderRow, 3, "Point", 9);
    areas.forEach((area, index) => {
      const scorerName = scoreSource === SCORE_SOURCE_ASSESSOR
        ? getAreaConfiguredAssessorNameForPeriod(periodId, area) || getAreaResponsibleNameForPeriod(periodId, area)
        : getAreaResponsibleNameForPeriod(periodId, area);
      addCell(itemHeaderRow, 4 + index, scorerName, 10);
    });

    let rowNumber = firstScoreRow;
    DEFAULT_ITEMS.forEach((item) => {
      const itemStart = rowNumber;
      const itemEnd = itemStart + item.criteria.length - 1;

      item.criteria.forEach((criterion, index) => {
        if (index === 0) {
          addCell(rowNumber, 1, item.code, 11);
          addCell(rowNumber, 2, item.name, 12);
          if (item.criteria.length > 1) {
            merge(rowNumber, 1, itemEnd, 1);
            merge(rowNumber, 2, itemEnd, 2);
          }
        }

        rowHeights.set(rowNumber, item.criteria.length === 1 ? 21 : 19);
        addCell(rowNumber, 3, item.criteria.length === 1 ? "" : criterion.label, 13);
        areas.forEach((area, areaIndex) => {
          const column = 4 + areaIndex;
          if (isNotApplicable(item.id, criterion.id, area)) {
            addCell(rowNumber, column, "", 16);
            return;
          }

          const record = getScoreRecord(periodId, area.id, item.id, criterion.id, scoreSource);
          const value = Number.isFinite(record?.score) ? record.score : null;
          const style = isScoreCrossed(record) ? 16 : Number.isFinite(value) && value <= 2 ? 15 : 14;
          addCell(rowNumber, column, isScoreCrossed(record) ? "" : value, style);
        });

        addCell(rowNumber, averageColumn, itemAverage(periodId, item, areas, scoreSource), 29);
        if (index === 0 && item.criteria.length > 1) {
          merge(rowNumber, averageColumn, itemEnd, averageColumn);
        }

        rowNumber += 1;
      });
    });

    const totalRow = rowNumber;
    const groupRow = totalRow + 1;
    const groupLabelRow = totalRow + 2;
    const signatureRow = totalRow + 3;
    [totalRow, groupRow, groupLabelRow].forEach((row) => rowHeights.set(row, 26));
    rowHeights.set(signatureRow, 34);

    addCell(totalRow, 1, "TOTAL SCORE:", 18);
    merge(totalRow, 1, groupLabelRow, 3);
    areas.forEach((area, index) => {
      const column = 4 + index;
      addCell(totalRow, column, areaAverage(periodId, area, scoreSource), 19);
    });
    addCell(totalRow, averageColumn, overallAverage(periodId, areas, scoreSource), 23);
    merge(totalRow, averageColumn, groupLabelRow, averageColumn);

    buildDepartmentSummarySpans(areas).forEach((group) => {
      const start = 4 + group.startIndex;
      const end = start + group.areas.length - 1;
      if (group.label && group.areas.length > 1) {
        addCell(groupRow, start, groupAverage(periodId, group.areas, scoreSource), 21);
        merge(groupRow, start, groupRow, end);
        addCell(groupLabelRow, start, group.label, 22);
        merge(groupLabelRow, start, groupLabelRow, end);
      } else {
        addCell(groupRow, start, group.label, 22);
        merge(groupRow, start, groupLabelRow, start);
      }
    });

    addCell(signatureRow, 1, "Người đánh giá", 20);
    merge(signatureRow, 1, signatureRow, 3);
    areas.forEach((area, index) => addCell(signatureRow, 4 + index, getSignatureName(periodId, area, scoreSource), 24));
    addCell(signatureRow, averageColumn, "", 24);

    const result = {
      rows,
      rowHeights,
      merges,
      period,
      maxColumn: averageColumn,
      maxRow: signatureRow,
      lastTableColumn,
      averageColumn,
      tabColor: options.tabColor || "",
      scoreSource,
    };
    fillRangeBorders(result, headerTopRow, 1, signatureRow, averageColumn);
    return result;
  }

  function buildAverageScoreWorksheetModel(periodId, options = {}) {
    const period = getPeriod(periodId);
    const areas = getAreasForPeriod(periodId);
    const maxColumn = areas.length + 1;
    const rows = new Map();
    const rowHeights = new Map();
    const merges = [];
    const columnsXml = [
      '<col min="1" max="1" width="15" customWidth="1"/>',
      areas.length ? `<col min="2" max="${maxColumn}" width="6.6" customWidth="1"/>` : "",
    ].join("");

    function addCell(row, column, value, style, options = {}) {
      if (!rows.has(row)) {
        rows.set(row, []);
      }
      rows.get(row).push({ row, column, value, style, ...options });
    }

    function merge(rowStart, columnStart, rowEnd, columnEnd) {
      if (columnEnd > columnStart || rowEnd > rowStart) {
        merges.push(`${cellRef(rowStart, columnStart)}:${cellRef(rowEnd, columnEnd)}`);
      }
    }

    const areaRows = areas.map((area) => {
      const selfAverage = areaAverage(periodId, area, SCORE_SOURCE_SELF);
      const assessorAverage = areaAverage(periodId, area, SCORE_SOURCE_ASSESSOR);
      return {
        area,
        selfAverage,
        assessorAverage,
        average: average([selfAverage, assessorAverage]),
      };
    });
    const rowByAreaId = new Map(areaRows.map((row) => [row.area.id, row]));
    const titleRow = 1;
    const zoneRow = 2;
    const picRow = 3;
    const selfRow = 4;
    const assessorRow = 5;
    const averageRow = 6;
    const groupAverageRow = 7;
    const groupLabelRow = 8;

    rowHeights.set(titleRow, 28);
    rowHeights.set(zoneRow, 24);
    rowHeights.set(picRow, 38);
    [selfRow, assessorRow, averageRow, groupAverageRow, groupLabelRow].forEach((row) => rowHeights.set(row, 24));

    addCell(titleRow, 1, "Điểm số trung bình tính KPI các bộ phận", 1);
    merge(titleRow, 1, titleRow, maxColumn);
    addCell(zoneRow, 1, "Zone", 2);
    addCell(picRow, 1, "PIC", 2);
    addCell(selfRow, 1, "Điểm tự Đ.giá lần 1", 13);
    addCell(assessorRow, 1, "Điểm Đ.G theo lịch", 13);
    addCell(averageRow, 1, "Điểm trung bình", 13);
    addCell(groupAverageRow, 1, "", 13);
    addCell(groupLabelRow, 1, "", 13);

    areas.forEach((area, index) => {
      const column = index + 2;
      const values = rowByAreaId.get(area.id) || {};
      addCell(zoneRow, column, area.code || "", area.highlight ? 5 : 4);
      addCell(picRow, column, getAreaResponsibleNameForPeriod(periodId, area), 10);
      addCell(selfRow, column, values.selfAverage, Number.isFinite(values.selfAverage) ? 19 : 14);
      addCell(assessorRow, column, values.assessorAverage, Number.isFinite(values.assessorAverage) ? 19 : 14);
      addCell(averageRow, column, values.average, Number.isFinite(values.average) ? 19 : 14);
    });

    buildDepartmentSummarySpans(areas).forEach((group) => {
      const start = 2 + group.startIndex;
      const end = start + group.areas.length - 1;
      const value = average(group.areas.map((area) => rowByAreaId.get(area.id)?.average));
      addCell(groupAverageRow, start, value, Number.isFinite(value) ? 21 : 14);
      addCell(groupLabelRow, start, group.label || "", 22);
      if (group.areas.length > 1) {
        merge(groupAverageRow, start, groupAverageRow, end);
        merge(groupLabelRow, start, groupLabelRow, end);
      }
    });

    const result = {
      rows,
      rowHeights,
      merges,
      period,
      maxColumn,
      maxRow: groupLabelRow,
      lastTableColumn: maxColumn,
      columnsXml,
      tabColor: options.tabColor || "",
    };
    fillModelBorders(result);
    return result;
  }

  function buildWorksheetXml(model) {
    const sortedRows = [...model.rows.entries()].sort((a, b) => a[0] - b[0]);
    const rowXml = sortedRows
      .map(([rowNumber, cells]) => {
        const height = model.rowHeights.get(rowNumber);
        const heightAttrs = height ? ` ht="${height}" customHeight="1"` : "";
        const cellsXml = cells
          .sort((a, b) => a.column - b.column)
          .map((cell) => buildCellXml(cell))
          .join("");
        return `<row r="${rowNumber}"${heightAttrs}>${cellsXml}</row>`;
      })
      .join("");
    const mergeXml = model.merges.length
      ? `<mergeCells count="${model.merges.length}">${model.merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`
      : "";

    const hiddenCols = Number.isFinite(model.hiddenSourceStartColumn) && Number.isFinite(model.hiddenSourceEndColumn)
      ? `<col min="${model.hiddenSourceStartColumn}" max="${model.hiddenSourceEndColumn}" width="0" hidden="1" customWidth="1"/>`
      : "";
    const averageCol = Number.isFinite(model.averageColumn) ? `<col min="${model.averageColumn}" max="${model.averageColumn}" width="10.5" customWidth="1"/>` : "";
    const drawingXml = model.drawingRelId ? `<drawing r:id="${escapeXml(model.drawingRelId)}"/>` : "";
    const defaultColumnsXml = `
    <col min="1" max="1" width="7" customWidth="1"/>
    <col min="2" max="2" width="21" customWidth="1"/>
    <col min="3" max="3" width="12" customWidth="1"/>
    <col min="4" max="${model.lastTableColumn}" width="6.4" customWidth="1"/>
    ${averageCol}
    ${hiddenCols}
    `;
    const columnsXml = model.columnsXml ? `${model.columnsXml}${hiddenCols}` : defaultColumnsXml;
    const sheetPrXml = model.tabColor ? `<sheetPr><tabColor rgb="${escapeXml(model.tabColor)}"/></sheetPr>` : "";

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${sheetPrXml}
  <dimension ref="A1:${excelColumnName(model.maxColumn)}${model.maxRow}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${columnsXml}</cols>
  <sheetData>${rowXml}</sheetData>
  ${mergeXml}
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
  ${drawingXml}
</worksheet>`;
  }

  function buildCellXml(cell) {
    const ref = cellRef(cell.row, cell.column);
    const style = Number.isFinite(cell.style) && cell.style > 0 ? ` s="${cell.style}"` : "";
    const formula = cell.formula ? `<f>${escapeXml(cell.formula)}</f>` : "";

    if (Number.isFinite(cell.value)) {
      return `<c r="${ref}"${style}>${formula}<v>${cell.value}</v></c>`;
    }

    if (cell.formula) {
      return `<c r="${ref}"${style}>${formula}</c>`;
    }

    if (cell.value === null || cell.value === undefined || cell.value === "") {
      return `<c r="${ref}"${style}/>`;
    }

    return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`;
  }

  function addModelCell(model, row, column, value, style = 14, options = {}) {
    if (!model.rows.has(row)) {
      model.rows.set(row, []);
    }
    model.rows.get(row).push({ row, column, value, style, ...options });
    model.maxRow = Math.max(model.maxRow || row, row);
    model.maxColumn = Math.max(model.maxColumn || column, column);
  }

  function fillModelBorders(model) {
    const maxRow = model.maxRow || 1;
    const maxColumn = model.lastTableColumn || model.maxColumn || 1;
    for (let r = 1; r <= maxRow; r++) {
      if (!model.rows.has(r)) {
        model.rows.set(r, []);
      }
      const existingColumns = new Set(model.rows.get(r).map((c) => c.column));
      for (let c = 1; c <= maxColumn; c++) {
        if (!existingColumns.has(c)) {
          model.rows.get(r).push({ row: r, column: c, value: "", style: 30 });
        }
      }
    }
  }

  function fillRangeBorders(model, startRow, startCol, endRow, endCol, style = 30) {
    for (let r = startRow; r <= endRow; r++) {
      if (!model.rows.has(r)) {
        model.rows.set(r, []);
      }
      const existingColumns = new Set(model.rows.get(r).map((c) => c.column));
      for (let c = startCol; c <= endCol; c++) {
        if (!existingColumns.has(c)) {
          model.rows.get(r).push({ row: r, column: c, value: "", style });
        }
      }
    }
  }

  function buildReportWorksheetModel({ title, subtitle = "", tables = [] }) {
    const maxColumn = Math.max(1, ...tables.map((table) => Math.max(
      table.headers?.length || 0,
      ...(table.rows || []).map((row) => row.length),
    )));
    const model = {
      rows: new Map(),
      rowHeights: new Map(),
      merges: [],
      maxColumn,
      maxRow: 1,
      lastTableColumn: maxColumn,
      columnsXml: Array.from({ length: maxColumn }, (_, index) => {
        const column = index + 1;
        const width = column === 1 ? 24 : column <= 3 ? 18 : 13;
        return `<col min="${column}" max="${column}" width="${width}" customWidth="1"/>`;
      }).join(""),
    };
    let rowNumber = 1;
    model.rowHeights.set(rowNumber, 32);
    addModelCell(model, rowNumber, 1, title, 1);
    if (maxColumn > 1) {
      model.merges.push(`${cellRef(rowNumber, 1)}:${cellRef(rowNumber, maxColumn)}`);
    }
    rowNumber += 1;
    if (subtitle) {
      model.rowHeights.set(rowNumber, 22);
      addModelCell(model, rowNumber, 1, subtitle, 24);
      if (maxColumn > 1) {
        model.merges.push(`${cellRef(rowNumber, 1)}:${cellRef(rowNumber, maxColumn)}`);
      }
      rowNumber += 1;
    }
    rowNumber += 1;

    tables.forEach((table) => {
      const headers = table.headers || [];
      const rows = table.rows || [];
      addModelCell(model, rowNumber, 1, table.title || "", 2);
      if (maxColumn > 1) {
        model.merges.push(`${cellRef(rowNumber, 1)}:${cellRef(rowNumber, maxColumn)}`);
      }
      rowNumber += 1;
      headers.forEach((header, index) => addModelCell(model, rowNumber, index + 1, header, 2));
      rowNumber += 1;
      if (rows.length) {
        rows.forEach((row) => {
          row.forEach((value, index) => {
            const style = Number.isFinite(value) ? 14 : 24;
            addModelCell(model, rowNumber, index + 1, value, style);
          });
          rowNumber += 1;
        });
      } else {
        addModelCell(model, rowNumber, 1, "Chưa có dữ liệu.", 24);
        rowNumber += 1;
      }
      rowNumber += 1;
    });

    model.maxRow = Math.max(model.maxRow, rowNumber);
    fillModelBorders(model);
    return model;
  }

  function quoteSheetNameForFormula(sheetName) {
    return `'${String(sheetName || "Sheet").replace(/'/g, "''")}'`;
  }

  function uniqueWorksheetName(name, usedNames = new Set()) {
    const base = String(name || "Sheet")
      .replace(/[\[\]:*?/\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 31) || "Sheet";
    let candidate = base;
    let suffix = 2;
    while (usedNames.has(candidate.toLocaleLowerCase("vi"))) {
      const tail = ` (${suffix})`;
      candidate = base.slice(0, 31 - tail.length) + tail;
      suffix += 1;
    }
    usedNames.add(candidate.toLocaleLowerCase("vi"));
    return candidate;
  }

  function excelTabColor(index) {
    const colors = [
      "FF00B050", "FFC00000", "FFFFC000", "FF92D050", "FF31859B", "FF0070C0",
      "FF1F4E79", "FFE46C0A", "FF963634", "FF948A54", "FF953735", "FF7030A0",
      "FFFFFF00", "FF70AD47",
    ];
    return colors[index % colors.length];
  }

  function sheetRangeRef(sheetName, rowStart, columnStart, rowEnd, columnEnd) {
    return `${quoteSheetNameForFormula(sheetName)}!$${excelColumnName(columnStart)}$${rowStart}:$${excelColumnName(columnEnd)}$${rowEnd}`;
  }

  function attachWorksheetCharts(model, sheetName, charts = []) {
    const preparedCharts = [];
    const validCharts = charts.filter((chart) => chart?.categories?.length && chart?.series?.length);
    if (!validCharts.length) {
      return;
    }

    const sourceStartColumn = (model.maxColumn || 1) + 2;
    let sourceEndColumn = sourceStartColumn;
    let sourceRow = 1;
    validCharts.forEach((chart) => {
      const categories = chart.categories.map((label) => String(label ?? ""));
      const series = chart.series
        .filter((item) => item?.values?.length)
        .map((item) => ({ ...item, values: categories.map((_, index) => Number(item.values[index] || 0)) }));
      if (!series.length) {
        return;
      }

      addModelCell(model, sourceRow, sourceStartColumn, chart.categoryHeader || "Hạng mục", 2);
      series.forEach((item, index) => addModelCell(model, sourceRow, sourceStartColumn + index + 1, item.name, 2));
      categories.forEach((category, categoryIndex) => {
        const rowNumber = sourceRow + categoryIndex + 1;
        addModelCell(model, rowNumber, sourceStartColumn, category, 24);
        series.forEach((item, index) => addModelCell(model, rowNumber, sourceStartColumn + index + 1, item.values[categoryIndex], 14));
      });

      const chartStartRow = sourceRow + 1;
      const chartEndRow = sourceRow + categories.length;
      const preparedSeries = series.map((item, index) => ({
        ...item,
        range: sheetRangeRef(sheetName, chartStartRow, sourceStartColumn + index + 1, chartEndRow, sourceStartColumn + index + 1),
      }));
      preparedCharts.push({
        ...chart,
        categories,
        categoryRange: sheetRangeRef(sheetName, chartStartRow, sourceStartColumn, chartEndRow, sourceStartColumn),
        series: preparedSeries,
      });
      sourceEndColumn = Math.max(sourceEndColumn, sourceStartColumn + series.length);
      sourceRow += categories.length + 3;
    });

    if (!preparedCharts.length) {
      return;
    }

    model.hiddenSourceStartColumn = sourceStartColumn;
    model.hiddenSourceEndColumn = sourceEndColumn;
    model.maxColumn = Math.max(model.maxColumn || 1, sourceEndColumn);
    model.maxRow = Math.max(model.maxRow || 1, ...preparedCharts.map((chart) => chart.to?.row || 1), sourceRow);
    model.drawingRelId = "rId1";
    model.charts = preparedCharts;
  }

  function attachFiveSChartsToWorksheetModel(model, periodId, sheetName, scoreSource = SCORE_SOURCE_ASSESSOR) {
    const period = getPeriod(periodId);
    const areas = getAreasForPeriod(periodId);
    const targets = getFiveSChartTargets();
    const source = normalizeScoreSource(scoreSource);
    const sourceLabel = source === SCORE_SOURCE_SELF ? "Điểm tự đánh giá" : "Điểm assessor";
    const zoneRows = areas.map((area) => ({
      label: "Zone " + (area.code || "-"),
      value: areaAverage(periodId, area, source),
    })).filter((row) => Number.isFinite(row.value));
    const itemRows = DEFAULT_ITEMS.map((item) => ({
      label: `${item.code.replace(/[()]/g, "")} ${item.name}`,
      value: itemAverage(periodId, item, areas, source),
    })).filter((row) => Number.isFinite(row.value));
    const chartRow = (model.maxRow || 1) + 2;
    attachWorksheetCharts(model, sheetName, [
      {
        title: `Tổng hợp điểm các zone (${periodLabel(period)})`,
        categories: zoneRows.map((row) => row.label),
        series: [
          { name: sourceLabel, values: zoneRows.map((row) => row.value), color: "00B0F0", type: "bar" },
          { name: "Target", values: zoneRows.map(() => targets.zone), color: "FF0000", type: "line" },
        ],
        from: { row: chartRow, column: 1 },
        to: { row: chartRow + 18, column: Math.min(13, Math.max(8, zoneRows.length + 4)) },
        yMin: 0,
        yMax: 5,
        yMajorUnit: 1,
        axisFormat: "0.00",
        labelFormat: "0.00",
      },
      {
        title: `Điểm 5S các hạng mục (${periodLabel(period)})`,
        categories: itemRows.map((row) => row.label),
        series: [
          { name: sourceLabel, values: itemRows.map((row) => row.value), color: "4F81BD", type: "bar" },
          { name: "Target", values: itemRows.map(() => targets.item), color: "FF0000", type: "line" },
        ],
        from: { row: chartRow, column: 14 },
        to: { row: chartRow + 18, column: 27 },
        yMin: 0,
        yMax: 5,
        yMajorUnit: 1,
        axisFormat: "0.00",
        labelFormat: "0.00",
      },
    ]);
  }

  function buildWorkbookFromSheets(sheets) {
    const normalizedSheets = sheets.map((sheet) => ({
      ...sheet,
      charts: sheet.charts || [],
      images: sheet.images || [],
    }));
    const chartEntries = [];
    let drawingNumber = 0;
    const files = {
      "[Content_Types].xml": buildMultiSheetContentTypesXml(normalizedSheets),
      "_rels/.rels": buildRootRelationshipsXml(),
      "xl/workbook.xml": buildWorkbookXml(normalizedSheets.map((sheet) => sheet.name)),
      "xl/_rels/workbook.xml.rels": buildWorkbookRelationshipsXml(normalizedSheets.length),
      "xl/styles.xml": buildXlsxStylesXml(),
    };

    normalizedSheets.forEach((sheet, index) => {
      const sheetNumber = index + 1;
      files[`xl/worksheets/sheet${sheetNumber}.xml`] = sheet.xml;
      if (sheet.charts.length || sheet.images.length) {
        drawingNumber += 1;
        const firstChartIndex = chartEntries.length + 1;
        files[`xl/worksheets/_rels/sheet${sheetNumber}.xml.rels`] = buildWorksheetRelationshipsXml(drawingNumber);
        files[`xl/drawings/drawing${drawingNumber}.xml`] = buildSheetDrawingXml(sheet.charts, sheet.images);
        files[`xl/drawings/_rels/drawing${drawingNumber}.xml.rels`] = buildSheetDrawingRelationshipsXml(sheet.charts, firstChartIndex, sheet.images);
        sheet.charts.forEach((chart) => chartEntries.push(chart));
        sheet.images.forEach((image) => {
          files[`xl/media/${image.name}`] = image.bytes;
        });
      }
    });

    chartEntries.forEach((chart, index) => {
      files[`xl/charts/chart${index + 1}.xml`] = buildReportChartXml(chart, 100000 + index * 20);
    });

    return zipFiles(files);
  }

  function buildContentTypesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
  }

  function buildMultiSheetContentTypesXml(sheets) {
    const worksheetOverrides = sheets
      .map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join("");
    const imageDefaults = [...new Set(sheets.flatMap((sheet) => sheet.images || []).map((image) => image.extension))]
      .filter(Boolean)
      .map((extension) => `<Default Extension="${escapeXml(extension)}" ContentType="image/${extension === "jpg" ? "jpeg" : escapeXml(extension)}"/>`)
      .join("");
    let drawingIndex = 0;
    let chartIndex = 0;
    const drawingOverrides = [];
    const chartOverrides = [];
    sheets.forEach((sheet) => {
      if (!sheet.charts?.length && !sheet.images?.length) {
        return;
      }
      drawingIndex += 1;
      drawingOverrides.push(`<Override PartName="/xl/drawings/drawing${drawingIndex}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
      sheet.charts.forEach(() => {
        chartIndex += 1;
        chartOverrides.push(`<Override PartName="/xl/charts/chart${chartIndex}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
      });
    });

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${imageDefaults}
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${worksheetOverrides}
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${drawingOverrides.join("")}
  ${chartOverrides.join("")}
</Types>`;
  }

  function buildRootRelationshipsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  }

  function buildWorkbookXml(sheetName = "5S") {
    if (Array.isArray(sheetName)) {
      const sheetsXml = sheetName
        .map((name, index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
        .join("");
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <workbookPr/>
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="17600"/></bookViews>
  <sheets>${sheetsXml}</sheets>
</workbook>`;
    }

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <workbookPr/>
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="17600"/></bookViews>
  <sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
  }

  function buildWorkbookRelationshipsXml(sheetCount = 1) {
    const worksheetRelationships = Array.from({ length: sheetCount }, (_, index) => {
      return `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`;
    }).join("");
    const stylesRelId = sheetCount + 1;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${worksheetRelationships}
  <Relationship Id="rId${stylesRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  }

  function buildWorksheetRelationshipsXml(drawingNumber = 1) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingNumber}.xml"/>
</Relationships>`;
  }

  function buildDrawingRelationshipsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart2.xml"/>
</Relationships>`;
  }

  function buildReportDrawingRelationshipsXml(charts, firstChartIndex = 1) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${charts.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${firstChartIndex + index}.xml"/>`).join("")}
</Relationships>`;
  }

  function buildSheetDrawingXml(charts = [], images = []) {
    const imageShapeOffset = charts.length ? charts.length + 2 : 1;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${charts.map((chart, index) => buildChartAnchorXml(chart, index + 1)).join("")}
  ${images.map((image, index) => buildSafetyImageAnchorXml(image, charts.length + index + 1, imageShapeOffset + index)).join("")}
</xdr:wsDr>`;
  }

  function buildSheetDrawingRelationshipsXml(charts = [], firstChartIndex = 1, images = []) {
    const chartRelationships = charts.map((_, index) => {
      return `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${firstChartIndex + index}.xml"/>`;
    }).join("");
    const imageRelationships = images.map((image, index) => {
      return `<Relationship Id="rId${charts.length + index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${image.name}"/>`;
    }).join("");

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${chartRelationships}
  ${imageRelationships}
</Relationships>`;
  }

  function buildXlsxStylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3">
    <numFmt numFmtId="164" formatCode="0.0"/>
    <numFmt numFmtId="165" formatCode="0.00"/>
    <numFmt numFmtId="166" formatCode="0%"/>
  </numFmts>
  <fonts count="16">
    <font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <font><sz val="12"/><color rgb="FF000000"/><name val="Times New Roman"/><family val="1"/></font>
    <font><b/><sz val="12"/><color rgb="FF000000"/><name val="Times New Roman"/><family val="1"/></font>
    <font><b/><sz val="20"/><color rgb="FF000000"/><name val="Times New Roman"/><family val="1"/></font>
    <font><b/><sz val="16"/><color rgb="FF000000"/><name val="Times New Roman"/><family val="1"/></font>
    <font><b/><sz val="14"/><color rgb="FF000000"/><name val="Times New Roman"/><family val="1"/></font>
    <font><sz val="18"/><color rgb="FF000000"/><name val="Arial"/><family val="2"/></font>
    <font><sz val="18"/><color rgb="FF000000"/><name val="Arial"/><family val="2"/></font>
    <font><b/><sz val="16"/><color rgb="FF000000"/><name val="Times New Roman"/><family val="1"/></font>
    <font><b/><sz val="14"/><color rgb="FF000000"/><name val="Times New Roman"/><family val="1"/></font>
    <font><b/><sz val="10"/><color rgb="FF000000"/><name val="Times New Roman"/><family val="1"/></font>
    <font><b/><sz val="13"/><color rgb="FF000000"/><name val="Times New Roman"/><family val="1"/></font>
    <font><b/><sz val="15"/><color rgb="FFD00000"/><name val="Times New Roman"/><family val="1"/></font>
    <font><b/><sz val="14"/><color rgb="FF000000"/><name val="Times New Roman"/><family val="1"/></font>
    <font><b/><sz val="18"/><color rgb="FF000000"/><name val="Times New Roman"/><family val="1"/></font>
    <font><b/><sz val="24"/><color rgb="FF000000"/><name val="Times New Roman"/><family val="1"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF00B050"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF4B6C2"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFF0000"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FF111111"/></left>
      <right style="thin"><color rgb="FF111111"/></right>
      <top style="thin"><color rgb="FF111111"/></top>
      <bottom style="thin"><color rgb="FF111111"/></bottom>
      <diagonal/>
    </border>
    <border diagonalUp="1">
      <left style="thin"><color rgb="FF111111"/></left>
      <right style="thin"><color rgb="FF111111"/></right>
      <top style="thin"><color rgb="FF111111"/></top>
      <bottom style="thin"><color rgb="FF111111"/></bottom>
      <diagonal style="thin"><color rgb="FF7A1723"/></diagonal>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="31">
    ${xf(0, 0, 0, 0)}
    ${xf(0, 15, 0, 1, "center", "center", true)}
    ${xf(0, 8, 0, 1, "center", "center", true)}
    ${xf(0, 8, 0, 1, "center", "center", false)}
    ${xf(0, 2, 0, 1, "center", "center", false)}
    ${xf(0, 2, 2, 1, "center", "center", false)}
    ${xf(0, 4, 0, 1, "center", "center", false)}
    ${xf(0, 9, 0, 1, "center", "center", false)}
    ${xf(0, 3, 0, 1, "center", "center", false)}
    ${xf(0, 3, 0, 1, "center", "center", false)}
    ${xf(0, 10, 0, 1, "center", "center", true)}
    ${xf(0, 11, 0, 1, "center", "center", false)}
    ${xf(0, 5, 0, 1, "center", "center", true)}
    ${xf(0, 5, 0, 1, "left", "center", false)}
    ${xf(0, 9, 0, 1, "center", "center", false)}
    ${xf(0, 12, 5, 1, "center", "center", false)}
    ${xf(0, 9, 4, 2, "center", "center", false)}
    ${xf(164, 4, 0, 1, "center", "center", false)}
    ${xf(0, 6, 3, 1, "center", "center", false)}
    ${xf(165, 13, 0, 1, "center", "center", false)}
    ${xf(0, 7, 0, 1, "center", "center", false)}
    ${xf(165, 14, 0, 1, "center", "center", false)}
    ${xf(0, 13, 0, 1, "center", "center", false)}
    ${xf(164, 3, 2, 1, "center", "center", false)}
    ${xf(0, 1, 0, 1, "center", "center", true)}
    ${xf(0, 1, 0, 1, "center", "center", true)}
    ${xf(0, 10, 0, 1, "center", "center", true, 90)}
    ${xf(0, 2, 6, 1, "center", "center", false)}
    ${xf(166, 13, 0, 1, "center", "center", false)}
    ${xf(165, 4, 0, 1, "center", "center", false)}
    ${xf(0, 0, 0, 1)}
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;
  }

  function xf(numFmtId, fontId, fillId, borderId, horizontal = "center", vertical = "center", wrap = false, textRotation = "") {
    const numFmt = numFmtId ? ` numFmtId="${numFmtId}" applyNumberFormat="1"` : ' numFmtId="0"';
    const rotation = textRotation !== "" ? ` textRotation="${textRotation}"` : "";
    return `<xf${numFmt} fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${horizontal}" vertical="${vertical}"${wrap ? ' wrapText="1"' : ""}${rotation}/></xf>`;
  }

  function buildDrawingXml(charts) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${charts.map((chart, index) => buildChartAnchorXml(chart, index + 1)).join("")}
</xdr:wsDr>`;
  }

  function buildChartAnchorXml(chart, index) {
    return `<xdr:twoCellAnchor>
  <xdr:from><xdr:col>${chart.from.column - 1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chart.from.row - 1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
  <xdr:to><xdr:col>${chart.to.column}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chart.to.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
  <xdr:graphicFrame macro="">
    <xdr:nvGraphicFramePr><xdr:cNvPr id="${index + 1}" name="Dashboard ${index}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
    <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
    <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rId${index}"/></a:graphicData></a:graphic>
  </xdr:graphicFrame>
  <xdr:clientData/>
</xdr:twoCellAnchor>`;
  }

  function buildChartXml(chart, axisBase) {
    const catId = axisBase;
    const valId = axisBase + 1;
    const yMin = Number.isFinite(chart.yMin) ? `<c:min val="${chart.yMin}"/>` : "";
    const yMax = Number.isFinite(chart.yMax) ? `<c:max val="${chart.yMax}"/>` : "";
    const yMajorUnit = Number.isFinite(chart.yMajorUnit) ? `<c:majorUnit val="${chart.yMajorUnit}"/>` : "";
    const yMinorUnit = Number.isFinite(chart.yMinorUnit) ? `<c:minorUnit val="${chart.yMinorUnit}"/>` : "";
    const targetDash = chart.targetLineDash ? '<a:prstDash val="dash"/>' : "";

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:date1904 val="0"/>
  <c:lang val="vi-VN"/>
  <c:roundedCorners val="0"/>
  <c:chart>
    <c:title>${chartTitleXml(chart.title)}</c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>
      <c:barChart>
        <c:barDir val="col"/>
        <c:grouping val="clustered"/>
        <c:varyColors val="0"/>
        <c:ser>
          <c:idx val="0"/><c:order val="0"/>
          <c:tx><c:v>${escapeXml(chart.seriesName || "Series1")}</c:v></c:tx>
          <c:spPr><a:solidFill><a:srgbClr val="00B0F0"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>
          <c:cat>${chartStringRefXml(chart.categoryRange, chart.categories)}</c:cat>
          <c:val>${chartNumberRefXml(chart.valueRange, chart.values)}</c:val>
        </c:ser>
        ${chartDataLabelsXml(chart)}
        <c:gapWidth val="${chart.gapWidth || 80}"/>
        <c:overlap val="0"/>
        <c:axId val="${catId}"/>
        <c:axId val="${valId}"/>
      </c:barChart>
      <c:lineChart>
        <c:grouping val="standard"/>
        <c:varyColors val="0"/>
        <c:ser>
          <c:idx val="1"/><c:order val="1"/>
          <c:tx><c:v>${escapeXml(chart.targetName || "Target")}</c:v></c:tx>
          <c:spPr><a:ln w="19050"><a:solidFill><a:srgbClr val="${chart.targetColor || "FF0000"}"/></a:solidFill>${targetDash}</a:ln></c:spPr>
          <c:marker><c:symbol val="none"/></c:marker>
          <c:cat>${chartStringRefXml(chart.categoryRange, chart.categories)}</c:cat>
          <c:val>${chartNumberRefXml(chart.targetRange, chart.targetValues)}</c:val>
        </c:ser>
        <c:axId val="${catId}"/>
        <c:axId val="${valId}"/>
      </c:lineChart>
      <c:catAx>
        <c:axId val="${catId}"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="b"/>
        ${chartTextPropertiesXml(800)}
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="${valId}"/><c:crosses val="autoZero"/>
        <c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="${valId}"/>
        <c:scaling><c:orientation val="minMax"/>${yMax}${yMin}</c:scaling>
        <c:delete val="0"/><c:axPos val="l"/>
        <c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>
        ${Number.isFinite(chart.yMinorUnit) ? '<c:minorGridlines><c:spPr><a:ln w="3175"><a:solidFill><a:srgbClr val="ECECEC"/></a:solidFill></a:ln></c:spPr></c:minorGridlines>' : ""}
        <c:numFmt formatCode="${chart.axisFormat || "0.00"}" sourceLinked="0"/>
        <c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>
        ${chartTextPropertiesXml(1100)}
        <c:crossAx val="${catId}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/>
        ${yMajorUnit}
        ${yMinorUnit}
      </c:valAx>
      ${chartDataTableXml(chart)}
    </c:plotArea>
    ${chartLegendXml(chart)}
    <c:plotVisOnly val="0"/>
    <c:dispBlanksAs val="gap"/>
    <c:showDLblsOverMax val="0"/>
  </c:chart>
</c:chartSpace>`;
  }

  function buildReportChartXml(chart, axisBase) {
    const catId = axisBase;
    const valId = axisBase + 1;
    const yMin = Number.isFinite(chart.yMin) ? `<c:min val="${chart.yMin}"/>` : "";
    const yMax = Number.isFinite(chart.yMax) ? `<c:max val="${chart.yMax}"/>` : "";
    const yMajorUnit = Number.isFinite(chart.yMajorUnit) ? `<c:majorUnit val="${chart.yMajorUnit}"/>` : "";
    const barSeries = (chart.series || []).filter((series) => series.type !== "line");
    const lineSeries = (chart.series || []).filter((series) => series.type === "line");
    const barXml = barSeries.length ? `<c:barChart>
        <c:barDir val="col"/>
        <c:grouping val="clustered"/>
        <c:varyColors val="0"/>
        ${barSeries.map((series, index) => buildReportChartSeriesXml(series, index, chart.categoryRange, chart.categories)).join("")}
        ${chartDataLabelsXml(chart)}
        <c:gapWidth val="${chart.gapWidth || 80}"/>
        <c:overlap val="0"/>
        <c:axId val="${catId}"/>
        <c:axId val="${valId}"/>
      </c:barChart>` : "";
    const lineXml = lineSeries.length ? `<c:lineChart>
        <c:grouping val="standard"/>
        <c:varyColors val="0"/>
        ${lineSeries.map((series, index) => buildReportChartSeriesXml(series, barSeries.length + index, chart.categoryRange, chart.categories, true)).join("")}
        <c:axId val="${catId}"/>
        <c:axId val="${valId}"/>
      </c:lineChart>` : "";

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:date1904 val="0"/>
  <c:lang val="vi-VN"/>
  <c:roundedCorners val="0"/>
  <c:chart>
    <c:title>${chartTitleXml(chart.title)}</c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>
      ${barXml}
      ${lineXml}
      <c:catAx>
        <c:axId val="${catId}"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="b"/>
        ${chartTextPropertiesXml(800)}
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="${valId}"/><c:crosses val="autoZero"/>
        <c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="${valId}"/>
        <c:scaling><c:orientation val="minMax"/>${yMax}${yMin}</c:scaling>
        <c:delete val="0"/><c:axPos val="l"/>
        <c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>
        <c:numFmt formatCode="${chart.axisFormat || "0"}" sourceLinked="0"/>
        <c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>
        ${chartTextPropertiesXml(1000)}
        <c:crossAx val="${catId}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/>
        ${yMajorUnit}
      </c:valAx>
      ${chartDataTableXml(chart)}
    </c:plotArea>
    ${chartLegendXml(chart)}
    <c:plotVisOnly val="0"/>
    <c:dispBlanksAs val="gap"/>
    <c:showDLblsOverMax val="0"/>
  </c:chart>
</c:chartSpace>`;
  }

  function buildReportChartSeriesXml(series, index, categoryRange, categories, isLine = false) {
    const color = String(series.color || "4F81BD").replace("#", "").toUpperCase();
    const lineStyle = isLine
      ? `<a:ln w="19050"><a:solidFill><a:srgbClr val="${escapeXml(color)}"/></a:solidFill></a:ln>`
      : `<a:solidFill><a:srgbClr val="${escapeXml(color)}"/></a:solidFill><a:ln><a:noFill/></a:ln>`;
    const marker = isLine ? '<c:marker><c:symbol val="none"/></c:marker>' : "";
    return `<c:ser>
          <c:idx val="${index}"/><c:order val="${index}"/>
          <c:tx><c:v>${escapeXml(series.name || "Series " + (index + 1))}</c:v></c:tx>
          <c:spPr>${lineStyle}</c:spPr>
          ${marker}
          <c:cat>${chartStringRefXml(categoryRange, categories)}</c:cat>
          <c:val>${chartNumberRefXml(series.range, series.values)}</c:val>
        </c:ser>`;
  }

  function chartDataLabelsXml(chart) {
    if (chart.showDataLabels === false) {
      return "";
    }

    const position = chart.dataLabelPosition ? `<c:dLblPos val="${chart.dataLabelPosition}"/>` : "";
    return `<c:dLbls><c:numFmt formatCode="${chart.labelFormat || "0.00"}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${chartTextPropertiesXml(1000)}${position}<c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>`;
  }

  function chartDataTableXml(chart) {
    if (!chart.showDataTable) {
      return "";
    }

    return `<c:dTable><c:showHorzBorder val="1"/><c:showVertBorder val="1"/><c:showOutline val="1"/><c:showKeys val="1"/>${chartTextPropertiesXml(1000)}</c:dTable>`;
  }

  function chartLegendXml(chart) {
    if (chart.showLegend === false) {
      return "";
    }

    return `<c:legend><c:legendPos val="b"/><c:layout/><c:overlay val="0"/>${chartTextPropertiesXml(1100)}</c:legend>`;
  }

  function chartTextPropertiesXml(size, color = "4D4D4D") {
    return `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Arial"/></a:defRPr></a:pPr><a:endParaRPr lang="vi-VN"/></a:p></c:txPr>`;
  }

  function chartTitleXml(title) {
    return `<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1800"><a:solidFill><a:srgbClr val="595959"/></a:solidFill><a:latin typeface="Arial"/></a:defRPr></a:pPr><a:r><a:rPr lang="vi-VN" sz="1800"><a:solidFill><a:srgbClr val="595959"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>${escapeXml(title)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/><c:overlay val="0"/>`;
  }

  function chartStringRefXml(range, labels) {
    return `<c:strRef><c:f>${escapeXml(range)}</c:f><c:strCache><c:ptCount val="${labels.length}"/>${labels
      .map((label, index) => `<c:pt idx="${index}"><c:v>${escapeXml(label)}</c:v></c:pt>`)
      .join("")}</c:strCache></c:strRef>`;
  }

  function chartNumberRefXml(range, values) {
    return `<c:numRef><c:f>${escapeXml(range)}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${values
      .map((value, index) => (Number.isFinite(value) ? `<c:pt idx="${index}"><c:v>${Number(value).toFixed(4)}</c:v></c:pt>` : ""))
      .join("")}</c:numCache></c:numRef>`;
  }

  function buildGroupedSpans(areas, propertyName, mergeBlankGroups) {
    const groups = [];

    areas.forEach((area, index) => {
      const label = area[propertyName] || "";
      const current = groups[groups.length - 1];
      if (current && current.label === label && (label || mergeBlankGroups)) {
        current.areas.push(area);
      } else {
        groups.push({ label, startIndex: index, areas: [area] });
      }
    });

    return groups;
  }

  function buildDepartmentSummarySpans(areas) {
    const deptSpans = buildGroupedSpans(areas, "departmentHead", false);
    return deptSpans.map((group) => {
      const explicitSummary = group.areas.find((area) => String(area.summaryGroup || "").trim())?.summaryGroup?.trim();
      const label = explicitSummary || group.label || "";
      return {
        label,
        departmentHead: group.label,
        startIndex: group.startIndex,
        areas: group.areas,
      };
    });
  }

  function cellRef(row, column) {
    return `${excelColumnName(column)}${row}`;
  }

  function rangeRef(rowStart, columnStart, rowEnd, columnEnd) {
    return `'5S'!$${excelColumnName(columnStart)}$${rowStart}:$${excelColumnName(columnEnd)}$${rowEnd}`;
  }

  function wrapChartCategoryLabel(label, maxLineLength = 10) {
    const words = String(label ?? "")
      .replace(/\s+/g, " ")
      .replace(/\s*\(/g, " (")
      .trim()
      .split(" ")
      .filter(Boolean);
    const lines = [];
    let currentLine = "";

    words.forEach((word) => {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;
      if (currentLine && nextLine.length > maxLineLength) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = nextLine;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.join("\n");
  }

  function escapeXml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function zipFiles(files) {
    const encoder = new TextEncoder();
    const entries = Object.entries(files).map(([name, content]) => ({
      name,
      data: typeof content === "string" ? encoder.encode(content) : content,
    }));
    const parts = [];
    const centralDirectory = [];
    let offset = 0;
    const { date, time } = getDosDateTime(new Date());

    entries.forEach((entry) => {
      const nameBytes = encoder.encode(entry.name);
      const crc = crc32(entry.data);
      const localHeader = concatBytes([
        uint32(0x04034b50),
        uint16(20),
        uint16(0x0800),
        uint16(0),
        uint16(time),
        uint16(date),
        uint32(crc),
        uint32(entry.data.length),
        uint32(entry.data.length),
        uint16(nameBytes.length),
        uint16(0),
        nameBytes,
      ]);

      parts.push(localHeader, entry.data);
      centralDirectory.push(
        concatBytes([
          uint32(0x02014b50),
          uint16(20),
          uint16(20),
          uint16(0x0800),
          uint16(0),
          uint16(time),
          uint16(date),
          uint32(crc),
          uint32(entry.data.length),
          uint32(entry.data.length),
          uint16(nameBytes.length),
          uint16(0),
          uint16(0),
          uint16(0),
          uint16(0),
          uint32(0),
          uint32(offset),
          nameBytes,
        ]),
      );
      offset += localHeader.length + entry.data.length;
    });

    const centralStart = offset;
    centralDirectory.forEach((part) => {
      parts.push(part);
      offset += part.length;
    });
    const centralSize = offset - centralStart;

    parts.push(
      concatBytes([
        uint32(0x06054b50),
        uint16(0),
        uint16(0),
        uint16(entries.length),
        uint16(entries.length),
        uint32(centralSize),
        uint32(centralStart),
        uint16(0),
      ]),
    );

    return concatBytes(parts);
  }

  function getDosDateTime(dateValue) {
    const year = Math.max(1980, dateValue.getFullYear());
    const month = dateValue.getMonth() + 1;
    const day = dateValue.getDate();
    const hours = dateValue.getHours();
    const minutes = dateValue.getMinutes();
    const seconds = Math.floor(dateValue.getSeconds() / 2);
    return {
      date: ((year - 1980) << 9) | (month << 5) | day,
      time: (hours << 11) | (minutes << 5) | seconds,
    };
  }

  function uint16(value) {
    const bytes = new Uint8Array(2);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, value, true);
    return bytes;
  }

  function uint32(value) {
    const bytes = new Uint8Array(4);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, value >>> 0, true);
    return bytes;
  }

  function concatBytes(chunks) {
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    chunks.forEach((chunk) => {
      output.set(chunk, offset);
      offset += chunk.length;
    });
    return output;
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let index = 0; index < bytes.length; index += 1) {
      crc = CRC32_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      const chunk = bytes.subarray(index, index + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return window.btoa(binary);
  }
  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
  }

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    if (elements.toast) {
      elements.toast.textContent = message;
      elements.toast.classList.toggle("is-error", isError);
      elements.toast.classList.add("is-visible");
      toastTimer = window.setTimeout(() => {
        elements.toast.classList.remove("is-visible");
      }, 2600);
    }
    if (typeof window.showMobileToast === "function" && document.getElementById("mobileProtoOverlay")) {
      window.showMobileToast(message, isError);
    }
  }

  function handleLocalDataSyncStatus(event) {
    const detail = event?.detail || {};
    const pending = Number(detail.pending || 0);
    const syncing = Boolean(detail.syncing);
    const hasError = Boolean(detail.lastError);
    const indicator = document.querySelector(".status-indicator");
    const label = indicator?.querySelector("span:not(.status-dot)");

    if (indicator) {
      indicator.classList.toggle("has-pending", pending > 0);
      indicator.classList.toggle("is-syncing", syncing);
      indicator.classList.toggle("is-offline", pending > 0 && !syncing);
      indicator.classList.toggle("has-error", hasError && pending > 0);
    }

    if (label) {
      if (pending > 0 && syncing) {
        label.textContent = `Đang đồng bộ ${pending} thay đổi`;
      } else if (pending > 0 && hasError) {
        label.textContent = `Chờ đúng mạng nội bộ (${pending})`;
      } else if (pending > 0) {
        label.textContent = `Đã lưu tạm ${pending} thay đổi`;
      } else {
        label.textContent = "Dữ liệu nội bộ (Local)";
      }
    }

    if (pending > 0 && lastOfflinePending === 0 && !syncing) {
      showToast("Mất kết nối mạng nội bộ. Dữ liệu đã được lưu tạm trên thiết bị.");
    } else if (pending === 0 && lastOfflinePending > 0 && lastOfflineSyncing && !hasError) {
      showToast("Đã đồng bộ dữ liệu offline lên máy chủ.");
    }

    lastOfflinePending = pending;
    lastOfflineSyncing = syncing;
  }

  async function copyTextToClipboard(text, successMessage = "Đã copy.") {
    if (!String(text || "").trim()) {
      showToast("Không có nội dung để copy.", true);
      return;
    }

    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) {
          throw new Error("Copy command failed");
        }
      }

      showToast(successMessage);
    } catch (error) {
      console.error(error);
      const recipientTextarea = document.getElementById("safety-recipient-emails");
      recipientTextarea?.focus();
      recipientTextarea?.select();
      showToast("Không copy tự động được, hãy nhấn Ctrl+C.", true);
    }
  }

  function getHistoryEntryScope(entry) {
    if (entry?.scope) {
      return normalizeCatalogType(entry.scope);
    }
    const period = getPeriod(entry?.periodId || "");
    if (period && normalizePeriodType(period.type) === SAFETY_PERIOD_TYPE) {
      return SAFETY_PERIOD_TYPE;
    }
    const text = [entry?.periodLabel, entry?.subjectLabel, entry?.changeLabel, entry?.note]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("vi");
    return text.includes("an toàn") || text.includes("đg at") || text.includes(" at") ? SAFETY_PERIOD_TYPE : FIVE_S_PERIOD_TYPE;
  }

  function getHistoryEntries(scope = "") {
    const normalizedScope = scope ? normalizeCatalogType(scope) : "";
    return [...(state.history || [])]
      .filter((entry) => !isHistoryEntryExpired(entry))
      .filter((entry) => !normalizedScope || getHistoryEntryScope(entry) === normalizedScope)
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  }

  function formatHistoryTarget(entry) {
    const parts = [
      entry.periodLabel || "",
      entry.areaCode ? "Zone " + entry.areaCode : "",
      entry.itemCode ? entry.itemCode + (entry.criterionLabel ? " - " + entry.criterionLabel : "") : "",
    ].filter(Boolean);
    return parts.join(" · ") || "-";
  }

  function formatHistoryChange(entry) {
    if (entry.changeLabel) {
      return entry.changeLabel;
    }

    if (entry.subjectLabel) {
      return entry.subjectLabel;
    }

    return [entry.beforeLabel, entry.afterLabel].filter(Boolean).join(" → ") || "-";
  }

  function openEditHistoryModal(scope = activeHistoryScope) {
    if (!requireAdminAction()) {
      return;
    }

    closeAccountMenu();
    activeHistoryScope = normalizeCatalogType(scope);
    const rows = getHistoryEntries(activeHistoryScope);
    const historyRows = rows.map((entry) => {
      const userLabel = (entry.userName || "Không rõ") + (entry.username ? " (" + entry.username + ")" : "");
      const beforeAfter = [
        entry.beforeLabel ? "<span><strong>Trước:</strong> " + escapeHtml(entry.beforeLabel) + "</span>" : "",
        entry.afterLabel ? "<span><strong>Sau:</strong> " + escapeHtml(entry.afterLabel) + "</span>" : "",
      ].filter(Boolean).join("") || "-";
      return "<tr>" +
        "<td data-label=\"Thời gian\">" + escapeHtml(formatDateTimeDisplay(entry.timestamp)) + "</td>" +
        "<td data-label=\"Tài khoản\">" + escapeHtml(userLabel) + "</td>" +
        "<td data-label=\"Kỳ / Zone\">" + escapeHtml(formatHistoryTarget(entry)) + "</td>" +
        "<td data-label=\"Nội dung\"><strong>" + escapeHtml(formatHistoryChange(entry)) + "</strong>" + (entry.subjectLabel ? "<span>" + escapeHtml(entry.subjectLabel) + "</span>" : "") + "</td>" +
        "<td data-label=\"Trước / Sau\">" + beforeAfter + "</td>" +
        "<td data-label=\"Ghi chú\">" + escapeHtml(entry.note || "-") + "</td>" +
      "</tr>";
    }).join("");
    const scopeSwitch = "<div class=\"scope-card-row history-scope-row\">" + scopeCardHtml(activeHistoryScope, "set-history-scope", "Lịch sử") + "</div>";
    const html = scopeSwitch + (rows.length
      ? "<div class=\"history-summary\"><strong>" + rows.length + "</strong><span>phiên có chỉnh sửa " + escapeHtml(getAccountScopeLabel(activeHistoryScope)) + " trong 3 tháng gần nhất từ tất cả tài khoản.</span></div>" +
        "<div class=\"history-table-wrap\"><table class=\"history-table\"><thead><tr>" +
          "<th>Thời gian</th><th>Tài khoản</th><th>Kỳ / Zone</th><th>Nội dung</th><th>Trước / Sau</th><th>Ghi chú</th>" +
        "</tr></thead><tbody>" + historyRows + "</tbody></table></div>"
      : "<div class=\"history-empty\"><strong>Chưa có log chỉnh sửa " + escapeHtml(getAccountScopeLabel(activeHistoryScope)) + " (3 tháng gần nhất)</strong><span>Khi admin hoặc assessor cập nhật dữ liệu, lịch sử sẽ hiện ở đây.</span></div>") +
      "<p style=\"margin:10px 0 0; font-size:0.8rem; color:var(--muted); text-align:right;\">💡 <em>Hệ thống tự động lưu giữ lịch sử chỉnh sửa trong vòng 3 tháng gần nhất để tối ưu hiệu năng và dung lượng.</em></p>";

    openFormModal({
      title: "Lịch sử chỉnh sửa",
      submitText: "Đóng",
      submitClass: "secondary-button",
      html,
      onSubmit() {
        return true;
      },
    });
  }

  const COPY_STYLE_PROPS = [
    "display",
    "box-sizing",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "color",
    "background",
    "background-color",
    "border",
    "border-color",
    "border-style",
    "border-width",
    "border-collapse",
    "border-spacing",
    "padding",
    "text-align",
    "vertical-align",
    "line-height",
    "white-space",
    "width",
    "min-width",
    "height",
    "fill",
    "stroke",
    "stroke-width",
    "stroke-dasharray",
    "stroke-linecap",
    "border-radius",
    "box-shadow",
    "margin",
    "max-width",
    "max-height",
    "overflow",
    "overflow-x",
    "overflow-y",
    "gap",
    "grid-template-columns",
    "grid-template-rows",
    "align-items",
    "justify-content",
    "justify-items",
    "place-items",
    "flex",
    "flex-direction",
    "flex-wrap",
    "text-transform",
    "letter-spacing",
  ];

  function formControlTextForCopy(control) {
    if (!control) {
      return "";
    }

    if (control.tagName === "SELECT") {
      return control.selectedOptions?.[0]?.textContent || control.value || "";
    }

    return control.value || "";
  }

  function cellTextForCopy(cell) {
    const controls = Array.from(cell.querySelectorAll?.("input,textarea,select") || []);
    const text = controls.length
      ? controls.map(formControlTextForCopy).join(" ")
      : cell.innerText || "";
    return String(text).replace(/\s+/g, " ").trim();
  }

  function tableTextForCopy(element) {
    const table = element.matches?.("table") ? element : element.querySelector?.("table");
    if (!table) {
      return element.innerText || "";
    }

    return Array.from(table.rows).map((row) => Array.from(row.cells)
      .map(cellTextForCopy)
      .join("\t"))
      .join("\n");
  }

  function replaceFormControlsForCopy(root) {
    root.querySelectorAll?.("input,textarea,select").forEach((control) => {
      const replacement = document.createElement("span");
      replacement.textContent = formControlTextForCopy(control);
      replacement.setAttribute("style", control.getAttribute("style") || "");
      control.replaceWith(replacement);
    });
  }

  function syncFormControlValuesForHtml(root) {
    root.querySelectorAll?.("input,textarea,select").forEach((control) => {
      if (control.tagName === "SELECT") {
        Array.from(control.options || []).forEach((option) => {
          option.toggleAttribute("selected", option.selected);
        });
        return;
      }

      if (control.tagName === "TEXTAREA") {
        control.textContent = control.value || "";
        return;
      }

      if (control.type === "checkbox" || control.type === "radio") {
        control.toggleAttribute("checked", control.checked);
        return;
      }

      control.setAttribute("value", control.value || "");
    });
  }

  function openFullscreenTable(tableKind = "") {
    if (tableKind === "assessor") {
      const sourceTable = elements.assessorSheet?.querySelector(".assessor-4m-table");
      const periodId = sourceTable?.dataset.periodId || getActivePeriodId(FIVE_S_PERIOD_TYPE);
      const area = getAreaForPeriod(periodId, sourceTable?.dataset.areaId || elements.assessorAreaSelect?.value || "");
      const scoreSource = normalizeScoreSource(sourceTable?.dataset.scoreSource || getScoreSourceForAccount(currentUser));
      if (!periodId || !area) {
        showToast("Chưa có bảng để phóng to.", true);
        return;
      }

      const wrapper = document.createElement("div");
      wrapper.className = "assessor-4m-wrap fullscreen-table-wrap";
      wrapper.setAttribute("data-drag-scroll", "");
      const table = document.createElement("table");
      table.className = "matrix-table standard-reference-table assessor-4m-table";
      wrapper.appendChild(table);
      renderAssessorFourMTable(table, {
        periodId,
        area,
        scoreSource,
        editable: canEditFiveSScoreSource(currentUser, scoreSource) && !isPeriodArchived(periodId),
      });
      syncFormControlValuesForHtml(wrapper);

      openFormModal({
        title: "Phiếu chấm 5S",
        submitText: "Đóng",
        submitClass: "secondary-button",
        modalClass: "table-fullscreen-modal",
        html: wrapper.outerHTML,
        onSubmit() {
          return true;
        },
      });
      return;
    }

    const sourceWrap = elements.summaryTable?.closest?.(".summary-matrix-wrap");
    const sourceTable = sourceWrap?.querySelector("table");
    if (!sourceWrap || !sourceTable) {
      showToast("Chưa có bảng để phóng to.", true);
      return;
    }

    const clone = sourceWrap.cloneNode(true);
    clone.removeAttribute("id");
    clone.classList.add("fullscreen-table-wrap");
    clone.setAttribute("data-drag-scroll", "");
    clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    syncFormControlValuesForHtml(clone);

    openFormModal({
      title: "Bảng điểm 5S",
      submitText: "Đóng",
      submitClass: "secondary-button",
      modalClass: "table-fullscreen-modal",
      html: clone.outerHTML,
      onSubmit() {
        return true;
      },
    });
  }

  function inlineCopyStyles(sourceNode, cloneNode) {
    if (!(sourceNode instanceof Element) || !(cloneNode instanceof Element)) {
      return;
    }

    const computed = window.getComputedStyle(sourceNode);
    const styleText = COPY_STYLE_PROPS.map((property) => {
      const value = computed.getPropertyValue(property);
      return value ? property + ":" + value : "";
    }).filter(Boolean).join(";");
    const existingStyle = cloneNode.getAttribute("style") || "";
    cloneNode.setAttribute("style", [existingStyle, styleText].filter(Boolean).join(";"));

    Array.from(sourceNode.children).forEach((child, index) => {
      inlineCopyStyles(child, cloneNode.children[index]);
    });
  }

  function fallbackSelectCopy(element) {
    const selection = window.getSelection?.();
    if (!selection || !document.createRange) {
      return false;
    }

    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
    const copied = document.execCommand?.("copy");
    selection.removeAllRanges();
    return Boolean(copied);
  }

  const IMAGE_COPY_EXPAND_SELECTORS = [
    ".excel-chart-scroll",
    ".excel-wide-wrap",
    ".dashboard-table-wrap",
    ".wide-table-wrap",
    ".factory-summary-wrap",
    ".progress-summary-wrap",
    ".department-zone-summary-wrap",
  ];

  function shouldCopyReportAsImage(target) {
    const explicitFormat = target.dataset?.copyFormat || target.closest?.(".copyable-report-block")?.dataset?.copyFormat || "";
    if (explicitFormat === "image") {
      return true;
    }
    if (explicitFormat === "html") {
      return false;
    }
    return Boolean(target.querySelector?.("svg,canvas,.excel-chart-panel,.dashboard-visual"));
  }

  function getSvgViewBoxSize(svg) {
    const viewBox = svg.getAttribute("viewBox");
    if (!viewBox) {
      return null;
    }
    const parts = viewBox.split(/[\s,]+/).map(Number).filter((value) => Number.isFinite(value));
    if (parts.length < 4) {
      return null;
    }
    return { width: Math.max(1, parts[2]), height: Math.max(1, parts[3]) };
  }

  function getImageCopySize(element) {
    const rootRect = element.getBoundingClientRect();
    let width = Math.max(1, element.scrollWidth || 0, rootRect.width || 0);
    let height = Math.max(1, element.scrollHeight || 0, rootRect.height || 0);

    element.querySelectorAll?.("*").forEach((node) => {
      if (!(node instanceof Element)) {
        return;
      }
      const rect = node.getBoundingClientRect();
      const left = Math.max(0, rect.left - rootRect.left);
      const top = Math.max(0, rect.top - rootRect.top);
      width = Math.max(width, left + Math.max(rect.width || 0, node.scrollWidth || 0));
      height = Math.max(height, top + Math.max(rect.height || 0, node.scrollHeight || 0));

      if (node instanceof SVGElement) {
        const viewBoxSize = getSvgViewBoxSize(node);
        if (viewBoxSize) {
          width = Math.max(width, left + viewBoxSize.width);
          height = Math.max(height, top + viewBoxSize.height);
        }
      }
    });

    return {
      width: Math.min(12000, Math.ceil(width + 8)),
      height: Math.min(12000, Math.ceil(height + 8)),
    };
  }

  function expandImageCopyClone(clone) {
    clone.querySelectorAll?.(IMAGE_COPY_EXPAND_SELECTORS.join(",")).forEach((node) => {
      node.style.overflow = "visible";
      node.style.overflowX = "visible";
      node.style.overflowY = "visible";
      node.style.maxWidth = "none";
      node.style.maxHeight = "none";
    });

    clone.querySelectorAll?.("svg[viewBox]").forEach((svg) => {
      const size = getSvgViewBoxSize(svg);
      if (!size) {
        return;
      }
      svg.setAttribute("width", String(size.width));
      svg.setAttribute("height", String(size.height));
      svg.style.width = size.width + "px";
      svg.style.height = size.height + "px";
      svg.style.maxWidth = "none";
      svg.style.overflow = "visible";
    });
  }

  function loadImageFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Không render được ảnh copy."));
      };
      image.src = url;
    });
  }

  function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Không tạo được ảnh PNG."));
        }
      }, "image/png");
    });
  }

  async function renderChartTargetToPng(target) {
    const svgEl = target.querySelector("svg");
    if (!svgEl) {
      throw new Error("Không tìm thấy phần tử SVG trong biểu đồ.");
    }

    // 1. Determine SVG dimensions
    let svgWidth = 0;
    let svgHeight = 0;
    const viewBox = svgEl.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(Number).filter(Number.isFinite);
      if (parts.length >= 4) {
        svgWidth = parts[2];
        svgHeight = parts[3];
      }
    }
    if (!svgWidth || !svgHeight) {
      const rect = svgEl.getBoundingClientRect();
      svgWidth = svgEl.clientWidth || Math.round(rect.width) || 740;
      svgHeight = svgEl.clientHeight || Math.round(rect.height) || 280;
    }

    // 2. Extract Title
    const titleEl = target.querySelector("h3, h2, h4, .section-heading h2, strong");
    const rawTitle = titleEl ? titleEl.textContent.replace(/\s+/g, " ").trim() : "";
    const subtitleEl = titleEl?.parentElement?.querySelector("span");
    const subtitleText = subtitleEl ? subtitleEl.textContent.replace(/\s+/g, " ").trim() : "";
    const titleText = rawTitle && subtitleText && !rawTitle.includes(subtitleText) ? `${rawTitle} - ${subtitleText}` : rawTitle;

    // 3. Extract Legend
    const legendEl = target.querySelector(".excel-chart-legend, .admin-card-chart-legend");
    const isVerticalLegend = Boolean(legendEl && legendEl.classList.contains("vertical"));
    const legendItems = [];
    if (legendEl) {
      legendEl.querySelectorAll("span").forEach((span) => {
        const icon = span.querySelector("i, b");
        let color = "";
        if (icon) {
          color = icon.style.backgroundColor || icon.style.background || "";
          if (!color) {
            const computed = window.getComputedStyle(icon);
            color = computed.backgroundColor || "";
          }
        }
        const text = span.textContent.replace(/\s+/g, " ").trim();
        const isTarget = span.classList.contains("legend-target") || Boolean(span.querySelector("b")) || /target/i.test(text);
        if (text) {
          legendItems.push({
            color: color || (isTarget ? "#e11d48" : "#12a8e8"),
            text,
            isTarget,
          });
        }
      });
    }

    // 4. Calculate layout metrics
    const paddingX = 24;
    const paddingTop = 20;
    const paddingBottom = 20;
    const titleHeight = titleText ? 36 : 0;

    let totalWidth = svgWidth + paddingX * 2;
    let totalHeight = svgHeight + titleHeight + paddingTop + paddingBottom;
    let chartX = paddingX;
    let chartY = paddingTop + titleHeight;
    let legendX = 0;
    let legendY = 0;

    if (legendItems.length > 0) {
      if (isVerticalLegend) {
        const legendColWidth = 160;
        totalWidth = svgWidth + legendColWidth + paddingX * 2;
        const legendHeight = legendItems.length * 20;
        totalHeight = Math.max(svgHeight, legendHeight) + titleHeight + paddingTop + paddingBottom;
        legendX = paddingX + svgWidth + 16;
        legendY = chartY + Math.max(0, (svgHeight - legendHeight) / 2);
      } else {
        const legendHeight = 36;
        totalHeight = svgHeight + titleHeight + legendHeight + paddingTop + paddingBottom;
        legendX = paddingX;
        legendY = chartY + svgHeight + 14;
      }
    }

    // 5. Clone and prepare pure SVG for rendering
    const clonedSvg = svgEl.cloneNode(true);
    inlineCopyStyles(svgEl, clonedSvg);
    clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clonedSvg.setAttribute("width", String(svgWidth));
    clonedSvg.setAttribute("height", String(svgHeight));

    // Ensure CSS styles for SVG classes are embedded directly in SVG
    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.textContent = `
      .excel-axis-label, .excel-bar-label, .excel-month-label, .excel-zone-label, .excel-owner-label, .stacked-label {
        fill: #404040;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 10px;
        text-anchor: middle;
      }
      .excel-axis-label { text-anchor: start; }
      .excel-owner-label { font-size: 8px; }
      .stacked-label { fill: #ffffff; font-size: 9px; font-weight: 800; text-anchor: middle; }
      .zone-bar-open { fill: #4472c4; }
      .zone-bar-closed { fill: #00b0f0; }
      .zone-target-line { fill: none; stroke: #4472c4; stroke-dasharray: 8 7; stroke-linecap: round; stroke-width: 2; }
      .zone-target-dot { fill: #4472c4; }
      .admin-chart-bar { fill: #12a8e8; }
      .admin-chart-axis { stroke: #94a3b8; stroke-width: 1; }
      .admin-chart-grid-line { stroke: #e2e8f0; stroke-width: 1; }
      .admin-chart-target { stroke: #e11d48; stroke-width: 2; stroke-dasharray: 6 4; fill: none; }
      .admin-chart-value { fill: #1f2937; font-family: Arial, sans-serif; font-size: 11px; font-weight: 750; text-anchor: middle; }
      .admin-chart-y-label { fill: #64748b; font-family: Arial, sans-serif; font-size: 10px; text-anchor: end; }
      .admin-chart-x-label { fill: #1f2937; font-family: Arial, sans-serif; font-size: 10px; }
      .admin-chart-group line { stroke: #60a5fa; stroke-width: 1; }
      .admin-chart-group text { fill: #1f2937; font-family: Arial, sans-serif; font-size: 10px; font-weight: 750; text-anchor: middle; }
      text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    `;
    clonedSvg.insertBefore(styleEl, clonedSvg.firstChild);

    // Serialize pure SVG (NO foreignObject)
    const svgXml = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgXml], { type: "image/svg+xml;charset=utf-8" });
    const svgImage = await loadImageFromBlob(svgBlob);

    // 6. Draw everything to Canvas (High DPI scale 2x)
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(totalWidth * scale);
    canvas.height = Math.round(totalHeight * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Draw Title
    if (titleText) {
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const titleCenterX = isVerticalLegend ? paddingX + svgWidth / 2 : totalWidth / 2;
      ctx.fillText(titleText, titleCenterX, paddingTop + 8);
    }

    // Draw Chart SVG
    ctx.drawImage(svgImage, chartX, chartY, svgWidth, svgHeight);

    // Draw Legend
    if (legendItems.length > 0) {
      ctx.font = "600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textBaseline = "middle";
      if (isVerticalLegend) {
        legendItems.forEach((item, index) => {
          const itemY = legendY + index * 19;
          if (item.isTarget) {
            ctx.strokeStyle = item.color;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(legendX, itemY + 6);
            ctx.lineTo(legendX + 16, itemY + 6);
            ctx.stroke();
            ctx.setLineDash([]);
          } else {
            ctx.fillStyle = item.color;
            ctx.fillRect(legendX, itemY, 11, 11);
            ctx.strokeStyle = "rgba(0,0,0,0.18)";
            ctx.lineWidth = 1;
            ctx.strokeRect(legendX, itemY, 11, 11);
          }
          ctx.fillStyle = "#334155";
          ctx.textAlign = "left";
          ctx.fillText(item.text, legendX + 18, itemY + 6);
        });
      } else {
        // Horizontal legend: measure and align
        let curX = legendX + Math.max(0, (svgWidth - legendItems.length * 90) / 2);
        legendItems.forEach((item) => {
          if (item.isTarget) {
            ctx.strokeStyle = item.color;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(curX, legendY + 5);
            ctx.lineTo(curX + 14, legendY + 5);
            ctx.stroke();
            ctx.setLineDash([]);
          } else {
            ctx.fillStyle = item.color;
            ctx.fillRect(curX, legendY, 10, 10);
            ctx.strokeStyle = "rgba(0,0,0,0.18)";
            ctx.lineWidth = 1;
            ctx.strokeRect(curX, legendY, 10, 10);
          }
          ctx.fillStyle = "#334155";
          ctx.textAlign = "left";
          ctx.fillText(item.text, curX + 16, legendY + 5);
          curX += ctx.measureText(item.text).width + 24;
        });
      }
    }

    return canvasToPngBlob(canvas);
  }

  async function renderReportTargetToPng(target) {
    if (target.querySelector("svg")) {
      try {
        return await renderChartTargetToPng(target);
      } catch (svgError) {
        console.warn("Pure SVG canvas render failed, falling back to DOM wrapper:", svgError);
      }
    }

    const { width, height } = getImageCopySize(target);
    const clone = target.cloneNode(true);
    inlineCopyStyles(target, clone);
    replaceFormControlsForCopy(clone);
    clone.querySelectorAll("button,.copy-toolbar,[data-copy-hidden]").forEach((node) => node.remove());
    expandImageCopyClone(clone);
    clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    clone.style.boxSizing = "border-box";
    clone.style.width = width + "px";
    clone.style.maxWidth = "none";
    clone.style.overflow = "visible";
    clone.style.background = "#ffffff";

    const wrapper = document.createElement("div");
    wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    wrapper.style.boxSizing = "border-box";
    wrapper.style.width = width + "px";
    wrapper.style.minHeight = height + "px";
    wrapper.style.margin = "0";
    wrapper.style.padding = "0";
    wrapper.style.background = "#ffffff";
    wrapper.style.overflow = "visible";
    wrapper.appendChild(clone);

    const serialized = new XMLSerializer().serializeToString(wrapper);
    const svgText = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '"><foreignObject x="0" y="0" width="100%" height="100%">' + serialized + '</foreignObject></svg>';
    const image = await loadImageFromBlob(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));
    const scale = Math.max(0.5, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(30000000 / Math.max(1, width * height))));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvasToPngBlob(canvas);
  }

  function showReportImageFallback(blob, filename = "dashboard-chart.png") {
    const url = URL.createObjectURL(blob);
    openFormModal({
      title: "Ảnh dashboard/biểu đồ",
      submitText: "Đóng",
      submitClass: "secondary-button",
      modalClass: "report-image-modal",
      extraActions: '<a class="primary-button" href="' + escapeHtml(url) + '" download="' + escapeHtml(filename) + '">Tải ảnh</a>',
      html: '<div class="report-image-preview"><img src="' + escapeHtml(url) + '" alt="Ảnh dashboard hoặc biểu đồ"><p>Chuột phải vào ảnh để copy, hoặc bấm Tải ảnh rồi chèn vào Word/PowerPoint.</p></div>',
      onSubmit() {
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
      },
    });
  }

  async function copyReportImageToClipboard(target) {
    const blob = await renderReportTargetToPng(target);
    if (!navigator.clipboard?.write || !window.ClipboardItem || !window.isSecureContext) {
      const error = new Error("Image clipboard API is not available");
      error.imageBlob = blob;
      throw error;
    }
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return blob;
  }

  async function copyReportTarget(targetId) {
    const target = document.getElementById(String(targetId || ""));
    if (!target) {
      showToast("Không tìm thấy bảng hoặc biểu đồ để copy.", true);
      return;
    }

    const copyAsImage = shouldCopyReportAsImage(target);
    if (copyAsImage) {
      let blob = null;
      try {
        blob = await renderReportTargetToPng(target);
      } catch (renderError) {
        console.error("Lỗi render ảnh biểu đồ:", renderError);
        showToast("Không thể tạo ảnh biểu đồ để copy.", true);
        return;
      }

      try {
        if (!navigator.clipboard?.write || !window.ClipboardItem || !window.isSecureContext) {
          throw new Error("Clipboard API không khả dụng trong ngữ cảnh này");
        }
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        showToast("Đã copy biểu đồ dưới dạng ảnh.");
      } catch (clipboardError) {
        console.warn("Clipboard write failed, showing fallback modal:", clipboardError);
        showReportImageFallback(blob);
        showToast("Trình duyệt chặn copy ảnh trực tiếp, app đã mở ảnh để tải hoặc copy thủ công.");
      }
      return;
    }

    const clone = target.cloneNode(true);
    inlineCopyStyles(target, clone);
    replaceFormControlsForCopy(clone);
    clone.querySelectorAll("button,.copy-toolbar,[data-copy-hidden]").forEach((node) => node.remove());
    const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + clone.outerHTML + '</body></html>';
    const text = tableTextForCopy(target);

    try {
      if (navigator.clipboard?.write && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        })]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (!fallbackSelectCopy(target)) {
        throw new Error("Clipboard API is not available");
      }

      showToast("Đã copy bảng.");
    } catch (error) {
      console.error(error);
      if (fallbackSelectCopy(target)) {
        showToast("Đã copy bảng.");
      } else {
        showToast("Trình duyệt đang chặn quyền copy clipboard.", true);
      }
    }
  }

  function showProblemZoneEmails() {
    if (!requireAdminAction("Chỉ admin được xem/gửi danh sách email trưởng phòng.")) {
      return;
    }

    closeAccountMenu();
    openSendSafetyMailModal(getActivePeriodId(SAFETY_PERIOD_TYPE), { areaId: "" });
  }

  function editFiveSChartTarget(targetKey = "zone") {
    if (!requireAdminAction("Chỉ admin được sửa target biểu đồ 5S.")) {
      return;
    }

    const key = targetKey === "item" ? "item" : "zone";
    const label = key === "item" ? "biểu đồ hạng mục 5S" : "biểu đồ zone 5S";
    const currentValue = getFiveSChartTarget(key);
    openFormModal({
      title: "Sửa target " + label,
      submitText: "Lưu target",
      html: `
        <label>
          <span>Target</span>
          <input name="target" type="number" min="0" max="5" step="0.1" value="${escapeHtml(currentValue)}" required>
        </label>
      `,
      async onSubmit(formData) {
        return updateFiveSChartTarget(key, formData.get("target"));
      },
    });
  }

  function handleAction(action, id, sourceElement = null) {
    const periodId = sourceElement?.dataset.periodId || "";
    const periodType = sourceElement?.dataset.periodType || "";
    const adminActions = new Set([
      "import-page-json",
      "export-page-json",
      "set-catalog-scope",
      "set-account-scope",
      "set-history-scope",
      "delete-period",
      "edit-five-s-period-date",
      "edit-safety-period-date",
      "edit-scorer",
      "delete-scorer",
      "edit-assessor",
      "delete-assessor",
      "edit-area",
      "edit-department-head",
      "edit-safety-risk-owner",
      "edit-summary-group",
      "edit-area-responsible",
      "edit-area-assessor",
      "show-problem-zone-emails",
      "edit-five-s-chart-target",
      "send-safety-report-mail",
      "copy-safety-report-summary",
      "show-edit-history",
      "edit-department-head-email",
      "clear-department-head-email",
      "delete-area",
      "edit-account",
      "add-account-access",
      "remove-account-access",
      "delete-viewer-account",
      "delete-department-head-account",
      "delete-account",
    ]);
    const safetyActions = new Set(["add-safety-record", "edit-safety-record", "delete-safety-record"]);
    if (adminActions.has(action) && !requireAdminAction()) {
      return;
    }
    if (safetyActions.has(action) && !canUseSafety(currentUser)) {
      showToast("Bạn không có quyền thao tác đánh giá an toàn.", true);
      return;
    }

    const handlers = {
      "go-home": () => goHome(),
      "fullscreen-table": () => openFullscreenTable(id),
      "activate-period": () => activatePeriod(id, periodType),
      "import-page-json": () => confirmImportPageJson(sourceElement),
      "export-page-json": () => confirmExportPageJson(sourceElement),
      "export-summary-period": () => confirmExportExcel(id),
      "export-safety-period": () => confirmExportSafetyExcel(id, { areaId: "" }),
      "send-safety-report-mail": () => sendSafetyReportMail(periodId || getActivePeriodId(SAFETY_PERIOD_TYPE), { areaId: sourceElement?.dataset.areaId || "" }).catch((error) => {
        console.error(error);
        showToast(error.message || "Lỗi khi gửi báo cáo.", true);
      }),
      "copy-safety-report-summary": () => {
        const text = document.getElementById("safety-report-summary-text")?.value || "";
        copyTextToClipboard(text, "Đã copy nội dung báo cáo.");
      },
      "set-catalog-scope": () => setCatalogScope(id),
      "set-account-scope": () => setAccountScope(id),
      "set-history-scope": () => setHistoryScope(id),
      "set-safety-department-filter": () => {
        if (elements.safetyDepartmentFilter) {
          elements.safetyDepartmentFilter.value = id || "";
        }
        renderActiveTab();
      },
      "set-safety-detail-page": () => {
        window.SafetyPage?.setDetailPage(sourceElement?.dataset.pageType || "assessment", sourceElement?.dataset.page || "1");
        renderActiveTab();
      },
      "add-safety-record": () => addSafetyRecord(),
      "delete-safety-record": () => deleteSafetyRecord(id),
      "delete-period": () => deletePeriod(id),
      "edit-five-s-period-date": () => editFiveSPeriodDate(id),
      "edit-safety-period-date": () => editSafetyPeriodDate(id),
      "edit-scorer": () => editScorer(id),
      "delete-scorer": () => deleteScorer(id),
      "edit-assessor": () => editAssessor(id),
      "delete-assessor": () => deleteAssessor(id),
      "edit-area": () => editArea(id, periodId),
      "edit-department-head": () => editDepartmentHeadGroup(id || "", periodId, sourceElement?.dataset.areaIds || ""),
      "edit-safety-risk-owner": () => editSafetyRiskOwnerGroup(sourceElement?.dataset.areaIds || "", periodId, id || ""),
      "edit-summary-group": () => editSummaryGroup(id || "", periodId, sourceElement?.dataset.areaIds || "", sourceElement?.dataset.deptHead || ""),
      "edit-area-responsible": () => editAreaResponsible(id, periodId),
      "edit-area-assessor": () => editAreaAssessor(id, periodId),
      "show-problem-zone-emails": () => showProblemZoneEmails(),
      "edit-five-s-chart-target": () => editFiveSChartTarget(id),
      "copy-report-target": () => copyReportTarget(sourceElement?.dataset.copyTarget || id).catch((error) => {
        console.error(error);
        showToast("Lỗi khi copy bảng/biểu đồ.", true);
      }),
      "show-edit-history": () => openEditHistoryModal(),
      "edit-department-head-email": () => editDepartmentHeadEmail(id),
      "clear-department-head-email": () => clearDepartmentHeadEmail(id),
      "delete-area": () => deleteArea(id),
      "edit-account": () => editAccount(id),
      "add-account-access": () => addAccountAccess(id, sourceElement?.dataset.accountScope || ""),
      "remove-account-access": () => removeAccountAccess(id, sourceElement?.dataset.accountScope || activeAccountScope),
      "delete-viewer-account": () => deleteViewerAccount(id),
      "delete-department-head-account": () => deleteDepartmentHeadAccount(id),
      "delete-account": () => deleteAccount(id),
      "edit-safety-record": () => editSafetyRecord(id),
      "modal-cancel": () => closeModal(),
    };

    handlers[action]?.();
  }
  function isDragScrollIgnoredTarget(target) {
    const scoreControl = target?.closest?.(".assessor-score-select,[data-edit-score],[data-inline-score-input]");
    if (scoreControl?.closest?.(".assessor-4m-wrap,.summary-matrix-wrap")) {
      return false;
    }
    return Boolean(target?.closest?.("button,input,select,textarea,a,label,[contenteditable='true'],[contenteditable='plaintext-only']"));
  }

  function bindEvents() {
    elements.loginForm.addEventListener("submit", handleLogin);
    window.addEventListener("local-data-auth-revoked", (event) => {
      handleSessionRevoked(event?.detail?.message || "");
    });

    // CapsLock indicator for login password
    const capsWarning = document.getElementById("login-caps-warning");
    if (capsWarning && elements.loginPassword) {
      const checkCaps = (e) => {
        if (e.getModifierState) {
          capsWarning.hidden = !e.getModifierState("CapsLock");
        }
      };
      elements.loginPassword.addEventListener("keydown", checkCaps);
      elements.loginPassword.addEventListener("keyup", checkCaps);
      elements.loginPassword.addEventListener("blur", () => {
        capsWarning.hidden = true;
      });
    }

    // Setup Drag-to-scroll and wheel scroll for header quick nav
    const headerQuickNav = document.getElementById("headerQuickNav") || document.querySelector(".header-quick-nav");
    if (headerQuickNav && window.setupNavDragScroll) {
      window.setupNavDragScroll(headerQuickNav);
    }

    // Track actual header height for CSS variable (used by tab-panel min-height)
    const appHeader = document.querySelector(".app-header");
    if (appHeader) {
      const updateHeaderHeight = () => {
        document.documentElement.style.setProperty(
          "--app-header-height",
          appHeader.getBoundingClientRect().height + "px"
        );
      };
      updateHeaderHeight();
      const headerResizeObserver = new ResizeObserver(updateHeaderHeight);
      headerResizeObserver.observe(appHeader);
    }

    elements.logoutButton.addEventListener("click", handleLogout);
    elements.undoButton?.addEventListener("click", () => executeUndo());
    elements.redoButton?.addEventListener("click", () => executeRedo());
    elements.accountMenuButton?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleAccountMenu();
    });

    document.querySelectorAll(".tab-button").forEach((button) => {
      button.addEventListener("click", () => {
        const tab = button.dataset.tab;
        if (tab === "catalog") {
          expandedCatalogScope = "";
        } else if (tab === "accounts") {
          expandedAccountScope = "";
        }
        const options = {};
        if (button.dataset.safetyReport) {
          options.safetyReport = button.dataset.safetyReport;
        } else if (tab === "safety") {
          options.safetyReport = "assessment";
        }
        setActiveTab(tab, options);
      });
    });

    window.addEventListener("popstate", syncRouteFromLocation);
    window.addEventListener("hashchange", syncRouteFromLocation);
    window.addEventListener("local-data-sync-status", handleLocalDataSyncStatus);
    dataStore?.getOfflineQueueCount?.()
      .then((pending) => handleLocalDataSyncStatus({ detail: { pending, syncing: false, online: navigator.onLine } }))
      .catch((error) => console.warn("Không đọc được trạng thái dữ liệu offline:", error));
    document.addEventListener("dblclick", (event) => {
      const image = event.target?.closest?.("img");
      if (!image || image.closest(".brand-line,.cyber-brand,.safety-logo-cell")) {
        return;
      }
      const src = image.currentSrc || image.src || image.dataset.photoSrc || "";
      if (!src) {
        return;
      }
      event.preventDefault();
      openImageFullscreenModal(image);
    });

    const bindPeriodSelect = (select, type) => {
      if (!select) return;
      select.addEventListener("change", () => activatePeriod(select.value, type));
    };
    bindPeriodSelect(elements.assessorPeriodSelect, FIVE_S_PERIOD_TYPE);
    bindPeriodSelect(elements.summaryPeriodSelect, FIVE_S_PERIOD_TYPE);
    bindPeriodSelect(elements.safetyPeriodSelect, SAFETY_PERIOD_TYPE);
    bindPeriodSelect(elements.issueStatsPeriodSelect, SAFETY_PERIOD_TYPE);

    elements.assessorAreaSelect?.addEventListener("change", renderAssessorTab);
    elements.summaryScoreSource?.addEventListener("change", renderActiveTab);
    [elements.safetyAreaFilter, elements.safetyYearFilter, elements.safetyMonthFilter, elements.safetyDepartmentFilter].forEach((select) => {
      select?.addEventListener("change", renderActiveTab);
    });
    elements.addSafetyRecordButton?.addEventListener("click", addSafetyRecord);
    elements.exportExcelButton?.addEventListener("click", () => confirmExportExcel(getActivePeriodId(FIVE_S_PERIOD_TYPE)));
    elements.editSafetyMetaButton?.addEventListener("click", editSafetyMeta);
    elements.exportSafetyExcelButton?.addEventListener("click", confirmExportActiveSafetyReportExcel);
    elements.sendSafetyMailButton?.addEventListener("click", () => openSendSafetyMailModal(getActivePeriodId(SAFETY_PERIOD_TYPE)));

    elements.periodSafetyDateCalendar?.addEventListener("change", () => {
      elements.periodSafetyDate.value = formatDateDisplay(elements.periodSafetyDateCalendar.value);
    });
    elements.periodSafetyDate?.addEventListener("input", () => {
      elements.periodSafetyDateCalendar.value = parseDisplayDateToIso(elements.periodSafetyDate.value);
    });
    elements.period5SForm?.addEventListener("submit", (event) => handlePeriodSubmit(event, FIVE_S_PERIOD_TYPE));
    elements.periodSafetyForm?.addEventListener("submit", (event) => handlePeriodSubmit(event, SAFETY_PERIOD_TYPE));
    elements.scorerForm.addEventListener("submit", handleScorerSubmit);
    elements.departmentHeadEmailForm?.addEventListener("submit", handleDepartmentHeadEmailSubmit);
    elements.departmentHeadEmailName?.addEventListener("change", () => fillDepartmentHeadEmailForm(elements.departmentHeadEmailName.value));
    elements.safetyDepartmentGroupsForm?.addEventListener("submit", handleSafetyDepartmentGroupsSubmit);
    elements.catalogAssessorForm?.addEventListener("submit", handleAssessorSubmit);
    elements.areaForm.addEventListener("submit", handleAreaSubmit);
    elements.accountRole?.addEventListener("change", () => {
      syncAccountRoleFields();
      syncAccountAssignedZones();
    });
    elements.accountAssessor?.addEventListener("change", () => syncAccountAssignedZones());
    elements.accountManager?.addEventListener("change", () => syncAccountAssignedZones());
    elements.accountForm.addEventListener("submit", handleAccountSubmit);
    elements.viewerAccountForm?.addEventListener("submit", handleViewerAccountSubmit);
    elements.departmentHeadAccountSource?.addEventListener("change", populateDepartmentHeadAccountSelect);
    elements.departmentHeadAccountForm?.addEventListener("submit", handleDepartmentHeadAccountSubmit);

    elements.modalCloseButton.addEventListener("click", closeModal);
    elements.modalBackdrop.addEventListener("click", (event) => {
      if (event.target === elements.modalBackdrop) {
        closeModal();
      }
    });

    // Universal 2D Drag-to-Scroll Engine
    // - Detects any scrollable container (tables, charts, modals)
    // - Scrolls in both X and Y directions freely (2D pan)
    // - Click 1 time = select/action; Click-hold and drag = pan scroll
    // - setPointerCapture only called AFTER drag threshold → clicks always work normally

    const DRAG_THRESHOLD = 4; // px distance before treating as a drag
    const SCROLLABLE_SELECTORS = [
      "[data-drag-scroll]",
      ".table-wrap",
      ".wide-table-wrap",
      ".dashboard-table-wrap",
      ".history-table-wrap",
      ".admin-card-chart-scroll",
      ".excel-chart-scroll",
      ".excel-wide-wrap",
      ".factory-summary-wrap",
      ".progress-summary-wrap",
      ".rank-summary-wrap",
      ".stop6-summary-wrap",
      ".department-zone-summary-wrap",
      ".annual-department-table-wrap",
      ".modal-body",
      ".safety-record-entry-wrap",
      ".safety-assessment-month-chart",
    ].join(",");
    // Note: .cyber-nav-links and .header-quick-nav are handled by setupNavDragScroll separately

    const canScrollX = (el) => Boolean(el && el.scrollWidth > el.clientWidth + 1);
    const canScrollY = (el) => Boolean(el && el.scrollHeight > el.clientHeight + 1);
    const getOpenModalBackdrop = () => (
      elements.modalBackdrop && !elements.modalBackdrop.hidden ? elements.modalBackdrop : null
    );
    const getOpenModalBoundary = (fromElement) => {
      const backdrop = getOpenModalBackdrop();
      if (!backdrop || !fromElement?.closest) return null;
      return fromElement.closest("#modal-backdrop") === backdrop ? backdrop : null;
    };
    const getScrollLeft = (el) => (el ? el.scrollLeft : 0);
    const getScrollTop = (el) => (el === document.scrollingElement ? window.scrollY : el?.scrollTop || 0);
    const setScrollLeft = (el, value) => {
      if (el) el.scrollLeft = value;
    };
    const setScrollTop = (el, value) => {
      if (!el) return;
      if (el === document.scrollingElement) {
        window.scrollTo(window.scrollX, value);
      } else {
        el.scrollTop = value;
      }
    };

    function findVerticalScroller(fromElement) {
      const modalBoundary = getOpenModalBoundary(fromElement);
      let el = fromElement;
      while (el && el !== document.body) {
        if (canScrollY(el)) return el;
        if (modalBoundary && el === modalBoundary) return null;
        el = el.parentElement;
      }

      if (modalBoundary) return null;
      const root = document.scrollingElement || document.documentElement;
      return canScrollY(root) ? root : null;
    }

    function findScrollableContainer(target) {
      let el = target;
      while (el && el !== document.body) {
        if (el.matches?.(SCROLLABLE_SELECTORS)) {
          if (canScrollX(el) || canScrollY(el)) return el;
        }
        el = el.parentElement;
      }
      return null;
    }

    let universalDragState = null;
    let suppressClickUntil = 0;

    const endUniversalDrag = () => {
      if (!universalDragState) return;

      const { scroller, yScroller, moved } = universalDragState;
      scroller.classList.remove("is-drag-scrolling");
      if (yScroller && yScroller !== scroller && yScroller !== document.scrollingElement) {
        yScroller.classList.remove("is-drag-scrolling");
      }
      document.body.classList.remove("is-drag-scrolling-active");
      scroller.style.scrollBehavior = "";

      universalDragState = null;

      if (moved) {
        suppressClickUntil = Date.now() + 150;
      }
    };

    document.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || isDragScrollIgnoredTarget(event.target)) return;
      const openModalBackdrop = getOpenModalBackdrop();
      if (openModalBackdrop && event.target?.closest?.("#modal-backdrop") !== openModalBackdrop) return;

      const scroller = findScrollableContainer(event.target);
      if (!scroller) return;
      const xScroller = canScrollX(scroller) ? scroller : null;
      const yScroller = canScrollY(scroller) ? scroller : findVerticalScroller(scroller);

      if (!xScroller && !yScroller) return;

      // Record initial position but do NOT setPointerCapture yet
      // Capture is only set once the drag threshold is confirmed in pointermove
      // This ensures simple clicks are never intercepted
      universalDragState = {
        scroller,
        xScroller,
        yScroller,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: getScrollLeft(xScroller),
        scrollTop: getScrollTop(yScroller),
        moved: false,
        captured: false,
      };
    });

    document.addEventListener("pointermove", (event) => {
      if (!universalDragState) return;

      const dx = event.clientX - universalDragState.startX;
      const dy = event.clientY - universalDragState.startY;

      if (!universalDragState.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

      // Threshold crossed — this is a real drag. Now capture pointer and start panning.
      if (!universalDragState.captured) {
        universalDragState.captured = true;
        try { universalDragState.scroller.setPointerCapture(universalDragState.pointerId); } catch (_) {}
        universalDragState.scroller.style.scrollBehavior = "auto";
      }

      universalDragState.moved = true;
      universalDragState.scroller.classList.add("is-drag-scrolling");
      if (universalDragState.yScroller && universalDragState.yScroller !== universalDragState.scroller && universalDragState.yScroller !== document.scrollingElement) {
        universalDragState.yScroller.classList.add("is-drag-scrolling");
      }
      document.body.classList.add("is-drag-scrolling-active");

      setScrollLeft(universalDragState.xScroller, universalDragState.scrollLeft - dx);
      setScrollTop(universalDragState.yScroller, universalDragState.scrollTop - dy);

      event.preventDefault();
    }, { passive: false });

    document.addEventListener("pointerup", endUniversalDrag);
    document.addEventListener("pointercancel", endUniversalDrag);

    document.addEventListener("keydown", handleInlineScoreKeydown, { capture: true });
    document.addEventListener("beforeinput", handleInlineScoreBeforeInput, { capture: true });
    document.addEventListener("paste", handleInlineScorePaste);
    document.addEventListener("dragstart", handleInlineScoreDragDrop, { capture: true });
    document.addEventListener("dragover", handleInlineScoreDragDrop, { capture: true });
    document.addEventListener("drop", handleInlineScoreDragDrop, { capture: true });
    document.addEventListener("input", (event) => {
      const assessorScoreSelect = event.target?.closest?.("[data-assessor-score-select]");
      if (assessorScoreSelect) {
        handleAssessorScoreSelectChange(assessorScoreSelect);
        return;
      }

      const input = event.target?.closest?.("[data-inline-score-input]");
      if (!input) {
        return;
      }
      const rawScore = cleanInlineScoreInputValue(input);
      commitInlineScoreInput(input, rawScore);
    });
    document.addEventListener("focusin", (event) => {
      const input = event.target?.closest?.("[data-inline-score-input]");
      if (!input) {
        return;
      }
      rememberActiveInlineScoreInput(input);
      input.setSelectionRange?.(0, input.value.length);
    });
    document.addEventListener("pointerdown", (event) => {
      if (!event.target?.closest?.("[data-inline-score-input]")) {
        activeInlineScoreCell = null;
      }
    });

    // Global click suppressor: prevents accidental clicks after drag ends
    document.addEventListener("click", (event) => {
      if (Date.now() < suppressClickUntil) {
        event.stopPropagation();
        event.preventDefault();
      }
    }, { capture: true });


    document.addEventListener("keydown", (event) => {
      const tabTarget = event.target.closest?.("[data-go-tab][role='button']");
      if (tabTarget && ["Enter", " "].includes(event.key)) {
        event.preventDefault();
        goToTab(tabTarget.dataset.goTab);
        return;
      }

      if (event.key === "Escape" && !elements.modalBackdrop.hidden) {
        closeModal();
      } else if (event.key === "Escape") {
        closeAccountMenu();
      }

      const isCtrlOrMeta = event.ctrlKey || event.metaKey;
      const key = (event.key || "").toLowerCase();
      const code = event.code || "";

      const isUndo = isCtrlOrMeta && !event.shiftKey && (key === "z" || code === "KeyZ");
      const isRedo = isCtrlOrMeta && (
        (!event.shiftKey && (key === "y" || code === "KeyY")) ||
        (event.shiftKey && (key === "z" || code === "KeyZ"))
      );

      if (isUndo || isRedo) {
        const target = event.target;
        const isTextInput = Boolean(
          target &&
          (
            target.tagName === "TEXTAREA" ||
            (target.tagName === "INPUT" && !["button", "submit", "checkbox", "radio", "file"].includes((target.type || "").toLowerCase())) ||
            target.isContentEditable
          )
        );

        const isModalOpen = Boolean(elements.modalBackdrop && !elements.modalBackdrop.hidden);

        if (!isTextInput && !isModalOpen) {
          event.preventDefault();
          if (isUndo) {
            executeUndo();
          } else {
            executeRedo();
          }
          return;
        }
      }
    });

    document.addEventListener("click", (event) => {
      const clickedUserBox = event.target.closest("#user-box");
      const clickedCyberUserBox = event.target.closest("#cyberUserBox");
      if (!clickedUserBox && elements.accountMenu) {
        elements.accountMenu.hidden = true;
        elements.accountMenuButton?.setAttribute("aria-expanded", "false");
      }
      if (!clickedCyberUserBox) {
        document.querySelectorAll(".cyber-account-dropdown").forEach((el) => {
          el.hidden = true;
          const btn = el.parentElement?.querySelector("[aria-expanded]");
          btn?.setAttribute("aria-expanded", "false");
        });
      }

      const tabTarget = event.target.closest("[data-go-tab]");
      if (tabTarget) {
        goToTab(tabTarget.dataset.goTab);
        return;
      }

      const safetyReportTarget = event.target.closest("[data-go-safety-report]");
      if (safetyReportTarget) {
        event.preventDefault();
        goToSafetyReport(safetyReportTarget.dataset.goSafetyReport || "");
        return;
      }

      const editButton = event.target.closest("[data-edit-score]");
      if (editButton) {
        openScoreModal(editButton);
        return;
      }

      const actionButton = event.target.closest("[data-action]");
      if (actionButton) {
        handleAction(actionButton.dataset.action, actionButton.dataset.id, actionButton);
      }
    });

    document.addEventListener("change", (event) => {
      const selectAll = event.target?.closest?.("input[data-select-all]");
      if (selectAll) {
        const targetName = selectAll.getAttribute("data-select-all");
        const container = selectAll.closest(".zone-check-list, form, .modal-body, .form-field");
        if (container) {
          const isChecked = selectAll.checked;
          const checkboxes = container.querySelectorAll(`input[name="${targetName}"]`);
          checkboxes.forEach((cb) => {
            cb.checked = isChecked;
          });
          refreshSelectAllStates(container);
        }
        return;
      }

      const itemCheckbox = event.target?.closest?.('input[name="areaIds"], input[name="assessorIds"]');
      if (itemCheckbox) {
        const container = itemCheckbox.closest(".zone-check-list, form, .modal-body, .form-field");
        if (container) {
          refreshSelectAllStates(container);
        }
      }

      const assessorScoreSelect = event.target?.closest?.("[data-assessor-score-select]");
      if (assessorScoreSelect) {
        handleAssessorScoreSelectChange(assessorScoreSelect);
        return;
      }

      const targetInput = event.target?.closest?.("[data-safety-target-input]");
      if (targetInput) {
        updateSafetyZoneTarget(targetInput.dataset.periodId || "", targetInput.dataset.areaId || "", targetInput.value).catch((error) => {
          console.error(error);
          showToast("Lỗi khi cập nhật mục tiêu/tháng.", true);
          renderActiveTab();
        });
        return;
      }

      const progressTargetInput = event.target?.closest?.("[data-progress-target-input]");
      if (progressTargetInput) {
        const year = progressTargetInput.dataset.year || "";
        const month = progressTargetInput.dataset.month || "";
        updateSafetyMonthlyTarget(year, month, progressTargetInput.value).catch((error) => {
          console.error(error);
          showToast("Lỗi khi cập nhật mục tiêu.", true);
          renderActiveTab();
        });
        return;
      }
    });
  }
  // ─── App initialisation ───────────────────────────────────────────────────────

  const elements_loading = document.getElementById("loading-screen");
  let pendingDataWatchRaf = null;

  function startDataWatch() {
    if (dataUnsubscribe) {
      return;
    }

    dataUnsubscribe = dbRef().on("value", (snapshot) => {
      const raw = snapshot.val();
      if (!raw) {
        return;
      }

      const userId = currentUser?.id || "";
      state = normalizeState(raw);
      invalidateScoreRecordIndex();
      if (!currentUser) {
        return;
      }

      const updatedAccount = state.accounts.find((account) => account.id === userId);
      if (!updatedAccount) {
        clearSession();
        showLoginScreen();
        return;
      }

      currentUser = updatedAccount;
      if (hasOtherActiveSession(currentUser, currentSessionId)) {
        handleSessionRevoked();
        return;
      }
      if (suppressNextDataWatchRender > 0) {
        suppressNextDataWatchRender -= 1;
        return;
      }
      if (pendingDataWatchRaf) {
        cancelAnimationFrame(pendingDataWatchRaf);
      }
      const scrollState = captureScoreScrollState();
      pendingDataWatchRaf = requestAnimationFrame(() => {
        pendingDataWatchRaf = null;
        renderAll({ updateRoute: false, preserveScroll: true });
        restoreScoreScrollState(scrollState);
        requestAnimationFrame(() => {
          restoreScoreScrollState(scrollState);
        });
      });
    });
  }

  function stopDataWatch() {
    if (!dataUnsubscribe) {
      return;
    }

    dataUnsubscribe();
    dataUnsubscribe = null;
  }

  async function init() {
    bindEvents();

    try {
      if (elements_loading) elements_loading.hidden = true;
      const restored = await restoreSessionUser();
      if (restored) {
        startDataWatch();
      }
      syncRouteFromLocation();
    } catch (error) {
      console.error("Local data init error:", error);
      if (elements_loading) {
        elements_loading.querySelector("p").textContent =
          "Không kết nối được dữ liệu nội bộ. Hãy chạy npm start rồi mở địa chỉ localhost được hiển thị.";
        elements_loading.querySelector(".loading-spinner").style.display = "none";
      }
    }
  }

  init();
})();
