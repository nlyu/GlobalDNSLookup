export class ProviderError extends Error {
  constructor(kind, message, options = {}) {
    super(message, options);
    this.name = "ProviderError";
    this.kind = kind;
  }
}

export function errorLabel(error) {
  switch (error?.kind) {
    case "timeout":
      return "Timeout";
    case "rate_limited":
      return "Rate limited";
    case "provider_unavailable":
      return "Resolver unavailable";
    case "malformed_response":
      return "Invalid response";
    default:
      return "Query failed";
  }
}
