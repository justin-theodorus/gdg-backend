"""
Notification message templates for CareConnect Hub Telegram Bot.
"""
from datetime import datetime
from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def format_datetime(dt_str: str) -> str:
    """Format datetime string for display."""
    try:
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        return dt.strftime('%A, %d %B at %H:%M')
    except:
        return dt_str[:16] if dt_str else 'TBA'


def format_date_short(dt_str: str) -> str:
    """Format datetime string for short display."""
    try:
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        return dt.strftime('%a, %d %b')
    except:
        return dt_str[:10] if dt_str else 'TBA'


def format_expiry(expires_at: str) -> str:
    """Format expiry time for display."""
    try:
        dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        return dt.strftime('%H:%M')
    except:
        return expires_at


# ==================== PARTICIPANT NOTIFICATIONS ====================

def booking_confirmation(activity: dict, booking: dict) -> tuple[str, InlineKeyboardMarkup]:
    """Generate booking confirmation message."""
    text = (
        f"✅ <b>Booking Confirmed!</b>\n\n"
        f"📌 {activity.get('title', 'Activity')}\n"
        f"📅 {format_datetime(activity.get('start_datetime', ''))}\n"
        f"📍 {activity.get('location', 'TBA')}\n\n"
        f"Booking ID: {booking.get('id', '')[:8]}...\n\n"
        f"See you there! 🎉"
    )
    
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("📋 My Bookings", callback_data="show_my_bookings")]
    ])
    
    return text, keyboard


def booking_cancellation(activity: dict, reason: str = '') -> tuple[str, InlineKeyboardMarkup]:
    """Generate booking cancellation message."""
    text = (
        f"❌ <b>Booking Cancelled</b>\n\n"
        f"📌 {activity.get('title', 'Activity')}\n"
        f"📅 {format_datetime(activity.get('start_datetime', ''))}\n"
    )
    
    if reason:
        text += f"\nReason: {reason}\n"
    
    text += "\nWe hope to see you at another event!"
    
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("📅 Browse Events", callback_data="browse_events")]
    ])
    
    return text, keyboard


def activity_reminder(activity: dict) -> tuple[str, InlineKeyboardMarkup]:
    """Generate 24-hour reminder message."""
    requirements = activity.get('requirements', '')
    
    text = (
        f"🔔 <b>Reminder Tomorrow!</b>\n\n"
        f"📌 {activity.get('title', 'Activity')}\n"
        f"📅 {format_datetime(activity.get('start_datetime', ''))}\n"
        f"📍 {activity.get('location', 'TBA')}\n"
    )
    
    if activity.get('room'):
        text += f"🚪 Room: {activity['room']}\n"
    
    if requirements:
        text += f"\n<b>What to bring:</b>\n{requirements}\n"
    
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("ℹ️ View Details", callback_data=f"activity_{activity.get('id', '')}"),
            InlineKeyboardButton("🗑️ Cancel", callback_data=f"cancel_booking_activity_{activity.get('id', '')}")
        ]
    ])
    
    return text, keyboard


def activity_cancelled(activity: dict, reason: str = '', alternatives: list = None) -> tuple[str, InlineKeyboardMarkup]:
    """Generate activity cancelled notification."""
    text = (
        f"⚠️ <b>Activity Cancelled</b>\n\n"
        f"📌 {activity.get('title', 'Activity')}\n"
        f"📅 {format_datetime(activity.get('start_datetime', ''))}\n"
    )
    
    if reason:
        text += f"\n<b>Reason:</b> {reason}\n"
    
    if alternatives:
        text += "\n💡 <b>Suggested Alternatives:</b>\n"
        for alt in alternatives[:3]:
            text += f"• {alt.get('title', '')} - {format_date_short(alt.get('start_datetime', ''))}\n"
    
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("📅 Browse Events", callback_data="browse_events")]
    ])
    
    return text, keyboard


def waitlist_offer(activity: dict, expires_at: str) -> tuple[str, InlineKeyboardMarkup]:
    """Generate waitlist spot available notification."""
    text = (
        f"🎉 <b>Spot Available!</b>\n\n"
        f"You're off the waitlist for:\n"
        f"📌 {activity.get('title', 'Activity')}\n"
        f"📅 {format_datetime(activity.get('start_datetime', ''))}\n\n"
        f"⏰ Accept within 2 hours:\n"
        f"Expires at: {format_expiry(expires_at)}"
    )
    
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Accept Spot", callback_data=f"accept_waitlist_{activity.get('waitlist_id', '')}"),
            InlineKeyboardButton("❌ Decline", callback_data=f"decline_waitlist_{activity.get('waitlist_id', '')}")
        ]
    ])
    
    return text, keyboard


# ==================== VOLUNTEER NOTIFICATIONS ====================

