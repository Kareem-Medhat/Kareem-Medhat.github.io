// Pure functions only: no DOM, no fetch. Try them in the browser console with
// `const stats = await import("./js/stats.js")`.

export const DiagnosisKind = Object.freeze({
  Above: "above",
  Normal: "normal",
  SlightlyLow: "slightlyLow",
  Low: "low",
});

const NORMAL_BAND_PERCENT = 5;
const LOW_BAND_PERCENT = 15;

// Ordered: the first rule that matches wins.
export const diagnosisRules = Object.freeze([
  {
    kind: DiagnosisKind.Above,
    isMatch: (percentBetter) => percentBetter > NORMAL_BAND_PERCENT,
    title: "Better than the reference",
    advice:
      "Your result beats the trusted reference. That's fine. Better cooling, faster memory or a factory overclock can do this.",
    hasTroubleshootingLink: false,
  },
  {
    kind: DiagnosisKind.Normal,
    isMatch: (percentBetter) => percentBetter >= -NORMAL_BAND_PERCENT,
    title: "Normal",
    advice: `Your result is within ${NORMAL_BAND_PERCENT}% of the trusted reference. Your hardware is performing as expected.`,
    hasTroubleshootingLink: false,
  },
  {
    kind: DiagnosisKind.SlightlyLow,
    isMatch: (percentBetter) => percentBetter >= -LOW_BAND_PERCENT,
    title: "A bit low",
    advice:
      "Close background apps, set the Windows power mode to best performance, plug in your laptop, and run the test again.",
    hasTroubleshootingLink: true,
  },
  {
    kind: DiagnosisKind.Low,
    isMatch: () => true,
    title: "Low",
    advice: `More than ${LOW_BAND_PERCENT}% below the reference. Check temperatures and power limits: your hardware may be overheating and slowing itself down.`,
    hasTroubleshootingLink: true,
  },
]);

// Positive means the score is better than the reference, whichever direction "better" is.
export const toPercentBetter = ({ score, reference, higherIsBetter }) => {
  const percentPerRatio = 100;
  const percent = ((score - reference) / reference) * percentPerRatio;
  return higherIsBetter ? percent : -percent;
};

export const toRange = (values) => {
  if (values.length === 0) {
    throw new Error("toRange needs at least one value");
  }
  return { min: Math.min(...values), max: Math.max(...values) };
};

// Several sources are never averaged: a score anywhere inside their range counts as 0%,
// otherwise it is measured against the nearest end of the range.
export const toPercentBetterThanRange = ({ score, range, higherIsBetter }) => {
  if (score >= range.min && score <= range.max) {
    return 0;
  }
  const nearest = score < range.min ? range.min : range.max;
  return toPercentBetter({ score, reference: nearest, higherIsBetter });
};

export const diagnose = ({ percentBetter, rules }) => {
  const rule = rules.find((candidate) => candidate.isMatch(percentBetter));
  if (rule === undefined) {
    throw new Error(`No diagnosis rule matches ${percentBetter}%`);
  }
  return rule;
};

export const StressAnswerKind = Object.freeze({ Yes: "yes", No: "no", NotSure: "notSure" });

export const StressVerdictKind = Object.freeze({ Pass: "pass", Check: "check", Fail: "fail" });

// maxTempC is the maker's published maximum; undefined when the maker publishes none.
export const toStressVerdict = ({ isStable, temperatureC, maxTempC }) => {
  if (isStable === StressAnswerKind.No) {
    return {
      kind: StressVerdictKind.Fail,
      title: "Not stable",
      advice:
        "Crashes, freezes or visual glitches under load usually mean an unstable overclock, a driver problem, overheating or a power supply that can't keep up. Go back to stock settings and update your drivers before testing again.",
    };
  }
  if (isStable === StressAnswerKind.NotSure) {
    return {
      kind: StressVerdictKind.Check,
      title: "Not sure yet",
      advice: "Run the test again and watch the screen the whole time.",
    };
  }
  if (maxTempC === undefined) {
    return {
      kind: StressVerdictKind.Check,
      title: "Stable, temperature not checked",
      advice: "Your card's maker doesn't publish a maximum temperature, so we can't judge it.",
    };
  }
  if (temperatureC === undefined) {
    throw new Error("toStressVerdict needs temperatureC when maxTempC is known");
  }
  if (temperatureC >= maxTempC) {
    return {
      kind: StressVerdictKind.Fail,
      title: "Too hot",
      advice: `${temperatureC} °C reached your card's ${maxTempC} °C maximum, where it slows itself down to stay safe. Stop stress testing until the cooling is fixed: clean out dust, check that every fan spins, and give the case room to breathe.`,
    };
  }
  return {
    kind: StressVerdictKind.Pass,
    title: "Healthy",
    advice: `Stable, and ${temperatureC} °C is below your card's ${maxTempC} °C maximum.`,
  };
};
