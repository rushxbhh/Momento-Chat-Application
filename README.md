# Momento-Chat-Application
# 💬 Momento - Ephemeral Chat Application

<div align="center">

![Momento Logo](https://img.shields.io/badge/Momento-Chat-ff4655?style=for-the-badge&logo=chat&logoColor=white)

**A private, self-destructing chat room application with no accounts, no history, just secure conversations.**

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.1-brightgreen?style=flat-square&logo=spring)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-18.2-blue?style=flat-square&logo=react)](https://reactjs.org/)
[![Redis](https://img.shields.io/badge/Redis-7.0-red?style=flat-square&logo=redis)](https://redis.io/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Enabled-orange?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

[Features](#-features) • [Demo](#-demo) • [Installation](#-installation) • [Usage](#-usage) • [Architecture](#-architecture) • [API](#-api-documentation) • [Contributing](#-contributing)

</div>

---

## 📖 About

Momento is a real-time ephemeral chat application designed for privacy-focused conversations. Messages and rooms automatically self-destruct after a configurable time period (1-60 minutes), leaving no trace. Built with modern web technologies and enterprise-grade scalability.

### 🎯 Key Highlights

- **Zero Persistence**: No message history, no user accounts
- **Self-Destructing Rooms**: Auto-expire after set duration
- **Real-time Communication**: WebSocket-based instant messaging
- **Anonymous**: Auto-generated usernames for privacy
- **Scalable**: Redis-backed, supports horizontal scaling
- **Production Ready**: Docker support, Redis TTL, auto-cleanup

---

## ✨ Features

### Core Features
- 🔥 **Ephemeral Rooms** - Create temporary chat rooms (1-60 min)
- 💬 **Real-time Messaging** - Instant message delivery via WebSocket
- 👤 **Anonymous Chat** - No registration, auto-generated usernames
- ⏱️ **Live Countdown** - Real-time timer showing room expiration
- 🔒 **Privacy First** - No data storage, messages vanish on expiry
- 😊 **Emoji Support** - Built-in emoji picker
- 📎 **File Sharing** - Attach images and videos (frontend ready)

### Technical Features
- ⚡ **Redis Integration** - Persistent storage with auto-expiry (TTL)
- 🚀 **Horizontal Scaling** - Multiple server instances supported
- 🧹 **Auto-cleanup** - Rooms destroyed when all users leave
- 🔄 **Crash Recovery** - Rooms persist across server restarts
- 📊 **Session Tracking** - Active user count per room
- 🎨 **Modern UI** - Beautiful dark theme with glassmorphism

---

## 🎬 Demo

### Create Room
![Create Room](https://via.placeholder.com/800x400?text=Create+Room+Screenshot)

### Chat Interface
![Chat Interface](https://via.placeholder.com/800x400?text=Chat+Interface+Screenshot)

### Features Showcase
![Features](https://via.placeholder.com/800x400?text=Features+Screenshot)

> **Live Demo**: [momento-demo.example.com](https://momento-demo.example.com) *(Add your deployed link)*

---

## 🏗️ Architecture

```
┌─────────────┐         WebSocket          ┌──────────────┐
│   React     │◄──────────────────────────►│ Spring Boot  │
│  Frontend   │         REST API           │   Backend    │
└─────────────┘                            └──────────────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │    Redis     │
                                            │  (Sessions)  │
                                            └──────────────┘
```

### Tech Stack

#### Backend
- **Framework**: Spring Boot 3.2.1
- **Language**: Java 21
- **WebSocket**: Native Spring WebSocket
- **Database**: Redis (for session storage)
- **Build Tool**: Maven

#### Frontend
- **Framework**: React 18.2
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Hooks
- **HTTP Client**: Fetch API
- **WebSocket**: Native WebSocket API

---

## 🚀 Installation

### Prerequisites

- **Java 17+** ([Download](https://adoptium.net/))
- **Node.js 16+** ([Download](https://nodejs.org/))
- **Redis 6+** ([Download](https://redis.io/download))
- **Maven 3.6+** (or use included `mvnw`)

### Quick Start

#### 1️⃣ Clone Repository
```bash
git clone https://github.com/yourusername/momento.git
cd momento
```

#### 2️⃣ Start Redis
```bash
# Option A: Docker (Recommended)
docker run -d -p 6379:6379 --name momento-redis redis:alpine

# Option B: Local Installation
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis-server
```

#### 3️⃣ Backend Setup
```bash
cd backend

# Install dependencies and build
./mvnw clean install

# Run application
./mvnw spring-boot:run
```

Backend runs on `http://localhost:8080`

#### 4️⃣ Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs on `http://localhost:3000`

#### 5️⃣ Open Application
Visit `http://localhost:3000` in your browser

---

## 📝 Usage

### Creating a Room

1. Open the application
2. Adjust the room duration slider (1-60 minutes)
3. Click **"CREATE NEW ROOM"**
4. Share the generated Room ID with others
5. Click **"ENTER ROOM"** to start chatting

### Joining a Room

1. Get a Room ID from someone
2. Enter the Room ID in the **"Join Room"** section
3. Click **"JOIN ROOM"**
4. Click **"ENTER CHAT"** to join the conversation

### Chatting

- Type your message in the input box
- Press **Enter** or click **"Send"**
- Use emoji picker (😊) for emojis
- Attach files using the 📎 button
- Monitor the countdown timer for room expiry

---

## ⚙️ Configuration

### Backend Configuration

**`application.properties`**
```properties
# Server Configuration
server.port=8080

# Redis Configuration
spring.data.redis.host=${REDIS_HOST:localhost}
spring.data.redis.port=${REDIS_PORT:6379}
spring.data.redis.password=${REDIS_PASSWORD:}
spring.data.redis.timeout=60000

# Logging
logging.level.com.rushabh.Vartalaap=INFO
```

### Frontend Configuration

**`.env`**
```env
# Development
VITE_API_URL=/api
VITE_WS_URL=ws://localhost:3000/ws

# Production
VITE_API_URL=https://your-api.com
VITE_WS_URL=wss://your-api.com/ws
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis server hostname | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |
| `REDIS_PASSWORD` | Redis password (if any) | `` |
| `PORT` | Backend server port | `8080` |

---

## 📚 API Documentation

### REST Endpoints

#### Create Room
```http
POST /api/rooms/create
Content-Type: application/json

{
  "expiryMinutes": 10
}

Response:
{
  "roomId": "abc12345",
  "status": "active",
  "expiresAt": "2026-01-15T13:00:00",
  "remainingSeconds": 600
}
```

#### Get Room Info
```http
GET /api/rooms/{roomId}

Response:
{
  "roomId": "abc12345",
  "status": "active",
  "expiresAt": "2026-01-15T13:00:00",
  "remainingSeconds": 450
}
```

### WebSocket Protocol

#### Connect
```
ws://localhost:8080/ws
```

#### Join Room
```json
{
  "type": "JOIN",
  "roomId": "abc12345",
  "sender": "anonymous-happy-fox-x7k2",
  "content": "User joined"
}
```

#### Send Message
```json
{
  "type": "CHAT",
  "roomId": "abc12345",
  "sender": "anonymous-happy-fox-x7k2",
  "content": "Hello everyone!",
  "timestamp": "2026-01-15T12:30:00"
}
```

#### Leave Room
```json
{
  "type": "LEAVE",
  "roomId": "abc12345",
  "sender": "anonymous-happy-fox-x7k2",
  "content": "User left"
}
```

---

## 🐳 Docker Deployment

### Using Docker Compose

**`docker-compose.yml`**
```yaml
version: '3.8'

services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  backend:
    build: ./backend
    ports:
      - "8080:8080"
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      redis:
        condition: service_healthy

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  redis-data:
```

### Run with Docker Compose
```bash
docker-compose up -d
```

---

## 🌐 Production Deployment

### Deploy to Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

### Deploy to Render

1. Connect your GitHub repository
2. Add Redis database (free tier available)
3. Configure environment variables
4. Deploy!

### Deploy to Heroku

```bash
# Create app
heroku create momento-app

# Add Redis
heroku addons:create heroku-redis:mini

# Deploy
git push heroku main
```

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
./mvnw test
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Manual Testing Checklist

- [ ] Create room with default duration
- [ ] Create room with custom duration (1 min, 30 min, 60 min)
- [ ] Join room with valid Room ID
- [ ] Join room with invalid Room ID (should fail)
- [ ] Send messages between multiple users
- [ ] Test emoji picker
- [ ] Test file attachment (UI)
- [ ] Leave room and verify notification
- [ ] Wait for room expiry (use 1 min for testing)
- [ ] Verify room auto-cleanup when all users leave
- [ ] Test server restart (Redis persistence)
- [ ] Test multi-tab support

---

## 🛠️ Development

### Project Structure

```
momento/
├── backend/
│   ├── src/main/java/com/rushabh/Vartalaap/
│   │   ├── config/
│   │   │   ├── RedisConfig.java
│   │   │   └── SimpleWebSocketConfig.java
│   │   ├── controller/
│   │   │   └── RoomController.java
│   │   ├── listener/
│   │   │   └── ChatWebSocketHandler.java
│   │   ├── model/
│   │   │   ├── ChatMessage.java
│   │   │   ├── ChatRoom.java
│   │   │   ├── CreateRoomRequest.java
│   │   │   └── RoomResponse.java
│   │   ├── service/
│   │   │   └── ChatRoomService.java
│   │   └── MomentoApplication.java
│   ├── src/main/resources/
│   │   └── application.properties
│   └── pom.xml
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── public/
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── docker-compose.yml
└── README.md
```

### Adding New Features

1. **Fork** the repository
2. Create a **feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit** changes: `git commit -m 'Add amazing feature'`
4. **Push** to branch: `git push origin feature/amazing-feature`
5. Open a **Pull Request**

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Check existing issues or create a new one
2. Fork the repository
3. Create your feature branch
4. Write clean, documented code
5. Add tests for new features
6. Ensure all tests pass
7. Submit a pull request

### Code Style

- **Backend**: Follow Java naming conventions, use Lombok
- **Frontend**: Use React hooks, functional components
- **Commits**: Use conventional commits (feat, fix, docs, etc.)

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Rushabh Singh Baghel**

- GitHub: [@rushabhsinghbaghel](https://github.com/rushabhsinghbaghel)
- LinkedIn: [Rushabh Singh](https://linkedin.com/in/yourprofile)
- Email: your.email@example.com

---

## 🙏 Acknowledgments

- [Spring Boot](https://spring.io/projects/spring-boot) - Backend framework
- [React](https://reactjs.org/) - Frontend library
- [Redis](https://redis.io/) - In-memory data store
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Lucide Icons](https://lucide.dev/) - Icon library

---

## 📊 Project Stats

![GitHub stars](https://img.shields.io/github/stars/yourusername/momento?style=social)
![GitHub forks](https://img.shields.io/github/forks/yourusername/momento?style=social)
![GitHub issues](https://img.shields.io/github/issues/yourusername/momento)
![GitHub pull requests](https://img.shields.io/github/issues-pr/yourusername/momento)

---

## 🗺️ Roadmap

- [x] Basic chat functionality
- [x] Redis integration
- [x] Auto-cleanup on empty rooms
- [x] Custom expiry time
- [x] Emoji support
- [ ] End-to-end encryption
- [ ] File upload to cloud storage
- [ ] Multiple room support per user
- [ ] Room password protection
- [ ] Message reactions
- [ ] Typing indicators
- [ ] Read receipts
- [ ] Mobile app (React Native)

---

## ❓ FAQ

**Q: Are messages encrypted?**  
A: Currently, messages are transmitted over WebSocket. For production, use WSS (WebSocket Secure). E2E encryption is planned.

**Q: Can I recover a deleted room?**  
A: No, once a room expires or all users leave, it's permanently deleted.

**Q: How many users can join a room?**  
A: Currently unlimited. You can add rate limiting if needed.

**Q: Does it work offline?**  
A: No, real-time chat requires active internet connection.

**Q: Can I self-host?**  
A: Yes! Follow the installation guide and deploy to your own server.

---

<div align="center">

Made with ❤️ by Rushabh Singh Baghel

**[⬆ Back to Top](#-momento---ephemeral-chat-application)**

</div>