console.log("Smart Matatu frontend script loaded.");

const fareInput = document.getElementById("fare");
const passengersInput = document.getElementById("passengers");
const totalFareEl = document.getElementById("total-fare");

const transactionIdEl = document.getElementById("transaction-id");
const receiptAmountEl = document.getElementById("receipt-amount");
const receiptMethodEl = document.getElementById("receipt-method");
const confirmButtonEl = document.getElementById("confirm-button");

const paymentButtons = document.querySelectorAll(".payment-button");
const paymentresultEl = document.getElementById("payment-result");
const transactionListEl = document.getElementById("transaction-list");
const transactionSearch = document.getElementById("transaction-search");
const totalRevenueEl = document.getElementById("total-revenue");
const totalTransactionsEl = document.getElementById("total-transactions");
const totalpassengersEl = document.getElementById("total-passengers");
const transactionMessageEl = document.getElementById("transaction-message");
const averageFareEl = document.getElementById("average-fare");
const paymentFilter = document.getElementById("payment-filter");

const kpiTotalRevenue = document.getElementById("kpi-total-revenue");
const kpiTotalTransactions = document.getElementById("kpi-total-transactions");
const kpiTotalPassengers = document.getElementById("kpi-total-passengers");
const kpiAverageFare = document.getElementById("kpi-average-fare");
const kpiMpesa = document.getElementById("kpi-mpesa");
const kpiCash = document.getElementById("kpi-cash");
const kpiUssd = document.getElementById("kpi-ussd");

const API_URL = "http://localhost:3000/api/transactions";
const STORAGE_KEY = "smartMatatuTransactions";

const LOGIN_URL = "http://localhost:3000/api/auth/login";
const USERS_URL = "http://localhost:3000/api/users";

const loginForm = document.getElementById("login-form");
const loginUsername = document.getElementById("login-username");
const loginPassword = document.getElementById("login-password");
const loginMessage = document.getElementById("login-message");
const loginButton = document.getElementById("login-button");

const loginSection = document.getElementById("login-section");
const dashboardSection = document.getElementById("dashboard-section");
const logoutButton = document.getElementById("logout-button");

const createUserForm = document.getElementById("create-user-form");
const newUsernameInput = document.getElementById("new-username");
const newPasswordInput = document.getElementById("new-password");
const newUserRoleSelect = document.getElementById("new-user-role");
const createUserButton = document.getElementById("create-user-button");
const createUserMessage = document.getElementById("create-user-message");
const userManagementSection = document.getElementById("user-management");
const userManagementLink = document.querySelector('.sidebar-nav a[href="#user-management"]');

const routeSelect = document.getElementById("route-select");
const boardingStageSelect = document.getElementById("boarding-stage");
const alightingStageSelect = document.getElementById("alighting-stage");

let selectedpaymentMethod = null;
let isSubmittingPayment = false;


// ==========================================
// AUTHENTICATED USER AND ROLE MANAGEMENT
// ==========================================

function getAuthenticatedUser() {
    try {
        return JSON.parse(sessionStorage.getItem("authUser") || "null");
    } catch (error) {
        console.error("Could not read authenticated user details:", error);
        return null;
    }
}

function updateRoleBasedInterface() {
    const user = getAuthenticatedUser();
    const isAdmin = Boolean(user && user.role === "admin");

    if (userManagementLink) {
        userManagementLink.hidden = !isAdmin;
    }

    if (userManagementSection) {
        userManagementSection.hidden = !isAdmin;
    }

    if (!isAdmin && createUserMessage) {
        createUserMessage.textContent = "";
    }
}


// ==========================================
// ROUTE MANAGEMENT
// ==========================================

