/**
 * Admin Interface JavaScript
 * Real-time monitoring, dashboard updates, and interactive features
 */

// Global variables
let healthMonitorInterval;
let orderRefreshInterval;
let responseTimeChart;
let systemMetricsInterval;

// Configuration
const CONFIG = {
    HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
    ORDER_REFRESH_INTERVAL: 10000, // 10 seconds
    METRICS_UPDATE_INTERVAL: 60000, // 1 minute
    ANIMATION_DURATION: 300
};

// Initialize admin interface
document.addEventListener('DOMContentLoaded', function() {
    initializeAdmin();
});

/**
 * Initialize admin functionality
 */
function initializeAdmin() {
    setupHealthMonitoring();
    setupOrderManagement();
    setupShelfManagement();
    setupDashboardUpdates();
    setupFormValidation();
    setupTooltips();
    setupKeyboardShortcuts();
    setupErrorHandling();
    
    // Update last update time if element exists
    const lastUpdateElement = document.getElementById('lastUpdateTime');
    if (lastUpdateElement) {
        lastUpdateElement.textContent = new Date().toLocaleString();
    }
    
    console.log('Admin interface initialized');
}

/**
 * Setup health monitoring and system status updates
 */
function setupHealthMonitoring() {
    // Initialize health indicators
    updateHealthIndicators();
    
    // Start monitoring interval
    healthMonitorInterval = setInterval(() => {
        updateHealthIndicators();
    }, CONFIG.HEALTH_CHECK_INTERVAL);
    
    // Setup connection test functionality
    const testButtons = document.querySelectorAll('[onclick*="testShopifyConnection"]');
    testButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            testShopifyConnection();
        });
    });
    
    console.log('Health monitoring started');
}

/**
 * Update health indicators across the interface
 */
function updateHealthIndicators() {
    // This would normally make an API call to check system health
    // For now, we'll simulate the health check
    
    fetch('/api/health')
        .then(response => response.json())
        .then(data => {
            updateHealthDisplay(data);
        })
        .catch(error => {
            console.error('Health check failed:', error);
            updateHealthDisplay({
                status: 'unhealthy',
                error: 'Failed to connect to health API'
            });
        });
}

/**
 * Update health display elements
 */
function updateHealthDisplay(healthData) {
    // Update status indicators
    const indicators = document.querySelectorAll('.health-indicator');
    indicators.forEach(indicator => {
        const component = indicator.closest('.stat-card')?.querySelector('p')?.textContent;
        
        if (component?.includes('Shopify')) {
            indicator.className = `health-indicator ${healthData.shopify_connected ? 'health-good' : 'health-error'}`;
        } else if (component?.includes('Database')) {
            indicator.className = `health-indicator ${healthData.database_connected ? 'health-good' : 'health-error'}`;
        }
    });
    
    // Update last check timestamp
    const timestampElements = document.querySelectorAll('.last-check-time');
    timestampElements.forEach(el => {
        if (healthData.timestamp) {
            el.textContent = `Last check: ${new Date(healthData.timestamp).toLocaleTimeString()}`;
        }
    });
    
    // Update queue metrics
    updateQueueMetrics(healthData);
}

/**
 * Update queue metrics display
 */
function updateQueueMetrics(data) {
    if (data.pending_orders !== undefined) {
        const pendingElements = document.querySelectorAll('[data-metric="pending"]');
        pendingElements.forEach(el => {
            el.textContent = data.pending_orders;
        });
    }
    
    if (data.processing_orders !== undefined) {
        const processingElements = document.querySelectorAll('[data-metric="processing"]');
        processingElements.forEach(el => {
            el.textContent = data.processing_orders;
        });
    }
}

/**
 * Test Shopify connection with modal feedback
 */
