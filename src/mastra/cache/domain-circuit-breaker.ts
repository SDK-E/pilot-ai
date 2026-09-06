type DomainState = {
  failures: number;
  blockedUntil?: number;
};

const states = new Map<string, DomainState>();

const FAILURE_THRESHOLD = 3;
const BLOCK_MS = 60_000;

export function canRequestDomain(
  hostname: string,
): boolean {
  const state = states.get(hostname);

  if (!state) {
    return true;
  }

  if (
    state.blockedUntil &&
    state.blockedUntil > Date.now()
  ) {
    return false;
  }

  if (
    state.blockedUntil &&
    state.blockedUntil <= Date.now()
  ) {
    states.delete(hostname);
  }

  return true;
}

export function recordDomainSuccess(
  hostname: string,
): void {
  states.delete(hostname);
}

export function recordDomainFailure(
  hostname: string,
): void {
  const current =
    states.get(hostname) ?? {
      failures: 0,
    };

  current.failures += 1;

  if (
    current.failures >=
    FAILURE_THRESHOLD
  ) {
    current.blockedUntil =
      Date.now() + BLOCK_MS;
  }

  states.set(hostname, current);
}