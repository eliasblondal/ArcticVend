import os
import logging
from datetime import datetime, timedelta
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash, generate_password_hash
import json
import uuid
from config import Config
from shopify_client import ShopifyClient
from utils import create_order_directories, get_next_order_number, save_order_to_queue

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s %(levelname)s %(name)s %(message)s',
    handlers=[
        logging.FileHandler('kiosk.log'),
        logging.StreamHandler()
    ]
)

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Load configuration
app.config.from_object(Config)

# Configure the database
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///kiosk.db")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

# Initialize the app with the extension
db.init_app(app)

# Initialize Shopify client
shopify_client = ShopifyClient()

# Create order directories
create_order_directories()

with app.app_context():
    # Import models after db initialization
    import models
    db.create_all()
    
    # Create default admin user if it doesn't exist
    admin = models.User.query.filter_by(username='admin').first()
    if not admin:
        admin = models.User(
            username='admin',
            password_hash=generate_password_hash(os.environ.get('ADMIN_PASSWORD', 'admin123')),
            is_admin=True
        )
        db.session.add(admin)
        db.session.commit()
        logging.info("Created default admin user")

# Language translations
TRANSLATIONS = {
    'is': {
        'welcome': 'Velkomin/n',
        'tap_to_start': 'Smelltu til að byrja',
        'products': 'Vörur',
        'cart': 'Karfa',
        'checkout': 'Greiða',
        'total': 'Samtals',
        'add_to_cart': 'Setja í körfu',
        'remove': 'Fjarlægja',
        'order_complete': 'Pöntun tókst',
        'order_number': 'Pöntunarnúmer',
        'pickup_code': 'Sóttkóði',
        'enter_code': 'Sláðu inn kóða',
        'invalid_code': 'Ógildur kóði',
        'back': 'Til baka',
        'continue': 'Halda áfram',
        'price': 'Verð',
        'quantity': 'Magn',
        'empty_cart': 'Tóm karfa',
        'error': 'Villa',
        'try_again': 'Reyndu aftur'
    },
    'en': {
        'welcome': 'Welcome',
        'tap_to_start': 'Tap to Start',
        'products': 'Products',
        'cart': 'Cart',
        'checkout': 'Checkout',
        'total': 'Total',
        'add_to_cart': 'Add to Cart',
        'remove': 'Remove',
        'order_complete': 'Order Complete',
        'order_number': 'Order Number',
        'pickup_code': 'Pickup Code',
        'enter_code': 'Enter Code',
        'invalid_code': 'Invalid Code',
        'back': 'Back',
        'continue': 'Continue',
        'price': 'Price',
        'quantity': 'Quantity',
        'empty_cart': 'Empty Cart',
        'error': 'Error',
        'try_again': 'Try Again'
    }
}

def get_translation(key, lang='is'):
    """Get translation for a key in specified language"""
    return TRANSLATIONS.get(lang, TRANSLATIONS['is']).get(key, key)

@app.template_filter('translate')
def translate_filter(key):
    lang = session.get('language', 'is')
    return get_translation(key, lang)

# Customer Kiosk Routes
@app.route('/')
@app.route('/kiosk')
def kiosk_index():
    """McDonald's-style main interface"""
    return render_template('kiosk/index.html')

@app.route('/kiosk/products')
def kiosk_products():
    """Product grid with Shopify data"""
    try:
        products = shopify_client.get_products()
        return render_template('kiosk/products.html', products=products)
    except Exception as e:
        logging.error(f"Error fetching products: {e}")
        flash(get_translation('error'), 'error')
        return redirect(url_for('kiosk_index'))

@app.route('/kiosk/add_to_cart', methods=['POST'])
def add_to_cart():
    """Add product to cart"""
    try:
        product_id = request.form.get('product_id')
        sku = request.form.get('sku')
        title = request.form.get('title')
        price = float(request.form.get('price'))
        quantity = int(request.form.get('quantity', 1))
        
        if 'cart' not in session:
            session['cart'] = {}
        
        if product_id in session['cart']:
            session['cart'][product_id]['quantity'] += quantity
        else:
            session['cart'][product_id] = {
                'sku': sku,
                'title': title,
                'price': price,
                'quantity': quantity
            }
        
        session.modified = True
        return redirect(url_for('kiosk_products'))
    except Exception as e:
        logging.error(f"Error adding to cart: {e}")
        flash(get_translation('error'), 'error')
        return redirect(url_for('kiosk_products'))

