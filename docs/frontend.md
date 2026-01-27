# Frontend

Bootstrap 5 dark theme UI with Chart.js visualizations.

## Tech Stack

| Library | Version | CDN |
|---------|---------|-----|
| Bootstrap | 5.3.0 | `cdn.jsdelivr.net/npm/bootstrap@5.3.0` |
| Bootstrap Icons | 1.11.1 | `cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1` |
| Chart.js | 4.4.0 | `cdn.jsdelivr.net/npm/chart.js@4.4.0` |

## Page Structure

### Layout

```
┌─────────────────────────────────────────┐
│ Navbar (Balance Sheet branding)         │
├─────────────────────────────────────────┤
│ Stats Cards (4 columns)                 │
│ [Total] [Month] [Essential] [Optional]  │
├─────────────────────────────────────────┤
│ Tab Navigation                          │
│ [Expenses] [Reports] [Import]           │
├─────────────────────────────────────────┤
│ Tab Content                             │
│                                         │
└─────────────────────────────────────────┘
```

### Tab 1: Expenses

```
┌──────────────┬──────────────────────────┐
│ Add Expense  │ Recent Expenses Table    │
│ Form (4 col) │ (8 columns)              │
│              │                          │
│ - Description│ Date | Desc | Cat | Amt  │
│ - Amount     │ Tags | Actions           │
│ - Date       │                          │
│ - Category   │                          │
│ - Tags       │                          │
│ [Submit]     │                          │
└──────────────┴──────────────────────────┘
```

### Tab 2: Reports

```
┌──────────────────────────────────────────┐
│ [This Month] [This Year] [All Time]      │
├────────────────────┬─────────────────────┤
│ Expenses by        │ Monthly Trend       │
│ Category           │ (Line Chart)        │
│ (Doughnut Chart)   │                     │
└────────────────────┴─────────────────────┘
```

### Tab 3: Import

```
┌──────────────────────────────────────────┐
│ CSV format instructions                  │
│                                          │
│ [File Input]                             │
│ [Import Button]                          │
│                                          │
│ Import Results                           │
└──────────────────────────────────────────┘
```

## Dark Theme CSS

Location: `static/css/style.css`

### CSS Variables

```css
:root {
    --xero-dark-bg: #0d1117;      /* Page background */
    --xero-card-bg: #161b22;      /* Card background */
    --xero-card-hover: #1c2128;   /* Card hover state */
    --xero-blue: #13B5EA;         /* Primary accent */
    --xero-blue-hover: #0fa0d1;   /* Accent hover */
    --xero-border: #30363d;       /* Border color */
    --xero-text: #e6edf3;         /* Primary text */
    --xero-text-muted: #8b949e;   /* Muted text */
    --essential: #3fb950;          /* Green for essential */
    --optional: #a371f7;           /* Purple for optional */
}
```

### Key Styles

```css
body {
    background-color: var(--xero-dark-bg);
    color: var(--xero-text);
}

.card {
    background-color: var(--xero-card-bg);
    border: 1px solid var(--xero-border);
}

.card:hover {
    background-color: var(--xero-card-hover);
}

.form-control:focus {
    border-color: var(--xero-blue);
    box-shadow: 0 0 0 3px rgba(19, 181, 234, 0.1);
}

.btn-primary {
    background-color: var(--xero-blue);
}

.tag-essential {
    background-color: rgba(63, 185, 80, 0.15);
    color: var(--essential);
    border: 1px solid var(--essential);
}

.tag-optional {
    background-color: rgba(163, 113, 247, 0.15);
    color: var(--optional);
    border: 1px solid var(--optional);
}
```

## JavaScript Architecture

Location: `static/js/app.js`

### Global State

```javascript
let categories = [];          // Loaded category list
let currentPeriod = 'month';  // Current stats period
let categoryChart = null;     // Chart.js instance
let trendChart = null;        // Chart.js instance
```

### Initialization

```javascript
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('date').valueAsDate = new Date();
    loadCategories();
    loadExpenses();
    loadStatistics('month');
    document.getElementById('expense-form').addEventListener('submit', handleExpenseSubmit);
    document.getElementById('import-form').addEventListener('submit', handleImportSubmit);
});
```

### Core Functions

| Function | Purpose |
|----------|---------|
| `loadCategories()` | Fetch categories, populate dropdown |
| `loadExpenses()` | Fetch and render expense table |
| `handleExpenseSubmit()` | Add new expense |
| `deleteExpense(id)` | Delete expense with confirmation |
| `loadStatistics(period)` | Fetch stats, update cards and charts |
| `updateCategoryChart()` | Render doughnut chart |
| `updateTrendChart()` | Render line chart |
| `handleImportSubmit()` | Upload and process CSV |

### Utility Functions

```javascript
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function getCategoryColor(categoryId) {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.color : '#95a5a6';
}
```

## Chart.js Configuration

### Doughnut Chart (Categories)

```javascript
categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
        labels: labels,
        datasets: [{
            data: data,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#fff'
        }]
    },
    options: {
        responsive: true,
        plugins: {
            legend: { position: 'bottom' },
            tooltip: {
                callbacks: {
                    label: (context) => `${context.label}: $${context.parsed.toFixed(2)}`
                }
            }
        }
    }
});
```

### Line Chart (Monthly Trend)

```javascript
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
            legend: { display: false }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: (value) => '$' + value.toFixed(0)
                }
            }
        }
    }
});
```

## Bootstrap Components Used

| Component | Usage |
|-----------|-------|
| Navbar | Top branding bar |
| Cards | Stats cards, form containers |
| Grid (row/col) | Page layout |
| Tabs | Expenses/Reports/Import |
| Forms | Add expense, import CSV |
| Tables | Expense list |
| Badges | Category labels |
| Buttons | Actions |
| Alerts | Import results |
| Button Groups | Period filters |

## File Structure

```
static/
  css/
    style.css       # Dark theme overrides (166 lines)
  js/
    app.js          # Frontend logic (228 lines)
templates/
  index.html        # Main page (209 lines)
```

## Responsive Design

Uses Bootstrap 5 responsive grid:
- Stats cards: `col-md-3` (4 per row on medium+)
- Expenses tab: `col-md-4` form, `col-md-8` table
- Reports tab: `col-md-6` per chart
- Import tab: `col-md-8 offset-md-2` centered
