/**
 * 招待リンクシステム
 * 管理者が生成した招待リンクで従業員を安全に登録
 */


/**
 * URLパラメータから招待トークンを取得
 */
function getInviteTokenFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('invite');
}

/**
 * 招待トークンの検証
 */
async function validateInviteToken(inviteToken) {
    try {
        
        const inviteRef = await firebase.firestore()
            .collection('invite_codes')
            .where('code', '==', inviteToken)
            .where('active', '==', true)
            .get();
        
        if (inviteRef.empty) {
            throw new Error('無効な招待トークンです');
        }
        
        const inviteData = inviteRef.docs[0].data();
        
        // 有効期限チェック
        if (inviteData.expiresAt && inviteData.expiresAt.toDate() < new Date()) {
            throw new Error('招待トークンの有効期限が切れています');
        }
        
        // 使用回数チェック
        if (inviteData.maxUses && inviteData.used >= inviteData.maxUses) {
            throw new Error('招待トークンの使用回数上限に達しています');
        }
        
        return {
            valid: true,
            tenantId: inviteData.tenantId,
            companyName: inviteData.companyName,
            inviteId: inviteRef.docs[0].id,
            data: inviteData
        };
        
    } catch (error) {
        return {
            valid: false,
            error: error.message
        };
    }
}

/**
 * 招待トークン使用回数を増加
 */
async function incrementInviteTokenUsage(inviteId) {
    try {
        await firebase.firestore()
            .collection('invite_codes')
            .doc(inviteId)
            .update({
                used: firebase.firestore.FieldValue.increment(1),
                lastUsedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
    } catch (error) {
    }
}

/**
 * 招待コードのスタイル設定
 */
function setupInviteStyles() {
    if (document.getElementById('invite-styles')) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'invite-styles';
    styleElement.textContent = `
        .invite-info {
            background: #e8f5e8;
            border: 1px solid #4CAF50;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            text-align: center;
        }
        
        .invite-company {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        
        .invite-label {
            font-weight: 600;
            color: #2E7D32;
        }
        
        .invite-company-name {
            font-weight: 700;
            color: #1B5E20;
            background: #C8E6C9;
            padding: 4px 12px;
            border-radius: 4px;
        }
        
        .invite-error {
            background: #ffebee;
            border: 1px solid #f44336;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            text-align: center;
            color: #c62828;
        }
        
        .invite-warning {
            background: #fff3e0;
            border: 1px solid #ff9800;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            text-align: center;
            color: #ef6c00;
        }
    `;
    
    document.head.appendChild(styleElement);
}

/**
 * 招待リンクの初期化処理
 */
async function initInviteSystem() {
    
    setupInviteStyles();
    
    const inviteToken = getInviteTokenFromURL();
    
    if (inviteToken) {
        
        // 招待トークンを隠しフィールドに設定
        const inviteTokenInput = document.getElementById('inviteToken');
        if (inviteTokenInput) {
            inviteTokenInput.value = inviteToken;
        }
        
        // 招待トークンを検証
        const validation = await validateInviteToken(inviteToken);
        const inviteInfo = document.getElementById('invite-info');
        const companyNameEl = document.getElementById('invite-company-name');
        
        if (validation.valid) {
            // 有効な招待コードの場合
            if (companyNameEl) {
                companyNameEl.textContent = validation.companyName || '会社名';
                companyNameEl.className = 'invite-company-name';
            }
            
            if (inviteInfo) {
                inviteInfo.className = 'invite-info';
                inviteInfo.style.display = 'block';
            }
            
            // 登録フォームを自動表示
            showRegisterForm();
            
        } else {
            // 無効な招待リンクの場合
            if (inviteInfo) {
                inviteInfo.className = 'invite-error';
                inviteInfo.innerHTML = `
                    <div>❌ ${validation.error}</div>
                    <div style="margin-top: 10px; font-size: 14px;">
                        管理者に正しい招待リンクを確認してください
                    </div>
                `;
                inviteInfo.style.display = 'block';
            }
            
            // 登録ボタンを無効化
            const registerBtn = document.querySelector('#registerForm button[type="submit"]');
            if (registerBtn) {
                registerBtn.disabled = true;
                registerBtn.textContent = '招待トークンが無効です';
            }
        }
    } else {
        // 招待トークンなしの場合の処理
        const inviteInfo = document.getElementById('invite-info');
        if (inviteInfo) {
            inviteInfo.className = 'invite-warning';
            inviteInfo.innerHTML = `
                <div>⚠️ 招待リンクが必要です</div>
                <div style="margin-top: 10px; font-size: 14px;">
                    従業員登録には管理者からの招待リンクが必要です
                </div>
            `;
            inviteInfo.style.display = 'block';
        }
        
        // 登録ボタンを無効化
        const registerBtn = document.querySelector('#registerForm button[type="submit"]');
        if (registerBtn) {
            registerBtn.disabled = true;
            registerBtn.textContent = '招待リンクが必要です';
        }
    }
}

/**
 * 登録フォームを表示
 */
function showRegisterForm() {
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');
    const toggleText = document.getElementById('toggle-text');
    const showRegisterBtn = document.getElementById('showRegisterButton');
    const showLoginBtn = document.getElementById('showLoginButton');
    
    if (registerForm) registerForm.style.display = 'block';
    if (loginForm) loginForm.style.display = 'none';
    if (toggleText) toggleText.textContent = 'すでにアカウントをお持ちの方は';
    if (showRegisterBtn) showRegisterBtn.style.display = 'none';
    if (showLoginBtn) showLoginBtn.style.display = 'inline';
}

/**
 * 従業員登録処理（招待トークン対応版）
 */
async function registerEmployeeWithInvite(email, password, displayName, inviteToken) {
    try {
        
        // 招待トークン再検証
        const validation = await validateInviteToken(inviteToken);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        
        // Firebase認証でユーザー作成
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // プロフィール更新
        await user.updateProfile({
            displayName: displayName
        });
        
        // テナント内のユーザーコレクションに追加
        const userData = {
            email: email,
            displayName: displayName,
            role: 'employee',
            tenantId: validation.tenantId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            active: true,
            inviteToken: inviteToken
        };
        
        // テナント固有のユーザーコレクションに保存
        await firebase.firestore()
            .collection('tenants')
            .doc(validation.tenantId)
            .collection('users')
            .doc(user.uid)
            .set(userData);
        
        // グローバルユーザー情報も更新
        await firebase.firestore()
            .collection('global_users')
            .doc(email)
            .set({
                ...userData,
                uid: user.uid
            });
        
        // 招待トークン使用回数を増加
        await incrementInviteTokenUsage(validation.inviteId);
        
        
        return {
            success: true,
            user: user,
            tenantId: validation.tenantId,
            companyName: validation.companyName
        };
        
    } catch (error) {
        throw error;
    }
}

// グローバル関数として公開
window.initInviteSystem = initInviteSystem;
window.validateInviteToken = validateInviteToken;
window.registerEmployeeWithInvite = registerEmployeeWithInvite;
window.getInviteTokenFromURL = getInviteTokenFromURL;

