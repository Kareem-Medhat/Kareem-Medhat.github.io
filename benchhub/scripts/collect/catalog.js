import { IdentityKind, toCatalogMatchKey, toHardwareIdentity, toSlug } from "./hardware-name.js";

export const ResolutionKind = Object.freeze({
  Existing: "existing",
  New: "new",
  UnsupportedVendor: "unsupportedVendor",
  UnknownAlias: "unknownAlias",
});

export const toCatalogIndex = ({ hardware, vendors }) => {
  return {
    byId: new Map(hardware.map((item) => [item.id, item])),
    byMatchKey: new Map(
      hardware.flatMap((item) => {
        const matchKey = toCatalogMatchKey({ hardware: item, vendors });
        return matchKey === undefined ? [] : [[matchKey, item]];
      }),
    ),
  };
};

export const resolveHardware = ({ name, type, formFactor, catalogIndex, config }) => {
  const aliasId = config.hardwareAliases[name];
  if (aliasId !== undefined) {
    const aliased = catalogIndex.byId.get(aliasId);
    return aliased === undefined
      ? { kind: ResolutionKind.UnknownAlias, name, aliasId }
      : { kind: ResolutionKind.Existing, hardware: aliased };
  }
  const identity = toHardwareIdentity({ name, type, formFactor, vendors: config.vendors });
  if (identity.kind === IdentityKind.UnsupportedVendor) {
    return { kind: ResolutionKind.UnsupportedVendor, name };
  }
  const existing = catalogIndex.byMatchKey.get(identity.matchKey);
  if (existing !== undefined) {
    return { kind: ResolutionKind.Existing, hardware: existing };
  }
  return {
    kind: ResolutionKind.New,
    matchKey: identity.matchKey,
    hardware: { id: toSlug(`${identity.vendor} ${identity.model}`), type, vendor: identity.vendor, model: identity.model, formFactor },
  };
};

// The same model name can exist as a desktop and a laptop part (integrated graphics, older
// mobile GeForce cards), so an id that is taken gets its form factor appended.
export const toUniqueHardware = ({ newHardware, catalogIndex }) => {
  const newById = Map.groupBy(newHardware, (item) => item.id);
  return newHardware.map((item) => {
    const isTaken = catalogIndex.byId.has(item.id) || newById.get(item.id).length > 1;
    return isTaken ? { ...item, id: `${item.id}-${item.formFactor}` } : item;
  });
};
