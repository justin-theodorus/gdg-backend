"""
Session management for Telegram Bot.
Handles user session data including JWT tokens.
"""
import logging
from typing import Optional
from telegram.ext import ContextTypes

logger = logging.getLogger(__name__)


class UserSession:
    """Manages user session data stored in context.user_data."""
    
    @staticmethod
    def get_token(context: ContextTypes.DEFAULT_TYPE) -> Optional[str]:
        """Get JWT token from session."""
        return context.user_data.get('token')
    
    @staticmethod
    def set_token(context: ContextTypes.DEFAULT_TYPE, token: str):
        """Set JWT token in session."""
        context.user_data['token'] = token
    
    @staticmethod
    def get_user(context: ContextTypes.DEFAULT_TYPE) -> Optional[dict]:
        """Get user data from session."""
        return context.user_data.get('user')
    
    @staticmethod
    def set_user(context: ContextTypes.DEFAULT_TYPE, user: dict):
        """Set user data in session."""
        context.user_data['user'] = user
    
    @staticmethod
    def get_participant_id(context: ContextTypes.DEFAULT_TYPE) -> Optional[str]:
        """Get participant ID from session."""
        user = context.user_data.get('user', {})
        return user.get('participant_id')
    
    @staticmethod
    def get_caregiver_id(context: ContextTypes.DEFAULT_TYPE) -> Optional[str]:
        """Get caregiver ID from session."""
        user = context.user_data.get('user', {})
        return user.get('caregiver_id')
    
    @staticmethod
    def get_user_id(context: ContextTypes.DEFAULT_TYPE) -> Optional[str]:
        """Get user ID from session."""
        user = context.user_data.get('user', {})
        return user.get('id')
    
    @staticmethod
    def get_role(context: ContextTypes.DEFAULT_TYPE) -> Optional[str]:
        """Get user role from session."""
        user = context.user_data.get('user', {})
        return user.get('role')
    
    @staticmethod
    def get_email(context: ContextTypes.DEFAULT_TYPE) -> Optional[str]:
        """Get user email from session."""
        user = context.user_data.get('user', {})
        return user.get('email')
    
    @staticmethod
    def get_name(context: ContextTypes.DEFAULT_TYPE) -> str:
        """Get user display name from session."""
        user = context.user_data.get('user', {})
        first_name = user.get('first_name', '')
        last_name = user.get('last_name', '')
        return f"{first_name} {last_name}".strip() or 'User'
    
    @staticmethod
    def is_authenticated(context: ContextTypes.DEFAULT_TYPE) -> bool:
        """Check if user is authenticated."""
        return bool(context.user_data.get('token'))
    
    @staticmethod
    def login(context: ContextTypes.DEFAULT_TYPE, user: dict, token: str):
        """Store user login data in session."""
        context.user_data['user'] = user
        context.user_data['token'] = token
        logger.info(f"User logged in: {user.get('email')} (role: {user.get('role')})")
    
    @staticmethod
    def logout(context: ContextTypes.DEFAULT_TYPE):
        """Clear user session data."""
        context.user_data.pop('user', None)
        context.user_data.pop('token', None)
        context.user_data.pop('registration', None)
        logger.info("User logged out")
    
    @staticmethod
    def set_registration_data(context: ContextTypes.DEFAULT_TYPE, key: str, value):
        """Set temporary registration data."""
        if 'registration' not in context.user_data:
            context.user_data['registration'] = {}
        context.user_data['registration'][key] = value
    
    @staticmethod
    def get_registration_data(context: ContextTypes.DEFAULT_TYPE, key: str, default=None):
        """Get temporary registration data."""
        return context.user_data.get('registration', {}).get(key, default)
    
    @staticmethod
    def clear_registration_data(context: ContextTypes.DEFAULT_TYPE):
        """Clear temporary registration data."""
        context.user_data.pop('registration', None)
    
    @staticmethod
    def set_draft(context: ContextTypes.DEFAULT_TYPE, draft: dict):
        """Set draft event data (for admin poster upload)."""
        context.user_data['draft'] = draft
    
    @staticmethod
    def get_draft(context: ContextTypes.DEFAULT_TYPE) -> Optional[dict]:
        """Get draft event data."""
        return context.user_data.get('draft')
    
    @staticmethod
    def clear_draft(context: ContextTypes.DEFAULT_TYPE):
        """Clear draft event data."""
        context.user_data.pop('draft', None)
    
    @staticmethod
    def set_poster_id(context: ContextTypes.DEFAULT_TYPE, poster_id: str):
        """Set poster file ID for broadcasting."""
        context.user_data['poster_id'] = poster_id
    
    @staticmethod
    def get_poster_id(context: ContextTypes.DEFAULT_TYPE) -> Optional[str]:
        """Get poster file ID."""
        return context.user_data.get('poster_id')
