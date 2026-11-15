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

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log("SERVER DATABASE PATH:", databasePath);

db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        fare REAL NOT NULL CHECK (fare > 0),
        passengers INTEGER NOT NULL CHECK (passengers >= 1),
        total REAL NOT NULL,
        paymentmethod TEXT NOT NULL,
        route TEXT,
        status TEXT NOT NULL,
        dateTime TEXT NOT NULL
    )
`);

const transactionColumns = db.prepare(
    "PRAGMA table_info(transactions)"
).all();

const routeColumnExists = transactionColumns.some(
    column => column.name === "route"
);

if (!routeColumnExists) {
    db.exec(`
        ALTER TABLE transactions
        ADD COLUMN route TEXT
    `);

    console.log("Database migration: route column added.");
} else {
    console.log("Database migration: route column already exists.");
}

console.log(
    "SERVER DATABASE COUNT:",
    db.prepare("SELECT COUNT(*) AS count FROM transactions").get().count
);


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


db.exec(`
    CREATE TABLE IF NOT EXISTS saccos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sacco_code TEXT NOT NULL UNIQUE,
        sacco_name TEXT NOT NULL,
        county TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_code TEXT NOT NULL UNIQUE,
        sacco_id INTEGER NOT NULL,
        route_name TEXT NOT NULL,
        origin TEXT NOT NULL,
        destination TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        verification_status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (sacco_id)
            REFERENCES saccos(id)
    )
`);
db.exec(`
    CREATE TABLE IF NOT EXISTS route_stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_id INTEGER NOT NULL,
        stage_order INTEGER NOT NULL,
        stop_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (route_id)
            REFERENCES routes(id)
            ON DELETE CASCADE,
        UNIQUE (route_id, stage_order)
    )
`);
console.log("SACCO and routes tables initialized.");

const insertSacco = db.prepare(`
    INSERT OR IGNORE INTO saccos
    (sacco_code, sacco_name, county)
    VALUES (?, ?, ?)
`);

insertSacco.run(
    "NYK-001",
    "Nyekicha SACCO",
    "Nyeri"
);

const nyekicha = db.prepare(`
    SELECT id
    FROM saccos
    WHERE sacco_code = ?
`).get("NYK-001");

const insertRoute = db.prepare(`
    INSERT OR IGNORE INTO routes
    (
        route_code,
        sacco_id,
        route_name,
        origin,
        destination,
        status,
        verification_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);

insertRoute.run(
    "NYR-001",
    nyekicha.id,
    "Nyeri Town - Chaka",
    "Nyeri Town",
    "Chaka",
    "active",
    "pending"
);

console.log("Nyekicha SACCO pilot initialized.");

console.log(
    "REGISTERED SACCOS:",
    db.prepare("SELECT COUNT(*) AS count FROM saccos").get().count
);

console.log(
    "REGISTERED ROUTES:",
    db.prepare("SELECT COUNT(*) AS count FROM routes").get().count
);


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
    SELECT id, fare, passengers, total,
           paymentmethod, status, dateTime
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

app.get(
    "/api/saccos",
    authenticateToken,
    authorizeRoles("admin", "sacco_manager"),
    (req, res) => {
        try {
            const saccos = db.prepare(`
                SELECT
                    id,
                    sacco_code,
                    sacco_name,
                    county,
                    status,
                    created_at
                FROM saccos
                ORDER BY sacco_name ASC
            `).all();

            return res.json({
                status: "success",
                count: saccos.length,
                saccos
            });

        } catch (error) {
            console.error("SACCO retrieval failed:", error.message);

            return res.status(500).json({
                status: "error",
                message: "Could not retrieve SACCO records"
            });
        }
    }
);

