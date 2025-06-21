/**
 * 管理者登録フォーム専用JavaScript
 */

console.log('admin-register.js loaded');

// Firebase初期化待ち
let firebaseInitialized = false;

/**
 * Firebase初期化チェック
 */
function waitForFirebase() {
    return new Promise((resolve, reject) => {
        if (typeof firebase !== 'undefined' && firebase.app()) {
            firebaseInitialized = true;
            resolve();
        } else {
            const checkInterval = setInterval(() => {
                if (typeof firebase !== 'undefined' && firebase.app()) {
                    clearInterval(checkInterval);
                    firebaseInitialized = true;
                    resolve();
                }
            }, 100);
            
            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('Firebase初期化タイムアウト'));
            }, 5000);
        }
    });
}

/**
 * 管理者登録処理
 */
async function handleAdminRegister(e) {
    e.preventDefault();
    console.log('👑 管理者登録処理開始');
    
    const email = document.getElementById('adminEmail')?.value?.trim();
    const password = document.getElementById('adminPassword')?.value?.trim();
    const displayName = document.getElementById('adminDisplayName')?.value?.trim();
    const company = document.getElementById('adminCompany')?.value?.trim();
    const department = document.getElementById('adminDepartment')?.value?.trim();
    const phone = document.getElementById('adminPhone')?.value?.trim();
    
    // バリデーション
    if (!email || !password || !displayName || !company) {
        showMessage('必須項目をすべて入力してください', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('パスワードは6文字以上で入力してください', 'error');
        return;
    }
    
    // メールアドレス形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('正しいメールアドレスを入力してください', 'error');
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
        // 管理者登録依頼をadmin_requestsコレクションに保存
        console.log('📝 管理者登録依頼を送信中...');
        const requestData = {
            requesterEmail: email,
            requesterName: displayName,
            companyName: company,
            department: department || '',
            phone: phone || '',
            password: password, // 承認時にアカウント作成用
            status: 'pending',
            requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
            requestedBy: 'self-registration'
        };
        
        const requestRef = await firebase.firestore().collection('admin_requests').add(requestData);
        console.log('✅ 管理者登録依頼を送信:', requestRef.id);
        
        // 成功メッセージ表示
        showMessage('管理者登録依頼を送信しました。承認をお待ちください。\ndxconsulting.branu2@gmail.com宛に通知メールを送信します。', 'success');
        
        // フォームをリセット
        document.getElementById('adminRegisterForm').reset();
        
        console.log('✅ 管理者登録依頼送信完了:', email);
        
    } catch (error) {
        console.error('❌ 管理者登録エラー:', error);
        
        let message = '管理者登録に失敗しました';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                message = 'このメールアドレスは既に使用されています';
                break;
            case 'auth/invalid-email':
                message = '無効なメールアドレスです';
                break;
            case 'auth/weak-password':
                message = 'パスワードが弱すぎます';
                break;
            case 'auth/network-request-failed':
                message = 'ネットワークエラーが発生しました';
                break;
            default:
                message = `登録エラー: ${error.message}`;
        }
        
        showMessage(message, 'error');
        
    } finally {
        // ボタンを元に戻す
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
}

/**
 * メッセージ表示
 */
function showMessage(message, type) {
    const messageElement = document.getElementById('register-message');
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.className = `message ${type}`;
        messageElement.classList.remove('hidden');
        
        // エラーメッセージは自動で消える
        if (type === 'error') {
            setTimeout(() => {
                messageElement.classList.add('hidden');
            }, 5000);
        }
    }
}

/**
 * 初期化処理
 */
async function initAdminRegister() {
    try {
        // Firebase初期化待ち
        await waitForFirebase();
        console.log('✅ Firebase初期化完了');
        
        // フォームイベントリスナー設定
        const form = document.getElementById('adminRegisterForm');
        if (form) {
            form.addEventListener('submit', handleAdminRegister);
            console.log('✅ 管理者登録フォームイベントリスナー設定完了');
        }
        
        console.log('✅ 管理者登録ページ初期化完了');
        
    } catch (error) {
        console.error('❌ 管理者登録ページ初期化エラー:', error);
        showMessage('システムの初期化に失敗しました', 'error');
    }
}

// DOMContentLoaded後に初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM読み込み完了 - 管理者登録ページ');
    initAdminRegister();
});

// window.onloadでのバックアップ初期化
window.onload = function() {
    if (!firebaseInitialized) {
        console.warn('Firebase未初期化 - バックアップ初期化を実行');
        setTimeout(initAdminRegister, 500);
    }
};