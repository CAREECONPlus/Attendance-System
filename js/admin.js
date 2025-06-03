/**
 * admin.js - SPA構造対応版（抜粋）
 * ログアウト処理の修正
 */

// 管理者画面の基本的なUI初期化
function setupAdminBasics() {
    // ユーザー名を表示
    const currentUser = getCurrentUser();
    if (currentUser) {
        const adminUserNameEl = getElement('admin-user-name');
        if (adminUserNameEl) {
            adminUserNameEl.textContent = currentUser.displayName || currentUser.email;
            console.log('管理者名を表示:', currentUser.displayName);
        }
    }
}

// イベント設定（ログアウトボタン修正版）
function setupAdminEvents() {
    // ... 他のイベント設定 ...
    
    // ログアウトボタン（修正版）
    const logoutBtn = getElement('admin-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            // main.jsの共通ログアウト関数を呼び出し
            if (typeof window.handleLogout === 'function') {
                window.handleLogout();
            } else {
                console.error('handleLogout 関数が見つかりません');
            }
        });
        console.log('管理者ログアウトボタンのイベントリスナー設定完了');
    } else {
        console.error('admin-logout-btn が見つかりません');
    }
}

// ... 残りのadmin.jsの機能は既存のまま ...
