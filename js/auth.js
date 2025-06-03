console.log('auth.js loaded');

/**
 * 勤怠管理システム - Firebase認証機能 (v8 SDK対応版)
 * 
 * このファイルには、Firebase Authenticationを使用した
 * ログイン、登録、ログアウト、認証状態管理の機能が含まれています。
 */

// Firebase関連の参照を取得
let auth;
let db;

// 初期化関数
function initAuth() {
    // Firebase参照を取得
    auth = window.auth;
    db = window.db;
    
    if (!auth || !db) {
        console.error('Firebase が初期化されていません');
        return;
    }
    
    console.log('Firebase Auth初期化完了');
}

/**
 * メールアドレスとパスワードでユーザー登録
 * @param {string} email メールアドレス
 * @param {string} password パスワード
 * @param {string} displayName 表示名
 * @param {string} role ユーザーの役割（'admin' または 'employee'）
 * @returns {Object} { success: boolean, user?: User, error?: string }
 */
async function registerUser(email, password, displayName, role = 'employee') {
    try {
        // Firebase Authenticationでユーザー作成
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // ユーザープロフィールを更新
        await user.updateProfile({
            displayName: displayName
        });
        
        // Firestoreにユーザー情報を保存
        await db.collection('users').doc(user.uid).set({
            email: email,
            displayName: displayName,
            role: role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            siteHistory: []
        });
        
        console.log('ユーザー登録成功:', user.email);
        return { success: true, user: user };
        
    } catch (error) {
        console.error('ユーザー登録エラー:', error);
        return { success: false, error: error.message };
    }
}

/**
 * メールアドレスとパスワードでログイン
 * @param {string} email メールアドレス
 * @param {string} password パスワード
 * @returns {Object} { success: boolean, user?: User, error?: string }
 */
async function loginUser(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        console.log('ログイン成功:', user.email);
        return { success: true, user: user };
        
    } catch (error) {
        console.error('ログインエラー:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ログアウト
 * @returns {Object} { success: boolean, error?: string }
 */
async function logoutUser() {
    try {
        await auth.signOut();
        console.log('ログアウト成功');
        return { success: true };
        
    } catch (error) {
        console.error('ログアウトエラー:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 現在のユーザーの情報を取得
 * @returns {Object|null} ユーザー情報またはnull
 */
function getCurrentUser() {
    return auth ? auth.currentUser : null;
}

/**
 * ユーザーのロール情報をFirestoreから取得
 * @param {string} userId ユーザーID
 * @returns {Object} { success: boolean, role?: string, userData?: Object, error?: string }
 */
async function getUserRole(userId) {
    try {
        if (!userId) {
            return { success: false, error: 'ユーザーIDが無効です' };
        }
        
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            return { 
                success: true, 
                role: userData.role || 'employee',
                userData: userData
            };
        } else {
            console.warn('ユーザー情報が見つかりません:', userId);
            return { success: false, error: 'ユーザー情報が見つかりません' };
        }
        
    } catch (error) {
        console.error('ユーザーロール取得エラー:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 認証状態の変化を監視
 * @param {Function} callback 認証状態が変化した時に呼び出されるコールバック
 * @returns {Function} アンサブスクライブ関数
 */
function onAuthChanged(callback) {
    if (!auth) {
        console.error('Firebase Authが初期化されていません');
        return () => {};
    }
    
    return auth.onAuthStateChanged(callback);
}

// DOMが読み込まれたら初期化
document.addEventListener('DOMContentLoaded', () => {
    // Firebaseの初期化を待つ
    if (window.auth && window.db) {
        initAuth();
    } else {
        // Firebaseが初期化されるまで待機
        const checkInterval = setInterval(() => {
            if (window.auth && window.db) {
                clearInterval(checkInterval);
                initAuth();
            }
        }, 100);
    }
});

// グローバルスコープに関数をエクスポート
window.registerUser = registerUser;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.getCurrentUser = getCurrentUser;
window.getUserRole = getUserRole;
window.onAuthChanged = onAuthChanged;

console.log('Auth関数をグローバルにエクスポートしました');
