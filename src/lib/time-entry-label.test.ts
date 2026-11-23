import { test } from "node:test";
import { strict as assert } from "node:assert";
import { normalizeTimeEntryLabel } from "./time-entry-label";

test("company and task labels match across case and spacing", () => {
  assert.equal(normalizeTimeEntryLabel("Company Name"), normalizeTimeEntryLabel("COMPANYNAME"));
  assert.equal(normalizeTimeEntryLabel("Statutory Audit FY26"), normalizeTimeEntryLabel("statutoryauditfy26"));
  assert.notEqual(normalizeTimeEntryLabel("Company One"), normalizeTimeEntryLabel("Company Two"));
});
