#!/bin/bash

echo "🚀 Deploying Smart Timetable Server to Railway..."

# Install Railway CLI if not present
if ! command -v railway &> /dev/null; then
    echo "📦 Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Login to Railway
echo "🔐 Logging into Railway..."
railway login

# Deploy
echo "🚂 Deploying to Railway..."
railway up

echo "✅ Deployment complete!"
echo "🌐 Your app is now running in the cloud!"
echo "📱 Update your mobile app with the new URL"