async function loadRoutes() {
    const token = sessionStorage.getItem("authToken");

    if (!token) {
        console.warn("No authentication token. Cannot load routes.");
        return;
    }

    routeSelect.innerHTML = '<option value="">Loading routes...</option>';

    try {
        const response = await fetch("http://localhost:3000/api/routes", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok || data.status !== "success") {
            throw new Error(data.message || "Unable to load routes.");
        }

        routeSelect.innerHTML = '<option value="">Select a route</option>';

        const approvedRoutes = data.routes.filter(route =>
            route.status === "active" &&
            route.verification_status === "approved"
        );

        if (approvedRoutes.length === 0) {
            routeSelect.innerHTML =
                '<option value="">No approved routes available</option>';

            console.warn("No active, approved routes were found.");
            return;
        }

        approvedRoutes.forEach(route => {
            const option = document.createElement("option");

            option.value = route.id;
            option.textContent =
                `${route.route_code} - ${route.route_name}`;

            routeSelect.appendChild(option);
        });

    } catch (error) {
        console.error("Route loading error:", error);

        routeSelect.innerHTML =
            '<option value="">Failed to load routes</option>';
    }
}


routeSelect.addEventListener("change", async function () {
    const routeId = this.value;

    boardingStageSelect.innerHTML =
        '<option value="">Select boarding stage</option>';

    alightingStageSelect.innerHTML =
        '<option value="">Select alighting stage</option>';

    boardingStageSelect.disabled = true;
    alightingStageSelect.disabled = true;

    if (!routeId) return;

    const token = sessionStorage.getItem("authToken");

    try {
        const response = await fetch(
            `http://localhost:3000/api/routes/${routeId}/stages`,
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to load route stages.");
        }

        data.stages.forEach(stage => {
            const boardingOption = document.createElement("option");
            boardingOption.value = stage.id;
            boardingOption.textContent = stage.stop_name;

            const alightingOption = document.createElement("option");
            alightingOption.value = stage.id;
            alightingOption.textContent = stage.stop_name;

            boardingStageSelect.appendChild(boardingOption);
            alightingStageSelect.appendChild(alightingOption);
        });

        boardingStageSelect.disabled = false;
        alightingStageSelect.disabled = false;

    } catch (error) {
        console.error("Stage loading error:", error);
        alert(error.message);
    }
});



let transactions = [];
let revenueTrendChart = null;
let paymentMethodChart = null;
let routePerformanceChart = null;

try {
    const savedTransactions = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
    );

    if (Array.isArray(savedTransactions)) {
        transactions = savedTransactions;
    }

} catch (error) {
    console.error("Could not load local transactions:", error);
}


function getTodayPrefix() {
    const date = new Date();

    const year = String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `sm-${year}${month}${day}-`;
}

function getNextTransactionNumber() {
    const prefix = getTodayPrefix();
    let highestNumber = 0;

    transactions.forEach(function (transaction) {
        const id = String(transaction.id || "");

        if (id.startsWith(prefix)) {
            const suffix = id.slice(prefix.length);

            if (/^\d+$/.test(suffix)) {
                highestNumber = Math.max(
                    highestNumber,
                    Number(suffix)
                );
            }
        }
    });

    return highestNumber + 1;
}

function generateTransactionId() {
    const number = String(getNextTransactionNumber()).padStart(3, "0");

    return getTodayPrefix() + number;
}


function saveTransactions() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(transactions)
        );

    } catch (error) {
        console.error("Could not save transactions:", error);
    }
}



function getPaymentMethodName(method) {
    const names = {
        mpesa: "M-Pesa",
        cash: "Cash",
        ussd: "USSD",
        qr: "QR",
        card: "Card"
    };

    return names[method] || method || "Unknown";
}

function normalizePaymentMethod(method) {
    const value = String(method || "").trim().toLowerCase();

    const names = {
        "m-pesa": "mpesa",
        mpesa: "mpesa",
        cash: "cash",
        ussd: "ussd",
        qr: "qr",
        "qr code": "qr",
        card: "card"
    };

    return names[value] || value;
}


function calculateTotalFare() {
    if (!fareInput || !passengersInput || !totalFareEl) {
        return 0;
    }

    const fare = Number(fareInput.value) || 0;
    const passengers = Number(passengersInput.value) || 0;
    const totalFare = fare * passengers;

    totalFareEl.textContent = "KSh " + totalFare.toFixed(2);

    return totalFare;
}


