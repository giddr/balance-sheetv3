// Balance Sheet App - Full Featured Frontend
let categories = [];
let allExpenses = [];
let currentPeriod = 'month';
let categoryChart = null;
let trendChart = null;
let selectedExpenses = new Set();
const currentYear = new Date().getFullYear();
let statsYear = 2025; // Year shown in statistics cards - default to 2025 where most data is

// Sorting state: { column, direction } per table context
let sortState = {}; // keyed by month or table name, e.g. { '2025-01': { column: 'date', direction: 'asc' } }

// Track currently active month tab so it persists across reloads
let activeMonthTab = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Set default date to today
    const dateInput = document.getElementById('date');
    if (dateInput) dateInput.valueAsDate = new Date();

    // Set default cash date to today
    const cashDateInput = document.getElementById('cash-date-input');
    if (cashDateInput) cashDateInput.valueAsDate = new Date();

    // Set year labels to match statsYear (default 2025)
    document.querySelectorAll('.current-year').forEach(el => {
        el.textContent = statsYear;
    });

    // Populate year filter dropdown dynamically
    populateYearFilter();

    // Load all data
    loadCategories();
    loadExpenses();
    loadStatistics('month');
    loadCashRunway();
    populateMonthSelector();
    populateExportMonthSelector();

    // Setup event listeners
    setupEventListeners();
});

// Populate year filter with dynamic years
function populateYearFilter() {
    const yearFilter = document.getElementById('filter-year');
    if (!yearFilter) return;

    // Keep the "All Years" option (selected by default to show all transactions)
    yearFilter.innerHTML = '<option value="" selected>All Years</option>';

    // Add years from current year back to 2024
    for (let year = currentYear; year >= 2024; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    }
}

// Set year for statistics cards and reload stats
function setStatsYear(year) {
    statsYear = year;

    // Update toggle button states
    const toggleButtons = document.querySelectorAll('#stats-year-toggle button');
    toggleButtons.forEach(btn => {
        if (parseInt(btn.dataset.year) === year) {
            btn.classList.add('active');
            btn.classList.remove('btn-outline-primary');
            btn.classList.add('btn-primary');
        } else {
            btn.classList.remove('active');
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-outline-primary');
        }
    });

    // Update the year labels in the stats cards
    document.querySelectorAll('.current-year').forEach(el => {
        el.textContent = year;
    });

    // Reload statistics with the new year
    loadStatistics(currentPeriod);
}

// ============ SORTABLE TABLE HELPERS ============
function getSortIcon(tableKey, column) {
    const state = sortState[tableKey];
    if (!state || state.column !== column) {
        return '<i class="bi bi-arrow-down-up sort-icon text-muted" style="font-size: 0.7em; opacity: 0.4;"></i>';
    }
    return state.direction === 'asc'
        ? '<i class="bi bi-sort-up sort-icon" style="font-size: 0.7em;"></i>'
        : '<i class="bi bi-sort-down sort-icon" style="font-size: 0.7em;"></i>';
}

function toggleSort(tableKey, column, renderFn) {
    const state = sortState[tableKey];
    if (state && state.column === column) {
        state.direction = state.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortState[tableKey] = { column, direction: 'asc' };
    }
    renderFn();
}

function sortExpenses(expenses, tableKey) {
    const state = sortState[tableKey];
    if (!state) return expenses;

    const sorted = [...expenses];
    const dir = state.direction === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
        let valA, valB;
        switch (state.column) {
            case 'date':
                return dir * a.date.localeCompare(b.date);
            case 'description':
                return dir * (a.description || '').localeCompare(b.description || '');
            case 'account':
                return dir * (a.source_account || '').localeCompare(b.source_account || '');
            case 'category':
                return dir * (a.category || '').localeCompare(b.category || '');
            case 'type':
                valA = a.is_essential ? 'essential' : 'optional';
                valB = b.is_essential ? 'essential' : 'optional';
                return dir * valA.localeCompare(valB);
            case 'amount':
                return dir * (a.amount - b.amount);
            default:
                return 0;
        }
    });
    return sorted;
}

function setupEventListeners() {
    // Expense form
    const expenseForm = document.getElementById('expense-form');
    if (expenseForm) {
        expenseForm.addEventListener('submit', handleExpenseSubmit);
    }

    // Import form
    const importForm = document.getElementById('import-form');
    if (importForm) {
        importForm.addEventListener('submit', handleImportSubmit);
    }

    // Manual transaction form
    const manualForm = document.getElementById('manual-transaction-form');
    if (manualForm) {
        manualForm.addEventListener('submit', handleManualTransactionSubmit);
        // Set default date to today
        const manualDate = document.getElementById('manual-date');
        if (manualDate) manualDate.valueAsDate = new Date();
        // Populate category dropdown
        populateManualCategoryDropdown();
    }

    // Cash position form
    const cashForm = document.getElementById('cash-position-form');
    if (cashForm) {
        cashForm.addEventListener('submit', handleCashPositionSubmit);
    }

    // Recurring checkbox toggle
    const recurringCheckbox = document.getElementById('is-recurring');
    if (recurringCheckbox) {
        recurringCheckbox.addEventListener('change', function() {
            document.getElementById('recurring-options').style.display = this.checked ? 'block' : 'none';
        });
    }

    // Filter listeners
    const searchInput = document.getElementById('search-expenses');
    if (searchInput) {
        searchInput.addEventListener('input', filterAndDisplayExpenses);
    }

    const filterYear = document.getElementById('filter-year');
    if (filterYear) {
        filterYear.addEventListener('change', filterAndDisplayExpenses);
    }

    const filterCategory = document.getElementById('filter-category');
    if (filterCategory) {
        filterCategory.addEventListener('change', filterAndDisplayExpenses);
    }

    const filterType = document.getElementById('filter-type');
    if (filterType) {
        filterType.addEventListener('change', filterAndDisplayExpenses);
    }

    const filterTransactionType = document.getElementById('filter-transaction-type');
    if (filterTransactionType) {
        filterTransactionType.addEventListener('change', filterAndDisplayExpenses);
    }

    const filterAmountMin = document.getElementById('filter-amount-min');
    if (filterAmountMin) {
        filterAmountMin.addEventListener('input', filterAndDisplayExpenses);
    }

    const filterAmountMax = document.getElementById('filter-amount-max');
    if (filterAmountMax) {
        filterAmountMax.addEventListener('input', filterAndDisplayExpenses);
    }
}

// ============ CATEGORIES ============
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        categories = await response.json();

        // Populate expense form category dropdown
        const categorySelect = document.getElementById('category');
        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">Select Category</option>';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name;
                categorySelect.appendChild(option);
            });
        }

        // Populate filter category dropdown
        const filterCategory = document.getElementById('filter-category');
        if (filterCategory) {
            filterCategory.innerHTML = '<option value="">All</option>';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.name;
                option.textContent = cat.name;
                filterCategory.appendChild(option);
            });
        }

        // Populate settings category list
        loadCategoryList();
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

function loadCategoryList() {
    const categoryList = document.getElementById('category-list');
    if (!categoryList) return;

    categoryList.innerHTML = categories.map(cat => `
        <div class="list-group-item d-flex justify-content-between align-items-center">
            <div>
                <span class="badge me-2" style="background-color: ${cat.color}">&nbsp;</span>
                ${cat.name}
            </div>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory(${cat.id}, '${cat.name}')">
                <i class="bi bi-trash"></i>
            </button>
        </div>
    `).join('');
}

async function deleteCategory(id, name) {
    if (!confirm(`Delete category "${name}"? All expenses in this category will become "Uncategorized".`)) return;

    try {
        const response = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
        if (response.ok) {
            await loadCategories();
            await loadExpenses();
            loadStatistics(currentPeriod);
        }
    } catch (error) {
        console.error('Error deleting category:', error);
    }
}

// ============ EXPENSES ============
async function loadExpenses() {
    try {
        const response = await fetch('/api/expenses');
        allExpenses = await response.json();
        filterAndDisplayExpenses();
    } catch (error) {
        console.error('Error loading expenses:', error);
    }
}

