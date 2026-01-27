# Expense Tracking

CRUD operations for expenses with tags and recurring detection.

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/expenses` | GET | List all expenses (sorted by date desc) |
| `/api/expenses` | POST | Create new expense |
| `/api/expenses/<id>` | DELETE | Delete expense by ID |

## Expense Model

Location: `app.py` lines 87-99

```python
class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=True)
    is_recurring = db.Column(db.Boolean, default=False)
    recurring_frequency = db.Column(db.String(20), nullable=True)  # daily/weekly/monthly/yearly
    is_essential = db.Column(db.Boolean, default=False)
    notes = db.Column(db.Text, nullable=True)
    tags = db.relationship('Tag', secondary=expense_tags, ...)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

## Create Expense

**POST** `/api/expenses`

Request body:
```json
{
  "description": "Woolworths groceries",
  "amount": 85.50,
  "date": "2026-01-15",
  "category_id": 1,
  "tags": ["essential", "groceries"],
  "is_recurring": false,
  "recurring_frequency": null,
  "is_essential": true,
  "notes": "Weekly shop"
}
```

Response:
```json
{
  "message": "Expense added successfully",
  "id": 42
}
```

### Implementation (app.py lines 143-168)

```python
@app.route('/api/expenses', methods=['GET', 'POST'])
def expenses():
    if request.method == 'POST':
        data = request.json
        expense = Expense(
            description=data['description'],
            amount=float(data['amount']),
            date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
            category_id=data.get('category_id'),
            is_recurring=data.get('is_recurring', False),
            recurring_frequency=data.get('recurring_frequency'),
            is_essential=data.get('is_essential', False),
            notes=data.get('notes', '')
        )

        # Handle tags
        if 'tags' in data and data['tags']:
            for tag_name in data['tags']:
                tag = Tag.query.filter_by(name=tag_name).first()
                if not tag:
                    tag = Tag(name=tag_name)
                    db.session.add(tag)
                expense.tags.append(tag)

        db.session.add(expense)
        db.session.commit()
        return jsonify({'message': 'Expense added successfully', 'id': expense.id}), 201
```

## List Expenses

**GET** `/api/expenses`

Response:
```json
[
  {
    "id": 42,
    "description": "Woolworths groceries",
    "amount": 85.50,
    "date": "2026-01-15",
    "category": "Food & Dining",
    "category_id": 1,
    "is_recurring": false,
    "recurring_frequency": null,
    "is_essential": true,
    "notes": "Weekly shop",
    "tags": ["essential", "groceries"]
  }
]
```

Sorted by date descending (most recent first).

## Delete Expense

**DELETE** `/api/expenses/<id>`

Response:
```json
{
  "message": "Expense deleted successfully"
}
```

Returns 404 if expense not found.

## Tags System

### Tag Model

```python
class Tag(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
```

### Junction Table

```python
expense_tags = db.Table('expense_tags',
    db.Column('expense_id', db.Integer, db.ForeignKey('expense.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id'), primary_key=True)
)
```

### Auto-Created Tags

- `essential` - Essential expense
- `optional` - Optional expense
- `recurring` - Subscription/recurring expense

### Adding Tags

Tags are created on-the-fly if they don't exist:

```python
for tag_name in data['tags']:
    tag = Tag.query.filter_by(name=tag_name).first()
    if not tag:
        tag = Tag(name=tag_name)
        db.session.add(tag)
    expense.tags.append(tag)
```

## Recurring Expense Detection

Recurring expenses are detected during CSV import when description contains:
- Netflix, Spotify, Amazon Prime, Disney
- Gym, membership
- Category is "Subscriptions"

```python
if 'subscription' in category_name.lower() or \
   any(sub in desc_lower for sub in ['netflix', 'spotify', 'prime', 'gym']):
    tags.append('recurring')
```

## Frontend Integration

### Add Expense Form

```html
<form id="expense-form">
    <input type="text" id="description" required>
    <input type="number" id="amount" step="0.01" required>
    <input type="date" id="date" required>
    <select id="category">...</select>
    <input type="text" id="tags" placeholder="comma separated">
    <button type="submit">Add Expense</button>
</form>
```

### JavaScript Submit Handler

```javascript
async function handleExpenseSubmit(e) {
    e.preventDefault();
    const tags = document.getElementById('tags').value
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

    const expenseData = {
        description: document.getElementById('description').value,
        amount: parseFloat(document.getElementById('amount').value),
        date: document.getElementById('date').value,
        category_id: document.getElementById('category').value || null,
        tags: tags
    };

    const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(expenseData)
    });

    if (response.ok) {
        document.getElementById('expense-form').reset();
        loadExpenses();
        loadStatistics(currentPeriod);
    }
}
```

### Display Expenses

```javascript
tbody.innerHTML = expenses.map(expense => `
    <tr>
        <td>${formatDate(expense.date)}</td>
        <td>${expense.description}</td>
        <td><span class="badge" style="background-color: ${getCategoryColor(expense.category_id)}">
            ${expense.category}
        </span></td>
        <td><strong>$${expense.amount.toFixed(2)}</strong></td>
        <td>${expense.tags.map(tag =>
            `<span class="tag-badge tag-${tag}">${tag}</span>`
        ).join('')}</td>
        <td><button onclick="deleteExpense(${expense.id})">Delete</button></td>
    </tr>
`).join('');
```