if (fareInput) {
    fareInput.addEventListener("input", function () {
        if (Number(fareInput.value) < 0) {
            fareInput.value = "";
        }

        calculateTotalFare();
    });
}


if (passengersInput) {
    passengersInput.addEventListener("input", function () {
        const passengers = Number(passengersInput.value);

        if (passengers < 1) {
            passengersInput.value = "";
        }

        calculateTotalFare();
    });
}




function validateFare() {
    const fare = Number(fareInput?.value);

    if (!Number.isFinite(fare) || fare <= 0) {
        alert("Please enter a valid fare amount.");
        return false;
    }

    return true;
}

function validatePassengers() {
    const passengers = Number(passengersInput?.value);

    if (!Number.isInteger(passengers) || passengers < 1) {
        alert("Please enter a valid passenger count.");
        return false;
    }

    return true;
}

function validatePaymentMethod() {
    if (!selectedpaymentMethod) {
        alert("Please select a payment method.");
        return false;
    }

    return true;
}


paymentButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        paymentButtons.forEach(function (btn) {
            btn.classList.remove("selected");
        });

        button.classList.add("selected");

        selectedpaymentMethod = button.getAttribute("data-method");

        console.log("Selected payment method:", selectedpaymentMethod);

        const selectedEl = document.getElementById("selected-methods");

        if (selectedEl) {
            selectedEl.textContent =
                "Selected payment method: " +
                getPaymentMethodName(selectedpaymentMethod);
        }
    });
});



function createTransactionRow(transaction) {
    const row = document.createElement("tr");

    const processedAt = transaction.dateTime
        ? new Date(transaction.dateTime)
        : null;

    const hasValidDate =
        processedAt && !Number.isNaN(processedAt.getTime());

    const processedDate = hasValidDate
        ? processedAt.toLocaleDateString()
        : "N/A";

    const processedTime = hasValidDate
        ? processedAt.toLocaleTimeString()
        : "N/A";

    const values = [
        transaction.id || "N/A",
        "KSh " + Number(transaction.fare || 0).toFixed(2),
        transaction.passengers ?? 0,
        "KSh " + Number(transaction.total || 0).toFixed(2),
        transaction.paymentmethod || "N/A",
        transaction.status || "Paid",
        processedDate,
        processedTime
    ];

    values.forEach(function (value) {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        row.appendChild(cell);
    });

    return row;
}


function displayTransactions(list = transactions) {
    if (!transactionListEl) {
        return;
    }

    transactionListEl.replaceChildren();

    if (list.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 8;
        cell.textContent = "No transactions found.";
        cell.style.textAlign = "center";

        row.appendChild(cell);
        transactionListEl.appendChild(row);

        return;
    }

    list.forEach(function (transaction) {
        transactionListEl.appendChild(
            createTransactionRow(transaction)
        );
    });
}

function filterTransactions() {
    const selectedMethod = paymentFilter
        ? paymentFilter.value
        : "all";

    const searchText = transactionSearch
        ? transactionSearch.value.trim().toLowerCase()
        : "";

    const filteredTransactions = transactions.filter(function (transaction) {
        const transactionMethod = normalizePaymentMethod(
            transaction.paymentmethod
        );

        const matchesMethod =
            !selectedMethod ||
            selectedMethod.toLowerCase() === "all" ||
            transactionMethod === normalizePaymentMethod(selectedMethod);

        const searchableValues = [
            transaction.id,
            transaction.fare,
            transaction.passengers,
            transaction.total,
            transaction.paymentmethod,
            transaction.status,
            transaction.dateTime
        ];

        const matchesSearch = searchableValues.some(function (value) {
            return String(value ?? "").toLowerCase().includes(searchText);
        });

        return matchesMethod && matchesSearch;
    });

    displayTransactions(filteredTransactions);
}


if (transactionSearch) {
    transactionSearch.addEventListener("input", filterTransactions);
}

if (paymentFilter) {
    paymentFilter.addEventListener("change", filterTransactions);
}


function calculateRevenueByMethod(method) {
    return transactions.reduce(function (sum, transaction) {
        return normalizePaymentMethod(transaction.paymentmethod) ===
            normalizePaymentMethod(method)
            ? sum + Number(transaction.total || 0)
            : sum;
    }, 0);
}