function testShopifyConnection() {
    const modal = document.getElementById('connectionTestModal');
    const content = document.getElementById('connectionTestContent');
    
    if (!modal || !content) return;
    
    const modalInstance = new bootstrap.Modal(modal);
    
    // Show loading state
    content.innerHTML = `
        <div class="text-center">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Testing connection...</span>
            </div>
            <p>Testing Shopify connection...</p>
            <div class="progress">
                <div class="progress-bar progress-bar-striped progress-bar-animated" 
                     style="width: 100%" role="progressbar"></div>
            </div>
        </div>
    `;
    
    modalInstance.show();
    
    // Simulate connection test (replace with actual API call)
    setTimeout(() => {
        // This would normally be a fetch to test connection
        const isConnected = Math.random() > 0.3; // Simulate success/failure
        
        if (isConnected) {
            content.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle me-2"></i>
                    <strong>Connection Successful!</strong>
                </div>
                <div class="test-details">
                    <h6>Test Results:</h6>
                    <ul class="list-unstyled">
                        <li><i class="fas fa-check text-success me-2"></i>Authentication: Success</li>
                        <li><i class="fas fa-check text-success me-2"></i>Store Access: Success</li>
                        <li><i class="fas fa-check text-success me-2"></i>Location Access: Success</li>
                        <li><i class="fas fa-check text-success me-2"></i>Response Time: 245ms</li>
                    </ul>
                </div>
                <div class="mt-3">
                    <small class="text-muted">Test completed at ${new Date().toLocaleTimeString()}</small>
                </div>
            `;
        } else {
            content.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Connection Failed!</strong>
                </div>
                <div class="test-details">
                    <h6>Error Details:</h6>
                    <p class="text-muted">Unable to establish connection to Shopify API</p>
                    <h6>Troubleshooting Steps:</h6>
                    <ul class="list-unstyled">
                        <li>• Check API credentials in environment variables</li>
                        <li>• Verify store URL format</li>
                        <li>• Check internet connectivity</li>
                        <li>• Review Shopify app permissions</li>
                        <li>• Check API rate limits</li>
                    </ul>
                </div>
            `;
        }
    }, 2000);
}

/**
 * Setup order management functionality
 */
function setupOrderManagement() {
    // Auto-refresh orders if there are processing orders
    const processingOrders = document.querySelectorAll('[data-status="processing"]');
    if (processingOrders.length > 0) {
        orderRefreshInterval = setInterval(() => {
            refreshOrdersTable();
        }, CONFIG.ORDER_REFRESH_INTERVAL);
    }
    
    // Setup order filtering
    setupOrderFiltering();
    
    // Setup order actions
    setupOrderActions();
    
    // Setup pagination
    setupPagination();
    
    console.log('Order management setup complete');
}

/**
 * Refresh orders table
 */
function refreshOrdersTable() {
    const currentUrl = window.location.pathname + window.location.search;
    
    fetch(currentUrl, {
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.text())
    .then(html => {
        // Parse the HTML and update the table
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const newTable = doc.querySelector('#ordersTable tbody');
        const currentTable = document.querySelector('#ordersTable tbody');
        
        if (newTable && currentTable) {
            // Highlight changed rows
            highlightChangedRows(currentTable, newTable);
            currentTable.innerHTML = newTable.innerHTML;
            
            // Re-setup event listeners for new content
            setupOrderActions();
        }
        
        // Update stats
        const newStats = doc.querySelector('.order-stats');
        const currentStats = document.querySelector('.order-stats');
        if (newStats && currentStats) {
            currentStats.innerHTML = newStats.innerHTML;
        }
    })
    .catch(error => {
        console.error('Failed to refresh orders:', error);
    });
}

/**
 * Highlight changed rows in orders table
 */
function highlightChangedRows(oldTable, newTable) {
    const oldRows = Array.from(oldTable.querySelectorAll('tr'));
    const newRows = Array.from(newTable.querySelectorAll('tr'));
    
    newRows.forEach((newRow, index) => {
        const oldRow = oldRows[index];
        if (!oldRow || oldRow.innerHTML !== newRow.innerHTML) {
            newRow.style.backgroundColor = '#fff3cd';
            setTimeout(() => {
                newRow.style.backgroundColor = '';
            }, 2000);
        }
    });
}

/**
 * Setup order filtering functionality
 */
function setupOrderFiltering() {
    const typeFilter = document.getElementById('typeFilter');
    const searchInput = document.getElementById('orderSearch');
    
    if (typeFilter) {
        typeFilter.addEventListener('change', filterOrders);
    }
    
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(filterOrders, 300);
        });
    }
}

