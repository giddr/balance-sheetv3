from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import csv
import io
import re

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///expenses.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Smart Categorization Rules
CATEGORIZATION_RULES = {
    'Food & Dining': {
        'keywords': ['woolworths', 'coles', 'aldi', 'iga', 'supermarket', 'grocery', 'cafe', 'restaurant',
                     'uber eats', 'deliveroo', 'menulog', 'starbucks', 'mcdonald', 'kfc', 'subway',
                     'pizza', 'bakery', 'butcher', 'deli', 'food', 'dining'],
        'essential_keywords': ['woolworths', 'coles', 'aldi', 'iga', 'supermarket', 'grocery'],
        'essential': True
    },
    'Transportation': {
        'keywords': ['uber', 'taxi', 'petrol', 'gas', 'fuel', 'bp', 'shell', 'caltex', '7-eleven',
                     'parking', 'toll', 'rego', 'registration', 'service', 'mechanic', 'auto'],
        'essential_keywords': ['petrol', 'gas', 'fuel', 'rego', 'registration'],
        'essential': True
    },
    'Healthcare': {
        'keywords': ['chemist', 'pharmacy', 'priceline', 'amcal', 'terry white', 'doctor', 'medical',
                     'hospital', 'dental', 'dentist', 'optom', 'physio', 'health', 'medicare'],
        'essential_keywords': ['chemist', 'pharmacy', 'doctor', 'medical', 'hospital', 'dental', 'medicare'],
        'essential': True
    },
    'Pet Care': {
        'keywords': ['vet', 'pet', 'petbarn', 'pet stock', 'dog', 'cat', 'animal'],
        'essential_keywords': ['vet', 'pet', 'dog', 'cat'],
        'essential': True
    },
    'Kids & Education': {
        'keywords': ['school', 'childcare', 'daycare', 'kindy', 'kindergarten', 'uniform',
                     'education', 'tuition', 'kids'],
        'essential_keywords': ['school', 'childcare', 'daycare', 'education', 'tuition'],
        'essential': True
    },
    'Bills & Utilities': {
        'keywords': ['electricity', 'gas bill', 'water', 'council', 'rates', 'internet', 'telstra',
                     'optus', 'vodafone', 'nbn', 'phone', 'mobile', 'insurance', 'agl', 'origin'],
        'essential_keywords': ['electricity', 'gas bill', 'water', 'council', 'rates', 'internet', 'insurance'],
        'essential': True
    },
    'Subscriptions': {
        'keywords': ['netflix', 'spotify', 'subscription', 'amazon prime', 'disney', 'apple music',
                     'youtube premium', 'gym', 'membership'],
        'essential_keywords': [],
        'essential': False
    },
    'Shopping': {
        'keywords': ['amazon', 'ebay', 'kmart', 'target', 'big w', 'bunnings', 'officeworks',
                     'clothing', 'fashion', 'shoes', 'department store'],
        'essential_keywords': [],
        'essential': False
    },
    'Entertainment': {
        'keywords': ['cinema', 'movie', 'theatre', 'concert', 'event', 'ticketek', 'entertainment'],
        'essential_keywords': [],
        'essential': False
    }
}

# Database Models
class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    color = db.Column(db.String(7), default='#3498db')
    expenses = db.relationship('Expense', backref='category', lazy=True)

class Tag(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)

expense_tags = db.Table('expense_tags',
    db.Column('expense_id', db.Integer, db.ForeignKey('expense.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id'), primary_key=True)
)

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

def smart_categorize(description):
    """Returns (category_name, is_essential, suggested_tags)"""
    desc_lower = description.lower()
    
    for category_name, rules in CATEGORIZATION_RULES.items():
        for keyword in rules['keywords']:
            if keyword in desc_lower:
                is_essential = rules['essential']
                if is_essential:
                    is_essential = any(kw in desc_lower for kw in rules['essential_keywords'])
                
                tags = ['essential'] if is_essential else ['optional']
                if 'subscription' in category_name.lower() or any(sub in desc_lower for sub in ['netflix', 'spotify', 'prime', 'gym']):
                    tags.append('recurring')
                
                return category_name, is_essential, tags
    
    return 'Other', False, ['optional']

with app.app_context():
    db.create_all()
    
    if Category.query.count() == 0:
        default_categories = [
            Category(name='Food & Dining', color='#e74c3c'),
            Category(name='Transportation', color='#3498db'),
            Category(name='Shopping', color='#9b59b6'),
            Category(name='Entertainment', color='#f39c12'),
            Category(name='Bills & Utilities', color='#1abc9c'),
            Category(name='Healthcare', color='#e67e22'),
            Category(name='Pet Care', color='#ff6b9d'),
            Category(name='Kids & Education', color='#feca57'),
            Category(name='Subscriptions', color='#48dbfb'),
            Category(name='Other', color='#95a5a6')
        ]
        db.session.add_all(default_categories)
        db.session.commit()

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
            category_id=data.get('category_id'),
            is_recurring=data.get('is_recurring', False),
            recurring_frequency=data.get('recurring_frequency'),
            is_essential=data.get('is_essential', False),
            notes=data.get('notes', '')
        )
        
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
    
    expenses = Expense.query.order_by(Expense.date.desc()).all()
    return jsonify([{
        'id': e.id,
        'description': e.description,
        'amount': e.amount,
        'date': e.date.isoformat(),
        'category': e.category.name if e.category else 'Uncategorized',
        'category_id': e.category_id,
        'is_recurring': e.is_recurring,
        'recurring_frequency': e.recurring_frequency,
        'is_essential': e.is_essential,
        'notes': e.notes,
        'tags': [tag.name for tag in e.tags]
    } for e in expenses])

