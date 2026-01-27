# Project Setup Guide

Use this guide to set up a new Flask + SQLite expense tracking app with the same stack.

## 1. Project Structure

```
project-name/
  app.py              # Flask app, routes, models, business logic
  requirements.txt    # Python dependencies
  templates/
    index.html        # Jinja2 HTML template
  static/
    css/
      style.css       # Custom styling (dark theme)
    js/
      app.js          # Frontend JavaScript (fetch API, Chart.js)
  instance/
    expenses.db       # SQLite database (auto-created)
```

## 2. Dependencies

Create `requirements.txt`:

```
Flask==3.0.0
Flask-SQLAlchemy==3.1.1
python-dateutil==2.8.2
```

Install:

```bash
pip install -r requirements.txt
```

## 3. Flask App Boilerplate

### `app.py`

```python
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///expenses.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Models
class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    color = db.Column(db.String(7), default='#3498db')
    expenses = db.relationship('Expense', backref='category', lazy=True)

class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Initialize database
with app.app_context():
    db.create_all()

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/expenses', methods=['GET', 'POST'])
def expenses():
    if request.method == 'POST':
        data = request.json
        expense = Expense(
            description=data['description'],
            amount=float(data['amount']),
            date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
            category_id=data.get('category_id')
        )
        db.session.add(expense)
        db.session.commit()
        return jsonify({'message': 'Created', 'id': expense.id}), 201

    expenses = Expense.query.order_by(Expense.date.desc()).all()
    return jsonify([{
        'id': e.id,
        'description': e.description,
        'amount': e.amount,
        'date': e.date.isoformat(),
        'category': e.category.name if e.category else 'Uncategorized'
    } for e in expenses])

@app.route('/api/expenses/<int:id>', methods=['DELETE'])
def delete_expense(id):
    expense = Expense.query.get_or_404(id)
    db.session.delete(expense)
    db.session.commit()
    return jsonify({'message': 'Deleted'})

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=8080)
```

## 4. HTML Template Boilerplate

### `templates/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>App Name</title>
    <!-- Bootstrap 5 -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <!-- Custom CSS -->
    <link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">
</head>
<body>
    <nav class="navbar navbar-dark">
        <div class="container-fluid">
            <span class="navbar-brand"><i class="bi bi-wallet2"></i> App Name</span>
        </div>
    </nav>

    <div class="container mt-4">
        <!-- Your content here -->
    </div>

    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <!-- Custom JS -->
    <script src="{{ url_for('static', filename='js/app.js') }}"></script>
</body>
</html>
```

## 5. Dark Theme CSS

### `static/css/style.css`

```css
:root {
    --dark-bg: #0d1117;
    --card-bg: #161b22;
    --card-hover: #1c2128;
    --accent: #13B5EA;
    --accent-hover: #0fa0d1;
    --border: #30363d;
    --text: #e6edf3;
    --text-muted: #8b949e;
}

body {
    background-color: var(--dark-bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.navbar {
    background: var(--card-bg) !important;
    border-bottom: 1px solid var(--border);
}

.card {
    background-color: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
}

.card:hover {
    background-color: var(--card-hover);
}

.form-control, .form-select {
    background-color: var(--dark-bg);
    border: 1px solid var(--border);
    color: var(--text);
}

.form-control:focus, .form-select:focus {
    background-color: var(--card-bg);
    border-color: var(--accent);
    color: var(--text);
    box-shadow: 0 0 0 3px rgba(19, 181, 234, 0.1);
}

.btn-primary {
    background-color: var(--accent);
    border: none;
}

.btn-primary:hover {
    background-color: var(--accent-hover);
}

.table {
    color: var(--text);
}

.table thead th {
    background-color: var(--dark-bg);
    border-bottom: 2px solid var(--border);
    color: var(--text-muted);
}

.table tbody tr:hover {
    background-color: var(--card-hover);
}
```

## 6. Frontend JavaScript Pattern

### `static/js/app.js`

```javascript
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    document.getElementById('form').addEventListener('submit', handleSubmit);
});

async function loadData() {
    try {
        const response = await fetch('/api/expenses');
        const data = await response.json();
        renderData(data);
    } catch (error) {
        console.error('Error:', error);
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    const formData = {
        description: document.getElementById('description').value,
        amount: parseFloat(document.getElementById('amount').value),
        date: document.getElementById('date').value
    };

    try {
        const response = await fetch('/api/expenses', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            document.getElementById('form').reset();
            loadData();
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function deleteItem(id) {
    if (!confirm('Delete?')) return;

    try {
        const response = await fetch(`/api/expenses/${id}`, {
            method: 'DELETE'
        });
        if (response.ok) loadData();
    } catch (error) {
        console.error('Error:', error);
    }
}

function renderData(items) {
    const container = document.getElementById('list');
    container.innerHTML = items.map(item => `
        <tr>
            <td>${item.description}</td>
            <td>$${item.amount.toFixed(2)}</td>
            <td><button onclick="deleteItem(${item.id})">Delete</button></td>
        </tr>
    `).join('');
}
```

## 7. Run the App

```bash
python app.py
```

Opens at: `http://127.0.0.1:8080`

## 8. Many-to-Many Relationships

For tags or similar:

```python
# Junction table
item_tags = db.Table('item_tags',
    db.Column('item_id', db.Integer, db.ForeignKey('item.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id'), primary_key=True)
)

class Tag(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)

class Item(db.Model):
    # ... other fields
    tags = db.relationship('Tag', secondary=item_tags, lazy='subquery',
        backref=db.backref('items', lazy=True))
```

## 9. CSV Import Pattern

```python
import csv
import io

@app.route('/api/import-csv', methods=['POST'])
def import_csv():
    file = request.files['file']
    stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
    csv_reader = csv.DictReader(stream)

    for row in csv_reader:
        # Process each row
        item = Item(
            description=row.get('description'),
            amount=float(row.get('amount', 0))
        )
        db.session.add(item)

    db.session.commit()
    return jsonify({'message': 'Imported'})
```

## 10. Chart.js Integration

```javascript
function renderChart(data) {
    const ctx = document.getElementById('chart');
    new Chart(ctx, {
        type: 'doughnut',  // or 'line', 'bar'
        data: {
            labels: Object.keys(data),
            datasets: [{
                data: Object.values(data),
                backgroundColor: ['#e74c3c', '#3498db', '#9b59b6']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}
```
