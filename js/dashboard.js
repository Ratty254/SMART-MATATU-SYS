"use strict";


(function () {
    const API = window.SmartMatatuAPI;

    if (!API) {
        console.error("SmartMatatuAPI is not available.");
        return;
    }

    let revenueChart = null;
    let paymentChart = null;
    let routeChart = null;

    let allTransactions = [];

    const elements = {
        totalRevenue: document.getElementById("total-revenue"),
        totalTransactions: document.getElementById("total-transactions"),
        totalPassengers: document.getElementById("total-passengers"),
        averageFare: document.getElementById("average-fare"),

        mpesaRevenue: document.getElementById("mpesa-revenue"),
        cashRevenue: document.getElementById("cash-revenue"),
        ussdRevenue: document.getElementById("ussd-revenue"),
        otherRevenue: document.getElementById("other-revenue"),

        recentTransactionsBody: document.getElementById("recent-transactions-body"),
        lastUpdated: document.getElementById("dashboard-last-updated"),

        revenueCanvas: document.getElementById("revenue-trend-chart"),
        paymentCanvas: document.getElementById("payment-method-chart"),
        routeCanvas: document.getElementById("route-transactions-chart")
    };

    

    function getValue(transaction, possibleKeys, fallback = null) {
        for (const key of possibleKeys) {
            if (
                transaction[key] !== undefined &&
                transaction[key] !== null &&
                transaction[key] !== ""
            ) {
                return transaction[key];
            }
        }

        return fallback;
    }

    function getAmount(transaction) {
        return Number(
            getValue(transaction, ["total", "amount", "total_amount"], 0)
        ) || 0;
    }

    function getFare(transaction) {
        return Number(
            getValue(transaction, ["fare", "fare_amount"], 0)
        ) || 0;
    }

    function getPassengers(transaction) {
        return Number(
            getValue(transaction, ["passengers", "passenger_count"], 0)
        ) || 0;
    }

    function getPaymentMethod(transaction) {
        const method = String(
            getValue(
                transaction,
                ["paymentmethod", "payment_method", "paymentMethod"],
                "Other"
            )
        );

        return method.trim().toLowerCase();
    }

    function getDate(transaction) {
        const rawDate = getValue(
            transaction,
            ["dateTime", "date_time", "created_at", "transaction_date", "date"],
            null
        );

        if (!rawDate) {
            return null;
        }

        const date = new Date(rawDate);

        return Number.isNaN(date.getTime()) ? null : date;
    }

    function getTransactionId(transaction) {
        return getValue(
            transaction,
            ["id", "transaction_id", "transactionId"],
            "N/A"
        );
    }

    function getRouteName(transaction) {
        return String(
            getValue(
                transaction,
                ["route_name", "routeName", "route_code", "route", "route_id"],
                "Unassigned"
            )
        );
    }

    function getStatus(transaction) {
        return String(
            getValue(transaction, ["status", "payment_status"], "Unknown")
        );
    }

    function isPaid(transaction) {
        return getStatus(transaction).toLowerCase() === "paid";
    }

    function formatCurrency(amount) {
        return API.formatMoney(Number(amount) || 0);
    }

    function formatDate(date) {
        if (!date) {
            return "N/A";
        }

        return API.formatDateTime(date);
    }



    function showDashboardError(message) {
        console.error(message);

        if (typeof API.showMessage === "function") {
            const existingMessage = document.getElementById("dashboard-message");

            if (existingMessage) {
                API.showMessage("dashboard-message", message, "error");
            }
        }
    }

    
    function calculateDashboardStatistics(transactions) {
        const paidTransactions = transactions.filter(isPaid);

        const totalRevenue = paidTransactions.reduce(
            (sum, transaction) => sum + getAmount(transaction),
            0
        );

        const totalPassengers = paidTransactions.reduce(
            (sum, transaction) => sum + getPassengers(transaction),
            0
        );

        const totalTransactions = paidTransactions.length;

        const averageFare = totalPassengers > 0
            ? totalRevenue / totalPassengers
            : 0;

        return {
            totalRevenue,
            totalTransactions,
            totalPassengers,
            averageFare
        };
    }

    function updateDashboardStatistics(transactions) {
        const statistics = calculateDashboardStatistics(transactions);

        if (elements.totalRevenue) {
            elements.totalRevenue.textContent =
                formatCurrency(statistics.totalRevenue);
        }

        if (elements.totalTransactions) {
            elements.totalTransactions.textContent =
                statistics.totalTransactions.toLocaleString();
        }

        if (elements.totalPassengers) {
            elements.totalPassengers.textContent =
                statistics.totalPassengers.toLocaleString();
        }

        if (elements.averageFare) {
            elements.averageFare.textContent =
                formatCurrency(statistics.averageFare);
        }

        updatePaymentMethodStatistics(transactions);
    }

    

    function updatePaymentMethodStatistics(transactions) {
        const revenue = {
            mpesa: 0,
            cash: 0,
            ussd: 0,
            other: 0
        };

        transactions.filter(isPaid).forEach(transaction => {
            const amount = getAmount(transaction);
            const method = getPaymentMethod(transaction);

            if (method.includes("mpesa") || method.includes("m-pesa")) {
                revenue.mpesa += amount;
            } else if (method.includes("cash")) {
                revenue.cash += amount;
            } else if (method.includes("ussd")) {
                revenue.ussd += amount;
            } else {
                revenue.other += amount;
            }
        });

        if (elements.mpesaRevenue) {
            elements.mpesaRevenue.textContent =
                formatCurrency(revenue.mpesa);
        }

        if (elements.cashRevenue) {
            elements.cashRevenue.textContent =
                formatCurrency(revenue.cash);
        }

        if (elements.ussdRevenue) {
            elements.ussdRevenue.textContent =
                formatCurrency(revenue.ussd);
        }

        if (elements.otherRevenue) {
            elements.otherRevenue.textContent =
                formatCurrency(revenue.other);
        }
    }

    
    function renderRecentTransactions(transactions) {
        const tbody = elements.recentTransactionsBody;

        if (!tbody) {
            return;
        }

        tbody.innerHTML = "";

        const recentTransactions = [...transactions]
            .sort((a, b) => {
                const dateA = getDate(a);
                const dateB = getDate(b);

                return (dateB?.getTime() || 0) -
                    (dateA?.getTime() || 0);
            })
            .slice(0, 8);

        if (recentTransactions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state">
                        No transactions have been recorded yet.
                    </td>
                </tr>
            `;
            return;
        }

        recentTransactions.forEach(transaction => {
            const row = document.createElement("tr");

            const values = [
                getTransactionId(transaction),
                getRouteName(transaction),
                formatCurrency(getFare(transaction)),
                getPassengers(transaction),
                formatCurrency(getAmount(transaction)),
                getPaymentMethod(transaction),
                getStatus(transaction),
                formatDate(getDate(transaction))
            ];

            values.forEach((value, index) => {
                const cell = document.createElement("td");
                cell.textContent = value;

                if (index === 6) {
                    const status = String(value).toLowerCase();
                    cell.classList.add("status-" + status);
                }

                row.appendChild(cell);
            });

            tbody.appendChild(row);
        });
    }



    function groupRevenueByDate(transactions) {
        const grouped = {};

        transactions.filter(isPaid).forEach(transaction => {
            const date = getDate(transaction);

            if (!date) {
                return;
            }

            const label = date.toLocaleDateString("en-KE", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });

            grouped[label] = (grouped[label] || 0) + getAmount(transaction);
        });

        return {
            labels: Object.keys(grouped),
            values: Object.values(grouped)
        };
    }

    function renderRevenueChart(transactions) {
        if (!elements.revenueCanvas || typeof Chart === "undefined") {
            console.warn("Revenue chart canvas or Chart.js is unavailable.");
            return;
        }

        const data = groupRevenueByDate(transactions);

        if (revenueChart) {
            revenueChart.destroy();
        }

        revenueChart = new Chart(elements.revenueCanvas, {
            type: "line",

            data: {
                labels: data.labels,

                datasets: [{
                    label: "Revenue (KSh)",
                    data: data.values,
                    borderWidth: 3,
                    tension: 0.35,
                    fill: false
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
                        beginAtZero: true
                    }
                }
            }
        });
    }

    
    function renderPaymentChart(transactions) {
        if (!elements.paymentCanvas || typeof Chart === "undefined") {
            console.warn("Payment chart canvas or Chart.js is unavailable.");
            return;
        }

        const paymentTotals = {
            "M-Pesa": 0,
            "Cash": 0,
            "USSD": 0,
            "QR": 0,
            "Card": 0,
            "Other": 0
        };

        transactions.filter(isPaid).forEach(transaction => {
            const method = getPaymentMethod(transaction);
            const amount = getAmount(transaction);

            if (method.includes("mpesa") || method.includes("m-pesa")) {
                paymentTotals["M-Pesa"] += amount;
            } else if (method.includes("cash")) {
                paymentTotals["Cash"] += amount;
            } else if (method.includes("ussd")) {
                paymentTotals["USSD"] += amount;
            } else if (method.includes("qr")) {
                paymentTotals["QR"] += amount;
            } else if (method.includes("card")) {
                paymentTotals["Card"] += amount;
            } else {
                paymentTotals["Other"] += amount;
            }
        });

        if (paymentChart) {
            paymentChart.destroy();
        }

        paymentChart = new Chart(elements.paymentCanvas, {
            type: "doughnut",

            data: {
                labels: Object.keys(paymentTotals),

                datasets: [{
                    label: "Revenue",
                    data: Object.values(paymentTotals)
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
    }


    function renderRouteChart(transactions) {
        if (!elements.routeCanvas || typeof Chart === "undefined") {
            console.warn("Route chart canvas or Chart.js is unavailable.");
            return;
        }

        const routeTotals = {};

        transactions.filter(isPaid).forEach(transaction => {
            const route = getRouteName(transaction);

            routeTotals[route] = (routeTotals[route] || 0) + 1;
        });

        if (routeChart) {
            routeChart.destroy();
        }

        routeChart = new Chart(elements.routeCanvas, {
            type: "bar",

            data: {
                labels: Object.keys(routeTotals),

                datasets: [{
                    label: "Transactions",
                    data: Object.values(routeTotals),
                    borderWidth: 1
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

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
    }

    
    async function loadDashboard() {
        try {
            if (elements.recentTransactionsBody) {
                elements.recentTransactionsBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="empty-state">
                            Loading transactions...
                        </td>
                    </tr>
                `;
            }

            const transactions = await API.getTransactions();

            allTransactions = Array.isArray(transactions)
                ? transactions
                : [];

            updateDashboardStatistics(allTransactions);
            renderRecentTransactions(allTransactions);

            renderRevenueChart(allTransactions);
            renderPaymentChart(allTransactions);
            renderRouteChart(allTransactions);

            if (elements.lastUpdated) {
                elements.lastUpdated.textContent =
                    "Last updated: " + new Date().toLocaleString("en-KE");
            }

        } catch (error) {
            console.error("Dashboard loading failed:", error);

            showDashboardError(
                error.message || "Unable to load dashboard information."
            );

            if (elements.recentTransactionsBody) {
                elements.recentTransactionsBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="empty-state">
                            Unable to load transactions. Please refresh the page.
                        </td>
                    </tr>
                `;
            }
        }
    }

    
    function initializeDashboard() {
        const refreshButton = document.getElementById("refresh-dashboard");

        if (refreshButton) {
            refreshButton.addEventListener("click", loadDashboard);
        }

        loadDashboard();
    }

    document.addEventListener("DOMContentLoaded", initializeDashboard);

    window.SmartMatatuDashboard = {
        loadDashboard,
        getTransactions: () => [...allTransactions]
    };

})();