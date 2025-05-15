/**
 * main.js - 管理者初期化改善版
 */

console.log('main.js 読み込み開始');

/**
 * システム初期化
 */
async function initializeSystem() {
    console.log('勤怠管理システムを初期化中...');
    
    try {
        // Firebase初期化待ち
        await waitForFirebaseInit();
        
        console.log('Firebase初期化完了');
        
        // 認証状態に基づいて画面を表示
        await handleAuthState();
        
    } catch (error) {
        console.error('システム初期化エラー:', error);
        showError('システムの初期化に失敗しました');
        window.location.href = 'login.html';
    }
    
    console.log('勤怠管理システムの初期化が完了しました');
}

/**
 * Firebase初期化の完了を待機
 */
function waitForFirebaseInit() {
    return new Promise((resolve, reject) => {
        if (typeof firebase === 'undefined') {
            const checkInterval = setInterval(() => {
                if (typeof firebase !== 'undefined' && firebase.app()) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            
            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('Firebase初期化タイムアウト'));
            }, 5000);
        } else {
            resolve();
        }
    });
}

/**
 * 認証状態に基づいて適切な画面を表示
 */
async function handleAuthState() {
    return new Promise((resolve) => {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                console.log('認証済みユーザー:', user.email);
                
                try {
                    // ユーザーの役割を取得
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    
                    if (!userDoc.exists) {
                        console.error('ユーザー情報が見つかりません');
                        await firebase.auth().signOut();
                        window.location.href = 'login.html';
                        return;
                    }
                    
                    const userData = userDoc.data();
                    console.log('ユーザー役割:', userData.role);
                    
                    // 役割に基づいて画面表示
                    if (userData.role === 'admin') {
                        showPage('admin');
                        
                        // 少し遅延させてから管理者画面を初期化
                        setTimeout(() => {
                            if (typeof initAdminPage === 'function') {
                                initAdminPage();
                            } else {
                                console.error('initAdminPage 関数が見つかりません');
                            }
                        }, 300);
                        
                    } else if (userData.role === 'employee') {
                        showPage('employee');
                        
                        // 少し遅延させてから従業員画面を初期化
                        setTimeout(() => {
                            if (typeof initEmployeePage === 'function') {
                                initEmployeePage();
                            } else {
                                console.error('initEmployeePage 関数が見つかりません');
                            }
                        }, 300);
                        
                    } else {
                        console.error('不明な役割:', userData.role);
                        await firebase.auth().signOut();
                        window.location.href = 'login.html';
                    }
                    
                } catch (error) {
                    console.error('ユーザー情報取得エラー:', error);
                    await firebase.auth().signOut();
                    window.location.href = 'login.html';
                }
                
            } else {
                console.log('未認証ユーザー - ログイン画面へリダイレクト');
                window.location.href = 'login.html';
            }
            
            resolve();
        });
    });
}

/**
 * ページの表示/非表示を切り替え
 */
function showPage(pageName) {
    console.log(`画面切り替え: ${pageName}`);
    
    // 全ての画面を非表示
    document.querySelectorAll('#employee-page, #admin-page')
        .forEach(el => el.classList.add('hidden'));
    
    // 指定された画面を表示
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
        console.log(`${pageName}画面を表示完了`);
    } else {
        console.error(`ページが見つかりません: ${pageName}-page`);
    }
}

/**
 * エラーメッセージを表示
 */
function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
    
    console.error(message);
}

/**
 * グローバルエラーハンドリング
 */
function setupErrorHandling() {
    window.addEventListener('error', function(e) {
        console.error('アプリケーションエラー:', e.message);
        
        if (e.message.includes('firebase') || e.message.includes('firestore')) {
            showError('Firebase接続エラーが発生しました');
        }
    });
    
    window.addEventListener('unhandledrejection', function(e) {
        console.error('未処理のPromiseエラー:', e.reason);
        
        if (e.reason && e.reason.code) {
            if (e.reason.code.startsWith('auth/')) {
                window.location.href = 'login.html';
            } else if (e.reason.code.startsWith('firestore/')) {
                showError('データベースエラーが発生しました');
            }
        }
        
        e.preventDefault();
    });
}

/**
 * DOMContentLoadedイベントでの初期化
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM読み込み完了 - index.html');
    
    // 初期状態では全ページを非表示
    document.querySelectorAll('#employee-page, #admin-page')
        .forEach(el => el.classList.add('hidden'));
    
    // エラーハンドリング設定
    setupErrorHandling();
    
    // 少し遅延させてからシステム初期化
    setTimeout(() => {
        initializeSystem();
    }, 100);
});

/**
 * 緊急時のリセット関数
 */
window.resetApplication = function() {
    if (confirm('アプリケーションをリセットしてログイン画面に戻りますか？')) {
        firebase.auth().signOut().then(() => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = 'login.html';
        }).catch(error => {
            console.error('リセット時のエラー:', error);
            window.location.href = 'login.html';
        });
    }
};
