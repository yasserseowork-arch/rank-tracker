// content/parser.js (top-level #rso items)
// Developed by Ayub Ansary - SEO Specialist (https://ayubansary.com)
// Helping businesses grow beyond limitations
window.BT = window.BT || {};
(function () {
  function extractTopLevelItems(doc) {
    // Updated selectors to match current Google search result structure
    const rso = doc.querySelector("#search #rso") || doc.querySelector("#rso") || doc.querySelector("#search");
    if (!rso) return [];
    // More comprehensive selector for search result containers
    const kids = Array.from(rso.children);
    // Structural selection: "Duck Typing"
    // If it has an anchor with an H3, or an H3 with an anchor, it's a result.
    // We avoid specific classes like .g or .MjjYud which change often.
    const organic = kids.filter(k => {
      // Must not be a script or style
      if (k.tagName === "SCRIPT" || k.tagName === "STYLE") return false;
      // Must have a title link
      return k.querySelector("a h3") || k.querySelector("h3 a");
    });
    return organic;
  }
  window.BT.parser = { extractTopLevelItems };
})();