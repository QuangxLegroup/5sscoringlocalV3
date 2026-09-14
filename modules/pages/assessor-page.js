(() => {
  "use strict";

  function render(context) {
    context.legacyRenderers.assessor();
  }

  window.PageRegistry.register({
    id: "assessor",
    title: "Phiếu chấm",
    render,
  });
})();