/**
 * 勤怠管理システム - ログイン機能（簡略化版 v2）
 */
console.log('login.js loaded - Simplified version v2');

// 初期化フラグ
let loginInitialized = false;

/**
 * Firebase初期化完了を待つ
 */
function waitForFirebase() {
    return new Promise((resolve) => {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
            resolve();
        } else {
            const checkInterval = setInterval(() => {
                if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        }
    });
}

/**
 * ログイン機能の初期化
 */
async function initLogin() {
    if (loginInitialized) {
        console.log('⚠️ ログイン機能は既に初期化済みです');
        return;
    }
    
    console.log('🚀 ログイン機能初期化開始');
    
    try {
        // Firebase初期化完了を待つ
        await waitForFirebase();
        console.log('✅ Firebase初期化確認完了');
        
        // ログインフォーム
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            // 既存のイベントリスナーを削除（重複防止）
            const newLoginForm = loginForm.cloneNode(true);
            loginForm.parentNode.replaceChild(newLoginForm, loginForm);
            
            // 新しいフォームにイベントリスナーを追加
            const freshLoginForm = document.getElementById('loginForm');
            freshLoginForm.addEventListener('submit', handleLogin);
            console.log('✅ ログインフォーム設定完了');
        } else {
            console.warn('⚠️ ログインフォームが見つかりません');
        }
        
        // 登録フォーム
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            // 既存のイベントリスナーを削除（重複防止）
            const newRegisterForm = registerForm.cloneNode(true);
            registerForm.parentNode.replaceChild(newRegisterForm, registerForm);
            
            // 新しいフォームにイベントリスナーを追加
            const freshRegisterForm = document.getElementById('registerForm');
            freshRegisterForm.addEventListener('submit', handleRegister);
            console.log('✅ 登録フォーム設定完了');
        } else {
            console.warn('⚠️ 登録フォームが見つかりません');
        }
        
        // フォーム切り替えボタン
        const showRegisterBtn = document.getElementById('showRegisterButton');
        const showLoginBtn = document.getElementById('showLoginButton');
        
        if (showRegisterBtn) {
            showRegisterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                showRegisterForm();
            });
        }
        
        if (showLoginBtn) {
            showLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                showLoginForm();
            });
        }
        
        // Firebase認証状態の監視
        firebase.auth().onAuthStateChanged(handleAuthStateChange);
        
        
        loginInitialized = true;
        console.log('🎉 ログイン機能初期化完了');
        
    } catch (error) {
        console.error('❌ ログイン初期化エラー:', error);
        // 3秒後に再試行
        setTimeout(() => {
            loginInitialized = false;
            initLogin();
        }, 3000);
    }
}

/**
 * ログイン処理
 */
async function handleLogin(e) {
    e.preventDefault();
    console.log('🔐 ログイン処理開始');
    
    const email = document.getElementById('email')?.value?.trim();
    const password = document.getElementById('password')?.value?.trim();
    
    if (!email || !password) {
        showError('メールアドレスとパスワードを入力してください');
        return;
    }
    
    // ローディング表示
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'ログイン中...';
    }
    
    try {
        // Firebase認証
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        console.log('✅ Firebase認証成功:', user.uid);
        
        // ユーザーデータ取得
        const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            throw new Error('ユーザーデータが見つかりません');
        }
        
        const userData = userDoc.data();
        console.log('✅ ユーザーデータ取得:', userData);
        
        // ユーザーのロールを決定
        let userRole = userData.role || 'employee';
        
        // dxconsulting.branu2@gmail.comは自動的にsuper_adminに設定
        if (user.email === 'dxconsulting.branu2@gmail.com') {
            userRole = 'super_admin';
            // Firestoreのroleも強制的に更新
            if (userData.role !== 'super_admin') {
                await db.collection('users').doc(user.uid).update({ 
                    role: 'super_admin',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('✅ super_adminロールに強制更新:', user.email);
            } else {
                console.log('✅ 既にsuper_adminロール:', user.email);
            }
        }
        
        // グローバル変数設定
        window.currentUser = {
            uid: user.uid,
            email: user.email,
            displayName: userData.displayName || user.displayName,
            role: userRole
        };
        
        console.log('🎉 ログイン成功:', window.currentUser);
        
        // 適切なページに遷移
        if (window.currentUser.role === 'admin' || window.currentUser.role === 'super_admin') {
            console.log('👑 管理者画面に遷移 (role:', window.currentUser.role + ')');
            showPage('admin');
            // 管理者画面の初期化
            setTimeout(() => {
                if (typeof initAdminPage === 'function') {
                    initAdminPage();
                }
            }, 200);
        } else {
            console.log('👤 従業員画面に遷移');
            showPage('employee');
            // 従業員画面の初期化
            setTimeout(() => {
                if (typeof initEmployeePage === 'function') {
                    initEmployeePage();
                }
            }, 200);
        }
        
    } catch (error) {
        console.error('❌ ログインエラー:', error);
        
        let message = 'ログインに失敗しました';
        if (error.code === 'auth/user-not-found') {
            message = 'ユーザーが見つかりません';
        } else if (error.code === 'auth/wrong-password') {
            message = 'パスワードが正しくありません';
        } else if (error.code === 'auth/invalid-email') {
            message = 'メールアドレスの形式が正しくありません';
        } else if (error.code === 'auth/too-many-requests') {
            message = 'ログイン試行回数が多すぎます。しばらく時間をおいてから再試行してください';
        }
        
        showError(message);
    } finally {
        // ローディング解除
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText || 'ログイン';
        }
    }
}

