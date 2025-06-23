/**
 * 勤怠管理システム - ログイン機能（簡略化版 v2）
 */

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
        return;
    }
    
    
    try {
        // Firebase初期化完了を待つ
        await waitForFirebase();
        
        // ログインフォーム
        const loginForm = document.getElementById('loginForm');
        
        // 従業員登録フォーム
        const registerForm = document.getElementById('registerForm');
        
        if (loginForm) {
            // 既存のイベントリスナーを削除（重複防止）
            const newLoginForm = loginForm.cloneNode(true);
            loginForm.parentNode.replaceChild(newLoginForm, loginForm);
            
            // 新しいフォームにイベントリスナーを追加
            const freshLoginForm = document.getElementById('loginForm');
            freshLoginForm.addEventListener('submit', handleLogin);
        }
        
        if (registerForm) {
            // 既存のイベントリスナーを削除（重複防止）
            const newRegisterForm = registerForm.cloneNode(true);
            registerForm.parentNode.replaceChild(newRegisterForm, registerForm);
            
            // 新しいフォームにイベントリスナーを追加
            const freshRegisterForm = document.getElementById('registerForm');
            freshRegisterForm.addEventListener('submit', handleEmployeeRegister);
        }
        
        // Firebase認証状態の監視
        firebase.auth().onAuthStateChanged(handleAuthStateChange);
        
        
        loginInitialized = true;
        
        // 招待システムの初期化
        if (typeof initInviteSystem === 'function') {
            await initInviteSystem();
        }
        
        
    } catch (error) {
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
        // ログイン処理中フラグを設定
        window.isLoggingIn = true;
        
        // Firebase認証のみ実行（以降の処理はhandleAuthStateChangeに委譲）
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        
        // handleAuthStateChangeが自動的に呼ばれるため、ここでは何もしない
        
    } catch (error) {
        
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
        // フラグをクリア
        window.isLoggingIn = false;
        hideLoadingOverlay();
        
        // ローディング解除
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText || 'ログイン';
        }
    }
}


/**
 * 認証状態変化の処理
 */
