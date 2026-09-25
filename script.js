const fareInput = document.getElementById("fare");
const passengersInput = document.getElementById("passengers");
const totalFareEl = document.getElementById("total-fare");
const transactionIdEl = document.getElementById("transaction-id");
const receiptAmountEl = document.getElementById("receipt-amount");
const receiptMethodEl = document.getElementById("receipt-method");
const confirmButtonEl = document.getElementById("confirm-button");
const paymentButtons =
    document.querySelectorAll(".payment-button");
    const paymentresultEl = document.getElementById("payment-result");
    const transactionListEl = document.getElementById("transaction-list");
    const transactionSearch = document.getElementById("transaction-search");
    const totalRevenueEl = document.getElementById("total-revenue");
    const totalTransactionsEl = document.getElementById("total-transactions");
    const totalpassengersEl = document.getElementById("total-passengers");
    const transactionMessageEl = document.getElementById("transaction-message");
const averageFareEl = document.getElementById("average-fare");
const paymentFilter =
    document.getElementById("payment-filter");
const kpiTotalRevenue =
    document.getElementById("kpi-total-revenue");

const kpiTotalTransactions =
    document.getElementById("kpi-total-transactions");

const kpiTotalPassengers =
    document.getElementById("kpi-total-passengers");

const kpiAverageFare =
    document.getElementById("kpi-average-fare");

const kpiMpesa =
    document.getElementById("kpi-mpesa");

const kpiCash =
    document.getElementById("kpi-cash");

const kpiUssd =
    document.getElementById("kpi-ussd");


function updateDashboardKPIs() {

    const totalRevenue = transactions.reduce(function(sum, transaction) {
        return sum + transaction.total;
    }, 0);
    const totalPassengers = transactions.reduce(function(sum, transaction) {
        return sum + transaction.passengers;
    }, 0);
    const averageFare = totalPassengers > 0 ? totalRevenue / totalPassengers : 0;
    const revenueByMethod = {
        "M-Pesa": calculateRevenueByMethod("M-Pesa"),
        "Cash": calculateRevenueByMethod("Cash"),
        "USSD": calculateRevenueByMethod("USSD")
    };

    if (kpiTotalRevenue) kpiTotalRevenue.textContent = "KSh " + totalRevenue.toFixed(2);
    if (kpiTotalTransactions) kpiTotalTransactions.textContent = transactions.length;
    if (kpiTotalPassengers) kpiTotalPassengers.textContent = totalPassengers;
    if (kpiAverageFare) kpiAverageFare.textContent = "KSh " + averageFare.toFixed(2);
    if (kpiMpesa) kpiMpesa.textContent = "KSh " + revenueByMethod["M-Pesa"].toFixed(2);
    if (kpiCash) kpiCash.textContent = "KSh " + revenueByMethod.Cash.toFixed(2);
    if (kpiUssd) kpiUssd.textContent = "KSh " + revenueByMethod.USSD.toFixed(2);

}
let selectedpaymentMethod = null;
let transactionId = 1;
let transactions = JSON.parse(localStorage.getItem("smartMatatuTransactions") || "[]");

if (transactions.length > 0) {
    transactionId = transactions.length + 1;
}

function saveTransactions() {
    localStorage.setItem("smartMatatuTransactions", JSON.stringify(transactions));
}

function displayLatestTransaction() {
    const latestTransaction = transactions[transactions.length - 1];
    if (!latestTransaction) return;

    if (transactionIdEl) {
        transactionIdEl.textContent = latestTransaction.id;
    }
    if (transactionMessageEl) {
        transactionMessageEl.textContent = "Your payment has been successfully recorded.";
    }
    if (paymentresultEl) {
        paymentresultEl.style.display = "block";
    }
}

function getPaymentMethodName(method) {
    const names = {
        mpesa: "M-Pesa",
        cash: "Cash",
        ussd: "USSD"
    };
    return names[method] || method;
}

function displayTransactions() {
    if (!transactionListEl) return;

    transactionListEl.innerHTML = "";
    transactions.forEach(function(transaction) {
        transactionListEl.appendChild(createTransactionRow(transaction));
    });
}

