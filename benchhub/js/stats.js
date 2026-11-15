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

export const StressVerdictKind = Object.freeze({ Pass: "pass", Check: "check", Fail: "fail" });

// Maker: the card maker's own published maximum. General: the maker publishes none, so the
// card is compared with the range of maximums that makers do publish for other cards.
export const TemperatureLimitKind = Object.freeze({ Maker: "maker", General: "general" });

export const toPublishedRange = (maxTemps) => {
  if (maxTemps.length === 0) {
    return undefined;
  }
  return { lowestMaxTempC: Math.min(...maxTemps), highestMaxTempC: Math.max(...maxTemps) };
};

const toMakerVerdict = ({ temperatureC, maxTempC }) => {
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
    advice: `${temperatureC} °C is below your card's ${maxTempC} °C maximum.`,
  };
};

// A general guide never fails a card: the number is not that card's own limit.
const toGeneralVerdict = ({ temperatureC, lowestMaxTempC, highestMaxTempC }) => {
  if (temperatureC >= highestMaxTempC) {
    return {
      kind: StressVerdictKind.Check,
      title: "Hotter than any published maximum",
      advice: `${temperatureC} °C is at or above ${highestMaxTempC} °C, the highest maximum any maker publishes for the cards we track. Your card's own limit isn't published, but this is hotter than cards should run. Stop stress testing and check the cooling: clean out dust, check that every fan spins, and give the case room to breathe.`,
    };
  }
  if (temperatureC >= lowestMaxTempC) {
    return {
      kind: StressVerdictKind.Check,
      title: "Running hot",
      advice: `${temperatureC} °C is inside the ${lowestMaxTempC} to ${highestMaxTempC} °C range where published maximums sit. Your card's own limit isn't published, so it may be close to it. Check the cooling before running long stress tests.`,
    };
  }
  return {
    kind: StressVerdictKind.Pass,
    title: "Within the general guide",
    advice: `${temperatureC} °C is below ${lowestMaxTempC} °C, the lowest maximum any maker publishes for the cards we track. Your card's own limit isn't published, so treat this as a guide.`,
  };
};

export const toStressVerdict = ({ temperatureC, limit }) => {
  if (limit.kind === TemperatureLimitKind.Maker) {
    return toMakerVerdict({ temperatureC, maxTempC: limit.maxTempC });
  }
  if (limit.kind === TemperatureLimitKind.General) {
    return toGeneralVerdict({ temperatureC, lowestMaxTempC: limit.lowestMaxTempC, highestMaxTempC: limit.highestMaxTempC });
  }
  throw new Error(`Unknown temperature limit kind: ${limit.kind}`);
};
