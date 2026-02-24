import { matchesAnyGlob } from "./glob";

export function shouldTrackEndpoint(pathname: string, include: string[], exclude: string[]): boolean {
  if (matchesAnyGlob(pathname, exclude)) {
    return false;
  }

  if (include.length === 0) {
    return true;
  }

  return matchesAnyGlob(pathname, include);
}

