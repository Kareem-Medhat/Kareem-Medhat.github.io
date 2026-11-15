// Everything the collector leaves out is reported under one of these kinds, so a
// missing score is always explained in the report.
export const ProblemKind = Object.freeze({
  PageFailed: "pageFailed",
  UnexpectedScoreColumn: "unexpectedScoreColumn",
  DuplicateName: "duplicateName",
  UnsupportedVendor: "unsupportedVendor",
  UnknownAlias: "unknownAlias",
  ValueNotInReview: "valueNotInReview",
  TimeLimitReached: "timeLimitReached",
});
