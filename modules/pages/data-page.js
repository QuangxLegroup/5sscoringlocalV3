(() => {
  "use strict";

  function render(context) {
    context.legacyRenderers.data();
  }

  window.PageRegistry.register({
    id: "data",
    title: "Dữ liệu",
    render,
  });
})();