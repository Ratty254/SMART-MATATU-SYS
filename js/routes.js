
const routesTableBody = document.getElementById(
    "routes-table-body"
);

const totalRoutesElement = document.getElementById(
    "total-routes"
);

const pendingRoutesElement = document.getElementById(
    "pending-routes"
);

const approvedRoutesElement = document.getElementById(
    "approved-routes"
);

const rejectedRoutesElement = document.getElementById(
    "rejected-routes"
);

const routeSearchInput = document.getElementById(
    "route-search"
);

const verificationFilter = document.getElementById(
    "verification-filter"
);

const refreshRoutesButton = document.getElementById(
    "refresh-routes-button"
);

const routesMessageElement = document.getElementById(
    "routes-message"
);

const routesLastUpdatedElement = document.getElementById(
    "routes-last-updated"
);




let registeredRoutes = [];

let isLoadingRoutes = false;

let isUpdatingRoute = false;




function escapeRouteHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}




function showRoutesMessage(message, type = "info") {

    if (!routesMessageElement) {
        console.warn(message);
        return;
    }

    routesMessageElement.textContent = message;

    routesMessageElement.className = `auth-message ${type}`;

    routesMessageElement.style.display = "block";
}


function clearRoutesMessage() {

    if (!routesMessageElement) {
        return;
    }

    routesMessageElement.textContent = "";

    routesMessageElement.className = "auth-message";

    routesMessageElement.style.display = "none";
}



function getVerificationStatus(route) {

    return String(
        route.verification_status || "pending"
    ).trim().toLowerCase();
}


function getRouteStatus(route) {

    return String(
        route.status || "unknown"
    ).trim().toLowerCase();
}



function updateRouteStatistics() {

    const total = registeredRoutes.length;

    const pending = registeredRoutes.filter(route =>
        getVerificationStatus(route) === "pending"
    ).length;

    const approved = registeredRoutes.filter(route =>
        getVerificationStatus(route) === "approved"
    ).length;

    const rejected = registeredRoutes.filter(route =>
        getVerificationStatus(route) === "rejected"
    ).length;


    if (totalRoutesElement) {
        totalRoutesElement.textContent = total;
    }

    if (pendingRoutesElement) {
        pendingRoutesElement.textContent = pending;
    }

    if (approvedRoutesElement) {
        approvedRoutesElement.textContent = approved;
    }

    if (rejectedRoutesElement) {
        rejectedRoutesElement.textContent = rejected;
    }
}



function getVerificationBadge(status) {

    const normalizedStatus = String(status)
        .toLowerCase();

    const badgeStyles = {

        pending: {
            label: "Pending",
            background: "#fff3cd",
            color: "#856404"
        },

        approved: {
            label: "Approved",
            background: "#d4edda",
            color: "#155724"
        },

        rejected: {
            label: "Rejected",
            background: "#f8d7da",
            color: "#721c24"
        }

    };

    const badge = badgeStyles[normalizedStatus] || {
        label: normalizedStatus || "Unknown",
        background: "#e2e3e5",
        color: "#383d41"
    };

    return `
        <span
            style="
                display: inline-block;
                padding: 6px 10px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                background: ${badge.background};
                color: ${badge.color};
                white-space: nowrap;
            "
        >
            ${escapeRouteHTML(badge.label)}
        </span>
    `;
}




function getRouteActions(route) {

    const status = getVerificationStatus(route);

    const routeId = escapeRouteHTML(route.id);


    if (status === "pending") {

        return `
            <div
                style="
                    display: flex;
                    gap: 7px;
                    flex-wrap: wrap;
                    min-width: 150px;
                "
            >

                <button
                    type="button"
                    class="btn btn-primary route-action-button"
                    data-action="approve"
                    data-route-id="${routeId}"
                    style="
                        padding: 7px 11px;
                        font-size: 12px;
                    "
                >
                    Approve
                </button>

                <button
                    type="button"
                    class="route-action-button"
                    data-action="reject"
                    data-route-id="${routeId}"
                    style="
                        padding: 7px 11px;
                        font-size: 12px;
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    "
                >
                    Reject
                </button>

            </div>
        `;
    }


    if (
        status === "approved" ||
        status === "rejected"
    ) {

        return `
            <div
                style="
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    min-width: 150px;
                "
            >

                <button
                    type="button"
                    class="route-action-button"
                    data-action="reset"
                    data-route-id="${routeId}"
                    style="
                        padding: 8px 11px;
                        font-size: 12px;
                        background: #6c757d;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    "
                >
                    ↻ Reset Verification
                </button>

                <small style="color: #777;">
                    Return route for review
                </small>

            </div>
        `;
    }


    return `
        <span style="color: #777; font-size: 13px;">
            No action available
        </span>
    `;
}




