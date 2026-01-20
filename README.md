# CareConnect Hub

> **Empowering Care For The Intelectially Disabled Through Smart Activity Management**

CareConnect Hub is a comprehensive activity management system designed for special needs care centers. It connects participants, caregivers (family members), volunteers, and staff through an intelligent platform that combines a Telegram bot interface with a powerful staff dashboard.

## 🎯 Problem Statement

**Problem Statement by MINDS:** How might we reduce friction in activity sign-ups for both individuals and caregivers, while reducing manual effort for staff in managing and consolidating registration data?

## 🌟 Key Features

### For Participants & Caregivers (Telegram Bot)
- 📱 **No App Required** - Everything happens in Telegram
- 🔍 **Browse Activities** - Search by type, date, and availability
- 📅 **One-Tap Booking** - Simple registration process
- 🚫 **Smart Conflict Detection** - Prevents double-booking with alternative suggestions
- ⏰ **Automatic Reminders** - Get notified before activities
- 📝 **Feedback System** - Rate activities after completion
- 👨‍👩‍👧 **Caregiver Proxy** - Family members can manage bookings remotely

### For Staff (Dashboard)
- 📊 **Real-Time Analytics** - Track registrations, satisfaction, and trends
- 🎯 **Activity Management** - Create, edit, and monitor all activities
- 🤖 **AI Volunteer Matching** - Smart algorithm matches volunteers to activities
- 📋 **Waitlist Automation** - FIFO queue processing with notifications
- ✅ **Check-In System** - Quick participant and volunteer check-in
- 📈 **Reports & Insights** - Attendance trends, popular activities, leaderboards
- 🎨 **Program Organization** - Color-coded activity programs

### For Volunteers
- 🏆 **Gamified Leaderboard** - Compete for top contributor spot
- ⏱️ **Automatic Hour Tracking** - Hours calculated from check-in/out
- ⭐ **Rating System** - Build reputation through quality contributions
- 📬 **Assignment Notifications** - Accept or decline via Telegram

## 🏗️ Architecture

```
┌─────────────────┐
│  Telegram Bot   │  ← Participants, Caregivers, Volunteers
│   (Python)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Next.js API   │  ← RESTful Backend
│   (TypeScript)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Supabase DB   │  ← PostgreSQL + Row-Level Security
│  (PostgreSQL)   │
└─────────────────┘
         ▲
         │
┌─────────────────┐
│ Staff Dashboard │  ← Web UI for Staff
│   (Next.js)     │
└─────────────────┘
```

## 💻 Tech Stack

### Frontend
- **Framework:** Next.js 16 (React 19)
- **Styling:** Tailwind CSS 4
- **UI Components:** Radix UI + shadcn/ui
- **State Management:** Zustand
- **Forms:** React Hook Form + Zod validation
- **Charts:** Recharts
- **Date Handling:** date-fns

### Backend
- **Database:** Supabase (PostgreSQL)
- **Authentication:** JWT with bcrypt
- **API:** Next.js App Router API routes
- **Validation:** Zod schemas

### Bot
- **Platform:** Telegram Bot API
- **Language:** Python (bot directory)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Telegram Bot Token (for bot functionality)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd careconnect-hub
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# JWT
JWT_SECRET=your_jwt_secret_change_in_production
JWT_EXPIRES_IN=7d
```

4. **Seed the database** (for demo/development)
```bash
npm run seed:demo
```

This creates:
- 8 volunteers with varied skills and ratings
- 10 participants with different membership types
- 22 activities including conflicting time slots
- Sample bookings and waitlist entries
- Past activities with feedback for analytics

5. **Run the development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo Credentials

After seeding, you can log in with:

**Staff Account:**
- Email: `staff@careconnect.test`
- Password: `Staff123!`

**Test Participants/Volunteers:**
- Email: `sarah.chen@demo.com` (Volunteer)
- Email: `margaret.tan@demo.com` (Participant)
- Password: `demo1234` (for all demo accounts)

## 📱 Telegram Bot Setup

The Telegram bot is located in the `bot/` directory.

1. **Install Python dependencies**
```bash
cd bot
pip install -r requirements.txt
```

2. **Configure bot environment**
```bash
cp .env.example .env
```

Edit `bot/.env`:
```env
# Telegram Bot Configuration
TELEGRAM_TOKEN=your_telegram_bot_token

# Backend API Configuration
BACKEND_API_URL=http://localhost:3000/api

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. **Run the bot**
```bash
python3 app.py
```

See [bot/README.md](bot/README.md) for detailed bot documentation.

## 📚 Key Concepts

### Smart Conflict Detection
When a participant tries to book an activity that overlaps with an existing booking, the system:
1. Detects the time conflict
2. Returns the conflicting activity details
3. Suggests 3 alternative activities ranked by similarity (matching activity type, tags, and accessibility needs)

