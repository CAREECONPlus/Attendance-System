/**
 * Firebase設定ファイル
 * 本番環境では環境変数から設定値を取得してください
 */

// 開発環境用のFirebase設定（本番では削除してください）
if (typeof window !== 'undefined') {
    window.FIREBASE_CONFIG = {
        // 🚨 セキュリティ警告: 本番環境では環境変数を使用してください
        // これらの値は開発環境でのみ使用されます
        apiKey: "YOUR_FIREBASE_API_KEY_HERE",
        authDomain: "YOUR_PROJECT.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT.appspot.com",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID",
        measurementId: "YOUR_MEASUREMENT_ID"
    };
}