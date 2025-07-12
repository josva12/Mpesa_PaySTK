import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Configuration class for the M-Pesa STK Push application"""
    
    # Safaricom Daraja API Configuration
    CONSUMER_KEY = os.getenv('CONSUMER_KEY')
    CONSUMER_SECRET = os.getenv('CONSUMER_SECRET')
    BUSINESS_SHORTCODE = os.getenv('BUSINESS_SHORTCODE')
    PASSKEY = os.getenv('PASSKEY')
    CALLBACK_URL = os.getenv('CALLBACK_URL')
    
    # API Environment
    API_ENVIRONMENT = os.getenv('API_ENVIRONMENT', 'sandbox')
    API_URL = "https://sandbox.safaricom.co.ke" if API_ENVIRONMENT == 'sandbox' else "https://api.safaricom.co.ke"
    
    # Security
    API_TOKEN = os.getenv('API_TOKEN')
    SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-change-in-production')
    
    # MongoDB Configuration
    MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/mpesa_transactions')
    MONGO_DB_NAME = 'mpesa_transactions'
    MONGO_COLLECTION_NAME = 'transactions'
    
    # Server Configuration
    PORT = int(os.getenv('PORT', 5000))
    HOST = os.getenv('HOST', '0.0.0.0')
    DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
    
    # Logging Configuration
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', 'mpesa_logs.log')
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS = int(os.getenv('RATE_LIMIT_REQUESTS', 100))
    RATE_LIMIT_WINDOW = int(os.getenv('RATE_LIMIT_WINDOW', 900))  # 15 minutes
    
    # Timeouts
    API_TIMEOUT = int(os.getenv('API_TIMEOUT', 30))
    TOKEN_TIMEOUT = int(os.getenv('TOKEN_TIMEOUT', 3600))
    
    # Validation
    MIN_AMOUNT = 1
    MAX_AMOUNT = 70000
    PHONE_REGEX = r'^254[17]\d{8}$'
    
    @classmethod
    def validate_config(cls):
        """Validate that all required configuration is present"""
        required_fields = [
            'CONSUMER_KEY', 'CONSUMER_SECRET', 'BUSINESS_SHORTCODE', 
            'PASSKEY', 'CALLBACK_URL', 'API_TOKEN'
        ]
        
        missing_fields = []
        for field in required_fields:
            if not getattr(cls, field):
                missing_fields.append(field)
        
        if missing_fields:
            raise ValueError(f"Missing required configuration: {', '.join(missing_fields)}")
        
        return True

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    LOG_LEVEL = 'DEBUG'

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    LOG_LEVEL = 'WARNING'

class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    DEBUG = True
    MONGO_URI = 'mongodb://localhost:27017/mpesa_transactions_test'

# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
} 