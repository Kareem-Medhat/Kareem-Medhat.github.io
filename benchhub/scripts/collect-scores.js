#!/usr/bin/env node
// Collects reference scores from the sources in data/sources.json and merges them into
// copies of data/hardware.json and data/scores.json.
//
//   node scripts/collect-scores.js --out <dir> --report <file> --cache-dir <dir>
//                                  [--only <regex>] [--sources ul,notebookcheck] [--minutes <n>]
//
// --out data  updates the site's data in place; any other directory gives a preview.
// --only      limits the run to hardware whose source name matches, e.g. "A2000|Xeon".
// --sources   limits the run to some collectors. A full Notebookcheck run opens a few
//             thousand pages and takes hours; "--sources ul" is two pages.
// --minutes   stops starting new Notebookcheck chips after this long and saves what it has.
//             Chips new to the catalog go first, most widely tested first, so a short
//             run covers the most popular missing hardware.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { resolveHardware, ResolutionKind, toCatalogIndex, toUniqueHardware } from "./collect/catalog.js";
import { config } from "./collect/config.js";
import { findDisagreements, mergeScores, toTestKey } from "./collect/merge.js";
import { collectChip, listChips } from "./collect/notebookcheck-collector.js";
import { ProblemKind } from "./collect/problem.js";
import { mapSequentially } from "./collect/sequence.js";
import { collectUl } from "./collect/ul-collector.js";

const dataDir = fileURLToPath(new URL("../data/", import.meta.url));

const readJson = async (file) => JSON.parse(await readFile(join(dataDir, file), "utf8"));

