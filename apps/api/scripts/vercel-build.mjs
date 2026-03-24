import { execSync } from "node:child_process";

const nonPoolingUrl = process.env.POSTGRES_URL_NON_POOLING;
const standardUrl = process.env.DATABASE_URL;

const selectedUrl = nonPoolingUrl || standardUrl;

if (!selectedUrl) {
  console.error("[vercel-build] Missing database URL.");
  console.error("Set DATABASE_URL, or connect Vercel Postgres integration (POSTGRES_URL_NON_POOLING).");
  process.exit(1);
}

let normalizedUrl = selectedUrl;
if (!/connect_timeout=/i.test(normalizedUrl)) {
  const joiner = normalizedUrl.includes("?") ? "&" : "?";
  normalizedUrl = `${normalizedUrl}${joiner}connect_timeout=15`;
}

process.env.DATABASE_URL = normalizedUrl;

console.log("[vercel-build] Running prisma generate...");
execSync("npx prisma generate", { stdio: "inherit" });

console.log("[vercel-build] Running prisma db push...");
execSync("npx prisma db push", { stdio: "inherit" });

console.log("[vercel-build] Prisma schema sync complete.");
