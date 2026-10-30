const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const backupPath = path.join(__dirname, "transactions-backup.json");
const databasePath = path.join(__dirname, "smart-matatu.db");


if (!fs.existsSync(backupPath)) {
    console.error("Backup file not found:", backupPath);
    process.exit(1);
}

const backupData = JSON.parse(fs.readFileSync(backupPath, "utf8"));

const transactions = Array.isArray(backupData)
    ? backupData
    : backupData.transactions;

if (!Array.isArray(transactions)) {
    console.error("Backup must contain a transactions array.");
    process.exit(1);
}

const db = new Database(databasePath);

try {
    db.pragma("journal_mode = WAL");

    db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            fare REAL NOT NULL CHECK (fare > 0),
            passengers INTEGER NOT NULL CHECK (passengers >= 1),
            total REAL NOT NULL,
            paymentmethod TEXT NOT NULL,
            status TEXT NOT NULL,
            dateTime TEXT NOT NULL
        )
    `);

    const insert = db.prepare(`
        INSERT OR IGNORE INTO transactions
        (id, fare, passengers, total, paymentmethod, status, dateTime)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const importTransactions = db.transaction((records) => {
        let imported = 0;

        for (const transaction of records) {
            if (
                typeof transaction.id !== "string" ||
                !transaction.id.trim() ||
                !Number.isFinite(transaction.fare) ||
                transaction.fare <= 0 ||
                !Number.isInteger(transaction.passengers) ||
                transaction.passengers < 1 ||
                !Number.isFinite(transaction.total) ||
                Math.abs(
                    transaction.total -
                    transaction.fare * transaction.passengers
                ) > 0.001 ||
                typeof transaction.paymentmethod !== "string" ||
                !transaction.paymentmethod.trim() ||
                typeof transaction.dateTime !== "string" ||
                !transaction.dateTime.trim()
            ) {
                throw new Error(
                    "Invalid transaction record: " + transaction.id
                );
            }

            const result = insert.run(
                transaction.id.trim(),
                transaction.fare,
                transaction.passengers,
                transaction.total,
                transaction.paymentmethod.trim(),
                transaction.status || "Paid",
                transaction.dateTime
            );

            imported += result.changes;
        }

        return imported;
    });

    const importedCount = importTransactions(transactions);

    const databaseCount = db
        .prepare("SELECT COUNT(*) AS count FROM transactions")
        .get().count;

    console.log("Backup records:", transactions.length);
    console.log("New records imported:", importedCount);
    console.log("Total records in SQLite:", databaseCount);
    console.log("Database location:", databasePath);
} catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
} finally {
    db.close();
}