(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const IMAGE_STAGE_SELECTOR = ".image-fullscreen-stage, .mobile-image-fullscreen-stage";

  function mountImageViewerInteractions(view, stage) {
    if (!view || !stage) return { reset() {}, destroy() {} };

    view.classList.add("image-viewer-zoomable");
    stage.classList.add("image-viewer-zoom-stage");
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let panDrag = null;
    let pinchGesture = null;
    let suppressClickUntil = 0;
    const activeTouchPoints = new Map();

    const render = () => {
      stage.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
      view.classList.toggle("is-zoomed", zoom > 1.01);
    };

    const reset = () => {
      zoom = 1;
      panX = 0;
      panY = 0;
      panDrag = null;
      pinchGesture = null;
      activeTouchPoints.clear();
      view.classList.remove("is-dragging");
      render();
    };

    const onWheel = (event) => {
      event.preventDefault();
      const bounds = view.getBoundingClientRect();
      const pointerX = event.clientX - (bounds.left + bounds.width / 2);
      const pointerY = event.clientY - (bounds.top + bounds.height / 2);
      const nextZoom = Math.max(0.25, Math.min(8, zoom * Math.exp(-event.deltaY * 0.0015)));
      const ratio = nextZoom / zoom;
      if (nextZoom <= 1) {
        panX = 0;
        panY = 0;
      } else {
        panX = pointerX + (panX - pointerX) * ratio;
        panY = pointerY + (panY - pointerY) * ratio;
      }
      zoom = nextZoom;
      render();
    };

    const onPointerDown = (event) => {
      if (event.button !== 0) return;
      const pointerOverStage = Boolean(event.target.closest?.(IMAGE_STAGE_SELECTOR));
      const activeOverlay = event.target.closest?.(".image-annotation-overlay");
      if (
        activeOverlay?.classList.contains("is-drawing") ||
        activeOverlay?.classList.contains("is-erasing") ||
        activeOverlay?.classList.contains("is-text-mode") ||
        activeOverlay?.classList.contains("is-text-dragging")
      ) return;

      if (event.pointerType === "touch") {
        if (!pointerOverStage && activeTouchPoints.size === 0) return;
        activeTouchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (activeTouchPoints.size >= 2) {
          const points = [...activeTouchPoints.values()].slice(0, 2);
          const bounds = view.getBoundingClientRect();
          const centerX = bounds.left + bounds.width / 2;
          const centerY = bounds.top + bounds.height / 2;
          pinchGesture = {
            startDistance: Math.max(1, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)),
            startZoom: zoom,
            startX: (points[0].x + points[1].x) / 2 - centerX,
            startY: (points[0].y + points[1].y) / 2 - centerY,
            startPanX: panX,
            startPanY: panY,
          };
          panDrag = null;
          suppressClickUntil = Date.now() + 1000;
          event.preventDefault();
          activeTouchPoints.forEach((_, pointerId) => {
            try { view.setPointerCapture?.(pointerId); } catch (_) {}
          });
          view.classList.add("is-dragging");
          return;
        }
      }

      if (!pointerOverStage || zoom <= 1.01) return;
      event.preventDefault();
      panDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, panX, panY };
      view.classList.add("is-dragging");
      try { view.setPointerCapture?.(event.pointerId); } catch (_) {}
    };

    const onPointerMove = (event) => {
      if (event.pointerType === "touch" && activeTouchPoints.has(event.pointerId)) {
        activeTouchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      if (pinchGesture && activeTouchPoints.size >= 2) {
        const points = [...activeTouchPoints.values()].slice(0, 2);
        const bounds = view.getBoundingClientRect();
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        const pointerX = (points[0].x + points[1].x) / 2 - centerX;
        const pointerY = (points[0].y + points[1].y) / 2 - centerY;
        const distance = Math.max(1, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y));
        const nextZoom = Math.max(0.25, Math.min(8, pinchGesture.startZoom * distance / pinchGesture.startDistance));
        const ratio = nextZoom / pinchGesture.startZoom;
        if (nextZoom <= 1) {
          panX = 0;
          panY = 0;
        } else {
          panX = pointerX - ratio * (pinchGesture.startX - pinchGesture.startPanX);
          panY = pointerY - ratio * (pinchGesture.startY - pinchGesture.startPanY);
        }
        zoom = nextZoom;
        event.preventDefault();
        render();
        return;
      }
      if (!panDrag || event.pointerId !== panDrag.pointerId) return;
      panX = panDrag.panX + event.clientX - panDrag.startX;
      panY = panDrag.panY + event.clientY - panDrag.startY;
      event.preventDefault();
      render();
    };

    const finishGesture = (event) => {
      const pointerId = event?.pointerId;
      if (event?.type !== "lostpointercapture" && pointerId != null) activeTouchPoints.delete(pointerId);
      if (panDrag && (pointerId == null || pointerId === panDrag.pointerId)) panDrag = null;
      if (pinchGesture && activeTouchPoints.size < 2) {
        pinchGesture = null;
        suppressClickUntil = Date.now() + 500;
        const remaining = activeTouchPoints.entries().next().value;
        if (remaining && zoom > 1.01) {
          panDrag = {
            pointerId: remaining[0],
            startX: remaining[1].x,
            startY: remaining[1].y,
            panX,
            panY,
          };
        }
      }
      if (!panDrag && !pinchGesture) view.classList.remove("is-dragging");
    };

    const onClickCapture = (event) => {
      if (Date.now() >= suppressClickUntil || event.target.closest?.(".image-fullscreen-close, .mobile-image-fullscreen-close")) return;
      event.preventDefault();
      event.stopPropagation();
    };

    view.addEventListener("wheel", onWheel, { passive: false });
    view.addEventListener("pointerdown", onPointerDown);
    view.addEventListener("pointermove", onPointerMove);
    view.addEventListener("pointerup", finishGesture);
    view.addEventListener("pointercancel", finishGesture);
    view.addEventListener("lostpointercapture", finishGesture);
    view.addEventListener("click", onClickCapture, true);

    return {
      reset,
      destroy() {
        view.removeEventListener("wheel", onWheel);
        view.removeEventListener("pointerdown", onPointerDown);
        view.removeEventListener("pointermove", onPointerMove);
        view.removeEventListener("pointerup", finishGesture);
        view.removeEventListener("pointercancel", finishGesture);
        view.removeEventListener("lostpointercapture", finishGesture);
        view.removeEventListener("click", onClickCapture, true);
        view.classList.remove("image-viewer-zoomable", "is-zoomed", "is-dragging");
        stage.classList.remove("image-viewer-zoom-stage");
        stage.style.transform = "";
      },
    };
  }

  function createRectElement(item, index, width, height, isPreview, isErasing) {
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.classList.add("image-annotation-shape", "image-annotation-rect");
    if (isPreview) rect.classList.add("is-preview");
    if (isErasing) rect.classList.add("is-erasable");
    rect.dataset.annotationIndex = String(index);
    const px = item.x * width;
    const py = item.y * height;
    const pw = item.width * width;
    const ph = item.height * height;
    const rx = Math.min(8, Math.min(pw, ph) * 0.12);
    rect.setAttribute("x", String(px));
    rect.setAttribute("y", String(py));
    rect.setAttribute("width", String(pw));
    rect.setAttribute("height", String(ph));
    rect.setAttribute("rx", String(rx));
    rect.setAttribute("ry", String(rx));
    rect.setAttribute("fill", "none");
    rect.setAttribute("stroke", "#ff3b30");
    rect.setAttribute("stroke-width", String(Math.max(3, Math.min(width, height) * 0.006)));
    rect.setAttribute("vector-effect", "non-scaling-stroke");
    if (!isPreview) {
      rect.setAttribute("role", "img");
      rect.setAttribute("aria-label", `Khung khoanh vùng ${index + 1}`);
    }
    return rect;
  }

  function createCircleElement(item, index, width, height, isPreview, isErasing) {
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.classList.add("image-annotation-shape", "image-annotation-circle");
    if (isPreview) circle.classList.add("is-preview");
    if (isErasing) circle.classList.add("is-erasable");
    circle.dataset.annotationIndex = String(index);
    circle.setAttribute("cx", String(item.x * width));
    circle.setAttribute("cy", String(item.y * height));
    circle.setAttribute("r", String(item.radius * Math.min(width, height)));
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", "#ff3b30");
    circle.setAttribute("stroke-width", String(Math.max(3, Math.min(width, height) * 0.006)));
    circle.setAttribute("vector-effect", "non-scaling-stroke");
    if (!isPreview) {
      circle.setAttribute("role", "img");
      circle.setAttribute("aria-label", `Vòng khoanh ${index + 1}`);
    }
    return circle;
  }

  function createArrowElement(item, index, width, height, isPreview, isErasing) {
    const g = document.createElementNS(SVG_NS, "g");
    g.classList.add("image-annotation-shape", "image-annotation-arrow-group");
    if (isPreview) g.classList.add("is-preview");
    if (isErasing) g.classList.add("is-erasable");
    g.dataset.annotationIndex = String(index);

    const x1 = item.x1 * width;
    const y1 = item.y1 * height;
    const x2 = item.x2 * width;
    const y2 = item.y2 * height;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);

    if (len < 4) return g;

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
    const strokeW = Math.max(3.5, Math.min(width, height) * 0.007);

    const stem = document.createElementNS(SVG_NS, "line");
    stem.setAttribute("x1", String(x1));
    stem.setAttribute("y1", String(y1));
    stem.setAttribute("x2", String(bx));
    stem.setAttribute("y2", String(by));
    stem.setAttribute("stroke", "#ff3b30");
    stem.setAttribute("stroke-width", String(strokeW));
    stem.setAttribute("stroke-linecap", "round");
    stem.setAttribute("vector-effect", "non-scaling-stroke");
    g.appendChild(stem);

    const head = document.createElementNS(SVG_NS, "polygon");
    head.setAttribute("points", `${x2},${y2} ${lx},${ly} ${rx},${ry}`);
    head.setAttribute("fill", "#ff3b30");
    head.setAttribute("stroke", "#ff3b30");
    head.setAttribute("stroke-width", "1");
    g.appendChild(head);

    if (!isPreview) {
      g.setAttribute("role", "img");
      g.setAttribute("aria-label", `Mũi tên ${index + 1}`);
    }
    return g;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  const WORD_FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 44, 56, 72];

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

  function createTextElement(item, index, width, height, isPreview, isErasing) {
    const g = document.createElementNS(SVG_NS, "g");
    g.classList.add("image-annotation-shape", "image-annotation-text-group");
    if (isPreview) g.classList.add("is-preview");
    if (isErasing) g.classList.add("is-erasable");
    g.dataset.annotationIndex = String(index);

    const minDim = Math.min(width, height);
    const fontSize = getAnnotationFontSize(item.size, minDim);
    const colorInfo = getAnnotationColor(item.color);
    const px = item.x * width;
    const py = item.y * height;

    const lines = String(item.text || "").split("\n");
    const longestLine = lines.reduce((max, l) => Math.max(max, l.length), 0);
    const boxW = Math.max(38, Math.round(longestLine * fontSize * 0.65 + 16));
    const boxH = Math.max(36, Math.round(lines.length * fontSize * 1.35 + 10));

    const hitBox = document.createElementNS(SVG_NS, "rect");
    hitBox.classList.add("text-drag-hitbox");
    hitBox.setAttribute("x", String(Math.round(px - boxW / 2)));
    hitBox.setAttribute("y", String(Math.round(py - boxH / 2)));
    hitBox.setAttribute("width", String(boxW));
    hitBox.setAttribute("height", String(boxH));
    hitBox.setAttribute("rx", "6");
    hitBox.setAttribute("ry", "6");
    hitBox.dataset.width = String(boxW);
    hitBox.dataset.height = String(boxH);
    hitBox.setAttribute("fill", "transparent");
    hitBox.setAttribute("stroke", "transparent");
    hitBox.setAttribute("stroke-dasharray", "3 3");
    hitBox.setAttribute("stroke-width", "1.5");
    g.appendChild(hitBox);

    const textEl = document.createElementNS(SVG_NS, "text");
    textEl.setAttribute("x", String(px));
    textEl.setAttribute("y", String(py));
    textEl.setAttribute("text-anchor", "middle");
    textEl.setAttribute("fill", colorInfo.fill);
    textEl.setAttribute("stroke", colorInfo.stroke);
    textEl.setAttribute("stroke-width", String(Math.max(2, fontSize * 0.16)));
    textEl.setAttribute("stroke-linejoin", "round");
    textEl.setAttribute("stroke-linecap", "round");
    textEl.setAttribute("paint-order", "stroke fill");
    textEl.setAttribute("font-family", "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif");
    textEl.setAttribute("font-weight", "700");
    textEl.setAttribute("font-size", String(fontSize));
    textEl.setAttribute("dominant-baseline", "central");
    textEl.setAttribute("vector-effect", "non-scaling-stroke");

    if (lines.length <= 1) {
      textEl.textContent = lines[0] || "";
    } else {
      lines.forEach((line, lineIdx) => {
        const tspan = document.createElementNS(SVG_NS, "tspan");
        tspan.setAttribute("x", String(px));
        tspan.setAttribute("text-anchor", "middle");
        if (lineIdx > 0) {
          tspan.setAttribute("dy", "1.22em");
        }
        tspan.textContent = line;
        textEl.appendChild(tspan);
      });
    }

    g.appendChild(textEl);

    if (!isPreview) {
      g.setAttribute("role", "img");
      g.setAttribute("aria-label", `Chữ ghi chú ${index + 1}: ${item.text}`);
    }
    return g;
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

  function normalizeCircles(value) {
    return normalizeAnnotations(value);
  }

  function mountImageCircleAnnotator(stage, toolbarHost, options = {}) {
    if (!stage || !toolbarHost) return () => {};

    const image = stage.querySelector("img");
    if (!image) return () => {};

    const overlay = document.createElementNS(SVG_NS, "svg");
    overlay.classList.add("image-annotation-overlay");
    overlay.setAttribute("aria-label", "Các nét vẽ trên ảnh");
    stage.appendChild(overlay);

    const isViewOnly = options.viewOnly === true || options.showToolbar === false;
    let toolbar = null;
    let rectButton = null;
    let circleButton = null;
    let penButton = null;
    let arrowButton = null;
    let eraserButton = null;
    let undoButton = null;
    let clearButton = null;
    let hint = null;
    let textButton = null;
    let textToolbar = null;
    let textPopover = null;
    let outsidePointerCleanup = null;
    let activeTextColor = "red";
    let activeTextSize = 18;
    let textDrag = null;

    if (!isViewOnly) {
      toolbar = document.createElement("div");
      toolbar.className = "image-annotation-toolbar";
      toolbar.innerHTML = `
        <div class="image-annotation-buttons" role="toolbar" aria-label="Đánh dấu và vẽ nét trên ảnh">
          <button type="button" class="image-annotation-button image-annotation-rect" data-annotation-tool="rect" aria-pressed="false" title="Khoanh vùng hình chữ nhật (kéo để bao quanh nút hoặc khu vực)">
            <i class="fa-regular fa-square"></i><span>Khoanh vùng</span>
          </button>
          <button type="button" class="image-annotation-button image-annotation-circle image-annotation-pen" data-annotation-tool="circle" aria-pressed="false" title="Khoanh tròn (kéo từ tâm ra ngoài)">
            <i class="fa-regular fa-circle"></i><span>Khoanh tròn</span>
          </button>
          <button type="button" class="image-annotation-button image-annotation-arrow" data-annotation-tool="arrow" aria-pressed="false" title="Vẽ mũi tên đỏ chỉ vào vị trí cần chú ý">
            <i class="fa-solid fa-arrow-right"></i><span>Mũi tên</span>
          </button>
          <button type="button" class="image-annotation-button image-annotation-text" data-annotation-tool="text" aria-pressed="false" title="Chèn chữ ghi chú trên ảnh (chọn vị trí để nhập chữ)">
            <i class="fa-solid fa-font"></i><span>Chữ</span>
          </button>
          <button type="button" class="image-annotation-button image-annotation-eraser" aria-pressed="false" title="Chọn nét để xóa riêng" hidden>
            <i class="fa-solid fa-eraser"></i><span>Xóa nét</span>
          </button>
          <button type="button" class="image-annotation-button image-annotation-undo" title="Xóa nét vừa thêm" hidden>
            <i class="fa-solid fa-rotate-left"></i><span>Bỏ nét</span>
          </button>
          <button type="button" class="image-annotation-button image-annotation-clear" title="Xóa tất cả nét" hidden>
            <i class="fa-solid fa-trash-can"></i><span>Xóa hết</span>
          </button>
        </div>
        <div class="image-annotation-text-toolbar" hidden>
          <div class="image-annotation-text-options">
            <span class="image-annotation-setting-label">Màu:</span>
            <button type="button" class="image-annotation-color-btn color-red is-active" data-toolbar-color="red" title="Chữ màu đỏ">
              <span class="color-swatch-circle" style="background:#ff3b30"></span><span>Đỏ</span>
            </button>
            <button type="button" class="image-annotation-color-btn color-white" data-toolbar-color="white" title="Chữ màu trắng">
              <span class="color-swatch-circle" style="background:#ffffff"></span><span>Trắng</span>
            </button>
            <button type="button" class="image-annotation-color-btn color-black" data-toolbar-color="black" title="Chữ màu đen">
              <span class="color-swatch-circle" style="background:#111827"></span><span>Đen</span>
            </button>
          </div>
          <div class="image-annotation-text-options">
            <span class="image-annotation-setting-label">Cỡ:</span>
            <div class="image-annotation-size-stepper">
              <button type="button" class="image-annotation-size-step-btn" data-toolbar-size-step="-2" title="Giảm cỡ chữ"><i class="fa-solid fa-minus"></i></button>
              <select class="image-annotation-size-select" data-toolbar-size-select title="Chọn cỡ số (như Word)">
                ${WORD_FONT_SIZES.map((sz) => `<option value="${sz}" ${sz === 18 ? "selected" : ""}>${sz}</option>`).join("")}
              </select>
              <button type="button" class="image-annotation-size-step-btn" data-toolbar-size-step="2" title="Tăng cỡ chữ"><i class="fa-solid fa-plus"></i></button>
            </div>
            <div class="image-annotation-quick-sizes">
              <button type="button" class="image-annotation-size-btn" data-toolbar-size="14" title="Cỡ 14">14</button>
              <button type="button" class="image-annotation-size-btn is-active" data-toolbar-size="18" title="Cỡ 18">18</button>
              <button type="button" class="image-annotation-size-btn" data-toolbar-size="24" title="Cỡ 24">24</button>
              <button type="button" class="image-annotation-size-btn" data-toolbar-size="32" title="Cỡ 32">32</button>
            </div>
          </div>
        </div>
        <span class="image-annotation-hint" role="status" aria-live="polite"></span>
      `;
      toolbarHost.appendChild(toolbar);

      rectButton = toolbar.querySelector(".image-annotation-rect");
      circleButton = toolbar.querySelector(".image-annotation-circle");
      penButton = circleButton;
      arrowButton = toolbar.querySelector(".image-annotation-arrow");
      eraserButton = toolbar.querySelector(".image-annotation-eraser");
      undoButton = toolbar.querySelector(".image-annotation-undo");
      clearButton = toolbar.querySelector(".image-annotation-clear");
      hint = toolbar.querySelector(".image-annotation-hint");
      textButton = toolbar.querySelector(".image-annotation-text, [data-annotation-tool='text']");
      textToolbar = toolbar.querySelector(".image-annotation-text-toolbar");
    }

    const initialSource = options.initialAnnotations || options.initialCircles || [];
    const circles = normalizeAnnotations(initialSource);
    const canEdit = !isViewOnly && options.editable !== false && typeof options.onSave === "function";
    let mode = "view"; // "view" | "rect" | "circle" | "arrow" | "erase"
    let drawing = null;
    let revision = 0;
    let savedRevision = 0;
    let saveTimer = 0;
    let saveChain = Promise.resolve();
    let pendingSnapshot = null;
    let saveWorker = null;
    let saveStatus = "";

    const imageSize = () => ({
      width: Math.max(1, stage.clientWidth),
      height: Math.max(1, stage.clientHeight),
    });

    const pointerToImagePoint = (event) => {
      const { width, height } = imageSize();
      try {
        const matrix = overlay.getScreenCTM?.();
        if (matrix) {
          const point = overlay.createSVGPoint();
          point.x = event.clientX;
          point.y = event.clientY;
          const localPoint = point.matrixTransform(matrix.inverse());
          return { x: localPoint.x, y: localPoint.y, width, height };
        }
      } catch (_) {}

      const bounds = overlay.getBoundingClientRect();
      return {
        x: (event.clientX - bounds.left) * width / Math.max(1, bounds.width),
        y: (event.clientY - bounds.top) * height / Math.max(1, bounds.height),
        width,
        height,
      };
    };

    const updateOverlaySize = () => {
      const { width, height } = imageSize();
      overlay.setAttribute("viewBox", `0 0 ${width} ${height}`);
      overlay.setAttribute("width", String(width));
      overlay.setAttribute("height", String(height));
      renderCircles();
    };

    function renderCircles() {
      if (!overlay.isConnected) return;
      const { width, height } = imageSize();
      const isErasing = mode === "erase";
      const elements = circles.map((item, index) => {
        const type = item.type || (Number.isFinite(Number(item.radius)) ? "circle" : "rect");
        if (type === "rect") return createRectElement(item, index, width, height, false, isErasing);
        if (type === "arrow") return createArrowElement(item, index, width, height, false, isErasing);
        if (type === "text") return createTextElement(item, index, width, height, false, isErasing);
        return createCircleElement(item, index, width, height, false, isErasing);
      });
      if (drawing) {
        const type = drawing.type;
        if (type === "rect") elements.push(createRectElement(drawing, circles.length, width, height, true, false));
        else if (type === "arrow") elements.push(createArrowElement(drawing, circles.length, width, height, true, false));
        else elements.push(createCircleElement(drawing, circles.length, width, height, true, false));
      }
      overlay.replaceChildren(...elements);
    }

    const updateControls = () => {
      const hasCircles = circles.length > 0;
      if (toolbar) {
        if (eraserButton) eraserButton.hidden = !hasCircles;
        if (undoButton) undoButton.hidden = !hasCircles;
        if (clearButton) clearButton.hidden = !hasCircles;
        if (rectButton) {
          rectButton.classList.toggle("is-active", mode === "rect");
          rectButton.setAttribute("aria-pressed", String(mode === "rect"));
          rectButton.disabled = !canEdit;
        }
        if (circleButton) {
          circleButton.classList.toggle("is-active", mode === "circle" || mode === "draw");
          circleButton.setAttribute("aria-pressed", String(mode === "circle" || mode === "draw"));
          circleButton.disabled = !canEdit;
        }
        if (arrowButton) {
          arrowButton.classList.toggle("is-active", mode === "arrow");
          arrowButton.setAttribute("aria-pressed", String(mode === "arrow"));
          arrowButton.disabled = !canEdit;
        }
        if (textButton) {
          textButton.classList.toggle("is-active", mode === "text");
          textButton.setAttribute("aria-pressed", String(mode === "text"));
          textButton.disabled = !canEdit;
        }
        if (textToolbar) {
          textToolbar.hidden = mode !== "text";
        }
        if (eraserButton) {
          eraserButton.classList.toggle("is-active", mode === "erase");
          eraserButton.setAttribute("aria-pressed", String(mode === "erase"));
          eraserButton.disabled = !canEdit;
        }
        toolbar.classList.toggle("has-annotations", hasCircles);
        if (hint) {
          if (mode === "rect") {
            hint.textContent = "Kéo thả trên ảnh để khoanh vùng hình chữ nhật.";
          } else if (mode === "circle" || mode === "draw") {
            hint.textContent = "Kéo từ tâm ra ngoài để khoanh tròn đỏ.";
          } else if (mode === "arrow") {
            hint.textContent = "Kéo từ đuôi đến đầu để vẽ mũi tên đỏ chỉ vị trí.";
          } else if (mode === "text") {
            hint.textContent = "Chạm để chèn chữ mới, hoặc kéo thả chữ có sẵn đến bất kì vị trí nào.";
          } else if (mode === "erase") {
            hint.textContent = "Chạm vào nét (vùng khoanh hoặc mũi tên) muốn xóa.";
          } else if (saveStatus) {
            hint.textContent = saveStatus;
          } else if (!canEdit) {
            hint.textContent = "Chỉ xem — tài khoản này không thể lưu nét trên ảnh.";
          } else if (hasCircles) {
            hint.textContent = `${circles.length} nét đã vẽ · có thể xóa từng nét hoặc xóa hết.`;
          } else {
            hint.textContent = "Chọn Khoanh vùng, Khoanh tròn, Mũi tên hoặc Chữ để bắt đầu đánh dấu.";
          }
        }
      }
      overlay.classList.toggle("is-drawing", ["rect", "circle", "draw", "arrow"].includes(mode));
      overlay.classList.toggle("is-erasing", mode === "erase");
      overlay.classList.toggle("is-text-mode", mode === "text");
      renderCircles();
    };


    const updateToolbarTextOptions = () => {
      if (!textToolbar) return;
      const curNum = parseFontSizeNumber(activeTextSize);
      textToolbar.querySelectorAll("[data-toolbar-color]").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.toolbarColor === activeTextColor);
      });
      const select = textToolbar.querySelector("[data-toolbar-size-select]");
      if (select) {
        select.value = String(curNum);
      }
      textToolbar.querySelectorAll("[data-toolbar-size]").forEach((btn) => {
        const btnNum = parseFontSizeNumber(btn.dataset.toolbarSize);
        btn.classList.toggle("is-active", btnNum === curNum);
      });
    };

    const closeTextPopover = () => {
      if (outsidePointerCleanup) {
        outsidePointerCleanup();
        outsidePointerCleanup = null;
      }
      if (textPopover) {
        textPopover.remove();
        textPopover = null;
      }
    };

    const openTextPopover = (clientX, clientY, nx, ny, editingIndex = -1) => {
      closeTextPopover();
      if (!canEdit) return;

      const isEditing = editingIndex >= 0 && circles[editingIndex]?.type === "text";
      const existingItem = isEditing ? circles[editingIndex] : null;

      let selectedColor = existingItem?.color || activeTextColor || "red";
      let selectedSize = existingItem ? parseFontSizeNumber(existingItem.size) : parseFontSizeNumber(activeTextSize);
      const selectedSizeNum = selectedSize;
      const initialText = existingItem?.text || "";

      textPopover = document.createElement("div");
      textPopover.className = "image-annotation-text-popover";
      textPopover.innerHTML = `
        <div class="image-annotation-text-popover-header">
          <span><i class="fa-solid fa-font"></i> <strong>${isEditing ? "Sửa chữ ghi chú" : "Chèn chữ ghi chú"}</strong></span>
          <button type="button" class="image-annotation-text-popover-close" title="Đóng">&times;</button>
        </div>
        <div class="image-annotation-text-popover-body">
          <input type="text" class="image-annotation-text-popover-input" placeholder="Nhập nội dung chữ..." maxlength="120" value="${escapeHtml(initialText)}" />
          <div class="image-annotation-text-popover-row">
            <span class="popover-opt-label">Màu chữ:</span>
            <div class="popover-btn-group" role="radiogroup" aria-label="Màu chữ">
              <button type="button" class="image-annotation-pill-btn opt-color color-red ${selectedColor === "red" ? "is-active" : ""}" data-color="red" title="Đỏ">
                <span class="color-swatch-circle" style="background:#ff3b30"></span><span>Đỏ</span>
              </button>
              <button type="button" class="image-annotation-pill-btn opt-color color-white ${selectedColor === "white" ? "is-active" : ""}" data-color="white" title="Trắng">
                <span class="color-swatch-circle" style="background:#ffffff"></span><span>Trắng</span>
              </button>
              <button type="button" class="image-annotation-pill-btn opt-color color-black ${selectedColor === "black" ? "is-active" : ""}" data-color="black" title="Đen">
                <span class="color-swatch-circle" style="background:#111827"></span><span>Đen</span>
              </button>
            </div>
          </div>
          <div class="image-annotation-text-popover-row">
            <span class="popover-opt-label">Cỡ chữ (Word):</span>
            <div class="popover-size-wrapper">
              <div class="popover-size-stepper">
                <button type="button" class="popover-step-btn" data-popover-step="-2" title="Giảm cỡ chữ"><i class="fa-solid fa-minus"></i></button>
                <select class="popover-size-select" title="Chọn cỡ số (như Word)">
                  ${WORD_FONT_SIZES.map((sz) => `<option value="${sz}" ${sz === selectedSizeNum ? "selected" : ""}>${sz}</option>`).join("")}
                </select>
                <button type="button" class="popover-step-btn" data-popover-step="2" title="Tăng cỡ chữ"><i class="fa-solid fa-plus"></i></button>
              </div>
              <div class="popover-btn-group popover-numeric-sizes" role="radiogroup" aria-label="Cỡ chữ số">
                ${[14, 18, 24, 32].map((sz) => `
                  <button type="button" class="image-annotation-pill-btn opt-size ${selectedSizeNum === sz ? "is-active" : ""}" data-size="${sz}" title="Cỡ ${sz}">${sz}</button>
                `).join("")}
              </div>
            </div>
          </div>
        </div>
        <div class="image-annotation-text-popover-footer">
          ${isEditing ? '<button type="button" class="secondary-button popover-delete-btn"><i class="fa-solid fa-trash-can"></i> Xóa</button>' : ''}
          <button type="button" class="secondary-button popover-cancel-btn">Hủy</button>
          <button type="button" class="primary-button popover-save-btn"><i class="fa-solid fa-check"></i> ${isEditing ? "Lưu" : "Chèn chữ"}</button>
        </div>
      `;

      toolbarHost.appendChild(textPopover);

      const popoverWidth = Math.min(310, Math.max(260, window.innerWidth - 24));
      const popoverHeight = 240;
      const maxLeft = Math.max(10, window.innerWidth - popoverWidth - 12);
      const maxTop = Math.max(10, window.innerHeight - popoverHeight - 12);
      const left = Math.min(maxLeft, Math.max(12, clientX - popoverWidth / 2));
      let top = clientY - popoverHeight - 14;
      if (top < 70) {
        top = clientY + 24;
      }
      top = Math.min(maxTop, Math.max(12, top));

      textPopover.style.left = `${left}px`;
      textPopover.style.top = `${top}px`;

      const input = textPopover.querySelector(".image-annotation-text-popover-input");
      input?.focus();
      input?.select();

      const onDocPointerDown = (e) => {
        if (!textPopover) return;
        if (textPopover.contains(e.target)) return;
        if (overlay?.contains(e.target)) return;
        if (toolbar?.contains(e.target)) return;
        closeTextPopover();
      };
      const outsideTimer = setTimeout(() => {
        document.addEventListener("pointerdown", onDocPointerDown, true);
      }, 60);
      outsidePointerCleanup = () => {
        clearTimeout(outsideTimer);
        document.removeEventListener("pointerdown", onDocPointerDown, true);
      };

      textPopover.querySelectorAll(".opt-color").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          selectedColor = btn.dataset.color || "red";
          activeTextColor = selectedColor;
          textPopover.querySelectorAll(".opt-color").forEach((b) => b.classList.toggle("is-active", b === btn));
          updateToolbarTextOptions();
        });
      });

      const popoverSelect = textPopover.querySelector(".popover-size-select");
      const syncPopoverSizeUI = () => {
        if (popoverSelect) popoverSelect.value = String(selectedSize);
        textPopover.querySelectorAll(".opt-size").forEach((b) => {
          b.classList.toggle("is-active", Number(b.dataset.size) === selectedSize);
        });
        activeTextSize = selectedSize;
        updateToolbarTextOptions();
      };

      popoverSelect?.addEventListener("change", (e) => {
        e.stopPropagation();
        selectedSize = Number(popoverSelect.value) || 18;
        syncPopoverSizeUI();
      });

      textPopover.querySelectorAll("[data-popover-step]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const step = Number(btn.dataset.popoverStep) || 0;
          selectedSize = Math.min(120, Math.max(10, selectedSize + step));
          syncPopoverSizeUI();
        });
      });

      textPopover.querySelectorAll(".opt-size").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          selectedSize = Number(btn.dataset.size) || 18;
          syncPopoverSizeUI();
        });
      });

      const handleSave = () => {
        const text = input?.value?.trim();
        if (!text) {
          input?.focus();
          return;
        }
        if (isEditing) {
          circles[editingIndex] = {
            ...circles[editingIndex],
            type: "text",
            text,
            color: selectedColor,
            size: selectedSize,
          };
        } else {
          circles.push({
            type: "text",
            text,
            x: nx,
            y: ny,
            color: selectedColor,
            size: selectedSize,
          });
        }
        scheduleSave();
        updateControls();
        closeTextPopover();
      };

      textPopover.querySelector(".popover-save-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        handleSave();
      });

      textPopover.querySelector(".popover-cancel-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        closeTextPopover();
      });

      textPopover.querySelector(".image-annotation-text-popover-close")?.addEventListener("click", (e) => {
        e.stopPropagation();
        closeTextPopover();
      });

      textPopover.querySelector(".popover-delete-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isEditing && editingIndex < circles.length) {
          circles.splice(editingIndex, 1);
          scheduleSave();
          updateControls();
        }
        closeTextPopover();
      });

      input?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleSave();
        } else if (e.key === "Escape") {
          e.preventDefault();
          closeTextPopover();
        }
      });

      textPopover.addEventListener("pointerdown", (e) => e.stopPropagation());
      textPopover.addEventListener("click", (e) => e.stopPropagation());
    };

    const setMode = (nextMode) => {
      if (!canEdit) return;
      if (mode === "text" && nextMode !== "text") {
        closeTextPopover();
      }
      mode = mode === nextMode ? "view" : nextMode;
      drawing = null;
      updateControls();
    };

    const runSaveQueue = () => {
      if (saveWorker) return saveWorker;
      saveWorker = (async () => {
        while (pendingSnapshot) {
          const current = pendingSnapshot;
          pendingSnapshot = null;
          if (current.revision <= savedRevision) continue;
          try {
            await options.onSave(current.snapshot);
          } catch (error) {
            if (!pendingSnapshot || pendingSnapshot.revision <= current.revision) pendingSnapshot = current;
            else continue;
            throw error;
          }
          savedRevision = Math.max(savedRevision, current.revision);
          if (revision === current.revision) {
            saveStatus = "Đã tự động lưu nét vẽ.";
            updateControls();
            window.setTimeout(() => {
              if (saveStatus === "Đã tự động lưu nét vẽ.") {
                saveStatus = "";
                updateControls();
              }
            }, 1800);
          }
        }
      })().finally(() => {
        saveWorker = null;
      });
      saveChain = saveWorker;
      return saveWorker;
    };

    const saveSnapshot = (snapshot, snapshotRevision) => {
      if (!canEdit || snapshotRevision <= savedRevision) return saveWorker || saveChain;
      if (!pendingSnapshot || snapshotRevision >= pendingSnapshot.revision) {
        pendingSnapshot = { snapshot, revision: snapshotRevision };
      }
      return runSaveQueue();
    };

    const scheduleSave = () => {
      if (!canEdit) return;
      revision += 1;
      saveStatus = "Đang lưu nét vẽ…";
      updateControls();
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        saveTimer = 0;
        const snapshot = circles.map((item) => ({ ...item }));
        saveSnapshot(snapshot, revision).catch((error) => {
          saveStatus = "Chưa lưu được. Hãy thử lại hoặc đóng ảnh sau khi kết nối lại.";
          updateControls();
          options.onError?.(error);
        });
      }, 80);
    };

    if (toolbar) {
      rectButton?.addEventListener("click", (event) => {
        event.stopPropagation();
        setMode("rect");
      });
      circleButton?.addEventListener("click", (event) => {
        event.stopPropagation();
        setMode("circle");
      });
      arrowButton?.addEventListener("click", (event) => {
        event.stopPropagation();
        setMode("arrow");
      });
      textButton?.addEventListener("click", (event) => {
        event.stopPropagation();
        setMode("text");
      });
      textToolbar?.querySelectorAll("[data-toolbar-color]").forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          activeTextColor = btn.dataset.toolbarColor || "red";
          updateToolbarTextOptions();
        });
      });
      const toolbarSelect = textToolbar?.querySelector("[data-toolbar-size-select]");
      toolbarSelect?.addEventListener("change", (event) => {
        event.stopPropagation();
        activeTextSize = Number(toolbarSelect.value) || 18;
        updateToolbarTextOptions();
      });

      textToolbar?.querySelectorAll("[data-toolbar-size-step]").forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          const step = Number(btn.dataset.toolbarSizeStep) || 0;
          const cur = parseFontSizeNumber(activeTextSize);
          activeTextSize = Math.min(120, Math.max(10, cur + step));
          updateToolbarTextOptions();
        });
      });

      textToolbar?.querySelectorAll("[data-toolbar-size]").forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          activeTextSize = Number(btn.dataset.toolbarSize) || 18;
          updateToolbarTextOptions();
        });
      });
      eraserButton?.addEventListener("click", (event) => {
        event.stopPropagation();
        setMode("erase");
      });
      undoButton?.addEventListener("click", (event) => {
        event.stopPropagation();
        if (circles.pop()) scheduleSave();
        updateControls();
      });
      clearButton?.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!circles.length) return;
        circles.splice(0, circles.length);
        drawing = null;
        mode = "view";
        scheduleSave();
        updateControls();
      });
      toolbar.addEventListener("click", (event) => event.stopPropagation());
    }

    stage.addEventListener("click", (event) => event.stopPropagation());

    overlay.addEventListener("pointerdown", (event) => {
      if (mode === "erase") {
        const targetElement = event.target.closest?.("[data-annotation-index]");
        if (targetElement) {
          event.preventDefault();
          event.stopPropagation();
          const targetIndex = Number(targetElement.dataset.annotationIndex);
          if (Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < circles.length) {
            circles.splice(targetIndex, 1);
            scheduleSave();
            updateControls();
          }
        }
        return;
      }
      // Text drag and drop or edit detection
      const textTarget = event.target.closest?.(".image-annotation-text-group[data-annotation-index]");
      if (canEdit && textTarget) {
        const targetIndex = Number(textTarget.dataset.annotationIndex);
        if (Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < circles.length && circles[targetIndex].type === "text") {
          event.preventDefault();
          event.stopPropagation();
          closeTextPopover();

          const { x: pointerX, y: pointerY, width, height } = pointerToImagePoint(event);
          textDrag = {
            pointerId: event.pointerId,
            targetIndex,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startPointerX: pointerX,
            startPointerY: pointerY,
            initialItemX: circles[targetIndex].x,
            initialItemY: circles[targetIndex].y,
            hasMoved: false,
            width,
            height,
            element: textTarget,
          };

          overlay.classList.add("is-text-dragging");
          textTarget.classList.add("is-active-dragging");
          try { overlay.setPointerCapture?.(event.pointerId); } catch (_) {}
          return;
        }
      }

      if (mode === "text") {
        event.preventDefault();
        event.stopPropagation();
        const { x: pointerX, y: pointerY, width, height } = pointerToImagePoint(event);
        const nx = Math.max(0, Math.min(1, pointerX / width));
        const ny = Math.max(0, Math.min(1, pointerY / height));
        openTextPopover(event.clientX, event.clientY, nx, ny, -1);
        return;
      }
      const activeDrawMode = mode === "draw" ? "circle" : mode;
      if (!canEdit || !["rect", "circle", "arrow"].includes(activeDrawMode) || event.button > 0) return;
      event.preventDefault();
      event.stopPropagation();
      overlay.setPointerCapture?.(event.pointerId);
      const { x: pointerX, y: pointerY, width, height } = pointerToImagePoint(event);
      const nx = Math.max(0, Math.min(1, pointerX / width));
      const ny = Math.max(0, Math.min(1, pointerY / height));

      if (activeDrawMode === "rect") {
        drawing = { type: "rect", startX: nx, startY: ny, x: nx, y: ny, width: 0, height: 0 };
      } else if (activeDrawMode === "arrow") {
        drawing = { type: "arrow", x1: nx, y1: ny, x2: nx, y2: ny };
      } else {
        drawing = { type: "circle", x: nx, y: ny, radius: 0 };
      }
      renderCircles();
    });

    overlay.addEventListener("pointermove", (event) => {
      if (!canEdit) return;

      if (textDrag && event.pointerId === textDrag.pointerId) {
        event.preventDefault();
        event.stopPropagation();
        const dx = Math.abs(event.clientX - textDrag.startClientX);
        const dy = Math.abs(event.clientY - textDrag.startClientY);
        if (!textDrag.hasMoved && (dx > 3 || dy > 3)) {
          textDrag.hasMoved = true;
        }
        if (textDrag.hasMoved) {
          const { x: currentPointerX, y: currentPointerY, width, height } = pointerToImagePoint(event);
          const deltaX = (currentPointerX - textDrag.startPointerX) / Math.max(1, width);
          const deltaY = (currentPointerY - textDrag.startPointerY) / Math.max(1, height);

          const newX = Math.max(0.01, Math.min(0.99, textDrag.initialItemX + deltaX));
          const newY = Math.max(0.01, Math.min(0.99, textDrag.initialItemY + deltaY));

          const item = circles[textDrag.targetIndex];
          if (item) {
            item.x = newX;
            item.y = newY;
            const px = newX * width;
            const py = newY * height;
            const textEl = textDrag.element.querySelector("text");
            if (textEl) {
              textEl.setAttribute("x", String(px));
              textEl.setAttribute("y", String(py));
              textEl.querySelectorAll("tspan").forEach((tspan) => {
                tspan.setAttribute("x", String(px));
              });
            }
            const hitBox = textDrag.element.querySelector(".text-drag-hitbox");
            if (hitBox) {
              const bw = Number(hitBox.dataset.width) || 40;
              const bh = Number(hitBox.dataset.height) || 28;
              hitBox.setAttribute("x", String(Math.round(px - bw / 2)));
              hitBox.setAttribute("y", String(Math.round(py - bh / 2)));
            }
          }
        }
        return;
      }

      if (!drawing) return;
      event.preventDefault();
      const { x: pointerX, y: pointerY, width, height } = pointerToImagePoint(event);
      const nx = Math.max(0, Math.min(1, pointerX / width));
      const ny = Math.max(0, Math.min(1, pointerY / height));

      if (drawing.type === "rect") {
        drawing.x = Math.min(drawing.startX, nx);
        drawing.y = Math.min(drawing.startY, ny);
        drawing.width = Math.abs(nx - drawing.startX);
        drawing.height = Math.abs(ny - drawing.startY);
      } else if (drawing.type === "arrow") {
        drawing.x2 = nx;
        drawing.y2 = ny;
      } else {
        const dx = (nx - drawing.x) * width;
        const dy = (ny - drawing.y) * height;
        drawing.radius = Math.hypot(dx, dy) / Math.min(width, height);
      }
      renderCircles();
    });

    const finishInteraction = (event) => {
      if (textDrag && (!event || event.pointerId === textDrag.pointerId)) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        try { overlay.releasePointerCapture?.(textDrag.pointerId); } catch (_) {}
        overlay.classList.remove("is-text-dragging");
        textDrag.element?.classList.remove("is-active-dragging");

        const wasMoved = textDrag.hasMoved;
        const targetIndex = textDrag.targetIndex;
        const item = circles[targetIndex];
        const clientX = event ? event.clientX : textDrag.startClientX;
        const clientY = event ? event.clientY : textDrag.startClientY;
        textDrag = null;

        if (wasMoved) {
          renderCircles();
          scheduleSave();
          updateControls();
        } else if (item && item.type === "text") {
          openTextPopover(clientX, clientY, item.x, item.y, targetIndex);
        }
        return;
      }

      if (!drawing) return;
      event.preventDefault();
      event.stopPropagation();
      if (drawing.type === "rect") {
        if (drawing.width >= 0.012 && drawing.height >= 0.012) {
          circles.push({
            type: "rect",
            x: drawing.x,
            y: drawing.y,
            width: drawing.width,
            height: drawing.height,
          });
          scheduleSave();
        }
      } else if (drawing.type === "arrow") {
        const dx = drawing.x2 - drawing.x1;
        const dy = drawing.y2 - drawing.y1;
        if (Math.hypot(dx, dy) >= 0.02) {
          circles.push({
            type: "arrow",
            x1: drawing.x1,
            y1: drawing.y1,
            x2: drawing.x2,
            y2: drawing.y2,
          });
          scheduleSave();
        }
      } else {
        if (drawing.radius >= 0.012) {
          circles.push({
            type: "circle",
            x: drawing.x,
            y: drawing.y,
            radius: drawing.radius,
          });
          scheduleSave();
        }
      }
      drawing = null;
      updateControls();
    };
    overlay.addEventListener("pointerup", finishInteraction);
    overlay.addEventListener("pointercancel", finishInteraction);

    const resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(updateOverlaySize)
      : null;
    resizeObserver?.observe(image);
    window.addEventListener("resize", updateOverlaySize);
    if (image.complete) updateOverlaySize();
    else image.addEventListener("load", updateOverlaySize, { once: true });
    updateControls();

    return async () => {
      closeTextPopover();
      window.clearTimeout(saveTimer);
      saveTimer = 0;
      if (revision > savedRevision) {
        await saveSnapshot(circles.map((item) => ({ ...item })), revision);
      } else {
        await saveChain;
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateOverlaySize);
      toolbar?.remove();
      overlay.remove();
    };
  }

  function refreshSafetyPhotoAnnotationThumbnail(image, annotations = undefined) {
    if (!(image instanceof HTMLImageElement) || (!image.matches("[data-safety-annotations]") && !image.matches("[data-guide-annotations]"))) return;
    if (annotations !== undefined) {
      image.__latestSafetyAnnotations = annotations;
    } else {
      delete image.__latestSafetyAnnotations;
    }
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
      wrapper.appendChild(overlay);
    }
    const render = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) return;
      const imageRect = image.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      if (!imageRect.width || !imageRect.height || !wrapperRect.width || !wrapperRect.height) return;
      const objectFit = window.getComputedStyle(image).objectFit;
      const aspectMode = objectFit === "cover"
        ? "xMidYMid slice"
        : objectFit === "fill"
          ? "none"
          : "xMidYMid meet";
      overlay.setAttribute("viewBox", `0 0 ${width} ${height}`);
      overlay.setAttribute("preserveAspectRatio", aspectMode);
      overlay.style.left = `${imageRect.left - wrapperRect.left}px`;
      overlay.style.top = `${imageRect.top - wrapperRect.top}px`;
      overlay.style.width = `${imageRect.width}px`;
      overlay.style.height = `${imageRect.height}px`;

      const sourceData = image.__latestSafetyAnnotations !== undefined
        ? image.__latestSafetyAnnotations
        : (image.dataset.safetyAnnotations || image.dataset.guideAnnotations || "[]");
      const items = normalizeAnnotations(sourceData);
      overlay.replaceChildren(...items.map((item, index) => {
        const type = item.type || (Number.isFinite(Number(item.radius)) ? "circle" : "rect");
        if (type === "rect") return createRectElement(item, index, width, height, false, false);
        if (type === "arrow") return createArrowElement(item, index, width, height, false, false);
        if (type === "text") return createTextElement(item, index, width, height, false, false);
        return createCircleElement(item, index, width, height, false, false);
      }));
    };
    image.__safetyPhotoThumbRender = render;
    if (image.complete && image.naturalWidth) render();
    if (!image.__safetyPhotoThumbLoadWired) {
      image.__safetyPhotoThumbLoadWired = true;
      image.addEventListener("load", () => image.__safetyPhotoThumbRender?.());
    }
    if (!image.__safetyPhotoThumbResizeObserver && typeof ResizeObserver === "function") {
      image.__safetyPhotoThumbResizeObserver = new ResizeObserver(() => image.__safetyPhotoThumbRender?.());
      image.__safetyPhotoThumbResizeObserver.observe(image);
      image.__safetyPhotoThumbResizeObserver.observe(wrapper);
    }
  }

  function mountSafetyPhotoAnnotationThumbnails(root = document) {
    if (root.matches?.("img[data-safety-annotations], img[data-guide-annotations]")) refreshSafetyPhotoAnnotationThumbnail(root);
    root.querySelectorAll?.("img[data-safety-annotations], img[data-guide-annotations]").forEach((image) => refreshSafetyPhotoAnnotationThumbnail(image));
  }
window.mountImageCircleAnnotator = mountImageCircleAnnotator;
  window.mountImageViewerInteractions = mountImageViewerInteractions;
  window.refreshSafetyPhotoAnnotationThumbnail = refreshSafetyPhotoAnnotationThumbnail;
  window.normalizeAnnotations = normalizeAnnotations;
  window.normalizeCircles = normalizeAnnotations;
  mountSafetyPhotoAnnotationThumbnails();
  if (typeof MutationObserver === "function" && document.body) {
    const thumbnailObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.target.matches?.("img[data-safety-annotations], img[data-guide-annotations]")) {
          refreshSafetyPhotoAnnotationThumbnail(mutation.target);
        }
        mutation.addedNodes?.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) mountSafetyPhotoAnnotationThumbnails(node);
        });
      });
    });
    thumbnailObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-safety-annotations", "data-guide-annotations", "src"] });
  }
})();