@app.route('/kiosk/cart')
def kiosk_cart():
    """Shopping cart management"""
    cart = session.get('cart', {})
    total = sum(item['price'] * item['quantity'] for item in cart.values())
    return render_template('kiosk/cart.html', cart=cart, total=total)

@app.route('/kiosk/remove_from_cart', methods=['POST'])
def remove_from_cart():
    """Remove item from cart"""
    product_id = request.form.get('product_id')
    if 'cart' in session and product_id in session['cart']:
        del session['cart'][product_id]
        session.modified = True
    return redirect(url_for('kiosk_cart'))

@app.route('/kiosk/checkout')
def kiosk_checkout():
    """Order creation and payment"""
    cart = session.get('cart', {})
    if not cart:
        flash(get_translation('empty_cart'), 'warning')
        return redirect(url_for('kiosk_products'))
    
    total = sum(item['price'] * item['quantity'] for item in cart.values())
    return render_template('kiosk/checkout.html', cart=cart, total=total)

@app.route('/kiosk/complete_order', methods=['POST'])
def complete_order():
    """Complete the order"""
    try:
        cart = session.get('cart', {})
        if not cart:
            flash(get_translation('empty_cart'), 'warning')
            return redirect(url_for('kiosk_products'))
        
        # Create Shopify order
        order_data = shopify_client.create_order(cart, order_type='kiosk')
        
        if not order_data:
            flash(get_translation('error'), 'error')
            return redirect(url_for('kiosk_checkout'))
        
        # Create local order entry
        order_id = str(uuid.uuid4())
        order_number = get_next_order_number()
        
        # Get shelf assignments for products
        shelf_numbers = []
        for item in cart.values():
            shelf = models.ShelfMapping.query.filter_by(sku=item['sku'], active=True).first()
            if shelf:
                shelf_numbers.append(shelf.shelf_number)
        
        # Save to order queue
        queue_data = {
            "order_id": order_id,
            "order_type": "kiosk",
            "shopify_order_id": str(order_data.get('id')),
            "shopify_order_number": order_data.get('order_number'),
            "items": list(cart.values()),
            "shelf_numbers": shelf_numbers,
            "created_at": datetime.now().isoformat(),
            "test_order": session.get('test_mode', False)
        }
        
        save_order_to_queue(queue_data)
        
        # Save to database
        db_order = models.OrderQueue(
            id=order_id,
            order_type='kiosk',
            shopify_order_id=str(order_data.get('id')),
            shopify_order_number=order_data.get('order_number'),
            items=json.dumps(list(cart.values())),
            status='pending',
            test_order=session.get('test_mode', False)
        )
        db.session.add(db_order)
        db.session.commit()
        
        # Clear cart
        session.pop('cart', None)
        
        return render_template('kiosk/order_complete.html', 
                             order_number=order_number,
                             order_id=order_id)
        
    except Exception as e:
        logging.error(f"Error completing order: {e}")
        flash(get_translation('error'), 'error')
        return redirect(url_for('kiosk_checkout'))

@app.route('/kiosk/wolt-pickup')
def wolt_pickup():
    """Wolt pickup code entry"""
    return render_template('kiosk/wolt_pickup.html')

@app.route('/kiosk/verify_pickup', methods=['POST'])
def verify_pickup():
    """Verify Wolt pickup code"""
    try:
        pickup_code = request.form.get('pickup_code')
        
        # Find order with matching pickup code
        order = models.OrderQueue.query.filter_by(
            pickup_code=pickup_code,
            status='pending',
            order_type='wolt'
        ).first()
        
        if not order:
            flash(get_translation('invalid_code'), 'error')
            return redirect(url_for('wolt_pickup'))
        
        # Update order status to processing
        order.status = 'processing'
        db.session.commit()
        
        # Move to processing queue
        queue_data = {
            "order_id": order.id,
            "order_type": "wolt",
            "shopify_order_id": order.shopify_order_id,
            "shopify_order_number": order.shopify_order_number,
            "items": json.loads(order.items),
            "pickup_code": pickup_code,
            "created_at": order.created_at.isoformat(),
            "processing_at": datetime.now().isoformat()
        }
        
        save_order_to_queue(queue_data, status='processing')
        
        return render_template('kiosk/pickup_confirmed.html', 
                             order_number=order.shopify_order_number)
        
    except Exception as e:
        logging.error(f"Error verifying pickup code: {e}")
        flash(get_translation('error'), 'error')
        return redirect(url_for('wolt_pickup'))

