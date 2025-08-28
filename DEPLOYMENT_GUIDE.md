# 🚀 **Complete Deployment Guide - Railway + MongoDB Atlas**

## **Overview**
This guide will deploy your Smart Timetable app to the cloud, making it available 24/7 without needing your PC running.

---

## **📋 Prerequisites**
- GitHub account
- MongoDB Atlas account (free)
- Railway account (free)

---

## **🗄️ STEP 1: MongoDB Atlas Setup**

### **1.1 Create MongoDB Atlas Account**
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Click "Try Free" and sign up
3. Choose "Free" tier (M0)

### **1.2 Create Database Cluster**
1. Click "Build a Database"
2. Choose "FREE" tier
3. Select cloud provider (AWS/Google Cloud/Azure)
4. Choose region (closest to you)
5. Click "Create"

### **1.3 Create Database User**
1. Go to "Database Access" → "Add New Database User"
2. Username: `timetable_user`
3. Password: Generate a strong password
4. Role: "Read and write to any database"
5. Click "Add User"

### **1.4 Get Connection String**
1. Go to "Database" → "Connect"
2. Choose "Connect your application"
3. Copy the connection string
4. Replace `<username>`, `<password>`, `<database>` with your values

**Example:**
```
mongodb+srv://timetable_user:YourPassword123@cluster0.abc123.mongodb.net/timetable_db?retryWrites=true&w=majority
```

---

## **🚂 STEP 2: Deploy to Railway**

### **2.1 Create Railway Account**
1. Go to [Railway](https://railway.app/)
2. Sign in with GitHub
3. Click "New Project"

### **2.2 Deploy from GitHub**
1. Choose "Deploy from GitHub repo"
2. Select your `timetable` repository
3. Railway will auto-detect it's a Node.js app

### **2.3 Configure Environment Variables**
In Railway dashboard, add these variables:

```bash
# Copy from your web app
MONGODB_URI=mongodb+srv://timetable_user:YourPassword123@cluster0.abc123.mongodb.net/timetable_db?retryWrites=true&w=majority
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Generated secrets (use generate-secret.vercel.app/32)
JWT_SECRET=your-generated-jwt-secret
JWT_REFRESH_SECRET=your-generated-refresh-secret
SESSION_SECRET=your-generated-session-secret

# Production settings
NODE_ENV=production
PORT=5000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### **2.4 Deploy**
1. Railway will automatically build and deploy
2. Wait for "Deploy successful" message
3. Copy your app URL (e.g., `https://your-app.railway.app`)

---

## **📱 STEP 3: Update Mobile App**

### **3.1 Update Environment Variables**
In `mobile-app/.env`:

```bash
EXPO_PUBLIC_API_BASE_URL=https://your-app.railway.app/api
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

### **3.2 Update Google OAuth**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Add your Railway URL to authorized redirect URIs:
   - `https://your-app.railway.app/api/auth/google/callback`
   - `https://your-app.railway.app/api/auth/google-mobile`

### **3.3 Test Mobile App**
1. Build and run mobile app
2. Try registration/login
3. Should work from anywhere now!

---

## **🔧 Troubleshooting**

### **If deployment fails:**
1. Check Railway logs
2. Verify environment variables
3. Ensure MongoDB Atlas is accessible
4. Make sure `server/package.json` exists

### **If mobile app can't connect:**
1. Verify Railway URL is correct
2. Check if server is running (visit `/api/health`)
3. Ensure CORS is configured properly

---

## **✅ What You Get**

- **🚀 Server runs 24/7** - No PC needed
- **🌍 Global access** - Works from anywhere
- **📱 Mobile app works** - No local network issues
- **🔒 Secure HTTPS** - Professional security
- **📊 Auto-scaling** - Handles multiple users
- **💰 Free tier** - No cost for development

---

## **🎯 Next Steps After Deployment**

1. **Test all features** on mobile app
2. **Share with users** - they can access from anywhere
3. **Monitor performance** in Railway dashboard
4. **Scale up** when needed (Railway handles this automatically)

---

## **📞 Need Help?**

- **Railway Docs**: [docs.railway.app](https://docs.railway.app/)
- **MongoDB Atlas Docs**: [docs.atlas.mongodb.com](https://docs.atlas.mongodb.com/)
- **Check server status**: Visit `/api/health` on your Railway URL

---

**🎉 Congratulations! Your app is now running in the cloud 24/7!**
