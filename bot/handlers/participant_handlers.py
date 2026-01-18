"""
Participant-specific handlers for CareConnect Hub Telegram Bot.
Handles: My Bookings, Waitlist Status, Rating Flow
"""
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, ConversationHandler

from session import UserSession
from config import RATING_SELECT_STARS, RATING_INPUT_FEEDBACK


def format_datetime(dt_str: str) -> str:
    """Format datetime string for display."""
    try:
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        return dt.strftime('%a, %d %b at %H:%M')
    except:
        return dt_str[:16] if dt_str else 'TBA'


def format_datetime_short(dt_str: str) -> str:
    """Format datetime string for compact display."""
    try:
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        return dt.strftime('%a, %H:%M')
    except:
        return dt_str[:10] if dt_str else 'TBA'


async def show_my_bookings(update: Update, context: ContextTypes.DEFAULT_TYPE, api):
    """Display participant's bookings (upcoming and past)."""
    chat_id = update.effective_chat.id
    
    if not UserSession.is_authenticated(context):
        await context.bot.send_message(chat_id=chat_id, text="⚠️ Please /start to login first.")
        return
    
    token = UserSession.get_token(context)
    bookings = await api.get_my_bookings(token, limit=20)
    
    if not bookings:
        await context.bot.send_message(
            chat_id=chat_id,
            text="📋 <b>MY BOOKINGS</b>\n\nYou don't have any bookings yet.\n\nUse <b>📅 Browse Events</b> to find activities!",
            parse_mode='HTML'
        )
        return
    
    now = datetime.now()
    upcoming = []
    past = []
    
    for booking in bookings:
        activity = booking.get('activity', {})
        start_dt_str = activity.get('start_datetime', '')
        try:
            start_dt = datetime.fromisoformat(start_dt_str.replace('Z', '+00:00'))
            if start_dt.replace(tzinfo=None) > now:
                upcoming.append(booking)
            else:
                past.append(booking)
        except:
            upcoming.append(booking)
    
    # Build message
    text = "╔═══════════════════════╗\n║   📋 MY BOOKINGS      ║\n╚═══════════════════════╝\n\n"
    
    keyboard = []
    
    # Upcoming bookings
    if upcoming:
        text += f"🔵 <b>UPCOMING ({len(upcoming)})</b>\n"
        for booking in upcoming[:5]:  # Limit to 5
            activity = booking.get('activity', {})
            title = activity.get('title', 'Untitled')
            date_str = format_datetime_short(activity.get('start_datetime', ''))
            text += f"• {title} - {date_str}\n"
            
            # Add action buttons
            keyboard.append([
                InlineKeyboardButton("🗑️ Cancel", callback_data=f"cancel_booking_{booking['id']}"),
                InlineKeyboardButton("ℹ️ Details", callback_data=f"booking_details_{booking['id']}")
            ])
        text += "\n"
    else:
        text += "🔵 <b>UPCOMING</b>\nNo upcoming bookings\n\n"
    
    # Past bookings
    if past:
        text += f"🟢 <b>PAST ({len(past)})</b>\n"
        for booking in past[:5]:  # Limit to 5
            activity = booking.get('activity', {})
            title = activity.get('title', 'Untitled')
            date_str = format_datetime_short(activity.get('start_datetime', ''))
            
            if booking.get('feedback_rating'):
                rating = booking['feedback_rating']
                stars = '⭐' * rating
                text += f"• {title} - {date_str}\n  ✅ Rated ({stars})\n"
            else:
                text += f"• {title} - {date_str}\n"
                keyboard.append([
                    InlineKeyboardButton(f"⭐ Rate: {title[:20]}", callback_data=f"rate_booking_{booking['id']}")
                ])
    
    await context.bot.send_message(
        chat_id=chat_id,
        text=text,
        reply_markup=InlineKeyboardMarkup(keyboard) if keyboard else None,
        parse_mode='HTML'
    )


async def show_booking_details(update: Update, context: ContextTypes.DEFAULT_TYPE, api, booking_id: str):
    """Show detailed view of a booking."""
    query = update.callback_query
    await query.answer()
    
    token = UserSession.get_token(context)
    
    # Get all bookings and find the one we need
    bookings = await api.get_my_bookings(token, limit=50)
    booking = next((b for b in bookings if b['id'] == booking_id), None)
    
    if not booking:
        await query.edit_message_text("❌ Booking not found.")
        return
    
    activity = booking.get('activity', {})
    program = activity.get('program', {})
    
    text = (
        f"📋 <b>BOOKING DETAILS</b>\n\n"
        f"📌 <b>{activity.get('title', 'Untitled')}</b>\n"
        f"🏷️ {program.get('name', 'General')}\n\n"
        f"📅 {format_datetime(activity.get('start_datetime', ''))}\n"
        f"📍 {activity.get('location', 'TBA')}\n"
        f"🚪 Room: {activity.get('room', 'TBA')}\n\n"
        f"📝 {activity.get('description', 'No description')[:200]}\n\n"
        f"Status: {'✅ Confirmed' if booking.get('status') == 'confirmed' else booking.get('status', 'Unknown').title()}"
    )
    
    keyboard = [
        [InlineKeyboardButton("🗑️ Cancel Booking", callback_data=f"confirm_cancel_{booking_id}")],
        [InlineKeyboardButton("◀️ Back to Bookings", callback_data="back_to_bookings")]
    ]
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')


