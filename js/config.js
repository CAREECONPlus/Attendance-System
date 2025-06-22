/**
 * Firebase設定ファイル
 * セキュリティ強化版 - GitHub Pages対応
 */

if (typeof window !== 'undefined') {
    // 本番環境用のFirebase設定
    // APIキーは制限付き（GitHub Pages からのアクセスのみ許可）
    window.FIREBASE_CONFIG = {
        apiKey: "AIzaSyDRoE9DmPhHUINfKtkO7azI-ZTnNR4uimw",
        authDomain: "attendance-system-39ae6.firebaseapp.com",
        projectId: "attendance-system-39ae6",
        storageBucket: "attendance-system-39ae6.appspot.com",
        messagingSenderId: "723896381304",
        appId: "1:723896381304:web:92f31b721706dcbf11a28d",
        measurementId: "G-8DY7MWM44W"
    };
    
    console.log('🔐 Firebase設定読み込み完了（制限付きAPIキー使用）');
}