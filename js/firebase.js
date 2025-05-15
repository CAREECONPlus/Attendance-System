console.log('firebase.js loaded');

/**
 * 勤怠管理システム - Firebase初期化
 * 
 * このファイルは、Firebaseの初期化とグローバル設定を行います。
 * すべてのページで共通して使用されるFirebaseの設定を管理します。
 */

// Firebase SDK のインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

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

// Firebaseアプリの初期化
const app = initializeApp(firebaseConfig);

// Firestore データベースの初期化
const db = getFirestore(app);

// Firebase Authentication の初期化
const auth = getAuth(app);

// 開発環境でエミュレーターを使用する場合（オプション）
// 本番環境では以下のコメントを外さないでください
/*
if (location.hostname === 'localhost') {
    try {
        connectFirestoreEmulator(db, 'localhost', 8080);
        connectAuthEmulator(auth, 'http://localhost:9099');
        console.log('Firebase エミュレーターに接続しました');
    } catch (error) {
        console.log('エミュレーター接続エラー:', error);
    }
}
*/

// グローバルスコープにエクスポート
window.firebase = {
    app,
    db,
    auth
};

// 個別にもエクスポート（他のスクリプトから使いやすくするため）
window.db = db;
window.auth = auth;

console.log('Firebase初期化完了');

// Firebase接続状態の確認
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log(`Firebase認証: ログイン中のユーザー - ${user.email}`);
    } else {
        console.log('Firebase認証: ログインしていません');
    }
});

// Firestoreの接続状態監視（デバッグ用）
db._delegate._databaseId && console.log(`Firestore接続: プロジェクトID - ${db._delegate._databaseId.projectId}`);

/**
 * Firebase初期化の確認関数
 * 他のスクリプトからFirebaseが正しく初期化されているかチェックできます
 */
window.checkFirebaseConnection = function() {
    return {
        app: !!app,
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
        // 必要に応じてユーザーにエラーメッセージを表示
    } else if (event.reason && event.reason.code && event.reason.code.startsWith('firestore/')) {
        console.error('Firestoreエラー:', event.reason);
        // 必要に応じてユーザーにエラーメッセージを表示
    }
});