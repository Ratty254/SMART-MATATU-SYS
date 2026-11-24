const path = require("path");
const Database = require("better-sqlite3");

const databasePath = path.join(__dirname, "smart-matatu.db");

const db = new Database(databasePath);

db.pragma("foreign_keys = ON");

console.log("--------------------------------------");
console.log("SMART MATATU NOTIFICATION MIGRATION");
console.log("--------------------------------------");
console.log("Database:", databasePath);

try {
    // ------------------------------------------
    // VERIFY EXISTING DATABASE TABLES
    // ------------------------------------------

    const requiredTables = [
        "users",
        "transactions",
        "saccos",
        "routes"
    ];

    const existingTables = db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
    `).all().map(table => table.name);

    for (const table of requiredTables) {
        if (!existingTables.includes(table)) {
            throw new Error(
                `Required database table '${table}' was not found.`
            );
        }
    }

    console.log("Existing database tables verified.");

    // ------------------------------------------
    // CREATE NOTIFICATIONS TABLE
    // ------------------------------------------

    const createNotificationsTable = db.transaction(() => {

        db.exec(`
            CREATE TABLE IF NOT EXISTS notifications (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                event_key TEXT NOT NULL,

                user_id INTEGER NOT NULL,

                recipient_role TEXT NOT NULL
                    CHECK (
                        recipient_role IN (
                            'admin',
                            'sacco_manager',
                            'conductor'
                        )
                    ),

                transaction_id TEXT,

                actor_user_id INTEGER,

                sacco_id INTEGER,

                route_id INTEGER,

                notification_type TEXT NOT NULL,

                severity TEXT NOT NULL
                    CHECK (
                        severity IN (
                            'low',
                            'medium',
                            'high',
                            'critical'
                        )
                    ),

                title TEXT NOT NULL,

                message TEXT NOT NULL,

                expected_amount REAL,

                recorded_amount REAL,

                verified_amount REAL,

                difference_amount REAL,

                verification_source TEXT,

                status TEXT NOT NULL DEFAULT 'unread'
                    CHECK (
                        status IN (
                            'unread',
                            'read',
                            'acknowledged',
                            'investigating',
                            'resolved'
                        )
                    ),

                created_at TEXT NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,

                read_at TEXT,

                acknowledged_at TEXT,

                resolved_at TEXT,

                FOREIGN KEY (user_id)
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                FOREIGN KEY (actor_user_id)
                    REFERENCES users(id)
                    ON DELETE SET NULL,

                FOREIGN KEY (transaction_id)
                    REFERENCES transactions(id)
                    ON DELETE SET NULL,

                FOREIGN KEY (sacco_id)
                    REFERENCES saccos(id)
                    ON DELETE SET NULL,

                FOREIGN KEY (route_id)
                    REFERENCES routes(id)
                    ON DELETE SET NULL,

                UNIQUE (event_key, user_id)
            )
        `);

        // --------------------------------------
        // CREATE DATABASE INDEXES
        // --------------------------------------

        db.exec(`
            CREATE INDEX IF NOT EXISTS
            idx_notifications_user_status

            ON notifications (
                user_id,
                status,
                created_at
            )
        `);

        db.exec(`
            CREATE INDEX IF NOT EXISTS
            idx_notifications_transaction

            ON notifications (
                transaction_id
            )
        `);

        db.exec(`
            CREATE INDEX IF NOT EXISTS
            idx_notifications_event

            ON notifications (
                event_key
            )
        `);

        db.exec(`
            CREATE INDEX IF NOT EXISTS
            idx_notifications_sacco

            ON notifications (
                sacco_id,
                created_at
            )
        `);

        db.exec(`
            CREATE INDEX IF NOT EXISTS
            idx_notifications_severity

            ON notifications (
                severity,
                status
            )
        `);
    });

    // Execute the migration atomically.
    createNotificationsTable();

    // ------------------------------------------
    // VERIFY MIGRATION
    // ------------------------------------------

    const notificationColumns = db.prepare(`
        PRAGMA table_info(notifications)
    `).all();

    const notificationCount = db.prepare(`
        SELECT COUNT(*) AS count
        FROM notifications
    `).get().count;

    const userCount = db.prepare(`
        SELECT COUNT(*) AS count
        FROM users
    `).get().count;

    const transactionCount = db.prepare(`
        SELECT COUNT(*) AS count
        FROM transactions
    `).get().count;

    console.log("");
    console.log("NOTIFICATION TABLE CREATED/VERIFIED");
    console.log("--------------------------------------");

    console.table(
        notificationColumns.map(column => ({
            column: column.name,
            type: column.type,
            required: column.notnull === 1
        }))
    );

    console.log("Existing users:", userCount);
    console.log("Existing transactions:", transactionCount);
    console.log("Existing notifications:", notificationCount);

    console.log("");
    console.log("Migration completed successfully.");

} catch (error) {

    console.error("");
    console.error("NOTIFICATION MIGRATION FAILED:");
    console.error(error.message);

    process.exitCode = 1;

} finally {

    db.close();

    console.log("");
    console.log("Database connection closed.");
}