(() => {
  "use strict";

  function render(context) {
    if (typeof context?.legacyRenderers?.["guide-setup"] === "function") {
      context.legacyRenderers["guide-setup"]();
    }
  }

  window.PageRegistry.register({
    id: "guide-setup",
    title: "Thiết lập hướng dẫn",
    render,
  });
})();
