/**
 * 勤怠管理システム - ログイン・ユーザー登録機能 (Firebase v8対応版)
 */

console.log('login.js loaded - Firebase Auth v8 version');

// ログインフォームの初期化（Firebase v8対応版）
function initLoginForm() {
    console.log('ログインフォーム初期化 - Firebase Auth v8 version');
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();
            const errorMsg = document.getElementById('error-message');
            
            // エラーメッセージをクリア
            if (errorMsg) {
                errorMsg.textContent = '';
                errorMsg.classList.add('hidden');
            }
            
            // 入力チェック
            if (!email || !password) {
                showError('メールアドレスとパスワードを入力してください');
                return;
            }
            
            try {
                // ローディング表示
                const loginBtn = loginForm.querySelector('button[type="submit"]');
                if (loginBtn) {
                    loginBtn.classList.add('loading');
                    loginBtn.disabled = true;
                }
                
                // Firebase Auth でログイン
                const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                console.log('Firebase認証成功:', user.uid);
                
                // ユーザー情報をFirestoreから取得
                const userDoc = await db.collection('users').doc(user.uid).get();
                
                if (!userDoc.exists) {
                    throw new Error('ユーザーデータが見つかりません');
                }
                
                const userData = userDoc.data();
                console.log('ユーザーデータ取得:', userData);
                
                // ページ遷移
                if (userData.role === 'admin') {
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
                
            } catch (error) {
                console.error('ログインエラー:', error);
                
                // エラーメッセージの表示
                let message = 'ログインに失敗しました';
                
                if (error.code === 'auth/user-not-found') {
                    message = 'ユーザーが見つかりません';
                } else if (error.code === 'auth/wrong-password') {
                    message = 'パスワードが正しくありません';
                } else if (error.code === 'auth/invalid-email') {
                    message = 'メールアドレスの形式が正しくありません';
                } else if (error.code === 'auth/user-disabled') {
                    message = 'このアカウントは無効化されています';
                } else if (error.code === 'auth/too-many-requests') {
                    message = 'ログイン試行回数が多すぎます。しばらく時間をおいてから再試行してください';
                }
                
                showError(message);
            } finally {
                // ローディング解除
                const loginBtn = loginForm.querySelector('button[type="submit"]');
                if (loginBtn) {
                    loginBtn.classList.remove('loading');
                    loginBtn.disabled = false;
                }
            }
        });
    }
    
    // 新規登録リンク
    const registerBtn = document.getElementById('go-to-register');
    if (registerBtn) {
        registerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showPage('register');
        });
    }
    
    // 登録フォーム初期化
    initRegisterForm();
}

// 新規登録フォーム初期化（Firebase v8対応版）
function initRegisterForm() {
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('新規登録フォーム送信イベント発生');
            
            const msgEl = document.getElementById('register-message');
            
            // 入力値を取得
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value.trim();
            const displayName = document.getElementById('reg-fullname').value.trim();
            const role = document.getElementById('reg-role').value || 'employee';
            
            console.log('入力値:', {email, displayName, role});
            
            // 入力チェック
            if (!email || !password || !displayName) {
                showRegisterError('全ての項目を入力してください');
                return;
            }
            
            // パスワードの長さチェック
            if (password.length < 6) {
                showRegisterError('パスワードは6文字以上で入力してください');
                return;
            }
            
            try {
                // ローディング表示
                const registerBtn = registerForm.querySelector('button[type="submit"]');
                if (registerBtn) {
                    registerBtn.classList.add('loading');
                    registerBtn.disabled = true;
                }
                
                // Firebase Auth でユーザー作成
                const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                console.log('Firebase認証ユーザー作成成功:', user.uid);
                
                // Firestoreにユーザー情報を保存
                const userData = {
                    email: email,
                    displayName: displayName,
                    role: role,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    siteHistory: []
                };
                
                await db.collection('users').doc(user.uid).set(userData);
                
                console.log('Firestoreにユーザーデータ保存成功');
                
                // Firebase Auth プロファイルの更新
                await user.updateProfile({
                    displayName: displayName
                });
                
                // 成功メッセージを表示
                showRegisterSuccess('登録が完了しました！ログイン画面に戻ります...');
                
                // 3秒後にログイン画面へ
                setTimeout(() => {
                    showPage('login');
                    registerForm.reset();
                    clearRegisterMessage();
                }, 3000);
                
            } catch (error) {
                console.error('ユーザー登録エラー:', error);
                
                // エラーメッセージの表示
                let message = '登録処理中にエラーが発生しました';
                
                if (error.code === 'auth/email-already-in-use') {
                    message = 'このメールアドレスは既に使用されています';
                } else if (error.code === 'auth/invalid-email') {
                    message = 'メールアドレスの形式が正しくありません';
                } else if (error.code === 'auth/weak-password') {
                    message = 'パスワードが弱すぎます（6文字以上で入力してください）';
                } else if (error.code === 'auth/operation-not-allowed') {
                    message = 'メール/パスワード認証が有効化されていません';
                }
                
                showRegisterError(message);
                
                // Firebase Authでユーザーが作成された場合は削除
                if (firebase.auth().currentUser) {
                    await firebase.auth().currentUser.delete();
                }
            } finally {
                // ローディング解除
                const registerBtn = registerForm.querySelector('button[type="submit"]');
                if (registerBtn) {
                    registerBtn.classList.remove('loading');
                    registerBtn.disabled = false;
                }
            }
        });
    }
    
    // 戻るボタン
    const backBtn = document.getElementById('back-to-login');
    if (backBtn) {
        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showPage('login');
            
            // フォームとメッセージをリセット
            const registerForm = document.getElementById('registerForm');
            if (registerForm) registerForm.reset();
            clearRegisterMessage();
        });
    }
}

