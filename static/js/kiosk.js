/**
 * Kiosk Interface JavaScript
 * Touch-friendly interactions for McDonald's-style interface
 */

// Global variables
let inactivityTimer;
let cartUpdateTimer;
const INACTIVITY_TIMEOUT = 300000; // 5 minutes
const CART_UPDATE_INTERVAL = 1000; // 1 second

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeKiosk();
});

/**
 * Initialize kiosk functionality
 */
function initializeKiosk() {
    setupTouchInteractions();
    setupInactivityTimer();
    setupCartUpdates();
    setupFormValidation();
    setupAccessibility();
    updateCurrentTime();
    
    console.log('Kiosk interface initialized');
}

/**
 * Setup touch-friendly interactions
 */
function setupTouchInteractions() {
    // Add touch feedback to all buttons
    const touchElements = document.querySelectorAll('.btn, .product-card, .payment-method, .shelf-slot');
    
    touchElements.forEach(element => {
        // Touch start - visual feedback
        element.addEventListener('touchstart', function(e) {
            this.classList.add('touch-active');
            this.style.transform = 'scale(0.98)';
        }, { passive: true });
        
        // Touch end - remove feedback
        element.addEventListener('touchend', function(e) {
            this.classList.remove('touch-active');
            this.style.transform = '';
            
            // Add ripple effect for buttons
            if (this.classList.contains('btn')) {
                addRippleEffect(this, e);
            }
        }, { passive: true });
        
        // Touch cancel - cleanup
        element.addEventListener('touchcancel', function(e) {
            this.classList.remove('touch-active');
            this.style.transform = '';
        }, { passive: true });
    });
    
    // Prevent double-tap zoom on iOS
    document.addEventListener('touchstart', function(e) {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });
    
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(e) {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
}

/**
 * Add ripple effect to buttons
 */
function addRippleEffect(element, event) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    
    let x, y;
    if (event.type === 'touchend' && event.changedTouches) {
        x = event.changedTouches[0].clientX - rect.left - size / 2;
        y = event.changedTouches[0].clientY - rect.top - size / 2;
    } else {
        x = rect.width / 2 - size / 2;
        y = rect.height / 2 - size / 2;
    }
    
    ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        transform: scale(0);
        animation: ripple 0.6s linear;
        left: ${x}px;
        top: ${y}px;
        width: ${size}px;
        height: ${size}px;
        pointer-events: none;
    `;
    
    // Add ripple animation CSS if not exists
    if (!document.getElementById('ripple-style')) {
        const style = document.createElement('style');
        style.id = 'ripple-style';
        style.textContent = `
            @keyframes ripple {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
    
    // Remove ripple after animation
    setTimeout(() => {
        if (ripple.parentNode) {
            ripple.parentNode.removeChild(ripple);
        }
    }, 600);
}

/**
 * Setup inactivity timer for auto-refresh
 */
function setupInactivityTimer() {
    function resetTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            // Only redirect to home if not on admin pages
            if (!window.location.pathname.startsWith('/admin')) {
                window.location.href = '/kiosk';
            }
        }, INACTIVITY_TIMEOUT);
    }
    
    // Reset timer on user interactions
    ['click', 'touchstart', 'mousemove', 'keypress', 'scroll'].forEach(event => {
        document.addEventListener(event, resetTimer, { passive: true });
    });
    
    resetTimer(); // Start timer
}

/**
 * Setup cart updates and management
 */
function setupCartUpdates() {
    // Update cart badge count
    function updateCartBadge() {
        const cartLinks = document.querySelectorAll('a[href*="cart"]');
        const cartItems = document.querySelectorAll('.cart-item').length;
        
        cartLinks.forEach(link => {
            let badge = link.querySelector('.badge');
            if (cartItems > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger';
                    link.style.position = 'relative';
                    link.appendChild(badge);
                }
                badge.textContent = cartItems;
            } else if (badge) {
                badge.remove();
            }
        });
    }
    
    // Quantity controls for products
    document.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.dataset.action;
            const input = this.parentElement.querySelector('.qty-input');
            const current = parseInt(input.value) || 1;
            const max = parseInt(input.max) || 999;
            
            if (action === 'increase' && current < max) {
                input.value = current + 1;
                announceToScreenReader(`Quantity increased to ${current + 1}`);
            } else if (action === 'decrease' && current > 1) {
                input.value = current - 1;
                announceToScreenReader(`Quantity decreased to ${current - 1}`);
            }
            
            // Trigger input event for any listeners
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
    });
    
    // Auto-save cart changes
    document.querySelectorAll('.qty-input').forEach(input => {
        input.addEventListener('change', function() {
            const value = Math.max(1, Math.min(parseInt(this.value) || 1, parseInt(this.max) || 999));
            this.value = value;
            
            // Auto-submit form after delay
            clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(() => {
                this.closest('form')?.submit();
            }, 1000);
        });
    });
    
    updateCartBadge();
    
    // Update cart periodically
    setInterval(updateCartBadge, CART_UPDATE_INTERVAL);
}

/**
 * Setup form validation and submission
 */
