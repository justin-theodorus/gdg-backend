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
                
                # Log full error for debugging
                logger.error(f'Booking API error: status={response.status_code}, data={data}')
                
                return {
                    'success': False,
                    'error_code': error_code,
                    'error': error_msg,
                    'details': details,
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
                response = await client.put(
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
    
    # ==================== BOOKING FEEDBACK ENDPOINTS ====================
    
    async def submit_booking_feedback(
        self,
        token: str,
        booking_id: str,
        rating: int,
        feedback_text: str = ''
    ) -> dict:
        """Submit feedback/rating for a completed booking."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f'{self.base_url}/bookings/{booking_id}/feedback',
                    json={
                        'rating': rating,
                        'feedback_text': feedback_text,
                    },
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code == 200 and data.get('success'):
                    return {'success': True, **data.get('data', {})}
                
                error_msg = data.get('error', {}).get('message', 'Failed to submit feedback')
                return {'success': False, 'error': error_msg}
            except Exception as e:
                logger.error(f'Submit feedback error: {e}')
                return {'success': False, 'error': str(e)}
    
    # ==================== WAITLIST ENDPOINTS ====================
    
    async def get_participant_waitlist(self, token: str, participant_id: str) -> list:
        """Get participant's waitlist entries."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(
                    f'{self.base_url}/waitlist/participant/{participant_id}',
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code == 200 and data.get('success'):
                    return data.get('data', {}).get('entries', [])
                
                return []
            except Exception as e:
                logger.error(f'Get waitlist error: {e}')
                return []
    
    async def accept_waitlist_offer(self, token: str, waitlist_id: str) -> dict:
        """Accept a waitlist offer."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f'{self.base_url}/waitlist/{waitlist_id}/accept',
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code == 200 and data.get('success'):
                    return {'success': True, **data.get('data', {})}
                
                error_msg = data.get('error', {}).get('message', 'Failed to accept offer')
                return {'success': False, 'error': error_msg}
            except Exception as e:
                logger.error(f'Accept waitlist error: {e}')
                return {'success': False, 'error': str(e)}
    
    async def decline_waitlist_offer(self, token: str, waitlist_id: str) -> dict:
        """Decline a waitlist offer."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f'{self.base_url}/waitlist/{waitlist_id}/decline',
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code == 200 and data.get('success'):
                    return {'success': True}
                
                return {'success': False}
            except Exception as e:
                logger.error(f'Decline waitlist error: {e}')
                return {'success': False, 'error': str(e)}
    
    # ==================== VOLUNTEER ENDPOINTS ====================
    
    async def create_volunteer_profile(
        self,
        token: str,
        user_id: str,
        interests: list = None,
        skills: list = None,
        availability: dict = None
    ) -> dict:
        """Create a volunteer profile."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f'{self.base_url}/volunteers',
                    json={
                        'user_id': user_id,
                        'interests': interests or [],
                        'skills': skills or [],
                        'availability': availability or {},
                    },
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code in [200, 201] and data.get('success'):
                    return {'success': True, 'volunteer': data.get('data')}
                
                error_msg = data.get('error', {}).get('message', 'Failed to create volunteer profile')
                return {'success': False, 'error': error_msg}
            except Exception as e:
                logger.error(f'Create volunteer profile error: {e}')
                return {'success': False, 'error': str(e)}
    
    async def get_volunteer_assignments(
        self,
        token: str,
        volunteer_id: str,
        status: str = None
    ) -> dict:
        """Get volunteer's assignments, optionally filtered by status."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                params = {}
                if status:
                    params['status'] = status
                
                response = await client.get(
                    f'{self.base_url}/volunteers/{volunteer_id}/assignments',
                    params=params,
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code == 200 and data.get('success'):
                    return data.get('data', {})
                
                return {'assignments': [], 'grouped': {}}
            except Exception as e:
                logger.error(f'Get assignments error: {e}')
                return {'assignments': [], 'grouped': {}}
    
    async def respond_to_assignment(
        self,
        token: str,
        assignment_id: str,
        response: str  # 'accepted' or 'declined'
    ) -> dict:
        """Accept or decline a volunteer assignment."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                resp = await client.put(
                    f'{self.base_url}/volunteer-assignments/{assignment_id}/respond',
                    json={'response': response},
                    headers=self._get_headers(token)
                )
                data = resp.json()
                
                if resp.status_code == 200 and data.get('success'):
                    return {'success': True, **data.get('data', {})}
                
                error_msg = data.get('error', {}).get('message', 'Failed to respond')
                return {'success': False, 'error': error_msg}
            except Exception as e:
                logger.error(f'Respond to assignment error: {e}')
                return {'success': False, 'error': str(e)}
    
    async def check_in_assignment(self, token: str, assignment_id: str) -> dict:
        """Check in for a volunteer assignment."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f'{self.base_url}/volunteer-assignments/{assignment_id}/check-in',
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code == 200 and data.get('success'):
                    return {'success': True, **data.get('data', {})}
                
                error_msg = data.get('error', {}).get('message', 'Failed to check in')
                return {'success': False, 'error': error_msg}
            except Exception as e:
                logger.error(f'Check in error: {e}')
                return {'success': False, 'error': str(e)}
    
    async def check_out_assignment(
        self,
        token: str,
        assignment_id: str,
        feedback: str = '',
    ) -> dict:
        """Check out from a volunteer assignment."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f'{self.base_url}/volunteer-assignments/{assignment_id}/check-out',
                    json={'volunteer_feedback': feedback},
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code == 200 and data.get('success'):
                    return {'success': True, **data.get('data', {})}
                
                error_msg = data.get('error', {}).get('message', 'Failed to check out')
                return {'success': False, 'error': error_msg}
            except Exception as e:
                logger.error(f'Check out error: {e}')
                return {'success': False, 'error': str(e)}
    
    async def get_volunteer_stats(self, token: str, volunteer_id: str) -> dict:
        """Get volunteer's statistics and achievements."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(
                    f'{self.base_url}/volunteers/{volunteer_id}/stats',
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code == 200 and data.get('success'):
                    return data.get('data', {})
                
                return {}
            except Exception as e:
                logger.error(f'Get volunteer stats error: {e}')
                return {}
    
    async def get_leaderboard(self, token: str, limit: int = 10, sort_by: str = 'total_hours') -> list:
        """Get volunteer leaderboard."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(
                    f'{self.base_url}/volunteers/leaderboard',
                    params={'limit': limit, 'sort_by': sort_by},
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code == 200 and data.get('success'):
                    return data.get('data', {}).get('leaderboard', [])
                
                return []
            except Exception as e:
                logger.error(f'Get leaderboard error: {e}')
                return []
    
    async def get_activities_needing_volunteers(self, token: str, limit: int = 10) -> list:
        """Get activities that need volunteers."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(
                    f'{self.base_url}/activities',
                    params={'limit': limit},
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code == 200 and data.get('success'):
                    activities = data.get('data', {}).get('activities', [])
                    # Filter to those needing volunteers
                    return [
                        a for a in activities 
                        if (a.get('current_volunteers', 0) < a.get('max_volunteers', 0))
                    ]
                
                return []
            except Exception as e:
                logger.error(f'Get activities needing volunteers error: {e}')
                return []
    
    # ==================== CAREGIVER ENDPOINTS ====================
    
    async def get_caregiver_participants(self, token: str, caregiver_id: str) -> list:
        """Get participants linked to a caregiver."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(
                    f'{self.base_url}/caregivers/{caregiver_id}/participants',
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code == 200 and data.get('success'):
                    return data.get('data', {}).get('participants', [])
                
                return []
            except Exception as e:
                logger.error(f'Get caregiver participants error: {e}')
                return []
    
    async def link_participant_to_caregiver(
        self,
        token: str,
        caregiver_id: str,
        participant_id: str = None,
        participant_email: str = None,
        is_primary: bool = False
    ) -> dict:
        """Link a participant to a caregiver."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                body = {
                    'caregiver_id': caregiver_id,
                    'is_primary': is_primary,
                }
                if participant_id:
                    body['participant_id'] = participant_id
                if participant_email:
                    body['participant_email'] = participant_email
                
                response = await client.post(
                    f'{self.base_url}/participant-caregivers/link',
                    json=body,
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code in [200, 201] and data.get('success'):
                    return {'success': True, **data.get('data', {})}
                
                error_msg = data.get('error', {}).get('message', 'Failed to link participant')
                return {'success': False, 'error': error_msg}
            except Exception as e:
                logger.error(f'Link participant error: {e}')
                return {'success': False, 'error': str(e)}
    
    async def get_participant_bookings(self, token: str, participant_id: str) -> list:
        """Get bookings for a specific participant (for caregivers)."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(
                    f'{self.base_url}/participants/{participant_id}',
                    headers=self._get_headers(token)
                )
                data = response.json()
                
                if response.status_code == 200 and data.get('success'):
                    return data.get('data', {}).get('upcoming_bookings', [])
                
                return []
            except Exception as e:
                logger.error(f'Get participant bookings error: {e}')
                return []
    
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
