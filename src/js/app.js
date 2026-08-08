import { locations } from "../data/locations.js";
import { normalizeDomain } from "./domain.js";
import { resolveLocation } from "./dns/resolver.js";
import { createLoadingRows, createWaitingRows, updateResultRow } from "./ui/results.js";

const form = document.querySelector("#lookup-form");
const input = document.querySelector("#domain-input");
const button = document.querySelector("#lookup-button");
const error = document.querySelector("#input-error");
const resultsSection = document.querySelector("#results-section");
const resultsBody = document.querySelector("#results-body");
const resultsTitle = document.querySelector("#results-title");
const summary = document.querySelector("#lookup-summary");
const liveStatus = document.querySelector("#live-status");
const year = document.querySelector("#current-year");
const themeToggle = document.querySelector("#theme-toggle");

year.textContent = new Date().getFullYear();
createWaitingRows(resultsBody, locations);
updateThemeButton();

themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem("globalDnsTheme", nextTheme);
  updateThemeButton();
});

document.querySelectorAll("[data-example]").forEach((exampleButton) => {
  exampleButton.addEventListener("click", () => {
    input.value = exampleButton.dataset.example;
    form.requestSubmit();
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  let hostname;
  try {
    hostname = normalizeDomain(input.value);
  } catch (validationError) {
    showError(validationError.message);
    input.focus();
    return;
  }

  hideError();
  button.disabled = true;
  button.textContent = "Looking up...";
  resultsTitle.textContent = `DNS results for ${hostname}`;
  summary.textContent = `0 / ${locations.length} complete`;
  resultsSection.hidden = false;
  createLoadingRows(resultsBody, locations);
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });

  let completed = 0;
  await Promise.all(
    locations.map(async (location) => {
      const result = await resolveLocation(hostname, location);
      updateResultRow(result);
      completed += 1;
      summary.textContent = `${completed} / ${locations.length} complete`;
      liveStatus.textContent = `${location.name} lookup complete.`;
    })
  );

  button.disabled = false;
  button.textContent = "Lookup";
  liveStatus.textContent = `DNS lookup for ${hostname} complete.`;
});

function showError(message) {
  error.textContent = message;
  error.hidden = false;
}

function hideError() {
  error.textContent = "";
  error.hidden = true;
}

function updateThemeButton() {
  const isDark = document.documentElement.dataset.theme === "dark";
  themeToggle.firstElementChild.textContent = isDark ? "☀" : "☾";
  themeToggle.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
}
