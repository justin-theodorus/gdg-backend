"""
CareConnect Hub Telegram Bot
Integrated with the backend API for activity registration.
Supports: Participants, Caregivers, and Volunteers
"""
import os
import sys
import logging
import base64

# Configure logging
logger = logging.getLogger(__name__)
import dateparser
from datetime import datetime, timedelta
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, KeyboardButton
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler, MessageHandler, CallbackQueryHandler, filters, ConversationHandler
from google.oauth2 import service_account
from googleapiclient.discovery import build

# Add bot directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Local imports
from config import (
    TELEGRAM_TOKEN, ADMIN_TELEGRAM_ID, BACKEND_API_URL,
    SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_CALENDAR_ID,
    SERVICE_ACCOUNT_FILE, INPUT_EMAIL, INPUT_PASSWORD, INPUT_CARE_NAME, UPLOAD_POSTER,
    INPUT_VOLUNTEER_INTERESTS, INPUT_VOLUNTEER_SKILLS, INPUT_VOLUNTEER_AVAILABILITY,
    RATING_SELECT_STARS, RATING_INPUT_FEEDBACK, CHECKOUT_INPUT_FEEDBACK,
    INPUT_PARTICIPANT_EMAIL,
    validate_config
)
from api_client import CareConnectAPI
from session import UserSession

# Handler imports
from handlers.participant_handlers import (
    show_my_bookings, show_booking_details, confirm_cancel_booking, do_cancel_booking,
    show_waitlist_status, handle_waitlist_accept, handle_waitlist_decline,
    start_rating_flow, handle_rating_selection, handle_rating_feedback, handle_rating_skip_feedback
)
from handlers.caregiver_handlers import (
    show_care_recipients, start_add_recipient, handle_participant_email_input,
    cancel_add_recipient, view_participant_schedule, start_register_for_participant,
    confirm_register_for_participant, show_all_bookings, back_to_recipients
)
from handlers.volunteer_handlers import (
    start_volunteer_registration, toggle_interest, interests_done,
    toggle_skill, skills_done, set_availability, complete_volunteer_registration,
    show_available_opportunities, show_volunteer_activity_details, express_interest,
    show_my_assignments, handle_accept_assignment, handle_decline_assignment,
    handle_check_in, start_check_out, handle_checkout_feedback, handle_checkout_skip_feedback,
    show_volunteer_stats, show_leaderboard
)

# ================= 1. CONFIGURATION =================

# Validate configuration on startup
validate_config()

# Path Setup
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Initialize API Client
api = CareConnectAPI(
    base_url=BACKEND_API_URL,
    supabase_url=SUPABASE_URL,
    supabase_key=SUPABASE_ANON_KEY
)

# Google Calendar Setup (kept for calendar sync)
SCOPES = ['https://www.googleapis.com/auth/calendar']
calendar_service = None

try:
    service_account_path = os.path.join(BASE_DIR, SERVICE_ACCOUNT_FILE)
    if os.path.exists(service_account_path):
        creds = service_account.Credentials.from_service_account_file(service_account_path, scopes=SCOPES)
        calendar_service = build('calendar', 'v3', credentials=creds)
        logging.info("✅ Google Calendar service initialized")
    else:
        logging.warning("⚠️ Service account file not found, Google Calendar sync disabled")
except Exception as e:
    logging.warning(f"⚠️ Google Calendar setup failed: {e}")

logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)

# ================= 2. ROLE-BASED MENUS =================

def get_participant_menu():
    """Get keyboard for participants."""
    return ReplyKeyboardMarkup([
        [KeyboardButton("📅 Browse Events")],
        [KeyboardButton("📋 My Bookings"), KeyboardButton("⏰ Waitlist")],
        [KeyboardButton("👤 My Profile"), KeyboardButton("❓ Help")]
    ], resize_keyboard=True)

def get_caregiver_menu():
    """Get keyboard for caregivers."""
    return ReplyKeyboardMarkup([
        [KeyboardButton("👥 My Care Recipients")],
        [KeyboardButton("📅 Browse Events"), KeyboardButton("📋 All Bookings")],
        [KeyboardButton("👤 My Profile"), KeyboardButton("❓ Help")]
    ], resize_keyboard=True)

def get_volunteer_menu():
    """Get keyboard for volunteers."""
    return ReplyKeyboardMarkup([
        [KeyboardButton("🎯 Available Opportunities")],
        [KeyboardButton("📋 My Assignments"), KeyboardButton("⏰ Hours & Stats")],
        [KeyboardButton("👤 My Profile"), KeyboardButton("❓ Help")]
    ], resize_keyboard=True)

def get_admin_menu():
    """Get keyboard for admin."""
    return ReplyKeyboardMarkup([
        [KeyboardButton("📤 Upload Poster"), KeyboardButton("📊 View Stats")]
    ], resize_keyboard=True)

# ================= 3. GOOGLE CALENDAR HELPERS =================

def create_google_calendar_event(event_data: dict) -> str | None:
    """Creates event on Master Calendar."""
    if not calendar_service:
        logging.warning("Calendar service not available")
        return None
    
    date_str = event_data.get('datetime', '')
    dt = dateparser.parse(date_str, settings={'PREFER_DATES_FROM': 'future', 'DATE_ORDER': 'DMY'})
    
    if not dt:
        dt = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=1)

    start_time = dt.isoformat()
    end_time = (dt + timedelta(hours=2)).isoformat()

    event_body = {
        'summary': event_data['name'],
        'location': event_data.get('location', ''),
        'description': event_data.get('summary', ''),
        'start': {'dateTime': start_time, 'timeZone': 'Asia/Singapore'},
        'end': {'dateTime': end_time, 'timeZone': 'Asia/Singapore'},
        'guestsCanInviteOthers': False
    }

    try:
        event = calendar_service.events().insert(calendarId=GOOGLE_CALENDAR_ID, body=event_body).execute()
        return event['id']
    except Exception as e:
        logging.error(f"Calendar create error: {e}")
        return None

