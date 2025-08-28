const User = require('../models/User');
const GoogleClassroomService = require('./googleClassroom');

class RealtimeSyncService {
  constructor() {
    this.syncIntervals = new Map(); // userId -> intervalId
    this.activeSyncs = new Set();
  }

  // Start real-time sync for a user
  startSync(userId, interval = 300000) { // Default 5 minutes
    if (this.syncIntervals.has(userId)) {
      console.log(`Sync already active for user ${userId}`);
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        await this.syncUserData(userId);
      } catch (error) {
        console.error(`Sync failed for user ${userId}:`, error);
      }
    }, interval);

    this.syncIntervals.set(userId, intervalId);
    console.log(`Started real-time sync for user ${userId} with ${interval}ms interval`);
  }

  // Stop sync for a user
  stopSync(userId) {
    const intervalId = this.syncIntervals.get(userId);
    if (intervalId) {
      clearInterval(intervalId);
      this.syncIntervals.delete(userId);
      console.log(`Stopped real-time sync for user ${userId}`);
    }
  }

  // Sync user's Google Classroom data
  async syncUserData(userId) {
    if (this.activeSyncs.has(userId)) {
      console.log(`Sync already in progress for user ${userId}`);
      return;
    }

    this.activeSyncs.add(userId);

    try {
      const user = await User.findById(userId);
      if (!user || !user.googleAuth?.isConnected) {
        console.log(`User ${userId} not connected to Google Classroom`);
        return;
      }

      // Check if token needs refresh
      let accessToken = user.googleAuth.accessToken;
      if (user.googleAuth.tokenExpiry && new Date() > user.googleAuth.tokenExpiry) {
        console.log(`Refreshing token for user ${userId}`);
        // Token refresh logic would go here
        // For now, we'll skip sync if token is expired
        return;
      }

      const classroomService = new GoogleClassroomService(accessToken);

      // Sync assignments
      const assignments = await classroomService.getAllAssignments();
      
      // Sync announcements
      const announcements = await classroomService.getRecentAnnouncements();

      // Update last sync time
      await User.findByIdAndUpdate(userId, {
        'googleAuth.lastSync': new Date()
      });

      console.log(`Successfully synced ${assignments.length} assignments and ${announcements.length} announcements for user ${userId}`);

      // Here you could emit events to connected clients via WebSocket
      // this.emitToUser(userId, 'sync_complete', { assignments, announcements });

    } catch (error) {
      console.error(`Failed to sync data for user ${userId}:`, error);
    } finally {
      this.activeSyncs.delete(userId);
    }
  }

  // Get sync status for a user
  getSyncStatus(userId) {
    return {
      isActive: this.syncIntervals.has(userId),
      isSyncing: this.activeSyncs.has(userId),
      lastActivity: new Date()
    };
  }

  // Manual sync trigger
  async triggerSync(userId) {
    console.log(`Manual sync triggered for user ${userId}`);
    await this.syncUserData(userId);
  }

  // Cleanup on app shutdown
  cleanup() {
    console.log('Cleaning up real-time sync service...');
    for (const [userId, intervalId] of this.syncIntervals) {
      clearInterval(intervalId);
      console.log(`Cleared sync interval for user ${userId}`);
    }
    this.syncIntervals.clear();
    this.activeSyncs.clear();
  }
}

// Singleton instance
const realtimeSyncService = new RealtimeSyncService();

// Cleanup on process termination
process.on('SIGTERM', () => {
  realtimeSyncService.cleanup();
});

process.on('SIGINT', () => {
  realtimeSyncService.cleanup();
});

module.exports = realtimeSyncService;