async def confirm_cancel_booking(update: Update, context: ContextTypes.DEFAULT_TYPE, booking_id: str):
    """Ask for confirmation before cancelling."""
    query = update.callback_query
    await query.answer()
    
    text = (
        "⚠️ <b>CONFIRM CANCELLATION</b>\n\n"
        "Are you sure you want to cancel this booking?\n\n"
        "Note: You cannot cancel within 2 hours of the activity start time."
    )
    
    keyboard = [
        [
            InlineKeyboardButton("✅ Yes, Cancel", callback_data=f"do_cancel_{booking_id}"),
            InlineKeyboardButton("❌ No, Keep", callback_data="back_to_bookings")
        ]
    ]
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')


async def do_cancel_booking(update: Update, context: ContextTypes.DEFAULT_TYPE, api, booking_id: str):
    """Execute booking cancellation."""
    query = update.callback_query
    await query.answer()
    
    token = UserSession.get_token(context)
    result = await api.cancel_booking(token, booking_id)
    
    if result.get('success'):
        await query.edit_message_text(
            "✅ <b>Booking Cancelled</b>\n\nYour booking has been cancelled successfully.",
            parse_mode='HTML'
        )
    else:
        error = result.get('error', 'Cancellation failed')
        await query.edit_message_text(
            f"❌ <b>Cancellation Failed</b>\n\n{error}",
            parse_mode='HTML'
        )


# ==================== WAITLIST STATUS ====================

