import { pilotConfig } from '../config';

type DomainState = {
  failures: number;
  blockedUntil?: number;
};

const states =
  new Map<string, DomainState>();

export function canRequestDomain(
  hostname: string,
): boolean {
  const state =
    states.get(hostname);

  if (!state) {
    return true;
  }

  if (
    state.blockedUntil &&
    state.blockedUntil >
      Date.now()
  ) {
    return false;
  }

  if (
    state.blockedUntil &&
    state.blockedUntil <=
      Date.now()
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
    pilotConfig.network
      .circuitBreaker
      .failureThreshold
  ) {
    current.blockedUntil =
      Date.now() +
      pilotConfig.network
        .circuitBreaker
        .blockDurationMs;
  }

  states.set(
    hostname,
    current,
  );
}