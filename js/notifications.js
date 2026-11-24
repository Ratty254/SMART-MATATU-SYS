"use strict";

(function () {

    const API = window.SmartMatatuAPI;

    if (!API) {
        console.error("SmartMatatuAPI is unavailable.");
        return;
    }

    let allNotifications = [];
    let filteredNotifications = [];
    let activeFilter = "all";
    let isLoading = false;

    const elements = {

        refreshButton: document.getElementById("refresh-notifications"),

        message: document.getElementById("notification-message"),

        list: document.getElementById("notification-list"),

        resultsCount: document.getElementById("notification-results-count"),

        lastUpdated: document.getElementById("notifications-last-updated"),

        search: document.getElementById("notification-search"),

        severityFilter: document.getElementById(
            "notification-severity-filter"
        ),

        clearFilters: document.getElementById(
            "clear-notification-filters"
        ),

        filterButtons: document.querySelectorAll(
            "[data-notification-filter]"
        ),

        totalCount: document.getElementById(
            "notification-total-count"
        ),

        unreadCount: document.getElementById(
            "notification-unread-count"
        ),

        criticalCount: document.getElementById(
            "notification-critical-count"
        ),

        resolvedCount: document.getElementById(
            "notification-resolved-count"
        )

    };


    // --------------------------------------------------
    // GENERAL HELPERS
    // --------------------------------------------------

    function getValue(notification, keys, fallback = "") {

        for (const key of keys) {

            if (
                notification[key] !== undefined &&
                notification[key] !== null &&
                notification[key] !== ""
            ) {
                return notification[key];
            }

        }

        return fallback;
    }


    function normalize(value) {

        return String(value || "")
            .trim()
            .toLowerCase();

    }


    function getNotificationId(notification) {

        return getValue(
            notification,
            ["id", "notification_id"],
            null
        );

    }


    function getSeverity(notification) {

        return normalize(
            getValue(notification, ["severity"], "low")
        );

    }


    function getStatus(notification) {

        return normalize(
            getValue(notification, ["status"], "unread")
        );

    }


    function getTitle(notification) {

        return getValue(
            notification,
            ["title"],
            "System Notification"
        );

    }


    function getMessage(notification) {

        return getValue(
            notification,
            ["message"],
            "No additional information is available."
        );

    }


    function getTransactionId(notification) {

        return getValue(
            notification,
            ["transaction_id", "transactionId"],
            null
        );

    }


    function getRoute(notification) {

        return getValue(
            notification,
            ["route_name", "route_code", "route"],
            "Unassigned"
        );

    }


    function getConductor(notification) {

        return getValue(
            notification,
            ["actor_username", "conductor_name", "username"],
            "Not specified"
        );

    }


    function getCreatedAt(notification) {

        return getValue(
            notification,
            ["created_at", "date_time", "createdAt"],
            null
        );

    }


    function formatDate(value) {

        if (!value) {
            return "Date unavailable";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Date unavailable";
        }

        return date.toLocaleString("en-KE", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });

    }


    function formatCurrency(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return "Not available";
        }

        const amount = Number(value);

        if (!Number.isFinite(amount)) {
            return "Not available";
        }

        return API.formatMoney(amount);

    }


    function escapeClass(value) {

        return normalize(value)
            .replace(/[^a-z0-9_-]/g, "-");

    }


    // --------------------------------------------------
    // MESSAGE HANDLING
    // --------------------------------------------------

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


    // --------------------------------------------------
    // SUMMARY STATISTICS
    // --------------------------------------------------

    async function updateSummary() {

        const total = allNotifications.length;

        const unread = allNotifications.filter(
            notification => getStatus(notification) === "unread"
        ).length;

        const critical = allNotifications.filter(
            notification => getSeverity(notification) === "critical"
        ).length;

        const resolved = allNotifications.filter(
            notification => getStatus(notification) === "resolved"
        ).length;


        if (elements.totalCount) {

            elements.totalCount.textContent =
                total.toLocaleString();

        }


        if (elements.unreadCount) {

            elements.unreadCount.textContent =
                unread.toLocaleString();

        }


        if (elements.criticalCount) {

            elements.criticalCount.textContent =
                critical.toLocaleString();

        }


        if (elements.resolvedCount) {

            elements.resolvedCount.textContent =
                resolved.toLocaleString();

        }


        // Retrieve the actual unread count from the backend.
        // This count may be larger than the notifications
        // currently displayed on this page.

        try {

            const unreadTotal =
                await API.getUnreadNotificationCount();

            if (elements.unreadCount) {

                elements.unreadCount.textContent =
                    Number(unreadTotal).toLocaleString();

            }

            if (
                window.SmartMatatuAppShell &&
                typeof window.SmartMatatuAppShell.updateNotificationBadge ===
                "function"
            ) {

                window.SmartMatatuAppShell.updateNotificationBadge(
                    Number(unreadTotal)
                );

            }

        } catch (error) {

            console.warn(
                "Unable to refresh unread notification count:",
                error
            );

        }

    }


    // --------------------------------------------------
    // FILTERING
    // --------------------------------------------------

    function matchesActiveFilter(notification) {

        const status = getStatus(notification);

        const severity = getSeverity(notification);

        switch (activeFilter) {

            case "unread":

                return status === "unread";


            case "critical":

                return severity === "critical";


            case "under-review":

                return (
                    status === "acknowledged" ||
                    status === "investigating"
                );


            case "resolved":

                return status === "resolved";


            case "all":

            default:

                return true;

        }

    }


    function matchesSearch(notification, searchTerm) {

        if (!searchTerm) {
            return true;
        }

        const searchableValues = [

            getTitle(notification),

            getMessage(notification),

            getTransactionId(notification),

            getRoute(notification),

            getConductor(notification),

            getSeverity(notification),

            getStatus(notification),

            getValue(
                notification,
                ["notification_type"],
                ""
            )

        ];

        return searchableValues.some(value =>
            normalize(value).includes(searchTerm)
        );

    }


    function matchesSeverity(notification, selectedSeverity) {

        if (!selectedSeverity) {
            return true;
        }

        return getSeverity(notification) ===
            normalize(selectedSeverity);

    }


    function applyFilters() {

        const searchTerm = normalize(
            elements.search?.value
        );

        const selectedSeverity =
            elements.severityFilter?.value || "";


        filteredNotifications = allNotifications.filter(
            notification => {

                return (

                    matchesActiveFilter(notification) &&

                    matchesSearch(notification, searchTerm) &&

                    matchesSeverity(
                        notification,
                        selectedSeverity
                    )

                );

            }
        );


        renderNotifications(filteredNotifications);

    }


    function setActiveFilter(filter) {

        activeFilter = filter;


        elements.filterButtons.forEach(button => {

            const isActive =
                button.dataset.notificationFilter === filter;

            button.classList.toggle("active", isActive);

            button.setAttribute(
                "aria-pressed",
                String(isActive)
            );

        });


        applyFilters();

    }


    function clearFilters() {

        if (elements.search) {
            elements.search.value = "";
        }

        if (elements.severityFilter) {
            elements.severityFilter.value = "";
        }

        setActiveFilter("all");

        clearMessage();

    }


    // --------------------------------------------------
    // DOM ELEMENT HELPERS
    // --------------------------------------------------

    function createElement(tag, className, text = "") {

        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== "") {
            element.textContent = text;
        }

        return element;

    }


    function createDetail(label, value) {

        const container = createElement(
            "div",
            "notification-detail"
        );

        const heading = createElement(
            "small",
            "",
            label
        );

        const content = createElement(
            "strong",
            "",
            String(value)
        );

        container.appendChild(heading);

        container.appendChild(content);

        return container;

    }


    // --------------------------------------------------
    // FINANCIAL DETAILS
    // --------------------------------------------------

    function createFinancialDetails(notification) {

        const container = createElement(
            "div",
            "notification-financial-details"
        );


        const expected = getValue(
            notification,
            ["expected_amount"],
            null
        );

        const recorded = getValue(
            notification,
            ["recorded_amount"],
            null
        );

        const verified = getValue(
            notification,
            ["verified_amount"],
            null
        );

        const difference = getValue(
            notification,
            ["difference_amount"],
            null
        );


        container.appendChild(
            createDetail(
                "Expected Amount",
                formatCurrency(expected)
            )
        );


        container.appendChild(
            createDetail(
                "Recorded Amount",
                formatCurrency(recorded)
            )
        );


        container.appendChild(
            createDetail(
                "Verified Amount",
                formatCurrency(verified)
            )
        );


        container.appendChild(
            createDetail(
                "Difference",
                formatCurrency(difference)
            )
        );


        const verificationSource = getValue(
            notification,
            ["verification_source"],
            null
        );


        if (!verified && !verificationSource) {

            const note = createElement(
                "p",
                "notification-verification-note",
                "Independent payment verification is not available for this notification."
            );

            container.appendChild(note);

        } else if (verificationSource) {

            const source = createElement(
                "p",
                "notification-verification-note",
                "Verification source: " + verificationSource
            );

            container.appendChild(source);

        }


        return container;

    }


    // --------------------------------------------------
    // NOTIFICATION ACTION BUTTONS
    // --------------------------------------------------

    function createActionButton(label, action, notificationId) {

        const button = createElement(
            "button",
            "btn btn-outline notification-action-button",
            label
        );

        button.type = "button";

        button.dataset.notificationAction = action;

        button.dataset.notificationId = notificationId;

        return button;

    }


    function createActions(notification) {

        const container = createElement(
            "div",
            "notification-actions"
        );

        const notificationId = getNotificationId(notification);

        const status = getStatus(notification);

        const transactionId = getTransactionId(notification);


        if (status === "unread") {

            container.appendChild(
                createActionButton(
                    "Mark as Read",
                    "read",
                    notificationId
                )
            );

        }


        if (
            status !== "acknowledged" &&
            status !== "investigating" &&
            status !== "resolved"
        ) {

            container.appendChild(
                createActionButton(
                    "Acknowledge",
                    "acknowledged",
                    notificationId
                )
            );

        }


        if (
            status !== "investigating" &&
            status !== "resolved"
        ) {

            container.appendChild(
                createActionButton(
                    "Investigate",
                    "investigating",
                    notificationId
                )
            );

        }


        if (status !== "resolved") {

            container.appendChild(
                createActionButton(
                    "Resolve",
                    "resolved",
                    notificationId
                )
            );

        }


        if (transactionId !== null && transactionId !== "") {

            const viewButton = createElement(
                "button",
                "btn btn-primary notification-view-transaction",
                "View Transaction"
            );

            viewButton.type = "button";

            viewButton.dataset.notificationAction = "view-transaction";

            viewButton.dataset.transactionId = transactionId;

            container.appendChild(viewButton);

        }


        return container;

    }


    // --------------------------------------------------
    // CREATE NOTIFICATION CARD
    // --------------------------------------------------

    function createNotificationCard(notification) {

        const severity = getSeverity(notification);

        const status = getStatus(notification);

        const card = createElement(
            "article",
            "notification-card notification-" +
            escapeClass(severity) +
            " notification-status-" +
            escapeClass(status)
        );


        card.dataset.notificationId =
            getNotificationId(notification);


        // HEADER

        const header = createElement(
            "div",
            "notification-card-header"
        );


        const headingGroup = createElement(
            "div",
            "notification-card-heading"
        );


        const title = createElement(
            "h3",
            "notification-title",
            getTitle(notification)
        );


        const badges = createElement(
            "div",
            "notification-badges"
        );


        const severityBadge = createElement(
            "span",
            "notification-severity " + escapeClass(severity),
            severity.toUpperCase()
        );


        const statusBadge = createElement(
            "span",
            "notification-status " + escapeClass(status),
            status.replace(/-/g, " ").toUpperCase()
        );


        badges.appendChild(severityBadge);

        badges.appendChild(statusBadge);


        headingGroup.appendChild(title);

        headingGroup.appendChild(badges);


        const date = createElement(
            "small",
            "notification-date",
            formatDate(getCreatedAt(notification))
        );


        header.appendChild(headingGroup);

        header.appendChild(date);


        // MESSAGE

        const message = createElement(
            "p",
            "notification-message",
            getMessage(notification)
        );


        // TRANSACTION DETAILS

        const transactionDetails = createElement(
            "div",
            "notification-transaction-details"
        );


        const transactionId = getTransactionId(notification);


        transactionDetails.appendChild(
            createDetail(
                "Transaction ID",
                transactionId || "Not linked to a saved transaction"
            )
        );


        transactionDetails.appendChild(
            createDetail(
                "Route",
                getRoute(notification)
            )
        );


        transactionDetails.appendChild(
            createDetail(
                "Conductor",
                getConductor(notification)
            )
        );


        const transactionDate = getValue(
            notification,
            ["transaction_date", "date_time"],
            null
        );


        if (transactionDate) {

            transactionDetails.appendChild(
                createDetail(
                    "Transaction Date",
                    formatDate(transactionDate)
                )
            );

        }


        // FINANCIAL DETAILS

        const financialDetails =
            createFinancialDetails(notification);


        // ACTIONS

        const actions = createActions(notification);


        card.appendChild(header);

        card.appendChild(message);

        card.appendChild(transactionDetails);

        card.appendChild(financialDetails);

        card.appendChild(actions);


        return card;

    }


    // --------------------------------------------------
    // RENDER NOTIFICATIONS
    // --------------------------------------------------

    function renderNotifications(notifications) {

        if (!elements.list) {
            return;
        }

        elements.list.innerHTML = "";


        if (notifications.length === 0) {

            const emptyState = createElement(
                "div",
                "notification-empty-state"
            );


            const heading = createElement(
                "h3",
                "",
                "No Notifications Found"
            );


            const description = createElement(
                "p",
                "",
                "There are no notifications matching your current filters."
            );


            emptyState.appendChild(heading);

            emptyState.appendChild(description);

            elements.list.appendChild(emptyState);


            if (elements.resultsCount) {

                elements.resultsCount.textContent =
                    "No matching notifications found.";

            }

            return;

        }


        notifications.forEach(notification => {

            elements.list.appendChild(
                createNotificationCard(notification)
            );

        });


        if (elements.resultsCount) {

            elements.resultsCount.textContent =
                `Showing ${notifications.length} of ${allNotifications.length} notifications`;

        }

    }


    // --------------------------------------------------
    // LOAD NOTIFICATIONS
    // --------------------------------------------------

    async function loadNotifications() {

        if (isLoading) {
            return;
        }

        isLoading = true;

        clearMessage();


        if (elements.refreshButton) {

            elements.refreshButton.disabled = true;

            elements.refreshButton.textContent = "Loading...";

        }


        if (elements.list) {

            elements.list.innerHTML = `
                <div class="notification-loading-state">
                    <p>Loading system notifications...</p>
                </div>
            `;

        }


        try {

            const response = await API.getNotifications({
                limit: 200
            });


            allNotifications = Array.isArray(response)
                ? response
                : [];


            // Newest notifications first.

            allNotifications.sort((a, b) => {

                const dateA = new Date(
                    getCreatedAt(a) || 0
                ).getTime();

                const dateB = new Date(
                    getCreatedAt(b) || 0
                ).getTime();

                return dateB - dateA;

            });


            await updateSummary();

            applyFilters();


            if (elements.lastUpdated) {

                elements.lastUpdated.textContent =
                    "Last updated: " +
                    new Date().toLocaleString("en-KE");

            }


        } catch (error) {

            console.error(
                "Notification loading failed:",
                error
            );


            showMessage(
                error.message ||
                "Unable to load notifications. Please try again.",
                "error"
            );


            if (elements.list) {

                elements.list.innerHTML = `
                    <div class="notification-error-state">
                        <h3>Unable to Load Notifications</h3>
                        <p>
                            Check your connection and confirm that
                            the backend server is running.
                        </p>
                    </div>
                `;

            }

        } finally {

            isLoading = false;


            if (elements.refreshButton) {

                elements.refreshButton.disabled = false;

                elements.refreshButton.textContent =
                    "↻ Refresh Notifications";

            }

        }

    }


    // --------------------------------------------------
    // UPDATE NOTIFICATION STATUS
    // --------------------------------------------------

    async function updateNotification(notificationId, newStatus) {

        if (!notificationId) {
            return;
        }


        try {

            if (newStatus === "read") {

                await API.markNotificationAsRead(
                    notificationId
                );

            } else {

                await API.updateNotificationStatus(
                    notificationId,
                    newStatus
                );

            }


            showMessage(
                "Notification status updated successfully.",
                "success"
            );


            await loadNotifications();


        } catch (error) {

            console.error(
                "Notification status update failed:",
                error
            );


            showMessage(
                error.message ||
                "Unable to update notification status.",
                "error"
            );

        }

    }


    // --------------------------------------------------
    // VIEW TRANSACTION
    // --------------------------------------------------

    function viewTransaction(transactionId) {

        if (!transactionId) {
            return;
        }


        const destination =
            "transactions.html?transaction_id=" +
            encodeURIComponent(transactionId);


        window.location.href = destination;

    }


    // --------------------------------------------------
    // EVENT LISTENERS
    // --------------------------------------------------

    function initializeEventListeners() {

        elements.refreshButton?.addEventListener(
            "click",
            loadNotifications
        );


        elements.clearFilters?.addEventListener(
            "click",
            clearFilters
        );


        elements.search?.addEventListener(
            "input",
            applyFilters
        );


        elements.severityFilter?.addEventListener(
            "change",
            applyFilters
        );


        elements.filterButtons.forEach(button => {

            button.addEventListener("click", function () {

                setActiveFilter(
                    this.dataset.notificationFilter
                );

            });

        });


        // Event delegation for notification actions.

        elements.list?.addEventListener(
            "click",
            async function (event) {

                const button = event.target.closest(
                    "[data-notification-action]"
                );


                if (!button) {
                    return;
                }


                const action =
                    button.dataset.notificationAction;


                if (action === "view-transaction") {

                    viewTransaction(
                        button.dataset.transactionId
                    );

                    return;

                }


                const notificationId =
                    button.dataset.notificationId;


                if (!notificationId) {
                    return;
                }


                if (button.disabled) {
                    return;
                }


                button.disabled = true;


                await updateNotification(
                    notificationId,
                    action
                );


                button.disabled = false;

            }
        );

    }


    // --------------------------------------------------
    // INITIALIZATION
    // --------------------------------------------------

    function initializeNotificationsPage() {

        initializeEventListeners();

        loadNotifications();

    }


    document.addEventListener(
        "DOMContentLoaded",
        initializeNotificationsPage
    );


    // Public interface for testing and future integration.

    window.SmartMatatuNotifications = {

        loadNotifications,

        applyFilters,

        clearFilters,

        updateNotification,

        getAllNotifications: () => [
            ...allNotifications
        ],

        getFilteredNotifications: () => [
            ...filteredNotifications
        ]

    };


})();