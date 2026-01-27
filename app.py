from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from functools import wraps
import csv
import io
import re
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///expenses.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
db = SQLAlchemy(app)

# Simple password (in production, use environment variable)
APP_PASSWORD = os.environ.get('APP_PASSWORD', 'Sebastian0727Gold!')

# Login required decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('logged_in'):
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Smart Categorization Rules
CATEGORIZATION_RULES = {
    'Food & Dining': {
        'keywords': ['woolworths', 'ww metro', 'coles', 'aldi', 'iga', 'supermarket', 'grocery', 'cafe', 'restaurant',
                     'uber eats', 'deliveroo', 'menulog', 'starbucks', 'mcdonald', 'kfc', 'subway',
                     'pizza', 'bakery', 'butcher', 'deli', 'food', 'dining', 'toscano', 'colonial fruit',
                     'baker bleu', 'bakers delight', 'prahran bakery', 'fishawk', 'leaf', 'blu fin',
                     'stocked food', 'central gourmet', 'glicks cakes', 'bread', 'gourmet',
                     'brothers keeper', 'ls mabels', 'neds armadale', 'maker & monger', 'maker and monger',
                     'belles hot chicken', 'bistro', 'bar', 'grill', 'eatery', 'kitchen', 'coffee',
                     'brother baba budan', 'market lane', 'seven seeds', 'proud mary', 'patricia',
                     'cumulus', 'supernormal', 'chin chin', 'grill american', 'huxtaburger',
                     'sushi', 'poke', 'vietnamese', 'thai', 'indian', 'chinese', 'japanese',
                     'taco', 'burrito', 'bar lourinha', 'meatball', 'wine bar', 'pub',
                     'the mess hall', 'st ali', 'pillar of salt', 'cut paw paw', 'half acre',
                     'matcha maiden', 'schnitz', 'guzman', 'nando', 'hungry jack', 'red rooster',
                     'pidapipo', 'messina', 'yo-chi', 'gelato', 'gelateria', 'ice cream', 'dessert',
                     'lune croissanterie', 'axil', 'common room', 'bissel', 'elster', 'moby',
                     'la manna', 'lamanna', 'pak leab', 'reddy express', 'woodfrog', 'green dragon',
                     'don don', 'the wolf', 'the servery', 'ls satnaam', 'fratellino', 'terracotta',
                     'flying duck', 'penance', 'mietta', 'fish n gr', 'nuvoletta', 'tarts anon',
                     'mia sugarcane', 'nigel armadale', 'nineveh', 'wattletree', 'prahran market',
                     'zlr*', 'gunnii'],
        'essential_keywords': ['woolworths', 'ww metro', 'coles', 'aldi', 'iga', 'supermarket', 'grocery',
                               'toscano', 'colonial fruit', 'baker bleu', 'bakers delight', 'prahran bakery',
                               'fishawk', 'leaf', 'blu fin', 'stocked food', 'bakery', 'butcher', 'fruit',
                               'la manna', 'lamanna', 'prahran market'],
        'essential': True  # Default for this category, but restaurants/cafes will be optional
    },
    'Transportation': {
        'keywords': ['uber', 'taxi', 'petrol', 'gas', 'fuel', 'bp', 'shell', 'caltex', '7-eleven', '7 eleven',
                     'parking', 'toll', 'rego', 'registration', 'service', 'mechanic', 'auto',
                     'jax tyres', 'vicroads', 'myki', 'dilma taxi', 'gm taxipay', 'spotto',
                     'paypal *carsales', 'carsales'],
        'essential_keywords': ['petrol', 'gas', 'fuel', 'rego', 'registration', '7-eleven', '7 eleven',
                               'jax tyres', 'vicroads', 'myki'],
        'essential': True
    },
    'Housing & Rent': {
        'keywords': ['stockdale leggo', 'rent', 'fox & hare', 'paragem', 'repayment', 'mortgage', 'home loan'],
        'essential_keywords': ['stockdale leggo', 'rent', 'fox & hare', 'paragem', 'repayment', 'mortgage', 'home loan'],
        'essential': True
    },
    'Healthcare': {
        'keywords': ['chemist', 'pharmacy', 'pharamcy', 'priceline', 'amcal', 'terry white', 'doctor', 'medical',
                     'hospital', 'dental', 'dentist', 'optom', 'physio', 'health', 'medicare',
                     'chemist warehouse', 'prahran midnight pharma', 'cabrini', 'racgp', 'spark speech',
                     'skindepth', 'melbourne specialists', 'your pharamcy'],
        'essential_keywords': ['chemist', 'pharmacy', 'pharamcy', 'doctor', 'medical', 'hospital', 'dental', 'medicare',
                               'chemist warehouse', 'prahran midnight pharma', 'cabrini', 'racgp', 'spark speech',
                               'your pharamcy'],
        'essential': True
    },
    'Pet Care': {
        'keywords': ['vet', 'pet', 'petbarn', 'pet stock', 'petstock', 'dog', 'cat', 'animal', 'crumble',
                     'mad paws', 'pawpawup', 'petco'],
        'essential_keywords': ['vet', 'pet', 'petstock', 'petbarn', 'mad paws', 'crumble'],
        'essential': True
    },
    'Personal Care': {
        'keywords': ['woodenstone barbers', 'salon gabrielle', 'dashing nails', 'barber', 'haircut',
                     'hair salon', 'nails', 'manicure', 'orikan group', 'spa', 'beauty'],
        'essential_keywords': ['woodenstone barbers', 'salon gabrielle', 'dashing nails', 'barber', 'haircut'],
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
                     'optus', 'vodafone', 'nbn', 'phone', 'mobile', 'insurance', 'agl', 'origin',
                     'energy locals', 'aussie broadband', 'belong', 'south east water', 'linkt',
                     'budget direct', 'aami', 'metlife', 'doctors health', 'qbeinsuranc', 'qbe insurance',
                     'clearskies wealth', 'financial planning', 'willed', 'estate planning',
                     'carinspect'],
        'essential_keywords': ['electricity', 'gas bill', 'water', 'council', 'rates', 'internet', 'insurance',
                               'energy locals', 'aussie broadband', 'belong', 'linkt', 'aami', 'metlife',
                               'qbeinsuranc', 'qbe insurance', 'clearskies wealth', 'financial planning',
                               'willed', 'carinspect'],
        'essential': True
    },
    'Gym & Fitness': {
        'keywords': ['sweatshop', 'gym', 'fitness', 'bumphe', 'www.bumphe', 'membership'],
        'essential_keywords': ['sweatshop', 'bumphe', 'www.bumphe'],
        'essential': True
    },
    'Subscriptions': {
        'keywords': ['netflix', 'spotify', 'subscription', 'amazon prime', 'disney', 'apple music',
                     'youtube premium', 'kayo', 'hubbl', 'google one', 'kindle unltd', 'meanjin',
                     'crikey', 'choice subscription', 'apple.com/bill', 'paypal *apple',
                     'wikipedia gift', 'donation', 'grouptogether', 'standup.org'],
        'essential_keywords': ['netflix', 'spotify', 'disney', 'kayo', 'hubbl', 'google one',
                               'kindle unltd', 'meanjin', 'choice subscription'],
        'essential': True  # User marked most as necessary
    },
    'Books & Media': {
        'keywords': ['kindle svcs', 'readings', 'jeffreys books', 'books', 'bookstore'],
        'essential_keywords': ['kindle svcs', 'readings', 'jeffreys books'],
        'essential': True
    },
    'Childcare & Education': {
        'keywords': ['childcare', 'gilly s early', 'mount scopu', 'chabad house', 'swimming lessons',
                     'city of stonning', 'trybooking'],
        'essential_keywords': ['childcare', 'gilly s early', 'mount scopu', 'chabad house', 'swimming'],
        'essential': True
    },
    'Shopping': {
        'keywords': ['amazon', 'ebay', 'kmart', 'target', 'big w', 'bunnings', 'officeworks',
                     'clothing', 'fashion', 'shoes', 'department store', 'myer', 'david jones',
                     'cotton on', 'bonds', 'country road', 'baby kingdom', 'purebaby', 'adairs',
                     'depop', 'sarah and sebastian', 'jewelry', 'running warehouse', 'shaver shop'],
        'essential_keywords': ['kmart', 'bonds', 'cotton on', 'baby', 'purebaby', 'adairs', 'baby bunting'],  # Baby supplies are essential
        'essential': True
    },
    'Entertainment': {
        'keywords': ['cinema', 'movie', 'theatre', 'concert', 'event', 'ticketek', 'entertainment',
                     'palace', 'hoyts', 'village', 'imax', 'moonlight cinema', 'astor theatre',
                     'terror twilight', 'record store', 'vinyl', 'schwartz', 'thesatpaper',
                     'roller', 'rollerau'],
        'essential_keywords': [],
        'essential': False
    },
    'Alcohol & Liquor': {
        'keywords': ['dan murphy', 'bws', 'liquor', 'bottle shop', 'wine', 'beer', 'spirits',
                     'vintage cellars', 'first choice', 'bottle-o', 'liquorland'],
        'essential_keywords': [],
        'essential': False
    },
    'Home & Hardware': {
        'keywords': ['bunnings', 'mitre 10', 'hardware', 'ikea', 'freedom', 'fantastic furniture',
                     'the reject shop', 'spotlight', 'lincraft', 'howards storage',
                     'penhalluriack', 'building', 'mister minit', 'airtasker', 'handyman',
                     'repair', 'maintenance', 'steambrook'],
        'essential_keywords': ['bunnings', 'mitre 10', 'hardware', 'penhalluriack', 'building',
                               'airtasker', 'repair', 'maintenance'],  # Home repairs are essential
        'essential': True
    },
    'Electronics & Tech': {
        'keywords': ['jb hi-fi', 'jb hifi', 'harvey norman', 'bing lee', 'good guys', 'apple store',
                     'microsoft store', 'electronics', 'computer', 'laptop', 'phone store',
                     'paypal *paddle', 'paddle.net'],
        'essential_keywords': [],
        'essential': False
    },
    'Investments & Savings': {
        'keywords': ['futurity', 'cfs edge', 'investment', 'savings', 'superannuation', 'super',
                     'managed fund', 'shares', 'etf', 'education bond', 'investment bond'],
        'essential_keywords': ['futurity', 'cfs edge', 'investment', 'education bond', 'investment bond'],
        'essential': True  # These are important financial commitments
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
    db.Column('expense_id', db.Integer, db.ForeignKey('expense.id', ondelete='CASCADE'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id', ondelete='CASCADE'), primary_key=True)
)

class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=True)
    is_recurring = db.Column(db.Boolean, default=False)
    recurring_frequency = db.Column(db.String(20), nullable=True)
    is_essential = db.Column(db.Boolean, default=False)  # New field for essential/optional
    transaction_type = db.Column(db.String(10), default='expense')  # 'income' or 'expense'
    notes = db.Column(db.Text, nullable=True)
    source_account = db.Column(db.String(100), nullable=True)  # Bank account source from filename
    bpay_biller_code = db.Column(db.String(20), nullable=True)  # BPAY biller code for smart categorization
    tags = db.relationship('Tag', secondary=expense_tags, lazy='subquery',
        backref=db.backref('expenses', lazy=True))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class CashPosition(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Float, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Smart Categorization Function
def smart_categorize(description):
    """
    Analyzes transaction description and returns category, tags, and whether it's essential
    Returns: (category_name, is_essential, suggested_tags)
    """
    desc_lower = description.lower()

    # Check against each category
    for category_name, rules in CATEGORIZATION_RULES.items():
        for keyword in rules['keywords']:
            if keyword in desc_lower:
                # Determine if essential based on keyword match
                is_essential = False

                # First check if it matches essential keywords (supermarkets, necessities)
                if any(kw in desc_lower for kw in rules['essential_keywords']):
                    is_essential = True
                # Otherwise, use category default (for categories without essential keywords)
                elif not rules['essential_keywords']:
                    is_essential = rules['essential']

                # Generate tags
                tags = []
                if is_essential:
                    tags.append('essential')
                else:
                    tags.append('optional')

                # Add recurring tag for known subscriptions
                if 'subscription' in category_name.lower() or any(sub in desc_lower for sub in ['netflix', 'spotify', 'prime', 'gym', 'kayo', 'disney']):
                    tags.append('recurring')

                return category_name, is_essential, tags

    # Default: uncategorized and optional
    return 'Other', False, ['optional']

# Initialize database
with app.app_context():
    db.create_all()

    # Add default categories if none exist
    if Category.query.count() == 0:
        default_categories = [
            Category(name='Food & Dining', color='#e74c3c'),
            Category(name='Transportation', color='#3498db'),
            Category(name='Housing & Rent', color='#8e44ad'),
            Category(name='Shopping', color='#9b59b6'),
            Category(name='Entertainment', color='#f39c12'),
            Category(name='Bills & Utilities', color='#1abc9c'),
            Category(name='Healthcare', color='#e67e22'),
            Category(name='Pet Care', color='#ff6b9d'),
            Category(name='Personal Care', color='#f368e0'),
            Category(name='Kids & Education', color='#feca57'),
            Category(name='Childcare & Education', color='#ffd32a'),
            Category(name='Gym & Fitness', color='#00d2d3'),
            Category(name='Subscriptions', color='#48dbfb'),
            Category(name='Books & Media', color='#ff9ff3'),
            Category(name='Alcohol & Liquor', color='#ff6348'),
            Category(name='Home & Hardware', color='#ff9f43'),
            Category(name='Electronics & Tech', color='#4b6584'),
            Category(name='Other', color='#95a5a6')
        ]
        db.session.add_all(default_categories)
        db.session.commit()

# Routes
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        password = request.form.get('password')
        if password == APP_PASSWORD:
            session['logged_in'] = True
            return redirect(url_for('index'))
        else:
            return render_template('login.html', error='Incorrect password')
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    return render_template('index.html')

@app.route('/test')
def test():
    return render_template('test.html')

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
            transaction_type=data.get('transaction_type', 'expense'),
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

    # GET request - return all expenses
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
        'transaction_type': e.transaction_type if hasattr(e, 'transaction_type') else 'expense',
        'notes': e.notes,
        'source_account': e.source_account if hasattr(e, 'source_account') else None,
        'bpay_biller_code': e.bpay_biller_code if hasattr(e, 'bpay_biller_code') else None,
        'tags': [tag.name for tag in e.tags]
    } for e in expenses])

