"""
Caregiver-specific handlers for CareConnect Hub Telegram Bot.
Handles: Care Recipients, Register on Behalf, All Bookings View
"""
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, ConversationHandler

from session import UserSession
from config import INPUT_PARTICIPANT_EMAIL


def format_datetime_short(dt_str: str) -> str:
    """Format datetime string for compact display."""
    try:
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        return dt.strftime('%a, %H:%M')
    except:
        return dt_str[:10] if dt_str else 'TBA'


# ==================== CARE RECIPIENTS MANAGEMENT ====================

async def show_care_recipients(update: Update, context: ContextTypes.DEFAULT_TYPE, api):
    """Display list of participants linked to this caregiver."""
    chat_id = update.effective_chat.id
    
    if not UserSession.is_authenticated(context):
        await context.bot.send_message(chat_id=chat_id, text="⚠️ Please /start to login first.")
        return
    
    user = UserSession.get_user(context)
    if user.get('role') != 'caregiver':
        await context.bot.send_message(
            chat_id=chat_id,
            text="⚠️ This feature is only available for caregivers."
        )
        return
    
    token = UserSession.get_token(context)
    caregiver_id = user.get('caregiver_id')
    
    if not caregiver_id:
        await context.bot.send_message(
            chat_id=chat_id,
            text="⚠️ Caregiver profile not found. Please contact support."
        )
        return
    
    participants = await api.get_caregiver_participants(token, caregiver_id)
    
    text = "╔═══════════════════════╗\n║  👥 CARE RECIPIENTS   ║\n╚═══════════════════════╝\n\n"
    
    keyboard = []
    
    if participants:
        text += "You're caring for:\n\n"
        
        for i, p in enumerate(participants, 1):
            user_info = p.get('user', {})
            name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip() or 'Unknown'
            upcoming = p.get('upcoming_bookings_count', 0)
            
            # Get accessibility needs
            needs = p.get('accessibility_needs', [])
            needs_text = ', '.join(needs) if needs else 'None'
            
            text += f"<b>{i}. 👵 {name}</b>\n"
            text += f"   • {upcoming} upcoming event(s)\n"
            text += f"   • Needs: {needs_text[:30]}\n\n"
            
            keyboard.append([
                InlineKeyboardButton(f"📅 Schedule: {name[:10]}", callback_data=f"view_schedule_{p['id']}"),
                InlineKeyboardButton(f"➕ Register", callback_data=f"register_for_{p['id']}")
            ])
    else:
        text += "You haven't linked any care recipients yet.\n\n"
        text += "Click below to link a participant by their email."
    
    keyboard.append([InlineKeyboardButton("➕ Add New Recipient", callback_data="add_recipient")])
    
    await context.bot.send_message(
        chat_id=chat_id,
        text=text,
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='HTML'
    )


