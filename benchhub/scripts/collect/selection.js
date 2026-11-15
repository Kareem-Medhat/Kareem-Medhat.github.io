const byValue = (a, b) => a.value - b.value;

// Picks from the middle of evenly sized slices of the sorted values, so the choice shows
// the spread between devices without leaning on the single lowest or highest outlier.
export const pickSpread = ({ sortedItems, count }) => {
  if (count <= 0) {
    return [];
  }
  if (sortedItems.length <= count) {
    return sortedItems;
  }
  const sliceMiddle = 0.5;
  return Array.from({ length: count }, (_unused, index) => sortedItems[Math.floor(((index + sliceMiddle) / count) * sortedItems.length)]);
};

// One review usually carries several tests, so reviews already picked for an earlier
// test count towards later ones. That keeps the number of pages to open small.
const selectReviewUrls = ({ charts, maxReviewsPerTest }) => {
  return charts.reduce((pickedUrls, chart) => {
    const coveredCount = chart.existingUrls.size + chart.rows.filter((row) => pickedUrls.has(row.reviewUrl)).length;
    const openRows = chart.rows.filter((row) => !pickedUrls.has(row.reviewUrl)).toSorted(byValue);
    const picked = pickSpread({ sortedItems: openRows, count: maxReviewsPerTest - coveredCount });
    return new Set([...pickedUrls, ...picked.map((row) => row.reviewUrl)]);
  }, new Set());
};

export const selectChartRows = ({ charts, maxReviewsPerTest }) => {
  const openCharts = charts.map((chart) => {
    return { ...chart, rows: chart.rows.filter((row) => !chart.existingUrls.has(row.reviewUrl)) };
  });
  const pickedUrls = selectReviewUrls({ charts: openCharts, maxReviewsPerTest });
  return openCharts.flatMap((chart) => {
    const pickedRows = chart.rows.filter((row) => pickedUrls.has(row.reviewUrl)).toSorted(byValue);
    return pickSpread({ sortedItems: pickedRows, count: maxReviewsPerTest - chart.existingUrls.size }).map((row) => {
      return { test: chart.test, row };
    });
  });
};
