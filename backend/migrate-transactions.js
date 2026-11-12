const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const backupPath = path.join(__dirname, "transactions-backup.json");
const databasePath = path.join(__dirname, "smart-matatu.db");

if (!fs.existsSync(backupPath) || !fs.existsSync(databasePath)) {
    throw new Error("Backup or SQLite database file is missing.");
}

const backupData = JSON.parse(fs.readFileSync(backupPath, "utf8"));
const backup = Array.isArray(backupData)
    ? backupData
    : backupData.transactions;

if (!Array.isArray(backup) || backup.length !== 14) {
    throw new Error("Expected exactly 14 backup records. No changes made.");
}


const replacements = {
    "2026-10-26T08:01:46.044Z": "sm-261026-015",
    "2026-10-26T08:02:33.737Z": "sm-261026-016"
};

const records = backup.map(transaction => {
    const newId = replacements[transaction.dateTime];

    if (
        newId &&
        !(
            (transaction.id === "sm-261026-005" &&
             transaction.dateTime === "2026-10-26T08:01:46.044Z") ||
            (transaction.id === "sm-261026-006" &&
             transaction.dateTime === "2026-10-26T08:02:33.737Z")
        )
    ) {
        throw new Error("Unexpected record matched a replacement timestamp.");
    }

    return {
        ...transaction,
        id: newId || transaction.id
    };
});

const ids = records.map(transaction => transaction.id);

if (new Set(ids).size !== records.length) {
    throw new Error("IDs are still duplicated after correction. No changes made.");
}

const db = new Database(databasePath);

try {
    const count = db.prepare(
        "SELECT COUNT(*) AS count FROM transactions"
    ).get().count;

    if (count !== 0) {
        throw new Error(
            `SQLite already contains ${count} records. Import cancelled to prevent conflicts.`
        );
    }

    const insert = db.prepare(`
        INSERT INTO transactions
        (id, fare, passengers, total, paymentmethod, status, dateTime)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const importAll = db.transaction(items => {
        for (const transaction of items) {
            if (
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
                !transaction.paymentmethod.trim()
            ) {
                throw new Error(
                    "Invalid transaction: " + transaction.id
                );
            }

            insert.run(
                transaction.id,
                transaction.fare,
                transaction.passengers,
                transaction.total,
                transaction.paymentmethod,
                transaction.status || "Paid",
                transaction.dateTime || new Date().toISOString()
            );
        }
    });

    importAll(records);

    const finalCount = db.prepare(
        "SELECT COUNT(*) AS count FROM transactions"
    ).get().count;

    console.log("Imported records:", records.length);
    console.log("SQLite records after import:", finalCount);
    console.log("All transaction IDs are unique.");
    console.log("Original JSON backup was not modified.");
} finally {
    db.close();
}