# TYPR 🚀

playtypr.com

A competitive typing racing application where users can test their typing skills through various game modes including ranked matchmaking, custom games, and solo practice.

## 🎮 Features

### Game Modes
- **Ranked Mode**: Competitive matchmaking with ELO-based ranking system and divisions
- **Custom Games**: Create private rooms or join via custom codes to race with friends
- **Solo Practice**: Practice typing alone to improve your skills

### Key Features
- **Real-time Multiplayer**: Live typing races with WebSocket connections
- **ELO Ranking System**: Competitive ranking with divisions (Plastic → Silver → Gold → Platinum → Diamond → Cherry MX)
- **Comprehensive Stats**: Track WPM, accuracy, games played, win rate, and more
- **Leaderboards**: Global rankings updated hourly
- **User Authentication**: Secure login with email/password or Google OAuth
- **Responsive Design**: Modern UI built with Tailwind CSS
- **Real-time Updates**: Live progress tracking during races

## 🛠️ Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Router DOM v7** for navigation
- **Socket.IO Client** for real-time communication
- **Firebase SDK** for authentication and database
- **Chart.js** with React Chart.js 2 for statistics visualization
- **Framer Motion** for animations

### Backend
- **Node.js** with TypeScript
- **Express.js** for API routes
- **Socket.IO** for real-time WebSocket connections
- **Redis** for session management and caching
- **Firebase Admin SDK** for server-side Firebase operations

### Database & Services
- **Cloud Firestore** for data storage
- **Firebase Authentication** for user management
- **Firebase Functions** for serverless operations
- **Firebase Hosting** for deployment
- **OpenAI API** for text generation

```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Firebase CLI
- Redis server (for backend)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd typr
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   cd ..
   ```

4. **Install Firebase Functions dependencies**
   ```bash
   cd functions
   npm install
   cd ..
   ```

5. **Set up environment variables**
   
   Create `backend/.env`:
   ```env
   REDIS_HOST=your-redis-host
   REDIS_PORT=your-redis-port
   REDIS_PASSWORD=your-redis-password
   OPENAI_API_KEY=your-openai-api-key
   FRONTEND_URL=http://localhost:5173
   ```

   Create `frontend/.env` (if needed):
   ```env
   VITE_BACKEND_URL=http://localhost:5001
   VITE_WS_URL=ws://localhost:5001
   ```

### Development

1. **Start the backend server**
   ```bash
   cd backend
   npm run dev:local
   ```

2. **Start the frontend development server**
   ```bash
   npm run dev:local
   ```

3. **Start Firebase emulators** (optional, for local Firebase services)
   ```bash
   firebase emulators:start
   ```

The application will be available at:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5001`

### Production Build

1. **Build the frontend**
   ```bash
   npm run build
   ```

2. **Build the backend**
   ```bash
   cd backend
   npm run build
   ```

3. **Deploy Firebase Functions**
   ```bash
   cd functions
   npm run deploy
   ```

## 🎯 Game Modes Explained

### Ranked Mode
- **Matchmaking**: Players are matched based on their ELO rating
- **ELO System**: Win/loss affects your rating and rank
- **Divisions**: Progress through ranks from Plastic to Cherry MX
- **Match Acceptance**: Players must accept matches before they begin
- **Stats Tracking**: Separate ranked statistics from overall stats

### Custom Games
- **Room Creation**: Create private rooms with custom settings
- **Join Codes**: Share room codes with friends
- **Flexible Settings**: Customize text length, time limits, and more
- **Real-time Racing**: Live progress tracking for all participants

### Solo Practice
- **Personal Improvement**: Practice without affecting ranked stats
- **Various Texts**: Random texts or topic-based content
- **Performance Tracking**: Monitor your improvement over time
- **No Pressure**: Perfect for warming up or skill development

## 📊 Statistics & Rankings

### User Statistics
- **Overall Stats**: Combined statistics from all game modes
- **Ranked Stats**: Specific to ranked matches only
- **Metrics Tracked**:
  - Words Per Minute (WPM)
  - Accuracy percentage
  - Games played
  - Win/loss record
  - Total typing time
  - Characters and words typed

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is private and proprietary.

## 🙏 Acknowledgments

- Built with modern web technologies
- Inspired by competitive typing platforms
- Designed for speed and performance

---

**Happy Typing! 🎯**