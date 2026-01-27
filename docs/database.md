# Database

SQLite database with Flask-SQLAlchemy ORM.

## Configuration

Location: `app.py` lines 9-12

```python
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///expenses.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
```

- **Database file**: `instance/expenses.db`
- **ORM**: Flask-SQLAlchemy
- **Auto-created**: Tables created on first run

## Models

### Category

```python
class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    color = db.Column(db.String(7), default='#3498db')  # Hex color
    expenses = db.relationship('Expense', backref='category', lazy=True)
```

**Default Categories** (created on first run):

| Name | Color |
|------|-------|
| Food & Dining | `#e74c3c` |
| Transportation | `#3498db` |
| Shopping | `#9b59b6` |
| Entertainment | `#f39c12` |
| Bills & Utilities | `#1abc9c` |
| Healthcare | `#e67e22` |
| Pet Care | `#ff6b9d` |
| Kids & Education | `#feca57` |
| Subscriptions | `#48dbfb` |
| Other | `#95a5a6` |

### Tag

```python
class Tag(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
```

### Expense

```python
class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=True)
    is_recurring = db.Column(db.Boolean, default=False)
    recurring_frequency = db.Column(db.String(20), nullable=True)
    is_essential = db.Column(db.Boolean, default=False)
    notes = db.Column(db.Text, nullable=True)
    tags = db.relationship('Tag', secondary=expense_tags, lazy='subquery',
        backref=db.backref('expenses', lazy=True))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

### Junction Table (expense_tags)

```python
expense_tags = db.Table('expense_tags',
    db.Column('expense_id', db.Integer, db.ForeignKey('expense.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id'), primary_key=True)
)
```

## Relationships

```
Category (1) ─────────── (many) Expense
                              │
                              │ (many-to-many via expense_tags)
                              │
Tag (many) ───────────────────┘
```

- **Category → Expenses**: One-to-many (`category.expenses`)
- **Expense → Category**: Many-to-one (`expense.category`)
- **Expense ↔ Tag**: Many-to-many (`expense.tags`, `tag.expenses`)

## Database Initialization

Location: `app.py` lines 120-137

```python
with app.app_context():
    db.create_all()

    # Seed default categories if empty
    if Category.query.count() == 0:
        default_categories = [
            Category(name='Food & Dining', color='#e74c3c'),
            Category(name='Transportation', color='#3498db'),
            # ... more categories
        ]
        db.session.add_all(default_categories)
        db.session.commit()
```

## Common Queries

### Get All Expenses (sorted by date)

```python
expenses = Expense.query.order_by(Expense.date.desc()).all()
```

### Get Expenses by Date Range

```python
from datetime import datetime

start_date = datetime.now().date().replace(day=1)  # First of month
expenses = Expense.query.filter(Expense.date >= start_date).all()
```

### Get Expenses with Category

```python
expenses = Expense.query.all()
for e in expenses:
    category_name = e.category.name if e.category else 'Uncategorized'
```

### Sum Expenses

```python
total = sum(e.amount for e in expenses)
essential_total = sum(e.amount for e in expenses if e.is_essential)
```

### Get or Create Tag

```python
tag = Tag.query.filter_by(name='essential').first()
if not tag:
    tag = Tag(name='essential')
    db.session.add(tag)
```

### Add Tags to Expense

```python
expense = Expense(...)
for tag_name in ['essential', 'groceries']:
    tag = Tag.query.filter_by(name=tag_name).first()
    if not tag:
        tag = Tag(name=tag_name)
        db.session.add(tag)
    expense.tags.append(tag)
```

## Schema Diagram

```
┌─────────────────┐
│    Category     │
├─────────────────┤
│ id (PK)         │
│ name (unique)   │
│ color           │
└────────┬────────┘
         │
         │ 1:many
         ▼
┌─────────────────┐       ┌─────────────────┐
│    Expense      │       │ expense_tags    │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │◄──────┤ expense_id (PK) │
│ description     │       │ tag_id (PK)     │
│ amount          │       └────────┬────────┘
│ date            │                │
│ category_id (FK)│                │
│ is_recurring    │                │
│ recurring_freq  │                ▼
│ is_essential    │       ┌─────────────────┐
│ notes           │       │      Tag        │
│ created_at      │       ├─────────────────┤
└─────────────────┘       │ id (PK)         │
                          │ name (unique)   │
                          └─────────────────┘
```

## File Location

- **Database**: `instance/expenses.db`
- **Git ignored**: Yes (in `.gitignore`)

The database is auto-created in the `instance/` folder when Flask-SQLAlchemy runs `db.create_all()`.