function filterAndDisplayExpenses() {
    const searchTerm = (document.getElementById('search-expenses')?.value || '').toLowerCase();
    const yearFilter = document.getElementById('filter-year')?.value || '';
    const categoryFilter = document.getElementById('filter-category')?.value || '';
    const typeFilter = document.getElementById('filter-type')?.value || '';
    const transactionTypeFilter = document.getElementById('filter-transaction-type')?.value || '';
    const amountMinStr = document.getElementById('filter-amount-min')?.value || '';
    const amountMaxStr = document.getElementById('filter-amount-max')?.value || '';
    const amountMin = amountMinStr ? parseFloat(amountMinStr) : null;
    const amountMax = amountMaxStr ? parseFloat(amountMaxStr) : null;

    let filtered = allExpenses.filter(expense => {
        // Search filter
        if (searchTerm && !expense.description.toLowerCase().includes(searchTerm)) {
            return false;
        }

        // Year filter
        if (yearFilter) {
            const expenseYear = expense.date.substring(0, 4);
            if (expenseYear !== yearFilter) return false;
        }

        // Category filter
        if (categoryFilter && expense.category !== categoryFilter) {
            return false;
        }

        // Essential/Optional filter
        if (typeFilter === 'essential' && !expense.is_essential) return false;
        if (typeFilter === 'optional' && expense.is_essential) return false;

        // Transaction type filter (income/expense)
        if (transactionTypeFilter && expense.transaction_type !== transactionTypeFilter) {
            return false;
        }

        // Amount range filter
        if (amountMin !== null && expense.amount < amountMin) return false;
        if (amountMax !== null && expense.amount > amountMax) return false;

        return true;
    });

    displayExpensesByMonth(filtered);
}

