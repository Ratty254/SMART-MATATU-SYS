const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");


const backupPath = path.join(__dirname, "transactions-backup.json");
const databasePath = path.join(__dirname, "smart-matatu.db");

if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
}

if (!fs.existsSync(databasePath)) {
    throw new Error(`SQLite database not found: ${databasePath}`);
}


const backupData = JSON.parse(
    fs.readFileSync(backupPath, "utf8")
);

const backup = Array.isArray(backupData)
    ? backupData
    : backupData.transactions;

if (!Array.isArray(backup)) {
    throw new Error(
        "Backup does not contain a transaction array."
    );
}

for (const [index, transaction] of backup.entries()) {
    if (
        !transaction ||
        typeof transaction.id !== "string" ||
        !transaction.id.trim()
    ) {
        throw new Error(
            `Invalid or missing transaction ID at backup index ${index}.`
        );
    }
}


const db = new Database(databasePath, { readonly: true });

try {
    console.log("\n========== DATABASE CHECK ==========");

    console.log("Database file:", databasePath);

    const tables = db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
    `).all();

    console.log(
        "Database tables:",
        tables.map(table => table.name)
    );

    const hasTransactionsTable = tables.some(
        table => table.name === "transactions"
    );

    if (!hasTransactionsTable) {
        throw new Error(
            "The SQLite transactions table does not exist."
        );
    }

    const saved = db.prepare(`
        SELECT id, fare, passengers, total,
               paymentmethod, status, dateTime
        FROM transactions
    `).all();

    const savedIds = new Set(
        saved.map(transaction => transaction.id)
    );

    const backupIds = backup.map(
        transaction => transaction.id
    );

    
    const missing = backup.filter(
        transaction => !savedIds.has(transaction.id)
    );


    const idCounts = new Map();

    for (const transaction of backup) {
        const id = transaction.id.trim();

        idCounts.set(
            id,
            (idCounts.get(id) || 0) + 1
        );
    }

    const duplicateIds = [...idCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(([id]) => id);

    console.log("\n= COUNTS =");
    console.log("Backup record count:", backup.length);
    console.log("SQLite record count:", saved.length);
    console.log("Backup IDs missing from SQLite:", missing.length);

    console.log("\nMissing transaction IDs:");
    console.table(
        missing.map(transaction => ({
            id: transaction.id,
            fare: transaction.fare,
            passengers: transaction.passengers,
            total: transaction.total,
            paymentmethod: transaction.paymentmethod,
            dateTime: transaction.dateTime
        }))
    );

    console.log("\n========== DUPLICATE IDs ==========");
    console.log("Number of duplicate ID values:", duplicateIds.length);

    if (duplicateIds.length === 0) {
        console.log("No duplicate IDs found in backup.");
    }

    for (const id of duplicateIds) {
        console.log(`\nDuplicate ID: ${id}`);

        console.table(
            backup.filter(
                transaction => transaction.id.trim() === id
            )
        );
    }


    const alreadySaved = backup.filter(
        transaction => savedIds.has(transaction.id.trim())
    );

    console.log("\n========== IMPORT PREVIEW ==========");
    console.log(
        "Backup records whose IDs already exist in SQLite:",
        alreadySaved.length
    );
    console.log(
        "Backup records with IDs not yet in SQLite:",
        missing.length
    );

    console.log(
        "\nDiagnostic complete. No data was changed."
    );

} finally {
    db.close();
}