app.post(
    "/api/saccos",
    authenticateToken,
    authorizeRoles("admin"),
    (req, res) => {
        const { sacco_code, sacco_name, county } = req.body || {};

        if (
            typeof sacco_code !== "string" ||
            typeof sacco_name !== "string" ||
            typeof county !== "string" ||
            !/^[A-Z0-9-]{3,20}$/.test(sacco_code.trim()) ||
            !sacco_name.trim() ||
            sacco_name.trim().length > 100 ||
            !county.trim() ||
            county.trim().length > 100
        ) {
            return res.status(400).json({
                status: "error",
                message: "Invalid SACCO registration details"
            });
        }

        try {
            const result = db.prepare(`
                INSERT INTO saccos
                (sacco_code, sacco_name, county)
                VALUES (?, ?, ?)
            `).run(
                sacco_code.trim(),
                sacco_name.trim(),
                county.trim()
            );

            return res.status(201).json({
                status: "success",
                message: "SACCO registered successfully",
                sacco: {
                    id: result.lastInsertRowid,
                    sacco_code: sacco_code.trim(),
                    sacco_name: sacco_name.trim(),
                    county: county.trim(),
                    status: "active"
                }
            });

        } catch (error) {
            if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
                return res.status(409).json({
                    status: "error",
                    message: "SACCO code already exists"
                });
            }

            console.error("SACCO registration failed:", error.message);

            return res.status(500).json({
                status: "error",
                message: "Could not register SACCO"
            });
        }
    }
);

app.get(
    "/api/routes",
    authenticateToken,
    authorizeRoles("admin", "sacco_manager"),
    (req, res) => {
        try {
            const routes = db.prepare(`
                SELECT
                    routes.id,
                    routes.route_code,
                    routes.sacco_id,
                    routes.route_name,
                    routes.origin,
                    routes.destination,
                    routes.status,
                    routes.verification_status,
                    routes.created_at,
                    saccos.sacco_name,
                    saccos.sacco_code
                FROM routes
                INNER JOIN saccos
                    ON routes.sacco_id = saccos.id
                ORDER BY routes.route_name ASC
            `).all();

            return res.json({
                status: "success",
                count: routes.length,
                routes
            });

        } catch (error) {
            console.error("Route retrieval failed:", error.message);

            return res.status(500).json({
                status: "error",
                message: "Could not retrieve route records"
            });
        }
    }
);

app.post(
    "/api/routes",
    authenticateToken,
    authorizeRoles("admin"),
    (req, res) => {
        const {
            route_code,
            sacco_id,
            route_name,
            origin,
            destination
        } = req.body || {};

        if (
            typeof route_code !== "string" ||
            !/^[A-Z0-9-]{3,20}$/.test(route_code.trim()) ||
            !Number.isSafeInteger(sacco_id) ||
            sacco_id < 1 ||
            typeof route_name !== "string" ||
            !route_name.trim() ||
            route_name.trim().length > 150 ||
            typeof origin !== "string" ||
            !origin.trim() ||
            origin.trim().length > 100 ||
            typeof destination !== "string" ||
            !destination.trim() ||
            destination.trim().length > 100
        ) {
            return res.status(400).json({
                status: "error",
                message: "Invalid route registration details"
            });
        }

        const saccoExists = db.prepare(`
            SELECT id
            FROM saccos
            WHERE id = ?
        `).get(sacco_id);

        if (!saccoExists) {
            return res.status(404).json({
                status: "error",
                message: "Selected SACCO does not exist"
            });
        }

        try {
            const result = db.prepare(`
                INSERT INTO routes
                (
                    route_code,
                    sacco_id,
                    route_name,
                    origin,
                    destination
                )
                VALUES (?, ?, ?, ?, ?)
            `).run(
                route_code.trim(),
                sacco_id,
                route_name.trim(),
                origin.trim(),
                destination.trim()
            );

            return res.status(201).json({
                status: "success",
                message: "Route registered successfully",
                route: {
                    id: result.lastInsertRowid,
                    route_code: route_code.trim(),
                    sacco_id,
                    route_name: route_name.trim(),
                    origin: origin.trim(),
                    destination: destination.trim(),
                    status: "active",
                    verification_status: "pending"
                }
            });

        } catch (error) {
            if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
                return res.status(409).json({
                    status: "error",
                    message: "Route code already exists"
                });
            }

            console.error("Route registration failed:", error.message);

            return res.status(500).json({
                status: "error",
                message: "Could not register route"
            });
        }
    }
);
app.get(
    "/api/routes/:id/stages",
    authenticateToken,
    authorizeRoles("admin", "sacco_manager", "conductor"),
    (req, res) => {
        const routeId = Number(req.params.id);

        if (!Number.isInteger(routeId) || routeId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid route ID."
            });
        }

        const route = db.prepare(
            "SELECT * FROM routes WHERE id = ?"
        ).get(routeId);

        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found."
            });
        }

        const stages = db.prepare(`
            SELECT id, route_id, stage_order, stop_name, created_at
            FROM route_stages
            WHERE route_id = ?
            ORDER BY stage_order ASC
        `).all(routeId);

        return res.json({
            success: true,
            route: route,
            total_stages: stages.length,
            stages: stages
        });
    }
);