function displayExpensesByMonth(expenses) {
    const monthlyTabs = document.getElementById('monthly-tabs');
    const monthlyContent = document.getElementById('monthly-tab-content');

    if (!monthlyTabs || !monthlyContent) return;

    // Group expenses by month
    const expensesByMonth = {};
    expenses.forEach(expense => {
        const monthKey = expense.date.substring(0, 7); // YYYY-MM
        if (!expensesByMonth[monthKey]) {
            expensesByMonth[monthKey] = [];
        }
        expensesByMonth[monthKey].push(expense);
    });

    // Sort months descending
    const months = Object.keys(expensesByMonth).sort().reverse();

    if (months.length === 0) {
        monthlyTabs.innerHTML = '<li class="nav-item"><span class="nav-link text-muted">No transactions</span></li>';
        monthlyContent.innerHTML = '<p class="text-muted text-center">Import some transactions to get started!</p>';
        return;
    }

    // Determine which month tab to activate (restore previous or default to first)
    const targetMonth = (activeMonthTab && months.includes(activeMonthTab)) ? activeMonthTab : months[0];
    activeMonthTab = targetMonth;

    // Create tabs
    monthlyTabs.innerHTML = months.map((month) => {
        const date = new Date(month + '-01');
        const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        return `
            <li class="nav-item">
                <button class="nav-link ${month === targetMonth ? 'active' : ''}"
                        data-bs-toggle="pill"
                        data-bs-target="#month-${month}"
                        type="button"
                        onclick="activeMonthTab='${month}'">
                    ${label}
                </button>
            </li>
        `;
    }).join('');

    // Store grouped expenses for sorting re-renders
    window._expensesByMonth = expensesByMonth;

    // Create content
    monthlyContent.innerHTML = months.map((month, index) => {
        const monthExpenses = expensesByMonth[month];
        const monthTotal = monthExpenses.filter(e => e.transaction_type === 'expense').reduce((sum, e) => sum + e.amount, 0);
        const monthIncome = monthExpenses.filter(e => e.transaction_type === 'income').reduce((sum, e) => sum + e.amount, 0);

        return `
            <div class="tab-pane fade ${month === targetMonth ? 'show active' : ''}" id="month-${month}">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <span class="badge bg-success me-2">Income: $${monthIncome.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                        <span class="badge bg-danger">Expenses: $${monthTotal.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                    </div>
                    <span class="text-muted">${monthExpenses.length} transactions</span>
                </div>
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th style="width: 30px;"></th>
                                ${renderSortableHeader('month-' + month, 'date', 'Date')}
                                ${renderSortableHeader('month-' + month, 'description', 'Description')}
                                ${renderSortableHeader('month-' + month, 'account', 'Account')}
                                ${renderSortableHeader('month-' + month, 'category', 'Category')}
                                ${renderSortableHeader('month-' + month, 'type', 'Type')}
                                ${renderSortableHeader('month-' + month, 'amount', 'Amount', 'text-end')}
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="month-tbody-${month}">
                            ${sortExpenses(monthExpenses, 'month-' + month).map(expense => createExpenseRow(expense)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }).join('');
}

function renderSortableHeader(tableKey, column, label, extraClass) {
    const cls = extraClass ? ` class="${extraClass}"` : '';
    return `<th${cls} style="cursor: pointer; user-select: none;" onclick="toggleSort('${tableKey}', '${column}', function() { rerenderMonthTable('${tableKey}'); })">${label} ${getSortIcon(tableKey, column)}</th>`;
}

function rerenderMonthTable(tableKey) {
    const month = tableKey.replace('month-', '');
    const expenses = window._expensesByMonth && window._expensesByMonth[month];
    if (!expenses) return;

    // Re-render the tbody
    const tbody = document.getElementById('month-tbody-' + month);
    if (tbody) {
        tbody.innerHTML = sortExpenses(expenses, tableKey).map(expense => createExpenseRow(expense)).join('');
    }

    // Re-render the thead to update sort icons
    const table = tbody.closest('table');
    if (table) {
        const thead = table.querySelector('thead tr');
        if (thead) {
            thead.innerHTML = `
                <th style="width: 30px;"></th>
                ${renderSortableHeader(tableKey, 'date', 'Date')}
                ${renderSortableHeader(tableKey, 'description', 'Description')}
                ${renderSortableHeader(tableKey, 'account', 'Account')}
                ${renderSortableHeader(tableKey, 'category', 'Category')}
                ${renderSortableHeader(tableKey, 'type', 'Type')}
                ${renderSortableHeader(tableKey, 'amount', 'Amount', 'text-end')}
                <th>Actions</th>
            `;
        }
    }
}

function createExpenseRow(expense) {
    const isIncome = expense.transaction_type === 'income';
    const amountClass = isIncome ? 'text-success' : 'text-danger';
    const amountPrefix = isIncome ? '+' : '-';
    const typeIcon = expense.is_essential ? '✓ Essential' : '◆ Optional';
    const typeBadgeClass = expense.is_essential ? 'bg-success' : 'bg-secondary';
    const isSelected = selectedExpenses.has(expense.id);

    return `
        <tr class="${isSelected ? 'table-primary' : ''}" data-expense-id="${expense.id}">
            <td>
                <input type="checkbox" class="form-check-input expense-checkbox"
                       data-id="${expense.id}"
                       data-amount="${expense.amount}"
                       ${isSelected ? 'checked' : ''}
                       onchange="toggleExpenseSelection(${expense.id}, ${expense.amount}, this.checked)">
            </td>
            <td>${formatDate(expense.date)}</td>
            <td>
                <span title="${expense.description}">${truncateText(expense.description, 40)}</span>
                ${expense.notes ? '<i class="bi bi-sticky-fill text-warning ms-1" style="font-size: 0.7em; cursor: help;" title="' + escapeHtml(expense.notes) + '"></i>' : ''}
            </td>
            <td>
                ${expense.source_account ? `<span class="badge bg-info" style="font-size: 0.75rem;">${expense.source_account}</span>` : ''}
            </td>
            <td>
                <span class="badge category-badge" style="background-color: ${getCategoryColor(expense.category_id)}; cursor: pointer;"
                      onclick="showCategoryEditor(${expense.id}, '${escapeHtml(expense.description)}', ${expense.category_id || 'null'}, ${expense.is_essential}, '${escapeHtml(expense.notes || '')}')">
                    ${expense.category} <i class="bi bi-pencil-fill" style="font-size: 0.6em;"></i>
                </span>
            </td>
            <td><span class="badge ${typeBadgeClass}" style="font-size: 0.75rem;">${typeIcon}</span></td>
            <td class="text-end">
                <strong class="${amountClass}">${amountPrefix}$${expense.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-secondary" onclick="showCategoryEditor(${expense.id}, '${escapeHtml(expense.description)}', ${expense.category_id || 'null'}, ${expense.is_essential}, '${escapeHtml(expense.notes || '')}')" title="Edit Category">
                    <i class="bi bi-tag"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteExpense(${expense.id})" title="Delete">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `;
}

// ============ SELECTION TALLY ============
function toggleExpenseSelection(id, amount, isChecked) {
    if (isChecked) {
        selectedExpenses.add(id);
    } else {
        selectedExpenses.delete(id);
    }
    updateSelectionTally();
}

function updateSelectionTally() {
    const tallyBar = document.getElementById('selection-tally-bar');
    if (!tallyBar) return;

    if (selectedExpenses.size === 0) {
        tallyBar.style.display = 'none';
        return;
    }

    tallyBar.style.display = 'block';

    // Calculate total
    let total = 0;
    selectedExpenses.forEach(id => {
        const expense = allExpenses.find(e => e.id === id);
        if (expense) total += expense.amount;
    });

    document.getElementById('selection-count').textContent = selectedExpenses.size;
    document.getElementById('selection-total').textContent = `$${total.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
}

function clearSelection() {
    selectedExpenses.clear();
    updateSelectionTally();
    // Uncheck all checkboxes
    document.querySelectorAll('.expense-checkbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('tr[data-expense-id]').forEach(row => row.classList.remove('table-primary'));
}

// ============ CATEGORY EDITOR ============
function showCategoryEditor(expenseId, description, currentCategoryId, isEssential, currentNotes) {
    const categoryOptions = categories.map(cat =>
        `<option value="${cat.id}" ${cat.id === currentCategoryId ? 'selected' : ''}>${cat.name}</option>`
    ).join('');

    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'categoryEditorModal';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Edit Category</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p><strong>Transaction:</strong> ${description}</p>
                    <div class="mb-3">
                        <label class="form-label">Category</label>
                        <select class="form-select" id="edit-category">
                            <option value="">Uncategorized</option>
                            ${categoryOptions}
                        </select>
                    </div>
                    <div class="mb-3">
                        <div class="form-check">
                            <input type="checkbox" class="form-check-input" id="edit-essential" ${isEssential ? 'checked' : ''}>
                            <label class="form-check-label" for="edit-essential">Mark as Essential</label>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Notes</label>
                        <textarea class="form-control" id="edit-notes" rows="2" placeholder="Add a note...">${currentNotes || ''}</textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Apply changes to:</label>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="updateScope" id="update-all" value="all" checked>
                            <label class="form-check-label" for="update-all">
                                All transactions with this description
                            </label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="updateScope" id="update-fuzzy" value="fuzzy">
                            <label class="form-check-label" for="update-fuzzy">
                                All similar transactions (fuzzy match)
                            </label>
                        </div>
                        <div id="fuzzy-preview" style="display: none; margin-top: 8px; padding: 8px; border-radius: 6px; background: var(--xero-dark-bg); font-size: 0.85rem;">
                            <small class="text-muted">Checking matches...</small>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="updateScope" id="update-single" value="single">
                            <label class="form-check-label" for="update-single">
                                Only this transaction
                            </label>
                        </div>
                        <small id="notes-scope-hint" class="text-muted" style="display: none;">Note: Notes only apply to this transaction, not bulk updates.</small>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="saveCategoryChanges(${expenseId}, '${escapeHtml(description)}')">
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    // Fuzzy match preview logic
    const fuzzyRadio = document.getElementById('update-fuzzy');
    const fuzzyPreview = document.getElementById('fuzzy-preview');
    const notesHint = document.getElementById('notes-scope-hint');

    fuzzyRadio.addEventListener('change', async function() {
        fuzzyPreview.style.display = 'block';
        notesHint.style.display = 'block';
        fuzzyPreview.innerHTML = '<small class="text-muted"><div class="spinner-border spinner-border-sm me-1"></div> Checking matches...</small>';
        try {
            const resp = await fetch('/api/expenses/fuzzy-match-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: description })
            });
            const data = await resp.json();
            fuzzyPreview.dataset.keywords = data.keywords;
            fuzzyPreview.innerHTML = `
                <small><strong>Keywords:</strong> "${data.keywords}"</small><br>
                <small><strong>Found:</strong> ${data.match_count} matching transaction(s)</small>
                ${data.sample_descriptions.slice(0, 5).map(d =>
                    '<br><small class="text-muted">- ' + truncateText(d, 60) + '</small>'
                ).join('')}
                ${data.sample_descriptions.length > 5 ? '<br><small class="text-muted">...</small>' : ''}
            `;
        } catch (err) {
            fuzzyPreview.innerHTML = '<small class="text-danger">Error loading preview</small>';
        }
    });

    document.getElementById('update-all').addEventListener('change', () => {
        fuzzyPreview.style.display = 'none';
        notesHint.style.display = 'block';
    });
    document.getElementById('update-single').addEventListener('change', () => {
        fuzzyPreview.style.display = 'none';
        notesHint.style.display = 'none';
    });

    modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
    });
}

async function saveCategoryChanges(expenseId, description) {
    const categoryId = document.getElementById('edit-category').value || null;
    const isEssential = document.getElementById('edit-essential').checked;
    const notes = document.getElementById('edit-notes')?.value || '';
    const updateScope = document.querySelector('input[name="updateScope"]:checked').value;

    try {
        let response;
        if (updateScope === 'single') {
            // Update only this transaction (including notes)
            response = await fetch(`/api/expenses/${expenseId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category_id: categoryId ? parseInt(categoryId) : null,
                    is_essential: isEssential,
                    notes: notes
                })
            });
        } else if (updateScope === 'fuzzy') {
            // Fuzzy match - update all similar transactions
            const fuzzyKeywords = document.getElementById('fuzzy-preview')?.dataset?.keywords;
            response = await fetch('/api/expenses/bulk-update-category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: description,
                    category_id: categoryId ? parseInt(categoryId) : null,
                    is_essential: isEssential,
                    match_mode: 'fuzzy',
                    fuzzy_keywords: fuzzyKeywords
                })
            });
            // Also update notes on the specific transaction if provided
            if (notes) {
                await fetch(`/api/expenses/${expenseId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notes: notes })
                });
            }
        } else {
            // Update all matching transactions (exact match)
            response = await fetch('/api/expenses/bulk-update-category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: description,
                    category_id: categoryId ? parseInt(categoryId) : null,
                    is_essential: isEssential
                })
            });
            // Also update notes on the specific transaction if provided
            if (notes) {
                await fetch(`/api/expenses/${expenseId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notes: notes })
                });
            }
        }

        const result = await response.json();

        if (response.ok) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('categoryEditorModal'));
            modal.hide();

            const count = result.count || 1;
            showToast(`Updated ${count} transaction(s)`, 'success');

            await loadExpenses();
            loadStatistics(currentPeriod);
        } else {
            showToast(result.error || 'Failed to update', 'danger');
        }
    } catch (error) {
        console.error('Error updating category:', error);
        showToast('Error updating category', 'danger');
    }
}

async function updateCategoryBulk(description) {
    const categoryId = document.getElementById('edit-category').value || null;
    const isEssential = document.getElementById('edit-essential').checked;

    try {
        const response = await fetch('/api/expenses/bulk-update-category', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description: description,
                category_id: categoryId ? parseInt(categoryId) : null,
                is_essential: isEssential
            })
        });

        const result = await response.json();

        if (response.ok) {
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('categoryEditorModal'));
            modal.hide();

            // Show success message
            showToast(`Updated ${result.count} transaction(s)`, 'success');

            // Reload data
            await loadExpenses();
            loadStatistics(currentPeriod);
        } else {
            showToast(result.error || 'Failed to update', 'danger');
        }
    } catch (error) {
        console.error('Error updating category:', error);
        showToast('Error updating category', 'danger');
    }
}

