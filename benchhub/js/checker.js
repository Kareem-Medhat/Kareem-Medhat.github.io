import { loadData } from "./data.js";
import { el } from "./ui.js";
import { applyStartEntries, readEntries, readStartEntries, saveEntries, toSavedEntries } from "./checker/entries.js";
import { findElements, renderForm } from "./checker/form.js";
import { renderResult } from "./checker/result.js";
import { toSelection } from "./checker/selection.js";

const start = async () => {
  const elements = findElements();
  const data = await loadData();
  const startEntries = readStartEntries(data.benchmarks);
  applyStartEntries({ form: elements.form, entries: startEntries });
  const update = () => {
    const selection = toSelection({ data, entries: readEntries(elements.form), startEntries });
    renderForm({ elements, selection });
    renderResult({ result: elements.result, selection });
    saveEntries(toSavedEntries(selection));
  };
  elements.form.addEventListener("input", update);
  elements.form.addEventListener("submit", (event) => event.preventDefault());
  update();
};

start().catch((error) => {
  console.error("The checker could not start", error);
  document
    .getElementById("result")
    ?.replaceChildren(el("p", { children: ["Couldn't load the reference data. Check your connection and reload the page."] }));
});
