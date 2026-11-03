import { CategoryKind, FormFactorKind, HardwareTypeKind, toComparisonKey, toHardwareName } from "../data.js";

// A sole option is picked for the user; otherwise `wanted` is kept only while it is on offer.
const toSelectChoice = ({ items, toOptionOf, wanted }) => {
  const options = items.map(toOptionOf);
  const wantedValue = options.length === 1 ? options[0].value : wanted;
  return {
    items,
    options,
    selected: items.find((item) => toOptionOf(item).value === wantedValue),
  };
};

export const toSelection = ({ data, entries, startEntries }) => {
  const type = entries.type ?? HardwareTypeKind.Cpu;
  const formFactor = entries.ff ?? FormFactorKind.Desktop;
  const isStress = (benchmark) => benchmark.category === CategoryKind.Stress;

  const hardwareChoice = toSelectChoice({
    items: data.hardware.filter((item) => {
      return item.type === type && item.formFactor === formFactor;
    }),
    toOptionOf: (item) => {
      return { value: item.id, label: toHardwareName(item) };
    },
    wanted: entries.hw ?? startEntries.hw,
  });
  const hardware = hardwareChoice.selected;

  const hardwareScores = data.scores.filter((score) => {
    return score.hardwareId === hardware?.id && score.conditions.formFactor === formFactor;
  });
  const benchmarkIds = new Set(hardwareScores.map((score) => score.benchmark));
  const versionKeys = new Set(hardwareScores.map((score) => `${score.benchmark}/${score.version}`));
  const comparisonKeys = new Set(hardwareScores.map((score) => score.comparisonKey));

  const wantedBenchmarkId = entries.b ?? startEntries.b;
  const benchmarkChoice = toSelectChoice({
    items:
      hardware === undefined
        ? []
        : data.benchmarks.filter((item) => item.comparedBy === type && (isStress(item) || benchmarkIds.has(item.id))),
    toOptionOf: (item) => {
      return { value: item.id, label: item.name };
    },
    wanted: wantedBenchmarkId,
  });
  const benchmark = benchmarkChoice.selected;

  const versionChoice = toSelectChoice({
    items:
      benchmark === undefined
        ? []
        : benchmark.versions.filter((item) => isStress(benchmark) || versionKeys.has(`${benchmark.id}/${item.id}`)),
    toOptionOf: (item) => {
      return { value: item.id, label: item.name };
    },
    wanted: entries.v ?? startEntries.v,
  });
  const version = versionChoice.selected;

  const toKey = (test) => {
    return toComparisonKey({ benchmark: benchmark?.id, version: version?.id, test: test.id });
  };
  const testChoice = toSelectChoice({
    items:
      benchmark === undefined || version === undefined
        ? []
        : version.tests.filter((item) => isStress(benchmark) || comparisonKeys.has(toKey(item))),
    toOptionOf: (item) => {
      return { value: item.id, label: item.name };
    },
    wanted: entries.t ?? startEntries.t,
  });
  const test = testChoice.selected;

  return {
    entries,
    type,
    formFactor,
    hardware,
    benchmark,
    version,
    test,
    choices: { hardware: hardwareChoice, benchmark: benchmarkChoice, version: versionChoice, test: testChoice },
    wantedBenchmark: data.benchmarks.find((item) => item.id === wantedBenchmarkId),
    references: test === undefined ? [] : hardwareScores.filter((score) => score.comparisonKey === toKey(test)),
    temperatureLimit: hardware === undefined ? undefined : data.temperatureLimitsByHardwareId.get(hardware.id),
  };
};