async def show_waitlist_status(update: Update, context: ContextTypes.DEFAULT_TYPE, api):
    """Display participant's waitlist entries."""
    chat_id = update.effective_chat.id
    
    if not UserSession.is_authenticated(context):
        await context.bot.send_message(chat_id=chat_id, text="⚠️ Please /start to login first.")
        return
    
    token = UserSession.get_token(context)
    participant_id = UserSession.get_participant_id(context)
    
    if not participant_id:
        await context.bot.send_message(
            chat_id=chat_id,
            text="⚠️ You need to be a participant to view waitlist."
        )
        return
    
    entries = await api.get_participant_waitlist(token, participant_id)
    
    if not entries:
        await context.bot.send_message(
            chat_id=chat_id,
            text="╔═══════════════════════╗\n║  ⏰ WAITLIST STATUS   ║\n╚═══════════════════════╝\n\n✨ You're not on any waitlists.",
            parse_mode='HTML'
        )
        return
    
    text = "╔═══════════════════════╗\n║  ⏰ WAITLIST STATUS   ║\n╚═══════════════════════╝\n\n"
    text += f"📋 You're on {len(entries)} waitlist(s):\n\n"
    
    keyboard = []
    
    for i, entry in enumerate(entries, 1):
        activity = entry.get('activity', {})
        title = activity.get('title', 'Untitled')
        date_str = format_datetime_short(activity.get('start_datetime', ''))
        position = entry.get('position', '?')
        status = entry.get('status', 'waiting')
        
        text += f"<b>{i}. {title}</b> - {date_str}\n"
        
        if status == 'notified' and entry.get('is_offer_active'):
            # Active offer - show expiry and accept/decline
            expires_ms = entry.get('offer_expires_in', 0)
            if expires_ms > 0:
                hours = expires_ms // (1000 * 60 * 60)
                mins = (expires_ms // (1000 * 60)) % 60
                text += f"   Position: #1 (You're next!)\n"
                text += f"   ⏰ Offer expires in: {hours}h {mins}m\n"
            else:
                text += f"   ⚠️ Offer may have expired\n"
            
            keyboard.append([
                InlineKeyboardButton("✅ Accept Spot", callback_data=f"accept_waitlist_{entry['id']}"),
                InlineKeyboardButton("❌ Decline", callback_data=f"decline_waitlist_{entry['id']}")
            ])
        else:
            text += f"   Position: #{position}\n"
            keyboard.append([
                InlineKeyboardButton(f"❌ Leave: {title[:15]}...", callback_data=f"decline_waitlist_{entry['id']}")
            ])
        
        text += "\n"
    
    await context.bot.send_message(
        chat_id=chat_id,
        text=text,
        reply_markup=InlineKeyboardMarkup(keyboard) if keyboard else None,
        parse_mode='HTML'
    )


async def handle_waitlist_accept(update: Update, context: ContextTypes.DEFAULT_TYPE, api, waitlist_id: str):
    """Handle accepting a waitlist offer."""
    query = update.callback_query
    await query.answer("Processing...")
    
    token = UserSession.get_token(context)
    result = await api.accept_waitlist_offer(token, waitlist_id)
    
    if result.get('success'):
        await query.edit_message_text(
            "🎉 <b>Spot Accepted!</b>\n\n"
            "Your booking has been confirmed.\n"
            "Check <b>📋 My Bookings</b> for details.",
            parse_mode='HTML'
        )
    else:
        error = result.get('error', 'Failed to accept offer')
        await query.edit_message_text(
            f"❌ <b>Could Not Accept</b>\n\n{error}\n\n"
            "The offer may have expired. Please check your waitlist status.",
            parse_mode='HTML'
        )


async def handle_waitlist_decline(update: Update, context: ContextTypes.DEFAULT_TYPE, api, waitlist_id: str):
    """Handle declining a waitlist offer or leaving waitlist."""
    query = update.callback_query
    await query.answer("Processing...")
    
    token = UserSession.get_token(context)
    result = await api.decline_waitlist_offer(token, waitlist_id)
    
    if result.get('success'):
        await query.edit_message_text(
            "✅ <b>Removed from Waitlist</b>\n\n"
            "You've been removed from the waitlist.",
            parse_mode='HTML'
        )
    else:
        await query.edit_message_text(
            "❌ <b>Error</b>\n\nCould not remove from waitlist.",
            parse_mode='HTML'
        )


# ==================== RATING FLOW ====================

async def start_rating_flow(update: Update, context: ContextTypes.DEFAULT_TYPE, booking_id: str):
    """Start the rating flow for a completed activity."""
    query = update.callback_query
    await query.answer()
    
    # Store booking ID in session
    UserSession.set_rating_booking_id(context, booking_id)
    
    text = (
        "⭐ <b>RATE THIS ACTIVITY</b>\n\n"
        "How was your experience?\n"
        "Select a rating below:"
    )
    
    keyboard = [
        [
            InlineKeyboardButton("⭐", callback_data="rating_1"),
            InlineKeyboardButton("⭐⭐", callback_data="rating_2"),
            InlineKeyboardButton("⭐⭐⭐", callback_data="rating_3"),
        ],
        [
            InlineKeyboardButton("⭐⭐⭐⭐", callback_data="rating_4"),
            InlineKeyboardButton("⭐⭐⭐⭐⭐", callback_data="rating_5"),
        ],
        [InlineKeyboardButton("❌ Cancel", callback_data="back_to_bookings")]
    ]
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')
    return RATING_SELECT_STARS


async def handle_rating_selection(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle rating star selection."""
    query = update.callback_query
    await query.answer()
    
    rating = int(query.data.split('_')[1])
    UserSession.set_rating_value(context, rating)
    
    stars = '⭐' * rating
    text = (
        f"⭐ <b>RATE THIS ACTIVITY</b>\n\n"
        f"Your rating: {stars}\n\n"
        f"Would you like to add a comment? (optional)\n\n"
        f"Type your feedback or click Skip."
    )
    
    keyboard = [[InlineKeyboardButton("⏭️ Skip", callback_data="rating_skip_feedback")]]
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')
    return RATING_INPUT_FEEDBACK


async def handle_rating_feedback(update: Update, context: ContextTypes.DEFAULT_TYPE, api):
    """Handle rating feedback text input."""
    feedback_text = update.message.text.strip()
    
    booking_id = UserSession.get_rating_booking_id(context)
    rating = UserSession.get_rating_value(context)
    token = UserSession.get_token(context)
    
    if not booking_id or not rating:
        await update.message.reply_text("⚠️ Rating session expired. Please try again.")
        UserSession.clear_rating_data(context)
        return ConversationHandler.END
    
    # Submit feedback
    result = await api.submit_booking_feedback(token, booking_id, rating, feedback_text)
    
    UserSession.clear_rating_data(context)
    
    if result.get('success'):
        stars = '⭐' * rating
        await update.message.reply_text(
            f"✅ <b>Thank you for your feedback!</b>\n\n"
            f"Rating: {stars}\n"
            f"Comment: {feedback_text[:100]}...\n\n"
            f"Your feedback helps us improve!",
            parse_mode='HTML'
        )
    else:
        await update.message.reply_text(
            f"❌ Could not submit feedback: {result.get('error', 'Unknown error')}",
            parse_mode='HTML'
        )
    
    return ConversationHandler.END


async def handle_rating_skip_feedback(update: Update, context: ContextTypes.DEFAULT_TYPE, api):
    """Handle skipping feedback text."""
    query = update.callback_query
    await query.answer()
    
    booking_id = UserSession.get_rating_booking_id(context)
    rating = UserSession.get_rating_value(context)
    token = UserSession.get_token(context)
    
    if not booking_id or not rating:
        await query.edit_message_text("⚠️ Rating session expired. Please try again.")
        UserSession.clear_rating_data(context)
        return ConversationHandler.END
    
    # Submit feedback without text
    result = await api.submit_booking_feedback(token, booking_id, rating, '')
    
    UserSession.clear_rating_data(context)
    
    if result.get('success'):
        stars = '⭐' * rating
        await query.edit_message_text(
            f"✅ <b>Thank you for your rating!</b>\n\n"
            f"Rating: {stars}\n\n"
            f"Your feedback helps us improve!",
            parse_mode='HTML'
        )
    else:
        await query.edit_message_text(
            f"❌ Could not submit rating: {result.get('error', 'Unknown error')}",
            parse_mode='HTML'
        )
    
    return ConversationHandler.END
