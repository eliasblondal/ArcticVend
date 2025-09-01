import requests
import json
import logging
from datetime import datetime, timedelta
from config import Config
import os

class ShopifyClient:
    """Shopify API client for product and order management"""
    
    def __init__(self):
        self.store_url = os.environ.get('SHOPIFY_STORE_URL', 'your-store.myshopify.com')
        self.access_token = os.environ.get('SHOPIFY_ACCESS_TOKEN', 'your-token')
        self.api_version = os.environ.get('SHOPIFY_API_VERSION', '2024-01')
        self.location_id = os.environ.get('SHOPIFY_LOCATION_ID', '109514817905')
        
        self.base_url = f'https://{self.store_url}/admin/api/{self.api_version}'
        self.graphql_url = f'https://{self.store_url}/admin/api/{self.api_version}/graphql.json'
        
        self.headers = {
            'X-Shopify-Access-Token': self.access_token,
            'Content-Type': 'application/json'
        }
        
        self._product_cache = {}
        self._cache_timestamp = None
        self._cache_duration = 300  # 5 minutes
        
        logging.info(f"Initialized Shopify client for store: {self.store_url}")
    
    def test_connection(self):
        """Test Shopify API connection"""
        try:
            response = requests.get(f'{self.base_url}/shop.json', headers=self.headers, timeout=10)
            
            if response.status_code == 200:
                shop_data = response.json()
                return {
                    'connected': True,
                    'shop_name': shop_data['shop']['name'],
                    'timestamp': datetime.now().isoformat()
                }
            else:
                logging.error(f"Shopify connection failed: {response.status_code}")
                return {
                    'connected': False,
                    'error': f'HTTP {response.status_code}',
                    'timestamp': datetime.now().isoformat()
                }
                
        except Exception as e:
            logging.error(f"Shopify connection error: {e}")
            return {
                'connected': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def clear_cache(self):
        """Clear product cache"""
        self._product_cache = {}
        self._cache_timestamp = None
        logging.info("Product cache cleared")
    
    def get_products(self):
        """Get products with inventory from kiosk location using GraphQL"""
        try:
            # Check cache first
            if self._is_cache_valid():
                logging.debug("Returning cached products")
                return list(self._product_cache.values())
            
            # GraphQL query to get products with inventory at location
            query = """
            query getProductsWithInventory($locationId: ID!) {
                location(id: $locationId) {
                    inventoryLevels(first: 100) {
                        edges {
                            node {
                                available
                                item {
                                    sku
                                    variant {
                                        id
                                        title
                                        price
                                        product {
                                            id
                                            title
                                            description
                                            images(first: 1) {
                                                edges {
                                                    node {
                                                        url
                                                        altText
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            """
            
            variables = {
                "locationId": f"gid://shopify/Location/{self.location_id}"
            }
            
            response = requests.post(
                self.graphql_url,
                headers=self.headers,
                json={'query': query, 'variables': variables},
                timeout=30
            )
            
            if response.status_code != 200:
                logging.error(f"GraphQL query failed: {response.status_code} - {response.text}")
                return []
            
            data = response.json()
            
            if 'errors' in data:
                logging.error(f"GraphQL errors: {data['errors']}")
                return []
            
            # Process the response
            products = []
            inventory_levels = data['data']['location']['inventoryLevels']['edges']
            
            for edge in inventory_levels:
                node = edge['node']
                available = node['available']
                
                # Only show products with available inventory
                if available > 0:
                    item = node['item']
                    variant = item['variant']
                    product = variant['product']
                    
                    # Get product image
                    image_url = None
                    if product['images']['edges']:
                        image_url = product['images']['edges'][0]['node']['url']
                    
                    product_data = {
                        'id': variant['id'].split('/')[-1],  # Extract numeric ID
                        'sku': item['sku'],
                        'title': product['title'],
                        'variant_title': variant['title'],
                        'description': product['description'],
                        'price': float(variant['price']),
                        'available': available,
                        'image_url': image_url
                    }
                    
                    products.append(product_data)
                    self._product_cache[product_data['id']] = product_data
            
            self._cache_timestamp = datetime.now()
            logging.info(f"Retrieved {len(products)} products with available inventory")
            return products
            
        except Exception as e:
            logging.error(f"Error fetching products: {e}")
            return []
    
    def _is_cache_valid(self):
        """Check if product cache is still valid"""
        if not self._cache_timestamp or not self._product_cache:
            return False
        
        return (datetime.now() - self._cache_timestamp).seconds < self._cache_duration
    
    def create_order(self, cart_items, order_type='kiosk'):
        """Create order in Shopify"""
        try:
            # Prepare line items
            line_items = []
            for product_id, item in cart_items.items():
                line_items.append({
                    'variant_id': int(product_id),
                    'quantity': item['quantity'],
                    'price': str(item['price'])
                })
            
            # Prepare order data
            order_data = {
                'order': {
                    'line_items': line_items,
                    'financial_status': 'paid',
                    'fulfillment_status': None,
                    'location_id': int(self.location_id),
                    'tags': f'{order_type}-order',
                    'note': f'Order created via {order_type} interface',
                    'source_name': 'kiosk'
                }
            }
            
            response = requests.post(
                f'{self.base_url}/orders.json',
                headers=self.headers,
                json=order_data,
                timeout=30
            )
            
            if response.status_code == 201:
                order = response.json()['order']
                logging.info(f"Created Shopify order: {order['order_number']}")
                return order
            else:
                logging.error(f"Failed to create order: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logging.error(f"Error creating order: {e}")
            return None
    
    def fulfill_order(self, order_id):
        """Mark order as fulfilled in Shopify"""
        try:
            # Get order details first
            response = requests.get(
                f'{self.base_url}/orders/{order_id}.json',
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code != 200:
                logging.error(f"Failed to get order {order_id}: {response.status_code}")
                return False
            
            order = response.json()['order']
            
            # Create fulfillment
            line_items = []
            for item in order['line_items']:
                line_items.append({
                    'id': item['id'],
                    'quantity': item['quantity']
                })
            
            fulfillment_data = {
                'fulfillment': {
                    'location_id': int(self.location_id),
                    'tracking_number': None,
                    'line_items': line_items,
                    'notify_customer': False
                }
            }
            
            response = requests.post(
                f'{self.base_url}/orders/{order_id}/fulfillments.json',
                headers=self.headers,
                json=fulfillment_data,
                timeout=30
            )
            
            if response.status_code == 201:
                logging.info(f"Fulfilled order {order_id}")
                return True
            else:
                logging.error(f"Failed to fulfill order {order_id}: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logging.error(f"Error fulfilling order {order_id}: {e}")
            return False
    
    def get_order(self, order_id):
        """Get order details from Shopify"""
        try:
            response = requests.get(
                f'{self.base_url}/orders/{order_id}.json',
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()['order']
            else:
                logging.error(f"Failed to get order {order_id}: {response.status_code}")
                return None
                
        except Exception as e:
            logging.error(f"Error getting order {order_id}: {e}")
            return None
