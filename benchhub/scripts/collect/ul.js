import { toText } from "./html.js";

export const RankingKind = Object.freeze({ Parsed: "parsed", UnexpectedScoreColumn: "unexpectedScoreColumn" });

const toRow = (rowHtml) => {
  const name = /href='\/hardware\/gpu\/[^']*\+review'>([^<]+)</.exec(rowHtml)?.[1];
  const score = /<span class='bar-score'>\s*(\d+)\s*<\/span>/.exec(rowHtml)?.[1];
  if (name === undefined || score === undefined) {
    return [];
  }
  return [{ name: toText(name), value: Number(score) }];
};

// The large badge at the top of a GPU's own page: its score and the test it belongs to.
export const parseHardwarePageScore = ({ html, expectedScoreHeader }) => {
  const badge = /<span class='result-pimp-badge-score-item'>(\d+)<\/span>[\s\S]*?<h3 class='result-pimp-badge-test-subtitle'>([\s\S]*?)<\/h3>/.exec(html);
  if (badge === null || !toText(badge[2]).startsWith(expectedScoreHeader)) {
    return undefined;
  }
  return Number(badge[1]);
};

export const parseRanking = ({ html, expectedScoreHeader }) => {
  const headers = [...html.matchAll(/<th[\s\S]*?<\/th>/g)].map((match) => toText(match[0]));
  if (!headers.includes(expectedScoreHeader)) {
    return { kind: RankingKind.UnexpectedScoreColumn, headers };
  }
  return { kind: RankingKind.Parsed, rows: html.split(/<tr>/).flatMap(toRow) };
};
