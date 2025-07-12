require('dotenv').config();

class Config {
    constructor() {
        // Safaricom Daraja API Configuration
        this.CONSUMER_KEY = process.env.CONSUMER_KEY;
        this.CONSUMER_SECRET = process.env.CONSUMER_SECRET;
        this.BUSINESS_SHORTCODE = process.env.BUSINESS_SHORTCODE;
        this.PASSKEY = process.env.PASSKEY;
        this.CALLBACK_URL = process.env.CALLBACK_URL;
        
        // API Environment
        this.API_ENVIRONMENT = process.env.API_ENVIRONMENT || 'sandbox';
        this.API_URL = this.API_ENVIRONMENT === 'sandbox' 
            ? 'https://sandbox.safaricom.co.ke' 
            : 'https://api.safaricom.co.ke';
        
        // Security
        this.API_TOKEN = process.env.API_TOKEN;
        this.SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-change-in-production';
        
        // MongoDB Configuration
        this.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mpesa_transactions';
        this.MONGO_DB_NAME = 'mpesa_transactions';
        this.MONGO_COLLECTION_NAME = 'transactions';
        
        // Server Configuration
        this.PORT = parseInt(process.env.PORT) || 3000;
        this.HOST = process.env.HOST || '0.0.0.0';
        this.NODE_ENV = process.env.NODE_ENV || 'development';
        
        // Logging Configuration
        this.LOG_LEVEL = process.env.LOG_LEVEL || 'info';
        this.LOG_FILE = process.env.LOG_FILE || 'mpesa_logs.log';
        
        // Rate Limiting
        this.RATE_LIMIT_REQUESTS = parseInt(process.env.RATE_LIMIT_REQUESTS) || 100;
        this.RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 900; // 15 minutes
        
        // Timeouts
        this.API_TIMEOUT = parseInt(process.env.API_TIMEOUT) || 30000;
        this.TOKEN_TIMEOUT = parseInt(process.env.TOKEN_TIMEOUT) || 3600000;
        
        // Validation
        this.MIN_AMOUNT = 1;
        this.MAX_AMOUNT = 70000;
        this.PHONE_REGEX = /^254[17]\d{8}$/;
    }
    
    validateConfig() {
        const requiredFields = [
            'CONSUMER_KEY', 'CONSUMER_SECRET', 'BUSINESS_SHORTCODE', 
            'PASSKEY', 'CALLBACK_URL', 'API_TOKEN'
        ];
        
        const missingFields = requiredFields.filter(field => !this[field]);
        
        if (missingFields.length > 0) {
            throw new Error(`Missing required configuration: ${missingFields.join(', ')}`);
        }
        
        return true;
    }
    
    isDevelopment() {
        return this.NODE_ENV === 'development';
    }
    
    isProduction() {
        return this.NODE_ENV === 'production';
    }
    
    isTesting() {
        return this.NODE_ENV === 'test';
    }
}

// Create and export configuration instance
const config = new Config();

module.exports = config; 