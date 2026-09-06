type DomainState = {
  failures: number;
  blockedUntil?: number;
};

type CircuitBreakerConfig = {
  failureThreshold: number;
  blockDurationMs: number;
};

type CircuitBreaker = {
  canRequestDomain: (hostname: string) => boolean;
  recordDomainSuccess: (hostname: string) => void;
  recordDomainFailure: (hostname: string) => void;
};

export function createCircuitBreaker(
  config: CircuitBreakerConfig,
): CircuitBreaker {
  const states = new Map<string, DomainState>();

  return {
    canRequestDomain(hostname: string): boolean {
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
    },

    recordDomainSuccess(hostname: string): void {
      states.delete(hostname);
    },

    recordDomainFailure(hostname: string): void {
      const current = states.get(hostname) ?? {
        failures: 0,
      };

      current.failures += 1;

      if (
        current.failures >=
        config.failureThreshold
      ) {
        current.blockedUntil =
          Date.now() +
          config.blockDurationMs;
      }

      states.set(hostname, current);
    },
  };
}