@app.route('/kiosk/test-login')
def test_login():
    """Test user login for development"""
    return render_template('kiosk/test_login.html')

@app.route('/kiosk/authenticate_test', methods=['POST'])
def authenticate_test():
    """Authenticate test user"""
    try:
        username = request.form.get('username')
        pin = request.form.get('pin')
        
        test_user = models.TestUser.query.filter_by(
            username=username,
            pin=pin,
            active=True
        ).first()
        
        if test_user:
            session['test_mode'] = True
            session['test_user'] = username
            flash(f"Test mode activated for {username}", 'success')
            return redirect(url_for('kiosk_products'))
        else:
            flash("Invalid test credentials", 'error')
            return redirect(url_for('test_login'))
            
    except Exception as e:
        logging.error(f"Error in test authentication: {e}")
        flash(get_translation('error'), 'error')
        return redirect(url_for('test_login'))

@app.route('/kiosk/language/<lang>')
def set_language(lang):
    """Set interface language"""
    if lang in ['is', 'en']:
        session['language'] = lang
    return redirect(request.referrer or url_for('kiosk_index'))

# Admin Management Routes
@app.route('/admin')
def admin_dashboard():
    """Main admin dashboard"""
    if not session.get('admin_logged_in'):
        return redirect(url_for('admin_login'))
    
    # Get system statistics
    total_shelves = models.ShelfMapping.query.count()
    active_shelves = models.ShelfMapping.query.filter_by(active=True).count()
    pending_orders = models.OrderQueue.query.filter_by(status='pending').count()
    processing_orders = models.OrderQueue.query.filter_by(status='processing').count()
    
    # Get recent orders
    recent_orders = models.OrderQueue.query.order_by(
        models.OrderQueue.created_at.desc()
    ).limit(10).all()
    
    return render_template('admin/dashboard.html',
                         total_shelves=total_shelves,
                         active_shelves=active_shelves,
                         pending_orders=pending_orders,
                         processing_orders=processing_orders,
                         recent_orders=recent_orders)

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    """Simple admin authentication"""
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = models.User.query.filter_by(username=username, is_admin=True).first()
        
        if user and check_password_hash(user.password_hash, password):
            session['admin_logged_in'] = True
            session['admin_user'] = username
            return redirect(url_for('admin_dashboard'))
        else:
            flash('Invalid credentials', 'error')
    
    return render_template('admin/login.html')

@app.route('/admin/logout')
def admin_logout():
    """Admin logout"""
    session.pop('admin_logged_in', None)
    session.pop('admin_user', None)
    return redirect(url_for('admin_login'))

@app.route('/admin/shelves')
def admin_shelves():
    """Shelf mapping management"""
    if not session.get('admin_logged_in'):
        return redirect(url_for('admin_login'))
    
    shelves = models.ShelfMapping.query.order_by(models.ShelfMapping.shelf_number).all()
    return render_template('admin/shelves.html', shelves=shelves)

