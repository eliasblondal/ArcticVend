from datetime import datetime
from app import db
from sqlalchemy import CheckConstraint

class ShelfMapping(db.Model):
    """Shelf mapping model for tracking product locations"""
    __tablename__ = 'shelf_mappings'
    
    shelf_number = db.Column(db.Integer, primary_key=True)
    sku = db.Column(db.String(50))
    product_name = db.Column(db.String(100))
    current_stock = db.Column(db.Integer, default=0)
    active = db.Column(db.Boolean, default=True)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        CheckConstraint('shelf_number BETWEEN 1 AND 40', name='shelf_number_range'),
    )

class OrderQueue(db.Model):
    """Order queue model for tracking orders"""
    __tablename__ = 'order_queue'
    
    id = db.Column(db.String(36), primary_key=True)
    order_type = db.Column(db.String(20))
    shopify_order_id = db.Column(db.String(50), unique=True)
    shopify_order_number = db.Column(db.String(20))
    items = db.Column(db.Text)  # JSON string
    status = db.Column(db.String(20), default='pending')
    pickup_code = db.Column(db.String(10))
    test_order = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    processed_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    
    __table_args__ = (
        CheckConstraint("order_type IN ('kiosk', 'wolt')", name='valid_order_type'),
        CheckConstraint("status IN ('pending', 'processing', 'completed', 'failed')", name='valid_status'),
    )

class SystemHealth(db.Model):
    """System health monitoring model"""
    __tablename__ = 'system_health'
    
    id = db.Column(db.Integer, primary_key=True)
    component = db.Column(db.String(50))
    status = db.Column(db.String(20))
    message = db.Column(db.Text)
    last_check = db.Column(db.DateTime, default=datetime.utcnow)
    details = db.Column(db.Text)  # JSON string

class TestUser(db.Model):
    """Test users for development mode"""
    __tablename__ = 'test_users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50))
    pin = db.Column(db.String(6))
    active = db.Column(db.Boolean, default=True)

class ShelfZoneConfig(db.Model):
    """Configuration for shelf zones"""
    __tablename__ = 'shelf_zone_config'
    
    id = db.Column(db.Integer, primary_key=True)
    zone_name = db.Column(db.String(20))  # 'small', 'medium', 'large'
    start_shelf = db.Column(db.Integer)
    end_shelf = db.Column(db.Integer)
    color = db.Column(db.String(20))  # Display color for zone
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        CheckConstraint('start_shelf >= 1 AND end_shelf <= 40', name='valid_shelf_range'),
        CheckConstraint("zone_name IN ('small', 'medium', 'large')", name='valid_zone_name'),
    )

class ProductMetadata(db.Model):
    """Product metadata for shelf compatibility"""
    __tablename__ = 'product_metadata'
    
    sku = db.Column(db.String(50), primary_key=True)
    box_size = db.Column(db.String(20))  # 'small', 'medium', 'large'
    dimensions_cm = db.Column(db.JSON)  # {"width": 20, "height": 30, "depth": 15}
    max_stack = db.Column(db.Integer)  # How many fit in one shelf
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        CheckConstraint("box_size IN ('small', 'medium', 'large')", name='valid_box_size'),
    )

class User(db.Model):
    """Admin users model"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    password_hash = db.Column(db.String(256))
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
