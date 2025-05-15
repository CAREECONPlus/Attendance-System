/**
 * ログイン画面処理 (Firebase v8 - HTML構造対応版)
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('ログイン画面初期化開始');
    
    // Firebase認証状態の監視
    firebase.auth().onAuthStateChanged(async function(user) {
        if (user) {
            console.log('ユーザーは既にログイン済み:', user.email);
            await redirectBasedOnRole(user);
        }
    });
    
    // ログインフォームの処理
    setupLoginForm();
    // 新規登録フォームの処理
    setupRegisterForm();
    // ページ切り替えの処理
    setupPageSwitcher();
});

/**
 * ページの表示/非表示を切り替え
 */
function showPage(pageType) {
    const loginPage = document.querySelector('.login-container');
    const registerPage = document.getElementById('register-page');
    
    if (pageType === 'login') {
        if (loginPage) loginPage.classList.remove('hidden');
        if (registerPage) registerPage.classList.add('hidden');
    } else if (pageType === 'register') {
        if (loginPage) loginPage.classList.add('hidden');
        if (registerPage) registerPage.classList.remove('hidden');
    }
}

/**
 * ページ切り替えの設定
 */
function setupPageSwitcher() {
    // 新規登録へのリンク
    const goToRegister = document.getElementById('go-to-register');
    if (goToRegister) {
        goToRegister.addEventListener('click', function(e) {
            e.preventDefault();
            showPage('register');
        });
    }
    
    // ログインへ戻るリンク
    const backToLogin = document.getElementById('back-to-login');
    if (backToLogin) {
        backToLogin.addEventListener('click', function(e) {
            e.preventDefault();
            showPage('login');
        });
    }
}

/**
 * ログインフォームの設定
 */
function setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    if (!loginForm || !emailInput || !passwordInput) {
        console.error('ログインフォームの要素が見つかりません');
        return;
    }
    
    // フォーム送信イベント
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        await handleLogin();
    });
    
    // Enterキーでログイン
    [emailInput, passwordInput].forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLogin();
            }
        });
    });
}

/**
 * 新規登録フォームの設定
 */
function setupRegisterForm() {
    const registerForm = document.getElementById('registerForm');
    
    if (!registerForm) {
        console.error('新規登録フォームが見つかりません');
        return;
    }
    
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        await handleRegister();
    });
}

/**
 * ログイン処理
 */
async function handleLogin() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitButton = document.querySelector('#loginForm button[type="submit"]');
    const errorDiv = document.getElementById('error-message');
    
    // エラーメッセージをクリア
    if (errorDiv) {
        errorDiv.textContent = '';
        errorDiv.classList.add('hidden');
    }
    
    // 入力値の取得
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    // バリデーション
    if (!email) {
        showError('メールアドレスを入力してください');
        emailInput.focus();
        return;
    }
    
    if (!password) {
        showError('パスワードを入力してください');
        passwordInput.focus();
        return;
    }
    
    // ボタンを無効化（ローディングUI削除、テキスト変更のみ）
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'ログイン中...';
    
    try {
        console.log('ログイン試行:', email);
        
        // Firebase認証
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        console.log('Firebase認証成功:', userCredential.user.email);
        
        // ロールベースのリダイレクト
        await redirectBasedOnRole(userCredential.user);
        
    } catch (error) {
        console.error('ログインエラー:', error);
        
        // エラーメッセージの表示
        let errorMessage = 'ログインに失敗しました';
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'このメールアドレスは登録されていません';
                break;
            case 'auth/wrong-password':
                errorMessage = 'パスワードが正しくありません';
                break;
            case 'auth/invalid-email':
                errorMessage = 'メールアドレスの形式が正しくありません';
                break;
            case 'auth/user-disabled':
                errorMessage = 'このアカウントは無効化されています';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'ログイン試行回数が上限に達しました。しばらく待ってから再試行してください';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'ネットワークエラーです。接続を確認してください';
                break;
            default:
                errorMessage = `ログインエラー: ${error.message}`;
        }
        
        showError(errorMessage);
        
    } finally {
        // ボタンを元に戻す
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
}

/**
 * 新規登録処理
 */
