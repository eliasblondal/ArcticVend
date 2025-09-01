# Overview

This is an automated alcohol retail kiosk system designed for Iceland, featuring a touch-friendly McDonald's-style interface for customers and a comprehensive admin panel for store management. The system integrates with Shopify for inventory and order management, uses a robot for product dispensing, and handles both direct kiosk sales and Wolt pickup orders with multilingual support (Icelandic/English).

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Web Framework and Backend
- **Flask** as the core web framework with SQLAlchemy ORM for database operations
- **SQLite** database for local data storage (shelf mappings, order queue, system health)
- **Session-based authentication** for admin users with simple username/password credentials
- **JSON file-based order queue** system for processing orders asynchronously

## Frontend Architecture
- **Bootstrap 5** for responsive UI components with custom CSS for kiosk-specific styling
- **Touch-optimized interface** designed like McDonald's kiosks with large buttons and clear navigation
- **Multilingual support** with Icelandic and English language switching
- **Real-time dashboard** using Chart.js for admin monitoring with automatic refresh intervals

## Database Design
The system uses three main database tables:
- **shelf_mappings**: Tracks 40 physical shelves with SKU assignments, stock levels, and capacity constraints
- **order_queue**: Manages order processing workflow with status tracking (pending/processing/completed/failed)
- **system_health**: Monitors component status for troubleshooting and maintenance

## Order Processing Workflow
- Orders flow through a **JSON file-based queue system** organized by status directories
- **Automatic order numbering** with timestamp-based unique identifiers
- **Dual order types** supporting both direct kiosk purchases and Wolt delivery pickups
- **Test mode functionality** for development and debugging without affecting live inventory

## Admin Management System
- **Real-time monitoring dashboard** with system health indicators and order statistics
- **Shelf management interface** for assigning products to physical shelf locations
- **Order tracking system** with filtering, search, and export capabilities
- **Health monitoring** for Shopify connection status and system component checks

# External Dependencies

## Shopify Integration
- **Shopify Admin API** (REST and GraphQL) for product catalog and inventory management
- **Product caching system** with 5-minute refresh intervals to minimize API calls
- **Order creation workflow** that syncs kiosk purchases with Shopify order management
- **Location-based inventory tracking** using Shopify location IDs for stock management

## Third-Party Services
- **Bootstrap 5 CDN** for UI components and responsive design
- **Font Awesome CDN** for consistent iconography throughout the interface  
- **Chart.js CDN** for admin dashboard analytics and real-time monitoring graphs

## Future Integration Placeholders
- **Audkenni integration** (Icelandic identity verification service) with placeholder client credentials
- **Robot dispensing system** integration points built into the order processing workflow
- **Webhook endpoints** prepared for Shopify order status updates and inventory changes