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
    
    # ==================== VOLUNTEER SESSION HELPERS ====================
    
    @staticmethod
    def get_volunteer_id(context: ContextTypes.DEFAULT_TYPE) -> Optional[str]:
        """Get volunteer ID from session."""
        user = context.user_data.get('user', {})
        return user.get('volunteer_id')
    
    @staticmethod
    def set_volunteer_data(context: ContextTypes.DEFAULT_TYPE, key: str, value):
        """Set temporary volunteer registration data."""
        if 'volunteer_reg' not in context.user_data:
            context.user_data['volunteer_reg'] = {}
        context.user_data['volunteer_reg'][key] = value
    
    @staticmethod
    def get_volunteer_data(context: ContextTypes.DEFAULT_TYPE, key: str, default=None):
        """Get temporary volunteer registration data."""
        return context.user_data.get('volunteer_reg', {}).get(key, default)
    
    @staticmethod
    def clear_volunteer_data(context: ContextTypes.DEFAULT_TYPE):
        """Clear temporary volunteer registration data."""
        context.user_data.pop('volunteer_reg', None)
    
    # ==================== CAREGIVER SESSION HELPERS ====================
    
    @staticmethod
    def get_selected_participant_id(context: ContextTypes.DEFAULT_TYPE) -> Optional[str]:
        """Get currently selected participant ID (for caregiver actions)."""
        return context.user_data.get('selected_participant_id')
    
    @staticmethod
    def set_selected_participant_id(context: ContextTypes.DEFAULT_TYPE, participant_id: str):
        """Set currently selected participant ID."""
        context.user_data['selected_participant_id'] = participant_id
    
    @staticmethod
    def clear_selected_participant(context: ContextTypes.DEFAULT_TYPE):
        """Clear selected participant."""
        context.user_data.pop('selected_participant_id', None)
    
    # ==================== RATING FLOW HELPERS ====================
    
    @staticmethod
    def set_rating_booking_id(context: ContextTypes.DEFAULT_TYPE, booking_id: str):
        """Set booking ID for rating flow."""
        context.user_data['rating_booking_id'] = booking_id
    
    @staticmethod
    def get_rating_booking_id(context: ContextTypes.DEFAULT_TYPE) -> Optional[str]:
        """Get booking ID for rating flow."""
        return context.user_data.get('rating_booking_id')
    
    @staticmethod
    def set_rating_value(context: ContextTypes.DEFAULT_TYPE, rating: int):
        """Set rating value in flow."""
        context.user_data['rating_value'] = rating
    
    @staticmethod
    def get_rating_value(context: ContextTypes.DEFAULT_TYPE) -> Optional[int]:
        """Get rating value from flow."""
        return context.user_data.get('rating_value')
    
    @staticmethod
    def clear_rating_data(context: ContextTypes.DEFAULT_TYPE):
        """Clear rating flow data."""
        context.user_data.pop('rating_booking_id', None)
        context.user_data.pop('rating_value', None)
    
    # ==================== CHECKOUT FLOW HELPERS ====================
    
    @staticmethod
    def set_checkout_assignment_id(context: ContextTypes.DEFAULT_TYPE, assignment_id: str):
        """Set assignment ID for checkout flow."""
        context.user_data['checkout_assignment_id'] = assignment_id
    
    @staticmethod
    def get_checkout_assignment_id(context: ContextTypes.DEFAULT_TYPE) -> Optional[str]:
        """Get assignment ID for checkout flow."""
        return context.user_data.get('checkout_assignment_id')
    
    @staticmethod
    def clear_checkout_data(context: ContextTypes.DEFAULT_TYPE):
        """Clear checkout flow data."""
        context.user_data.pop('checkout_assignment_id', None)