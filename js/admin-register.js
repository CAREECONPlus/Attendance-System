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
        // Firebase認証でユーザー作成
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        console.log('✅ Firebase認証ユーザー作成:', user.uid);
        
        // テナント作成
        console.log('🏢 テナント作成開始...');
        const tenantId = await createTenant({
            companyName: company,
            adminEmail: email,
            adminName: displayName,
            department: department,
            phone: phone
        });
        console.log('✅ テナント作成完了:', tenantId);
        
        // テナント設定を初期化
        if (window.initializeTenantSettings) {
            await window.initializeTenantSettings(tenantId, {
                name: company,
                email: email,
                phone: phone || ''
            });
            console.log('✅ テナント設定初期化完了');
        }
        
        // テナント対応のユーザーデータを作成
        const userData = {
            uid: user.uid,
            email: email,
            displayName: displayName,
            role: 'admin', // 管理者として登録
            company: company,
            department: department || '',
            phone: phone || '',
            tenantId: tenantId, // テナントID追加
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // テナント内のusersコレクションに保存
        const tenantUsersPath = `tenants/${tenantId}/users`;
        await firebase.firestore().collection(tenantUsersPath).doc(user.uid).set(userData);
        console.log('✅ テナント内管理者データ保存完了');
        
        // グローバルユーザー管理にも登録（テナント横断検索用）
        const globalUserData = {
            uid: user.uid,
            email: email,
            displayName: displayName,
            role: 'admin',
            tenantId: tenantId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await firebase.firestore().collection('global_users').doc(email).set(globalUserData);
        console.log('✅ グローバルユーザーデータ保存完了');
        
        // 従来のusersコレクションにも保存（後方互換性）
        await firebase.firestore().collection('users').doc(user.uid).set(userData);
        console.log('✅ 従来のユーザーデータ保存完了');
        
        // Firebase Authプロファイル更新
        await user.updateProfile({
            displayName: displayName
        });
        
        // 成功メッセージとテナント専用URLの生成
        const tenantUrl = generateSuccessUrl(tenantId);
        showMessage(`管理者アカウントが正常に作成されました！\n専用URL: ${tenantUrl}`, 'success');
        
        // フォームをリセット
        document.getElementById('adminRegisterForm').reset();
        
        // 3秒後にテナント専用URLにリダイレクト
        setTimeout(() => {
            window.location.href = tenantUrl;
        }, 3000);
        
        console.log('✅ 管理者登録完了:', email, 'テナント:', tenantId);
        
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