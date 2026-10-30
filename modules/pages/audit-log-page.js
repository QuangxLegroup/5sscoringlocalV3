(() => {
  "use strict";

  function render(context) {
    if (typeof context?.legacyRenderers?.["audit-log"] === "function") {
      context.legacyRenderers["audit-log"]();
    }
  }

  window.PageRegistry.register({
    id: "audit-log",
    title: "Lịch sử chỉnh sửa",
    render,
  });
})();
