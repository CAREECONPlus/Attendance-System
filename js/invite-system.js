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
        console.log('=== 招待トークン検証開始 ===');
        console.log('Token:', inviteToken);
        
        if (!inviteToken) {
            console.log('ERROR: 招待トークンが空です');
            throw new Error('招待トークンが指定されていません');
        }
        
        console.log('Firestore接続確認:', typeof firebase?.firestore);
        if (!firebase || !firebase.firestore) {
            console.log('ERROR: Firebase未初期化');
            throw new Error('Firebase が初期化されていません');
        }
        
        console.log('invite_codes コレクションにクエリ実行中...');
        const inviteRef = await firebase.firestore()
            .collection('invite_codes')
            .where('code', '==', inviteToken)
            .where('active', '==', true)
            .get();
        
        console.log('クエリ結果:', {
            empty: inviteRef.empty,
            size: inviteRef.size,
            docs: inviteRef.docs.length
        });
        
        if (inviteRef.empty) {
            console.log('ERROR: 招待トークンが見つかりません');
            console.log('全invite_codesをデバッグ用に取得中...');
            
            // デバッグ: 全ての招待コードを確認
            const allInvites = await firebase.firestore()
                .collection('invite_codes')
                .limit(5)
                .get();
            
            console.log('既存の招待コード一覧:');
            allInvites.docs.forEach((doc, index) => {
                console.log(`${index + 1}:`, {
                    id: doc.id,
                    code: doc.data().code,
                    active: doc.data().active,
                    companyName: doc.data().companyName
                });
            });
            
            throw new Error('無効な招待トークンです');
        }
        
        const inviteData = inviteRef.docs[0].data();
        console.log('招待データ:', {
            tenantId: inviteData.tenantId,
            companyName: inviteData.companyName,
            expiresAt: inviteData.expiresAt,
            used: inviteData.used,
            maxUses: inviteData.maxUses,
            active: inviteData.active
        });
        
        // 有効期限チェック
        if (inviteData.expiresAt && inviteData.expiresAt.toDate() < new Date()) {
            console.log('ERROR: 有効期限切れ');
            throw new Error('招待トークンの有効期限が切れています');
        }
        
        // 使用回数チェック
        if (inviteData.maxUses && inviteData.used >= inviteData.maxUses) {
            console.log('ERROR: 使用回数上限');
            throw new Error('招待トークンの使用回数上限に達しています');
        }
        
        console.log('=== 招待トークン検証成功 ===');
        return {
            valid: true,
            tenantId: inviteData.tenantId,
            companyName: inviteData.companyName,
            inviteId: inviteRef.docs[0].id,
            data: inviteData
        };
        
    } catch (error) {
        console.log('=== 招待トークン検証失敗 ===');
        console.error('Error details:', error);
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
 * Firebase初期化完了を待つ
 */
function waitForFirebaseInit() {
    return new Promise((resolve) => {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
            console.log('Firebase already initialized');
            resolve();
        } else {
            console.log('Waiting for Firebase initialization...');
            const checkInterval = setInterval(() => {
                if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
                    console.log('Firebase initialization detected');
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            
            // 10秒でタイムアウト
            setTimeout(() => {
                clearInterval(checkInterval);
                console.error('Firebase initialization timeout');
                resolve();
            }, 10000);
        }
    });
}

/**
 * 招待リンクの初期化処理
 */
async function initInviteSystem() {
    
    setupInviteStyles();
    
    const inviteToken = getInviteTokenFromURL();
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const inviteInfo = document.getElementById('invite-info');
    
    if (inviteToken) {
        console.log('Invite token found:', inviteToken);
        
        // Firebase初期化完了を待つ
        await waitForFirebaseInit();
        
        // 招待トークンを検証
        const validation = await validateInviteToken(inviteToken);
        const companyNameDisplay = document.getElementById('company-name-display');
        
        if (validation.valid) {
            console.log('Valid invite token, showing registration form');
            // 有効な招待コードの場合 - 登録フォームを表示
            
            // 会社名を表示
            if (companyNameDisplay) {
                companyNameDisplay.textContent = validation.companyName || '会社名';
            }
            
            // 招待情報を表示
            if (inviteInfo) {
                inviteInfo.classList.remove('hidden');
                inviteInfo.className = 'invite-info';
            }
            
            // 登録フォームを表示、ログインフォームを隠す
            if (registerForm) {
                registerForm.classList.remove('hidden');
            }
            if (loginForm) {
                loginForm.classList.add('hidden');
            }
            
            // 招待トークンをグローバル変数として保存
            window.currentInviteToken = inviteToken;
            
        } else {
            console.log('Invalid invite token:', validation.error);
            // 無効な招待リンクの場合 - エラー表示してログインフォーム表示
            if (inviteInfo) {
                inviteInfo.classList.remove('hidden');
                inviteInfo.className = 'invite-error';
                inviteInfo.innerHTML = `
                    <div>❌ ${validation.error}</div>
                    <div style="margin-top: 10px; font-size: 14px;">
                        管理者に正しい招待リンクを確認してください
                    </div>
                `;
            }
            
            // ログインフォームを表示
            if (loginForm) {
                loginForm.classList.remove('hidden');
            }
            if (registerForm) {
                registerForm.classList.add('hidden');
            }
        }
    } else {
        console.log('No invite token, showing login form');
        // 招待トークンなしの場合 - ログインフォームのみ表示
        if (loginForm) {
            loginForm.classList.remove('hidden');
        }
        if (registerForm) {
            registerForm.classList.add('hidden');
        }
        if (inviteInfo) {
            inviteInfo.classList.add('hidden');
            inviteInfo.innerHTML = `
                <div>⚠️ 招待リンクが必要です</div>
                <div style="margin-top: 10px; font-size: 14px;">
                    従業員登録には管理者からの招待リンクが必要です
                </div>
            `;
            inviteInfo.style.display = 'block';
        }
    }
}



// グローバル関数として公開
window.initInviteSystem = initInviteSystem;
window.validateInviteToken = validateInviteToken;
window.getInviteTokenFromURL = getInviteTokenFromURL;

