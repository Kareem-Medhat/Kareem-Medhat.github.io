import { loadPage, PageKind } from "./page-loader.js";
import { ProblemKind } from "./problem.js";
import { mapSequentially } from "./sequence.js";
import { parseHardwarePageScore, parseRanking, RankingKind } from "./ul.js";

const toCandidate = ({ row, ranking, page, ul }) => {
  return {
    name: row.name,
    type: "gpu",
    formFactor: ranking.formFactor,
    benchmark: ul.benchmark,
    version: ul.version,
    test: ul.test,
    value: row.value,
    sourceId: ul.sourceId,
    url: ranking.url,
    retrievedDate: page.retrievedDate,
    notes: `Median of all user-submitted results for "${row.name}" on UL's ${ranking.label} GPU ranking (Steel Nomad DX12 graphics score), not a single controlled test.`,
  };
};

// UL lists a few names twice with different scores (the second row is another variant
// it files under the same name). The GPU's own page states which score belongs to the
// name; a row is kept only when that page confirms it.
const resolveDuplicate = async ({ rows, ranking, config, cacheDir }) => {
  const [{ name }] = rows;
  const problem = { kind: ProblemKind.DuplicateName, url: ranking.url, name, values: rows.map((row) => row.value) };
  const page = await loadPage({ url: `${config.ul.hardwarePageBaseUrl}${encodeURIComponent(name)}+review`, cacheDir, http: config.http });
  if (page.kind === PageKind.Failed) {
    return { rows: [], problems: [problem, { kind: ProblemKind.PageFailed, url: page.url, reason: page.reason }] };
  }
  const confirmedValue = parseHardwarePageScore({ html: page.html, expectedScoreHeader: config.ul.expectedScoreHeader });
  const confirmedRows = rows.filter((row) => row.value === confirmedValue);
  return confirmedRows.length === 1 ? { rows: confirmedRows, problems: [] } : { rows: [], problems: [problem] };
};

const collectRanking = async ({ ranking, config, cacheDir, nameFilter }) => {
  const page = await loadPage({ url: ranking.url, cacheDir, http: config.http });
  if (page.kind === PageKind.Failed) {
    return { candidates: [], problems: [{ kind: ProblemKind.PageFailed, url: page.url, reason: page.reason }] };
  }
  const parsed = parseRanking({ html: page.html, expectedScoreHeader: config.ul.expectedScoreHeader });
  if (parsed.kind === RankingKind.UnexpectedScoreColumn) {
    return { candidates: [], problems: [{ kind: ProblemKind.UnexpectedScoreColumn, url: ranking.url, headers: parsed.headers }] };
  }
  const groups = [...Map.groupBy(parsed.rows.filter((row) => nameFilter.test(row.name)), (row) => row.name).values()];
  const resolved = await mapSequentially(groups.filter((rows) => rows.length > 1), (rows) => {
    return resolveDuplicate({ rows, ranking, config, cacheDir });
  });
  const uniqueRows = [...groups.filter((rows) => rows.length === 1).flat(), ...resolved.flatMap((result) => result.rows)];
  return {
    candidates: uniqueRows.map((row) => {
      return toCandidate({ row, ranking, page, ul: config.ul });
    }),
    problems: resolved.flatMap((result) => result.problems),
  };
};

export const collectUl = async ({ config, cacheDir, nameFilter }) => {
  const results = await mapSequentially(config.ul.rankings, (ranking) => {
    return collectRanking({ ranking, config, cacheDir, nameFilter });
  });
  return {
    candidates: results.flatMap((result) => result.candidates),
    problems: results.flatMap((result) => result.problems),
  };
};
