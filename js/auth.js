
/**
 * 勤怠管理システム - Firebase認証機能 (v8 SDK対応版)
 * 
 * このファイルには、Firebase Authenticationを使用した
 * ログイン、登録、ログアウト、認証状態管理の機能が含まれています。
 */

// Firebase関連の参照を取得（グローバル変数を使用）
let firebaseAuth;
let firestoreDb;

// 初期化関数
function initAuth() {
    // Firebase参照を取得（firebase.js で定義されたものを使用）
    firebaseAuth = window.auth;
    firestoreDb = window.db;
    
    if (!firebaseAuth || !firestoreDb) {
        return;
    }
    
}

/**
 * 招待トークンを使った従業員登録
 * @param {string} email メールアドレス
 * @param {string} password パスワード
 * @param {string} displayName 表示名
 * @param {string} inviteToken 招待トークン
 * @returns {Object} { success: boolean, user?: User, error?: string }
 */
async function registerEmployeeWithInvite(email, password, displayName, inviteToken) {
    try {
        // 招待トークンを検証
        const validation = await validateInviteToken(inviteToken);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        // Firebase Authenticationでユーザー作成
        const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // ユーザープロフィールを更新
        await user.updateProfile({
            displayName: displayName
        });
        
        // Firebase Auth状態の同期を確実にする
        console.log('User created, synchronizing auth state...');
        
        // Firebase Auth状態を強制的に更新
        await firebaseAuth.updateCurrentUser(user);
        console.log('Current user updated');
        
        // IDトークンを取得
        let idToken;
        try {
            idToken = await user.getIdToken(true);
            console.log('ID token obtained successfully');
        } catch (tokenError) {
            console.log('ID token error, retrying...', tokenError.message);
            await new Promise(resolve => setTimeout(resolve, 1000));
            idToken = await user.getIdToken(true);
            console.log('ID token obtained on retry');
        }
        
        // 認証状態の確認
        console.log('Auth state after update:', {
            currentUser: firebaseAuth.currentUser?.uid,
            targetUser: user.uid,
            match: firebaseAuth.currentUser?.uid === user.uid
        });
        
        // テナント情報を取得
        const tenantId = validation.tenantId;
        
        // Firestore書き込みを順次実行（エラーハンドリング強化）
        try {
            // デバッグ: 現在の認証状態を確認
            console.log('Current auth user:', firebaseAuth.currentUser?.uid);
            console.log('Target user UID:', user.uid);
            console.log('ID Token available:', !!idToken);
            
            // テスト: 最初に簡単なコレクションに書き込みテスト
            console.log('Testing write permissions with _test collection...');
            await firestoreDb.collection('_test').doc('test-' + Date.now()).set({
                test: true,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userUid: user.uid
            });
            console.log('✅ Test write successful');
            
            // 1. テナント内ユーザー情報を保存
            console.log('Saving user data to tenant collection...');
            console.log('Tenant ID:', tenantId);
            console.log('User UID:', user.uid);
            
            const userCollection = firestoreDb.collection('tenants').doc(tenantId).collection('users');
            await userCollection.doc(user.uid).set({
                email: email,
                displayName: displayName,
                role: 'employee',
                tenantId: tenantId,
                inviteToken: inviteToken,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                siteHistory: []
            });
            console.log('✅ Tenant user data saved successfully');

            // 2. global_usersに追加
            console.log('Saving to global_users...');
            await firestoreDb.collection('global_users').doc(user.uid).set({
                email: email,
                displayName: displayName,
                tenantId: tenantId,
                role: 'employee',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Global user data saved successfully');

            // 3. 招待コードの使用回数を更新
            console.log('Updating invite code usage...');
            await firestoreDb.collection('invite_codes').doc(validation.inviteId).update({
                used: firebase.firestore.FieldValue.increment(1),
                lastUsedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Invite code updated successfully');
            
        } catch (firestoreError) {
            console.error('Firestore operation failed:', firestoreError);
            // ユーザー作成は成功したが、Firestore保存で失敗した場合
            // ユーザーを削除するかログに記録する
            throw new Error(`ユーザー情報の保存に失敗しました: ${firestoreError.message}`);
        }

        return { success: true, user: user, tenantId: tenantId };
        
    } catch (error) {
        console.error('Employee registration with invite failed:', error);
        return { success: false, error: error.message };
    }
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
    // セキュリティ: 通常の登録では管理者権限を付与しない
    if (role === 'admin' || role === 'super_admin') {
        role = 'employee';
    }
    try {
        // Firebase Authenticationでユーザー作成
        const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // ユーザープロフィールを更新
        await user.updateProfile({
            displayName: displayName
        });
        
        // Firestoreにユーザー情報を保存（テナント対応）
        const userCollection = window.getUserCollection ? window.getUserCollection() : firestoreDb.collection('users');
        await userCollection.doc(user.uid).set({
            email: email,
            displayName: displayName,
            role: role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            siteHistory: []
        });
        
        return { success: true, user: user };
        
    } catch (error) {
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
        const userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        return { success: true, user: user };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * ログアウト
 * @returns {Object} { success: boolean, error?: string }
 */
async function logoutUser() {
    try {
        await firebaseAuth.signOut();
        return { success: true };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * 現在のユーザーの情報を取得
 * @returns {Object|null} ユーザー情報またはnull
 */
function getCurrentUser() {
    return firebaseAuth ? firebaseAuth.currentUser : null;
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
        
        // テナント対応のユーザー情報取得
        const userCollection = window.getUserCollection ? window.getUserCollection() : firestoreDb.collection('users');
        const userDoc = await userCollection.doc(userId).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            return { 
                success: true, 
                role: userData.role || 'employee',
                userData: userData
            };
        } else {
            return { success: false, error: 'ユーザー情報が見つかりません' };
        }
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * 認証状態の変化を監視
 * @param {Function} callback 認証状態が変化した時に呼び出されるコールバック
 * @returns {Function} アンサブスクライブ関数
 */
function onAuthChanged(callback) {
    if (!firebaseAuth) {
        return () => {};
    }
    
    return firebaseAuth.onAuthStateChanged(callback);
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

