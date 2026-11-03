const STORAGE_KEY = "checker:last-entries";

const toChoice = (value) => {
  return typeof value === "string" && value !== "" ? value : undefined;
};

export const readEntries = (form) => {
  const formData = new FormData(form);
  return {
    type: toChoice(formData.get("type")),
    ff: toChoice(formData.get("ff")),
    hw: toChoice(formData.get("hw")),
    b: toChoice(formData.get("b")),
    v: toChoice(formData.get("v")),
    t: toChoice(formData.get("t")),
    score: toChoice(formData.get("score")),
    stable: toChoice(formData.get("stable")),
    temp: toChoice(formData.get("temp")),
  };
};

const readStoredQuery = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    // Storage can be blocked; the checker then simply starts empty.
    return undefined;
  }
};

export const readStartEntries = (benchmarks) => {
  const fromUrl = new URLSearchParams(window.location.search);
  const params = fromUrl.size > 0 ? fromUrl : new URLSearchParams(readStoredQuery());
  const b = toChoice(params.get("b"));
  return {
    type: toChoice(params.get("type")) ?? benchmarks.find((benchmark) => benchmark.id === b)?.comparedBy,
    ff: toChoice(params.get("ff")),
    hw: toChoice(params.get("hw")),
    b,
    v: toChoice(params.get("v")),
    t: toChoice(params.get("t")),
    score: toChoice(params.get("score")),
  };
};

export const applyStartEntries = ({ form, entries }) => {
  [
    ["type", entries.type],
    ["ff", entries.ff],
  ]
    .filter(([, value]) => value !== undefined)
    .forEach(([name, value]) => {
      const radio = [...form.querySelectorAll(`input[name="${name}"]`)].find((input) => input.value === value);
      radio?.toggleAttribute("checked", true);
    });
  if (entries.score !== undefined) {
    form.querySelector('input[name="score"]')?.setAttribute("value", entries.score);
  }
};

export const saveEntries = (entries) => {
  const query = new URLSearchParams(Object.entries(entries).filter(([, value]) => value !== undefined)).toString();
  window.history.replaceState(null, "", query === "" ? window.location.pathname : `?${query}`);
  try {
    localStorage.setItem(STORAGE_KEY, query);
  } catch {
    // Storage can be blocked; the URL still holds the entries.
  }
};

export const toSavedEntries = (selection) => {
  return {
    type: selection.type,
    ff: selection.formFactor,
    hw: selection.hardware?.id,
    b: selection.benchmark?.id,
    v: selection.version?.id,
    t: selection.test?.id,
    score: selection.entries.score,
  };
};
