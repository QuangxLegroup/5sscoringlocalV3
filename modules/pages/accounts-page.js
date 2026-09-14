(() => {
  "use strict";

  function render(context) {
    context.legacyRenderers.accounts();
  }

  window.PageRegistry.register({
    id: "accounts",
    title: "Tài khoản",
    render,
  });
})();