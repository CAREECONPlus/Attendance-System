/**
 * ログイン画面処理 (Firebase v8 - ローディングUI削除版)
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
});

/**
 * ログインフォームの設定
 */
function setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('login-btn');
    
    if (!loginForm || !emailInput || !passwordInput || !loginButton) {
        console.error('ログインフォームの要素が見つかりません');
        return;
    }
    
    // フォーム送信イベント
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        await handleLogin();
    });
    
    // ログインボタンクリックイベント
    loginButton.addEventListener('click', async function(e) {
        e.preventDefault();
        await handleLogin();
    });
    
    // Enterキーでログイン
    [emailInput, passwordInput].forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
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
    const loginButton = document.getElementById('login-btn');
    
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
    const originalText = loginButton.textContent;
    loginButton.disabled = true;
    loginButton.textContent = 'ログイン中...';
    
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
            default:
                errorMessage = `ログインエラー: ${error.message}`;
        }
        
        showError(errorMessage);
        
    } finally {
        // ボタンを元に戻す
        loginButton.disabled = false;
        loginButton.textContent = originalText;
    }
}

/**
 * ユーザーの役割に基づいてリダイレクト
 */
async function redirectBasedOnRole(user) {
    try {
        console.log('ユーザー役割確認中:', user.uid);
        
        // Firestoreからユーザー情報を取得
        const userDoc = await db.collection('users').doc(user.uid).get();
        
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
 * エラーメッセージの表示
 */
function showError(message) {
    // 既存のエラーメッセージを削除
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // エラーメッセージ要素を作成
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        background-color: #fee;
        color: #c33;
        padding: 10px;
        margin: 10px 0;
        border: 1px solid #fcc;
        border-radius: 4px;
        font-size: 14px;
    `;
    
    // フォームの上に表示
    const form = document.getElementById('login-form');
    if (form) {
        form.insertBefore(errorDiv, form.firstChild);
    }
    
    // 3秒後に自動削除
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

/**
 * 成功メッセージの表示
 */
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.cssText = `
        background-color: #efe;
        color: #363;
        padding: 10px;
        margin: 10px 0;
        border: 1px solid #cfc;
        border-radius: 4px;
        font-size: 14px;
    `;
    
    const form = document.getElementById('login-form');
    if (form) {
        form.insertBefore(successDiv, form.firstChild);
    }
    
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.remove();
        }
    }, 3000);
}
