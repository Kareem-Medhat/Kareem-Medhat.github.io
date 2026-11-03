// Every data file lives in ../data/ relative to this module, so paths resolve the
// same from any page and under any GitHub Pages subpath.
const siteRootUrl = new URL("../", import.meta.url);

export const CategoryKind = Object.freeze({
  Cpu: "cpu",
  Gpu: "gpu",
  Storage: "storage",
  Stress: "stress",
});

export const HardwareTypeKind = Object.freeze({ Cpu: "cpu", Gpu: "gpu" });

export const FormFactorKind = Object.freeze({ Desktop: "desktop", Laptop: "laptop" });

export const SourceTypeKind = Object.freeze({
  OfficialVendor: "official-vendor",
  ReviewSite: "review-site",
  OfficialResultsDatabase: "official-results-database",
});

export const TestLabelKind = Object.freeze({ Test: "test", Preset: "preset" });

export const ParseKind = Object.freeze({ Valid: "valid", Invalid: "invalid" });

export const toSiteUrl = (path) => new URL(path, siteRootUrl).href;

export const toComparisonKey = ({ benchmark, version, test }) => `${benchmark}/${version}/${test}`;

export const toHardwareName = (hardware) => {
  return [hardware.vendor, hardware.model, hardware.variant].filter((part) => part !== undefined).join(" ");
};

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const isOneOf = (kinds, value) => Object.values(kinds).includes(value);

const isHttpsUrl = (value) => isNonEmptyString(value) && URL.canParse(value) && new URL(value).protocol === "https:";

// Root-absolute or full URLs break when the site is served from a GitHub Pages subpath.
const isRelativePath = (value) => isNonEmptyString(value) && !value.startsWith("/") && !URL.canParse(value);

const isIsoDate = (value) => {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
};

const isOptionalText = (value) => value === undefined || isNonEmptyString(value);

const toParsed = ({ checks, build }) => {
  const invalidField = checks.find(([, isValid]) => !isValid)?.[0];
  if (invalidField !== undefined) {
    return { kind: ParseKind.Invalid, reason: `missing or invalid "${invalidField}"` };
  }
  return { kind: ParseKind.Valid, value: build() };
};

const parseList = ({ file, raw, parseItem }) => {
  if (!Array.isArray(raw)) {
    throw new Error(`data/${file} must contain a JSON array`);
  }
  const parsed = raw.map((item, index) => {
    return { index, result: parseItem(item) };
  });
  return {
    items: parsed.filter(({ result }) => result.kind === ParseKind.Valid).map(({ result }) => result.value),
    problems: parsed
      .filter(({ result }) => result.kind === ParseKind.Invalid)
      .map(({ index, result }) => {
        return { file, index, reason: result.reason };
      }),
  };
};

const parseSite = (raw) => {
  const result = toParsed({
    checks: [
      ["name", isNonEmptyString(raw?.name)],
      ["tagline", isNonEmptyString(raw?.tagline)],
    ],
    build: () => {
      return { name: raw.name, tagline: raw.tagline };
    },
  });
  if (result.kind === ParseKind.Invalid) {
    throw new Error(`data/site.json: ${result.reason}`);
  }
  return result.value;
};

const parseSource = (raw) => {
  return toParsed({
    checks: [
      ["id", isNonEmptyString(raw?.id)],
      ["name", isNonEmptyString(raw?.name)],
      ["homepage", isHttpsUrl(raw?.homepage)],
      ["type", isOneOf(SourceTypeKind, raw?.type)],
    ],
    build: () => {
      return { id: raw.id, name: raw.name, homepage: raw.homepage, type: raw.type, notes: raw.notes };
    },
  });
};

const parseTest = (raw) => {
  return toParsed({
    checks: [
      ["id", isNonEmptyString(raw?.id)],
      ["name", isNonEmptyString(raw?.name)],
    ],
    build: () => {
      return { id: raw.id, name: raw.name };
    },
  });
};

