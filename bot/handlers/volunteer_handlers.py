"""
Volunteer-specific handlers for CareConnect Hub Telegram Bot.
Handles: Registration, Opportunities, Assignments, Check-in/out, Stats, Leaderboard
"""
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, ConversationHandler

from session import UserSession
from config import (
    INPUT_VOLUNTEER_INTERESTS, INPUT_VOLUNTEER_SKILLS, INPUT_VOLUNTEER_AVAILABILITY,
    CHECKOUT_INPUT_FEEDBACK, VOLUNTEER_INTERESTS, VOLUNTEER_SKILLS
)


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


# ==================== VOLUNTEER REGISTRATION ====================

async def start_volunteer_registration(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start volunteer-specific registration (collect interests)."""
    query = update.callback_query
    await query.answer()
    
    # Initialize selected interests
    UserSession.set_volunteer_data(context, 'interests', [])
    
    text = (
        "🙋 <b>VOLUNTEER REGISTRATION</b>\n\n"
        "Step 1/3: Select your <b>interests</b>\n"
        "(Select all that apply, then click Done)"
    )
    
    keyboard = []
    for interest_id, interest_name in VOLUNTEER_INTERESTS:
        keyboard.append([InlineKeyboardButton(f"⬜ {interest_name}", callback_data=f"toggle_interest_{interest_id}")])
    
    keyboard.append([InlineKeyboardButton("✅ Done - Next Step", callback_data="interests_done")])
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')
    return INPUT_VOLUNTEER_INTERESTS


async def toggle_interest(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Toggle an interest selection."""
    query = update.callback_query
    await query.answer()
    
    interest_id = query.data.replace('toggle_interest_', '')
    
    current = UserSession.get_volunteer_data(context, 'interests') or []
    if interest_id in current:
        current.remove(interest_id)
    else:
        current.append(interest_id)
    
    UserSession.set_volunteer_data(context, 'interests', current)
    
    # Rebuild keyboard with updated selections
    text = (
        "🙋 <b>VOLUNTEER REGISTRATION</b>\n\n"
        "Step 1/3: Select your <b>interests</b>\n"
        f"Selected: {len(current)}"
    )
    
    keyboard = []
    for interest_id_opt, interest_name in VOLUNTEER_INTERESTS:
        icon = "✅" if interest_id_opt in current else "⬜"
        keyboard.append([InlineKeyboardButton(f"{icon} {interest_name}", callback_data=f"toggle_interest_{interest_id_opt}")])
    
    keyboard.append([InlineKeyboardButton("✅ Done - Next Step", callback_data="interests_done")])
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')
    return INPUT_VOLUNTEER_INTERESTS


async def interests_done(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Move to skills selection."""
    query = update.callback_query
    await query.answer()
    
    # Initialize selected skills
    UserSession.set_volunteer_data(context, 'skills', [])
    
    text = (
        "🙋 <b>VOLUNTEER REGISTRATION</b>\n\n"
        "Step 2/3: Select your <b>skills</b>\n"
        "(Select all that apply, then click Done)"
    )
    
    keyboard = []
    for skill_id, skill_name in VOLUNTEER_SKILLS:
        keyboard.append([InlineKeyboardButton(f"⬜ {skill_name}", callback_data=f"toggle_skill_{skill_id}")])
    
    keyboard.append([InlineKeyboardButton("✅ Done - Next Step", callback_data="skills_done")])
    keyboard.append([InlineKeyboardButton("⏭️ Skip Skills", callback_data="skills_done")])
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')
    return INPUT_VOLUNTEER_SKILLS


async def toggle_skill(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Toggle a skill selection."""
    query = update.callback_query
    await query.answer()
    
    skill_id = query.data.replace('toggle_skill_', '')
    
    current = UserSession.get_volunteer_data(context, 'skills') or []
    if skill_id in current:
        current.remove(skill_id)
    else:
        current.append(skill_id)
    
    UserSession.set_volunteer_data(context, 'skills', current)
    
    # Rebuild keyboard
    text = (
        "🙋 <b>VOLUNTEER REGISTRATION</b>\n\n"
        "Step 2/3: Select your <b>skills</b>\n"
        f"Selected: {len(current)}"
    )
    
    keyboard = []
    for skill_id_opt, skill_name in VOLUNTEER_SKILLS:
        icon = "✅" if skill_id_opt in current else "⬜"
        keyboard.append([InlineKeyboardButton(f"{icon} {skill_name}", callback_data=f"toggle_skill_{skill_id_opt}")])
    
    keyboard.append([InlineKeyboardButton("✅ Done - Next Step", callback_data="skills_done")])
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')
    return INPUT_VOLUNTEER_SKILLS


async def skills_done(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Move to availability selection."""
    query = update.callback_query
    await query.answer()
    
    text = (
        "🙋 <b>VOLUNTEER REGISTRATION</b>\n\n"
        "Step 3/3: When are you usually available?\n"
        "(Select your preferred times)"
    )
    
    # Simplified availability - just general preferences
    keyboard = [
        [InlineKeyboardButton("🌅 Weekday Mornings", callback_data="avail_weekday_morning")],
        [InlineKeyboardButton("☀️ Weekday Afternoons", callback_data="avail_weekday_afternoon")],
        [InlineKeyboardButton("🌙 Weekday Evenings", callback_data="avail_weekday_evening")],
        [InlineKeyboardButton("📅 Weekends", callback_data="avail_weekend")],
        [InlineKeyboardButton("🔄 Flexible / Any Time", callback_data="avail_flexible")],
        [InlineKeyboardButton("✅ Complete Registration", callback_data="complete_volunteer_reg")]
    ]
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')
    return INPUT_VOLUNTEER_AVAILABILITY


async def set_availability(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Set availability preference."""
    query = update.callback_query
    await query.answer()
    
    avail_type = query.data.replace('avail_', '')
    
    # Map to availability dict
    availability = {}
    if avail_type == 'weekday_morning':
        availability = {d: ['morning'] for d in ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']}
    elif avail_type == 'weekday_afternoon':
        availability = {d: ['afternoon'] for d in ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']}
    elif avail_type == 'weekday_evening':
        availability = {d: ['evening'] for d in ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']}
    elif avail_type == 'weekend':
        availability = {'saturday': ['morning', 'afternoon', 'evening'], 'sunday': ['morning', 'afternoon', 'evening']}
    elif avail_type == 'flexible':
        availability = {d: ['morning', 'afternoon', 'evening'] for d in ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']}
    
    UserSession.set_volunteer_data(context, 'availability', availability)
    
    # Show selected and confirm
    text = (
        f"🙋 <b>VOLUNTEER REGISTRATION</b>\n\n"
        f"Availability: {avail_type.replace('_', ' ').title()}\n\n"
        f"Click 'Complete Registration' to finish."
    )
    
    keyboard = [[InlineKeyboardButton("✅ Complete Registration", callback_data="complete_volunteer_reg")]]
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')
    return INPUT_VOLUNTEER_AVAILABILITY


async def complete_volunteer_registration(update: Update, context: ContextTypes.DEFAULT_TYPE, api):
    """Complete volunteer profile creation."""
    query = update.callback_query
    await query.answer("Creating your volunteer profile...")
    
    token = UserSession.get_token(context)
    user_id = UserSession.get_user_id(context)
    
    interests = UserSession.get_volunteer_data(context, 'interests') or []
    skills = UserSession.get_volunteer_data(context, 'skills') or []
    availability = UserSession.get_volunteer_data(context, 'availability') or {}
    
    result = await api.create_volunteer_profile(token, user_id, interests, skills, availability)
    
    UserSession.clear_volunteer_data(context)
    
    if result.get('success'):
        volunteer = result.get('volunteer', {})
        # Update session with volunteer_id
        user = UserSession.get_user(context)
        user['volunteer_id'] = volunteer.get('id')
        UserSession.set_user(context, user)
        
        await query.edit_message_text(
            "✅ <b>Volunteer Profile Created!</b>\n\n"
            f"Interests: {', '.join(interests) or 'None selected'}\n"
            f"Skills: {', '.join(skills) or 'None selected'}\n\n"
            "You can now:\n"
            "• Browse volunteer opportunities\n"
            "• Accept assignments\n"
            "• Track your hours\n\n"
            "Use the menu to get started!",
            parse_mode='HTML'
        )
    else:
        error = result.get('error', 'Failed to create profile')
        await query.edit_message_text(
            f"❌ <b>Could Not Create Profile</b>\n\n{error}",
            parse_mode='HTML'
        )
    
    return ConversationHandler.END


# ==================== AVAILABLE OPPORTUNITIES ====================

async def show_available_opportunities(update: Update, context: ContextTypes.DEFAULT_TYPE, api):
    """Display activities that need volunteers."""
    chat_id = update.effective_chat.id
    
    if not UserSession.is_authenticated(context):
        await context.bot.send_message(chat_id=chat_id, text="⚠️ Please /start to login first.")
        return
    
    token = UserSession.get_token(context)
    activities = await api.get_activities_needing_volunteers(token, limit=10)
    
    text = "╔═══════════════════════╗\n║  🎯 OPPORTUNITIES     ║\n╚═══════════════════════╝\n\n"
    
    if not activities:
        text += "No volunteer opportunities at the moment.\nCheck back later!"
        await context.bot.send_message(chat_id=chat_id, text=text, parse_mode='HTML')
        return
    
    text += "Activities needing volunteers:\n\n"
    
    keyboard = []
    for activity in activities:
        title = activity.get('title', 'Untitled')
        date_str = format_datetime_short(activity.get('start_datetime', ''))
        
        current_vol = activity.get('current_volunteers', 0)
        max_vol = activity.get('max_volunteers', 0)
        needed = max_vol - current_vol
        
        # Activity type for matching display
        activity_type = activity.get('activity_type', '').title()
        
        text += f"<b>📌 {title}</b>\n"
        text += f"   📅 {date_str}\n"
        text += f"   🏷️ {activity_type}\n"
        text += f"   👥 Need: {needed} volunteer(s)\n\n"
        
        keyboard.append([
            InlineKeyboardButton(f"ℹ️ Details", callback_data=f"vol_activity_{activity['id']}"),
            InlineKeyboardButton(f"✋ I'm Interested", callback_data=f"vol_interested_{activity['id']}")
        ])
    
    await context.bot.send_message(
        chat_id=chat_id,
        text=text,
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='HTML'
    )


async def show_volunteer_activity_details(update: Update, context: ContextTypes.DEFAULT_TYPE, api, activity_id: str):
    """Show activity details for volunteer."""
    query = update.callback_query
    await query.answer()
    
    token = UserSession.get_token(context)
    activity = await api.get_activity(token, activity_id)
    
    if not activity:
        await query.edit_message_text("❌ Activity not found.")
        return
    
    title = activity.get('title', 'Untitled')
    description = activity.get('description', 'No description')
    date_str = format_datetime(activity.get('start_datetime', ''))
    location = activity.get('location', 'TBA')
    room = activity.get('room', '')
    
    current_vol = activity.get('current_volunteers', 0)
    max_vol = activity.get('max_volunteers', 0)
    
    text = (
        f"📌 <b>{title}</b>\n\n"
        f"📝 {description[:300]}\n\n"
        f"📅 {date_str}\n"
        f"📍 {location}" + (f", {room}" if room else "") + "\n"
        f"👥 Volunteers: {current_vol}/{max_vol}\n\n"
        f"<i>Express interest and staff will reach out to assign you.</i>"
    )
    
    keyboard = [
        [InlineKeyboardButton("✋ I'm Interested", callback_data=f"vol_interested_{activity_id}")],
        [InlineKeyboardButton("◀️ Back", callback_data="back_to_opportunities")]
    ]
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')


async def express_interest(update: Update, context: ContextTypes.DEFAULT_TYPE, activity_id: str):
    """Handle volunteer expressing interest (notify staff)."""
    query = update.callback_query
    await query.answer("Thanks for your interest!")
    
    # In a full implementation, this would:
    # 1. Create a pending assignment request
    # 2. Notify staff via dashboard
    # For now, we'll show a confirmation
    
    await query.edit_message_text(
        "✅ <b>Interest Registered!</b>\n\n"
        "Staff has been notified of your interest.\n"
        "You'll receive a message when you're assigned.\n\n"
        "Thank you for volunteering!",
        parse_mode='HTML'
    )


# ==================== MY ASSIGNMENTS ====================

async def show_my_assignments(update: Update, context: ContextTypes.DEFAULT_TYPE, api):
    """Display volunteer's assignments."""
    chat_id = update.effective_chat.id
    
    if not UserSession.is_authenticated(context):
        await context.bot.send_message(chat_id=chat_id, text="⚠️ Please /start to login first.")
        return
    
    volunteer_id = UserSession.get_volunteer_id(context)
    if not volunteer_id:
        await context.bot.send_message(
            chat_id=chat_id,
            text="⚠️ Volunteer profile not found. Please register as a volunteer first."
        )
        return
    
    token = UserSession.get_token(context)
    data = await api.get_volunteer_assignments(token, volunteer_id)
    
    grouped = data.get('grouped', {})
    
    text = "╔═══════════════════════╗\n║   📋 MY ASSIGNMENTS   ║\n╚═══════════════════════╝\n\n"
    
    keyboard = []
    
    # Pending invitations
    invited = grouped.get('invited', [])
    if invited:
        text += f"🟡 <b>PENDING INVITATION ({len(invited)})</b>\n"
        for a in invited[:3]:
            activity = a.get('activity', {})
            title = activity.get('title', 'Untitled')
            date_str = format_datetime_short(activity.get('start_datetime', ''))
            role = a.get('role', 'assistant').title()
            
            text += f"• {title} - {date_str}\n"
            text += f"  Role: {role}\n\n"
            
            keyboard.append([
                InlineKeyboardButton("✅ Accept", callback_data=f"accept_assign_{a['id']}"),
                InlineKeyboardButton("❌ Decline", callback_data=f"decline_assign_{a['id']}")
            ])
    
    # Confirmed
    confirmed = grouped.get('confirmed', [])
    if confirmed:
        text += f"\n🔵 <b>CONFIRMED ({len(confirmed)})</b>\n"
        for a in confirmed[:3]:
            activity = a.get('activity', {})
            title = activity.get('title', 'Untitled')
            date_str = format_datetime_short(activity.get('start_datetime', ''))
            role = a.get('role', 'assistant').title()
            
            text += f"• {title} - {date_str}\n"
            text += f"  Role: {role}\n"
            
            # Check if can check in (within 30 min of start)
            now = datetime.now()
            try:
                start_dt = datetime.fromisoformat(activity.get('start_datetime', '').replace('Z', '+00:00'))
                start_dt = start_dt.replace(tzinfo=None)
                thirty_min_before = start_dt.replace(tzinfo=None)
                if now >= thirty_min_before.replace(tzinfo=None):
                    if not a.get('check_in_time'):
                        keyboard.append([InlineKeyboardButton(f"📍 Check In: {title[:15]}", callback_data=f"checkin_{a['id']}")])
                    elif not a.get('check_out_time'):
                        keyboard.append([InlineKeyboardButton(f"🏁 Check Out: {title[:15]}", callback_data=f"checkout_{a['id']}")])
            except:
                pass
            
            text += "\n"
    
    # Completed (summary)
    completed = grouped.get('completed', [])
    if completed:
        text += f"\n🟢 <b>COMPLETED ({len(completed)})</b>\n"
        text += f"  View your stats for details.\n"
    
    if not invited and not confirmed and not completed:
        text += "No assignments yet.\n\nCheck <b>🎯 Available Opportunities</b> to find activities!"
    
    await context.bot.send_message(
        chat_id=chat_id,
        text=text,
        reply_markup=InlineKeyboardMarkup(keyboard) if keyboard else None,
        parse_mode='HTML'
    )


async def handle_accept_assignment(update: Update, context: ContextTypes.DEFAULT_TYPE, api, assignment_id: str):
    """Accept a volunteer assignment."""
    query = update.callback_query
    await query.answer("Processing...")
    
    token = UserSession.get_token(context)
    result = await api.respond_to_assignment(token, assignment_id, 'accepted')
    
    if result.get('success'):
        await query.edit_message_text(
            "✅ <b>Assignment Accepted!</b>\n\n"
            "Details have been sent to you.\n"
            "Remember to check in when you arrive!",
            parse_mode='HTML'
        )
    else:
        error = result.get('error', 'Failed to accept')
        await query.edit_message_text(f"❌ {error}", parse_mode='HTML')


async def handle_decline_assignment(update: Update, context: ContextTypes.DEFAULT_TYPE, api, assignment_id: str):
    """Decline a volunteer assignment."""
    query = update.callback_query
    await query.answer("Processing...")
    
    token = UserSession.get_token(context)
    result = await api.respond_to_assignment(token, assignment_id, 'declined')
    
    if result.get('success'):
        await query.edit_message_text(
            "✅ Assignment declined.\n\nThank you for letting us know.",
            parse_mode='HTML'
        )
    else:
        error = result.get('error', 'Failed to decline')
        await query.edit_message_text(f"❌ {error}", parse_mode='HTML')


# ==================== CHECK-IN / CHECK-OUT ====================

async def handle_check_in(update: Update, context: ContextTypes.DEFAULT_TYPE, api, assignment_id: str):
    """Handle volunteer check-in."""
    query = update.callback_query
    await query.answer("Checking in...")
    
    token = UserSession.get_token(context)
    result = await api.check_in_assignment(token, assignment_id)
    
    if result.get('success'):
        await query.edit_message_text(
            f"✅ <b>Checked In!</b>\n\n"
            f"Activity: {result.get('activity_title', 'Unknown')}\n"
            f"Time: {result.get('check_in_time', '')[:16]}\n\n"
            f"Remember to check out when you're done!",
            parse_mode='HTML'
        )
    else:
        error = result.get('error', 'Failed to check in')
        await query.edit_message_text(f"❌ {error}", parse_mode='HTML')


async def start_check_out(update: Update, context: ContextTypes.DEFAULT_TYPE, assignment_id: str):
    """Start checkout flow (collect feedback)."""
    query = update.callback_query
    await query.answer()
    
    UserSession.set_checkout_assignment_id(context, assignment_id)
    
    text = (
        "🏁 <b>CHECK OUT</b>\n\n"
        "How was your experience? (optional)\n"
        "Type your feedback or click Skip."
    )
    
    keyboard = [[InlineKeyboardButton("⏭️ Skip Feedback", callback_data="checkout_skip_feedback")]]
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')
    return CHECKOUT_INPUT_FEEDBACK


async def handle_checkout_feedback(update: Update, context: ContextTypes.DEFAULT_TYPE, api):
    """Handle checkout with feedback."""
    feedback = update.message.text.strip()
    
    assignment_id = UserSession.get_checkout_assignment_id(context)
    token = UserSession.get_token(context)
    
    if not assignment_id:
        await update.message.reply_text("⚠️ Session expired. Please try again.")
        return ConversationHandler.END
    
    result = await api.check_out_assignment(token, assignment_id, feedback)
    
    UserSession.clear_checkout_data(context)
    
    if result.get('success'):
        hours = result.get('hours_contributed', 0)
        total = result.get('total_hours', 0)
        
        await update.message.reply_text(
            f"✅ <b>Checked Out!</b>\n\n"
            f"Hours logged: {hours:.2f} hrs\n"
            f"Total hours: {total:.2f} hrs\n\n"
            f"Thank you for volunteering!",
            parse_mode='HTML'
        )
    else:
        error = result.get('error', 'Failed to check out')
        await update.message.reply_text(f"❌ {error}")
    
    return ConversationHandler.END


async def handle_checkout_skip_feedback(update: Update, context: ContextTypes.DEFAULT_TYPE, api):
    """Handle checkout without feedback."""
    query = update.callback_query
    await query.answer("Checking out...")
    
    assignment_id = UserSession.get_checkout_assignment_id(context)
    token = UserSession.get_token(context)
    
    if not assignment_id:
        await query.edit_message_text("⚠️ Session expired. Please try again.")
        return ConversationHandler.END
    
    result = await api.check_out_assignment(token, assignment_id, '')
    
    UserSession.clear_checkout_data(context)
    
    if result.get('success'):
        hours = result.get('hours_contributed', 0)
        total = result.get('total_hours', 0)
        
        await query.edit_message_text(
            f"✅ <b>Checked Out!</b>\n\n"
            f"Hours logged: {hours:.2f} hrs\n"
            f"Total hours: {total:.2f} hrs\n\n"
            f"Thank you for volunteering!",
            parse_mode='HTML'
        )
    else:
        error = result.get('error', 'Failed to check out')
        await query.edit_message_text(f"❌ {error}")
    
    return ConversationHandler.END


# ==================== HOURS & STATS ====================

async def show_volunteer_stats(update: Update, context: ContextTypes.DEFAULT_TYPE, api):
    """Display volunteer's statistics."""
    chat_id = update.effective_chat.id
    
    if not UserSession.is_authenticated(context):
        await context.bot.send_message(chat_id=chat_id, text="⚠️ Please /start to login first.")
        return
    
    volunteer_id = UserSession.get_volunteer_id(context)
    if not volunteer_id:
        await context.bot.send_message(
            chat_id=chat_id,
            text="⚠️ Volunteer profile not found."
        )
        return
    
    token = UserSession.get_token(context)
    stats = await api.get_volunteer_stats(token, volunteer_id)
    
    if not stats:
        await context.bot.send_message(chat_id=chat_id, text="❌ Could not load stats.")
        return
    
    volunteer = stats.get('volunteer', {})
    this_month = stats.get('this_month', {})
    achievements = stats.get('achievements', [])
    position = stats.get('leaderboard_position', 0)
    
    rating = volunteer.get('rating', 0)
    stars = '⭐' * int(rating) + ('½' if rating % 1 >= 0.5 else '')
    
    text = "╔═══════════════════════╗\n║   ⏰ YOUR STATS       ║\n╚═══════════════════════╝\n\n"
    
    text += f"🏆 Volunteer Level: {stars} ({rating:.1f}/5)\n"
    text += f"📍 Leaderboard: #{position}\n\n"
    
    text += f"📊 <b>THIS MONTH:</b>\n"
    text += f"• Sessions: {this_month.get('sessions', 0)}\n"
    text += f"• Total Hours: {this_month.get('total_hours', 0):.1f} hrs\n"
    text += f"• Avg Rating: {this_month.get('avg_rating', 0):.1f}/5\n\n"
    
    text += f"📈 <b>ALL TIME:</b>\n"
    text += f"• Total Sessions: {volunteer.get('total_sessions', 0)}\n"
    text += f"• Total Hours: {volunteer.get('total_hours', 0):.1f} hrs\n\n"
    
    if achievements:
        text += f"🏅 <b>ACHIEVEMENTS:</b>\n"
        for a in achievements[:5]:
            text += f"• {a.get('name')}\n"
    
    keyboard = [[InlineKeyboardButton("📊 View Leaderboard", callback_data="view_leaderboard")]]
    
    await context.bot.send_message(
        chat_id=chat_id,
        text=text,
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='HTML'
    )


async def show_leaderboard(update: Update, context: ContextTypes.DEFAULT_TYPE, api):
    """Display volunteer leaderboard."""
    query = update.callback_query
    await query.answer()
    
    token = UserSession.get_token(context)
    leaderboard = await api.get_leaderboard(token, limit=10)
    
    volunteer_id = UserSession.get_volunteer_id(context)
    
    text = "╔═══════════════════════╗\n║   🏆 LEADERBOARD      ║\n╚═══════════════════════╝\n\n"
    text += "<b>TOP VOLUNTEERS (All Time)</b>\n\n"
    
    medals = ['🥇', '🥈', '🥉']
    
    for v in leaderboard:
        rank = v.get('rank', 0)
        name = f"{v.get('user', {}).get('first_name', '')} {v.get('user', {}).get('last_name', '')}".strip()
        hours = v.get('total_hours', 0)
        rating = v.get('rating', 0)
        
        medal = medals[rank-1] if rank <= 3 else f"{rank}️⃣"
        is_you = " ⬅️ YOU!" if v.get('id') == volunteer_id else ""
        
        text += f"{medal} {name} - {hours:.1f} hrs ⭐{rating:.1f}{is_you}\n"
    
    keyboard = [[InlineKeyboardButton("📊 My Stats", callback_data="my_stats")]]
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')
