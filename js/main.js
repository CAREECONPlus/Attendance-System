/**
 * 勤怠管理システム - メインスクリプト（Firebase v8対応版）
 * 
 * システムの初期化と全体の連携を担当します。
 * Firebase初期化完了後にシステムを初期化し、適切な画面を表示します。
 */

console.log('main.js loaded - Firebase v8 version');

/**
 * システム初期化の中心関数（Firebase v8対応版）
 */
async function initializeSystem() {
    console.log('勤怠管理システムを初期化中...');
    
    try {
        // Firebase初期化待ち
        await waitForFirebaseInit();
        
        console.log('Firebase初期化完了 - 認証状態を確認中...');
        
        // Firebase Auth状態の監視は login.js で行われているため、
        // ここでは現在の認証状態をチェックするのみ
        const currentUser = firebase.auth().currentUser;
        
        if (currentUser) {
            console.log(`Firebase認証済みユーザー: ${currentUser.uid}`);
            // 認証済みユーザーの処理は login.js の onAuthStateChanged で処理される
        } else {
            console.log('Firebase未認証 - ログイン画面を表示準備中...');
            // 未認証の場合の処理も login.js で行われる
        }
        
    } catch (error) {
        console.error('システム初期化エラー:', error);
        showError('システムの初期化に失敗しました');
        // フォールバック: ログイン画面を表示
        showPage('login');
    }
    
    // エラーハンドリングの設定
    setupErrorHandling();
    
    console.log('勤怠管理システムの初期化が完了しました');
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
        if (e.reason && e.reason.code && e.reason.code.startsWith('auth/')) {
            console.error('Firebase Auth エラー:', e.reason);
            // auth/* エラーは login.js で処理されるため、ここでは表示しない
        } else if (e.reason && e.reason.code && e.reason.code.startsWith('firestore/')) {
            console.error('Firestore エラー:', e.reason);
            showError('データベースエラーが発生しました');
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
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
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
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
    
    console.log(message);
}

/**
 * Firebase接続状態の監視
 */
function monitorFirebaseConnection() {
    // Firestore接続状態の監視
    if (typeof db !== 'undefined') {
        db.enableNetwork().then(() => {
            console.log('Firestore接続が有効です');
        }).catch((error) => {
            console.error('Firestore接続エラー:', error);
            showError('データベース接続に問題があります');
        });
        
        // 定期的な接続チェック（5分ごと）
        setInterval(async () => {
            try {
                // 簡単なクエリでFirestore接続をテスト
                await db.collection('users').limit(1).get();
                console.log('Firestore接続確認完了');
            } catch (error) {
                console.error('Firestore接続チェック失敗:', error);
                // 接続エラーの場合は再接続を試行
                try {
                    await db.enableNetwork();
                    console.log('Firestore再接続成功');
                } catch (reconnectError) {
                    console.error('Firestore再接続失敗:', reconnectError);
                    showError('データベース接続が不安定です');
                }
            }
        }, 5 * 60 * 1000); // 5分間隔
    }
}

/**
 * アプリケーションの状態をリセット（緊急時用）
 */
window.resetApplication = function() {
    if (confirm('アプリケーションをリセットしますか？ログアウトされます。')) {
        firebase.auth().signOut().then(() => {
            localStorage.clear();
            sessionStorage.clear();
            location.reload();
        }).catch(error => {
            console.error('リセット時のログアウトエラー:', error);
            // 強制リロード
            location.reload();
        });
    }
};

/**
 * オフライン状態の監視
 */
function setupOfflineDetection() {
    function updateOnlineStatus() {
        if (navigator.onLine) {
            console.log('オンライン状態です');
            // オンライン復帰時にFirebaseに再接続
            if (typeof db !== 'undefined') {
                db.enableNetwork().catch(error => {
                    console.error('オンライン復帰時の再接続エラー:', error);
                });
            }
        } else {
            console.log('オフライン状態です');
            showError('インターネット接続が切断されました');
        }
    }
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // 初期状態をチェック
    updateOnlineStatus();
}

/**
 * ページヘルパー関数
 */
function showPage(pageName) {
    try {
        // 全てのページを非表示
        document.querySelectorAll('#login-page, #employee-page, #admin-page, #register-page')
            .forEach(el => el.classList.add('hidden'));
        
        // 指定されたページを表示
        const targetPage = document.getElementById(`${pageName}-page`);
        if (targetPage) {
            targetPage.classList.remove('hidden');
            console.log(`ページ切り替え: ${pageName}`);
        } else {
            console.error(`ページが見つかりません: ${pageName}`);
        }
    } catch (error) {
        console.error('ページ切り替えエラー:', error);
    }
}

/**
 * バックアップ認証チェック関数
 */
function checkAuthStatus() {
    const currentUser = firebase.auth().currentUser;
    if (currentUser) {
        console.log('認証済み:', currentUser.email);
        return true;
    } else {
        console.log('未認証');
        showPage('login');
        return false;
    }
}

/**
 * アプリケーション状態の診断（デバッグ用）
 */
function diagnoseApplication() {
    console.log('=== アプリケーション診断 ===');
    console.log('Firebase App:', typeof firebase !== 'undefined' && firebase.app() ? '初期化済み' : '未初期化');
    console.log('Firestore:', typeof db !== 'undefined' ? '利用可能' : '未定義');
    console.log('Auth:', typeof firebase !== 'undefined' && firebase.auth() ? '利用可能' : '未定義');
    console.log('Current User:', firebase.auth()?.currentUser ? firebase.auth().currentUser.email : 'なし');
    
    // 表示されているページをチェック
    const visiblePage = document.querySelector('.page:not(.hidden)');
    console.log('表示中のページ:', visiblePage ? visiblePage.id : 'なし');
    
    // 必要な関数の存在チェック
    console.log('initEmployeePage:', typeof window.initEmployeePage);
    console.log('initAdminPage:', typeof window.initAdminPage);
    console.log('getCurrentUser:', typeof window.getCurrentUser);
    console.log('showPage:', typeof window.showPage);
    console.log('==============================');
    
    return {
        firebase: typeof firebase !== 'undefined',
        firestore: typeof db !== 'undefined',
        auth: typeof firebase !== 'undefined' && firebase.auth(),
        currentUser: firebase.auth()?.currentUser,
        visiblePage: visiblePage?.id
    };
}

/**
 * DOMContentLoadedイベントでの初期化
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM読み込み完了 - Firebase v8 version');
    
    // 初期状態では全ページを非表示
    document.querySelectorAll('#login-page, #employee-page, #admin-page, #register-page')
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
            showPage('login');
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
            }
        });
        
        // Firebase接続監視を開始（少し遅延）
        setTimeout(() => {
            if (typeof db !== 'undefined') {
                monitorFirebaseConnection();
            }
        }, 2000);
        
        // オフライン検出を設定
        setupOfflineDetection();
    }, 100);
});

/**
 * window.onloadイベントでのバックアップ初期化
 */
window.onload = function() {
    console.log('ページが完全に読み込まれました - Firebase v8 version');
    
    // DOMContentLoadedで初期化されていない場合のバックアップ
    if (!firebase.apps || firebase.apps.length === 0) {
        console.warn('Firebase未初期化 - バックアップ初期化を実行');
        setTimeout(initializeSystem, 500);
    }
    
    // 3秒後にもチェック（最終的なフォールバック）
    setTimeout(() => {
        if (!window.currentUser && firebase.auth().currentUser) {
            console.warn('認証状態の不整合を検出 - 修正を試行');
            firebase.auth().onAuthStateChanged(user => {
                if (user && !window.currentUser) {
                    console.log('認証状態を修復中...');
                    location.reload();
                }
            });
        }
    }, 3000);
};

/**
 * ページ離脱時の警告（必要に応じて）
 */
window.addEventListener('beforeunload', function(e) {
    // Firebase使用時は自動保存されるため、基本的に警告は不要
    // ただし、重要な処理中の場合は警告を表示することも可能
    
    // 例: 現在編集中のデータがある場合の警告
    /*
    const confirmationMessage = 'ページを離れると編集中のデータが失われる可能性があります。';
    e.returnValue = confirmationMessage;
    return confirmationMessage;
    */
});

/**
 * Service Worker登録（PWA対応の準備）
 */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker登録成功:', registration);
            })
            .catch(error => {
                console.log('Service Worker登録失敗:', error);
            });
    }
}

// Service Worker登録（必要に応じて有効化）
// registerServiceWorker();

// デバッグ用のグローバル関数
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // 開発環境でのデバッグ関数
    window.debugInfo = function() {
        return diagnoseApplication();
    };
    
    window.forceLogin = function() {
        showPage('login');
    };
    
    window.testAuth = function() {
        return checkAuthStatus();
    };
    
    window.clearData = function() {
        if (confirm('ローカルデータをクリアしますか？')) {
            localStorage.clear();
            sessionStorage.clear();
            console.log('ローカルデータをクリアしました');
        }
    };
}

// グローバルスコープにエクスポート
window.initializeSystem = initializeSystem;
window.showPage = showPage;
window.showError = showError;
window.showSuccess = showSuccess;
window.checkAuthStatus = checkAuthStatus;
window.diagnoseApplication = diagnoseApplication;