function createTransactionRow(transaction) {
    const row = document.createElement("tr");
    const processedAt = transaction.dateTime ? new Date(transaction.dateTime) : null;
    const hasValidDate = processedAt && !Number.isNaN(processedAt.getTime());
    const processedDate = hasValidDate
        ? processedAt.toLocaleDateString()
        : "N/A";
    const processedTime = hasValidDate
        ? processedAt.toLocaleTimeString()
        : "N/A";

    row.innerHTML = `
        <td>${transaction.id}</td>
        <td>KSh ${Number(transaction.fare).toFixed(2)}</td>
        <td>${transaction.passengers}</td>
        <td>KSh ${Number(transaction.total).toFixed(2)}</td>
        <td>${transaction.paymentmethod}</td>
        <td>${transaction.status}</td>
        <td>${processedDate}</td>
        <td>${processedTime}</td>
    `;

    return row;
}

function searchTransactions() {
    const searchTerm = transactionSearch.value.trim().toLowerCase();
    const matchingTransactions = transactions.filter(function(transaction) {
        return [
            transaction.id,
            transaction.paymentmethod,
            transaction.status
        ].some(function(value) {
            return String(value).toLowerCase().includes(searchTerm);
        });
    });

    if (!transactionListEl) return;

    transactionListEl.innerHTML = "";
    matchingTransactions.forEach(function(transaction) {
        transactionListEl.appendChild(createTransactionRow(transaction));
    });
}

if (transactionSearch) {
    transactionSearch.addEventListener("input", searchTransactions);
}
function calculateRevenueByMethod(method) {
    let total = 0;

    transactions.forEach(function(transaction) {
        if (transaction.paymentmethod === method) {
            total += transaction.total;
        }
    });

    return total;
}
function filterTransactions() {

    const selectedMethod =
        paymentFilter.value;

    const searchText =
        transactionSearch.value.toLowerCase().trim();

    const filteredTransactions =
        transactions.filter(function(transaction) {

            const matchesMethod =
                selectedMethod === "all" ||
                transaction.method === selectedMethod;

            const matchesSearch =
                transaction.id.toLowerCase().includes(searchText) ||
                getPaymentMethodName(transaction.method)
                    .toLowerCase()
                    .includes(searchText);

            return matchesMethod && matchesSearch;
        });

    displayTransactions(filteredTransactions);
}

function calculateMpesaRevenue() {
    return calculateRevenueByMethod("M-Pesa");
}

function calculateCashRevenue() {
    return calculateRevenueByMethod("Cash");
}

function calculateUssdRevenue() {
    return calculateRevenueByMethod("USSD");
}

function updatePaymentMethodRevenue() {
    const methodMap = {
        "M-Pesa": document.getElementById("mpesa-revenue"),
        "Cash": document.getElementById("cash-revenue"),
        "USSD": document.getElementById("ussd-revenue")
    };

    Object.entries(methodMap).forEach(function([method, element]) {
        if (!element) return;
        element.textContent = "KSh " + calculateRevenueByMethod(method).toFixed(2);
    });
}

function calculateTotalRevenue() {

    let totalRevenue = 0;

    transactions.forEach(function(transaction) {
        totalRevenue += transaction.total;
    });

    if (totalRevenueEl) {
        totalRevenueEl.textContent = "KSh " + totalRevenue.toFixed(2);
    }
}

function generateTransactionId() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).toString().padStart(2, "0");
    const day = String(date.getDate()).toString().padStart(2, "0");
    const number = String(transactionId).padStart(3, "0");
    return "sm-" + year + month + day + "-" + number;
}
function calculateTotalTransactions() {
    const totalTransactions = transactions.length;
    if (totalTransactionsEl) {
        totalTransactionsEl.textContent = totalTransactions;
    }
}

function calculateTotalPassengers() {

    let totalPassengers = 0;

    transactions.forEach(function(transaction) {
        totalPassengers += transaction.passengers;
    });

    if (totalpassengersEl) {
        totalpassengersEl.textContent = totalPassengers;
    }
}

