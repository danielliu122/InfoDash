// logger.js - Centralized logging utility for InfoDash

class Logger {
    constructor() {
        this.logLevel = this.getLogLevel();
        this.logCounts = {};
        this.suppressedLogs = new Set();
        this.lastLogTime = {};
    }

    getLogLevel() {
        // Check for log level in localStorage or URL params
        const urlParams = new URLSearchParams(window.location.search);
        const logLevel = urlParams.get('log') || localStorage.getItem('infodash_log_level') || 'warn';
        return logLevel;
    }

    setLogLevel(level) {
        this.logLevel = level;
        localStorage.setItem('infodash_log_level', level);
    }

    shouldLog(level) {
        const levels = { error: 0, warn: 1, info: 2, debug: 3 };
        return levels[level] <= levels[this.logLevel];
    }

    // Rate limiting for repetitive logs
    isRateLimited(key, limit = 5, windowMs = 60000) {
        const now = Date.now();
        if (!this.lastLogTime[key]) {
            this.lastLogTime[key] = now;
            this.logCounts[key] = 1;
            return false;
        }

        if (now - this.lastLogTime[key] > windowMs) {
            this.lastLogTime[key] = now;
            this.logCounts[key] = 1;
            return false;
        }

        this.logCounts[key]++;
        return this.logCounts[key] > limit;
    }

    // Consolidated stock data logging
    logStockUpdate(symbol, data, isBulk = false) {
        if (!this.shouldLog('info')) return;
        
        const key = `stock_update_${symbol}`;
        if (this.isRateLimited(key, 3, 30000)) return; // Limit to 3 logs per 30 seconds per symbol

        const change = data.change || 0;
        const changePercent = data.changePercent || 0;
        const changeIcon = change >= 0 ? '↗' : '↘';
        
        // console.log(`📊 ${symbol}: $${(data.price || 0).toFixed(2)} ${changeIcon} ${changePercent.toFixed(2)}%`);
    }

    // Consolidated bulk stock data logging
    logBulkStockUpdate(symbols, data) {
        if (!this.shouldLog('info')) return;
        
        const key = 'bulk_stock_update';
        if (this.isRateLimited(key, 2, 10000)) return; // Limit to 2 logs per 10 seconds

        const validStocks = Object.values(data).filter(stock => !stock.error);
        // console.log(`📈 Bulk update: ${validStocks.length}/${symbols.length} stocks updated`);
    }

    // Consolidated API request logging
    logApiRequest(endpoint, status, responseTime = null) {
        if (!this.shouldLog('debug')) return;
        
        const key = `api_${endpoint}`;
        if (this.isRateLimited(key, 5, 30000)) return;

        const timeStr = responseTime ? ` (${responseTime}ms)` : '';
        // console.log(`🌐 API ${endpoint}: ${status}${timeStr}`);
    }

    // Consolidated cache logging
    logCache(cacheKey, action) {
        if (!this.shouldLog('debug')) return;
        
        const key = `cache_${action}`;
        if (this.isRateLimited(key, 3, 60000)) return;

        // console.log(`💾 Cache ${action}: ${cacheKey}`);
    }

    // Error logging (always shown)
    error(message, error = null) {
        console.error(`❌ ${message}`, error || '');
    }

    // Warning logging
    warn(message, data = null) {
        if (!this.shouldLog('warn')) return;
        // console.warn(`⚠️ ${message}`, data || '');
    }

    // Info logging
    info(message, data = null) {
        if (!this.shouldLog('info')) return;
        // console.log(`ℹ️ ${message}`, data || '');
    }

    // Debug logging
    debug(message, data = null) {
        if (!this.shouldLog('debug')) return;
        // console.log(`🔍 ${message}`, data || '');
    }

    // Success logging
    success(message, data = null) {
        if (!this.shouldLog('info')) return;
        // console.log(`✅ ${message}`, data || '');
    }

    // Dashboard status logging
    logDashboardStatus(action) {
        if (!this.shouldLog('info')) return;
        
        const key = `dashboard_${action}`;
        if (this.isRateLimited(key, 2, 30000)) return;

        // console.log(`📊 Dashboard ${action}`);
    }

    // Chart logging
    logChart(action, details = null) {
        if (!this.shouldLog('debug')) return;
        
        const key = `chart_${action}`;
        if (this.isRateLimited(key, 3, 60000)) return;

        // console.log(`📈 Chart ${action}`, details || '');
    }

    // User action logging
    logUserAction(action, details = null) {
        if (!this.shouldLog('info')) return;
        // console.log(`👤 User ${action}`, details || '');
    }

    // Performance logging
    logPerformance(operation, duration) {
        if (!this.shouldLog('debug')) return;
        
        const key = `perf_${operation}`;
        if (this.isRateLimited(key, 2, 60000)) return;

        // console.log(`⚡ ${operation}: ${duration}ms`);
    }

    // Suppress specific log patterns
    suppress(pattern) {
        this.suppressedLogs.add(pattern);
    }

    // Check if log should be suppressed
    isSuppressed(message) {
        return Array.from(this.suppressedLogs).some(pattern => 
            message.includes(pattern)
        );
    }

    // Clear rate limiting counters
    clearRateLimits() {
        this.logCounts = {};
        this.lastLogTime = {};
    }

    // Get current log statistics
    getStats() {
        return {
            logLevel: this.logLevel,
            suppressedCount: this.suppressedLogs.size,
            rateLimitedKeys: Object.keys(this.logCounts).length
        };
    }
}

// Create global logger instance
const logger = new Logger();

// Make logger available globally
window.logger = logger;

// Export for module usage
export default logger; 