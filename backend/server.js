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

function getTableColumns(tableName) {

    return db.prepare(`PRAGMA table_info(${tableName})`).all();

}

function addColumnIfMissing(tableName, columnName, columnDefinition) {

    const columns = getTableColumns(tableName);

    const exists = columns.some(

        column => column.name === columnName

    );

    if (!exists) {

        db.exec(`

            ALTER TABLE ${tableName}

            ADD COLUMN ${columnName} ${columnDefinition}

        `);

        console.log(

            `Database migration: ${tableName}.${columnName} added.`

        );

    } else {

        console.log(

            `Database migration: ${tableName}.${columnName} already exists.`

        );

    }

}

function isValidEmail(email) {

    return (

        typeof email === "string" &&

        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

    );

}

function publicUser(user) {

    if (!user) {

        return null;

    }

    return {

        id: user.id,

        username: user.username,

        email: user.email || "",

        role: user.role,

        status: user.status || "active",

        sacco_id: user.sacco_id ?? null,

        created_at: user.created_at

    };

}

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

addColumnIfMissing("transactions", "route", "TEXT");

addColumnIfMissing("transactions", "route_id", "INTEGER");

addColumnIfMissing("transactions", "boarding_stage_id", "INTEGER");

addColumnIfMissing("transactions", "alighting_stage_id", "INTEGER");
addColumnIfMissing("transactions", "created_by_user_id", "INTEGER");

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

        email TEXT,

        status TEXT NOT NULL DEFAULT 'active',

        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

    )

`);

addColumnIfMissing("users", "email", "TEXT");

addColumnIfMissing(

    "users",

    "status",

    "TEXT NOT NULL DEFAULT 'active'"

);

addColumnIfMissing("users", "sacco_id", "INTEGER");

const findUserByUsername = db.prepare(`

    SELECT

        id,

        username,

        password_hash,

        email,

        role,

        status,

        sacco_id,

        created_at

    FROM users

    WHERE username = ?

`);

const findUserById = db.prepare(`

    SELECT

        id,

        username,

        password_hash,

        email,

        role,

        status,

        sacco_id,

        created_at

    FROM users

    WHERE id = ?

`);

const findUserByEmail = db.prepare(`

    SELECT id

    FROM users

    WHERE LOWER(email) = LOWER(?)

`);

const insertUser = db.prepare(`

    INSERT INTO users (

        username,

        password_hash,

        role,

        email,

        status

    )

    VALUES (?, ?, ?, ?, ?)

`);

const getAllUsers = db.prepare(`

    SELECT

        id,

        username,

        email,

        role,

        status,

        sacco_id,

        created_at

    FROM users

    ORDER BY created_at DESC, id DESC

`);

const updateUserStatus = db.prepare(`

    UPDATE users

    SET status = ?

    WHERE id = ?

`);

const countActiveAdmins = db.prepare(`

    SELECT COUNT(*) AS count

    FROM users

    WHERE role = 'admin'

    AND status = 'active'

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


addColumnIfMissing("transactions", "created_by_user_id", "INTEGER");

