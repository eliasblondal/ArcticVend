import os

class Config:
    """Application configuration"""
    
    # Flask settings
    SECRET_KEY = os.environ.get('SESSION_SECRET', 'dev-secret-key-change-in-production')
    DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    # Database settings
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///kiosk.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Shopify settings
    SHOPIFY_STORE_URL = os.environ.get('SHOPIFY_STORE_URL', 'your-store.myshopify.com')
    SHOPIFY_ACCESS_TOKEN = os.environ.get('SHOPIFY_ACCESS_TOKEN', 'your-token')
    SHOPIFY_API_VERSION = os.environ.get('SHOPIFY_API_VERSION', '2024-01')
    SHOPIFY_LOCATION_ID = os.environ.get('SHOPIFY_LOCATION_ID', '109514817905')
    SHOPIFY_WEBHOOK_SECRET = os.environ.get('SHOPIFY_WEBHOOK_SECRET', 'your-webhook-secret')
    
    # Admin settings
    ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
    
    # Kiosk settings
    KIOSK_TIMEOUT = int(os.environ.get('KIOSK_TIMEOUT', '300'))  # 5 minutes
    PRODUCT_CACHE_DURATION = int(os.environ.get('PRODUCT_CACHE_DURATION', '300'))  # 5 minutes
    
    # Order processing settings
    ORDER_QUEUE_DIR = os.environ.get('ORDER_QUEUE_DIR', './orders')
    MAX_ORDER_RETRIES = int(os.environ.get('MAX_ORDER_RETRIES', '3'))
    
    # Future integration placeholders
    AUDKENNI_CLIENT_ID = os.environ.get('AUDKENNI_CLIENT_ID', 'placeholder')
    AUDKENNI_CLIENT_SECRET = os.environ.get('AUDKENNI_CLIENT_SECRET', 'placeholder')
