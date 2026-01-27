# Analytics

Statistics API with multi-period totals, category breakdown, and trend data.

## Endpoint

**GET** `/api/statistics?period=month|year|all`

## Query Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| `period` | `month` (default) | Current month only |
| | `year` | Year to date |
| | `all` | All time |

## Response Structure

```json
{
  "total": 1250.00,
  "year_total": 15000.00,
  "month_total": 1250.00,
  "count": 45,
  "average": 27.78,
  "essential_total": 800.00,
  "optional_total": 450.00,
  "by_category": {
    "Food & Dining": {
      "amount": 500.00,
      "count": 20,
      "color": "#e74c3c"
    },
    "Transportation": {
      "amount": 200.00,
      "count": 10,
      "color": "#3498db"
    }
  },
  "monthly_trend": [
    {"month": "Feb 2025", "amount": 1100.00, "essential": 700.00, "optional": 400.00},
    {"month": "Mar 2025", "amount": 1200.00, "essential": 750.00, "optional": 450.00}
  ],
  "mom_change": 8.33
}
```

## Response Fields

| Field | Description |
|-------|-------------|
| `total` | Sum for selected period |
| `year_total` | Year-to-date total (always calculated) |
| `month_total` | Current month total (always calculated) |
| `count` | Number of expenses in period |
| `average` | Average expense amount |
| `essential_total` | Sum of essential expenses |
| `optional_total` | Sum of optional expenses |
| `by_category` | Breakdown by category with amount, count, color |
| `monthly_trend` | Last 12 months of data |
| `mom_change` | Month-over-month percentage change |

## Implementation

Location: `app.py` lines 201-277

### Period Filtering

```python
@app.route('/api/statistics', methods=['GET'])
def statistics():
    period = request.args.get('period', 'month')

    if period == 'month':
        start_date = datetime.now().date().replace(day=1)
    elif period == 'year':
        start_date = datetime.now().date().replace(month=1, day=1)
    else:
        start_date = None  # All time

    query = Expense.query
    if start_date:
        query = query.filter(Expense.date >= start_date)

    expenses = query.all()
```

### Essential vs Optional Totals

```python
essential_total = sum(e.amount for e in expenses if e.is_essential)
optional_total = sum(e.amount for e in expenses if not e.is_essential)
```

### Category Breakdown

```python
category_stats = {}
for expense in expenses:
    cat_name = expense.category.name if expense.category else 'Uncategorized'
    if cat_name not in category_stats:
        category_stats[cat_name] = {
            'amount': 0,
            'count': 0,
            'color': expense.category.color if expense.category else '#95a5a6'
        }
    category_stats[cat_name]['amount'] += expense.amount
    category_stats[cat_name]['count'] += 1
```

### Monthly Trend (12 Months)

```python
monthly_trend = []
for i in range(11, -1, -1):
    month_start = datetime.now().date().replace(day=1) - relativedelta(months=i)
    month_end = month_start + relativedelta(months=1)

    month_expenses = Expense.query.filter(
        Expense.date >= month_start,
        Expense.date < month_end
    ).all()

    monthly_trend.append({
        'month': month_start.strftime('%b %Y'),
        'amount': sum(e.amount for e in month_expenses),
        'essential': sum(e.amount for e in month_expenses if e.is_essential),
        'optional': sum(e.amount for e in month_expenses if not e.is_essential)
    })
```

### Month-over-Month Change

```python
mom_change = 0
if len(monthly_trend) >= 2:
    current_month = monthly_trend[-1]['amount']
    previous_month = monthly_trend[-2]['amount']
    if previous_month > 0:
        mom_change = ((current_month - previous_month) / previous_month) * 100
```

## Frontend Usage

### Loading Statistics

```javascript
async function loadStatistics(period = 'month') {
    currentPeriod = period;
    const response = await fetch(`/api/statistics?period=${period}`);
    const stats = await response.json();

    // Update cards
    document.getElementById('total-expenses').textContent = `$${stats.year_total.toFixed(2)}`;
    document.getElementById('month-expenses').textContent = `$${stats.month_total.toFixed(2)}`;
    document.getElementById('essential-expenses').textContent = `$${stats.essential_total.toFixed(2)}`;
    document.getElementById('optional-expenses').textContent = `$${stats.optional_total.toFixed(2)}`;

    // Update charts
    updateCategoryChart(stats.by_category);
    updateTrendChart(stats.monthly_trend);
}
```

### Period Filter Buttons

```html
<div class="btn-group">
    <button onclick="loadStatistics('month')">This Month</button>
    <button onclick="loadStatistics('year')">This Year</button>
    <button onclick="loadStatistics('all')">All Time</button>
</div>
```

## Charts

### Category Doughnut Chart

```javascript
function updateCategoryChart(categoryData) {
    const labels = Object.keys(categoryData);
    const data = labels.map(label => categoryData[label].amount);
    const colors = labels.map(label => categoryData[label].color);

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors
            }]
        },
        options: {
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.label}: $${context.parsed.toFixed(2)}`
                    }
                }
            }
        }
    });
}
```

### Monthly Trend Line Chart

```javascript
function updateTrendChart(trendData) {
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
}
```

## Stats Cards Display

```html
<div class="row">
    <div class="col-md-3">
        <div class="card">
            <h6>TOTAL EXPENSES</h6>
            <h2 id="total-expenses">$0.00</h2>
        </div>
    </div>
    <div class="col-md-3">
        <div class="card">
            <h6>THIS MONTH</h6>
            <h2 id="month-expenses">$0.00</h2>
        </div>
    </div>
    <div class="col-md-3">
        <div class="card" style="border-left: 4px solid #10b981;">
            <h6>ESSENTIAL</h6>
            <h2 id="essential-expenses" style="color: #10b981;">$0.00</h2>
        </div>
    </div>
    <div class="col-md-3">
        <div class="card" style="border-left: 4px solid #8b5cf6;">
            <h6>OPTIONAL</h6>
            <h2 id="optional-expenses" style="color: #8b5cf6;">$0.00</h2>
        </div>
    </div>
</div>
```
