/**
 * 勤怠管理システム - ログイン・ユーザー登録機能 (完全修正版)
 */

// ログインフォームの初期化
function initLoginForm() {
    console.log('ログインフォーム初期化 (完全修正版)');
    
    // 初期ユーザーの確認
    setupInitialUsers();
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            
            // 直接ローカルストレージからユーザー検索
            let users = [];
            try {
                const data = localStorage.getItem('users');
                if (data) {
                    users = JSON.parse(data);
                }
            } catch (e) {
                console.error('ユーザーデータエラー:', e);
            }
            
            // ユーザー認証
            const user = users.find(u => u.username === username && u.password === password);
            if (user) {
                // ログイン成功
                localStorage.setItem('currentUser', JSON.stringify(user));
                
                if (user.role === 'admin') {
                    document.getElementById('login-page').classList.add('hidden');
                    document.getElementById('admin-page').classList.remove('hidden');
                    
                    setTimeout(function() {
                        if (typeof initAdminPage === 'function') {
                            initAdminPage();
                        }
                    }, 200);
                } else {
                    document.getElementById('login-page').classList.add('hidden');
                    document.getElementById('employee-page').classList.remove('hidden');
                    
                    setTimeout(function() {
                        if (typeof initEmployeePage === 'function') {
                            initEmployeePage();
                        }
                    }, 200);
                }
            } else {
                // ログイン失敗
                const errorMsg = document.getElementById('error-message');
                if (errorMsg) {
                    errorMsg.textContent = 'ユーザーIDまたはパスワードが正しくありません';
                }
            }
        });
    }
    
    // 新規登録リンク
    const registerBtn = document.getElementById('go-to-register');
    if (registerBtn) {
        registerBtn.addEventListener('click', function() {
            document.getElementById('login-page').classList.add('hidden');
            document.getElementById('register-page').classList.remove('hidden');
        });
    }
    
    // 登録フォーム初期化
    initSimpleRegisterForm();
}

// 非常にシンプルな登録フォーム初期化 (完全修正版)
function initSimpleRegisterForm() {
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('フォーム送信イベント発生');
            
            // メッセージ要素を取得
            const msgEl = document.getElementById('register-message');
            
            // ユーザー入力を取得
            const username = document.getElementById('reg-username').value.trim();
            const password = document.getElementById('reg-password').value.trim();
            const fullName = document.getElementById('reg-fullname').value.trim();
            const role = document.getElementById('reg-role').value;
            
            console.log('入力値:', {username, fullName, role});
            
            // 入力チェック
            if (!username || !password || !fullName) {
                if (msgEl) {
                    msgEl.textContent = '全ての項目を入力してください';
                    // クラスをそのままにして赤いメッセージ表示
                }
                console.log('入力チェックエラー: 未入力項目あり');
                return;
            }
            
            // ユーザーデータ取得
            let users = [];
            try {
                const data = localStorage.getItem('users');
                if (data) {
                    users = JSON.parse(data);
                    console.log('既存ユーザー数:', users.length);
                } else {
                    console.log('ユーザーデータがありません');
                }
            } catch (e) {
                console.error('ユーザーデータ読み取りエラー:', e);
            }
            
            // 重複チェック - findを使用して詳細な確認
            const existingUser = users.find(u => u.username === username);
            
            if (existingUser) {
                // 重複の場合
                console.log('重複ユーザーが見つかりました:', existingUser);
                if (msgEl) {
                    msgEl.className = 'error-text'; 
                    msgEl.textContent = 'このユーザーIDは既に使用されています';
                    // クラスをそのままにして赤いメッセージ表示
                }
                return; // 処理を終了
            }
            
            // ここから新規ユーザー登録処理 (重複がない場合のみ実行)
            try {
                // 新しいIDを生成
                let newId = 1;
                if (users.length > 0) {
                    // 数値に変換して最大値を取得
                    const ids = users.map(u => {
                        const id = Number(u.id);
                        return isNaN(id) ? 0 : id;
                    });
                    newId = Math.max(...ids) + 1;
                }
                
                // 新規ユーザーオブジェクトを作成
                const newUser = {
                    id: newId,
                    username: username,
                    password: password,
                    fullName: fullName,
                    role: role || 'employee'
                };
                
                // ユーザーリストに追加
                users.push(newUser);
                
                // ローカルストレージに保存
                localStorage.setItem('users', JSON.stringify(users));
                
                console.log('新規ユーザーを登録しました:', newUser);
                
                // 成功メッセージを表示 - ここが重要
                if (msgEl) {
                    // 既存のクラスを削除して直接スタイルを設定
                    msgEl.className = 'success-text';
                    msgEl.textContent = '登録が完了しました！ログイン画面に戻ります...';
                    msgEl.style.color = '#4CAF50'; // 緑色を直接指定
                    
                    // 3秒後にログイン画面へ
                    setTimeout(() => {
                        document.getElementById('register-page').classList.add('hidden');
                        document.getElementById('login-page').classList.remove('hidden');
                        registerForm.reset();
                        msgEl.textContent = '';
                        msgEl.style.color = '';
                        msgEl.className = 'error-text'; // クラスを元に戻す
                    }, 3000);
                }
            } catch (error) {
                // エラー処理
                console.error('ユーザー登録エラー:', error);
                if (msgEl) {
                    msgEl.textContent = '登録処理中にエラーが発生しました';
                    // エラーメッセージは既存のクラスのまま
                }
            }
        });
    }
    
    // 戻るボタン
    const backBtn = document.getElementById('back-to-login');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            document.getElementById('register-page').classList.add('hidden');
            document.getElementById('login-page').classList.remove('hidden');
            
            // フォームとメッセージをリセット
            const registerForm = document.getElementById('registerForm');
            if (registerForm) registerForm.reset();
            
            const msgEl = document.getElementById('register-message');
            if (msgEl) {
                msgEl.textContent = '';
                msgEl.className = 'error-text'; // クラスを元に戻す
                msgEl.style.color = ''; // スタイルをリセット
            }
        });
    }
}

// 初期ユーザーを確実に設定
function setupInitialUsers() {
    try {
        const data = localStorage.getItem('users');
        if (!data) {
            const initialUsers = [
                {
                    id: 1,
                    username: 'admin',
                    password: 'admin',
                    fullName: '管理者',
                    role: 'admin'
                },
                {
                    id: 2,
                    username: 'employee',
                    password: 'employee',
                    fullName: '山田太郎',
                    role: 'employee'
                }
            ];
            localStorage.setItem('users', JSON.stringify(initialUsers));
            console.log('初期ユーザーを作成しました');
        }
    } catch (e) {
        console.error('初期ユーザー設定エラー:', e);
    }
}

// DOMが読み込まれた時にログインフォームを初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM読み込み完了');
    
    // 画面初期表示
    document.querySelectorAll('#login-page, #employee-page, #admin-page, #register-page')
        .forEach(el => el.classList.add('hidden'));
        
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    if (!currentUser) {
        document.getElementById('login-page').classList.remove('hidden');
        initLoginForm();
    } else {
        if (currentUser.role === 'admin') {
            document.getElementById('admin-page').classList.remove('hidden');
            setTimeout(() => {
                if (typeof initAdminPage === 'function') initAdminPage();
            }, 200);
        } else {
            document.getElementById('employee-page').classList.remove('hidden');
            setTimeout(() => {
                if (typeof initEmployeePage === 'function') initEmployeePage();
            }, 200);
        }
    }
});
