# 🎓 Smart Timetable App

A comprehensive, AI-powered timetable and productivity assistant designed specifically for college students. This all-in-one application combines intelligent scheduling, assignment management, and AI-driven study planning to help students excel in their academic journey.

## ✨ Features

### 🕒 Core Timetable Management
- **Multi-branch Support**: Complete timetables for all engineering branches
- **Smart Scheduling**: View daily, weekly, and monthly schedules
- **Free Slot Analysis**: Identify available study time and breaks
- **Workload Insights**: Understand your daily academic load

### ✏️ Dynamic User Timetables
- **Personal Customization**: Add, edit, and remove custom classes
- **Class Visibility Control**: Hide or show specific classes from base timetable
- **Custom Class Management**: Full CRUD operations for personal classes
- **Preference Settings**: Customize display options and default colors
- **Real-time Updates**: Instant changes reflect across the application

### 🔗 Google Integration
- **Google Classroom Sync**: Automatic assignment and deadline import
- **Gmail Integration**: Email notifications and reminders
- **Drive Integration**: Access study materials and submissions

### 🤖 AI-Powered Features
- **Smart Task Prioritization**: AI analyzes deadlines and workload to suggest priorities
- **Personalized Study Plans**: Course-specific learning roadmaps
- **Time Management Advice**: Intelligent suggestions for optimal time utilization
- **Study Recommendations**: AI-driven study strategies and tips

### 📱 User Experience
- **Modern, Responsive Design**: Works seamlessly on all devices
- **Intuitive Interface**: Easy navigation and user-friendly controls
- **Real-time Updates**: Live schedule and deadline tracking
- **Customizable Themes**: Light, dark, and auto themes

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v5 or higher)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd smart-timetable-app
   ```

2. **Install dependencies**
   ```bash
   # Install backend dependencies
   npm install
   
   # Install frontend dependencies
   cd client
   npm install
   cd ..
   ```

3. **Environment Setup**
   ```bash
   # Create .env file in the root directory
   cp .env.example .env
   
   # Configure your environment variables
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

4. **Database Setup**
   ```bash
   # Start MongoDB (if running locally)
   mongod
   
   # Or use MongoDB Atlas (cloud)
   # Update MONGODB_URI in .env
   ```

5. **Seed the Database (Optional)**
   ```bash
   # Populate with sample timetable data
   npm run seed
   
   # This creates sample timetables for different branches
   # Admin user: admin@college.edu / admin123
   ```

6. **Run the Application**
   ```bash
   # Development mode (runs both backend and frontend)
   npm run dev
   
   # Or run separately:
   # Backend only
   npm run server
   
   # Frontend only
   npm run client
   ```

6. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - API Health Check: http://localhost:5000/api/health

## 🏗️ Project Structure

```
smart-timetable-app/
├── server/                 # Backend server
│   ├── models/            # Database models
│   ├── routes/            # API routes
│   ├── middleware/        # Custom middleware
│   └── index.js          # Server entry point
├── client/                # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── contexts/      # React contexts
│   │   ├── services/      # API services
│   │   └── App.js        # Main app component
│   ├── public/            # Static assets
│   └── package.json
├── package.json           # Root package.json
└── README.md
```

## 🔧 Configuration

### Backend Configuration
- **Port**: Default 5000 (configurable via PORT env var)
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT-based with bcrypt password hashing
- **Security**: Helmet, CORS, rate limiting

### Frontend Configuration
- **Port**: Default 3000
- **Build Tool**: Create React App
- **Styling**: Tailwind CSS with custom components
- **State Management**: React Context + React Query

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile

### Timetable
- `GET /api/timetable/:branch/:year` - Get timetable
- `GET /api/timetable/:branch/:year/daily/:day` - Daily schedule
- `GET /api/timetable/:branch/:year/free-slots` - Free time slots
- `GET /api/timetable/:branch/:year/workload` - Workload analysis

### User Timetable Management
- `GET /api/user-timetable/my` - Get user's personalized timetable
- `POST /api/user-timetable/custom-class` - Add custom class
- `PUT /api/user-timetable/custom-class/:id` - Update custom class
- `DELETE /api/user-timetable/custom-class/:id` - Remove custom class
- `POST /api/user-timetable/toggle-visibility/:id` - Toggle class visibility
- `PUT /api/user-timetable/preferences` - Update timetable preferences
- `GET /api/user-timetable/daily/:day` - Get user's daily schedule

### AI Features
- `POST /api/ai/prioritize` - Task prioritization
- `POST /api/ai/study-plan` - Generate study plans
- `POST /api/ai/time-management` - Time management advice

## 🎨 Customization

### Adding New Branches
1. Update the User model in `server/models/User.js`
2. Add branch-specific logic in timetable routes
3. Update frontend branch selection components

### Customizing AI Features
1. Modify AI logic in `server/routes/ai.js`
2. Add new AI endpoints as needed
3. Update frontend AI components

### Styling Changes
1. Modify `client/src/index.css` for global styles
2. Update Tailwind config in `client/tailwind.config.js`
3. Use custom CSS classes defined in the CSS file

## 🚀 Deployment

### Backend Deployment
1. Set production environment variables
2. Build and deploy to your preferred hosting service
3. Configure MongoDB connection
4. Set up SSL certificates

### Frontend Deployment
1. Build the production version: `npm run build`
2. Deploy the `build` folder to your hosting service
3. Configure environment variables for production API endpoints

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and commit: `git commit -m 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check this README and code comments
- **Issues**: Report bugs and feature requests via GitHub Issues
- **Discussions**: Join community discussions for help and ideas

## 🔮 Future Enhancements

- **Mobile App**: Native iOS and Android applications
- **Advanced AI**: Machine learning for better predictions
- **Collaboration**: Group study planning and sharing
- **Analytics**: Detailed study analytics and insights
- **Integrations**: More third-party service integrations

---

**Built with ❤️ for students, by students**

*Smart Timetable App - Making college life easier, one schedule at a time!* 