@app.route('/api/expenses/bulk-update-category', methods=['POST'])
def bulk_update_category():
    """Update category and is_essential for all expenses with matching description or BPAY biller code"""
    try:
        data = request.get_json()
        description = data.get('description')
        category_id = data.get('category_id')
        is_essential = data.get('is_essential', False)

        if not description:
            return jsonify({'error': 'Description is required'}), 400

        # First, find the reference expense to check if it has a BPAY biller code
        reference_expense = Expense.query.filter_by(description=description).first()

        if not reference_expense:
            return jsonify({'error': 'No expenses found with that description'}), 404

        # SMART MATCHING: If the reference expense has a BPAY biller code, match by that
        # Otherwise, match by description
        if reference_expense.bpay_biller_code:
            # Match all expenses with the same BPAY biller code
            expenses = Expense.query.filter_by(bpay_biller_code=reference_expense.bpay_biller_code).all()
            match_type = f'BPAY biller code {reference_expense.bpay_biller_code}'
        else:
            # Match all expenses with the same description
            expenses = Expense.query.filter_by(description=description).all()
            match_type = 'description'

        for expense in expenses:
            expense.category_id = category_id
            expense.is_essential = is_essential

        db.session.commit()

        return jsonify({
            'message': f'Successfully updated {len(expenses)} expense(s) matching {match_type}',
            'count': len(expenses),
            'match_type': match_type
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update expenses: {str(e)}'}), 500

@app.route('/api/expenses/delete-all', methods=['POST'])
def delete_all_expenses():
    """Delete all expenses from the database"""
    try:
        num_deleted = Expense.query.delete()
        db.session.commit()

        # Clean up any orphaned tag associations (safety measure)
        db.session.execute(db.text('''
            DELETE FROM expense_tags
            WHERE expense_id NOT IN (SELECT id FROM expense)
        '''))
        db.session.commit()

        return jsonify({
            'message': f'Successfully deleted {num_deleted} expenses',
            'count': num_deleted
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete expenses: {str(e)}'}), 500

@app.route('/api/expenses/<int:expense_id>', methods=['DELETE', 'PUT'])
def expense_detail(expense_id):
    expense = Expense.query.get_or_404(expense_id)

    if request.method == 'DELETE':
        db.session.delete(expense)
        db.session.commit()
        return jsonify({'message': 'Expense deleted successfully'})

    if request.method == 'PUT':
        data = request.json

        # Support partial updates (for category editing)
        if 'description' in data:
            expense.description = data['description']
        if 'amount' in data:
            expense.amount = float(data['amount'])
        if 'date' in data:
            expense.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        if 'category_id' in data:
            expense.category_id = data.get('category_id')
        if 'is_recurring' in data:
            expense.is_recurring = data.get('is_recurring', False)
        if 'recurring_frequency' in data:
            expense.recurring_frequency = data.get('recurring_frequency')
        if 'is_essential' in data:
            expense.is_essential = data.get('is_essential', False)
        if 'notes' in data:
            expense.notes = data.get('notes', '')

        # Update tags only if provided
        if 'tags' in data:
            expense.tags.clear()
            if data['tags']:
                for tag_name in data['tags']:
                    tag = Tag.query.filter_by(name=tag_name).first()
                    if not tag:
                        tag = Tag(name=tag_name)
                        db.session.add(tag)
                    expense.tags.append(tag)

        db.session.commit()
        return jsonify({'message': 'Expense updated successfully'})

@app.route('/api/categories', methods=['GET', 'POST'])
def categories():
    if request.method == 'POST':
        data = request.json
        category = Category(name=data['name'], color=data.get('color', '#3498db'))
        db.session.add(category)
        db.session.commit()
        return jsonify({'message': 'Category added successfully', 'id': category.id}), 201

    categories = Category.query.all()
    return jsonify([{
        'id': c.id,
        'name': c.name,
        'color': c.color
    } for c in categories])

@app.route('/api/categories/<int:category_id>', methods=['DELETE'])
def delete_category(category_id):
    """Delete a category and set all associated expenses to Uncategorized"""
    try:
        category = Category.query.get_or_404(category_id)
        category_name = category.name

        # Find all expenses with this category
        expenses = Expense.query.filter_by(category_id=category_id).all()

        # Set them to None (Uncategorized)
        for expense in expenses:
            expense.category_id = None

        # Delete the category
        db.session.delete(category)
        db.session.commit()

        return jsonify({
            'message': f'Category "{category_name}" deleted successfully',
            'updated_count': len(expenses)
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete category: {str(e)}'}), 500

@app.route('/api/tags', methods=['GET'])
def tags():
    tags = Tag.query.all()
    return jsonify([{'id': t.id, 'name': t.name} for t in tags])

@app.route('/api/cash-position', methods=['GET', 'POST'])
def cash_position_list():
    if request.method == 'POST':
        data = request.json
        cash_position = CashPosition(
            date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
            amount=float(data['amount']),
            notes=data.get('notes', '')
        )
        db.session.add(cash_position)
        db.session.commit()
        return jsonify({
            'message': 'Cash position added successfully',
            'id': cash_position.id
        }), 201

    # GET - return all cash positions sorted by date descending
    positions = CashPosition.query.order_by(CashPosition.date.desc()).all()
    return jsonify([{
        'id': p.id,
        'date': p.date.strftime('%Y-%m-%d'),
        'amount': p.amount,
        'notes': p.notes
    } for p in positions])

@app.route('/api/cash-position/<int:position_id>', methods=['PUT', 'DELETE'])
def cash_position_detail(position_id):
    position = CashPosition.query.get_or_404(position_id)

    if request.method == 'DELETE':
        db.session.delete(position)
        db.session.commit()
        return jsonify({'message': 'Cash position deleted successfully'})

    if request.method == 'PUT':
        data = request.json
        position.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        position.amount = float(data['amount'])
        position.notes = data.get('notes', '')
        db.session.commit()
        return jsonify({'message': 'Cash position updated successfully'})

@app.route('/api/cash-position/runway', methods=['GET'])
def cash_runway():
    """Calculate cash runway based on latest cash position and average monthly burn rate"""
    # Get the latest cash position
    latest_position = CashPosition.query.order_by(CashPosition.date.desc()).first()

    if not latest_position:
        return jsonify({
            'current_cash': 0,
            'runway_months': 0,
            'runway_date': None,
            'monthly_burn': 0,
            'message': 'No cash position recorded'
        })

    # Calculate average monthly burn rate from last 3 months
    three_months_ago = datetime.now().date() - timedelta(days=90)
    recent_expenses = Expense.query.filter(
        Expense.date >= three_months_ago,
        Expense.transaction_type == 'expense'
    ).all()
    recent_income = Expense.query.filter(
        Expense.date >= three_months_ago,
        Expense.transaction_type == 'income'
    ).all()

    total_expenses = sum(e.amount for e in recent_expenses)
    total_income = sum(e.amount for e in recent_income)
    monthly_burn = (total_expenses - total_income) / 3  # Average over 3 months

    # Calculate runway
    if monthly_burn > 0:
        runway_months = latest_position.amount / monthly_burn
        runway_date = (datetime.now() + timedelta(days=runway_months * 30)).strftime('%Y-%m-%d')
    else:
        runway_months = float('inf')
        runway_date = None

    return jsonify({
        'current_cash': latest_position.amount,
        'current_cash_date': latest_position.date.strftime('%Y-%m-%d'),
        'runway_months': round(runway_months, 1) if runway_months != float('inf') else None,
        'runway_date': runway_date,
        'monthly_burn': round(monthly_burn, 2),
        'message': 'success'
    })

@app.route('/api/statistics', methods=['GET'])
def statistics():
    period = request.args.get('period', 'month')
    selected_year = request.args.get('year', None)

    # Use selected year or current year
    if selected_year:
        try:
            base_year = int(selected_year)
        except:
            base_year = datetime.now().year
    else:
        base_year = datetime.now().year

    # Handle custom month selection (format: "custom-YYYY-MM")
    if period.startswith('custom-'):
        month_str = period.replace('custom-', '')  # "2025-01"
        try:
            year, month = map(int, month_str.split('-'))
            start_date = datetime(year, month, 1).date()
            # Calculate end date (first day of next month)
            if month == 12:
                end_date = datetime(year + 1, 1, 1).date()
            else:
                end_date = datetime(year, month + 1, 1).date()
        except:
            # Invalid format, default to current month
            start_date = datetime(base_year, datetime.now().month, 1).date()
            end_date = None
    elif period == 'month':
        # Use current month of base_year (or current month if it's the current year)
        current_month = datetime.now().month if base_year == datetime.now().year else 12
        start_date = datetime(base_year, current_month, 1).date()
        end_date = None
    elif period == 'last3months':
        # Last 3 months from today
        start_date = (datetime.now().date() - relativedelta(months=3))
        end_date = None
    elif period == 'last12months':
        # Last 12 months from today
        start_date = (datetime.now().date() - relativedelta(months=12))
        end_date = None
    elif period == 'year':
        start_date = datetime(base_year, 1, 1).date()
        end_date = datetime(base_year + 1, 1, 1).date()
    else:
        start_date = None
        end_date = None

    query = Expense.query
    if start_date:
        query = query.filter(Expense.date >= start_date)
    if end_date:
        query = query.filter(Expense.date < end_date)

    transactions = query.all()

    # Separate income and expenses
    income_total = sum(t.amount for t in transactions if t.transaction_type == 'income')
    expense_total = sum(t.amount for t in transactions if t.transaction_type == 'expense')
    net_position = income_total - expense_total

    # Always calculate year and month totals for dashboard cards (using selected year)
    year_start = datetime(base_year, 1, 1).date()
    year_end = datetime(base_year + 1, 1, 1).date()
    year_transactions = Expense.query.filter(Expense.date >= year_start, Expense.date < year_end).all()
    year_income = sum(t.amount for t in year_transactions if t.transaction_type == 'income')
    year_expenses = sum(t.amount for t in year_transactions if t.transaction_type == 'expense')
    year_net = year_income - year_expenses

    # For month, use current month if viewing current year, otherwise use December of selected year
    if base_year == datetime.now().year:
        month_start = datetime.now().date().replace(day=1)
        month_end = None
    else:
        # Show December for past years
        month_start = datetime(base_year, 12, 1).date()
        month_end = datetime(base_year + 1, 1, 1).date()

    month_query = Expense.query.filter(Expense.date >= month_start)
    if month_end:
        month_query = month_query.filter(Expense.date < month_end)
    month_transactions = month_query.all()
    month_income = sum(t.amount for t in month_transactions if t.transaction_type == 'income')
    month_expenses = sum(t.amount for t in month_transactions if t.transaction_type == 'expense')
    month_net = month_income - month_expenses

    # Essential vs Optional breakdown (expenses only) - ALWAYS USE YEAR DATA TO MATCH DASHBOARD
    year_expenses_only = [t for t in year_transactions if t.transaction_type == 'expense']
    essential_total = sum(e.amount for e in year_expenses_only if e.is_essential)
    optional_total = sum(e.amount for e in year_expenses_only if not e.is_essential)

    # By category
    category_stats = {}
    for transaction in transactions:
        cat_name = transaction.category.name if transaction.category else 'Uncategorized'
        if cat_name not in category_stats:
            category_stats[cat_name] = {
                'amount': 0,
                'count': 0,
                'color': transaction.category.color if transaction.category else '#95a5a6',
                'type': transaction.transaction_type
            }
        category_stats[cat_name]['amount'] += transaction.amount
        category_stats[cat_name]['count'] += 1

    # Monthly trend (12 months of selected year)
    monthly_trend = []
    for month_num in range(1, 13):
        m_start = datetime(base_year, month_num, 1).date()
        m_end = datetime(base_year, month_num + 1, 1).date() if month_num < 12 else datetime(base_year + 1, 1, 1).date()
        m_transactions = Expense.query.filter(
            Expense.date >= m_start,
            Expense.date < m_end
        ).all()
        m_income = sum(t.amount for t in m_transactions if t.transaction_type == 'income')
        m_exp = sum(t.amount for t in m_transactions if t.transaction_type == 'expense')
        m_expenses_only = [t for t in m_transactions if t.transaction_type == 'expense']
        monthly_trend.append({
            'month': m_start.strftime('%b %Y'),
            'income': m_income,
            'expenses': m_exp,
            'net': m_income - m_exp,
            'essential': sum(e.amount for e in m_expenses_only if e.is_essential),
            'optional': sum(e.amount for e in m_expenses_only if not e.is_essential)
        })

    # Calculate month-over-month net change
    mom_change = 0
    if len(monthly_trend) >= 2:
        current_month_net = monthly_trend[-1]['net']
        previous_month_net = monthly_trend[-2]['net']
        if abs(previous_month_net) > 0:
            mom_change = ((current_month_net - previous_month_net) / abs(previous_month_net)) * 100

    return jsonify({
        'income_total': income_total,
        'expense_total': expense_total,
        'net_position': net_position,
        'year_income': year_income,
        'year_expenses': year_expenses,
        'year_net': year_net,
        'month_income': month_income,
        'month_expenses': month_expenses,
        'month_net': month_net,
        'count': len(transactions),
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

    # Extract source account from filename (remove .csv extension)
    source_account = file.filename.rsplit('.', 1)[0] if '.' in file.filename else file.filename

    try:
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_reader = csv.DictReader(stream)

        imported_count = 0
        errors = []

        # Log available columns for debugging
        first_row = True

        for row_num, row in enumerate(csv_reader, start=2):
            if first_row:
                # Debug: log all column names
                print(f"DEBUG: CSV columns found: {list(row.keys())}")
                first_row = False
            try:
                # Try to parse common CSV formats
                # First, normalize the row keys by stripping whitespace and lowercasing
                normalized_row = {k.strip().lower(): v.strip() if isinstance(v, str) else v for k, v in row.items()}

                # Try to find date column
                date_str = None
                for key in ['date', 'transaction date']:
                    if key in normalized_row and normalized_row[key]:
                        date_str = normalized_row[key]
                        break

                # Try to find description column
                description = normalized_row.get('description')

                # MORTGAGE FORMAT: Skip interest component rows
                # Skip rows with "Loan Interest", "Interest rate change", or just "INTEREST" in description
                # This prevents double-counting on interest-only mortgages where LOAN PAYMENT and INTEREST
                # appear as separate rows on the same date but represent the same transaction
                if description:
                    desc_lower = description.lower().strip()
                    desc_upper = description.strip()
                    if ('loan interest' in desc_lower or
                        'interest rate change' in desc_lower or
                        desc_upper == 'INTEREST'):
                        continue

                # Detect CSV format: check for "debits and credits" column (bank format) or "amount" column (Amex format)
                debits_credits = None
                for key in ['debits and credits', 'debits/credits', 'debits & credits']:
                    if key in normalized_row and normalized_row[key]:
                        debits_credits = normalized_row[key]
                        break

                amount_str = normalized_row.get('amount') if normalized_row.get('amount') else None

                # Must have either debits/credits or amount
                if not debits_credits and not amount_str:
                    errors.append(f"Row {row_num}: Missing amount or debits/credits column")
                    continue

                if not all([date_str, description]):
                    errors.append(f"Row {row_num}: Missing required fields (date, description)")
                    continue

                # Parse date (try multiple formats)
                date_obj = None
                date_formats = [
                    '%Y-%m-%d',      # 2024-01-15
                    '%d/%m/%Y',      # 15/01/2024 (Australian format)
                    '%m/%d/%Y',      # 01/15/2024 (US format)
                    '%Y/%m/%d',      # 2024/01/15
                    '%d-%m-%Y',      # 15-01-2024
                    '%d %b %Y',      # 15 Jan 2024
                    '%d %B %Y',      # 15 January 2024
                    '%b %d %Y',      # Jan 15 2024
                    '%B %d %Y',      # January 15 2024
                    '%d-%b-%Y',      # 15-Jan-2024
                    '%d/%b/%Y',      # 15/Jan/2024
                    '%Y%m%d',        # 20240115
                ]

                for date_format in date_formats:
                    try:
                        date_obj = datetime.strptime(date_str.strip(), date_format).date()
                        break
                    except ValueError:
                        continue

                if not date_obj:
                    errors.append(f"Row {row_num}: Invalid date format '{date_str}' - supported formats: DD/MM/YYYY, DD-MM-YYYY, DD MMM YYYY, etc.")
                    continue

                # Parse amount based on format
                if debits_credits:
                    # BANK FORMAT: debits and credits column
                    # Parse the amount value
                    amount_clean = debits_credits.replace('$', '').replace(',', '').strip()
                    if not amount_clean or amount_clean == '':
                        errors.append(f"Row {row_num}: Empty debits/credits value")
                        continue

                    # Check if value is in parentheses (debit/expense)
                    if amount_clean.startswith('(') and amount_clean.endswith(')'):
                        # Debit (expense) - remove parentheses
                        amount_clean = amount_clean[1:-1].strip()
                        amount_float = float(amount_clean)
                        is_income_from_amount = False  # Parentheses = expense
                    else:
                        # No parentheses - need to check description for debit/credit keywords
                        amount_float = float(amount_clean)

                        # Bank statement keywords to determine debit vs credit
                        desc_lower = description.lower()

                        # LAYER 1: Skip internal transfers between our bank accounts
                        # BSB 944600: internal bank transfers (but NOT mortgage repayments)
                        # BSB 013350: Brooklyn Avenue mortgage payment account (tracked separately)
                        #
                        # Two layers of protection for mortgage repayments:
                        # 1. Must contain "repayment" keyword
                        # 2. Must be from specific account BSB 944600 acc 000772410
                        is_mortgage_repayment = ('repayment' in desc_lower and
                                                '944600' in description and
                                                '000772410' in description)

                        # Skip internal transfers but allow mortgage repayments through
                        if not is_mortgage_repayment:
                            if ('944600' in description or 'bsb 944600' in desc_lower or
                                '013350' in description or 'bsb 013350' in desc_lower):
                                continue

                        # LAYER 2: Skip transfers from/to Gideon or Tayla (internal family transfers)
                        family_names = ['gideon', 'tayla', 'reisner']
                        transfer_prefixes = ['transfer from', 'transfer to', 'direct credit from',
                                            'direct debit to', 'payment from', 'payment to']

                        # Check if it's a transfer with a family member's name
                        is_family_transfer = False
                        for prefix in transfer_prefixes:
                            if prefix in desc_lower:
                                # Check if any family name appears after the transfer keyword
                                if any(name in desc_lower for name in family_names):
                                    is_family_transfer = True
                                    break

                        if is_family_transfer:
                            continue

                        # LAYER 3: Skip credit card payments (already counted in credit card statements)
                        # Only skip "direct debit to" and "transfer to" for credit card companies
                        credit_card_keywords = ['american express', 'amex']

                        is_cc_payment = False
                        if 'direct debit to' in desc_lower or 'transfer to' in desc_lower:
                            # Only skip if it's to a credit card company
                            is_cc_payment = any(cc in desc_lower for cc in credit_card_keywords)

                        if is_cc_payment:
                            continue

                        # Keywords that indicate DEBITS (money going OUT / expenses)
                        debit_keywords = ['purchase', 'bpay', 'withdrawal', 'atm',
                                         'direct credit to', 'direct debit to', 'payment to', 'transfer to']

                        # Keywords that indicate CREDITS (money coming IN / income)
                        credit_keywords = ['direct credit from', 'transfer from', 'deposit',
                                          'payment received', 'salary', 'wage']

                        # Check for debit keywords first
                        is_debit = any(keyword in desc_lower for keyword in debit_keywords)
                        is_credit = any(keyword in desc_lower for keyword in credit_keywords)

                        # Default to expense if unclear
                        is_income_from_amount = is_credit and not is_debit

                    amount = abs(amount_float)
                else:
                    # CREDIT CARD FORMAT: amount column
                    # Expenses: positive numbers $100.00
                    # Payments to card: negative numbers -$100.00 (NOT income, skip these)
                    amount_clean = amount_str.replace('$', '').replace(',', '').strip()
                    amount_float = float(amount_clean)
                    amount = abs(amount_float)

                    # For credit cards: positive = expense, negative = payment (skip)
                    # We'll filter out payments by treating them as neither income nor expense
                    if amount_float < 0:
                        # This is a payment TO the credit card - skip it
                        continue
                    else:
                        # This is an expense
                        is_income_from_amount = False

                # Detect transaction type (income vs expense)
                # Income keywords for detection
                income_keywords = ['payment received', 'direct debit received', 'online payment received',
                                   'salary', 'wage', 'deposit', 'transfer in', 'refund', 'thank you', 'thankyou',
                                   'jeremy wald',  # Rental income from Denbigh Road apartment
                                   'rt etgar glen eira']  # Rental income from Brooklyn Avenue property
                description_lower = description.lower()

                # IMPORTANT: Explicitly mark "transfer to" as expense (never income)
                # This fixes cases where positive amounts might be misinterpreted
                is_transfer_out = 'transfer to' in description_lower or 'payment to' in description_lower

                # Determine if this is income (use amount sign OR keywords, but NOT if it's a transfer out)
                is_income = (is_income_from_amount or any(keyword in description_lower for keyword in income_keywords)) and not is_transfer_out
                transaction_type = 'income' if is_income else 'expense'

                # SMART CATEGORIZATION (only for expenses)
                if transaction_type == 'expense':
                    category_name, is_essential, suggested_tags = smart_categorize(description)
                else:
                    # Income category
                    category_name = 'Income'
                    is_essential = False
                    suggested_tags = ['income']

                # Check for duplicate (same description, amount, and date)
                existing = Expense.query.filter_by(
                    description=description,
                    amount=amount,
                    date=date_obj
                ).first()

                if existing:
                    # Skip duplicate
                    continue

                # Find or create category
                category = Category.query.filter_by(name=category_name).first()
                if not category:
                    category = Category(name=category_name)
                    db.session.add(category)
                    db.session.flush()

                # Extract BPAY biller code if present (format: BPAY 12345 or BPAY Biller Code: 12345)
                bpay_code = None
                bpay_match = re.search(r'bpay.*?(\d{4,6})', description.lower())
                if bpay_match:
                    bpay_code = bpay_match.group(1)

                # Create expense with auto-categorization
                expense = Expense(
                    description=description,
                    amount=amount,
                    date=date_obj,
                    category_id=category.id,
                    is_essential=is_essential,
                    transaction_type=transaction_type,
                    source_account=source_account,
                    bpay_biller_code=bpay_code
                )

                # Add auto-generated tags (avoid duplicates) using no_autoflush
                with db.session.no_autoflush:
                    for tag_name in suggested_tags:
                        tag = Tag.query.filter_by(name=tag_name).first()
                        if not tag:
                            tag = Tag(name=tag_name)
                            db.session.add(tag)
                            db.session.flush()  # Flush to get the tag ID

                        # Only append if tag is not already in the expense tags
                        if tag not in expense.tags:
                            expense.tags.append(tag)

                db.session.add(expense)
                imported_count += 1

            except Exception as e:
                db.session.rollback()  # Rollback on error to prevent session issues
                errors.append(f"Row {row_num}: {str(e)}")
                continue

        db.session.commit()

        return jsonify({
            'message': f'Successfully imported {imported_count} expenses with smart categorization',
            'imported': imported_count,
            'errors': errors
        })

    except Exception as e:
        return jsonify({'error': f'Failed to process CSV: {str(e)}'}), 400


# ==========================================
# Helper Functions for Smart Matching
# ==========================================

def normalize_description(description):
    """
    Normalize a transaction description for comparison.
    Removes variable parts like dates, reference numbers, amounts, etc.
    """
    desc = description.lower().strip()

    # Remove dates in various formats
    desc = re.sub(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', '', desc)
    desc = re.sub(r'\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*\d{0,4}', '', desc, flags=re.IGNORECASE)

    # Remove reference numbers, receipt numbers, transaction IDs
    desc = re.sub(r'(ref|rcpt|receipt|txn|transaction|id|no|#)[\s:]*[a-z0-9]+', '', desc, flags=re.IGNORECASE)
    desc = re.sub(r'\b[a-z]{2,4}\d{6,}\b', '', desc)  # Letter prefix + numbers
    desc = re.sub(r'\b\d{6,}\b', '', desc)  # Long number sequences (6+ digits)

    # Remove card numbers (last 4 digits pattern)
    desc = re.sub(r'card\s*\d{4}', '', desc, flags=re.IGNORECASE)
    desc = re.sub(r'x{2,}\d{4}', '', desc, flags=re.IGNORECASE)

    # Remove currency amounts
    desc = re.sub(r'\$[\d,]+\.?\d*', '', desc)
    desc = re.sub(r'aud\s*[\d,]+\.?\d*', '', desc, flags=re.IGNORECASE)

    # Remove common suffixes that vary
    desc = re.sub(r'\s+(aus|australia|au|vic|nsw|qld|sa|wa|nt|tas|act)\s*$', '', desc, flags=re.IGNORECASE)
    desc = re.sub(r'\s+\d{4}\s*$', '', desc)  # Trailing 4-digit numbers

    # Remove extra whitespace
    desc = re.sub(r'\s+', ' ', desc).strip()

    return desc


def get_period_label(period):
    """Get human-readable label for a period"""
    today = datetime.now().date()

    if period.startswith('range-'):
        range_str = period.replace('range-', '')
        try:
            start_str, end_str = range_str.split('_')
            return f'{start_str} to {end_str}'
        except:
            return 'Custom Range'
    elif period.startswith('custom-'):
        month_str = period.replace('custom-', '')
        try:
            year, month = map(int, month_str.split('-'))
            return datetime(year, month, 1).strftime('%B %Y')
        except:
            return 'Selected Month'
    elif period == 'month':
        return today.strftime('%B %Y')
    elif period == 'last3months':
        return 'Last 3 Months'
    elif period == 'last12months':
        return 'Last 12 Months'
    elif period == 'year':
        return f'Year to Date ({today.year})'
    elif period == 'all':
        return 'All Time'
    return 'Selected Period'


# ==========================================
# Duplicate Detection Endpoints
# ==========================================

@app.route('/api/duplicates', methods=['GET'])
@login_required
def find_duplicates():
    """Find potential duplicate transactions in the database"""
    expenses = Expense.query.order_by(Expense.date.desc()).all()

    # Group by (date, amount) - most reliable duplicate indicators
    groups = {}
    for exp in expenses:
        key = (exp.date.isoformat(), str(exp.amount))
        if key not in groups:
            groups[key] = []
        groups[key].append(exp)

    # Find groups with 2+ transactions (potential duplicates)
    duplicates = []
    for key, items in groups.items():
        if len(items) >= 2:
            # Further check: descriptions should be similar
            desc_groups = {}
            for item in items:
                norm_desc = normalize_description(item.description)
                if norm_desc not in desc_groups:
                    desc_groups[norm_desc] = []
                desc_groups[norm_desc].append(item)

            for desc, desc_items in desc_groups.items():
                if len(desc_items) >= 2:
                    duplicates.append({
                        'date': key[0],
                        'amount': key[1],
                        'description': desc_items[0].description,
                        'count': len(desc_items),
                        'items': [{'id': i.id, 'description': i.description,
                                   'source_account': i.source_account,
                                   'category': i.category.name if i.category else 'Uncategorized'} for i in desc_items]
                    })

    duplicates.sort(key=lambda x: x['date'], reverse=True)
    return jsonify({'duplicates': duplicates, 'total_groups': len(duplicates)})


@app.route('/api/duplicates/remove', methods=['DELETE'])
@login_required
def remove_duplicates():
    """Remove specified duplicate transactions"""
    try:
        data = request.get_json()
        ids_to_remove = data.get('ids', [])

        if not ids_to_remove:
            return jsonify({'error': 'No IDs provided'}), 400

        removed_count = 0
        for expense_id in ids_to_remove:
            expense = Expense.query.get(expense_id)
            if expense:
                db.session.delete(expense)
                removed_count += 1

        db.session.commit()
        return jsonify({'message': f'Successfully removed {removed_count} duplicate(s)', 'removed_count': removed_count})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to remove duplicates: {str(e)}'}), 500


# ==========================================
# Service Station Recategorization
# ==========================================

@app.route('/api/expenses/recategorize-service-stations', methods=['POST'])
@login_required
def recategorize_service_stations():
    """Re-categorize existing service station transactions based on amount threshold"""
    try:
        service_station_keywords = ['7-eleven', '7eleven', 'ampol', 'bp ', 'shell ', 'caltex',
                                    'united petroleum', 'metro petroleum', 'liberty ', 'puma energy',
                                    'coles express', 'woolworths petrol', 'costco fuel']

        food_category = Category.query.filter_by(name='Food & Dining').first()
        transport_category = Category.query.filter_by(name='Transportation').first()

        if not food_category or not transport_category:
            return jsonify({'error': 'Required categories not found'}), 400

        all_expenses = Expense.query.filter_by(transaction_type='expense').all()

        updated_to_food = 0
        updated_to_transport = 0
        details = []

        for expense in all_expenses:
            desc_lower = expense.description.lower()
            is_service_station = any(keyword in desc_lower for keyword in service_station_keywords)

            if is_service_station:
                if expense.amount >= 40:
                    # Should be Transportation (fuel)
                    if expense.category_id != transport_category.id:
                        old_cat = expense.category.name if expense.category else 'None'
                        expense.category_id = transport_category.id
                        expense.is_essential = True
                        updated_to_transport += 1
                        details.append(f"{expense.description[:30]}... ${expense.amount:.2f} -> Transportation (was {old_cat})")
                else:
                    # Should be Food & Dining (convenience store purchase)
                    if expense.category_id != food_category.id:
                        old_cat = expense.category.name if expense.category else 'None'
                        expense.category_id = food_category.id
                        expense.is_essential = False
                        updated_to_food += 1
                        details.append(f"{expense.description[:30]}... ${expense.amount:.2f} -> Food & Dining (was {old_cat})")

        db.session.commit()

        return jsonify({
            'message': f'Recategorized {updated_to_transport + updated_to_food} service station transactions',
            'updated_to_transport': updated_to_transport,
            'updated_to_food': updated_to_food,
            'details': details[:20]  # Limit details to first 20
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to recategorize: {str(e)}'}), 500


# ==========================================
# Enhanced Bulk Update Endpoints
# ==========================================

@app.route('/api/expenses/bulk-update-essential', methods=['POST'])
@login_required
def bulk_update_essential():
    """Update is_essential for multiple expenses by ID"""
    try:
        data = request.get_json()
        expense_ids = data.get('expense_ids', [])
        is_essential = data.get('is_essential', False)

        if not expense_ids:
            return jsonify({'error': 'No expense IDs provided'}), 400

        updated_count = 0
        for expense_id in expense_ids:
            expense = Expense.query.get(expense_id)
            if expense:
                expense.is_essential = is_essential
                updated_count += 1

        db.session.commit()
        return jsonify({
            'message': f'Successfully updated {updated_count} expense(s)',
            'updated_count': updated_count
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update: {str(e)}'}), 500


# ==========================================
# Category Management Endpoints
# ==========================================

@app.route('/api/categories/<int:category_id>', methods=['PUT'])
@login_required
def update_category(category_id):
    """Update a category's name or color"""
    try:
        category = Category.query.get_or_404(category_id)
        data = request.get_json()

        if 'name' in data:
            # Check if name is unique (except for this category)
            existing = Category.query.filter(Category.name == data['name'], Category.id != category_id).first()
            if existing:
                return jsonify({'error': 'Category name already exists'}), 400
            category.name = data['name']

        if 'color' in data:
            category.color = data['color']

        db.session.commit()
        return jsonify({'message': 'Category updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update category: {str(e)}'}), 500


# ==========================================
# PDF Export Feature
# ==========================================

try:
    from fpdf import FPDF
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False


if PDF_AVAILABLE:
    class PDFReportGenerator(FPDF):
        """Professional PDF financial report generator"""

        # Color palette
        NAVY = (30, 58, 95)
        TEAL = (13, 148, 136)
        CORAL = (239, 68, 68)
        LIGHT_GRAY = (243, 244, 246)
        DARK_TEXT = (31, 41, 55)
        WHITE = (255, 255, 255)

        def __init__(self, title="Financial Report", period_label=""):
            super().__init__()
            self.title = title
            self.period_label = period_label
            self.set_auto_page_break(auto=True, margin=20)
            self.set_margins(20, 20, 20)

        def header(self):
            # Navy header bar
            self.set_fill_color(*self.NAVY)
            self.rect(0, 0, 210, 45, 'F')

            # Title
            self.set_y(12)
            self.set_font('Helvetica', 'B', 24)
            self.set_text_color(*self.WHITE)
            self.cell(0, 10, 'BALANCE SHEET', ln=True, align='C')

            # Subtitle
            self.set_font('Helvetica', '', 14)
            self.cell(0, 7, self.title, ln=True, align='C')

            # Date and period
            self.set_font('Helvetica', '', 10)
            self.cell(0, 5, f'Generated: {datetime.now().strftime("%B %d, %Y")}  |  Period: {self.period_label}', ln=True, align='C')

            self.set_y(55)
            self.set_text_color(*self.DARK_TEXT)

        def footer(self):
            self.set_y(-15)
            self.set_font('Helvetica', '', 8)
            self.set_text_color(128, 128, 128)
            self.cell(0, 10, f'Page {self.page_no()}  |  Generated by Balance Sheet App', align='C')

        def section_header(self, title):
            self.ln(5)
            self.set_fill_color(*self.NAVY)
            self.set_text_color(*self.WHITE)
            self.set_font('Helvetica', 'B', 11)
            self.cell(0, 8, f'  {title}', fill=True, ln=True)
            self.set_text_color(*self.DARK_TEXT)
            self.ln(2)

        def format_currency(self, amount):
            if amount >= 0:
                return f'${amount:,.2f}'
            else:
                return f'-${abs(amount):,.2f}'

        def add_summary_section(self, stats):
            self.section_header('SUMMARY')

            self.set_font('Helvetica', '', 10)

            # Create summary table
            data = [
                ['Total Income', self.format_currency(stats.get('income_total', 0))],
                ['Total Expenses', self.format_currency(stats.get('expense_total', 0))],
                ['Net Position', self.format_currency(stats.get('net_position', 0))],
                ['Savings Rate', f"{(stats.get('net_position', 0) / stats.get('income_total', 1) * 100) if stats.get('income_total', 0) > 0 else 0:.1f}%"]
            ]

            for row in data:
                self.set_font('Helvetica', '', 10)
                self.cell(80, 7, row[0])
                self.set_font('Helvetica', 'B', 10)
                self.cell(0, 7, row[1], ln=True)

            self.ln(3)

        def add_essential_optional_section(self, stats):
            self.section_header('ESSENTIAL VS OPTIONAL SPENDING')

            essential = stats.get('essential_total', 0)
            optional = stats.get('optional_total', 0)
            total = essential + optional

            self.set_font('Helvetica', '', 10)

            if total > 0:
                self.cell(80, 7, 'Essential Spending')
                self.cell(40, 7, self.format_currency(essential))
                self.cell(0, 7, f'({essential/total*100:.1f}%)', ln=True)

                self.cell(80, 7, 'Optional Spending')
                self.cell(40, 7, self.format_currency(optional))
                self.cell(0, 7, f'({optional/total*100:.1f}%)', ln=True)
            else:
                self.cell(0, 7, 'No expense data available', ln=True)

            self.ln(3)

        def add_category_breakdown(self, by_category):
            self.section_header('CATEGORY BREAKDOWN')

            # Sort by amount descending
            sorted_cats = sorted(by_category.items(), key=lambda x: x[1]['amount'], reverse=True)

            # Table header
            self.set_fill_color(*self.LIGHT_GRAY)
            self.set_font('Helvetica', 'B', 9)
            self.cell(70, 7, 'Category', border=1, fill=True)
            self.cell(25, 7, 'Type', border=1, fill=True, align='C')
            self.cell(40, 7, 'Amount', border=1, fill=True, align='R')
            self.cell(25, 7, 'Count', border=1, fill=True, align='C')
            self.ln()

            # Table rows
            self.set_font('Helvetica', '', 9)
            for cat_name, data in sorted_cats:
                self.cell(70, 6, cat_name[:35], border=1)
                self.cell(25, 6, data.get('type', 'expense')[:3].title(), border=1, align='C')
                self.cell(40, 6, self.format_currency(data['amount']), border=1, align='R')
                self.cell(25, 6, str(data['count']), border=1, align='C')
                self.ln()

            self.ln(3)

        def add_monthly_trend(self, monthly_trend):
            self.section_header('MONTHLY TREND (LAST 12 MONTHS)')

            # Table header
            self.set_fill_color(*self.LIGHT_GRAY)
            self.set_font('Helvetica', 'B', 9)
            self.cell(35, 7, 'Month', border=1, fill=True)
            self.cell(35, 7, 'Income', border=1, fill=True, align='R')
            self.cell(35, 7, 'Expenses', border=1, fill=True, align='R')
            self.cell(35, 7, 'Net', border=1, fill=True, align='R')
            self.ln()

            # Table rows
            self.set_font('Helvetica', '', 9)
            for month_data in monthly_trend:
                self.cell(35, 6, month_data['month'], border=1)
                self.cell(35, 6, self.format_currency(month_data['income']), border=1, align='R')
                self.cell(35, 6, self.format_currency(month_data['expenses']), border=1, align='R')

                # Color code net
                net = month_data['net']
                self.cell(35, 6, self.format_currency(net), border=1, align='R')
                self.ln()

            self.ln(3)


@app.route('/api/export/pdf', methods=['POST'])
@login_required
def export_pdf():
    """Generate PDF report based on selected sections and period"""
    if not PDF_AVAILABLE:
        return jsonify({'error': 'PDF export requires fpdf2. Install with: pip install fpdf2'}), 500

    try:
        data = request.json or {}
        period = data.get('period', 'year')
        sections = data.get('sections', {
            'summary': True,
            'essential_optional': True,
            'category_breakdown': True,
            'monthly_trend': False
        })
        custom_title = data.get('title', 'Financial Report')

        # Get period label
        period_label = get_period_label(period)

        # Calculate date range
        today = datetime.now().date()

        if period.startswith('range-'):
            range_str = period.replace('range-', '')
            try:
                start_str, end_str = range_str.split('_')
                start_date = datetime.strptime(start_str, '%Y-%m-%d').date()
                end_date = datetime.strptime(end_str, '%Y-%m-%d').date() + timedelta(days=1)
            except:
                start_date = today.replace(month=1, day=1)
                end_date = None
        elif period.startswith('custom-'):
            month_str = period.replace('custom-', '')
            try:
                year, month = map(int, month_str.split('-'))
                start_date = datetime(year, month, 1).date()
                if month == 12:
                    end_date = datetime(year + 1, 1, 1).date()
                else:
                    end_date = datetime(year, month + 1, 1).date()
            except:
                start_date = today.replace(day=1)
                end_date = None
        elif period == 'month':
            start_date = today.replace(day=1)
            end_date = None
        elif period == 'last3months':
            start_date = (today - relativedelta(months=3))
            end_date = None
        elif period == 'last12months':
            start_date = (today - relativedelta(months=12))
            end_date = None
        elif period == 'year':
            start_date = today.replace(month=1, day=1)
            end_date = None
        else:
            start_date = None
            end_date = None

        # Query transactions
        query = Expense.query
        if start_date:
            query = query.filter(Expense.date >= start_date)
        if end_date:
            query = query.filter(Expense.date < end_date)

        transactions = query.all()

        # Calculate statistics
        income_total = sum(t.amount for t in transactions if t.transaction_type == 'income')
        expense_total = sum(t.amount for t in transactions if t.transaction_type == 'expense')
        net_position = income_total - expense_total

        expenses_only = [t for t in transactions if t.transaction_type == 'expense']
        essential_total = sum(e.amount for e in expenses_only if e.is_essential)
        optional_total = sum(e.amount for e in expenses_only if not e.is_essential)

        # By category
        by_category = {}
        for t in transactions:
            cat_name = t.category.name if t.category else 'Uncategorized'
            if cat_name not in by_category:
                by_category[cat_name] = {'amount': 0, 'count': 0, 'type': t.transaction_type}
            by_category[cat_name]['amount'] += t.amount
            by_category[cat_name]['count'] += 1

        # Monthly trend
        monthly_trend = []
        for i in range(11, -1, -1):
            month_start = (today.replace(day=1) - relativedelta(months=i))
            month_end = month_start + relativedelta(months=1)
            month_transactions = Expense.query.filter(
                Expense.date >= month_start,
                Expense.date < month_end
            ).all()
            month_income = sum(t.amount for t in month_transactions if t.transaction_type == 'income')
            month_exp = sum(t.amount for t in month_transactions if t.transaction_type == 'expense')
            monthly_trend.append({
                'month': month_start.strftime('%b %Y'),
                'income': month_income,
                'expenses': month_exp,
                'net': month_income - month_exp
            })

        stats = {
            'income_total': income_total,
            'expense_total': expense_total,
            'net_position': net_position,
            'essential_total': essential_total,
            'optional_total': optional_total
        }

        # Generate PDF
        pdf = PDFReportGenerator(title=custom_title, period_label=period_label)
        pdf.add_page()

        if sections.get('summary', True):
            pdf.add_summary_section(stats)

        if sections.get('essential_optional', True):
            pdf.add_essential_optional_section(stats)

        if sections.get('category_breakdown', True):
            pdf.add_category_breakdown(by_category)

        if sections.get('monthly_trend', False):
            pdf.add_monthly_trend(monthly_trend)

        # Output to BytesIO
        pdf_output = io.BytesIO()
        pdf.output(pdf_output)
        pdf_output.seek(0)

        from flask import send_file
        return send_file(
            pdf_output,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'balance_sheet_report_{datetime.now().strftime("%Y-%m-%d")}.pdf'
        )

    except Exception as e:
        return jsonify({'error': f'Failed to generate PDF: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)
