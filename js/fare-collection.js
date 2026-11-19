

(function () {
    const API = window.SmartMatatuAPI;

    if (!API) {
        console.error("SmartMatatuAPI is unavailable.");
        return;
    }

    const ALLOWED_PAYMENT_METHODS = [
        "M-Pesa",
        "Cash",
        "USSD"
    ];

    let availableRoutes = [];
    let availableStages = [];
    let isSubmittingPayment = false;

    let stageLoadRequestId = 0;

    const elements = {
        form: document.getElementById("fare-collection-form"),

        route: document.getElementById("route-select"),
        boardingStage: document.getElementById("boarding-stage"),
        alightingStage: document.getElementById("alighting-stage"),

        fare: document.getElementById("fare-amount"),
        passengers: document.getElementById("passenger-count"),

        calculatedTotal: document.getElementById("calculated-total"),

        paymentMethods: document.querySelectorAll(
            'input[name="payment_method"]'
        ),

        confirmButton: document.getElementById("confirm-payment"),
        clearButton: document.getElementById("clear-fare-form"),

        message: document.getElementById("fare-message"),

        summaryFare: document.getElementById("summary-fare"),
        summaryPassengers: document.getElementById("summary-passengers"),
        summaryPaymentMethod: document.getElementById("summary-payment-method"),
        summaryTotal: document.getElementById("summary-total"),

        recentTransactions: document.getElementById("fare-recent-transactions")
    };

    

    function formatCurrency(amount) {
        return API.formatMoney(Number(amount) || 0);
    }

    function getSelectedPaymentMethod() {
        const selected = document.querySelector(
            'input[name="payment_method"]:checked'
        );

        return selected ? selected.value : "";
    }

    function showFareMessage(message, type = "info") {
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

    function clearFareMessage() {
        if (!elements.message) {
            return;
        }

        elements.message.textContent = "";
        elements.message.className = "message-box";
    }

    function setSubmittingState(submitting) {
        if (!elements.confirmButton) {
            return;
        }

        elements.confirmButton.disabled = submitting;

        elements.confirmButton.textContent = submitting
            ? "Processing Payment..."
            : "Confirm Payment";
    }

    function getRouteId(route) {
        return route.id ?? route.route_id;
    }

    function getRouteLabel(route) {
        const code = route.route_code || "";
        const name = route.route_name || route.name || "";

        return [code, name].filter(Boolean).join(" - ") ||
            `Route ${getRouteId(route)}`;
    }

    function getStageId(stage) {
        return stage.id ?? stage.stage_id;
    }

    function getStageOrder(stage) {
        const order = Number(stage.stage_order);

        return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
    }

    function getStageName(stage) {
        return stage.stop_name ||
            stage.stage_name ||
            stage.name ||
            `Stage ${getStageId(stage)}`;
    }

    function isAllowedPaymentMethod(method) {
        return ALLOWED_PAYMENT_METHODS.includes(method);
    }


    function resetPaymentSummary() {
        if (elements.summaryFare) {
            elements.summaryFare.textContent = formatCurrency(0);
        }

        if (elements.summaryPassengers) {
            elements.summaryPassengers.textContent = "0";
        }

        if (elements.summaryPaymentMethod) {
            elements.summaryPaymentMethod.textContent = "Not selected";
        }

        if (elements.summaryTotal) {
            elements.summaryTotal.textContent = formatCurrency(0);
        }

        if (elements.calculatedTotal) {
            elements.calculatedTotal.textContent = formatCurrency(0);
        }
    }

    
    function calculateFare() {
        const fare = Number(elements.fare?.value || 0);
        const passengers = Number(elements.passengers?.value || 0);

        const validFare = Number.isFinite(fare) && fare > 0;

        const validPassengers =
            Number.isInteger(passengers) && passengers > 0;

        const total = validFare && validPassengers
            ? fare * passengers
            : 0;

        if (elements.calculatedTotal) {
            elements.calculatedTotal.textContent =
                formatCurrency(total);
        }

        if (elements.summaryFare) {
            elements.summaryFare.textContent =
                formatCurrency(validFare ? fare : 0);
        }

        if (elements.summaryPassengers) {
            elements.summaryPassengers.textContent =
                validPassengers ? passengers : 0;
        }

        if (elements.summaryPaymentMethod) {
            elements.summaryPaymentMethod.textContent =
                getSelectedPaymentMethod() || "Not selected";
        }

        if (elements.summaryTotal) {
            elements.summaryTotal.textContent =
                formatCurrency(total);
        }

        return total;
    }

    

    async function loadRoutes() {
        if (!elements.route) {
            return;
        }

        elements.route.innerHTML =
            '<option value="">Loading routes...</option>';

        availableRoutes = [];

        try {
            const routes = await API.getRoutes();

            
            availableRoutes = Array.isArray(routes)
                ? routes.filter(route =>
                    String(route.status || "").toLowerCase() === "active"
                )
                : [];

            elements.route.innerHTML =
                '<option value="">Select a route</option>';

            if (availableRoutes.length === 0) {
                elements.route.innerHTML =
                    '<option value="">No active routes available</option>';

                showFareMessage(
                    "There are currently no active routes available.",
                    "info"
                );

                return;
            }

            availableRoutes.forEach(route => {
                const option = document.createElement("option");

                option.value = getRouteId(route);
                option.textContent = getRouteLabel(route);

                elements.route.appendChild(option);
            });

            clearFareMessage();

        } catch (error) {
            console.error("Route loading failed:", error);

            elements.route.innerHTML =
                '<option value="">Unable to load routes</option>';

            showFareMessage(
                error.message || "Unable to load routes. Please try again.",
                "error"
            );
        }
    }

    
    function resetStageSelects() {
        if (elements.boardingStage) {
            elements.boardingStage.innerHTML =
                '<option value="">Select boarding stage</option>';

            elements.boardingStage.disabled = true;
        }

        if (elements.alightingStage) {
            elements.alightingStage.innerHTML =
                '<option value="">Select alighting stage</option>';

            elements.alightingStage.disabled = true;
        }

        availableStages = [];
    }

    async function loadStages(routeId) {
        const currentRequestId = ++stageLoadRequestId;

        resetStageSelects();

        if (!routeId) {
            return;
        }

        if (elements.boardingStage) {
            elements.boardingStage.innerHTML =
                '<option value="">Loading stages...</option>';
        }

        if (elements.alightingStage) {
            elements.alightingStage.innerHTML =
                '<option value="">Loading stages...</option>';
        }

        try {
            const stages = await API.getRouteStages(routeId);

        
            if (currentRequestId !== stageLoadRequestId) {
                return;
            }

            availableStages = Array.isArray(stages)
                ? stages
                    .filter(stage =>
                        getStageId(stage) !== undefined &&
                        getStageId(stage) !== null
                    )
                    .sort((a, b) =>
                        getStageOrder(a) - getStageOrder(b)
                    )
                : [];

            if (availableStages.length === 0) {
                resetStageSelects();

                showFareMessage(
                    "No stages have been configured for this route.",
                    "error"
                );

                return;
            }

            populateStageSelects();

            clearFareMessage();

        } catch (error) {
            if (currentRequestId !== stageLoadRequestId) {
                return;
            }

            console.error("Stage loading failed:", error);

            resetStageSelects();

            showFareMessage(
                error.message || "Unable to load route stages.",
                "error"
            );
        }
    }

    function populateStageSelects() {
        const selects = [
            {
                element: elements.boardingStage,
                placeholder: "Select boarding stage"
            },
            {
                element: elements.alightingStage,
                placeholder: "Select alighting stage"
            }
        ];

        selects.forEach(select => {
            if (!select.element) {
                return;
            }

            select.element.innerHTML = "";

            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = select.placeholder;

            select.element.appendChild(placeholder);

            availableStages.forEach(stage => {
                const option = document.createElement("option");

                option.value = getStageId(stage);
                option.textContent = getStageName(stage);

                select.element.appendChild(option);
            });

            select.element.disabled = false;
        });
    }

    
    function validateFare() {
        const fare = Number(elements.fare?.value);

        if (!Number.isFinite(fare) || fare <= 0) {
            showFareMessage(
                "Enter a valid fare greater than zero.",
                "error"
            );

            elements.fare?.focus();

            return false;
        }

        return true;
    }

    function validatePassengers() {
        const passengers = Number(elements.passengers?.value);

        if (
            !Number.isInteger(passengers) ||
            passengers <= 0
        ) {
            showFareMessage(
                "Enter a valid whole number of passengers.",
                "error"
            );

            elements.passengers?.focus();

            return false;
        }

        return true;
    }

    function validateRoute() {
        if (!elements.route?.value) {
            showFareMessage(
                "Please select a route.",
                "error"
            );

            elements.route?.focus();

            return false;
        }

        const selectedRoute = availableRoutes.find(
            route =>
                String(getRouteId(route)) === String(elements.route.value)
        );

        if (!selectedRoute) {
            showFareMessage(
                "The selected route is not available.",
                "error"
            );

            return false;
        }

        return true;
    }

    function validateStages() {
        const boardingId = elements.boardingStage?.value;
        const alightingId = elements.alightingStage?.value;

        if (!boardingId || !alightingId) {
            showFareMessage(
                "Select both boarding and alighting stages.",
                "error"
            );

            return false;
        }

        if (String(boardingId) === String(alightingId)) {
            showFareMessage(
                "Boarding and alighting stages cannot be the same.",
                "error"
            );

            return false;
        }

        const boardingStage = availableStages.find(
            stage =>
                String(getStageId(stage)) === String(boardingId)
        );

        const alightingStage = availableStages.find(
            stage =>
                String(getStageId(stage)) === String(alightingId)
        );

        if (!boardingStage || !alightingStage) {
            showFareMessage(
                "The selected stages are invalid for this route.",
                "error"
            );

            return false;
        }

        if (
            getStageOrder(boardingStage) >=
            getStageOrder(alightingStage)
        ) {
            showFareMessage(
                "The alighting stage must come after the boarding stage.",
                "error"
            );

            return false;
        }

        return true;
    }

    function validatePaymentMethod() {
        const paymentMethod = getSelectedPaymentMethod();

        if (!paymentMethod) {
            showFareMessage(
                "Please select a payment method.",
                "error"
            );

            return false;
        }

        if (!isAllowedPaymentMethod(paymentMethod)) {
            showFareMessage(
                "Invalid payment method. Select M-Pesa, Cash or USSD.",
                "error"
            );

            return false;
        }

        return true;
    }

    function validateForm() {
        if (!validateRoute()) {
            return false;
        }

        if (!validateStages()) {
            return false;
        }

        if (!validateFare()) {
            return false;
        }

        if (!validatePassengers()) {
            return false;
        }

        if (!validatePaymentMethod()) {
            return false;
        }

        return true;
    }

    
    function generateTransactionId() {
        const now = new Date();

        const year = String(now.getFullYear()).slice(-2);
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");

        const time =
            String(now.getHours()).padStart(2, "0") +
            String(now.getMinutes()).padStart(2, "0") +
            String(now.getSeconds()).padStart(2, "0");

        const random = Math.floor(100 + Math.random() * 900);

        return `SM-${year}${month}${day}-${time}-${random}`;
    }

   
    function getTransactionValue(transaction, keys, fallback = "") {
        for (const key of keys) {
            if (
                transaction[key] !== undefined &&
                transaction[key] !== null
            ) {
                return transaction[key];
            }
        }

        return fallback;
    }

    function renderRecentTransactions(transactions) {
        if (!elements.recentTransactions) {
            return;
        }

        elements.recentTransactions.innerHTML = "";

        const recent = [...transactions]
            .sort((a, b) => {
                const dateA = new Date(
                    getTransactionValue(
                        a,
                        ["dateTime", "date_time", "created_at"],
                        0
                    )
                ).getTime();

                const dateB = new Date(
                    getTransactionValue(
                        b,
                        ["dateTime", "date_time", "created_at"],
                        0
                    )
                ).getTime();

                return dateB - dateA;
            })
            .slice(0, 5);

        if (recent.length === 0) {
            elements.recentTransactions.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state">
                        No recent transactions found.
                    </td>
                </tr>
            `;

            return;
        }

        recent.forEach(transaction => {
            const row = document.createElement("tr");

            const values = [
                getTransactionValue(
                    transaction,
                    ["id", "transaction_id"],
                    "N/A"
                ),
                getTransactionValue(transaction, ["fare"], 0),
                getTransactionValue(transaction, ["passengers"], 0),
                getTransactionValue(transaction, ["total"], 0),
                getTransactionValue(
                    transaction,
                    ["paymentmethod", "payment_method", "paymentMethod"],
                    "N/A"
                ),
                getTransactionValue(transaction, ["status"], "Unknown"),
                getTransactionValue(
                    transaction,
                    ["dateTime", "date_time", "created_at"],
                    "N/A"
                )
            ];

            values.forEach((value, index) => {
                const cell = document.createElement("td");

                if (index === 1 || index === 3) {
                    cell.textContent = formatCurrency(value);

                } else if (index === 6 && value !== "N/A") {
                    cell.textContent = API.formatDateTime(value);

                } else {
                    cell.textContent = value;
                }

                row.appendChild(cell);
            });

            elements.recentTransactions.appendChild(row);
        });
    }

    async function refreshRecentTransactions() {
        try {
            const transactions = await API.getTransactions();

            renderRecentTransactions(
                Array.isArray(transactions) ? transactions : []
            );

        } catch (error) {
            console.error(
                "Recent transaction loading failed:",
                error
            );

            if (elements.recentTransactions) {
                elements.recentTransactions.innerHTML = `
                    <tr>
                        <td colspan="8" class="empty-state">
                            Unable to load recent transactions.
                        </td>
                    </tr>
                `;
            }
        }
    }



    async function submitPayment(event) {
        event.preventDefault();

        if (isSubmittingPayment) {
            return;
        }

        clearFareMessage();

        if (!validateForm()) {
            return;
        }

        const fare = Number(elements.fare.value);
        const passengers = Number(elements.passengers.value);
        const total = fare * passengers;

        const selectedRoute = availableRoutes.find(
            route =>
                String(getRouteId(route)) === String(elements.route.value)
        );

        const selectedBoardingStage = availableStages.find(
            stage =>
                String(getStageId(stage)) ===
                String(elements.boardingStage.value)
        );

        const selectedAlightingStage = availableStages.find(
            stage =>
                String(getStageId(stage)) ===
                String(elements.alightingStage.value)
        );

        if (
            !selectedRoute ||
            !selectedBoardingStage ||
            !selectedAlightingStage
        ) {
            showFareMessage(
                "The selected route or stages could not be verified.",
                "error"
            );

            return;
        }

        const transactionData = {
            id: generateTransactionId(),

            fare,
            passengers,
            total,

            paymentmethod: getSelectedPaymentMethod(),

            status: "Paid",

            dateTime: new Date().toISOString(),

            route_id: Number(getRouteId(selectedRoute)),

            boarding_stage_id: Number(
                getStageId(selectedBoardingStage)
            ),

            alighting_stage_id: Number(
                getStageId(selectedAlightingStage)
            )
        };

        isSubmittingPayment = true;
        setSubmittingState(true);

        try {
            const response = await API.createTransaction(transactionData);

            if (
                !response ||
                response.status !== "success"
            ) {
                throw new Error(
                    response?.message ||
                    "Transaction could not be completed."
                );
            }

            showFareMessage(
                response.duplicate
                    ? "This transaction was already recorded."
                    : "Payment recorded successfully. Transaction ID: " +
                      (response.transaction?.id || transactionData.id),
                response.duplicate ? "info" : "success"
            );

            if (!response.duplicate) {
                resetForm();
            }

            await refreshRecentTransactions();

        } catch (error) {
            console.error("Payment submission failed:", error);

            showFareMessage(
                error.message ||
                "Payment submission failed. Please try again.",
                "error"
            );

        } finally {
            isSubmittingPayment = false;
            setSubmittingState(false);
        }
    }

    
    function resetForm() {
        stageLoadRequestId++;

        elements.form?.reset();

        resetStageSelects();
        resetPaymentSummary();
        clearFareMessage();
    }


    function initializeEventListeners() {
        elements.fare?.addEventListener(
            "input",
            calculateFare
        );

        elements.passengers?.addEventListener(
            "input",
            calculateFare
        );

        elements.paymentMethods.forEach(input => {
            input.addEventListener(
                "change",
                calculateFare
            );
        });

        elements.route?.addEventListener("change", async () => {
            clearFareMessage();

            await loadStages(elements.route.value);
        });

        elements.form?.addEventListener(
            "submit",
            submitPayment
        );

        elements.clearButton?.addEventListener("click", () => {
            resetForm();
        });
    }


    async function initializeFareCollection() {
        resetStageSelects();
        resetPaymentSummary();

        initializeEventListeners();

        await loadRoutes();

        await refreshRecentTransactions();
    }

    document.addEventListener(
        "DOMContentLoaded",
        initializeFareCollection
    );

    window.SmartMatatuFareCollection = {
        loadRoutes,
        loadStages,
        calculateFare,
        refreshRecentTransactions
    };

})();