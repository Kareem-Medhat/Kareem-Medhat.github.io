// Requests to one source run one at a time, so the delay between them holds.
export const mapSequentially = (items, toResult) => {
  return items.reduce(async (previous, item) => {
    const results = await previous;
    return [...results, await toResult(item)];
  }, Promise.resolve([]));
};