def add_attendee_to_event(google_event_id: str, user_email: str) -> bool:
    """Adds user to Google Calendar event."""
    if not calendar_service:
        return False
    
    try:
        event = calendar_service.events().get(calendarId=GOOGLE_CALENDAR_ID, eventId=google_event_id).execute()
        attendees = event.get('attendees', [])
        
        # Check if already in list to avoid duplicates
        if any(a.get('email') == user_email for a in attendees):
            return True
            
        attendees.append({'email': user_email})
        
        calendar_service.events().patch(
            calendarId=GOOGLE_CALENDAR_ID, eventId=google_event_id,
            body={'attendees': attendees}, sendUpdates='all'
        ).execute()
        return True
    except Exception as e:
        logging.error(f"Calendar Add Error: {e}")
        return False

# ================= 4. MAIN MENU & HANDLERS =================

async def show_main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Sends the Persistent Bottom Menu based on user state and role."""
    user = update.effective_user
    chat_id = update.effective_chat.id

    # Clean up inline keyboard if clicked
    if update.callback_query:
        await update.callback_query.answer()
    
    # 1. ADMIN MENU
    if user.id == int(ADMIN_TELEGRAM_ID):
        await context.bot.send_message(
            chat_id=chat_id,
            text="👑 <b>Admin Dashboard</b>",
            reply_markup=get_admin_menu(),
            parse_mode='HTML'
        )
        return ConversationHandler.END

    # 2. Try to login with Telegram ID via API
    result = await api.login_with_telegram(str(user.id))
    
    if result.get('found') and result.get('user'):
        # User exists - store session and show role-based menu
        UserSession.login(context, result['user'], result['token'])
        
        role = result['user'].get('role', 'participant')
        name = result['user'].get('first_name', 'there')
        
        # Select menu based on role
        if role == 'volunteer':
            markup = get_volunteer_menu()
        elif role == 'caregiver':
            markup = get_caregiver_menu()
        else:  # participant or default
            markup = get_participant_menu()
        
        await context.bot.send_message(
            chat_id=chat_id,
            text=f"👋 <b>Welcome back, {name}!</b>",
            reply_markup=markup,
            parse_mode='HTML'
        )
        return ConversationHandler.END
    
    # 3. NEW USER - Show registration options
    keyboard = [
        [InlineKeyboardButton("🏃 I am a Participant", callback_data="role_participant")],
        [InlineKeyboardButton("🤝 I am a Caregiver", callback_data="role_caregiver")],
        [InlineKeyboardButton("🙋 I am a Volunteer", callback_data="role_volunteer")]
    ]
    await context.bot.send_message(
        chat_id=chat_id,
        text="👋 <b>Welcome to CareConnect Hub!</b>\n\nWho are you?",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='HTML'
    )
    return ConversationHandler.END

# --- TRAFFIC CONTROLLER ---

async def handle_menu_clicks(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle bottom menu button clicks."""
    text = update.message.text
    
    # Participant/Common menus
    if text == "📅 Browse Events":
        await browse_events(update, context)
    elif text == "📋 My Bookings":
        await show_my_bookings(update, context, api)
    elif text == "⏰ Waitlist":
        await show_waitlist_status(update, context, api)
    elif text == "👤 My Profile":
        await show_profile(update, context)
    elif text == "❓ Help":
        await show_help(update, context)
    
    # Caregiver menus
    elif text == "👥 My Care Recipients":
        await show_care_recipients(update, context, api)
    elif text == "📋 All Bookings":
        await show_all_bookings(update, context, api)
    
    # Volunteer menus
    elif text == "🎯 Available Opportunities":
        await show_available_opportunities(update, context, api)
    elif text == "📋 My Assignments":
        await show_my_assignments(update, context, api)
    elif text == "⏰ Hours & Stats":
        await show_volunteer_stats(update, context, api)
    
    # Admin menus
    elif text == "📤 Upload Poster":
        return await admin_start_upload(update, context)
    elif text == "📊 View Stats":
        await show_stats(update, context)