function calculateTotalRevenue() {
    const totalRevenue = transactions.reduce(function (sum, transaction) {
        return sum + Number(transaction.total || 0);
    }, 0);

    if (totalRevenueEl) {
        totalRevenueEl.textContent = "KSh " + totalRevenue.toFixed(2);
    }
}


function calculateTotalTransactions() {
    if (totalTransactionsEl) {
        totalTransactionsEl.textContent = transactions.length;
    }
}


function calculateTotalPassengers() {
    const totalPassengers = transactions.reduce(function (sum, transaction) {
        return sum + Number(transaction.passengers || 0);
    }, 0);

    if (totalpassengersEl) {
        totalpassengersEl.textContent = totalPassengers;
    }
}


function calculateAverageFare() {
    if (!averageFareEl) {
        return;
    }

    const totalRevenue = transactions.reduce(function (sum, transaction) {
        return sum + Number(transaction.total || 0);
    }, 0);

    const totalPassengers = transactions.reduce(function (sum, transaction) {
        return sum + Number(transaction.passengers || 0);
    }, 0);

    const averageFare = totalPassengers > 0
        ? totalRevenue / totalPassengers
        : 0;

    averageFareEl.textContent = "KSh " + averageFare.toFixed(2);
}


function updateRevenueTrendChart() {
    const canvas = document.getElementById("revenue-trend-chart");

    if (!canvas) {
        console.warn("Revenue trend chart canvas was not found.");
        return;
    }

    if (typeof Chart === "undefined") {
        console.error("Chart.js is not available. Check the Chart.js script in index.html.");
        return;
    }

    const dailyRevenue = {};

    transactions.forEach(function (transaction) {
        const date = new Date(transaction.dateTime);

        if (isNaN(date.getTime())) return;

        const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Africa/Nairobi",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(date);

        const year = parts.find(p => p.type === "year").value;
        const month = parts.find(p => p.type === "month").value;
        const day = parts.find(p => p.type === "day").value;

        const dateKey = `${year}-${month}-${day}`;

        dailyRevenue[dateKey] =
            (dailyRevenue[dateKey] || 0) + Number(transaction.total || 0);
    });

    const dates = Object.keys(dailyRevenue).sort();

    const labels = dates.map(function (date) {
        return date;
    });

    const values = dates.map(function (date) {
        return dailyRevenue[date];
    });

    if (revenueTrendChart) {
        revenueTrendChart.data.labels = labels;
        revenueTrendChart.data.datasets[0].data = values;
        revenueTrendChart.update();
        return;
    }

    revenueTrendChart = new Chart(canvas, {
        type: "line",

        data: {
            labels: labels,

            datasets: [{
                label: "Daily Revenue (KSh)",
                data: values,
                borderColor: "#2563eb",
                backgroundColor: "rgba(37, 99, 235, 0.15)",
                fill: true,
                tension: 0.35
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    display: true
                }
            },

            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Revenue (KSh)"
                    }
                }
            }
        }
    });
}


function updateDashboardKPIs() {
    const totalRevenue = transactions.reduce(function (sum, transaction) {
        return sum + Number(transaction.total || 0);
    }, 0);

    const totalPassengers = transactions.reduce(function (sum, transaction) {
        return sum + Number(transaction.passengers || 0);
    }, 0);

    const averageFare = totalPassengers > 0
        ? totalRevenue / totalPassengers
        : 0;

    if (kpiTotalRevenue) {
        kpiTotalRevenue.textContent = "KSh " + totalRevenue.toFixed(2);
    }

    if (kpiTotalTransactions) {
        kpiTotalTransactions.textContent = transactions.length;
    }

    if (kpiTotalPassengers) {
        kpiTotalPassengers.textContent = totalPassengers;
    }

    if (kpiAverageFare) {
        kpiAverageFare.textContent = "KSh " + averageFare.toFixed(2);
    }

    if (kpiMpesa) {
        kpiMpesa.textContent =
            "KSh " + calculateRevenueByMethod("M-Pesa").toFixed(2);
    }

    if (kpiCash) {
        kpiCash.textContent =
            "KSh " + calculateRevenueByMethod("Cash").toFixed(2);
    }

    if (kpiUssd) {
        kpiUssd.textContent =
            "KSh " + calculateRevenueByMethod("USSD").toFixed(2);
    }
}


