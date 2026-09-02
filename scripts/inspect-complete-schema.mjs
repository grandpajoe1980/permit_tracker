import fs from "node:fs";
import path from "node:path";

const migrationsDir = path.resolve("supabase/migrations");
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();

const tables = new Set();
const views = new Set();
const functions = new Map();
const policies = new Map();
const triggers = new Map();
const enums = new Set();

for (const file of files) {
  const content = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  
  // Tables
  const tableMatches = content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_\.\"]+)/gi);
  for (const m of tableMatches) {
    tables.add(m[1].replace(/["']/g, ''));
  }

  // Views
  const viewMatches = content.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_\.\"]+)/gi);
  for (const m of viewMatches) {
    views.add(m[1].replace(/["']/g, ''));
  }

  // Functions
  const funcMatches = content.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_\.\"]+)\s*\(([^)]*)\)/gi);
  for (const m of funcMatches) {
    const fnName = m[1].replace(/["']/g, '');
    const fnArgs = m[2].replace(/\s+/g, ' ').trim();
    functions.set(fnName, { file, args: fnArgs });
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
    triggers.set(triggerName, file);
  }

  // Types / Enums
  const typeMatches = content.matchAll(/CREATE\s+TYPE\s+([a-zA-Z0-9_\.\"]+)/gi);
  for (const m of typeMatches) {
    enums.add(m[1].replace(/["']/g, '').trim());
  }
}

console.log("=== SUMMARY FROM MIGRATIONS ===");
console.log(`Total Migration Files: ${files.length}`);
console.log(`Total Tables: ${tables.size}`);
console.log(Array.from(tables).sort().map(t => `  - ${t}`).join("\n"));

console.log(`\nTotal Views: ${views.size}`);
console.log(Array.from(views).sort().map(v => `  - ${v}`).join("\n"));

console.log(`\nTotal RPC / Schema Functions: ${functions.size}`);
for (const [name, info] of Array.from(functions.entries()).sort()) {
  console.log(`  - ${name}(${info.args}) [${info.file}]`);
}

console.log(`\nTotal Policies: ${Array.from(policies.values()).reduce((a, b) => a + b.length, 0)} across ${policies.size} tables`);
for (const [table, pols] of Array.from(policies.entries()).sort()) {
  console.log(`  Table: ${table} (${pols.length} policies)`);
  for (const p of pols) {
    console.log(`    * ${p.name} [${p.file}]`);
  }
}

console.log(`\nTotal Triggers: ${triggers.size}`);
for (const [t, f] of Array.from(triggers.entries()).sort()) {
  console.log(`  - ${t} [${f}]`);
}