db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        recipient_role TEXT NOT NULL,
        transaction_id TEXT,
        actor_user_id INTEGER,
        sacco_id INTEGER,
        route_id INTEGER,
        notification_type TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'medium'
            CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        expected_amount REAL,
        recorded_amount REAL,
        verified_amount REAL,
        difference_amount REAL,
        verification_source TEXT,
        status TEXT NOT NULL DEFAULT 'unread'
            CHECK (status IN ('unread', 'read', 'acknowledged', 'investigating', 'resolved')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        read_at TEXT,
        acknowledged_at TEXT,
        resolved_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
        FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (sacco_id) REFERENCES saccos(id) ON DELETE SET NULL,
        FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL,
        UNIQUE (event_key, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user_status
        ON notifications(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_created
        ON notifications(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_transaction
        ON notifications(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_severity_status
        ON notifications(severity, status);
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

    jwt.verify(token, JWT_SECRET, (error, decodedUser) => {

        if (error) {

            return res.status(403).json({

                status: "error",

                message: "Invalid or expired authentication token."

            });

        }

        const currentUser = findUserById.get(decodedUser.id);

        if (!currentUser) {

            return res.status(401).json({

                status: "error",

                message: "User account no longer exists."

            });

        }

        if (currentUser.status !== "active") {

            return res.status(403).json({

                status: "error",

                message: "Your account is not active. Contact an administrator."

            });

        }

        req.user = {

            id: currentUser.id,

            username: currentUser.username,

            email: currentUser.email,

            role: currentUser.role,

            status: currentUser.status,
            sacco_id: currentUser.sacco_id ?? null

        };

        next();

    });

}


function createDiscrepancyNotifications({
    eventKey,
    transactionId = null,
    actorUserId,
    routeId = null,
    notificationType,
    severity,
    title,
    message,
    expectedAmount = null,
    recordedAmount = null,
    verifiedAmount = null,
    differenceAmount = null,
    verificationSource = null
}) {
    const route = Number.isInteger(routeId)
        ? db.prepare(`
            SELECT id, sacco_id, route_name
            FROM routes
            WHERE id = ?
        `).get(routeId)
        : null;

    const recipients = db.prepare(`
        SELECT id, role
        FROM users
        WHERE status = 'active'
          AND (
            role = 'admin'
            OR id = ?
            OR (role = 'sacco_manager' AND sacco_id = ?)
          )
    `).all(actorUserId || -1, route ? route.sacco_id : -1);

    const insertNotification = db.prepare(`
        INSERT OR IGNORE INTO notifications (
            event_key, user_id, recipient_role, transaction_id,
            actor_user_id, sacco_id, route_id, notification_type,
            severity, title, message, expected_amount,
            recorded_amount, verified_amount, difference_amount,
            verification_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction(() => {
        for (const recipient of recipients) {
            insertNotification.run(
                eventKey,
                recipient.id,
                recipient.role,
                transactionId,
                actorUserId || null,
                route ? route.sacco_id : null,
                route ? route.id : null,
                notificationType,
                severity,
                title,
                message,
                expectedAmount,
                recordedAmount,
                verifiedAmount,
                differenceAmount,
                verificationSource
            );
        }
    });

    insertMany();
    return recipients.length;
}

function authorizeRoles(...allowedRoles) {

    return (req, res, next) => {

        if (

            !req.user ||

            !allowedRoles.includes(req.user.role)

        ) {

            return res.status(403).json({

                status: "error",

                message: "Access denied. You do not have permission."

            });

        }

        next();

    };

}

app.get("/api/health", (req, res) => {

    return res.json({

        status: "success",

        message: "Smart Matatu backend is running.",

        database: "SQLite",

        timestamp: new Date().toISOString()

    });

});

app.post("/api/auth/login", (req, res) => {

    const { username, password } = req.body || {};

    if (

        typeof username !== "string" ||

        typeof password !== "string" ||

        !username.trim() ||

        !password

    ) {

        return res.status(400).json({

            status: "error",

            message: "Username and password are required."

        });

    }

    const user = findUserByUsername.get(username.trim());

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {

        return res.status(401).json({

            status: "error",

            message: "Invalid username or password."

        });

    }

    if (user.status !== "active") {

        return res.status(403).json({

            status: "error",

            message:

                user.status === "pending"

                    ? "Your account is awaiting administrator approval."

                    : "Your account has been suspended."

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

        message: "Login successful.",

        token,

        user: publicUser(user)

    });

});

app.post("/api/auth/register", async (req, res) => {

    const {

        username,

        email,

        password,

        role

    } = req.body || {};

    if (

        typeof username !== "string" ||

        !/^[a-zA-Z0-9\_.-]{3,30}$/.test(username.trim())

    ) {

        return res.status(400).json({

            status: "error",

            message:

                "Username must contain 3 to 30 valid characters."

        });

    }

    if (!isValidEmail(email)) {

        return res.status(400).json({

            status: "error",

            message: "Please provide a valid email address."

        });

    }

    if (

        typeof password !== "string" ||

        password.length < 8

    ) {

        return res.status(400).json({

            status: "error",

            message: "Password must contain at least 8 characters."

        });

    }

    if (!["conductor", "sacco_manager"].includes(role)) {

        return res.status(400).json({

            status: "error",

            message: "Invalid registration role."

        });

    }

    const cleanUsername = username.trim();

    const cleanEmail = email.trim().toLowerCase();

    const existingUsername = findUserByUsername.get(cleanUsername);

    if (existingUsername) {

        return res.status(409).json({

            status: "error",

            message: "Username already exists."

        });

    }

    const existingEmail = findUserByEmail.get(cleanEmail);

    if (existingEmail) {

        return res.status(409).json({

            status: "error",

            message: "Email address is already registered."

        });

    }

    try {

        const passwordHash = await bcrypt.hash(password, 12);

        const result = insertUser.run(

            cleanUsername,

            passwordHash,

            role,

            cleanEmail,

            "pending"

        );

        const registeredUser = findUserById.get(

            Number(result.lastInsertRowid)

        );

        return res.status(201).json({

            status: "success",

            message:

                "Registration successful. Your account is awaiting administrator approval.",

            user: publicUser(registeredUser)

        });

    } catch (error) {

        console.error("Registration failed:", error);

        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {

            return res.status(409).json({

                status: "error",

                message: "Username already exists."

            });

        }

        return res.status(500).json({

            status: "error",

            message: "Could not complete registration."

        });

    }

});

app.post(

    "/api/users",

    authenticateToken,

    authorizeRoles("admin"),

    async (req, res) => {

        const {

            username,

            password,

            role,

            email

        } = req.body || {};

        if (

            typeof username !== "string" ||

            typeof password !== "string" ||

            !/^[a-zA-Z0-9\_.-]{3,30}$/.test(username.trim()) ||

            password.length < 12 ||

            !["conductor", "sacco_manager"].includes(role)

        ) {

            return res.status(400).json({

                status: "error",

                message:

                    "Invalid username, password, or role. Password must have at least 12 characters."

            });

        }

        const cleanEmail =

            typeof email === "string" && email.trim()

                ? email.trim().toLowerCase()

                : null;

        if (cleanEmail && !isValidEmail(cleanEmail)) {

            return res.status(400).json({

                status: "error",

                message: "Invalid email address."

            });

        }

        if (cleanEmail && findUserByEmail.get(cleanEmail)) {

            return res.status(409).json({

                status: "error",

                message: "Email address is already registered."

            });

        }

        try {

            const passwordHash = await bcrypt.hash(password, 12);

            const result = insertUser.run(

                username.trim(),

                passwordHash,

                role,

                cleanEmail,

                "active"

            );

            const createdUser = findUserById.get(

                Number(result.lastInsertRowid)

            );

            return res.status(201).json({

                status: "success",

                message: "User account created successfully.",

                user: publicUser(createdUser)

            });

        } catch (error) {

            console.error("User creation failed:", error);

            if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {

                return res.status(409).json({

                    status: "error",

                    message: "Username already exists."

                });

            }

            return res.status(500).json({

                status: "error",

                message: "Could not create user."

            });

        }

    }

);

app.get(

    "/api/users",

    authenticateToken,

    authorizeRoles("admin"),

    (req, res) => {

        try {

            const users = getAllUsers.all().map(publicUser);

            return res.json({

                status: "success",

                count: users.length,

                users

            });

        } catch (error) {

            console.error("User retrieval failed:", error);

            return res.status(500).json({

                status: "error",

                message: "Could not retrieve user accounts."

            });

        }

    }

);

app.patch(

    "/api/users/:id/status",

    authenticateToken,

    authorizeRoles("admin"),

    (req, res) => {

        const userId = Number(req.params.id);

        const { status } = req.body || {};

        if (

            !Number.isInteger(userId) ||

            userId <= 0

        ) {

            return res.status(400).json({

                status: "error",

                message: "Invalid user ID."

            });

        }

        if (!["active", "pending", "suspended"].includes(status)) {

            return res.status(400).json({

                status: "error",

                message:

                    "Status must be active, pending, or suspended."

            });

        }

        const targetUser = findUserById.get(userId);

        if (!targetUser) {

            return res.status(404).json({

                status: "error",

                message: "User account not found."

            });

        }

        if (userId === req.user.id && status !== "active") {

            return res.status(400).json({

                status: "error",

                message: "You cannot suspend or deactivate your own account."

            });

        }

        if (

            targetUser.role === "admin" &&

            targetUser.status === "active" &&

            status !== "active"

        ) {

            const activeAdmins = countActiveAdmins.get().count;

            if (activeAdmins <= 1) {

                return res.status(400).json({

                    status: "error",

                    message:

                        "The last active administrator cannot be suspended or deactivated."

                });

            }

        }

        try {

            updateUserStatus.run(status, userId);

            const updatedUser = findUserById.get(userId);

            return res.json({

                status: "success",

                message: `User account ${status} successfully.`,

                user: publicUser(updatedUser)

            });

        } catch (error) {

            console.error("User status update failed:", error);

            return res.status(500).json({

                status: "error",

                message: "Could not update user status."

            });

        }

    }

);


app.patch(
    "/api/users/:id/assignment",
    authenticateToken,
    authorizeRoles("admin"),
    (req, res) => {
        const userId = Number(req.params.id);
        const { sacco_id } = req.body || {};

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Invalid user ID."
            });
        }

        if (sacco_id !== null && (!Number.isInteger(sacco_id) || sacco_id <= 0)) {
            return res.status(400).json({
                status: "error",
                message: "sacco_id must be a valid SACCO ID or null."
            });
        }

        const targetUser = findUserById.get(userId);
        if (!targetUser) {
            return res.status(404).json({
                status: "error",
                message: "User account not found."
            });
        }

        if (targetUser.role === "admin") {
            return res.status(400).json({
                status: "error",
                message: "SACCO assignment is only available for conductors and SACCO managers."
            });
        }

        if (sacco_id !== null) {
            const sacco = db.prepare("SELECT id FROM saccos WHERE id = ?").get(sacco_id);
            if (!sacco) {
                return res.status(404).json({
                    status: "error",
                    message: "Selected SACCO does not exist."
                });
            }
        }

        db.prepare("UPDATE users SET sacco_id = ? WHERE id = ?").run(sacco_id, userId);
        return res.json({
            status: "success",
            message: "User SACCO assignment updated.",
            user: publicUser(findUserById.get(userId))
        });
    }
);

app.delete(

    "/api/users/:id",

    authenticateToken,

    authorizeRoles("admin"),

    (req, res) => {

        const userId = Number(req.params.id);

        if (

            !Number.isInteger(userId) ||

            userId <= 0

        ) {

            return res.status(400).json({

                status: "error",

                message: "Invalid user ID."

            });

        }

        if (userId === req.user.id) {

            return res.status(400).json({

                status: "error",

                message: "You cannot delete your own account."

            });

        }

        const targetUser = findUserById.get(userId);

        if (!targetUser) {

            return res.status(404).json({

                status: "error",

                message: "User account not found."

            });

        }

        if (targetUser.role === "admin") {

            return res.status(403).json({

                status: "error",

                message:

                    "Administrator accounts cannot be deleted through this endpoint."

            });

        }

        try {

            db.prepare(`

                DELETE FROM users

                WHERE id = ?

            `).run(userId);

            return res.json({

                status: "success",

                message: "User account deleted successfully.",

                deletedUserId: userId

            });

        } catch (error) {

            console.error("User deletion failed:", error);

            return res.status(500).json({

                status: "error",

                message: "Could not delete user account."

            });

        }

    }

);

app.get(

    "/api/users/me",

    authenticateToken,

    (req, res) => {

        try {

            const user = findUserById.get(req.user.id);

            if (!user) {

                return res.status(404).json({

                    status: "error",

                    message: "User profile not found."

                });

            }

            return res.json({

                status: "success",

                user: publicUser(user)

            });

        } catch (error) {

            console.error("Profile retrieval failed:", error);

            return res.status(500).json({

                status: "error",

                message: "Could not retrieve your profile."

            });

        }

    }

);

app.patch(

    "/api/users/me",

    authenticateToken,

    (req, res) => {

        const {

            username,

            email

        } = req.body || {};

        if (

            typeof username !== "string" ||

            !/^[a-zA-Z0-9\_.-]{3,30}$/.test(username.trim())

        ) {

            return res.status(400).json({

                status: "error",

                message:

                    "Username must contain 3 to 30 valid characters."

            });

        }

        if (!isValidEmail(email)) {

            return res.status(400).json({

                status: "error",

                message: "Please provide a valid email address."

            });

        }

        const cleanUsername = username.trim();

        const cleanEmail = email.trim().toLowerCase();

        const existingUsername = findUserByUsername.get(cleanUsername);

        if (

            existingUsername &&

            existingUsername.id !== req.user.id

        ) {

            return res.status(409).json({

                status: "error",

                message: "That username is already in use."

            });

        }

        const existingEmail = findUserByEmail.get(cleanEmail);

        if (

            existingEmail &&

            existingEmail.id !== req.user.id

        ) {

            return res.status(409).json({

                status: "error",

                message: "That email address is already in use."

            });

        }

        try {

            db.prepare(`

                UPDATE users

                SET username = ?,

                    email = ?

                WHERE id = ?

            `).run(

                cleanUsername,

                cleanEmail,

                req.user.id

            );

            const updatedUser = findUserById.get(req.user.id);

            return res.json({

                status: "success",

                message: "Profile updated successfully.",

                user: publicUser(updatedUser)

            });

        } catch (error) {

            console.error("Profile update failed:", error);

            return res.status(500).json({

                status: "error",

                message: "Could not update your profile."

            });

        }

    }

);
app.post(

    "/api/users/me/change-password",

    authenticateToken,

    async (req, res) => {

        const {

            currentPassword,

            newPassword

        } = req.body || {};

        if (

            typeof currentPassword !== "string" ||

            typeof newPassword !== "string" ||

            !currentPassword ||

            !newPassword

        ) {

            return res.status(400).json({

                status: "error",

                message: "Current and new passwords are required."

            });

        }

        if (newPassword.length < 8) {

            return res.status(400).json({

                status: "error",

                message:

                    "New password must contain at least 8 characters."

            });

        }

        if (currentPassword === newPassword) {

            return res.status(400).json({

                status: "error",

                message:

                    "New password must be different from your current password."

            });

        }

        try {

            const user = findUserById.get(req.user.id);

            if (!user) {

                return res.status(404).json({

                    status: "error",

                    message: "User account not found."

                });

            }

            const passwordMatches = await bcrypt.compare(

                currentPassword,

                user.password_hash

            );

            if (!passwordMatches) {

                return res.status(401).json({

                    status: "error",

                    message: "Current password is incorrect."

                });

            }

            const newPasswordHash = await bcrypt.hash(

                newPassword,

                12

            );

            db.prepare(`

                UPDATE users

                SET password_hash = ?

                WHERE id = ?

            `).run(

                newPasswordHash,

                req.user.id

            );

            return res.json({

                status: "success",

                message: "Password changed successfully."

            });

        } catch (error) {

            console.error("Password change failed:", error);

            return res.status(500).json({

                status: "error",

                message: "Could not change password."

            });

        }

    }

);

app.patch(

    "/api/routes/:id/verification",

    authenticateToken,

    authorizeRoles("admin"),

    (req, res) => {

        const routeId = Number(req.params.id);

        const { verification_status } = req.body || {};

        if (!Number.isInteger(routeId) || routeId <= 0) {

            return res.status(400).json({

                status: "error",

                message: "Invalid route ID."

            });

        }

        if (!["approved", "rejected"].includes(verification_status)) {

            return res.status(400).json({

                status: "error",

                message:

                    "Verification status must be approved or rejected."

            });

        }

        const route = db.prepare(`

            SELECT id, route_code, route_name, verification_status

            FROM routes

            WHERE id = ?

        `).get(routeId);

        if (!route) {

            return res.status(404).json({

                status: "error",

                message: "Route not found."

            });

        }

        db.prepare(`

            UPDATE routes

            SET verification_status = ?

            WHERE id = ?

        `).run(verification_status, routeId);

        const updatedRoute = db.prepare(`

            SELECT

                id,

                route_code,

                route_name,

                status,

                verification_status

            FROM routes

            WHERE id = ?

        `).get(routeId);

        return res.json({

            status: "success",

            message: `Route ${verification_status} successfully.`,

            route: updatedRoute

        });

    }

);


app.get("/api/notifications/unread-count", authenticateToken, (req, res) => {
    try {
        const result = db.prepare(`
            SELECT COUNT(*) AS count
            FROM notifications
            WHERE user_id = ? AND status = 'unread'
        `).get(req.user.id);
        return res.json({ status: "success", unread_count: result.count });
    } catch (error) {
        console.error("Unread notification count failed:", error);
        return res.status(500).json({
            status: "error",
            message: "Could not retrieve unread notification count."
        });
    }
});

app.get("/api/notifications", authenticateToken, (req, res) => {
    try {
        const allowedStatuses = ["unread", "read", "acknowledged", "investigating", "resolved"];
        const allowedSeverities = ["low", "medium", "high", "critical"];
        const status = req.query.status;
        const severity = req.query.severity;
        const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);

        if (status && !allowedStatuses.includes(status)) {
            return res.status(400).json({ status: "error", message: "Invalid notification status filter." });
        }
        if (severity && !allowedSeverities.includes(severity)) {
            return res.status(400).json({ status: "error", message: "Invalid severity filter." });
        }

        let sql = `
            SELECT n.*,
                   t.fare AS transaction_fare,
                   t.passengers AS transaction_passengers,
                   t.paymentmethod AS payment_method,
                   t.dateTime AS transaction_date,
                   r.route_name,
                   actor.username AS actor_username
            FROM notifications n
            LEFT JOIN transactions t ON t.id = n.transaction_id
            LEFT JOIN routes r ON r.id = n.route_id
            LEFT JOIN users actor ON actor.id = n.actor_user_id
            WHERE n.user_id = ?
        `;
        const params = [req.user.id];

        if (status) {
            sql += " AND n.status = ?";
            params.push(status);
        }
        if (severity) {
            sql += " AND n.severity = ?";
            params.push(severity);
        }
        sql += " ORDER BY n.created_at DESC, n.id DESC LIMIT ?";
        params.push(limit);

        const notifications = db.prepare(sql).all(...params);
        return res.json({
            status: "success",
            count: notifications.length,
            notifications
        });
    } catch (error) {
        console.error("Notification retrieval failed:", error);
        return res.status(500).json({
            status: "error",
            message: "Could not retrieve notifications."
        });
    }
});

app.patch("/api/notifications/:id/read", authenticateToken, (req, res) => {
    const notificationId = Number(req.params.id);
    if (!Number.isInteger(notificationId) || notificationId <= 0) {
        return res.status(400).json({ status: "error", message: "Invalid notification ID." });
    }

    const result = db.prepare(`
        UPDATE notifications
        SET status = CASE WHEN status = 'unread' THEN 'read' ELSE status END,
            read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
        WHERE id = ? AND user_id = ?
    `).run(notificationId, req.user.id);

    if (!result.changes) {
        return res.status(404).json({ status: "error", message: "Notification not found." });
    }
    return res.json({ status: "success", message: "Notification marked as read." });
});

app.patch("/api/notifications/:id/status", authenticateToken, (req, res) => {
    const notificationId = Number(req.params.id);
    const { status } = req.body || {};
    const allowedStatuses = ["read", "acknowledged", "investigating", "resolved"];

    if (!Number.isInteger(notificationId) || notificationId <= 0) {
        return res.status(400).json({ status: "error", message: "Invalid notification ID." });
    }
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
            status: "error",
            message: "Status must be read, acknowledged, investigating, or resolved."
        });
    }

    const result = db.prepare(`
        UPDATE notifications
        SET status = ?,
            read_at = CASE WHEN ? IN ('read', 'acknowledged', 'investigating', 'resolved')
                           THEN COALESCE(read_at, CURRENT_TIMESTAMP) ELSE read_at END,
            acknowledged_at = CASE WHEN ? = 'acknowledged'
                                   THEN COALESCE(acknowledged_at, CURRENT_TIMESTAMP) ELSE acknowledged_at END,
            resolved_at = CASE WHEN ? = 'resolved'
                               THEN COALESCE(resolved_at, CURRENT_TIMESTAMP) ELSE resolved_at END
        WHERE id = ? AND user_id = ?
    `).run(status, status, status, status, notificationId, req.user.id);

    if (!result.changes) {
        return res.status(404).json({ status: "error", message: "Notification not found." });
    }
    return res.json({ status: "success", message: `Notification marked ${status}.` });
});

const findTransaction = db.prepare(`

    SELECT *

    FROM transactions

    WHERE id = ?

`);

const getRouteById = db.prepare(`

    SELECT

        id,

        route_code,

        route_name,

        status,

        verification_status

    FROM routes

    WHERE id = ?

`);

const getRouteStageByRouteAndId = db.prepare(`

    SELECT

        id,

        route_id,

        stage_order,

        stop_name

    FROM route_stages

    WHERE id = ?

    AND route_id = ?

`);

const insertTransaction = db.prepare(`

    INSERT INTO transactions

    (

        id,

        fare,

        passengers,

        total,

        paymentmethod,

        route,

        status,

        dateTime,

        route_id,

        boarding_stage_id,

        alighting_stage_id,

        created_by_user_id

    )

    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

`);

const getAllTransactions = db.prepare(`

    SELECT

        id,

        fare,

        passengers,

        total,

        paymentmethod,

        status,

        dateTime,

        route,

        route_id,

        boarding_stage_id,

        alighting_stage_id

    FROM transactions

    ORDER BY rowid ASC

`);

const getTransactionCount = db.prepare(`

    SELECT COUNT(*) AS count

    FROM transactions

`);

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

            console.error("SACCO retrieval failed:", error);

            return res.status(500).json({

                status: "error",

                message: "Could not retrieve SACCO records."

            });

        }

    }

);

app.post(

    "/api/saccos",

    authenticateToken,

    authorizeRoles("admin"),

    (req, res) => {

        const {

            sacco_code,

            sacco_name,

            county

        } = req.body || {};

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

                message: "Invalid SACCO registration details."

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

                message: "SACCO registered successfully.",

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

                    message: "SACCO code already exists."

                });

            }

            console.error("SACCO registration failed:", error);

            return res.status(500).json({

                status: "error",

                message: "Could not register SACCO."

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

            console.error("Route retrieval failed:", error);

            return res.status(500).json({

                status: "error",

                message: "Could not retrieve route records."

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

                message: "Invalid route registration details."

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

                message: "Selected SACCO does not exist."

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

                message: "Route registered successfully.",

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

                    message: "Route code already exists."

                });

            }

            console.error("Route registration failed:", error);

            return res.status(500).json({

                status: "error",

                message: "Could not register route."

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

        const route = db.prepare(`

            SELECT *

            FROM routes

            WHERE id = ?

        `).get(routeId);

        if (!route) {

            return res.status(404).json({

                success: false,

                message: "Route not found."

            });

        }

        const stages = db.prepare(`

            SELECT

                id,

                route_id,

                stage_order,

                stop_name,

                created_at

            FROM route_stages

            WHERE route_id = ?

            ORDER BY stage_order ASC

        `).all(routeId);

        return res.json({

            success: true,

            route,

            total_stages: stages.length,

            stages

        });

    }

);

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

            dateTime,

            route_id,

            boarding_stage_id,

            alighting_stage_id

        } = req.body || {};

        if (
            typeof id !== "string" ||
            !id.trim() ||
            !Number.isFinite(fare) ||
            fare <= 0 ||
            !Number.isInteger(passengers) ||
            passengers < 1 ||
            !Number.isFinite(total) ||
            typeof paymentmethod !== "string" ||
            !paymentmethod.trim()
        ) {
            return res.status(400).json({
                status: "error",
                message: "Invalid transaction details."
            });
        }

        const expectedAmount = Number((fare * passengers).toFixed(2));
        const recordedAmount = Number(total.toFixed(2));

        if (Math.abs(recordedAmount - expectedAmount) > 0.001) {
            try {
                createDiscrepancyNotifications({
                    eventKey: `fare-mismatch:${id.trim()}:${req.user.id}:${recordedAmount}`,
                    transactionId: null,
                    actorUserId: req.user.id,
                    routeId: Number.isInteger(route_id) ? route_id : null,
                    notificationType: "fare_mismatch",
                    severity: "critical",
                    title: "Transaction fare mismatch",
                    message: `Recorded total KSh ${recordedAmount.toFixed(2)} does not match expected fare KSh ${expectedAmount.toFixed(2)} for ${passengers} passenger(s).`,
                    expectedAmount,
                    recordedAmount,
                    differenceAmount: Number((expectedAmount - recordedAmount).toFixed(2)),
                    verificationSource: "server_calculation"
                });
            } catch (notificationError) {
                console.error("Could not create fare mismatch notification:", notificationError);
            }

            return res.status(400).json({
                status: "error",
                message: "Invalid transaction details: total must equal fare multiplied by passengers.",
                discrepancy_detected: true
            });
        }

        const hasRouteInformation =

            route_id !== undefined ||

            boarding_stage_id !== undefined ||

            alighting_stage_id !== undefined;

        let selectedRoute = null;

        let boardingStage = null;

        let alightingStage = null;

        if (hasRouteInformation) {

            if (

                !Number.isInteger(route_id) ||

                !Number.isInteger(boarding_stage_id) ||

                !Number.isInteger(alighting_stage_id)

            ) {

                return res.status(400).json({

                    status: "error",

                    message:

                        "Valid route, boarding stage and alighting stage IDs are required."

                });

            }

            selectedRoute = getRouteById.get(route_id);

            if (

                !selectedRoute ||

                selectedRoute.status !== "active" ||

                selectedRoute.verification_status !== "approved"

            ) {

                return res.status(400).json({

                    status: "error",

                    message:

                        "Selected route is unavailable or not approved."

                });

            }

            boardingStage = getRouteStageByRouteAndId.get(

                boarding_stage_id,

                route_id

            );

            alightingStage = getRouteStageByRouteAndId.get(

                alighting_stage_id,

                route_id

            );

            if (!boardingStage || !alightingStage) {

                return res.status(400).json({

                    status: "error",

                    message:

                        "Invalid boarding or alighting stage."

                });

            }

            if (

                boardingStage.id === alightingStage.id ||

                boardingStage.stage_order >= alightingStage.stage_order

            ) {

                return res.status(400).json({

                    status: "error",

                    message:

                        "Alighting stage must come after boarding stage."

                });

            }

        }

        const transactionId = id.trim();

        const transaction = {

            id: transactionId,

            fare,

            passengers,

            total,

            paymentmethod: paymentmethod.trim(),

            route: selectedRoute

                ? selectedRoute.route_name

                : null,

            status:

                typeof status === "string" && status.trim()

                    ? status.trim()

                    : "Paid",

            dateTime:

                typeof dateTime === "string" && dateTime.trim()

                    ? dateTime

                    : new Date().toISOString(),

            route_id: selectedRoute

                ? selectedRoute.id

                : null,

            boarding_stage_id: boardingStage

                ? boardingStage.id

                : null,

            alighting_stage_id: alightingStage

                ? alightingStage.id

                : null,

            created_by_user_id: req.user.id

        };

        const matchesExistingTransaction = (existing, incoming) => {

            return (

                Number(existing.fare) === Number(incoming.fare) &&

                Number(existing.passengers) === Number(incoming.passengers) &&

                Number(existing.total) === Number(incoming.total) &&

                existing.paymentmethod === incoming.paymentmethod &&

                existing.route === incoming.route &&

                existing.status === incoming.status &&

                existing.route_id === incoming.route_id &&

                existing.boarding_stage_id === incoming.boarding_stage_id &&

                existing.alighting_stage_id === incoming.alighting_stage_id

            );

        };

        const existingTransaction = findTransaction.get(transactionId);

        if (existingTransaction) {

            if (

                matchesExistingTransaction(

                    existingTransaction,

                    transaction

                )

            ) {

                return res.status(200).json({

                    status: "success",

                    message:

                        "Transaction already saved. Duplicate request acknowledged.",

                    count: getTransactionCount.get().count,

                    transaction: existingTransaction,

                    duplicate: true

                });

            }

            try {
                createDiscrepancyNotifications({
                    eventKey: `duplicate-transaction:${transactionId}:${req.user.id}:${Number(total).toFixed(2)}`,
                    transactionId: existingTransaction.id,
                    actorUserId: req.user.id,
                    routeId: existingTransaction.route_id,
                    notificationType: "duplicate_transaction",
                    severity: "high",
                    title: "Duplicate transaction ID detected",
                    message: `A transaction with ID ${transactionId} was submitted again with different details.`,
                    expectedAmount: Number(existingTransaction.total),
                    recordedAmount: Number(total),
                    differenceAmount: Number((Number(existingTransaction.total) - Number(total)).toFixed(2)),
                    verificationSource: "duplicate_submission_check"
                });
            } catch (notificationError) {
                console.error("Could not create duplicate transaction notification:", notificationError);
            }

            return res.status(409).json({
                status: "error",
                message: "Transaction ID already exists with different details.",
                discrepancy_detected: true
            });

        }

        try {

            insertTransaction.run(

                transaction.id,

                transaction.fare,

                transaction.passengers,

                transaction.total,

                transaction.paymentmethod,

                transaction.route,

                transaction.status,

                transaction.dateTime,

                transaction.route_id,

                transaction.boarding_stage_id,

                transaction.alighting_stage_id,

                req.user.id

            );

            return res.status(201).json({

                status: "success",

                message: "Transaction saved to SQLite.",

                count: getTransactionCount.get().count,

                transaction,

                duplicate: false

            });

        } catch (error) {

            if (

                error.code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||

                error.code === "SQLITE_CONSTRAINT_UNIQUE"

            ) {

                const existing = findTransaction.get(transaction.id);

                if (

                    existing &&

                    matchesExistingTransaction(existing, transaction)

                ) {

                    return res.status(200).json({

                        status: "success",

                        message:

                            "Transaction already saved. Duplicate request acknowledged.",

                        count: getTransactionCount.get().count,

                        transaction: existing,

                        duplicate: true

                    });

                }

                return res.status(409).json({

                    status: "error",

                    message:

                        "Transaction ID already exists with different details."

                });

            }

            console.error("Transaction insertion error:", error);

            return res.status(500).json({

                status: "error",

                message: "Failed to save transaction."

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

            console.error("Database read failed:", error);

            return res.status(500).json({

                status: "error",

                message: "Could not retrieve transactions."

            });

        }

    }

);

const server = app.listen(PORT, () => {

    console.log("-----------------------------------");

    console.log("SMART MATATU BACKEND STARTED");

    console.log("-----------------------------------");

    console.log(`Backend: http\://localhost:${PORT}`);

    console.log(`SQLite: ${databasePath}`);

    console.log("Authentication: Enabled");

    console.log("User Management: Enabled");

    console.log("Profile Management: Enabled");

    console.log("SACCO Management: Initialized");

    console.log("Route Management: Initialized");

    console.log("Transaction Management: Initialized");
    console.log("Notification Centre: Initialized");

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