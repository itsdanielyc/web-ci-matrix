// Turns a GitHub Actions run into a short digest an agent can act on without
// reading logs: which jobs failed, the first error lines of each failed step,
// and which artifacts exist. Needs the gh CLI, signed in.
// Usage: node scripts/triage.mjs [run-id]   (default: the latest run on this branch)
import { execFileSync } from "node:child_process";

const MAX_LINES_PER_JOB = 12;
const repo = sh("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]).trim();
let runId = process.argv[2];
if (!runId) {
  const branch = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  runId = sh("gh", ["run", "list", "-R", repo, "-b", branch, "-L", "1", "--json", "databaseId", "--jq", ".[0].databaseId"]).trim();
}
if (!runId) die("no run found");

const run = JSON.parse(sh("gh", ["run", "view", runId, "-R", repo, "--json", "status,conclusion,name,headBranch,url,jobs"]));
const failed = run.jobs.filter((j) => j.conclusion && j.conclusion !== "success" && j.conclusion !== "skipped");
const out = [];
out.push(`# ${run.name} run ${runId} on ${run.headBranch}: ${run.status} ${run.conclusion ?? ""}`.trim());
out.push(run.url);
out.push(`jobs: ${run.jobs.length}, failed: ${failed.length}, passed: ${run.jobs.filter((j) => j.conclusion === "success").length}`);

for (const job of failed) {
  const step = (job.steps ?? []).find((s) => s.conclusion === "failure");
  out.push("");
  out.push(`## ${job.name}: ${job.conclusion}${step ? ` at step "${step.name}"` : ""}`);
  let log = "";
  try {
    log = sh("gh", ["run", "view", runId, "-R", repo, "--job", String(job.databaseId), "--log-failed"]);
  } catch {
    out.push("  (log not available yet)");
    continue;
  }
  const lines = log
    .split(/\r?\n/)
    .map((l) => l.replace(/^[^\t]*\t[^\t]*\t/, "").replace(/^\S+Z\s/, "")) // strip "job\tstep\ttimestamp"
    .filter((l) => /error|fail|✖|✗|expected|received|panicked|exit code|not found|timed out|Timeout/i.test(l))
    .filter((l) => !/^##\[group\]|^##\[endgroup\]|warning:/i.test(l));
  const unique = [...new Set(lines)].slice(0, MAX_LINES_PER_JOB);
  if (unique.length === 0) out.push("  (no error-looking lines; open the log)");
  for (const l of unique) out.push(`  ${l.trim().slice(0, 200)}`);
}

let artifacts = [];
try {
  artifacts = JSON.parse(sh("gh", ["api", `repos/${repo}/actions/runs/${runId}/artifacts`, "--jq", "[.artifacts[].name]"]));
} catch {}
if (artifacts.length) {
  out.push("");
  out.push(`artifacts: ${artifacts.join(", ")}`);
  out.push(`fetch one: gh run download ${runId} -R ${repo} -n <name> -D <dir>`);
}
console.log(out.join("\n"));

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
}
function die(msg) {
  console.error(msg);
  process.exit(1);
}
