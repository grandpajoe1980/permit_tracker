import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, layout, css, readme] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
]);

test("uses the typed domain module without duplicating fixtures in the UI", () => {
  assert.match(page, /^"use client";/);
  assert.match(page, /from "@\/lib\/demo-data"/);
  assert.match(page, /from "@\/lib\/permit-utils"/);
  assert.doesNotMatch(page, /WQ-2024-00142|applicant\.happypath/);
});

test("preserves stable journey labels and semantic controls", () => {
  assert.match(page, /Select your agency/i);
  assert.match(page, /Sign in to the PATH demo/i);
  assert.match(page, /My applications/i);
  assert.match(page, /id="agency-next"/);
  assert.match(page, /id="login-submit"/);
  assert.match(page, /id="login-error" role="alert"/);
  assert.match(page, /id="new-permit-link"/);
  assert.match(
    page,
    /https:\/\/www\.deq\.louisiana\.gov\/about-ldeq\/office-of-environmental-services-welcome/,
  );
  assert.match(page, /target="_blank"/);
  assert.match(page, /rel="noopener noreferrer"/);
  assert.match(page, /role="group" aria-label="Available agencies"/);
  assert.match(page, /aria-live="polite"/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML|onclick\s*=/);
});

test("ships final product metadata without starter preview markers", () => {
  assert.match(layout, /PATH — Permit Application Tracker/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
});

test("includes responsive, focus, reduced-motion, and print protections", () => {
  assert.match(css, /\.skip-link:focus/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /@media print/);
  assert.match(css, /\.demo-banner/);
});

test("documents the public-demo boundary and production security gap", () => {
  assert.match(readme, /not connected to LDEQ or any government system/i);
  assert.match(readme, /not a security boundary/i);
  assert.match(readme, /server-side authorization/i);
});
