/* =====================================================
   EXPENSEFLOW
   Student Expense Tracker
===================================================== */


/* =====================================================
   STORAGE
===================================================== */

const STORAGE_KEYS = {

    name: "expenseflow_name",

    transactions: "expenseflow_transactions",

    budget: "expenseflow_budget",

    theme: "expenseflow_theme"

};


/* =====================================================
   CATEGORY COLORS
   (used for the donut chart + category list dots so
   they always match, no matter which categories the
   user actually has transactions in)
===================================================== */

const CATEGORY_COLORS = {

    Food: "#5265ff",
    Transport: "#27d27c",
    Education: "#ffab2e",
    Shopping: "#ff4d6d",
    Entertainment: "#9b5cff",
    Bills: "#4b8cff",
    Health: "#20d486",
    Other: "#8e98b7"

};


/* =====================================================
   CATEGORY OPTIONS PER TRANSACTION TYPE

   The category dropdown used to only ever show expense
   categories (Food, Transport, Bills...). None of those
   fit an income entry, and the dropdown is a required
   field - so picking "Income" and trying to submit
   without choosing one of those mismatched options got
   silently blocked by the browser's built-in "please
   select an item" validation. This swaps the dropdown's
   options to match whichever tab (Expense/Income) is
   currently selected.
===================================================== */

const EXPENSE_CATEGORIES = [
    { value: "Food", label: "🍔 Food" },
    { value: "Transport", label: "🚌 Transport" },
    { value: "Education", label: "📚 Education" },
    { value: "Shopping", label: "🛍️ Shopping" },
    { value: "Entertainment", label: "🎮 Entertainment" },
    { value: "Bills", label: "💡 Bills" },
    { value: "Health", label: "❤️ Health" },
    { value: "Other", label: "📦 Other" }
];

const INCOME_CATEGORIES = [
    { value: "Pocket Money", label: "💰 Pocket Money" },
    { value: "Scholarship", label: "🎓 Scholarship" },
    { value: "Part-time Job", label: "💼 Part-time Job" },
    { value: "Salary", label: "🧾 Salary" },
    { value: "Gift", label: "🎁 Gift" },
    { value: "Other", label: "📦 Other" }
];


function populateCategoryOptions(selectEl, type) {

    if (!selectEl) return;

    const list =
        type === "income"
            ? INCOME_CATEGORIES
            : EXPENSE_CATEGORIES;

    const previousValue =
        selectEl.value;

    selectEl.innerHTML =
        '<option value="">Select category</option>' +
        list.map(function (c) {
            return `<option value="${c.value}">${c.label}</option>`;
        }).join("");

    // Keep the previous choice if it still applies
    // (e.g. "Other" exists in both lists), otherwise
    // reset back to the placeholder.
    const stillValid =
        list.some(function (c) {
            return c.value === previousValue;
        });

    selectEl.value =
        stillValid ? previousValue : "";

}


/* =====================================================
   GLOBAL DATA
===================================================== */

let transactions =
    JSON.parse(
        localStorage.getItem(
            STORAGE_KEYS.transactions
        )
    ) || [];

let budget =
    Number(
        localStorage.getItem(
            STORAGE_KEYS.budget
        )
    ) || 0;

let userName =
    localStorage.getItem(
        STORAGE_KEYS.name
    ) || "";

let currentTransactionType = "expense";


/* =====================================================
   DOM ELEMENTS
===================================================== */

const welcomeScreen =
    document.getElementById("welcomeScreen");

const app =
    document.getElementById("app");

const userNameInput =
    document.getElementById("userName");

const photoInput =
    document.getElementById("photoInput");

const previewImage =
    document.getElementById("previewImage");

const defaultAvatar =
    document.getElementById("defaultAvatar");

const continueBtn =
    document.getElementById("continueBtn");

const welcomeError =
    document.getElementById("welcomeError");

const greetingName =
    document.getElementById("greetingName");

const headerUserName =
    document.getElementById("headerUserName");

const sidebarUserName =
    document.getElementById("sidebarUserName");


/* =====================================================
   INITIALIZATION
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);


async function initializeApp() {

    setCurrentDates();

    setupEventListeners();

    loadTheme();

    if (userName) {

        await showApp();

    } else {

        welcomeScreen.classList.remove("hidden");

        app.classList.add("hidden");

    }

}


/* =====================================================
   SHOW APPLICATION
===================================================== */

