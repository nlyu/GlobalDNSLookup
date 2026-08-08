import { ProviderError } from "./errors.js";

const TYPE_CNAME = 5;
const TYPE_A = 1;
const TYPE_AAAA = 28;

export function parseDnsJson(data, queryType) {
  if (!data || !Number.isInteger(data.Status)) {
    throw new ProviderError("malformed_response", "DNS response is missing a valid status.");
  }

  if (data.Status === 3) {
    return result("nxdomain");
  }
  if (data.Status === 2 || data.Status === 5) {
    throw new ProviderError("provider_unavailable", `Resolver returned DNS status ${data.Status}.`);
  }
  if (data.Status !== 0) {
    throw new ProviderError("provider_unavailable", `Resolver returned DNS status ${data.Status}.`);
  }

  const answers = data.Answer;
  if (answers !== undefined && !Array.isArray(answers)) {
    throw new ProviderError("malformed_response", "DNS answer is not an array.");
  }

  const expectedType = queryType === "A" ? TYPE_A : TYPE_AAAA;
  const cnames = [];
  const records = [];

  for (const answer of answers ?? []) {
    if (
      !answer ||
      !Number.isInteger(answer.type) ||
      typeof answer.data !== "string" ||
      !Number.isFinite(answer.TTL)
    ) {
      continue;
    }

    const record = {
      value: trimTrailingDot(answer.data),
      ttl: Math.max(0, answer.TTL)
    };

    if (answer.type === TYPE_CNAME) {
      cnames.push(record);
    } else if (answer.type === expectedType) {
      records.push(record);
    }
  }

  return {
    status: records.length > 0 ? "success" : "no_data",
    records: uniqueRecords(records),
    cnames: uniqueRecords(cnames)
  };
}

function result(status) {
  return { status, records: [], cnames: [] };
}

function trimTrailingDot(value) {
  return value.replace(/\.$/, "");
}

function uniqueRecords(records) {
  const seen = new Set();
  return records.filter((record) => {
    const key = `${record.value}|${record.ttl}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
