

const API_BASE = "http://localhost:3000/api";

window.API_BASE = API_BASE;




function getAuthToken() {
    return sessionStorage.getItem("token");
}

function setAuthToken(token) {
    if (!token) {
        throw new Error("A valid authentication token is required.");
    }

    sessionStorage.setItem("token", token);
}

function removeAuthToken() {
    sessionStorage.removeItem("token");
}

function getCurrentUser() {
    const storedUser = sessionStorage.getItem("user");

    if (!storedUser) {
        return null;
    }

    try {
        return JSON.parse(storedUser);
    } catch (error) {
        console.error("Unable to read stored user information:", error);
        return null;
    }
}

function setCurrentUser(user) {
    if (!user || typeof user !== "object") {
        throw new Error("Valid user information is required.");
    }

    sessionStorage.setItem("user", JSON.stringify(user));
}

function removeCurrentUser() {
    sessionStorage.removeItem("user");
}



class APIError extends Error {

    constructor(message, status, data = null) {
        super(message);

        this.name = "APIError";
        this.status = status;
        this.data = data;
    }
}



async function apiRequest(endpoint, options = {}) {

    const token = getAuthToken();

    const headers = {
        ...(options.headers || {})
    };

    const requestOptions = {
        ...options,
        headers
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    if (
        requestOptions.body &&
        typeof requestOptions.body === "object" &&
        !(requestOptions.body instanceof FormData) &&
        !(requestOptions.body instanceof Blob)
    ) {
        headers["Content-Type"] = "application/json";

        requestOptions.body = JSON.stringify(
            requestOptions.body
        );
    }

    if (requestOptions.body instanceof FormData) {
        delete headers["Content-Type"];
    }

    const url = endpoint.startsWith("http")
        ? endpoint
        : `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    let response;

    try {
        response = await fetch(url, requestOptions);

    } catch (error) {
        console.error("Backend connection failed:", error);

        throw new APIError(
            "Unable to connect to the Smart Matatu server. Check whether the backend is running.",
            0
        );
    }

    const contentType = response.headers.get("content-type") || "";

    let responseData = null;

    if (contentType.includes("application/json")) {
        try {
            responseData = await response.json();
        } catch (error) {
            responseData = null;
        }

    } else {
        try {
            responseData = await response.text();
        } catch (error) {
            responseData = null;
        }
    }

    if (!response.ok) {

        const message =
            responseData?.message ||
            responseData?.error ||
            `Request failed with status ${response.status}.`;

        if (
            response.status === 401 &&
            getAuthToken()
        ) {
            removeAuthToken();
            removeCurrentUser();

            const currentPage = window.location.pathname;

            if (
                currentPage.includes("/pages/") &&
                !currentPage.includes("login.html")
            ) {
                window.location.href = "login.html";
            }
        }

        throw new APIError(
            message,
            response.status,
            responseData
        );
    }

    return responseData;
}



async function getTransactions() {

    const response = await apiRequest(
        "/transactions",
        {
            method: "GET"
        }
    );

    return response?.transactions || [];
}


async function createTransaction(transactionData) {

    if (!transactionData || typeof transactionData !== "object") {
        throw new Error("Transaction information is required.");
    }

    return await apiRequest(
        "/transactions",
        {
            method: "POST",
            body: transactionData
        }
    );
}



async function getRoutes() {

    const response = await apiRequest(
        "/routes",
        {
            method: "GET"
        }
    );

    return response?.routes || [];
}


async function getRouteStages(routeId) {

    if (!routeId) {
        throw new Error("A valid route ID is required.");
    }

    const response = await apiRequest(
        `/routes/${encodeURIComponent(routeId)}/stages`,
        {
            method: "GET"
        }
    );

    return response?.stages || [];
}


async function updateRouteVerification(routeId, verificationStatus) {

    if (!routeId) {
        throw new Error("A valid route ID is required.");
    }

    const allowedStatuses = [
        "approved",
        "rejected",
        "pending"
    ];

    const status = String(verificationStatus)
        .trim()
        .toLowerCase();

    if (!allowedStatuses.includes(status)) {
        throw new Error(
            "Verification status must be approved, rejected or pending."
        );
    }

    return await apiRequest(
        `/routes/${encodeURIComponent(routeId)}/verification`,
        {
            method: "PATCH",
            body: {
                verification_status: status
            }
        }
    );
}


async function getMyProfile() {

    return await apiRequest(
        "/users/me",
        {
            method: "GET"
        }
    );
}


async function updateMyProfile(profileData) {

    return await apiRequest(
        "/users/me",
        {
            method: "PATCH",
            body: profileData
        }
    );
}


async function getUsers() {

    const response = await apiRequest(
        "/users",
        {
            method: "GET"
        }
    );

    return response?.users || [];
}


async function updateUserStatus(userId, status) {

    if (!userId || !status) {
        throw new Error("User ID and account status are required.");
    }

    return await apiRequest(
        `/users/${encodeURIComponent(userId)}/status`,
        {
            method: "PATCH",
            body: {
                status
            }
        }
    );
}


async function deleteUser(userId) {

    if (!userId) {
        throw new Error("A valid user ID is required.");
    }

    return await apiRequest(
        `/users/${encodeURIComponent(userId)}`,
        {
            method: "DELETE"
        }
    );
}


function formatMoney(amount) {

    const value = Number(amount);

    if (!Number.isFinite(value)) {
        return "KSh 0.00";
    }

    return new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: "KES",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}


function formatDate(dateValue) {

    if (!dateValue) {
        return "N/A";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "N/A";
    }

    return date.toLocaleDateString("en-KE", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}


function formatDateTime(dateValue) {

    if (!dateValue) {
        return "N/A";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "N/A";
    }

    return date.toLocaleString("en-KE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}



function showMessage(element, message, type = "info") {

    if (!element) {
        console.warn(message);
        return;
    }

    element.textContent = message;
    element.className = `auth-message ${type}`;
    element.style.display = "block";
}


function clearMessage(element) {

    if (!element) {
        return;
    }

    element.textContent = "";
    element.className = "";
    element.style.display = "none";
}


window.SmartMatatuAPI = {

    API_BASE,

    apiRequest,

    APIError,

    getAuthToken,
    setAuthToken,
    removeAuthToken,

    getCurrentUser,
    setCurrentUser,
    removeCurrentUser,

    getTransactions,
    createTransaction,

    getRoutes,
    getRouteStages,
    updateRouteVerification,

    getMyProfile,
    updateMyProfile,

    getUsers,
    updateUserStatus,
    deleteUser,

    formatMoney,
    formatDate,
    formatDateTime,

    showMessage,
    clearMessage

};



console.log("Smart Matatu API module loaded successfully.");
console.log("Backend API:", API_BASE);