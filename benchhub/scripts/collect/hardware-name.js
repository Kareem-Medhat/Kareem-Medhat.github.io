export const IdentityKind = Object.freeze({ Known: "known", UnsupportedVendor: "unsupportedVendor" });

const toMatchName = (untaggedModel) => {
  return untaggedModel
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/\bgeforce\s+/, "")
    .replace(/(\d)\s+(gb?)\b/g, "$1$2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
};

// "+" separates real models (Ryzen AI Max+ 395 vs Ryzen AI Max 390), so it is spelled out
// instead of being dropped with the other punctuation.
export const toSlug = (text) => {
  return text
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
};

export const toHardwareIdentity = ({ name, type, formFactor, vendors }) => {
  const [firstWord, ...rest] = name.trim().split(/\s+/);
  const vendor = vendors.find((candidate) => candidate.toLowerCase() === firstWord.toLowerCase());
  if (vendor === undefined || rest.length === 0) {
    return { kind: IdentityKind.UnsupportedVendor, name };
  }
  // Sources tag the form factor in the name ("(notebook)", "Laptop GPU", "Mobile"). The
  // tag is dropped for matching, because the form factor is tracked as its own field.
  const formFactorTag = /\s*\((?:notebook|laptop|desktop)\)|\s+laptop(?:\s+gpu)?\b|\s+desktop(?:\s+gpu)?$|\s+mobile$/gi;
  const taggedModel = rest.join(" ");
  // UL appends a bare "GPU" to some names ("Arc 140T GPU") that other sources leave off.
  const untaggedModel = taggedModel.replace(formFactorTag, "").replace(/\s+gpu$/i, "").trim();
  const isTaggedLaptopGpu = type === "gpu" && formFactor === "laptop" && untaggedModel !== taggedModel;
  return {
    kind: IdentityKind.Known,
    type,
    formFactor,
    vendor,
    model: isTaggedLaptopGpu ? `${untaggedModel} Laptop GPU` : untaggedModel,
    matchKey: `${type}:${formFactor}:${vendor.toLowerCase()} ${toMatchName(untaggedModel)}`,
  };
};

export const toCatalogMatchKey = ({ hardware, vendors }) => {
  const name = [hardware.vendor, hardware.model, hardware.variant].filter((part) => part !== undefined).join(" ");
  const identity = toHardwareIdentity({ name, type: hardware.type, formFactor: hardware.formFactor, vendors });
  return identity.kind === IdentityKind.Known ? identity.matchKey : undefined;
};