def volunteer_invitation(activity: dict, assignment: dict) -> tuple[str, InlineKeyboardMarkup]:
    """Generate volunteer assignment invitation."""
    role = assignment.get('role', 'assistant').title()
    responsibilities = assignment.get('responsibilities', '')
    
    text = (
        f"🙋 <b>New Volunteer Opportunity!</b>\n\n"
        f"📌 {activity.get('title', 'Activity')}\n"
        f"📅 {format_datetime(activity.get('start_datetime', ''))}\n"
        f"🎯 Role: {role}\n"
    )
    
    if responsibilities:
        text += f"\n<b>Responsibilities:</b>\n{responsibilities}\n"
    
    # Calculate expected hours
    try:
        start = datetime.fromisoformat(activity.get('start_datetime', '').replace('Z', '+00:00'))
        end = datetime.fromisoformat(activity.get('end_datetime', '').replace('Z', '+00:00'))
        hours = (end - start).total_seconds() / 3600
        text += f"\n⏱️ Expected time: {hours:.1f} hours\n"
    except:
        pass
    
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Accept", callback_data=f"accept_assign_{assignment.get('id', '')}"),
            InlineKeyboardButton("❌ Decline", callback_data=f"decline_assign_{assignment.get('id', '')}")
        ],
        [InlineKeyboardButton("ℹ️ Details", callback_data=f"assignment_details_{assignment.get('id', '')}")]
    ])
    
    return text, keyboard


def volunteer_reminder(activity: dict, assignment: dict) -> tuple[str, InlineKeyboardMarkup]:
    """Generate volunteer assignment reminder (24h before)."""
    role = assignment.get('role', 'assistant').title()
    responsibilities = assignment.get('responsibilities', '')
    
    text = (
        f"🔔 <b>Assignment Tomorrow!</b>\n\n"
        f"📌 {activity.get('title', 'Activity')} - {role}\n"
        f"📅 {format_datetime(activity.get('start_datetime', ''))}\n"
        f"📍 {activity.get('location', 'TBA')}\n"
    )
    
    if activity.get('room'):
        text += f"🚪 Room: {activity['room']}\n"
    
    if responsibilities:
        text += f"\n<b>Responsibilities:</b>\n{responsibilities}\n"
    
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📍 Directions", callback_data=f"directions_{activity.get('id', '')}"),
            InlineKeyboardButton("❌ Cancel", callback_data=f"cancel_assignment_{assignment.get('id', '')}")
        ]
    ])
    
    return text, keyboard


def check_in_reminder(activity: dict, assignment: dict) -> tuple[str, InlineKeyboardMarkup]:
    """Generate check-in reminder (30 min before)."""
    text = (
        f"🔔 <b>Reminder: {activity.get('title', 'Activity')} in 30 min!</b>\n\n"
        f"📍 {activity.get('location', 'TBA')}"
    )
    
    if activity.get('room'):
        text += f", {activity['room']}"
    
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("📍 Check In Now", callback_data=f"checkin_{assignment.get('id', '')}")]
    ])
    
    return text, keyboard


def staff_rating_received(activity: dict, rating: int, feedback: str = '') -> tuple[str, InlineKeyboardMarkup]:
    """Generate notification when staff rates volunteer."""
    stars = '⭐' * rating
    
    text = (
        f"🌟 <b>New Rating Received!</b>\n\n"
        f"Activity: {activity.get('title', 'Activity')}\n"
        f"Date: {format_date_short(activity.get('start_datetime', ''))}\n"
        f"Rating: {stars} ({rating}/5)\n"
    )
    
    if feedback:
        text += f"\n<b>Staff Feedback:</b>\n\"{feedback}\"\n"
    
    text += "\n💪 Keep up the great work!"
    
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("📊 View My Stats", callback_data="my_stats")]
    ])
    
    return text, keyboard


# ==================== CAREGIVER NOTIFICATIONS ====================

def caregiver_booking_confirmation(participant_name: str, activity: dict) -> tuple[str, InlineKeyboardMarkup]:
    """Generate booking confirmation for caregiver."""
    text = (
        f"✅ <b>Booking Confirmed for {participant_name}</b>\n\n"
        f"📌 {activity.get('title', 'Activity')}\n"
        f"📅 {format_datetime(activity.get('start_datetime', ''))}\n"
        f"📍 {activity.get('location', 'TBA')}"
    )
    
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("📋 View All Bookings", callback_data="show_all_bookings")]
    ])
    
    return text, keyboard


def caregiver_participant_reminder(participant_name: str, activity: dict) -> tuple[str, InlineKeyboardMarkup]:
    """Generate reminder for caregiver about participant's activity."""
    text = (
        f"🔔 <b>Reminder for {participant_name}</b>\n\n"
        f"Tomorrow:\n"
        f"📌 {activity.get('title', 'Activity')}\n"
        f"📅 {format_datetime(activity.get('start_datetime', ''))}\n"
        f"📍 {activity.get('location', 'TBA')}"
    )
    
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("📋 View Schedule", callback_data=f"view_schedule_{activity.get('participant_id', '')}")]
    ])
    
    return text, keyboard
