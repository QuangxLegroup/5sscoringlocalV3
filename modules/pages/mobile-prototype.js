(() => {
  "use strict";

  // Rapid Hazard Presets for Safety Reporting
  const RAPID_HAZARD_PRESETS = [
    { text: "Cáp điện hở nguy hiểm", label: "+ Cáp điện hở" },
    { text: "Sàn trơn trượt có vệt dầu", label: "+ Sàn trơn trượt" },
    { text: "Hàng hóa xếp vượt chiều cao quy định (>2m)", label: "+ Hàng để cao" },
    { text: "Chắn lối thoát hiểm / Cản trở bình PCCC", label: "+ Chắn lối thoát" },
    { text: "Không mang đầy đủ BHLĐ / PPE", label: "+ Thiếu BHLĐ / PPE" },
    { text: "Rò rỉ dầu mỡ / Hóa chất ra sàn", label: "+ Rò rỉ dầu/hóa chất" },
    { text: "Kẹt cuốn cơ khí / Thiếu tấm che an toàn", label: "+ Kẹt cuốn cơ khí" },
    { text: "Xe nâng chạy nhanh / Điểm mù góc khuất", label: "+ Xe nâng / Va chạm" },
  ];

  // Section categories for 5S navigation filter
  const SECTION_FILTERS = [
    { id: "all", label: "Tất cả" },
    { id: "A", label: "A - Đường đi" },
    { id: "B", label: "B - Hàng hóa" },
    { id: "C", label: "C - Dây chuyền" },
    { id: "D", label: "D - Nghỉ ngơi" },
    { id: "E", label: "E - Tự giác" },
  ];

  // Level names
  const LEVEL_NAMES = {
    1: "Rất xấu",
    2: "Xấu",
    3: "Bình thường",
    4: "Tốt",
    5: "Rất tốt",
  };

  // State
  let activeTab = "safety"; // "safety" | "5s"
  let isFullWidth = false;
  let currentFiveSZoneId = "";
  let currentSafetyZoneId = "";
  let activeSectionFilter = "all";
  let uploadedSafetyPhotoData = "";
  let uploadedSafetyAfterPhotoData = "";
  let editingSafetyRecordId = "";
  let currentAppContext = null;

  function openMobileImageModal(imgSrc) {
    if (!imgSrc || imgSrc === "images/Logo.jpg") return;
    const existing = document.getElementById("mobileImageModal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "mobileImageModal";
    modal.className = "mobile-image-modal-fullscreen";
    modal.innerHTML = `
      <div class="mobile-image-fullscreen-backdrop"></div>
      <button type="button" class="mobile-image-fullscreen-close" aria-label="Đóng">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <div class="mobile-image-fullscreen-container">
        <img src="${imgSrc}" alt="Ảnh xem trước" class="mobile-image-fullscreen-img">
      </div>
    `;
    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector(".mobile-image-fullscreen-backdrop").addEventListener("click", closeModal);
    modal.querySelector(".mobile-image-fullscreen-close").addEventListener("click", closeModal);
    modal.querySelector(".mobile-image-fullscreen-container").addEventListener("click", closeModal);
  }

  function formatIsoToVnDate(isoStr) {
    if (!isoStr) return "";
    const clean = String(isoStr).split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts;
      if (y && m && d) {
        return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
      }
    }
    return clean;
  }

  function openSafetyDetailModal(item, overlay, context) {
    if (!item) return;
    const existing = document.getElementById("mobileSafetyDetailModal");
    if (existing) existing.remove();

    const isLight = (typeof getMobileTheme === "function" && getMobileTheme() === "light") ||
                    overlay?.classList?.contains("is-light-theme") ||
                    document.querySelector(".mobile-responsive-overlay")?.classList?.contains("is-light-theme");

    const fiveSPeriodId = context?.getActivePeriodId?.(context.SAFETY_PERIOD_TYPE) || "";
    const allAreas = context ? context.getAreasForPeriod(fiveSPeriodId) : [];
    const itemArea = allAreas.find((a) => a.id === item.areaId);
    const zoneLabel = itemArea ? `Zone ${itemArea.code} · ${itemArea.departmentHead || itemArea.responsibleName || ''}` : (item.issueLocation || "Zone");
    const canEditFull = canManageFullSafetyRecord(context, item);
    const canEditCountermeasure = canManageSafetyCountermeasure(context, item);
    const countermeasureOnly = canEditCountermeasure && !canEditFull;
    const lockedAttr = countermeasureOnly ? "disabled" : "";
    const defaultActionOwner = context?.getAccountDisplayName?.(context.currentUser, context.SAFETY_PERIOD_TYPE, item.periodId || fiveSPeriodId)
      || context?.currentUser?.name
      || context?.currentUser?.username
      || "";
    const todayValue = typeof context?.todayIsoDate === "function" ? context.todayIsoDate() : new Date().toISOString().slice(0, 10);

    const rawLevel = String(item.issueLevel || item.level || item.riskLevel || "").trim().toUpperCase();
    const rawStop6 = String(item.issueType || item.stop6 || item.stop_6 || item.issue_type || "").trim();
    const statusVal = item.issueStatus || "open";

    let modalPhotoUrl = item.photoDataUrl || "";
    let modalAfterPhotoUrl = item.afterPhotoDataUrl || "";

    const modal = document.createElement("div");
    modal.id = "mobileSafetyDetailModal";
    modal.className = "mobile-safety-detail-modal" + (isLight ? " is-light-theme" : "");
    modal.innerHTML = `
      <div class="detail-modal-backdrop"></div>
      <div class="detail-modal-content">
        
        <div class="detail-modal-header">
          <div class="detail-header-title">
            <i class="fa-solid fa-pen-to-square text-brand-400"></i>
            <span>${countermeasureOnly ? "Cập Nhật Cải Tiến / Xử Lý" : "Sửa Báo Cáo Mối Nguy"}</span>
          </div>
          <button type="button" class="btn-close-modal" id="closeDetailModalBtn">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="detail-modal-body">
          <!-- Zone & Status Bar -->
          <div class="detail-meta-top">
            <span class="detail-zone-chip"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(zoneLabel)}</span>
            <div class="modal-status-select-wrap">
              <select id="modalDetailStatus" class="modal-status-select ${statusVal}" ${lockedAttr}>
                <option value="open" ${statusVal === 'open' ? 'selected' : ''}>Chưa xử lý</option>
                <option value="in_progress" ${statusVal === 'in_progress' ? 'selected' : ''}>Đang xử lý</option>
                <option value="overdue" ${statusVal === 'overdue' ? 'selected' : ''}>Quá hạn</option>
                <option value="closed" ${statusVal === 'closed' ? 'selected' : ''}>Đã khắc phục</option>
              </select>
            </div>
          </div>

          <!-- STOP 6 & Level Selection Grid -->
          <div class="modal-form-grid-2">
            <div class="modal-form-group">
              <label class="modal-form-label">Cấp bậc nguy cơ</label>
              <select id="modalDetailLevel" class="modal-form-select" ${lockedAttr}>
                <option value="" ${!rawLevel ? 'selected' : ''}>Chưa phân loại</option>
                <option value="A" ${rawLevel === 'A' ? 'selected' : ''}>Cấp độ A (Nghiêm trọng)</option>
                <option value="B" ${rawLevel === 'B' ? 'selected' : ''}>Cấp độ B</option>
                <option value="C" ${rawLevel === 'C' ? 'selected' : ''}>Cấp độ C (Nhẹ)</option>
              </select>
            </div>
            <div class="modal-form-group">
              <label class="modal-form-label">Phân loại STOP 6</label>
              <select id="modalDetailStop6" class="modal-form-select" ${lockedAttr}>
                <option value="" ${!rawStop6 ? 'selected' : ''}>Chưa phân loại</option>
                <option value="1-Kẹp,kẹt" ${rawStop6 === '1-Kẹp,kẹt' ? 'selected' : ''}>1-Kẹp, kẹt</option>
                <option value="2-Vật nặng" ${rawStop6 === '2-Vật nặng' ? 'selected' : ''}>2-Vật nặng</option>
                <option value="3-Xe cộ" ${rawStop6 === '3-Xe cộ' ? 'selected' : ''}>3-Xe cộ</option>
                <option value="4-Rơi,ngã" ${rawStop6 === '4-Rơi,ngã' ? 'selected' : ''}>4-Rơi, ngã</option>
                <option value="5-Điện giật" ${rawStop6 === '5-Điện giật' ? 'selected' : ''}>5-Điện giật</option>
                <option value="6-Cháy nổ" ${rawStop6 === '6-Cháy nổ' ? 'selected' : ''}>6-Cháy nổ</option>
                <option value="7-Loại khác" ${rawStop6 === '7-Loại khác' ? 'selected' : ''}>7-Loại khác</option>
              </select>
            </div>
          </div>

          <!-- Description (Mô tả mối nguy hiểm) -->
          <div class="modal-form-group">
            <label class="modal-form-label">Mô tả mối nguy hiểm</label>
            <textarea id="modalDetailNote" class="modal-form-textarea" rows="2" placeholder="Nhập mô tả chi tiết mối nguy..." ${lockedAttr}>${escapeHtml(item.note || '')}</textarea>
          </div>

          <!-- Photo 1: Ảnh hiện trường (Edit, Add & Delete) -->
          <div class="modal-form-group">
            <label class="modal-form-label"><i class="fa-solid fa-camera"></i> Ảnh hiện trường</label>
            <div class="modal-photo-upload-box" id="modalPhotoBox1">
              <input type="file" id="modalPhotoInput1" accept="image/*" capture="environment" class="photo-file-input ${modalPhotoUrl ? 'is-hidden' : ''}" ${lockedAttr}>
              
              <div id="modalPhotoPlaceholder1" class="photo-placeholder ${modalPhotoUrl ? 'is-hidden' : ''}">
                <div class="photo-icon-circle">
                  <i class="fa-solid fa-image"></i>
                </div>
                <p class="photo-primary-prompt">Chụp / Đính kèm ảnh hiện trường</p>
                <div class="photo-action-chip">
                  <i class="fa-solid fa-plus"></i> Thêm / Tải ảnh mới
                </div>
              </div>

              <div id="modalPhotoWrap1" class="photo-preview-wrap ${modalPhotoUrl ? '' : 'is-hidden'}">
                <img id="modalPhotoImg1" src="${modalPhotoUrl || ''}" alt="Ảnh hiện trường" class="photo-preview-img cursor-pointer" data-preview-img="${modalPhotoUrl || ''}" title="Chạm để xem phóng to">
                <div class="photo-preview-actions">
                  <button type="button" id="modalRetakePhotoBtn1" class="photo-btn retake-btn" title="Đổi / Chụp lại ảnh khác" ${lockedAttr}>
                    <i class="fa-solid fa-arrows-rotate"></i>
                    <span>Đổi ảnh</span>
                  </button>
                  <button type="button" id="modalRemovePhotoBtn1" class="photo-btn delete-btn" title="Xóa ảnh này" ${lockedAttr}>
                    <i class="fa-solid fa-trash-can"></i>
                    <span>Xóa ảnh</span>
                  </button>
                </div>
                <div class="photo-attached-badge">
                  <i class="fa-solid fa-circle-check"></i> Ảnh hiện trường (Chạm xem)
                </div>
              </div>
            </div>
          </div>

          <!-- Info Grid (Finder & Channel) -->
          <div class="modal-form-grid-2">
            <div class="modal-form-group">
              <label class="modal-form-label">Phát hiện bởi (kênh)</label>
              <select id="modalDetailFoundChannel" class="modal-form-select" ${lockedAttr}>
                <option value="worker" ${item.foundChannel === 'worker' ? 'selected' : ''}>Công nhân</option>
                <option value="head" ${item.foundChannel === 'head' ? 'selected' : ''}>Trưởng bộ phận</option>
                <option value="assessor" ${item.foundChannel === 'assessor' ? 'selected' : ''}>Assessor</option>
              </select>
            </div>
            <div class="modal-form-group">
              <label class="modal-form-label">Tên người phát hiện</label>
              <input type="text" id="modalDetailFoundBy" class="modal-form-input" value="${escapeHtml(item.issueFoundBy || '')}" placeholder="Tên người phát hiện..." ${lockedAttr}>
            </div>
          </div>

          <div class="modal-form-grid-2">
            <div class="modal-form-group">
              <label class="modal-form-label">Mã nhân viên</label>
              <input type="text" id="modalDetailEmployeeCode" class="modal-form-input" value="${escapeHtml(item.employeeCode || '')}" placeholder="Mã NV..." ${lockedAttr}>
            </div>
            <div class="modal-form-group">
              <label class="modal-form-label">Ngày hoàn thành</label>
              <input type="date" id="modalDetailCompletionDate" class="modal-form-input" value="${escapeHtml(item.completionDate ? item.completionDate.split('T')[0] : todayValue)}">
            </div>
          </div>

          <!-- Improvement / Countermeasure Details -->
          <div class="modal-form-group">
            <label class="modal-form-label text-emerald-400"><i class="fa-solid fa-wrench"></i> Đối sách cải tiến, xử lý</label>
            <textarea id="modalDetailImprovement" class="modal-form-textarea" rows="2" placeholder="Nội dung phương án cải tiến / xử lý...">${escapeHtml(item.improvementContent || '')}</textarea>
          </div>

          <!-- Photo 2: Ảnh sau cải tiến (Edit, Add & Delete) -->
          <div class="modal-form-group">
            <label class="modal-form-label text-emerald-400"><i class="fa-solid fa-camera"></i> Ảnh sau cải tiến (nếu có)</label>
            <div class="modal-photo-upload-box" id="modalPhotoBox2">
              <input type="file" id="modalPhotoInput2" accept="image/*" capture="environment" class="photo-file-input ${modalAfterPhotoUrl ? 'is-hidden' : ''}">
              
              <div id="modalPhotoPlaceholder2" class="photo-placeholder ${modalAfterPhotoUrl ? 'is-hidden' : ''}">
                <div class="photo-icon-circle">
                  <i class="fa-solid fa-image"></i>
                </div>
                <p class="photo-primary-prompt">Chụp / Đính kèm ảnh sau cải tiến</p>
                <div class="photo-action-chip">
                  <i class="fa-solid fa-plus"></i> Thêm ảnh đối sách
                </div>
              </div>

              <div id="modalPhotoWrap2" class="photo-preview-wrap ${modalAfterPhotoUrl ? '' : 'is-hidden'}">
                <img id="modalPhotoImg2" src="${modalAfterPhotoUrl || ''}" alt="Ảnh sau cải tiến" class="photo-preview-img cursor-pointer" data-preview-img="${modalAfterPhotoUrl || ''}" title="Chạm để xem phóng to">
                <div class="photo-preview-actions">
                  <button type="button" id="modalRetakePhotoBtn2" class="photo-btn retake-btn" title="Đổi / Chụp lại ảnh khác">
                    <i class="fa-solid fa-arrows-rotate"></i>
                    <span>Đổi ảnh</span>
                  </button>
                  <button type="button" id="modalRemovePhotoBtn2" class="photo-btn delete-btn" title="Xóa ảnh này">
                    <i class="fa-solid fa-trash-can"></i>
                    <span>Xóa ảnh</span>
                  </button>
                </div>
                <div class="photo-attached-badge">
                  <i class="fa-solid fa-circle-check"></i> Ảnh sau cải tiến (Chạm xem)
                </div>
              </div>
            </div>
          </div>

          <div class="modal-form-grid-2">
            <div class="modal-form-group">
              <label class="modal-form-label">Đảm nhiệm (PIC)</label>
              <input type="text" id="modalDetailActionOwner" class="modal-form-input" value="${escapeHtml(item.actionOwner || defaultActionOwner)}" placeholder="Người đảm nhiệm...">
            </div>
            <div class="modal-form-group">
              <label class="modal-form-label">Kế hoạch</label>
              <input type="text" id="modalDetailActionPlan" class="modal-form-input" value="${escapeHtml(item.actionPlan || '')}" placeholder="Kế hoạch xử lý...">
            </div>
          </div>

        </div>

        <!-- Action Buttons Footer -->
        <div class="detail-modal-footer">
          <button type="button" class="btn-detail-save" id="btnDetailSave" ${canEditCountermeasure ? "" : "disabled"}>
            <i class="fa-solid fa-floppy-disk"></i> LƯU THAY ĐỔI
          </button>
          <button type="button" class="btn-detail-delete" id="btnDetailDelete" ${canEditFull ? "" : "hidden"}>
            <i class="fa-solid fa-trash-can"></i> XÓA BÁO CÁO
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector(".detail-modal-backdrop").addEventListener("click", closeModal);
    modal.querySelector("#closeDetailModalBtn").addEventListener("click", closeModal);

    // Lightbox for photos in detail modal
    modal.querySelectorAll("[data-preview-img]").forEach((el) => {
      el.addEventListener("click", (e) => {
        // Only trigger lightbox if user tapped on the image itself, not on action buttons
        if (e.target.closest(".photo-btn")) return;
        e.preventDefault();
        e.stopPropagation();
        const src = el.dataset.previewImg || el.src;
        if (src) openMobileImageModal(src);
      });
    });

    // Wire Photo 1 (Ảnh hiện trường) events
    const fileInput1 = modal.querySelector("#modalPhotoInput1");
    const placeholder1 = modal.querySelector("#modalPhotoPlaceholder1");
    const wrap1 = modal.querySelector("#modalPhotoWrap1");
    const img1 = modal.querySelector("#modalPhotoImg1");

    if (fileInput1) {
      fileInput1.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            modalPhotoUrl = ev.target.result;
            if (img1) {
              img1.src = modalPhotoUrl;
              img1.dataset.previewImg = modalPhotoUrl;
            }
            placeholder1?.classList.add("is-hidden");
            wrap1?.classList.remove("is-hidden");
            fileInput1?.classList.add("is-hidden");
          };
          reader.readAsDataURL(file);
        }
      });
    }

    modal.querySelector("#modalRetakePhotoBtn1")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileInput1?.classList.remove("is-hidden");
      fileInput1?.click();
    });

    modal.querySelector("#modalRemovePhotoBtn1")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      modalPhotoUrl = "";
      if (fileInput1) fileInput1.value = "";
      if (img1) {
        img1.src = "";
        img1.dataset.previewImg = "";
      }
      wrap1?.classList.add("is-hidden");
      placeholder1?.classList.remove("is-hidden");
      fileInput1?.classList.remove("is-hidden");
    });

    // Wire Photo 2 (Ảnh sau cải tiến) events
    const fileInput2 = modal.querySelector("#modalPhotoInput2");
    const placeholder2 = modal.querySelector("#modalPhotoPlaceholder2");
    const wrap2 = modal.querySelector("#modalPhotoWrap2");
    const img2 = modal.querySelector("#modalPhotoImg2");

    if (fileInput2) {
      fileInput2.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            modalAfterPhotoUrl = ev.target.result;
            if (img2) {
              img2.src = modalAfterPhotoUrl;
              img2.dataset.previewImg = modalAfterPhotoUrl;
            }
            placeholder2?.classList.add("is-hidden");
            wrap2?.classList.remove("is-hidden");
            fileInput2?.classList.add("is-hidden");
          };
          reader.readAsDataURL(file);
        }
      });
    }

    modal.querySelector("#modalRetakePhotoBtn2")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileInput2?.classList.remove("is-hidden");
      fileInput2?.click();
    });

    modal.querySelector("#modalRemovePhotoBtn2")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      modalAfterPhotoUrl = "";
      if (fileInput2) fileInput2.value = "";
      if (img2) {
        img2.src = "";
        img2.dataset.previewImg = "";
      }
      wrap2?.classList.add("is-hidden");
      placeholder2?.classList.remove("is-hidden");
      fileInput2?.classList.remove("is-hidden");
    });

    // Save button click inside direct edit modal
    modal.querySelector("#btnDetailSave")?.addEventListener("click", async () => {
      if (!canManageSafetyCountermeasure(context, item)) {
        showMobileToast("Tài khoản của bạn không có quyền cập nhật phần cải tiến/xử lý cho zone này!", true);
        return;
      }

      const note = modal.querySelector("#modalDetailNote")?.value?.trim() || "";
      const issueStatus = modal.querySelector("#modalDetailStatus")?.value || "open";
      const issueLevel = modal.querySelector("#modalDetailLevel")?.value || "";
      const issueType = modal.querySelector("#modalDetailStop6")?.value || "";
      const foundChannel = modal.querySelector("#modalDetailFoundChannel")?.value || "worker";
      const issueFoundBy = modal.querySelector("#modalDetailFoundBy")?.value?.trim() || "";
      const employeeCode = modal.querySelector("#modalDetailEmployeeCode")?.value?.trim() || "";
      const improvementContent = modal.querySelector("#modalDetailImprovement")?.value?.trim() || "";
      const actionOwner = modal.querySelector("#modalDetailActionOwner")?.value?.trim() || "";
      const actionPlan = modal.querySelector("#modalDetailActionPlan")?.value?.trim() || "";
      const completionDate = modal.querySelector("#modalDetailCompletionDate")?.value || "";

      if (!countermeasureOnly && !note) {
        showMobileToast("Vui lòng nhập mô tả Mối nguy hiểm!", true);
        return;
      }

      let finalPhotoDataUrl = modalPhotoUrl;
      let finalPhotoName = item.photoName || "anh-moi-nguy.jpg";
      const file1 = fileInput1?.files?.[0];
      if (file1 && typeof context?.prepareScorePhoto === "function") {
        try {
          const prepared1 = await context.prepareScorePhoto(file1, null, false, fiveSPeriodId);
          finalPhotoDataUrl = prepared1.photoDataUrl || finalPhotoDataUrl;
          finalPhotoName = prepared1.photoName || finalPhotoName;
        } catch (_) {}
      }

      let finalAfterPhotoDataUrl = modalAfterPhotoUrl;
      let finalAfterPhotoName = item.afterPhotoName || "anh-sau-cai-tien.jpg";
      const file2 = fileInput2?.files?.[0];
      if (file2 && typeof context?.prepareScorePhoto === "function") {
        try {
          const prepared2 = await context.prepareScorePhoto(file2, null, false, fiveSPeriodId);
          finalAfterPhotoDataUrl = prepared2.photoDataUrl || finalAfterPhotoDataUrl;
          finalAfterPhotoName = prepared2.photoName || finalAfterPhotoName;
        } catch (_) {}
      }

      const now = new Date();
      const updatedRecord = countermeasureOnly
        ? {
            ...item,
            improvementContent,
            actionOwner: actionOwner || defaultActionOwner,
            actionPlan,
            completionDate: completionDate || todayValue,
            afterPhotoDataUrl: finalAfterPhotoDataUrl,
            afterPhotoName: finalAfterPhotoName,
            updatedAt: now.toISOString(),
          }
        : {
            ...item,
            note,
            issueStatus,
            issueLevel,
            issueType,
            foundChannel,
            issueFoundBy,
            employeeCode,
            improvementContent,
            actionOwner: actionOwner || defaultActionOwner,
            actionPlan,
            completionDate: completionDate || todayValue,
            photoDataUrl: finalPhotoDataUrl,
            photoName: finalPhotoName,
            afterPhotoDataUrl: finalAfterPhotoDataUrl,
            afterPhotoName: finalAfterPhotoName,
            updatedAt: now.toISOString(),
          };

      try {
        if (context?.state?.safetyRecords) {
          const idx = context.state.safetyRecords.findIndex((r) => r.id === item.id);
          if (idx >= 0) {
            context.state.safetyRecords[idx] = updatedRecord;
          }
        }

        if (typeof context?.saveSafetyRecord === "function") {
          await context.saveSafetyRecord(updatedRecord);
        }

        closeModal();
        showMobileToast("Đã lưu thay đổi báo cáo thành công!");
        renderSafetyScreen(overlay, context);
      } catch (err) {
        console.error("Lỗi khi cập nhật báo cáo:", err);
        showMobileToast("Lỗi khi lưu: " + (err.message || err), true);
      }
    });

    // Delete button click inside detail modal
    modal.querySelector("#btnDetailDelete")?.addEventListener("click", async () => {
      if (!canManageFullSafetyRecord(context, item)) {
        showMobileToast("Tài khoản của bạn không có quyền xóa báo cáo mối nguy!", true);
        return;
      }
      if (!confirm("Bạn có chắc chắn muốn xóa báo cáo mối nguy này không?")) {
        return;
      }
      try {
        let deleted = false;
        if (typeof context?.deleteSafetyRecordDirect === "function") {
          deleted = await context.deleteSafetyRecordDirect(item.id);
        }
        if (!deleted && typeof context?.deleteSafetyRecordFromDb === "function") {
          await context.deleteSafetyRecordFromDb(item.id);
          deleted = true;
        }
        if (context?.state?.safetyRecords) {
          context.state.safetyRecords = context.state.safetyRecords.filter((r) => r.id !== item.id);
        }
        if (editingSafetyRecordId === item.id) {
          editingSafetyRecordId = "";
          uploadedSafetyPhotoData = "";
          uploadedSafetyAfterPhotoData = "";
        }
        closeModal();
        showMobileToast("Đã xóa báo cáo mối nguy thành công!");
        renderSafetyScreen(overlay, context);
      } catch (err) {
        console.error("Lỗi khi xóa:", err);
        showMobileToast("Lỗi khi xóa: " + (err.message || err), true);
      }
    });
  }

  function getAppContext() {
    if (currentAppContext) return currentAppContext;
    if (typeof window.__GET_APP_CONTEXT__ === "function") {
      currentAppContext = window.__GET_APP_CONTEXT__();
      return currentAppContext;
    }
    if (window.__APP_CONTEXT__) {
      currentAppContext = window.__APP_CONTEXT__;
      return currentAppContext;
    }
    return null;
  }

  function checkFiveSPermission(context) {
    const user = context?.currentUser;
    if (!user) return false;
    if (typeof context?.isFiveSAssessor === "function") {
      return context.isFiveSAssessor(user);
    }
    return true;
  }

  function checkSafetyPermission(context) {
    const user = context?.currentUser;
    if (!user) return false;
    if (typeof context?.canUseSafety === "function") {
      return context.canUseSafety(user);
    }
    return true;
  }

  function isDepartmentHeadUser(context) {
    const user = context?.currentUser;
    return Boolean(user && typeof context?.isDepartmentHeadAccount === "function" && context.isDepartmentHeadAccount(user));
  }

  function canManageSafetyCountermeasure(context, record) {
    if (!record) return false;
    if (typeof context?.canManageSafetyCountermeasure === "function") {
      return context.canManageSafetyCountermeasure(record, context.currentUser);
    }
    if (typeof context?.canManageSafetyRecord === "function") {
      return context.canManageSafetyRecord(record, context.currentUser);
    }
    return checkSafetyPermission(context);
  }

  function canManageFullSafetyRecord(context, record) {
    if (!record) return false;
    if (typeof context?.canManageSafetyRecord === "function") {
      return context.canManageSafetyRecord(record, context.currentUser);
    }
    return checkSafetyPermission(context);
  }

  function getMobileTheme() {
    return localStorage.getItem("mobile_theme") || "dark";
  }

  function applyMobileTheme(overlay, theme) {
    if (!overlay) return;
    const isLight = theme === "light";
    overlay.classList.add("theme-toggling");
    overlay.classList.toggle("is-light-theme", isLight);
    const themeBtn = overlay.querySelector("#mobileThemeToggleBtn");
    if (themeBtn) {
      themeBtn.title = isLight ? "Chuyển sang giao diện Tối" : "Chuyển sang giao diện Sáng";
      themeBtn.innerHTML = `<i class="fa-solid ${isLight ? 'fa-moon text-amber-500' : 'fa-sun text-amber-400'}"></i>`;
    }
    requestAnimationFrame(() => {
      overlay.classList.remove("theme-toggling");
    });
  }

  // Open Mobile Prototype View
  function openMobilePrototype(initialTab = "safety", passedContext = null) {
    if (passedContext) {
      currentAppContext = passedContext;
    }
    const context = getAppContext();
    const can5S = checkFiveSPermission(context);
    const canSafety = checkSafetyPermission(context);

    if (initialTab === "5s") {
      if (can5S) {
        activeTab = "5s";
      } else if (canSafety) {
        activeTab = "safety";
        showMobileToast("Tài khoản không có quyền chấm 5S, đã chuyển sang Đánh Giá An Toàn.");
      } else {
        showMobileToast("Tài khoản của bạn không có quyền sử dụng giao diện Mobile.", true);
        return;
      }
    } else {
      if (canSafety) {
        activeTab = "safety";
      } else if (can5S) {
        activeTab = "5s";
        showMobileToast("Tài khoản không có quyền đánh giá An Toàn, đã chuyển sang Chấm Điểm 5S.");
      } else {
        showMobileToast("Tài khoản của bạn không có quyền sử dụng giao diện Mobile.", true);
        return;
      }
    }

    // If overlay is already open in DOM, do NOT tear down and recreate overlay!
    const existingOverlay = document.getElementById("mobileProtoOverlay");
    if (existingOverlay && document.body.contains(existingOverlay)) {
      const tabBtnSafety = existingOverlay.querySelector("#mobileTabBtnSafety");
      const tabBtn5S = existingOverlay.querySelector("#mobileTabBtn5S");
      const screenSafety = existingOverlay.querySelector("#mobileScreenSafety");
      const screen5S = existingOverlay.querySelector("#mobileScreen5S");

      if (activeTab === "5s") {
        if (tabBtn5S) tabBtn5S.className = "mobile-tab-btn is-active-fives";
        if (tabBtnSafety) tabBtnSafety.className = "mobile-tab-btn" + (!checkSafetyPermission(context) ? " is-disabled-tab" : "");
        if (screen5S) screen5S.classList.remove("is-hidden");
        if (screenSafety) screenSafety.classList.add("is-hidden");
      } else {
        if (tabBtnSafety) tabBtnSafety.className = "mobile-tab-btn is-active-safety";
        if (tabBtn5S) tabBtn5S.className = "mobile-tab-btn" + (!checkFiveSPermission(context) ? " is-disabled-tab" : "");
        if (screenSafety) screenSafety.classList.remove("is-hidden");
        if (screen5S) screen5S.classList.add("is-hidden");
      }
      return;
    }

    // Close existing if open
    closeMobilePrototype();

    const currentTheme = getMobileTheme();
    const overlay = document.createElement("div");
    overlay.className = "mobile-responsive-overlay" + (currentTheme === "light" ? " is-light-theme" : "");
    overlay.id = "mobileProtoOverlay";

    // Render skeleton
    overlay.innerHTML = buildOverlaySkeletonHtml(context);
    document.body.appendChild(overlay);
    document.body.classList.add("mobile-proto-open");

    // Initialize zones & handlers
    initMobilePrototype(overlay, context);

    // Update browser URL route
    const targetRoute = activeTab === "5s" ? "/mobile/5s" : "/mobile/safety";
    context?.pushRoute?.(targetRoute);
  }

  // Close Mobile Prototype
  function closeMobilePrototype() {
    const existing = document.getElementById("mobileProtoOverlay");
    if (existing) {
      existing.remove();
    }
    document.body.classList.remove("mobile-proto-open");
  }

  // Build Skeleton HTML
  function buildOverlaySkeletonHtml(context) {
    const user = context?.currentUser;
    const assessorName = context?.getAccountDisplayName?.(user, context.FIVE_S_PERIOD_TYPE) || user?.name || user?.username || "Đánh giá viên";
    const fiveSPeriodId = context?.getActivePeriodId?.(context.FIVE_S_PERIOD_TYPE) || "";
    const fiveSPeriod = context?.getPeriod?.(fiveSPeriodId);
    const periodBadgeText = fiveSPeriod ? context.periodLabel(fiveSPeriod) : "Kỳ đang mở";

    const can5S = checkFiveSPermission(context);
    const canSafety = checkSafetyPermission(context);
    const currentTheme = getMobileTheme();

    const isAdmin = typeof context?.isAdminAccount === "function" && context.isAdminAccount(user);
    const isZoneOwner = typeof context?.isZoneOwnerAccount === "function" && context.isZoneOwnerAccount(user);
    const roleTitle = isZoneOwner ? "Quản lý zone" : isAdmin ? "Admin" : "Assessor";

    return `
      <!-- Desktop Top Control Bar (Hidden on small mobile screens) -->
      <header class="mobile-responsive-topbar">
        <div class="topbar-left">
          <span class="topbar-pulse-dot"></span>
          <span class="topbar-title">5S & Safety Industrial Mobile View</span>
        </div>
        <div class="topbar-right">
          <button type="button" id="mobileToggleWidthBtn" class="topbar-btn" title="Chuyển chế độ mở rộng / thu gọn">
            <i class="fa-solid fa-expand"></i>
            <span id="mobileToggleWidthText">Mở rộng</span>
          </button>
          <button type="button" id="mobileReturnDashboardBtn" class="topbar-btn topbar-btn-return" title="Quay lại Trang chủ">
            <i class="fa-solid fa-arrow-left"></i>
            <span>Về trang chủ</span>
          </button>
        </div>
      </header>

      <!-- Main Responsive Shell (Real mobile interface, NO phone bezel) -->
      <main class="mobile-responsive-shell" id="mobileResponsiveShell">
        
        <!-- App Header Inside View -->
        <div class="mobile-nav-header">
          <div class="nav-header-brand-row">
            <div class="nav-header-logo-group">
              <img src="images/Logo.jpg" alt="LeGroup Logo" class="nav-header-avatar-img" style="width: 32px; height: 32px; max-width: 32px; max-height: 32px; object-fit: contain; border-radius: 6px; flex-shrink: 0; background: #ffffff; padding: 2px; box-sizing: border-box;">
              <div>
                <h1 class="nav-header-title">LeGroup Factory</h1>
                <p class="nav-header-assessor">
                  <i class="fa-solid ${isZoneOwner ? 'fa-user-gear text-emerald-400' : isAdmin ? 'fa-user-shield text-amber-400' : 'fa-user-check text-sky-400'}"></i>
                  <span>${escapeHtml(roleTitle)}: <strong id="mobileNavAssessorName">${escapeHtml(assessorName)}</strong></span>
                </p>
              </div>
            </div>
            <div class="nav-header-period-pill">
              <span class="period-pill-text">${escapeHtml(periodBadgeText)}</span>
              <button type="button" id="mobileThemeToggleBtn" class="mobile-theme-toggle-btn" title="${currentTheme === 'light' ? 'Chuyển sang giao diện Tối' : 'Chuyển sang giao diện Sáng'}">
                <i class="fa-solid ${currentTheme === 'light' ? 'fa-moon text-amber-500' : 'fa-sun text-amber-400'}"></i>
              </button>
              <button type="button" id="mobileNavCloseBtn" class="mobile-nav-close-btn" title="Đóng">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          <!-- Segmented Tab Switcher -->
          <div class="mobile-tab-switcher">
            <button type="button" id="mobileTabBtnSafety" class="mobile-tab-btn ${activeTab === 'safety' ? 'is-active-safety' : ''} ${!canSafety ? 'is-disabled-tab' : ''}" ${!canSafety ? 'title="Bạn không có quyền đánh giá An Toàn"' : ''}>
              <i class="fa-solid ${canSafety ? 'fa-triangle-exclamation text-amber-400' : 'fa-lock text-slate-400'}"></i>
              <span>Báo Cáo An Toàn</span>
            </button>
            <button type="button" id="mobileTabBtn5S" class="mobile-tab-btn ${activeTab === '5s' ? 'is-active-fives' : ''} ${!can5S ? 'is-disabled-tab' : ''}" ${!can5S ? 'title="Bạn không có quyền chấm 5S"' : ''}>
              <i class="fa-solid ${can5S ? 'fa-clipboard-check text-emerald-400' : 'fa-lock text-slate-400'}"></i>
              <span>Chấm Điểm 5S</span>
            </button>
          </div>
        </div>

        <!-- SCREEN 1: BÁO CÁO AN TOÀN -->
        <div id="mobileScreenSafety" class="mobile-screen-pane ${activeTab === 'safety' ? '' : 'is-hidden'}">
          <!-- Populated by renderSafetyScreen() -->
        </div>

        <!-- SCREEN 2: CHẤM ĐIỂM 5S -->
        <div id="mobileScreen5S" class="mobile-screen-pane ${activeTab === '5s' ? '' : 'is-hidden'}">
          <!-- Populated by renderFiveSScreen() -->
        </div>

      </main>

      <!-- Toast Notification Container -->
      <div id="mobileToast" class="mobile-toast-popup">
        <i class="fa-solid fa-circle-check text-emerald-400"></i>
        <span id="mobileToastText">Thao tác thành công</span>
      </div>
    `;
  }

  // Initialize listeners and content
  function initMobilePrototype(overlay, context) {
    // Return button
    const returnBtn = overlay.querySelector("#mobileReturnDashboardBtn");
    const closeBtn = overlay.querySelector("#mobileNavCloseBtn");
    const handleClose = () => {
      closeMobilePrototype();
      if (typeof context?.setActiveTab === "function") {
        context.setActiveTab("home");
      } else if (typeof context?.pushRoute === "function") {
        context.pushRoute("/home");
      }
    };
    if (returnBtn) returnBtn.addEventListener("click", handleClose);
    if (closeBtn) closeBtn.addEventListener("click", handleClose);

    // Theme toggle button
    const themeBtn = overlay.querySelector("#mobileThemeToggleBtn");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const activeTheme = getMobileTheme();
        const nextTheme = activeTheme === "light" ? "dark" : "light";
        localStorage.setItem("mobile_theme", nextTheme);
        applyMobileTheme(overlay, nextTheme);
      });
    }

    // Full width toggle
    const toggleWidthBtn = overlay.querySelector("#mobileToggleWidthBtn");
    const toggleWidthText = overlay.querySelector("#mobileToggleWidthText");
    const shell = overlay.querySelector("#mobileResponsiveShell");
    if (toggleWidthBtn && shell) {
      toggleWidthBtn.addEventListener("click", () => {
        isFullWidth = !isFullWidth;
        shell.classList.toggle("is-full-width", isFullWidth);
        if (toggleWidthText) {
          toggleWidthText.textContent = isFullWidth ? "Thu gọn" : "Mở rộng";
        }
      });
    }

    // Tab switcher
    const tabBtnSafety = overlay.querySelector("#mobileTabBtnSafety");
    const tabBtn5S = overlay.querySelector("#mobileTabBtn5S");
    const screenSafety = overlay.querySelector("#mobileScreenSafety");
    const screen5S = overlay.querySelector("#mobileScreen5S");

    function switchMobileTab(tab) {
      if (tab === "safety") {
        if (!checkSafetyPermission(context)) {
          showMobileToast("Tài khoản của bạn không có quyền đánh giá An Toàn!", true);
          return;
        }
        activeTab = "safety";
        tabBtnSafety.className = "mobile-tab-btn is-active-safety";
        tabBtn5S.className = "mobile-tab-btn" + (!checkFiveSPermission(context) ? " is-disabled-tab" : "");
        screenSafety.classList.remove("is-hidden");
        screen5S.classList.add("is-hidden");
        renderSafetyScreen(overlay, getAppContext());
        context?.pushRoute?.("/mobile/safety");
      } else {
        if (!checkFiveSPermission(context)) {
          showMobileToast("Tài khoản của bạn không có quyền chấm 5S!", true);
          return;
        }
        activeTab = "5s";
        tabBtn5S.className = "mobile-tab-btn is-active-fives";
        tabBtnSafety.className = "mobile-tab-btn" + (!checkSafetyPermission(context) ? " is-disabled-tab" : "");
        screen5S.classList.remove("is-hidden");
        screenSafety.classList.add("is-hidden");
        renderFiveSScreen(overlay, getAppContext());
        context?.pushRoute?.("/mobile/5s");
      }
    }

    if (tabBtnSafety) tabBtnSafety.addEventListener("click", () => switchMobileTab("safety"));
    if (tabBtn5S) tabBtn5S.addEventListener("click", () => switchMobileTab("5s"));

    // Initial render based on activeTab
    if (activeTab === "safety") {
      renderSafetyScreen(overlay, context);
    } else {
      renderFiveSScreen(overlay, context);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN 1: BÁO CÁO AN TOÀN (SAFETY AUDIT & HAZARD REPORTING)
  // ─────────────────────────────────────────────────────────────────────────────
  function renderSafetyScreen(overlay, context) {
    const screen = overlay.querySelector("#mobileScreenSafety");
    if (!screen) return;

    const safetyPeriodId = context?.getActivePeriodId?.(context.SAFETY_PERIOD_TYPE) || "";
    const allSafetyAreas = context ? context.getAreasForPeriod(safetyPeriodId) : [];
    const user = context?.currentUser;
    const isAdmin = typeof context?.isAdminAccount === "function" && context.isAdminAccount(user);
    const allowedAreaIds = (!isAdmin && typeof context?.getAllowedAreaIds === "function")
      ? context.getAllowedAreaIds(user, safetyPeriodId)
      : null;
    const countermeasureOnlyMode = isDepartmentHeadUser(context);
    const reportableAreas = allSafetyAreas.filter((a) => {
      const code = String(a.templateCode || a.code || "").trim();
      return code !== "27" && (!allowedAreaIds || allowedAreaIds.has(a.id));
    });

    const allRecords = context?.state?.safetyRecords || [];
    const editingRecord = editingSafetyRecordId ? allRecords.find((r) => r.id === editingSafetyRecordId) || null : null;

    if (editingRecord) {
      currentSafetyZoneId = editingRecord.areaId || currentSafetyZoneId;
      if (!uploadedSafetyPhotoData && editingRecord.photoDataUrl) {
        uploadedSafetyPhotoData = editingRecord.photoDataUrl;
      }
      if (!uploadedSafetyAfterPhotoData && editingRecord.afterPhotoDataUrl) {
        uploadedSafetyAfterPhotoData = editingRecord.afterPhotoDataUrl;
      }
    } else if (!currentSafetyZoneId && reportableAreas.length > 0) {
      currentSafetyZoneId = reportableAreas[0].id;
    }

    const now = new Date();
    const safetyPeriod = context?.getPeriod?.(safetyPeriodId);
    let defaultIssueDate = "";
    if (editingRecord?.issueDay && editingRecord?.issueMonth && safetyPeriod?.year) {
      defaultIssueDate = `${safetyPeriod.year}-${String(editingRecord.issueMonth).padStart(2, "0")}-${String(editingRecord.issueDay).padStart(2, "0")}`;
    } else if (safetyPeriod?.year && safetyPeriod?.month) {
      const d = String(now.getDate()).padStart(2, "0");
      defaultIssueDate = `${safetyPeriod.year}-${String(safetyPeriod.month).padStart(2, "0")}-${d}`;
    } else {
      defaultIssueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    }

    const dateStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Get current safety records for recent history
    const recentRecords = allRecords
      .filter((r) => !safetyPeriodId || r.periodId === safetyPeriodId)
      .filter((r) => !allowedAreaIds || allowedAreaIds.has(r.areaId))
      .slice(0, 20);

    const defaultFinder = editingRecord ? (editingRecord.issueFoundBy || "") : (context?.getAccountDisplayName?.(user, context.SAFETY_PERIOD_TYPE, safetyPeriodId) || user?.name || "");
    const defaultActionOwner = context?.getAccountDisplayName?.(user, context.SAFETY_PERIOD_TYPE, safetyPeriodId) || user?.name || user?.username || "";
    const todayValue = typeof context?.todayIsoDate === "function" ? context.todayIsoDate() : new Date().toISOString().slice(0, 10);

    screen.innerHTML = `
      <div class="mobile-safety-container">
        
        <!-- Metadata Banner -->
        <div class="mobile-info-banner">
          <div class="info-row">
            <span class="info-label"><i class="fa-regular fa-calendar-check text-brand-400"></i> Nguồn phát hiện:</span>
            <span class="info-value">Đánh giá an toàn nhà máy</span>
          </div>
          <div class="info-row">
            <span class="info-label"><i class="fa-regular fa-clock text-brand-400"></i> Thời gian:</span>
            <span class="info-value font-mono">${dateStr}</span>
          </div>
        </div>

        ${editingRecord ? `
          <div class="mobile-editing-alert-banner">
            <div>
              <i class="fa-solid fa-pen-to-square text-amber-400"></i>
              <span>Đang sửa mối nguy: <strong>${escapeHtml(editingRecord.note ? (editingRecord.note.slice(0, 32) + '...') : editingRecord.id)}</strong></span>
            </div>
            <button type="button" id="cancelEditSafetyBtn" class="btn-cancel-edit-mobile">
              <i class="fa-solid fa-xmark"></i> Hủy sửa
            </button>
          </div>
        ` : ''}

        ${countermeasureOnlyMode ? `
          <div class="mobile-info-banner">
            <div class="info-row">
              <span class="info-label"><i class="fa-solid fa-wrench text-brand-400"></i> Chế độ:</span>
              <span class="info-value">Cập nhật cải tiến / xử lý cho zone trưởng phòng quản lý</span>
            </div>
          </div>
        ` : `
        <!-- Safety Form Card -->
        <form id="mobileSafetyForm" class="mobile-safety-form">
          
          <!-- Row 1: Zone & Ngày phát hiện -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Khu vực (Zone)<span class="required-star">*</span></label>
              <div class="select-wrapper">
                <select id="mobileSafetyZoneSelect" required class="form-control form-select">
                  <option value="">-- Chọn Zone --</option>
                  ${reportableAreas.map((area) => `
                    <option value="${escapeHtml(area.id)}" ${area.id === currentSafetyZoneId ? 'selected' : ''}>
                      Zone ${escapeHtml(area.code)} · ${escapeHtml(context?.getSafetyDepartmentForArea?.(area, safetyPeriodId) || area.departmentHead || area.responsibleName || "")}
                    </option>
                  `).join("")}
                </select>
                <i class="fa-solid fa-chevron-down select-chevron"></i>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Ngày phát hiện</label>
              <div class="date-input-container">
                <input type="text" id="mobileSafetyIssueDateDisplay" class="form-control date-custom-input" placeholder="dd/mm/yyyy" value="${formatIsoToVnDate(defaultIssueDate)}" readonly>
                <input type="date" id="mobileSafetyIssueDate" class="native-hidden-date-input" value="${escapeHtml(defaultIssueDate)}">
                <button type="button" class="btn-calendar-trigger" tabindex="-1">
                  <i class="fa-solid fa-calendar-days text-white"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Row 2: Mối nguy hiểm phát hiện được (Mô tả duy nhất bắt buộc) -->
          <div class="form-group">
            <label class="form-label">Mối nguy hiểm phát hiện <span class="required-star">*</span></label>
            <textarea id="mobileSafetyDescription" rows="3" required
              placeholder="Mô tả chi tiết vị trí và nội dung mối nguy hiểm phát hiện..."
              class="form-control form-textarea">${escapeHtml(editingRecord?.note || "")}</textarea>
          </div>

          <!-- Row 3: Photo Upload & Camera Component (Ảnh hiện trường) -->
          <div class="form-group">
            <label class="form-label">Hình ảnh minh họa hiện trường</label>
            
            <div id="mobilePhotoUploadBox" class="photo-upload-box">
              <input type="file" id="mobileSafetyFileInput" accept="image/*" capture="environment" class="photo-file-input">
              
              <div id="photoPlaceholder" class="photo-placeholder ${uploadedSafetyPhotoData ? 'is-hidden' : ''}">
                <div class="photo-icon-circle">
                  <i class="fa-solid fa-camera"></i>
                </div>
                <p class="photo-primary-prompt">Chụp ảnh hoặc Tải lên ảnh</p>
                <p class="photo-sub-prompt">Nhấn vào đây để mở máy ảnh / bộ sưu tập</p>
                <div class="photo-action-chip">
                  <i class="fa-solid fa-plus"></i> Chụp ảnh minh họa
                </div>
              </div>

              <div id="photoPreviewWrap" class="photo-preview-wrap ${uploadedSafetyPhotoData ? '' : 'is-hidden'}">
                <img id="mobileSafetyPreviewImg" src="${uploadedSafetyPhotoData || ''}" alt="Ảnh hiện trường" class="photo-preview-img cursor-pointer" data-preview-img="${uploadedSafetyPhotoData || ''}" title="Chạm để phóng to ảnh">
                <div class="photo-preview-actions">
                  <button type="button" id="mobileRetakePhotoBtn" class="photo-btn retake-btn" title="Đổi/Chụp lại ảnh">
                    <i class="fa-solid fa-arrows-rotate"></i>
                  </button>
                  <button type="button" id="mobileRemovePhotoBtn" class="photo-btn delete-btn" title="Xóa ảnh này">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
                <div class="photo-attached-badge">
                  <i class="fa-solid fa-circle-check"></i> Đã đính kèm ảnh
                </div>
              </div>
            </div>
          </div>

          <!-- Row 4: STOP 6 & Severity Grid (Cấp bậc có Chưa phân loại) -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Phân loại STOP 6</label>
              <div class="select-wrapper">
                <select id="mobileSafetyStop6" class="form-control form-select">
                  <option value="" ${!editingRecord?.issueType ? 'selected' : ''}>Chưa phân loại</option>
                  <option value="1-Kẹp,kẹt" ${editingRecord?.issueType === '1-Kẹp,kẹt' ? 'selected' : ''}>1-Kẹp, kẹt</option>
                  <option value="2-Vật nặng" ${editingRecord?.issueType === '2-Vật nặng' ? 'selected' : ''}>2-Vật nặng</option>
                  <option value="3-Xe cộ" ${editingRecord?.issueType === '3-Xe cộ' ? 'selected' : ''}>3-Xe cộ</option>
                  <option value="4-Rơi,ngã" ${editingRecord?.issueType === '4-Rơi,ngã' ? 'selected' : ''}>4-Rơi, ngã</option>
                  <option value="5-Điện giật" ${editingRecord?.issueType === '5-Điện giật' ? 'selected' : ''}>5-Điện giật</option>
                  <option value="6-Cháy nổ" ${editingRecord?.issueType === '6-Cháy nổ' ? 'selected' : ''}>6-Cháy nổ</option>
                  <option value="7-Loại khác" ${editingRecord?.issueType === '7-Loại khác' ? 'selected' : ''}>7-Loại khác</option>
                </select>
                <i class="fa-solid fa-chevron-down select-chevron"></i>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Cấp bậc nguy cơ</label>
              <div class="select-wrapper">
                <select id="mobileSafetyLevel" class="form-control form-select">
                  <option value="" ${!editingRecord?.issueLevel ? 'selected' : ''}>Chưa phân loại</option>
                  <option value="A" ${editingRecord?.issueLevel === 'A' ? 'selected' : ''}>Cấp độ A (Nghiêm trọng)</option>
                  <option value="B" ${editingRecord?.issueLevel === 'B' ? 'selected' : ''}>Cấp độ B</option>
                  <option value="C" ${editingRecord?.issueLevel === 'C' ? 'selected' : ''}>Cấp độ C (Nhẹ)</option>
                </select>
                <i class="fa-solid fa-chevron-down select-chevron"></i>
              </div>
            </div>
          </div>

          <!-- Row 5: Kênh phát hiện & Tình trạng -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Phát hiện bởi (kênh)</label>
              <div class="select-wrapper">
                <select id="mobileSafetyFoundChannel" class="form-control form-select">
                  <option value="worker" ${editingRecord?.foundChannel === 'worker' ? 'selected' : ''}>Công nhân</option>
                  <option value="head" ${editingRecord?.foundChannel === 'head' ? 'selected' : ''}>Trưởng bộ phận</option>
                  <option value="assessor" ${editingRecord?.foundChannel === 'assessor' || (!editingRecord && true) ? 'selected' : ''}>Assessor</option>
                </select>
                <i class="fa-solid fa-chevron-down select-chevron"></i>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Tình trạng</label>
              <div class="select-wrapper">
                <select id="mobileSafetyIssueStatus" class="form-control form-select">
                  <option value="open" ${editingRecord?.issueStatus === 'open' || (!editingRecord && true) ? 'selected' : ''}>Chưa xử lý</option>
                  <option value="in_progress" ${editingRecord?.issueStatus === 'in_progress' ? 'selected' : ''}>Đang xử lý</option>
                  <option value="overdue" ${editingRecord?.issueStatus === 'overdue' ? 'selected' : ''}>Quá hạn</option>
                  <option value="closed" ${editingRecord?.issueStatus === 'closed' ? 'selected' : ''}>Đã khắc phục</option>
                </select>
                <i class="fa-solid fa-chevron-down select-chevron"></i>
              </div>
            </div>
          </div>

          <!-- Row 6: Tên người phát hiện & Mã nhân viên -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Tên người phát hiện</label>
              <input type="text" id="mobileSafetyIssueFoundBy" class="form-control" placeholder="Ghi rõ tên người phát hiện..." value="${escapeHtml(defaultFinder)}">
            </div>
            <div class="form-group">
              <label class="form-label">Mã nhân viên</label>
              <input type="text" id="mobileSafetyEmployeeCode" class="form-control" placeholder="Mã NV (nếu có)..." value="${escapeHtml(editingRecord?.employeeCode || '')}">
            </div>
          </div>

          <!-- Row 7: Hạng mục -->
          <div class="form-group">
            <label class="form-label">Hạng mục</label>
            <input type="text" id="mobileSafetyIssueItemLabel" class="form-control" placeholder="Hạng mục..." value="${escapeHtml(editingRecord?.issueItemLabel || 'Nhận diện nguy cơ mất an toàn')}">
          </div>

          <!-- Row 8: Nội dung cải tiến, xử lý -->
          <div class="form-group">
            <label class="form-label">Nội dung cải tiến, xử lý</label>
            <textarea id="mobileSafetyImprovementContent" rows="2"
              placeholder="Giải pháp / biện pháp xử lý hoặc đối sách..."
              class="form-control form-textarea">${escapeHtml(editingRecord?.improvementContent || '')}</textarea>
          </div>

          <!-- Row 9: Ảnh sau cải tiến -->
          <div class="form-group">
            <label class="form-label">Ảnh sau cải tiến (nếu có)</label>
            <div id="mobilePhotoAfterUploadBox" class="photo-upload-box">
              <input type="file" id="mobileSafetyAfterFileInput" accept="image/*" capture="environment" class="photo-file-input">
              
              <div id="photoAfterPlaceholder" class="photo-placeholder ${uploadedSafetyAfterPhotoData ? 'is-hidden' : ''}">
                <div class="photo-icon-circle">
                  <i class="fa-solid fa-image"></i>
                </div>
                <p class="photo-primary-prompt">Chụp / Đính kèm ảnh sau cải tiến</p>
                <div class="photo-action-chip">
                  <i class="fa-solid fa-plus"></i> Tải ảnh đối sách
                </div>
              </div>

              <div id="photoAfterPreviewWrap" class="photo-preview-wrap ${uploadedSafetyAfterPhotoData ? '' : 'is-hidden'}">
                <img id="mobileSafetyAfterPreviewImg" src="${uploadedSafetyAfterPhotoData || ''}" alt="Ảnh sau cải tiến" class="photo-preview-img cursor-pointer" data-preview-img="${uploadedSafetyAfterPhotoData || ''}" title="Chạm để phóng to ảnh">
                <div class="photo-preview-actions">
                  <button type="button" id="mobileRetakeAfterPhotoBtn" class="photo-btn retake-btn" title="Đổi ảnh">
                    <i class="fa-solid fa-arrows-rotate"></i>
                  </button>
                  <button type="button" id="mobileRemoveAfterPhotoBtn" class="photo-btn delete-btn" title="Xóa ảnh này">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
                <div class="photo-attached-badge">
                  <i class="fa-solid fa-circle-check"></i> Đã đính kèm ảnh sau cải tiến
                </div>
              </div>
            </div>
          </div>

          <!-- Row 10: Đảm nhiệm & Kế hoạch -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Đảm nhiệm (PIC)</label>
              <input type="text" id="mobileSafetyActionOwner" class="form-control" placeholder="Người chịu trách nhiệm..." value="${escapeHtml(editingRecord?.actionOwner || defaultActionOwner)}">
            </div>
            <div class="form-group">
              <label class="form-label">Kế hoạch</label>
              <input type="text" id="mobileSafetyActionPlan" class="form-control" placeholder="Kế hoạch hoàn thành..." value="${escapeHtml(editingRecord?.actionPlan || '')}">
            </div>
          </div>

          <!-- Row 11: Ngày hoàn thành -->
          <div class="form-group">
            <label class="form-label">Ngày hoàn thành</label>
            <div class="date-input-container">
              <input type="text" id="mobileSafetyCompletionDateDisplay" class="form-control date-custom-input" placeholder="dd/mm/yyyy" value="${formatIsoToVnDate(editingRecord?.completionDate ? editingRecord.completionDate.split('T')[0] : todayValue)}" readonly>
              <input type="date" id="mobileSafetyCompletionDate" class="native-hidden-date-input" value="${escapeHtml(editingRecord?.completionDate ? editingRecord.completionDate.split('T')[0] : todayValue)}">
              <button type="button" class="btn-calendar-trigger" tabindex="-1">
                <i class="fa-solid fa-calendar-days text-white"></i>
              </button>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="form-submit-row">
            <button type="submit" id="mobileSubmitSafetyBtn" class="btn-primary-gradient">
              <i class="fa-solid ${editingRecord ? 'fa-floppy-disk' : 'fa-paper-plane'}"></i>
              <span>${editingRecord ? 'CẬP NHẬT BÁO CÁO AN TOÀN' : 'LƯU BÁO CÁO AN TOÀN'}</span>
            </button>
          </div>
        </form>
        `}

        <!-- Recent Uploads History List -->
        <div class="mobile-history-section">
          <div class="history-section-header">
            <h3 class="history-section-title">Danh sách mối nguy đã ghi nhận</h3>
            <span class="history-count-badge">${recentRecords.length} Mối nguy</span>
          </div>

          <div class="history-cards-list">
            ${recentRecords.length === 0 ? `
              <div class="history-empty-card">
                <i class="fa-solid fa-shield-check text-slate-500 text-2xl mb-1"></i>
                <p>Chưa có báo cáo mối nguy nào được ghi nhận trong kỳ này.</p>
              </div>
            ` : recentRecords.map((item) => {
              const itemArea = reportableAreas.find((a) => a.id === item.areaId) || allSafetyAreas.find((a) => a.id === item.areaId);
              const zoneLabel = itemArea ? `Zone ${itemArea.code}` : (item.issueLocation || "Zone");
              const statusText = item.issueStatus === "closed" ? "Đã khắc phục" : item.issueStatus === "in_progress" ? "Đang xử lý" : item.issueStatus === "overdue" ? "Quá hạn" : "Chưa xử lý";
              const statusClass = item.issueStatus === "closed" ? "status-closed" : item.issueStatus === "in_progress" ? "status-progress" : item.issueStatus === "overdue" ? "status-overdue" : "status-open";
              const photoThumb = item.photoDataUrl || "images/Logo.jpg";
              const hasPhoto = Boolean(item.photoDataUrl);
              const hasAfterPhoto = Boolean(item.afterPhotoDataUrl);
              const rawLevel = item.issueLevel || item.level || item.riskLevel || "";
              const issueLevel = String(rawLevel).trim().toUpperCase();
              const levelBadgeClass = issueLevel === "A" ? "pill-level-a" : issueLevel === "B" ? "pill-level-b" : issueLevel === "C" ? "pill-level-c" : "pill-level-none";
              const levelBadgeText = issueLevel ? (issueLevel.startsWith("CẤP") ? issueLevel : `Cấp ${issueLevel}`) : "Chưa phân loại";

              const rawStop6 = item.issueType || item.stop6 || item.stop_6 || item.issue_type || "";
              const stop6Text = String(rawStop6).trim();

              const itemDate = item.issueDay && item.issueMonth
                ? `${String(item.issueDay).padStart(2, '0')}/${String(item.issueMonth).padStart(2, '0')}`
                : (item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("vi-VN") : dateStr);

              return `
                <div class="history-card ${editingSafetyRecordId === item.id ? 'is-editing' : ''}" data-action="open-safety-card-detail" data-id="${item.id}" title="Chạm để xem chi tiết, sửa hoặc xóa">
                  <img src="${photoThumb}" alt="Thumb" class="history-card-thumb ${hasPhoto ? 'cursor-pointer' : ''}" ${hasPhoto ? `data-preview-img="${photoThumb}" title="Chạm 1 lần để xem ảnh lớn"` : ''} onerror="this.src='images/Logo.jpg'">
                  <div class="history-card-body">
                    <div class="history-card-top">
                      <span class="history-zone-chip">${escapeHtml(zoneLabel)}</span>
                      <span class="history-status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <p class="history-hazard-text">${escapeHtml(item.note || "Mối nguy không có mô tả")}</p>
                    <div class="history-meta-row">
                      <span class="history-date-text"><i class="fa-regular fa-clock"></i> ${escapeHtml(itemDate)}</span>
                      <span class="history-pill ${levelBadgeClass}">${escapeHtml(levelBadgeText)}</span>
                      ${stop6Text ? `<span class="history-pill pill-stop6"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(stop6Text)}</span>` : ''}
                    </div>
                    ${item.improvementContent ? `
                      <div class="history-countermeasure-note">
                        <i class="fa-solid fa-wrench"></i> ${escapeHtml(item.improvementContent)}
                      </div>
                    ` : ''}
                    ${hasAfterPhoto ? `
                      <div class="history-after-photo-tag">
                        <img src="${item.afterPhotoDataUrl}" class="after-photo-mini cursor-pointer" data-preview-img="${item.afterPhotoDataUrl}" title="Ảnh sau cải tiến (chạm để phóng to)">
                        <span>Ảnh sau cải tiến</span>
                      </div>
                    ` : ''}
                  </div>
                  <div class="history-card-chevron">
                    <i class="fa-solid fa-chevron-right"></i>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

      </div>
    `;

    // Wire up events inside Safety form
    wireSafetyEvents(screen, context, safetyPeriodId, overlay);
  }

  function wireSafetyEvents(screen, context, safetyPeriodId, overlay) {
    const user = context?.currentUser;
    const defaultActionOwner = context?.getAccountDisplayName?.(user, context.SAFETY_PERIOD_TYPE, safetyPeriodId) || user?.name || user?.username || "";
    const todayValue = typeof context?.todayIsoDate === "function" ? context.todayIsoDate() : new Date().toISOString().slice(0, 10);

    // Cancel Edit button
    const cancelEditBtn = screen.querySelector("#cancelEditSafetyBtn");
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener("click", () => {
        editingSafetyRecordId = "";
        uploadedSafetyPhotoData = "";
        uploadedSafetyAfterPhotoData = "";
        renderSafetyScreen(overlay, context);
      });
    }

    // Photo 1 (Hiện trường)
    const fileInput = screen.querySelector("#mobileSafetyFileInput");
    const previewWrap = screen.querySelector("#photoPreviewWrap");
    const placeholder = screen.querySelector("#photoPlaceholder");
    const previewImg = screen.querySelector("#mobileSafetyPreviewImg");

    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            uploadedSafetyPhotoData = ev.target.result;
            if (previewImg) {
              previewImg.src = uploadedSafetyPhotoData;
              previewImg.dataset.previewImg = uploadedSafetyPhotoData;
            }
            placeholder?.classList.add("is-hidden");
            previewWrap?.classList.remove("is-hidden");
          };
          reader.readAsDataURL(file);
        }
      });
    }

    const retakeBtn = screen.querySelector("#mobileRetakePhotoBtn");
    if (retakeBtn && fileInput) {
      retakeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
      });
    }

    const removeBtn = screen.querySelector("#mobileRemovePhotoBtn");
    if (removeBtn && fileInput) {
      removeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadedSafetyPhotoData = "";
        fileInput.value = "";
        previewWrap?.classList.add("is-hidden");
        placeholder?.classList.remove("is-hidden");
      });
    }

    // Photo 2 (Sau cải tiến)
    const afterFileInput = screen.querySelector("#mobileSafetyAfterFileInput");
    const afterPreviewWrap = screen.querySelector("#photoAfterPreviewWrap");
    const afterPlaceholder = screen.querySelector("#photoAfterPlaceholder");
    const afterPreviewImg = screen.querySelector("#mobileSafetyAfterPreviewImg");

    if (afterFileInput) {
      afterFileInput.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            uploadedSafetyAfterPhotoData = ev.target.result;
            if (afterPreviewImg) {
              afterPreviewImg.src = uploadedSafetyAfterPhotoData;
              afterPreviewImg.dataset.previewImg = uploadedSafetyAfterPhotoData;
            }
            afterPlaceholder?.classList.add("is-hidden");
            afterPreviewWrap?.classList.remove("is-hidden");
          };
          reader.readAsDataURL(file);
        }
      });
    }

    const retakeAfterBtn = screen.querySelector("#mobileRetakeAfterPhotoBtn");
    if (retakeAfterBtn && afterFileInput) {
      retakeAfterBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        afterFileInput.click();
      });
    }

    const removeAfterBtn = screen.querySelector("#mobileRemoveAfterPhotoBtn");
    if (removeAfterBtn && afterFileInput) {
      removeAfterBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadedSafetyAfterPhotoData = "";
        afterFileInput.value = "";
        afterPreviewWrap?.classList.add("is-hidden");
        afterPlaceholder?.classList.remove("is-hidden");
      });
    }

    // Wire date picker change sync to display inputs (dd/mm/yyyy)
    screen.querySelectorAll(".date-input-container").forEach((wrap) => {
      const nativeDate = wrap.querySelector(".native-hidden-date-input");
      const displayInput = wrap.querySelector(".date-custom-input");
      if (!nativeDate || !displayInput) return;

      nativeDate.addEventListener("change", () => {
        displayInput.value = formatIsoToVnDate(nativeDate.value);
      });
      nativeDate.addEventListener("input", () => {
        displayInput.value = formatIsoToVnDate(nativeDate.value);
      });

      wrap.addEventListener("click", () => {
        try {
          if (typeof nativeDate.showPicker === "function") {
            nativeDate.showPicker();
          }
        } catch (_) {}
      });
    });

    // Image 1-tap quick preview (lightbox)
    screen.querySelectorAll("[data-preview-img]").forEach((imgEl) => {
      imgEl.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const src = imgEl.dataset.previewImg || imgEl.src;
        if (src && src !== "images/Logo.jpg") {
          openMobileImageModal(src, "Ảnh minh họa");
        }
      });
    });

    // Card click: open detail modal (where user can view full info, Edit, or Delete)
    screen.querySelectorAll('.history-card[data-action="open-safety-card-detail"]').forEach((card) => {
      card.addEventListener("click", (e) => {
        // If user tapped directly on an image thumbnail, don't trigger modal (preview lightbox handles it)
        if (e.target.closest("[data-preview-img]")) {
          return;
        }
        const recordId = card.dataset.id;
        const allRecords = context?.state?.safetyRecords || [];
        const record = allRecords.find((r) => r.id === recordId);
        if (record) {
          openSafetyDetailModal(record, overlay, context);
        }
      });
    });

    // Form submit handler
    const form = screen.querySelector("#mobileSafetyForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!checkSafetyPermission(context)) {
          showMobileToast("Tài khoản của bạn không có quyền đánh giá An toàn!", true);
          return;
        }
        const areaId = screen.querySelector("#mobileSafetyZoneSelect")?.value;
        const desc = screen.querySelector("#mobileSafetyDescription")?.value?.trim();
        const issueDate = screen.querySelector("#mobileSafetyIssueDate")?.value || "";
        const stop6 = screen.querySelector("#mobileSafetyStop6")?.value || "";
        const level = screen.querySelector("#mobileSafetyLevel")?.value || "";
        const foundChannel = screen.querySelector("#mobileSafetyFoundChannel")?.value || "worker";
        const issueStatus = screen.querySelector("#mobileSafetyIssueStatus")?.value || "open";
        const issueFoundBy = screen.querySelector("#mobileSafetyIssueFoundBy")?.value?.trim() || "";
        const employeeCode = screen.querySelector("#mobileSafetyEmployeeCode")?.value?.trim() || "";
        const issueItemLabel = screen.querySelector("#mobileSafetyIssueItemLabel")?.value?.trim() || "Nhận diện nguy cơ mất an toàn";
        const improvementContent = screen.querySelector("#mobileSafetyImprovementContent")?.value?.trim() || "";
        const actionOwner = screen.querySelector("#mobileSafetyActionOwner")?.value?.trim() || defaultActionOwner;
        const actionPlan = screen.querySelector("#mobileSafetyActionPlan")?.value?.trim() || "";
        const completionDate = screen.querySelector("#mobileSafetyCompletionDate")?.value || todayValue;

        if (!areaId) {
          showMobileToast("Vui lòng chọn Khu vực / Zone!", true);
          return;
        }
        if (!desc) {
          showMobileToast("Vui lòng nhập mô tả Mối nguy hiểm phát hiện được!", true);
          return;
        }

        const now = new Date();
        const user = context?.currentUser;
        const area = context?.getAreasForPeriod?.(safetyPeriodId)?.find((a) => a.id === areaId);

        let finalPhotoDataUrl = uploadedSafetyPhotoData;
        let finalPhotoName = "anh-moi-nguy.jpg";
        const file = fileInput?.files?.[0];
        if (file && typeof context?.prepareScorePhoto === "function") {
          try {
            const prepared = await context.prepareScorePhoto(file, null, false, safetyPeriodId);
            finalPhotoDataUrl = prepared.photoDataUrl || finalPhotoDataUrl;
            finalPhotoName = prepared.photoName || finalPhotoName;
          } catch (_) {}
        }

        let finalAfterPhotoDataUrl = uploadedSafetyAfterPhotoData;
        let finalAfterPhotoName = "anh-sau-cai-tien.jpg";
        const afterFile = afterFileInput?.files?.[0];
        if (afterFile && typeof context?.prepareScorePhoto === "function") {
          try {
            const preparedAfter = await context.prepareScorePhoto(afterFile, null, false, safetyPeriodId);
            finalAfterPhotoDataUrl = preparedAfter.photoDataUrl || finalAfterPhotoDataUrl;
            finalAfterPhotoName = preparedAfter.photoName || finalAfterPhotoName;
          } catch (_) {}
        }

        const dateParts = issueDate ? issueDate.split("-") : [String(now.getFullYear()), String(now.getMonth() + 1), String(now.getDate())];
        const issueYear = dateParts[0] || String(now.getFullYear());
        const issueMonth = String(Number(dateParts[1]) || now.getMonth() + 1);
        const issueDay = String(Number(dateParts[2]) || now.getDate());

        const isEditing = Boolean(editingSafetyRecordId);
        const existingRecord = isEditing ? (context?.state?.safetyRecords || []).find((r) => r.id === editingSafetyRecordId) : null;
        const targetId = isEditing ? editingSafetyRecordId : (context?.makeId ? context.makeId("safety") : `safety-${Date.now()}`);
        const ownerUsername = user?.username || "assessor";
        const ownerName = issueFoundBy || context?.getAccountDisplayName?.(user, context.SAFETY_PERIOD_TYPE, safetyPeriodId) || user?.name || ownerUsername;

        const payload = {
          ...(existingRecord || {}),
          id: targetId,
          periodId: safetyPeriodId,
          areaId: areaId,
          issueLocation: area ? `Zone ${area.code}` : "Zone",
          issueDay,
          issueMonth,
          note: desc,
          photoDataUrl: finalPhotoDataUrl,
          photoName: finalPhotoName,
          issueCount: existingRecord?.issueCount || 1,
          issueType: stop6,
          issueLevel: level,
          issueStatus,
          issueFoundBy: ownerName,
          employeeCode,
          issueItemLabel,
          foundChannel,
          improvementContent,
          afterPhotoDataUrl: finalAfterPhotoDataUrl,
          afterPhotoName: finalAfterPhotoName,
          actionOwner,
          actionPlan,
          completionDate,
          completionLevelConfirm: context?.getSafetyLevelConfirm?.({ issueLevel: level }) || "",
          completionStop6Confirm: context?.getSafetyStop6Confirm?.({ issueType: stop6 }) || "",
          scorerName: existingRecord?.scorerName || ownerName,
          accountUsername: existingRecord?.accountUsername || ownerUsername,
          createdBy: existingRecord?.createdBy || ownerUsername,
          createdAt: existingRecord?.createdAt || now.toISOString(),
          updatedAt: now.toISOString(),
        };

        try {
          if (context?.state?.safetyRecords) {
            const idx = context.state.safetyRecords.findIndex((r) => r.id === targetId);
            if (idx >= 0) {
              context.state.safetyRecords[idx] = payload;
            } else {
              context.state.safetyRecords.unshift(payload);
            }
          }
          if (typeof context?.saveSafetyRecord === "function") {
            await context.saveSafetyRecord(payload);
          }

          // Reset form & state
          editingSafetyRecordId = "";
          uploadedSafetyPhotoData = "";
          uploadedSafetyAfterPhotoData = "";
          if (fileInput) fileInput.value = "";
          if (afterFileInput) afterFileInput.value = "";

          showMobileToast(isEditing ? "Đã cập nhật báo cáo an toàn!" : "Đã lưu báo cáo an toàn thành công!");
          renderSafetyScreen(overlay, context);
        } catch (err) {
          console.error("Lỗi khi lưu báo cáo an toàn:", err);
          showMobileToast("Lỗi khi lưu: " + (err.message || err), true);
        }
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN 2: CHẤM ĐIỂM 5S (5S AUDIT SHEET WITH INLINE ALL 5 LEVELS)
  // ─────────────────────────────────────────────────────────────────────────────
  function renderFiveSScreen(overlay, context) {
    const screen = overlay.querySelector("#mobileScreen5S");
    if (!screen) return;

    const user = context?.currentUser;
    const isAdmin = typeof context?.isAdminAccount === "function" && context.isAdminAccount(user);
    const fiveSPeriodId = context?.getActivePeriodId?.(context.FIVE_S_PERIOD_TYPE) || "";
    const periodOpen = typeof context?.isPeriodOpen === "function"
      ? context.isPeriodOpen(fiveSPeriodId, context.FIVE_S_PERIOD_TYPE)
      : true;

    const allAreas = context ? context.getAreasForPeriod(fiveSPeriodId) : [];
    const allowedAreaIds = (user && !isAdmin && typeof context?.getAllowedAreaIds === "function")
      ? context.getAllowedAreaIds(user, fiveSPeriodId)
      : null;

    // Filter assigned areas for non-admin user
    const assignedAreas = allowedAreaIds ? allAreas.filter((a) => allowedAreaIds.has(a.id)) : allAreas;

    // Default zone selection
    if (assignedAreas.length > 0) {
      if (!currentFiveSZoneId || (allowedAreaIds && !allowedAreaIds.has(currentFiveSZoneId))) {
        currentFiveSZoneId = assignedAreas[0].id;
      }
    } else if (!currentFiveSZoneId && allAreas.length > 0) {
      currentFiveSZoneId = allAreas[0].id;
    }

    const selectedArea = allAreas.find((a) => a.id === currentFiveSZoneId) || assignedAreas[0] || allAreas[0] || null;
    const isAreaAllowed = !allowedAreaIds || (selectedArea && allowedAreaIds.has(selectedArea.id));
    const canEditScore = periodOpen && isAreaAllowed;

    const scoreSource = typeof context?.getScoreSourceForAccount === "function"
      ? context.getScoreSourceForAccount(user)
      : (context?.SCORE_SOURCE_ASSESSOR || "assessor");

    // Build flattened items list
    const flattenedCriteria = buildFlattened5SCriteria(context);

    // Calculate score statistics for selected area
    const stat = calculateArea5SScoreStat(selectedArea, flattenedCriteria, context, fiveSPeriodId, scoreSource);

    // Notice banner HTML
    let noticeBannerHtml = "";
    if (!periodOpen) {
      noticeBannerHtml = `
        <div class="fives-notice-banner warning">
          <i class="fa-solid fa-lock"></i>
          <span>Kỳ đánh giá 5S này hiện không mở. Bạn đang ở chế độ xem, không thể chấm điểm mới.</span>
        </div>
      `;
    } else if (allowedAreaIds && assignedAreas.length === 0) {
      noticeBannerHtml = `
        <div class="fives-notice-banner warning">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>Tài khoản của bạn chưa được phân quyền chấm điểm Zone nào trong kỳ này.</span>
        </div>
      `;
    } else if (!isAreaAllowed && selectedArea) {
      noticeBannerHtml = `
        <div class="fives-notice-banner info">
          <i class="fa-solid fa-eye"></i>
          <span>Bạn đang xem Zone ${escapeHtml(selectedArea.code)} ở chế độ chỉ xem. Chọn Zone có nhãn (✓ Được chấm) để chấm điểm.</span>
        </div>
      `;
    }

    screen.innerHTML = `
      <div class="mobile-fives-container">
        
        ${noticeBannerHtml}

        <!-- Sticky Header: Zone Selector & Live Scoring Progress -->
        <div class="fives-sticky-header">
          <div class="fives-header-top">
            <div class="fives-zone-picker">
              <span class="fives-zone-label">Khu vực kiểm tra</span>
              <div class="select-wrapper-inline">
                <select id="mobileAuditZoneSelect" class="fives-zone-select">
                  ${allAreas.map((area) => {
                    const isAllowed = !allowedAreaIds || allowedAreaIds.has(area.id);
                    const tag = allowedAreaIds ? (isAllowed ? "✓ " : "🔒 ") : "";
                    const resp = context?.getAreaResponsibleNameForPeriod?.(fiveSPeriodId, area) || "";
                    return `
                      <option value="${escapeHtml(area.id)}" ${area.id === currentFiveSZoneId ? 'selected' : ''}>
                        ${tag}Zone ${escapeHtml(area.code)} · ${escapeHtml(resp)}
                      </option>
                    `;
                  }).join("")}
                </select>
                <i class="fa-solid fa-chevron-down select-chevron-inline"></i>
              </div>
            </div>
            <div class="fives-progress-stat">
              <span class="fives-progress-label">Đã đánh giá</span>
              <strong id="evaluatedProgressText" class="fives-progress-val font-mono">${stat.completed} / ${stat.total} Hạng mục</strong>
            </div>
          </div>

          <!-- Overall Score Bar -->
          <div class="fives-score-metric-row">
            <div class="metric-text-row">
              <span class="metric-title">Điểm TB hiện tại:</span>
              <strong id="overallAvgScoreText" class="metric-score-val font-mono">${stat.avgText} / 5.0</strong>
            </div>
            <div class="metric-progress-track">
              <div id="scoreProgressBarFill" class="metric-progress-fill" style="width: ${stat.pct}%;"></div>
            </div>
          </div>
        </div>

        <!-- Instruction Tip -->
        <div class="fives-instruction-tip">
          <i class="fa-solid ${canEditScore ? 'fa-hand-pointer text-brand-400' : 'fa-lock text-amber-400'} text-xs"></i>
          <span>${canEditScore ? 'Chạm trực tiếp vào ô mô tả tiêu chí (Cấp 1 - Cấp 5) để chọn điểm đánh giá.' : 'Khu vực này ở chế độ chỉ xem.'}</span>
        </div>

        <!-- Section Navigation Filter Pills -->
        <div class="fives-section-nav">
          ${SECTION_FILTERS.map((filter) => `
            <button type="button" class="section-pill-btn ${activeSectionFilter === filter.id ? 'is-active' : ''}" data-section-filter="${filter.id}">
              ${filter.label}
            </button>
          `).join("")}
        </div>

        <!-- 5S Audit Category Items Card List -->
        <div class="fives-items-list" id="fivesItemsListContainer">
          ${render5SItemCards(selectedArea, flattenedCriteria, context, fiveSPeriodId, scoreSource)}
        </div>

      </div>
    `;

    // Wire up events inside 5S view
    wireFiveSEvents(screen, overlay, context, fiveSPeriodId, scoreSource);
  }

  // Build flattened criteria list matching standards.js
  function buildFlattened5SCriteria(context) {
    const standards = window.FIVE_S_STANDARDS || {};
    const criteriaList = [];

    // Define standard categories
    const categories = [
      {
        id: "a1",
        code: "A1",
        category: "Khu vực đường đi (A1)",
        title: "Đường đi bộ, cầu thang, hành lang, các đường border",
        section: "A",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "a2",
        code: "A2",
        category: "Cây nước (A2)",
        title: "Cốc uống & vỏ bình nước",
        section: "A",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "a3",
        code: "A3",
        category: "Khu rửa tay & Vệ sinh (A3)",
        title: "Bồn rửa, khăn lau tay, thiết bị vệ sinh",
        section: "A",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "b1",
        code: "B1",
        category: "Khu để dầu & Hóa chất (B1)",
        title: "Dầu mỡ, sơn, dung môi hóa chất các loại",
        section: "B",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "b2",
        code: "B2",
        category: "Hàng lưu kho & Hàng lỗi (B2)",
        title: "Sản phẩm, thành phẩm, kho spare part, hàng lỗi",
        section: "B",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "b3",
        code: "B3",
        category: "Vật tư & Giẻ lau (B3)",
        title: "Nơi để vật tư, găng tay, giẻ lau dây chuyền",
        section: "B",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "c1",
        code: "C1",
        category: "Nơi làm việc (C1)",
        title: "Mặt sàn khu thao tác trong dây chuyền sản xuất",
        section: "C",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "c2",
        code: "C2",
        category: "Thiết bị & Máy móc (C2)",
        title: "Thiết bị, máy móc sản xuất và khu vực xung quanh",
        section: "C",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "c3",
        code: "C3",
        category: "Bàn thao tác & Dolly (C3)",
        title: "Bàn thao tác, bàn kiểm tra chất lượng, các loại dolly",
        section: "C",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "c4",
        code: "C4",
        category: "Đồ gá Jig & Dụng cụ (C4)",
        title: "Nơi để đồ gá, dưỡng jig, tool, tủ dụng cụ đo",
        section: "C",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "c5",
        code: "C5",
        category: "Bảng quản lý dây chuyền (C5)",
        title: "Bảng thông báo, check sheet, màn hình Andon",
        section: "C",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "d1",
        code: "D1",
        category: "Khu vực nghỉ (D1)",
        title: "Phòng nghỉ giải lao, bàn ghế, tủ để đồ",
        section: "D",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "d2",
        code: "D2",
        category: "Bàn quản lý GL (D2)",
        title: "Khu vực bàn làm việc của Group Leader",
        section: "D",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "d3",
        code: "D3",
        category: "Tư liệu & Bản vẽ (D3)",
        title: "Khu để tư liệu, tài liệu, tủ lưu bản vẽ kỹ thuật",
        section: "D",
        criteria: [
          { key: "phan-loai", phase: "Phân loại" },
          { key: "sap-xep", phase: "Sắp xếp" },
          { key: "lau-don", phase: "Lau dọn" },
        ],
      },
      {
        id: "e1",
        code: "E1",
        category: "Tự giác tổ viên (E1)",
        title: "Nhận thức và thực hiện 5S tự giác của tổ viên",
        section: "E",
        criteria: [
          { key: "diem", phase: "Đánh giá" },
        ],
      },
      {
        id: "e2",
        code: "E2",
        category: "Tự giác giám sát (E2)",
        title: "Sự chỉ đạo và tuân thủ 5S của người giám sát",
        section: "E",
        criteria: [
          { key: "diem", phase: "Đánh giá" },
        ],
      },
    ];

    categories.forEach((cat) => {
      cat.criteria.forEach((crit) => {
        const uniqueId = `${cat.id}_${crit.key}`;
        const levelTexts = standards[cat.id]?.[crit.key] || [];
        criteriaList.push({
          id: uniqueId,
          itemId: cat.id,
          criterionId: crit.key,
          code: cat.code,
          category: cat.category,
          title: cat.title,
          phase: crit.phase,
          section: cat.section,
          levels: {
            1: levelTexts[0] || "Tiêu chuẩn Cấp 1",
            2: levelTexts[1] || "Tiêu chuẩn Cấp 2",
            3: levelTexts[2] || "Tiêu chuẩn Cấp 3",
            4: levelTexts[3] || "Tiêu chuẩn Cấp 4",
            5: levelTexts[4] || "Tiêu chuẩn Cấp 5",
          },
        });
      });
    });

    return criteriaList;
  }

  // Calculate stats for selected area
  function calculateArea5SScoreStat(area, criteriaList, context, periodId, scoreSource) {
    if (!area) return { completed: 0, total: criteriaList.length, avgText: "--", pct: 0 };
    let totalScore = 0;
    let scoredCount = 0;
    let completedCount = 0;

    criteriaList.forEach((c) => {
      let scoreVal = null;
      let status = "";
      if (context && typeof context.getScoreRecord === "function") {
        const rec = context.getScoreRecord(periodId, area.id, c.itemId, c.criterionId, scoreSource);
        if (rec) {
          status = rec.status || "";
          if (Number.isFinite(rec.score)) {
            scoreVal = rec.score;
          }
        }
      }
      if (status === "na") {
        completedCount += 1;
      } else if (scoreVal !== null) {
        totalScore += scoreVal;
        scoredCount += 1;
        completedCount += 1;
      }
    });

    const avg = scoredCount > 0 ? (totalScore / scoredCount).toFixed(2) : "--";
    const pct = scoredCount > 0 ? Math.min(100, Math.round(((Number(avg) || 0) / 5) * 100)) : 0;

    return {
      completed: completedCount,
      total: criteriaList.length,
      avgText: avg,
      pct,
    };
  }

  // Render Single 5S Category Card
  function renderSingle5SCard(item, area, context, periodId, scoreSource) {
    let record = null;
    let currentScore = null;
    let isNa = false;
    if (context && typeof context.getScoreRecord === "function") {
      record = context.getScoreRecord(periodId, area.id, item.itemId, item.criterionId, scoreSource);
      if (record) {
        if (record.status === "na") {
          isNa = true;
        } else if (Number.isFinite(record.score)) {
          currentScore = record.score;
        }
      }
    }

    let scorePillClass = "text-slate-400";
    let scorePillText = "Chưa chấm";
    if (isNa) {
      scorePillClass = "text-slate-400 font-semibold";
      scorePillText = "Không cần chấm (✕)";
    } else if (currentScore !== null) {
      if (currentScore <= 2) {
        scorePillClass = "text-rose-400 font-bold";
        scorePillText = `Đã chọn: Cấp ${currentScore} (${LEVEL_NAMES[currentScore]})`;
      } else if (currentScore === 3) {
        scorePillClass = "text-amber-400 font-bold";
        scorePillText = `Đã chọn: Cấp ${currentScore} (${LEVEL_NAMES[currentScore]})`;
      } else {
        scorePillClass = "text-emerald-400 font-bold";
        scorePillText = `Đã chọn: Cấp ${currentScore} (${LEVEL_NAMES[currentScore]})`;
      }
    }

    return `
      <div class="fives-card" data-fives-item-id="${item.id}" data-item-raw-id="${item.itemId}" data-criterion-raw-id="${item.criterionId}">
        
        <!-- Card Header -->
        <div class="fives-card-header">
          <div>
            <span class="fives-card-category-badge">${escapeHtml(item.category)}</span>
            <h4 class="fives-card-title">${escapeHtml(item.title)}</h4>
          </div>
          <div class="fives-card-badges-right">
            <span class="fives-phase-badge">${escapeHtml(item.phase)}</span>
            <span class="fives-score-badge ${scorePillClass}">${scorePillText}</span>
          </div>
        </div>

        <!-- All 5 Inline Level Criteria Rows + Không cần chấm option -->
        <div class="fives-levels-stack">
          <span class="fives-levels-stack-title">Tiêu chuẩn cấp độ (Chạm để chọn / Chạm lại để hủy chọn):</span>
          
          <div class="levels-options-group">
            ${[1, 2, 3, 4, 5].map((lvl) => {
              const isSelected = !isNa && currentScore === lvl;
              const levelDesc = item.levels[lvl] || "Tiêu chuẩn Cấp " + lvl;
              let levelBoxClass = "level-unselected";
              let badgeClass = "badge-unselected";

              if (isSelected) {
                if (lvl <= 2) {
                  levelBoxClass = "level-selected-low";
                  badgeClass = "badge-selected-low";
                } else if (lvl === 3) {
                  levelBoxClass = "level-selected-mid";
                  badgeClass = "badge-selected-mid";
                } else {
                  levelBoxClass = "level-selected-high";
                  badgeClass = "badge-selected-high";
                }
              }

              return `
                <div class="fives-level-row ${levelBoxClass}" 
                     data-action-score="${lvl}"
                     data-item-id="${item.itemId}"
                     data-criterion-id="${item.criterionId}"
                     role="button"
                     tabindex="0">
                  
                  <div class="level-badge-wrap">
                    <span class="level-num-badge ${badgeClass}">${lvl}</span>
                  </div>

                  <div class="level-content-wrap">
                    <div class="level-title-line">
                      <span class="level-name-label">Cấp ${lvl} - ${LEVEL_NAMES[lvl]}</span>
                      ${isSelected ? `
                        <span class="level-chosen-tag ${lvl <= 2 ? 'tag-low' : lvl === 3 ? 'tag-mid' : 'tag-high'}">
                          <i class="fa-solid fa-circle-check"></i> Đã chọn
                        </span>
                      ` : ''}
                    </div>
                    <p class="level-desc-text ${isSelected ? 'is-selected-text' : ''}">${escapeHtml(levelDesc)}</p>
                  </div>

                </div>
              `;
            }).join("")}

            <!-- Không cần chấm (Gạch chéo) option -->
            <div class="fives-level-row level-na-row ${isNa ? 'level-selected-na' : 'level-unselected'}"
                 data-action-score="na"
                 data-item-id="${item.itemId}"
                 data-criterion-id="${item.criterionId}"
                 role="button"
                 tabindex="0">
              <div class="level-badge-wrap">
                <span class="level-num-badge ${isNa ? 'badge-selected-na' : 'badge-unselected'}">✕</span>
              </div>
              <div class="level-content-wrap">
                <div class="level-title-line">
                  <span class="level-name-label">Không cần chấm (Gạch chéo)</span>
                  ${isNa ? `
                    <span class="level-chosen-tag tag-na">
                      <i class="fa-solid fa-xmark"></i> Đã gạch chéo
                    </span>
                  ` : ''}
                </div>
                <p class="level-desc-text ${isNa ? 'is-selected-text' : ''}">Hạng mục này không áp dụng hoặc không cần đánh giá tại khu vực này.</p>
              </div>
            </div>

          </div>
        </div>

      </div>
    `;
  }

  // Render Category Item Cards
  function render5SItemCards(area, criteriaList, context, periodId, scoreSource) {
    if (!area) return '<div class="p-4 text-center text-slate-400 text-xs">Vui lòng chọn zone để đánh giá.</div>';

    const filtered = activeSectionFilter === "all"
      ? criteriaList
      : criteriaList.filter((c) => c.section === activeSectionFilter);

    return filtered.map((item) => renderSingle5SCard(item, area, context, periodId, scoreSource)).join("");
  }

  // Wire up 5S Events
  function wireFiveSEvents(screen, overlay, context, fiveSPeriodId, scoreSource) {
    // Zone Select Change
    const zoneSelect = screen.querySelector("#mobileAuditZoneSelect");
    if (zoneSelect) {
      zoneSelect.addEventListener("change", (e) => {
        currentFiveSZoneId = e.target.value;
        renderFiveSScreen(overlay, context);
      });
    }

    // Section Filter Pill click
    screen.querySelectorAll("[data-section-filter]").forEach((pill) => {
      pill.addEventListener("click", () => {
        activeSectionFilter = pill.dataset.sectionFilter;
        renderFiveSScreen(overlay, context);
      });
    });

    // Horizontal drag / swipe scroll for section filter pills
    const navContainer = screen.querySelector(".fives-section-nav");
    if (navContainer) {
      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;
      navContainer.addEventListener("mousedown", (e) => {
        isDown = true;
        startX = e.pageX - navContainer.offsetLeft;
        scrollLeft = navContainer.scrollLeft;
      });
      navContainer.addEventListener("mouseleave", () => { isDown = false; });
      navContainer.addEventListener("mouseup", () => { isDown = false; });
      navContainer.addEventListener("mousemove", (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - navContainer.offsetLeft;
        const walk = (x - startX) * 1.5;
        navContainer.scrollLeft = scrollLeft - walk;
      });
    }

    const selectedArea = context?.getAreasForPeriod?.(fiveSPeriodId)?.find((a) => a.id === currentFiveSZoneId);
    if (!selectedArea) return;

    const flattenedCriteria = buildFlattened5SCriteria(context);
    wireCardScoreClickHandlers(screen, overlay, context, fiveSPeriodId, scoreSource, selectedArea, flattenedCriteria);
  }

  // Attach score click handlers to a screen or individual card container
  function wireCardScoreClickHandlers(container, overlay, context, fiveSPeriodId, scoreSource, selectedArea, flattenedCriteria) {
    container.querySelectorAll("[data-action-score]").forEach((row) => {
      row.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const user = context?.currentUser;
        const isAdmin = typeof context?.isAdminAccount === "function" && context.isAdminAccount(user);
        const periodOpen = typeof context?.isPeriodOpen === "function"
          ? context.isPeriodOpen(fiveSPeriodId, context.FIVE_S_PERIOD_TYPE)
          : true;

        if (!periodOpen) {
          showMobileToast("Kỳ đánh giá 5S này hiện không mở, không thể chấm điểm!", true);
          return;
        }

        const allowedAreaIds = (user && !isAdmin && typeof context?.getAllowedAreaIds === "function")
          ? context.getAllowedAreaIds(user, fiveSPeriodId)
          : null;

        if (allowedAreaIds && selectedArea && !allowedAreaIds.has(selectedArea.id)) {
          showMobileToast(`Bạn không có quyền chấm điểm cho Zone ${selectedArea.code}! Hãy chọn Zone được phân công.`, true);
          return;
        }

        if (!checkFiveSPermission(context)) {
          showMobileToast("Tài khoản của bạn không có quyền chấm điểm 5S!", true);
          return;
        }

        if (typeof context?.canEditFiveSScoreSource === "function" && !context.canEditFiveSScoreSource(user, scoreSource)) {
          showMobileToast("Tài khoản của bạn không có quyền chỉnh sửa nguồn điểm này!", true);
          return;
        }

        const rawAction = row.dataset.actionScore;
        const itemId = row.dataset.itemId;
        const criterionId = row.dataset.criterionId;
        const item = context?.getItem?.(itemId) || { id: itemId, code: itemId.toUpperCase() };
        const criterion = context?.getCriterion?.(item, criterionId) || { id: criterionId, label: criterionId };
        
        const currentRec = context?.getScoreRecord?.(fiveSPeriodId, selectedArea.id, itemId, criterionId, scoreSource);
        const currentScore = currentRec && Number.isFinite(currentRec.score) ? currentRec.score : null;
        const currentStatus = currentRec?.status || "";

        let newScore = null;
        let newStatus = "";

        if (rawAction === "na") {
          if (currentStatus === "na") {
            newScore = null;
            newStatus = "";
          } else {
            newScore = null;
            newStatus = "na";
          }
        } else {
          const lvl = Number(rawAction);
          if (currentScore === lvl && currentStatus !== "na") {
            newScore = null;
            newStatus = "";
          } else {
            newScore = lvl;
            newStatus = "";
          }
        }

        try {
          // 1. INSTANT OPTIMISTIC UI UPDATE (0ms delay, ZERO layout reflow or frame jerk)
          const cardEl = row.closest(".fives-card");
          if (cardEl) {
            updateCardDOMDirectly(cardEl, newScore, newStatus);
          }

          // 2. Async save to database
          if (typeof context?.setScore === "function") {
            await context.setScore({
              periodId: fiveSPeriodId,
              area: selectedArea,
              item,
              criterion,
              score: newScore,
              status: newStatus,
              scoreSource,
            });
          }

          // 3. Update header statistics in-place
          const screen = overlay.querySelector("#mobileScreen5S");
          const stat = calculateArea5SScoreStat(selectedArea, flattenedCriteria, context, fiveSPeriodId, scoreSource);

          const progressValEl = screen?.querySelector("#evaluatedProgressText");
          if (progressValEl) progressValEl.textContent = `${stat.completed} / ${stat.total} Hạng mục`;

          const avgValEl = screen?.querySelector("#overallAvgScoreText");
          if (avgValEl) avgValEl.textContent = `${stat.avgText} / 5.0`;

          const fillBarEl = screen?.querySelector("#scoreProgressBarFill");
          if (fillBarEl) fillBarEl.style.width = `${stat.pct}%`;

        } catch (err) {
          console.error("Lỗi khi lưu điểm:", err);
          showMobileToast("Lỗi khi lưu điểm: " + (err.message || err), true);
        }
      });
    });
  }

  // Direct Optimistic DOM Mutation for 5S Category Card (0ms latency, ZERO DOM replacement, ZERO frame jerk)
  function updateCardDOMDirectly(cardEl, newScore, newStatus) {
    if (!cardEl) return;

    // 1. Update Score Badge at top right
    const scoreBadge = cardEl.querySelector(".fives-score-badge");
    if (scoreBadge) {
      if (newStatus === "na") {
        scoreBadge.className = "fives-score-badge text-slate-400 font-semibold";
        scoreBadge.textContent = "Không cần chấm (✕)";
      } else if (newScore !== null && Number.isFinite(newScore)) {
        const lvl = newScore;
        const levelName = LEVEL_NAMES[lvl] || ("Cấp " + lvl);
        let pillColor = lvl <= 2 ? "text-rose-400 font-bold" : (lvl === 3 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold");
        scoreBadge.className = "fives-score-badge " + pillColor;
        scoreBadge.textContent = `Đã chọn: Cấp ${lvl} (${levelName})`;
      } else {
        scoreBadge.className = "fives-score-badge text-slate-400";
        scoreBadge.textContent = "Chưa chấm";
      }
    }

    // 2. Update level rows inside card
    cardEl.querySelectorAll(".fives-level-row").forEach((rowEl) => {
      const actionScore = rowEl.dataset.actionScore;
      const numBadge = rowEl.querySelector(".level-num-badge");
      const titleLine = rowEl.querySelector(".level-title-line");
      const descText = rowEl.querySelector(".level-desc-text");

      const existingTag = titleLine ? titleLine.querySelector(".level-chosen-tag") : null;
      if (existingTag) existingTag.remove();

      if (actionScore === "na") {
        const isNaSelected = newStatus === "na";
        rowEl.className = "fives-level-row level-na-row " + (isNaSelected ? "level-selected-na" : "level-unselected");
        if (numBadge) numBadge.className = "level-num-badge " + (isNaSelected ? "badge-selected-na" : "badge-unselected");
        if (descText) descText.classList.toggle("is-selected-text", isNaSelected);
        if (isNaSelected && titleLine) {
          titleLine.insertAdjacentHTML("beforeend", '<span class="level-chosen-tag tag-na"><i class="fa-solid fa-xmark"></i> Đã gạch chéo</span>');
        }
      } else {
        const lvlNum = Number(actionScore);
        const isLvlSelected = newStatus !== "na" && newScore === lvlNum;
        let boxClass = "level-unselected";
        let badgeClass = "badge-unselected";
        let tagClass = "tag-high";

        if (isLvlSelected) {
          if (lvlNum <= 2) {
            boxClass = "level-selected-low";
            badgeClass = "badge-selected-low";
            tagClass = "tag-low";
          } else if (lvlNum === 3) {
            boxClass = "level-selected-mid";
            badgeClass = "badge-selected-mid";
            tagClass = "tag-mid";
          } else {
            boxClass = "level-selected-high";
            badgeClass = "badge-selected-high";
            tagClass = "tag-high";
          }
        }

        rowEl.className = "fives-level-row " + boxClass;
        if (numBadge) numBadge.className = "level-num-badge " + badgeClass;
        if (descText) descText.classList.toggle("is-selected-text", isLvlSelected);
        if (isLvlSelected && titleLine) {
          titleLine.insertAdjacentHTML("beforeend", `<span class="level-chosen-tag ${tagClass}"><i class="fa-solid fa-circle-check"></i> Đã chọn</span>`);
        }
      }
    });
  }

  // Toast Notification
  function showMobileToast(msg, isError = false) {
    const toast = document.getElementById("mobileToast");
    const toastText = document.getElementById("mobileToastText");
    if (!toast || !toastText) return;

    toastText.textContent = msg;
    toast.classList.toggle("is-error", Boolean(isError));
    toast.classList.add("is-visible");

    clearTimeout(toast.__timer);
    toast.__timer = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2800);
  }

  // Helper: Read file as data URL
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Helper: Escape HTML
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Expose methods globally
  window.openMobilePrototype = openMobilePrototype;
  window.closeMobilePrototype = closeMobilePrototype;
  window.showMobileToast = showMobileToast;
})();
