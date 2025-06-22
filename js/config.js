/**
 * Firebase設定ファイル
 * 本番環境では環境変数から設定値を取得してください
 */

// 開発環境用のFirebase設定（本番では削除してください）
if (typeof window !== 'undefined') {
    window.FIREBASE_CONFIG = {
        // 🚨 セキュリティ警告: 本番環境では環境変数を使用してください
        // これらの値は開発環境でのみ使用されます
        apiKey: "REDACTED_API_KEY",
        authDomain: "attendance-system-39ae6.firebaseapp.com",
        projectId: "attendance-system-39ae6",
        storageBucket: "attendance-system-39ae6.appspot.com",
        messagingSenderId: "723896381304",
        appId: "1:723896381304:web:92f31b721706dcbf11a28d",
        measurementId: "G-8DY7MWM44W"
    };
}