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
    return {
      id: String(source.id || `${sectionId}-${index + 1}-${makeId()}`),
      title: String(source.title || ""),
      body: String(source.body || ""),
      imageUrl: String(source.imageUrl || ""),
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
      ? `<ol class="mobile-user-guide-steps">${guide.steps.map((step) => `
          <li class="mobile-user-guide-step">
            <h3>${escapeHtml(step.title)}</h3>
            ${step.body ? `<p>${escapeHtml(step.body)}</p>` : ""}
            ${step.imageUrl ? `<img class="mobile-user-guide-image" data-photo-src="${escapeHtml(step.imageUrl)}" src="${escapeHtml(step.imageUrl)}" alt="Ảnh hướng dẫn: ${escapeHtml(step.title)}" loading="lazy">` : ""}
          </li>`).join("")}</ol>`
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

  function renderStepEditor(sectionId, step = {}, index = 0) {
    const imageUrl = String(step.imageUrl || "");
    return `<article class="guide-editor-step" data-guide-step-card data-guide-section="${escapeHtml(sectionId)}" data-step-id="${escapeHtml(step.id || makeId())}" data-image-url="${escapeHtml(imageUrl)}" data-image-removed="false">
      <div class="guide-editor-step-heading"><strong>Bước ${index + 1}</strong><button type="button" class="secondary-button guide-editor-remove-step" data-guide-delete-step>Gỡ bước</button></div>
      <label class="guide-editor-field"><span>Tên bước</span><input type="text" data-guide-step-field="title" value="${escapeHtml(step.title || "")}" placeholder="Ví dụ: Chọn khu vực cần kiểm tra"></label>
      <label class="guide-editor-field"><span>Nội dung hướng dẫn</span><textarea rows="3" data-guide-step-field="body" placeholder="Mô tả thao tác cần thực hiện">${escapeHtml(step.body || "")}</textarea></label>
      <div class="guide-editor-image-field">
        <label class="guide-editor-field"><span>Ảnh minh họa cho bước này</span><input type="file" accept="image/*" data-guide-image-input></label>
        <img class="guide-editor-image-preview" data-guide-image-preview data-photo-src="${escapeHtml(imageUrl)}" ${imageUrl ? `src="${escapeHtml(imageUrl)}"` : ""} alt="Ảnh minh họa bước ${index + 1}" ${imageUrl ? "" : "hidden"}>
        <button type="button" class="secondary-button" data-guide-remove-image ${imageUrl ? "" : "hidden"}>Xóa ảnh</button>
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
          <div class="guide-editor-steps" data-guide-steps>${guide.steps.map((step, stepIndex) => renderStepEditor(section.id, step, stepIndex)).join("")}</div>
          <button type="button" class="secondary-button guide-editor-add-step" data-guide-add-step="${section.id}">＋ Thêm bước</button>
          <label class="guide-editor-field"><span>Lưu ý chung</span><textarea rows="2" data-guide-field="hint" placeholder="Lưu ý cho người dùng">${escapeHtml(guide.hint)}</textarea></label>
          <label class="guide-editor-field"><span>Ghi chú thao tác quyền Admin</span><textarea rows="2" data-guide-field="adminNote" placeholder="Hướng dẫn riêng cho Admin">${escapeHtml(guide.adminNote)}</textarea></label>
        </section>`;
      }).join("")}`;
  }

  window.UserGuideContent = {
    sections: SECTIONS.map(({ id, label }) => ({ id, label })),
    defaults,
    normalize,
    getGuide,
    getSection,
    renderGuide,
    renderEditor,
    renderStepEditor,
  };
})();
