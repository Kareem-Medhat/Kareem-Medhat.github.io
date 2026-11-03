"use strict";

const ThemeKind = { Dark: "dark", Light: "light" };

// Must match the key read by the inline script in <head>, which applies the theme before first paint.
const THEME_STORAGE_KEY = "theme";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const persistTheme = (theme) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked (private mode, strict settings); the theme still applies for this visit.
  }
};

const toggleTheme = (root) => {
  const theme = root.dataset.theme === ThemeKind.Light ? ThemeKind.Dark : ThemeKind.Light;
  root.dataset.theme = theme;
  persistTheme(theme);
};

const setupNav = (nav, { scrolledOffsetPx }) => {
  const menuButton = nav.querySelector("[data-menu-button]");
  const setMenuOpen = (isOpen) => {
    nav.classList.toggle("is-open", isOpen);
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  };
  const markScrolled = () => nav.classList.toggle("is-scrolled", window.scrollY > scrolledOffsetPx);

  menuButton.addEventListener("click", () => setMenuOpen(!nav.classList.contains("is-open")));
  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenuOpen(false)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenuOpen(false);
  });
  window.addEventListener("scroll", markScrolled, { passive: true });
  markScrolled();
};

const onceVisible = (elements, onVisible, { threshold, rootMargin }) => {
  const observer = new IntersectionObserver(
    (entries) =>
      entries
        .filter((entry) => entry.isIntersecting)
        .forEach((entry) => {
          observer.unobserve(entry.target);
          onVisible(entry.target);
        }),
    { threshold, rootMargin },
  );
  elements.forEach((element) => observer.observe(element));
};

// Sections without a nav link (the hero) are observed too, so scrolling back to them clears the highlight.
const highlightActiveSection = (links, sections, { rootMargin }) => {
  const linksBySectionId = new Map(links.map((link) => [link.hash.slice(1), link]));
  const observer = new IntersectionObserver(
    (entries) =>
      entries
        .filter((entry) => entry.isIntersecting)
        .forEach((entry) => {
          links.forEach((link) => link.removeAttribute("aria-current"));
          linksBySectionId.get(entry.target.id)?.setAttribute("aria-current", "true");
        }),
    { rootMargin },
  );
  sections.forEach((section) => observer.observe(section));
};

const trackPointer = (elements) =>
  elements.forEach((element) =>
    element.addEventListener("pointermove", (event) => {
      const bounds = element.getBoundingClientRect();
      element.style.setProperty("--mx", `${event.clientX - bounds.left}px`);
      element.style.setProperty("--my", `${event.clientY - bounds.top}px`);
    }),
  );

const animateCount = (element, { durationMs }) => {
  const target = Number(element.dataset.count);
  const startedAt = performance.now();
  const step = (now) => {
    const progress = Math.min((now - startedAt) / durationMs, 1);
    const eased = 1 - (1 - progress) ** 3;
    element.textContent = Math.round(target * eased).toLocaleString("en-US");
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

const typeText = async (target, text, { charDelayMs }) => {
  for (const prefix of Array.from(text, (_, index) => text.slice(0, index + 1))) {
    target.textContent = prefix;
    await sleep(charDelayMs);
  }
};

// Lines are written in full in the HTML so the terminal reads correctly without JS; this replays them.
const playTerminal = async (terminal, { charDelayMs, commandPauseMs, outputPauseMs }) => {
  const lines = [...terminal.querySelectorAll(".term__line")];
  const caret = terminal.querySelector(".caret");
  const commandsByLine = new Map(
    lines
      .filter((line) => line.classList.contains("term__line--cmd"))
      .map((line) => [line, line.querySelector(".term__cmd").textContent]),
  );

  lines.forEach((line) => line.classList.add("is-pending"));
  commandsByLine.forEach((_, line) => {
    line.querySelector(".term__cmd").textContent = "";
  });

  for (const line of lines) {
    line.classList.remove("is-pending");
    const command = commandsByLine.get(line);
    if (command === undefined) {
      await sleep(outputPauseMs);
      continue;
    }
    const target = line.querySelector(".term__cmd");
    target.after(caret);
    await sleep(commandPauseMs);
    await typeText(target, command, { charDelayMs });
    await sleep(commandPauseMs);
  }
};

const trackTimelineProgress = (timeline, { anchorRatio }) => {
  const update = () => {
    const bounds = timeline.getBoundingClientRect();
    const anchor = window.innerHeight * anchorRatio;
    const progress = Math.min(Math.max((anchor - bounds.top) / bounds.height, 0), 1);
    timeline.style.setProperty("--progress", progress.toFixed(3));
  };
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
};

const setupCopyButton = (button, { resetMs }) => {
  const label = button.querySelector("[data-copy-label]");
  const idleText = label.textContent;
  const email = button.dataset.copy;
  const showCopied = () => {
    button.classList.add("is-copied");
    label.textContent = "Copied!";
    setTimeout(() => {
      button.classList.remove("is-copied");
      label.textContent = idleText;
    }, resetMs);
  };
  // The Clipboard API is missing on insecure origins and can be denied; opening the mail client still gets the address across.
  const openMailClient = () => window.location.assign(`mailto:${email}`);

  button.addEventListener("click", () => {
    if (!navigator.clipboard) {
      openMailClient();
      return;
    }
    navigator.clipboard.writeText(email).then(showCopied, openMailClient);
  });
};

const showLocalTime = (element, { timeZone, refreshMs }) => {
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" });
  const render = () => {
    element.textContent = formatter.format(new Date());
  };
  render();
  setInterval(render, refreshMs);
};

// Reveal first: content stays hidden under `.js .reveal` until this runs.
onceVisible(document.querySelectorAll(".reveal"), (element) => element.classList.add("is-visible"), {
  threshold: 0.12,
  rootMargin: "0px 0px -6% 0px",
});

document.querySelector("[data-theme-toggle]").addEventListener("click", () => toggleTheme(document.documentElement));
setupNav(document.querySelector(".nav"), { scrolledOffsetPx: 8 });
highlightActiveSection([...document.querySelectorAll(".nav__links a")], document.querySelectorAll("main section[id]"), {
  rootMargin: "-45% 0px -50% 0px",
});
trackPointer(document.querySelectorAll(".card, .hero"));
trackTimelineProgress(document.querySelector(".timeline"), { anchorRatio: 0.6 });
setupCopyButton(document.querySelector("[data-copy]"), { resetMs: 2000 });
showLocalTime(document.querySelector("[data-local-time]"), { timeZone: "Africa/Cairo", refreshMs: 30_000 });

if (!isReducedMotion()) {
  const counters = document.querySelectorAll("[data-count]");
  counters.forEach((counter) => {
    counter.textContent = "0";
  });
  onceVisible(counters, (counter) => animateCount(counter, { durationMs: 1800 }), { threshold: 0.6, rootMargin: "0px" });
  playTerminal(document.querySelector(".terminal"), { charDelayMs: 34, commandPauseMs: 380, outputPauseMs: 120 });
}
