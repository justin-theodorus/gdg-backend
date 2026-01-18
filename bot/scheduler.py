"""
Scheduled tasks for CareConnect Hub Telegram Bot.
Handles automated reminders and notifications.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from handlers.notification_templates import (
    activity_reminder, volunteer_reminder, check_in_reminder
)

logger = logging.getLogger(__name__)


class NotificationScheduler:
    """Manages scheduled notifications for the bot."""
    
    def __init__(self, api_client, bot, supabase_url: str, supabase_key: str):
        self.api = api_client
        self.bot = bot
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.scheduler = AsyncIOScheduler()
        self._setup_jobs()
    
    def _setup_jobs(self):
        """Set up scheduled jobs."""
        # Daily activity reminders at 9 AM
        self.scheduler.add_job(
            self.send_activity_reminders,
            CronTrigger(hour=9, minute=0),
            id='activity_reminders',
            replace_existing=True
        )
        
        # Daily volunteer reminders at 9 AM
        self.scheduler.add_job(
            self.send_volunteer_reminders,
            CronTrigger(hour=9, minute=0),
            id='volunteer_reminders',
            replace_existing=True
        )
        
        # Check-in reminders every 30 minutes
        self.scheduler.add_job(
            self.send_check_in_reminders,
            CronTrigger(minute='0,30'),
            id='checkin_reminders',
            replace_existing=True
        )
        
        # Process expired waitlist offers every hour
        self.scheduler.add_job(
            self.process_expired_waitlist,
            CronTrigger(minute=0),
            id='waitlist_expiry',
            replace_existing=True
        )
        
        logger.info("Notification scheduler jobs configured")
    
    def start(self):
        """Start the scheduler."""
        self.scheduler.start()
        logger.info("Notification scheduler started")
    
    def stop(self):
        """Stop the scheduler."""
        self.scheduler.shutdown()
        logger.info("Notification scheduler stopped")
    
    async def _get_supabase_data(self, table: str, query_params: dict) -> list:
        """Helper to query Supabase directly."""
        import httpx
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f'{self.supabase_url}/rest/v1/{table}',
                    params=query_params,
                    headers={
                        'apikey': self.supabase_key,
                        'Authorization': f'Bearer {self.supabase_key}',
                    }
                )
                if response.status_code == 200:
                    return response.json()
                return []
        except Exception as e:
            logger.error(f"Supabase query error: {e}")
            return []
    
    async def send_activity_reminders(self):
        """Send reminders for activities happening tomorrow."""
        logger.info("Running activity reminders job")
        
        tomorrow_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        tomorrow_end = tomorrow_start + timedelta(days=1)
        
        # Get activities happening tomorrow
        activities = await self._get_supabase_data('activities', {
            'select': 'id,title,description,start_datetime,end_datetime,location,room,requirements',
            'start_datetime': f'gte.{tomorrow_start.isoformat()}',
            'start_datetime': f'lt.{tomorrow_end.isoformat()}',
            'is_cancelled': 'eq.false',
        })
        
        for activity in activities:
            # Get confirmed bookings for this activity
            bookings = await self._get_supabase_data('bookings', {
                'select': 'id,participant:participants(user:users(telegram_id))',
                'activity_id': f"eq.{activity['id']}",
                'status': 'eq.confirmed',
            })
            
            for booking in bookings:
                try:
                    telegram_id = booking.get('participant', {}).get('user', {}).get('telegram_id')
                    if telegram_id:
                        text, keyboard = activity_reminder(activity)
                        await self.bot.send_message(
                            chat_id=telegram_id,
                            text=text,
                            reply_markup=keyboard,
                            parse_mode='HTML'
                        )
                        logger.info(f"Sent activity reminder to {telegram_id}")
                except Exception as e:
                    logger.error(f"Failed to send activity reminder: {e}")
    
    async def send_volunteer_reminders(self):
        """Send reminders for volunteer assignments tomorrow."""
        logger.info("Running volunteer reminders job")
        
        tomorrow_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        tomorrow_end = tomorrow_start + timedelta(days=1)
        
        # Get confirmed assignments for activities tomorrow
        assignments = await self._get_supabase_data('volunteer_assignments', {
            'select': 'id,role,responsibilities,volunteer:volunteers(user:users(telegram_id)),activity:activities(id,title,start_datetime,location,room)',
            'status': 'eq.confirmed',
        })
        
        for assignment in assignments:
            try:
                activity = assignment.get('activity', {})
                start_dt = datetime.fromisoformat(activity.get('start_datetime', '').replace('Z', '+00:00'))
                
                if tomorrow_start <= start_dt.replace(tzinfo=None) < tomorrow_end:
                    telegram_id = assignment.get('volunteer', {}).get('user', {}).get('telegram_id')
                    if telegram_id:
                        text, keyboard = volunteer_reminder(activity, assignment)
                        await self.bot.send_message(
                            chat_id=telegram_id,
                            text=text,
                            reply_markup=keyboard,
                            parse_mode='HTML'
                        )
                        logger.info(f"Sent volunteer reminder to {telegram_id}")
            except Exception as e:
                logger.error(f"Failed to send volunteer reminder: {e}")
    
    async def send_check_in_reminders(self):
        """Send check-in reminders 30 minutes before activities."""
        logger.info("Running check-in reminders job")
        
        now = datetime.now()
        thirty_min_later = now + timedelta(minutes=30)
        forty_min_later = now + timedelta(minutes=40)
        
        # Get confirmed assignments for activities starting in ~30 minutes
        assignments = await self._get_supabase_data('volunteer_assignments', {
            'select': 'id,role,check_in_time,volunteer:volunteers(user:users(telegram_id)),activity:activities(id,title,start_datetime,location,room)',
            'status': 'eq.confirmed',
            'check_in_time': 'is.null',  # Not checked in yet
        })
        
        for assignment in assignments:
            try:
                activity = assignment.get('activity', {})
                start_dt = datetime.fromisoformat(activity.get('start_datetime', '').replace('Z', '+00:00'))
                start_dt = start_dt.replace(tzinfo=None)
                
                # Check if activity starts in approximately 30 minutes
                if thirty_min_later <= start_dt < forty_min_later:
                    telegram_id = assignment.get('volunteer', {}).get('user', {}).get('telegram_id')
                    if telegram_id:
                        text, keyboard = check_in_reminder(activity, assignment)
                        await self.bot.send_message(
                            chat_id=telegram_id,
                            text=text,
                            reply_markup=keyboard,
                            parse_mode='HTML'
                        )
                        logger.info(f"Sent check-in reminder to {telegram_id}")
            except Exception as e:
                logger.error(f"Failed to send check-in reminder: {e}")
    
    async def process_expired_waitlist(self):
        """Process expired waitlist offers."""
        logger.info("Processing expired waitlist offers")
        
        now = datetime.now().isoformat()
        
        # Get expired waitlist entries that are in 'notified' status
        expired = await self._get_supabase_data('waitlist_entries', {
            'select': 'id,activity_id,participant_id',
            'status': 'eq.notified',
            'expires_at': f'lt.{now}',
        })
        
        for entry in expired:
            try:
                # Mark as expired
                import httpx
                async with httpx.AsyncClient() as client:
                    await client.patch(
                        f"{self.supabase_url}/rest/v1/waitlist_entries",
                        params={'id': f"eq.{entry['id']}"},
                        json={'status': 'expired'},
                        headers={
                            'apikey': self.supabase_key,
                            'Authorization': f'Bearer {self.supabase_key}',
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal',
                        }
                    )
                
                logger.info(f"Marked waitlist entry {entry['id']} as expired")
                
                # TODO: Notify next person in waitlist
                # This would require calling the processWaitlist function
                
            except Exception as e:
                logger.error(f"Failed to process expired waitlist: {e}")


async def send_notification(bot, telegram_id: str, text: str, keyboard=None):
    """Helper to send a notification message."""
    try:
        await bot.send_message(
            chat_id=telegram_id,
            text=text,
            reply_markup=keyboard,
            parse_mode='HTML'
        )
        return True
    except Exception as e:
        logger.error(f"Failed to send notification to {telegram_id}: {e}")
        return False
