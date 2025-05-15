/**
 * Firebase認証関連ユーティリティ (Firebase v8対応)
 */

console.log('auth.js (Firebase v8) 読み込み開始');

/**
 * 現在のユーザーを取得
 */
function getCurrentUser() {
    return firebase.auth().currentUser;
}

/**
 * ユーザーがログインしているかチェック
 */
function isLoggedIn() {
    return getCurrentUser() !== null;
}

/**
 * 認証状態の監視
 */
function onAuthStateChanged(callback) {
    return firebase.auth().onAuthStateChanged(callback);
}

/**
 * メールアドレスとパスワードでユーザー登録 (Firebase v8)
 * @param {string} email メールアドレス
 * @param {string} password パスワード
 * @param {string} displayName 表示名
 * @param {string} role ユーザーの役割（'admin' または 'employee'）
 * @returns {Object} { success: boolean, user?: User, error?: string }
 */
async function registerUser(email, password, displayName, role = 'employee') {
    try {
        console.log('ユーザー登録開始:', email);
        
        // Firebase Authenticationでユーザー作成
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
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
 * メールアドレスとパスワードでログイン (Firebase v8)
 * @param {string} email メールアドレス
 * @param {string} password パスワード
 * @returns {Object} { success: boolean, user?: User, error?: string }
 */
async function loginUser(email, password) {
    try {
        console.log('ログイン試行:', email);
        
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        console.log('Firebase認証成功:', user.email);
        return { success: true, user: user };
        
    } catch (error) {
        console.error('ログインエラー:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ログアウト (Firebase v8)
 * @returns {Object} { success: boolean, error?: string }
 */
async function logoutUser() {
    try {
        await firebase.auth().signOut();
        console.log('ログアウト成功');
        return { success: true };
        
    } catch (error) {
        console.error('ログアウトエラー:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ユーザーの役割をFirestoreから取得 (Firebase v8)
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
 * 認証と役割チェック (Firebase v8)
 * @param {string} requiredRole 必要な役割（'admin' または 'employee'）
 * @returns {boolean} 認証と役割チェックの結果
 */
async function checkAuth(requiredRole = null) {
    const user = getCurrentUser();
    
    if (!user) {
        console.log('未認証 - ログイン画面へリダイレクト');
        window.location.href = 'login.html';
        return false;
    }
    
    if (requiredRole) {
        const roleResult = await getUserRole(user.uid);
        
        if (!roleResult.success) {
            console.log('ユーザー役割取得失敗 - ログイン画面へリダイレクト');
            window.location.href = 'login.html';
            return false;
        }
        
        const userRole = roleResult.role;
        
        if (userRole !== requiredRole) {
            console.log(`権限不足: ${userRole} !== ${requiredRole}`);
            
            // 適切なページにリダイレクト
            if (userRole === 'admin') {
                window.location.href = 'admin.html';
            } else if (userRole === 'employee') {
                window.location.href = 'employee.html';
            } else {
                window.location.href = 'login.html';
            }
            return false;
        }
    }
    
    return true;
}

/**
 * ページ初期化時の認証確認 (Firebase v8)
 * @param {string} requiredRole 必要な役割
 * @returns {Promise} 認証確認の結果
 */
async function initAuth(requiredRole = null) {
    return new Promise((resolve) => {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                console.log('認証済みユーザー:', user.email);
                
                if (requiredRole) {
                    const isValid = await checkAuth(requiredRole);
                    resolve({ user, isValid });
                } else {
                    resolve({ user, isValid: true });
                }
            } else {
                console.log('未認証ユーザー');
                window.location.href = 'login.html';
                resolve({ user: null, isValid: false });
            }
        });
    });
}

/**
 * パスワードリセットメールを送信 (Firebase v8)
 * @param {string} email メールアドレス
 * @returns {Object} { success: boolean, error?: string }
 */
async function sendPasswordReset(email) {
    try {
        await firebase.auth().sendPasswordResetEmail(email);
        console.log('パスワードリセットメール送信成功:', email);
        return { success: true };
        
    } catch (error) {
        console.error('パスワードリセットメール送信エラー:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 現在のユーザーのプロフィールを更新 (Firebase v8)
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
            await user.updateProfile({ displayName: updates.displayName });
        }
        
        // メールアドレス更新
        if (updates.email) {
            await user.updateEmail(updates.email);
        }
        
        // Firestoreのユーザー情報も更新
        const updateData = {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (updates.displayName) updateData.displayName = updates.displayName;
        if (updates.email) updateData.email = updates.email;
        
        await db.collection('users').doc(user.uid).update(updateData);
        
        console.log('プロフィール更新成功');
        return { success: true };
        
    } catch (error) {
        console.error('プロフィール更新エラー:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ユーザーアカウントを削除 (Firebase v8)
 * @returns {Object} { success: boolean, error?: string }
 */
async function deleteUserAccount() {
    try {
        const user = getCurrentUser();
        if (!user) {
            return { success: false, error: 'ログインしていません' };
        }
        
        // Firestoreからユーザー情報を削除
        await db.collection('users').doc(user.uid).delete();
        
        // 関連する勤怠記録も削除
        const attendanceQuery = await db.collection('attendance')
            .where('userId', '==', user.uid)
            .get();
        
        const batch = db.batch();
        attendanceQuery.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        
        // Authenticationからユーザーを削除
        await user.delete();
        
        console.log('アカウント削除成功');
        return { success: true };
        
    } catch (error) {
        console.error('アカウント削除エラー:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ユーザー情報をローカルストレージに保存
 */
function saveUserToLocalStorage(user, userData) {
    const userInfo = {
        uid: user.uid,
        email: user.email,
        displayName: userData.displayName || user.displayName,
        role: userData.role,
        lastLogin: new Date().toISOString()
    };
    
    localStorage.setItem('currentUser', JSON.stringify(userInfo));
}

/**
 * ローカルストレージからユーザー情報を取得
 */
function getUserFromLocalStorage() {
    const userInfo = localStorage.getItem('currentUser');
    return userInfo ? JSON.parse(userInfo) : null;
}

/**
 * ローカルストレージからユーザー情報を削除
 */
function clearUserFromLocalStorage() {
    localStorage.removeItem('currentUser');
}

// Firebase認証状態のグローバル監視を設定
document.addEventListener('DOMContentLoaded', function() {
    // Firebaseが初期化されるまで待機
    if (typeof firebase !== 'undefined' && firebase.auth) {
        console.log('Firebase認証監視開始');
        
        firebase.auth().onAuthStateChanged(async function(user) {
            if (user) {
                // ユーザー情報をローカルストレージに保存
                try {
                    const userRole = await getUserRole(user.uid);
                    if (userRole.success) {
                        saveUserToLocalStorage(user, userRole.userData);
                    }
                } catch (error) {
                    console.error('ユーザー情報保存エラー:', error);
                }
            } else {
                // ログアウト時にローカルストレージをクリア
                clearUserFromLocalStorage();
            }
        });
    }
});

console.log('auth.js (Firebase v8) 読み込み完了');

// v8形式の関数をグローバルスコープにエクスポート
window.registerUser = registerUser;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.getCurrentUser = getCurrentUser;
window.getUserRole = getUserRole;
window.onAuthStateChanged = onAuthStateChanged;
window.sendPasswordReset = sendPasswordReset;
window.updateUserProfile = updateUserProfile;
window.deleteUserAccount = deleteUserAccount;
window.checkAuth = checkAuth;
window.initAuth = initAuth;
window.isLoggedIn = isLoggedIn;
window.saveUserToLocalStorage = saveUserToLocalStorage;
window.getUserFromLocalStorage = getUserFromLocalStorage;
window.clearUserFromLocalStorage = clearUserFromLocalStorage;
