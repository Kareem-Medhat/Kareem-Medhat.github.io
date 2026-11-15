const namedEntities = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
  ["nbsp", " "],
  ["ndash", "-"],
]);

const decodeEntities = (text) => {
  return text
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/g, (match, name) => namedEntities.get(name) ?? match);
};

export const toText = (html) => {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/[\s ‑]+/g, " ")
    .trim();
};

export const parseScoreValue = (html) => {
  const text = toText(html).replace(/,/g, "");
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : undefined;
};
