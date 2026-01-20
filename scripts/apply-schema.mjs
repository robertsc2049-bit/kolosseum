import fs from "fs";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = fs.readFileSync("./src/db/schema.sql", "utf8");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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
