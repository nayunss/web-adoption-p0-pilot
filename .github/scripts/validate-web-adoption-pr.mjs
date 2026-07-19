#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const LOCK_PATH = ".ai/manifests/release-adoption.lock.json";
const ROLLBACK_PATH = ".ai/manifests/release-adoption.rollback.json";
const BASE_REF = process.env.BASE_REF;
const HASH = /^sha256:[a-f0-9]{64}$/u;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function sha256(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

if (!/^[A-Za-z0-9._/-]+$/u.test(BASE_REF ?? "")) throw new Error("BASE_REF is invalid");
const base = `origin/${BASE_REF}`;
git(["rev-parse", "--verify", base]);
const changed = git(["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`])
  .split("\n")
  .filter(Boolean)
  .sort();
if (!changed.includes(LOCK_PATH) || !changed.includes(ROLLBACK_PATH)) {
  throw new Error("adoption lock and rollback record must both be present");
}

const lock = JSON.parse(readFileSync(LOCK_PATH, "utf8"));
if (!HASH.test(lock.planSha256 ?? "")) throw new Error("adoption lock plan SHA-256 is invalid");
const expectedPlan = process.env.EXPECTED_PLAN_SHA256
  || JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")).pull_request?.body
    ?.match(/sha256:[a-f0-9]{64}/u)?.[0];
if (!HASH.test(expectedPlan ?? "") || expectedPlan !== lock.planSha256) {
  throw new Error("PR approval plan does not match the adoption lock");
}

const allowed = new Set([
  LOCK_PATH,
  ROLLBACK_PATH,
  ...(lock.files ?? []).map((file) => file.path),
]);
const unexpected = changed.filter((path) => !allowed.has(path));
const missing = [...allowed].filter((path) => !changed.includes(path));
if (unexpected.length || missing.length) {
  throw new Error(`adoption path boundary mismatch; unexpected=${unexpected.join(",")} missing=${missing.join(",")}`);
}
for (const file of lock.files ?? []) {
  if (!HASH.test(file.sha256 ?? "") || sha256(file.path) !== file.sha256) {
    throw new Error(`managed file hash mismatch: ${file.path}`);
  }
}

const ownerAtBase = git(["show", `${base}:owner.txt`]);
const ownerAtHead = readFileSync("owner.txt", "utf8").trimEnd();
if (ownerAtHead !== ownerAtBase) throw new Error("owner.txt changed");
if (lock.execution?.dependencyInstall !== "NOT_RUN"
  || lock.execution?.databaseMigration !== "NOT_RUN"
  || lock.execution?.providerWrite !== "NOT_RUN"
  || lock.execution?.productionDeploy !== "NOT_RUN") {
  throw new Error("adoption lock expanded the execution boundary");
}

process.stdout.write(`Web adoption PR validation: PASS (${changed.length} allowed paths, ${lock.planSha256})\n`);

