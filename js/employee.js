/**
 * employee.js - SPA構造対応版（抜粋）
 * ログアウト処理の修正
 */

// 従業員画面の基本的なUI初期化
function setupEmployeeBasics() {
    // ユーザー名を表示
    const currentUser = getCurrentUser();
    if (currentUser) {
        const userNameEl = getElement('user-name');
        if (userNameEl) {
            userNameEl.textContent = currentUser.displayName || currentUser.email;
            console.log('ユーザー名を表示:', currentUser.displayName);
        }
    }
    
    // ログアウトボタン（修正版）
    const logoutBtn = getElement('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            // main.jsの共通ログアウト関数を呼び出し
            if (typeof window.handleLogout === 'function') {
                window.handleLogout();
            } else {
                console.error('handleLogout 関数が見つかりません');
            }
        });
    }
}

// ... 残りのemployee.jsの機能は既存のまま ...
