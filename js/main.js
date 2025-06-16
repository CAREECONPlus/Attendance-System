/**
 * 勤怠管理システム - メインスクリプト（マルチテナント対応版）
 */

console.log('main.js loaded - Multi-tenant version');

/**
 * システム初期化の中心関数（マルチテナント対応版）
 */
async function initializeSystem() {
    console.log('🚀 勤怠管理システムを初期化中（マルチテナント版）...');
    
    try {
        // Firebase初期化待ち
        await waitForFirebaseInit();
        console.log('✅ Firebase初期化完了');
        
        // 🆕 テナント初期化
        const tenantInitialized = await initializeTenant();
        
        if (tenantInitialized) {
            // テナントが選択済みの場合、通常のログインフローに進む
            console.log('✅ テナント初期化完了 - ログイン画面へ');
            
            // Firebase認証状態の確認
            const currentUser = firebase.auth().currentUser;
            if (currentUser) {
                console.log(`✅ 既存認証ユーザー: ${currentUser.uid}`);
                // 認証済みユーザーの処理は login.js で行われる
            } else {
                console.log('❌ 未認証 - ログイン画面を表示');
                showPage('login');
            }
        } else {
            // テナント選択が必要な場合、テナント選択画面が既に表示されている
            console.log('⏳ テナント選択待ち');
        }
        
    } catch (error) {
        console.error('❌ システム初期化エラー:', error);
        showError('システムの初期化に失敗しました');
        
        // フォールバック: テナント選択画面を表示
        if (typeof showTenantSelection === 'function') {
            showTenantSelection();
        } else {
            showPage('login');
        }
    }
    
    // エラーハンドリングの設定
    setupErrorHandling();
    
    console.log('✅ 勤怠管理システムの初期化が完了しました（マルチテナント版）');
}

/**
 * Firebase初期化の完了を待機
 */
function waitForFirebaseInit() {
    return new Promise((resolve, reject) => {
        // firebase.jsが読み込まれているかチェック
        if (typeof firebase === 'undefined') {
            const checkInterval = setInterval(() => {
                if (typeof firebase !== 'undefined' && firebase.app()) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            
            // 5秒以内に初期化されない場合はエラー
            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('Firebase初期化タイムアウト'));
            }, 5000);
        } else {
            // 既に初期化済み
            resolve();
        }
    });
}

/**
 * エラーハンドリングの設定
 */
function setupErrorHandling() {
    // グローバルエラーハンドラ
    window.addEventListener('error', function(e) {
        console.error('アプリケーションエラー:', e.message, e.filename, e.lineno);
        
        // Firebase関連のエラーかどうかをチェック
        if (e.message.includes('firebase') || e.message.includes('firestore')) {
            console.error('Firebase関連エラー:', e);
            showError('データベース接続エラーが発生しました');
        } else {
            // 一般的なエラー
            showError('アプリケーションエラーが発生しました');
        }
    });
    
    // キャッチされていないPromiseエラーを捕捉
    window.addEventListener('unhandledrejection', function(e) {
        console.error('未処理のPromiseエラー:', e.reason);
        
        // Firebase関連のエラーかどうかをチェック
        if (e.reason && e.reason.code) {
            if (e.reason.code.startsWith('auth/')) {
                console.error('Firebase Auth エラー:', e.reason);
                // auth/* エラーは login.js で処理されるため、ここでは表示しない
            } else if (e.reason.code.startsWith('firestore/')) {
                console.error('Firestore エラー:', e.reason);
                showError('データベースエラーが発生しました');
            }
        } else {
            showError('システムエラーが発生しました');
        }
        
        // デフォルトの処理を防ぐ
        e.preventDefault();
    });
}

/**
 * エラーメッセージを表示
 * @param {string} message エラーメッセージ
 */
function showError(message) {
    // トースト通知を表示
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
        border-radius: 8px;
        padding: 15px;
        max-width: 300px;
        z-index: 9999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        font-weight: 600;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);
    
    console.error(message);
}

/**
 * 成功メッセージを表示
 * @param {string} message 成功メッセージ
 */
function showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
        border-radius: 8px;
        padding: 15px;
        max-width: 300px;
        z-index: 9999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        font-weight: 600;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
    
    console.log(message);
}

/**
 * ページ切り替え関数（マルチテナント対応版）
 * @param {string} pageName 表示するページ名
 */
function showPage(pageName) {
    try {
        // 全てのページを非表示（テナント選択画面も含む）
        document.querySelectorAll('#login-page, #employee-page, #admin-page, #register-page, #tenant-selection-page')
            .forEach(el => el.classList.add('hidden'));
        
        // 指定されたページを表示
        const targetPage = document.getElementById(`${pageName}-page`);
        if (targetPage) {
            targetPage.classList.remove('hidden');
            console.log(`✅ ページ切り替え: ${pageName}`);
            
            // 🆕 テナント情報をページタイトルに反映
            const currentTenant = getCurrentTenant();
            if (currentTenant && pageName !== 'tenant-selection') {
                document.title = `${currentTenant.companyName} - 勤怠管理システム`;
            } else if (pageName === 'tenant-selection') {
                document.title = '会社選択 - 勤怠管理システム';
            }
        } else {
            console.error(`❌ ページが見つかりません: ${pageName}-page`);
            
            // フォールバック処理
            if (pageName === 'tenant-selection') {
                // テナント選択ページが見つからない場合は動的作成を試行
                if (typeof showTenantSelection === 'function') {
                    showTenantSelection();
                } else {
                    showPage('login');
                }
            }
        }
    } catch (error) {
        console.error('ページ切り替えエラー:', error);
    }
}

