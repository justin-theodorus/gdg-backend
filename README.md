# CareConnect Hub - Backend API

A RESTful API for managing activity registration for community care programs. Built with Next.js 14 and Supabase.

## Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Activity Management**: Create, update, and manage activities with programs
- **Booking System**: Smart booking with automatic conflict detection
- **Waitlist Management**: Automatic FIFO waitlist processing
- **Volunteer Matching**: Intelligent volunteer-activity matching algorithm
- **Analytics Dashboard**: Real-time metrics and insights

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT with bcrypt
- **Validation**: Zod
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd careconnect-hub
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Update `.env.local` with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
```

5. Run the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3000/api`

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |

### Programs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/programs` | List programs |
| POST | `/api/programs` | Create program (staff) |
| GET | `/api/programs/:id` | Get program |
| PUT | `/api/programs/:id` | Update program (staff) |
| DELETE | `/api/programs/:id` | Delete program (staff) |

### Activities
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/activities` | List activities with filters |
| POST | `/api/activities` | Create activity (staff) |
| GET | `/api/activities/:id` | Get activity details |
| PUT | `/api/activities/:id` | Update activity (staff) |
| POST | `/api/activities/:id/cancel` | Cancel activity (staff) |
| GET | `/api/activities/:id/find-volunteers` | Find matched volunteers |

### Bookings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bookings` | List bookings |
| POST | `/api/bookings` | Create booking |
| GET | `/api/bookings/:id` | Get booking |
| PUT | `/api/bookings/:id/cancel` | Cancel booking |
| POST | `/api/bookings/conflicts` | Check conflicts |

### Waitlist
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/waitlist/participant/:id` | Get participant waitlist |
| GET | `/api/waitlist/activity/:id` | Get activity waitlist (staff) |
| POST | `/api/waitlist/:id/accept` | Accept waitlist offer |
| POST | `/api/waitlist/:id/decline` | Decline waitlist offer |

### Volunteers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/volunteers` | List volunteers |
| POST | `/api/volunteers` | Create volunteer profile |
| GET | `/api/volunteers/:id` | Get volunteer |
| PUT | `/api/volunteers/:id` | Update volunteer |
| GET | `/api/volunteers/leaderboard` | Get leaderboard |

### Volunteer Assignments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/volunteer-assignments` | Create assignment (staff) |
| PUT | `/api/volunteer-assignments/:id/respond` | Accept/decline |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/dashboard` | Dashboard stats (staff) |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/system/health` | Health check |

## User Roles

- **participant**: Can view activities, create bookings
- **caregiver**: Can manage linked participants
- **volunteer**: Can view and respond to assignments
- **staff**: Full access to all features

## Demo Scenarios

### 1. Activity Creation
```bash
# Login as staff
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "staff@example.com", "password": "password123"}'

# Create activity
curl -X POST http://localhost:3000/api/activities \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Art Therapy",
    "start_datetime": "2026-01-20T14:00:00Z",
    "end_datetime": "2026-01-20T15:30:00Z",
    "capacity": 10,
    "location": "Room A"
  }'
```

### 2. Booking with Conflict Detection
```bash
# Create booking - will detect conflicts automatically
curl -X POST http://localhost:3000/api/bookings \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_id": "<activity-id>",
    "participant_id": "<participant-id>"
  }'
```

### 3. Waitlist Flow
- When activity is full, new bookings automatically join waitlist
- When someone cancels, next person in waitlist is notified
- They have 2 hours to accept the offer

### 4. Volunteer Matching
```bash
# Find volunteers for activity
curl http://localhost:3000/api/activities/<id>/find-volunteers \
  -H "Authorization: Bearer <token>"
```

### 5. Analytics Dashboard
```bash
curl http://localhost:3000/api/analytics/dashboard?days=30 \
  -H "Authorization: Bearer <token>"
```

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

## License

MIT