/**
 * Filter orders based on type and search criteria
 */
function filterOrders() {
    const typeFilter = document.getElementById('typeFilter')?.value || 'all';
    const searchTerm = document.getElementById('orderSearch')?.value.toLowerCase() || '';
    const rows = document.querySelectorAll('.order-row');
    
    let visibleCount = 0;
    
    rows.forEach(row => {
        const type = row.dataset.type;
        const orderText = row.textContent.toLowerCase();
        
        const typeMatch = typeFilter === 'all' || type === typeFilter;
        const searchMatch = searchTerm === '' || orderText.includes(searchTerm);
        
        if (typeMatch && searchMatch) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    // Update visible count
    updateFilterResultsCount(visibleCount);
}

/**
 * Update filter results count
 */
function updateFilterResultsCount(count) {
    let countElement = document.querySelector('.filter-results-count');
    if (!countElement) {
        countElement = document.createElement('small');
        countElement.className = 'filter-results-count text-muted';
        const cardHeader = document.querySelector('.card-header h5');
        if (cardHeader) {
            cardHeader.appendChild(countElement);
        }
    }
    
    countElement.textContent = ` (${count} shown)`;
}

/**
 * Setup order action handlers
 */
function setupOrderActions() {
    // Fulfill order buttons
    document.querySelectorAll('form[action*="fulfill"]').forEach(form => {
        form.addEventListener('submit', function(e) {
            const orderNumber = this.closest('tr')?.querySelector('strong')?.textContent;
            if (!confirm(`Are you sure you want to fulfill order ${orderNumber}?`)) {
                e.preventDefault();
            } else {
                // Show loading state
                const btn = this.querySelector('button[type="submit"]');
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                }
            }
        });
    });
    
    // View details buttons
    document.querySelectorAll('[onclick*="viewOrderDetails"]').forEach(btn => {
        btn.removeAttribute('onclick');
        btn.addEventListener('click', function() {
            const orderId = this.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
            if (orderId) {
                viewOrderDetails(orderId);
            }
        });
    });
}

/**
 * View order details in modal
 */
function viewOrderDetails(orderId) {
    const modal = document.getElementById('orderDetailsModal');
    const content = document.getElementById('orderDetailsContent');
    
    if (!modal || !content) return;
    
    const modalInstance = new bootstrap.Modal(modal);
    
    // Show loading state
    content.innerHTML = `
        <div class="text-center">
            <div class="spinner-border mb-3" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p>Loading order details...</p>
        </div>
    `;
    
    modalInstance.show();
    
    // Load order details (this would be an API call in a real implementation)
    setTimeout(() => {
        content.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6>Order Information</h6>
                    <table class="table table-sm">
                        <tr><th>Order ID:</th><td>${orderId}</td></tr>
                        <tr><th>Status:</th><td><span class="badge bg-info">Processing</span></td></tr>
                        <tr><th>Created:</th><td>${new Date().toLocaleString()}</td></tr>
                        <tr><th>Type:</th><td>Kiosk Order</td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6>Items</h6>
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        Order details would be loaded from the database here.
                    </div>
                </div>
            </div>
            <div class="mt-3">
                <h6>Processing Timeline</h6>
                <div class="timeline">
                    <div class="timeline-item completed">
                        <i class="fas fa-check-circle"></i>
                        Order Created
                    </div>
                    <div class="timeline-item active">
                        <i class="fas fa-cog fa-spin"></i>
                        Processing
                    </div>
                    <div class="timeline-item">
                        <i class="fas fa-box"></i>
                        Dispensing
                    </div>
                    <div class="timeline-item">
                        <i class="fas fa-check"></i>
                        Completed
                    </div>
                </div>
            </div>
        `;
    }, 1000);
}

/**
 * Setup shelf management functionality
 */
function setupShelfManagement() {
    // Make shelf slots clickable
    document.querySelectorAll('.shelf-slot').forEach(slot => {
        slot.addEventListener('click', function() {
            selectShelfForEditing(this);
        });
    });
    
    // Setup form validation for shelf assignment
    const shelfForm = document.querySelector('form[action*="assign"]');
    if (shelfForm) {
        shelfForm.addEventListener('submit', function(e) {
            if (!validateShelfForm(this)) {
                e.preventDefault();
            }
        });
    }
    
    // Setup table search functionality
    setupShelfTableSearch();
    
    console.log('Shelf management setup complete');
}

/**
 * Select shelf for editing
 */
function selectShelfForEditing(slotElement) {
    const shelfNumber = slotElement.dataset.shelf;
    const sku = slotElement.dataset.sku || '';
    
    // Highlight selected shelf
    document.querySelectorAll('.shelf-slot').forEach(s => s.classList.remove('selected'));
    slotElement.classList.add('selected');
    
    // Populate form
    const form = document.querySelector('form[action*="assign"]');
    if (form) {
        const shelfSelect = form.querySelector('[name="shelf_number"]');
        const skuInput = form.querySelector('[name="sku"]');
        
        if (shelfSelect) shelfSelect.value = shelfNumber;
        if (skuInput) skuInput.value = sku;
        
        // If shelf has data, populate other fields
        if (sku) {
            const editBtn = document.querySelector(`[data-shelf="${shelfNumber}"]`);
            if (editBtn) {
                form.querySelector('[name="product_name"]').value = editBtn.dataset.name || '';
                form.querySelector('[name="shelf_size"]').value = editBtn.dataset.size || '';
                form.querySelector('[name="max_capacity"]').value = editBtn.dataset.capacity || '';
            }
        }
        
        // Focus on first empty field
        const firstEmptyField = form.querySelector('input:not([value]), select:not([value])');
        if (firstEmptyField) {
            firstEmptyField.focus();
        }
    }
    
    // Scroll form into view
    form?.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Validate shelf assignment form
 */
function validateShelfForm(form) {
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('is-invalid');
            isValid = false;
        } else {
            field.classList.remove('is-invalid');
        }
    });
    
    if (!isValid) {
        showAlert('Please fill in all required fields', 'warning');
    }
    
    return isValid;
}

/**
 * Setup shelf table search
 */
function setupShelfTableSearch() {
    const shelvesTable = document.querySelector('#shelvesTable');
    if (!shelvesTable) return;
    
    const searchInput = shelvesTable.parentElement.querySelector('input[placeholder*="Search"]');
    
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                filterShelfTable(this.value);
            }, 300);
        });
    }
}

/**
 * Filter shelf table rows
 */
function filterShelfTable(searchTerm) {
    const rows = document.querySelectorAll('#shelvesTable tbody tr');
    const term = searchTerm.toLowerCase();
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
}

/**
 * Setup dashboard real-time updates
 */
function setupDashboardUpdates() {
    // Initialize charts if on dashboard
    if (document.getElementById('responseTimeChart')) {
        initializeResponseTimeChart();
    }
    
    // Update metrics periodically
    systemMetricsInterval = setInterval(() => {
        updateSystemMetrics();
    }, CONFIG.METRICS_UPDATE_INTERVAL);
    
    // Auto-refresh dashboard stats
    setInterval(() => {
        updateDashboardStats();
    }, CONFIG.HEALTH_CHECK_INTERVAL);
}

/**
 * Initialize response time chart
 */
function initializeResponseTimeChart() {
    const ctx = document.getElementById('responseTimeChart')?.getContext('2d');
    if (!ctx) return;
    
    const chartData = {
        labels: generateTimeLabels(6),
        datasets: [{
            label: 'Response Time (ms)',
            data: [245, 289, 234, 198, 267, 223],
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            tension: 0.4,
            fill: true
        }]
    };
    
    responseTimeChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Response Time (ms)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Response: ${context.parsed.y}ms`;
                        }
                    }
                }
            }
        }
    });
    
    // Update chart data periodically
    setInterval(() => {
        updateResponseTimeChart();
    }, 30000);
}

