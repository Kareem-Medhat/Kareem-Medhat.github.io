import { CategoryKind, loadData, toSiteUrl } from "./data.js";
import { el } from "./ui.js";

// Versions that share a guide page (3DMark Time Spy and Steel Nomad) become one entry.
const toGuideEntries = (benchmarks) => {
  const entries = benchmarks.flatMap((benchmark) => {
    return benchmark.versions.map((version) => {
      return { benchmark, version };
    });
  });
  return [...Map.groupBy(entries, (entry) => entry.version.guide).entries()].map(([guide, group]) => {
    return {
      guide,
      benchmark: group[0].benchmark,
      title: `${group[0].benchmark.name} ${group.map((entry) => entry.version.name).join(", ")}`,
    };
  });
};

const toGuideItem = ({ guide, benchmark, title }) => {
  const categoryLabels = Object.freeze({
    [CategoryKind.Cpu]: "Tests your processor (CPU)",
    [CategoryKind.Gpu]: "Tests your graphics card (GPU)",
    [CategoryKind.Storage]: "Tests your storage drive",
    [CategoryKind.Stress]: "Stress test: a health check",
  });
  return el("li", {
    attrs: { class: "guide-card" },
    children: [
      el("a", { attrs: { href: toSiteUrl(guide) }, children: [title] }),
      el("span", {
        attrs: { class: `tag tag--${benchmark.category}` },
        children: [categoryLabels[benchmark.category]],
      }),
    ],
  });
};

const showGuides = async (list) => {
  const { benchmarks } = await loadData();
  list.replaceChildren(...toGuideEntries(benchmarks).map(toGuideItem));
};

document.querySelectorAll("[data-guide-list]").forEach((list) => {
  showGuides(list).catch((error) => {
    console.error("Could not load the guide list", error);
    list.replaceChildren(el("li", { children: ["Couldn't load the guide list. Try reloading the page."] }));
  });
});