// ============ ADD EXPENSE ============
async function handleExpenseSubmit(e) {
    e.preventDefault();

    const tags = document.getElementById('tags').value.split(',').map(t => t.trim()).filter(t => t.length > 0);
    const isRecurring = document.getElementById('is-recurring').checked;
    const transactionType = document.querySelector('input[name="transaction-type"]:checked')?.value || 'expense';

    const expenseData = {
        description: document.getElementById('description').value,
        amount: parseFloat(document.getElementById('amount').value),
        date: document.getElementById('date').value,
        category_id: document.getElementById('category').value || null,
        tags: tags,
        is_recurring: isRecurring,
        recurring_frequency: isRecurring ? document.getElementById('recurring-frequency').value : null,
        is_essential: false,
        transaction_type: transactionType,
        notes: document.getElementById('notes')?.value || ''
    };

    try {
        const response = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(expenseData)
        });

        if (response.ok) {
            // Reset form
            document.getElementById('expense-form').reset();
            document.getElementById('date').valueAsDate = new Date();
            document.getElementById('recurring-options').style.display = 'none';
            // Reset transaction type to expense (default)
            document.getElementById('type-expense').checked = true;

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addExpenseModal'));
            if (modal) modal.hide();

            // Reload data
            await loadExpenses();
            loadStatistics(currentPeriod);

            showToast(`${transactionType === 'income' ? 'Income' : 'Expense'} added successfully`, 'success');
        }
    } catch (error) {
        console.error('Error adding expense:', error);
        showToast('Error adding transaction', 'danger');
    }
}

async function deleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
        const response = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
        if (response.ok) {
            selectedExpenses.delete(id);
            await loadExpenses();
            loadStatistics(currentPeriod);
            updateSelectionTally();
            showToast('Expense deleted', 'success');
        }
    } catch (error) {
        console.error('Error deleting expense:', error);
    }
}

