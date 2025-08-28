#!/bin/bash

# 🚂 Railway Quick Start Script
echo "🚀 Starting Railway deployment..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "📦 Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Login to Railway
echo "🔐 Logging into Railway..."
railway login

# Link to project (if not already linked)
echo "🔗 Linking to Railway project..."
railway link

# Deploy to Railway
echo "🚀 Deploying to Railway..."
railway up

echo "✅ Deployment complete!"
echo "🌐 Your app is now running in the cloud!"
echo "📱 Update your mobile app with the new URL"
