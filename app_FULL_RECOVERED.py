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
APP_PASSWORD = os.environ.get('APP_PASSWORD', 'balancesheet2025')

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
    \