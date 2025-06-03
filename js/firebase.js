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

// Firebase v8 SDKで初期化
firebase.initializeApp(firebaseConfig);

// データベースとAuth インスタンスを取得
const db = firebase.firestore();
const auth = firebase.auth();

// グローバルスコープにエクスポート
window.db = db;
window.auth = auth;
window.firebase = firebase;

console.log('Firebase初期化完了 (v8 SDK)');

// Firebase接続状態の確認
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log(`Firebase認証: ログイン中のユーザー - ${user.email}`);
    } else {
        console.log('Firebase認証: ログインしていません');
    }
});

/**
 * Firebase初期化の確認関数
 * 他のスクリプトからFirebaseが正しく初期化されているかチェックできます
 */
window.checkFirebaseConnection = function() {
    return {
        app: !!firebase.app(),
        database: !!db,
        auth: !!auth,
        user: auth.currentUser
    };
};

/**
 * Firebase設定情報の取得（デバッグ用）
 * 機密情報は含まれていません
 */
window.getFirebaseInfo = function() {
    return {
        authDomain: firebaseConfig.authDomain,
        projectId: firebaseConfig.projectId,
        currentUser: auth.currentUser ? {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            displayName: auth.currentUser.displayName
        } : null
    };
};

// エラーハンドリング
window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.code && event.reason.code.startsWith('auth/')) {
        console.error('Firebase認証エラー:', event.reason);
    } else if (event.reason && event.reason.code && event.reason.code.startsWith('firestore/')) {
        console.error('Firestoreエラー:', event.reason);
    }
});
