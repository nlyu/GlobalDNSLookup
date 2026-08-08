const labels = {
  success: "Done",
  partial_success: "Partial",
  nxdomain: "NXDOMAIN",
  failed: "Failed"
};

export function createWaitingRows(body, locations) {
  body.replaceChildren(
    ...locations.map((location) => {
      const row = document.createElement("tr");
      row.id = `result-${location.code}`;
      row.innerHTML = `
        <td class="location" data-label="Location"><span class="country-flag" role="img" aria-label="${location.name} flag">${location.flag}</span>${location.name}<div class="record-meta">${location.subnet}</div></td>
        <td data-label="CNAME">—</td>
        <td data-label="A">—</td>
        <td data-label="AAAA">—</td>
        <td data-label="Resolver">—</td>
        <td data-label="Status"><span class="status">Waiting</span></td>
      `;
      return row;
    })
  );
}

export function createLoadingRows(body, locations) {
  body.replaceChildren(
    ...locations.map((location) => {
      const row = document.createElement("tr");
      row.id = `result-${location.code}`;
      row.innerHTML = `
        <td class="location" data-label="Location"><span class="country-flag" role="img" aria-label="${location.name} flag">${location.flag}</span>${location.name}<div class="record-meta">${location.subnet}</div></td>
        <td data-label="CNAME">Querying...</td>
        <td data-label="A">Querying...</td>
        <td data-label="AAAA">Querying...</td>
        <td data-label="Resolver">—</td>
        <td data-label="Status"><span class="status status-loading">Querying</span></td>
      `;
      return row;
    })
  );
}

export function updateResultRow(result) {
  const row = document.querySelector(`#result-${result.location.code}`);
  if (!row) {
    return;
  }

  const statusClass =
    result.status === "success"
      ? "status-success"
      : result.status === "partial_success"
        ? "status-partial"
        : "status-error";

  row.replaceChildren(
    cell("Location", locationHtml(result)),
    cell("CNAME", cnameHtml(result.cname)),
    cell("A", recordHtml(result.a)),
    cell("AAAA", recordHtml(result.aaaa)),
    cell("Resolver", resolverHtml(result)),
    cell(
      "Status",
      `<span class="status ${statusClass}">${labels[result.status]}</span><div class="record-meta">${result.durationMs} ms</div>`
    )
  );
}

function cell(label, html) {
  const td = document.createElement("td");
  td.dataset.label = label;
  td.innerHTML = html;
  if (label === "Location") {
    td.className = "location";
  }
  return td;
}

function locationHtml(result) {
  const name = escapeHtml(result.location.name);
  return `<span class="country-flag" role="img" aria-label="${name} flag">${result.location.flag}</span>${name}<div class="record-meta">${escapeHtml(result.location.subnet)}</div>`;
}

function cnameHtml(records) {
  if (records.length === 0) {
    return "—";
  }
  return list(
    records.map(
      (record) =>
        `${escapeHtml(record.value)}<div class="record-meta">TTL ${record.ttl} · ${record.resolver}</div>`
    )
  );
}

function recordHtml(result) {
  if (result.status === "nxdomain") {
    return "NXDOMAIN";
  }
  if (result.status === "failed") {
    return `<span class="input-error">${escapeHtml(result.error)}</span>`;
  }
  if (result.records.length === 0) {
    return `No record<div class="record-meta">${escapeHtml(result.resolver ?? "")}</div>`;
  }
  return list(
    result.records.map(
      (record) =>
        `${escapeHtml(record.value)}<div class="record-meta">TTL ${record.ttl}</div>`
    )
  );
}

function resolverHtml(result) {
  const values = [
    result.a.resolver ? `A: ${result.a.resolver}` : null,
    result.aaaa.resolver ? `AAAA: ${result.aaaa.resolver}` : null
  ].filter(Boolean);
  return values.length ? values.join("<br>") : "—";
}

function list(items) {
  return `<ul class="record-list">${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
