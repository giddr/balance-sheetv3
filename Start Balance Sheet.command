#!/bin/bash
cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Load environment variables if .env exists
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

# Open browser after 4 seconds
(sleep 4 && open http://127.0.0.1:8080) &

# Start Flask app
python3 app.py
