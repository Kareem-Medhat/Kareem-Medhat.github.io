import { CategoryKind, toHardwareName, toSiteUrl } from "../data.js";
import {
  DiagnosisKind,
  StressAnswerKind,
  StressVerdictKind,
  diagnose,
  diagnosisRules,
  toPercentBetter,
  toPercentBetterThanRange,
  toRange,
  toStressVerdict,
} from "../stats.js";
import { el } from "../ui.js";
import { formFactorLabels } from "./labels.js";

const ToneKind = Object.freeze({ Good: "good", Warn: "warn", Bad: "bad" });

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

// Accepts what people type: "15,230", "15 230 pts", "78 °C".
const toPositiveNumber = (text) => {
  if (text === undefined) {
    return undefined;
  }
  const value = Number(text.replace(/[\s,]/g, "").replace(/[^\d.]+$/, ""));
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

const describePercent = (percentBetter) => {
  const shownPercent = numberFormat.format(Math.abs(percentBetter));
  // "Same" exactly when the shown number rounds to zero, so the text never says "0% better".
  if (Number(shownPercent) === 0) {
    return "the same as";
  }
  return `${shownPercent}% ${percentBetter > 0 ? "better" : "worse"} than`;
};

const toVerdict = ({ display, title, advice, link }) => {
  return el("div", {
    attrs: { class: `verdict tone-${display.tone}` },
    children: [
      el("span", { attrs: { class: "verdict-icon", "aria-hidden": "true" }, children: [display.icon] }),
      el("div", {
        children: [
          el("p", { attrs: { class: "verdict-title" }, children: [title] }),
          el("p", { children: [advice] }),
          ...(link === undefined ? [] : [el("a", { attrs: { href: link.href }, children: [link.label] })]),
        ],
      }),
    ],
  });
};

const toConditionsText = (conditions) => {
  return [formFactorLabels[conditions.formFactor], conditions.isStock ? "stock settings" : "overclocked", conditions.notes]
    .filter((part) => part !== undefined)
    .join(" · ");
};

const toReferenceItem = ({ reference, benchmark, score }) => {
  const comparison =
    score === undefined
      ? []
      : [
          el("p", {
            attrs: { class: "ref-compare" },
            children: [
              `Yours is ${describePercent(toPercentBetter({ score, reference: reference.value, higherIsBetter: benchmark.higherIsBetter }))} this.`,
            ],
          }),
        ];
  return el("li", {
    attrs: { class: "ref" },
    children: [
      el("p", {
        attrs: { class: "ref-value" },
        children: [numberFormat.format(reference.value), el("span", { attrs: { class: "unit" }, children: [` ${benchmark.unit}`] })],
      }),
      el("p", {
        children: [
          "Source: ",
          el("a", { attrs: { href: reference.url, rel: "noopener" }, children: [reference.source.name] }),
        ],
      }),
      el("p", { attrs: { class: "muted" }, children: [`${toConditionsText(reference.conditions)}. Retrieved ${reference.retrievedDate}.`] }),
      ...comparison,
    ],
  });
};

const toScoreView = ({ benchmark, version, references, scoreText }) => {
  const diagnosisDisplay = Object.freeze({
    [DiagnosisKind.Above]: { icon: "▲", tone: ToneKind.Good },
    [DiagnosisKind.Normal]: { icon: "✓", tone: ToneKind.Good },
    [DiagnosisKind.SlightlyLow]: { icon: "!", tone: ToneKind.Warn },
    [DiagnosisKind.Low]: { icon: "▼", tone: ToneKind.Bad },
  });
  const score = toPositiveNumber(scoreText);
  const values = references.map((reference) => reference.value);
  const range = toRange(values);
  const percentBetter =
    score === undefined ? undefined : toPercentBetterThanRange({ score, range, higherIsBetter: benchmark.higherIsBetter });
  const scoreSummary = () => {
    if (scoreText === undefined) {
      return [];
    }
    if (score === undefined || percentBetter === undefined) {
      return [el("p", { attrs: { class: "tone-bad-text" }, children: ["Enter your score as a number greater than 0."] })];
    }
    const rule = diagnose({ percentBetter, rules: diagnosisRules });
    const target = references.length === 1 ? "the trusted reference" : "the closest end of the trusted range";
    return [
      toVerdict({
        display: diagnosisDisplay[rule.kind],
        title: rule.title,
        advice: rule.advice,
        link: rule.hasTroubleshootingLink
          ? { href: `${toSiteUrl(version.guide)}#troubleshooting`, label: "Open the troubleshooting steps" }
          : undefined,
      }),
      el("p", {
        children: [
          percentBetter === 0 && references.length > 1
            ? `Your score of ${numberFormat.format(score)} ${benchmark.unit} is inside the range of trusted references.`
            : `Your score of ${numberFormat.format(score)} ${benchmark.unit} is ${describePercent(percentBetter)} ${target}.`,
        ],
      }),
    ];
  };
  const rangeNote =
    references.length > 1
      ? [
          el("p", {
            attrs: { class: "muted" },
            children: [
              `Range: ${numberFormat.format(range.min)} to ${numberFormat.format(range.max)} ${benchmark.unit}.`,
            ],
          }),
        ]
      : [];
  return [
    ...scoreSummary(),
    el("h3", { children: ["Trusted reference scores"] }),
    ...rangeNote,
    el("ul", {
      attrs: { class: "refs" },
      children: references.map((reference) => {
        return toReferenceItem({ reference, benchmark, score });
      }),
    }),
  ];
};

const toLimitLine = (limit) => {
  return el("p", {
    children: [
      "Maximum temperature for your card: ",
      el("strong", { children: [`${limit.maxTempC} °C`] }),
      " (",
      el("a", { attrs: { href: limit.url, rel: "noopener" }, children: [limit.source.name] }),
      ").",
    ],
  });
};

const toStressView = ({ version, entries, limit }) => {
  const stressVerdictDisplay = Object.freeze({
    [StressVerdictKind.Pass]: { icon: "✓", tone: ToneKind.Good },
    [StressVerdictKind.Check]: { icon: "!", tone: ToneKind.Warn },
    [StressVerdictKind.Fail]: { icon: "✕", tone: ToneKind.Bad },
  });
  const guideLink = el("a", { attrs: { href: toSiteUrl(version.guide) }, children: ["Read the guide, including the safety warning"] });
  const intro = [el("p", { children: [guideLink, "."] }), ...(limit === undefined ? [] : [toLimitLine(limit)])];
  const temperatureC = toPositiveNumber(entries.temp);
  if (entries.stable === undefined) {
    return [...intro, el("p", { children: ["Answer the question above to see your result."] })];
  }
  if (entries.stable === StressAnswerKind.Yes && limit !== undefined && temperatureC === undefined) {
    return [...intro, el("p", { children: ["Type the highest temperature you saw."] })];
  }
  const verdict = toStressVerdict({ isStable: entries.stable, temperatureC, maxTempC: limit?.maxTempC });
  return [...intro, toVerdict({ display: stressVerdictDisplay[verdict.kind], title: verdict.title, advice: verdict.advice })];
};

export const renderResult = ({ result, selection }) => {
  const heading = el("h2", { attrs: { id: "result-heading" }, children: ["Your result"] });
  const { hardware, formFactor, benchmark, version, test } = selection;
  if (hardware === undefined || benchmark === undefined || version === undefined || test === undefined) {
    result.replaceChildren(heading, el("p", { children: ["Choose your hardware and the test you ran."] }));
    return;
  }
  const summary = el("p", {
    attrs: { class: "result-summary" },
    children: [
      `${benchmark.name} ${version.name}, ${test.name}, on ${toHardwareName(hardware)} (${formFactorLabels[formFactor]})`,
    ],
  });
  const body =
    benchmark.category === CategoryKind.Stress
      ? toStressView({ version, entries: selection.entries, limit: selection.temperatureLimit })
      : toScoreView({ benchmark, version, references: selection.references, scoreText: selection.entries.score });
  result.replaceChildren(heading, summary, ...body);
};
