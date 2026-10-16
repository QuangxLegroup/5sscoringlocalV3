(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  function mountImageCircleAnnotator(stage, toolbarHost, options = {}) {
    if (!stage || !toolbarHost) return () => {};

    const image = stage.querySelector("img");
    if (!image) return () => {};

    const overlay = document.createElementNS(SVG_NS, "svg");
    overlay.classList.add("image-annotation-overlay");
    overlay.setAttribute("aria-label", "Các vùng đã khoanh tròn");
    stage.appendChild(overlay);

    const toolbar = document.createElement("div");
    toolbar.className = "image-annotation-toolbar";
    toolbar.innerHTML = `
      <div class="image-annotation-buttons" role="toolbar" aria-label="Đánh dấu ảnh an toàn">
        <button type="button" class="image-annotation-button image-annotation-pen" aria-pressed="false" title="Khoanh tròn vùng thiếu an toàn">
          <i class="fa-solid fa-pen"></i><span>Khoanh</span>
        </button>
        <button type="button" class="image-annotation-button image-annotation-eraser" aria-pressed="false" title="Chọn vòng tròn để xóa riêng" hidden>
          <i class="fa-solid fa-eraser"></i><span>Xóa từng vòng</span>
        </button>
        <button type="button" class="image-annotation-button image-annotation-undo" title="Xóa nét vừa thêm" hidden>
          <i class="fa-solid fa-rotate-left"></i><span>Bỏ nét</span>
        </button>
        <button type="button" class="image-annotation-button image-annotation-clear" title="Xóa tất cả nét" hidden>
          <i class="fa-solid fa-trash-can"></i><span>Xóa hết</span>
        </button>
      </div>
      <span class="image-annotation-hint" role="status" aria-live="polite"></span>
    `;
    toolbarHost.appendChild(toolbar);

    const penButton = toolbar.querySelector(".image-annotation-pen");
    const eraserButton = toolbar.querySelector(".image-annotation-eraser");
    const undoButton = toolbar.querySelector(".image-annotation-undo");
    const clearButton = toolbar.querySelector(".image-annotation-clear");
    const hint = toolbar.querySelector(".image-annotation-hint");
    const circles = (Array.isArray(options.initialCircles) ? options.initialCircles : []).flatMap((circle) => {
      const x = Number(circle?.x);
      const y = Number(circle?.y);
      const radius = Number(circle?.radius);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius <= 0) return [];
      return [{
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
        radius: Math.max(0, Math.min(2, radius)),
      }];
    });
    const canEdit = options.editable !== false && typeof options.onSave === "function";
    let mode = "view";
    let drawing = null;
    let revision = 0;
    let savedRevision = 0;
    let saveTimer = 0;
    let saveChain = Promise.resolve();
    let saveStatus = "";

    const imageSize = () => ({
      width: Math.max(1, stage.clientWidth),
      height: Math.max(1, stage.clientHeight),
    });

    const updateOverlaySize = () => {
      const { width, height } = imageSize();
      overlay.setAttribute("viewBox", `0 0 ${width} ${height}`);
      overlay.setAttribute("width", String(width));
      overlay.setAttribute("height", String(height));
      renderCircles();
    };

    const circleElement = (circle, index, isPreview = false) => {
      const { width, height } = imageSize();
      const element = document.createElementNS(SVG_NS, "circle");
      element.classList.add("image-annotation-circle");
      if (isPreview) element.classList.add("is-preview");
      if (mode === "erase" && !isPreview) element.classList.add("is-erasable");
      element.dataset.circleIndex = String(index);
      element.setAttribute("cx", String(circle.x * width));
      element.setAttribute("cy", String(circle.y * height));
      element.setAttribute("r", String(circle.radius * Math.min(width, height)));
      element.setAttribute("fill", "none");
      element.setAttribute("stroke", "#ff3b30");
      element.setAttribute("stroke-width", String(Math.max(3, Math.min(width, height) * 0.006)));
      element.setAttribute("vector-effect", "non-scaling-stroke");
      if (!isPreview) {
        element.setAttribute("role", "img");
        element.setAttribute("aria-label", `Vòng khoanh ${index + 1}`);
      }
      return element;
    };

    function renderCircles() {
      if (!overlay.isConnected) return;
      overlay.replaceChildren(...circles.map((circle, index) => circleElement(circle, index)));
      if (drawing) overlay.appendChild(circleElement(drawing, circles.length, true));
    }

    const updateControls = () => {
      const hasCircles = circles.length > 0;
      eraserButton.hidden = !hasCircles;
      undoButton.hidden = !hasCircles;
      clearButton.hidden = !hasCircles;
      penButton.classList.toggle("is-active", mode === "draw");
      eraserButton.classList.toggle("is-active", mode === "erase");
      penButton.setAttribute("aria-pressed", String(mode === "draw"));
      eraserButton.setAttribute("aria-pressed", String(mode === "erase"));
      overlay.classList.toggle("is-drawing", mode === "draw");
      overlay.classList.toggle("is-erasing", mode === "erase");
      toolbar.classList.toggle("has-annotations", hasCircles);
      hint.textContent = mode === "draw"
        ? "Kéo từ tâm ra mép để khoanh tròn."
        : mode === "erase"
          ? "Chạm vào vòng muốn xóa."
          : saveStatus || (!canEdit
            ? "Chỉ xem — tài khoản này không thể lưu nét trên ảnh."
            : hasCircles
              ? `${circles.length} vòng đã khoanh · có thể xóa từng vòng hoặc xóa hết.`
              : "Ảnh gốc không bị thay đổi.");
      penButton.disabled = !canEdit;
      eraserButton.disabled = !canEdit;
      renderCircles();
    };

    const setMode = (nextMode) => {
      if (!canEdit) return;
      mode = mode === nextMode ? "view" : nextMode;
      drawing = null;
      updateControls();
    };

    const saveSnapshot = (snapshot, snapshotRevision) => {
      if (!canEdit || snapshotRevision <= savedRevision) return saveChain;
      saveChain = saveChain.catch(() => {}).then(() => options.onSave(snapshot));
      const currentSave = saveChain;
      return currentSave.then(() => {
        savedRevision = Math.max(savedRevision, snapshotRevision);
        if (revision === snapshotRevision) {
          saveStatus = "Đã tự động lưu nét khoanh.";
          updateControls();
          window.setTimeout(() => {
            if (saveStatus === "Đã tự động lưu nét khoanh.") {
              saveStatus = "";
              updateControls();
            }
          }, 1800);
        }
      });
    };

    const scheduleSave = () => {
      if (!canEdit) return;
      revision += 1;
      saveStatus = "Đang lưu nét khoanh…";
      updateControls();
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        saveTimer = 0;
        const snapshot = circles.map((circle) => ({ ...circle }));
        saveSnapshot(snapshot, revision).catch((error) => {
          saveStatus = "Chưa lưu được. Hãy thử lại hoặc đóng ảnh sau khi kết nối lại.";
          updateControls();
          options.onError?.(error);
        });
      }, 300);
    };

    penButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setMode("draw");
    });
    eraserButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setMode("erase");
    });
    undoButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (circles.pop()) scheduleSave();
      updateControls();
    });
    clearButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!circles.length) return;
      circles.splice(0, circles.length);
      drawing = null;
      mode = "view";
      scheduleSave();
      updateControls();
    });

    toolbar.addEventListener("click", (event) => event.stopPropagation());
    stage.addEventListener("click", (event) => event.stopPropagation());

    overlay.addEventListener("pointerdown", (event) => {
      if (mode === "erase") {
        const circleElementTarget = event.target.closest?.("circle[data-circle-index]");
        if (circleElementTarget) {
          event.preventDefault();
          event.stopPropagation();
          circles.splice(Number(circleElementTarget.dataset.circleIndex), 1);
          scheduleSave();
          updateControls();
        }
        return;
      }
      if (!canEdit || mode !== "draw" || event.button > 0) return;
      event.preventDefault();
      event.stopPropagation();
      overlay.setPointerCapture?.(event.pointerId);
      const bounds = overlay.getBoundingClientRect();
      const { width, height } = imageSize();
      const x = Math.max(0, Math.min(width, event.clientX - bounds.left));
      const y = Math.max(0, Math.min(height, event.clientY - bounds.top));
      drawing = { x: x / width, y: y / height, radius: 0 };
      renderCircles();
    });

    overlay.addEventListener("pointermove", (event) => {
      if (!canEdit || mode !== "draw" || !drawing) return;
      event.preventDefault();
      const bounds = overlay.getBoundingClientRect();
      const { width, height } = imageSize();
      const dx = event.clientX - bounds.left - drawing.x * width;
      const dy = event.clientY - bounds.top - drawing.y * height;
      drawing.radius = Math.hypot(dx, dy) / Math.min(width, height);
      renderCircles();
    });

    const finishDrawing = (event) => {
      if (mode !== "draw" || !drawing) return;
      event.preventDefault();
      event.stopPropagation();
      if (drawing.radius >= 0.012) {
        circles.push(drawing);
        scheduleSave();
      }
      drawing = null;
      updateControls();
    };
    overlay.addEventListener("pointerup", finishDrawing);
    overlay.addEventListener("pointercancel", finishDrawing);

    const resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(updateOverlaySize)
      : null;
    resizeObserver?.observe(image);
    window.addEventListener("resize", updateOverlaySize);
    if (image.complete) updateOverlaySize();
    else image.addEventListener("load", updateOverlaySize, { once: true });
    updateControls();

    return async () => {
      window.clearTimeout(saveTimer);
      saveTimer = 0;
      if (revision > savedRevision) {
        await saveSnapshot(circles.map((circle) => ({ ...circle })), revision);
      } else {
        await saveChain;
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateOverlaySize);
      toolbar.remove();
      overlay.remove();
    };
  }

  function normalizeCircles(value) {
    let circles = value;
    if (typeof circles === "string") {
      try { circles = JSON.parse(circles); } catch (_) { circles = []; }
    }
    if (!Array.isArray(circles)) return [];
    return circles.flatMap((circle) => {
      const x = Number(circle?.x);
      const y = Number(circle?.y);
      const radius = Number(circle?.radius);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius <= 0) return [];
      return [{ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), radius: Math.max(0, Math.min(2, radius)) }];
    });
  }

  function refreshSafetyPhotoAnnotationThumbnail(image, annotations = image?.dataset?.safetyAnnotations) {
    if (!(image instanceof HTMLImageElement) || !image.matches("[data-safety-annotations]")) return;
    const parent = image.parentElement;
    let wrapper = parent?.classList.contains("safety-photo-thumb-wrap") ? parent : null;
    if (!wrapper) {
      wrapper = document.createElement("span");
      wrapper.className = "safety-photo-thumb-wrap";
      image.parentNode?.insertBefore(wrapper, image);
      wrapper.appendChild(image);
    }
    let overlay = wrapper.querySelector("svg.safety-photo-thumb-overlay");
    if (!overlay) {
      overlay = document.createElementNS(SVG_NS, "svg");
      overlay.classList.add("safety-photo-thumb-overlay");
      overlay.setAttribute("aria-hidden", "true");
      overlay.setAttribute("preserveAspectRatio", "xMidYMid slice");
      wrapper.appendChild(overlay);
    }
    const render = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) return;
      overlay.setAttribute("viewBox", `0 0 ${width} ${height}`);
      overlay.replaceChildren(...normalizeCircles(annotations).map((circle) => {
        const element = document.createElementNS(SVG_NS, "circle");
        element.setAttribute("cx", String(circle.x * width));
        element.setAttribute("cy", String(circle.y * height));
        element.setAttribute("r", String(circle.radius * Math.min(width, height)));
        element.setAttribute("fill", "none");
        element.setAttribute("stroke", "#ff3b30");
        element.setAttribute("stroke-width", "2");
        element.setAttribute("vector-effect", "non-scaling-stroke");
        return element;
      }));
    };
    if (image.complete) render();
    else image.addEventListener("load", render, { once: true });
  }

  function mountSafetyPhotoAnnotationThumbnails(root = document) {
    if (root.matches?.("img[data-safety-annotations]")) refreshSafetyPhotoAnnotationThumbnail(root);
    root.querySelectorAll?.("img[data-safety-annotations]").forEach((image) => refreshSafetyPhotoAnnotationThumbnail(image));
  }

  window.mountImageCircleAnnotator = mountImageCircleAnnotator;
  window.refreshSafetyPhotoAnnotationThumbnail = refreshSafetyPhotoAnnotationThumbnail;
  mountSafetyPhotoAnnotationThumbnails();
  if (typeof MutationObserver === "function" && document.body) {
    const thumbnailObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.target.matches?.("img[data-safety-annotations]")) {
          refreshSafetyPhotoAnnotationThumbnail(mutation.target);
        }
        mutation.addedNodes?.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) mountSafetyPhotoAnnotationThumbnails(node);
        });
      });
    });
    thumbnailObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-safety-annotations"] });
  }
})();
