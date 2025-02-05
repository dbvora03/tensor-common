import { Maybe, isNullLike } from '../utils';
import {
  Attribute,
  AttributeCamelCase,
  RarityRanks,
  RaritySystem,
} from './types';

export const getRarityRank = (
  system: RaritySystem,
  ranks: RarityRanks,
): number | null => {
  switch (system) {
    case RaritySystem.Hrtt:
      return (
        ranks.rarityRankTTCustom ??
        ranks.rarityRankTeam ??
        ranks.rarityRankTT ??
        ranks.rarityRankHR ??
        null
      );
    case RaritySystem.Stat:
      return ranks.rarityRankTTStat ?? ranks.rarityRankStat ?? null;
    case RaritySystem.Team:
      return ranks.rarityRankTeam ?? null;
    case RaritySystem.Tn:
      return ranks.rarityRankTN ?? null;
  }
};

// Special trait type to use for filtering by the NFT's name.
export const NAME_TRAIT_TYPE = '<name>';

export const nullLikeTraitValues = [
  'none',
  'null',
  'nill',
  'undefined',
  '',
  'nothing',
  'not present',
  'not_present',
  'not-present',
  'not set',
  'not_set',
  'not-set',
  'not available',
  'not_available',
  'not-available',
  'not',
  'neither',
  'empty',
  'bad',
  'absent',
  'missing',
  'lacking',
  'unavailable',
  'n/a',
  'na',
  'n.a.',
];
export const NONE_TRAIT_VALUE = 'None';

export const normalizeTraitValue = (value: string) => {
  if (nullLikeTraitValues.includes(`${value}`.toLowerCase())) {
    return NONE_TRAIT_VALUE;
  }
  return value;
};

export const countNonNullAttributes = (
  attributes: Attribute[],
  /// If true, will count attributes with a value of "None" as non-null.
  includeNone = false,
): number => {
  return attributes.filter((a) => {
    if (isNullLike(a.trait_type) || isNullLike(a.value)) {
      return false;
    }

    if (!includeNone && NONE_TRAIT_VALUE === a.value) {
      return false;
    }

    if (nullLikeTraitValues.includes(normalizeTraitValue(a.value))) {
      return false;
    }
    return true;
  }).length;
};

export const matchesTraitFilter = ({
  traitsFilter,
  attributes,
  name,
}: {
  traitsFilter: { traitType: string; values: string[] }[];
  attributes: Maybe<Attribute[]>;
  name: Maybe<string>;
}) => {
  //AND for traits themselves
  return traitsFilter.every(({ traitType, values }) => {
    if (traitType === NAME_TRAIT_TYPE) {
      return !isNullLike(name) && values.includes(name);
    }

    const matches = attributes?.filter((attr) => attr.trait_type === traitType);
    if (!matches?.length) return values.includes(NONE_TRAIT_VALUE);

    //OR for values within the same trait
    const matched = matches.some((m: Attribute) =>
      values.includes(normalizeTraitValue(m.value)),
    );
    return matched;
  });
};

// Copied from Prisma.JsonValue.
type JsonObject = { [Key in string]?: JsonValue };
interface JsonArray extends Array<JsonValue> {}
type JsonValue = string | number | boolean | JsonObject | JsonArray | null;

export const normalizeMintTraits = (
  attrs: Attribute[] | JsonValue | undefined,
): Attribute[] | null => {
  // --------------------------------------- normalize trait data
  if (
    attrs === undefined ||
    attrs === null ||
    typeof attrs === 'number' ||
    typeof attrs === 'string' ||
    typeof attrs === 'boolean'
  ) {
    return null;
  }

  // For some collections (rarible), attributes is an object with {traitType: value}.
  const attrsArr = Array.isArray(attrs)
    ? attrs
    : Object.entries(attrs).map(([trait_type, value]) => ({
        trait_type,
        value,
      }));

  // Can't make this an object since mints may have duplicate
  // trait types.
  const traits: Attribute[] = [];
  for (const attr of attrsArr) {
    if (
      attr === null ||
      typeof attr === 'number' ||
      typeof attr === 'string' ||
      typeof attr === 'boolean'
    ) {
      continue;
    }

    if (!('value' in attr)) {
      continue;
    }

    if (!('trait_type' in attr)) {
      continue;
    }

    traits.push({
      // Some collections (nftworlds) have attributes that only have a value type.
      // We assign it to the "attribute" trait type.
      trait_type: (attr['trait_type'] ?? 'attribute') as string,
      // Some projects (SMB) have leading/trailing whitespace.
      // This will also store nulls and undefines
      value: normalizeTraitValue(`${attr['value']}`.trim()),
    });
  }

  return traits;
};

export const camelCaseAttributes = (
  attributes: Attribute[],
): AttributeCamelCase[] =>
  attributes.map((a) => ({
    traitType: a.trait_type,
    value: a.value,
  }));

export const snakeCaseAttributes = (
  attributes: AttributeCamelCase[],
): Attribute[] =>
  attributes.map((a) => ({
    trait_type: a.traitType,
    value: a.value,
  }));

export const hasMatchingTraits = (
  requiredTraits: Attribute[],
  nftTraits: Attribute[],
): boolean => {
  const requiredTraitsMap: Record<string, string[]> = {};

  for (const item of requiredTraits) {
    requiredTraitsMap[item.trait_type] ??= [];
    requiredTraitsMap[item.trait_type].push(item.value);
  }

  //AND'ing (all traitTypes have to match)
  for (const traitType in requiredTraitsMap) {
    const acceptedValues = requiredTraitsMap[traitType];

    //OR'ing (only one value has to match)
    const match = nftTraits.some(
      (item) =>
        item.trait_type === traitType && acceptedValues.includes(item.value),
    );

    // If there's a trait type without a matching value, return false
    if (!match) {
      return false;
    }
  }

  // If all trait types have a matching value, return true
  return true;
};
