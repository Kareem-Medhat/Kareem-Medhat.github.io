const MS_PER_DAY = 86_400_000;
const CACHE_MAX_AGE_DAYS = 7;

const steelNomad = { benchmark: "3dmark", version: "steel-nomad", test: "score" };

// benchmarkId/settingId are Notebookcheck's own chart ids. A chip page marks a chart
// "b<benchmarkId>_s<settingId>" and a review marks the same chart "_<benchmarkId>_<settingId>",
// which is what lets a value be traced from the chip page to the review that measured it.
// label is the chart name exactly as reviews print it in their list of the device's results.
// Order matters: reviews are picked for earlier tests first, so the scarcest tests lead.
const notebookcheckTests = [
  { hardwareType: "cpu", benchmark: "cinebench", version: "2026", test: "multi-core", benchmarkId: 1103, settingId: 3712, label: "Cinebench 2026 CPU Multi" },
  { hardwareType: "cpu", benchmark: "cinebench", version: "2026", test: "single-core", benchmarkId: 1103, settingId: 3714, label: "Cinebench 2026 CPU Single Thread" },
  { hardwareType: "cpu", benchmark: "cinebench", version: "r23", test: "multi-core", benchmarkId: 768, settingId: 2370, label: "Cinebench R23 Multi Core" },
  { hardwareType: "cpu", benchmark: "cinebench", version: "r23", test: "single-core", benchmarkId: 768, settingId: 2371, label: "Cinebench R23 Single Core" },
  // Only Notebookcheck's "Geekbench 6.7" charts. Primate Labs' 6.1 release notes say 6.1
  // scores run up to 5% (single-core) and 10% (multi-core) higher than 6.0 and advise against
  // comparing the two, so the "Geekbench 6.0" charts don't match a current Geekbench 6 run.
  { hardwareType: "cpu", benchmark: "geekbench", version: "6", test: "multi-core", benchmarkId: 967, settingId: 2919, label: "Geekbench 6.7.1 Multi-Core" },
  { hardwareType: "cpu", benchmark: "geekbench", version: "6", test: "single-core", benchmarkId: 967, settingId: 2918, label: "Geekbench 6.7.1 Single-Core" },
  { hardwareType: "gpu", ...steelNomad, benchmarkId: 201, settingId: 3226, label: "3DMark Steel Nomad" },
  { hardwareType: "gpu", benchmark: "3dmark", version: "time-spy", test: "graphics-score", benchmarkId: 201, settingId: 1067, label: "3DMark Time Spy Graphics" },
];

export const config = {
  http: {
    userAgent: "Mozilla/5.0 (compatible; reference-score-collector/1.0)",
    delayMs: 1500,
    timeoutMs: 90_000,
    cacheMaxAgeMs: CACHE_MAX_AGE_DAYS * MS_PER_DAY,
  },
  // Source names starting with any other vendor are reported as skipped.
  vendors: ["NVIDIA", "AMD", "Intel", "Qualcomm"],
  // Source name (exactly as the source prints it) -> hardware.json id, for the cases
  // where two sources spell one chip so differently that the names don't match up.
  hardwareAliases: {
    // UL's name for the RTX A6000; NVIDIA never sold a "Quadro RTX A6000".
    "NVIDIA Quadro RTX A6000": "nvidia-rtx-a6000",
  },
  // Two sources whose medians for one hardware + test differ by more than this ratio
  // are listed in the report for the owner to review.
  disagreementRatio: 1.25,
  ul: {
    sourceId: "ul-benchmarks",
    // The ranking's score column changes when UL promotes a new test, so a page whose
    // column header is anything else is rejected instead of filed under the wrong test.
    expectedScoreHeader: "3DMark Steel Nomad",
    ...steelNomad,
    // A GPU's own page, used to tell apart ranking rows that share one name.
    hardwarePageBaseUrl: "https://benchmarks.ul.com/hardware/gpu/",
    rankings: [
      { formFactor: "desktop", label: "desktop", url: "https://benchmarks.ul.com/compare/best-gpus?amount=0&sortBy=SCORE&reverseOrder=true&types=DESKTOP&minRating=0" },
      { formFactor: "laptop", label: "mobile", url: "https://benchmarks.ul.com/compare/best-gpus?amount=0&sortBy=SCORE&reverseOrder=true&types=MOBILE&minRating=0" },
    ],
  },
  notebookcheck: {
    sourceId: "notebookcheck",
    maxReviewsPerTest: 3,
    verificationRounds: 3,
    tests: notebookcheckTests,
    // deskornote=4 lists desktop and notebook chips together; phone chips are left out.
    lists: [
      { hardwareType: "cpu", url: "https://www.notebookcheck.net/Mobile-Processors-Benchmark-List.2436.0.html?deskornote=4&archive=1" },
      { hardwareType: "gpu", url: "https://www.notebookcheck.net/Mobile-Graphics-Cards-Benchmark-List.844.0.html?deskornote=4&professional=0&archive=1" },
    ],
  },
};
