(() => {
  "use strict";

  const views = new WeakMap();
  const ROWS_PER_PAGE = 10;
  const FINDING_CATEGORIES = [
    ["A1", "A1 - Đường đi bộ"],
    ["A2", "A2 - Cây nước"],
    ["A3", "A3 - Khu vực rửa tay, nhà vệ sinh"],
    ["B1", "B1 - Khu để dầu, hóa chất, sơn (các loại dd hóa chất)"],
    ["B2", "B2 - Hàng lưu kho, hàng lỗi"],
    ["B3", "B3 - Nơi để vật tư, vật liệu, găng tay, giẻ lau"],
    ["C1", "C1 - Nơi làm việc"],
    ["C2", "C2 - Thiết bị máy móc sản xuất"],
    ["C3", "C3 - Bàn thao tác"],
    ["C4", "C4 - Nơi để đồ gá, Jig, tủ dụng cụ"],
    ["C5", "C5 - Bảng quản lý trong dây chuyền"],
    ["D1", "D1 - Khu vực nghỉ"],
    ["D2", "D2 - Bàn quản lý (GL)"],
    ["D3", "D3 - Khu để tư liệu, tài liệu"],
    ["E1", "E1 - Tự giác của tổ viên"],
    ["E2", "E2 - Tự giác của người giám sát"],
  ];
  function findingCategoryNormalized(val) {
    if (!val) return "";
    const clean = String(val).trim().toUpperCase();
    const match = FINDING_CATEGORIES.find(([id, label]) => id.toUpperCase() === clean || clean.startsWith(id.toUpperCase() + " ") || clean.startsWith(id.toUpperCase() + "-") || label.toUpperCase() === clean);
    return match ? match[0] : "";
  }
  function findingCategoryLabel(val) {
    if (!val) return "";
    const clean = String(val).trim();
    const match = FINDING_CATEGORIES.find(([id, label]) => id.toUpperCase() === clean.toUpperCase() || clean.toUpperCase().startsWith(id.toUpperCase() + " ") || clean.toUpperCase().startsWith(id.toUpperCase() + "-") || label.toLowerCase() === clean.toLowerCase());
    return match ? match[1] : clean;
  }
  function parseInspectors(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.map((s) => String(s || "").trim().slice(0, 20)).filter(Boolean).slice(0, 2);
    return String(val)
      .split(/,|\n|·|\/|;/)
      .map((s) => s.trim().slice(0, 20))
      .filter(Boolean)
      .slice(0, 2);
  }
  function formatInspectors(n1, n2) {
    const p1 = String(n1 || "").trim().slice(0, 20);
    const p2 = String(n2 || "").trim().slice(0, 20);
    return [p1, p2].filter(Boolean).slice(0, 2).join(", ");
  }
  const fields = ["location", "problem", "fiveS", "shift", "countermeasure", "dueDate", "progress"];
  const headings = ["Vị trí", "Vấn đề / Problem", "Hạng mục", "Ca / Shift", "Biện pháp khắc phục / CM", "Hạn / Due date", "Tiến độ / Progress"];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const canEdit = (ctx) => Boolean(ctx.currentUser && (ctx.isAdminAccount(ctx.currentUser) || ctx.isDepartmentHeadAccount(ctx.currentUser) || (ctx.hasAccountAccessType(ctx.currentUser, ctx.FIVE_S_PERIOD_TYPE) && (ctx.isZoneOwnerAccount(ctx.currentUser, ctx.FIVE_S_PERIOD_TYPE) || ctx.isFiveSAssessor(ctx.currentUser)))));
  const canEditPeriod = (ctx, periodId) => canEdit(ctx) && Boolean(periodId && ctx.getPeriod(periodId) && !ctx.getPeriod(periodId).archived && (typeof ctx.isPeriodOpen === "function" ? ctx.isPeriodOpen(periodId, ctx.FIVE_S_PERIOD_TYPE) : ctx.getActivePeriodId(ctx.FIVE_S_PERIOD_TYPE) === periodId));
  const sortedAreas = (ctx, periodId) => [...ctx.getAreasForPeriod(periodId)].sort((a, b) => String(a.code).localeCompare(String(b.code), "vi", { numeric: true }));
  const editableAreas = (ctx, periodId) => sortedAreas(ctx, periodId).filter((area) => canEditPeriod(ctx, periodId) && (ctx.isAdminAccount(ctx.currentUser) || ctx.getAllowedAreaIds(ctx.currentUser, periodId).has(area.id)));
  const canEditSheet = (ctx, sheet) => {
    if (!canEdit(ctx) || !sheet) return false;
    const periodId = resolvePeriodId(sheet, ctx.getPeriodsByType(ctx.FIVE_S_PERIOD_TYPE));
    if (!canEditPeriod(ctx, periodId)) return false;
    const areas = editableAreas(ctx, periodId);
    return ctx.isAdminAccount(ctx.currentUser) || Boolean(resolveAreaId(sheet, areas));
  };
  const blankRow = () => Object.fromEntries(fields.map((key) => [key, key === "progress" ? "0" : ""]));
  const UNASSIGNED = "unassigned";
  const displayDate = (value) => String(value || "").replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1");
  function resolvePeriodId(sheet, periods) {
    if (sheet.periodId) return sheet.periodId;
    const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(sheet.inspectionDate || "");
    return match ? periods.find((period) => Number(period.year) === Number(match[1]) && Number(period.month) === Number(match[2]))?.id || "" : "";
  }
  const sheets = (ctx) => [...(ctx.state.fiveSFindings || [])].sort((a, b) => String(b.inspectionDate).localeCompare(String(a.inspectionDate)) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const zoneLabel = (area) => `Zone ${area.code}`;
  const shortZoneLabel = (value) => String(value || "").split("·")[0].trim();
  const rowHasContent = (row) => fields.some((key) => key === "progress" ? Number(row[key]) > 0 : Boolean(row[key]));
  function defaultRows(rows = []) {
    const result = [...rows];
    while (result.length > ROWS_PER_PAGE && !rowHasContent(result[result.length - 1])) result.pop();
    while (result.length < ROWS_PER_PAGE) result.push(blankRow());
    return result;
  }
  function resolveAreaId(sheet, areas) {
    if (sheet.areaId) return areas.some((area) => area.id === sheet.areaId) ? sheet.areaId : "";
    const code = String(sheet.area || "").replace(/^zone\s*/i, "").split("·")[0].trim();
    return areas.find((area) => String(area.code).trim() === code)?.id || "";
  }

  function findMatchingSheet(ctx, periodId, areaId, inspector, inspectionDate) {
    const periods = ctx.getPeriodsByType(ctx.FIVE_S_PERIOD_TYPE);
    const areas = ctx.getAreasForPeriod(periodId);
    return sheets(ctx).find((record) => resolvePeriodId(record, periods) === periodId
      && resolveAreaId(record, areas) === areaId && record.inspector === inspector && record.inspectionDate === inspectionDate);
  }

  function zoneInput(sheet, ctx, editing, esc) {
    const areas = editing ? editableAreas(ctx, sheet.periodId || "") : sortedAreas(ctx, sheet.periodId || "");
    const selectedId = resolveAreaId(sheet, areas);
    if (!editing) return `<input name="areaId" type="text" value="${esc(areas.find((area) => area.id === selectedId) ? zoneLabel(areas.find((area) => area.id === selectedId)) : shortZoneLabel(sheet.area))}" disabled>`;
    return `<select name="areaId" required aria-label="Khu vực (Zone)"><option value="">${esc(sheet.area && !selectedId ? `Khu vực cũ: ${sheet.area} — chọn Zone` : "Chọn Zone 5S")}</option>${areas.map((area) => `<option value="${esc(area.id)}" ${area.id === selectedId ? "selected" : ""}>${esc(zoneLabel(area))}</option>`).join("")}</select>${areas.length ? "" : '<small class="findings-hint">Không có Zone được phép đánh giá trong kỳ này.</small>'}`;
  }

  function fresh(ctx, periodId, mobile = false) {
    return {
      periodId,
      id: ctx.makeId("finding"), areaId: "", area: "", inspector: ctx.currentUser?.name || ctx.currentUser?.username || "",
      inspectionDate: ctx.todayIsoDate(), rows: Array.from({ length: mobile ? 1 : ROWS_PER_PAGE }, blankRow),
    };
  }

  function mount(host, ctx) {
    if (!host) return;
    let view = views.get(host);
    const firstMount = !view || view.userId !== ctx.currentUser?.id;
    if (firstMount) {
      view = { userId: ctx.currentUser?.id, periodId: ctx.getActivePeriodId(ctx.FIVE_S_PERIOD_TYPE), selectedId: "", draft: null, busy: false };
      views.set(host, view);
    }
    view.ctx = ctx;
    if (!canEdit(ctx)) view.draft = null;
    if (view.busy || (view.draft && host.querySelector("form"))) return;
    render(host, view);
  }

  function render(host, view) {
    const ctx = view.ctx;
    const esc = ctx.escapeHtml;
    const mobile = host.id === "mobileScreenFindings";
    if (mobile) { renderMobile(host, view); return; }
    const periods = ctx.getPeriodsByType(ctx.FIVE_S_PERIOD_TYPE);
    const allRecords = sheets(ctx);
    const periodFor = (item) => {
      const id = resolvePeriodId(item, periods);
      return periods.some((period) => period.id === id) ? id : UNASSIGNED;
    };
    const hasUnassigned = allRecords.some((item) => periodFor(item) === UNASSIGNED);
    if (!periods.some((period) => period.id === view.periodId) && !(hasUnassigned && view.periodId === UNASSIGNED)) {
      view.periodId = periods.find((period) => period.id === ctx.getActivePeriodId(ctx.FIVE_S_PERIOD_TYPE))?.id || periods[0]?.id || (hasUnassigned ? UNASSIGNED : "");
    }
    const periodRecords = allRecords.filter((item) => periodFor(item) === view.periodId);
    const areas = sortedAreas(ctx, view.periodId);
    const zoneKey = (item) => {
      const id = resolveAreaId(item, areas) || item.areaId;
      return id ? `id:${id}` : `legacy:${String(item.area || "").trim().toLocaleLowerCase("vi")}`;
    };
    const zoneOptions = new Map(areas.map((area) => [`id:${area.id}`, `Zone ${area.code}`]));
    periodRecords.forEach((item) => {
      if (!zoneOptions.has(zoneKey(item))) zoneOptions.set(zoneKey(item), shortZoneLabel(item.area) || "Chưa chọn Zone");
    });
    if (!zoneOptions.has(view.zoneFilter)) view.zoneFilter = "";
    const records = periodRecords.filter((item) => !view.zoneFilter || zoneKey(item) === view.zoneFilter)
      .sort((a, b) => zoneOptions.get(zoneKey(a)).localeCompare(zoneOptions.get(zoneKey(b)), "vi", { numeric: true }));
    const mobilePeriodBadge = host.closest("#mobileProtoOverlay")?.querySelector(".period-pill-text");
    if (mobilePeriodBadge) mobilePeriodBadge.textContent = ctx.periodLabel(periods.find((period) => period.id === view.periodId));
    const saved = records.find((sheet) => sheet.id === view.selectedId) || records[0];
    view.selectedId = saved?.id || "";
    const sheet = view.draft || (saved ? { ...saved, periodId: resolvePeriodId(saved, periods) } : { periodId: view.periodId, area: "", inspector: "", inspectionDate: "", rows: defaultRows() });
    const editing = Boolean(view.draft && canEditPeriod(ctx, view.draft.periodId));
    const isAllZones = !view.zoneFilter;
    const combined = !mobile && !editing && (isAllZones || records.length > 1);
    const rowSources = combined ? records.flatMap((record) => (record.rows || []).map((row, index) => ({ record, index, row })).filter(({ row }) => rowHasContent(row))) : [];
    const tableRows = editing ? sheet.rows : defaultRows(combined ? rowSources.map(({ row }) => row) : sheet.rows);
    if (!tableRows.length) tableRows.push(blankRow());
    const rowPageCount = Math.max(1, Math.ceil(tableRows.length / ROWS_PER_PAGE));
    view.rowPage = Math.max(0, Math.min(view.rowPage || 0, rowPageCount - 1));
    const firstRow = view.rowPage * ROWS_PER_PAGE;
    const zoneInspectors = [...new Set(records.flatMap((item) => parseInspectors(item.inspector)))].slice(0, 2);
    const displayInspectors = isAllZones ? [] : zoneInspectors;
    const canEditCurrentZone = Boolean(!isAllZones && canEditPeriod(ctx, view.periodId) && (ctx.isAdminAccount(ctx.currentUser) || editableAreas(ctx, view.periodId).some((a) => `id:${a.id}` === view.zoneFilter)));
    const isEditingHeader = Boolean(view.editingHeader && canEditCurrentZone);
    const currentInspectionDate = isAllZones ? "" : (sheet.inspectionDate || records.find((item) => item.inspectionDate)?.inspectionDate || "");
    const headerHtml = isEditingHeader
      ? `<div class="findings-inspection is-editing">
          <label><span>Người kiểm tra</span>
            <div class="findings-inspectors-inputs">
              <input name="headerInspector1" maxlength="20" placeholder="Người kiểm tra 1" value="${esc(zoneInspectors[0] || "")}" required>
              <input name="headerInspector2" maxlength="20" placeholder="Người kiểm tra 2" value="${esc(zoneInspectors[1] || "")}">
            </div>
          </label>
          <label><span>Ngày kiểm tra</span>
            ${dateEditor(currentInspectionDate || ctx.todayIsoDate(), 'name="headerInspectionDate"', true, esc, true)}
          </label>
          <div class="findings-header-actions">
            <button type="button" class="btn-save-header" data-finding-action="save-header">Lưu</button>
            <button type="button" class="btn-cancel-header" data-finding-action="cancel-header">Hủy</button>
          </div>
        </div>`
      : `<div class="findings-inspection ${canEditCurrentZone ? "is-editable" : ""}">
          ${canEditCurrentZone ? `<button type="button" class="findings-header-edit-btn" data-finding-action="edit-header" title="Sửa trực tiếp người kiểm tra và ngày kiểm tra"><i class="fa-solid fa-pen-to-square"></i> Sửa</button>` : ""}
          <label><span>Người kiểm tra</span>
            <div class="findings-inspectors-display" ${canEditCurrentZone ? 'data-finding-action="edit-header" role="button" tabindex="0" title="Nhấp để sửa trực tiếp"' : ""}>
              ${displayInspectors.length ? displayInspectors.map((name) => `<span class="findings-inspector-name">${esc(name)}</span>`).join("") : '<span class="findings-inspector-name is-empty">&nbsp;</span>'}
            </div>
          </label>
          <label><span>Ngày kiểm tra</span>
            <div class="findings-date-display" ${canEditCurrentZone ? 'data-finding-action="edit-header" role="button" tabindex="0" title="Nhấp để sửa trực tiếp"' : ""}>
              <span class="findings-date-text">${esc(displayDate(currentInspectionDate)) || "&nbsp;"}</span>
            </div>
          </label>
        </div>`;
    const button = (action, label) => `<button type="button" data-finding-action="${action}">${label}</button>`;
    const valueInput = (name, value, type = "text", required = false) => type === "date"
      ? dateEditor(value, `name="${name}"`, editing, esc, required)
      : `<input name="${name}" type="${type}" value="${esc(value || "")}" ${required ? "required" : ""} maxlength="200" ${editing ? "" : "disabled"}>`;
    const periodOptions = (selected) => periods.map((period) => `<option value="${esc(period.id)}" ${period.id === selected ? "selected" : ""}>${esc(ctx.periodLabel(period))}</option>`).join("");
    host.innerHTML = `<div class="findings-page ${mobile ? "findings-mobile" : ""}">
      <div class="findings-toolbar ${mobile ? "" : "toolbar findings-desktop-toolbar"}">
        <label ${mobile && editing ? "hidden" : ""}><span>Kỳ đánh giá 5S</span><select data-finding-period aria-label="Kỳ đánh giá 5S" ${editing ? "disabled" : ""}>
          ${periodOptions(view.periodId)}${hasUnassigned ? `<option value="${UNASSIGNED}" ${view.periodId === UNASSIGNED ? "selected" : ""}>Phiếu chưa gán kỳ</option>` : ""}${!periods.length && !hasUnassigned ? '<option value="">Chưa có kỳ chấm 5S</option>' : ""}
        </select></label>
        <label ${mobile && editing ? "hidden" : ""}><span>Khu vực (Zone)</span><select data-finding-zone aria-label="Lọc theo Zone" ${editing ? "disabled" : ""}>
          <option value="">Tất cả Zone</option>${[...zoneOptions].sort((a, b) => a[1].localeCompare(b[1], "vi", { numeric: true })).map(([key, label]) => `<option value="${esc(key)}" ${view.zoneFilter === key ? "selected" : ""}>${esc(label)}</option>`).join("")}
        </select></label>
        <div class="findings-actions">${mobile && view.showDetail && !editing ? button("back", "‹ Danh sách") : ""}${editing ? '<button type="submit" data-finding-save>Lưu phiếu</button>' + button("cancel", "Hủy") : canEditPeriod(ctx, view.periodId) ? (periods.some((period) => period.id === view.periodId) ? button("new", "＋ Thêm vấn đề 5S") : "") + (canEditSheet(ctx, saved) && mobile && view.showDetail ? button("edit", "Sửa") + button("delete", "Xóa") : "") : '<span class="findings-readonly">Chỉ xem</span>'}
        ${!editing ? `<button type="button" class="btn-export-excel-gradient" data-finding-export ${records.length ? "" : "disabled"} title="Xuất các phiếu theo kỳ và Zone đang lọc"><i class="fa-solid fa-file-excel" aria-hidden="true"></i> Xuất Excel</button>` : ""}</div>
      </div>
      ${mobile && !editing && !view.showDetail ? mobileList(records, periodRecords, esc) : ""}
      <form class="findings-form ${mobile ? "mobile-safety-form" : ""}" ${mobile && !editing && !view.showDetail ? "hidden" : ""}>
        ${editing ? `<label class="findings-period-editor">Kỳ của phiếu<select name="periodId" required aria-label="Kỳ của phiếu"><option value="">Chọn kỳ chấm 5S</option>${periodOptions(sheet.periodId)}</select></label>` : ""}
        ${mobile ? mobileForm(sheet, ctx, editing, view, valueInput) : `<div class="findings-paper">
          <div class="findings-heading">
            <h2>Các vấn đề về 5S phát hiện<span>5S find out</span></h2>
            ${headerHtml}
          </div>
          <div class="findings-subheading"><label>Khu vực (Zone):${editing ? zoneInput(sheet, ctx, editing, esc) : valueInput("areaId", isAllZones ? "Tất cả Zone" : (zoneOptions.get(view.zoneFilter) || shortZoneLabel(sheet.area)))}</label></div>
          <div class="findings-table-scroll" tabindex="0" role="region" aria-label="Bảng các vấn đề 5S, cuộn ngang để xem đủ cột">
            <table class="findings-table"><colgroup>${[80, 120, 290, 180, 75, 275, 140, 100].map((width) => `<col style="width:${width / 1260 * 100}%">`).join("")}</colgroup>
              <thead><tr><th scope="col">STT</th>${headings.map((heading) => `<th scope="col">${heading}</th>`).join("")}</tr></thead>
              <tbody>${tableRows.slice(firstRow, firstRow + ROWS_PER_PAGE).map((row, offset) => {
                const index = firstRow + offset;
                const source = combined ? rowSources[index] : saved && index < saved.rows.length ? { record: saved, index } : null;
                const actions = editing ? `<button type="button" data-remove-row="${index}" aria-label="Xóa dòng ${index + 1}" title="Xóa dòng">Xóa</button>` : source && canEditSheet(ctx, source.record) ? `<button type="button" data-edit-saved-row="${source.index}" data-sheet-id="${esc(source.record.id)}" aria-label="Sửa dòng ${index + 1}" title="Sửa dòng">Sửa</button><button type="button" data-delete-saved-row="${source.index}" data-sheet-id="${esc(source.record.id)}" aria-label="Xóa dòng ${index + 1}" title="Xóa dòng">Xóa</button>` : "";
                return `<tr><th scope="row">${index + 1}${combined && source ? `<small class="findings-row-zone">${esc(shortZoneLabel(source.record.area))}</small>` : ""}${actions}</th>${fields.map((key, col) => `<td>${cell(row, key, index, headings[col], editing, esc)}</td>`).join("")}</tr>`;
              }).join("")}</tbody>
            </table>
          </div>
        </div>`}
        ${!mobile ? `<nav class="findings-row-pager" aria-label="Phân trang dòng phiếu 5S">
          <span>Dòng ${firstRow + 1}–${Math.min(firstRow + ROWS_PER_PAGE, tableRows.length)} / ${tableRows.length}</span>
          <button type="button" data-finding-row-page="${view.rowPage - 1}" ${view.rowPage === 0 ? "disabled" : ""}>‹ Trang trước</button>
          <span aria-live="polite">Trang ${view.rowPage + 1} / ${rowPageCount}</span>
          <button type="button" data-finding-row-page="${view.rowPage + 1}" ${view.rowPage + 1 === rowPageCount ? "disabled" : ""}>Trang sau ›</button>
        </nav>` : ""}
        ${editing ? `<div class="findings-bottom"><button type="button" data-finding-action="add-row">＋ Thêm vấn đề 5S</button><button type="submit">Lưu phiếu</button></div>` : ""}
      </form>
    </div>`;

    const form = host.querySelector("form");
    if (editing && (view.appendExisting || Number.isInteger(view.editIssueIndex))) {
      form.elements.periodId.disabled = true;
      form.elements.areaId.disabled = true;
    }
    host.querySelectorAll("[data-finding-row-page]").forEach((button) => button.addEventListener("click", () => {
      if (view.busy) return;
      collect(form, view);
      view.rowPage = Number(button.dataset.findingRowPage);
      render(host, view);
    }));
    host.querySelector("[data-finding-export]")?.addEventListener("click", () => {
      try { ctx.exportFiveSFindings(records.map((item) => item.id), view.periodId); }
      catch (error) { message(host, "Không xuất được Excel. Vui lòng thử lại.", true); }
    });
    host.querySelectorAll("[data-open-finding]").forEach((button) => button.addEventListener("click", () => {
      view.selectedId = button.dataset.openFinding;
      view.issueIndex = Number(button.dataset.issueIndex);
      view.editIssueIndex = null;
      view.showDetail = true;
      render(host, view);
    }));
    form.elements.periodId?.addEventListener("change", (event) => {
      event.stopPropagation();
      collect(form, view);
      view.draft.areaId = "";
      view.draft.area = "";
      render(host, view);
    });
    host.querySelector("[data-finding-period]").addEventListener("change", (event) => {
      view.periodId = event.target.value;
      view.zoneFilter = "";
      view.selectedId = "";
      view.rowPage = 0;
      view.showDetail = false;
      view.notice = null;
      view.editingHeader = false;
      render(host, view);
    });
    host.querySelector("[data-finding-zone]").addEventListener("change", (event) => {
      view.zoneFilter = event.target.value;
      view.selectedId = "";
      view.rowPage = 0;
      view.showDetail = false;
      view.notice = null;
      view.editingHeader = false;
      render(host, view);
    });
    form.querySelectorAll(".findings-date-editor").forEach((wrap) => {
      const text = wrap.querySelector("[data-finding-date]");
      const calendar = wrap.querySelector(".findings-date-calendar");
      if (!calendar) return;
      text.addEventListener("input", () => {
        const iso = ctx.parseDisplayDateToIso(text.value);
        text.setCustomValidity(text.value && !iso ? "Nhập ngày hợp lệ theo dạng dd/mm/yyyy." : "");
        calendar.value = iso;
      });
      calendar.addEventListener("input", () => {
        text.value = displayDate(calendar.value);
        text.dispatchEvent(new Event("input", { bubbles: true }));
      });
      calendar.addEventListener("change", () => {
        text.value = displayDate(calendar.value);
        text.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });
    host.querySelector("[data-finding-save]")?.addEventListener("click", () => form.requestSubmit());
    host.querySelectorAll("[data-edit-saved-row], [data-delete-saved-row]").forEach((button) => button.addEventListener("click", async () => {
      if (view.busy || !canEdit(ctx)) return;
      const record = records.find((item) => item.id === button.dataset.sheetId);
      const deleting = button.hasAttribute("data-delete-saved-row");
      const index = Number(deleting ? button.dataset.deleteSavedRow : button.dataset.editSavedRow);
      if (!record?.rows[index] || !canEditSheet(ctx, record)) return;
      if (deleting) {
        if (!window.confirm(`Xóa dòng ${index + 1} của ${record.area}?`)) return;
        await perform(host, view, async () => {
          const data = clone(record);
          data.rows.splice(index, 1);
          data.updatedAt = new Date().toISOString();
          data.updatedBy = ctx.currentUser.id;
          await ctx.saveFiveSFinding(data);
          ctx.state.fiveSFindings = ctx.state.fiveSFindings.map((item) => item.id === data.id ? data : item);
        }, "Đã xóa dòng.");
        return;
      }
      openIssueModal(host, view, record, index);
    }));
    form.addEventListener("input", () => collect(form, view));
    form.addEventListener("change", (event) => {
      collect(form, view);
      if (event.target.dataset.field === "progress") {
        const circle = event.target.parentElement.querySelector(".findings-progress");
        circle?.style.setProperty("--progress", `${event.target.value}%`);
      }
    });
    if (isEditingHeader) {
      form.querySelectorAll('[name="headerInspector1"], [name="headerInspector2"], [name="headerInspectionDate"]').forEach((inp) => {
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            host.querySelector('[data-finding-action="save-header"]')?.click();
          }
        });
      });
    }
    host.querySelectorAll("[data-finding-action]").forEach((el) => el.addEventListener("click", async () => {
      const action = el.dataset.findingAction;
      if (view.busy) return;
      if (action === "back") { view.showDetail = false; render(host, view); return; }
      if (!canEdit(ctx)) return;
      view.notice = null;
      if (action === "edit-header") {
        view.editingHeader = true;
        render(host, view);
        host.querySelector('[name="headerInspector1"]')?.focus();
        return;
      }
      if (action === "cancel-header") {
        view.editingHeader = false;
        render(host, view);
        return;
      }
      if (action === "save-header") {
        const inp1 = form.elements.headerInspector1 ? form.elements.headerInspector1.value.trim().slice(0, 20) : "";
        const inp2 = form.elements.headerInspector2 ? form.elements.headerInspector2.value.trim().slice(0, 20) : "";
        if (!inp1 && !inp2) {
          ctx.showToast("Vui lòng nhập người kiểm tra (tối đa 2 người, mỗi người tối đa 20 chữ cái).", true);
          form.elements.headerInspector1?.focus();
          return;
        }
        const dateInput = form.elements.headerInspectionDate ? form.elements.headerInspectionDate.value.trim() : "";
        const dateIso = ctx.parseDisplayDateToIso(dateInput);
        if (!dateIso) {
          ctx.showToast("Vui lòng nhập ngày kiểm tra hợp lệ theo định dạng dd/mm/yyyy.", true);
          form.elements.headerInspectionDate?.focus();
          return;
        }
        const newInspector = formatInspectors(inp1, inp2);
        const targetAreaId = areas.find((a) => `id:${a.id}` === view.zoneFilter)?.id || (areas.length === 1 ? areas[0].id : "");
        const targetRecords = periodRecords.filter((item) => resolveAreaId(item, areas) === targetAreaId);
        await perform(host, view, async () => {
          if (targetRecords.length > 0) {
            const updates = targetRecords.map((r) => ({
              ...clone(r),
              inspector: newInspector,
              inspectionDate: dateIso,
              updatedAt: new Date().toISOString(),
              updatedBy: ctx.currentUser.id,
            }));
            if (updates.length > 1) {
              await ctx.saveFiveSFindingsBatch(updates);
            } else {
              await ctx.saveFiveSFinding(updates[0]);
            }
            ctx.state.fiveSFindings = ctx.state.fiveSFindings.map((item) => {
              const u = updates.find((x) => x.id === item.id);
              return u || item;
            });
          } else {
            const targetArea = areas.find((a) => a.id === targetAreaId);
            const data = fresh(ctx, view.periodId);
            data.areaId = targetAreaId;
            data.area = targetArea ? zoneLabel(targetArea) : "";
            data.inspector = newInspector;
            data.inspectionDate = dateIso;
            data.updatedAt = new Date().toISOString();
            data.updatedBy = ctx.currentUser.id;
            await ctx.saveFiveSFinding(data);
            ctx.state.fiveSFindings = [...(ctx.state.fiveSFindings || []), data];
          }
          view.editingHeader = false;
        }, "Đã cập nhật người kiểm tra và ngày kiểm tra.");
        return;
      }
      if (action === "new") { openIssueModal(host, view); return; }
      if (action === "edit" && canEditSheet(ctx, saved)) { openIssueModal(host, view, saved, view.issueIndex); return; }
      if (action === "cancel") { view.draft = null; view.addingIssues = false; view.appendExisting = false; view.editIssueIndex = null; }
      if (action === "add-row" && view.draft) {
        collect(form, view);
        view.editIssueIndex = null;
        view.draft.rows.push(blankRow());
        view.openRow = view.draft.rows.length - 1;
        view.rowPage = Math.floor((view.draft.rows.length - 1) / ROWS_PER_PAGE);
      }
      if (action === "delete" && canEditSheet(ctx, saved)) {
        if (mobile && Number.isInteger(view.issueIndex) && saved.rows[view.issueIndex]) {
          if (!window.confirm("Xóa vấn đề 5S này?")) return;
          await perform(host, view, async () => {
            const data = clone(saved);
            data.rows.splice(view.issueIndex, 1);
            data.updatedAt = new Date().toISOString();
            data.updatedBy = ctx.currentUser.id;
            await ctx.saveFiveSFinding(data);
            ctx.state.fiveSFindings = ctx.state.fiveSFindings.map((item) => item.id === data.id ? data : item);
            view.issueIndex = null;
            view.showDetail = false;
          }, "Đã xóa vấn đề 5S.");
          return;
        }
        if (!window.confirm(`Xóa phiếu 5S khu vực ${saved.area}, ngày ${ctx.formatDateDisplay(saved.inspectionDate)}?`)) return;
        await perform(host, view, async () => {
          await ctx.deleteFiveSFinding(saved.id);
          ctx.state.fiveSFindings = (ctx.state.fiveSFindings || []).filter((item) => item.id !== saved.id);
          view.selectedId = "";
          view.showDetail = false;
        }, "Đã xóa phiếu.");
        return;
      }
      render(host, view);
      if (action === "new" || action === "add-row") (host.querySelector(`[data-row="${view.openRow}"][data-field="location"]`) || host.querySelector(`[data-row="${view.openRow}"][data-field="problem"]`))?.focus();
    }));
    host.querySelectorAll("[data-remove-row]").forEach((el) => el.addEventListener("click", () => {
      if (view.busy || !view.draft || !canEdit(ctx)) return;
      collect(form, view);
      view.draft.rows.splice(Number(el.dataset.removeRow), 1);
      view.editIssueIndex = null;
      if (!view.draft.rows.length) view.draft.rows.push(blankRow());
      view.openRow = Math.min(view.openRow || 0, view.draft.rows.length - 1);
      render(host, view);
    }));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (view.busy || !view.draft || !canEdit(ctx)) return;
      collect(form, view);
      let data = clone(view.draft);
      const invalidDueDateIndex = data.rows.findIndex((row) => row.dueDate && !ctx.parseDisplayDateToIso(displayDate(row.dueDate)));
      if (invalidDueDateIndex >= 0) {
        view.rowPage = Math.floor(invalidDueDateIndex / ROWS_PER_PAGE);
        view.openRow = invalidDueDateIndex;
        render(host, view);
        message(host, `Hạn hoàn thành ở dòng ${invalidDueDateIndex + 1} không hợp lệ. Nhập ngày theo dạng dd/mm/yyyy.`, true);
        host.querySelector(`[data-row="${invalidDueDateIndex}"][data-field="dueDate"]`)?.focus();
        return;
      }
      const invalidDate = [...form.querySelectorAll("[data-finding-date]")].find((input) => input.value && !ctx.parseDisplayDateToIso(input.value));
      if (invalidDate) {
        invalidDate.setCustomValidity("Nhập ngày hợp lệ theo dạng dd/mm/yyyy.");
        invalidDate.reportValidity();
        return;
      }
      if (!periods.some((period) => period.id === data.periodId)) return message(host, "Vui lòng chọn kỳ chấm điểm 5S cho phiếu.", true);
      if (!editableAreas(ctx, data.periodId).some((area) => area.id === data.areaId)) return message(host, "Vui lòng chọn Zone được phân công trong kỳ này.", true);
      if (!data.inspector || !data.inspectionDate) return message(host, "Vui lòng nhập đủ người kiểm tra và ngày kiểm tra.", true);
      if (!data.rows.some((row) => row.problem)) return message(host, "Vui lòng nhập ít nhất một vấn đề phát hiện.", true);
      if (data.rows.some((row) => !row.problem && fields.some((key) => key !== "progress" && row[key]))) return message(host, "Vui lòng nhập vấn đề cho các dòng đã có thông tin.", true);
      if (view.addingIssues) {
        const target = findMatchingSheet(ctx, data.periodId, data.areaId, data.inspector, data.inspectionDate);
        if (target) {
          if (!canEditSheet(ctx, target)) return message(host, "Bạn chỉ được thêm vấn đề cho Zone được phân công.", true);
          data = { ...clone(target), periodId: data.periodId, areaId: data.areaId, area: data.area, rows: defaultRows([...(target.rows || []).filter(rowHasContent), ...data.rows.filter(rowHasContent)]) };
        }
      }
      await perform(host, view, async () => {
        data.createdAt = data.createdAt || new Date().toISOString();
        data.updatedAt = new Date().toISOString();
        data.updatedBy = ctx.currentUser.id;
        await ctx.saveFiveSFinding(data);
        ctx.state.fiveSFindings = [...(ctx.state.fiveSFindings || []).filter((item) => item.id !== data.id), data];
        view.selectedId = data.id;
        view.periodId = data.periodId;
        if (view.zoneFilter) view.zoneFilter = `id:${data.areaId}`;
        view.draft = null;
        view.addingIssues = false;
        view.appendExisting = false;
        view.issueIndex = null;
        view.editIssueIndex = null;
        view.showDetail = false;
      }, "Đã lưu phiếu.");
    });
    if (view.notice) message(host, view.notice.text, view.notice.error);
  }

  function renderMobile(host, view) {
    const ctx = view.ctx;
    const esc = ctx.escapeHtml;
    const periods = ctx.getPeriodsByType(ctx.FIVE_S_PERIOD_TYPE).filter((period) => ctx.isAdminAccount(ctx.currentUser) || (!period.archived && period.id === ctx.getActivePeriodId(ctx.FIVE_S_PERIOD_TYPE)));
    if (!periods.some((period) => period.id === view.periodId)) view.periodId = periods[0]?.id || "";
    const periodId = view.periodId;
    const records = sheets(ctx).filter((record) => resolvePeriodId(record, periods) === periodId)
      .sort((a, b) => shortZoneLabel(a.area).localeCompare(shortZoneLabel(b.area), "vi", { numeric: true }));
    const areas = sortedAreas(ctx, periodId);
    const zoneOptions = new Map(areas.map((area) => [area.id, zoneLabel(area)]));
    records.forEach((record) => { const id = resolveAreaId(record, areas) || record.areaId || shortZoneLabel(record.area); if (!zoneOptions.has(id)) zoneOptions.set(id, shortZoneLabel(record.area)); });
    const getMobileAreaInspectors = (targetAreaId) => {
      if (!targetAreaId) return [];
      const targetRecords = records.filter((item) => resolveAreaId(item, areas) === targetAreaId);
      return [...new Set(targetRecords.flatMap((item) => parseInspectors(item.inspector)))].slice(0, 2);
    };
    const getMobileAreaDate = (targetAreaId) => {
      if (!targetAreaId) return "";
      const targetRecords = records.filter((item) => resolveAreaId(item, areas) === targetAreaId);
      return targetRecords.find((item) => item.inspectionDate)?.inspectionDate || targetRecords[0]?.inspectionDate || "";
    };
    const reset = (areaId = "") => {
      view.mobileEdit = null;
      view.mobileDraft = fresh(ctx, periodId, true);
      const allowed = editableAreas(ctx, periodId);
      const area = allowed.find((item) => item.id === areaId) || (allowed.length === 1 ? allowed[0] : null);
      if (area) {
        view.mobileDraft.areaId = area.id;
        view.mobileDraft.area = zoneLabel(area);
        const areaInspectors = getMobileAreaInspectors(area.id);
        if (areaInspectors.length) {
          view.mobileDraft.inspector = formatInspectors(areaInspectors[0], areaInspectors[1]);
        }
        const areaDate = getMobileAreaDate(area.id);
        if (areaDate) view.mobileDraft.inspectionDate = areaDate;
      }
    };
    if (!view.mobileDraft || view.mobileDraft.periodId !== periodId) reset();
    const draft = view.mobileDraft;
    const source = view.mobileEdit && records.find((record) => record.id === view.mobileEdit.id);
    const writable = Boolean(periodId && canEditPeriod(ctx, periodId) && (!view.mobileEdit || canEditSheet(ctx, source)));
    const input = (name, value, type = "text", required = false) => type === "date"
      ? dateEditor(value, `name="${name}"`, writable && !view.mobileEdit, esc, required)
      : `<input name="${name}" value="${esc(value || "")}" maxlength="200" ${required ? "required" : ""} ${!writable || view.mobileEdit ? "disabled" : ""}>`;
    const field = (label, html, wide = false) => `<label class="findings-mobile-field ${wide ? "is-wide" : ""}"><span>${label}</span>${html}</label>`;
    const labels = ["Vị trí", "Vấn đề 5S *", "Hạng mục", "Ca làm việc", "Biện pháp khắc phục", "Hạn hoàn thành", "Tiến độ"];
    host.innerHTML = `<div class="findings-page findings-mobile findings-mobile-single">
      <form class="findings-form mobile-safety-form" data-mobile-issue-form>
        <div class="mobile-info-banner"><strong>${view.mobileEdit ? writable ? "Sửa vấn đề 5S" : "Thông tin vấn đề 5S" : "Thông tin vấn đề 5S"}</strong><span>${periodId ? esc(ctx.periodLabel(ctx.getPeriod(periodId))) : "Chưa có kỳ đánh giá đang mở"}</span></div>
        <div class="findings-mobile-grid">
          ${field("Khu vực (Zone) *", zoneInput(draft, ctx, writable, esc))}
          ${field("Ngày kiểm tra *", input("inspectionDate", draft.inspectionDate, "date", true))}
          ${field("Người kiểm tra *", `
            <div class="findings-inspectors-inputs">
              <input name="inspector1" value="${esc(parseInspectors(draft.inspector)[0] || "")}" maxlength="20" placeholder="Người kiểm tra 1" required ${!writable || view.mobileEdit ? "disabled" : ""}>
              <input name="inspector2" value="${esc(parseInspectors(draft.inspector)[1] || "")}" maxlength="20" placeholder="Người kiểm tra 2" ${!writable || view.mobileEdit ? "disabled" : ""}>
            </div>
          `, true)}
          ${fields.map((key, index) => field(labels[index], cell(draft.rows[0], key, 0, labels[index], writable, esc, true), ["location", "problem", "countermeasure"].includes(key))).join("")}
        </div>
        <div class="findings-mobile-submit">${writable ? `<div class="mobile-fixed-save"><button type="submit">${view.mobileEdit ? "LƯU THAY ĐỔI" : "LƯU VẤN ĐỀ 5S"}</button></div>` : '<span class="findings-readonly">Chỉ xem — bạn không có quyền thêm, sửa, xóa vấn đề 5S trong kỳ hoặc Zone này.</span><div class="mobile-fixed-save"><button type="button" data-findings-denied>LƯU VẤN ĐỀ 5S</button></div>'}
        ${view.mobileEdit ? `<button type="button" data-mobile-reset>${writable ? "Hủy sửa" : "Đóng chi tiết"}</button>${writable ? '<button type="button" class="findings-remove-issue" data-mobile-delete>Xóa vấn đề</button>' : ""}` : ""}</div>
        <p class="findings-message" role="status" aria-live="polite"></p>
      </form>
      ${mobileList(records, records, esc)}
    </div>`;
    const badge = host.closest("#mobileProtoOverlay")?.querySelector(".period-pill-text");
    if (badge) badge.textContent = ctx.periodLabel(ctx.getPeriod(periodId));
    const form = host.querySelector("form");
    host.querySelector("[data-findings-denied]")?.addEventListener("click", () => ctx.showToast("Bạn không có quyền thêm, sửa, lưu hoặc xóa vấn đề 5S trong kỳ hoặc Zone này.", true));
    if (view.mobileEdit) form.elements.areaId.disabled = true;
    if (writable) form.querySelector('[data-field="problem"]').required = true;
    const capture = () => {
      if (!writable) return;
      draft.areaId = form.elements.areaId.value;
      draft.area = zoneOptions.get(draft.areaId) || "";
      const n1 = form.elements.inspector1 ? form.elements.inspector1.value.trim().slice(0, 20) : "";
      const n2 = form.elements.inspector2 ? form.elements.inspector2.value.trim().slice(0, 20) : "";
      draft.inspector = formatInspectors(n1, n2);
      draft.inspectionDate = ctx.parseDisplayDateToIso(form.elements.inspectionDate.value) || form.elements.inspectionDate.value.trim();
      form.querySelectorAll("[data-field]").forEach((input) => { draft.rows[0][input.dataset.field] = input.dataset.field === "dueDate" ? ctx.parseDisplayDateToIso(input.value) || input.value.trim() : input.value.trim(); });
    };
    form.addEventListener("input", capture);
    form.addEventListener("change", (event) => {
      capture();
      if (event.target.dataset.field === "progress") event.target.parentElement.querySelector(".findings-progress")?.style.setProperty("--progress", `${event.target.value}%`);
    });
    form.elements.areaId?.addEventListener("change", (event) => {
      const selectedId = event.target.value;
      if (!selectedId) return;
      const [m1, m2] = getMobileAreaInspectors(selectedId);
      if (form.elements.inspector1) form.elements.inspector1.value = m1 || String(ctx.currentUser?.name || ctx.currentUser?.username || "").trim().slice(0, 20);
      if (form.elements.inspector2) form.elements.inspector2.value = m2 || "";
      const date = getMobileAreaDate(selectedId) || ctx.todayIsoDate();
      if (form.elements.inspectionDate) {
        form.elements.inspectionDate.value = displayDate(date);
        const cal = form.querySelector(".findings-date-calendar");
        if (cal) cal.value = date;
      }
      capture();
    });
    form.querySelectorAll(".findings-date-editor").forEach((wrap) => {
      const input = wrap.querySelector("[data-finding-date]");
      const calendar = wrap.querySelector(".findings-date-calendar");
      if (!calendar) return;
      input.addEventListener("input", () => { calendar.value = ctx.parseDisplayDateToIso(input.value) || ""; });
      for (const event of ["input", "change"]) calendar.addEventListener(event, () => { input.value = displayDate(calendar.value); capture(); });
    });
    host.querySelectorAll("[data-open-finding]").forEach((button) => button.addEventListener("click", () => {
      if (view.busy) return;
      const record = records.find((item) => item.id === button.dataset.openFinding);
      const index = Number(button.dataset.issueIndex);
      if (!record?.rows[index]) return;
      capture();
      openIssueModal(host, view, record, index);
    }));
    host.querySelector("[data-mobile-reset]")?.addEventListener("click", () => {
      reset(draft.areaId);
      if (view.mobileNewDraft?.periodId === periodId) view.mobileDraft = view.mobileNewDraft;
      view.mobileNewDraft = null;
      view.notice = null;
      renderMobile(host, view);
    });
    const persist = async (deleting = false) => {
      if (view.busy || !writable) return;
      capture();
      const edit = view.mobileEdit;
      const target = edit ? ctx.state.fiveSFindings.find((record) => record.id === edit.id) : findMatchingSheet(ctx, periodId, draft.areaId, draft.inspector, draft.inspectionDate);
      if (edit && (!target || JSON.stringify(target.rows?.[edit.index]) !== JSON.stringify(edit.original))) return message(host, "Vấn đề đã thay đổi. Chọn lại vấn đề trong danh sách.", true);
      if (target && !canEditSheet(ctx, target)) return message(host, "Bạn không có quyền thay đổi Zone này.", true);
      const area = editableAreas(ctx, periodId).find((item) => item.id === draft.areaId);
      if (!area) return message(host, "Vui lòng chọn Zone được phân công.", true);
      const row = clone(draft.rows[0]);
      if (!deleting && !row.problem) return message(host, "Vui lòng nhập vấn đề 5S.", true);
      const date = ctx.parseDisplayDateToIso(displayDate(draft.inspectionDate));
      const n1 = form.elements.inspector1 ? form.elements.inspector1.value.trim() : "";
      const n2 = form.elements.inspector2 ? form.elements.inspector2.value.trim() : "";
      if (!deleting && (n1.length > 20 || n2.length > 20)) return message(host, "Mỗi tên người kiểm tra tối đa 20 chữ cái.", true);
      if (!deleting && (!date || !draft.inspector)) return message(host, "Vui lòng nhập người kiểm tra và ngày hợp lệ (dd/mm/yyyy).", true);
      if (!deleting && row.dueDate && !ctx.parseDisplayDateToIso(displayDate(row.dueDate))) return message(host, "Hạn hoàn thành không hợp lệ (dd/mm/yyyy).", true);
      row.dueDate = row.dueDate ? ctx.parseDisplayDateToIso(displayDate(row.dueDate)) : "";
      const data = target ? clone(target) : { ...fresh(ctx, periodId), inspector: draft.inspector, inspectionDate: date };
      data.periodId = periodId; data.areaId = area.id; data.area = zoneLabel(area);
      if (deleting) data.rows.splice(edit.index, 1);
      else {
        let index = edit ? edit.index : data.rows.findIndex((item) => !rowHasContent(item));
        if (index < 0) index = data.rows.length;
        data.rows[index] = row;
      }
      data.createdAt ||= new Date().toISOString();
      data.updatedAt = new Date().toISOString(); data.updatedBy = ctx.currentUser.id;
      await perform(host, view, async () => {
        await ctx.saveFiveSFinding(data);
        ctx.state.fiveSFindings = [...ctx.state.fiveSFindings.filter((record) => record.id !== data.id), data];
        reset(area.id);
        view.mobileNewDraft = null;
        view.zoneFilter = "";
      }, deleting ? "Đã xóa vấn đề 5S." : edit ? "Đã cập nhật vấn đề 5S." : "Đã thêm vấn đề 5S.");
    };
    form.addEventListener("submit", (event) => { event.preventDefault(); persist(); });
    host.querySelector("[data-mobile-delete]")?.addEventListener("click", () => { if (window.confirm("Xóa vấn đề 5S này?")) persist(true); });
    if (view.notice) message(host, view.notice.text, view.notice.error);
  }

  function openIssueModal(host, view, record = null, rowIndex = null) {
    const ctx = view.ctx;
    const editing = Boolean(record);
    const mobile = host.id === "mobileScreenFindings";
    const writable = editing ? canEditSheet(ctx, record) : canEditPeriod(ctx, view.periodId);
    if ((!editing && !writable) || (editing && (!Number.isInteger(rowIndex) || !record.rows?.[rowIndex]))) return;
    const periodId = editing ? resolvePeriodId(record, ctx.getPeriodsByType(ctx.FIVE_S_PERIOD_TYPE)) : view.periodId;
    const areas = writable ? editableAreas(ctx, periodId) : sortedAreas(ctx, periodId);
    const esc = ctx.escapeHtml;
    const areaId = editing ? resolveAreaId(record, areas) : areas.find((area) => `id:${area.id}` === view.zoneFilter)?.id || (areas.length === 1 ? areas[0].id : "");
    const periodRecords = sheets(ctx).filter((item) => resolvePeriodId(item, ctx.getPeriodsByType(ctx.FIVE_S_PERIOD_TYPE)) === periodId);
    const getAreaInspectors = (targetAreaId) => {
      if (!targetAreaId) return [];
      const targetRecords = periodRecords.filter((item) => resolveAreaId(item, areas) === targetAreaId);
      return [...new Set(targetRecords.flatMap((item) => parseInspectors(item.inspector)))].slice(0, 2);
    };
    const getAreaInspectionDate = (targetAreaId) => {
      if (!targetAreaId) return "";
      const targetRecords = periodRecords.filter((item) => resolveAreaId(item, areas) === targetAreaId);
      return targetRecords.find((item) => item.inspectionDate)?.inspectionDate || targetRecords[0]?.inspectionDate || "";
    };
    let initN1 = "";
    let initN2 = "";
    if (editing && record?.inspector) {
      const parsed = parseInspectors(record.inspector);
      initN1 = parsed[0] || "";
      initN2 = parsed[1] || "";
      if (!initN2) {
        const areaInspectors = getAreaInspectors(areaId);
        const second = areaInspectors.find((n) => n.toLowerCase() !== initN1.toLowerCase());
        if (second) initN2 = second;
      }
    } else {
      const areaInspectors = getAreaInspectors(areaId);
      initN1 = areaInspectors[0] || "";
      initN2 = areaInspectors[1] || "";
      if (!initN1 && !initN2) {
        initN1 = String(ctx.currentUser?.name || ctx.currentUser?.username || "").trim().slice(0, 20);
      }
    }
    const initialDate = (editing ? record?.inspectionDate : null) || getAreaInspectionDate(areaId) || ctx.todayIsoDate();
    const originalRow = editing ? clone(record.rows[rowIndex]) : null;
    const originalMetadata = editing ? JSON.stringify([record.areaId, record.area, record.inspectionDate, record.inspector, record.periodId]) : null;
    const hasChanged = (target) => !target || JSON.stringify(target.rows?.[rowIndex]) !== JSON.stringify(originalRow)
      || JSON.stringify([target.areaId, target.area, target.inspectionDate, target.inspector, target.periodId]) !== originalMetadata;
    const row = originalRow || blankRow();
    let saving = false;
    ctx.openFormModal({
      title: editing ? writable ? "Sửa vấn đề 5S" : "Chi tiết vấn đề 5S" : "Thêm vấn đề 5S",
      submitText: mobile && editing ? "Lưu thay đổi" : "Lưu vấn đề",
      extraRightActions: mobile && editing ? '<button type="button" class="danger-button" data-delete-issue-modal>Xóa vấn đề</button>' : "",
      modalClass: `safety-record-modal findings-issue-modal${mobile ? " is-mobile-detail" : ""}${mobile && !host.closest(".is-light-theme") ? " is-mobile-dark" : ""}`,
      html: `<div class="modal-context"><span><strong>Kỳ:</strong> ${esc(ctx.periodLabel(ctx.getPeriod(periodId)))}</span><span><strong>Nguồn:</strong> Vấn đề 5S</span></div>
        <div class="findings-page"><div class="safety-record-entry-wrap"><table class="safety-record-entry-table findings-issue-entry-table">
          <thead><tr><th>Zone</th><th>Ngày kiểm tra</th><th>Người kiểm tra</th>${headings.map((heading) => `<th>${heading}</th>`).join("")}</tr></thead>
          <tbody><tr><td data-label="Zone"><select name="areaId" required ${writable ? "" : "disabled"}><option value="">Chọn Zone 5S</option>${areas.map((area) => `<option value="${esc(area.id)}" ${area.id === areaId ? "selected" : ""}>${esc(zoneLabel(area))}</option>`).join("")}</select></td>
          <td data-label="Ngày kiểm tra">${dateEditor(initialDate, 'name="inspectionDate"', writable, esc, true)}</td>
          <td data-label="Người kiểm tra">
            <div class="findings-inspectors-inputs">
              <input name="inspector1" required maxlength="20" placeholder="Người kiểm tra 1" value="${esc(initN1)}" ${writable ? "" : "disabled"}>
              <input name="inspector2" maxlength="20" placeholder="Người kiểm tra 2" value="${esc(initN2)}" ${writable ? "" : "disabled"}>
            </div>
          </td>
          ${fields.map((key, index) => `<td data-label="${esc(headings[index])}">${cell(row, key, 0, headings[index], writable, esc, mobile)}</td>`).join("")}</tr></tbody>
        </table></div></div><p class="findings-modal-error" role="alert"></p>`,
      async onSubmit(_formData, form) {
        if (!writable) { ctx.showToast("Bạn không có quyền sửa, lưu vấn đề 5S này.", true); return false; }
        if (saving) return false;
        const error = form.querySelector(".findings-modal-error");
        error.textContent = "";
        const selected = areas.find((area) => area.id === form.elements.areaId.value);
        const issue = Object.fromEntries(fields.map((key) => [key, form.querySelector(`[data-field="${key}"]`).value.trim()]));
        const inspectionDate = ctx.parseDisplayDateToIso(form.elements.inspectionDate.value);
        if (!selected || !editableAreas(ctx, periodId).some((area) => area.id === selected.id)) { error.textContent = "Vui lòng chọn Zone được phân công."; return false; }
        if (!issue.problem) { error.textContent = "Vui lòng nhập vấn đề 5S."; form.querySelector('[data-field="problem"]').focus(); return false; }
        const n1 = form.elements.inspector1 ? form.elements.inspector1.value.trim().slice(0, 20) : "";
        const n2 = form.elements.inspector2 ? form.elements.inspector2.value.trim().slice(0, 20) : "";
        if (!n1 && !n2) {
          error.textContent = "Vui lòng nhập người kiểm tra (tối đa 2 người, mỗi người tối đa 20 chữ cái).";
          form.elements.inspector1?.focus();
          return false;
        }
        if ((form.elements.inspector1 && form.elements.inspector1.value.trim().length > 20) || (form.elements.inspector2 && form.elements.inspector2.value.trim().length > 20)) {
          error.textContent = "Mỗi tên người kiểm tra tối đa 20 chữ cái.";
          return false;
        }
        const inspector = formatInspectors(n1, n2);
        if (!inspectionDate || !inspector) { error.textContent = "Vui lòng nhập người kiểm tra và ngày hợp lệ (dd/mm/yyyy)."; return false; }
        if (issue.dueDate && !ctx.parseDisplayDateToIso(issue.dueDate)) { error.textContent = "Hạn hoàn thành không hợp lệ (dd/mm/yyyy)."; return false; }
        issue.dueDate = issue.dueDate ? ctx.parseDisplayDateToIso(issue.dueDate) : "";
        const target = editing ? ctx.state.fiveSFindings.find((item) => item.id === record.id) : findMatchingSheet(ctx, periodId, selected.id, inspector, inspectionDate);
        if (editing && hasChanged(target)) { error.textContent = "Vấn đề đã thay đổi. Đóng cửa sổ và mở lại để sửa dữ liệu mới nhất."; return false; }
        if (target && !canEditSheet(ctx, target)) { error.textContent = "Bạn không có quyền thay đổi Zone này."; return false; }
        const metadataChanged = editing && (resolveAreaId(target, areas) !== selected.id || target.inspector !== inspector || target.inspectionDate !== inspectionDate);
        // Legacy records share inspection details across rows. Split only the edited
        // issue when those details change, and persist both records atomically.
        const split = metadataChanged && target.rows.some((item, index) => index !== rowIndex && rowHasContent(item));
        const remaining = split ? clone(target) : null;
        if (remaining) remaining.rows.splice(rowIndex, 1);
        const data = target && !split ? clone(target) : fresh(ctx, periodId);
        data.periodId = periodId;
        data.areaId = selected.id;
        data.area = zoneLabel(selected);
        if (editing || !target) { data.inspector = inspector; data.inspectionDate = inspectionDate; }
        let index = editing && !split ? rowIndex : data.rows.findIndex((item) => !rowHasContent(item));
        if (index < 0) index = data.rows.length;
        data.rows[index] = issue;
        data.createdAt ||= new Date().toISOString();
        data.updatedAt = new Date().toISOString();
        data.updatedBy = ctx.currentUser.id;
        saving = true;
        const controls = [...ctx.elements.modalBackdrop.querySelectorAll("button, input, select, textarea")].map((el) => [el, el.disabled]);
        controls.forEach(([el]) => { el.disabled = true; });
        try {
          const updates = remaining ? [remaining, data] : [data];
          if (remaining) {
            remaining.periodId = periodId;
            remaining.areaId = resolveAreaId(target, areas);
            remaining.updatedAt = data.updatedAt;
            remaining.updatedBy = data.updatedBy;
            await ctx.saveFiveSFindingsBatch(updates);
          } else await ctx.saveFiveSFinding(data);
          ctx.state.fiveSFindings = [...ctx.state.fiveSFindings.filter((item) => !updates.some((updated) => updated.id === item.id)), ...updates];
          if (editing && view.zoneFilter) view.zoneFilter = `id:${selected.id}`;
          view.selectedId = data.id;
          view.showDetail = false;
          view.issueIndex = null;
          view.notice = null;
          render(host, view);
          message(host, editing ? "Đã cập nhật vấn đề 5S." : "Đã thêm vấn đề 5S.");
          return true;
        } catch (failure) {
          error.textContent = "Không lưu được vấn đề. Vui lòng thử lại.";
          return false;
        } finally {
          saving = false;
          controls.forEach(([el, disabled]) => { el.disabled = disabled; });
        }
      },
    });
    const form = ctx.elements.modalBody.querySelector("form");
    if (writable) form.querySelector('[data-field="problem"]').required = true;
    if (!writable) {
      if (!mobile) ctx.elements.modalActions.querySelector('[type="submit"]')?.remove();
      form.querySelector(".findings-modal-error").textContent = "Chỉ xem — bạn không có quyền sửa, lưu hoặc xóa vấn đề 5S này.";
      ctx.elements.modalActions.querySelector('[data-action="modal-cancel"]').textContent = "Đóng";
    } else if (mobile && editing) {
      ctx.elements.modalActions.querySelector('[data-action="modal-cancel"]')?.remove();
      const deleteButton = ctx.elements.modalActions.querySelector("[data-delete-issue-modal]");
      if (deleteButton) ctx.elements.modalActions.querySelector('[type="submit"]').before(deleteButton);
    }
    ctx.elements.modalActions.querySelector("[data-delete-issue-modal]")?.addEventListener("click", async () => {
      if (!canEditSheet(ctx, record)) { ctx.showToast("Bạn không có quyền xóa vấn đề 5S này.", true); return; }
      if (saving) return;
      const target = ctx.state.fiveSFindings.find((item) => item.id === record.id);
      const error = form.querySelector(".findings-modal-error");
      if (hasChanged(target) || !canEditSheet(ctx, target)) {
        error.textContent = "Vấn đề đã thay đổi hoặc bạn không còn quyền sửa. Đóng cửa sổ và mở lại.";
        return;
      }
      if (!window.confirm("Xóa vấn đề 5S này?")) return;
      const data = clone(target);
      data.rows.splice(rowIndex, 1);
      data.updatedAt = new Date().toISOString();
      data.updatedBy = ctx.currentUser.id;
      saving = true;
      const controls = [...ctx.elements.modalBackdrop.querySelectorAll("button, input, select, textarea")].map((el) => [el, el.disabled]);
      controls.forEach(([el]) => { el.disabled = true; });
      try {
        await ctx.saveFiveSFinding(data);
        ctx.state.fiveSFindings = ctx.state.fiveSFindings.map((item) => item.id === data.id ? data : item);
        ctx.closeModal();
        render(host, view);
        message(host, "Đã xóa vấn đề 5S.");
      } catch (failure) {
        error.textContent = "Không xóa được vấn đề. Vui lòng thử lại.";
      } finally {
        saving = false;
        controls.forEach(([el, disabled]) => { el.disabled = disabled; });
      }
    });
    form.querySelectorAll(".findings-date-editor").forEach((wrap) => {
      const input = wrap.querySelector("[data-finding-date]");
      const calendar = wrap.querySelector(".findings-date-calendar");
      if (!calendar) return;
      input.addEventListener("input", () => { calendar.value = ctx.parseDisplayDateToIso(input.value) || ""; });
      calendar.addEventListener("input", () => { input.value = displayDate(calendar.value); });
      calendar.addEventListener("change", () => { input.value = displayDate(calendar.value); });
    });
    form.elements.areaId?.addEventListener("change", (event) => {
      const selectedId = event.target.value;
      if (!selectedId) return;
      const [n1, n2] = getAreaInspectors(selectedId);
      if (form.elements.inspector1) form.elements.inspector1.value = n1 || String(ctx.currentUser?.name || ctx.currentUser?.username || "").trim().slice(0, 20);
      if (form.elements.inspector2) form.elements.inspector2.value = n2 || "";
      const date = getAreaInspectionDate(selectedId) || ctx.todayIsoDate();
      if (form.elements.inspectionDate) {
        form.elements.inspectionDate.value = displayDate(date);
        const calendar = form.querySelector(".findings-date-calendar");
        if (calendar) calendar.value = date;
      }
    });
    form.querySelector('[data-field="progress"]')?.addEventListener("change", (event) => {
      event.target.parentElement.querySelector(".findings-progress")?.style.setProperty("--progress", `${event.target.value}%`);
    });
    if (writable && (editing || areaId) && !mobile) (form.querySelector('[data-field="location"]') || form.querySelector('[data-field="problem"]'))?.focus();
  }

  function mobileList(records, periodRecords, esc) {
    const issues = records.flatMap((sheet) => (sheet.rows || []).map((row, index) => ({ sheet, row, index })).filter(({ row }) => rowHasContent(row)));
    const total = periodRecords.reduce((count, sheet) => count + (sheet.rows || []).filter(rowHasContent).length, 0);
    return `<section class="findings-mobile-list" aria-label="Danh sách vấn đề 5S">
      <div class="findings-list-heading"><h3>VẤN ĐỀ 5S ĐÃ GHI NHẬN</h3><span>${issues.length === total ? `${total} vấn đề` : `${issues.length} / ${total} vấn đề trong kỳ`}</span></div>
      ${issues.length ? issues.map(({ sheet, row, index }) => {
        const complete = Number(row.progress) === 100;
        return `<button type="button" class="findings-record-card" data-open-finding="${esc(sheet.id)}" data-issue-index="${index}">
          <span class="findings-record-icon" aria-hidden="true">▤</span>
          <span class="findings-record-copy"><strong>${esc(shortZoneLabel(sheet.area) || "Chưa chọn Zone")}</strong><span>${esc(row.problem || "Vấn đề 5S")}</span><small>${esc(displayDate(sheet.inspectionDate))}</small></span>
          <span class="findings-status ${complete ? "is-done" : ""}">${complete ? "Hoàn thành" : "Đang xử lý"}</span><span aria-hidden="true">›</span>
        </button>`;
      }).join("") : '<div class="findings-empty"><span aria-hidden="true">▤</span><strong>Chưa có vấn đề trong kỳ này</strong><p>Điền thông tin ở trên để ghi nhận vấn đề 5S.</p></div>'}
    </section>`;
  }

  function mobileForm(sheet, ctx, editing, view, valueInput) {
    const esc = ctx.escapeHtml;
    const field = (label, input, wide = false) => `<label class="findings-mobile-field ${wide ? "is-wide" : ""}"><span>${label}</span>${input}</label>`;
    const labels = ["Vị trí", "Vấn đề phát hiện", "Hạng mục", "Ca làm việc", "Biện pháp khắc phục", "Hạn hoàn thành", "Tiến độ"];
    const selectedIndex = editing ? view.editIssueIndex : view.issueIndex;
    const rows = (sheet.rows || []).map((row, index) => ({ row, index }))
      .filter(({ row, index }) => (editing || rowHasContent(row)) && (!Number.isInteger(selectedIndex) || index === selectedIndex));
    return `<div class="findings-mobile-meta">
      <div class="mobile-info-banner"><strong>${editing ? "Ghi nhận vấn đề 5S" : "Chi tiết vấn đề 5S"}</strong><span>${esc(ctx.periodLabel(ctx.getPeriod(sheet.periodId)))}</span></div>
      <div class="findings-mobile-grid">
        ${field("Khu vực (Zone) *", zoneInput(sheet, ctx, editing, esc))}
        ${field("Ngày kiểm tra *", valueInput("inspectionDate", sheet.inspectionDate, "date", true))}
        ${field("Người kiểm tra *", `
          <div class="findings-inspectors-inputs">
            <input name="inspector1" value="${esc(parseInspectors(sheet.inspector)[0] || "")}" maxlength="20" placeholder="Người kiểm tra 1" required ${editing ? "" : "disabled"}>
            <input name="inspector2" value="${esc(parseInspectors(sheet.inspector)[1] || "")}" maxlength="20" placeholder="Người kiểm tra 2" ${editing ? "" : "disabled"}>
          </div>
        `, true)}
      </div>
    </div>
    <div class="findings-list-heading"><h3>VẤN ĐỀ PHÁT HIỆN</h3><span>${rows.length} vấn đề</span></div>
    <div class="findings-issue-list">${rows.map(({ row, index }) => `<details class="findings-issue-card" ${!editing || Number.isInteger(selectedIndex) || index === (view.openRow || 0) ? "open" : ""}>
      <summary><span class="findings-issue-number">${index + 1}</span><span>${esc(row.problem || "Vấn đề mới")}</span><span class="findings-status ${Number(row.progress) === 100 ? "is-done" : ""}">${Number(row.progress) || 0}%</span></summary>
      <div class="findings-mobile-grid">${fields.map((key, col) => field(labels[col], cell(row, key, index, labels[col], editing, esc, true), ["location", "problem", "countermeasure"].includes(key))).join("")}</div>
      ${editing ? `<button type="button" class="findings-remove-issue" data-remove-row="${index}" aria-label="Xóa vấn đề ${index + 1}">Xóa vấn đề</button>` : ""}
    </details>`).join("")}</div>`;
  }

  function cell(row, key, index, label, editing, esc, mobile = false) {
    const value = String(row[key] ?? (key === "progress" ? "0" : ""));
    const attrs = `data-row="${index}" data-field="${key}" aria-label="Dòng ${index + 1}: ${label}"`;
    const options = (items) => items.map(([id, text]) => `<option value="${esc(id)}" ${value === id ? "selected" : ""}>${esc(text)}</option>`).join("");
    if (key === "progress") {
      const progress = ["0", "25", "50", "75", "100"].includes(value) ? value : "0";
      return `<div class="findings-progress" style="--progress:${progress}%" aria-hidden="true"></div>${editing ? `<select ${attrs}>${options(["0", "25", "50", "75", "100"].map((v) => [v, v + "%"]))}</select>` : `<span>${progress}%</span>`}`;
    }
    if (key === "dueDate") return dateEditor(value, attrs, editing, esc);
    if (!editing) {
      if (key === "fiveS") return `<span>${esc(findingCategoryLabel(value))}</span>`;
      return `<span>${esc(value)}</span>`;
    }
    if (key === "fiveS") {
      const selectedId = findingCategoryNormalized(value);
      return `<select ${attrs}><option value="">Chưa chọn</option>${FINDING_CATEGORIES.map(([id, text]) => `<option value="${esc(text)}" ${selectedId === id || value === text ? "selected" : ""}>${esc(text)}</option>`).join("")}</select>`;
    }
    if (mobile && ["location", "shift"].includes(key)) return `<input type="text" ${attrs} value="${esc(value)}" maxlength="2000">`;
    return `<textarea ${attrs} rows="3" maxlength="2000">${esc(value)}</textarea>`;
  }

  function collect(form, view) {
    if (!view.draft) return;
    for (const key of ["areaId", "periodId"]) view.draft[key] = form.elements[key] ? form.elements[key].value.trim() : (view.draft[key] || "");
    if (form.elements.inspector1) {
      view.draft.inspector = formatInspectors(form.elements.inspector1.value, form.elements.inspector2?.value);
    } else if (form.elements.inspector) {
      view.draft.inspector = form.elements.inspector.value.trim();
    }
    const area = view.ctx.getAreasForPeriod(view.draft.periodId).find((item) => item.id === view.draft.areaId);
    if (area) view.draft.area = `Zone ${area.code}`;
    const readDate = (input) => view.ctx.parseDisplayDateToIso(input.value) || input.value.trim();
    view.draft.inspectionDate = readDate(form.elements.inspectionDate);
    form.querySelectorAll("[data-row][data-field]").forEach((input) => {
      view.draft.rows[Number(input.dataset.row)] ||= blankRow();
      view.draft.rows[Number(input.dataset.row)][input.dataset.field] = input.dataset.field === "dueDate" ? readDate(input) : input.value.trim();
    });
  }

  function dateEditor(value, attrs, editing, esc, required = false) {
    return `<span class="findings-date-editor"><input type="text" ${attrs} data-finding-date value="${esc(displayDate(value))}" placeholder="${editing ? "dd/mm/yyyy" : ""}" inputmode="numeric" maxlength="10" ${required ? "required" : ""} ${editing ? "" : "disabled"}>
      ${editing ? `<input type="date" class="findings-date-calendar" aria-label="Mở lịch chọn ngày" value="${/^\d{4}-\d{2}-\d{2}$/.test(value) ? esc(value) : ""}" tabindex="0">` : ""}</span>`;
  }

  function message(host, text, error = false) {
    const view = views.get(host);
    if (view) view.notice = { text, error };
    if (view?.ctx?.showToast && text && text !== "Đang lưu...") {
      view.ctx.showToast(text, error);
    }
    const el = host.querySelector(".findings-message");
    if (el) {
      el.textContent = text;
      el.classList.toggle("is-error", error);
    }
  }

  async function perform(host, view, action, success) {
    view.busy = true;
    host.querySelectorAll("button, input, select, textarea").forEach((el) => { el.disabled = true; });
    message(host, "Đang lưu...");
    try {
      await action();
      view.busy = false;
      render(host, view);
      message(host, success);
    } catch (error) {
      view.busy = false;
      render(host, view);
      message(host, "Không lưu được phiếu. Vui lòng thử lại.", true);
    }
  }

  window.FiveSFindingsPage = { mount, resolvePeriodId, resolveAreaId, findingCategoryLabel, FINDING_CATEGORIES, parseInspectors, formatInspectors };
  window.PageRegistry.register({ id: "five-s-findings", title: "Vấn đề 5S", render: (ctx) => mount(document.getElementById("tab-five-s-findings"), ctx) });
})();
