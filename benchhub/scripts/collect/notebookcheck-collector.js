import { parseChipList, parseChipPageRows, parseReviewValues } from "./notebookcheck.js";
import { loadPage, PageKind } from "./page-loader.js";
import { ProblemKind } from "./problem.js";
import { selectChartRows } from "./selection.js";
import { mapSequentially } from "./sequence.js";

const toPageProblem = (page) => {
  return { kind: ProblemKind.PageFailed, url: page.url, reason: page.reason };
};

const loadList = async ({ list, config, cacheDir }) => {
  const page = await loadPage({ url: list.url, cacheDir, http: config.http });
  if (page.kind === PageKind.Failed) {
    return { chips: [], problems: [toPageProblem(page)] };
  }
  const benchmarkIds = [...new Set(config.notebookcheck.tests.map((test) => test.benchmarkId))];
  return {
    chips: parseChipList({ html: page.html, benchmarkIds }).map((chip) => {
      return { ...chip, hardwareType: list.hardwareType };
    }),
    problems: [],
  };
};

export const listChips = async ({ config, cacheDir }) => {
  const results = await mapSequentially(config.notebookcheck.lists, (list) => {
    return loadList({ list, config, cacheDir });
  });
  return {
    chips: [...new Map(results.flatMap((result) => result.chips).map((chip) => [chip.url, chip])).values()],
    problems: results.flatMap((result) => result.problems),
  };
};

const toNotes = ({ row, test }) => {
  const parts = [`CPU: ${row.cpu}`, `GPU: ${row.gpu}`, `RAM: ${row.ram}`].filter((part) => !part.endsWith(": "));
  return `Tested in the ${row.model} (${parts.join("; ")}). Notebookcheck chart: ${test.label}.`;
};

const verifyReview = async ({ reviewUrl, picks, chip, config, cacheDir }) => {
  const page = await loadPage({ url: reviewUrl, cacheDir, http: config.http });
  if (page.kind === PageKind.Failed) {
    return { candidates: [], problems: [toPageProblem(page)] };
  }
  const checked = picks.map((pick) => {
    return { ...pick, reviewValues: parseReviewValues({ html: page.html, test: pick.test }) };
  });
  return {
    candidates: checked
      .filter((pick) => pick.reviewValues.includes(pick.row.value))
      .map(({ test, row }) => {
        return {
          name: chip.name,
          type: chip.hardwareType,
          formFactor: chip.formFactor,
          benchmark: test.benchmark,
          version: test.version,
          test: test.test,
          value: row.value,
          sourceId: config.notebookcheck.sourceId,
          url: reviewUrl,
          retrievedDate: page.retrievedDate,
          notes: toNotes({ row, test }),
          chartLabel: test.label,
        };
      }),
    problems: checked
      .filter((pick) => !pick.reviewValues.includes(pick.row.value))
      .map(({ test, row, reviewValues }) => {
        return { kind: ProblemKind.ValueNotInReview, chip: chip.name, url: reviewUrl, chart: test.label, listedValue: row.value, reviewValues };
      }),
  };
};

const toPickKey = ({ reviewUrl, test }) => `${reviewUrl}|${test.label}`;

// Some reviews don't print every value the chip page credits them with. Each round drops
// what was already tried and picks again for the tests that are still short of reviews.
const collectRounds = async ({ charts, roundsLeft, chip, config, cacheDir }) => {
  const picks = selectChartRows({ charts, maxReviewsPerTest: config.notebookcheck.maxReviewsPerTest });
  if (roundsLeft === 0 || picks.length === 0) {
    return { candidates: [], problems: [] };
  }
  const picksByReview = [...Map.groupBy(picks, (pick) => pick.row.reviewUrl)];
  const results = await mapSequentially(picksByReview, ([reviewUrl, reviewPicks]) => {
    return verifyReview({ reviewUrl, picks: reviewPicks, chip, config, cacheDir });
  });
  const candidates = results.flatMap((result) => result.candidates);
  const triedKeys = new Set(picks.map((pick) => toPickKey({ reviewUrl: pick.row.reviewUrl, test: pick.test })));
  const next = await collectRounds({
    charts: charts.map((chart) => {
      const verifiedUrls = candidates.filter((candidate) => candidate.chartLabel === chart.test.label).map((candidate) => candidate.url);
      return {
        ...chart,
        existingUrls: new Set([...chart.existingUrls, ...verifiedUrls]),
        rows: chart.rows.filter((row) => !triedKeys.has(toPickKey({ reviewUrl: row.reviewUrl, test: chart.test }))),
      };
    }),
    roundsLeft: roundsLeft - 1,
    chip,
    config,
    cacheDir,
  });
  return {
    candidates: [...candidates, ...next.candidates],
    problems: [...results.flatMap((result) => result.problems), ...next.problems],
  };
};

// The chip page only says which reviews hold a value. Each value is then confirmed on
// the review itself, because that review is the page the score cites.
export const collectChip = async ({ chip, toExistingUrls, config, cacheDir }) => {
  const page = await loadPage({ url: chip.url, cacheDir, http: config.http });
  if (page.kind === PageKind.Failed) {
    return { candidates: [], problems: [toPageProblem(page)] };
  }
  const charts = config.notebookcheck.tests
    .filter((test) => test.hardwareType === chip.hardwareType)
    .map((test) => {
      const rows = parseChipPageRows({ html: page.html, benchmarkId: test.benchmarkId, settingId: test.settingId });
      return {
        test,
        existingUrls: toExistingUrls(test),
        rows: rows.filter((row) => row.reviewUrl !== undefined && row.value !== undefined),
      };
    });
  return collectRounds({ charts, roundsLeft: config.notebookcheck.verificationRounds, chip, config, cacheDir });
};