const parseVersion = (raw) => {
  const rawTests = raw?.tests ?? raw?.presets;
  const tests = Array.isArray(rawTests) ? rawTests.map(parseTest) : [];
  return toParsed({
    checks: [
      ["id", isNonEmptyString(raw?.id)],
      ["name", isNonEmptyString(raw?.name)],
      ["tests or presets", tests.length > 0 && tests.every((test) => test.kind === ParseKind.Valid)],
      ["guide", raw?.guide === undefined || isRelativePath(raw.guide)],
      ["note", isOptionalText(raw?.note)],
    ],
    build: () => {
      return {
        id: raw.id,
        name: raw.name,
        note: raw.note,
        guide: raw.guide,
        testLabel: raw.tests === undefined ? TestLabelKind.Preset : TestLabelKind.Test,
        tests: tests.map((test) => test.value),
      };
    },
  });
};

const parseBenchmark = (raw) => {
  const versions = Array.isArray(raw?.versions) ? raw.versions.map(parseVersion) : [];
  return toParsed({
    checks: [
      ["id", isNonEmptyString(raw?.id)],
      ["name", isNonEmptyString(raw?.name)],
      ["vendor", isNonEmptyString(raw?.vendor)],
      ["officialDownloadUrl", isHttpsUrl(raw?.officialDownloadUrl)],
      ["category", isOneOf(CategoryKind, raw?.category)],
      ["unit", isNonEmptyString(raw?.unit)],
      ["higherIsBetter", typeof raw?.higherIsBetter === "boolean"],
      ["comparedBy", isOneOf(HardwareTypeKind, raw?.comparedBy)],
      ["guide", isRelativePath(raw?.guide)],
      ["versions", versions.length > 0 && versions.every((version) => version.kind === ParseKind.Valid)],
    ],
    build: () => {
      return {
        id: raw.id,
        name: raw.name,
        vendor: raw.vendor,
        officialDownloadUrl: raw.officialDownloadUrl,
        category: raw.category,
        unit: raw.unit,
        higherIsBetter: raw.higherIsBetter,
        comparedBy: raw.comparedBy,
        guide: raw.guide,
        versions: versions.map((version) => {
          return { ...version.value, guide: version.value.guide ?? raw.guide };
        }),
      };
    },
  });
};

const parseHardware = (raw) => {
  return toParsed({
    checks: [
      ["id", isNonEmptyString(raw?.id)],
      ["type", isOneOf(HardwareTypeKind, raw?.type)],
      ["vendor", isNonEmptyString(raw?.vendor)],
      ["model", isNonEmptyString(raw?.model)],
      ["variant", raw?.variant === undefined || isNonEmptyString(raw.variant)],
      ["formFactor", isOneOf(FormFactorKind, raw?.formFactor)],
    ],
    build: () => {
      return {
        id: raw.id,
        type: raw.type,
        vendor: raw.vendor,
        model: raw.model,
        variant: raw.variant,
        formFactor: raw.formFactor,
      };
    },
  });
};

const parseScore = ({ raw, sourcesById, hardwareById, testKeys }) => {
  const comparisonKey = toComparisonKey({ benchmark: raw?.benchmark, version: raw?.version, test: raw?.test });
  return toParsed({
    checks: [
      ["sourceId (not in sources.json)", sourcesById.has(raw?.sourceId)],
      ["hardwareId (not in hardware.json)", hardwareById.has(raw?.hardwareId)],
      ["benchmark/version/test (not in benchmarks.json)", testKeys.has(comparisonKey)],
      ["value", Number.isFinite(raw?.value) && raw.value > 0],
      ["url", isHttpsUrl(raw?.url)],
      ["retrievedDate", isIsoDate(raw?.retrievedDate)],
      ["conditions.formFactor (must match the hardware's formFactor)", hardwareById.get(raw?.hardwareId)?.formFactor === raw?.conditions?.formFactor],
      ["conditions.stock", typeof raw?.conditions?.stock === "boolean"],
    ],
    build: () => {
      return {
        hardwareId: raw.hardwareId,
        benchmark: raw.benchmark,
        version: raw.version,
        test: raw.test,
        comparisonKey,
        value: raw.value,
        source: sourcesById.get(raw.sourceId),
        url: raw.url,
        retrievedDate: raw.retrievedDate,
        conditions: {
          formFactor: raw.conditions.formFactor,
          isStock: raw.conditions.stock,
          notes: isNonEmptyString(raw.conditions.notes) ? raw.conditions.notes : undefined,
        },
      };
    },
  });
};

