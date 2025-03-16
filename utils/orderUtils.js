/**
 * Time limit (in hours) for order cancellation
 */
export const CANCELLATION_TIME_LIMIT = 2;

/**
 * Checks if an order is within the cancellation period
 * @param {Date} orderDate - The date when the order was placed
 * @returns {Object} Object containing cancellation eligibility info
 */
export const isWithinCancellationPeriod = (orderDate) => {
  const orderTime = new Date(orderDate).getTime();
  const currentTime = new Date().getTime();
  const hoursSinceOrder = (currentTime - orderTime) / (1000 * 60 * 60);
  
  return {
    canCancel: hoursSinceOrder <= CANCELLATION_TIME_LIMIT,
    hoursPassed: Math.floor(hoursSinceOrder),
    timeRemaining: Math.max(0, CANCELLATION_TIME_LIMIT - hoursSinceOrder)
  };
};

/**
 * Format time remaining for display
 * @param {number} hours - Number of hours remaining 
 * @returns {string} Formatted time string
 */
export const formatTimeRemaining = (hours) => {
  const minutes = Math.round(hours * 60);
  return minutes > 60 
    ? `${Math.floor(hours)} hours ${Math.round((hours % 1) * 60)} minutes`
    : `${minutes} minutes`;
};