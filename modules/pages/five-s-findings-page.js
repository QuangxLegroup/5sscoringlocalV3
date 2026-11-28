(() => {
  "use strict";

  const views = new WeakMap();
  const ROWS_PER_PAGE = 10;
  const FINDINGS_PAGE_SIZE = 25;
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
  const countermeasureFields = new Set(["countermeasure", "dueDate", "progress"]);
  const headings = ["Vị trí", "Vấn đề / Problem", "Hạng mục", "Ca / Shift", "Biện pháp khắc phục / CM", "Hạn / Due date", "Tiến độ / Progress"];
  const clone = (value) => JSON.parse(JSON.stringify(value));
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
  const canEdit = (ctx) => Boolean(ctx.currentUser && (ctx.isAdminAccount(ctx.currentUser) || ctx.hasAt5sRole?.(ctx.currentUser)
    || ctx.isDepartmentHeadAccount(ctx.currentUser)
    || ctx.hasDepartmentHeadRole?.(ctx.currentUser, ctx.getActivePeriodId?.(ctx.FIVE_S_PERIOD_TYPE))
    || (ctx.hasAccountAccessType(ctx.currentUser, ctx.FIVE_S_PERIOD_TYPE) && (ctx.isZoneOwnerAccount(ctx.currentUser, ctx.FIVE_S_PERIOD_TYPE) || ctx.isFiveSAssessor(ctx.currentUser)))));
  const canManageFindingCountermeasure = (ctx, sheet) => Boolean(ctx.canManageFiveSFindingCountermeasure?.(sheet, ctx.currentUser));
  const canEditFinding = (ctx, sheet) => canEditSheet(ctx, sheet) || canManageFindingCountermeasure(ctx, sheet);
  const canEditPeriod = (ctx, periodId) => canEdit(ctx) && Boolean(periodId && ctx.getPeriod(periodId) && !ctx.getPeriod(periodId).archived && (typeof ctx.isPeriodOpen === "function" ? ctx.isPeriodOpen(periodId, ctx.FIVE_S_PERIOD_TYPE) : ctx.getActivePeriodId(ctx.FIVE_S_PERIOD_TYPE) === periodId));
  const sortedAreas = (ctx, periodId) => [...ctx.getAreasForPeriod(periodId)].sort((a, b) => {
    if (typeof ctx?.compareZoneCodesByOrder === "function") return ctx.compareZoneCodesByOrder(a, b);
    if (typeof window !== "undefined" && window.CustomDropdown?.compareZoneCodesByOrder) {
      return window.CustomDropdown.compareZoneCodesByOrder(a, b);
    }
    return String(a.code).localeCompare(String(b.code), "vi", { numeric: true });
  });
  const editableAreas = (ctx, periodId) => sortedAreas(ctx, periodId).filter((area) => ctx.isAdminAccount(ctx.currentUser)
    || (canEditPeriod(ctx, periodId) && (ctx.hasAt5sRole?.(ctx.currentUser) || ctx.getAllowedAreaIds(ctx.currentUser, periodId).has(area.id))));
  const canEditSheet = (ctx, sheet) => {
    if (!canEdit(ctx) || !sheet) return false;
    if (ctx.isAdminAccount(ctx.currentUser)) return true;
    const periodId = resolvePeriodId(sheet, ctx.getPeriodsByType(ctx.FIVE_S_PERIOD_TYPE));
    if (!periodId || !ctx.getPeriod(periodId)) return false;
    const isAssessorOrAt5s = Boolean(
      ctx.hasAt5sRole?.(ctx.currentUser)
      || (ctx.hasAccountAccessType?.(ctx.currentUser, ctx.FIVE_S_PERIOD_TYPE)
        && ctx.getAccountRolesForType?.(ctx.currentUser, ctx.FIVE_S_PERIOD_TYPE, periodId)?.includes?.("assessor5s"))
    );
    if (canManageFindingCountermeasure(ctx, sheet) && !isAssessorOrAt5s) return false;
    if (!canEditPeriod(ctx, periodId)) return false;
    const areas = editableAreas(ctx, periodId);
    return Boolean(ctx.hasAt5sRole?.(ctx.currentUser)) || Boolean(resolveAreaId(sheet, areas));
  };
  const blankRow = () => Object.fromEntries(fields.map((key) => [key, key === "progress" ? "0" : ""]));
  const UNASSIGNED = "unassigned";
  const displayDate = (value) => String(value || "").replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1");
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
  const cleanFindingDraftPhotoUrl = (url) => {
    const val = String(url || "").trim();
    if (!val || val.startsWith("blob:") || (typeof window !== "undefined" && (val === window.location.href || val === window.location.origin + "/"))) return "";
    if (val.startsWith("data:image/") || val.startsWith("/api/photos/") || val.includes("/api/photos/")) return val;
    return val;
  };
  function areFindingRowsEqual(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    for (const k of fields) {
      if (k === "dueDate") {
        if (displayDate(a.dueDate) !== displayDate(b.dueDate)) return false;
      } else if (k === "fiveS") {
        if (findingCategoryNormalized(a.fiveS) !== findingCategoryNormalized(b.fiveS)) return false;
      } else if (k === "progress") {
        if (String(Number(a.progress) || 0) !== String(Number(b.progress) || 0)) return false;
      } else {
        if (String(a[k] || "").trim() !== String(b[k] || "").trim()) return false;
      }
    }
    if (cleanFindingDraftPhotoUrl(a.photoDataUrl) !== cleanFindingDraftPhotoUrl(b.photoDataUrl)) return false;
    if (cleanFindingDraftPhotoUrl(a.afterPhotoDataUrl) !== cleanFindingDraftPhotoUrl(b.afterPhotoDataUrl)) return false;
    if (String(a.afterPhotoName || "") !== String(b.afterPhotoName || "")) return false;
    if (JSON.stringify(a.photoAnnotations || []) !== JSON.stringify(b.photoAnnotations || [])) return false;
    if (JSON.stringify(a.afterPhotoAnnotations || []) !== JSON.stringify(b.afterPhotoAnnotations || [])) return false;
    return true;
  }
  function photoImageAttributes(row, esc, metadata = {}) {
    const photoField = metadata.photoField || "photoDataUrl";
    const annotationField = photoField === "afterPhotoDataUrl" ? "afterPhotoAnnotations" : "photoAnnotations";
    const annotations = JSON.stringify(row?.[annotationField] || []);
    return `data-safety-annotations="${esc(annotations)}" data-finding-photo-sheet-id="${esc(metadata.sheetId || "")}" data-finding-photo-row-index="${Number.isInteger(metadata.rowIndex) ? metadata.rowIndex : ""}" data-finding-photo-url="${esc(row?.[photoField] || "")}" data-finding-photo-field="${esc(photoField)}" data-finding-photo-editable="${metadata.editable ? "true" : "false"}"`;
  }
  function photoPreview(row, esc, metadata = {}) {
    const photoField = metadata.photoField || "photoDataUrl";
    const isAfterPhoto = photoField === "afterPhotoDataUrl";
    const photoUrl = row?.[photoField];
    const alt = isAfterPhoto ? "Ảnh sau xử lý" : "Ảnh vấn đề 5S";
    return photoUrl
      ? `<img class="findings-photo-thumb" src="${esc(photoThumbnailUrl(photoUrl))}" data-photo-fallback-src="${esc(photoUrl)}" data-preview-img="${esc(photoUrl)}" loading="lazy" decoding="async" alt="${alt}" ${photoImageAttributes(row, esc, metadata)}>`
      : '<span class="findings-photo-empty">Chưa có ảnh</span>';
  }
  function photoEditorWidget(row, editing, esc, metadata = {}, mobile = false) {
    const photoField = metadata.photoField || "photoDataUrl";
    const isAfterPhoto = photoField === "afterPhotoDataUrl";
    const inputName = isAfterPhoto ? "findingAfterPhoto" : "findingPhoto";
    const removeName = isAfterPhoto ? "removeFindingAfterPhoto" : "removeFindingPhoto";
    const hasPhoto = Boolean(row?.[photoField]);
    const photoLabel = metadata.photoLabel || (isAfterPhoto ? (mobile ? "Ảnh sau cải tiến, xử lý" : "Ảnh sau xử lý") : "Ảnh vấn đề 5S");
    return `<div class="photo-upload-box photo-edit-widget findings-photo-editor ${isAfterPhoto ? "findings-after-photo-editor" : ""} ${mobile ? "findings-mobile-photo-upload" : ""} ${hasPhoto ? "has-photo" : ""} ${editing ? "is-editable" : "is-disabled"}" data-finding-photo-field="${photoField}">
      <input name="${inputName}" type="file" accept="image/*" capture="environment" class="photo-file-input ${hasPhoto ? "is-hidden" : ""}" ${editing ? "" : "disabled"}>
      <div class="photo-placeholder photo-editor-empty ${hasPhoto ? "is-hidden" : ""}">
        <div class="photo-icon-circle"><i class="fa-solid fa-camera"></i></div>
        <p class="photo-primary-prompt">${photoLabel}</p>
        <p class="photo-sub-prompt">Chụp ảnh hoặc tải ảnh minh họa</p>
        <button type="button" class="photo-action-chip" data-finding-add ${editing ? "" : "disabled"}><i class="fa-solid fa-plus"></i> Thêm ảnh</button>
      </div>
      <div class="photo-preview-wrap ${hasPhoto ? "" : "is-hidden"}">
        <img class="photo-preview-img findings-photo-thumb" data-findings-photo-preview data-preview-img="${hasPhoto ? esc(row[photoField]) : ""}" ${hasPhoto ? `src="${esc(row[photoField])}" ${photoImageAttributes(row, esc, { ...metadata, photoField })}` : `data-finding-photo-field="${photoField}" hidden`} alt="${photoLabel}" title="Chạm để phóng to ảnh">
        <div class="photo-preview-actions">
          <button type="button" class="photo-btn annotate-btn" data-finding-annotate title="Vẽ nét & chú thích ảnh" aria-label="Vẽ nét & chú thích ảnh" ${editing && hasPhoto ? "" : "hidden"}><i class="fa-solid fa-pen-to-square"></i></button>
          <button type="button" class="photo-btn open-btn" data-finding-open title="Mở ảnh lớn" aria-label="Mở ${photoLabel.toLocaleLowerCase("vi")}" ${hasPhoto ? "" : "hidden"}><i class="fa-solid fa-expand"></i></button>
          <button type="button" class="photo-btn retake-btn" data-finding-retake title="Đổi ảnh" aria-label="Đổi ${photoLabel.toLocaleLowerCase("vi")}" ${editing && hasPhoto ? "" : "hidden"}><i class="fa-solid fa-arrows-rotate"></i></button>
          <button type="button" class="photo-btn delete-btn" data-finding-remove title="Xóa ảnh" aria-label="Xóa ${photoLabel.toLocaleLowerCase("vi")}" ${editing && hasPhoto ? "" : "hidden"}><i class="fa-solid fa-trash-can"></i></button>
        </div>
        <div class="photo-attached-badge"><i class="fa-solid fa-circle-check"></i> Đã đính kèm ảnh</div>
      </div>
      <input type="checkbox" name="${removeName}" hidden aria-hidden="true">
    </div>`;
  }
  function photoEditor(row, editing, esc, metadata = {}) { return photoEditorWidget(row, editing, esc, metadata); }
  function mobilePhotoEditor(row, editing, esc, metadata = {}) { return photoEditorWidget(row, editing, esc, metadata, true); }
  function bindFindingPhotoImages(root, ctx, row = null, metadata = {}) {
    root?.querySelectorAll?.("img.findings-photo-thumb, img.findings-record-thumb").forEach((image) => {
      const readAnnotations = () => {
        try { return JSON.parse(image.dataset.safetyAnnotations || "[]"); } catch (_) { return []; }
      };
      const saveAnnotations = async (annotations) => {
        const sheetId = image.dataset.findingPhotoSheetId || "";
        const rowIndex = Number(image.dataset.findingPhotoRowIndex);
        const photoField = image.dataset.findingPhotoField || metadata.photoField || "photoDataUrl";
        const annotationField = photoField === "afterPhotoDataUrl" ? "afterPhotoAnnotations" : "photoAnnotations";
        const pending = image.dataset.findingPhotoSourcePending === "true";
        if (!pending && sheetId && Number.isInteger(rowIndex)) {
          await ctx.saveFiveSFindingPhotoAnnotations(sheetId, rowIndex, annotations, image.dataset.findingPhotoUrl || "", photoField);
        }
        if (row && (!pending || metadata.preserveOriginal !== true)) row[annotationField] = annotations;
        const serialized = JSON.stringify(annotations);
        image.dataset.safetyAnnotations = serialized;
        image.dataset.findingPhotoAnnotations = serialized;
        window.refreshSafetyPhotoAnnotationThumbnail?.(image, annotations);
        metadata.onAnnotationsSaved?.(annotations, { pending, image, photoField });
        return true;
      };
      if (typeof image.__findingPhotoAnnotationSave !== "function") image.__findingPhotoAnnotationSave = saveAnnotations;
      if (!image.dataset.findingPhotoEditable) image.dataset.findingPhotoEditable = "false";
      const openImage = () => {
        const src = image.dataset.previewImg || image.currentSrc || image.src;
        if (!src) return;
        const options = {
          initialCircles: readAnnotations(),
          editable: image.dataset.findingPhotoEditable === "true" || image.dataset.findingPhotoSourcePending === "true",
          onSave: saveAnnotations,
          onError: (error) => ctx.showToast(error?.message || "Không lưu được nét khoanh.", true),
        };
        if (typeof window.openMobileImageModal === "function") {
          window.openMobileImageModal(src, options);
          return;
        }
        if (typeof window.openImageFullscreenModal === "function") {
          window.openImageFullscreenModal(image);
          return;
        }

        const viewer = document.createElement("div");
        viewer.className = "mobile-image-modal-fullscreen";
        const backdrop = document.createElement("div");
        backdrop.className = "mobile-image-fullscreen-backdrop";
        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "mobile-image-fullscreen-close";
        closeButton.setAttribute("aria-label", "Đóng ảnh");
        closeButton.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        const container = document.createElement("div");
        container.className = "mobile-image-fullscreen-container";
        const imagePreview = document.createElement("img");
        imagePreview.className = "mobile-image-fullscreen-img";
        imagePreview.alt = "Ảnh vấn đề 5S";
        imagePreview.src = src;
        const stage = document.createElement("div");
        stage.className = "mobile-image-fullscreen-stage";
        stage.appendChild(imagePreview);
        container.appendChild(stage);
        const viewerInteractions = window.mountImageViewerInteractions?.(viewer, stage);
        const closeViewer = () => { viewerInteractions?.destroy(); viewer.remove(); };
        backdrop.addEventListener("click", closeViewer);
        closeButton.addEventListener("click", closeViewer);
        viewer.append(backdrop, closeButton, container);
        document.body.appendChild(viewer);
      };
      image.__findingPhotoOpen = openImage;
      if (image.dataset.findingPhotoClickBound !== "true") {
        image.dataset.findingPhotoClickBound = "true";
        image.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openImage();
        });
      }
    });
  }
  function bindPhotoEditor(form, ctx, row, metadata = {}) {
    const photoInputs = [
      { name: "findingPhoto", removeName: "removeFindingPhoto", photoField: "photoDataUrl", annotationField: "photoAnnotations" },
      { name: "findingAfterPhoto", removeName: "removeFindingAfterPhoto", photoField: "afterPhotoDataUrl", annotationField: "afterPhotoAnnotations" },
    ];
    photoInputs.forEach((config) => {
      form.querySelectorAll(`input[name="${config.name}"]`).forEach((input) => input.addEventListener("change", () => {
        const file = input.files?.[0];
        const editor = input.closest(".photo-edit-widget");
        const preview = editor?.querySelector("[data-findings-photo-preview]");
        if (!file || !preview) return;
        const photoEditable = config.photoField === "afterPhotoDataUrl"
          ? Boolean(metadata.afterPhotoEditable ?? metadata.editable)
          : Boolean(metadata.editable);
        const remove = editor.querySelector(`input[name="${config.removeName}"]`);
        if (remove) remove.checked = false;
        const reader = new FileReader();
        reader.onload = () => {
          const src = String(reader.result || "");
          if (row && metadata.preserveOriginal !== true) {
            row[config.photoField] = src;
            row[config.annotationField] = [];
          }
          metadata.onPhotoReplaced?.(config.photoField, src);
          preview.src = src;
          preview.dataset.photoSrc = "";
          preview.dataset.previewImg = src;
          preview.dataset.safetyAnnotations = "[]";
          preview.dataset.findingPhotoAnnotations = "[]";
          preview.dataset.findingPhotoField = config.photoField;
          preview.dataset.findingPhotoSourcePending = "true";
          preview.dataset.findingPhotoSheetId = "";
          preview.dataset.findingPhotoRowIndex = "";
          preview.dataset.findingPhotoUrl = "";
          preview.dataset.findingPhotoEditable = photoEditable ? "true" : "false";
          preview.hidden = false;
          editor.querySelector(".photo-preview-wrap")?.classList.remove("is-hidden");
          editor.querySelector(".photo-editor-empty")?.classList.add("is-hidden");
          input.classList.add("is-hidden");
          editor.querySelector("[data-finding-annotate]")?.toggleAttribute("hidden", !photoEditable);
          editor.querySelector("[data-finding-open]")?.removeAttribute("hidden");
          editor.querySelector("[data-finding-retake]")?.toggleAttribute("hidden", !photoEditable);
          editor.querySelector("[data-finding-remove]")?.toggleAttribute("hidden", !photoEditable);
          editor.classList.add("has-photo");
          window.refreshSafetyPhotoAnnotationThumbnail?.(preview, []);
        };
        reader.readAsDataURL(file);
      }));
      form.querySelectorAll(`input[name="${config.removeName}"]`).forEach((input) => input.addEventListener("change", () => {
        const editor = input.closest(".photo-edit-widget");
        const preview = editor?.querySelector("[data-findings-photo-preview]");
        if (!editor || !preview) return;
        if (input.checked && row && metadata.preserveOriginal !== true) {
          row[config.photoField] = "";
          row[config.annotationField] = [];
        }
        editor.querySelector(".photo-preview-wrap")?.classList.toggle("is-hidden", input.checked);
        editor.querySelector(".photo-editor-empty")?.classList.toggle("is-hidden", !input.checked);
        preview.hidden = input.checked;
        editor.querySelector(`input[name="${config.name}"]`)?.classList.toggle("is-hidden", !input.checked);
        editor.classList.toggle("has-photo", !input.checked);
      }));
    });
    bindFindingPhotoImages(form, ctx, row, metadata);
    form.querySelectorAll(".photo-edit-widget").forEach((editor) => {
      const photoField = editor.dataset.findingPhotoField || "photoDataUrl";
      const isAfterPhoto = photoField === "afterPhotoDataUrl";
      const annotationField = isAfterPhoto ? "afterPhotoAnnotations" : "photoAnnotations";
      const photoEditable = isAfterPhoto
        ? Boolean(metadata.afterPhotoEditable ?? metadata.editable)
        : Boolean(metadata.editable);
      const input = editor.querySelector(isAfterPhoto ? 'input[name="findingAfterPhoto"]' : 'input[name="findingPhoto"]');
      const preview = editor.querySelector("[data-findings-photo-preview]");
      const placeholder = editor.querySelector(".photo-placeholder");
      const previewWrap = editor.querySelector(".photo-preview-wrap");
      const remove = editor.querySelector(isAfterPhoto ? 'input[name="removeFindingAfterPhoto"]' : 'input[name="removeFindingPhoto"]');
      const add = editor.querySelector("[data-finding-add]");
      const annotate = editor.querySelector("[data-finding-annotate]");
      const open = editor.querySelector("[data-finding-open]");
      const retake = editor.querySelector("[data-finding-retake]");
      const deleteButton = editor.querySelector("[data-finding-remove]");
      const choosePhoto = () => {
        if (!photoEditable || input?.disabled) return;
        input?.click();
      };
      const setPhoto = (src, annotations = row?.[annotationField] || []) => {
        if (!preview) return;
        preview.src = src;
        preview.dataset.previewImg = src;
        preview.dataset.findingPhotoField = photoField;
        preview.dataset.safetyAnnotations = JSON.stringify(annotations);
        preview.dataset.findingPhotoAnnotations = JSON.stringify(annotations);
        preview.hidden = false;
        previewWrap?.classList.remove("is-hidden");
        placeholder?.classList.add("is-hidden");
        editor.classList.add("has-photo");
        input?.classList.add("is-hidden");
        if (annotate) annotate.hidden = !photoEditable;
        if (open) open.hidden = false;
        if (retake) retake.hidden = !photoEditable;
        if (deleteButton) deleteButton.hidden = !photoEditable;
        if (remove) remove.hidden = true;
      };
      add?.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); choosePhoto(); });
      annotate?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        preview?.__findingPhotoOpen?.();
      });
      open?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        preview?.__findingPhotoOpen?.();
      });
      retake?.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); choosePhoto(); });
      deleteButton?.addEventListener("click", (event) => {
        event.preventDefault(); event.stopPropagation();
        if (remove) { remove.checked = true; remove.dispatchEvent(new Event("change", { bubbles: true })); }
        input.value = "";
        previewWrap?.classList.add("is-hidden");
        placeholder?.classList.remove("is-hidden");
        editor.classList.remove("has-photo");
        input?.classList.remove("is-hidden");
      });
      if (preview && row?.[photoField]) setPhoto(row[photoField]);
    });
  }
  function resolvePeriodId(sheet, periods) {
    if (sheet?.periodId) {
      if (Array.isArray(periods) && periods.some((p) => p.id === sheet.periodId)) return sheet.periodId;
      if (!Array.isArray(periods) || !periods.length) return sheet.periodId;
    }
    const text = String(sheet?.inspectionDate || "").trim();
    const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
    const displayMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
    const year = isoMatch ? Number(isoMatch[1]) : displayMatch ? Number(displayMatch[3]) : null;
    const month = isoMatch ? Number(isoMatch[2]) : displayMatch ? Number(displayMatch[2]) : null;
    if (Number.isInteger(year) && Number.isInteger(month) && Array.isArray(periods)) {
      const found = periods.find((period) => Number(period.year) === year && Number(period.month) === month);
      if (found?.id) return found.id;
    }
    return sheet?.periodId || "";
  }
  const sheets = (ctx) => [...(ctx.state.fiveSFindings || [])].sort(compareFindingsNewestFirst);
  const zoneLabel = (area) => `Zone ${area.code}`;
  const shortZoneLabel = (value) => String(value || "").split("·")[0].trim();
  const rowHasContent = (row) => Boolean(row?.photoDataUrl) || fields.some((key) => key === "progress" ? Number(row[key]) > 0 : Boolean(row[key]));
  const findingRowIdentity = (row) => [row?.location, row?.problem, findingCategoryNormalized(row?.fiveS), row?.shift, cleanFindingDraftPhotoUrl(row?.photoDataUrl)]
    .map((value) => String(value || "").trim().toLocaleLowerCase("vi")).join("|");
  function monthKeyFromDate(value) {
    const text = String(value || "").trim();
    const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
    if (isoMatch) return `${isoMatch[1]}-${String(Number(isoMatch[2])).padStart(2, "0")}`;
    const displayMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    return displayMatch ? `${displayMatch[3]}-${String(Number(displayMatch[2])).padStart(2, "0")}` : "";
  }
  function monthKeyFromPeriod(period) {
    const year = Number(period?.year);
    const month = Number(period?.month);
    if (Number.isInteger(year) && year > 0 && Number.isInteger(month) && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}`;
    }
    const idMatch = /5s-(\d{4})-(\d{1,2})/i.exec(String(period?.id || ""));
    if (idMatch) return `${idMatch[1]}-${String(Number(idMatch[2])).padStart(2, "0")}`;
    return monthKeyFromDate(period?.label);
  }
  function monthKeyForFinding(sheet, periods) {
    const dateKey = monthKeyFromDate(sheet?.inspectionDate);
    if (dateKey) return dateKey;
    const periodId = resolvePeriodId(sheet, periods);
    return monthKeyFromPeriod(periods.find((period) => period.id === periodId));
  }
  function findingDateSortValue(value) {
    const text = String(value || "").trim();
    const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
    if (isoMatch) return Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    const displayMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    if (displayMatch) return Date.UTC(Number(displayMatch[3]), Number(displayMatch[2]) - 1, Number(displayMatch[1]));
    return Date.parse(text) || 0;
  }
  function compareFindingsNewestFirst(left, right) {
    return findingDateSortValue(right?.inspectionDate) - findingDateSortValue(left?.inspectionDate)
      || String(right?.updatedAt || "").localeCompare(String(left?.updatedAt || ""))
      || String(right?.id || "").localeCompare(String(left?.id || ""));
  }
  function isFindingResolved(row) {
    return Boolean(String(row?.countermeasure || "").trim()) || Number(row?.progress) >= 100;
  }
  function defaultRows(rows = []) {
    const result = [...rows];
    while (result.length > ROWS_PER_PAGE && !rowHasContent(result[result.length - 1])) result.pop();
    while (result.length < ROWS_PER_PAGE) result.push(blankRow());
    return result;
  }
  function resolveAreaId(sheet, areas) {
    if (!sheet || !Array.isArray(areas)) return "";
    if (sheet.areaId && areas.some((area) => area.id === sheet.areaId)) return sheet.areaId;
    const raw = String(sheet.areaId || sheet.area || "").replace(/^zone\s*/i, "").split("·")[0].trim();
    if (raw) {
      const byCode = areas.find((area) => String(area.code).trim() === raw);
      if (byCode) return byCode.id;
      const byId = areas.find((area) => area.id === raw);
      if (byId) return byId.id;
      const byName = areas.find((area) => String(area.name || "").trim() === raw || String(area.name || "").toLowerCase().includes(raw.toLowerCase()));
      if (byName) return byName.id;
    }
    return "";
  }

  function findMatchingSheet(ctx, periodId, areaId, inspector, inspectionDate) {
    const periods = ctx.getPeriodsByType(ctx.FIVE_S_PERIOD_TYPE);
    const areas = ctx.getAreasForPeriod(periodId);
    return sheets(ctx).find((record) => resolvePeriodId(record, periods) === periodId
      && resolveAreaId(record, areas) === areaId && record.inspector === inspector && displayDate(record.inspectionDate) === displayDate(inspectionDate));
  }

  function zoneInput(sheet, ctx, editing, esc) {
    const areas = editing ? editableAreas(ctx, sheet.periodId || "") : sortedAreas(ctx, sheet.periodId || "");
    const selectedId = resolveAreaId(sheet, areas);
    if (!editing) return `<input name="areaId" type="text" value="${esc(areas.find((area) => area.id === selectedId) ? zoneLabel(areas.find((area) => area.id === selectedId)) : shortZoneLabel(sheet.area))}" disabled>`;
    return `<select name="areaId" required aria-label="Khu vực (Zone)"><option value="">${esc(sheet.area && !selectedId ? `Khu vực cũ: ${sheet.area} — chọn Zone` : "Chọn Zone 5S")}</option>${areas.map((area) => `<option value="${esc(area.id)}" ${area.id === selectedId ? "selected" : ""}>${esc(zoneLabel(area))}</option>`).join("")}</select>${areas.length ? "" : '<small class="findings-hint">Không có Zone được phép đánh giá trong kỳ này.</small>'}`;
  }

  function fresh(ctx, periodId, mobile = false) {
    const loggedInInspector = String(ctx.getAccountDisplayName?.(ctx.currentUser, ctx.FIVE_S_PERIOD_TYPE, periodId) || ctx.currentUser?.name || ctx.currentUser?.username || "").trim().slice(0, 20);
    return {
      periodId,
      id: ctx.makeId("finding"), areaId: "", area: "", inspector: loggedInInspector,
      inspectionDate: ctx.todayIsoDate(), rows: Array.from({ length: mobile ? 1 : ROWS_PER_PAGE }, blankRow),
    };
  }

  function mount(host, ctx) {
    if (!host) return;
    let view = views.get(host);
    const firstMount = !view || view.userId !== ctx.currentUser?.id;
    if (firstMount) {
      view = { userId: ctx.currentUser?.id, periodId: ctx.getActivePeriodId(ctx.FIVE_S_PERIOD_TYPE), selectedId: "", draft: null, busy: false, assignedZonesOnly: false };
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
    const activePeriodId = ctx.getActivePeriodId(ctx.FIVE_S_PERIOD_TYPE);
    const activePeriod = periods.find((period) => period.id === activePeriodId) || periods[0] || null;
    if (!view.draft) view.periodId = activePeriod?.id || "";
    else if (!periods.some((period) => period.id === view.periodId)) view.periodId = activePeriod?.id || "";
    const availableMonthKeys = [...new Set(allRecords
      .filter((item) => (item.rows || []).some(rowHasContent))
      .map((item) => monthKeyForFinding(item, periods))
      .filter(Boolean))].sort((left, right) => right.localeCompare(left));
    const availableYears = [...new Set(availableMonthKeys.map((key) => Number(key.slice(0, 4))))]
      .filter((year) => Number.isInteger(year)).sort((left, right) => right - left);
    const today = new Date();
    const latestDataYear = Number(availableMonthKeys[0]?.slice(0, 4)) || 0;
    const fallbackYear = latestDataYear || Number(activePeriod?.year) || today.getFullYear();
    let selectedYear = Number(view.findingYear) || fallbackYear;
    if (!availableYears.includes(selectedYear)) selectedYear = availableYears.includes(fallbackYear) ? fallbackYear : availableYears[0] || fallbackYear;
    const availableMonths = availableMonthKeys
      .filter((key) => Number(key.slice(0, 4)) === selectedYear)
      .map((key) => Number(key.slice(5, 7))).sort((left, right) => right - left);
    const latestDataMonth = availableMonthKeys.find((key) => Number(key.slice(0, 4)) === selectedYear);
    const fallbackMonth = latestDataMonth
      ? Number(latestDataMonth.slice(5, 7))
      : Number(activePeriod?.year) === selectedYear
        ? Number(activePeriod?.month) || availableMonths[0] || today.getMonth() + 1
        : availableMonths[0] || today.getMonth() + 1;
    let selectedMonth = Number(view.findingMonth) || fallbackMonth;
    if (!availableMonths.includes(selectedMonth)) selectedMonth = availableMonths.includes(fallbackMonth) ? fallbackMonth : availableMonths[0] || fallbackMonth;
    view.findingYear = selectedYear;
    view.findingMonth = selectedMonth;
    const selectedMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
    const monthRecords = allRecords.filter((item) => monthKeyForFinding(item, periods) === selectedMonthKey);
    const statusFilter = ["resolved", "unresolved"].includes(view.findingStatusFilter) ? view.findingStatusFilter : "all";
    const rowMatchesStatus = (row) => statusFilter === "all"
      || (statusFilter === "resolved" ? isFindingResolved(row) : !isFindingResolved(row));
    const areas = sortedAreas(ctx, view.periodId);
    const areasByPeriod = new Map([[view.periodId, areas]]);
    const areasForFinding = (item) => {
      const itemPeriodId = resolvePeriodId(item, periods);
      if (!periods.some((period) => period.id === itemPeriodId)) return areas;
      if (!areasByPeriod.has(itemPeriodId)) areasByPeriod.set(itemPeriodId, sortedAreas(ctx, itemPeriodId));
      return areasByPeriod.get(itemPeriodId);
    };
    const zoneKey = (item) => {
      const id = resolveAreaId(item, areasForFinding(item)) || item.areaId;
      return id ? `id:${id}` : `legacy:${String(item.area || "").trim().toLocaleLowerCase("vi")}`;
    };
    const zoneOptions = new Map(areas.map((area) => [`id:${area.id}`, `Zone ${area.code}`]));
    monthRecords.forEach((item) => {
      const recordAreas = areasForFinding(item);
      const recordAreaId = resolveAreaId(item, recordAreas) || item.areaId;
      const recordArea = recordAreas.find((area) => area.id === recordAreaId);
      if (!zoneOptions.has(zoneKey(item))) zoneOptions.set(zoneKey(item), recordArea ? `Zone ${recordArea.code}` : shortZoneLabel(item.area) || "Chưa chọn Zone");
    });
    if (!zoneOptions.has(view.zoneFilter)) view.zoneFilter = "";
    const records = monthRecords.filter((item) => (!view.zoneFilter || zoneKey(item) === view.zoneFilter)
      && (statusFilter === "all" || (item.rows || []).some((row) => rowHasContent(row) && rowMatchesStatus(row))))
      .sort(compareFindingsNewestFirst);
    const mobilePeriodBadge = host.closest("#mobileProtoOverlay")?.querySelector(".period-pill-text");
    if (mobilePeriodBadge) mobilePeriodBadge.textContent = ctx.periodLabel(periods.find((period) => period.id === view.periodId));
    const saved = records.find((sheet) => sheet.id === view.selectedId) || records[0];
    view.selectedId = saved?.id || "";
    const sheet = view.draft || (saved ? { ...saved, periodId: resolvePeriodId(saved, periods) } : { periodId: view.periodId, area: "", inspector: "", inspectionDate: "", rows: defaultRows() });
    const editing = Boolean(view.draft && canEditPeriod(ctx, view.draft.periodId));
    const isAllZones = !view.zoneFilter;
    const combined = !mobile && !editing && (isAllZones || records.length > 1 || statusFilter !== "all");
    const rowSources = editing ? [] : records.flatMap((record) => (record.rows || []).map((row, index) => ({ record, index, row })))
      .filter(({ row }) => rowHasContent(row) && rowMatchesStatus(row));
    if (combined) rowSources.sort((left, right) => compareFindingsNewestFirst(left.record, right.record) || right.index - left.index);
    const tableRows = editing ? sheet.rows : rowSources.map(({ row }) => row);
    const pageSize = editing ? ROWS_PER_PAGE : FINDINGS_PAGE_SIZE;
    const rowPageCount = Math.max(1, Math.ceil(tableRows.length / pageSize));
    view.rowPage = Math.max(0, Math.min(view.rowPage || 0, rowPageCount - 1));
    const firstRow = view.rowPage * pageSize;
    const zoneInspectors = [...new Set(records.flatMap((item) => parseInspectors(item.inspector)))].slice(0, 2);
    const displayInspectors = isAllZones ? [] : zoneInspectors;
    const currentZoneEditableRecord = monthRecords.find((item) => periodFor(item) === view.periodId
      && zoneKey(item) === view.zoneFilter
      && resolveAreaId(item, areasForFinding(item))
      && canEditSheet(ctx, item));
    const canEditCurrentZone = Boolean(!isAllZones && canEditPeriod(ctx, view.periodId)
      && (ctx.isAdminAccount(ctx.currentUser)
        ? areas.some((area) => `id:${area.id}` === view.zoneFilter) || currentZoneEditableRecord
        : editableAreas(ctx, view.periodId).some((area) => `id:${area.id}` === view.zoneFilter)));
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
    const canAddFinding = canEditPeriod(ctx, view.periodId) && editableAreas(ctx, view.periodId).length > 0;
    const valueInput = (name, value, type = "text", required = false) => type === "date"
      ? dateEditor(value, `name="${name}"`, editing, esc, required)
      : `<input name="${name}" type="${type}" value="${esc(value || "")}" ${required ? "required" : ""} maxlength="200" ${editing ? "" : "disabled"}>`;
    const periodOptions = (selected) => periods.map((period) => `<option value="${esc(period.id)}" ${period.id === selected ? "selected" : ""}>${esc(ctx.periodLabel(period))}</option>`).join("");
    const yearOptions = availableYears.map((year) => `<option value="${year}" ${year === selectedYear ? "selected" : ""}>${year}</option>`).join("");
    const monthOptions = availableMonths.map((month) => `<option value="${month}" ${month === selectedMonth ? "selected" : ""}>Tháng ${month}</option>`).join("");
    const statusOptions = [
      ["all", "Tất cả trạng thái"],
      ["unresolved", "Chưa xử lý"],
      ["resolved", "Đã xử lý"],
    ].map(([value, label]) => `<option value="${value}" ${statusFilter === value ? "selected" : ""}>${label}</option>`).join("");
    const addFindingAction = canAddFinding && periods.some((period) => period.id === view.periodId)
      ? '<button type="button" class="primary-button" data-finding-action="new"><i class="fa-solid fa-plus" aria-hidden="true"></i> Thêm vấn đề 5S</button>'
      : "";
    const mobileFullEdit = canEditSheet(ctx, saved);
    const mobileSavedActions = mobile && view.showDetail && canEditFinding(ctx, saved)
      ? button("edit", "Sửa") + (mobileFullEdit ? button("delete", "Xóa") : "")
      : "";
    host.innerHTML = `<div class="findings-page ${mobile ? "findings-mobile" : ""}">
      <div class="findings-toolbar ${mobile ? "" : "toolbar findings-desktop-toolbar"}">
        <label><span>Năm báo cáo</span><select data-finding-year aria-label="Năm báo cáo" ${editing ? "disabled" : ""}>${yearOptions || '<option value="">Chưa có dữ liệu</option>'}</select></label>
        <label><span>Tháng báo cáo</span><select data-finding-month aria-label="Tháng báo cáo" ${editing ? "disabled" : ""}>${monthOptions || '<option value="">Chưa có dữ liệu</option>'}</select></label>
        <label ${mobile && editing ? "hidden" : ""}><span>Khu vực (Zone)</span><select data-finding-zone aria-label="Lọc theo Zone" ${editing ? "disabled" : ""}>
          <option value="">Tất cả Zone</option>${[...zoneOptions].sort((a, b) => (ctx.compareZoneCodesByOrder || window.CustomDropdown?.compareZoneCodesByOrder || ((x, y) => x.localeCompare(y, "vi", { numeric: true })))(a[1], b[1])).map(([key, label]) => `<option value="${esc(key)}" ${view.zoneFilter === key ? "selected" : ""}>${esc(label)}</option>`).join("")}
        </select></label>
        <label><span>Trạng thái</span><select data-finding-status aria-label="Lọc theo trạng thái" ${editing ? "disabled" : ""}>${statusOptions}</select></label>
        <div class="findings-actions">${!editing ? `<button type="button" class="btn-export-excel-gradient" data-finding-export title="Xuất vấn đề trong tháng đang chọn"><i class="fa-solid fa-file-excel" aria-hidden="true"></i> Xuất Excel</button>` : ""}${mobile && view.showDetail && !editing ? button("back", "‹ Danh sách") : ""}${editing ? '<button type="submit" data-finding-save>Lưu phiếu</button>' + button("cancel", "Hủy") : addFindingAction + mobileSavedActions}</div>
      </div>
      ${mobile && !editing && !view.showDetail ? mobileList(records, monthRecords, esc, ctx, "", null, view) : ""}
      <form class="findings-form ${mobile ? "mobile-safety-form" : ""}" ${mobile && !editing && !view.showDetail ? "hidden" : ""}>
        ${editing ? `<label class="findings-period-editor">Kỳ của phiếu<select name="periodId" required aria-label="Kỳ của phiếu"><option value="">Chọn kỳ chấm 5S</option>${periodOptions(sheet.periodId)}</select></label>` : ""}
        ${mobile ? mobileForm(sheet, ctx, editing, view, valueInput) : `<div class="findings-paper">
          <div class="findings-heading">
            <h2>Các vấn đề về 5S phát hiện<span>5S find out</span></h2>
            ${headerHtml}
          </div>
          <div class="findings-subheading"><label>Khu vực (Zone):${editing ? zoneInput(sheet, ctx, editing, esc) : valueInput("areaId", isAllZones ? "Tất cả Zone" : (zoneOptions.get(view.zoneFilter) || shortZoneLabel(sheet.area)))}</label></div>
          <div class="findings-table-scroll" tabindex="0" role="region" aria-label="Bảng các vấn đề 5S, cuộn ngang để xem đủ cột">
            <table class="findings-table"><colgroup>${[65, 85, 105, 100, 250, 130, 170, 65, 235, 130, 120, 90].map((width) => `<col style="width:${width / 1545 * 100}%">`).join("")}</colgroup>
              <thead><tr><th scope="col">STT</th><th scope="col">Zone</th><th scope="col">Ngày kiểm tra</th>${headings.map((heading, col) => `<th scope="col">${heading}</th>${col === 1 ? '<th scope="col">Ảnh vấn đề</th>' : ""}${col === 4 ? '<th scope="col">Ảnh sau xử lý</th>' : ""}`).join("")}</tr></thead>
              <tbody>${!editing && !tableRows.length ? '<tr><td colspan="12" class="findings-empty-row">Không có vấn đề phù hợp với bộ lọc.</td></tr>' : tableRows.slice(firstRow, firstRow + pageSize).map((row, offset) => {
                const index = firstRow + offset;
                const source = editing ? null : rowSources[index];
                const fullEdit = source && canEditSheet(ctx, source.record);
                const responseEdit = source && canManageFindingCountermeasure(ctx, source.record);
                const actions = editing ? `<button type="button" data-remove-row="${index}" aria-label="Xóa dòng ${index + 1}" title="Xóa dòng">Xóa</button>` : source && (fullEdit || responseEdit) ? `<button type="button" data-edit-saved-row="${source.index}" data-sheet-id="${esc(source.record.id)}" aria-label="Sửa dòng ${index + 1}" title="Sửa dòng">Sửa</button>${fullEdit ? `<button type="button" data-delete-saved-row="${source.index}" data-sheet-id="${esc(source.record.id)}" aria-label="Xóa dòng ${index + 1}" title="Xóa dòng">Xóa</button>` : ""}` : "";
                const photoMetadata = source ? { sheetId: source.record.id, rowIndex: source.index, editable: canEditSheet(ctx, source.record) } : { editable: editing };
                const afterPhotoMetadata = source ? { sheetId: source.record.id, rowIndex: source.index, editable: responseEdit || Boolean(ctx.isAdminAccount?.(ctx.currentUser)), photoField: "afterPhotoDataUrl" } : { editable: editing && (Boolean(ctx.isAdminAccount?.(ctx.currentUser)) || canManageFindingCountermeasure(ctx, sheet)), photoField: "afterPhotoDataUrl" };
                const zone = (editing || rowHasContent(row)) ? source?.record.area || sheet.area : "";
                const inspectionDate = source?.record.inspectionDate || sheet.inspectionDate;
                return `<tr><th scope="row">${index + 1}${actions}</th><td><span>${esc(shortZoneLabel(zone) || "")}</span></td><td><span>${esc(displayDate(inspectionDate))}</span></td>${fields.map((key, col) => `<td>${cell(row, key, index, headings[col], editing, esc)}</td>${key === "problem" ? `<td class="findings-photo-cell">${photoPreview(row, esc, photoMetadata)}</td>` : ""}${key === "countermeasure" ? `<td class="findings-photo-cell">${photoPreview(row, esc, afterPhotoMetadata)}</td>` : ""}`).join("")}</tr>`;
              }).join("")}</tbody>
            </table>
          </div>
        </div>`}
        ${!mobile && (editing ? rowPageCount > 1 : tableRows.length > FINDINGS_PAGE_SIZE) ? `<nav class="findings-row-pager" aria-label="Phân trang vấn đề 5S">
          <span>${Math.min(pageSize, Math.max(0, tableRows.length - firstRow))}/${tableRows.length} · Trang ${view.rowPage + 1}/${rowPageCount}</span>
          <button type="button" data-finding-row-page="${view.rowPage - 1}" ${view.rowPage === 0 ? "disabled" : ""}>‹ Trang trước</button>
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
    host.querySelector("[data-finding-export]")?.addEventListener("click", async () => {
      try {
        const result = await ctx.exportFiveSFindings(monthRecords.map((item) => item.id), { year: selectedYear, month: selectedMonth, status: statusFilter });
        if (result?.skippedPhotos?.length) {
          const count = result.skippedPhotos.length;
          const firstIssue = result.skippedPhotos[0];
          const detail = firstIssue?.reason ? ` Dòng ${firstIssue.row}: ${firstIssue.reason}` : "";
          message(host, `Đã xuất Excel; bỏ qua ${count} ảnh không tải được.${detail}`, false);
        }
      }
      catch (error) { message(host, error?.message || "Không xuất được Excel. Vui lòng thử lại.", true); }
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
    host.querySelector("[data-finding-year]")?.addEventListener("change", (event) => {
      view.findingYear = Number(event.target.value) || 0;
      view.zoneFilter = "";
      view.selectedId = "";
      view.rowPage = 0;
      view.notice = null;
      view.editingHeader = false;
      view.showDetail = false;
      render(host, view);
    });
    host.querySelector("[data-finding-month]")?.addEventListener("change", (event) => {
      view.findingMonth = Number(event.target.value) || 0;
      view.zoneFilter = "";
      view.selectedId = "";
      view.rowPage = 0;
      view.showDetail = false;
      view.notice = null;
      view.editingHeader = false;
      render(host, view);
    });
    host.querySelector("[data-finding-status]")?.addEventListener("change", (event) => {
      view.findingStatusFilter = event.target.value;
      view.selectedId = "";
      view.rowPage = 0;
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
      if (!record?.rows[index] || (deleting ? !canEditSheet(ctx, record) : !canEditFinding(ctx, record))) return;
      if (deleting) {
        if (!window.confirm(`Xóa dòng ${index + 1} của ${record.area}?`)) return;
        const removedPhotoUrls = [record.rows[index]?.photoDataUrl, record.rows[index]?.afterPhotoDataUrl].filter(Boolean);
        await perform(host, view, async () => {
          const data = clone(record);
          data.rows.splice(index, 1);
          data.updatedAt = new Date().toISOString();
          data.updatedBy = ctx.currentUser.id;
          await ctx.saveFiveSFinding(data);
          ctx.state.fiveSFindings = ctx.state.fiveSFindings.map((item) => item.id === data.id ? data : item);
          await ctx.deleteUnusedPhotoFiles(removedPhotoUrls);
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
      if (!canEdit(ctx)) {
        ctx.showToast("Bạn không có quyền sửa, lưu hoặc xóa vấn đề 5S.", true);
        return;
      }
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
        const targetAreaId = areas.find((area) => `id:${area.id}` === view.zoneFilter)?.id
          || (currentZoneEditableRecord ? resolveAreaId(currentZoneEditableRecord, areasForFinding(currentZoneEditableRecord)) : "")
          || (areas.length === 1 ? areas[0].id : "");
        const targetRecords = monthRecords.filter((item) => periodFor(item) === view.periodId
          && resolveAreaId(item, areasForFinding(item)) === targetAreaId
          && canEditSheet(ctx, item));
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
      if (action === "edit" && canEditFinding(ctx, saved)) { openIssueModal(host, view, saved, view.issueIndex); return; }
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
            const removedPhotoUrls = [data.rows[view.issueIndex]?.photoDataUrl, data.rows[view.issueIndex]?.afterPhotoDataUrl].filter(Boolean);
            data.rows.splice(view.issueIndex, 1);
            data.updatedAt = new Date().toISOString();
            data.updatedBy = ctx.currentUser.id;
            await ctx.saveFiveSFinding(data);
            ctx.state.fiveSFindings = ctx.state.fiveSFindings.map((item) => item.id === data.id ? data : item);
            await ctx.deleteUnusedPhotoFiles(removedPhotoUrls);
            view.issueIndex = null;
            view.showDetail = false;
          }, "Đã xóa vấn đề 5S.");
          return;
        }
        if (!window.confirm(`Xóa phiếu 5S khu vực ${saved.area}, ngày ${ctx.formatDateDisplay(saved.inspectionDate)}?`)) return;
        await perform(host, view, async () => {
          await ctx.deleteFiveSFinding(saved.id);
          ctx.state.fiveSFindings = (ctx.state.fiveSFindings || []).filter((item) => item.id !== saved.id);
          await ctx.deleteUnusedPhotoFiles((saved.rows || []).flatMap((row) => [row.photoDataUrl || "", row.afterPhotoDataUrl || ""]));
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
      data.rows.forEach((row) => { delete row.detectionDate; });
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
        const targetCandidate = findMatchingSheet(ctx, data.periodId, data.areaId, data.inspector, data.inspectionDate);
        const managerCannotEditExistingSheet = targetCandidate
          && canManageFindingCountermeasure(ctx, targetCandidate)
          && !canEditSheet(ctx, targetCandidate);
        const target = managerCannotEditExistingSheet ? null : targetCandidate;
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
        const savedMonthKey = monthKeyForFinding(data, periods);
        view.findingYear = Number(savedMonthKey.slice(0, 4)) || view.findingYear;
        view.findingMonth = Number(savedMonthKey.slice(5, 7)) || view.findingMonth;
        view.findingStatusFilter = "all";
        view.rowPage = 0;
        view.selectedId = data.id;
        view.periodId = data.periodId;
        if (view.zoneFilter) view.zoneFilter = `id:${data.areaId}`;
        view.draft = null;
        view.addingIssues = false;
        view.appendExisting = false;
        view.issueIndex = null;
        view.editIssueIndex = null;
        view.showDetail = false;
      }, "Đã lưu vấn đề 5S thành công!");
    });
    if (view.notice) message(host, view.notice.text, view.notice.error);
    ctx.hydrateAuthenticatedPhotos(host);
    bindFindingPhotoImages(host, ctx);
  }

  function renderMobile(host, view) {
    const ctx = view.ctx;
    const esc = ctx.escapeHtml;
    const allPeriods = ctx.getPeriodsByType(ctx.FIVE_S_PERIOD_TYPE);
    const activePeriodId = ctx.getActivePeriodId(ctx.FIVE_S_PERIOD_TYPE);
    const activePeriod = allPeriods.find((period) => period.id === activePeriodId);
    const activeMonthKey = monthKeyFromPeriod(activePeriod);
    if (view.activeFindingMonthKey !== activeMonthKey) {
      view.activeFindingMonthKey = activeMonthKey;
      view.findingMonthKey = activeMonthKey;
    }
    const allRecords = sheets(ctx);
    const monthOptions = new Map();
    allPeriods.forEach((period) => {
      const key = monthKeyFromPeriod(period);
      if (key) monthOptions.set(key, key);
    });
    allRecords.forEach((record) => {
      const key = monthKeyForFinding(record, allPeriods);
      if (key) monthOptions.set(key, key);
    });
    const sortedMonthKeys = [...monthOptions.keys()].sort((left, right) => right.localeCompare(left));
    if (!sortedMonthKeys.includes(view.findingMonthKey)) {
      view.findingMonthKey = sortedMonthKeys.includes(activeMonthKey) ? activeMonthKey : sortedMonthKeys[0] || "";
    }
    const monthOptionsHtml = sortedMonthKeys.map((key) => {
      const [year, month] = key.split("-");
      return `<option value="${esc(key)}" ${key === view.findingMonthKey ? "selected" : ""}>Tháng ${Number(month)}/${year}</option>`;
    }).join("");
    const periods = allPeriods.filter((period) => ctx.isAdminAccount(ctx.currentUser) || (!period.archived && period.id === activePeriodId));
    if (!periods.some((period) => period.id === view.periodId)) view.periodId = periods[0]?.id || "";
    const periodId = view.periodId;
    const records = allRecords.filter((record) => resolvePeriodId(record, allPeriods) === periodId);
    const allMonthRecords = allRecords
      .filter((record) => monthKeyForFinding(record, allPeriods) === view.findingMonthKey)
      .sort(compareFindingsNewestFirst);
    const assignedZonesOnly = Boolean(view.assignedZonesOnly);
    const isInAssignedZone = (record) => {
      if (typeof ctx?.getAllowedAreaIds !== "function") return true;
      const recordPeriodId = resolvePeriodId(record, allPeriods);
      const allowedAreaIds = ctx.getAllowedAreaIds(ctx.currentUser, recordPeriodId);
      if (!allowedAreaIds || typeof allowedAreaIds.has !== "function") return true;
      const recordAreas = sortedAreas(ctx, recordPeriodId);
      const areaId = resolveAreaId(record, recordAreas) || record.areaId;
      return Boolean(areaId && allowedAreaIds.has(areaId));
    };
    const visibleMonthRecords = assignedZonesOnly
      ? allMonthRecords.filter(isInAssignedZone)
      : allMonthRecords;
    const requestedFindingsPage = Math.max(1, Math.trunc(Number(view.findingsListPage) || 1));
    const findingsPageSize = 50;
    const localTotalPages = Math.max(1, Math.ceil(visibleMonthRecords.length / findingsPageSize));
    const findingsPage = Math.min(requestedFindingsPage, localTotalPages);
    view.findingsListPage = findingsPage;
    const monthRecords = visibleMonthRecords.slice((findingsPage - 1) * findingsPageSize, findingsPage * findingsPageSize);
    const findingsPager = {
      page: findingsPage,
      totalPages: localTotalPages,
      totalRows: visibleMonthRecords.reduce((total, record) => total + (record.rows || []).filter(rowHasContent).length, 0),
    };
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
    const mobileFindingDraftKey = view.mobileEdit ? ("mob_5s_edit_" + view.mobileEdit.id + "_" + view.mobileEdit.index) : ("mob_5s_new_" + periodId);
    if (!view._mobDraftCheckedKey || view._mobDraftCheckedKey !== mobileFindingDraftKey) {
      view._mobDraftCheckedKey = mobileFindingDraftKey;
      const mobSavedDraft = window.FormDraftManager?.getDraft(mobileFindingDraftKey);
      if (mobSavedDraft) {
        if (mobSavedDraft.areaId) draft.areaId = mobSavedDraft.areaId;
        if (mobSavedDraft.area) draft.area = mobSavedDraft.area;
        if (mobSavedDraft.inspector) draft.inspector = mobSavedDraft.inspector;
        if (mobSavedDraft.inspectionDate) draft.inspectionDate = mobSavedDraft.inspectionDate;
        if (mobSavedDraft.rows?.[0]) {
          draft.rows[0] = { ...draft.rows[0], ...mobSavedDraft.rows[0] };
        }
      }
    }
    const source = view.mobileEdit && records.find((record) => record.id === view.mobileEdit.id);
    const isAdmin = Boolean(ctx.isAdminAccount?.(ctx.currentUser));
    const writable = Boolean(periodId && canEditPeriod(ctx, periodId) && (view.mobileEdit ? canEditSheet(ctx, source) : editableAreas(ctx, periodId).length > 0));
    const canManageMobileCountermeasure = view.mobileEdit ? (isAdmin || canManageFindingCountermeasure(ctx, source)) : isAdmin;
    const isMobileFieldEditable = (key) => countermeasureFields.has(key) ? (writable && canManageMobileCountermeasure) : writable;
    const input = (name, value, type = "text", required = false) => type === "date"
      ? dateEditor(value, `name="${name}"`, writable && !view.mobileEdit, esc, required)
      : `<input name="${name}" value="${esc(value || "")}" maxlength="200" ${required ? "required" : ""} ${!writable || view.mobileEdit ? "disabled" : ""}>`;
    const field = (label, html, wide = false) => `<label class="findings-mobile-field ${wide ? "is-wide" : ""}"><span>${label}</span>${html}</label>`;
    const labels = ["Vị trí", "Vấn đề 5S *", "Hạng mục", "Ca làm việc", "Biện pháp khắc phục", "Hạn hoàn thành", "Tiến độ"];
    const mobileAfterPhotoEditable = isMobileFieldEditable("countermeasure");
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
          ${fields.map((key, index) => {
            const itemHtml = field(labels[index], cell(draft.rows[0], key, 0, labels[index], true, esc, true, isMobileFieldEditable(key)), ["location", "problem", "countermeasure"].includes(key));
            if (key === "problem") {
              return `${itemHtml}<div class="findings-mobile-field is-wide"><span>Ảnh vấn đề</span>${mobilePhotoEditor(draft.rows[0], writable, esc, { sheetId: view.mobileEdit?.id, rowIndex: view.mobileEdit?.index, editable: writable, photoField: "photoDataUrl" })}</div>`;
            }
            if (key === "countermeasure") {
              return `${itemHtml}<div class="findings-mobile-field is-wide findings-after-photo-field"><span>Ảnh sau cải tiến, xử lý</span>${mobilePhotoEditor(draft.rows[0], mobileAfterPhotoEditable, esc, { sheetId: view.mobileEdit?.id, rowIndex: view.mobileEdit?.index, editable: mobileAfterPhotoEditable, photoField: "afterPhotoDataUrl" })}</div>`;
            }
            return itemHtml;
          }).join("")}
        </div>
        <div class="findings-mobile-submit">${writable ? `<div class="mobile-fixed-save"><button type="submit">${view.mobileEdit ? "LƯU THAY ĐỔI" : "LƯU VẤN ĐỀ 5S"}</button></div>` : '<span class="findings-readonly">Chỉ xem — bạn không có quyền thêm, sửa, xóa vấn đề 5S trong kỳ hoặc Zone này.</span>'}
        ${view.mobileEdit ? `<button type="button" data-mobile-reset>${writable ? "Hủy sửa" : "Đóng chi tiết"}</button>${writable ? '<button type="button" class="findings-remove-issue" data-mobile-delete>Xóa vấn đề</button>' : ""}` : ""}</div>
        <p class="findings-message" role="status" aria-live="polite"></p>
      </form>
      ${mobileList(monthRecords, monthRecords, esc, ctx, monthOptionsHtml, findingsPager, view)}
    </div>`;
    if (view.scrollToNewFinding) {
      const target = view.scrollToNewFinding;
      const findCard = () => Array.from(host.querySelectorAll(".findings-mobile-list [data-open-finding]"))
        .find((card) => card.dataset.openFinding === String(target.sheetId) && Number(card.dataset.issueIndex) === target.rowIndex);
      if (findCard()) {
        view.scrollToNewFinding = null;
        scrollMobileTargetIntoView(findCard);
      }
    }
    const badge = host.closest("#mobileProtoOverlay")?.querySelector(".period-pill-text");
    if (badge) badge.textContent = ctx.periodLabel(ctx.getPeriod(periodId));
    const form = host.querySelector("form");
    host.querySelector("[data-finding-month]")?.addEventListener("change", (event) => {
      view.findingMonthKey = event.target.value;
      view.findingsListPage = 1;
      renderMobile(host, view);
    });
    host.querySelector("[data-findings-assigned-zone-filter]")?.addEventListener("change", (event) => {
      view.assignedZonesOnly = Boolean(event.target.checked);
      view.findingsListPage = 1;
      renderMobile(host, view);
    });
    host.querySelectorAll("[data-findings-page]").forEach((button) => button.addEventListener("click", () => {
      view.findingsListPage = Number(button.dataset.findingsPage) || 1;
      renderMobile(host, view);
    }));
    bindPhotoEditor(form, ctx, draft.rows[0], {
      sheetId: view.mobileEdit?.id,
      rowIndex: view.mobileEdit?.index,
      editable: writable,
      afterPhotoEditable: mobileAfterPhotoEditable,
      onPhotoReplaced: () => capture(),
      onAnnotationsSaved: (annotations, { pending, photoField }) => {
        if (!pending && view.mobileEdit?.original) {
          const annotationField = photoField === "afterPhotoDataUrl" ? "afterPhotoAnnotations" : "photoAnnotations";
          view.mobileEdit.original[annotationField] = annotations;
        }
        capture();
      },
    });
    if (view.mobileEdit) form.elements.areaId.disabled = true;
    if (writable) form.querySelector('[data-field="problem"]').required = true;
    const isMobileFindingDirty = () => {
      if (!form?.isConnected || host.classList.contains("is-hidden")) return false;
      if (view.mobileEdit && view.mobileEdit.original) {
        const orig = view.mobileEdit.original;
        return !areFindingRowsEqual(draft.rows[0], orig);
      }
      return Boolean(
        String(draft.rows[0]?.problem || "").trim() ||
        String(draft.rows[0]?.location || "").trim() ||
        String(draft.rows[0]?.countermeasure || "").trim() ||
        String(draft.rows[0]?.photoDataUrl || "").trim() ||
        String(draft.rows[0]?.afterPhotoDataUrl || "").trim()
      );
    };

    const capture = () => {
      if (!writable) return;
      draft.areaId = form.elements.areaId.value;
      draft.area = zoneOptions.get(draft.areaId) || "";
      const n1 = form.elements.inspector1 ? form.elements.inspector1.value.trim().slice(0, 20) : "";
      const n2 = form.elements.inspector2 ? form.elements.inspector2.value.trim().slice(0, 20) : "";
      draft.inspector = formatInspectors(n1, n2);
      draft.inspectionDate = ctx.parseDisplayDateToIso(form.elements.inspectionDate.value) || form.elements.inspectionDate.value.trim();
      form.querySelectorAll("[data-field]").forEach((input) => { draft.rows[0][input.dataset.field] = input.dataset.field === "dueDate" ? ctx.parseDisplayDateToIso(input.value) || input.value.trim() : input.value.trim(); });
      if (isMobileFindingDirty()) {
        window.FormDraftManager?.saveDraft(mobileFindingDraftKey, clone(draft));
      } else {
        window.FormDraftManager?.clearDraft(mobileFindingDraftKey);
      }
    };

    window.FormDraftManager?.registerDirtyForm(mobileFindingDraftKey, {
      isDirty: isMobileFindingDirty,
      getSnapshot: () => clone(draft),
      onDiscard: () => {
        window.FormDraftManager?.clearDraft(mobileFindingDraftKey);
        view._mobDraftCheckedKey = "";
        reset(draft.areaId);
        view.mobileNewDraft = null;
      },
    });
    form.addEventListener("input", capture);
    form.addEventListener("change", (event) => {
      capture();
      if (event.target.dataset.field === "progress") event.target.parentElement.querySelector(".findings-progress")?.style.setProperty("--progress", `${event.target.value}%`);
    });
    form.elements.areaId?.addEventListener("change", (event) => {
      const selectedId = event.target.value;
      if (!selectedId) return;
      const [m1, m2] = getMobileAreaInspectors(selectedId);
      const loggedInInspector = String(ctx.getAccountDisplayName?.(ctx.currentUser, ctx.FIVE_S_PERIOD_TYPE, periodId) || ctx.currentUser?.name || ctx.currentUser?.username || "").trim().slice(0, 20);
      if (form.elements.inspector1) {
        form.elements.inspector1.value = loggedInInspector || form.elements.inspector1.value.trim() || m1;
      }
      if (form.elements.inspector2 && !form.elements.inspector2.value.trim() && m2) {
        form.elements.inspector2.value = m2;
      }
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
      const record = monthRecords.find((item) => item.id === button.dataset.openFinding);
      const index = Number(button.dataset.issueIndex);
      if (!record?.rows[index]) return;
      capture();
      openIssueModal(host, view, record, index);
    }));
    host.querySelector("[data-mobile-reset]")?.addEventListener("click", () => {
      const doReset = () => {
        view._mobDraftCheckedKey = "";
        reset(draft.areaId);
        if (view.mobileNewDraft?.periodId === periodId) view.mobileDraft = view.mobileNewDraft;
        view.mobileNewDraft = null;
        view.notice = null;
        renderMobile(host, view);
      };
      if (window.FormDraftManager?.isFormDirty(mobileFindingDraftKey)) {
        window.FormDraftManager.showUnsavedConfirmModal({
          title: "Bạn có thay đổi chưa lưu!",
          message: "Nội dung đang nhập đã được lưu tạm vào bộ nhớ (cache). Bạn có muốn tiếp tục chỉnh sửa hay thoát?",
          onKeepEditing: () => {},
          onSaveDraftAndExit: () => {
            window.FormDraftManager?.unregisterDirtyForm(mobileFindingDraftKey);
            doReset();
          },
          onDiscardAndExit: () => {
            window.FormDraftManager?.clearDraft(mobileFindingDraftKey);
            window.FormDraftManager?.unregisterDirtyForm(mobileFindingDraftKey);
            doReset();
          },
        });
        return;
      }
      doReset();
    });
    const persist = async (deleting = false) => {
      if (view.busy || !writable) return;
      capture();
      const edit = view.mobileEdit;
      const targetCandidate = edit ? ctx.state.fiveSFindings.find((record) => record.id === edit.id) : findMatchingSheet(ctx, periodId, draft.areaId, draft.inspector, draft.inspectionDate);
      const managerCannotEditExistingSheet = !edit && targetCandidate
        && canManageFindingCountermeasure(ctx, targetCandidate)
        && !canEditSheet(ctx, targetCandidate);
      const target = managerCannotEditExistingSheet ? null : targetCandidate;
      if (edit && (!target || JSON.stringify(target.rows?.[edit.index]) !== JSON.stringify(edit.original))) return message(host, "Vấn đề đã thay đổi. Chọn lại vấn đề trong danh sách.", true);
      if (target && !canEditSheet(ctx, target)) return message(host, "Bạn không có quyền thay đổi Zone này.", true);
      const area = editableAreas(ctx, periodId).find((item) => item.id === draft.areaId);
      if (!area) return message(host, "Vui lòng chọn Zone được phân công.", true);
      const row = clone(draft.rows[0]);
      if (!canManageMobileCountermeasure) {
        if (!edit) {
          row.countermeasure = "";
          row.dueDate = "";
          row.progress = "0";
          row.afterPhotoDataUrl = "";
          row.afterPhotoName = "";
          row.afterPhotoAnnotations = [];
        } else if (edit.original) {
          row.countermeasure = edit.original.countermeasure || "";
          row.dueDate = edit.original.dueDate || "";
          row.progress = edit.original.progress || "0";
          row.afterPhotoDataUrl = edit.original.afterPhotoDataUrl || "";
          row.afterPhotoName = edit.original.afterPhotoName || "";
          row.afterPhotoAnnotations = edit.original.afterPhotoAnnotations || [];
        }
      }
      if (!deleting && !row.problem) return message(host, "Vui lòng nhập vấn đề 5S.", true);
      const date = ctx.parseDisplayDateToIso(displayDate(draft.inspectionDate));
      const n1 = form.elements.inspector1 ? form.elements.inspector1.value.trim() : "";
      const n2 = form.elements.inspector2 ? form.elements.inspector2.value.trim() : "";
      if (!deleting && (n1.length > 20 || n2.length > 20)) return message(host, "Mỗi tên người kiểm tra tối đa 20 chữ cái.", true);
      if (!deleting && (!date || !draft.inspector)) return message(host, "Vui lòng nhập người kiểm tra và ngày hợp lệ (dd/mm/yyyy).", true);
      if (!deleting && row.dueDate && !ctx.parseDisplayDateToIso(displayDate(row.dueDate))) return message(host, "Hạn hoàn thành không hợp lệ (dd/mm/yyyy).", true);
      row.dueDate = row.dueDate ? ctx.parseDisplayDateToIso(displayDate(row.dueDate)) : "";
      delete row.detectionDate;
      const data = target ? clone(target) : { ...fresh(ctx, periodId), inspector: draft.inspector, inspectionDate: date };
      data.periodId = periodId; data.areaId = area.id; data.area = zoneLabel(area);
      let savedRowIndex = -1;
      if (deleting) data.rows.splice(edit.index, 1);
      else {
        let index = edit ? edit.index : data.rows.findIndex((item) => !rowHasContent(item));
        if (index < 0) index = data.rows.length;
        data.rows[index] = row;
        savedRowIndex = index;
      }
      data.createdAt ||= new Date().toISOString();
      data.updatedAt = new Date().toISOString(); data.updatedBy = ctx.currentUser.id;
      const oldPhotoUrls = [
        edit?.original?.photoDataUrl || row.photoDataUrl || "",
        edit?.original?.afterPhotoDataUrl || row.afterPhotoDataUrl || "",
      ].filter(Boolean);
      await perform(host, view, async () => {
        try {
          if (!deleting) {
            const nextPhoto = await ctx.prepareScorePhoto(form.elements.findingPhoto?.files?.[0], row, form.elements.removeFindingPhoto?.checked, periodId, "van-de-5s", "anh-truoc-xu-ly");
            if (form.elements.removeFindingPhoto?.checked) row.photoAnnotations = [];
            row.photoDataUrl = nextPhoto.photoDataUrl;
            row.photoName = nextPhoto.photoName;
            if (canManageMobileCountermeasure) {
              const nextAfterPhoto = await ctx.prepareScorePhoto(
                form.elements.findingAfterPhoto?.files?.[0],
                { photoDataUrl: row.afterPhotoDataUrl || "", photoName: row.afterPhotoName || "" },
                form.elements.removeFindingAfterPhoto?.checked,
                periodId,
                "van-de-5s",
                "anh-sau-xu-ly",
              );
              if (form.elements.removeFindingAfterPhoto?.checked) row.afterPhotoAnnotations = [];
              row.afterPhotoDataUrl = nextAfterPhoto.photoDataUrl;
              row.afterPhotoName = nextAfterPhoto.photoName;
            }
          }
          await ctx.saveFiveSFinding(data);
          ctx.state.fiveSFindings = [...(ctx.state.fiveSFindings || []).filter((record) => record.id !== data.id), data];
          if (!deleting) {
            view.findingMonthKey = monthKeyForFinding(data, allPeriods);
            const monthIssues = sheets(ctx)
              .filter((record) => monthKeyForFinding(record, allPeriods) === view.findingMonthKey)
              .flatMap((sheet) => (sheet.rows || []).map((savedRow, index) => ({ sheet, row: savedRow, index })))
              .filter(({ row: savedRow }) => rowHasContent(savedRow))
              .sort((left, right) => compareFindingsNewestFirst(left.sheet, right.sheet) || right.index - left.index);
            const savedIssueIndex = monthIssues.findIndex((item) => item.sheet.id === data.id && item.index === savedRowIndex);
            view.findingsListPage = savedIssueIndex >= 0 ? Math.floor(savedIssueIndex / findingsPageSize) + 1 : 1;
            view.scrollToNewFinding = edit ? null : { sheetId: data.id, rowIndex: savedRowIndex };
          } else {
            view.scrollToNewFinding = null;
            view.findingsListPage = 1;
          }
          await ctx.deleteUnusedPhotoFiles(oldPhotoUrls);
        } catch (error) {
          if (!deleting) await ctx.deleteUnusedPhotoFiles([row.photoDataUrl, row.afterPhotoDataUrl]);
          throw error;
        }
        window.FormDraftManager?.clearDraft(mobileFindingDraftKey);
        window.FormDraftManager?.unregisterDirtyForm(mobileFindingDraftKey);
        view._mobDraftCheckedKey = "";
        reset(area.id);
        view.mobileNewDraft = null;
        view.zoneFilter = "";
      }, deleting ? "Đã xóa vấn đề 5S thành công!" : edit ? "Đã lưu thay đổi vấn đề 5S thành công!" : "Đã lưu vấn đề 5S thành công!");
    };
    form.addEventListener("submit", (event) => { event.preventDefault(); persist(); });
    window.bindTouchSubmitBeforeKeyboardDismiss?.(form, form.querySelector('button[type="submit"]'));
    host.querySelector("[data-mobile-delete]")?.addEventListener("click", () => { if (window.confirm("Xóa vấn đề 5S này?")) persist(true); });
    if (view.notice) message(host, view.notice.text, view.notice.error);
    ctx.hydrateAuthenticatedPhotos(host);
    bindFindingPhotoImages(host, ctx);
  }

  function openIssueModal(host, view, record = null, rowIndex = null) {
    const ctx = view.ctx;
    const editing = Boolean(record);
    const mobile = host.id === "mobileScreenFindings";
    if (editing && !(ctx.state.fiveSFindings || []).some((item) => item.id === record.id)) {
      ctx.state.fiveSFindings = [...(ctx.state.fiveSFindings || []), clone(record)];
    }
    const isAdmin = Boolean(ctx.isAdminAccount?.(ctx.currentUser));
    const fullWritable = editing ? canEditSheet(ctx, record) : canEditPeriod(ctx, view.periodId);
    const responseWritable = Boolean(editing && canManageFindingCountermeasure(ctx, record));
    const writable = fullWritable || responseWritable;
    const canManageCountermeasure = editing ? (isAdmin || responseWritable) : isAdmin;
    const countermeasureOnly = responseWritable && !fullWritable && !isAdmin;
    if ((!editing && !writable) || (editing && (!Number.isInteger(rowIndex) || !record.rows?.[rowIndex]))) return;
    const resolvedPeriodId = resolvePeriodId(record, ctx.getPeriodsByType(ctx.FIVE_S_PERIOD_TYPE));
    const periodId = editing ? (resolvedPeriodId || record?.periodId || ctx.getActivePeriodId(ctx.FIVE_S_PERIOD_TYPE) || ctx.getPeriodsByType(ctx.FIVE_S_PERIOD_TYPE)[0]?.id || "") : view.periodId;
    const areas = fullWritable ? editableAreas(ctx, periodId) : sortedAreas(ctx, periodId);
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
      const loggedInInspector = String(ctx.getAccountDisplayName?.(ctx.currentUser, ctx.FIVE_S_PERIOD_TYPE, periodId) || ctx.currentUser?.name || ctx.currentUser?.username || "").trim().slice(0, 20);
      const areaInspectors = getAreaInspectors(areaId);
      initN1 = loggedInInspector || areaInspectors[0] || "";
      initN2 = areaInspectors[1] || "";
    }
    let initialDate = (editing ? record?.inspectionDate : null) || getAreaInspectionDate(areaId) || ctx.todayIsoDate();
    const originalRow = editing ? clone(record.rows[rowIndex]) : null;
    let pendingPhotoAnnotations = null;
    let pendingAfterPhotoAnnotations = null;
    const originalMetadata = editing ? {
      areaId: resolveAreaId(record, areas),
      areaLabel: shortZoneLabel(record.area).trim().toLocaleLowerCase("vi"),
      inspectionDate: displayDate(record.inspectionDate),
      inspector: formatInspectors(...parseInspectors(record.inspector)),
      periodId: resolvePeriodId(record, ctx.getPeriodsByType(ctx.FIVE_S_PERIOD_TYPE)),
    } : null;
    const hasChanged = (target) => {
      if (!target) return true;
      const targetAreaId = resolveAreaId(target, areas);
      const areaChanged = originalMetadata.areaId || targetAreaId
        ? targetAreaId !== originalMetadata.areaId
        : shortZoneLabel(target.area).trim().toLocaleLowerCase("vi") !== originalMetadata.areaLabel;
      return !areFindingRowsEqual(target.rows?.[rowIndex], originalRow)
        || areaChanged
        || displayDate(target.inspectionDate) !== originalMetadata.inspectionDate
        || formatInspectors(...parseInspectors(target.inspector)) !== originalMetadata.inspector
        || resolvePeriodId(target, ctx.getPeriodsByType(ctx.FIVE_S_PERIOD_TYPE)) !== originalMetadata.periodId;
    };
    const row = originalRow || blankRow();
    const origAreaId = areaId;
    const origInitialDate = initialDate;
    const origInitN1 = initN1;
    const origInitN2 = initN2;

    const findingDraftKey = editing ? ("5s_edit_" + record?.id + "_" + rowIndex) : ("5s_new_" + periodId);
    const rawFindingDraft = window.FormDraftManager?.getDraft(findingDraftKey);
    if (rawFindingDraft && typeof rawFindingDraft === "object") {
      rawFindingDraft.photoDataUrl = cleanFindingDraftPhotoUrl(rawFindingDraft.photoDataUrl);
      rawFindingDraft.afterPhotoDataUrl = cleanFindingDraftPhotoUrl(rawFindingDraft.afterPhotoDataUrl);
    }
    const hasMeaningfulNewFindingDraft = (d) => Boolean(
      d && (
        String(d.problem || "").trim() ||
        String(d.location || "").trim() ||
        (canManageCountermeasure && String(d.countermeasure || "").trim()) ||
        (canManageCountermeasure && String(d.dueDate || "").trim()) ||
        cleanFindingDraftPhotoUrl(d.photoDataUrl) ||
        (canManageCountermeasure && cleanFindingDraftPhotoUrl(d.afterPhotoDataUrl))
      )
    );
    if (!editing && rawFindingDraft && !hasMeaningfulNewFindingDraft(rawFindingDraft)) {
      window.FormDraftManager?.clearDraft(findingDraftKey);
    }
    if (editing && rawFindingDraft) {
      const draftMatchesOriginal =
        String(rawFindingDraft.areaId || "") === String(origAreaId || "") &&
        displayDate(rawFindingDraft.inspectionDate) === displayDate(origInitialDate) &&
        String(rawFindingDraft.inspector1 || "").trim() === String(origInitN1 || "").trim() &&
        String(rawFindingDraft.inspector2 || "").trim() === String(origInitN2 || "").trim() &&
        areFindingRowsEqual(rawFindingDraft, originalRow);
      if (draftMatchesOriginal) {
        window.FormDraftManager?.clearDraft(findingDraftKey);
      }
    }
    const findingDraft = (!editing && !hasMeaningfulNewFindingDraft(rawFindingDraft))
      ? null
      : (editing && rawFindingDraft && window.FormDraftManager?.hasDraft(findingDraftKey) ? rawFindingDraft : null);

    let effectiveAreaId = areaId;
    if (findingDraft) {
      if (findingDraft.areaId) effectiveAreaId = findingDraft.areaId;
      if (findingDraft.inspectionDate) initialDate = findingDraft.inspectionDate;
      if (findingDraft.inspector1 !== undefined) initN1 = findingDraft.inspector1;
      if (findingDraft.inspector2 !== undefined) initN2 = findingDraft.inspector2;
      fields.forEach((k) => {
        if (findingDraft[k] !== undefined) row[k] = findingDraft[k];
      });
      if (findingDraft.photoDataUrl) {
        row.photoDataUrl = findingDraft.photoDataUrl;
        row.photoAnnotations = findingDraft.photoAnnotations || [];
      }
      if (findingDraft.afterPhotoDataUrl) {
        row.afterPhotoDataUrl = findingDraft.afterPhotoDataUrl;
        row.afterPhotoAnnotations = findingDraft.afterPhotoAnnotations || [];
      }
    }

    let baselineSnapshot = null;
    const captureFindingSnapshot = () => {
      const modalForm = ctx.elements?.modalBody?.querySelector("form");
      if (!modalForm) return null;
      const readPhotoState = (photoField, annotationField) => {
        const photoPreview = modalForm.querySelector(`[data-findings-photo-preview][data-finding-photo-field="${photoField}"]`);
        const photoUrl = photoPreview && !photoPreview.hidden && !photoPreview.closest(".photo-preview-wrap")?.classList.contains("is-hidden")
          ? (photoPreview.dataset?.photoSrc || photoPreview.dataset?.previewImg || photoPreview.getAttribute("src") || "")
          : "";
        let photoAnnotations = [];
        try { photoAnnotations = JSON.parse(photoPreview?.dataset?.safetyAnnotations || photoPreview?.dataset?.findingPhotoAnnotations || "[]"); } catch (_) {}
        return { photoUrl: cleanFindingDraftPhotoUrl(photoUrl), photoAnnotations };
      };
      const beforePhoto = readPhotoState("photoDataUrl", "photoAnnotations");
      const afterPhoto = readPhotoState("afterPhotoDataUrl", "afterPhotoAnnotations");
      const snap = {
        areaId: modalForm.elements.areaId?.value || "",
        inspectionDate: modalForm.elements.inspectionDate?.value || "",
        inspector1: modalForm.elements.inspector1?.value || "",
        inspector2: modalForm.elements.inspector2?.value || "",
        photoDataUrl: beforePhoto.photoUrl,
        photoAnnotations: beforePhoto.photoAnnotations,
        afterPhotoDataUrl: afterPhoto.photoUrl,
        afterPhotoAnnotations: afterPhoto.photoAnnotations,
      };
      fields.forEach((k) => {
        const input = modalForm.querySelector('[data-field="' + k + '"]');
        snap[k] = input ? input.value : "";
      });
      return snap;
    };

    const isFindingModalDirty = () => {
      if (!writable) return false;
      const cur = captureFindingSnapshot();
      if (!cur) return false;
      if (!editing) {
        return hasMeaningfulNewFindingDraft(cur);
      }
      if (baselineSnapshot) {
        return JSON.stringify(cur) !== JSON.stringify(baselineSnapshot);
      }
      return false;
    };

    let saving = false;
    const isMobileLight = Boolean(
      host?.closest?.(".is-light-theme") ||
      document.querySelector(".mobile-responsive-overlay")?.classList?.contains("is-light-theme")
    );
    const isMobileDark = mobile && !isMobileLight;
    const beforePhotoEditable = fullWritable;
    const beforePhotoHtml = mobile
      ? mobilePhotoEditor(row, beforePhotoEditable, esc, { sheetId: record?.id, rowIndex, editable: beforePhotoEditable })
      : photoEditor(row, beforePhotoEditable, esc, { sheetId: record?.id, rowIndex, editable: beforePhotoEditable });
    const afterPhotoEditable = canManageCountermeasure;
    const afterPhotoHtml = mobile
      ? mobilePhotoEditor(row, afterPhotoEditable, esc, { sheetId: record?.id, rowIndex, editable: afterPhotoEditable, photoField: "afterPhotoDataUrl" })
      : photoEditor(row, afterPhotoEditable, esc, { sheetId: record?.id, rowIndex, editable: afterPhotoEditable, photoField: "afterPhotoDataUrl" });
    const isFieldEditable = (k) => {
      if (countermeasureFields.has(k)) {
        return canManageCountermeasure;
      }
      return fullWritable;
    };

    ctx.openFormModal({
      title: editing ? writable ? countermeasureOnly ? "Cập nhật xử lý vấn đề 5S" : "Sửa vấn đề 5S" : "Chi tiết vấn đề 5S" : "Thêm vấn đề 5S",
      submitText: countermeasureOnly ? "Lưu cập nhật" : mobile && editing ? "Lưu thay đổi" : "Lưu vấn đề",
      draftKey: findingDraftKey,
      getDraftSnapshot: captureFindingSnapshot,
      isDraftDirty: isFindingModalDirty,
      extraRightActions: mobile && editing && fullWritable ? '<button type="button" class="danger-button" data-delete-issue-modal>Xóa vấn đề</button>' : "",
      modalClass: `findings-issue-modal${mobile ? " is-mobile-detail" : ""}${!writable ? " is-readonly" : ""}${mobile ? (isMobileDark ? " is-mobile-dark" : " is-light-theme") : " is-light-theme"}`,
      html: `<div class="modal-context"><span><strong>Kỳ:</strong> ${esc(ctx.periodLabel(ctx.getPeriod(periodId)))}</span><span><strong>Nguồn:</strong> Vấn đề 5S</span></div>
        ${!writable ? '<p class="findings-readonly" role="status">Chỉ xem — bạn có thể xem chi tiết và đối sách nhưng không có quyền chỉnh sửa vấn đề 5S của Zone này.</p>' : ""}
        ${countermeasureOnly ? '<p class="findings-countermeasure-permission-note">Bạn được cập nhật biện pháp khắc phục, ảnh sau xử lý, hạn hoàn thành và tiến độ của Zone này.</p>' : ""}
        ${!editing && !isAdmin ? '<p class="findings-countermeasure-permission-note">Đối sách khắc phục, ảnh sau xử lý, hạn và tiến độ sẽ do quản lý Zone hoặc Admin cập nhật sau khi tiếp nhận.</p>' : ""}
        <div class="findings-page">
          <div class="findings-vertical-form">
            <div class="finding-form-group">
              <label class="finding-form-label">Zone <span class="required-star">*</span></label>
              <div class="finding-form-control">
                <select name="areaId" required ${fullWritable ? "" : "disabled"} aria-label="Zone">
                  <option value="">Chọn Zone 5S</option>
                  ${areas.map((area) => `<option value="${esc(area.id)}" ${area.id === effectiveAreaId ? "selected" : ""}>${esc(zoneLabel(area))}</option>`).join("")}
                </select>
              </div>
            </div>

            <div class="finding-form-group">
              <label class="finding-form-label">Vấn đề <span class="required-star">*</span></label>
              <div class="finding-form-control">
                ${cell(row, "problem", 0, "Vấn đề", true, esc, mobile, isFieldEditable("problem"))}
              </div>
            </div>

            <div class="finding-form-group">
              <label class="finding-form-label">Ảnh vấn đề</label>
              <div class="finding-form-control">
                ${beforePhotoHtml}
              </div>
            </div>

            <div class="finding-form-group">
              <label class="finding-form-label">Vị trí</label>
              <div class="finding-form-control">
                ${cell(row, "location", 0, "Vị trí", true, esc, mobile, isFieldEditable("location"))}
              </div>
            </div>

            <div class="finding-form-row finding-form-row-2">
              <div class="finding-form-group">
                <label class="finding-form-label">Ngày kiểm tra <span class="required-star">*</span></label>
                <div class="finding-form-control">
                  ${dateEditor(initialDate, 'name="inspectionDate"', fullWritable, esc, true)}
                </div>
              </div>
              <div class="finding-form-group">
                <label class="finding-form-label">Người kiểm tra <span class="required-star">*</span></label>
                <div class="findings-inspectors-inputs">
                  <input name="inspector1" required maxlength="20" placeholder="Người kiểm tra 1" value="${esc(initN1)}" ${fullWritable ? "" : "disabled"}>
                  <input name="inspector2" maxlength="20" placeholder="Người kiểm tra 2" value="${esc(initN2)}" ${fullWritable ? "" : "disabled"}>
                </div>
              </div>
            </div>

            <div class="finding-form-row finding-form-row-2">
              <div class="finding-form-group">
                <label class="finding-form-label">Hạng mục</label>
                <div class="finding-form-control">
                  ${cell(row, "fiveS", 0, "Hạng mục", true, esc, mobile, isFieldEditable("fiveS"))}
                </div>
              </div>
              <div class="finding-form-group">
                <label class="finding-form-label">Ca làm việc</label>
                <div class="finding-form-control">
                  ${cell(row, "shift", 0, "Ca làm việc", true, esc, mobile, isFieldEditable("shift"))}
                </div>
              </div>
            </div>

            <div class="finding-form-group">
              <label class="finding-form-label">Biện pháp khắc phục</label>
              <div class="finding-form-control">
                ${cell(row, "countermeasure", 0, "Biện pháp khắc phục", true, esc, mobile, isFieldEditable("countermeasure"))}
              </div>
            </div>

            <div class="finding-form-group findings-after-photo-field">
              <label class="finding-form-label" data-after-photo-label="Ảnh sau xử lý">Ảnh sau cải tiến, xử lý</label>
              <div class="finding-form-control">
                ${afterPhotoHtml}
              </div>
            </div>

            <div class="finding-form-row finding-form-row-2">
              <div class="finding-form-group">
                <label class="finding-form-label">Hạn hoàn thành</label>
                <div class="finding-form-control">
                  ${cell(row, "dueDate", 0, "Hạn hoàn thành", true, esc, mobile, isFieldEditable("dueDate"))}
                </div>
              </div>
              <div class="finding-form-group">
                <label class="finding-form-label">Tiến độ</label>
                <div class="finding-form-control">
                  ${cell(row, "progress", 0, "Tiến độ", true, esc, mobile, isFieldEditable("progress"))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <p class="findings-modal-error" role="alert"></p>`,
      async onSubmit(_formData, form) {
        if (!writable) { ctx.showToast("Bạn không có quyền sửa, lưu vấn đề 5S này.", true); return false; }
        if (saving) return false;
        const error = form.querySelector(".findings-modal-error");
        error.textContent = "";
        const selectedAreaId = fullWritable ? form.elements.areaId.value : effectiveAreaId;
        const selected = areas.find((area) => area.id === selectedAreaId);
        const issue = fullWritable
          ? Object.fromEntries(fields.map((key) => [key, form.querySelector(`[data-field="${key}"]`)?.value.trim() || ""]))
          : {
              ...clone(originalRow || {}),
              countermeasure: form.querySelector('[data-field="countermeasure"]')?.value.trim() || "",
              dueDate: form.querySelector('[data-field="dueDate"]')?.value.trim() || "",
              progress: form.querySelector('[data-field="progress"]')?.value || "0",
            };
        if (!canManageCountermeasure) {
          if (!editing) {
            issue.countermeasure = "";
            issue.dueDate = "";
            issue.progress = "0";
            issue.afterPhotoDataUrl = "";
            issue.afterPhotoName = "";
            issue.afterPhotoAnnotations = [];
          } else {
            issue.countermeasure = originalRow?.countermeasure || "";
            issue.dueDate = originalRow?.dueDate || "";
            issue.progress = originalRow?.progress || "0";
            issue.afterPhotoDataUrl = originalRow?.afterPhotoDataUrl || "";
            issue.afterPhotoName = originalRow?.afterPhotoName || "";
            issue.afterPhotoAnnotations = originalRow?.afterPhotoAnnotations || [];
          }
        }
        if (!fullWritable && originalRow) {
          issue.location = originalRow.location || "";
          issue.problem = originalRow.problem || "";
          issue.fiveS = originalRow.fiveS || "";
          issue.shift = originalRow.shift || "";
          issue.photoDataUrl = originalRow.photoDataUrl || "";
          issue.photoName = originalRow.photoName || "";
          issue.photoAnnotations = originalRow.photoAnnotations || [];
        }
        if (fullWritable) {
          issue.photoAnnotations = form.elements.findingPhoto?.files?.[0] ? (pendingPhotoAnnotations || []) : (originalRow?.photoAnnotations || []);
        }
        if (canManageCountermeasure) {
          issue.afterPhotoAnnotations = form.elements.findingAfterPhoto?.files?.[0]
            ? (pendingAfterPhotoAnnotations || [])
            : (originalRow?.afterPhotoAnnotations || []);
        } else {
          issue.afterPhotoAnnotations = originalRow?.afterPhotoAnnotations || [];
        }
        const originalPhotoUrl = originalRow?.photoDataUrl || "";
        const originalAfterPhotoUrl = originalRow?.afterPhotoDataUrl || "";
        const inspectionDate = ctx.parseDisplayDateToIso(form.elements.inspectionDate.value);
        if (!selected) { error.textContent = "Vui lòng chọn Zone."; return false; }
        if (fullWritable && !editableAreas(ctx, periodId).some((area) => area.id === selected.id)) {
          ctx.showToast("Bạn không có quyền sửa hoặc lưu vấn đề 5S ở Zone này.", true);
          return false;
        }
        if (!issue.problem) { error.textContent = "Vui lòng nhập vấn đề 5S."; form.querySelector('[data-field="problem"]').focus(); return false; }
        const n1 = form.elements.inspector1 ? form.elements.inspector1.value.trim().slice(0, 20) : "";
        const n2 = form.elements.inspector2 ? form.elements.inspector2.value.trim().slice(0, 20) : "";
        if (fullWritable && !n1 && !n2) {
          error.textContent = "Vui lòng nhập người kiểm tra (tối đa 2 người, mỗi người tối đa 20 chữ cái).";
          form.elements.inspector1?.focus();
          return false;
        }
        if (fullWritable && ((form.elements.inspector1 && form.elements.inspector1.value.trim().length > 20) || (form.elements.inspector2 && form.elements.inspector2.value.trim().length > 20))) {
          error.textContent = "Mỗi tên người kiểm tra tối đa 20 chữ cái.";
          return false;
        }
        const inspector = formatInspectors(n1, n2);
        if (fullWritable && (!inspectionDate || !inspector)) { error.textContent = "Vui lòng nhập người kiểm tra và ngày hợp lệ (dd/mm/yyyy)."; return false; }
        if (issue.dueDate && !ctx.parseDisplayDateToIso(issue.dueDate)) { error.textContent = "Hạn hoàn thành không hợp lệ (dd/mm/yyyy)."; return false; }
        issue.dueDate = issue.dueDate ? ctx.parseDisplayDateToIso(issue.dueDate) : "";
        const storedTarget = editing ? (ctx.state.fiveSFindings || []).find((item) => item.id === record.id) : null;
        const targetCandidate = editing ? (storedTarget || record) : findMatchingSheet(ctx, periodId, selected.id, inspector, inspectionDate);
        const managerCannotEditExistingSheet = !editing && targetCandidate
          && canManageFindingCountermeasure(ctx, targetCandidate)
          && !canEditSheet(ctx, targetCandidate);
        // Zone managers may still add findings. Keep their new finding in a new
        // sheet because the server limits edits to existing sheets to response fields.
        const target = managerCannotEditExistingSheet ? null : targetCandidate;
        if (editing && storedTarget && hasChanged(storedTarget)) {
          ctx.showToast("Vấn đề đã thay đổi. Đóng cửa sổ và mở lại để sửa dữ liệu mới nhất.", true);
          return false;
        }
        if (target && !canEditFinding(ctx, target)) {
          ctx.showToast("Bạn không có quyền thay đổi Zone này.", true);
          return false;
        }
        const metadataChanged = fullWritable && editing && (resolveAreaId(target, areas) !== selected.id || target.inspector !== inspector || target.inspectionDate !== inspectionDate);
        // Legacy records share inspection details across rows. Split only the edited
        // issue when those details change, and persist both records atomically.
        const split = metadataChanged && target.rows.some((item, index) => index !== rowIndex && rowHasContent(item));
        const remaining = split ? clone(target) : null;
        if (remaining) remaining.rows.splice(rowIndex, 1);
        const data = target && !split ? clone(target) : fresh(ctx, periodId);
        if (fullWritable) {
          data.periodId = periodId;
          data.areaId = selected.id;
          data.area = zoneLabel(selected);
          if (editing || !target) { data.inspector = inspector; data.inspectionDate = inspectionDate; }
        } else {
          if (!data.periodId && periodId) data.periodId = periodId;
          if (!data.areaId && selected?.id) data.areaId = selected.id;
        }
        let index = editing && !split ? rowIndex : data.rows.findIndex((item) => !rowHasContent(item));
        if (index < 0) index = data.rows.length;
        data.rows[index] = issue;
        data.createdAt ||= new Date().toISOString();
        data.updatedAt = new Date().toISOString();
        data.updatedBy = ctx.currentUser.id;
        saving = true;
        const controls = [...ctx.elements.modalBackdrop.querySelectorAll("button, input, select, textarea")].map((el) => [el, el.disabled]);
        controls.forEach(([el]) => { el.disabled = true; });
        let nextPhotoUrl = originalPhotoUrl;
        let nextAfterPhotoUrl = originalAfterPhotoUrl;
        try {
          const updates = remaining ? [remaining, data] : [data];
          if (fullWritable) {
            const nextPhoto = await ctx.prepareScorePhoto(form.elements.findingPhoto?.files?.[0], originalRow || issue, form.elements.removeFindingPhoto?.checked, periodId, "van-de-5s", "anh-truoc-xu-ly");
            if (form.elements.removeFindingPhoto?.checked) issue.photoAnnotations = [];
            issue.photoDataUrl = nextPhoto.photoDataUrl;
            issue.photoName = nextPhoto.photoName;
            nextPhotoUrl = issue.photoDataUrl || "";
          }
          if (canManageCountermeasure) {
            const nextAfterPhoto = await ctx.prepareScorePhoto(
              form.elements.findingAfterPhoto?.files?.[0],
              { photoDataUrl: originalAfterPhotoUrl, photoName: originalRow?.afterPhotoName || "" },
              form.elements.removeFindingAfterPhoto?.checked,
              periodId,
              "van-de-5s",
              "anh-sau-xu-ly",
            );
            if (form.elements.removeFindingAfterPhoto?.checked) issue.afterPhotoAnnotations = [];
            issue.afterPhotoDataUrl = nextAfterPhoto.photoDataUrl;
            issue.afterPhotoName = nextAfterPhoto.photoName;
            nextAfterPhotoUrl = issue.afterPhotoDataUrl || "";
          }
          if (remaining) {
            remaining.periodId = periodId;
            remaining.areaId = resolveAreaId(target, areas);
            remaining.updatedAt = data.updatedAt;
            remaining.updatedBy = data.updatedBy;
            await ctx.saveFiveSFindingsBatch(updates);
          } else await ctx.saveFiveSFinding(data);
          ctx.state.fiveSFindings = [...(ctx.state.fiveSFindings || []).filter((item) => !updates.some((updated) => updated.id === item.id)), ...updates];
          if (mobile) {
            view.findingMonthKey = monthKeyForFinding(data, ctx.getPeriodsByType(ctx.FIVE_S_PERIOD_TYPE));
            view.findingsListPage = 1;
          }
          await ctx.deleteUnusedPhotoFiles([
            nextPhotoUrl !== originalPhotoUrl ? originalPhotoUrl : "",
            nextAfterPhotoUrl !== originalAfterPhotoUrl ? originalAfterPhotoUrl : "",
          ]);
          invalidateFindingsPageCache(view);
          if (editing && view.zoneFilter) view.zoneFilter = `id:${selected.id}`;
          view.selectedId = data.id;
          view.showDetail = false;
          view.issueIndex = null;
          view.notice = null;
          render(host, view);
          window.FormDraftManager?.clearDraft(findingDraftKey);
          message(host, editing ? "Đã lưu thay đổi vấn đề 5S thành công!" : "Đã lưu vấn đề 5S thành công!");
          return true;
        } catch (failure) {
          try {
            await ctx.deleteUnusedPhotoFiles([
              nextPhotoUrl !== originalPhotoUrl ? nextPhotoUrl : "",
              nextAfterPhotoUrl !== originalAfterPhotoUrl ? nextAfterPhotoUrl : "",
            ]);
          } catch (_) {}
          ctx.showToast(failure?.message || "Không lưu được vấn đề. Vui lòng thử lại.", true);
          return false;
        } finally {
          saving = false;
          controls.forEach(([el, disabled]) => { el.disabled = disabled; });
        }
      },
    });
    const form = ctx.elements.modalBody.querySelector("form");
    bindPhotoEditor(form, ctx, originalRow || row, {
      sheetId: record?.id,
      rowIndex,
      editable: fullWritable,
      afterPhotoEditable: afterPhotoEditable,
      preserveOriginal: editing,
      onPhotoReplaced: (photoField) => {
        if (photoField === "afterPhotoDataUrl") pendingAfterPhotoAnnotations = [];
        else pendingPhotoAnnotations = [];
      },
      onAnnotationsSaved: (annotations, { pending, photoField }) => {
        if (photoField === "afterPhotoDataUrl") {
          if (pending) pendingAfterPhotoAnnotations = annotations;
          else if (originalRow) originalRow.afterPhotoAnnotations = annotations;
        } else if (pending) pendingPhotoAnnotations = annotations;
        else if (originalRow) originalRow.photoAnnotations = annotations;
      },
    });
    form.querySelectorAll(".findings-date-editor").forEach((wrap) => {
      const input = wrap.querySelector("[data-finding-date]");
      const calendar = wrap.querySelector(".findings-date-calendar");
      if (!calendar || !input) return;
      input.addEventListener("input", () => { calendar.value = ctx.parseDisplayDateToIso(input.value) || ""; });
      for (const event of ["input", "change"]) calendar.addEventListener(event, () => { input.value = displayDate(calendar.value); });
    });
    ctx.hydrateAuthenticatedPhotos(ctx.elements.modalBody);
    baselineSnapshot = captureFindingSnapshot();
    if (writable) form.querySelector('[data-field="problem"]').required = true;
    if (!writable) {
      ctx.elements.modalActions.querySelector('[type="submit"]')?.remove();
      ctx.elements.modalActions.querySelector("[data-delete-issue-modal]")?.remove();
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
      const storedTarget = (ctx.state.fiveSFindings || []).find((item) => item.id === record.id);
      const target = storedTarget || record;
      const currentIssue = target.rows?.[rowIndex];
      if (!currentIssue || findingRowIdentity(currentIssue) !== findingRowIdentity(originalRow) || !canEditSheet(ctx, target)) {
        ctx.showToast("Vấn đề đã thay đổi hoặc bạn không còn quyền xóa. Hãy tải lại danh sách rồi thử lại.", true);
        return;
      }
      if (!window.confirm("Xóa vấn đề 5S này?")) return;
      const data = clone(target);
      const removedPhotoUrls = [data.rows[rowIndex]?.photoDataUrl, data.rows[rowIndex]?.afterPhotoDataUrl].filter(Boolean);
      data.rows.splice(rowIndex, 1);
      data.updatedAt = new Date().toISOString();
      data.updatedBy = ctx.currentUser.id;
      saving = true;
      const controls = [...ctx.elements.modalBackdrop.querySelectorAll("button, input, select, textarea")].map((el) => [el, el.disabled]);
      controls.forEach(([el]) => { el.disabled = true; });
      try {
        await ctx.saveFiveSFinding(data);
        ctx.state.fiveSFindings = [...(ctx.state.fiveSFindings || []).filter((item) => item.id !== data.id), data];
        await ctx.deleteUnusedPhotoFiles(removedPhotoUrls);
        window.FormDraftManager?.clearDraft(findingDraftKey);
        if (mobile) view.findingsListPage = 1;
        invalidateFindingsPageCache(view);
        ctx.closeModal({ force: true });
        render(host, view);
        message(host, "Đã xóa vấn đề 5S thành công!");
      } catch (failure) {
        ctx.showToast(failure?.message || "Không xóa được vấn đề. Vui lòng thử lại.", true);
      } finally {
        saving = false;
        controls.forEach(([el, disabled]) => { el.disabled = disabled; });
      }
    });
    form.elements.areaId?.addEventListener("change", (event) => {
      const selectedId = event.target.value;
      if (!selectedId) return;
      const [n1, n2] = getAreaInspectors(selectedId);
      const loggedInInspector = String(ctx.getAccountDisplayName?.(ctx.currentUser, ctx.FIVE_S_PERIOD_TYPE, periodId) || ctx.currentUser?.name || ctx.currentUser?.username || "").trim().slice(0, 20);
      if (form.elements.inspector1) {
        if (!editing) {
          form.elements.inspector1.value = loggedInInspector || form.elements.inspector1.value.trim() || n1;
        } else {
          form.elements.inspector1.value = n1 || loggedInInspector;
        }
      }
      if (form.elements.inspector2) {
        if (!editing) {
          if (!form.elements.inspector2.value.trim() && n2) form.elements.inspector2.value = n2;
        } else {
          form.elements.inspector2.value = n2 || "";
        }
      }
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
    if (writable && (editing || areaId) && !mobile) (form.querySelector('[data-field="problem"]') || form.querySelector('[data-field="location"]'))?.focus();
  }

  function openIssueById(host, sheetId, rowIndex) {
    const view = host ? views.get(host) : null;
    const record = view?.ctx?.state?.fiveSFindings?.find((item) => item.id === sheetId);
    const index = Number(rowIndex);
    if (!view || !record?.rows?.[index]) return false;
    openIssueModal(host, view, record, index);
    return true;
  }

  function mobileList(records, periodRecords, esc, ctx, monthOptionsHtml = "", pagination = null, view = null) {
    const issues = records.flatMap((sheet) => (sheet.rows || []).map((row, index) => ({ sheet, row, index })).filter(({ row }) => rowHasContent(row)))
      .sort((left, right) => compareFindingsNewestFirst(left.sheet, right.sheet) || right.index - left.index);
    const total = pagination?.totalRows ?? periodRecords.reduce((count, sheet) => count + (sheet.rows || []).filter(rowHasContent).length, 0);
    return `<section class="findings-mobile-list" aria-label="Danh sách vấn đề 5S">
      <div class="findings-list-heading"><div class="history-heading-filter"><h3 class="history-section-title">VẤN ĐỀ 5S ĐÃ GHI NHẬN</h3><label class="history-period-filter"><span>Tháng</span><select data-finding-month aria-label="Lọc vấn đề 5S theo tháng" ${monthOptionsHtml ? "" : "disabled"}>${monthOptionsHtml || '<option value="">Chưa có dữ liệu</option>'}</select></label></div><span class="findings-list-count">${issues.length === total ? `${total} vấn đề` : `${issues.length} / ${total} vấn đề trong tháng`}</span></div>
      <label class="mobile-assigned-zone-filter">
        <input type="checkbox" data-findings-assigned-zone-filter ${view?.assignedZonesOnly ? "checked" : ""}>
        <span>Chỉ hiển thị Zone được phân công</span>
      </label>
      ${issues.length ? issues.map(({ sheet, row, index }) => {
        const complete = isFindingResolved(row);
        return `<button type="button" class="findings-record-card" data-open-finding="${esc(sheet.id)}" data-issue-index="${index}">
          ${row.photoDataUrl ? `<img class="findings-record-thumb" src="${esc(photoThumbnailUrl(row.photoDataUrl))}" data-preview-img="${esc(row.photoDataUrl)}" loading="lazy" decoding="async" alt="Ảnh vấn đề 5S" ${photoImageAttributes(row, esc, { sheetId: sheet.id, rowIndex: index, editable: canEditSheet(ctx, sheet) })}>` : '<span class="findings-record-icon" aria-hidden="true">▤</span>'}
          <span class="findings-record-copy"><strong>${esc(shortZoneLabel(sheet.area) || "Chưa chọn Zone")}</strong><span>${esc(row.problem || "Vấn đề 5S")}</span><small>${esc(displayDate(sheet.inspectionDate))}</small></span>
          <span class="findings-status ${complete ? "is-done" : ""}">${complete ? "Đã xử lý" : "Chưa xử lý"}</span><span aria-hidden="true">›</span>
        </button>`;
      }).join("") : '<div class="findings-empty"><span aria-hidden="true">▤</span><strong>Chưa có vấn đề trong tháng này</strong><p>Điền thông tin ở trên để ghi nhận vấn đề 5S.</p></div>'}
      ${pagination?.totalPages > 1 ? `<div class="safety-table-pager" aria-label="Phân trang vấn đề 5S"><button type="button" class="tiny-button" data-findings-page="${pagination.page - 1}" ${pagination.page <= 1 ? "disabled" : ""}>Trước</button><span>${issues.length}/${total} · Trang ${pagination.page}/${pagination.totalPages}</span><button type="button" class="tiny-button" data-findings-page="${pagination.page + 1}" ${pagination.page >= pagination.totalPages ? "disabled" : ""}>Sau</button></div>` : ""}
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
    <div class="findings-issue-list">${rows.map(({ row, index }) => {
      const complete = isFindingResolved(row);
      return `<details class="findings-issue-card" ${!editing || Number.isInteger(selectedIndex) || index === (view.openRow || 0) ? "open" : ""}>
      <summary><span class="findings-issue-number">${index + 1}</span><span>${esc(row.problem || "Vấn đề mới")}</span><span class="findings-status ${complete ? "is-done" : ""}">${complete ? "Đã xử lý" : `${Number(row.progress) || 0}%`}</span></summary>
      <div class="findings-mobile-grid">${fields.map((key, col) => field(labels[col], cell(row, key, index, labels[col], editing, esc, true), ["location", "problem", "countermeasure"].includes(key))).join("")}</div>
      ${editing ? `<button type="button" class="findings-remove-issue" data-remove-row="${index}" aria-label="Xóa vấn đề ${index + 1}">Xóa vấn đề</button>` : ""}
    </details>`;
    }).join("")}</div>`;
  }

  function cell(row, key, index, label, editing, esc, mobile = false, fieldEditable = editing) {
    const value = String(row[key] ?? (key === "progress" ? "0" : ""));
    const attrs = `data-row="${index}" data-field="${key}" aria-label="Dòng ${index + 1}: ${label}"`;
    const options = (items) => items.map(([id, text]) => `<option value="${esc(id)}" ${value === id ? "selected" : ""}>${esc(text)}</option>`).join("");
    if (key === "progress") {
      const progress = ["0", "25", "50", "75", "100"].includes(value) ? value : "0";
      if (!editing) {
        return `<div class="findings-progress" style="--progress:${progress}%" aria-hidden="true"></div><span>${progress}%</span>`;
      }
      return `<div class="findings-progress" style="--progress:${progress}%" aria-hidden="true"></div><select ${attrs} ${fieldEditable ? "" : "disabled"}>${options(["0", "25", "50", "75", "100"].map((v) => [v, v + "%"]))}</select>`;
    }
    if (key === "dueDate") {
      if (!editing) return `<span>${esc(displayDate(value))}</span>`;
      return dateEditor(value, attrs, fieldEditable, esc);
    }
    if (!editing) {
      if (key === "fiveS") return `<span>${esc(findingCategoryLabel(value))}</span>`;
      return `<span>${esc(value)}</span>`;
    }
    if (key === "fiveS") {
      const selectedId = findingCategoryNormalized(value);
      return `<select ${attrs} ${fieldEditable ? "" : "disabled"}><option value="">Chưa chọn</option>${FINDING_CATEGORIES.map(([id, text]) => `<option value="${esc(text)}" ${selectedId === id || value === text ? "selected" : ""}>${esc(text)}</option>`).join("")}</select>`;
    }
    if (key === "shift") return `<input type="text" ${attrs} value="${esc(value)}" maxlength="2000" placeholder="Ca làm việc" ${fieldEditable ? "" : "disabled"}>`;
    if (mobile && key === "location") return `<input type="text" ${attrs} value="${esc(value)}" maxlength="2000" ${fieldEditable ? "" : "disabled"}>`;
    return `<textarea ${attrs} rows="3" maxlength="2000" ${fieldEditable ? "" : "disabled"}>${esc(value)}</textarea>`;
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
    view.draft.inspectionDate = form.elements.inspectionDate ? readDate(form.elements.inspectionDate) : view.draft.inspectionDate;
    form.querySelectorAll("[data-row][data-field]").forEach((input) => {
      const rowIndex = Number(input.dataset.row);
      view.draft.rows[rowIndex] ||= blankRow();
      view.draft.rows[rowIndex][input.dataset.field] = input.dataset.field === "dueDate" ? readDate(input) : input.value.trim();
    });
  }

  function dateEditor(value, attrs, editing, esc, required = false) {
    return `<span class="findings-date-editor"><input type="text" ${attrs} data-finding-date value="${esc(displayDate(value))}" placeholder="${editing ? "dd/mm/yyyy" : ""}" inputmode="numeric" maxlength="10" ${required ? "required" : ""} ${editing ? "" : "disabled"}>
      ${editing ? `<input type="date" class="findings-date-calendar" aria-label="Mở lịch chọn ngày" value="${/^\d{4}-\d{2}-\d{2}$/.test(value) ? esc(value) : ""}" tabindex="0"><button type="button" class="btn-calendar-trigger" tabindex="-1" aria-hidden="true"><i class="fa-solid fa-calendar-days"></i></button>` : ""}</span>`;
  }

  function message(host, text, error = false) {
    const view = views.get(host);
    if (host?.id === "mobileScreenFindings" && text && text !== "Đang lưu...") {
      if (view) view.notice = null;
      const el = host.querySelector(".findings-message");
      if (el) {
        el.textContent = "";
        el.classList.remove("is-error");
      }
      view?.ctx?.showToast?.(text, error);
      return;
    }
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
      invalidateFindingsPageCache(view);
      view.busy = false;
      render(host, view);
      message(host, success);
    } catch (error) {
      view.busy = false;
      view.notice = null;
      render(host, view);
      view.ctx?.showToast?.(error?.message || "Không lưu được phiếu. Vui lòng thử lại.", true);
    }
  }

  function invalidateFindingsPageCache(view) {
    if (view) view.findingsListPage = 1;
  }

  window.FiveSFindingsPage = {
    mount,
    resetFilters(host) {
      const view = host ? views.get(host) : null;
      if (!view) return;
      view.findingYear = 0;
      view.findingMonth = 0;
      view.selectedId = "";
      view.rowPage = 0;
    },
    resolvePeriodId,
    resolveAreaId,
    findingCategoryLabel,
    FINDING_CATEGORIES,
    parseInspectors,
    formatInspectors,
    canEditSheet,
    isFindingResolved,
    openIssueById,
  };
  window.PageRegistry.register({ id: "five-s-findings", title: "Vấn đề 5S", render: (ctx) => mount(document.getElementById("tab-five-s-findings"), ctx) });
})();
