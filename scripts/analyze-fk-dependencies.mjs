import fs from "node:fs";
import path from "node:path";

const migrationsDir = path.resolve("supabase/migrations");
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();

const tableColumns = {}; // tableName -> { colName: { type, nullable, references } }
const foreignKeys = []; // { fromTable, fromCol, toTable, toCol }

for (const file of files) {
  const content = fs.readFileSync(path.join(migrationsDir, file), "utf8");

  // Parse create table blocks
  const tableBlocks = content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_\.\"]+)\s*\(([\s\S]*?)\n\);/gi);
  for (const block of tableBlocks) {
    const rawTableName = block[1].replace(/["']/g, '').replace(/^public\./, '');
    const body = block[2];

    if (!tableColumns[rawTableName]) tableColumns[rawTableName] = {};

    const lines = body.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("--") || trimmed.startsWith("CONSTRAINT") || trimmed.startsWith("PRIMARY KEY") || trimmed.startsWith("UNIQUE")) {
        // Check standalone foreign key constraint
        const fkMatch = trimmed.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+([a-zA-Z0-9_\.\"]+)\s*\(([^)]+)\)/i);
        if (fkMatch) {
          foreignKeys.push({
            fromTable: rawTableName,
            fromCol: fkMatch[1].replace(/["']/g, '').trim(),
            toTable: fkMatch[2].replace(/["']/g, '').replace(/^public\./, '').trim(),
            toCol: fkMatch[3].replace(/["']/g, '').trim(),
            file,
          });
        }
        continue;
      }

      // Column definition
      const colMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_\[\]]+)([\s\S]*)/);
      if (colMatch) {
        const colName = colMatch[1];
        const colType = colMatch[2];
        const rest = colMatch[3] || "";

        const notNull = /NOT\s+NULL/i.test(rest);
        const pk = /PRIMARY\s+KEY/i.test(rest);
        
        let refTable = null;
        let refCol = null;
        const inlineRefMatch = rest.match(/REFERENCES\s+([a-zA-Z0-9_\.\"]+)(?:\s*\(([^)]+)\))?/i);
        if (inlineRefMatch) {
          refTable = inlineRefMatch[1].replace(/["']/g, '').replace(/^public\./, '').trim();
          refCol = inlineRefMatch[2] ? inlineRefMatch[2].replace(/["']/g, '').trim() : "id";
          foreignKeys.push({
            fromTable: rawTableName,
            fromCol: colName,
            toTable: refTable,
            toCol: refCol,
            file,
          });
        }

        tableColumns[rawTableName][colName] = {
          type: colType,
          notNull: notNull || pk,
          isPrimary: pk,
          references: refTable ? `${refTable}(${refCol})` : null,
        };
      }
    }
  }
}

// Build dependency graph
const graph = {}; // parent -> children (tables that reference parent)
const inDegree = {}; // table -> number of parent tables it references

for (const fk of foreignKeys) {
  if (!graph[fk.toTable]) graph[fk.toTable] = new Set();
  graph[fk.toTable].add(fk.fromTable);
}

const analysis = {
  tableColumns,
  foreignKeys,
  graph: Object.fromEntries(Object.entries(graph).map(([k, v]) => [k, Array.from(v)])),
};

fs.writeFileSync("scripts/fk-dependency-analysis.json", JSON.stringify(analysis, null, 2));
console.log(`Extracted ${Object.keys(tableColumns).length} tables and ${foreignKeys.length} foreign key relationships.`);
