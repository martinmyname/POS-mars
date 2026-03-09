/**
 * Constants for Smart Restock Planner (Inventory).
 * UGX, Africa/Kampala. Do not change without product owner approval.
 */
export const RESTOCK_SAFETY_BUFFER = 1.25; // 25% extra on cycle demand
export const DEAD_STOCK_DAYS = 30; // No sales in this many days = dead stock
export const RESTOCK_VELOCITY_FAST = 3; // >= 3 units/day
export const RESTOCK_VELOCITY_MODERATE = 0.5; // >= 0.5 units/day
export const DEFAULT_RESTOCK_CYCLE_DAYS = 14;