async function showApp() {

    welcomeScreen.classList.add("hidden");

    app.classList.remove("hidden");

    updateUserInterface();

    await loadProfilePhoto();

    renderDashboard();

    renderTransactions();

    updateBudgetPage();

    updateAnalytics();

    loadTheme();

}


/* =====================================================
   WELCOME SCREEN
===================================================== */

continueBtn.addEventListener("click", async function () {

    const name = userNameInput.value.trim();

    if (!name) {
        welcomeError.textContent = "Please enter your name.";
        return;
    }

    userName = name;

    localStorage.setItem(
        STORAGE_KEYS.name,
        userName
    );

    welcomeError.textContent = "";

    // Save uploaded photo
    const file = photoInput.files[0];

    if (file) {
        await savePhoto(file);
    }

    // Open Dashboard
    await showApp();

});


/* =====================================================
   PHOTO PREVIEW
===================================================== */

photoInput.addEventListener(
    "change",
    function () {

        const file =
            photoInput.files[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {

            alert("Please select an image.");

            return;
        }

        const reader =
            new FileReader();

        reader.onload = function (event) {

            previewImage.src =
                event.target.result;

            previewImage.style.display =
                "block";

            defaultAvatar.style.display =
                "none";

        };

        reader.readAsDataURL(file);

    }
);


/* =====================================================
   INDEXED DB
   Used for profile photo
===================================================== */

const DB_NAME =
    "ExpenseFlowDB";

const DB_VERSION =
    1;

const STORE_NAME =
    "profile";


function openDatabase() {

    return new Promise(
        (resolve, reject) => {

            const request =
                indexedDB.open(
                    DB_NAME,
                    DB_VERSION
                );

            request.onupgradeneeded =
                function (event) {

                    const db =
                        event.target.result;

                    if (
                        !db.objectStoreNames.contains(
                            STORE_NAME
                        )
                    ) {

                        db.createObjectStore(
                            STORE_NAME
                        );

                    }

                };

            request.onsuccess =
                function () {

                    resolve(
                        request.result
                    );

                };

            request.onerror =
                function () {

                    reject(
                        request.error
                    );

                };

        }
    );

}


/* =====================================================
   SAVE PHOTO
===================================================== */

async function savePhoto(file) {

    if (!file) return;

    try {

        const db =
            await openDatabase();

        const transaction =
            db.transaction(
                STORE_NAME,
                "readwrite"
            );

        const store =
            transaction.objectStore(
                STORE_NAME
            );

        store.put(
            file,
            "profilePhoto"
        );

    } catch (error) {

        console.error(
            "Photo save error:",
            error
        );

    }

}


/* =====================================================
   LOAD PHOTO
===================================================== */

function getPhoto() {

    return openDatabase()
        .then(function (db) {

            return new Promise(
                function (resolve, reject) {

                    const transaction =
                        db.transaction(
                            STORE_NAME,
                            "readonly"
                        );

                    const store =
                        transaction.objectStore(
                            STORE_NAME
                        );

                    const request =
                        store.get(
                            "profilePhoto"
                        );

                    request.onsuccess =
                        function () {

                            resolve(
                                request.result || null
                            );

                        };

                    request.onerror =
                        function () {

                            reject(
                                request.error
                            );

                        };

                }
            );

        })
        .catch(function (error) {

            console.error(
                "Photo load error:",
                error
            );

            return null;

        });

}


async function loadProfilePhoto() {

    const file =
        await getPhoto();

    if (file) {

        const photoURL =
            URL.createObjectURL(file);

        applyAvatarPhoto(photoURL);

    } else {

        applyAvatarPhoto(null);

    }

}


/* Shows/hides the profile photo across the sidebar,
   header and settings avatars. Falls back to the
   first letter of the user's name when there is no
   saved photo. */

function applyAvatarPhoto(photoURL) {

    const avatarPairs = [
        ["sidebarProfileImage", "sidebarAvatarLetter"],
        ["headerProfileImage", "headerAvatarLetter"],
        ["settingsProfileImage", "settingsAvatarLetter"]
    ];

    avatarPairs.forEach(function (pair) {

        const img =
            document.getElementById(pair[0]);

        const letter =
            document.getElementById(pair[1]);

        if (!img) return;

        if (photoURL) {

            img.src = photoURL;
            img.style.display = "block";

            if (letter) {
                letter.style.display = "none";
            }

        } else {

            img.style.display = "none";
            img.removeAttribute("src");

            if (letter) {
                letter.style.display = "";
            }

        }

    });

}


/* =====================================================
   SMALL HELPERS
===================================================== */

function setText(id, value) {

    const el =
        document.getElementById(id);

    if (el) {
        el.textContent = value;
    }

}

function formatCurrency(amount) {

    const value =
        Number(amount) || 0;

    return "₹" + value.toFixed(2);

}


/* =====================================================
   CURRENT MONTH LABEL
===================================================== */

function setCurrentDates() {

    const now = new Date();

    const monthNames = [
        "January", "February", "March", "April",
        "May", "June", "July", "August",
        "September", "October", "November", "December"
    ];

    const currentMonthEl =
        document.getElementById("currentMonth");

    if (currentMonthEl) {

        currentMonthEl.textContent =
            monthNames[now.getMonth()] +
            " " +
            now.getFullYear();

    }

}


/* =====================================================
   PROFILE NAME / AVATAR LETTER
===================================================== */

function updateUserInterface() {

    const displayName =
        userName || "User";

    if (greetingName) {
        greetingName.textContent = displayName;
    }

    if (headerUserName) {
        headerUserName.textContent = displayName;
    }

    if (sidebarUserName) {
        sidebarUserName.textContent = displayName;
    }

    const settingsNameInput =
        document.getElementById("settingsNameInput");

    if (settingsNameInput) {
        settingsNameInput.value = userName;
    }

    const letter =
        displayName.charAt(0).toUpperCase();

    [
        "sidebarAvatarLetter",
        "headerAvatarLetter",
        "settingsAvatarLetter"
    ].forEach(function (id) {

        const el =
            document.getElementById(id);

        if (el) {
            el.textContent = letter;
        }

    });

}


/* =====================================================
   DASHBOARD RENDERING
===================================================== */

function renderDashboard() {

    const totalIncome =
        transactions
            .filter(t => t.type === "income")
            .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpense =
        transactions
            .filter(t => t.type === "expense")
            .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalBalance =
        totalIncome - totalExpense;


    /* Stat cards */

    setText("totalBalance", formatCurrency(totalBalance));
    setText("totalIncome", formatCurrency(totalIncome));
    setText("totalExpense", formatCurrency(totalExpense));
    setText("monthlyBudget", formatCurrency(budget));


    /* Budget progress bar (stat card) */

    const budgetPercent =
        budget > 0
            ? Math.min(100, (totalExpense / budget) * 100)
            : 0;

    const budgetProgressBar =
        document.getElementById("budgetProgressBar");

    if (budgetProgressBar) {
        budgetProgressBar.style.width = budgetPercent + "%";
    }

    setText(
        "budgetPercentage",
        Math.round(budgetPercent) + "%"
    );


    /* Days left in the current month */

    const now = new Date();

    const lastDayOfMonth =
        new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0
        ).getDate();

    const daysRemaining =
        Math.max(0, lastDayOfMonth - now.getDate());

    setText(
        "budgetDays",
        daysRemaining + " days remaining"
    );


    /* Category breakdown (expenses only) */

    const categoryTotals = {};

    transactions
        .filter(t => t.type === "expense")
        .forEach(t => {

            categoryTotals[t.category] =
                (categoryTotals[t.category] || 0) +
                Number(t.amount);

        });

    const categoryEntries =
        Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1]);

    const categoryListEl =
        document.getElementById("categoryList");

    if (categoryListEl) {

        if (categoryEntries.length === 0) {

            categoryListEl.innerHTML =
                '<div style="color:var(--muted);font-size:12px;">No expenses yet.</div>';

        } else {

            categoryListEl.innerHTML =
                categoryEntries.map(([category, amount]) => {

                    const percent =
                        totalExpense > 0
                            ? ((amount / totalExpense) * 100).toFixed(0)
                            : 0;

                    const color =
                        CATEGORY_COLORS[category] || "#8e98b7";

                    return `
                        <div class="category-item">
                            <span class="category-dot" style="background:${color}"></span>
                            <span class="category-name">${escapeHTML(category)}</span>
                            <span class="category-percent">${percent}%</span>
                            <span class="category-amount">${formatCurrency(amount)}</span>
                        </div>
                    `;

                }).join("");

        }

    }


    /* Donut chart */

    const donutChart =
        document.getElementById("donutChart");

    if (donutChart) {

        if (totalExpense > 0 && categoryEntries.length > 0) {

            let cumulativeDeg = 0;

            const segments =
                categoryEntries.map(([category, amount]) => {

                    const color =
                        CATEGORY_COLORS[category] || "#8e98b7";

                    const startDeg = cumulativeDeg;

                    cumulativeDeg +=
                        (amount / totalExpense) * 360;

                    return `${color} ${startDeg}deg ${cumulativeDeg}deg`;

                });

            donutChart.style.background =
                `conic-gradient(${segments.join(", ")})`;

        } else {

            donutChart.style.background =
                "rgba(255,255,255,0.08)";

        }

    }

    setText("chartTotal", formatCurrency(totalExpense));


    /* Budget Overview card (circle) */

    const budgetCircle =
        document.querySelector(".budget-circle");

    if (budgetCircle) {

        const circleDeg =
            (budgetPercent / 100) * 360;

        budgetCircle.style.background =
            `conic-gradient(var(--green) ${circleDeg}deg, rgba(255,255,255,0.07) ${circleDeg}deg)`;

    }

    setText(
        "budgetUsedPercentage",
        Math.round(budgetPercent) + "%"
    );

    setText("budgetSpentText", formatCurrency(totalExpense));
    setText("budgetLimitText", formatCurrency(budget));

    setText(
        "budgetRemainingText",
        formatCurrency(Math.max(0, budget - totalExpense))
    );


    /* Recent transactions (last 5, newest first) */

    const recentContainer =
        document.getElementById("recentTransactions");

    if (recentContainer) {

        const recent =
            transactions.slice(-5);

        renderTransactionList(recentContainer, recent);

    }


    /* Summary card */

    setText("summaryIncome", formatCurrency(totalIncome));
    setText("summaryExpense", formatCurrency(totalExpense));
    setText("summarySavings", formatCurrency(totalBalance));
    setText("summaryTransactions", transactions.length);


    /* Sidebar daily summary (today only) */

    const todayStr =
        new Date().toISOString().split("T")[0];

    const dailyIncome =
        transactions
            .filter(t => t.type === "income" && t.date === todayStr)
            .reduce((sum, t) => sum + Number(t.amount), 0);

    const dailyExpense =
        transactions
            .filter(t => t.type === "expense" && t.date === todayStr)
            .reduce((sum, t) => sum + Number(t.amount), 0);

    const dailyRemaining =
        dailyIncome - dailyExpense;

    setText("dailyIncome", formatCurrency(dailyIncome));
    setText("dailyExpense", formatCurrency(dailyExpense));
    setText("dailyRemaining", formatCurrency(dailyRemaining));

    const dailyPercent =
        dailyIncome > 0
            ? Math.min(100, (dailyExpense / dailyIncome) * 100)
            : 0;

    const dailyProgressCircle =
        document.getElementById("dailyProgressCircle");

    if (dailyProgressCircle) {

        const dailyDeg =
            (dailyPercent / 100) * 360;

        dailyProgressCircle.style.background =
            `conic-gradient(var(--primary) ${dailyDeg}deg, rgba(255,255,255,0.08) ${dailyDeg}deg)`;

    }

    setText(
        "dailyProgressText",
        Math.round(dailyPercent) + "%"
    );


    /* Smart insight */

    const insightText =
        document.getElementById("insightText");

    if (insightText) {

        if (transactions.length === 0) {

            insightText.textContent =
                "Add your first transaction to see insights.";

        } else if (categoryEntries.length > 0) {

            const topCategory = categoryEntries[0][0];
            const topAmount = categoryEntries[0][1];

            insightText.textContent =
                `You've spent the most on ${topCategory} (${formatCurrency(topAmount)}) so far.`;

        } else {

            insightText.textContent =
                "Keep tracking your expenses to see insights.";

        }

    }

}