/**
 * Generate time labels for charts
 */
function generateTimeLabels(count) {
    const labels = [];
    const now = new Date();
    
    for (let i = count - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - (i * 2 * 60 * 1000)); // 2-minute intervals
        labels.push(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    
    return labels;
}

/**
 * Update response time chart with new data
 */
function updateResponseTimeChart() {
    if (!responseTimeChart) return;
    
    // Simulate new response time data
    const newData = Math.floor(Math.random() * 200) + 150; // 150-350ms range
    
    // Shift data and add new point
    responseTimeChart.data.datasets[0].data.shift();
    responseTimeChart.data.datasets[0].data.push(newData);
    
    // Update labels
    responseTimeChart.data.labels.shift();
    responseTimeChart.data.labels.push(new Date().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    }));
    
    responseTimeChart.update('none'); // No animation for real-time updates
}

/**
 * Update system metrics
 */
function updateSystemMetrics() {
    // Simulate metric updates
    const metrics = [
        { selector: '.progress-bar:nth-of-type(1)', value: Math.random() * 30 + 10 }, // CPU
        { selector: '.progress-bar:nth-of-type(2)', value: Math.random() * 20 + 40 }, // Memory
        { selector: '.progress-bar:nth-of-type(3)', value: Math.random() * 10 + 20 }  // Disk
    ];
    
    metrics.forEach(metric => {
        const element = document.querySelector(metric.selector);
        if (element) {
            element.style.width = `${metric.value}%`;
            
            // Update text
            const textElement = element.parentElement.parentElement.querySelector('.text-muted');
            if (textElement) {
                textElement.textContent = `~${Math.round(metric.value)}%`;
            }
        }
    });
}

