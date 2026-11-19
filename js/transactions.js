"use strict";


(function () {
    const API = window.SmartMatatuAPI;

    if (!API) {
        console.error("SmartMatatuAPI is unavailable.");
        return;
    }

    let allTransactions = [];
    let filteredTransactions = [];

    const elements = {
        search: document.getElementById("transaction-search"),
        paymentFilter: document.getElementById("transaction-payment-filter"),
        statusFilter: document.getElementById("transaction-status-filter"),
        dateFrom: document.getElementById("transaction-date-from"),
        dateTo: document.getElementById("transaction-date-to"),

        applyFilters: document.getElementById("apply-transaction-filters"),
        clearFilters: document.getElementById("clear-transaction-filters"),
        refreshButton: document.getElementById("refresh-transactions"),

        message: document.getElementById("transaction-message"),

        tableBody: document.getElementById("transactions-table-body"),
        resultsCount: document.getElementById("transaction-results-count"),
        lastUpdated: document.getElementById("transactions-last-updated"),

        transactionCount: document.getElementById("transaction-count"),
        transactionRevenue: document.getElementById("transaction-revenue"),
        transactionPassengers: document.getElementById("transaction-passengers"),
        transactionAverage: document.getElementById("transaction-average")
    };



    function getValue(transaction, keys, fallback = "") {
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

    function getTransactionId(transaction) {
        return getValue(
            transaction,
            ["id", "transaction_id", "transactionId"],
            "N/A"
        );
    }

    function getRoute(transaction) {
        return String(
            getValue(
                transaction,
                ["route_name", "routeName", "route_code", "route", "route_id"],
                "Unassigned"
            )
        );
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

    function getTotal(transaction) {
        return Number(
            getValue(transaction, ["total", "amount", "total_amount"], 0)
        ) || 0;
    }

    function getPaymentMethod(transaction) {
        return String(
            getValue(
                transaction,
                ["paymentmethod", "payment_method", "paymentMethod"],
                "Unknown"
            )
        );
    }

    function getStatus(transaction) {
        return String(
            getValue(transaction, ["status", "payment_status"], "Unknown")
        );
    }

    function getDate(transaction) {
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

    function isPaid(transaction) {
        return getStatus(transaction).toLowerCase() === "paid";
    }

    function formatCurrency(amount) {
        return API.formatMoney(Number(amount) || 0);
    }

    function formatTransactionDate(transaction) {
        const date = getDate(transaction);

        return date ? API.formatDateTime(date) : "N/A";
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

   

    function updateStatistics(transactions) {
        const paidTransactions = transactions.filter(isPaid);

        const totalRevenue = paidTransactions.reduce(
            (sum, transaction) => sum + getTotal(transaction),
            0
        );

        const totalPassengers = paidTransactions.reduce(
            (sum, transaction) => sum + getPassengers(transaction),
            0
        );

        const transactionCount = paidTransactions.length;

        const averageTransaction = transactionCount > 0
            ? totalRevenue / transactionCount
            : 0;

        if (elements.transactionCount) {
            elements.transactionCount.textContent =
                transactions.length.toLocaleString();
        }

        if (elements.transactionRevenue) {
            elements.transactionRevenue.textContent =
                formatCurrency(totalRevenue);
        }

        if (elements.transactionPassengers) {
            elements.transactionPassengers.textContent =
                totalPassengers.toLocaleString();
        }

        if (elements.transactionAverage) {
            elements.transactionAverage.textContent =
                formatCurrency(averageTransaction);
        }
    }

    
    function normalize(value) {
        return String(value || "").trim().toLowerCase();
    }

    function matchesSearch(transaction, searchTerm) {
        if (!searchTerm) {
            return true;
        }

        const searchableValues = [
            getTransactionId(transaction),
            getRoute(transaction),
            getPaymentMethod(transaction),
            getStatus(transaction)
        ];

        return searchableValues.some(value =>
            normalize(value).includes(searchTerm)
        );
    }

    function matchesPaymentMethod(transaction, selectedMethod) {
        if (!selectedMethod) {
            return true;
        }

        return normalize(getPaymentMethod(transaction)) ===
            normalize(selectedMethod);
    }

    function matchesStatus(transaction, selectedStatus) {
        if (!selectedStatus) {
            return true;
        }

        return normalize(getStatus(transaction)) ===
            normalize(selectedStatus);
    }

    function matchesDateRange(transaction, startDate, endDate) {
        const transactionDate = getDate(transaction);

        if (!transactionDate) {
            return !startDate && !endDate;
        }

        if (startDate) {
            const start = new Date(startDate + "T00:00:00");

            if (transactionDate < start) {
                return false;
            }
        }

        if (endDate) {
            const end = new Date(endDate + "T23:59:59.999");

            if (transactionDate > end) {
                return false;
            }
        }

        return true;
    }

    function applyFilters() {
        const searchTerm = normalize(elements.search?.value);
        const selectedMethod = elements.paymentFilter?.value || "";
        const selectedStatus = elements.statusFilter?.value || "";
        const startDate = elements.dateFrom?.value || "";
        const endDate = elements.dateTo?.value || "";

        if (startDate && endDate && startDate > endDate) {
            showMessage(
                "The start date cannot be later than the end date.",
                "error"
            );

            return;
        }

        filteredTransactions = allTransactions.filter(transaction => {
            return (
                matchesSearch(transaction, searchTerm) &&
                matchesPaymentMethod(transaction, selectedMethod) &&
                matchesStatus(transaction, selectedStatus) &&
                matchesDateRange(transaction, startDate, endDate)
            );
        });

        clearMessage();

        renderTransactions(filteredTransactions);
        updateStatistics(filteredTransactions);
    }

    function clearFilters() {
        if (elements.search) {
            elements.search.value = "";
        }

        if (elements.paymentFilter) {
            elements.paymentFilter.value = "";
        }

        if (elements.statusFilter) {
            elements.statusFilter.value = "";
        }

        if (elements.dateFrom) {
            elements.dateFrom.value = "";
        }

        if (elements.dateTo) {
            elements.dateTo.value = "";
        }

        clearMessage();

        filteredTransactions = [...allTransactions];

        renderTransactions(filteredTransactions);
        updateStatistics(filteredTransactions);
    }

   
    function createTableCell(value) {
        const cell = document.createElement("td");
        cell.textContent = value;
        return cell;
    }

    function renderTransactions(transactions) {
        if (!elements.tableBody) {
            return;
        }

        elements.tableBody.innerHTML = "";

        const sortedTransactions = [...transactions].sort((a, b) => {
            const dateA = getDate(a);
            const dateB = getDate(b);

            return (dateB?.getTime() || 0) -
                (dateA?.getTime() || 0);
        });

        if (sortedTransactions.length === 0) {
            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state">
                        No transactions match your search or filters.
                    </td>
                </tr>
            `;

            if (elements.resultsCount) {
                elements.resultsCount.textContent =
                    "No matching transactions found.";
            }

            return;
        }

        sortedTransactions.forEach(transaction => {
            const row = document.createElement("tr");

            const values = [
                getTransactionId(transaction),
                getRoute(transaction),
                formatCurrency(getFare(transaction)),
                getPassengers(transaction).toLocaleString(),
                formatCurrency(getTotal(transaction)),
                getPaymentMethod(transaction),
                getStatus(transaction),
                formatTransactionDate(transaction)
            ];

            values.forEach((value, index) => {
                const cell = createTableCell(value);

                if (index === 6) {
                    cell.classList.add(
                        "status-" + normalize(value).replace(/\s+/g, "-")
                    );
                }

                row.appendChild(cell);
            });

            elements.tableBody.appendChild(row);
        });

        if (elements.resultsCount) {
            elements.resultsCount.textContent =
                `Showing ${sortedTransactions.length} of ${allTransactions.length} transactions`;
        }
    }

    
    async function loadTransactions() {
        clearMessage();

        if (elements.tableBody) {
            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state">
                        Loading transaction records...
                    </td>
                </tr>
            `;
        }

        if (elements.refreshButton) {
            elements.refreshButton.disabled = true;
            elements.refreshButton.textContent = "Loading...";
        }

        try {
            const response = await API.getTransactions();

            allTransactions = Array.isArray(response)
                ? response
                : [];

            filteredTransactions = [...allTransactions];

            renderTransactions(filteredTransactions);
            updateStatistics(filteredTransactions);

            if (elements.lastUpdated) {
                elements.lastUpdated.textContent =
                    "Last updated: " +
                    new Date().toLocaleString("en-KE");
            }

        } catch (error) {
            console.error("Transaction loading failed:", error);

            showMessage(
                error.message || "Unable to load transaction records.",
                "error"
            );

            if (elements.tableBody) {
                elements.tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="empty-state">
                            Unable to load transactions. Check your connection
                            and try refreshing.
                        </td>
                    </tr>
                `;
            }

        } finally {
            if (elements.refreshButton) {
                elements.refreshButton.disabled = false;
                elements.refreshButton.textContent = "Refresh Records";
            }
        }
    }

  

    function initializeEventListeners() {
        elements.applyFilters?.addEventListener(
            "click",
            applyFilters
        );

        elements.clearFilters?.addEventListener(
            "click",
            clearFilters
        );

        elements.refreshButton?.addEventListener(
            "click",
            loadTransactions
        );

        elements.search?.addEventListener("input", applyFilters);

        elements.paymentFilter?.addEventListener(
            "change",
            applyFilters
        );

        elements.statusFilter?.addEventListener(
            "change",
            applyFilters
        );

        elements.dateFrom?.addEventListener(
            "change",
            applyFilters
        );

        elements.dateTo?.addEventListener(
            "change",
            applyFilters
        );
    }


    function initializeTransactionsPage() {
        initializeEventListeners();
        loadTransactions();
    }

    document.addEventListener(
        "DOMContentLoaded",
        initializeTransactionsPage
    );

    window.SmartMatatuTransactions = {
        loadTransactions,
        applyFilters,
        clearFilters,
        getAllTransactions: () => [...allTransactions]
    };

})();