/**
 * 認証チェック（マルチテナント対応版）
 */
function checkAuthStatus() {
    const currentUser = firebase.auth().currentUser;
    const currentTenant = getCurrentTenant();
    
    if (!currentTenant) {
        console.log('❌ テナントが選択されていません');
        if (typeof showTenantSelection === 'function') {
            showTenantSelection();
        }
        return false;
    }
    
    if (currentUser) {
        console.log('✅ 認証済み:', currentUser.email, 'テナント:', currentTenant.companyName);
        return true;
    } else {
        console.log('❌ 未認証');
        showPage('login');
        return false;
    }
}

/**
 * アプリケーション状態の診断（マルチテナント対応版）
 */
function diagnoseApplication() {
    console.log('=== アプリケーション診断（マルチテナント版） ===');
    console.log('Firebase App:', typeof firebase !== 'undefined' && firebase.app() ? '初期化済み' : '未初期化');
    console.log('Firestore:', typeof db !== 'undefined' ? '利用可能' : '未定義');
    console.log('Auth:', typeof firebase !== 'undefined' && firebase.auth() ? '利用可能' : '未定義');
    console.log('Current User:', firebase.auth()?.currentUser ? firebase.auth().currentUser.email : 'なし');
    
    // 🆕 テナント情報
    const currentTenant = typeof getCurrentTenant === 'function' ? getCurrentTenant() : null;
    console.log('Current Tenant:', currentTenant ? `${currentTenant.companyName} (${currentTenant.id})` : 'なし');
    
    // 表示されているページをチェック
    const visiblePage = document.querySelector('.page:not(.hidden)');
    console.log('表示中のページ:', visiblePage ? visiblePage.id : 'なし');
    
    // 必要な関数の存在チェック
    console.log('initEmployeePage:', typeof window.initEmployeePage);
    console.log('initAdminPage:', typeof window.initAdminPage);
    console.log('getCurrentUser:', typeof window.getCurrentUser);
    console.log('getCurrentTenant:', typeof window.getCurrentTenant);
    console.log('initializeTenant:', typeof window.initializeTenant);
    console.log('==============================');
    
    return {
        firebase: typeof firebase !== 'undefined',
        firestore: typeof db !== 'undefined',
        auth: typeof firebase !== 'undefined' && firebase.auth(),
        currentUser: firebase.auth()?.currentUser,
        currentTenant: currentTenant,
        visiblePage: visiblePage?.id
    };
}

/**
 * DOMContentLoadedイベントでの初期化（マルチテナント対応版）
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM読み込み完了 - Multi-tenant version');
    
    // 初期状態では全ページを非表示
    document.querySelectorAll('#login-page, #employee-page, #admin-page, #register-page, #tenant-selection-page')
        .forEach(el => el.classList.add('hidden'));
    
    // ローディング画面を表示（もしあれば）
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.remove('hidden');
    }
    
    // 少し遅延させてからシステム初期化
    setTimeout(() => {
        initializeSystem().then(() => {
            // ローディング画面を非表示
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
            }
        }).catch(error => {
            console.error('システム初期化に失敗:', error);
            // フォールバック処理
            if (typeof showTenantSelection === 'function') {
                showTenantSelection();
            } else {
                showPage('login');
            }
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
            }
        });
    }, 100);
});

/**
 * window.onloadイベントでのバックアップ初期化
 */
window.onload = function() {
    console.log('📄 ページが完全に読み込まれました - Multi-tenant version');
    
    // DOMContentLoadedで初期化されていない場合のバックアップ
    if (!firebase.apps || firebase.apps.length === 0) {
        console.warn('Firebase未初期化 - バックアップ初期化を実行');
        setTimeout(initializeSystem, 500);
    }
};

// デバッグ用のグローバル関数（開発環境のみ）
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.debugInfo = function() {
        return diagnoseApplication();
    };
    
    window.forceLogin = function() {
        showPage('login');
    };
    
    window.forceTenantSelection = function() {
        if (typeof showTenantSelection === 'function') {
            showTenantSelection();
        }
    };
    
    window.testTenant = function() {
        const tenant = getCurrentTenant();
        console.log('Current Tenant:', tenant);
        return tenant;
    };
}

// グローバルスコープにエクスポート
window.initializeSystem = initializeSystem;
window.showPage = showPage;
window.showError = showError;
window.showSuccess = showSuccess;
window.checkAuthStatus = checkAuthStatus;
window.diagnoseApplication = diagnoseApplication;
