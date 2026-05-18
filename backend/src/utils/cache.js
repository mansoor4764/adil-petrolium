'use strict';

/**
 * Simple in-memory cache for serverless functions
 * Helps reduce database queries for frequently accessed data
 */

const cache = new Map();
const DEFAULT_TTL = 60 * 1000; // 60 seconds

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {any|null} - Cached value or null if expired/not found
 */
function get(key) {
  const item = cache.get(key);
  if (!item) return null;
  
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  
  return item.value;
}

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in milliseconds (default: 60s)
 */
function set(key, value, ttl = DEFAULT_TTL) {
  cache.set(key, {
    value,
    expiry: Date.now() + ttl,
  });
}

/**
 * Delete value from cache
 * @param {string} key - Cache key
 */
function del(key) {
  cache.delete(key);
}

/**
 * Clear all cache
 */
function clear() {
  cache.clear();
}

/**
 * Get cache size
 */
function size() {
  return cache.size;
}

/**
 * Wrapper function to cache async function results
 * @param {string} key - Cache key
 * @param {Function} fn - Async function to execute if cache miss
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Promise<any>} - Cached or fresh result
 */
async function wrap(key, fn, ttl = DEFAULT_TTL) {
  const cached = get(key);
  if (cached !== null) {
    return cached;
  }
  
  const result = await fn();
  set(key, result, ttl);
  return result;
}

module.exports = {
  get,
  set,
  del,
  clear,
  size,
  wrap,
};
