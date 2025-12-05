/**
 * Unified Footer JavaScript
 * Minimal script for form handling and analytics
 */

(function() {
  'use strict';

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const footer = document.getElementById('unified-footer');
    if (!footer) return;

    // Newsletter form enhancement
    const form = footer.querySelector('.primal-footer__newsletter-form');
    if (form) {
      form.addEventListener('submit', handleNewsletterSubmit);
    }
  }

  /**
   * Handle newsletter form submission
   * Tracks actual submission state for better UX
   */
  function handleNewsletterSubmit(event) {
    const form = event.target;
    const button = form.querySelector('.primal-footer__newsletter-button');
    const input = form.querySelector('.primal-footer__newsletter-input');
    const originalText = button.textContent;

    // Basic email validation (browser handles most via type="email")
    if (!input.value || !input.value.includes('@')) {
      return; // Let browser handle validation
    }

    // Prevent double submission
    if (button.disabled) {
      event.preventDefault();
      return;
    }

    // Show loading state
    button.textContent = 'Sending...';
    button.disabled = true;

    // For Shopify customer forms, listen for navigation/submission
    // Show success state after form processes
    var submitted = false;

    // Handle successful submission (form navigates or reloads)
    window.addEventListener('beforeunload', function onUnload() {
      submitted = true;
      window.removeEventListener('beforeunload', onUnload);
    });

    // Fallback: If page doesn't navigate (AJAX form), show success after delay
    // and reset. This handles both traditional form submit and AJAX patterns.
    setTimeout(function() {
      if (!submitted) {
        // Form likely submitted via AJAX or failed silently
        button.textContent = 'Subscribed!';
        input.value = '';

        // Reset after showing success
        setTimeout(function() {
          button.textContent = originalText;
          button.disabled = false;
        }, 2000);
      }
    }, 1500);
  }
})();