/* =====================================================
   TRANSACTIONS PAGE RENDERING
===================================================== */

function renderAllTransactionsPage() {

    const searchInput =
        document.getElementById("searchTransaction");

    const filterCategory =
        document.getElementById("filterCategory");

    const search =
        searchInput
            ? searchInput.value.toLowerCase()
            : "";

    const category =
        filterCategory
            ? filterCategory.value
            : "all";

    const container =
        document.getElementById("allTransactions");

    if (!container) return;

    const filtered =
        transactions.filter(t => {

            const matchesSearch =
                t.title.toLowerCase().includes(search);

            const matchesCategory =
                category === "all" ||
                t.category === category;

            return matchesSearch && matchesCategory;

        });

    renderTransactionList(container, filtered);

}

function renderTransactions() {

    renderAllTransactionsPage();

}


/* =====================================================
   BUDGET PAGE RENDERING
===================================================== */

function updateBudgetPage() {

    const totalExpense =
        transactions
            .filter(t => t.type === "expense")
            .reduce((sum, t) => sum + Number(t.amount), 0);

    const budgetInput =
        document.getElementById("budgetInput");

    if (budgetInput && budget > 0) {
        budgetInput.value = budget;
    }

    setText("pageBudgetAmount", formatCurrency(budget));

    const percent =
        budget > 0
            ? Math.min(100, (totalExpense / budget) * 100)
            : 0;

    const pageBudgetBar =
        document.getElementById("pageBudgetBar");

    if (pageBudgetBar) {
        pageBudgetBar.style.width = percent + "%";
    }

    setText("pageBudgetSpent", formatCurrency(totalExpense));

    setText(
        "pageBudgetRemaining",
        formatCurrency(budget - totalExpense)
    );

}