async function handleRegister() {
    const fullnameInput = document.getElementById('reg-fullname');
    const emailInput = document.getElementById('reg-email');
    const passwordInput = document.getElementById('reg-password');
    const roleInput = document.getElementById('reg-role');
    const submitButton = document.querySelector('#registerForm button[type="submit"]');
    const messageDiv = document.getElementById('register-message');
    
    // メッセージをクリア
    if (messageDiv) {
        messageDiv.textContent = '';
        messageDiv.className = 'message';
    }
    
    // 入力値の取得
    const fullname = fullnameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const role = roleInput.value;
    
    // バリデーション
    if (!fullname) {
        showRegisterError('氏名を入力してください');
        fullnameInput.focus();
        return;
    }
    
    if (!email) {
        showRegisterError('メールアドレスを入力してください');
        emailInput.focus();
        return;
    }
    
    if (!password) {
        showRegisterError('パスワードを入力してください');
        passwordInput.focus();
        return;
    }
    
    if (password.length < 6) {
        showRegisterError('パスワードは6文字以上で入力してください');
        passwordInput.focus();
        return;
    }
    
    // ボタンを無効化
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = '登録中...';
    
    try {
        console.log('新規登録試行:', email);
        
        // Firebase認証でユーザー作成
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // プロフィール更新
        await user.updateProfile({
            displayName: fullname
        });
        
        // Firestoreにユーザー情報を保存
        await window.db.collection('users').doc(user.uid).set({
            email: email,
            displayName: fullname,
            role: role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            siteHistory: []
        });
        
        console.log('新規登録成功:', user.email);
        showRegisterMessage('登録が完了しました。ログインページに移動します...', 'success');
        
        // 2秒後にログインページに移動
        setTimeout(() => {
            showPage('login');
            // フォームをリセット
            document.getElementById('registerForm').reset();
        }, 2000);
        
    } catch (error) {
        console.error('新規登録エラー:', error);
        
        let errorMessage = '登録に失敗しました';
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'このメールアドレスは既に使用されています';
                break;
            case 'auth/invalid-email':
                errorMessage = 'メールアドレスの形式が正しくありません';
                break;
            case 'auth/weak-password':
                errorMessage = 'パスワードが弱すぎます';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'ネットワークエラーです。接続を確認してください';
                break;
            default:
                errorMessage = `登録エラー: ${error.message}`;
        }
        
        showRegisterError(errorMessage);
        
    } finally {
        // ボタンを元に戻す
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
}

/**
 * ユーザーの役割に基づいてリダイレクト
 */
async function redirectBasedOnRole(user) {
    try {
        console.log('ユーザー役割確認中:', user.uid);
        
        // Firestoreからユーザー情報を取得
        const userDoc = await window.db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            console.error('ユーザーデータが見つかりません:', user.uid);
            showError('ユーザーデータが見つかりません。管理者に連絡してください。');
            await firebase.auth().signOut();
            return;
        }
        
        const userData = userDoc.data();
        console.log('ユーザーデータ:', userData);
        
        // 役割に基づいてリダイレクト
        if (userData.role === 'admin') {
            console.log('管理者としてリダイレクト');
            window.location.href = 'admin.html';
        } else if (userData.role === 'employee') {
            console.log('従業員としてリダイレクト');
            window.location.href = 'employee.html';
        } else {
            console.error('不明な役割:', userData.role);
            showError('ユーザーの役割が設定されていません。管理者に連絡してください。');
            await firebase.auth().signOut();
        }
        
    } catch (error) {
        console.error('役割確認エラー:', error);
        showError('ユーザー情報の確認に失敗しました');
        await firebase.auth().signOut();
    }
}

/**
 * ログインエラーメッセージの表示
 */
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    } else {
        // フォールバック：アラートで表示
        alert(message);
    }
}

/**
 * 新規登録メッセージの表示
 */
function showRegisterMessage(message, type = 'error') {
    const messageDiv = document.getElementById('register-message');
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.className = type === 'success' ? 'success-text' : 'error-text';
    }
}

/**
 * 新規登録エラーメッセージの表示
 */
function showRegisterError(message) {
    showRegisterMessage(message, 'error');
}
