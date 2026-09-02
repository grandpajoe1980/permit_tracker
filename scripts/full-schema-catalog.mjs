import fs from "node:fs";
import path from "node:path";

const migrationsDir = path.resolve("supabase/migrations");
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();

const tables = new Map(); // name -> list of files/definitions
const views = new Map();
const functions = new Map();
const policies = new Map();
const triggers = new Map();
const enums = new Map();

for (const file of files) {
  const content = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  
  // Tables
  const tableMatches = content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_\.\"]+)/gi);
  for (const m of tableMatches) {
    const t = m[1].replace(/["']/g, '');
    if (!tables.has(t)) tables.set(t, []);
    tables.get(t).push(file);
  }

  // Views
  const viewMatches = content.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_\.\"]+)/gi);
  for (const m of viewMatches) {
    const v = m[1].replace(/["']/g, '');
    if (!views.has(v)) views.set(v, []);
    views.get(v).push(file);
  }

  // Functions
  const funcMatches = content.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_\.\"]+)\s*\(([\s\S]*?)\)\s*(?:RETURNS|LANGUAGE)/gi);
  for (const m of funcMatches) {
    const fnName = m[1].replace(/["']/g, '');
    const fnArgs = m[2].replace(/\s+/g, ' ').trim();
    if (!functions.has(fnName)) functions.set(fnName, []);
    functions.get(fnName).push({ file, args: fnArgs });
  }

  // Policies
  const policyMatches = content.matchAll(/CREATE\s+POLICY\s+["']?([^"'\n]+?)["']?\s+ON\s+([a-zA-Z0-9_\.\"]+)/gi);
  for (const m of policyMatches) {
    const policyName = m[1].trim();
    const tableName = m[2].replace(/["']/g, '').trim();
    if (!policies.has(tableName)) policies.set(tableName, []);
    policies.get(tableName).push({ name: policyName, file });
  }

  // Triggers
  const triggerMatches = content.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([a-zA-Z0-9_\.\"]+)/gi);
  for (const m of triggerMatches) {
    const triggerName = m[1].replace(/["']/g, '').trim();
    if (!triggers.has(triggerName)) triggers.set(triggerName, []);
    triggers.get(triggerName).push(file);
  }

  // Types / Enums
  const typeMatches = content.matchAll(/CREATE\s+TYPE\s+([a-zA-Z0-9_\.\"]+)/gi);
  for (const m of typeMatches) {
    const typeName = m[1].replace(/["']/g, '').trim();
    if (!enums.has(typeName)) enums.set(typeName, []);
    enums.get(typeName).push(file);
  }
}

const report = {
  migrationFilesCount: files.length,
  migrationFiles: files,
  tablesCount: tables.size,
  tables: Object.fromEntries(tables),
  viewsCount: views.size,
  views: Object.fromEntries(views),
  functionsCount: functions.size,
  functions: Object.fromEntries(functions),
  policiesCount: Array.from(policies.values()).reduce((a, b) => a + b.length, 0),
  policiesByTable: Object.fromEntries(policies),
  triggersCount: triggers.size,
  triggers: Object.fromEntries(triggers),
  typesCount: enums.size,
  types: Object.fromEntries(enums),
};

fs.writeFileSync("scripts/schema-catalog-report.json", JSON.stringify(report, null, 2));
console.log("Wrote complete schema catalog to scripts/schema-catalog-report.json");
