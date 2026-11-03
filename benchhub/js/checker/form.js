import { CategoryKind, HardwareTypeKind, TestLabelKind, toHardwareName, toSiteUrl } from "../data.js";
import { el } from "../ui.js";
import { Combobox } from "./combobox.js";
import { formFactorLabels } from "./labels.js";

const getElement = (id) => {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`check.html is missing #${id}`);
  }
  return element;
};

export const findElements = () => {
  return {
    form: getElement("checker-form"),
    hardware: new Combobox({
      input: getElement("hw-input"),
      toggle: getElement("hw-toggle"),
      listbox: getElement("hw-listbox"),
      empty: getElement("hw-empty"),
      valueInput: getElement("hw"),
    }),
    hardwareLabel: getElement("hw-label"),
    benchmark: getElement("b"),
    version: getElement("v"),
    test: getElement("t"),
    testLabel: getElement("t-label"),
    versionHint: getElement("v-hint"),
    dataNote: getElement("data-note"),
    scoreStep: getElement("score-step"),
    scoreHint: getElement("score-hint"),
    stressStep: getElement("stress-step"),
    tempField: getElement("temp-field"),
    result: getElement("result"),
  };
};

const toOption = ({ value, label, isSelected }) => {
  return el("option", { attrs: isSelected ? { value, selected: "" } : { value }, children: [label] });
};

const renderSelect = ({ select, placeholder, choice, toValue }) => {
  const selectedValue = choice.selected === undefined ? undefined : toValue(choice.selected);
  select.replaceChildren(
    toOption({ value: "", label: placeholder, isSelected: selectedValue === undefined }),
    ...choice.options.map((option) => {
      return toOption({ ...option, isSelected: option.value === selectedValue });
    }),
  );
  select.toggleAttribute("disabled", choice.options.length === 0);
};

const toDataNote = ({ hardware, formFactor, wantedBenchmark, benchmarks }) => {
  // The stress health check needs no reference data, so a "no data" note would only confuse.
  if (hardware === undefined || wantedBenchmark?.category === CategoryKind.Stress) {
    return undefined;
  }
  const where = `${toHardwareName(hardware)} (${formFactorLabels[formFactor]})`;
  const helpLink = el("a", { attrs: { href: toSiteUrl("help.html#no-data") }, children: ["What can I do?"] });
  if (wantedBenchmark !== undefined && !benchmarks.includes(wantedBenchmark)) {
    return [`No trusted data yet for ${wantedBenchmark.name} on ${where}. `, helpLink];
  }
  if (benchmarks.every((benchmark) => benchmark.category === CategoryKind.Stress)) {
    return [`No trusted data yet for ${where}. `, helpLink];
  }
  return undefined;
};

export const renderForm = ({ elements, selection }) => {
  const hardwareLabels = Object.freeze({
    [HardwareTypeKind.Cpu]: { field: "Your CPU", placeholder: "Search, for example 7800X3D" },
    [HardwareTypeKind.Gpu]: { field: "Your graphics card", placeholder: "Search, for example 4070" },
  });
  const { type, benchmark, version, choices } = selection;
  const toId = (item) => item.id;

  elements.hardwareLabel.replaceChildren(hardwareLabels[type].field);
  elements.hardware.replaceOptions({
    options: choices.hardware.options,
    selectedValue: selection.hardware?.id,
    placeholder: hardwareLabels[type].placeholder,
  });
  renderSelect({ select: elements.benchmark, placeholder: "Choose a benchmark", choice: choices.benchmark, toValue: toId });
  renderSelect({ select: elements.version, placeholder: "Choose a version", choice: choices.version, toValue: toId });
  const testLabel = version?.testLabel === TestLabelKind.Preset ? "Preset" : "Test";
  elements.testLabel.replaceChildren(testLabel);
  renderSelect({ select: elements.test, placeholder: `Choose a ${testLabel.toLowerCase()}`, choice: choices.test, toValue: toId });

  const dataNote = toDataNote({
    hardware: selection.hardware,
    formFactor: selection.formFactor,
    wantedBenchmark: selection.wantedBenchmark,
    benchmarks: choices.benchmark.items,
  });
  elements.dataNote.replaceChildren(...(dataNote ?? []));
  elements.dataNote.toggleAttribute("hidden", dataNote === undefined);

  elements.versionHint.replaceChildren(version?.note ?? "");
  elements.versionHint.toggleAttribute("hidden", version?.note === undefined);

  const isStressSelected = benchmark?.category === CategoryKind.Stress;
  elements.scoreStep.toggleAttribute("hidden", isStressSelected);
  elements.stressStep.toggleAttribute("hidden", !isStressSelected);
  elements.tempField.toggleAttribute("hidden", selection.temperatureLimit === undefined);
  elements.scoreHint.replaceChildren(
    benchmark === undefined ? "" : `In ${benchmark.unit}. ${benchmark.higherIsBetter ? "Higher is better." : "Lower is better."}`,
  );
};
