"use strict";

(function () {
    const API = window.SmartMatatuAPI;

    if (!API) {
        console.error("SmartMatatuAPI is unavailable.");
        return;
    }

    let allTransactions = [];
    let filteredTransactions = [];

    let revenueChart = null;
    let paymentChart = null;
    let routeChart = null;

    const elements = {
        period: document.getElementById("report-period"),
        dateFrom: document.getElementById("report-date-from"),
        dateTo: document.getElementById("report-date-to"),

        generateButton: document.getElementById("generate-report"),
        refreshButton: document.getElementById("refresh-reports"),

        message: document.getElementById("reports-message"),

        totalRevenue: document.getElementById("report-total-revenue"),
        totalTransactions: document.getElementById("report-total-transactions"),
        totalPassengers: document.getElementById("report-total-passengers"),
        averageFare: document.getElementById("report-average-fare"),

        revenueCanvas: document.getElementById("report-revenue-trend-chart"),
        paymentCanvas: document.getElementById("report-payment-method-chart"),
        routeCanvas: document.getElementById("report-route-chart"),

        paymentSummaryBody: document.getElementById("payment-summary-body"),
        routePerformanceBody: document.getElementById("route-performance-body"),

        lastUpdated: document.getElementById("reports-last-updated")
    };

   
    function getValue(transaction, keys, fallback = null) {
        for (const key of keys) {
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
        return String(
            getValue(
                transaction,
                ["paymentmethod", "payment_method", "paymentMethod"],
                "Other"
            )
        ).trim();
    }

    function getStatus(transaction) {
        return String(
            getValue(transaction, ["status", "payment_status"], "Unknown")
        ).trim();
    }

    function isPaid(transaction) {
        return getStatus(transaction).toLowerCase() === "paid";
    }

    function getTransactionDate(transaction) {
        const value = getValue(
            transaction,
            ["dateTime", "date_time", "created_at", "transaction_date", "date"],
            null
        );

        if (!value) {
            return null;
        }

        const date = new Date(value);

        return Number.isNaN(date.getTime()) ? null : date;
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

    function formatCurrency(amount) {
        return API.formatMoney(Number(amount) || 0);
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

    
    function toDateInputValue(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function getWeekStart(date) {
        const result = new Date(date);
        const day = result.getDay();

        const difference = day === 0 ? 6 : day - 1;

        result.setDate(result.getDate() - difference);
        result.setHours(0, 0, 0, 0);

        return result;
    }

    function setDatePeriod() {
        if (!elements.period) {
            return;
        }

        const period = elements.period.value;
        const today = new Date();

        const start = new Date(today);
        const end = new Date(today);

        switch (period) {
            case "today":
                break;

            case "week":
                start.setTime(getWeekStart(today).getTime());
                break;

            case "month":
                start.setDate(1);
                break;

            case "year":
                start.setMonth(0, 1);
                break;

            case "all":
                if (elements.dateFrom) {
                    elements.dateFrom.value = "";
                }

                if (elements.dateTo) {
                    elements.dateTo.value = "";
                }

                return;

            case "custom":
                return;

            default:
                return;
        }

        if (elements.dateFrom) {
            elements.dateFrom.value = toDateInputValue(start);
        }

        if (elements.dateTo) {
            elements.dateTo.value = toDateInputValue(end);
        }
    }

    function filterByDateRange(transactions) {
        const startValue = elements.dateFrom?.value || "";
        const endValue = elements.dateTo?.value || "";

        if (startValue && endValue && startValue > endValue) {
            throw new Error(
                "The report start date cannot be later than the end date."
            );
        }

        const start = startValue
            ? new Date(`${startValue}T00:00:00`)
            : null;

        const end = endValue
            ? new Date(`${endValue}T23:59:59.999`)
            : null;

        return transactions.filter(transaction => {
            const date = getTransactionDate(transaction);

            if (!date) {
                return false;
            }

            if (start && date < start) {
                return false;
            }

            if (end && date > end) {
                return false;
            }

            return true;
        });
    }



    function updateStatistics(transactions) {
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

        if (elements.totalRevenue) {
            elements.totalRevenue.textContent =
                formatCurrency(totalRevenue);
        }

        if (elements.totalTransactions) {
            elements.totalTransactions.textContent =
                totalTransactions.toLocaleString();
        }

        if (elements.totalPassengers) {
            elements.totalPassengers.textContent =
                totalPassengers.toLocaleString();
        }

        if (elements.averageFare) {
            elements.averageFare.textContent =
                formatCurrency(averageFare);
        }
    }



    function getRevenueByDate(transactions) {
        const grouped = {};

        transactions.filter(isPaid).forEach(transaction => {
            const date = getTransactionDate(transaction);

            if (!date) {
                return;
            }

            const key = toDateInputValue(date);

            grouped[key] = (grouped[key] || 0) + getAmount(transaction);
        });

        const sortedDates = Object.keys(grouped).sort();

        return {
            labels: sortedDates.map(date => {
                const parsed = new Date(`${date}T00:00:00`);

                return parsed.toLocaleDateString("en-KE", {
                    day: "2-digit",
                    month: "short"
                });
            }),

            values: sortedDates.map(date => grouped[date])
        };
    }

    function renderRevenueChart(transactions) {
        if (!elements.revenueCanvas || typeof Chart === "undefined") {
            console.warn("Revenue chart or Chart.js is unavailable.");
            return;
        }

        const data = getRevenueByDate(transactions);

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

    

    function getPaymentSummary(transactions) {
        const summary = {};

        transactions.filter(isPaid).forEach(transaction => {
            const method = getPaymentMethod(transaction);
            const key = method.toLowerCase();

            if (!summary[key]) {
                summary[key] = {
                    name: method,
                    transactions: 0,
                    passengers: 0,
                    revenue: 0
                };
            }

            summary[key].transactions += 1;
            summary[key].passengers += getPassengers(transaction);
            summary[key].revenue += getAmount(transaction);
        });

        return Object.values(summary);
    }

    function renderPaymentSummary(transactions) {
        if (!elements.paymentSummaryBody) {
            return;
        }

        elements.paymentSummaryBody.innerHTML = "";

        const summary = getPaymentSummary(transactions);

        const totalRevenue = summary.reduce(
            (sum, item) => sum + item.revenue,
            0
        );

        if (summary.length === 0) {
            elements.paymentSummaryBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        No paid transactions found for this period.
                    </td>
                </tr>
            `;

            return;
        }

        summary.forEach(item => {
            const percentage = totalRevenue > 0
                ? (item.revenue / totalRevenue) * 100
                : 0;

            const row = document.createElement("tr");

            [
                item.name,
                item.transactions.toLocaleString(),
                item.passengers.toLocaleString(),
                formatCurrency(item.revenue),
                `${percentage.toFixed(2)}%`
            ].forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            elements.paymentSummaryBody.appendChild(row);
        });
    }

    function renderPaymentChart(transactions) {
        if (!elements.paymentCanvas || typeof Chart === "undefined") {
            console.warn("Payment chart or Chart.js is unavailable.");
            return;
        }

        const summary = getPaymentSummary(transactions);

        if (paymentChart) {
            paymentChart.destroy();
        }

        paymentChart = new Chart(elements.paymentCanvas, {
            type: "doughnut",

            data: {
                labels: summary.map(item => item.name),

                datasets: [{
                    label: "Revenue",
                    data: summary.map(item => item.revenue)
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


    function getRouteSummary(transactions) {
        const summary = {};

        transactions.filter(isPaid).forEach(transaction => {
            const route = getRouteName(transaction);

            if (!summary[route]) {
                summary[route] = {
                    name: route,
                    transactions: 0,
                    passengers: 0,
                    revenue: 0
                };
            }

            summary[route].transactions += 1;
            summary[route].passengers += getPassengers(transaction);
            summary[route].revenue += getAmount(transaction);
        });

        return Object.values(summary).sort(
            (a, b) => b.revenue - a.revenue
        );
    }

    function renderRoutePerformance(transactions) {
        if (!elements.routePerformanceBody) {
            return;
        }

        elements.routePerformanceBody.innerHTML = "";

        const summary = getRouteSummary(transactions);

        if (summary.length === 0) {
            elements.routePerformanceBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        No route performance data available.
                    </td>
                </tr>
            `;

            return;
        }

        summary.forEach(item => {
            const averageFare = item.passengers > 0
                ? item.revenue / item.passengers
                : 0;

            const row = document.createElement("tr");

            [
                item.name,
                item.transactions.toLocaleString(),
                item.passengers.toLocaleString(),
                formatCurrency(item.revenue),
                formatCurrency(averageFare)
            ].forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            elements.routePerformanceBody.appendChild(row);
        });
    }

    function renderRouteChart(transactions) {
        if (!elements.routeCanvas || typeof Chart === "undefined") {
            console.warn("Route chart or Chart.js is unavailable.");
            return;
        }

        const summary = getRouteSummary(transactions);

        if (routeChart) {
            routeChart.destroy();
        }

        routeChart = new Chart(elements.routeCanvas, {
            type: "bar",

            data: {
                labels: summary.map(item => item.name),

                datasets: [{
                    label: "Transactions",
                    data: summary.map(item => item.transactions),
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



    function generateReport() {
        try {
            clearMessage();

            filteredTransactions = filterByDateRange(allTransactions);

            updateStatistics(filteredTransactions);

            renderRevenueChart(filteredTransactions);
            renderPaymentChart(filteredTransactions);
            renderRouteChart(filteredTransactions);

            renderPaymentSummary(filteredTransactions);
            renderRoutePerformance(filteredTransactions);

            if (elements.lastUpdated) {
                elements.lastUpdated.textContent =
                    "Last updated: " +
                    new Date().toLocaleString("en-KE");
            }

            showMessage(
                `Report generated successfully. ${filteredTransactions.length} transaction records found.`,
                "success"
            );

        } catch (error) {
            showMessage(error.message, "error");
        }
    }

    

    async function loadReportData() {
        try {
            clearMessage();

            const transactions = await API.getTransactions();

            allTransactions = Array.isArray(transactions)
                ? transactions
                : [];

            generateReport();

        } catch (error) {
            console.error("Report data loading failed:", error);

            showMessage(
                error.message || "Unable to load revenue report data.",
                "error"
            );
        }
    }

    

    function initializeEventListeners() {
        elements.period?.addEventListener("change", setDatePeriod);

        elements.generateButton?.addEventListener(
            "click",
            generateReport
        );

        elements.refreshButton?.addEventListener(
            "click",
            loadReportData
        );
    }


    function initializeReports() {
        initializeEventListeners();

        setDatePeriod();

        loadReportData();
    }

    document.addEventListener(
        "DOMContentLoaded",
        initializeReports
    );

    window.SmartMatatuReports = {
        loadReportData,
        generateReport,
        getTransactions: () => [...allTransactions]
    };

})();