### Intelligent Volunteer Matching
The matching algorithm scores volunteers based on:
- **Interest Match (40%)** - Matching activity tags with volunteer interests
- **Rating (25%)** - Volunteer's average rating from past assignments
- **Availability (20%)** - Day/time alignment with volunteer's schedule
- **Experience (15%)** - Total hours contributed

### Automatic Waitlist Management
When an activity reaches capacity:
1. New registrations automatically join the waitlist with position tracking
2. When a spot opens, the next person is notified via Telegram
3. They have 2 hours to accept the offer
4. If expired, the offer automatically moves to the next person

### Role-Based Access Control
Four distinct roles with specific permissions:
- **Participant:** Browse and book activities, submit feedback
- **Caregiver:** Manage bookings for linked participants
- **Volunteer:** View and respond to assignments, track hours
- **Staff:** Full access to dashboard, analytics, and management features

## 🎯 Core API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/telegram` - Telegram-based auth (login/register/link)
- `GET /api/auth/me` - Get current user profile

### Activities
- `GET /api/activities` - List activities with filters
- `POST /api/activities` - Create activity (staff only)
- `GET /api/activities/:id` - Get activity details
- `PUT /api/activities/:id` - Update activity (staff only)
- `POST /api/activities/:id/cancel` - Cancel activity
- `GET /api/activities/:id/find-volunteers` - Get matched volunteers
- `POST /api/activities/:id/clone` - Clone activity as template

### Bookings
- `GET /api/bookings` - List bookings
- `POST /api/bookings` - Create booking with conflict detection
- `POST /api/bookings/conflicts` - Check for conflicts
- `PUT /api/bookings/:id/cancel` - Cancel booking
- `PUT /api/bookings/:id/check-in` - Check in participant
- `POST /api/bookings/:id/feedback` - Submit activity feedback

### Waitlist
- `GET /api/waitlist/participant/:id` - Get user's waitlist entries
- `GET /api/waitlist/activity/:id` - Get activity waitlist (staff)
- `POST /api/waitlist/:id/accept` - Accept waitlist offer
- `POST /api/waitlist/:id/decline` - Decline waitlist offer

### Volunteers
- `GET /api/volunteers` - List volunteers
- `GET /api/volunteers/:id` - Get volunteer profile
- `GET /api/volunteers/leaderboard` - Get leaderboard rankings
- `PUT /api/volunteers/:id` - Update volunteer profile

### Volunteer Assignments
- `POST /api/volunteer-assignments` - Create assignment (staff)
- `PUT /api/volunteer-assignments/:id/respond` - Accept/decline assignment
- `PUT /api/volunteer-assignments/:id/complete` - Mark completed with rating
- `POST /api/volunteer-assignments/:id/remind` - Send reminder

### Analytics
- `GET /api/analytics/dashboard` - Dashboard metrics and insights
- Query parameter: `?days=7|14|30|90`

## 📊 Dashboard Pages

### Staff Dashboard Routes
- `/dashboard` - Overview with metrics and upcoming activities
- `/activities` - Activity management (create, edit, search, filter)
- `/activities/:id` - Activity details with registrations and volunteers
- `/activities/:id/edit` - Edit activity form
- `/activities/:id/check-in` - Check-in interface
- `/activities/calendar` - Calendar view of activities
- `/participants` - Participant directory
- `/volunteers` - Volunteer directory with leaderboard
- `/reports` - Analytics and reports

## 📁 Project Structure

```
careconnect-hub/
├── src/
│   ├── app/
│   │   ├── (auth)/          # Auth pages (login, register)
│   │   ├── (dashboard)/     # Staff dashboard pages
│   │   ├── api/             # API routes
│   │   │   ├── activities/
│   │   │   ├── auth/
│   │   │   ├── bookings/
│   │   │   ├── volunteers/
│   │   │   └── analytics/
│   │   └── layout.tsx
│   ├── components/          # UI components
│   │   └── ui/             # shadcn/ui components
│   ├── lib/                # Utilities
│   │   ├── api-client.ts   # Frontend API client
│   │   ├── auth.ts         # Auth helpers
│   │   ├── supabase.ts     # Database client
│   │   └── validation.ts   # Zod schemas
│   ├── stores/             # Zustand stores
│   └── types/              # TypeScript types
├── bot/                    # Telegram bot
│   ├── app.py             # Main bot application
│   ├── handlers/          # Command handlers
│   └── api_client.py      # API communication
│
└── README.md
```

## 🔒 Security Features

- **JWT Authentication** - Secure token-based auth with 7-day expiry
- **Password Hashing** - bcrypt with salt rounds
- **Row-Level Security** - Database-level access control
- **Role-Based Permissions** - Fine-grained permission checks
- **Input Validation** - Zod schema validation on all inputs
- **SQL Injection Prevention** - Parameterized queries via Supabase


## 🤝 Contributing

This is a hackathon project. Contributions, issues, and feature requests are welcome!


## 🙏 Acknowledgments

Built for NUS GDG Hack4Good with the goal of improving care coordination for those with intelectual disabilities.

---