async def start_add_recipient(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start the flow to add a new care recipient."""
    query = update.callback_query
    await query.answer()
    
    text = (
        "➕ <b>ADD CARE RECIPIENT</b>\n\n"
        "Enter the <b>email address</b> of the participant you want to link.\n\n"
        "Note: They must already be registered as a participant."
    )
    
    keyboard = [[InlineKeyboardButton("❌ Cancel", callback_data="cancel_add_recipient")]]
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')
    return INPUT_PARTICIPANT_EMAIL


async def handle_participant_email_input(update: Update, context: ContextTypes.DEFAULT_TYPE, api):
    """Handle email input for linking participant."""
    email = update.message.text.strip().lower()
    
    if '@' not in email or '.' not in email:
        await update.message.reply_text(
            "⚠️ Invalid email format. Please enter a valid email address:",
            parse_mode='HTML'
        )
        return INPUT_PARTICIPANT_EMAIL
    
    token = UserSession.get_token(context)
    user = UserSession.get_user(context)
    caregiver_id = user.get('caregiver_id')
    
    result = await api.link_participant_to_caregiver(
        token,
        caregiver_id,
        participant_email=email,
        is_primary=True
    )
    
    if result.get('success'):
        participant = result.get('link', {}).get('participant', {})
        p_user = participant.get('user', {})
        name = f"{p_user.get('first_name', '')} {p_user.get('last_name', '')}".strip()
        
        await update.message.reply_text(
            f"✅ <b>Successfully Linked!</b>\n\n"
            f"You are now linked to <b>{name}</b>.\n\n"
            f"You can now:\n"
            f"• View their schedule\n"
            f"• Register them for activities\n"
            f"• Cancel their bookings",
            parse_mode='HTML'
        )
    else:
        error = result.get('error', 'Could not link participant')
        await update.message.reply_text(
            f"❌ <b>Could Not Link</b>\n\n{error}\n\n"
            f"Make sure the person is registered as a participant.",
            parse_mode='HTML'
        )
    
    return ConversationHandler.END


async def cancel_add_recipient(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel adding recipient."""
    query = update.callback_query
    await query.answer()
    await query.edit_message_text("❌ Cancelled linking recipient.")
    return ConversationHandler.END


# ==================== VIEW SCHEDULE ====================

async def view_participant_schedule(update: Update, context: ContextTypes.DEFAULT_TYPE, api, participant_id: str):
    """View a specific participant's schedule."""
    query = update.callback_query
    await query.answer()
    
    token = UserSession.get_token(context)
    bookings = await api.get_participant_bookings(token, participant_id)
    
    if not bookings:
        text = "📅 <b>SCHEDULE</b>\n\nNo upcoming bookings for this participant."
        keyboard = [[InlineKeyboardButton("◀️ Back", callback_data="back_to_recipients")]]
    else:
        text = "📅 <b>UPCOMING SCHEDULE</b>\n\n"
        keyboard = []

        for booking in bookings[:10]:
            activity = booking.get('activity') or {}
            title = activity.get('title', 'Untitled')
            date_str = format_datetime_short(activity.get('start_datetime', ''))
            location = activity.get('location', 'TBA')
            
            text += f"• <b>{title}</b>\n"
            text += f"  📅 {date_str} | 📍 {location}\n\n"
            
            keyboard.append([
                InlineKeyboardButton(f"🗑️ Cancel: {title[:15]}", callback_data=f"cancel_booking_{booking['id']}")
            ])
        
        keyboard.append([InlineKeyboardButton("◀️ Back", callback_data="back_to_recipients")])
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')


# ==================== REGISTER ON BEHALF ====================

async def start_register_for_participant(update: Update, context: ContextTypes.DEFAULT_TYPE, api, participant_id: str):
    """Start browsing events to register for a participant."""
    query = update.callback_query
    await query.answer()
    
    # Store selected participant in session
    UserSession.set_selected_participant_id(context, participant_id)
    
    token = UserSession.get_token(context)
    activities = await api.get_activities(token, limit=10, has_availability=False)
    
    if not activities:
        await query.edit_message_text("🚫 No upcoming events at the moment.")
        return
    
    text = "📅 <b>SELECT EVENT TO REGISTER</b>\n\n(Registering on behalf of your care recipient)\n\n"
    
    keyboard = []
    for activity in activities:
        start_dt = activity.get('start_datetime', '')
        try:
            dt = datetime.fromisoformat(start_dt.replace('Z', '+00:00'))
            date_str = dt.strftime('%d %b %H:%M')
        except:
            date_str = start_dt[:16] if start_dt else 'TBA'
        
        title = activity.get('title', 'Untitled')
        spots = activity.get('capacity', 0) - activity.get('current_bookings', 0)
        spot_text = f"🟢 {spots}" if spots > 0 else "🔴 Full"
        
        # Check accessibility
        accessibility = activity.get('accessibility_features', [])
        access_icon = "♿" if accessibility else ""
        
        btn_text = f"{access_icon} {title} ({date_str}) {spot_text}"
        keyboard.append([InlineKeyboardButton(btn_text, callback_data=f"register_activity_{activity['id']}")])
    
    keyboard.append([InlineKeyboardButton("◀️ Cancel", callback_data="back_to_recipients")])
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')


async def confirm_register_for_participant(update: Update, context: ContextTypes.DEFAULT_TYPE, api, activity_id: str):
    """Confirm and execute registration for participant."""
    query = update.callback_query
    await query.answer("Processing...")
    
    token = UserSession.get_token(context)
    participant_id = UserSession.get_selected_participant_id(context)
    
    if not participant_id:
        await query.edit_message_text("⚠️ Session expired. Please try again.")
        return
    
    # Get activity details
    activity = await api.get_activity(token, activity_id)
    if not activity:
        await query.edit_message_text("❌ Activity not found.")
        return
    
    # Create booking
    result = await api.create_booking(token, activity_id, participant_id)
    
    UserSession.clear_selected_participant(context)
    
    if result.get('success'):
        status = result.get('status', 'confirmed')
        
        if status == 'waitlisted':
            position = result.get('waitlist_position', '?')
            await query.edit_message_text(
                f"📋 <b>Added to Waitlist</b>\n\n"
                f"Activity: {activity.get('title')}\n"
                f"Position: #{position}\n\n"
                f"You'll be notified if a spot opens up.",
                parse_mode='HTML'
            )
        else:
            await query.edit_message_text(
                f"✅ <b>Registration Confirmed!</b>\n\n"
                f"Your care recipient is registered for:\n"
                f"📌 {activity.get('title')}\n"
                f"📅 {format_datetime_short(activity.get('start_datetime', ''))}\n"
                f"📍 {activity.get('location', 'TBA')}",
                parse_mode='HTML'
            )
    else:
        error = result.get('error', 'Registration failed')
        conflict = result.get('conflicting_activity')
        
        if conflict:
            await query.edit_message_text(
                f"⚠️ <b>Time Conflict</b>\n\n"
                f"Already registered for \"{conflict.get('title')}\" at this time.",
                parse_mode='HTML'
            )
        else:
            await query.edit_message_text(
                f"❌ <b>Registration Failed</b>\n\n{error}",
                parse_mode='HTML'
            )


# ==================== ALL BOOKINGS VIEW ====================

async def show_all_bookings(update: Update, context: ContextTypes.DEFAULT_TYPE, api):
    """Show all bookings across all care recipients."""
    chat_id = update.effective_chat.id
    
    if not UserSession.is_authenticated(context):
        await context.bot.send_message(chat_id=chat_id, text="⚠️ Please /start to login first.")
        return
    
    user = UserSession.get_user(context)
    if user.get('role') != 'caregiver':
        await context.bot.send_message(
            chat_id=chat_id,
            text="⚠️ This feature is only available for caregivers."
        )
        return
    
    token = UserSession.get_token(context)
    caregiver_id = user.get('caregiver_id')
    
    participants = await api.get_caregiver_participants(token, caregiver_id)
    
    text = "╔═══════════════════════╗\n║   📋 ALL BOOKINGS     ║\n╚═══════════════════════╝\n\n"
    
    keyboard = []
    
    if not participants:
        text += "No care recipients linked yet."
    else:
        for p in participants:
            user_info = p.get('user', {})
            name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip() or 'Unknown'
            
            bookings = await api.get_participant_bookings(token, p['id'])
            
            text += f"<b>👵 {name}</b>\n"
            
            if bookings:
                for booking in bookings[:3]:
                    activity = booking.get('activity') or {}
                    title = activity.get('title', 'Untitled')
                    date_str = format_datetime_short(activity.get('start_datetime', ''))
                    text += f"  • {title} - {date_str}\n"
                
                if len(bookings) > 3:
                    text += f"  ... and {len(bookings) - 3} more\n"
            else:
                text += "  No upcoming bookings\n"
            
            text += "\n"
            
            keyboard.append([
                InlineKeyboardButton(f"View {name[:10]}'s Schedule", callback_data=f"view_schedule_{p['id']}")
            ])
    
    await context.bot.send_message(
        chat_id=chat_id,
        text=text,
        reply_markup=InlineKeyboardMarkup(keyboard) if keyboard else None,
        parse_mode='HTML'
    )


async def back_to_recipients(update: Update, context: ContextTypes.DEFAULT_TYPE, api):
    """Navigate back to care recipients list."""
    query = update.callback_query
    await query.answer()
    
    # Clear any selected participant
    UserSession.clear_selected_participant(context)
    
    # Reshow recipients list
    await show_care_recipients_inline(update, context, api)


async def show_care_recipients_inline(update: Update, context: ContextTypes.DEFAULT_TYPE, api):
    """Show care recipients in response to inline button (edit existing message)."""
    query = update.callback_query
    
    user = UserSession.get_user(context)
    token = UserSession.get_token(context)
    caregiver_id = user.get('caregiver_id')
    
    participants = await api.get_caregiver_participants(token, caregiver_id)
    
    text = "╔═══════════════════════╗\n║  👥 CARE RECIPIENTS   ║\n╚═══════════════════════╝\n\n"
    
    keyboard = []
    
    if participants:
        text += "You're caring for:\n\n"
        
        for i, p in enumerate(participants, 1):
            user_info = p.get('user', {})
            name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip() or 'Unknown'
            upcoming = p.get('upcoming_bookings_count', 0)
            
            text += f"<b>{i}. 👵 {name}</b> - {upcoming} upcoming\n"
            
            keyboard.append([
                InlineKeyboardButton(f"📅 Schedule", callback_data=f"view_schedule_{p['id']}"),
                InlineKeyboardButton(f"➕ Register", callback_data=f"register_for_{p['id']}")
            ])
    else:
        text += "No care recipients linked yet."
    
    keyboard.append([InlineKeyboardButton("➕ Add New Recipient", callback_data="add_recipient")])
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')
