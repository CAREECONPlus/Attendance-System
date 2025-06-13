console.log('firebase.js loaded');

/**
 * 勤怠管理システム - Firebase初期化 (v8 SDK対応版)
 * 
 * このファイルは、Firebaseの初期化とグローバル設定を行います。
 * すべてのページで共通して使用されるFirebaseの設定を管理します。
 */

// Firebase設定
// 注意: これを実際のFirebaseプロジェクトの設定値に置き換えてください
const firebaseConfig = {
    apiKey: "AIzaSyCUCD0CLd6SQELpMK2f6KQFy2XVv5eMT2o",
    authDomain: "attendance-system-39ae6.firebaseapp.com",
    projectId: "attendance-system-39ae6",
    storageBucket: "attendance-system-39ae6.appspot.com",
    messagingSenderId: "723896381304",
    appId: "1:723896381304:web:92f31b721706dcbf11a28d",
    measurementId: "G-8DY7MWM44W"
};

// Firebase初期化状態を追跡
let isFirebaseInitialized = false;

try {
    // Firebase v8 SDKで初期化
    firebase.initializeApp(firebaseConfig);
    
    // データベースとAuth インスタンスを取得
    const db = firebase.firestore();
    const auth = firebase.auth();
    
    // Firestore設定（オフライン機能を有効化）
    db.enablePersistence({
        synchronizeTabs: true
    }).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('複数のタブが開かれているため、オフライン機能を有効化できません');
        } else if (err.code === 'unimplemented') {
            console.warn('このブラウザはオフライン機能をサポートしていません');
        }
    });
    
    // グローバルスコープにエクスポート
    window.db = db;
    window.auth = auth;
    window.firebase = firebase;
    
    isFirebaseInitialized = true;
    console.log('Firebase初期化完了 (v8 SDK)');
    
} catch (initError) {
    console.error('Firebase初期化エラー:', initError);
    
    // 初期化失敗時のフォールバック処理
    window.db = null;
    window.auth = null;
    
    // エラーメッセージを表示
    document.addEventListener('DOMContentLoaded', () => {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #ff4d4d;
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 9999;
            font-family: Arial, sans-serif;
        `;
        errorDiv.textContent = 'Firebase接続エラー: システムが正常に動作しない可能性があります';
        document.body.appendChild(errorDiv);
        
        setTimeout(() => errorDiv.remove(), 10000);
    });
}

// Firebase接続状態の確認
if (isFirebaseInitialized) {
    // 認証状態の監視
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log(`Firebase認証: ログイン中のユーザー - ${user.email}`);
        } else {
            console.log('Firebase認証: ログインしていません');
        }
    });
    
    // Firestore接続テスト
    setTimeout(async () => {
        try {
            await db.collection('_test').limit(1).get();
            console.log('Firestore接続テスト成功');
        } catch (testError) {
            console.warn('Firestore接続テスト失敗:', testError.message);
            
            if (testError.code === 'permission-denied') {
                console.warn('権限エラー: Firestoreのセキュリティルールを確認してください');
            }
        }
    }, 2000);
}

/**
 * Firebase初期化の確認関数
 * 他のスクリプトからFirebaseが正しく初期化されているかチェックできます
 */
window.checkFirebaseConnection = function() {
    return {
        initialized: isFirebaseInitialized,
        app: isFirebaseInitialized && !!firebase.app(),
        database: isFirebaseInitialized && !!window.db,
        auth: isFirebaseInitialized && !!window.auth,
        user: isFirebaseInitialized && window.auth ? window.auth.currentUser : null
    };
};

/**
 * Firebase設定情報の取得（デバッグ用）
 * 機密情報は含まれていません
 */
window.getFirebaseInfo = function() {
    if (!isFirebaseInitialized) {
        return { error: 'Firebase未初期化' };
    }
    
    return {
        authDomain: firebaseConfig.authDomain,
        projectId: firebaseConfig.projectId,
        currentUser: window.auth && window.auth.currentUser ? {
            uid: window.auth.currentUser.uid,
            email: window.auth.currentUser.email,
            displayName: window.auth.currentUser.displayName
        } : null
    };
};

/**
 * Firebase再初期化関数（緊急時用）
 */
window.reinitializeFirebase = function() {
    console.log('Firebase再初期化を試行中...');
    
    try {
        // 既存のアプリを削除
        if (firebase.apps.length > 0) {
            firebase.app().delete();
        }
        
        // 再初期化
        firebase.initializeApp(firebaseConfig);
        window.db = firebase.firestore();
        window.auth = firebase.auth();
        
        isFirebaseInitialized = true;
        console.log('Firebase再初期化成功');
        return true;
    } catch (error) {
        console.error('Firebase再初期化失敗:', error);
        return false;
    }
};

// エラーハンドリング
window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.code) {
        if (event.reason.code.startsWith('auth/')) {
            console.error('Firebase認証エラー:', event.reason);
        } else if (event.reason.code.startsWith('firestore/')) {
            console.error('Firestoreエラー:', event.reason);
            
            // 権限エラーの場合は特別な処理
            if (event.reason.code === 'firestore/permission-denied') {
                console.error('Firestore権限エラー: セキュリティルールを確認してください');
            }
        }
    }
});

// Firebase初期化完了の通知
if (isFirebaseInitialized) {
    // カスタムイベントを発火して他のスクリプトに初期化完了を通知
    document.addEventListener('DOMContentLoaded', () => {
        const event = new CustomEvent('firebaseInitialized', {
            detail: {
                db: window.db,
                auth: window.auth,
                firebase: window.firebase
            }
        });
        document.dispatchEvent(event);
    });
}
