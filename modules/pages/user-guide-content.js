(() => {
  const SECTIONS = [
    {
      id: "safety",
      label: "Báo cáo an toàn",
      defaults: {
        title: "Thêm vấn đề an toàn",
        intro: "Ghi nhận mối nguy, biện pháp xử lý và theo dõi báo cáo an toàn.",
        hint: "Kiểm tra kỳ đang chọn và trạng thái mở trước khi lưu. Quyền sửa hoặc xóa báo cáo cũ phụ thuộc vai trò và trạng thái lưu trữ.",
        adminNote: "Admin chọn kỳ An toàn đang mở và Zone cần ghi nhận trong biểu mẫu. Admin có thể chọn các Zone.",
        steps: [
          { id: "safety-zone", title: "Chọn khu vực", body: "Chọn tab Báo cáo An toàn, sau đó chọn Khu vực (Zone). Kiểm tra ngày phát hiện đã đúng chưa.", imageUrl: "" },
          { id: "safety-danger", title: "Mô tả mối nguy", body: "Nhập mối nguy hiểm phát hiện. Nêu rõ vị trí, tình trạng và nguy cơ để người phụ trách dễ xử lý.", imageUrl: "" },
          { id: "safety-photo", title: "Thêm thông tin và ảnh", body: "Chạm khung ảnh để chụp hoặc chọn ảnh hiện trường. Nếu phù hợp, chọn STOP 6, cấp độ A/B/C, kênh phát hiện và tình trạng.", imageUrl: "" },
          { id: "safety-action", title: "Ghi biện pháp xử lý và lưu", body: "Nhập biện pháp cải tiến, người phụ trách và ngày dự kiến. Chạm Lưu báo cáo an toàn; danh sách báo cáo nằm phía dưới.", imageUrl: "" },
        ],
      },
    },
    {
      id: "5s",
      label: "Chấm điểm 5S",
      defaults: {
        title: "Chấm điểm 5S",
        intro: "Chọn Zone, đối chiếu tiêu chí và ghi điểm cho từng hạng mục.",
        hint: "Điểm được lưu sau khi chạm chọn. Theo dõi số hạng mục đã đánh giá, điểm trung bình và tiến độ ở đầu màn hình. Nếu chỉ xem được, liên hệ Admin để kiểm tra quyền và kỳ.",
        adminNote: "Admin chọn kỳ 5S đang mở, Zone và nguồn điểm cần cập nhật. Điểm chỉ ghi được khi kỳ 5S còn mở.",
        steps: [
          { id: "5s-zone", title: "Chọn Zone và nguồn điểm", body: "Chọn tab Chấm Điểm 5S, sau đó chọn Zone ở mục Khu vực kiểm tra. Nếu có Nguồn điểm, chọn Assessor chấm hoặc Quản lý Zone tự chấm.", imageUrl: "" },
          { id: "5s-criteria", title: "Chọn nhóm tiêu chí", body: "Chọn Tất cả hoặc một nhóm A–E. Đọc mô tả của từng cấp trong hạng mục trước khi đánh giá.", imageUrl: "" },
          { id: "5s-score", title: "Chọn cấp điểm phù hợp", body: "Chạm cấp 1 Rất xấu, 2 Xấu, 3 Bình thường, 4 Tốt hoặc 5 Rất tốt theo hiện trạng. Chạm lại cấp đang chọn để bỏ điểm.", imageUrl: "" },
          { id: "5s-na", title: "Đánh dấu hạng mục không áp dụng", body: "Chỉ chọn Không cần chấm khi hạng mục thực sự không áp dụng cho Zone đó.", imageUrl: "" },
        ],
      },
    },
    {
      id: "findings",
      label: "Vấn đề 5S",
      defaults: {
        title: "Ghi nhận vấn đề 5S",
        intro: "Nhập vấn đề phát hiện, biện pháp khắc phục và tiến độ theo dõi.",
        hint: "Nếu lưu bị từ chối, kiểm tra Zone được phân công, ngày hợp lệ và kỳ 5S đang mở.",
        adminNote: "Admin chọn Zone cần ghi nhận trong kỳ đang mở. Admin có thể thêm và quản lý vấn đề 5S ở mọi Zone trong kỳ đó.",
        steps: [
          { id: "finding-zone", title: "Chọn kỳ và Zone", body: "Chọn tab Vấn đề 5S, kiểm tra kỳ 5S rồi chọn Zone cần ghi nhận.", imageUrl: "" },
          { id: "finding-date", title: "Kiểm tra ngày và người kiểm tra", body: "Kiểm tra Ngày kiểm tra và nhập ít nhất một Người kiểm tra.", imageUrl: "" },
          { id: "finding-description", title: "Ghi vấn đề và biện pháp", body: "Nhập Vấn đề 5S (bắt buộc). Bổ sung vị trí, hạng mục, ca làm việc, biện pháp khắc phục, hạn hoàn thành và tiến độ nếu có.", imageUrl: "" },
          { id: "finding-save", title: "Lưu và xem lại", body: "Chạm Lưu vấn đề 5S. Mục đã lưu xuất hiện trong danh sách bên dưới; chạm một mục để xem chi tiết hoặc sửa, xóa nếu có quyền.", imageUrl: "" },
        ],
      },
    },
  ];

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function makeId() {
    return globalThis.crypto?.randomUUID?.()
      || `guide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function normalizeStep(step, index, sectionId) {
    const source = step && typeof step === "object" ? step : {};
    const rawAnnotations = source.annotations || source.photoAnnotations || [];
    const annotations = Array.isArray(rawAnnotations)
      ? rawAnnotations
      : typeof rawAnnotations === "string"
        ? (() => { try { return JSON.parse(rawAnnotations); } catch (_) { return []; } })()
        : [];

    let images = [];
    if (Array.isArray(source.images) && source.images.length > 0) {
      images = source.images.slice(0, 3).map((img, imgIdx) => {
        const item = img && typeof img === "object" ? img : { imageUrl: String(img || "") };
        const rawAnn = item.annotations || item.photoAnnotations || [];
        const ann = Array.isArray(rawAnn)
          ? rawAnn
          : typeof rawAnn === "string"
            ? (() => { try { return JSON.parse(rawAnn); } catch (_) { return []; } })()
            : [];
        return {
          id: String(item.id || `img-${imgIdx + 1}`),
          imageUrl: String(item.imageUrl || ""),
          annotations: ann,
        };
      }).filter((img) => Boolean(img.imageUrl));
    } else if (source.imageUrl) {
      images = [{
        id: "img-1",
        imageUrl: String(source.imageUrl || ""),
        annotations,
      }];
    }

    const primaryImage = images[0] || null;

    return {
      id: String(source.id || `${sectionId}-${index + 1}`),
      title: String(source.title || ""),
      body: String(source.body || ""),
      imageUrl: primaryImage ? primaryImage.imageUrl : String(source.imageUrl || ""),
      annotations: primaryImage ? primaryImage.annotations : annotations,
      images,
    };
  }

  function normalize(guides) {
    const sourceGuides = guides && typeof guides === "object" ? guides : {};
    return Object.fromEntries(SECTIONS.map(({ id, defaults }) => {
      const source = sourceGuides[id] && typeof sourceGuides[id] === "object" ? sourceGuides[id] : {};
      const sourceSteps = Array.isArray(source.steps) ? source.steps : defaults.steps;
      return [id, {
        title: String(source.title ?? defaults.title),
        intro: String(source.intro ?? defaults.intro),
        hint: String(source.hint ?? defaults.hint),
        adminNote: String(source.adminNote ?? defaults.adminNote),
        steps: sourceSteps.map((step, index) => normalizeStep(step, index, id)),
      }];
    }));
  }

  function defaults() {
    return normalize(Object.fromEntries(SECTIONS.map(({ id, defaults: guide }) => [id, guide])));
  }

  function getSection(sectionId) {
    return SECTIONS.find((section) => section.id === sectionId) || SECTIONS[0];
  }

  function getGuide(sectionId, guides) {
    const id = getSection(sectionId).id;
    return normalize(guides)[id];
  }

  function renderGuide(sectionId, guides) {
    const section = getSection(sectionId);
    const guide = getGuide(section.id, guides);
    const stepsHtml = guide.steps.length
      ? `<ol class="mobile-user-guide-steps">${guide.steps.map((step) => {
          const stepImages = Array.isArray(step.images) && step.images.length > 0
            ? step.images
            : (step.imageUrl ? [{ imageUrl: step.imageUrl, annotations: step.annotations }] : []);

          const imagesHtml = stepImages.length > 0
            ? `<div class="mobile-user-guide-images-grid" data-count="${stepImages.length}">
                ${stepImages.map((img, imgIdx) => {
                  const serializedAnn = JSON.stringify(img.annotations || []);
                  return `<div class="mobile-user-guide-image-wrap">
                    <img class="mobile-user-guide-image" data-photo-src="${escapeHtml(img.imageUrl)}" data-guide-annotations="${escapeHtml(serializedAnn)}" data-safety-annotations="${escapeHtml(serializedAnn)}" src="${escapeHtml(img.imageUrl)}" alt="Ảnh hướng dẫn ${imgIdx + 1}: ${escapeHtml(step.title)}" loading="lazy">
                  </div>`;
                }).join("")}
              </div>`
            : "";

          return `
          <li class="mobile-user-guide-step">
            <h3>${escapeHtml(step.title)}</h3>
            ${step.body ? `<p>${escapeHtml(step.body)}</p>` : ""}
            ${imagesHtml}
          </li>`;
        }).join("")}</ol>`
      : '<p class="mobile-user-guide-empty">Admin chưa thêm bước hướng dẫn cho phần này.</p>';
    return `<article class="mobile-user-guide">
      <p class="mobile-user-guide-eyebrow">${escapeHtml(section.label)}</p>
      <h3>${escapeHtml(guide.title)}</h3>
      ${guide.intro ? `<p class="mobile-user-guide-intro">${escapeHtml(guide.intro)}</p>` : ""}
      ${stepsHtml}
      ${guide.hint ? `<aside class="mobile-user-guide-note"><strong>Lưu ý</strong><p>${escapeHtml(guide.hint)}</p></aside>` : ""}
      ${guide.adminNote ? `<aside class="mobile-user-guide-admin"><strong>Thao tác quyền Admin</strong><p>${escapeHtml(guide.adminNote)}</p></aside>` : ""}
    </article>`;
  }

  function renderStepImageItem(image = {}, imageIndex = 0) {
    const imageUrl = String(image.imageUrl || "");
    const annotations = Array.isArray(image.annotations) ? image.annotations : [];
    const serializedAnnotations = JSON.stringify(annotations);
    const imageId = image.id || `img-${imageIndex + 1}`;
    return `<div class="guide-step-image-item" data-guide-image-item data-image-id="${escapeHtml(imageId)}" data-image-url="${escapeHtml(imageUrl)}" data-annotations="${escapeHtml(serializedAnnotations)}">
      <div class="guide-editor-photo-preview" data-guide-photo-preview>
        <span class="guide-image-badge" title="Ảnh ${imageIndex + 1}">Ảnh ${imageIndex + 1}</span>
        <img class="guide-editor-image-preview" data-guide-image-preview data-photo-src="${escapeHtml(imageUrl)}" data-safety-annotations="${escapeHtml(serializedAnnotations)}" ${imageUrl ? `src="${escapeHtml(imageUrl)}"` : ""} alt="Ảnh minh họa ${imageIndex + 1}">
        <div class="photo-preview-actions guide-editor-photo-actions">
          <button type="button" class="photo-btn annotate-btn" data-guide-annotate-image title="Khoanh vùng & vẽ chú thích" aria-label="Khoanh vùng và vẽ chú thích"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i></button>
          <button type="button" class="photo-btn open-btn" data-guide-open-image title="Mở ảnh lớn" aria-label="Mở ảnh minh họa"><i class="fa-solid fa-expand" aria-hidden="true"></i></button>
          <button type="button" class="photo-btn retake-btn" data-guide-change-image title="Đổi ảnh này" aria-label="Đổi ảnh này"><i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i></button>
          <button type="button" class="photo-btn delete-btn guide-editor-image-remove" data-guide-remove-image title="Xóa ảnh này" aria-label="Xóa ảnh"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
        </div>
        <input type="file" accept="image/*" data-guide-single-image-input hidden aria-hidden="true">
      </div>
    </div>`;
  }

  function renderStepEditor(sectionId, step = {}, index = 0, total = 0) {
    const stepImages = Array.isArray(step.images) && step.images.length > 0
      ? step.images.slice(0, 3)
      : (step.imageUrl ? [{ id: "img-1", imageUrl: step.imageUrl, annotations: step.annotations }] : []);
    const primaryUrl = stepImages[0]?.imageUrl || step.imageUrl || "";
    const primaryAnnotations = stepImages[0]?.annotations || step.annotations || [];
    const isFirst = index === 0;
    const isLast = total > 0 ? index === total - 1 : false;
    return `<article class="guide-editor-step" data-guide-step-card data-guide-section="${escapeHtml(sectionId)}" data-step-id="${escapeHtml(step.id || `${sectionId}-${index + 1}`)}" data-image-url="${escapeHtml(primaryUrl)}" data-image-removed="false" data-annotations="${escapeHtml(JSON.stringify(primaryAnnotations))}">
      <div class="guide-editor-step-heading">
        <div class="guide-editor-step-title-group">
          <span class="guide-step-drag-handle" draggable="true" title="Kéo để đổi vị trí bước" aria-label="Kéo để đổi vị trí"><i class="fa-solid fa-grip-vertical" aria-hidden="true"></i></span>
          <strong>Bước ${index + 1}</strong>
        </div>
        <div class="guide-editor-step-actions">
          <button type="button" class="secondary-button guide-editor-move-step" data-guide-move-step="up" title="Di chuyển bước này lên trên" aria-label="Di chuyển lên trên" ${isFirst ? "disabled" : ""}><i class="fa-solid fa-arrow-up" aria-hidden="true"></i> Lên</button>
          <button type="button" class="secondary-button guide-editor-move-step" data-guide-move-step="down" title="Di chuyển bước này xuống dưới" aria-label="Di chuyển xuống dưới" ${isLast ? "disabled" : ""}><i class="fa-solid fa-arrow-down" aria-hidden="true"></i> Xuống</button>
          <button type="button" class="secondary-button guide-editor-remove-step" data-guide-delete-step title="Gỡ bước này" aria-label="Gỡ bước"><i class="fa-solid fa-trash-can" aria-hidden="true"></i> Gỡ bước</button>
        </div>
      </div>
      <label class="guide-editor-field"><span>Tên bước</span><input type="text" data-guide-step-field="title" value="${escapeHtml(step.title || "")}" placeholder="Ví dụ: Chọn khu vực cần kiểm tra"></label>
      <label class="guide-editor-field"><span>Nội dung hướng dẫn</span><textarea rows="3" data-guide-step-field="body" placeholder="Mô tả thao tác cần thực hiện">${escapeHtml(step.body || "")}</textarea></label>
      <div class="guide-editor-image-field">
        <div class="guide-step-images-header">
          <span>Ảnh minh họa cho bước này (tối đa 3 ảnh)</span>
          <span class="guide-images-counter" data-guide-images-counter>${stepImages.length}/3 ảnh</span>
        </div>
        <div class="guide-step-images-list" data-guide-images-list>
          ${stepImages.map((img, imgIdx) => renderStepImageItem(img, imgIdx)).join("")}
        </div>
        <div class="guide-add-image-wrap" data-guide-add-image-wrap ${stepImages.length >= 3 ? "hidden" : ""}>
          <input type="file" accept="image/*" data-guide-add-image-input hidden aria-hidden="true">
          <button type="button" class="secondary-button btn-add-step-image" data-guide-add-image title="Thêm ảnh minh họa (tối đa 3 ảnh)">
            <i class="fa-solid fa-plus"></i> <span>Thêm ảnh minh họa (${stepImages.length}/3)</span>
          </button>
        </div>
      </div>
    </article>`;
  }

  function renderEditor(guides) {
    const normalized = normalize(guides);
    return `<div class="guide-editor-intro">Chỉnh sửa riêng hướng dẫn của từng phần. Mỗi bước có thể có một ảnh minh họa; nội dung sẽ hiển thị khi người dùng mở dấu ? ở đúng phần đó.</div>
      <div class="guide-editor-tabs" role="tablist" aria-label="Phần hướng dẫn">${SECTIONS.map((section, index) => `<button type="button" class="guide-editor-tab ${index === 0 ? "is-active" : ""}" role="tab" aria-selected="${index === 0}" data-guide-tab="${section.id}">${escapeHtml(section.label)}</button>`).join("")}</div>
      ${SECTIONS.map((section, index) => {
        const guide = normalized[section.id];
        return `<section class="guide-editor-panel" role="tabpanel" data-guide-panel="${section.id}" ${index === 0 ? "" : "hidden"}>
          <label class="guide-editor-field"><span>Tiêu đề</span><input type="text" data-guide-field="title" value="${escapeHtml(guide.title)}" placeholder="Tên hướng dẫn"></label>
          <label class="guide-editor-field"><span>Mô tả ngắn</span><textarea rows="2" data-guide-field="intro" placeholder="Giới thiệu nội dung">${escapeHtml(guide.intro)}</textarea></label>
          <div class="guide-editor-steps" data-guide-steps>${guide.steps.map((step, stepIndex) => renderStepEditor(section.id, step, stepIndex, guide.steps.length)).join("")}</div>
          <button type="button" class="secondary-button guide-editor-add-step" data-guide-add-step="${section.id}">＋ Thêm bước</button>
          <label class="guide-editor-field"><span>Lưu ý chung</span><textarea rows="2" data-guide-field="hint" placeholder="Lưu ý cho người dùng">${escapeHtml(guide.hint)}</textarea></label>
          <label class="guide-editor-field"><span>Ghi chú thao tác quyền Admin</span><textarea rows="2" data-guide-field="adminNote" placeholder="Hướng dẫn riêng cho Admin">${escapeHtml(guide.adminNote)}</textarea></label>
        </section>`;
      }).join("")}`;
  }

  function getAnnotationColor(colorName) {
    const c = String(colorName || "red").toLowerCase();
    if (c === "white" || c === "#ffffff" || c === "trang") {
      return { fill: "#ffffff", stroke: "#000000", strokeWidth: 3, name: "white" };
    }
    if (c === "black" || c === "#000000" || c === "#111827" || c === "den") {
      return { fill: "#111827", stroke: "#ffffff", strokeWidth: 3, name: "black" };
    }
    return { fill: "#ff3b30", stroke: "#000000", strokeWidth: 2.5, name: "red" };
  }

  function parseFontSizeNumber(sizeVal) {
    if (typeof sizeVal === "number" && Number.isFinite(sizeVal) && sizeVal > 0) {
      return Math.min(120, Math.max(10, Math.round(sizeVal)));
    }
    const s = String(sizeVal ?? "18").trim().toLowerCase();
    const parsed = Number(s);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(120, Math.max(10, Math.round(parsed)));
    }
    if (s === "small" || s === "nho") return 14;
    if (s === "large" || s === "lon") return 28;
    return 18;
  }

  function getAnnotationFontSize(sizeName, minDim) {
    const s = String(sizeName || "18").toLowerCase();
    if (s === "small" || s === "nho") {
      return Math.max(12, Math.round(minDim * 0.026));
    }
    if (s === "large" || s === "lon") {
      return Math.max(22, Math.round(minDim * 0.058));
    }
    if (s === "medium" || s === "vua") {
      return Math.max(16, Math.round(minDim * 0.040));
    }
    const num = parseFontSizeNumber(sizeName);
    return Math.max(10, Math.round(minDim * (num / 480)));
  }

  function normalizeAnnotations(value) {
    let items = value;
    if (typeof items === "string") {
      try { items = JSON.parse(items); } catch (_) { items = []; }
    }
    if (!Array.isArray(items)) return [];
    return items.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const type = item.type || (Number.isFinite(Number(item.radius)) ? "circle" : "");
      if (type === "rect") {
        const x = Number(item.x);
        const y = Number(item.y);
        const width = Number(item.width);
        const height = Number(item.height);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return [];
        return [{
          type: "rect",
          x: Math.max(0, Math.min(1, x)),
          y: Math.max(0, Math.min(1, y)),
          width: Math.max(0, Math.min(1, width)),
          height: Math.max(0, Math.min(1, height)),
        }];
      }
      if (type === "arrow") {
        const x1 = Number(item.x1);
        const y1 = Number(item.y1);
        const x2 = Number(item.x2);
        const y2 = Number(item.y2);
        if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return [];
        return [{
          type: "arrow",
          x1: Math.max(0, Math.min(1, x1)),
          y1: Math.max(0, Math.min(1, y1)),
          x2: Math.max(0, Math.min(1, x2)),
          y2: Math.max(0, Math.min(1, y2)),
        }];
      }
      if (type === "text") {
        const text = String(item.text || "").trim();
        if (!text) return [];
        const x = Number(item.x);
        const y = Number(item.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
        const rawColor = String(item.color || "red").toLowerCase();
        const color = ["#ffffff", "white", "trang"].includes(rawColor)
          ? "white"
          : ["#000000", "#111827", "black", "den"].includes(rawColor)
            ? "black"
            : "red";
        const rawSize = item.size ?? item.fontSize;
        let size = "medium";
        if (typeof rawSize === "number" && Number.isFinite(rawSize)) {
          size = Math.min(120, Math.max(10, Math.round(rawSize)));
        } else if (typeof rawSize === "string") {
          const trimmed = rawSize.trim().toLowerCase();
          const parsed = Number(trimmed);
          if (Number.isFinite(parsed) && parsed > 0) {
            size = Math.min(120, Math.max(10, Math.round(parsed)));
          } else if (["small", "nho"].includes(trimmed)) {
            size = "small";
          } else if (["large", "lon"].includes(trimmed)) {
            size = "large";
          } else {
            size = "medium";
          }
        }
        return [{
          type: "text",
          text,
          x: Math.max(0, Math.min(1, x)),
          y: Math.max(0, Math.min(1, y)),
          color,
          size,
        }];
      }
      if (type === "circle" || (!type && Number.isFinite(Number(item.radius)))) {
        const x = Number(item.x);
        const y = Number(item.y);
        const radius = Number(item.radius);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius <= 0) return [];
        return [{
          type: "circle",
          x: Math.max(0, Math.min(1, x)),
          y: Math.max(0, Math.min(1, y)),
          radius: Math.max(0, Math.min(2, radius)),
        }];
      }
      return [];
    });
  }

  async function renderAnnotatedImageToDataUrl(imageSrc, annotations = [], getAuthUrlFn = null) {
    if (!imageSrc) return "";
    let objectUrl = "";
    try {
      let resolvedSrc = imageSrc;
      const authResolver = getAuthUrlFn || (typeof window !== "undefined" ? window.getAuthenticatedPhotoObjectUrl : null);
      const isInternal = (typeof window !== "undefined" && typeof window.isInternalPhotoUrl === "function")
        ? window.isInternalPhotoUrl(imageSrc)
        : String(imageSrc).includes("/api/photos/");

      if (typeof authResolver === "function" && isInternal) {
        resolvedSrc = await authResolver(imageSrc);
      } else if (!imageSrc.startsWith("data:") && !imageSrc.startsWith("blob:")) {
        const response = await fetch(imageSrc, { credentials: "include" });
        if (response.ok) {
          objectUrl = URL.createObjectURL(await response.blob());
          resolvedSrc = objectUrl;
        }
      }

      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = resolvedSrc;
      });

      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) return imageSrc;

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return imageSrc;

      ctx.drawImage(img, 0, 0, w, h);

      const items = normalizeAnnotations(annotations);
      if (items && items.length > 0) {
        const minDim = Math.min(w, h);
        const strokeWidth = Math.max(3.5, minDim * 0.006);

        items.forEach((item) => {
          ctx.strokeStyle = "#ff3b30";
          ctx.fillStyle = "#ff3b30";
          ctx.lineWidth = strokeWidth;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          if (item.type === "text") {
            const text = String(item.text || "").trim();
            if (text) {
              const px = item.x * w;
              const py = item.y * h;
              const colorInfo = getAnnotationColor(item.color);
              const fontSize = getAnnotationFontSize(item.size, minDim);
              ctx.font = `bold ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
              ctx.textBaseline = "alphabetic";
              ctx.textAlign = "start";
              ctx.strokeStyle = colorInfo.stroke;
              ctx.fillStyle = colorInfo.fill;
              ctx.lineWidth = Math.max(2, fontSize * 0.16);
              ctx.lineJoin = "round";
              ctx.lineCap = "round";

              const lines = text.split("\n");
              const lineHeight = fontSize * 1.25;
              lines.forEach((line, lineIdx) => {
                const lineY = py + lineIdx * lineHeight;
                ctx.strokeText(line, px, lineY);
                ctx.fillText(line, px, lineY);
              });
            }
          } else if (item.type === "rect") {
            const rx = item.x * w;
            const ry = item.y * h;
            const rw = item.width * w;
            const rh = item.height * h;
            const cornerR = Math.min(8, Math.min(rw, rh) * 0.12);
            ctx.beginPath();
            if (typeof ctx.roundRect === "function") {
              ctx.roundRect(rx, ry, rw, rh, cornerR);
            } else {
              ctx.rect(rx, ry, rw, rh);
            }
            ctx.stroke();
          } else if (item.type === "arrow") {
            const x1 = item.x1 * w;
            const y1 = item.y1 * h;
            const x2 = item.x2 * w;
            const y2 = item.y2 * h;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.hypot(dx, dy);
            if (len >= 4) {
              const ux = dx / len;
              const uy = dy / len;
              const nx = -uy;
              const ny = ux;
              const headLen = Math.min(32, Math.max(16, len * 0.28));
              const headHalfWidth = headLen * 0.55;
              const bx = x2 - ux * headLen;
              const by = y2 - uy * headLen;
              const lx = bx + nx * headHalfWidth;
              const ly = by + ny * headHalfWidth;
              const rx = bx - nx * headHalfWidth;
              const ry = by - ny * headHalfWidth;
              const arrowStrokeW = Math.max(3.5, minDim * 0.007);

              ctx.lineWidth = arrowStrokeW;
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(bx, by);
              ctx.stroke();

              ctx.beginPath();
              ctx.moveTo(x2, y2);
              ctx.lineTo(lx, ly);
              ctx.lineTo(rx, ry);
              ctx.closePath();
              ctx.fill();
            }
          } else {
            // Circle
            const cx = item.x * w;
            const cy = item.y * h;
            const radius = item.radius * minDim;
            if (radius > 0) {
              ctx.beginPath();
              ctx.arc(cx, cy, radius, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        });
      }

      return canvas.toDataURL("image/jpeg", 0.92);
    } catch (_) {
      return imageSrc;
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  async function getLogoDataUrl() {
    try {
      const response = await fetch("images/Logo.jpg", { credentials: "include" });
      if (!response.ok) return "";
      const blob = await response.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ""));
        reader.onerror = () => resolve("");
        reader.readAsDataURL(blob);
      });
    } catch (_) {
      return "";
    }
  }

  function collectSectionData(form, sectionId, sourceGuides) {
    const sectionMeta = getSection(sectionId);
    const guide = getGuide(sectionId, sourceGuides);
    const panel = form ? form.querySelector(`[data-guide-panel="${sectionId}"]`) : null;
    if (!panel) {
      return {
        id: sectionId,
        label: sectionMeta.label,
        title: guide.title || "",
        intro: guide.intro || "",
        hint: guide.hint || "",
        adminNote: guide.adminNote || "",
        steps: (guide.steps || []).map((step) => ({
          id: step.id,
          title: step.title || "",
          body: step.body || "",
          imageUrl: step.imageUrl || "",
          annotations: step.annotations || [],
          images: Array.isArray(step.images) ? step.images.map((img) => ({ ...img })) : [],
        })),
      };
    }

    const readField = (name) => panel.querySelector(`[data-guide-field="${name}"]`)?.value?.trim() || "";
    const steps = [];

    panel.querySelectorAll("[data-guide-step-card]").forEach((card) => {
      const title = card.querySelector('[data-guide-step-field="title"]')?.value?.trim() || "";
      const body = card.querySelector('[data-guide-step-field="body"]')?.value?.trim() || "";
      const imageItems = Array.from(card.querySelectorAll("[data-guide-image-item]"));
      const images = [];

      imageItems.slice(0, 3).forEach((item, itemIdx) => {
        const preview = item.querySelector("[data-guide-image-preview]");
        let imgUrl = item.dataset.imageUrl || "";
        if (preview && !preview.hidden && (preview.currentSrc || preview.src)) {
          imgUrl = preview.currentSrc || preview.src;
        }
        let annotations = [];
        try {
          annotations = JSON.parse(item.dataset.annotations || preview?.dataset?.safetyAnnotations || "[]");
        } catch (_) {}
        if (imgUrl) {
          images.push({
            id: item.dataset.imageId || `img-${itemIdx + 1}`,
            imageUrl: imgUrl,
            annotations,
          });
        }
      });

      const primary = images[0] || null;

      steps.push({
        id: card.dataset.stepId || makeId(),
        title,
        body,
        imageUrl: primary ? primary.imageUrl : "",
        annotations: primary ? primary.annotations : [],
        images,
      });
    });

    return {
      id: sectionId,
      label: sectionMeta.label,
      title: readField("title") || guide.title || "",
      intro: readField("intro") || guide.intro || "",
      hint: readField("hint") || guide.hint || "",
      adminNote: readField("adminNote") || guide.adminNote || "",
      steps,
    };
  }

  function formatDateTimeVi(date = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    const d = pad(date.getDate());
    const m = pad(date.getMonth() + 1);
    const y = date.getFullYear();
    const h = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${d}/${m}/${y} ${h}:${min}`;
  }

  function slugify(text) {
    return String(text || "Huong_Dan")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d").replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }

  function buildGuidePdfHtml(params = {}) {
    const {
      section = getSection("safety"),
      guide = getGuide(section.id),
      documentTitle = `Huong_Dan_${slugify(guide.title || section.label)}_LeGroup`,
    } = params;

    const stepsHtml = (guide.steps && guide.steps.length)
      ? `<ol class="mobile-user-guide-steps">${guide.steps.map((step) => {
          const stepImages = Array.isArray(step.renderedImages) && step.renderedImages.length > 0
            ? step.renderedImages
            : (Array.isArray(step.images) && step.images.length > 0
              ? step.images.map((img) => ({ imageUrl: img.imageUrl, renderedImageDataUrl: img.renderedImageDataUrl || img.imageUrl }))
              : (step.renderedImageDataUrl || step.imageUrl ? [{ imageUrl: step.imageUrl, renderedImageDataUrl: step.renderedImageDataUrl || step.imageUrl }] : []));

            const imagesHtml = stepImages.length > 0
            ? `<div class="guide-pdf-images-row" style="display: flex; gap: 10px; margin: 10px 0 6px; flex-wrap: wrap;">
                ${stepImages.map((img, imgIdx) => `<img class="mobile-user-guide-image" src="${escapeHtml(img.renderedImageDataUrl || img.imageUrl || "")}" alt="Ảnh hướng dẫn ${imgIdx + 1}: ${escapeHtml(step.title)}" style="flex: 1 1 0; min-width: 160px; max-width: ${stepImages.length > 1 ? '48%' : '100%'}; max-height: 280px; object-fit: contain; border: 1px solid #cbd5e1; border-radius: 8px;">`).join("")}
              </div>`
            : "";

          return `
          <li class="mobile-user-guide-step">
            <h3>${escapeHtml(step.title)}</h3>
            ${step.body ? `<p>${escapeHtml(step.body)}</p>` : ""}
            ${imagesHtml}
          </li>`;
        }).join("")}</ol>`
      : '<p class="mobile-user-guide-empty">Admin chưa thêm bước hướng dẫn cho phần này.</p>';

    return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(documentTitle)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 18mm 15mm 18mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .no-print {
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 24px;
      z-index: 999999;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
    }
    .no-print-title {
      font-size: 13pt;
      font-weight: 700;
      color: #f8fafc;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .no-print-actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .no-print-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      border-radius: 8px;
      font-size: 10pt;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.15s ease-in-out;
    }
    .no-print-btn-primary {
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
      color: #ffffff;
      box-shadow: 0 2px 6px rgba(220, 38, 38, 0.35);
    }
    .no-print-btn-primary:hover {
      background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
    }
    .no-print-btn-secondary {
      background: #334155;
      color: #f1f5f9;
    }
    .no-print-btn-secondary:hover {
      background: #475569;
    }

    @media print {
      .no-print {
        display: none !important;
      }
      body {
        background: #ffffff !important;
      }
      .page-container {
        padding: 0 !important;
        margin: 0 !important;
        max-width: 100% !important;
      }
    }

    .page-container {
      max-width: 780px;
      margin: 24px auto 40px;
      padding: 0 16px;
    }

    .mobile-user-guide {
      width: 100%;
      margin: 0 auto;
      line-height: 1.55;
    }

    .mobile-user-guide-eyebrow {
      margin: 0 0 6px;
      color: #0f766e;
      font-size: 0.82rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .mobile-user-guide > h3 {
      margin: 0 0 10px;
      font-size: 1.45rem;
      line-height: 1.25;
      color: #0f172a;
      font-weight: 800;
    }

    .mobile-user-guide-intro {
      margin: 0 0 20px;
      color: #475569;
      font-size: 1rem;
      line-height: 1.55;
    }

    .mobile-user-guide-steps {
      display: grid;
      gap: 16px;
      margin: 0;
      padding-left: 24px;
    }

    .mobile-user-guide-step {
      padding-left: 4px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .mobile-user-guide-step h3 {
      margin: 0 0 6px;
      font-size: 1.1rem;
      color: #0f172a;
      font-weight: 700;
    }

    .mobile-user-guide-step p,
    .mobile-user-guide-note p,
    .mobile-user-guide-admin p {
      margin: 0;
      white-space: pre-line;
      color: #334155;
      font-size: 0.98rem;
      line-height: 1.55;
    }

    .mobile-user-guide-image {
      display: block;
      width: min(100%, 640px);
      max-height: 380px;
      margin: 10px 0 4px;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      background: #fff;
      object-fit: contain;
    }

    .mobile-user-guide-note,
    .mobile-user-guide-admin {
      margin-top: 18px;
      padding: 12px 16px;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      background: #fff;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .mobile-user-guide-note strong,
    .mobile-user-guide-admin strong {
      display: block;
      margin-bottom: 4px;
      color: #0f172a;
      font-size: 1rem;
    }

    .mobile-user-guide-admin {
      border-color: #bfdbfe;
      background: #eff6ff;
    }

    .mobile-user-guide-empty {
      padding: 16px;
      border: 1px dashed #94a3b8;
      border-radius: 10px;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <div class="no-print-title">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      <span>Hướng dẫn sử dụng · ${escapeHtml(guide.title || section.label)}</span>
    </div>
    <div class="no-print-actions">
      <button type="button" class="no-print-btn no-print-btn-primary" onclick="window.print()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        <span>In / Lưu file PDF</span>
      </button>
      <button type="button" class="no-print-btn no-print-btn-secondary" onclick="window.close()">Đóng</button>
    </div>
  </div>

  <main class="page-container">
    <article class="mobile-user-guide">
      <p class="mobile-user-guide-eyebrow">${escapeHtml(section.label)}</p>
      <h3>${escapeHtml(guide.title)}</h3>
      ${guide.intro ? `<p class="mobile-user-guide-intro">${escapeHtml(guide.intro)}</p>` : ""}
      ${stepsHtml}
      ${guide.hint ? `<aside class="mobile-user-guide-note"><strong>Lưu ý</strong><p>${escapeHtml(guide.hint)}</p></aside>` : ""}
      ${guide.adminNote ? `<aside class="mobile-user-guide-admin"><strong>Thao tác quyền Admin</strong><p>${escapeHtml(guide.adminNote)}</p></aside>` : ""}
    </article>
  </main>
</body>
</html>`;
  }

  function dataUrlToBytes(dataUrl) {
    const commaIdx = dataUrl.indexOf(",");
    const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    const binaryString = (typeof window !== "undefined" && window.atob)
      ? window.atob(base64)
      : (typeof Buffer !== "undefined" ? Buffer.from(base64, "base64").toString("binary") : "");
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i) & 0xff;
    }
    return bytes;
  }

  function createPdfBinary(pages) {
    const pageCount = pages.length;
    const kids = [];
    const pageObjMap = pages.map((_, i) => {
      const pageId = 3 + i * 3;
      const imgId = pageId + 1;
      const contentId = pageId + 2;
      kids.push(`${pageId} 0 R`);
      return { pageId, imgId, contentId };
    });

    const totalObjs = 3 + pageCount * 3;
    const offsets = [];
    const parts = [];
    let byteOffset = 0;

    function pushString(str) {
      const arr = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) {
        arr[i] = str.charCodeAt(i) & 0xff;
      }
      parts.push(arr);
      byteOffset += arr.length;
    }

    function pushBytes(arr) {
      const u8 = arr instanceof Uint8Array ? arr : new Uint8Array(arr);
      parts.push(u8);
      byteOffset += u8.length;
    }

    pushString("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");

    function startObj(id) {
      offsets[id] = byteOffset;
      pushString(`${id} 0 obj\n`);
    }

    function endObj() {
      pushString("endobj\n");
    }

    // 1: Catalog
    startObj(1);
    pushString("<< /Type /Catalog /Pages 2 0 R >>\n");
    endObj();

    // 2: Pages
    startObj(2);
    pushString(`<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pageCount} >>\n`);
    endObj();

    for (let i = 0; i < pageCount; i++) {
      const p = pages[i];
      const { pageId, imgId, contentId } = pageObjMap[i];

      // Page: A4 standard 595.28 x 841.89 pt
      startObj(pageId);
      pushString(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im1 ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>\n`);
      endObj();

      // Image XObject with /DCTDecode (JPEG)
      startObj(imgId);
      pushString(`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.data.length} >>\nstream\n`);
      pushBytes(p.data);
      pushString("\nendstream\n");
      endObj();

      // Content stream placing Im1 to fill the A4 page
      const contentStr = "q\n595.28 0 0 841.89 0 0 cm\n/Im1 Do\nQ\n";
      startObj(contentId);
      pushString(`<< /Length ${contentStr.length} >>\nstream\n${contentStr}endstream\n`);
      endObj();
    }

    const startXref = byteOffset;
    pushString(`xref\n0 ${totalObjs}\n`);
    pushString("0000000000 65535 f \n");
    for (let i = 1; i < totalObjs; i++) {
      const off = String(offsets[i] || 0).padStart(10, "0");
      pushString(`${off} 00000 n \n`);
    }
    pushString(`trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`);

    let totalLen = 0;
    for (const part of parts) totalLen += part.length;
    const result = new Uint8Array(totalLen);
    let pos = 0;
    for (const part of parts) {
      result.set(part, pos);
      pos += part.length;
    }
    return result;
  }

  function wrapCanvasText(ctx, text, maxWidth) {
    if (!text) return [];
    if (!ctx || typeof ctx.measureText !== "function") {
      const charLimit = Math.max(20, Math.floor(maxWidth / 9));
      const words = String(text).split(/\s+/);
      const lines = [];
      let current = "";
      for (const w of words) {
        const next = current ? `${current} ${w}` : w;
        if (next.length > charLimit && current) {
          lines.push(current);
          current = w;
        } else {
          current = next;
        }
      }
      if (current) lines.push(current);
      return lines;
    }

    const paragraphs = String(text).split("\n");
    const lines = [];

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) {
        lines.push("");
        continue;
      }
      const words = trimmed.split(/\s+/);
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
    }
    return lines;
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      if (typeof Image === "undefined") return resolve(null);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function renderGuideToCanvasPages(params = {}) {
    const { section, guide } = params;
    const PAGE_WIDTH = 1240;
    const PAGE_HEIGHT = 1754;
    const MARGIN_X = 70;
    const MARGIN_TOP = 85;
    const MARGIN_BOTTOM = 85;
    const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
    const MAX_Y = PAGE_HEIGHT - MARGIN_BOTTOM;

    if (typeof document === "undefined" || !document.createElement) {
      return [{ width: PAGE_WIDTH, height: PAGE_HEIGHT, data: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) }];
    }

    const pages = [];
    let currentCanvas = null;
    let ctx = null;
    let currentY = MARGIN_TOP;

    function startNewPage() {
      currentCanvas = document.createElement("canvas");
      currentCanvas.width = PAGE_WIDTH;
      currentCanvas.height = PAGE_HEIGHT;
      ctx = currentCanvas.getContext("2d");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

      ctx.save();
      ctx.font = "bold 13px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("LEGROUP · HỆ THỐNG QUẢN LÝ 5S & AN TOÀN", MARGIN_X, 42);

      ctx.font = "bold 13px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#0b7f87";
      ctx.textAlign = "right";
      ctx.fillText(`HƯỚNG DẪN SỬ DỤNG · ${(section.label || "").toUpperCase()}`, PAGE_WIDTH - MARGIN_X, 42);

      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(MARGIN_X, 60);
      ctx.lineTo(PAGE_WIDTH - MARGIN_X, 60);
      ctx.stroke();
      ctx.restore();

      pages.push(currentCanvas);
      currentY = MARGIN_TOP;
      return ctx;
    }

    ctx = startNewPage();

    // Document header on page 1
    ctx.save();
    ctx.font = "bold 13px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#0b7f87";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText((section.label || "").toUpperCase(), MARGIN_X, currentY);
    currentY += 24;

    ctx.font = "bold 26px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#0f172a";
    const titleLines = wrapCanvasText(ctx, guide.title || section.label, CONTENT_WIDTH);
    for (const line of titleLines) {
      ctx.fillText(line, MARGIN_X, currentY);
      currentY += 34;
    }

    if (guide.intro) {
      currentY += 4;
      ctx.font = "16px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#475569";
      const introLines = wrapCanvasText(ctx, guide.intro, CONTENT_WIDTH);
      for (const line of introLines) {
        ctx.fillText(line, MARGIN_X, currentY);
        currentY += 24;
      }
    }

    currentY += 10;
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X, currentY);
    ctx.lineTo(PAGE_WIDTH - MARGIN_X, currentY);
    ctx.stroke();
    currentY += 24;
    ctx.restore();

    // Steps rendering
    const steps = guide.steps || [];
    if (steps.length === 0) {
      ctx.save();
      ctx.font = "15px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("Chưa có bước hướng dẫn nào được thiết lập.", MARGIN_X, currentY);
      currentY += 30;
      ctx.restore();
    }

    for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
      const step = steps[stepIdx];
      const rawImgs = Array.isArray(step.renderedImages) && step.renderedImages.length > 0
        ? step.renderedImages
        : (Array.isArray(step.images) && step.images.length > 0
          ? step.images
          : (step.renderedImageDataUrl || step.imageUrl ? [{ imageUrl: step.imageUrl, renderedImageDataUrl: step.renderedImageDataUrl || step.imageUrl }] : []));

      const loadedImages = (await Promise.all(
        rawImgs.slice(0, 3).map(async (item) => {
          const src = item.renderedImageDataUrl || item.imageUrl || "";
          const img = await loadImage(src);
          return img ? { img, item } : null;
        })
      )).filter(Boolean);

      const imgCount = loadedImages.length;
      let maxImgH = 0;
      const imgLayouts = [];

      if (imgCount === 1) {
        const item = loadedImages[0];
        const maxW = 860;
        const maxH = 380;
        const nw = item.img.naturalWidth || item.img.width || 800;
        const nh = item.img.naturalHeight || item.img.height || 600;
        let scale = Math.min(maxW / nw, maxH / nh, 1);
        let w = Math.round(nw * scale);
        let h = Math.round(nh * scale);
        imgLayouts.push({ img: item.img, w, h });
        maxImgH = h;
      } else if (imgCount === 2) {
        const maxW = 525;
        const maxH = 290;
        for (const item of loadedImages) {
          const nw = item.img.naturalWidth || item.img.width || 800;
          const nh = item.img.naturalHeight || item.img.height || 600;
          let scale = Math.min(maxW / nw, maxH / nh, 1);
          let w = Math.round(nw * scale);
          let h = Math.round(nh * scale);
          imgLayouts.push({ img: item.img, w, h });
          if (h > maxImgH) maxImgH = h;
        }
      } else if (imgCount === 3) {
        const maxW = 345;
        const maxH = 240;
        for (const item of loadedImages) {
          const nw = item.img.naturalWidth || item.img.width || 800;
          const nh = item.img.naturalHeight || item.img.height || 600;
          let scale = Math.min(maxW / nw, maxH / nh, 1);
          let w = Math.round(nw * scale);
          let h = Math.round(nh * scale);
          imgLayouts.push({ img: item.img, w, h });
          if (h > maxImgH) maxImgH = h;
        }
      }

      ctx.save();
      ctx.font = "15px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const bodyLines = wrapCanvasText(ctx, step.body, CONTENT_WIDTH - 42);
      const bodyHeight = bodyLines.length > 0 ? bodyLines.length * 22 + 8 : 0;
      const totalStepHeight = 34 + bodyHeight + (imgCount > 0 ? maxImgH + 20 : 0) + 24;

      if (currentY > MARGIN_TOP + 40 && (currentY + totalStepHeight) > MAX_Y) {
        ctx = startNewPage();
      }

      // Draw Step Number badge
      ctx.fillStyle = "#0b7f87";
      ctx.beginPath();
      ctx.arc(MARGIN_X + 14, currentY + 12, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(stepIdx + 1), MARGIN_X + 14, currentY + 12);

      // Draw Step Title
      ctx.font = "bold 18px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#0f172a";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(step.title || `Bước ${stepIdx + 1}`, MARGIN_X + 38, currentY + 12);
      currentY += 32;

      // Draw Step Body
      if (bodyLines.length > 0) {
        ctx.font = "15px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillStyle = "#334155";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        for (const line of bodyLines) {
          ctx.fillText(line, MARGIN_X + 38, currentY);
          currentY += 22;
        }
        currentY += 8;
      }
      ctx.restore();

      // Draw Step Images
      if (imgCount > 0) {
        if (currentY + maxImgH > MAX_Y) {
          ctx = startNewPage();
        }

        let curImgX = MARGIN_X + 38;
        const gap = imgCount === 2 ? 20 : 15;

        for (let i = 0; i < imgLayouts.length; i++) {
          const { img, w, h } = imgLayouts[i];
          const posX = curImgX;
          const posY = currentY;

          ctx.save();
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(posX, posY, w, h, 8);
          } else {
            ctx.rect(posX, posY, w, h);
          }
          ctx.clip();
          ctx.drawImage(img, posX, posY, w, h);
          ctx.restore();

          ctx.save();
          ctx.strokeStyle = "#cbd5e1";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(posX, posY, w, h, 8);
          } else {
            ctx.rect(posX, posY, w, h);
          }
          ctx.stroke();

          if (imgCount > 1) {
            ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
            if (typeof ctx.roundRect === "function") {
              ctx.beginPath();
              ctx.roundRect(posX + 8, posY + 8, 54, 22, 4);
              ctx.fill();
            } else {
              ctx.fillRect(posX + 8, posY + 8, 54, 22);
            }
            ctx.font = "bold 11px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`Ảnh ${i + 1}`, posX + 35, posY + 19);
          }
          ctx.restore();

          curImgX += w + gap;
        }

        currentY += maxImgH + 24;
      }
    }

    // Notes sections
    if (guide.hint) {
      ctx.save();
      ctx.font = "14px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const hintLines = wrapCanvasText(ctx, guide.hint, CONTENT_WIDTH - 36);
      const hintBoxH = 34 + hintLines.length * 22 + 16;

      if (currentY + hintBoxH > MAX_Y) {
        ctx = startNewPage();
      }

      ctx.save();
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(MARGIN_X, currentY, CONTENT_WIDTH, hintBoxH, 8);
      } else {
        ctx.rect(MARGIN_X, currentY, CONTENT_WIDTH, hintBoxH);
      }
      ctx.fillStyle = "#fffbeb";
      ctx.fill();
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      ctx.font = "bold 14px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#92400e";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("LƯU Ý", MARGIN_X + 18, currentY + 14);

      ctx.font = "14px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#78350f";
      let lineY = currentY + 36;
      for (const line of hintLines) {
        ctx.fillText(line, MARGIN_X + 18, lineY);
        lineY += 22;
      }
      ctx.restore();
      currentY += hintBoxH + 16;
    }

    if (guide.adminNote) {
      ctx.save();
      ctx.font = "14px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const adminLines = wrapCanvasText(ctx, guide.adminNote, CONTENT_WIDTH - 36);
      const adminBoxH = 34 + adminLines.length * 22 + 16;

      if (currentY + adminBoxH > MAX_Y) {
        ctx = startNewPage();
      }

      ctx.save();
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(MARGIN_X, currentY, CONTENT_WIDTH, adminBoxH, 8);
      } else {
        ctx.rect(MARGIN_X, currentY, CONTENT_WIDTH, adminBoxH);
      }
      ctx.fillStyle = "#eff6ff";
      ctx.fill();
      ctx.strokeStyle = "#bfdbfe";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      ctx.font = "bold 14px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#1e40af";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("THAO TÁC QUYỀN ADMIN", MARGIN_X + 18, currentY + 14);

      ctx.font = "14px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#1e3a8a";
      let lineY = currentY + 36;
      for (const line of adminLines) {
        ctx.fillText(line, MARGIN_X + 18, lineY);
        lineY += 22;
      }
      ctx.restore();
      currentY += adminBoxH + 16;
    }

    // Footers across all pages
    const totalPages = pages.length;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const dateStr = `Ngày xuất: ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      const pCanvas = pages[pIdx];
      const pCtx = pCanvas.getContext("2d");
      pCtx.save();
      pCtx.strokeStyle = "#e2e8f0";
      pCtx.lineWidth = 1.5;
      pCtx.beginPath();
      pCtx.moveTo(MARGIN_X, PAGE_HEIGHT - 55);
      pCtx.lineTo(PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 55);
      pCtx.stroke();

      pCtx.font = "12px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      pCtx.fillStyle = "#94a3b8";
      pCtx.textAlign = "left";
      pCtx.textBaseline = "middle";
      pCtx.fillText("Tài liệu hướng dẫn nội bộ LeGroup", MARGIN_X, PAGE_HEIGHT - 35);

      pCtx.textAlign = "center";
      pCtx.fillText(dateStr, PAGE_WIDTH / 2, PAGE_HEIGHT - 35);

      pCtx.font = "bold 12px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      pCtx.fillStyle = "#475569";
      pCtx.textAlign = "right";
      pCtx.fillText(`Trang ${pIdx + 1} / ${totalPages}`, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 35);
      pCtx.restore();
    }

    const pageJpegs = [];
    for (const pCanvas of pages) {
      const dataUrl = pCanvas.toDataURL("image/jpeg", 0.92);
      const bytes = dataUrlToBytes(dataUrl);
      pageJpegs.push({
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        data: bytes,
      });
    }

    return pageJpegs;
  }

  async function generateGuidePdfBlob(params = {}) {
    const { section, guide, documentTitle } = params;
    const pageJpegs = await renderGuideToCanvasPages({ section, guide, documentTitle });
    const pdfBytes = createPdfBinary(pageJpegs);
    return (typeof Blob !== "undefined")
      ? new Blob([pdfBytes], { type: "application/pdf" })
      : pdfBytes;
  }

  function downloadBlob(filename, blob, mimeType = "application/pdf") {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const finalBlob = blob instanceof Blob ? blob : new Blob([blob], { type: mimeType });
    const url = URL.createObjectURL(finalBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      link.remove();
    }, 200);
  }

  async function exportPdf(params = {}) {
    const {
      form = null,
      activeSectionId = "safety",
      sourceGuides = null,
      getAuthUrlFn = null,
      download = true,
    } = params;

    const sectionMeta = getSection(activeSectionId || "safety");
    const guideData = collectSectionData(form, sectionMeta.id, sourceGuides);

    try {
      for (const step of guideData.steps || []) {
        const stepImages = Array.isArray(step.images) && step.images.length > 0
          ? step.images
          : (step.imageUrl ? [{ id: "img-1", imageUrl: step.imageUrl, annotations: step.annotations }] : []);

        const renderedImages = [];
        for (const img of stepImages) {
          if (img.imageUrl) {
            const dataUrl = await renderAnnotatedImageToDataUrl(img.imageUrl, img.annotations, getAuthUrlFn);
            renderedImages.push({ ...img, renderedImageDataUrl: dataUrl });
          }
        }
        step.renderedImages = renderedImages;
        step.renderedImageDataUrl = renderedImages[0]?.renderedImageDataUrl || "";
      }

      const documentTitle = `Huong_Dan_${slugify(guideData.title || sectionMeta.label)}_LeGroup`;

      if (download) {
        const pdfBlob = await generateGuidePdfBlob({
          section: sectionMeta,
          guide: guideData,
          documentTitle,
        });

        downloadBlob(`${documentTitle}.pdf`, pdfBlob);
        return { success: true, title: documentTitle, blob: pdfBlob };
      }

      const html = buildGuidePdfHtml({
        section: sectionMeta,
        guide: guideData,
        documentTitle,
      });
      return { success: true, title: documentTitle, html };
    } catch (err) {
      throw err;
    }
  }

  function openExportModal(context = {}) {
    return exportPdf(context);
  }

  window.UserGuideContent = {
    sections: SECTIONS.map(({ id, label }) => ({ id, label })),
    defaults,
    normalize,
    getEffectiveGuides: normalize,
    getGuide,
    getSection,
    renderGuide,
    renderEditor,
    renderStepEditor,
    renderStepImageItem,
    normalizeAnnotations,
    renderAnnotatedImageToDataUrl,
    collectSectionData,
    buildGuidePdfHtml,
    generateGuidePdfBlob,
    createPdfBinary,
    downloadBlob,
    exportPdf,
    openExportModal,
  };
})();
