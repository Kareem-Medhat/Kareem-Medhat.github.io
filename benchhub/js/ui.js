import { loadSite } from "./data.js";

const ThemeKind = Object.freeze({ Light: "light", Dark: "dark" });

// style-exception: §4 A, the DOM builds nodes by mutation; the node is complete before it is returned
export const el = (tag, { attrs = {}, children = [] } = {}) => {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
  node.append(...children);
  return node;
};

const toCurrentTheme = () => {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === ThemeKind.Light || chosen === ThemeKind.Dark) {
    return chosen;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? ThemeKind.Dark : ThemeKind.Light;
};

const showTheme = (button) => {
  button.setAttribute("aria-pressed", String(toCurrentTheme() === ThemeKind.Dark));
};

const setUpThemeToggle = (button) => {
  // Same key as the rest of this GitHub Pages origin, so one choice applies everywhere.
  const themeStorageKey = "theme";
  showTheme(button);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => showTheme(button));
  button.addEventListener("click", () => {
    const theme = toCurrentTheme() === ThemeKind.Dark ? ThemeKind.Light : ThemeKind.Dark;
    document.documentElement.setAttribute("data-theme", theme);
    showTheme(button);
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch {
      // Storage can be blocked; the theme still applies for this page view.
    }
  });
};

const showSiteName = async () => {
  const site = await loadSite();
  document.querySelectorAll("[data-site-name]").forEach((node) => node.replaceChildren(site.name));
  document.querySelectorAll("[data-site-tagline]").forEach((node) => node.replaceChildren(site.tagline));
  document.querySelector("title")?.replaceChildren(`${document.title} · ${site.name}`);
};

document.querySelectorAll("[data-theme-toggle]").forEach(setUpThemeToggle);
showSiteName().catch((error) => console.error("Could not show the site name", error));