/**
 * 登録処理
 */
async function handleRegister(e) {
    e.preventDefault();
    console.log('👤 登録処理開始');
    
    const email = document.getElementById('registerEmail')?.value?.trim();
    const password = document.getElementById('registerPassword')?.value?.trim();
    const displayName = document.getElementById('displayName')?.value?.trim();
    
    // ロールを決定（dxconsulting.branu2@gmail.comは自動的にsuper_admin）
    let role = 'employee';
    if (email === 'dxconsulting.branu2@gmail.com') {
        role = 'super_admin';
        console.log('🔥 スーパー管理者として登録:', email);
    }
    
    if (!email || !password || !displayName) {
        showRegisterError('全ての項目を入力してください');
        return;
    }
    
    if (password.length < 6) {
        showRegisterError('パスワードは6文字以上で入力してください');
        return;
    }
    
    // ローディング表示
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '登録中...';
    }
    
    try {
        // Firebase認証でユーザー作成
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        console.log('✅ Firebase認証ユーザー作成:', user.uid);
        
        // Firestoreにユーザーデータ保存
        const userData = {
            uid: user.uid,
            email: email,
            displayName: displayName,
            role: role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await firebase.firestore().collection('users').doc(user.uid).set(userData);
        console.log('✅ ユーザーデータ保存完了');
        
        // Firebase Authプロファイル更新
        await user.updateProfile({
            displayName: displayName
        });
        
        alert('登録が完了しました！ログインしてください。');
        showLoginForm();
        
        // フォームをリセット
        e.target.reset();
        
        console.log('🎉 登録完了');
        
    } catch (error) {
        console.error('❌ 登録エラー:', error);
        
        let message = '登録に失敗しました';
        if (error.code === 'auth/email-already-in-use') {
            message = 'このメールアドレスは既に使用されています';
        } else if (error.code === 'auth/invalid-email') {
            message = 'メールアドレスの形式が正しくありません';
        } else if (error.code === 'auth/weak-password') {
            message = 'パスワードが弱すぎます（6文字以上で入力してください）';
        }
        
        showRegisterError(message);
    } finally {
        // ローディング解除
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText || '登録する';
        }
    }
}

/**
 * 認証状態変化の処理
 */