const writeJson = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`);

const { values: args } = parseArgs({
  options: {
    out: { type: "string" },
    report: { type: "string" },
    "cache-dir": { type: "string" },
    only: { type: "string" },
    sources: { type: "string" },
    minutes: { type: "string" },
  },
});
if (args.out === undefined || args.report === undefined || args["cache-dir"] === undefined) {
  throw new Error("Usage: collect-scores.js --out <dir> --report <file> --cache-dir <dir> [--only <regex>] [--sources ul,notebookcheck]");
}
const cacheDir = args["cache-dir"];
const nameFilter = new RegExp(args.only ?? "", "i");
const CollectorKind = Object.freeze({ Ul: "ul", Notebookcheck: "notebookcheck" });
const collectorKinds = args.sources === undefined ? Object.values(CollectorKind) : args.sources.split(",");
const unknownCollectors = collectorKinds.filter((kind) => !Object.values(CollectorKind).includes(kind));
if (unknownCollectors.length > 0) {
  throw new Error(`Unknown --sources value: ${unknownCollectors.join(", ")}. Use ${Object.values(CollectorKind).join(",")}.`);
}

const [hardware, scores, sources, benchmarks] = await Promise.all(
  ["hardware.json", "scores.json", "sources.json", "benchmarks.json"].map(readJson),
);

const sourceIds = new Set(sources.map((source) => source.id));
const registeredTests = new Set(
  benchmarks.flatMap((benchmark) => {
    return benchmark.versions.flatMap((version) => {
      return (version.tests ?? version.presets).map((test) => {
        return toTestKey({ benchmark: benchmark.id, version: version.id, test: test.id });
      });
    });
  }),
);
const configuredTests = [config.ul, ...config.notebookcheck.tests];
const unregistered = [
  ...[config.ul.sourceId, config.notebookcheck.sourceId].filter((id) => !sourceIds.has(id)),
  ...configuredTests.map(toTestKey).filter((key) => !registeredTests.has(key)),
];
if (unregistered.length > 0) {
  throw new Error(`scripts/collect/config.js refers to sources or tests missing from data/: ${unregistered.join(", ")}`);
}

const catalogIndex = toCatalogIndex({ hardware, vendors: config.vendors });
const existingUrlsByChart = new Map(
  [...Map.groupBy(scores, (score) => `${score.hardwareId}|${toTestKey(score)}|${score.sourceId}`)].map(([key, group]) => {
    return [key, new Set(group.map((score) => score.url))];
  }),
);

const resolve = ({ name, type, formFactor }) => {
  return resolveHardware({ name, type, formFactor, catalogIndex, config });
};

const toResolutionProblems = (resolution) => {
  if (resolution.kind === ResolutionKind.UnsupportedVendor) {
    return [{ kind: ProblemKind.UnsupportedVendor, name: resolution.name }];
  }
  if (resolution.kind === ResolutionKind.UnknownAlias) {
    return [{ kind: ProblemKind.UnknownAlias, name: resolution.name, aliasId: resolution.aliasId }];
  }
  return [];
};

const chipList = collectorKinds.includes(CollectorKind.Notebookcheck) ? await listChips({ config, cacheDir }) : { chips: [], problems: [] };
const MS_PER_MINUTE = 60_000;
const deadlineMs = args.minutes === undefined ? Number.POSITIVE_INFINITY : Date.now() + Number(args.minutes) * MS_PER_MINUTE;
if (Number.isNaN(deadlineMs)) {
  throw new Error(`--minutes must be a number, got "${args.minutes}"`);
}
const isInCatalog = (chip) => {
  return resolve({ name: chip.name, type: chip.hardwareType, formFactor: chip.formFactor }).kind === ResolutionKind.Existing;
};
const wantedChips = chipList.chips
  .filter((chip) => chip.hasListedScores && nameFilter.test(chip.name))
  .toSorted((a, b) => Number(isInCatalog(a)) - Number(isInCatalog(b)) || b.testedDeviceCount - a.testedDeviceCount);
console.log(`Notebookcheck: ${wantedChips.length} of ${chipList.chips.length} chips have listed scores and match the filter.`);

const chipResults = await mapSequentially(wantedChips, async (chip) => {
  const resolution = resolve({ name: chip.name, type: chip.hardwareType, formFactor: chip.formFactor });
  if (resolution.kind !== ResolutionKind.Existing && resolution.kind !== ResolutionKind.New) {
    return { candidates: [], problems: toResolutionProblems(resolution) };
  }
  if (Date.now() > deadlineMs) {
    return { candidates: [], problems: [{ kind: ProblemKind.TimeLimitReached, name: chip.name }] };
  }
  const result = await collectChip({
    chip,
    config,
    cacheDir,
    toExistingUrls: (test) => {
      return existingUrlsByChart.get(`${resolution.hardware.id}|${toTestKey(test)}|${config.notebookcheck.sourceId}`) ?? new Set();
    },
  });
  console.log(`  ${chip.name} (${chip.formFactor}): ${result.candidates.length} scores, ${result.problems.length} problems`);
  return result;
});

const ulResult = collectorKinds.includes(CollectorKind.Ul) ? await collectUl({ config, cacheDir, nameFilter }) : { candidates: [], problems: [] };
console.log(`UL: ${ulResult.candidates.length} ranking rows match the filter.`);

// Notebookcheck comes first so that, for hardware new to the catalog, its fuller model
// names win over UL's shortened ones.
const resolved = [...chipResults.flatMap((result) => result.candidates), ...ulResult.candidates].map((candidate) => {
  return { candidate, resolution: resolve(candidate) };
});
const firstSeenNew = new Map(
  resolved
    .filter(({ resolution }) => resolution.kind === ResolutionKind.New)
    .toReversed()
    .map(({ resolution }) => [resolution.matchKey, resolution.hardware]),
);
const uniqueNew = toUniqueHardware({ newHardware: [...firstSeenNew.values()], catalogIndex });
const newHardwareByMatchKey = new Map([...firstSeenNew.keys()].map((matchKey, index) => [matchKey, uniqueNew[index]]));
const newHardware = uniqueNew.toSorted((a, b) => a.id.localeCompare(b.id));
const duplicateIds = [...Map.groupBy(newHardware, (item) => item.id)].filter(([, group]) => group.length > 1).map(([id]) => id);
if (duplicateIds.length > 0) {
  throw new Error(`Two different chips produced the same hardware id; add them to hardwareAliases in config.js: ${duplicateIds.join(", ")}`);
}

const toHardwareId = (resolution) => {
  return resolution.kind === ResolutionKind.New ? newHardwareByMatchKey.get(resolution.matchKey).id : resolution.hardware.id;
};

const collectedScores = resolved
  .filter(({ resolution }) => resolution.kind === ResolutionKind.Existing || resolution.kind === ResolutionKind.New)
  .map(({ candidate, resolution }) => {
    return {
      hardwareId: toHardwareId(resolution),
      benchmark: candidate.benchmark,
      version: candidate.version,
      test: candidate.test,
      value: candidate.value,
      sourceId: candidate.sourceId,
      url: candidate.url,
      retrievedDate: candidate.retrievedDate,
      // Both sources report hardware as shipped; neither publishes overclocked runs in these charts.
      conditions: { formFactor: candidate.formFactor, stock: true, notes: candidate.notes },
    };
  });

const mergedScores = mergeScores({ existing: scores, collected: collectedScores });
const report = {
  newHardware,
  collectedScores,
  disagreements: findDisagreements({ scores: mergedScores, ratio: config.disagreementRatio }),
  problems: [
    ...chipList.problems,
    ...chipResults.flatMap((result) => result.problems),
    ...ulResult.problems,
    ...resolved.flatMap(({ resolution }) => toResolutionProblems(resolution)),
  ],
};

await mkdir(args.out, { recursive: true });
await writeJson(join(args.out, "hardware.json"), [...hardware, ...newHardware]);
await writeJson(join(args.out, "scores.json"), mergedScores);
await writeJson(args.report, report);

console.log(`New hardware: ${newHardware.length}. Scores collected: ${collectedScores.length} (${mergedScores.length - scores.length} new).`);
console.log(`Source disagreements: ${report.disagreements.length}. Problems: ${report.problems.length}. Details: ${args.report}`);
