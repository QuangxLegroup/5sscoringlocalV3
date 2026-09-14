(() => {
  "use strict";

  function render(context) {
    context.legacyRenderers.catalog();
  }

  window.PageRegistry.register({
    id: "catalog",
    title: "Danh mục",
    render,
  });
})();