function calculateAverageFare() {
    if (!averageFareEl) return;

    let totalRevenue = 0;
    let totalPassengers = 0;

    transactions.forEach(function(transaction) {
        totalRevenue += transaction.total;
        totalPassengers += transaction.passengers;
    });

    if (totalPassengers === 0) {
        averageFareEl.textContent = "KSh 0.00";
        return;
    }

    const averageFare = totalRevenue / totalPassengers;
    averageFareEl.textContent = "KSh " + averageFare.toFixed(2);
}

function updateDashboardSummary() {
    calculateTotalRevenue();
    calculateTotalTransactions();
    calculateTotalPassengers();
    calculateAverageFare();
    updatePaymentMethodRevenue();
}


const confirmButton = document.getElementById("confirm-button");
    function calculateTotalFare() {
    const fare = parseFloat(fareInput.value) || 0;
    const passengers = parseInt(passengersInput.value) || 1;
    const totalFare = fare * passengers;
    totalFareEl.textContent = "ksh " + totalFare.toFixed(2);
}
fareInput.addEventListener("input", function() {
    if (parseFloat(fareInput.value) < 0) {
        fareInput.value = "";
    }
    calculateTotalFare();
});
passengersInput.addEventListener("input", function() {
    if (parseInt(passengersInput.value) < 1) {
        passengersInput.value = "";
    }
    calculateTotalFare();
});
function validateFare() {
    const fare = parseFloat(fareInput.value);
    if (fare <= 0) {
        alert("Please enter a valid fare amount");
        
        return false;
    }
    return true;
}
function validatePassengers() {
    const passengers = parseInt(passengersInput.value);
    if (passengers < 1) {
        alert("Please enter a valid passenger count");
        return false;
    }
    return true;
}

paymentButtons.forEach(function(button) {

    button.addEventListener("click", function() {

        paymentButtons.forEach(function(btn) {

            btn.classList.remove("selected");

        });


        button.classList.add("selected");


        const method =
            button.getAttribute("data-method");
        
        selectedpaymentMethod = method;

        console.log("Selected payment method:", method);
        const selectedEl = document.getElementById('selected-methods');
        if (selectedEl) selectedEl.textContent = 'Selected payment method: ' + method;

    });

});
function validatePaymentMethod() {
    if(selectedpaymentMethod === null) {
        alert("Please select a payment method");
        return false;
    }
    return true;
}
fareInput.addEventListener("input", calculateTotalFare);
passengersInput.addEventListener("input", calculateTotalFare);
if (confirmButton) {
    confirmButton.addEventListener("click", function() {
        if (!validateFare() || !validatePassengers() || !validatePaymentMethod()) {
            alert("Payment details are not valid.");
            return;
        }
        
        const fare = Number(fareInput.value);
        const passengers = Number(passengersInput.value);
        const total = fare * passengers;

        // Generate transaction ID
        const newTransactionId = generateTransactionId();
        transactionId++;
        const transaction={
            id: newTransactionId,
            fare: fare,
            passengers: passengers,
            total: total,
            paymentmethod: getPaymentMethodName(selectedpaymentMethod),
            status: "Paid",
            dateTime: new Date().toISOString()
        };
        transactions.push(transaction);
        saveTransactions();
        displayTransactions();
        updateDashboardSummary();
        displayLatestTransaction();
        updateDashboardKPIs();
        updatePaymentMethodRevenue();
        
        
        // Display transaction information
        transactionIdEl.textContent = newTransactionId;
        if (receiptAmountEl) receiptAmountEl.textContent = "KSh " + total.toFixed(2);
        if (receiptMethodEl) receiptMethodEl.textContent = getPaymentMethodName(selectedpaymentMethod);
        
        // Show payment result
        paymentresultEl.style.display = "block";
        if (transactionMessageEl) {
            transactionMessageEl.textContent = "Your payment has been successfully recorded.";
        }
    });
}

displayTransactions();
updateDashboardSummary();
displayLatestTransaction();
updateDashboardKPIs();
updatePaymentMethodRevenue();

console.log("Payment Ready");
console.log("fare: " + fareInput.value);
console.log("passengers: " + passengersInput.value);
console.log("Payment Method: " + selectedpaymentMethod);
console.log("Total Fare: " + parseFloat(fareInput.value) * parseInt(passengersInput.value))
