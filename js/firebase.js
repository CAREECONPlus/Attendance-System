console.log('firebase.js loaded');

/**
 * 勤怠管理システム - Firebase初期化（v8互換版）
 * 
 * このファイルは、Firebase v8 SDKを使用してFirebaseの初期化とグローバル設定を行います。
 * すべてのページで共通して使用されるFirebaseの設定を管理します。
 */

// Firebase v8 SDK を読み込み
// HTMLファイルで以下のスクリプトタグが必要です：
// <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
// <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
// <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"></script>

// Firebase設定
const firebaseConfig = {
    apiKey: "AIzaSyCUCD0CLd6SQELpMK2f6KQFy2XVv5eMT2o",
    authDomain: "attendance-system-39ae6.firebaseapp.com",
    projectId: "attendance-system-39ae6",
    storageBucket: "attendance-system-39ae6.appspot.com",
    messagingSenderId: "723896381304",
    appId: "1:723896381304:web:92f31b721706dcbf11a28d",
    measurementId: "G-8DY7MWM44W"
};

// Firebase アプリの初期化
try {
    // 既に初期化されているかチェック
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase v8 初期化成功');
    } else {
        console.log('Firebase は既に初期化されています');
        firebase.app(); // デフォルトアプリを取得
    }
    
    // Firestore の初期化
    const db = firebase.firestore();
    
    // Firestore の設定
    db.settings({
        timestampsInSnapshots: true,
        merge: true
    });
    
    // グローバルスコープに追加
    window.db = db;
    console.log('Firestore v8 初期化成功');
    
    // Firebase Auth の初期化
    const auth = firebase.auth();
    
    // 言語設定（日本語）
    auth.languageCode = 'ja';
    
    // グローバルスコープに追加
    window.auth = auth;
    console.log('Firebase Auth v8 初期化成功');
    
    // Firebase Analytics（オプション）
    if (typeof firebase.analytics !== 'undefined') {
        try {
            firebase.analytics();
            console.log('Firebase Analytics 初期化成功');
        } catch (analyticsError) {
            console.log('Firebase Analytics 初期化失敗（オプショナル）:', analyticsError);
        }
    }
    
} catch (error) {
    console.error('Firebase初期化エラー:', error);
    
    // エラーをユーザーに表示
    setTimeout(() => {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'toast error';
        errorDiv.textContent = `Firebase接続に失敗しました: ${error.message}`;
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '20px';
        errorDiv.style.right = '20px';
        errorDiv.style.padding = '12px 20px';
        errorDiv.style.backgroundColor = '#ff4d4d';
        errorDiv.style.color = 'white';
        errorDiv.style.borderRadius = '8px';
        errorDiv.style.zIndex = '9999';
        document.body.appendChild(errorDiv);
        
        setTimeout(() => errorDiv.remove(), 10000);
    }, 1000);
    
    // 再初期化を試行
    setTimeout(() => {
        console.log('Firebase 再初期化を試行します...');
        location.reload();
    }, 5000);
}

// Firebase認証状態の監視
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log(`Firebase認証: ログイン中のユーザー - ${user.email} (${user.uid})`);
    } else {
        console.log('Firebase認証: ログインしていません');
    }
});

// ネットワーク状態の監視
window.addEventListener('online', () => {
    console.log('オンラインに復旧 - Firebase再接続を試行');
    
    // Firestoreの接続を再有効化
    if (window.db) {
        window.db.enableNetwork().then(() => {
            console.log('Firestore ネットワーク再接続成功');
        }).catch(error => {
            console.error('Firestore 再接続エラー:', error);
        });
    }
});

window.addEventListener('offline', () => {
    console.log('オフライン状態になりました');
});

/**
 * Firebase初期化の確認関数
 * 他のスクリプトからFirebaseが正しく初期化されているかチェックできます
 */
window.checkFirebaseConnection = function() {
    const result = {
        firebaseLoaded: typeof firebase !== 'undefined',
        appInitialized: firebase.apps && firebase.apps.length > 0,
        authAvailable: !!firebase.auth,
        firestoreAvailable: !!firebase.firestore,
        currentUser: firebase.auth().currentUser,
        dbReference: !!window.db,
        authReference: !!window.auth
    };
    
    console.log('Firebase接続状態:', result);
    return result;
};

/**
 * Firebase設定情報の取得（デバッグ用）
 */
window.getFirebaseInfo = function() {
    const app = firebase.app();
    const currentUser = firebase.auth().currentUser;
    
    return {
        authDomain: app.options.authDomain,
        projectId: app.options.projectId,
        appId: app.options.appId,
        currentUser: currentUser ? {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            emailVerified: currentUser.emailVerified
        } : null,
        networkState: navigator.onLine ? 'online' : 'offline'
    };
};

/**
 * Firebase設定のテスト関数
 */
window.testFirebaseConnection = async function() {
    console.log('Firebase接続テスト開始...');
    
    try {
        // Firestore接続テスト
        const testDoc = await window.db.collection('test').doc('connection').get();
        console.log('✅ Firestore接続成功');
        
        // Auth状態チェック
        const user = firebase.auth().currentUser;
        if (user) {
            console.log('✅ 認証済みユーザー:', user.email);
        } else {
            console.log('ℹ️ 未認証状態');
        }
        
        console.log('Firebase接続テスト完了');
        return true;
        
    } catch (error) {
        console.error('❌ Firebase接続テスト失敗:', error);
        return false;
    }
};

/**
 * デバッグ用：Firebase設定を表示
 */
window.showFirebaseConfig = function() {
    const config = firebase.app().options;
    console.log('Firebase設定:');
    console.log(`プロジェクトID: ${config.projectId}`);
    console.log(`認証ドメイン: ${config.authDomain}`);
    console.log(`ストレージバケット: ${config.storageBucket}`);
    console.log(`アプリID: ${config.appId}`);
};

// エラーハンドリング強化
window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.code) {
        if (event.reason.code.startsWith('auth/')) {
            console.error('Firebase認証エラー:', event.reason);
            // 認証エラーの場合はログイン画面にリダイレクト
            if (event.reason.code === 'auth/user-not-found' || 
                event.reason.code === 'auth/invalid-user-token') {
                firebase.auth().signOut();
            }
        } else if (event.reason.code.startsWith('firestore/')) {
            console.error('Firestoreエラー:', event.reason);
            // Firestoreエラーの場合は再接続を試行
            if (event.reason.code === 'firestore/unavailable') {
                setTimeout(() => {
                    window.db.enableNetwork();
                }, 2000);
            }
        }
    }
});

// 5秒後に初期化確認
setTimeout(() => {
    const status = window.checkFirebaseConnection();
    if (!status.appInitialized || !status.dbReference) {
        console.error('Firebase初期化に問題があります。ページを再読み込みしてください。');
        
        // ユーザーに警告表示
        const warningDiv = document.createElement('div');
        warningDiv.className = 'toast warning';
        warningDiv.textContent = 'システムの初期化に失敗しました。ページを再読み込みしてください。';
        warningDiv.style.position = 'fixed';
        warningDiv.style.top = '20px';
        warningDiv.style.right = '20px';
        warningDiv.style.padding = '12px 20px';
        warningDiv.style.backgroundColor = '#ff9800';
        warningDiv.style.color = 'white';
        warningDiv.style.borderRadius = '8px';
        warningDiv.style.zIndex = '9999';
        document.body.appendChild(warningDiv);
    }
}, 5000);

console.log('Firebase設定完了 - v8互換版');
