const fs = require("fs");
const content = fs.readFileSync("C:\\Intel\\Permit\\.env", "utf8");
const lines = content.split(/\r?\n/);
const results = {};
for (let line of lines) {
  line = line.trim();
  if (!line || line.startsWith("#")) continue;
  const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (match) {
    const key = match[1];
    let val = match[2].trim();
    let hasMatchingQuotes = false;
    let quoteChar = "";
    if ((val.startsWith("\x27") && val.endsWith("\x27")) || (val.startsWith("\"") && val.endsWith("\""))) {
      hasMatchingQuotes = true;
      quoteChar = val[0];
      val = val.substring(1, val.length - 1);
    }
    const trimmedVal = val.trim();
    const len = trimmedVal.length;
    const periodCount = (trimmedVal.match(/\./g) || []).length;
    let format = "opaque";
    if (periodCount === 2) { format = "legacy JWT"; }
    else if (trimmedVal.startsWith("sb_")) { format = "publishable/secret style"; }
    let host = "N/A";
    if (key === "SUPABASE_URL") {
      try { host = new URL(trimmedVal).host; } catch(e) { host = "Invalid URL"; }
    }
    results[key] = { present: true, length: len, hasMatchingQuotes, quoteChar, format, host, val: trimmedVal };
  }
}
["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"].forEach(k => {
  if (!results[k]) results[k] = { present: false, length: 0, hasMatchingQuotes: false, quoteChar: "", format: "opaque", host: "N/A", val: "" };
});
const https = require("https");
const http = require("http");
function makeRequest(url) {
  return new Promise((resolve) => {
    try {
      const lib = url.startsWith("https") ? https : http;
      const req = lib.get(url, (res) => resolve(res.statusCode));
      req.on("error", (e) => resolve("Error: " + e.message));
      req.end();
    } catch (err) { resolve("Exception: " + err.message); }
  });
}
async function run() {
  const url = results["SUPABASE_URL"].val;
  let settingsStatus = "N/A";
  let restStatus = "N/A";
  if (url) {
    settingsStatus = await makeRequest(url + "/auth/v1/settings");
    restStatus = await makeRequest(url + "/rest/v1/");
  }
  const cleanResults = {};
  for (let k of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    cleanResults[k] = {
      present: results[k].present,
      length: results[k].length,
      hasMatchingQuotes: results[k].hasMatchingQuotes,
      quoteChar: results[k].quoteChar,
      format: results[k].format,
      host: results[k].host
    };
  }
  console.log(JSON.stringify({ results: cleanResults, settingsStatus, restStatus }, null, 2));
}
run();