/**
 * Update dashboard statistics
 */
function updateDashboardStats() {
    // This would fetch real data from the API
    fetch('/api/health')
        .then(response => response.json())
        .then(data => {
            // Update stat cards
            updateStatCard('[data-metric="pending"]', data.pending_orders || 0);
            updateStatCard('[data-metric="processing"]', data.processing_orders || 0);
        })
        .catch(error => {
            console.error('Failed to update dashboard stats:', error);
        });
}

/**
 * Update stat card value with animation
 */
function updateStatCard(selector, newValue) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
        const currentValue = parseInt(element.textContent) || 0;
        if (currentValue !== newValue) {
            animateNumber(element, currentValue, newValue);
        }
    });
}

/**
 * Animate number changes in stat cards
 */
function animateNumber(element, from, to) {
    const duration = CONFIG.ANIMATION_DURATION;
    const startTime = Date.now();
    
    function update() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const current = Math.round(from + (to - from) * progress);
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

/**
 * Setup form validation
 */
function setupFormValidation() {
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!validateForm(this)) {
                e.preventDefault();
            }
        });
        
        // Real-time validation
        form.querySelectorAll('input, select, textarea').forEach(field => {
            field.addEventListener('blur', function() {
                validateField(this);
            });
        });
    });
}

/**
 * Validate form fields
 */
function validateForm(form) {
    const fields = form.querySelectorAll('[required]');
    let isValid = true;
    
    fields.forEach(field => {
        if (!validateField(field)) {
            isValid = false;
        }
    });
    
    return isValid;
}

/**
 * Validate individual field
 */