// エラーメッセージ表示
function showError(message) {
    const errorMsg = document.getElementById('error-message');
    if (errorMsg) {
        errorMsg.textContent = message;
        errorMsg.classList.remove('hidden');
    }
    
    // トースト通知も表示
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// 登録エラーメッセージ表示
function showRegisterError(message) {
    const msgEl = document.getElementById('register-message');
    if (msgEl) {
        msgEl.className = 'error-text';
        msgEl.textContent = message;
        msgEl.style.color = '#ff4d4d';
    }
}

// 登録成功メッセージ表示
function showRegisterSuccess(message) {
    const msgEl = document.getElementById('register-message');
    if (msgEl) {
        msgEl.className = 'success-text';
        msgEl.textContent = message;
        msgEl.style.color = '#4CAF50';
    }
}

// 登録メッセージクリア
function clearRegisterMessage() {
    const msgEl = document.getElementById('register-message');
    if (msgEl) {
        msgEl.textContent = '';
        msgEl.className = '';
        msgEl.style.color = '';
    }
}

// ページ表示切り替え
function showPage(pageName) {
    // 全てのページを非表示
    document.querySelectorAll('#login-page, #employee-page, #admin-page, #register-page')
        .forEach(el => el.classList.add('hidden'));
    
    // 指定されたページを表示
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }
}

// Firebase Auth 状態の監視
firebase.auth().onAuthStateChanged(async function(user) {
    console.log('Auth state changed:', user ? user.uid : 'null');
    
    if (user) {
        try {
            // ユーザー情報をFirestoreから取得
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                console.log('認証済みユーザー:', userData);
                
                // currentUserをグローバルスコープに設定
                window.currentUser = {
                    uid: user.uid,
                    email: user.email,
                    displayName: userData.displayName,
                    role: userData.role
                };
                
                // ページ遷移（初回ログイン時のみ）
                const currentPage = document.querySelector('.page:not(.hidden)');
                if (!currentPage || currentPage.id === 'login-page') {
                    if (userData.role === 'admin') {
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
                console.error('ユーザーデータが見つかりません');
                firebase.auth().signOut();
            }
        } catch (error) {
            console.error('ユーザーデータ取得エラー:', error);
            firebase.auth().signOut();
        }
    } else {
        // ログアウト状態
        window.currentUser = null;
        showPage('login');
        console.log('ユーザーがログアウトしました');
    }
});

// DOMが読み込まれた時の初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM読み込み完了 - Firebase Auth v8 version');
    
    // 初期状態では全ページを非表示
    document.querySelectorAll('#login-page, #employee-page, #admin-page, #register-page')
        .forEach(el => el.classList.add('hidden'));
    
    // ログインフォームを初期化
    initLoginForm();
    
    // Firebase Auth の状態を確認してページ表示
    const user = firebase.auth().currentUser;
    if (!user) {
        showPage('login');
    }
});

// ログアウト機能（グローバル関数として提供）
window.signOut = async function() {
    try {
        await firebase.auth().signOut();
        console.log('ログアウト成功');
    } catch (error) {
        console.error('ログアウトエラー:', error);
    }
};

// 現在のユーザー取得（グローバル関数として提供）
window.getCurrentUser = function() {
    return window.currentUser;
};

// 権限チェック（グローバル関数として提供）
window.checkAuth = function(requiredRole) {
    const user = getCurrentUser();
    if (!user) {
        console.log('ユーザーが認証されていません');
        showPage('login');
        return false;
    }
    
    if (requiredRole && user.role !== requiredRole) {
        console.log(`権限不足: 要求=${requiredRole}, 実際=${user.role}`);
        showPage('login');
        return false;
    }
    
    return true;
};

// 新規登録フォームのセットアップ（register.htmlで使用）
window.setupRegisterForm = function() {
    initRegisterForm();
};