function updatePaymentMethodRevenue() {
    const methodMap = {
        "M-Pesa": document.getElementById("mpesa-revenue"),
        "Cash": document.getElementById("cash-revenue"),
        "USSD": document.getElementById("ussd-revenue")
    };

    Object.entries(methodMap).forEach(function ([method, element]) {
        if (!element) {
            return;
        }

        element.textContent =
            "KSh " + calculateRevenueByMethod(method).toFixed(2);
    });
}


function updateDashboardSummary() {
    calculateTotalRevenue();
    calculateTotalTransactions();
    calculateTotalPassengers();
    calculateAverageFare();
    updateDashboardKPIs();
    updatePaymentMethodRevenue();
}


function displayLatestTransaction(transaction) {
    if (!transaction) {
        return;
    }

    if (transactionIdEl) {
        transactionIdEl.textContent = transaction.id || "N/A";
    }

    if (receiptAmountEl) {
        receiptAmountEl.textContent =
            "KSh " + Number(transaction.total || 0).toFixed(2);
    }

    if (receiptMethodEl) {
        receiptMethodEl.textContent = transaction.paymentmethod || "N/A";
    }
}


function showTransactionConfirmation(transaction) {
    displayLatestTransaction(transaction);

    if (transactionMessageEl) {
        transactionMessageEl.textContent =
            "Transaction " + transaction.id +
            " has been successfully recorded.";
    }

    if (paymentresultEl) {
        paymentresultEl.hidden = false;
        paymentresultEl.style.display = "block";

        paymentresultEl.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    }
}


if (confirmButtonEl) {
    confirmButtonEl.addEventListener("click", async function (event) {
        event.preventDefault();

        if (isSubmittingPayment) {
            return;
        }

        if (
            !validateFare() ||
            !validatePassengers() ||
            !validatePaymentMethod()
        ) {
            return;
        }

        const fare = Number(fareInput.value);
        const passengers = Number(passengersInput.value);
        const total = fare * passengers;

        const newTransaction = {
            id: generateTransactionId(),
            fare: fare,
            passengers: passengers,
            total: total,
            paymentmethod: getPaymentMethodName(selectedpaymentMethod),
            status: "Paid",
            dateTime: new Date().toISOString()
        };

        isSubmittingPayment = true;
        confirmButtonEl.disabled = true;

        const originalButtonText = confirmButtonEl.textContent;
        confirmButtonEl.textContent = "Processing...";

        try {
            const token = sessionStorage.getItem("authToken");

            if (!token) {
                sessionStorage.removeItem("authToken");
                sessionStorage.removeItem("authUser");

                if (dashboardSection) dashboardSection.hidden = true;
                if (loginSection) loginSection.hidden = false;

                if (loginMessage) {
                    loginMessage.textContent =
                        "Your session has expired. Please log in again.";
                }

                return;
            }

            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(newTransaction)
            });

            if (response.status === 401 || response.status === 403) {
                sessionStorage.removeItem("authToken");
                sessionStorage.removeItem("authUser");

                updateRoleBasedInterface();

                if (dashboardSection) dashboardSection.hidden = true;
                if (loginSection) loginSection.hidden = false;

                if (loginMessage) {
                    loginMessage.textContent =
                        "Your session has expired. Please log in again.";
                }

                console.warn(
                    "Transaction rejected: authentication failed."
                );

                return;
            }

            const data = await response.json();

            if (
                !response.ok ||
                data.status !== "success" ||
                !data.transaction
            ) {
                throw new Error(
                    data.message || "The backend rejected the transaction."
                );
            }

            const savedTransaction = data.transaction;

            const existingIndex = transactions.findIndex(function (item) {
                return item.id === savedTransaction.id;
            });

            if (existingIndex === -1) {
                transactions.push(savedTransaction);
            } else {
                transactions[existingIndex] = savedTransaction;
            }

            saveTransactions();
            displayTransactions();
            updateDashboardSummary();
            initializeDashboardCharts();

            showTransactionConfirmation(savedTransaction);

            console.log(
                "Transaction saved by backend:",
                savedTransaction
            );

            fareInput.value = "";
            passengersInput.value = "";

            calculateTotalFare();

            selectedpaymentMethod = null;

            paymentButtons.forEach(function (button) {
                button.classList.remove("selected");
            });

            const selectedEl = document.getElementById("selected-methods");

            if (selectedEl) {
                selectedEl.textContent = "";
            }

        } catch (error) {
            console.error("Payment submission failed:", error);

            if (transactionMessageEl) {
                transactionMessageEl.textContent =
                    "Transaction was not confirmed: " + error.message;
            } else {
                alert(
                    "Transaction was not confirmed. Check that the backend is running."
                );
            }

        } finally {
            isSubmittingPayment = false;
            confirmButtonEl.disabled = false;
            confirmButtonEl.textContent = originalButtonText;
        }
    });
}


