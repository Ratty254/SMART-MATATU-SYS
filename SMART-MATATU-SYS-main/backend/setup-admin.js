require("dotenv").config();

const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const databasePath = path.join(__dirname, "smart-matatu.db");
const db = new Database(databasePath);

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL
            CHECK (role IN ('conductor', 'sacco_manager', 'admin')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`);

async function createAdmin() {
    const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;

    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
        throw new Error("Admin username and password are required.");
    }

    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(ADMIN_USERNAME)) {
        throw new Error("Username must be 3–30 valid characters.");
    }

    if (ADMIN_PASSWORD.length < 12) {
        throw new Error("Password must contain at least 12 characters.");
    }

    const existingAdmin = db.prepare(`
        SELECT id FROM users WHERE role = 'admin' LIMIT 1
    `).get();

    if (existingAdmin) {
        throw new Error("An administrator already exists.");
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    db.prepare(`
        INSERT INTO users (username, password_hash, role)
        VALUES (?, ?, 'admin')
    `).run(ADMIN_USERNAME, passwordHash);

    console.log("Initial administrator created successfully.");
    console.log("Username:", ADMIN_USERNAME);
}

createAdmin()
    .catch(error => {
        console.error("Admin setup failed:", error.message);
        process.exitCode = 1;
    })
    .finally(() => {
        db.close();
    });