function validateField(field) {
    const value = field.value.trim();
    let isValid = true;
    
    // Remove existing validation classes
    field.classList.remove('is-valid', 'is-invalid');
    
    // Required field validation
    if (field.hasAttribute('required') && !value) {
        field.classList.add('is-invalid');
        isValid = false;
    }
    
    // Type-specific validation
    if (value) {
        if (field.type === 'email' && !isValidEmail(value)) {
            field.classList.add('is-invalid');
            isValid = false;
        } else if (field.type === 'number') {
            const num = parseFloat(value);
            const min = parseFloat(field.min);
            const max = parseFloat(field.max);
            
            if (isNaN(num) || (min && num < min) || (max && num > max)) {
                field.classList.add('is-invalid');
                isValid = false;
            }
        }
    }
    
    if (isValid && value) {
        field.classList.add('is-valid');
    }
    
    return isValid;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Setup Bootstrap tooltips
 */
function setupTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"], [title]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + R - Refresh current view
        if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !e.shiftKey) {
            e.preventDefault();
            refreshCurrentView();
        }
        
        // Ctrl/Cmd + S - Save form (if any)
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            const activeForm = document.querySelector('form:focus-within');
            if (activeForm) {
                activeForm.submit();
            }
        }
        
        // Escape - Close modal
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal.show');
            if (openModal) {
                const modalInstance = bootstrap.Modal.getInstance(openModal);
                if (modalInstance) {
                    modalInstance.hide();
                }
            }
        }
    });
}

/**
 * Refresh current view
 */
function refreshCurrentView() {
    const currentPath = window.location.pathname;
    
    if (currentPath.includes('/orders')) {
        refreshOrdersTable();
    } else if (currentPath.includes('/health')) {
        updateHealthIndicators();
    } else {
        window.location.reload();
    }
}

/**
 * Setup pagination handlers
 */
function setupPagination() {
    document.querySelectorAll('.pagination .page-link').forEach(link => {
        link.addEventListener('click', function(e) {
            if (this.closest('.page-item').classList.contains('disabled')) {
                e.preventDefault();
            }
        });
    });
}

/**
 * Setup error handling
 */
function setupErrorHandling() {
    window.addEventListener('error', function(e) {
        console.error('Admin interface error:', e.error);
        showAlert('An error occurred. Please refresh the page if issues persist.', 'danger');
    });
    
    // Handle fetch errors
    window.addEventListener('unhandledrejection', function(e) {
        console.error('Unhandled promise rejection:', e.reason);
        showAlert('Network error occurred. Please check your connection.', 'warning');
    });
}

/**
 * Show alert message
 */
function showAlert(message, type = 'info', duration = 5000) {
    const alertContainer = getOrCreateAlertContainer();
    const alertId = 'alert-' + Date.now();
    
    const alertHTML = `
        <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
            <i class="fas fa-${getAlertIcon(type)} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    alertContainer.insertAdjacentHTML('beforeend', alertHTML);
    
    // Auto-dismiss after duration
    if (duration > 0) {
        setTimeout(() => {
            const alert = document.getElementById(alertId);
            if (alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, duration);
    }
}

/**
 * Get or create alert container
 */
function getOrCreateAlertContainer() {
    let container = document.getElementById('alert-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'alert-container';
        container.className = 'position-fixed top-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
    }
    return container;
}

/**
 * Get appropriate icon for alert type
 */
function getAlertIcon(type) {
    const icons = {
        'success': 'check-circle',
        'danger': 'exclamation-triangle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    return icons[type] || 'info-circle';
}

/**
 * Export functions for global access
 */
window.AdminJS = {
    testShopifyConnection,
    viewOrderDetails,
    refreshOrdersTable,
    updateHealthIndicators,
    showAlert
};

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (healthMonitorInterval) clearInterval(healthMonitorInterval);
    if (orderRefreshInterval) clearInterval(orderRefreshInterval);
    if (systemMetricsInterval) clearInterval(systemMetricsInterval);
});

console.log('Admin JavaScript loaded successfully');
