const express = require("express");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());


app.use(express.static(path.join(__dirname, "..")));


const databasePath = path.join(__dirname, "smart-matatu.db");
const db = new Database(databasePath);
console.log("SERVER DATABASE PATH:", databasePath);
console.log("SERVER DATABASE COUNT:",db.prepare ("SELECT COUNT(*) AS count FROM transactions").get().count);

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

const findTransaction = db.prepare(
    "SELECT id FROM transactions WHERE id = ?"
);

const insertTransaction = db.prepare(`
    INSERT INTO transactions
    (id, fare, passengers, total, paymentmethod, status, dateTime)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const getAllTransactions = db.prepare(`
    SELECT id, fare, passengers, total, paymentmethod, status, dateTime
    FROM transactions
    ORDER BY rowid ASC
`);

const getTransactionCount = db.prepare(
    "SELECT COUNT(*) AS count FROM transactions"
);


app.get("/api/health", (req, res) => {
    res.json({
        status: "success",
        message: "Smart Matatu API is healthy",
        database: "SQLite",
        timestamp: new Date().toISOString()
    });
});


app.post("/api/transactions", (req, res) => {
    const {
        id,
        fare,
        passengers,
        total,
        paymentmethod,
        status,
        dateTime
    } = req.body;

    if (
        typeof id !== "string" ||
        !id.trim() ||
        !Number.isFinite(fare) ||
        fare <= 0 ||
        !Number.isInteger(passengers) ||
        passengers < 1 ||
        !Number.isFinite(total) ||
        Math.abs(total - fare * passengers) > 0.001 ||
        typeof paymentmethod !== "string" ||
        !paymentmethod.trim()
    ) {
        return res.status(400).json({
            status: "error",
            message: "Invalid transaction details"
        });
    }

    const transactionId = id.trim();

    if (findTransaction.get(transactionId)) {
        return res.status(409).json({
            status: "error",
            message: "Transaction ID already exists"
        });
    }

    const transaction = {
        id: transactionId,
        fare,
        passengers,
        total,
        paymentmethod: paymentmethod.trim(),
        status: typeof status === "string" && status.trim()
            ? status.trim()
            : "Paid",
        dateTime: typeof dateTime === "string" && dateTime.trim()
            ? dateTime
            : new Date().toISOString()
    };

    try {
        insertTransaction.run(
            transaction.id,
            transaction.fare,
            transaction.passengers,
            transaction.total,
            transaction.paymentmethod,
            transaction.status,
            transaction.dateTime
        );

        return res.status(201).json({
            status: "success",
            message: "Transaction saved to SQLite",
            count: getTransactionCount.get().count,
            transaction
        });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
            error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                status: "error",
                message: "Transaction ID already exists"
            });
        }

        console.error("Database insert failed:", error.message);

        return res.status(500).json({
            status: "error",
            message: "Could not save transaction"
        });
    }
});


app.get("/api/transactions", (req, res) => {
    try {
        const transactions = getAllTransactions.all();

        res.json({
            status: "success",
            count: transactions.length,
            transactions
        });
    } catch (error) {
        console.error("Database read failed:", error.message);

        res.status(500).json({
            status: "error",
            message: "Could not retrieve transactions"
        });
    }
});

const server = app.listen(PORT, () => {
    console.log(`Smart Matatu backend running at http://localhost:${PORT}`);
    console.log(`SQLite database: ${databasePath}`);
});


function shutdown() {
    server.close(() => {
        db.close();
        console.log("Server and SQLite database closed.");
        process.exit(0);
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);