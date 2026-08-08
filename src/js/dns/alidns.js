import { fetchJsonWithTimeout } from "./http.js";
import { parseDnsJson } from "./parser.js";

const ENDPOINT = "https://dns.alidns.com/resolve";

export async function queryAliDns(hostname, type, subnet) {
  const params = new URLSearchParams({
    name: hostname,
    type,
    edns_client_subnet: subnet
  });
  const data = await fetchJsonWithTimeout(`${ENDPOINT}?${params}`);
  return { ...parseDnsJson(data, type), resolver: "AliDNS" };
}
