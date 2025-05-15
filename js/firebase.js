/**
 * Firebase初期化 - Firebase v8 シンプル版
 */

console.log('Firebase.js読み込み開始');

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

// Firebase初期化
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase初期化完了');
} else {
    console.log('Firebase既に初期化済み');
}

// Firestore初期化
const db = firebase.firestore();

// Firebase Auth初期化
const auth = firebase.auth();

// グローバルスコープに追加
window.db = db;
window.auth = auth;

console.log('Firebase設定完了 - v8版');
