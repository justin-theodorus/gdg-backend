"""
Configuration module for CareConnect Hub Telegram Bot.
Loads environment variables and provides configuration constants.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / '.env'

if ENV_FILE.exists():
    load_dotenv(ENV_FILE)

# Telegram Configuration
TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN', '')
ADMIN_TELEGRAM_ID = int(os.getenv('ADMIN_TELEGRAM_ID', '0'))

# Backend API Configuration
BACKEND_API_URL = os.getenv('BACKEND_API_URL', 'http://localhost:3000/api')

# Supabase Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY', '')

# Google Calendar Configuration
GOOGLE_CALENDAR_ID = os.getenv('GOOGLE_CALENDAR_ID', '')
SERVICE_ACCOUNT_FILE = os.getenv('SERVICE_ACCOUNT_FILE', str(BASE_DIR / 'service_account.json'))

# Gemini AI Configuration (for Edge Function fallback)
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')

# Conversation States
INPUT_EMAIL = 0
INPUT_PASSWORD = 1
INPUT_CARE_NAME = 2
UPLOAD_POSTER = 3

# Validate required configuration
def validate_config():
    """Validate that required configuration is present."""
    errors = []
    
    if not TELEGRAM_TOKEN:
        errors.append('TELEGRAM_TOKEN is required')
    if not ADMIN_TELEGRAM_ID:
        errors.append('ADMIN_TELEGRAM_ID is required')
    if not BACKEND_API_URL:
        errors.append('BACKEND_API_URL is required')
    if not SUPABASE_URL:
        errors.append('SUPABASE_URL is required')
    if not SUPABASE_ANON_KEY:
        errors.append('SUPABASE_ANON_KEY is required')
    
    if errors:
        raise ValueError(f"Configuration errors: {', '.join(errors)}")
    
    return True