@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def expense_detail(expense_id):
    expense = Expense.query.get_or_404(expense_id)
    db.session.delete(expense)
    db.session.commit()
    return jsonify({'message': 'Expense deleted successfully'})

@app.route('/api/categories', methods=['GET'])
def categories():
    categories = Category.query.all()
    return jsonify([{
        'id': c.id,
        'name': c.name,
        'color': c.color
    } for c in categories])

@app.route('/api/statistics', methods=['GET'])
def statistics():
    period = request.args.get('period', 'month')
    
    if period == 'month':
        start_date = datetime.now().date().replace(day=1)
    elif period == 'year':
        start_date = datetime.now().date().replace(month=1, day=1)
    else:
        start_date = None
    
    query = Expense.query
    if start_date:
        query = query.filter(Expense.date >= start_date)
    
    expenses = query.all()
    total = sum(e.amount for e in expenses)
    
    # Always calculate year and month totals
    year_start = datetime.now().date().replace(month=1, day=1)
    year_expenses = Expense.query.filter(Expense.date >= year_start).all()
    year_total = sum(e.amount for e in year_expenses)
    
    month_start = datetime.now().date().replace(day=1)
    month_expenses = Expense.query.filter(Expense.date >= month_start).all()
    month_total = sum(e.amount for e in month_expenses)
    
    essential_total = sum(e.amount for e in expenses if e.is_essential)
    optional_total = sum(e.amount for e in expenses if not e.is_essential)
    
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
    
    monthly_trend = []
    for i in range(11, -1, -1):
        month_start_loop = (datetime.now().date().replace(day=1) - relativedelta(months=i))
        month_end = month_start_loop + relativedelta(months=1)
        month_exp = Expense.query.filter(
            Expense.date >= month_start_loop,
            Expense.date < month_end
        ).all()
        month_amt = sum(e.amount for e in month_exp)
        monthly_trend.append({
            'month': month_start_loop.strftime('%b %Y'),
            'amount': month_amt,
            'essential': sum(e.amount for e in month_exp if e.is_essential),
            'optional': sum(e.amount for e in month_exp if not e.is_essential)
        })
    
    mom_change = 0
    if len(monthly_trend) >= 2:
        current_month = monthly_trend[-1]['amount']
        previous_month = monthly_trend[-2]['amount']
        if previous_month > 0:
            mom_change = ((current_month - previous_month) / previous_month) * 100
    
    return jsonify({
        'total': total,
        'year_total': year_total,
        'month_total': month_total,
        'count': len(expenses),
        'average': total / len(expenses) if expenses else 0,
        'essential_total': essential_total,
        'optional_total': optional_total,
        'by_category': category_stats,
        'monthly_trend': monthly_trend,
        'mom_change': mom_change
    })

@app.route('/api/import-csv', methods=['POST'])
def import_csv():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    try:
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_reader = csv.DictReader(stream)
        
        imported_count = 0
        errors = []
        
        for row_num, row in enumerate(csv_reader, start=2):
            try:
                date_str = row.get('date') or row.get('Date') or row.get('DATE') or row.get('Transaction Date')
                description = row.get('description') or row.get('Description') or row.get('DESCRIPTION')
                amount_str = row.get('amount') or row.get('Amount') or row.get('AMOUNT')
                
                if not all([date_str, description, amount_str]):
                    errors.append(f"Row {row_num}: Missing required fields")
                    continue
                
                date_obj = None
                for date_format in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d', '%d-%m-%Y', '%d %b %Y']:
                    try:
                        date_obj = datetime.strptime(date_str.strip(), date_format).date()
                        break
                    except ValueError:
                        continue
                
                if not date_obj:
                    errors.append(f"Row {row_num}: Invalid date format: {date_str}")
                    continue
                
                amount_clean = amount_str.replace('$', '').replace(',', '').strip()
                amount = abs(float(amount_clean))
                
                category_name, is_essential, suggested_tags = smart_categorize(description)
                
                category = Category.query.filter_by(name=category_name).first()
                if not category:
                    category = Category(name=category_name)
                    db.session.add(category)
                    db.session.flush()
                
                expense = Expense(
                    description=description,
                    amount=amount,
                    date=date_obj,
                    category_id=category.id,
                    is_essential=is_essential
                )
                
                for tag_name in suggested_tags:
                    tag = Tag.query.filter_by(name=tag_name).first()
                    if not tag:
                        tag = Tag(name=tag_name)
                        db.session.add(tag)
                    expense.tags.append(tag)
                
                db.session.add(expense)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
        
        db.session.commit()
        
        return jsonify({
            'message': f'Successfully imported {imported_count} expenses',
            'imported': imported_count,
            'errors': errors
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to process CSV: {str(e)}'}), 400

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=8080)