const parseTemperatureLimit = ({ raw, sourcesById, hardwareById }) => {
  return toParsed({
    checks: [
      ["sourceId (not in sources.json)", sourcesById.has(raw?.sourceId)],
      ["hardwareId (not in hardware.json)", hardwareById.has(raw?.hardwareId)],
      ["maxTempC", Number.isFinite(raw?.maxTempC) && raw.maxTempC > 0],
      ["url", isHttpsUrl(raw?.url)],
      ["retrievedDate", isIsoDate(raw?.retrievedDate)],
    ],
    build: () => {
      return {
        hardwareId: raw.hardwareId,
        maxTempC: raw.maxTempC,
        source: sourcesById.get(raw.sourceId),
        url: raw.url,
        retrievedDate: raw.retrievedDate,
      };
    },
  });
};

export const parseData = (raw) => {
  const sources = parseList({ file: "sources.json", raw: raw.sources, parseItem: parseSource });
  const benchmarks = parseList({ file: "benchmarks.json", raw: raw.benchmarks, parseItem: parseBenchmark });
  const hardware = parseList({ file: "hardware.json", raw: raw.hardware, parseItem: parseHardware });
  const sourcesById = new Map(sources.items.map((source) => [source.id, source]));
  const hardwareById = new Map(hardware.items.map((item) => [item.id, item]));
  const testKeys = new Set(
    benchmarks.items.flatMap((benchmark) => {
      return benchmark.versions.flatMap((version) => {
        return version.tests.map((test) => {
          return toComparisonKey({ benchmark: benchmark.id, version: version.id, test: test.id });
        });
      });
    }),
  );
  const scores = parseList({
    file: "scores.json",
    raw: raw.scores,
    parseItem: (item) => {
      return parseScore({ raw: item, sourcesById, hardwareById, testKeys });
    },
  });
  const temperatureLimits = parseList({
    file: "temperature-limits.json",
    raw: raw.temperatureLimits,
    parseItem: (item) => {
      return parseTemperatureLimit({ raw: item, sourcesById, hardwareById });
    },
  });
  return {
    data: {
      site: parseSite(raw.site),
      sources: sources.items,
      benchmarks: benchmarks.items,
      hardware: hardware.items,
      hardwareById,
      scores: scores.items,
      temperatureLimitsByHardwareId: new Map(temperatureLimits.items.map((limit) => [limit.hardwareId, limit])),
    },
    problems: [
      ...sources.problems,
      ...benchmarks.problems,
      ...hardware.problems,
      ...scores.problems,
      ...temperatureLimits.problems,
    ],
  };
};

const fetchJson = async (file) => {
  const url = toSiteUrl(`data/${file}`);
  const response = await fetch(url).catch((error) => {
    throw new Error(`Could not fetch ${url}`, { cause: error });
  });
  if (!response.ok) {
    throw new Error(`Could not load ${url}: HTTP ${response.status}`);
  }
  return response.json().catch((error) => {
    throw new Error(`${url} is not valid JSON`, { cause: error });
  });
};

export const loadSite = async () => parseSite(await fetchJson("site.json"));

export const loadData = async () => {
  const [site, sources, benchmarks, hardware, scores, temperatureLimits] = await Promise.all(
    ["site.json", "sources.json", "benchmarks.json", "hardware.json", "scores.json", "temperature-limits.json"].map(fetchJson),
  );
  const { data, problems } = parseData({ site, sources, benchmarks, hardware, scores, temperatureLimits });
  problems.forEach(({ file, index, reason }) => {
    console.warn(`Dropped entry ${index} in data/${file}: ${reason}`);
  });
  return data;
};