app.post(
    "/api/routes/:id/stages",
    authenticateToken,
    authorizeRoles("admin"),
    (req, res) => {
        const routeId = Number(req.params.id);
        const stageOrder = Number(req.body.stage_order);
        const stopName = req.body.stop_name;

        if (!Number.isInteger(routeId) || routeId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid route ID."
            });
        }

        if (!Number.isInteger(stageOrder) || stageOrder <= 0) {
            return res.status(400).json({
                success: false,
                message: "Stage order must be a positive integer."
            });
        }

        if (typeof stopName !== "string" || !stopName.trim()) {
            return res.status(400).json({
                success: false,
                message: "Stop name is required."
            });
        }

        const route = db.prepare(
            "SELECT id, route_code, route_name FROM routes WHERE id = ?"
        ).get(routeId);

        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found."
            });
        }

        try {
            const result = db.prepare(`
                INSERT INTO route_stages
                (route_id, stage_order, stop_name)
                VALUES (?, ?, ?)
            `).run(routeId, stageOrder, stopName.trim());

            const newStage = db.prepare(`
                SELECT * FROM route_stages WHERE id = ?
            `).get(result.lastInsertRowid);

            return res.status(201).json({
                success: true,
                message: "Route stop registered successfully.",
                stage: newStage
            });

        } catch (error) {
            if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
                return res.status(409).json({
                    success: false,
                    message: "This stage order already exists for this route."
                });
            }

            console.error("Route stage registration error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to register route stop."
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

app.post(
    "/api/transactions",
    authenticateToken,
    authorizeRoles("conductor", "admin"),
    (req, res) => {

        const {
            id,
            fare,
            passengers,
            total,
            paymentmethod,
            status,
            dateTime
        } = req.body || {};

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
            if (
                error.code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
                error.code === "SQLITE_CONSTRAINT_UNIQUE"
            ) {
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
    }
);

app.get(
    "/api/transactions",
    authenticateToken,
    authorizeRoles("conductor", "sacco_manager", "admin"),
    (req, res) => {

        try {
            const transactions = getAllTransactions.all();

            return res.json({
                status: "success",
                count: transactions.length,
                transactions
            });

        } catch (error) {
            console.error("Database read failed:", error.message);

            return res.status(500).json({
                status: "error",
                message: "Could not retrieve transactions"
            });
        }
    }
);

const server = app.listen(PORT, () => {
    console.log("-----------------------------------");
    console.log("SMART MATATU BACKEND STARTED");
    console.log("-----------------------------------");
    console.log(`Backend: http://localhost:${PORT}`);
    console.log(`SQLite: ${databasePath}`);
    console.log("Authentication: Enabled");
    console.log("SACCO Management: Initialized");
    console.log("Route Management: Initialized");
    console.log("-----------------------------------");
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