function setupFormValidation() {
    // Prevent double submission
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(e) {
            if (this.dataset.submitting === 'true') {
                e.preventDefault();
                return false;
            }
            
            this.dataset.submitting = 'true';
            
            // Re-enable after 3 seconds as fallback
            setTimeout(() => {
                this.dataset.submitting = 'false';
            }, 3000);
        });
    });
    
    // Numeric input validation
    document.querySelectorAll('input[type="number"], .qty-input').forEach(input => {
        input.addEventListener('input', function() {
            const value = this.value.replace(/[^0-9]/g, '');
            if (this.value !== value) {
                this.value = value;
            }
            
            const min = parseInt(this.min) || 1;
            const max = parseInt(this.max) || 999;
            const numValue = parseInt(value) || min;
            
            if (numValue < min) this.value = min;
            if (numValue > max) this.value = max;
        });
    });
    
    // PIN code input validation
    document.querySelectorAll('input[pattern*="[0-9]"]').forEach(input => {
        input.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
            
            // Auto-advance focus or submit
            if (this.value.length === parseInt(this.maxLength)) {
                if (this.form && this.name === 'pin') {
                    // Auto-submit PIN forms
                    setTimeout(() => this.form.submit(), 500);
                } else {
                    // Focus next input
                    const nextInput = this.form?.querySelector(`input:not([name="${this.name}"]):not([type="hidden"])`);
                    if (nextInput) nextInput.focus();
                }
            }
        });
    });
    
    // Required field validation
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(e) {
            const requiredFields = this.querySelectorAll('[required]');
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
                e.preventDefault();
                announceToScreenReader('Please fill in all required fields');
            }
        });
    });
}

/**
 * Setup accessibility features
 */
function setupAccessibility() {
    // Add skip link
    if (!document.querySelector('.skip-link')) {
        const skipLink = document.createElement('a');
        skipLink.className = 'skip-link btn btn-primary position-absolute';
        skipLink.href = '#main-content';
        skipLink.textContent = 'Skip to main content';
        skipLink.style.cssText = 'top: -100px; left: 10px; z-index: 9999; transition: top 0.3s;';
        
        skipLink.addEventListener('focus', () => {
            skipLink.style.top = '10px';
        });
        
        skipLink.addEventListener('blur', () => {
            skipLink.style.top = '-100px';
        });
        
        document.body.insertBefore(skipLink, document.body.firstChild);
    }
    
    // Add main content landmark
    const mainContent = document.querySelector('.kiosk-container, .products-container, .cart-container');
    if (mainContent && !mainContent.id) {
        mainContent.id = 'main-content';
        mainContent.setAttribute('role', 'main');
    }
    
    // Improve button accessibility
    document.querySelectorAll('button:not([aria-label]):not([title])').forEach(btn => {
        const text = btn.textContent.trim();
        const icon = btn.querySelector('i');
        
        if (!text && icon) {
            const iconClass = icon.className;
            let label = 'Button';
            
            if (iconClass.includes('fa-plus')) label = 'Increase quantity';
            else if (iconClass.includes('fa-minus')) label = 'Decrease quantity';
            else if (iconClass.includes('fa-cart')) label = 'Add to cart';
            else if (iconClass.includes('fa-trash')) label = 'Remove item';
            else if (iconClass.includes('fa-check')) label = 'Confirm';
            else if (iconClass.includes('fa-arrow-left')) label = 'Go back';
            else if (iconClass.includes('fa-eye')) label = 'View details';
            
            btn.setAttribute('aria-label', label);
        }
    });
    
    // Add loading states
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function() {
            const submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.setAttribute('aria-busy', 'true');
                submitBtn.disabled = true;
            }
        });
    });
}

/**
 * Update current time display
 */
function updateCurrentTime() {
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        const now = new Date();
        timeElement.textContent = now.toLocaleString('is-IS', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // Update every minute
    setTimeout(updateCurrentTime, 60000);
}

/**
 * Announce message to screen readers
 */
function announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.cssText = `
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
    `;
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
}

/**
 * Handle keyboard navigation
 */
document.addEventListener('keydown', function(e) {
    // Escape key - go back or close modal
    if (e.key === 'Escape') {
        const modal = document.querySelector('.modal.show');
        if (modal) {
            const closeBtn = modal.querySelector('.btn-close, [data-bs-dismiss="modal"]');
            if (closeBtn) closeBtn.click();
        } else {
            const backBtn = document.querySelector('a[href*="back"], .btn:contains("back")');
            if (backBtn) backBtn.click();
        }
    }
    
    // Enter key on product cards
    if (e.key === 'Enter' && e.target.classList.contains('product-card')) {
        const addBtn = e.target.querySelector('.btn-add-cart, button[type="submit"]');
        if (addBtn) addBtn.click();
    }
    
    // Arrow key navigation for product grid
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const productCards = Array.from(document.querySelectorAll('.product-card'));
        const currentIndex = productCards.indexOf(document.activeElement);
        
        if (currentIndex !== -1) {
            e.preventDefault();
            let newIndex = currentIndex;
            
            switch (e.key) {
                case 'ArrowLeft':
                    newIndex = Math.max(0, currentIndex - 1);
                    break;
                case 'ArrowRight':
                    newIndex = Math.min(productCards.length - 1, currentIndex + 1);
                    break;
                case 'ArrowUp':
                    // Move up by row (assuming 3-4 columns)
                    newIndex = Math.max(0, currentIndex - 3);
                    break;
                case 'ArrowDown':
                    // Move down by row
                    newIndex = Math.min(productCards.length - 1, currentIndex + 3);
                    break;
            }
            
            if (productCards[newIndex]) {
                productCards[newIndex].focus();
            }
        }
    }
});

