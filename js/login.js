/**
 * 修正版 login.js - index.htmlリダイレクト対応
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('ログイン画面初期化開始');
    
    // Firebase認証状態の監視
    firebase.auth().onAuthStateChanged(async function(user) {
        if (user) {
            console.log('ユーザーは既にログイン済み:', user.email);
            // index.htmlにリダイレクトして、そこで役割に基づく画面表示
            window.location.href = 'index.html';
        }
    });
    
    // ログインフォームの処理
    setupLoginForm();
    // 新規登録フォームの処理（register.htmlでも使用される場合）
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
            // register.htmlにリダイレクト
            window.location.href = 'register.html';
        });
    }
    
    // ログインへ戻るリンク
    const backToLogin = document.getElementById('back-to-login');
    if (backToLogin) {
        backToLogin.addEventListener('click', function(e) {
            e.preventDefault();
            // login.htmlにリダイレクト
            window.location.href = 'login.html';
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
    
    // ボタンを無効化
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'ログイン中...';
    
    try {
        console.log('ログイン試行:', email);
        
        // Firebase認証
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        console.log('Firebase認証成功:', userCredential.user.email);
        
        // ログイン成功後はindex.htmlにリダイレクト
        // index.htmlで認証状態に基づいて適切な画面を表示
        window.location.href = 'index.html';
        
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
 * 新規登録フォームの設定（register.htmlで使用される場合）
 */
function setupRegisterForm() {
    const registerForm = document.getElementById('registerForm');
    
    if (!registerForm) {
        return; // 登録フォームがない場合はスキップ
    }
    
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        await handleRegister();
    });
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
        showRegisterMessage('登録が完了しました。メイン画面に移動します...', 'success');
        
        // 2秒後にindex.htmlに移動
        setTimeout(() => {
            window.location.href = 'index.html';
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

// エラーメッセージ関数群
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    } else {
        alert(message);
    }
}

function showRegisterMessage(message, type = 'error') {
    const messageDiv = document.getElementById('register-message');
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.className = type === 'success' ? 'success-text' : 'error-text';
    }
}

function showRegisterError(message) {
    showRegisterMessage(message, 'error');
}
