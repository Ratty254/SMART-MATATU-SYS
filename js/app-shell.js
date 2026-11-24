"use strict";

(function () {

    const API = window.SmartMatatuAPI;
    const AUTH = window.SmartMatatuAuth;


    // =====================================================
    // PAGE CONFIGURATION
    // =====================================================

    const PUBLIC_PAGES = [
        "login.html",
        "register.html",
        "forgot-password.html",
        "reset-password.html"
    ];

    const ADMIN_ONLY_PAGES = [
        "users.html",
        "routes.html"
    ];

    const PAGE_LINKS = {

        "dashboard.html": [
            "dashboard",
            "Dashboard"
        ],

        "fare-collection.html": [
            "fare-collection",
            "Fare Collection"
        ],

        "transactions.html": [
            "transactions",
            "Transactions"
        ],

        "notifications.html": [
            "notifications",
            "Notifications"
        ],

        "revenue-reports.html": [
            "revenue-reports",
            "Revenue Reports"
        ],

        "routes.html": [
            "routes",
            "Route Management"
        ],

        "users.html": [
            "users",
            "User Management"
        ],

        "profile.html": [
            "profile",
            "My Profile"
        ]

    };


    // =====================================================
    // CURRENT PAGE
    // =====================================================

    function getCurrentPage() {

        const pathname = window.location.pathname;

        return pathname
            .substring(pathname.lastIndexOf("/") + 1)
            .toLowerCase();

    }


    // =====================================================
    // SESSION MANAGEMENT
    // =====================================================

    function getSession() {

        if (!API) {

            return {
                token: null,
                user: null
            };

        }

        return {

            token: API.getAuthToken(),

            user: API.getCurrentUser()

        };

    }


    function redirectToLogin() {

        window.location.replace("login.html");

    }


    function redirectToDashboard() {

        window.location.replace("dashboard.html");

    }


    // =====================================================
    // PAGE PROTECTION
    // =====================================================

    function protectPage() {

        const currentPage = getCurrentPage();

        // Allow public authentication pages.
        if (PUBLIC_PAGES.includes(currentPage)) {

            return true;

        }

        const session = getSession();

        // Require authentication.
        if (!session.token) {

            redirectToLogin();

            return false;

        }

        if (!session.user) {

            console.error(
                "Authenticated session found, but user information is missing."
            );

            redirectToLogin();

            return false;

        }

        // Restrict administrative pages.
        if (
            ADMIN_ONLY_PAGES.includes(currentPage) &&
            session.user.role !== "admin"
        ) {

            console.warn(
                "Access denied: administrator permissions are required."
            );

            redirectToDashboard();

            return false;

        }

        return true;

    }


    // =====================================================
    // USER INFORMATION
    // =====================================================

    function displayCurrentUser() {

        const session = getSession();

        const user = session.user;

        if (!user) {

            return;

        }

        const username =
            user.username ||
            user.name ||
            "System User";

        const role =
            user.role ||
            "User";


        const usernameElements = [

            "current-user-name",
            "sidebar-user-name",
            "logged-in-username",
            "user-name"

        ];

        const roleElements = [

            "current-user-role",
            "sidebar-user-role",
            "logged-in-user-role",
            "user-role"

        ];


        usernameElements.forEach(function (id) {

            const element = document.getElementById(id);

            if (element) {

                element.textContent = username;

            }

        });


        roleElements.forEach(function (id) {

            const element = document.getElementById(id);

            if (element) {

                element.textContent = formatRole(role);

            }

        });

    }


    function formatRole(role) {

        return String(role)

            .replace(/_/g, " ")

            .replace(/\b\w/g, function (character) {

                return character.toUpperCase();

            });

    }


    // =====================================================
    // ROUTE MANAGEMENT NAVIGATION
    // ADMIN ONLY
    // =====================================================

    function configureRouteNavigation() {

        const navigation = document.querySelector(
            ".sidebar-navigation, .sidebar-nav"
        );

        if (!navigation) {

            console.warn(
                "Sidebar navigation was not found."
            );

            return;

        }

        const session = getSession();

        const isAdmin =
            session.user &&
            session.user.role === "admin";


        // Find an existing Route Management link.
        let routeLink = navigation.querySelector(
            '[data-page="routes"], [href="routes.html"]'
        );


        // Create the link if it does not exist.
        if (!routeLink) {

            routeLink = document.createElement("a");

            routeLink.href = "routes.html";

            routeLink.setAttribute(
                "data-page",
                "routes"
            );

            routeLink.id = "routes-navigation-link";

            routeLink.innerHTML = `
                <span aria-hidden="true">⇄</span>
                <span>Route Management</span>
            `;


            // First preference:
            // Insert immediately before User Management.
            const usersLink = navigation.querySelector(
                '[href="users.html"], [data-page="users"]'
            );

            if (usersLink) {

                usersLink.insertAdjacentElement(
                    "beforebegin",
                    routeLink
                );

            } else {

                // Second preference:
                // Find the MANAGEMENT heading.
                const headings = navigation.querySelectorAll(
                    ".sidebar-heading"
                );

                let managementHeading = null;

                headings.forEach(function (heading) {

                    if (
                        heading.textContent.trim().toUpperCase() ===
                        "MANAGEMENT"
                    ) {

                        managementHeading = heading;

                    }

                });


                if (managementHeading) {

                    managementHeading.insertAdjacentElement(
                        "afterend",
                        routeLink
                    );

                } else {

                    navigation.appendChild(routeLink);

                }

            }

        }


        // Admin-only visibility.
        routeLink.style.display = isAdmin ? "" : "none";

    }


    // =====================================================
    // NOTIFICATION NAVIGATION
    // =====================================================

    function configureNotificationNavigation() {

        const navigation = document.querySelector(
            ".sidebar-navigation, .sidebar-nav"
        );

        if (!navigation) {

            console.warn(
                "Sidebar navigation was not found. Notification link was not added."
            );

            return;

        }


        // Check whether Notifications already exists.
        let notificationLink = navigation.querySelector(
            '[data-page="notifications"], a[href="notifications.html"]'
        );


        // Create Notifications if it does not exist.
        if (!notificationLink) {

            notificationLink = document.createElement("a");

            notificationLink.href = "notifications.html";

            notificationLink.setAttribute(
                "data-page",
                "notifications"
            );

            notificationLink.className = "notification-nav-link";

            notificationLink.innerHTML = `
                <span aria-hidden="true">🔔</span>
                <span>Notifications</span>
                <span
                    id="notification-nav-badge"
                    class="notification-nav-badge"
                    aria-label="Unread notifications"
                    style="display: none;"
                ></span>
            `;

        } else {

            notificationLink.classList.add(
                "notification-nav-link"
            );

        }


        // Ensure the notification badge exists.
        let badge = notificationLink.querySelector(
            "#notification-nav-badge"
        );

        if (!badge) {

            badge = document.createElement("span");

            badge.id = "notification-nav-badge";

            badge.className = "notification-nav-badge";

            badge.setAttribute(
                "aria-label",
                "Unread notifications"
            );

            badge.style.display = "none";

            notificationLink.appendChild(badge);

        }


        // Keep Notifications immediately after Transactions.
        const transactionsLink = navigation.querySelector(
            '[href="transactions.html"], [data-page="transactions"]'
        );

        if (transactionsLink) {

            transactionsLink.insertAdjacentElement(
                "afterend",
                notificationLink
            );

        } else if (!notificationLink.parentElement) {

            navigation.appendChild(notificationLink);

        }

    }


    // =====================================================
    // NOTIFICATION BADGE
    // =====================================================

    function updateNotificationBadge(count) {

        const badge = document.getElementById(
            "notification-nav-badge"
        );

        if (!badge) {

            return;

        }

        const unreadCount = Math.max(
            0,
            Number(count) || 0
        );


        if (unreadCount === 0) {

            badge.textContent = "";

            badge.style.display = "none";

            badge.setAttribute(
                "aria-label",
                "No unread notifications"
            );

            return;

        }


        badge.textContent = unreadCount > 99
            ? "99+"
            : String(unreadCount);

        badge.style.display = "inline-flex";

        badge.setAttribute(
            "aria-label",
            `${unreadCount} unread notifications`
        );

    }


    // =====================================================
    // NOTIFICATION POLLING
    // =====================================================

    let notificationPollingInterval = null;

    let notificationRequestInProgress = false;


    function getAuthTokenSafely() {

        if (!API) {

            return null;

        }

        return API.getAuthToken();

    }


    async function refreshNotificationBadge() {

        if (!API || !getAuthTokenSafely()) {

            updateNotificationBadge(0);

            return;

        }

        if (
            typeof API.getUnreadNotificationCount !== "function"
        ) {

            console.warn(
                "Notification count API function is unavailable."
            );

            return;

        }

        if (notificationRequestInProgress) {

            return;

        }

        notificationRequestInProgress = true;

        try {

            const unreadCount =
                await API.getUnreadNotificationCount();

            updateNotificationBadge(unreadCount);

        } catch (error) {

            console.error(
                "Unable to refresh notification count:",
                error.message
            );

        } finally {

            notificationRequestInProgress = false;

        }

    }


    function startNotificationPolling() {

        if (notificationPollingInterval) {

            clearInterval(notificationPollingInterval);

        }

        // Get the initial unread count.
        refreshNotificationBadge();


        // Refresh every 30 seconds.
        notificationPollingInterval = setInterval(
            refreshNotificationBadge,
            30000
        );

    }


    // =====================================================
    // GENERAL NAVIGATION CONFIGURATION
    // =====================================================

    function configureNavigation() {

        const session = getSession();

        if (!session.user) {

            return;

        }

        const isAdmin =
            session.user.role === "admin";


        // User Management: Admin only.
        const usersLinks = document.querySelectorAll(
            '[href="users.html"], [data-page="users"]'
        );

        usersLinks.forEach(function (link) {

            link.style.display = isAdmin ? "" : "none";

        });


        // Route Management: Admin only.
        const routeLinks = document.querySelectorAll(
            '[href="routes.html"], [data-page="routes"]'
        );

        routeLinks.forEach(function (link) {

            link.style.display = isAdmin ? "" : "none";

        });


        // Highlight the current page.
        const currentPage = getCurrentPage();

        document.querySelectorAll(
            "nav a, .sidebar a, .app-sidebar a"
        ).forEach(function (link) {

            const href = link.getAttribute("href");

            if (!href) {

                return;

            }

            const linkPage = href

                .split("/")

                .pop()

                .split("?")[0]

                .toLowerCase();


            if (linkPage === currentPage) {

                link.classList.add("active");

                link.setAttribute(
                    "aria-current",
                    "page"
                );

            } else {

                link.classList.remove("active");

                link.removeAttribute(
                    "aria-current"
                );

            }

        });

    }


    // =====================================================
    // LOGOUT CONFIGURATION
    // =====================================================

    function configureLogout() {

        const logoutButtons = document.querySelectorAll(
            "#logout-button, .logout-button, [data-action='logout']"
        );

        logoutButtons.forEach(function (button) {

            button.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();


                    if (
                        AUTH &&
                        typeof AUTH.logoutUser === "function"
                    ) {

                        AUTH.logoutUser();

                        return;

                    }


                    if (API) {

                        API.removeAuthToken();

                        API.removeCurrentUser();

                    }

                    redirectToLogin();

                }
            );

        });

    }


    // =====================================================
    // APPLICATION INITIALIZATION
    // =====================================================

    function initializeApplicationShell() {

        if (!API) {

            console.error(
                "SmartMatatuAPI was not found. Load js/api.js before js/app-shell.js."
            );

            return;

        }


        // First protect the current page.
        const isProtectedPage = protectPage();

        if (!isProtectedPage) {

            return;

        }


        // Display the logged-in user.
        displayCurrentUser();


        // Configure Route Management.
        configureRouteNavigation();


        // Configure Notifications.
        configureNotificationNavigation();


        // Configure general navigation and active links.
        configureNavigation();


        // Configure logout.
        configureLogout();


        // Start notification polling.
        startNotificationPolling();


        console.log(
            "Smart Matatu application shell initialized:",
            getCurrentPage()
        );

    }


    // =====================================================
    // INITIALIZATION EVENT
    // =====================================================

    document.addEventListener(
        "DOMContentLoaded",
        initializeApplicationShell
    );


    // =====================================================
    // PUBLIC APPLICATION SHELL METHODS
    // =====================================================

    window.SmartMatatuAppShell = {

        initialize: initializeApplicationShell,

        getCurrentPage: getCurrentPage,

        protectPage: protectPage,

        displayCurrentUser: displayCurrentUser,

        configureNavigation: configureNavigation,

        configureLogout: configureLogout,

        configureRouteNavigation:
            configureRouteNavigation,

        configureNotificationNavigation:
            configureNotificationNavigation,

        refreshNotificationBadge:
            refreshNotificationBadge,

        updateNotificationBadge:
            updateNotificationBadge

    };


})();