/* =====================================================
   ANALYTICS PAGE RENDERING
===================================================== */

function updateAnalytics() {

    const totalExpense =
        transactions
            .filter(t => t.type === "expense")
            .reduce((sum, t) => sum + Number(t.amount), 0);

    const categoryTotals = {};

    transactions
        .filter(t => t.type === "expense")
        .forEach(t => {

            categoryTotals[t.category] =
                (categoryTotals[t.category] || 0) +
                Number(t.amount);

        });

    const entries =
        Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1]);

    const container =
        document.getElementById("analyticsCategories");

    if (container) {

        if (entries.length === 0) {

            container.innerHTML =
                '<div style="color:var(--muted);font-size:12px;">No expenses yet.</div>';

        } else {

            container.innerHTML =
                entries.map(([category, amount]) => {

                    const percent =
                        totalExpense > 0
                            ? ((amount / totalExpense) * 100).toFixed(0)
                            : 0;

                    return `
                        <div class="analytics-category">
                            <span>${escapeHTML(category)}</span>
                            <div class="analytics-bar">
                                <div style="width:${percent}%"></div>
                            </div>
                            <span>${formatCurrency(amount)}</span>
                        </div>
                    `;

                }).join("");

        }

    }

    setText("analyticsTotal", formatCurrency(totalExpense));

    const analyticsMessage =
        document.getElementById("analyticsMessage");

    if (analyticsMessage) {

        if (entries.length === 0) {

            analyticsMessage.textContent =
                "Start adding expenses to see your analysis.";

        } else {

            analyticsMessage.textContent =
                `You've spent across ${entries.length} ${entries.length === 1 ? "category" : "categories"}. Your top category is ${entries[0][0]}.`;

        }

    }

}


