"use strict";

(function () {
    const API = window.SmartMatatuAPI;

    if (!API) {
        console.error("SmartMatatuAPI is unavailable.");
        return;
    }

    let allUsers = [];
    let filteredUsers = [];

    const elements = {
        refreshButton: document.getElementById("refresh-users"),
        message: document.getElementById("users-message"),

        totalUsers: document.getElementById("total-users"),
        activeUsers: document.getElementById("active-users"),
        pendingUsers: document.getElementById("pending-users"),
        suspendedUsers: document.getElementById("suspended-users"),
        adminUsers: document.getElementById("admin-users"),

        search: document.getElementById("user-search"),
        roleFilter: document.getElementById("user-role-filter"),
        statusFilter: document.getElementById("user-status-filter"),

        applyFilters: document.getElementById("apply-user-filters"),
        clearFilters: document.getElementById("clear-user-filters"),

        tableBody: document.getElementById("users-table-body"),
        resultsCount: document.getElementById("users-results-count"),
        lastUpdated: document.getElementById("users-last-updated")
    };

   
    function getValue(user, keys, fallback = "") {
        for (const key of keys) {
            if (
                user[key] !== undefined &&
                user[key] !== null &&
                user[key] !== ""
            ) {
                return user[key];
            }
        }

        return fallback;
    }

    function getUserId(user) {
        return getValue(user, ["id", "user_id"], null);
    }

    function getUsername(user) {
        return String(
            getValue(user, ["username", "name"], "Unknown")
        );
    }

    function getEmail(user) {
        return String(
            getValue(user, ["email", "email_address"], "Not provided")
        );
    }

    function getRole(user) {
        return String(
            getValue(user, ["role", "user_role"], "unknown")
        ).toLowerCase();
    }

    function getStatus(user) {
        const status = getValue(
            user,
            ["status", "account_status"],
            null
        );

        if (status !== null) {
            return String(status).toLowerCase();
        }

        const active = getValue(
            user,
            ["is_active", "active"],
            true
        );

        return active === false || active === 0
            ? "suspended"
            : "active";
    }

    function getCreatedAt(user) {
        return getValue(
            user,
            ["created_at", "createdAt", "date_created"],
            null
        );
    }

    function formatCreatedAt(value) {
        if (!value) {
            return "Not available";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleDateString("en-KE", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    function normalizeUsersResponse(response) {
        if (Array.isArray(response)) {
            return response;
        }

        if (Array.isArray(response?.users)) {
            return response.users;
        }

        if (Array.isArray(response?.data?.users)) {
            return response.data.users;
        }

        return [];
    }

    function getRoleLabel(role) {
        const roleLabels = {
            admin: "Administrator",
            sacco_manager: "SACCO Manager",
            conductor: "Conductor"
        };

        return roleLabels[role] || "Unknown Role";
    }

   
    function showMessage(message, type = "info") {
        if (!elements.message) {
            return;
        }

        elements.message.textContent = message;
        elements.message.className = "message-box";

        if (type === "error") {
            elements.message.classList.add("error");
        } else if (type === "success") {
            elements.message.classList.add("success");
        } else {
            elements.message.classList.add("info");
        }
    }

    function clearMessage() {
        if (!elements.message) {
            return;
        }

        elements.message.textContent = "";
        elements.message.className = "message-box";
    }


    function updateStatistics(users) {
        const total = users.length;

        const active = users.filter(
            user => getStatus(user) === "active"
        ).length;

        const pending = users.filter(
            user => getStatus(user) === "pending"
        ).length;

        const suspended = users.filter(
            user => getStatus(user) === "suspended"
        ).length;

        const admins = users.filter(
            user => getRole(user) === "admin"
        ).length;

        if (elements.totalUsers) {
            elements.totalUsers.textContent = total.toLocaleString();
        }

        if (elements.activeUsers) {
            elements.activeUsers.textContent = active.toLocaleString();
        }

        if (elements.pendingUsers) {
            elements.pendingUsers.textContent = pending.toLocaleString();
        }

        if (elements.suspendedUsers) {
            elements.suspendedUsers.textContent =
                suspended.toLocaleString();
        }

        if (elements.adminUsers) {
            elements.adminUsers.textContent = admins.toLocaleString();
        }
    }



    function createStatusBadge(status) {
        const badge = document.createElement("span");

        badge.className = "status-badge";

        if (status === "active") {
            badge.classList.add("status-active");
            badge.textContent = "Active";

        } else if (status === "suspended") {
            badge.classList.add("status-suspended");
            badge.textContent = "Suspended";

        } else if (status === "pending") {
            badge.classList.add("status-pending");
            badge.textContent = "Pending Approval";

        } else {
            badge.classList.add("status-pending");
            badge.textContent = "Unknown";
        }

        return badge;
    }



    function createCell(value) {
        const cell = document.createElement("td");
        cell.textContent = String(value ?? "");
        return cell;
    }

    function createActionButton(text, action, userId, className) {
        const button = document.createElement("button");

        button.type = "button";
        button.textContent = text;
        button.dataset.action = action;
        button.dataset.userId = userId;
        button.className = className;

        return button;
    }

    function renderUsers(users) {
        if (!elements.tableBody) {
            return;
        }

        elements.tableBody.innerHTML = "";

        if (users.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 7;
            cell.className = "empty-state";
            cell.textContent = "No users found.";

            row.appendChild(cell);
            elements.tableBody.appendChild(row);

            if (elements.resultsCount) {
                elements.resultsCount.textContent = "0 users";
            }

            return;
        }

        const currentUser = API.getCurrentUser();

        const currentUserId = currentUser
            ? String(currentUser.id ?? currentUser.user_id ?? "")
            : "";

        users.forEach(user => {
            const row = document.createElement("tr");

            const userId = getUserId(user);
            const userIdString = String(userId);
            const role = getRole(user);
            const status = getStatus(user);

            row.appendChild(createCell(userId));
            row.appendChild(createCell(getUsername(user)));
            row.appendChild(createCell(getEmail(user)));
            row.appendChild(createCell(getRoleLabel(role)));

            const statusCell = document.createElement("td");

            statusCell.appendChild(
                createStatusBadge(status)
            );

            row.appendChild(statusCell);

            row.appendChild(
                createCell(formatCreatedAt(getCreatedAt(user)))
            );

            const actionsCell = document.createElement("td");

            actionsCell.className = "user-actions";

            if (userIdString === currentUserId) {
                const label = document.createElement("span");

                label.textContent = "Current account";
                label.className = "current-user-label";

                actionsCell.appendChild(label);

            } else if (status === "pending") {
                actionsCell.appendChild(
                    createActionButton(
                        "Approve",
                        "approve",
                        userIdString,
                        "btn btn-success btn-small"
                    )
                );

            } else if (status === "active") {
                actionsCell.appendChild(
                    createActionButton(
                        "Suspend",
                        "suspend",
                        userIdString,
                        "btn btn-warning btn-small"
                    )
                );

            } else if (status === "suspended") {
                actionsCell.appendChild(
                    createActionButton(
                        "Restore",
                        "restore",
                        userIdString,
                        "btn btn-success btn-small"
                    )
                );

            } else {
                const label = document.createElement("span");

                label.textContent = "No available action";
                label.className = "current-user-label";

                actionsCell.appendChild(label);
            }

            row.appendChild(actionsCell);

            elements.tableBody.appendChild(row);
        });

        if (elements.resultsCount) {
            elements.resultsCount.textContent =
                `${users.length} user${users.length === 1 ? "" : "s"}`;
        }
    }


    function applyFilters() {
        const searchTerm = (
            elements.search?.value || ""
        ).trim().toLowerCase();

        const selectedRole = (
            elements.roleFilter?.value || ""
        ).toLowerCase();

        const selectedStatus = (
            elements.statusFilter?.value || ""
        ).toLowerCase();

        filteredUsers = allUsers.filter(user => {
            const username = getUsername(user).toLowerCase();
            const email = getEmail(user).toLowerCase();
            const role = getRole(user);
            const status = getStatus(user);

            const matchesSearch =
                !searchTerm ||
                username.includes(searchTerm) ||
                email.includes(searchTerm) ||
                String(getUserId(user)).includes(searchTerm);

            const matchesRole =
                !selectedRole || role === selectedRole;

            const matchesStatus =
                !selectedStatus || status === selectedStatus;

            return (
                matchesSearch &&
                matchesRole &&
                matchesStatus
            );
        });

        renderUsers(filteredUsers);
    }

    function clearFilters() {
        if (elements.search) {
            elements.search.value = "";
        }

        if (elements.roleFilter) {
            elements.roleFilter.value = "";
        }

        if (elements.statusFilter) {
            elements.statusFilter.value = "";
        }

        applyFilters();
    }


    async function loadUsers(options = {}) {
        try {
            if (!options?.preserveMessage) {
                clearMessage();
            }

            if (elements.refreshButton) {
                elements.refreshButton.disabled = true;
                elements.refreshButton.textContent = "Loading...";
            }

            const response = await API.getUsers();

            allUsers = normalizeUsersResponse(response);

            updateStatistics(allUsers);

            applyFilters();

            if (elements.lastUpdated) {
                elements.lastUpdated.textContent =
                    "Last updated: " +
                    new Date().toLocaleString("en-KE");
            }

        } catch (error) {
            console.error("Unable to load users:", error);

            showMessage(
                error.message || "Unable to retrieve user accounts.",
                "error"
            );

        } finally {
            if (elements.refreshButton) {
                elements.refreshButton.disabled = false;
                elements.refreshButton.textContent = "Refresh Users";
            }
        }
    }

    /* =====================================================
       ACCOUNT STATUS MANAGEMENT
       ===================================================== */

    async function changeUserStatus(userId, newStatus) {
        const user = allUsers.find(
            item => String(getUserId(item)) === String(userId)
        );

        if (!user) {
            showMessage("User account could not be found.", "error");
            return;
        }

        const username = getUsername(user);

        const actionText = {
            active: "approve",
            suspended: "suspend",
            restore: "restore"
        };

        const confirmationText = {
            active: `Are you sure you want to approve ${username}'s account?`,
            suspended: `Are you sure you want to suspend ${username}'s account?`,
            restore: `Are you sure you want to restore ${username}'s account?`
        };

        const confirmed = window.confirm(
            confirmationText[newStatus] ||
            `Are you sure you want to ${actionText[newStatus] || "update"} this account?`
        );

        if (!confirmed) {
            return;
        }

        try {
            showMessage(
                `Updating ${username}'s account...`,
                "info"
            );

            await API.updateUserStatus(userId, newStatus);

            const successMessage = {
                active: `${username}'s account has been approved successfully.`,
                suspended: `${username}'s account has been suspended.`,
                restore: `${username}'s account has been restored.`
            };

            showMessage(
                successMessage[newStatus] ||
                `${username}'s account has been updated.`,
                "success"
            );

            await loadUsers({
                preserveMessage: true
            });

        } catch (error) {
            console.error("Account status update failed:", error);

            showMessage(
                error.message || "Unable to update this account.",
                "error"
            );
        }
    }


    function handleTableAction(event) {
        const button = event.target.closest("button[data-action]");

        if (!button) {
            return;
        }

        const action = button.dataset.action;
        const userId = button.dataset.userId;

        if (!userId) {
            return;
        }

        if (action === "approve") {
            changeUserStatus(userId, "active");
        }

        if (action === "suspend") {
            changeUserStatus(userId, "suspended");
        }

        if (action === "restore") {
            changeUserStatus(userId, "active");
        }
    }



    function initializeEventListeners() {
        elements.refreshButton?.addEventListener(
            "click",
            loadUsers
        );

        elements.applyFilters?.addEventListener(
            "click",
            applyFilters
        );

        elements.clearFilters?.addEventListener(
            "click",
            clearFilters
        );

        elements.search?.addEventListener(
            "input",
            applyFilters
        );

        elements.roleFilter?.addEventListener(
            "change",
            applyFilters
        );

        elements.statusFilter?.addEventListener(
            "change",
            applyFilters
        );

        elements.tableBody?.addEventListener(
            "click",
            handleTableAction
        );
    }

   
    function initializeUsersPage() {
        initializeEventListeners();
        loadUsers();
    }

    document.addEventListener(
        "DOMContentLoaded",
        initializeUsersPage
    );

    window.SmartMatatuUsers = {
        loadUsers,
        applyFilters,
        getUsers: () => [...allUsers]
    };

})();