async function loadTransactionsFromBackend() {
    try {
        const token = sessionStorage.getItem("authToken");

        if (!token) {
            sessionStorage.removeItem("authUser");

            if (dashboardSection) dashboardSection.hidden = true;
            if (loginSection) loginSection.hidden = false;

            if (loginMessage) {
                loginMessage.textContent =
                    "Your session has expired. Please log in again.";
            }

            return;
        }

        const response = await fetch(API_URL, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            sessionStorage.removeItem("authToken");
            sessionStorage.removeItem("authUser");

            updateRoleBasedInterface();

            if (dashboardSection) dashboardSection.hidden = true;
            if (loginSection) loginSection.hidden = false;

            if (loginMessage) {
                loginMessage.textContent =
                    "Your session has expired. Please log in again.";
            }

            console.warn(
                "Session expired or authentication rejected."
            );

            return;
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Could not load backend transactions."
            );
        }

        if (
            data.status !== "success" ||
            !Array.isArray(data.transactions)
        ) {
            throw new Error("Unexpected backend response.");
        }

        transactions = data.transactions;

        saveTransactions();
        displayTransactions();
        updateDashboardSummary();
        initializeDashboardCharts();

        console.log(
            "Transactions loaded from backend:",
            data.count
        );

    } catch (error) {
        console.error(
            "Could not load backend transactions:",
            error
        );

        console.warn(
            "Backend unavailable. Transaction data was not refreshed."
        );
    }
}


