console.log('firebase.js loaded - 修正版');

/**
 * 勤怠管理システム - Firebase初期化 (v8 SDK対応版・修正版)
 * 権限エラー解決のためオフライン機能を一時的に無効化
 */

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

// Firebase初期化状態を追跡
let isFirebaseInitialized = false;

try {
    console.log('🚀 Firebase初期化開始...');
    
    // Firebase v8 SDKで初期化
    firebase.initializeApp(firebaseConfig);
    
    // データベースとAuth インスタンスを取得
    const db = firebase.firestore();
    const auth = firebase.auth();
    
    console.log('✅ Firebase App初期化成功');
    
    // 🔧 オフライン機能を一時的に無効化（権限問題回避のため）
    /*
    db.enablePersistence({
        synchronizeTabs: true
    }).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('複数のタブが開かれているため、オフライン機能を有効化できません');
        } else if (err.code === 'unimplemented') {
            console.warn('このブラウザはオフライン機能をサポートしていません');
        }
    });
    */
    
    // 🆕 Firestore設定を簡略化
    console.log('📊 Firestore設定中...');
    
    // グローバルスコープにエクスポート
    window.db = db;
    window.auth = auth;
    window.firebase = firebase;
    
    isFirebaseInitialized = true;
    console.log('✅ Firebase初期化完了 (v8 SDK - 修正版)');
    
    // 🆕 即座に基本的な接続テスト
    setTimeout(async () => {
        try {
            console.log('🧪 基本接続テスト開始...');
            
            // 最もシンプルなテスト（書き込みなし）
            const testQuery = db.collection('_test').limit(1);
            await testQuery.get();
            
            console.log('✅ Firestore基本接続成功');
            
        } catch (testError) {
            console.warn('⚠️ Firestore接続テスト失敗:', testError.message);
            console.warn('エラーコード:', testError.code);
            
            // 詳細なエラー情報を表示
            if (testError.code === 'permission-denied') {
                console.error('🚨 セキュリティルール問題検出');
                showFirestoreRuleError();
            } else if (testError.code === 'unavailable') {
                console.error('🌐 Firestore サービス利用不可');
                showFirestoreUnavailableError();
            } else {
                console.error('❓ 不明なFirestoreエラー:', testError);
            }
        }
    }, 1000); // より早い段階でテスト
    
} catch (initError) {
    console.error('❌ Firebase初期化エラー:', initError);
    
    // より詳細なエラー情報
    console.error('初期化エラー詳細:', {
        message: initError.message,
        code: initError.code,
        stack: initError.stack
    });
    
    // 初期化失敗時のフォールバック処理
    window.db = null;
    window.auth = null;
    
    // エラーメッセージを表示
    showInitializationError(initError);
}

/**
 * 🚨 Firestoreルールエラーの表示
 */
function showFirestoreRuleError() {
    const errorDiv = createErrorDiv();
    errorDiv.innerHTML = `
        <h3>🔒 Firestore セキュリティルール エラー</h3>
        <p><strong>権限が不足しています</strong></p>
        <div style="margin: 15px 0; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 5px; font-size: 12px; text-align: left;">
            <strong>解決方法:</strong><br>
            1. Firebase Console → Firestore → ルール<br>
            2. 以下をコピー&ペースト:<br>
            <code style="background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 3px;">
rules_version = '2';<br>
service cloud.firestore {<br>
&nbsp;&nbsp;match /databases/{database}/documents {<br>
&nbsp;&nbsp;&nbsp;&nbsp;match /{document=**} {<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;allow read, write: if true;<br>
&nbsp;&nbsp;&nbsp;&nbsp;}<br>
&nbsp;&nbsp;}<br>
}
            </code><br>
            3. 「公開」をクリック<br>
            4. 1-2分待ってからリロード
        </div>
        <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: white; color: #ff4d4d; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
            🔄 リロード
        </button>
        <button onclick="this.parentElement.remove()" style="margin-left: 10px; padding: 8px 16px; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 4px; cursor: pointer;">
            ✕ 閉じる
        </button>
    `;
}

/**
 * 🌐 Firestore利用不可エラーの表示
 */
function showFirestoreUnavailableError() {
    const errorDiv = createErrorDiv();
    errorDiv.innerHTML = `
        <h3>🌐 Firestore サービス利用不可</h3>
        <p>Firestoreサービスに接続できません</p>
        <div style="margin: 15px 0;">
            <strong>考えられる原因:</strong><br>
            • インターネット接続の問題<br>
            • Firebaseサービスの一時的な障害<br>
            • プロジェクト設定の問題
        </div>
        <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: white; color: #ff4d4d; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
            🔄 リロード
        </button>
    `;
}

/**
 * 🔧 初期化エラーの表示
 */
