import { parseScoreValue, toText } from "./html.js";

export const parseChipList = ({ html, benchmarkIds }) => {
  const chipPageLink = /<a href="(https:\/\/www\.notebookcheck\.net\/[^"]+Benchmarks-and-Specs\.\d+\.0\.html)">([^<]+)<\/a>/;
  // Notebookcheck marks each list row with the device class it files the chip under.
  const formFactorsByRowClass = new Map([
    ["desk_odd", "desktop"],
    ["desk_even", "desktop"],
    ["odd", "laptop"],
    ["even", "laptop"],
  ]);
  const filledCell = new RegExp(`class="value bv_(?:${benchmarkIds.join("|")})"><div`);
  return [...html.matchAll(/<tr class="([a-z_]+)">([\s\S]*?)(?=<tr[ >]|<\/table>)/g)].flatMap(([, rowClass, rowHtml]) => {
    const formFactor = formFactorsByRowClass.get(rowClass);
    const link = chipPageLink.exec(rowHtml);
    if (formFactor === undefined || link === null) {
      return [];
    }
    // Each listed score carries the number of tested devices behind it ("n18"). The largest
    // one says how widely used the chip is.
    const deviceCounts = [...rowHtml.matchAll(/<sup>n(\d+)<\/sup>/g)].map((match) => Number(match[1]));
    return [
      {
        url: link[1],
        name: toText(link[2]),
        formFactor,
        hasListedScores: filledCell.test(rowHtml),
        testedDeviceCount: Math.max(0, ...deviceCounts),
      },
    ];
  });
};

const toChipRow = (cells) => {
  const reviewLink = /<a href="(https:\/\/www\.notebookcheck\.net\/[^"]+\.\d+\.0\.html)">/;
  const [model, cpu, gpu, ram, value] = cells;
  return {
    reviewUrl: reviewLink.exec(model)?.[1],
    model: toText(model.replace(/<span class="gpus_source">[\s\S]*?<\/span>/, "")),
    cpu: toText(cpu),
    gpu: toText(gpu),
    ram: toText(ram),
    value: parseScoreValue(value),
  };
};

export const parseChipPageRows = ({ html, benchmarkId, settingId }) => {
  const start = html.indexOf(`<div class="gpubench_div b${benchmarkId}_s${settingId}"`);
  if (start === -1) {
    return [];
  }
  const nextChart = html.indexOf('<div class="gpubench_div ', start + 1);
  const chartHtml = html.slice(start, nextChart === -1 ? html.length : nextChart);
  return [...chartHtml.matchAll(/<tr>((?:<td>[\s\S]*?<\/td>){5})<\/tr>/g)].map((match) => {
    return toChipRow([...match[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((cell) => cell[1]));
  });
};

// Reviews print the reviewed device's own result in two layouts: a comparison chart, where
// its bar is the "referencespecs" row (the other bars are comparison devices and must not
// count as confirmation), and a plain list of its results labelled with the chart name.
export const parseReviewValues = ({ html, test }) => {
  const barValue = new RegExp(`r_compare_bars_number__${test.benchmarkId}_${test.settingId}(?:_\\d+)?">([^<]+)<`);
  const barValues = [...html.matchAll(/<tr class="chart\s+referencespecs"[\s\S]*?<\/tr>/g)].map((match) => barValue.exec(match[0])?.[1]);
  const listValues = [...html.matchAll(/<div class="cb_bench_label">([^<]*)<\/div><div class="cb_bench_value">([^<]*)<\/div>/g)]
    .filter((match) => toText(match[1]) === test.label)
    .map((match) => match[2].replace(/\s*Points$/, ""));
  return [...barValues.filter((raw) => raw !== undefined), ...listValues].flatMap((raw) => {
    const value = parseScoreValue(raw);
    return value === undefined ? [] : [value];
  });
};