// ============ STATISTICS ============
async function loadStatistics(period = 'month') {
    currentPeriod = period;

    // Use statsYear for the statistics cards (set by toggle)
    const selectedYear = statsYear;

    try {
        const response = await fetch(`/api/statistics?period=${period}&year=${selectedYear}`);
        const stats = await response.json();

        // Update dashboard cards (year totals)
        const totalIncome = document.getElementById('total-income');
        if (totalIncome) totalIncome.textContent = `$${stats.year_income.toLocaleString('en-US', {minimumFractionDigits: 2})}`;

        const totalExpenses = document.getElementById('total-expenses');
        if (totalExpenses) totalExpenses.textContent = `$${stats.year_expenses.toLocaleString('en-US', {minimumFractionDigits: 2})}`;

        const netPosition = document.getElementById('net-position');
        if (netPosition) {
            netPosition.textContent = `$${stats.year_net.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            netPosition.style.color = stats.year_net >= 0 ? '#10b981' : '#ef4444';
        }

        // Month totals
        const monthIncomeText = document.getElementById('month-income-text');
        if (monthIncomeText) monthIncomeText.textContent = `Month: $${stats.month_income.toLocaleString('en-US', {minimumFractionDigits: 0})}`;

        const monthExpensesText = document.getElementById('month-expenses-text');
        if (monthExpensesText) monthExpensesText.textContent = `Month: $${stats.month_expenses.toLocaleString('en-US', {minimumFractionDigits: 0})}`;

        const monthNetText = document.getElementById('month-net-text');
        if (monthNetText) monthNetText.textContent = `Month: $${stats.month_net.toLocaleString('en-US', {minimumFractionDigits: 0})}`;

        // Essential/Optional
        const essentialExpenses = document.getElementById('essential-expenses');
        if (essentialExpenses) essentialExpenses.textContent = `$${stats.essential_total.toLocaleString('en-US', {minimumFractionDigits: 2})}`;

        const optionalExpenses = document.getElementById('optional-expenses');
        if (optionalExpenses) optionalExpenses.textContent = `$${stats.optional_total.toLocaleString('en-US', {minimumFractionDigits: 2})}`;

        // Update charts
        updateCategoryChart(stats.by_category);
        updateTrendChart(stats.monthly_trend);

        // Update category breakdown
        updateCategoryBreakdown(stats.by_category);

    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

function updateCategoryChart(categoryData) {
    const ctx = document.getElementById('category-chart');
    if (!ctx) return;

    if (categoryChart) categoryChart.destroy();

    // Filter out income for the pie chart
    const expenseCategories = Object.entries(categoryData).filter(([name, data]) => name !== 'Income');
    const labels = expenseCategories.map(([name]) => name);
    const data = expenseCategories.map(([, data]) => data.amount);
    const colors = expenseCategories.map(([, data]) => data.color);

    if (labels.length === 0) {
        ctx.parentElement.innerHTML = '<p class="text-muted text-center">No expense data yet</p>';
        return;
    }

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#1a1a2e'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#b0b0b0' }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: $${context.parsed.toLocaleString('en-US', {minimumFractionDigits: 2})} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function updateTrendChart(trendData) {
    const ctx = document.getElementById('trend-chart');
    if (!ctx) return;

    if (trendChart) trendChart.destroy();

    const labels = trendData.map(d => d.month);
    const incomeData = trendData.map(d => d.income);
    const expenseData = trendData.map(d => d.expenses);
    const netData = trendData.map(d => d.net);

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Income',
                    data: incomeData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'Expenses',
                    data: expenseData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'Net',
                    data: netData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.3,
                    fill: true,
                    borderDash: [5, 5]
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#b0b0b0' }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: $${context.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: {
                        color: '#b0b0b0',
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                },
                x: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#b0b0b0' }
                }
            }
        }
    });
}

// ============ CATEGORY BREAKDOWN ============
function updateCategoryBreakdown(categoryData) {
    const container = document.getElementById('category-breakdown-list');
    if (!container) return;

    // Sort categories by amount (descending)
    const sortedCategories = Object.entries(categoryData)
        .filter(([name]) => name !== 'Income')
        .sort((a, b) => b[1].amount - a[1].amount);

    if (sortedCategories.length === 0) {
        container.innerHTML = '<p class="text-muted text-center p-3">No expense data for this period</p>';
        return;
    }

    const total = sortedCategories.reduce((sum, [, data]) => sum + data.amount, 0);

    container.innerHTML = sortedCategories.map(([name, data]) => {
        const percentage = total > 0 ? ((data.amount / total) * 100).toFixed(1) : 0;
        return `
            <div class="category-breakdown-item" onclick="toggleCategoryBreakdown(this, '${escapeHtml(name)}')">
                <div class="category-breakdown-header">
                    <div class="category-info">
                        <span class="category-color-dot" style="background-color: ${data.color}"></span>
                        <div>
                            <strong>${name}</strong>
                            <small class="text-muted d-block">${data.count} transaction${data.count !== 1 ? 's' : ''}</small>
                        </div>
                    </div>
                    <div class="category-stats">
                        <strong class="text-danger">$${data.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                        <small class="text-muted d-block">${percentage}%</small>
                    </div>
                    <i class="bi bi-chevron-down expand-icon"></i>
                </div>
                <div class="category-transactions" data-category="${escapeHtml(name)}">
                    <div class="text-center text-muted py-2">
                        <div class="spinner-border spinner-border-sm"></div> Loading...
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function toggleCategoryBreakdown(element, categoryName) {
    const isExpanded = element.classList.contains('expanded');

    // Collapse all other items
    document.querySelectorAll('.category-breakdown-item.expanded').forEach(item => {
        if (item !== element) item.classList.remove('expanded');
    });

    // Toggle this item
    element.classList.toggle('expanded');

    // If expanding and not yet loaded, load the transactions
    if (!isExpanded) {
        const transactionsDiv = element.querySelector('.category-transactions');

        // Filter expenses for this category from allExpenses
        const categoryExpenses = allExpenses.filter(exp =>
            exp.category === categoryName &&
            exp.transaction_type === 'expense'
        ).slice(0, 20); // Limit to 20 for performance

        if (categoryExpenses.length === 0) {
            transactionsDiv.innerHTML = '<p class="text-muted text-center py-2">No transactions</p>';
            return;
        }

        transactionsDiv.innerHTML = categoryExpenses.map(exp => `
            <div class="category-transaction-row" data-expense-id="${exp.id}">
                <div style="flex: 1; min-width: 0;">
                    <span class="text-muted">${formatDate(exp.date)}</span>
                    <span class="ms-2">${truncateText(exp.description, 35)}</span>
                    ${exp.notes ? '<i class="bi bi-sticky-fill text-warning ms-1" style="font-size: 0.65em; cursor: help;" title="' + escapeHtml(exp.notes || '') + '"></i>' : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                    <strong class="text-danger">-$${exp.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                    <button class="btn btn-sm btn-outline-secondary" style="padding: 0.1rem 0.4rem; font-size: 0.75rem;"
                            onclick="event.stopPropagation(); showCategoryEditor(${exp.id}, '${escapeHtml(exp.description)}', ${exp.category_id || 'null'}, ${exp.is_essential}, '${escapeHtml(exp.notes || '')}')"
                            title="Edit Category">
                        <i class="bi bi-tag"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" style="padding: 0.1rem 0.4rem; font-size: 0.75rem;"
                            onclick="event.stopPropagation(); deleteExpense(${exp.id})"
                            title="Delete">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
}

// ============ CASH POSITION & RUNWAY ============
async function loadCashRunway() {
    try {
        const response = await fetch('/api/cash-position/runway');
        const data = await response.json();

        const currentCash = document.getElementById('current-cash');
        if (currentCash) {
            currentCash.textContent = `$${data.current_cash.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        }

        const cashDate = document.getElementById('cash-date');
        if (cashDate) {
            cashDate.textContent = data.current_cash_date ? `as of ${formatDate(data.current_cash_date)}` : 'No data';
        }

        const runwayMonths = document.getElementById('runway-months');
        if (runwayMonths) {
            if (data.runway_months === null) {
                runwayMonths.textContent = '∞ months';
                runwayMonths.style.color = '#10b981';
            } else {
                runwayMonths.textContent = `${data.runway_months} months`;
                runwayMonths.style.color = data.runway_months > 6 ? '#10b981' : data.runway_months > 3 ? '#f59e0b' : '#ef4444';
            }
        }

        const runwayDate = document.getElementById('runway-date');
        if (runwayDate) {
            runwayDate.textContent = data.runway_date ? `until ${formatDate(data.runway_date)}` : '--';
        }

        const monthlyBurn = document.getElementById('monthly-burn');
        if (monthlyBurn) {
            monthlyBurn.textContent = `$${data.monthly_burn.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        }

    } catch (error) {
        console.error('Error loading cash runway:', error);
    }
}

function showAddCashPositionModal() {
    document.getElementById('cash-date-input').valueAsDate = new Date();
    const modal = new bootstrap.Modal(document.getElementById('addCashPositionModal'));
    modal.show();
}

async function handleCashPositionSubmit(e) {
    e.preventDefault();

    const data = {
        date: document.getElementById('cash-date-input').value,
        amount: parseFloat(document.getElementById('cash-amount-input').value),
        notes: document.getElementById('cash-notes-input').value || ''
    };

    try {
        const response = await fetch('/api/cash-position', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('addCashPositionModal'));
            modal.hide();
            document.getElementById('cash-position-form').reset();
            loadCashRunway();
            showToast('Cash position updated', 'success');
        }
    } catch (error) {
        console.error('Error saving cash position:', error);
        showToast('Error saving cash position', 'danger');
    }
}

async function showCashHistoryModal() {
    try {
        const response = await fetch('/api/cash-position');
        const positions = await response.json();
        window._cashPositions = positions;

        renderCashHistoryTable();

        const modal = new bootstrap.Modal(document.getElementById('cashHistoryModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading cash history:', error);
    }
}

function renderCashHistoryTable() {
    const positions = window._cashPositions;
    if (!positions) return;

    const sorted = sortCashPositions(positions);

    function cashHeader(col, label, extraClass) {
        const cls = extraClass ? ` class="${extraClass}"` : '';
        return `<th${cls} style="cursor: pointer; user-select: none;" onclick="toggleSort('cash', '${col}', renderCashHistoryTable)">${label} ${getSortIcon('cash', col)}</th>`;
    }

    const thead = document.getElementById('cash-history-thead');
    if (thead) {
        thead.innerHTML = `<tr>${cashHeader('date', 'Date')}${cashHeader('amount', 'Amount')}${cashHeader('notes', 'Notes')}<th>Actions</th></tr>`;
    }

    const tbody = document.getElementById('cash-history-table');
    if (tbody) {
        tbody.innerHTML = sorted.map(p => `
            <tr>
                <td>${formatDate(p.date)}</td>
                <td><strong>$${p.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></td>
                <td>${p.notes || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteCashPosition(${p.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="4" class="text-muted text-center">No history</td></tr>';
    }
}

function sortCashPositions(positions) {
    const state = sortState['cash'];
    if (!state) return positions;

    const sorted = [...positions];
    const dir = state.direction === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
        switch (state.column) {
            case 'date':
                return dir * (a.date || '').localeCompare(b.date || '');
            case 'amount':
                return dir * (a.amount - b.amount);
            case 'notes':
                return dir * (a.notes || '').localeCompare(b.notes || '');
            default:
                return 0;
        }
    });
    return sorted;
}

async function deleteCashPosition(id) {
    if (!confirm('Delete this cash position entry?')) return;

    try {
        const response = await fetch(`/api/cash-position/${id}`, { method: 'DELETE' });
        if (response.ok) {
            showCashHistoryModal(); // Refresh
            loadCashRunway();
        }
    } catch (error) {
        console.error('Error deleting cash position:', error);
    }
}

// ============ IMPORT ============
async function handleImportSubmit(e) {
    e.preventDefault();

    const fileInput = document.getElementById('csv-file');
    const files = fileInput.files;

    if (files.length === 0) return;

    const resultDiv = document.getElementById('import-result');
    resultDiv.innerHTML = '<div class="alert alert-info">Importing...</div>';

    let totalImported = 0;
    let allErrors = [];

    for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/import-csv', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                totalImported += result.imported;
                if (result.errors && result.errors.length > 0) {
                    allErrors = allErrors.concat(result.errors.map(e => `${file.name}: ${e}`));
                }
            } else {
                allErrors.push(`${file.name}: ${result.error}`);
            }
        } catch (error) {
            allErrors.push(`${file.name}: ${error.message}`);
        }
    }

    // Show results
    let message = `<div class="alert alert-success">Successfully imported ${totalImported} transactions from ${files.length} file(s)</div>`;

    if (allErrors.length > 0) {
        message += '<div class="alert alert-warning"><strong>Warnings/Errors:</strong><ul>';
        allErrors.slice(0, 10).forEach(error => {
            message += `<li>${error}</li>`;
        });
        if (allErrors.length > 10) {
            message += `<li>... and ${allErrors.length - 10} more</li>`;
        }
        message += '</ul></div>';
    }

    resultDiv.innerHTML = message;
    fileInput.value = '';

    // Reload data
    await loadExpenses();
    loadStatistics(currentPeriod);
    loadCashRunway();
}

// ============ DELETE ALL ============
async function confirmDeleteAll() {
    if (!confirm('Are you sure you want to delete ALL expenses? This cannot be undone!')) return;
    if (!confirm('FINAL WARNING: This will permanently delete all your transaction data. Continue?')) return;

    try {
        const response = await fetch('/api/expenses/delete-all', { method: 'POST' });
        const result = await response.json();

        if (response.ok) {
            showToast(`Deleted ${result.count} expenses`, 'success');
            await loadExpenses();
            loadStatistics(currentPeriod);
        } else {
            showToast(result.error || 'Failed to delete', 'danger');
        }
    } catch (error) {
        console.error('Error deleting all expenses:', error);
        showToast('Error deleting expenses', 'danger');
    }
}

// ============ REPORTS PERIOD SELECTOR ============
function selectPeriod(period) {
    document.querySelectorAll('.period-selector button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`period-${period}`).classList.add('active');
    document.getElementById('month-selector').value = '';
    loadStatistics(period);
}

function selectSpecificMonth() {
    const monthValue = document.getElementById('month-selector').value;
    if (monthValue) {
        document.querySelectorAll('.period-selector button').forEach(btn => btn.classList.remove('active'));
        loadStatistics(`custom-${monthValue}`);
    }
}

function populateMonthSelector() {
    const selector = document.getElementById('month-selector');
    if (!selector) return;

    const months = [];
    const now = new Date();

    for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        months.push({ value, label });
    }

    selector.innerHTML = '<option value="">Select a month...</option>' +
        months.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
}

// ============ FILTER BY TRANSACTION TYPE (from dashboard cards) ============
function filterByTransactionType(type) {
    const filter = document.getElementById('filter-transaction-type');
    if (filter) {
        filter.value = type;
        filterAndDisplayExpenses();

        // Switch to transactions tab
        const transactionsTab = document.querySelector('[data-bs-target="#expenses-tab"]');
        if (transactionsTab) {
            new bootstrap.Tab(transactionsTab).show();
        }
    }
}

function clearFilters() {
    const search = document.getElementById('search-expenses');
    const year = document.getElementById('filter-year');
    const category = document.getElementById('filter-category');
    const type = document.getElementById('filter-type');
    const transactionType = document.getElementById('filter-transaction-type');
    const amountMin = document.getElementById('filter-amount-min');
    const amountMax = document.getElementById('filter-amount-max');

    if (search) search.value = '';
    if (year) year.value = '';  // Show all years by default
    if (category) category.value = '';
    if (type) type.value = '';
    if (transactionType) transactionType.value = '';
    if (amountMin) amountMin.value = '';
    if (amountMax) amountMax.value = '';

    filterAndDisplayExpenses();
}

// ============ UTILITY FUNCTIONS ============
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getCategoryColor(categoryId) {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.color : '#95a5a6';
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'position-fixed top-0 end-0 p-3';
        container.style.zIndex = '1100';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;

    container.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
    bsToast.show();

    toast.addEventListener('hidden.bs.toast', () => toast.remove());
}

// ==========================================
// PDF Export Functionality
// ==========================================

let currentExportPeriod = 'year';

// Initialize export month selector
function populateExportMonthSelector() {
    const monthSelector = document.getElementById('export-month-selector');
    if (!monthSelector) return;

    const today = new Date();
    for (let i = 0; i < 24; i++) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

        const option = document.createElement('option');
        option.value = monthKey;
        option.textContent = monthLabel;
        monthSelector.appendChild(option);
    }
}

// Set export period from button click
function setExportPeriod(period, buttonElement) {
    currentExportPeriod = period;

    // Update button states
    document.querySelectorAll('#export-period-buttons button').forEach(btn => {
        btn.classList.remove('active');
    });
    if (buttonElement) {
        buttonElement.classList.add('active');
    }

    // Clear month selector and custom date range
    const monthSelector = document.getElementById('export-month-selector');
    if (monthSelector) {
        monthSelector.value = '';
    }

    // Uncheck custom date range
    const customRangeCheckbox = document.getElementById('export-custom-range');
    if (customRangeCheckbox) {
        customRangeCheckbox.checked = false;
        document.getElementById('custom-date-range-inputs').style.display = 'none';
    }
}

// Set export period from custom month selector
function setExportCustomMonth() {
    const selector = document.getElementById('export-month-selector');
    if (selector && selector.value) {
        currentExportPeriod = `custom-${selector.value}`;

        // Remove active from period buttons
        document.querySelectorAll('#export-period-buttons button').forEach(btn => {
            btn.classList.remove('active');
        });

        // Uncheck custom date range
        const customRangeCheckbox = document.getElementById('export-custom-range');
        if (customRangeCheckbox) {
            customRangeCheckbox.checked = false;
            document.getElementById('custom-date-range-inputs').style.display = 'none';
        }
    }
}

// Toggle custom date range inputs visibility
function toggleCustomDateRange() {
    const checkbox = document.getElementById('export-custom-range');
    const inputs = document.getElementById('custom-date-range-inputs');

    if (checkbox.checked) {
        inputs.style.display = 'flex';

        // Remove active from period buttons
        document.querySelectorAll('#export-period-buttons button').forEach(btn => {
            btn.classList.remove('active');
        });

        // Clear month selector
        const monthSelector = document.getElementById('export-month-selector');
        if (monthSelector) {
            monthSelector.value = '';
        }

        // Set default dates if empty
        const startInput = document.getElementById('export-start-date');
        const endInput = document.getElementById('export-end-date');
        if (!startInput.value) {
            const today = new Date();
            const firstOfYear = new Date(today.getFullYear(), 0, 1);
            startInput.value = firstOfYear.toISOString().split('T')[0];
        }
        if (!endInput.value) {
            endInput.value = new Date().toISOString().split('T')[0];
        }

        updateCustomDateRange();
    } else {
        inputs.style.display = 'none';
        // Reset to year to date
        setExportPeriod('year', document.querySelector('#export-period-buttons button:nth-child(3)'));
    }
}

// Update period when custom date range changes
function updateCustomDateRange() {
    const startDate = document.getElementById('export-start-date').value;
    const endDate = document.getElementById('export-end-date').value;

    if (startDate && endDate) {
        currentExportPeriod = `range-${startDate}_${endDate}`;
    }
}

// Generate and download PDF
async function generatePDFExport() {
    const statusDiv = document.getElementById('export-status');
    statusDiv.innerHTML = '<div class="alert alert-info"><i class="bi bi-hourglass-split me-2"></i>Generating PDF...</div>';

    const sections = {
        summary: document.getElementById('export-summary').checked,
        essential_optional: document.getElementById('export-essential').checked,
        category_breakdown: document.getElementById('export-categories').checked,
        monthly_trend: document.getElementById('export-trend').checked
    };

    // Validate at least one section selected
    if (!Object.values(sections).some(v => v)) {
        statusDiv.innerHTML = '<div class="alert alert-warning">Please select at least one section to include in the report.</div>';
        return;
    }

    const payload = {
        period: currentExportPeriod,
        sections: sections,
        title: document.getElementById('export-title').value || 'Financial Report'
    };

    try {
        const response = await fetch('/api/export/pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `balance_sheet_report_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            statusDiv.innerHTML = '<div class="alert alert-success"><i class="bi bi-check-circle me-2"></i>PDF downloaded successfully!</div>';
            setTimeout(() => { statusDiv.innerHTML = ''; }, 3000);
        } else {
            const error = await response.json();
            statusDiv.innerHTML = `<div class="alert alert-danger">Error: ${error.error || 'Failed to generate PDF'}</div>`;
        }
    } catch (error) {
        console.error('Export error:', error);
        statusDiv.innerHTML = '<div class="alert alert-danger"><i class="bi bi-x-circle me-2"></i>Error generating PDF. Please try again.</div>';
    }
}

// ==========================================
// Duplicate Detection Functions
// ==========================================

async function scanForDuplicates() {
    const resultsDiv = document.getElementById('duplicates-results');
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = '<div class="d-flex align-items-center"><div class="spinner-border spinner-border-sm me-2"></div> Scanning for duplicates...</div>';

    try {
        const response = await fetch('/api/duplicates');
        const data = await response.json();

        if (data.duplicates.length === 0) {
            resultsDiv.innerHTML = '<div class="alert alert-success mb-0"><i class="bi bi-check-circle me-2"></i>No duplicates found! Your data is clean.</div>';
            return;
        }

        // Display duplicate groups with checkboxes to select which to remove
        let html = `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle me-2"></i>Found <strong>${data.total_groups}</strong> duplicate groups</div>`;
        html += '<div class="list-group">';

        for (const group of data.duplicates) {
            const formattedDate = new Date(group.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <strong>${group.description}</strong><br>
                            <small class="text-muted">${formattedDate} • $${parseFloat(group.amount).toFixed(2)} • ${group.count} copies</small>
                        </div>
                        <button class="btn btn-sm btn-outline-danger" onclick="selectAllDuplicates(this, [${group.items.slice(1).map(i => i.id).join(',')}])">
                            Select Duplicates
                        </button>
                    </div>
                    <div class="small">
            `;

            for (const item of group.items) {
                html += `
                    <div class="form-check">
                        <input class="form-check-input duplicate-checkbox" type="checkbox" value="${item.id}" id="dup-${item.id}">
                        <label class="form-check-label" for="dup-${item.id}">
                            ${item.description.substring(0, 50)}${item.description.length > 50 ? '...' : ''}
                            <span class="text-muted">(${item.source_account || 'Unknown source'}, ${item.category})</span>
                        </label>
                    </div>
                `;
            }

            html += '</div></div>';
        }

        html += '</div>';
        html += `
            <div class="mt-3">
                <button class="btn btn-danger" onclick="removeDuplicates()">
                    <i class="bi bi-trash me-2"></i>Remove Selected Duplicates
                </button>
            </div>
        `;

        resultsDiv.innerHTML = html;
    } catch (error) {
        console.error('Error scanning for duplicates:', error);
        resultsDiv.innerHTML = '<div class="alert alert-danger">Error scanning for duplicates. Please try again.</div>';
    }
}

function selectAllDuplicates(button, ids) {
    ids.forEach(id => {
        const checkbox = document.getElementById(`dup-${id}`);
        if (checkbox) checkbox.checked = true;
    });
}

async function removeDuplicates() {
    const checkboxes = document.querySelectorAll('.duplicate-checkbox:checked');
    const ids = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (ids.length === 0) {
        showToast('No duplicates selected', 'warning');
        return;
    }

    if (!confirm(`Remove ${ids.length} duplicate transaction(s)?`)) return;

    try {
        const response = await fetch('/api/duplicates/remove', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: ids })
        });

        const result = await response.json();

        if (response.ok) {
            showToast(`Removed ${result.removed_count} duplicate(s)`, 'success');
            await loadExpenses();
            loadStatistics(currentPeriod);
            scanForDuplicates(); // Refresh the scan
        } else {
            showToast(result.error || 'Failed to remove duplicates', 'danger');
        }
    } catch (error) {
        console.error('Error removing duplicates:', error);
        showToast('Error removing duplicates', 'danger');
    }
}

// ==========================================
// Service Station Recategorization
// ==========================================

async function recategorizeServiceStations() {
    if (!confirm('This will automatically recategorize service station transactions based on amount:\n\n• $40+ = Transportation (fuel)\n• Under $40 = Food & Dining (convenience store)\n\nContinue?')) {
        return;
    }

    try {
        const response = await fetch('/api/expenses/recategorize-service-stations', {
            method: 'POST'
        });

        const result = await response.json();

        if (response.ok) {
            showToast(`Recategorized ${result.updated_to_transport + result.updated_to_food} transactions`, 'success');
            await loadExpenses();
            loadStatistics(currentPeriod);
        } else {
            showToast(result.error || 'Failed to recategorize', 'danger');
        }
    } catch (error) {
        console.error('Error recategorizing:', error);
        showToast('Error recategorizing service stations', 'danger');
    }
}

// ==========================================
// Bulk Edit Functions
// ==========================================

function bulkEditCategory() {
    if (selectedExpenses.size === 0) {
        showToast('No transactions selected', 'warning');
        return;
    }

    // Create modal with category dropdown
    const categoryOptions = categories.map(cat =>
        `<option value="${cat.id}">${cat.name}</option>`
    ).join('');

    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'bulkCategoryModal';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Bulk Update Category</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>Update category for <strong>${selectedExpenses.size}</strong> selected transactions.</p>
                    <div class="mb-3">
                        <label class="form-label">Category</label>
                        <select class="form-select" id="bulk-category-select">
                            <option value="">Uncategorized</option>
                            ${categoryOptions}
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="applyBulkCategory()">Update</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    modal.addEventListener('hidden.bs.modal', () => modal.remove());
}

async function applyBulkCategory() {
    const categoryId = document.getElementById('bulk-category-select').value;
    const ids = Array.from(selectedExpenses);

    try {
        const response = await fetch('/api/expenses/bulk-update-category', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                expense_ids: ids,
                category_id: categoryId ? parseInt(categoryId) : null
            })
        });

        const result = await response.json();

        if (response.ok) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('bulkCategoryModal'));
            modal.hide();

            showToast(`Updated category for ${result.updated_count || ids.length} transaction(s)`, 'success');

            clearSelection();
            await loadExpenses();
            loadStatistics(currentPeriod);
        } else {
            showToast(result.error || 'Failed to update', 'danger');
        }
    } catch (error) {
        console.error('Error updating category:', error);
        showToast('Error updating category', 'danger');
    }
}

function bulkEditEssential() {
    if (selectedExpenses.size === 0) {
        showToast('No transactions selected', 'warning');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'bulkEssentialModal';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Bulk Update Essential/Optional</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>Update essential status for <strong>${selectedExpenses.size}</strong> selected transactions.</p>
                    <div class="d-grid gap-2">
                        <button class="btn btn-success" onclick="applyBulkEssential(true)">
                            <i class="bi bi-check-circle me-2"></i>Mark as Essential
                        </button>
                        <button class="btn btn-secondary" onclick="applyBulkEssential(false)">
                            <i class="bi bi-circle me-2"></i>Mark as Optional
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    modal.addEventListener('hidden.bs.modal', () => modal.remove());
}

async function applyBulkEssential(isEssential) {
    const ids = Array.from(selectedExpenses);

    try {
        const response = await fetch('/api/expenses/bulk-update-essential', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                expense_ids: ids,
                is_essential: isEssential
            })
        });

        const result = await response.json();

        if (response.ok) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('bulkEssentialModal'));
            modal.hide();

            showToast(`Updated ${result.updated_count} transaction(s) as ${isEssential ? 'essential' : 'optional'}`, 'success');

            clearSelection();
            await loadExpenses();
            loadStatistics(currentPeriod);
        } else {
            showToast(result.error || 'Failed to update', 'danger');
        }
    } catch (error) {
        console.error('Error updating essential status:', error);
        showToast('Error updating essential status', 'danger');
    }
}

function bulkDeleteSelected() {
    if (selectedExpenses.size === 0) {
        showToast('No transactions selected', 'warning');
        return;
    }

    if (!confirm(`Delete ${selectedExpenses.size} selected transaction(s)? This cannot be undone.`)) return;

    const ids = Array.from(selectedExpenses);
    let deleted = 0;

    Promise.all(ids.map(id =>
        fetch(`/api/expenses/${id}`, { method: 'DELETE' })
            .then(res => { if (res.ok) deleted++; })
    )).then(async () => {
        showToast(`Deleted ${deleted} transaction(s)`, 'success');
        clearSelection();
        await loadExpenses();
        loadStatistics(currentPeriod);
    });
}

// ==========================================
// Enhanced Category Management (Settings Tab)
// ==========================================

async function loadCategoryList() {
    try {
        const response = await fetch('/api/categories');
        const cats = await response.json();

        const categoryList = document.getElementById('category-list');
        if (!categoryList) return;

        if (cats.length === 0) {
            categoryList.innerHTML = '<p class="text-muted">No categories found.</p>';
            return;
        }

        categoryList.innerHTML = cats.map(cat => `
            <div class="list-group-item" id="category-item-${cat.id}">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <input type="color" class="form-control form-control-color me-2"
                               value="${cat.color}" style="width: 40px; height: 32px;"
                               onchange="updateCategoryColor(${cat.id}, this.value)">
                        <span class="category-name-display" id="cat-name-${cat.id}">${cat.name}</span>
                        <input type="text" class="form-control category-name-edit d-none"
                               id="cat-edit-${cat.id}" value="${cat.name}"
                               style="width: 200px;"
                               onkeydown="if(event.key==='Enter') saveRenamedCategory(${cat.id}); if(event.key==='Escape') cancelRenameCategory(${cat.id});">
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-secondary" onclick="startRenameCategory(${cat.id})" title="Rename">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="confirmDeleteCategory(${cat.id}, '${cat.name}')" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

function startRenameCategory(id) {
    document.getElementById(`cat-name-${id}`).classList.add('d-none');
    document.getElementById(`cat-edit-${id}`).classList.remove('d-none');
    document.getElementById(`cat-edit-${id}`).focus();
    document.getElementById(`cat-edit-${id}`).select();
}

function cancelRenameCategory(id) {
    const cat = categories.find(c => c.id === id);
    document.getElementById(`cat-edit-${id}`).value = cat ? cat.name : '';
    document.getElementById(`cat-edit-${id}`).classList.add('d-none');
    document.getElementById(`cat-name-${id}`).classList.remove('d-none');
}

async function saveRenamedCategory(id) {
    const newName = document.getElementById(`cat-edit-${id}`).value.trim();
    if (!newName) {
        cancelRenameCategory(id);
        return;
    }

    try {
        const response = await fetch(`/api/categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });

        if (response.ok) {
            showToast('Category renamed', 'success');
            await loadCategories();
            await loadExpenses();
        } else {
            const result = await response.json();
            showToast(result.error || 'Failed to rename', 'danger');
            cancelRenameCategory(id);
        }
    } catch (error) {
        console.error('Error renaming category:', error);
        cancelRenameCategory(id);
    }
}

async function updateCategoryColor(id, color) {
    try {
        const response = await fetch(`/api/categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ color: color })
        });

        if (response.ok) {
            // Update local categories array
            const cat = categories.find(c => c.id === id);
            if (cat) cat.color = color;

            // Refresh expense display to show new color
            filterAndDisplayExpenses();
        }
    } catch (error) {
        console.error('Error updating category color:', error);
    }
}

function confirmDeleteCategory(id, name) {
    if (!confirm(`Delete category "${name}"? All expenses in this category will become "Uncategorized".`)) return;
    deleteCategory(id, name);
}

async function addNewCategory() {
    const name = prompt('Enter new category name:');
    if (!name || !name.trim()) return;

    try {
        const response = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim(), color: '#3498db' })
        });

        if (response.ok) {
            showToast('Category added', 'success');
            await loadCategories();
        } else {
            const result = await response.json();
            showToast(result.error || 'Failed to add category', 'danger');
        }
    } catch (error) {
        console.error('Error adding category:', error);
    }
}

// ============ LEARNED RULES MANAGEMENT ============
async function loadLearnedRules() {
    const container = document.getElementById('learned-rules-list');
    if (!container) return;

    container.innerHTML = '<p class="text-center"><span class="spinner-border spinner-border-sm"></span> Loading...</p>';

    try {
        const response = await fetch('/api/learned-rules');
        const rules = await response.json();

        if (rules.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">No learned rules yet. Edit a transaction\'s category with "Apply to all" to create rules.</p>';
            return;
        }

        window._learnedRules = rules;
        renderLearnedRulesTable();

    } catch (error) {
        console.error('Error loading learned rules:', error);
        container.innerHTML = '<p class="text-danger">Failed to load rules</p>';
    }
}

async function deleteLearnedRule(ruleId) {
    if (!confirm('Delete this categorization rule? Future imports will use automatic categorization for matching transactions.')) {
        return;
    }

    try {
        const response = await fetch(`/api/learned-rules/${ruleId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Rule deleted', 'success');
            loadLearnedRules();
        } else {
            showToast('Failed to delete rule', 'danger');
        }
    } catch (error) {
        console.error('Error deleting rule:', error);
    }
}

function renderLearnedRulesTable() {
    const container = document.getElementById('learned-rules-list');
    const rules = window._learnedRules;
    if (!container || !rules) return;

    const sortedRules = sortLearnedRules(rules);

    function ruleHeader(col, label, extraClass) {
        const cls = extraClass ? ` class="${extraClass}"` : '';
        return `<th${cls} style="cursor: pointer; user-select: none;" onclick="toggleSort('rules', '${col}', renderLearnedRulesTable)">${label} ${getSortIcon('rules', col)}</th>`;
    }

    container.innerHTML = `
        <div class="table-responsive">
            <table class="table table-sm">
                <thead>
                    <tr>
                        ${ruleHeader('pattern', 'Match Pattern')}
                        ${ruleHeader('type', 'Type')}
                        ${ruleHeader('category', 'Category')}
                        ${ruleHeader('essential', 'Essential')}
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedRules.map(rule => `
                        <tr>
                            <td>
                                ${rule.bpay_biller_code
                                    ? `<span class="badge bg-info">BPAY ${rule.bpay_biller_code}</span>`
                                    : `<small>${truncateText(rule.description_pattern || 'N/A', 40)}</small>`
                                }
                            </td>
                            <td><span class="badge bg-${rule.transaction_type === 'income' ? 'success' : 'secondary'}">${rule.transaction_type}</span></td>
                            <td>${rule.category_name}</td>
                            <td>${rule.is_essential ? '<i class="bi bi-check-circle text-success"></i>' : '<i class="bi bi-x-circle text-muted"></i>'}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-danger" onclick="deleteLearnedRule(${rule.id})" title="Delete rule">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <small class="text-muted">${rules.length} rule${rules.length !== 1 ? 's' : ''} saved</small>
    `;
}

function sortLearnedRules(rules) {
    const state = sortState['rules'];
    if (!state) return rules;

    const sorted = [...rules];
    const dir = state.direction === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
        switch (state.column) {
            case 'pattern':
                const pa = a.bpay_biller_code || a.description_pattern || '';
                const pb = b.bpay_biller_code || b.description_pattern || '';
                return dir * pa.localeCompare(pb);
            case 'type':
                return dir * (a.transaction_type || '').localeCompare(b.transaction_type || '');
            case 'category':
                return dir * (a.category_name || '').localeCompare(b.category_name || '');
            case 'essential':
                return dir * ((a.is_essential ? 1 : 0) - (b.is_essential ? 1 : 0));
            default:
                return 0;
        }
    });
    return sorted;
}

// ============ MANUAL TRANSACTION ENTRY ============
function populateManualCategoryDropdown() {
    const select = document.getElementById('manual-category');
    if (!select) return;

    // Wait for categories to load, then populate
    const checkCategories = setInterval(() => {
        if (categories.length > 0) {
            clearInterval(checkCategories);
            select.innerHTML = '<option value="">Select Category</option>';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name;
                select.appendChild(option);
            });
        }
    }, 100);

    // Clear interval after 5 seconds max
    setTimeout(() => clearInterval(checkCategories), 5000);
}

