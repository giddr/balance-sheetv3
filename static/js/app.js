let categories = [];
let currentPeriod = 'month';
let categoryChart = null;
let trendChart = null;

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('date').valueAsDate = new Date();
    loadCategories();
    loadExpenses();
    loadStatistics('month');
    document.getElementById('expense-form').addEventListener('submit', handleExpenseSubmit);
    document.getElementById('import-form').addEventListener('submit', handleImportSubmit);
});

async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        categories = await response.json();
        const categorySelect = document.getElementById('category');
        categorySelect.innerHTML = '<option value="">Select Category</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            categorySelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function loadExpenses() {
    try {
        const response = await fetch('/api/expenses');
        const expenses = await response.json();
        const tbody = document.getElementById('expenses-list');
        if (expenses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No expenses yet</td></tr>';
            return;
        }
        tbody.innerHTML = expenses.map(expense => `
            <tr>
                <td>${formatDate(expense.date)}</td>
                <td>${expense.description}</td>
                <td><span class="badge" style="background-color: ${getCategoryColor(expense.category_id)}">${expense.category}</span></td>
                <td><strong>$${expense.amount.toFixed(2)}</strong></td>
                <td>${expense.tags.map(tag => `<span class="tag-badge tag-${tag}">${tag}</span>`).join('')}</td>
                <td><button class="btn btn-sm btn-danger" onclick="deleteExpense(${expense.id})"><i class="bi bi-trash"></i></button></td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading expenses:', error);
    }
}

async function handleExpenseSubmit(e) {
    e.preventDefault();
    const tags = document.getElementById('tags').value.split(',').map(t => t.trim()).filter(t => t.length > 0);
    const expenseData = {
        description: document.getElementById('description').value,
        amount: parseFloat(document.getElementById('amount').value),
        date: document.getElementById('date').value,
        category_id: document.getElementById('category').value || null,
        tags: tags,
        notes: ''
    };
    try {
        const response = await fetch('/api/expenses', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(expenseData)
        });
        if (response.ok) {
            document.getElementById('expense-form').reset();
            document.getElementById('date').valueAsDate = new Date();
            loadExpenses();
            loadStatistics(currentPeriod);
        }
    } catch (error) {
        console.error('Error adding expense:', error);
    }
}

async function deleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
        const response = await fetch(`/api/expenses/${id}`, {method: 'DELETE'});
        if (response.ok) {
            loadExpenses();
            loadStatistics(currentPeriod);
        }
    } catch (error) {
        console.error('Error deleting expense:', error);
    }
}

async function loadStatistics(period = 'month') {
    currentPeriod = period;
    try {
        const response = await fetch(`/api/statistics?period=${period}`);
        const stats = await response.json();
        
        document.getElementById('total-expenses').textContent = `$${stats.year_total.toFixed(2)}`;
        document.getElementById('month-expenses').textContent = `$${stats.month_total.toFixed(2)}`;
        document.getElementById('essential-expenses').textContent = `$${stats.essential_total.toFixed(2)}`;
        document.getElementById('optional-expenses').textContent = `$${stats.optional_total.toFixed(2)}`;
        
        updateCategoryChart(stats.by_category);
        updateTrendChart(stats.monthly_trend);
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

function updateCategoryChart(categoryData) {
    const ctx = document.getElementById('category-chart');
    if (categoryChart) categoryChart.destroy();
    const labels = Object.keys(categoryData);
    const data = labels.map(label => categoryData[label].amount);
    const colors = labels.map(label => categoryData[label].color);
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{data: data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff'}]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {position: 'bottom'},
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: $${context.parsed.toFixed(2)}`;
                        }
                    }
                }
            }
        }
    });
}

function updateTrendChart(trendData) {
    const ctx = document.getElementById('trend-chart');
    if (trendChart) trendChart.destroy();
    const labels = trendData.map(d => d.month);
    const data = trendData.map(d => d.amount);
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Expenses',
                data: data,
                borderColor: '#13B5EA',
                backgroundColor: 'rgba(19, 181, 234, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {display: false},
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `$${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(0);
                        }
                    }
                }
            }
        }
    });
}

async function handleImportSubmit(e) {
    e.preventDefault();
    const fileInput = document.getElementById('csv-file');
    const file = fileInput.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await fetch('/api/import-csv', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (response.ok) {
            let message = `<div class="alert alert-success">${result.message}</div>`;
            if (result.errors && result.errors.length > 0) {
                message += '<div class="alert alert-warning"><strong>Errors:</strong><ul>';
                result.errors.forEach(error => {
                    message += `<li>${error}</li>`;
                });
                message += '</ul></div>';
            }
            document.getElementById('import-result').innerHTML = message;
            fileInput.value = '';
            loadExpenses();
            loadStatistics(currentPeriod);
        }
    } catch (error) {
        console.error('Error importing CSV:', error);
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getCategoryColor(categoryId) {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.color : '#95a5a6';
}