function initializePaymentMethodChart() {
    const canvas = document.getElementById("payment-method-chart");

    if (!canvas) {
        console.warn("Payment method chart canvas was not found.");
        return;
    }

    if (typeof Chart === "undefined") {
        console.error("Chart.js is not available. Check the Chart.js script in index.html.");
        return;
    }

    const methodRevenue = {
        mpesa: 0,
        cash: 0,
        ussd: 0
    };

    transactions.forEach(function (transaction) {
        const method = normalizePaymentMethod(transaction.paymentmethod);

        if (Object.prototype.hasOwnProperty.call(methodRevenue, method)) {
            methodRevenue[method] += Number(transaction.total || 0);
        }
    });

    if (paymentMethodChart) {
        paymentMethodChart.destroy();
    }

    paymentMethodChart = new Chart(canvas, {
        type: "doughnut",

        data: {
            labels: ["M-Pesa", "Cash", "USSD"],

            datasets: [{
                label: "Revenue (KSh)",
                data: [
                    methodRevenue.mpesa,
                    methodRevenue.cash,
                    methodRevenue.ussd
                ],
                backgroundColor: [
                    "#16a34a",
                    "#2563eb",
                    "#f59e0b"
                ],
                borderWidth: 2
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });

    console.log("Payment method chart initialized.", methodRevenue);
}


function initializeRoutePerformanceChart() {
    const canvas = document.getElementById("route-performance-chart");

    if (!canvas) {
        console.warn("Route performance chart canvas was not found.");
        return;
    }

    if (typeof Chart === "undefined") {
        console.error("Chart.js is not available. Check the Chart.js script in index.html.");
        return;
    }

    const routeCounts = new Map();

    transactions.forEach(function (transaction) {
        const routeLabel = transaction.route_name ||
            transaction.route_code ||
            (transaction.route_id
                ? `Route ${transaction.route_id}`
                : "Unassigned");

        routeCounts.set(
            routeLabel,
            (routeCounts.get(routeLabel) || 0) + 1
        );
    });

    const sortedRoutes = Array.from(routeCounts.entries())
        .sort((a, b) => b[1] - a[1]);

    if (routePerformanceChart) {
        routePerformanceChart.destroy();
    }

    routePerformanceChart = new Chart(canvas, {
        type: "bar",

        data: {
            labels: sortedRoutes.map(item => item[0]),

            datasets: [{
                label: "Transactions",
                data: sortedRoutes.map(item => item[1]),
                backgroundColor: "#0f766e",
                borderRadius: 5
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: sortedRoutes.length > 5 ? "y" : "x",

            plugins: {
                legend: {
                    display: false
                }
            },

            scales: {
                y: {
                    beginAtZero: true,

                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });

    console.log(
        "Route performance chart initialized.",
        Object.fromEntries(routeCounts)
    );
}


function initializeDashboardCharts() {
    if (typeof Chart === "undefined") {
        console.error(
            "Chart.js has not loaded. Check your internet connection and the Chart.js CDN script in index.html."
        );

        return;
    }


    requestAnimationFrame(function () {
        updateRevenueTrendChart();
        initializePaymentMethodChart();
        initializeRoutePerformanceChart();

        if (revenueTrendChart) {
            revenueTrendChart.resize();
        }

        if (paymentMethodChart) {
            paymentMethodChart.resize();
        }

        if (routePerformanceChart) {
            routePerformanceChart.resize();
        }
    });
}


if (createUserForm) {
    createUserForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const username = newUsernameInput.value.trim();
        const password = newPasswordInput.value;
        const role = newUserRoleSelect.value;
        const token = sessionStorage.getItem("authToken");

        createUserMessage.textContent = "";

        if (!token) {
            createUserMessage.textContent =
                "Your session has expired. Please log in again.";
            return;
        }

        if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
            createUserMessage.textContent =
                "Username must be 3–30 characters and use only letters, numbers, dots, underscores or hyphens.";
            return;
        }

        if (password.length < 12) {
            createUserMessage.textContent =
                "Temporary password must contain at least 12 characters.";
            return;
        }

        if (!["conductor", "sacco_manager"].includes(role)) {
            createUserMessage.textContent =
                "Select either Conductor or SACCO Manager.";
            return;
        }

        createUserButton.disabled = true;
        createUserButton.textContent = "Creating account...";

        try {
            const response = await fetch(USERS_URL, {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },

                body: JSON.stringify({ username, password, role })
            });

            const data = await response.json();

            if (response.status === 401) {
                sessionStorage.removeItem("authToken");
                sessionStorage.removeItem("authUser");

                updateRoleBasedInterface();

                if (dashboardSection) dashboardSection.hidden = true;
                if (loginSection) loginSection.hidden = false;

                if (loginMessage) {
                    loginMessage.textContent =
                        "Your session has expired. Please log in again.";
                }

                return;
            }

            if (response.status === 403) {
                createUserMessage.textContent =
                    data.message || "Only administrators can create user accounts.";

                updateRoleBasedInterface();
                return;
            }

            if (!response.ok || data.status !== "success") {
                throw new Error(
                    data.message || "Could not create the user account."
                );
            }

            createUserMessage.textContent =
                `Account created successfully for ${data.user.username} (${data.user.role}).`;

            createUserMessage.setAttribute("role", "status");
            createUserForm.reset();

            console.log("User account created:", data.user);

        } catch (error) {
            console.error("User creation failed:", error);

            createUserMessage.textContent = error.message;
            createUserMessage.setAttribute("role", "alert");

        } finally {
            createUserButton.disabled = false;
            createUserButton.textContent = "Create Account";
        }
    });
}


if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        console.log("Login Event detected.");

        const username = loginUsername.value.trim();
        const password = loginPassword.value;

        if (!username || !password) {
            loginMessage.textContent =
                "Enter your username and password.";
            return;
        }

        loginButton.disabled = true;
        loginButton.textContent = "Authenticating...";
        loginMessage.textContent = "";

        try {
            const response = await fetch(LOGIN_URL, {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            const data = await response.json();

            if (!response.ok || data.status !== "success" || !data.token) {
                throw new Error(data.message || "Login failed.");
            }

            sessionStorage.setItem("authToken", data.token);

            if (data.user) {
                sessionStorage.setItem(
                    "authUser",
                    JSON.stringify(data.user)
                );
            }

            updateRoleBasedInterface();

            loginSection.hidden = true;
            dashboardSection.hidden = false;

            loginPassword.value = "";

            console.log("Login successful.");

            await loadTransactionsFromBackend();
            await loadRoutes();

            initializeDashboardCharts();

        } catch (error) {
            console.error("Login error:", error);

            loginMessage.textContent = error.message;

        } finally {
            loginButton.disabled = false;
            loginButton.textContent = "Login";
        }
    });
}


async function initializeSmartMatatu() {
    calculateTotalFare();

    const token = sessionStorage.getItem("authToken");

    if (!token) {
        sessionStorage.removeItem("authUser");

        updateRoleBasedInterface();

        if (dashboardSection) dashboardSection.hidden = true;
        if (loginSection) loginSection.hidden = false;

        return;
    }

    if (dashboardSection) dashboardSection.hidden = true;
    if (loginSection) loginSection.hidden = true;

    try {
        const response = await fetch(API_URL, {
            method: "GET",

            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (
            !response.ok ||
            data.status !== "success" ||
            !Array.isArray(data.transactions)
        ) {
            throw new Error(data.message || "Session validation failed.");
        }

        transactions = data.transactions;

        saveTransactions();
        displayTransactions();
        updateDashboardSummary();
        updateRoleBasedInterface();

        if (dashboardSection) dashboardSection.hidden = false;
        if (loginSection) loginSection.hidden = true;

        initializeDashboardCharts();

        console.log("Existing session restored successfully.");

    } catch (error) {
        console.error("Session restoration failed:", error);

        sessionStorage.removeItem("authToken");
        sessionStorage.removeItem("authUser");

        updateRoleBasedInterface();

        if (dashboardSection) dashboardSection.hidden = true;
        if (loginSection) loginSection.hidden = false;

        if (loginMessage) {
            loginMessage.textContent =
                "Your session has expired. Please log in again.";
        }
    }
}


if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeSmartMatatu,
        { once: true }
    );

} else {
    initializeSmartMatatu();
}


if (logoutButton) {
    logoutButton.addEventListener("click", function () {
        sessionStorage.removeItem("authToken");
        sessionStorage.removeItem("authUser");

        updateRoleBasedInterface();

        if (dashboardSection) {
            dashboardSection.hidden = true;
        }

        if (loginSection) {
            loginSection.hidden = false;
        }

        if (loginUsername) {
            loginUsername.value = "";
        }

        if (loginPassword) {
            loginPassword.value = "";
        }

        if (loginMessage) {
            loginMessage.textContent =
                "You have successfully logged out.";
        }

        console.log("User logged out successfully.");
    });
}


const sidebarLinks = document.querySelectorAll(
    ".sidebar-nav a"
);

sidebarLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
        const targetId = link.getAttribute("href");

        if (!targetId || !targetId.startsWith("#")) {
            return;
        }

        const targetSection = document.querySelector(targetId);

        if (!targetSection) {
            event.preventDefault();

            console.log("This dashboard section is not available yet.");
            return;
        }

        sidebarLinks.forEach(function (item) {
            item.classList.remove("active");
        });

        link.classList.add("active");

        targetSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });
});


console.log("Smart Matatu frontend ready.");