async function handleManualTransactionSubmit(e) {
    e.preventDefault();

    const resultDiv = document.getElementById('manual-result');
    resultDiv.innerHTML = '<div class="alert alert-info">Adding transaction...</div>';

    const expenseData = {
        date: document.getElementById('manual-date').value,
        amount: parseFloat(document.getElementById('manual-amount').value),
        description: document.getElementById('manual-description').value,
        category_id: document.getElementById('manual-category').value || null,
        transaction_type: document.getElementById('manual-type').value,
        source_account: document.getElementById('manual-source').value || null,
        is_essential: document.getElementById('manual-essential').checked,
        is_recurring: false,
        notes: ''
    };

    try {
        const response = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(expenseData)
        });

        if (response.ok) {
            resultDiv.innerHTML = `<div class="alert alert-success">
                <i class="bi bi-check-circle me-2"></i>Transaction added successfully!
            </div>`;

            // Reset form but keep the date
            document.getElementById('manual-amount').value = '';
            document.getElementById('manual-description').value = '';
            document.getElementById('manual-category').selectedIndex = 0;
            document.getElementById('manual-type').value = 'expense';
            document.getElementById('manual-source').value = '';
            document.getElementById('manual-essential').checked = false;

            // Reload data
            await loadExpenses();
            loadStatistics(currentPeriod);

            // Clear success message after 3 seconds
            setTimeout(() => { resultDiv.innerHTML = ''; }, 3000);
        } else {
            const error = await response.json();
            resultDiv.innerHTML = `<div class="alert alert-danger">
                <i class="bi bi-x-circle me-2"></i>Error: ${error.error || 'Failed to add transaction'}
            </div>`;
        }
    } catch (error) {
        console.error('Error adding manual transaction:', error);
        resultDiv.innerHTML = `<div class="alert alert-danger">
            <i class="bi bi-x-circle me-2"></i>Error adding transaction. Please try again.
        </div>`;
    }
}