function renderRoutesTable() {

    if (!routesTableBody) {
        return;
    }

    const searchTerm = routeSearchInput
        ? routeSearchInput.value.trim().toLowerCase()
        : "";

    const selectedStatus = verificationFilter
        ? verificationFilter.value.toLowerCase()
        : "all";


    let filteredRoutes = [...registeredRoutes];


    if (selectedStatus !== "all") {

        filteredRoutes = filteredRoutes.filter(route =>
            getVerificationStatus(route) === selectedStatus
        );
    }



    if (searchTerm) {

        filteredRoutes = filteredRoutes.filter(route => {

            const searchableValues = [

                route.route_code,
                route.route_name,
                route.origin,
                route.destination,
                route.sacco_name,
                route.sacco_code

            ];

            return searchableValues.some(value =>
                String(value || "")
                    .toLowerCase()
                    .includes(searchTerm)
            );
        });
    }


    if (filteredRoutes.length === 0) {

        routesTableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 25px;">
                    No routes match your search or selected filter.
                </td>
            </tr>
        `;

        return;
    }


    routesTableBody.innerHTML = filteredRoutes.map(route => {

        const routeCode = escapeRouteHTML(
            route.route_code || "N/A"
        );

        const routeName = escapeRouteHTML(
            route.route_name || "Unnamed Route"
        );

        const origin = escapeRouteHTML(
            route.origin || "N/A"
        );

        const destination = escapeRouteHTML(
            route.destination || "N/A"
        );

        const saccoName = escapeRouteHTML(
            route.sacco_name || route.sacco_code || "N/A"
        );

        const routeStatus = escapeRouteHTML(
            getRouteStatus(route)
        );

        const verificationStatus = getVerificationStatus(route);


        return `
            <tr>

                <td>
                    <strong>${routeCode}</strong>
                </td>

                <td>
                    ${routeName}
                </td>

                <td>
                    ${origin}
                </td>

                <td>
                    ${destination}
                </td>

                <td>
                    ${saccoName}
                </td>

                <td>
                    ${routeStatus}
                </td>

                <td>
                    ${getVerificationBadge(verificationStatus)}
                </td>

                <td>
                    ${getRouteActions(route)}
                </td>

            </tr>
        `;

    }).join("");
}




async function loadRoutes() {

    if (isLoadingRoutes) {
        return false;
    }

    isLoadingRoutes = true;

    clearRoutesMessage();

    if (routesTableBody) {

        routesTableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 25px;">
                    Loading registered routes...
                </td>
            </tr>
        `;
    }

    if (refreshRoutesButton) {
        refreshRoutesButton.disabled = true;
        refreshRoutesButton.textContent = "Loading...";
    }


    try {

        const routes = await window.SmartMatatuAPI.getRoutes();

        registeredRoutes = Array.isArray(routes)
            ? routes
            : [];

        updateRouteStatistics();

        renderRoutesTable();


        if (routesLastUpdatedElement) {

            routesLastUpdatedElement.textContent =
                `Last updated: ${new Date().toLocaleString("en-KE")}`;
        }


        console.log(
            "Registered routes loaded successfully:",
            registeredRoutes
        );

        return true;


    } catch (error) {

        console.error("Unable to load routes:", error);

        if (routesTableBody) {

            routesTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 25px;">
                        Unable to load routes. Please refresh and try again.
                    </td>
                </tr>
            `;
        }

        showRoutesMessage(
            error.message || "Unable to retrieve registered routes.",
            "error"
        );

        return false;

    } finally {

        isLoadingRoutes = false;

        if (refreshRoutesButton) {

            refreshRoutesButton.disabled = false;

            refreshRoutesButton.textContent = "↻ Refresh Routes";
        }
    }
}



async function handleRouteVerification(routeId, decision) {

    if (isUpdatingRoute) {
        return;
    }


    const allowedDecisions = [
        "approved",
        "rejected",
        "pending"
    ];

    if (!allowedDecisions.includes(decision)) {

        showRoutesMessage(
            "Invalid route verification action.",
            "error"
        );

        return;
    }


    const route = registeredRoutes.find(item =>
        String(item.id) === String(routeId)
    );

    if (!route) {

        showRoutesMessage(
            "The selected route could not be found. Refresh the page and try again.",
            "error"
        );

        return;
    }


    const currentStatus = getVerificationStatus(route);


    if (
        (decision === "approved" || decision === "rejected") &&
        currentStatus !== "pending"
    ) {

        showRoutesMessage(
            "Only pending routes can be approved or rejected.",
            "info"
        );

        return;
    }



    if (
        decision === "pending" &&
        !["approved", "rejected"].includes(currentStatus)
    ) {

        showRoutesMessage(
            "Only approved or rejected routes can be reset.",
            "info"
        );

        return;
    }


    const routeName = route.route_name || route.route_code;


    let actionText = "";

    let confirmationDetails = "";


    if (decision === "approved") {

        actionText = "approve";

        confirmationDetails =
            "The route will become eligible for fare collection.";

    } else if (decision === "rejected") {

        actionText = "reject";

        confirmationDetails =
            "The route will remain unavailable for fare collection.";

    } else {

        actionText = "reset verification for";

        confirmationDetails =
            "The route will return to PENDING status and become unavailable for new route-based fare transactions until an administrator approves it again.";
    }


    const confirmation = confirm(
        `Are you sure you want to ${actionText} this route?\n\n` +
        `Route: ${routeName}\n` +
        `Route Code: ${route.route_code || "N/A"}\n` +
        `SACCO: ${route.sacco_name || "N/A"}\n` +
        `Current Verification: ${currentStatus.toUpperCase()}\n\n` +
        confirmationDetails
    );


    if (!confirmation) {
        return;
    }


    isUpdatingRoute = true;

    clearRoutesMessage();


    const actionButtons = routesTableBody.querySelectorAll(
        ".route-action-button"
    );

    actionButtons.forEach(button => {
        button.disabled = true;
    });


    try {

        const response =
            await window.SmartMatatuAPI.updateRouteVerification(
                routeId,
                decision
            );


        console.log(
            "Route verification response:",
            response
        );



        await loadRoutes();


        const successMessage = response?.message ||
            (
                decision === "pending"
                    ? "Route verification reset successfully. It is now pending review."
                    : `Route ${routeName} successfully ${decision}.`
            );


        showRoutesMessage(
            successMessage,
            "success"
        );


    } catch (error) {

        console.error(
            "Route verification failed:",
            error
        );

        showRoutesMessage(
            error.message ||
            `Unable to ${actionText} this route.`,
            "error"
        );

    } finally {

        isUpdatingRoute = false;



        if (routesTableBody) {

            const currentActionButtons =
                routesTableBody.querySelectorAll(
                    ".route-action-button"
                );

            currentActionButtons.forEach(button => {
                button.disabled = false;
            });
        }
    }
}


if (routesTableBody) {

    routesTableBody.addEventListener("click", async event => {

        const button = event.target.closest(
            ".route-action-button"
        );

        if (!button || button.disabled) {
            return;
        }

        const routeId = button.dataset.routeId;

        const action = button.dataset.action;

        if (!routeId) {
            return;
        }


        if (action === "approve") {

            await handleRouteVerification(
                routeId,
                "approved"
            );

        } else if (action === "reject") {

            await handleRouteVerification(
                routeId,
                "rejected"
            );

        } else if (action === "reset") {

            await handleRouteVerification(
                routeId,
                "pending"
            );
        }
    });
}



if (routeSearchInput) {

    routeSearchInput.addEventListener("input", () => {
        renderRoutesTable();
    });
}


if (verificationFilter) {

    verificationFilter.addEventListener("change", () => {
        renderRoutesTable();
    });
}


if (refreshRoutesButton) {

    refreshRoutesButton.addEventListener("click", () => {
        loadRoutes();
    });
}



document.addEventListener("DOMContentLoaded", () => {

    console.log(
        "Smart Matatu Route Management module initialized."
    );

    if (!window.SmartMatatuAPI) {

        console.error(
            "Smart Matatu API module is unavailable."
        );

        showRoutesMessage(
            "The API module failed to load. Check your script paths.",
            "error"
        );

        return;
    }

    loadRoutes();

});