async function handleAuthStateChange(user) {
    console.log('🔐 認証状態変化:', user ? user.uid : 'null');
    
    if (user) {
        try {
            // ユーザーデータを取得
            const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                
                // ユーザーのロールを決定
                let userRole = userData.role || 'employee';
                
                // dxconsulting.branu2@gmail.comは自動的にsuper_adminに設定
                if (user.email === 'dxconsulting.branu2@gmail.com') {
                    userRole = 'super_admin';
                    // Firestoreのroleも強制的に更新
                    if (userData.role !== 'super_admin') {
                        await firebase.firestore().collection('users').doc(user.uid).update({ 
                            role: 'super_admin',
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        console.log('✅ super_adminロールに強制更新 (認証状態変化時):', user.email);
                    } else {
                        console.log('✅ 既にsuper_adminロール (認証状態変化時):', user.email);
                    }
                }
                
                // グローバル変数設定
                window.currentUser = {
                    uid: user.uid,
                    email: user.email,
                    displayName: userData.displayName || user.displayName,
                    role: userRole
                };
                
                console.log('✅ 認証済みユーザー設定完了:', window.currentUser);
                
                // 現在のページをチェック
                const currentPage = document.querySelector('.page:not(.hidden)');
                if (!currentPage || currentPage.id === 'login-page') {
                    // ログインページ表示中の場合のみ画面遷移
                    if (userRole === 'admin' || userRole === 'super_admin') {
                        console.log('👑 管理者画面に遷移 (認証状態変化 role:', userRole + ')');
                        showPage('admin');
                        setTimeout(() => {
                            if (typeof initAdminPage === 'function') {
                                initAdminPage();
                            }
                        }, 200);
                    } else {
                        console.log('👤 従業員画面に遷移 (認証状態変化)');
                        showPage('employee');
                        setTimeout(() => {
                            if (typeof initEmployeePage === 'function') {
                                initEmployeePage();
                            }
                        }, 200);
                    }
                }
            } else {
                console.error('❌ ユーザーデータが見つかりません');
                await firebase.auth().signOut();
            }
        } catch (error) {
            console.error('❌ ユーザーデータ取得エラー:', error);
            await firebase.auth().signOut();
        }
    } else {
        // ログアウト状態
        window.currentUser = null;
        showPage('login');
        console.log('✅ ログアウト状態');
    }
}

/**
 * 登録フォームを表示
 */
function showRegisterForm() {
    const loginForm = document.querySelector('#loginForm');
    const registerForm = document.querySelector('#registerForm');
    const showRegisterBtn = document.getElementById('showRegisterButton');
    const showLoginBtn = document.getElementById('showLoginButton');
    const toggleText = document.getElementById('toggle-text');
    
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
    if (showRegisterBtn) showRegisterBtn.style.display = 'none';
    if (showLoginBtn) showLoginBtn.style.display = 'inline';
    if (toggleText) toggleText.textContent = '既にアカウントをお持ちの方は';
    
    console.log('🔄 登録フォームに切り替え');
}

/**
 * ログインフォームを表示
 */
function showLoginForm() {
    const loginForm = document.querySelector('#loginForm');
    const registerForm = document.querySelector('#registerForm');
    const showRegisterBtn = document.getElementById('showRegisterButton');
    const showLoginBtn = document.getElementById('showLoginButton');
    const toggleText = document.getElementById('toggle-text');
    
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
    if (showRegisterBtn) showRegisterBtn.style.display = 'inline';
    if (showLoginBtn) showLoginBtn.style.display = 'none';
    if (toggleText) toggleText.textContent = 'アカウントをお持ちでない方は';
    
    console.log('🔄 ログインフォームに切り替え');
}

/**
 * エラーメッセージ表示
 */
function showError(message) {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
        setTimeout(() => {
            errorElement.classList.add('hidden');
        }, 5000);
    }
    
    console.error('❌ エラー:', message);
}

/**
 * 登録エラーメッセージ表示
 */
function showRegisterError(message) {
    const errorElement = document.getElementById('register-error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
        setTimeout(() => {
            errorElement.classList.add('hidden');
        }, 5000);
    }
    
    console.error('❌ 登録エラー:', message);
}

/**
 * ページ切り替え
 */
function showPage(pageName) {
    // 全てのページを非表示
    document.querySelectorAll('#login-page, #employee-page, #admin-page, #register-page, #admin-request-page')
        .forEach(el => el.classList.add('hidden'));
    
    // 指定されたページを表示
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
        console.log(`✅ ページ切り替え: ${pageName}`);
    } else {
        console.error(`❌ ページが見つかりません: ${pageName}-page`);
    }
}

/**
 * DOM読み込み完了時の初期化
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM読み込み完了 - ログイン初期化開始');
    
    // 初期状態では全ページを非表示
    document.querySelectorAll('#login-page, #employee-page, #admin-page, #register-page, #admin-request-page')
        .forEach(el => el.classList.add('hidden'));
    
    // 少し遅延させてFirebase初期化を確実に待つ
    setTimeout(() => {
        initLogin();
    }, 500);
});

/**
 * グローバル関数のエクスポート
 */
window.signOut = async function() {
    try {
        await firebase.auth().signOut();
        console.log('✅ ログアウト成功');
    } catch (error) {
        console.error('❌ ログアウトエラー:', error);
    }
};

window.getCurrentUser = function() {
    return window.currentUser;
};

window.checkAuth = function(requiredRole) {
    const user = window.getCurrentUser();
    if (!user) {
        console.log('❌ ユーザーが認証されていません');
        showPage('login');
        return false;
    }
    
    if (requiredRole) {
        // 管理者権限チェック（adminまたはsuper_adminで満たす）
        if (requiredRole === 'admin') {
            if (user.role !== 'admin' && user.role !== 'super_admin') {
                console.log(`❌ 権限不足: 要求=${requiredRole}, 実際=${user.role}`);
                return false;
            }
        } else if (user.role !== requiredRole) {
            console.log(`❌ 権限不足: 要求=${requiredRole}, 実際=${user.role}`);
            return false;
        }
    }
    
    return true;
};

window.showPage = showPage;


console.log('✅ login.js 読み込み完了');
