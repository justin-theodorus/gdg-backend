"""
API Client for CareConnect Hub Backend.
Provides async methods for interacting with the backend API.
"""
import httpx
import base64
import logging
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class CareConnectAPI:
    """Async client for CareConnect Hub API."""
    
    def __init__(self, base_url: str, supabase_url: str = '', supabase_key: str = ''):
        self.base_url = base_url.rstrip('/')
        self.supabase_url = supabase_url.rstrip('/')
        self.supabase_key = supabase_key
        self.timeout = 30.0
    
    def _get_headers(self, token: Optional[str] = None) -> dict:
        """Get headers for API requests."""
        headers = {
            'Content-Type': 'application/json',
        }
        if token:
            headers['Authorization'] = f'Bearer {token}'
        return headers
    
    # ==================== AUTH ENDPOINTS ====================
    
    async def login_with_telegram(self, telegram_id: str) -> dict:
        """
        Login using Telegram ID.
        Returns user data and token if found, or {found: False} if not registered.
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f'{self.base_url}/auth/telegram',
                    json={'action': 'login', 'telegram_id': str(telegram_id)},
                    headers=self._get_headers()
                )
                data = response.json()
                
                if response.status_code == 200 and data.get('success'):
                    return data.get('data', {})
                
                return {'found': False, 'user': None, 'token': None}
            except Exception as e:
                logger.error(f'Telegram login error: {e}')
                return {'found': False, 'user': None, 'token': None, 'error': str(e)}
    
    async def register_with_telegram(
        self,
        telegram_id: str,
        email: str,
        password: str,
        first_name: str,
        last_name: str = '',
        role: str = 'participant'
    ) -> dict:
        """
        Register a new user with Telegram ID.
        Returns user data and token on success.
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f'{self.base_url}/auth/telegram',
                    json={
                        'action': 'register',
                        'telegram_id': str(telegram_id),
                        'email': email,
                        'password': password,
                        'first_name': first_name,
                        'last_name': last_name,
                        'role': role,
                    },
                    headers=self._get_headers()
                )
                data = response.json()
                
                if response.status_code in [200, 201] and data.get('success'):
                    return {'success': True, **data.get('data', {})}
                
                error_msg = data.get('error', {}).get('message', 'Registration failed')
                return {'success': False, 'error': error_msg}
            except Exception as e:
                logger.error(f'Registration error: {e}')
                return {'success': False, 'error': str(e)}
    
    async def link_telegram(self, user_id: str, telegram_id: str) -> dict:
        """Link Telegram ID to existing user."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f'{self.base_url}/auth/telegram',
                    json={
                        'action': 'link',
                        'user_id': user_id,
                        'telegram_id': str(telegram_id),
                    },
                    headers=self._get_headers()
                )
                data = response.json()
                return {'success': data.get('success', False), **data.get('data', {})}
            except Exception as e:
                logger.error(f'Link telegram error: {e}')
                return {'success': False, 'error': str(e)}
    
    # ==================== ACTIVITIES ENDPOINTS ====================
    
    async def get_activities(
        self,
        token: str,
        limit: int = 10,
        has_availability: bool = True
    ) -> list:
        """Get upcoming activities."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                params = {
                    'limit': limit,
                    'has_availability': str(has_availability).lower(),
                }
                response = await client.get(
                    f'{self.base_url}/activities',
                    params=params,
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code == 200 and data.get('success'):
                    return data.get('data', {}).get('activities', [])
                
                return []
            except Exception as e:
                logger.error(f'Get activities error: {e}')
                return []
    
    async def get_activity(self, token: str, activity_id: str) -> Optional[dict]:
        """Get activity by ID."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(
                    f'{self.base_url}/activities/{activity_id}',
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code == 200 and data.get('success'):
                    return data.get('data')
                
                return None
            except Exception as e:
                logger.error(f'Get activity error: {e}')
                return None
    
    async def create_activity(self, token: str, activity_data: dict) -> dict:
        """Create a new activity (staff only)."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f'{self.base_url}/activities',
                    json=activity_data,
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code in [200, 201] and data.get('success'):
                    return {'success': True, 'activity': data.get('data')}
                
                error_msg = data.get('error', {}).get('message', 'Failed to create activity')
                return {'success': False, 'error': error_msg}
            except Exception as e:
                logger.error(f'Create activity error: {e}')
                return {'success': False, 'error': str(e)}
    
    # ==================== BOOKINGS ENDPOINTS ====================
    
    async def create_booking(
        self,
        token: str,
        activity_id: str,
        participant_id: str
    ) -> dict:
        """
        Create a booking for an activity.
        Handles conflict detection and waitlist automatically.
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f'{self.base_url}/bookings',
                    json={
                        'activity_id': activity_id,
                        'participant_id': participant_id,
                    },
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code in [200, 201] and data.get('success'):
                    result = data.get('data', {})
                    return {
                        'success': True,
                        'status': result.get('status', 'confirmed'),
                        'message': result.get('message', 'Booking confirmed'),
                        'booking': result.get('booking'),
                        'waitlist_position': result.get('waitlist_position'),
                    }
                
                # Handle specific error cases
                error = data.get('error', {})
                error_code = error.get('code', '')
                error_msg = error.get('message', 'Booking failed')
                details = error.get('details', {})
                
                return {
                    'success': False,
                    'error_code': error_code,
                    'error': error_msg,
                    'conflicting_activity': details.get('conflicting_activity'),
                    'alternatives': details.get('alternatives', []),
                }
            except Exception as e:
                logger.error(f'Create booking error: {e}')
                return {'success': False, 'error': str(e)}
    
    async def get_my_bookings(self, token: str, limit: int = 10) -> list:
        """Get current user's bookings."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(
                    f'{self.base_url}/bookings',
                    params={'limit': limit},
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code == 200 and data.get('success'):
                    return data.get('data', {}).get('bookings', [])
                
                return []
            except Exception as e:
                logger.error(f'Get bookings error: {e}')
                return []
    
    async def cancel_booking(self, token: str, booking_id: str) -> dict:
        """Cancel a booking."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f'{self.base_url}/bookings/{booking_id}/cancel',
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code == 200 and data.get('success'):
                    return {'success': True}
                
                error_msg = data.get('error', {}).get('message', 'Cancellation failed')
                return {'success': False, 'error': error_msg}
            except Exception as e:
                logger.error(f'Cancel booking error: {e}')
                return {'success': False, 'error': str(e)}
    
    # ==================== PARTICIPANTS ENDPOINTS ====================
    
    async def get_all_participants(self, token: str) -> list:
        """Get all participants (staff only, for broadcasting)."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(
                    f'{self.base_url}/participants',
                    params={'limit': 1000},
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code == 200 and data.get('success'):
                    return data.get('data', {}).get('participants', [])
                
                return []
            except Exception as e:
                logger.error(f'Get participants error: {e}')
                return []
    
    # ==================== EDGE FUNCTIONS ====================
    
    async def extract_poster(self, image_base64: str) -> dict:
        """
        Call the Supabase Edge Function to extract event details from poster.
        """
        if not self.supabase_url or not self.supabase_key:
            return {'success': False, 'error': 'Supabase not configured'}
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f'{self.supabase_url}/functions/v1/extract-poster',
                    json={'image_base64': image_base64},
                    headers={
                        'Authorization': f'Bearer {self.supabase_key}',
                        'Content-Type': 'application/json',
                    }
                )
                data = response.json()
                
                if response.status_code == 200:
                    return {'success': True, **data}
                
                return {'success': False, 'error': data.get('error', 'Extraction failed')}
            except Exception as e:
                logger.error(f'Extract poster error: {e}')
                return {'success': False, 'error': str(e)}
    
    # ==================== ANALYTICS ENDPOINTS ====================
    
    async def get_dashboard_stats(self, token: str) -> dict:
        """Get dashboard statistics (staff only)."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(
                    f'{self.base_url}/analytics/dashboard',
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code == 200 and data.get('success'):
                    return data.get('data', {})
                
                return {}
            except Exception as e:
                logger.error(f'Get dashboard stats error: {e}')
                return {}
    
    # ==================== USERS ENDPOINTS ====================
    
    async def get_all_users_with_telegram(self, token: str) -> list:
        """
        Get all users that have telegram_id set (for broadcasting).
        This requires direct Supabase access since we need telegram_id.
        """
        if not self.supabase_url or not self.supabase_key:
            return []
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(
                    f'{self.supabase_url}/rest/v1/users',
                    params={
                        'select': 'id,first_name,email,telegram_id,role',
                        'telegram_id': 'not.is.null',
                    },
                    headers={
                        'apikey': self.supabase_key,
                        'Authorization': f'Bearer {self.supabase_key}',
                    }
                )
                
                if response.status_code == 200:
                    return response.json()
                
                return []
            except Exception as e:
                logger.error(f'Get users with telegram error: {e}')
                return []