/* =====================================================
   THEME
===================================================== */

function loadTheme() {

    const saved =
        localStorage.getItem(STORAGE_KEYS.theme);

    const themeToggle =
        document.getElementById("themeToggle");

    if (saved === "light") {

        document.body.classList.add("light-mode");

        if (themeToggle) {
            themeToggle.textContent = "☀️ Light Mode";
        }

    } else {

        document.body.classList.remove("light-mode");

        if (themeToggle) {
            themeToggle.textContent = "🌙 Dark Mode";
        }

    }

}


/* =====================================================
   FIX - EVENT LISTENERS
===================================================== */

function setupEventListeners() {

    /* Start both category dropdowns on "expense",
       matching the default active tab. */

    populateCategoryOptions(
        document.getElementById("transactionCategory"),
        "expense"
    );

    populateCategoryOptions(
        document.getElementById("fullCategory"),
        "expense"
    );


    /* ==========================================
       SIDEBAR NAVIGATION
    ========================================== */

    const navItems = document.querySelectorAll(".nav-item");
    const mobileNavItems = document.querySelectorAll(
        ".mobile-nav-item, .mobile-add-btn"
    );

    function openPage(pageName) {

        // Hide all pages
        document.querySelectorAll(".page").forEach(page => {
            page.classList.remove("active-page");
        });

        // Show selected page
        const selectedPage = document.getElementById(
            pageName + "Page"
        );

        if (selectedPage) {
            selectedPage.classList.add("active-page");
        }

        // Update sidebar active button
        document.querySelectorAll(
            ".nav-item, .mobile-nav-item, .mobile-add-btn"
        ).forEach(btn => {
            btn.classList.remove("active");
        });

        document
            .querySelectorAll(
                `[data-page="${pageName}"]`
            )
            .forEach(btn => {
                btn.classList.add("active");
            });

        // Close mobile sidebar
        const sidebar = document.getElementById("sidebar");

        if (sidebar) {
            sidebar.classList.remove("open");
        }

        // Refresh page data
        if (pageName === "dashboard") {
            renderDashboard();
        }

        if (pageName === "transactions") {
            renderTransactions();
        }

        if (pageName === "budget") {
            updateBudgetPage();
        }

        if (pageName === "analytics") {
            updateAnalytics();
        }
    }


    /* Sidebar buttons */

    navItems.forEach(button => {

        button.addEventListener("click", function () {

            const page = this.dataset.page;

            openPage(page);

        });

    });


    /* Mobile navigation */

    mobileNavItems.forEach(button => {

        button.addEventListener("click", function () {

            const page = this.dataset.page;

            openPage(page);

        });

    });


    /* ==========================================
       MOBILE MENU
    ========================================== */

    const menuBtn =
        document.getElementById("menuBtn");

    const sidebar =
        document.getElementById("sidebar");

    if (menuBtn && sidebar) {

        menuBtn.addEventListener("click", function () {

            sidebar.classList.toggle("open");

        });

    }


    /* ==========================================
       QUICK ADD - EXPENSE / INCOME
    ========================================== */

    const quickTabs =
        document.querySelectorAll(
            ".quick-add-card .transaction-tab"
        );

    const transactionType =
        document.getElementById(
            "transactionType"
        );

    const addTransactionBtn =
        document.getElementById(
            "addTransactionBtn"
        );


    quickTabs.forEach(tab => {

        tab.addEventListener("click", function (event) {

            event.preventDefault();

            const type =
                this.dataset.type;

            // Save type
            if (transactionType) {
                transactionType.value = type;
            }

            // Change active tab
            quickTabs.forEach(t => {
                t.classList.remove("active");
            });

            this.classList.add("active");

            // Change button text
            if (addTransactionBtn) {

                if (type === "income") {
                    addTransactionBtn.textContent =
                        "Add Income";
                } else {
                    addTransactionBtn.textContent =
                        "Add Expense";
                }

            }

            // Show categories that actually fit this type
            populateCategoryOptions(
                document.getElementById("transactionCategory"),
                type
            );

        });

    });


    /* ==========================================
       QUICK ADD FORM
    ========================================== */

    const quickForm =
        document.getElementById(
            "quickTransactionForm"
        );

    if (quickForm) {

        quickForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                const title =
                    document.getElementById(
                        "transactionTitle"
                    ).value.trim();

                const amount =
                    Number(
                        document.getElementById(
                            "transactionAmount"
                        ).value
                    );

                const category =
                    document.getElementById(
                        "transactionCategory"
                    ).value;

                const date =
                    document.getElementById(
                        "transactionDate"
                    ).value;

                const type =
                    document.getElementById(
                        "transactionType"
                    ).value;


                if (!title) {
                    alert("Please enter a title.");
                    return;
                }

                if (!amount || amount <= 0) {
                    alert("Please enter a valid amount.");
                    return;
                }

                if (!category) {
                    alert("Please select a category.");
                    return;
                }

                if (!date) {
                    alert("Please select a date.");
                    return;
                }


                /* Create transaction */

                const newTransaction = {

                    id: Date.now(),

                    title: title,

                    amount: amount,

                    category: category,

                    date: date,

                    type: type

                };


                transactions.push(
                    newTransaction
                );


                /* Save */

                localStorage.setItem(
                    STORAGE_KEYS.transactions,
                    JSON.stringify(transactions)
                );


                /* Clear form */

                quickForm.reset();

                document.getElementById(
                    "transactionType"
                ).value = "expense";


                quickTabs.forEach(tab => {
                    tab.classList.remove("active");
                });

                const expenseTab =
                    document.querySelector(
                        '.quick-add-card .transaction-tab[data-type="expense"]'
                    );

                if (expenseTab) {
                    expenseTab.classList.add("active");
                }


                if (addTransactionBtn) {
                    addTransactionBtn.textContent =
                        "Add Expense";
                }

                populateCategoryOptions(
                    document.getElementById("transactionCategory"),
                    "expense"
                );

                /* Restore today's date after reset() clears it */

                const transactionDateInput =
                    document.getElementById("transactionDate");

                if (transactionDateInput) {
                    transactionDateInput.value =
                        new Date().toISOString().split("T")[0];
                }


                /* Refresh dashboard */

                renderDashboard();
                renderTransactions();
                updateBudgetPage();
                updateAnalytics();


                alert(
                    type === "income"
                        ? "Income added successfully!"
                        : "Expense added successfully!"
                );

            }
        );

    }


    /* ==========================================
       FULL ADD TRANSACTION PAGE
    ========================================== */

    const fullTabs =
        document.querySelectorAll(
            "#addPage .transaction-tab"
        );

    const fullType =
        document.getElementById(
            "fullTransactionType"
        );


    fullTabs.forEach(tab => {

        tab.addEventListener(
            "click",
            function () {

                const type =
                    this.dataset.fullType;

                if (fullType) {
                    fullType.value = type;
                }

                fullTabs.forEach(t => {
                    t.classList.remove("active");
                });

                this.classList.add("active");

                // Show categories that actually fit this type
                populateCategoryOptions(
                    document.getElementById("fullCategory"),
                    type
                );

            }
        );

    });


    const fullForm =
        document.getElementById(
            "fullTransactionForm"
        );


    if (fullForm) {

        fullForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                const title =
                    document.getElementById(
                        "fullTitle"
                    ).value.trim();

                const amount =
                    Number(
                        document.getElementById(
                            "fullAmount"
                        ).value
                    );

                const category =
                    document.getElementById(
                        "fullCategory"
                    ).value;

                const date =
                    document.getElementById(
                        "fullDate"
                    ).value;

                const type =
                    document.getElementById(
                        "fullTransactionType"
                    ).value;


                if (!title ||
                    !amount ||
                    amount <= 0 ||
                    !category ||
                    !date) {

                    alert(
                        "Please fill all fields with valid values."
                    );

                    return;
                }


                transactions.push({

                    id: Date.now(),

                    title: title,

                    amount: amount,

                    category: category,

                    date: date,

                    type: type

                });


                localStorage.setItem(
                    STORAGE_KEYS.transactions,
                    JSON.stringify(transactions)
                );


                fullForm.reset();

                fullType.value = "expense";

                fullTabs.forEach(tab => {
                    tab.classList.remove("active");
                });

                if (fullTabs[0]) {
                    fullTabs[0].classList.add("active");
                }

                populateCategoryOptions(
                    document.getElementById("fullCategory"),
                    "expense"
                );

                /* Restore today's date after reset() clears it */

                const fullDateInput =
                    document.getElementById("fullDate");

                if (fullDateInput) {
                    fullDateInput.value =
                        new Date().toISOString().split("T")[0];
                }


                renderDashboard();
                renderTransactions();
                updateBudgetPage();
                updateAnalytics();


                alert(
                    "Transaction added successfully!"
                );

                openPage("transactions");

            }
        );

    }


    /* ==========================================
       TRANSACTIONS ADD BUTTON
    ========================================== */

    const transactionsAddBtn =
        document.getElementById(
            "transactionsAddBtn"
        );

    if (transactionsAddBtn) {

        transactionsAddBtn.addEventListener(
            "click",
            function () {

                openPage("add");

            }
        );

    }


    /* ==========================================
       VIEW ALL
    ========================================== */

    const viewAllBtn =
        document.getElementById(
            "viewAllBtn"
        );

    if (viewAllBtn) {

        viewAllBtn.addEventListener(
            "click",
            function () {

                openPage("transactions");

            }
        );

    }


    /* ==========================================
       BUDGET
    ========================================== */

    const saveBudgetBtn =
        document.getElementById(
            "saveBudgetBtn"
        );

    if (saveBudgetBtn) {

        saveBudgetBtn.addEventListener(
            "click",
            function () {

                const input =
                    document.getElementById(
                        "budgetInput"
                    );

                const value =
                    Number(input.value);

                if (!input.value || value < 0) {
                    alert(
                        "Please enter a valid budget amount."
                    );
                    return;
                }

                budget = value;

                localStorage.setItem(
                    STORAGE_KEYS.budget,
                    budget
                );

                updateBudgetPage();
                renderDashboard();

                alert(
                    "Budget saved successfully!"
                );

            }
        );

    }


    /* ==========================================
       SEARCH TRANSACTIONS
    ========================================== */

    const searchInput =
        document.getElementById(
            "searchTransaction"
        );

    const filterCategory =
        document.getElementById(
            "filterCategory"
        );


    if (searchInput) {
        searchInput.addEventListener(
            "input",
            renderAllTransactionsPage
        );
    }

    if (filterCategory) {
        filterCategory.addEventListener(
            "change",
            renderAllTransactionsPage
        );
    }


    /* ==========================================
       SETTINGS - NAME
    ========================================== */

    const saveProfileBtn =
        document.getElementById(
            "saveProfileBtn"
        );

    if (saveProfileBtn) {

        saveProfileBtn.addEventListener(
            "click",
            function () {

                const input =
                    document.getElementById(
                        "settingsNameInput"
                    );

                const newName =
                    input.value.trim();

                if (!newName) {
                    alert(
                        "Please enter your name."
                    );
                    return;
                }

                userName = newName;

                localStorage.setItem(
                    STORAGE_KEYS.name,
                    userName
                );

                updateUserInterface();

                alert(
                    "Profile updated!"
                );

            }
        );

    }


    /* ==========================================
       SETTINGS PHOTO
    ========================================== */

    const settingsPhotoInput =
        document.getElementById(
            "settingsPhotoInput"
        );

    if (settingsPhotoInput) {

        settingsPhotoInput.addEventListener(
            "change",
            async function () {

                const file =
                    this.files[0];

                if (!file) return;

                await savePhoto(file);

                await loadProfilePhoto();

            }
        );

    }


    /* ==========================================
       THEME
    ========================================== */

    const themeToggle =
        document.getElementById(
            "themeToggle"
        );

    if (themeToggle) {

        themeToggle.addEventListener(
            "click",
            function () {

                document.body.classList.toggle(
                    "light-mode"
                );

                const isLight =
                    document.body.classList.contains(
                        "light-mode"
                    );

                localStorage.setItem(
                    STORAGE_KEYS.theme,
                    isLight
                        ? "light"
                        : "dark"
                );

                themeToggle.textContent =
                    isLight
                        ? "☀️ Light Mode"
                        : "🌙 Dark Mode";

            }
        );

    }


    /* ==========================================
       DATE PICKER FIX
    ========================================== */

    const dateInputs =
        document.querySelectorAll(
            'input[type="date"]'
        );


    dateInputs.forEach(input => {

        input.addEventListener(
            "click",
            function () {

                // Chrome supports showPicker()
                if (
                    typeof this.showPicker ===
                    "function"
                ) {

                    try {
                        this.showPicker();
                    } catch (error) {
                        // Browser may already have picker open
                    }

                }

            }
        );

    });


    /* ==========================================
       DEFAULT DATE
    ========================================== */

    const today =
        new Date()
            .toISOString()
            .split("T")[0];


    dateInputs.forEach(input => {

        if (!input.value) {
            input.value = today;
        }

        // A date input also needs a max so users
        // cannot accidentally pick a future date
        // that skews the daily/monthly summaries.
        if (!input.max) {
            input.max = today;
        }

    });

}


