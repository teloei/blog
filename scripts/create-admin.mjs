import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { webcrypto } from "node:crypto";

const DEFAULTS = {
  database: "teloei-blog-db",
  email: "admin@blog.com",
  password: "admin123",
  name: "Admin",
  role: "admin",
};

function readArg(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function quote(value) {
  return String(value).replace(/'/g, "''");
}

async function hashPassword(password) {
  const salt = Array.from(webcrypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const encoder = new TextEncoder();
  const keyMaterial = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await webcrypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: 100000, hash: "SHA-512" },
    keyMaterial,
    512
  );
  const hash = Array.from(new Uint8Array(derivedBits))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `pbkdf2:sha512:100000:${salt}:${hash}`;
}

async function main() {
  const remote = hasFlag("--remote");
  const printOnly = hasFlag("--print-only");
  const database = readArg("--db", DEFAULTS.database);
  const email = readArg("--email", DEFAULTS.email);
  const password = readArg("--password", DEFAULTS.password);
  const name = readArg("--name", DEFAULTS.name);
  const role = readArg("--role", DEFAULTS.role);

  if (!email || !password) {
    console.error("Email and password are required.");
    process.exit(1);
  }
  if (!["admin", "editor"].includes(role)) {
    console.error("Role must be admin or editor.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const sql = [
    "INSERT INTO users (email, password_hash, name, role, is_active)",
    `VALUES ('${quote(email)}', '${quote(passwordHash)}', '${quote(name)}', '${quote(role)}', 1)`,
    "ON CONFLICT(email) DO UPDATE SET",
    `password_hash='${quote(passwordHash)}',`,
    `name='${quote(name)}',`,
    `role='${quote(role)}',`,
    "is_active=1,",
    "updated_at=datetime('now');",
  ].join(" ");

  if (printOnly) {
    console.log(sql);
    return;
  }

  const args = ["d1", "execute", database];
  if (remote) args.push("--remote");
  else args.push("--local");
  args.push("--command", sql);

  const localWrangler = resolve("node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");
  const useLocalWrangler = existsSync(localWrangler);
  const command = process.platform === "win32" && useLocalWrangler ? "cmd.exe" : useLocalWrangler ? localWrangler : "npx";
  const commandArgs =
    process.platform === "win32" && useLocalWrangler
      ? ["/c", localWrangler, ...args]
      : command === "npx"
        ? ["wrangler", ...args]
        : args;

  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log(`Admin user ready: ${email} (${remote ? "remote" : "local"})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
