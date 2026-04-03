import picomatch from "picomatch";

export function matchesAnyGlob(value: string, patterns: string[]): boolean {
  if (patterns.length === 0) {
    return false;
  }
  return patterns.some((pattern) => picomatch(pattern)(value));
}
