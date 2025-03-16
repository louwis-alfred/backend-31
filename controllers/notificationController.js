import Notification from "../models/notificationModel.js";

// Simple in-memory cache implementation
const notificationCache = new Map();
const CACHE_TTL = 30000; // 30 seconds cache validity
const MAX_CACHE_ITEMS = 100; // Limit cache size to prevent memory issues

// Helper function to clean expired cache entries occasionally
const cleanupCache = () => {
  const now = Date.now();
  let count = 0;
  
  for (const [key, value] of notificationCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      notificationCache.delete(key);
      count++;
    }
    
    // If cache is too large, remove oldest entries
    if (notificationCache.size > MAX_CACHE_ITEMS) {
      const oldestEntry = [...notificationCache.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldestEntry) {
        notificationCache.delete(oldestEntry[0]);
        count++;
      }
    }
  }
  
  if (count > 0) {
    console.log(`Cache cleanup: removed ${count} expired entries`);
  }
};

// Run cleanup every minute
setInterval(cleanupCache, 60000);

// Create a new notification
export const createNotification = async (req, res) => {
  try {
    const notification = new Notification({
      recipient: req.body.recipient,
      type: req.body.type,
      title: req.body.title,
      message: req.body.message,
      data: req.body.data,
    });

    await notification.save();
    
    // Invalidate cache for this user after creating a new notification
    const cacheKey = `notifications:${req.body.recipient}`;
    notificationCache.delete(cacheKey);
    
    // Also invalidate unread count cache
    notificationCache.delete(`unread:${req.body.recipient}`);
    
    res.status(201).json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user's notifications with caching
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const cacheKey = `notifications:${userId}`;
    
    // Check cache first
    const cached = notificationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      // Add cache hit header for monitoring
      res.set('X-Cache', 'HIT');
      return res.json({ 
        success: true, 
        notifications: cached.data,
        fromCache: true
      });
    }
    
    // If not in cache or expired, fetch from database
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    
    // Update cache
    notificationCache.set(cacheKey, {
      timestamp: Date.now(),
      data: notifications
    });
    
    // Add cache miss header for monitoring
    res.set('X-Cache', 'MISS');
    res.json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }
    
    // Invalidate both caches when marking as read
    notificationCache.delete(`notifications:${userId}`);
    notificationCache.delete(`unread:${userId}`);

    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { read: true }
    );
    
    // Invalidate both caches when marking all as read
    notificationCache.delete(`notifications:${userId}`);
    notificationCache.delete(`unread:${userId}`);

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get unread count with caching
// Get unread count with caching
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { type } = req.query; // Get type from query params
    
    // Create a cache key that includes the type if provided
    const cacheKey = type 
      ? `unread:${userId}:${type}` 
      : `unread:${userId}`;
    
    // Check cache first with shorter TTL for count (10 seconds)
    const cached = notificationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 10000) {
      res.set('X-Cache', 'HIT');
      return res.json({ 
        success: true, 
        count: cached.data,
        fromCache: true
      });
    }
    
    // If not in cache or expired, fetch from database
    const filter = {
      recipient: req.user._id,
      read: false,
    };
    
    // Add type filter if provided
    if (type) {
      filter.type = type;
    }
    
    const count = await Notification.countDocuments(filter);
    
    // Update cache with shorter TTL for counts
    notificationCache.set(cacheKey, {
      timestamp: Date.now(),
      data: count
    });
    
    res.set('X-Cache', 'MISS');
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};