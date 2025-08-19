/**
 * 🌙 Modern Theme Toggle System
 * Nexus UI - Dark/Light Mode Controller
 */

class ThemeController {
    constructor() {
        this.currentTheme = this.getStoredTheme();
        this.init();
    }

    getStoredTheme() {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme) {
            return storedTheme;
        }
        
        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        
        return 'light';
    }

    setTheme(theme) {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        this.updateToggleIcon();
        this.announceThemeChange(theme);
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    updateToggleIcon() {
        const toggle = document.getElementById('theme-toggle');
        if (!toggle) return;

        const isDark = this.currentTheme === 'dark';
        toggle.innerHTML = isDark 
            ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
            : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
        
        toggle.setAttribute('aria-label', isDark ? '明るいテーマに切り替え' : '暗いテーマに切り替え');
        toggle.title = isDark ? '明るいテーマに切り替え' : '暗いテーマに切り替え';
    }

    announceThemeChange(theme) {
        // Create live region for screen readers
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = `テーマが${theme === 'dark' ? 'ダーク' : 'ライト'}モードに変更されました`;
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    createToggleButton() {
        // Check if toggle already exists
        if (document.getElementById('theme-toggle')) return;

        const toggle = document.createElement('button');
        toggle.id = 'theme-toggle';
        toggle.className = 'theme-toggle';
        toggle.setAttribute('type', 'button');
        toggle.setAttribute('aria-label', '明るいテーマに切り替え');
        toggle.title = 'テーマを切り替え';
        
        toggle.addEventListener('click', () => this.toggleTheme());
        toggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleTheme();
            }
        });

        if (document.body) {
            document.body.appendChild(toggle);
        } else {
            // body が存在しない場合は少し待つ
            setTimeout(() => {
                if (document.body) {
                    document.body.appendChild(toggle);
                } else {
                    console.warn('Could not append theme toggle: document.body is null');
                }
            }, 100);
        }
        this.updateToggleIcon();
    }

    handleSystemThemeChange() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        mediaQuery.addListener((e) => {
            // Only auto-switch if user hasn't manually set preference
            if (!localStorage.getItem('theme')) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    init() {
        // Set initial theme
        this.setTheme(this.currentTheme);
        
        // Create toggle button when DOM is ready
        const initToggle = () => {
            this.createToggleButton();
            this.handleSystemThemeChange();
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initToggle);
        } else if (document.readyState === 'interactive') {
            // DOM is ready but resources may still be loading
            setTimeout(initToggle, 0);
        } else {
            // DOM and resources are ready
            initToggle();
        }

        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.updateToggleIcon();
            }
        });

        // Smooth transition after page load
        setTimeout(() => {
            document.documentElement.style.transition = 'color 0.3s ease, background-color 0.3s ease';
        }, 100);
    }
}

// Auto-initialize theme controller
const themeController = new ThemeController();

// Export for manual usage if needed
window.themeController = themeController;