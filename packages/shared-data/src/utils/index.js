/**
 * Utility functions for shared data operations
 */
import { v4 as uuidv4 } from 'uuid';
/**
 * Generate a new UUID
 */
export function generateId() {
  return uuidv4();
}
/**
 * Generate a URL-friendly slug from a string
 */
export function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}
/**
 * Convert camelCase to snake_case
 */
export function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}
/**
 * Convert snake_case to camelCase
 */
export function snakeToCamel(str) {
  return str.replace(/([-_][a-z])/g, group =>
    group.toUpperCase().replace('-', '').replace('_', '')
  );
}
/**
 * Deep clone an object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }
  const cloned = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}
/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value) {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  if (typeof value === 'object' && Object.keys(value).length === 0) {
    return true;
  }
  return false;
}
/**
 * Validate email format
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
/**
 * Sanitize string for database insertion
 */
export function sanitizeString(str) {
  return str.trim().replace(/\0/g, '');
}
/**
 * Format date for database storage (ISO string)
 */
export function formatDateForDB(date) {
  return date.toISOString();
}
/**
 * Parse date from database (ISO string to Date)
 */
export function parseDateFromDB(dateString) {
  return new Date(dateString);
}
//# sourceMappingURL=index.js.map