@app.route('/admin/shelves/assign', methods=['GET', 'POST'])
def assign_shelf():
    """Visual shelf assignment with Shopify products"""
    if not session.get('admin_logged_in'):
        return redirect(url_for('admin_login'))
    
    if request.method == 'GET':
        # Get products from Shopify location
        products = shopify_client.get_products()
        shelves = models.ShelfMapping.query.all()
        
        # Get product metadata for size compatibility
        metadata = {}
        for product in products:
            meta = models.ProductMetadata.query.filter_by(sku=product.get('sku')).first()
            if meta:
                metadata[product['sku']] = {
                    'box_size': meta.box_size,
                    'max_stack': meta.max_stack
                }
        
        return jsonify({
            'products': products,
            'shelves': [{
                'shelf_number': s.shelf_number,
                'sku': s.sku,
                'product_name': s.product_name,
                'current_stock': s.current_stock,
                'active': s.active
            } for s in shelves],
            'metadata': metadata
        })
    
    # POST - Assign product to shelf
    try:
        shelf_number = int(request.form.get('shelf_number'))
        sku = request.form.get('sku')
        product_name = request.form.get('product_name')
        
        # Get product metadata
        meta = models.ProductMetadata.query.filter_by(sku=sku).first()
        if not meta:
            # Create default metadata
            meta = models.ProductMetadata(
                sku=sku,
                box_size='medium',
                dimensions_cm={'width': 20, 'height': 20, 'depth': 20},
                max_stack=10
            )
            db.session.add(meta)
        
        # Check shelf compatibility
        compatible = check_shelf_compatibility(shelf_number, meta.box_size)
        if not compatible:
            return jsonify({'error': 'Shelf not compatible with product size'}), 400
        
        # Check if shelf exists
        shelf = models.ShelfMapping.query.filter_by(shelf_number=shelf_number).first()
        
        if shelf:
            # Update existing shelf
            shelf.sku = sku
            shelf.product_name = product_name
            shelf.active = True
            shelf.last_updated = datetime.now()
        else:
            # Create new shelf mapping
            shelf = models.ShelfMapping(
                shelf_number=shelf_number,
                sku=sku,
                product_name=product_name,
                current_stock=0,
                active=True
            )
            db.session.add(shelf)
        
        db.session.commit()
        return jsonify({'success': True, 'message': f'Shelf {shelf_number} assigned successfully'})
        
    except Exception as e:
        logging.error(f"Error assigning shelf: {e}")
        return jsonify({'error': str(e)}), 500

def check_shelf_compatibility(shelf_number, box_size):
    """Check if shelf is compatible with product size"""
    # Small products: shelves 1-15
    # Medium products: shelves 16-30
    # Large products: shelves 31-40
    if box_size == 'small':
        return 1 <= shelf_number <= 15
    elif box_size == 'medium':
        return 16 <= shelf_number <= 30
    elif box_size == 'large':
        return 31 <= shelf_number <= 40
    return False