function showInitializationError(error) {
    document.addEventListener('DOMContentLoaded', () => {
        const errorDiv = createErrorDiv();
        errorDiv.innerHTML = `
            <h3>❌ Firebase初期化エラー</h3>
            <p>システムが正常に動作しない可能性があります</p>
            <div style="margin: 15px 0; font-size: 12px;">
                <strong>エラー:</strong> ${error.message}
            </div>
            <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: white; color: #ff4d4d; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                🔄 リロード
            </button>
        `;
    });
}

/**
 * エラー表示用のDIV作成
 */
function createErrorDiv() {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #ff4d4d;
        color: white;
        padding: 20px;
        border-radius: 8px;
        z-index: 9999;
        font-family: Arial, sans-serif;
        max-width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(errorDiv);
    return errorDiv;
}

// Firebase接続状態の確認
if (isFirebaseInitialized) {
    // 認証状態の監視（改良版）
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log(`✅ Firebase認証: ログイン中 - ${user.email}`);
            console.log('👤 ユーザー情報:', {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName
            });
        } else {
            console.log('❌ Firebase認証: 未ログイン');
        }
    });
}

/**
 * Firebase初期化の確認関数（改良版）
 */
window.checkFirebaseConnection = function() {
    const result = {
        initialized: isFirebaseInitialized,
        app: isFirebaseInitialized && !!firebase.app(),
        database: isFirebaseInitialized && !!window.db,
        auth: isFirebaseInitialized && !!window.auth,
        user: isFirebaseInitialized && window.auth ? window.auth.currentUser : null,
        projectId: isFirebaseInitialized ? firebaseConfig.projectId : null
    };
    
    console.log('🔍 Firebase接続状況:', result);
    return result;
};

/**
 * Firebase設定情報の取得（デバッグ用・改良版）
 */
window.getFirebaseInfo = function() {
    if (!isFirebaseInitialized) {
        return { error: 'Firebase未初期化' };
    }
    
    const info = {
        authDomain: firebaseConfig.authDomain,
        projectId: firebaseConfig.projectId,
        currentUser: window.auth && window.auth.currentUser ? {
            uid: window.auth.currentUser.uid,
            email: window.auth.currentUser.email,
            displayName: window.auth.currentUser.displayName
        } : null,
        firestoreReady: !!window.db
    };
    
    console.log('ℹ️ Firebase情報:', info);
    return info;
};

/**
 * Firebase再初期化関数（緊急時用・改良版）
 */
window.reinitializeFirebase = function() {
    console.log('🔄 Firebase再初期化を試行中...');
    
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
        console.log('✅ Firebase再初期化成功');
        return true;
    } catch (error) {
        console.error('❌ Firebase再初期化失敗:', error);
        return false;
    }
};

/**
 * 🧪 強制Firestoreテスト関数
 */
window.testFirestore = async function() {
    console.log('🧪 Firestoreテスト開始...');
    
    if (!window.db) {
        console.error('❌ Firestore未初期化');
        return false;
    }
    
    try {
        // 読み取りテスト
        console.log('📖 読み取りテスト...');
        await window.db.collection('_test').limit(1).get();
        console.log('✅ 読み取りテスト成功');
        
        // 書き込みテスト
        console.log('✍️ 書き込みテスト...');
        await window.db.collection('_test').doc('connection-test').set({
            test: true,
            timestamp: new Date(),
            browser: navigator.userAgent
        });
        console.log('✅ 書き込みテスト成功');
        
        console.log('🎉 全テスト成功 - Firestoreは正常に動作しています');
        return true;
        
    } catch (error) {
        console.error('❌ Firestoreテスト失敗:', error);
        console.error('エラー詳細:', {
            code: error.code,
            message: error.message
        });
        return false;
    }
};

// エラーハンドリング（改良版）
window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.code) {
        if (event.reason.code.startsWith('auth/')) {
            console.error('🔐 Firebase認証エラー:', event.reason);
        } else if (event.reason.code.startsWith('firestore/')) {
            console.error('📊 Firestoreエラー:', event.reason);
            
            // 権限エラーの場合は特別な処理
            if (event.reason.code === 'firestore/permission-denied') {
                console.error('🚨 Firestore権限エラー: セキュリティルールを確認してください');
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
        
        console.log('📡 firebaseInitializedイベント発火完了');
    });
}

// デバッグ用コマンド一覧
console.log('🔧 利用可能なデバッグコマンド:');
console.log('  • checkFirebaseConnection() - 接続状況確認');
console.log('  • getFirebaseInfo() - Firebase情報取得'); 
console.log('  • testFirestore() - Firestore動作テスト');
console.log('  • reinitializeFirebase() - 緊急再初期化');
