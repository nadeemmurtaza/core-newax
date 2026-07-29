export interface SplitPersonName {
  readonly firstName: string;
  readonly lastName: string;
}

/**
 * v1 policy (lossy, documented): split on the last whitespace-separated
 * token as lastName, everything before it as firstName. A single-token name
 * uses it as both. Callers must not invoke this with a blank name -- the
 * "no name" case means no CorePerson is created at all.
 */
export function splitPersonName(name: string): SplitPersonName {
  const tokens = name.split(/\s+/u).filter((token) => token.length > 0);
  const firstToken = tokens[0];
  if (firstToken === undefined) {
    throw new Error('splitPersonName requires a non-blank name.');
  }
  if (tokens.length === 1) {
    return { firstName: firstToken, lastName: firstToken };
  }
  const lastName = tokens[tokens.length - 1] as string;
  return { firstName: tokens.slice(0, -1).join(' '), lastName };
}
