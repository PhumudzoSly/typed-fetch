function escapeRegex(input: string): string {
  return input.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function patternToRegExp(pattern: string): RegExp {
  const placeholder = "__DOUBLE_STAR__";
  const normalized = pattern.replace(/\*\*/g, placeholder);
  const escaped = escapeRegex(normalized);
  const withDoubleStar = escaped.replace(
    new RegExp(placeholder, "g"),
    ".*"
  );
  const withSingleStar = withDoubleStar.replace(/\*/g, "[^/]*");
  return new RegExp(`^${withSingleStar}$`);
}

export function matchesAnyGlob(value: string, patterns: string[]): boolean {
  if (patterns.length === 0) {
    return false;
  }

  return patterns.some((pattern) => patternToRegExp(pattern).test(value));
}

