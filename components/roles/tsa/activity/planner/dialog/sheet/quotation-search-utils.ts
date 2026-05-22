export type ItemCodeVariant = {
  label: string;
  code: string;
};

export type SearchContext = {
  normalizedTerm: string;
  phraseUpper: string;
  tokensUpper: string[];
  codeTokensUpper: string[];
};

const CODE_LIKE_TOKEN_RE = /[\d-]/;

export const buildSearchContext = (rawTerm: string): SearchContext => {
  const normalizedTerm = rawTerm.trim();
  const phraseUpper = normalizedTerm.toUpperCase();

  const tokenSet = new Set(
    phraseUpper
      .split(/[\s,;|/\\]+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 2)
  );

  const tokensUpper = Array.from(tokenSet);
  const codeTokensUpper = tokensUpper.filter(
    (token) => CODE_LIKE_TOKEN_RE.test(token) || token.length >= 5
  );

  return {
    normalizedTerm,
    phraseUpper,
    tokensUpper,
    codeTokensUpper,
  };
};

export const matchesSearchText = (
  haystackUpper: string,
  phraseUpper: string,
  tokensUpper: string[]
) => {
  if (!phraseUpper) return false;
  if (haystackUpper.includes(phraseUpper)) return true;
  if (tokensUpper.length === 0) return false;
  return tokensUpper.every((token) => haystackUpper.includes(token));
};

export type VariantSelectionResult = {
  matchedVariants: ItemCodeVariant[];
  autoSelectedVariant: ItemCodeVariant | null;
  hasExactCodeMatch: boolean;
};

export const resolveVariantSelection = (
  variants: ItemCodeVariant[],
  phraseUpper: string,
  codeTokensUpper: string[]
): VariantSelectionResult => {
  if (!variants.length) {
    return {
      matchedVariants: [],
      autoSelectedVariant: null,
      hasExactCodeMatch: false,
    };
  }

  const exactMatches = variants.filter((variant) => {
    const codeUpper = variant.code.toUpperCase();
    return codeTokensUpper.some((token) => codeUpper === token);
  });

  const fuzzyMatches = variants.filter((variant) => {
    const codeUpper = variant.code.toUpperCase();
    if (codeTokensUpper.some((token) => codeUpper.includes(token))) return true;
    if (phraseUpper && codeUpper.includes(phraseUpper)) return true;
    return false;
  });

  const matchedVariants = exactMatches.length > 0 ? exactMatches : fuzzyMatches;
  const autoSelectedVariant =
    exactMatches.length === 1
      ? exactMatches[0]
      : matchedVariants.length === 1
        ? matchedVariants[0]
        : null;

  return {
    matchedVariants,
    autoSelectedVariant,
    hasExactCodeMatch: exactMatches.length > 0,
  };
};

export const executeSingleQuery = async <TSnapshot, TResult>(
  queryOnce: () => Promise<TSnapshot>,
  mapSnapshot: (snapshot: TSnapshot) => TResult
): Promise<TResult> => {
  const snapshot = await queryOnce();
  return mapSnapshot(snapshot);
};
