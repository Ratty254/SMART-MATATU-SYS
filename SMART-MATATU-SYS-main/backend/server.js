require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
}

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

const findUserByUsername = db.prepare(`
    SELECT id, username, password_hash, role
    FROM users
    WHERE username = ?
`);
const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, role)
    VALUES (?, ?, ?)
`);

function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];

    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            status: "error",
            message: "Authentication required. Please log in."
        });
    }

    jwt.verify(token, JWT_SECRET, (error, user) => {
        if (error) {
            return res.status(403).json({
                status: "error",
                message: "Invalid or expired authentication token."
            });
        }

        req.user = user;
        next();
    });
}
function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                status: "error",
                message: "Access denied. You do not have permission."
            });
        }

        next();
    };
}


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

app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;

    if (
        typeof username !== "string" ||
        typeof password !== "string" ||
        !username.trim() ||
        !password
    ) {
        return res.status(400).json({
            status: "error",
            message: "Username and password are required"
        });
    }

    const user = findUserByUsername.get(username.trim());

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({
            status: "error",
            message: "Invalid username or password"
        });
    }

    const token = jwt.sign(
        {
            id: user.id,
            username: user.username,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: "1h" }
    );

    return res.json({
        status: "success",
        message: "Login successful",
        token,
        user: {
            id: user.id,
            username: user.username,
            role: user.role
        }
    });
});

app.post(
    "/api/users",
    authenticateToken,
    authorizeRoles("admin"),
    async (req, res) => {
        const { username, password, role } = req.body;

        if (
            typeof username !== "string" ||
            typeof password !== "string" ||
            !/^[a-zA-Z0-9_.-]{3,30}$/.test(username) ||
            password.length < 12 ||
            !["conductor", "sacco_manager"].includes(role)
        ) {
            return res.status(400).json({
                status: "error",
                message: "Invalid username, password, or role. Password must have at least 12 characters."
            });
        }

        try {
            const passwordHash = await bcrypt.hash(password, 12);

            const result = insertUser.run(
                username,
                passwordHash,
                role
            );

            return res.status(201).json({
                status: "success",
                message: "User account created successfully",
                user: {
                    id: result.lastInsertRowid,
                    username,
                    role
                }
            });
        } catch (error) {
            if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
                return res.status(409).json({
                    status: "error",
                    message: "Username already exists"
                });
            }

            console.error("User creation failed:", error.message);

            return res.status(500).json({
                status: "error",
                message: "Could not create user"
            });
        }
    }
);
app.get("/api/health", (req, res) => {
    res.json({
        status: "success",
        message: "Smart Matatu API is healthy",
        database: "SQLite",
        timestamp: new Date().toISOString()
    });
});


app.post("/api/transactions",authenticateToken,authorizeRoles("conductor","admin"), (req, res) => {
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


app.get("/api/transactions",authenticateToken,authorizeRoles("conductor","sacco_manager","admin"), (req, res) => {
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