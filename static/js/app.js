// Balance Sheet App - Full Featured Frontend
let categories = [];
let allExpenses = [];
let currentPeriod = 'month';
let categoryChart = null;
let trendChart = null;
let selectedExpenses = new Set();

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Set default date to today
    const dateInput = document.getElementById('date');
    if (dateInput) dateInput.valueAsDate = new Date();

    // Set default cash date to today
    const cashDateInput = document.getElementById('cash-date-input');
    if (cashDateInput) cashDateInput.valueAsDate = new Date();

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

    // Create tabs
    monthlyTabs.innerHTML = months.map((month, index) => {
        const date = new Date(month + '-01');
        const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        return `
            <li class="nav-item">
                <button class="nav-link ${index === 0 ? 'active' : ''}"
                        data-bs-toggle="pill"
                        data-bs-target="#month-${month}"
                        type="button">
                    ${label}
                </button>
            </li>
        `;
    }).join('');

    // Create content
    monthlyContent.innerHTML = months.map((month, index) => {
        const monthExpenses = expensesByMonth[month];
        const monthTotal = monthExpenses.filter(e => e.transaction_type === 'expense').reduce((sum, e) => sum + e.amount, 0);
        const monthIncome = monthExpenses.filter(e => e.transaction_type === 'income').reduce((sum, e) => sum + e.amount, 0);

        return `
            <div class="tab-pane fade ${index === 0 ? 'show active' : ''}" id="month-${month}">
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
                                <th>Date</th>
                                <th>Description</th>
                                <th>Category</th>
                                <th>Type</th>
                                <th class="text-end">Amount</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${monthExpenses.map(expense => createExpenseRow(expense)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }).join('');
}

function createExpenseRow(expense) {
    const isIncome = expense.transaction_type === 'income';
    const amountClass = isIncome ? 'text-success' : 'text-danger';
    const amountPrefix = isIncome ? '+' : '-';
    const typeIcon = expense.is_essential ? '✓' : '◆';
    const typeClass = expense.is_essential ? 'text-success' : 'text-purple';
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
                ${expense.source_account ? `<br><small class="text-muted">${expense.source_account}</small>` : ''}
            </td>
            <td>
                <span class="badge category-badge" style="background-color: ${getCategoryColor(expense.category_id)}; cursor: pointer;"
                      onclick="showCategoryEditor(${expense.id}, '${escapeHtml(expense.description)}', ${expense.category_id || 'null'}, ${expense.is_essential})">
                    ${expense.category}
                </span>
            </td>
            <td><span class="${typeClass}">${typeIcon}</span></td>
            <td class="text-end">
                <strong class="${amountClass}">${amountPrefix}$${expense.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteExpense(${expense.id})">
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
function showCategoryEditor(expenseId, description, currentCategoryId, isEssential) {
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
                    <p class="text-muted small">${description}</p>
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
                            <label class="form-check-label" for="edit-essential">Essential expense</label>
                        </div>
                    </div>
                    <div class="alert alert-info small">
                        <i class="bi bi-info-circle"></i> Updating will apply to <strong>all transactions</strong> with this description (or matching BPAY code).
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="updateCategoryBulk('${escapeHtml(description)}')">
                        Update All Matching
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
    });
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

    // Get selected year from filter
    const yearFilter = document.getElementById('filter-year');
    const selectedYear = yearFilter ? yearFilter.value : new Date().getFullYear();

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

        const tbody = document.getElementById('cash-history-table');
        if (tbody) {
            tbody.innerHTML = positions.map(p => `
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

        const modal = new bootstrap.Modal(document.getElementById('cashHistoryModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading cash history:', error);
    }
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

    if (search) search.value = '';
    if (year) year.value = '2025';
    if (category) category.value = '';
    if (type) type.value = '';
    if (transactionType) transactionType.value = '';

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