async def show_profile(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show user profile."""
    if not UserSession.is_authenticated(context):
        await update.message.reply_text("⚠️ Not logged in. Type /start to register.")
        return
    
    user = UserSession.get_user(context)
    name = UserSession.get_name(context)
    email = user.get('email', 'Not set')
    role = user.get('role', 'Unknown').title()
    
    text = (
        f"👤 <b>Your Profile</b>\n\n"
        f"<b>Name:</b> {name}\n"
        f"<b>Email:</b> {email}\n"
        f"<b>Role:</b> {role}"
    )
    
    # Add role-specific info
    if role.lower() == 'volunteer':
        volunteer_id = user.get('volunteer_id')
        if volunteer_id:
            stats = await api.get_volunteer_stats(UserSession.get_token(context), volunteer_id)
            if stats:
                v = stats.get('volunteer', {})
                text += f"\n\n📊 <b>Volunteer Stats</b>\n"
                text += f"• Total Hours: {v.get('total_hours', 0):.1f}\n"
                text += f"• Sessions: {v.get('total_sessions', 0)}\n"
                text += f"• Rating: {'⭐' * int(v.get('rating', 0))} ({v.get('rating', 0):.1f})"
    
    await update.message.reply_text(text, parse_mode='HTML')

async def show_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show help message based on user role."""
    user = UserSession.get_user(context)
    role = user.get('role', 'participant') if user else 'participant'
    
    if role == 'volunteer':
        text = (
            "❓ <b>Volunteer Help</b>\n\n"
            "• <b>🎯 Available Opportunities</b> - Find activities that need volunteers\n"
            "• <b>📋 My Assignments</b> - View and manage your assignments\n"
            "• <b>⏰ Hours & Stats</b> - Track your contribution\n\n"
            "When assigned:\n"
            "1. Accept or decline the invitation\n"
            "2. Check in when you arrive (30 min before)\n"
            "3. Check out when done\n\n"
            "Need help? Contact the admin."
        )
    elif role == 'caregiver':
        text = (
            "❓ <b>Caregiver Help</b>\n\n"
            "• <b>👥 My Care Recipients</b> - Manage linked participants\n"
            "• <b>📅 Browse Events</b> - Find activities\n"
            "• <b>📋 All Bookings</b> - View all schedules\n\n"
            "To register someone:\n"
            "1. Go to Care Recipients\n"
            "2. Select a participant\n"
            "3. Click 'Register' and choose an event\n\n"
            "Need help? Contact the admin."
        )
    else:
        text = (
            "❓ <b>Help</b>\n\n"
            "• <b>📅 Browse Events</b> - See upcoming activities\n"
            "• <b>📋 My Bookings</b> - View your registrations\n"
            "• <b>⏰ Waitlist</b> - Check waitlist status\n\n"
            "To join an event:\n"
            "1. Browse events\n"
            "2. Click on an event\n"
            "3. Click 'Join This Event'\n\n"
            "Need help? Contact the admin."
        )
    
    await update.message.reply_text(text, parse_mode='HTML')

async def show_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show dashboard stats (admin only)."""
    if update.effective_user.id != ADMIN_TELEGRAM_ID:
        return
    
    token = UserSession.get_token(context)
    if not token:
        result = await api.login_with_telegram(str(update.effective_user.id))
        if result.get('found'):
            UserSession.login(context, result['user'], result['token'])
            token = result['token']
    
    if token:
        stats = await api.get_dashboard_stats(token)
        if stats:
            await update.message.reply_text(
                f"📊 <b>Dashboard Stats</b>\n\n"
                f"📝 Total Registrations: {stats.get('total_registrations', 0)}\n"
                f"👥 Unique Participants: {stats.get('unique_participants', 0)}\n"
                f"🙋 Active Volunteers: {stats.get('active_volunteers', 0)}\n"
                f"⭐ Avg Satisfaction: {stats.get('average_satisfaction', 0):.1f}\n"
                f"📅 Total Activities: {stats.get('total_activities', 0)}",
                parse_mode='HTML'
            )
            return
    
    await update.message.reply_text("📊 <b>Stats:</b> Unable to fetch stats.", parse_mode='HTML')

# --- REGISTRATION ---

async def start_registration(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start the registration flow."""
    query = update.callback_query
    await query.answer()
    
    role_map = {
        "role_participant": "participant",
        "role_caregiver": "caregiver",
        "role_volunteer": "volunteer"
    }
    role = role_map.get(query.data, "participant")
    UserSession.set_registration_data(context, 'role', role)
    
    role_display = role.title()
    await query.edit_message_text(
        f"✅ Selected: <b>{role_display}</b>\n\n"
        f"📧 Please enter your <b>email address</b>:",
        parse_mode='HTML'
    )
    return INPUT_EMAIL

async def save_email(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Save email and ask for password."""
    email = update.message.text.strip()
    
    if "@" not in email or "." not in email:
        await update.message.reply_text("⚠️ Invalid email format. Please try again:")
        return INPUT_EMAIL
    
    UserSession.set_registration_data(context, 'email', email)
    
    await update.message.reply_text(
        "🔐 Create a <b>password</b> (at least 8 characters):",
        parse_mode='HTML'
    )
    return INPUT_PASSWORD

async def save_password(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Save password and proceed based on role."""
    password = update.message.text.strip()
    
    if len(password) < 8:
        await update.message.reply_text("⚠️ Password must be at least 8 characters. Try again:")
        return INPUT_PASSWORD
    
    UserSession.set_registration_data(context, 'password', password)
    
    role = UserSession.get_registration_data(context, 'role')
    
    if role == "caregiver":
        await update.message.reply_text(
            "🤝 Who are you caring for? (Enter their name):",
            parse_mode='HTML'
        )
        return INPUT_CARE_NAME
    
    # Complete registration for participant
    return await complete_registration(update, context)

async def save_caregiver_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Save caregiver's care recipient name and complete registration."""
    care_name = update.message.text.strip()
    UserSession.set_registration_data(context, 'care_for', care_name)
    
    return await complete_registration(update, context)

async def complete_registration(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Complete the registration by calling the API."""
    user = update.effective_user
    
    email = UserSession.get_registration_data(context, 'email')
    password = UserSession.get_registration_data(context, 'password')
    role = UserSession.get_registration_data(context, 'role')
    
    msg = await update.message.reply_text("⏳ Creating your account...")
    
    result = await api.register_with_telegram(
        telegram_id=str(user.id),
        email=email,
        password=password,
        first_name=user.first_name or 'User',
        last_name=user.last_name or '',
        role=role
    )
    
    if result.get('success'):
        UserSession.login(context, result['user'], result['token'])
        UserSession.clear_registration_data(context)
        
        await msg.edit_text("✅ <b>Registration Complete!</b>\n\nYou can now use the menu below.", parse_mode='HTML')
        await show_main_menu(update, context)
        return ConversationHandler.END
    
    error_msg = result.get('error', 'Registration failed')
    await msg.edit_text(f"❌ <b>Registration Failed</b>\n\n{error_msg}", parse_mode='HTML')
    return ConversationHandler.END

# --- EVENT BROWSING ---

async def browse_events(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Browse upcoming events from the API."""
    chat_id = update.effective_chat.id
    
    if not UserSession.is_authenticated(context):
        await context.bot.send_message(chat_id=chat_id, text="⚠️ Please /start to login first.")
        return
    
    token = UserSession.get_token(context)
    activities = await api.get_activities(token, limit=10, has_availability=False)
    
    if not activities:
        await context.bot.send_message(chat_id=chat_id, text="🚫 No upcoming events at the moment.")
        return
    
    keyboard = []
    for activity in activities:
        # Format date nicely
        start_dt = activity.get('start_datetime', '')
        try:
            dt = datetime.fromisoformat(start_dt.replace('Z', '+00:00'))
            date_str = dt.strftime('%d %b %H:%M')
        except:
            date_str = start_dt[:16] if start_dt else 'TBA'
        
        title = activity.get('title', 'Untitled')
        spots = activity.get('capacity', 0) - activity.get('current_bookings', 0)
        spot_text = f"🟢 {spots} spots" if spots > 0 else "🔴 Full"
        
        btn_text = f"👉 {title} ({date_str}) {spot_text}"
        callback = f"activity_{activity['id']}"
        keyboard.append([InlineKeyboardButton(btn_text, callback_data=callback)])
    
    await context.bot.send_message(
        chat_id=chat_id,
        text="📅 <b>Upcoming Events</b>\n\nClick an event to see details and join:",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='HTML'
    )

async def show_activity_details(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show activity details and join button."""
    query = update.callback_query
    await query.answer()
    
    activity_id = query.data.replace('activity_', '')
    
    if not UserSession.is_authenticated(context):
        await query.edit_message_text("⚠️ Please /start to login first.")
        return
    
    token = UserSession.get_token(context)
    activity = await api.get_activity(token, activity_id)
    
    if not activity:
        await query.edit_message_text("❌ Activity not found.")
        return
    
    # Format details
    title = activity.get('title', 'Untitled')
    description = activity.get('description', 'No description')
    location = activity.get('location', 'TBA')
    
    start_dt = activity.get('start_datetime', '')
    try:
        dt = datetime.fromisoformat(start_dt.replace('Z', '+00:00'))
        date_str = dt.strftime('%A, %d %B %Y at %H:%M')
    except:
        date_str = start_dt
    
    capacity = activity.get('capacity', 0)
    current = activity.get('current_bookings', 0)
    available = capacity - current
    
    text = (
        f"📌 <b>{title}</b>\n\n"
        f"📝 {description}\n\n"
        f"📅 {date_str}\n"
        f"📍 {location}\n"
        f"👥 Spots: {current}/{capacity}"
    )
    
    if available > 0:
        text += f" ({available} available)"
    else:
        text += " (Waitlist available)"
    
    keyboard = [
        [InlineKeyboardButton("✅ Join This Event", callback_data=f"join_{activity_id}")],
        [InlineKeyboardButton("◀️ Back to Events", callback_data="back_to_events")]
    ]
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')

async def handle_back_to_events(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle back button to return to events list."""
    query = update.callback_query
    await query.answer()
    
    if not UserSession.is_authenticated(context):
        await query.edit_message_text("⚠️ Please /start to login first.")
        return
    
    token = UserSession.get_token(context)
    activities = await api.get_activities(token, limit=10, has_availability=False)
    
    if not activities:
        await query.edit_message_text("🚫 No upcoming events at the moment.")
        return
    
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
        spot_text = f"🟢 {spots} spots" if spots > 0 else "🔴 Full"
        
        btn_text = f"👉 {title} ({date_str}) {spot_text}"
        callback = f"activity_{activity['id']}"
        keyboard.append([InlineKeyboardButton(btn_text, callback_data=callback)])
    
    await query.edit_message_text(
        "📅 <b>Upcoming Events</b>\n\nClick an event to see details and join:",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='HTML'
    )

# --- JOIN HANDLER ---

async def join_event_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle joining an event."""
    query = update.callback_query
    await query.answer()
    
    activity_id = query.data.replace('join_', '')
    chat_id = update.effective_chat.id
    
    if not UserSession.is_authenticated(context):
        await context.bot.send_message(
            chat_id=chat_id,
            text="⚠️ <b>Error:</b> Please /start to register first.",
            parse_mode='HTML'
        )
        return
    
    token = UserSession.get_token(context)
    role = UserSession.get_role(context)
    participant_id = UserSession.get_participant_id(context)
    
    # Handle caregivers - show list of care recipients to register
    if role == 'caregiver':
        caregiver_id = UserSession.get_caregiver_id(context)
        if caregiver_id:
            participants = await api.get_caregiver_participants(token, caregiver_id)
            
            if not participants:
                await context.bot.send_message(
                    chat_id=chat_id,
                    text="⚠️ <b>No Care Recipients Linked</b>\n\nPlease add a care recipient first from '👥 My Care Recipients'.",
                    parse_mode='HTML'
                )
                return
            
            # Store activity_id and participants in session (to avoid callback_data length limit)
            print(f"DEBUG join_event: Storing activity_id={activity_id} from query.data={query.data}")
            context.user_data['pending_join_activity'] = activity_id
            
            # Build participants map with validation
            participants_map = {}
            for i, p in enumerate(participants):
                pid = p.get('id')
                if pid:
                    participants_map[str(i)] = pid
                    print(f"DEBUG join_event: Participant {i}: id={pid}, name={p.get('user', {}).get('first_name')}")
                else:
                    print(f"DEBUG join_event: WARNING - Participant {i} has no ID: {p}")
            
            context.user_data['pending_join_participants'] = participants_map
            print(f"DEBUG join_event: Final participants_map={participants_map}")
            
            # Show selection of care recipients
            keyboard = []
            for i, p in enumerate(participants):
                user_info = p.get('user', {})
                name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip() or 'Unknown'
                # Use index-based callback - full IDs stored in session
                keyboard.append([InlineKeyboardButton(
                    f"👵 Register {name}",
                    callback_data=f"cg_join_{i}"
                )])
            
            keyboard.append([InlineKeyboardButton("❌ Cancel", callback_data="cancel_cg_join")])
            
            await context.bot.send_message(
                chat_id=chat_id,
                text="👥 <b>Select Care Recipient</b>\n\nWho would you like to register for this event?",
                reply_markup=InlineKeyboardMarkup(keyboard),
                parse_mode='HTML'
            )
            return
    
    if not participant_id:
        await context.bot.send_message(
            chat_id=chat_id,
            text="⚠️ <b>Error:</b> Only participants and caregivers can join events. Please register as a participant.",
            parse_mode='HTML'
        )
        return
    
    # Create booking via API
    msg = await context.bot.send_message(chat_id=chat_id, text="⏳ Processing your registration...")
    
    result = await api.create_booking(token, activity_id, participant_id)
    
    if result.get('success'):
        status = result.get('status', 'confirmed')
        
        if status == 'waitlisted':
            position = result.get('waitlist_position', '?')
            await msg.edit_text(
                f"📋 <b>Added to Waitlist</b>\n\n"
                f"The event is currently full. You are #{position} on the waitlist.\n"
                f"We'll notify you if a spot opens up!",
                parse_mode='HTML'
            )
        else:
            # Get activity details for calendar sync
            activity = await api.get_activity(token, activity_id)
            
            # Try to add to Google Calendar
            calendar_synced = False
            if activity and activity.get('google_calendar_event_id'):
                email = UserSession.get_email(context)
                if email:
                    calendar_synced = add_attendee_to_event(activity['google_calendar_event_id'], email)
            
            calendar_msg = "\n\n📅 Check your Google Calendar!" if calendar_synced else ""
            
            await msg.edit_text(
                f"✅ <b>Confirmed!</b>\n\n"
                f"You're registered for this event.{calendar_msg}",
                parse_mode='HTML'
            )
    else:
        error_code = result.get('error_code', '')
        error_msg = result.get('error', 'Registration failed')
        
        if error_code == 'BOOKING_CONFLICT':
            conflict = result.get('conflicting_activity', {})
            conflict_title = conflict.get('title', 'another event')
            
            alternatives = result.get('alternatives', [])
            alt_text = ""
            if alternatives:
                alt_text = "\n\n<b>Alternatives:</b>\n"
                for alt in alternatives[:3]:
                    alt_text += f"• {alt.get('title')}\n"
            
            await msg.edit_text(
                f"⚠️ <b>Time Conflict</b>\n\n"
                f"You're already registered for \"{conflict_title}\" at this time.{alt_text}",
                parse_mode='HTML'
            )
        elif error_code == 'ALREADY_REGISTERED':
            await msg.edit_text(
                "ℹ️ <b>Already Registered</b>\n\nYou're already registered for this event!",
                parse_mode='HTML'
            )
        else:
            await msg.edit_text(f"❌ <b>Registration Failed</b>\n\n{error_msg}", parse_mode='HTML')


async def handle_caregiver_join(update: Update, context: ContextTypes.DEFAULT_TYPE, api, participant_id: str, activity_id: str):
    """Handle caregiver registering a care recipient for an event."""
    query = update.callback_query
    await query.answer("Processing...")
    
    token = UserSession.get_token(context)
    
    # Debug logging
    logger.info(f"handle_caregiver_join: participant_id={participant_id} (type={type(participant_id)})")
    logger.info(f"handle_caregiver_join: activity_id={activity_id} (type={type(activity_id)})")
    
    # Get activity details for confirmation message
    activity = await api.get_activity(token, activity_id)
    if not activity:
        await context.bot.send_message(
            chat_id=update.effective_chat.id,
            text="❌ Activity not found.",
            parse_mode='HTML'
        )
        return
    
    # Create booking for the care recipient
    print(f"DEBUG handle_caregiver_join: CALLING API with activity_id={activity_id}, participant_id={participant_id}")
    result = await api.create_booking(token, activity_id, participant_id)
    print(f"DEBUG handle_caregiver_join: API result={result}")
    
    title = activity.get('title', 'Event')
    
    if result.get('success'):
        status = result.get('status', 'confirmed')
        
        if status == 'waitlisted':
            position = result.get('waitlist_position', '?')
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text=(
                    f"📋 <b>Added to Waitlist</b>\n\n"
                    f"Activity: {title}\n"
                    f"Position: #{position}\n\n"
                    f"You'll be notified if a spot opens up for your care recipient."
                ),
                parse_mode='HTML'
            )
        else:
            # Try to add to Google Calendar
            calendar_synced = False
            if activity.get('google_calendar_event_id'):
                # Get participant's email for calendar
                participants = await api.get_caregiver_participants(token, UserSession.get_caregiver_id(context))
                for p in participants or []:
                    if p.get('id') == participant_id:
                        p_email = p.get('user', {}).get('email')
                        if p_email:
                            calendar_synced = add_attendee_to_event(activity['google_calendar_event_id'], p_email)
                        break
            
            calendar_msg = "\n\n📅 Added to their Google Calendar!" if calendar_synced else ""
            
            # Format datetime
            start_dt = activity.get('start_datetime', '')
            try:
                dt = datetime.fromisoformat(start_dt.replace('Z', '+00:00'))
                date_str = dt.strftime('%A, %d %B %Y at %H:%M')
            except:
                date_str = start_dt[:16] if start_dt else 'TBA'
            
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text=(
                    f"✅ <b>Registration Confirmed!</b>\n\n"
                    f"Your care recipient has been registered for:\n"
                    f"📌 {title}\n"
                    f"📅 {date_str}\n"
                    f"📍 {activity.get('location', 'TBA')}{calendar_msg}"
                ),
                parse_mode='HTML'
            )
    else:
        error_code = result.get('error_code', '')
        error_msg = result.get('error', 'Registration failed')
        
        if error_code == 'BOOKING_CONFLICT':
            conflict = result.get('conflicting_activity', {})
            conflict_title = conflict.get('title', 'another event')
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text=(
                    f"⚠️ <b>Time Conflict</b>\n\n"
                    f"Your care recipient is already registered for \"{conflict_title}\" at this time."
                ),
                parse_mode='HTML'
            )
        elif error_code == 'ALREADY_REGISTERED':
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text="ℹ️ <b>Already Registered</b>\n\nYour care recipient is already registered for this event!",
                parse_mode='HTML'
            )
        else:
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text=f"❌ <b>Registration Failed</b>\n\n{error_msg}",
                parse_mode='HTML'
            )


# --- CALLBACK QUERY ROUTER ---

async def handle_callback_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Route callback queries to appropriate handlers."""
    query = update.callback_query
    data = query.data
    
    # Participant handlers
    if data == "show_my_bookings" or data == "back_to_bookings":
        await query.answer()
        await show_my_bookings(update, context, api)
    elif data.startswith("booking_details_"):
        booking_id = data.replace("booking_details_", "")
        await show_booking_details(update, context, api, booking_id)
    elif data.startswith("confirm_cancel_"):
        booking_id = data.replace("confirm_cancel_", "")
        await confirm_cancel_booking(update, context, booking_id)
    elif data.startswith("do_cancel_"):
        booking_id = data.replace("do_cancel_", "")
        await do_cancel_booking(update, context, api, booking_id)
    elif data.startswith("cancel_booking_"):
        booking_id = data.replace("cancel_booking_", "")
        await confirm_cancel_booking(update, context, booking_id)
    
    # Waitlist handlers
    elif data.startswith("accept_waitlist_"):
        waitlist_id = data.replace("accept_waitlist_", "")
        await handle_waitlist_accept(update, context, api, waitlist_id)
    elif data.startswith("decline_waitlist_"):
        waitlist_id = data.replace("decline_waitlist_", "")
        await handle_waitlist_decline(update, context, api, waitlist_id)
    
    # Rating handlers
    elif data.startswith("rate_booking_"):
        booking_id = data.replace("rate_booking_", "")
        await start_rating_flow(update, context, booking_id)
    elif data.startswith("rating_") and not data.startswith("rating_skip"):
        await handle_rating_selection(update, context)
    elif data == "rating_skip_feedback":
        await handle_rating_skip_feedback(update, context, api)
    
    # Caregiver handlers
    elif data == "back_to_recipients":
        await back_to_recipients(update, context, api)
    elif data == "add_recipient":
        return await start_add_recipient(update, context)
    elif data == "cancel_add_recipient":
        return await cancel_add_recipient(update, context)
    elif data.startswith("view_schedule_"):
        participant_id = data.replace("view_schedule_", "")
        await view_participant_schedule(update, context, api, participant_id)
    elif data.startswith("register_for_"):
        participant_id = data.replace("register_for_", "")
        await start_register_for_participant(update, context, api, participant_id)
    elif data.startswith("register_activity_"):
        activity_id = data.replace("register_activity_", "")
        await confirm_register_for_participant(update, context, api, activity_id)
    elif data.startswith("cg_join_"):
        # Format: cg_join_{index} - participant_id and activity_id stored in session
        index = data.replace("cg_join_", "")
        activity_id = context.user_data.get('pending_join_activity')
        participants_map = context.user_data.get('pending_join_participants', {})
        participant_id = participants_map.get(index)
        
        # Debug logging (using print for visibility)
        print(f"DEBUG cg_join: index={index}")
        print(f"DEBUG cg_join: activity_id={activity_id} (type={type(activity_id).__name__})")
        print(f"DEBUG cg_join: participant_id={participant_id} (type={type(participant_id).__name__ if participant_id else 'None'})")
        print(f"DEBUG cg_join: participants_map={participants_map}")
        print(f"DEBUG cg_join: all user_data keys={list(context.user_data.keys())}")
        
        if activity_id and participant_id:
            await handle_caregiver_join(update, context, api, participant_id, activity_id)
            # Clean up session
            context.user_data.pop('pending_join_activity', None)
            context.user_data.pop('pending_join_participants', None)
        else:
            await query.answer("Session expired. Please try again.", show_alert=True)
    elif data == "cancel_cg_join":
        # Clean up session and go back
        activity_id = context.user_data.pop('pending_join_activity', None)
        context.user_data.pop('pending_join_participants', None)
        await query.answer()
        if activity_id:
            # Redirect back to activity details
            query.data = f"activity_{activity_id}"
            await show_activity_details(update, context)
    
    # Volunteer handlers
    elif data.startswith("vol_activity_"):
        activity_id = data.replace("vol_activity_", "")
        await show_volunteer_activity_details(update, context, api, activity_id)
    elif data.startswith("vol_interested_"):
        activity_id = data.replace("vol_interested_", "")
        await express_interest(update, context, activity_id)
    elif data == "back_to_opportunities":
        await query.answer()
        await show_available_opportunities(update, context, api)
    elif data.startswith("accept_assign_"):
        assignment_id = data.replace("accept_assign_", "")
        await handle_accept_assignment(update, context, api, assignment_id)
    elif data.startswith("decline_assign_"):
        assignment_id = data.replace("decline_assign_", "")
        await handle_decline_assignment(update, context, api, assignment_id)
    elif data.startswith("checkin_"):
        assignment_id = data.replace("checkin_", "")
        await handle_check_in(update, context, api, assignment_id)
    elif data.startswith("checkout_"):
        assignment_id = data.replace("checkout_", "")
        return await start_check_out(update, context, assignment_id)
    elif data == "checkout_skip_feedback":
        return await handle_checkout_skip_feedback(update, context, api)
    elif data == "view_leaderboard":
        await show_leaderboard(update, context, api)
    elif data == "my_stats":
        await query.answer()
        await show_volunteer_stats(update, context, api)

# --- ADMIN UPLOAD & BROADCAST ---

async def admin_start_upload(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start poster upload flow (admin only)."""
    chat_id = update.effective_chat.id
    
    if update.effective_user.id != ADMIN_TELEGRAM_ID:
        return ConversationHandler.END
    
    if update.callback_query:
        await update.callback_query.answer()
    
    await context.bot.send_message(
        chat_id=chat_id,
        text="📤 <b>Upload Mode</b>\n\nSend me the event poster image.",
        parse_mode='HTML'
    )
    return UPLOAD_POSTER

async def handle_poster(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Process poster image with AI extraction."""
    user = update.effective_user
    if user.id != ADMIN_TELEGRAM_ID:
        return ConversationHandler.END
    
    msg = await update.message.reply_text("🤖 <b>AI is reading the poster...</b>", parse_mode='HTML')
    
    # Save file ID for broadcasting later
    photo_file_id = update.message.photo[-1].file_id
    UserSession.set_poster_id(context, photo_file_id)
    
    # Download photo
    photo_file = await update.message.photo[-1].get_file()
    file_path = os.path.join(BASE_DIR, "poster.jpg")
    await photo_file.download_to_drive(file_path)
    
    # Read and encode image
    with open(file_path, 'rb') as f:
        image_base64 = base64.b64encode(f.read()).decode('utf-8')
    
    # Call Edge Function for extraction
    result = await api.extract_poster(image_base64)
    
    if not result.get('success') and not result.get('name'):
        if 'name' in result:
            data = result
        else:
            await msg.edit_text(f"❌ <b>Extraction Failed</b>\n\n{result.get('error', 'Unknown error')}", parse_mode='HTML')
            return ConversationHandler.END
    else:
        data = result
    
    UserSession.set_draft(context, data)
    
    text = (
        f"<b>Confirm Event Details:</b>\n\n"
        f"📌 <b>{data.get('name', 'Untitled')}</b>\n"
        f"🕒 {data.get('datetime', 'TBA')}\n"
        f"📍 {data.get('location', 'TBA')}\n\n"
        f"📝 {data.get('summary', 'No description')}"
    )
    
    buttons = [
        [InlineKeyboardButton("✅ Create & Broadcast", callback_data="confirm_post")],
        [InlineKeyboardButton("❌ Cancel", callback_data="cancel_post")]
    ]
    
    await msg.edit_text(text, parse_mode='HTML', reply_markup=InlineKeyboardMarkup(buttons))
    return UPLOAD_POSTER

async def admin_confirm_post(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Confirm and create the event, then broadcast."""
    query = update.callback_query
    await query.answer()
    chat_id = update.effective_chat.id
    
    if query.data == "cancel_post":
        UserSession.clear_draft(context)
        await context.bot.send_message(chat_id=chat_id, text="❌ Cancelled.")
        await show_main_menu(update, context)
        return ConversationHandler.END
    
    data = UserSession.get_draft(context)
    poster_id = UserSession.get_poster_id(context)
    
    if not data:
        await context.bot.send_message(chat_id=chat_id, text="❌ No draft data found.")
        return ConversationHandler.END
    
    await context.bot.send_message(chat_id=chat_id, text="⏳ Creating event and broadcasting...")
    
    try:
        # 1. Create Google Calendar event
        g_id = create_google_calendar_event(data)
        
        # 2. Parse datetime for API
        date_str = data.get('datetime', '')
        dt = dateparser.parse(date_str, settings={'PREFER_DATES_FROM': 'future', 'DATE_ORDER': 'DMY'})
        if not dt:
            dt = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=1)
        
        start_datetime = dt.isoformat()
        end_datetime = (dt + timedelta(hours=2)).isoformat()
        
        # 3. Create activity via API
        admin_result = await api.login_with_telegram(str(ADMIN_TELEGRAM_ID))
        if admin_result.get('found'):
            token = admin_result['token']
            
            activity_data = {
                'title': data.get('name', 'Untitled Event'),
                'description': data.get('summary', ''),
                'start_datetime': start_datetime,
                'end_datetime': end_datetime,
                'location': data.get('location', 'TBA'),
                'capacity': 50,
                'google_calendar_event_id': g_id,
            }
            
            api_result = await api.create_activity(token, activity_data)

            if api_result.get('success'):
                activity = api_result.get('activity') or {}
                activity_id = activity.get('id')
                
                # 4. Broadcast to all users with telegram_id
                users = await api.get_all_users_with_telegram(token)
                
                broadcast_caption = (
                    f"🎉 <b>NEW EVENT: {data.get('name')}</b>\n\n"
                    f"📅 {data.get('datetime')}\n"
                    f"📍 {data.get('location')}\n\n"
                    f"{data.get('summary', '')}\n\n"
                    f"👇 <b>Click below to Join!</b>"
                )
                
                join_btn = [[InlineKeyboardButton("🙋 Join Now", callback_data=f"activity_{activity_id}")]]
                
                count = 0
                for user_row in users:
                    telegram_id = user_row.get('telegram_id')
                    if telegram_id and telegram_id != str(ADMIN_TELEGRAM_ID):
                        try:
                            if poster_id:
                                await context.bot.send_photo(
                                    chat_id=telegram_id,
                                    photo=poster_id,
                                    caption=broadcast_caption,
                                    reply_markup=InlineKeyboardMarkup(join_btn),
                                    parse_mode='HTML'
                                )
                            else:
                                await context.bot.send_message(
                                    chat_id=telegram_id,
                                    text=broadcast_caption,
                                    reply_markup=InlineKeyboardMarkup(join_btn),
                                    parse_mode='HTML'
                                )
                            count += 1
                        except Exception as e:
                            logging.warning(f"Failed to send to {telegram_id}: {e}")
                
                await context.bot.send_message(
                    chat_id=ADMIN_TELEGRAM_ID,
                    text=f"✅ <b>Event Live!</b>\n\nBroadcast sent to {count} users.",
                    parse_mode='HTML'
                )
            else:
                await context.bot.send_message(
                    chat_id=ADMIN_TELEGRAM_ID,
                    text=f"❌ API Error: {api_result.get('error', 'Unknown error')}"
                )
        else:
            await context.bot.send_message(
                chat_id=ADMIN_TELEGRAM_ID,
                text="❌ Admin not registered in backend. Please register first."
            )
        
        UserSession.clear_draft(context)
        await show_main_menu(update, context)
        
    except Exception as e:
        logging.error(f"Error in confirm_post: {e}")
        await context.bot.send_message(chat_id=ADMIN_TELEGRAM_ID, text=f"❌ Error: {e}")
    
    return ConversationHandler.END

# ================= 5. MAIN =================

if __name__ == '__main__':
    app = ApplicationBuilder().token(TELEGRAM_TOKEN).build()
    
    # Registration conversation handler
    reg_handler = ConversationHandler(
        entry_points=[CallbackQueryHandler(start_registration, pattern="^role_")],
        states={
            INPUT_EMAIL: [MessageHandler(filters.TEXT & ~filters.COMMAND, save_email)],
            INPUT_PASSWORD: [MessageHandler(filters.TEXT & ~filters.COMMAND, save_password)],
            INPUT_CARE_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, save_caregiver_name)]
        },
        fallbacks=[CommandHandler("start", show_main_menu)]
    )
    
    # Admin upload conversation handler
    upload_handler = ConversationHandler(
        entry_points=[
            MessageHandler(filters.Regex("^📤 Upload Poster$"), admin_start_upload),
            CallbackQueryHandler(admin_start_upload, pattern="^admin_upload")
        ],
        states={
            UPLOAD_POSTER: [
                MessageHandler(filters.PHOTO, handle_poster),
                CallbackQueryHandler(admin_confirm_post, pattern="^(confirm_post|cancel_post)$")
            ]
        },
        fallbacks=[CommandHandler("start", show_main_menu)]
    )
    
    # Rating conversation handler
    rating_handler = ConversationHandler(
        entry_points=[CallbackQueryHandler(start_rating_flow, pattern="^rate_booking_")],
        states={
            RATING_SELECT_STARS: [CallbackQueryHandler(handle_rating_selection, pattern="^rating_[1-5]$")],
            RATING_INPUT_FEEDBACK: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, lambda u, c: handle_rating_feedback(u, c, api)),
                CallbackQueryHandler(lambda u, c: handle_rating_skip_feedback(u, c, api), pattern="^rating_skip_feedback$")
            ]
        },
        fallbacks=[CommandHandler("start", show_main_menu)]
    )
    
    # Caregiver add recipient handler
    caregiver_handler = ConversationHandler(
        entry_points=[CallbackQueryHandler(start_add_recipient, pattern="^add_recipient$")],
        states={
            INPUT_PARTICIPANT_EMAIL: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, lambda u, c: handle_participant_email_input(u, c, api)),
                CallbackQueryHandler(cancel_add_recipient, pattern="^cancel_add_recipient$")
            ]
        },
        fallbacks=[CommandHandler("start", show_main_menu)]
    )
    
    # Volunteer registration handler
    volunteer_reg_handler = ConversationHandler(
        entry_points=[CallbackQueryHandler(start_volunteer_registration, pattern="^complete_volunteer_profile$")],
        states={
            INPUT_VOLUNTEER_INTERESTS: [
                CallbackQueryHandler(toggle_interest, pattern="^toggle_interest_"),
                CallbackQueryHandler(interests_done, pattern="^interests_done$")
            ],
            INPUT_VOLUNTEER_SKILLS: [
                CallbackQueryHandler(toggle_skill, pattern="^toggle_skill_"),
                CallbackQueryHandler(skills_done, pattern="^skills_done$")
            ],
            INPUT_VOLUNTEER_AVAILABILITY: [
                CallbackQueryHandler(set_availability, pattern="^avail_"),
                CallbackQueryHandler(lambda u, c: complete_volunteer_registration(u, c, api), pattern="^complete_volunteer_reg$")
            ]
        },
        fallbacks=[CommandHandler("start", show_main_menu)]
    )
    
    # Checkout conversation handler
    checkout_handler = ConversationHandler(
        entry_points=[CallbackQueryHandler(start_check_out, pattern="^checkout_(?!skip)")],
        states={
            CHECKOUT_INPUT_FEEDBACK: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, lambda u, c: handle_checkout_feedback(u, c, api)),
                CallbackQueryHandler(lambda u, c: handle_checkout_skip_feedback(u, c, api), pattern="^checkout_skip_feedback$")
            ]
        },
        fallbacks=[CommandHandler("start", show_main_menu)]
    )
    
    # Add handlers (order matters - more specific first)
    app.add_handler(reg_handler)
    app.add_handler(upload_handler)
    app.add_handler(rating_handler)
    app.add_handler(caregiver_handler)
    app.add_handler(volunteer_reg_handler)
    app.add_handler(checkout_handler)
    
    app.add_handler(CommandHandler("start", show_main_menu))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_menu_clicks))
    
    # Callback query handlers
    app.add_handler(CallbackQueryHandler(show_activity_details, pattern="^activity_"))
    app.add_handler(CallbackQueryHandler(join_event_callback, pattern="^join_"))
    app.add_handler(CallbackQueryHandler(handle_back_to_events, pattern="^back_to_events$"))
    app.add_handler(CallbackQueryHandler(handle_callback_query))  # Catch-all for other callbacks
    
    print("🚀 CareConnect Hub Bot is running...")
    print(f"📡 Backend API: {BACKEND_API_URL}")
    print(f"👑 Admin ID: {ADMIN_TELEGRAM_ID}")
    print("✨ Features: Participants, Caregivers, Volunteers")
    app.run_polling(drop_pending_updates=True)
