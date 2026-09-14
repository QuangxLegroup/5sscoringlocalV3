(() => {
  "use strict";

  const pages = new Map();

  function register(page) {
    if (!page?.id || typeof page.render !== "function") {
      throw new Error("PageRegistry.register cần page có id và render(context).");
    }

    pages.set(page.id, { ...page });
  }

  function has(id) {
    return pages.has(id);
  }

  function render(id, context) {
    const page = pages.get(id);
    if (!page) {
      return false;
    }

    page.render(context);
    return true;
  }

  function list() {
    return [...pages.values()].map((page) => ({ id: page.id, title: page.title || page.id }));
  }

  window.PageRegistry = {
    has,
    list,
    register,
    render,
  };
})();