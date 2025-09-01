import os
import json
import logging
from datetime import datetime
import uuid

def create_order_directories():
    """Create necessary order directories"""
    directories = [
        './orders',
        './orders/pending',
        './orders/processing', 
        './orders/completed',
        './orders/archive'
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
    
    logging.info("Order directories created/verified")

def get_next_order_number():
    """Generate next order number"""
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    return f"K{timestamp}"

def save_order_to_queue(order_data, status='pending'):
    """Save order to JSON queue"""
    try:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        order_id = order_data.get('order_id', str(uuid.uuid4()))
        filename = f"{timestamp}_{order_id}.json"
        
        directory = f'./orders/{status}'
        filepath = os.path.join(directory, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(order_data, f, indent=2, ensure_ascii=False)
        
        logging.info(f"Saved order to queue: {filepath}")
        return filepath
        
    except Exception as e:
        logging.error(f"Error saving order to queue: {e}")
        return None

def load_order_from_queue(filepath):
    """Load order from JSON queue"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"Error loading order from queue: {e}")
        return None

def move_order_file(src_path, dest_status):
    """Move order file between queue directories"""
    try:
        src_dir, filename = os.path.split(src_path)
        dest_dir = f'./orders/{dest_status}'
        dest_path = os.path.join(dest_dir, filename)
        
        os.rename(src_path, dest_path)
        logging.info(f"Moved order file: {src_path} -> {dest_path}")
        return dest_path
        
    except Exception as e:
        logging.error(f"Error moving order file: {e}")
        return None

def generate_pickup_code():
    """Generate 6-digit pickup code"""
    import random
    return str(random.randint(100000, 999999))

def format_price(price, currency='ISK'):
    """Format price with currency"""
    if currency == 'ISK':
        return f"{price:,.0f} kr"
    return f"{price:.2f} {currency}"

def validate_shelf_number(shelf_number):
    """Validate shelf number is within range"""
    try:
        shelf = int(shelf_number)
        return 1 <= shelf <= 40
    except (ValueError, TypeError):
        return False

def sanitize_filename(filename):
    """Sanitize filename for safe file operations"""
    import re
    # Remove invalid characters
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    # Limit length
    return filename[:100]

def log_system_event(component, status, message, details=None):
    """Log system event for monitoring"""
    event = {
        'timestamp': datetime.now().isoformat(),
        'component': component,
        'status': status,
        'message': message,
        'details': details or {}
    }
    
    logging.info(f"System Event: {component} - {status} - {message}")
    
    # Save to health monitoring if needed
    try:
        from models import SystemHealth
        from app import db
        
        health_record = SystemHealth(
            component=component,
            status=status,
            message=message,
            details=json.dumps(details or {})
        )
        db.session.add(health_record)
        db.session.commit()
        
    except Exception as e:
        logging.error(f"Error logging system event to database: {e}")

def retry_operation(func, max_retries=3, delay=1):
    """Retry operation with exponential backoff"""
    import time
    
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            
            wait_time = delay * (2 ** attempt)
            logging.warning(f"Operation failed (attempt {attempt + 1}/{max_retries}), retrying in {wait_time}s: {e}")
            time.sleep(wait_time)