/**
 * Virtual keypad functionality for pickup codes and PINs
 */
function initializeVirtualKeypad() {
    const keypadBtns = document.querySelectorAll('.keypad-btn, .pin-btn');
    const targetInputs = document.querySelectorAll('[name="pickup_code"], [name="pin"]');
    
    keypadBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const digit = this.dataset.digit;
            const action = this.dataset.action;
            const activeInput = document.activeElement;
            
            let targetInput = null;
            
            // Find the correct input to target
            if (activeInput && targetInputs.includes(activeInput)) {
                targetInput = activeInput;
            } else {
                targetInput = targetInputs[0]; // Default to first input
            }
            
            if (!targetInput) return;
            
            if (digit) {
                // Add digit if under max length
                const maxLength = parseInt(targetInput.maxLength) || 10;
                if (targetInput.value.length < maxLength) {
                    targetInput.value += digit;
                    targetInput.focus();
                    
                    // Auto-submit when max length reached
                    if (targetInput.value.length === maxLength) {
                        setTimeout(() => {
                            const submitBtn = targetInput.form?.querySelector('button[type="submit"]');
                            if (submitBtn) {
                                submitBtn.focus();
                                announceToScreenReader('Ready to submit');
                            }
                        }, 500);
                    }
                }
            } else if (action === 'clear') {
                // Remove last character
                targetInput.value = targetInput.value.slice(0, -1);
                targetInput.focus();
            } else if (action === 'enter') {
                // Submit form if valid
                const form = targetInput.form;
                const minLength = parseInt(targetInput.pattern?.match(/\{(\d+)\}/)?.[1]) || targetInput.minLength || 0;
                
                if (form && targetInput.value.length >= minLength) {
                    form.submit();
                } else {
                    announceToScreenReader('Please complete all required fields');
                }
            }
        });
    });
}

// Initialize virtual keypad if present
document.addEventListener('DOMContentLoaded', function() {
    if (document.querySelector('.keypad-btn, .pin-btn')) {
        initializeVirtualKeypad();
    }
});

/**
 * Language switching functionality
 */
function switchLanguage(lang) {
    // Store language preference
    localStorage.setItem('kiosk-language', lang);
    
    // Update URL to include language
    const url = new URL(window.location);
    url.pathname = `/kiosk/language/${lang}`;
    
    window.location.href = url.href;
}

/**
 * Auto-redirect after order completion
 */
function setupOrderCompletion() {
    const orderComplete = document.querySelector('.order-complete');
    if (orderComplete) {
        let countdown = 10;
        const countdownElement = document.createElement('div');
        countdownElement.className = 'countdown-timer';
        countdownElement.innerHTML = `
            <p class="mt-4">
                <i class="fas fa-clock me-2"></i>
                Returning to main menu in <span id="countdown">${countdown}</span> seconds
            </p>
        `;
        orderComplete.appendChild(countdownElement);
        
        const countdownSpan = countdownElement.querySelector('#countdown');
        const timer = setInterval(() => {
            countdown--;
            countdownSpan.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(timer);
                window.location.href = '/kiosk';
            }
        }, 1000);
        
        // Allow manual navigation
        document.addEventListener('click', () => {
            clearInterval(timer);
            window.location.href = '/kiosk';
        });
    }
}

// Setup order completion if on order complete page
document.addEventListener('DOMContentLoaded', function() {
    setupOrderCompletion();
});

/**
 * Error handling and user feedback
 */
window.addEventListener('error', function(e) {
    console.error('Kiosk error:', e.error);
    
    // Show user-friendly error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger alert-dismissible fade show position-fixed';
    errorDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle me-2"></i>
        <strong>Villa / Error:</strong> Eitthvað fór úrskeiðis. Reyndu aftur.
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
});

/**
 * Performance monitoring
 */
function monitorPerformance() {
    // Monitor page load time
    window.addEventListener('load', function() {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        console.log(`Page load time: ${loadTime}ms`);
        
        if (loadTime > 3000) {
            console.warn('Slow page load detected');
        }
    });
    
    // Monitor memory usage (if available)
    if ('memory' in performance) {
        setInterval(() => {
            const memory = performance.memory;
            if (memory.usedJSHeapSize > 50 * 1024 * 1024) { // 50MB
                console.warn('High memory usage detected');
            }
        }, 30000);
    }
}

// Initialize performance monitoring
monitorPerformance();

// Export functions for global access
window.KioskJS = {
    announceToScreenReader,
    switchLanguage,
    addRippleEffect,
    initializeVirtualKeypad
};

console.log('Kiosk JavaScript loaded successfully');
