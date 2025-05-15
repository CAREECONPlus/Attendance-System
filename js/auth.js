console.log('auth.js loaded');

/**
 * 勤怠管理システム - Firebase認証機能
 * 
 * このファイルには、Firebase Authenticationを使用した
 * ログイン、登録、ログアウト、認証状態管理の機能が含まれています。
 */

// Firebase モジュールのインポート
import { 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail,
    updateEmail,
    deleteUser
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

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
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // ユーザープロフィールを更新
        await updateProfile(user, {
            displayName: displayName
        });
        
        // Firestoreにユーザー情報を保存
        await setDoc(doc(db, 'users', user.uid), {
            email: email,
            displayName: displayName,
            role: role,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
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
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
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
        await signOut(auth);
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
        
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
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
    
    return onAuthStateChanged(auth, callback);
}

/**
 * パスワードリセットメールを送信
 * @param {string} email メールアドレス
 * @returns {Object} { success: boolean, error?: string }
 */
async function sendPasswordReset(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        console.log('パスワードリセットメール送信成功:', email);
        return { success: true };
        
    } catch (error) {
        console.error('パスワードリセットメール送信エラー:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 現在のユーザーのプロフィールを更新
 * @param {Object} updates 更新する情報 { displayName?, email? }
 * @returns {Object} { success: boolean, error?: string }
 */
async function updateUserProfile(updates) {
    try {
        const user = getCurrentUser();
        if (!user) {
            return { success: false, error: 'ログインしていません' };
        }
        
        // プロフィール更新
        if (updates.displayName) {
            await updateProfile(user, { displayName: updates.displayName });
        }
        
        // メールアドレス更新
        if (updates.email) {
            await updateEmail(user, updates.email);
        }
        
        // Firestoreのユーザー情報も更新
        const updateData = {
            updatedAt: serverTimestamp()
        };
        
        if (updates.displayName) updateData.displayName = updates.displayName;
        if (updates.email) updateData.email = updates.email;
        
        await updateDoc(doc(db, 'users', user.uid), updateData);
        
        console.log('プロフィール更新成功');
        return { success: true };
        
    } catch (error) {
        console.error('プロフィール更新エラー:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ユーザーアカウントを削除
 * @returns {Object} { success: boolean, error?: string }
 */
async function deleteUserAccount() {
    try {
        const user = getCurrentUser();
        if (!user) {
            return { success: false, error: 'ログインしていません' };
        }
        
        // Firestoreからユーザー情報を削除
        await deleteDoc(doc(db, 'users', user.uid));
        
        // Authenticationからユーザーを削除
        await deleteUser(user);
        
        console.log('アカウント削除成功');
        return { success: true };
        
    } catch (error) {
        console.error('アカウント削除エラー:', error);
        return { success: false, error: error.message };
    }
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
window.sendPasswordReset = sendPasswordReset;
window.updateUserProfile = updateUserProfile;
window.deleteUserAccount = deleteUserAccount;

console.log('Auth関数をグローバルにエクスポートしました');