import fs from "fs";
import path from "node:path";
import { Pool } from "pg";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const schemaPath = path.resolve(process.cwd(), "schema.sql");
if (!fs.existsSync(schemaPath)) {
  console.error(`schema.sql not found at: ${schemaPath}`);
  process.exit(1);
}

let sql = fs.readFileSync(schemaPath, "utf8");

// Strip UTF-8 BOM if present (Postgres can choke at position 1)
if (sql.length > 0 && sql.charCodeAt(0) === 0xfeff) {
  sql = sql.slice(1);
}

// Ensure we run in a transaction even if schema.sql forgets BEGIN/COMMIT
sql = `BEGIN;\n${sql}\nCOMMIT;\n`;

const pool = new Pool({ connectionString: dbUrl });

try {
  await pool.query(sql);
  console.log("Schema applied successfully");
} catch (err) {
  console.error("Schema apply failed");
  console.error(err);
  process.exit(1);
} finally {
  await pool.end();
}
