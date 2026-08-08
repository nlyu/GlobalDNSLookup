import { ProviderError } from "./errors.js";

export async function fetchJsonWithTimeout(url, timeoutMs = 3000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { accept: "application/dns-json" },
      signal: controller.signal
    });

    if (response.status === 429) {
      throw new ProviderError("rate_limited", "Resolver rate limit reached.");
    }
    if (!response.ok) {
      throw new ProviderError(
        response.status >= 500 ? "provider_unavailable" : "request_failed",
        `Resolver returned HTTP ${response.status}.`
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new ProviderError("malformed_response", "Resolver returned invalid JSON.", {
        cause: error
      });
    }
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }
    if (error.name === "AbortError") {
      throw new ProviderError("timeout", "Resolver request timed out.", { cause: error });
    }
    throw new ProviderError("provider_unavailable", "Resolver could not be reached.", {
      cause: error
    });
  } finally {
    clearTimeout(timeout);
  }
}
