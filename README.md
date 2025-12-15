<div align="center">
  <img src="https://cdn.raven.cmp27.space/light-raven.png" alt="Raven Logo" width="150" height="150">

# Raven Backend

  **Caw Your Thoughts**

  A scalable, production-ready RESTful API backend for the Raven social media platform.

  [![NestJS](https://img.shields.io/badge/NestJS-11.0-E0234E?logo=nestjs)](https://nestjs.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
  [![Prisma](https://img.shields.io/badge/Prisma-6.17-2D3748?logo=prisma)](https://www.prisma.io/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?logo=postgresql)](https://www.postgresql.org/)
</div>

## Features

### Authentication & Security

- **Email/Password Authentication** - Secure sign-up and sign-in with bcrypt password hashing
- **OAuth Integration** - Google and GitHub OAuth 2.0 authentication support
- **JWT Token Management** - Access and refresh token flow with secure token storage
- **Session Management** - Track active sessions with device fingerprinting and IP logging
- **Multi-Device Support** - Register and manage multiple devices per user
- **Password Recovery** - Forgot password flow with email-based reset tokens
- **reCAPTCHA** - Google reCAPTCHA integration for bot protection
- **Rate Limiting** - Global throttling to prevent abuse

### Tweets & Posts

- **Tweet Creation** - Rich text posts with support for:
  - Hashtag detection and parsing
  - User mention detection and parsing
  - Up to 4 media attachments per tweet (images, videos, GIFs)
- **Reply Threads** - Nested conversation threads with root tweet tracking
- **Quote Tweets** - Retweet with commentary
- **Retweets** - Share tweets with followers
- **Likes** - Like/unlike functionality with optimized count tracking
- **Tweet Deletion** - Soft delete with cascade handling
- **Content Classification** - AI-powered tweet categorization (News, Sports, Entertainment)

### Direct Messaging

- **Real-time Chat** - WebSocket-powered instant messaging via Socket.IO
- **Conversation Management** - Create and manage one-on-one conversations
- **Message Features**:
  - Text messages with entity parsing
  - Image attachments
  - Emoji reactions (sender and receiver)
  - Message deletion (per-participant)
  - Read receipts via last seen tracking
- **WebSocket Scaling** - Redis adapter for horizontal scaling

### Timeline & Feed

- **Home Timeline** - Personalized feed with posts from followed users
- **Real-time Updates** - Server-Sent Events (SSE) for live feed updates
- **Cursor-based Pagination** - Efficient infinite scrolling implementation
- **For You Feed** - Algorithmic content discovery based on user interests

### Explore & Discovery

- **Trending Topics** - Real-time trending hashtags and keywords
- **Category-based Trending** - Trending content by category (News, Sports, Entertainment, General)
- **Explore Feed** - Curated content discovery

### Search

- **Full-text Search** - PostgreSQL full-text search capabilities
- **User Search** - Find users by username or display name
- **Tweet Search** - Search tweets by content
- **Hashtag Search** - Search by hashtag keywords

### User Management

- **Profile Customization** - Display name, bio, location, website
- **Profile Images** - Avatar and banner image upload
- **Following/Followers** - Social graph management with counter caching
- **Block System** - Block users with bidirectional visibility prevention
- **Mute System** - Mute users to hide their content
- **User Interests** - Personalization based on selected interests

### Notifications

- **Push Notifications** - Firebase Cloud Messaging (FCM) integration
- **In-App Notifications** - Real-time notification feed via SSE
- **Notification Types**:
  - Follow notifications
  - Like notifications
  - Retweet notifications
  - Quote notifications
  - Reply notifications
  - Mention notifications
  - Direct message notifications
- **Notification Aggregation** - Group similar notifications
- **Delivery Tracking** - Track notification delivery status to devices

### Media

- **File Upload** - Support for image and video uploads
- **S3 Storage** - AWS S3 compatible object storage
- **Image Processing** - Sharp-based image optimization and resizing
- **Media Association** - Attach media to tweets and messages

### AI Features

- **Tweet Classification** - Groq-powered content categorization
- **Smart Analysis** - Automated content analysis for trending topics

### Infrastructure

- **Background Jobs** - BullMQ for reliable job processing
- **Event-Driven Architecture** - NestJS Event Emitter for decoupled communication
- **Scheduled Tasks** - Cron-based scheduled jobs
- **Health Checks** - Health endpoint for monitoring
- **Structured Logging** - Winston-based logging with multiple transports

## Tech Stack

### Core

- **NestJS** 11.0 - Progressive Node.js framework
- **TypeScript** 5.7 - Type-safe JavaScript
- **Prisma** 6.17 - Type-safe ORM
- **PostgreSQL** - Primary database with full-text search

### Authentication

- **Passport.js** - Authentication middleware
- **JWT** - Token-based authentication
- **bcrypt** - Password hashing

### Real-time

- **Socket.IO** - WebSocket server for messaging
- **Redis** - Pub/Sub for WebSocket scaling and caching
- **SSE** - Server-Sent Events for live updates

### Storage & Media

- **AWS S3** - Object storage for media files
- **Sharp** - High-performance image processing

### Background Processing

- **BullMQ** - Redis-based job queue
- **Node Schedule** - Cron-like job scheduling

### External Services

- **Firebase Admin** - Push notification delivery
- **Nodemailer** - Email sending
- **Google Auth Library** - OAuth verification
- **Groq SDK** - AI-powered content analysis

### Testing

- **Jest** - Unit and integration testing
- **SuperTest** - HTTP assertion library
- **Jest Mock Extended** - Enhanced mocking utilities

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm
- PostgreSQL 15+
- Redis 7+

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/OmarGamal10/raven-backend
   cd raven-backend
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration values.

4. Generate Prisma client:

   ```bash
   pnpm db:generate
   ```

5. Run database migrations:

   ```bash
   pnpm db:migrate
   ```

6. Seed the database (optional):

   ```bash
   pnpm db:seed
   ```

7. Start the development server:

   ```bash
   pnpm dev
   ```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm start` | Start the server |
| `pnpm start:prod` | Start production server |
| `pnpm build` | Build for production |
| `pnpm clean` | Remove build artifacts |
| `pnpm rebuild` | Clean and rebuild |
| `pnpm lint` | Run ESLint with auto-fix |
| `pnpm lint:check` | Run ESLint without fix |
| `pnpm format` | Format code with Prettier |
| `pnpm format:check` | Check code formatting |
| `pnpm test` | Run unit tests |
| `pnpm test:cov` | Run tests with coverage |
| `pnpm test:e2e` | Run end-to-end tests |
| `pnpm db:migrate` | Deploy database migrations |
| `pnpm db:create` | Create new migration |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:reset` | Reset database |
| `pnpm db:seed` | Seed database |

## API Documentation

The API specification is available in TypeSpec format under the `api-spec/` directory:

- **Implemented Spec** - Current implemented API endpoints
- **Complete Spec** - Full API specification including planned features

Generate OpenAPI documentation:

```bash
pnpm spec:generate
```

## Docker

Build the Docker image:

```bash
docker build -t raven-backend .
```

Run with Docker Compose (development):

```bash
docker-compose -f docker-compose.dev.yml up
```

## Configuration

### Environment Variables

Key environment variables (see `.env.example` for full list):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret for JWT signing |
| `JWT_REFRESH_SECRET` | Secret for refresh token signing |
| `AWS_ACCESS_KEY_ID` | AWS credentials for S3 |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials for S3 |
| `S3_BUCKET` | S3 bucket name |
| `FIREBASE_PROJECT_ID` | Firebase project for push notifications |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `GROQ_API_KEY` | Groq API key for AI features |
| `SMTP_*` | Email configuration |
| `RECAPTCHA_SECRET_KEY` | reCAPTCHA secret key |

## Code Quality

The project enforces code quality with:

- **ESLint** - Linting with TypeScript rules
- **Prettier** - Code formatting
- **Husky** - Git hooks for pre-commit checks
- **TypeScript** - Strict type checking

## License

This project is licensed under the [MIT License](LICENSE).
