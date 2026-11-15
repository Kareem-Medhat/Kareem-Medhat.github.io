const toScoreKey = (score) => [score.hardwareId, score.benchmark, score.version, score.test, score.sourceId, score.url].join("|");

export const toTestKey = ({ benchmark, version, test }) => `${benchmark}/${version}/${test}`;

// A score collected again from the same page replaces the stored one in place, so re-runs
// refresh values (UL's medians move daily) instead of piling up duplicates. Stored scores
// that were not collected again are kept exactly as they are.
export const mergeScores = ({ existing, collected }) => {
  const collectedByKey = new Map(collected.map((score) => [toScoreKey(score), score]));
  const firstIndexByKey = new Map(existing.map((score, index) => [toScoreKey(score), index]).toReversed());
  const refreshed = existing.flatMap((score, index) => {
    const replacement = collectedByKey.get(toScoreKey(score));
    if (replacement === undefined) {
      return [score];
    }
    return firstIndexByKey.get(toScoreKey(score)) === index ? [replacement] : [];
  });
  return [...refreshed, ...[...collectedByKey.values()].filter((score) => !firstIndexByKey.has(toScoreKey(score)))];
};

const toMedian = (values) => {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export const findDisagreements = ({ scores, ratio }) => {
  const groups = Map.groupBy(scores, (score) => `${score.hardwareId}|${toTestKey(score)}`);
  return [...groups.values()].flatMap((group) => {
    const medians = [...Map.groupBy(group, (score) => score.sourceId)].map(([sourceId, sourceScores]) => {
      return { sourceId, median: toMedian(sourceScores.map((score) => score.value)), values: sourceScores.map((score) => score.value) };
    });
    const lowest = Math.min(...medians.map((entry) => entry.median));
    const highest = Math.max(...medians.map((entry) => entry.median));
    if (medians.length < 2 || highest / lowest <= ratio) {
      return [];
    }
    return [{ hardwareId: group[0].hardwareId, test: toTestKey(group[0]), sources: medians }];
  });
};