/* =====================================================
   TRANSACTION LIST HELPER
===================================================== */

function renderTransactionList(
    container,
    list
) {

    if (!container) return;

    if (!list.length) {

        container.innerHTML = `
            <div style="
                padding:25px;
                text-align:center;
                color:#8f99b5;
                font-size:13px;
            ">
                No transactions found.
            </div>
        `;

        return;
    }


    container.innerHTML =
        list
            .slice()
            .reverse()
            .map(transaction => {

                const isIncome =
                    transaction.type === "income";

                return `

                    <div class="transaction-item">

                        <div class="transaction-icon">
                            ${
                                isIncome
                                    ? "↓"
                                    : "↑"
                            }
                        </div>

                        <div class="transaction-info">

                            <strong>
                                ${escapeHTML(
                                    transaction.title
                                )}
                            </strong>

                            <span>
                                ${escapeHTML(
                                    transaction.category
                                )}
                            </span>

                        </div>

                        <div class="transaction-meta">

                            <div class="
                                transaction-amount
                                ${isIncome
                                    ? "income"
                                    : "expense"}
                            ">
                                ${
                                    isIncome
                                        ? "+"
                                        : "-"
                                } ₹${Number(
                                    transaction.amount
                                ).toFixed(2)}
                            </div>

                            <div class="transaction-date">
                                ${transaction.date}
                            </div>

                        </div>

                    </div>

                `;

            })
            .join("");

}


/* =====================================================
   SAFETY
===================================================== */

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}