@app.route('/admin/orders')
def admin_orders():
    """Order queue monitoring"""
    if not session.get('admin_logged_in'):
        return redirect(url_for('admin_login'))
    
    status_filter = request.args.get('status', 'all')
    page = int(request.args.get('page', 1))
    per_page = 20
    
    query = models.OrderQueue.query
    
    if status_filter != 'all':
        query = query.filter_by(status=status_filter)
    
    orders = query.order_by(models.OrderQueue.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return render_template('admin/orders.html', 
                         orders=orders, 
                         status_filter=status_filter)

@app.route('/admin/orders/<order_id>/fulfill', methods=['POST'])
def fulfill_order(order_id):
    """Manual fulfillment"""
    if not session.get('admin_logged_in'):
        return redirect(url_for('admin_login'))
    
    try:
        order = models.OrderQueue.query.get_or_404(order_id)
        
        # Update Shopify fulfillment
        if order.shopify_order_id:
            shopify_client.fulfill_order(order.shopify_order_id)
        
        # Update local status
        order.status = 'completed'
        order.completed_at = datetime.now()
        db.session.commit()
        
        flash(f'Order {order.shopify_order_number} fulfilled successfully', 'success')
        
    except Exception as e:
        logging.error(f"Error fulfilling order {order_id}: {e}")
        flash('Error fulfilling order', 'error')
    
    return redirect(url_for('admin_orders'))

@app.route('/admin/products/sync', methods=['POST'])
def sync_products():
    """Force sync products from Shopify"""
    if not session.get('admin_logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        shopify_client.clear_cache()
        products = shopify_client.get_products()
        
        return jsonify({
            'status': 'success',
            'products': len(products),
            'message': f'Successfully synced {len(products)} products from Shopify'
        })
    except Exception as e:
        logging.error(f"Error syncing products: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/orders/<path:filename>')
def serve_order_file(filename):
    """Serve order files for debugging"""
    if not app.debug and not session.get('admin_logged_in'):
        return "Unauthorized", 401
    
    from flask import send_from_directory
    return send_from_directory('orders', filename)

@app.route('/admin/health')
def admin_health():
    """System health dashboard"""
    if not session.get('admin_logged_in'):
        return redirect(url_for('admin_login'))
    
    # Check Shopify connection
    shopify_status = shopify_client.test_connection()
    
    # Get system health metrics
    health_checks = models.SystemHealth.query.order_by(
        models.SystemHealth.last_check.desc()
    ).all()
    
    # Calculate queue metrics
    pending_count = models.OrderQueue.query.filter_by(status='pending').count()
    processing_count = models.OrderQueue.query.filter_by(status='processing').count()
    
    return render_template('admin/health.html',
                         shopify_status=shopify_status,
                         health_checks=health_checks,
                         pending_count=pending_count,
                         processing_count=processing_count)

@app.route('/admin/products/sync', methods=['POST'])
def force_sync():
    """Force Shopify sync"""
    if not session.get('admin_logged_in'):
        return redirect(url_for('admin_login'))
    
    try:
        shopify_client.clear_cache()
        products = shopify_client.get_products()
        flash(f'Synced {len(products)} products from Shopify', 'success')
    except Exception as e:
        logging.error(f"Error syncing products: {e}")
        flash('Error syncing products', 'error')
    
    return redirect(url_for('admin_health'))

# API Endpoints for PLC/Bridge
@app.route('/api/orders/next')
def api_next_order():
    """Get next pending order"""
    try:
        order = models.OrderQueue.query.filter_by(status='pending').order_by(
            models.OrderQueue.created_at
        ).first()
        
        if not order:
            return jsonify({'status': 'no_orders'}), 200
        
        # Update to processing
        order.status = 'processing'
        order.processed_at = datetime.now()
        db.session.commit()
        
        # Get shelf numbers for items
        items = json.loads(order.items)
        shelf_numbers = []
        
        for item in items:
            shelf = models.ShelfMapping.query.filter_by(sku=item['sku'], active=True).first()
            if shelf:
                for _ in range(item['quantity']):
                    shelf_numbers.append(shelf.shelf_number)
        
        return jsonify({
            'status': 'success',
            'order_id': order.id,
            'order_type': order.order_type,
            'shelf_numbers': shelf_numbers,
            'items': items
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting next order: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/orders/<order_id>/complete', methods=['POST'])
def api_complete_order(order_id):
    """Mark order completed"""
    try:
        order = models.OrderQueue.query.get_or_404(order_id)
        
        # Update Shopify fulfillment
        if order.shopify_order_id:
            shopify_client.fulfill_order(order.shopify_order_id)
        
        # Update local status
        order.status = 'completed'
        order.completed_at = datetime.now()
        db.session.commit()
        
        return jsonify({'status': 'success'}), 200
        
    except Exception as e:
        logging.error(f"Error completing order {order_id}: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/orders/<order_id>/status', methods=['POST'])
def api_update_order_status(order_id):
    """Update order status"""
    try:
        order = models.OrderQueue.query.get_or_404(order_id)
        status = request.json.get('status')
        message = request.json.get('message', '')
        
        order.status = status
        if status == 'completed':
            order.completed_at = datetime.now()
        elif status == 'processing':
            order.processed_at = datetime.now()
            
        db.session.commit()
        
        return jsonify({'status': 'success'}), 200
        
    except Exception as e:
        logging.error(f"Error updating order status {order_id}: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/health')
def api_health():
    """System health check"""
    try:
        # Basic health metrics
        pending_orders = models.OrderQueue.query.filter_by(status='pending').count()
        processing_orders = models.OrderQueue.query.filter_by(status='processing').count()
        shopify_status = shopify_client.test_connection()
        
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'pending_orders': pending_orders,
            'processing_orders': processing_orders,
            'shopify_connected': shopify_status['connected'],
            'database_connected': True
        }), 200
        
    except Exception as e:
        logging.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'unhealthy',
            'timestamp': datetime.now().isoformat(),
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
