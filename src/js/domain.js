const MAX_HOSTNAME_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;

export function normalizeDomain(value) {
  const input = value.trim();
  if (!input) {
    throw new Error("Enter a domain or URL.");
  }

  let url;
  try {
    url = new URL(input.includes("://") ? input : `https://${input}`);
  } catch {
    throw new Error("Enter a valid domain or URL.");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || !hostname.includes(".")) {
    throw new Error("Enter a public domain name.");
  }
  if (hostname.length > MAX_HOSTNAME_LENGTH) {
    throw new Error("The domain name is too long.");
  }
  if (hostname.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    throw new Error("Enter a domain name rather than an IP address.");
  }

  const labels = hostname.split(".");
  if (
    labels.some(
      (label) =>
        !label ||
        label.length > MAX_LABEL_LENGTH ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
    )
  ) {
    throw new Error("The domain name contains an invalid label.");
  }

  return hostname;
}
