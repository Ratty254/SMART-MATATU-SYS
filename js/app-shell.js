"use strict";



(function () {
    const API = window.SmartMatatuAPI;
    const AUTH = window.SmartMatatuAuth;

    const PUBLIC_PAGES = [
        "login.html",
        "register.html",
        "forgot-password.html",
        "reset-password.html"
    ];

    const ADMIN_ONLY_PAGES = [
        "users.html"
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
        "revenue-reports.html": [
            "revenue-reports",
            "Revenue Reports"
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

    function getCurrentPage() {
        const pathname = window.location.pathname;
        return pathname.substring(pathname.lastIndexOf("/") + 1).toLowerCase();
    }

    function redirectToLogin() {
        window.location.replace("login.html");
    }

    function redirectToDashboard() {
        window.location.replace("dashboard.html");
    }

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

    function protectPage() {
        const currentPage = getCurrentPage();

        if (PUBLIC_PAGES.includes(currentPage)) {
            return true;
        }

        const session = getSession();

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

    function configureNavigation() {
        const session = getSession();

        if (!session.user) {
            return;
        }

        const isAdmin = session.user.role === "admin";

        const usersLinks = document.querySelectorAll(
            '[href="users.html"], [data-page="users"]'
        );

        usersLinks.forEach(function (link) {
            if (!isAdmin) {
                link.style.display = "none";
            } else {
                link.style.display = "";
            }
        });

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
                link.setAttribute("aria-current", "page");
            } else {
                link.classList.remove("active");
                link.removeAttribute("aria-current");
            }
        });
    }

    function configureLogout() {
        const logoutButtons = document.querySelectorAll(
            "#logout-button, .logout-button, [data-action='logout']"
        );

        logoutButtons.forEach(function (button) {
            button.addEventListener("click", function (event) {
                event.preventDefault();

                if (AUTH && typeof AUTH.logoutUser === "function") {
                    AUTH.logoutUser();
                    return;
                }

                if (API) {
                    API.removeAuthToken();
                    API.removeCurrentUser();
                }

                redirectToLogin();
            });
        });
    }

    function initializeApplicationShell() {
        if (!API) {
            console.error(
                "SmartMatatuAPI was not found. Load js/api.js before js/app-shell.js."
            );

            return;
        }

        const isProtectedPage = protectPage();

        if (!isProtectedPage) {
            return;
        }

        displayCurrentUser();
        configureNavigation();
        configureLogout();

        console.log(
            "Smart Matatu application shell initialized:",
            getCurrentPage()
        );
    }

    document.addEventListener(
        "DOMContentLoaded",
        initializeApplicationShell
    );

    window.SmartMatatuAppShell = {
        initialize: initializeApplicationShell,
        getCurrentPage: getCurrentPage,
        protectPage: protectPage,
        displayCurrentUser: displayCurrentUser,
        configureNavigation: configureNavigation,
        configureLogout: configureLogout
    };
})();