async function handleAuthStateChange(user) {
    // 初期化中または既に処理済みの場合はスキップ
    if (window.isInitializingUser || (user && window.currentUser && window.currentUser.uid === user.uid)) {
        return;
    }
    
    if (user) {
        try {
            // 初期化開始フラグ
            window.isInitializingUser = true;
            
            // ローディング表示
            showLoadingOverlay('システムを初期化中...');
            
            // 明示的ログインかページリロードかを判定
            const isExplicitLogin = window.isLoggingIn;
            // ユーザーのテナント情報を取得
            const userTenantId = await determineUserTenant(user.email);
            
            // テナント対応のユーザーデータ取得
            let userData;
            let userDoc;
            
            if (userTenantId) {
                // テナント内からユーザーデータを取得
                const tenantUsersPath = `tenants/${userTenantId}/users`;
                userDoc = await firebase.firestore().collection(tenantUsersPath).doc(user.uid).get();
                
                if (userDoc.exists) {
                    userData = userDoc.data();
                } else {
                    // フォールバック: 従来のusersコレクションから取得
                    userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
                    if (userDoc.exists) {
                        userData = userDoc.data();
                    }
                }
            } else {
                // テナント未設定の場合は従来のusersコレクションから取得
                userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    userData = userDoc.data();
                }
            }
            
            if (userData) {
                
                // ユーザーのロールを決定
                let userRole = userData.role || 'employee';
                
                // dxconsulting.branu2@gmail.comは自動的にsuper_adminに設定
                if (user.email === 'dxconsulting.branu2@gmail.com') {
                    userRole = 'super_admin';
                    if (userData.role !== 'super_admin') {
                        await firebase.firestore().collection('users').doc(user.uid).update({ 
                            role: 'super_admin',
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }
                
                // グローバル変数設定
                window.currentUser = {
                    uid: user.uid,
                    email: user.email,
                    displayName: userData.displayName || user.displayName,
                    role: userRole,
                    tenantId: userTenantId || userData.tenantId
                };
                
                
                // テナント情報をURLに反映（スーパー管理者以外）
                if (userTenantId && userRole !== 'super_admin') {
                    const currentTenantFromUrl = getTenantFromURL();
                    if (currentTenantFromUrl !== userTenantId) {
                        const tenantUrl = generateSuccessUrl(userTenantId);
                        window.location.href = tenantUrl;
                        return;
                    }
                }
                
                // 現在のページをチェック
                const currentPage = document.querySelector('.page:not(.hidden)');
                if (!currentPage || currentPage.id === 'login-page') {
                    // ログインページ表示中の場合のみ画面遷移
                    if (userRole === 'admin' || userRole === 'super_admin') {
                        showPage('admin');
                        setTimeout(() => {
                            if (typeof initAdminPage === 'function') {
                                initAdminPage();
                            }
                        }, 200);
                    } else {
                        showPage('employee');
                        setTimeout(() => {
                            if (typeof initEmployeePage === 'function') {
                                initEmployeePage();
                            }
                        }, 200);
                    }
                }
            } else {
                await firebase.auth().signOut();
            }
        } catch (error) {
            await firebase.auth().signOut();
        } finally {
            // 初期化完了
            window.isInitializingUser = false;
            window.isLoggingIn = false;
            hideLoadingOverlay();
        }
    } else {
        // ログアウト状態
        window.currentUser = null;
        window.isInitializingUser = false;
        window.isLoggingIn = false;
        hideLoadingOverlay();
        showPage('login');
    }
}


/**
 * ログインフォームを表示
 */
function showLoginForm() {
    const loginForm = document.querySelector('#loginForm');
    
    if (loginForm) loginForm.style.display = 'block';
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
    
}


// showPage関数はutils.jsで定義済み

/**
 * DOM読み込み完了時の初期化
 */
document.addEventListener('DOMContentLoaded', async () => {
    
    // 初期状態では全ページを非表示
    document.querySelectorAll('#login-page, #employee-page, #admin-page, #admin-request-page')
        .forEach(el => el.classList.add('hidden'));
    
    // テナント初期化
    try {
        await initializeTenant();
    } catch (error) {
    }
    
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
    } catch (error) {
    }
};

window.getCurrentUser = function() {
    return window.currentUser;
};

window.checkAuth = function(requiredRole) {
    const user = window.getCurrentUser();
    if (!user) {
        showPage('login');
        return false;
    }
    
    if (requiredRole) {
        // 管理者権限チェック（adminまたはsuper_adminで満たす）
        if (requiredRole === 'admin') {
            if (user.role !== 'admin' && user.role !== 'super_admin') {
                return false;
            }
        } else if (user.role !== requiredRole) {
            return false;
        }
    }
    
    return true;
};

window.showPage = showPage;

/**
 * 従業員登録処理
 */
async function handleEmployeeRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('register-name')?.value?.trim();
    const email = document.getElementById('register-email')?.value?.trim();
    const password = document.getElementById('register-password')?.value?.trim();
    const passwordConfirm = document.getElementById('register-password-confirm')?.value?.trim();
    const inviteToken = window.currentInviteToken;
    
    // バリデーション
    if (!name || !email || !password || !passwordConfirm) {
        showRegisterError('すべての項目を入力してください');
        return;
    }
    
    if (password !== passwordConfirm) {
        showRegisterError('パスワードが一致しません');
        return;
    }
    
    if (password.length < 6) {
        showRegisterError('パスワードは6文字以上で入力してください');
        return;
    }
    
    if (!inviteToken) {
        showRegisterError('招待トークンが見つかりません');
        return;
    }
    
    // ローディング表示
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '登録中...';
    }
    
    try {
        // 招待トークンを使って従業員登録
        const result = await registerEmployeeWithInvite(email, password, name, inviteToken);
        
        if (result.success) {
            // 登録成功 - ユーザー情報を設定してページ遷移
            
            // グローバル変数にユーザー情報を設定
            window.currentUser = {
                uid: result.user.uid,
                email: result.user.email,
                displayName: result.user.displayName || name,
                role: 'employee',
                tenantId: result.tenantId
            };
            
            if (result.tenantId) {
                const tenantUrl = `${window.location.origin}${window.location.pathname}?tenant=${result.tenantId}`;
                window.location.href = tenantUrl;
            } else {
                if (typeof showPage === 'function') {
                    showPage('employee');
                    setTimeout(() => {
                        if (typeof initEmployeePage === 'function') {
                            initEmployeePage();
                        }
                    }, 200);
                }
            }
        } else {
            showRegisterError(result.error || '登録に失敗しました');
        }
        
    } catch (error) {
        console.error('Registration error:', error);
        let message = '登録に失敗しました';
        
        if (error.code === 'auth/email-already-in-use') {
            message = 'このメールアドレスは既に使用されています。別のメールアドレスを使用するか、既存のアカウントでログインしてください。';
        } else if (error.code === 'auth/invalid-email') {
            message = 'メールアドレスの形式が正しくありません';
        } else if (error.code === 'auth/weak-password') {
            message = 'パスワードが弱すぎます';
        }
        
        showRegisterError(message);
    } finally {
        // ローディング解除
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText || '登録';
        }
    }
}

/**
 * 登録エラー表示
 */
function showRegisterError(message) {
    const errorElement = document.getElementById('register-error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
        
        // 5秒後に自動で隠す
        setTimeout(() => {
            errorElement.classList.add('hidden');
        }, 5000);
    }
}


