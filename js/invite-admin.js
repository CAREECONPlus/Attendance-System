/**
 * 管理者向け招待リンク生成・管理機能
 */


/**
 * 招待リンク生成機能の初期化
 */
function initInviteAdmin() {
    console.log('initInviteAdmin: 招待機能を初期化中...');
    
    // 招待リンク生成ボタン
    const generateBtn = document.getElementById('generate-invite-btn');
    console.log('generate-invite-btn要素:', generateBtn);
    if (generateBtn) {
        generateBtn.addEventListener('click', generateInviteLink);
        console.log('招待リンク生成ボタンにイベントリスナーを追加しました');
        console.log('ボタンのdisplay:', window.getComputedStyle(generateBtn).display);
        console.log('ボタンのvisibility:', window.getComputedStyle(generateBtn).visibility);
        console.log('ボタンの親要素:', generateBtn.parentElement);
        console.log('親要素のdisplay:', window.getComputedStyle(generateBtn.parentElement).display);
    } else {
        console.warn('generate-invite-btn要素が見つかりません');
    }
    
    // 招待リンクコピーボタン
    const copyBtn = document.getElementById('copy-invite-link');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyInviteLink);
    }
    
    // 招待履歴更新ボタン
    const refreshBtn = document.getElementById('refresh-invite-history');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadInviteHistory);
    }
    
}

/**
 * ランダムな招待トークンを生成
 */
function generateRandomToken() {
    // 32文字のランダムトークンを生成（英数字混合）
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

/**
 * 招待リンクを生成
 */
async function generateInviteLink() {
    
    const generateBtn = document.getElementById('generate-invite-btn');
    const originalText = generateBtn.textContent;
    
    try {
        // ローディング状態
        generateBtn.disabled = true;
        generateBtn.textContent = '生成中...';
        
        // 現在のユーザーとテナント情報を取得
        console.log('generateInviteLink: ユーザー情報取得中...');
        const currentUser = window.currentUser || window.getCurrentUser();
        console.log('currentUser:', currentUser);
        
        let currentTenantId;
        if (currentUser && currentUser.tenantId) {
            currentTenantId = currentUser.tenantId;
        } else if (typeof getCurrentTenantId === 'function') {
            currentTenantId = getCurrentTenantId();
        } else if (window.getCurrentTenantId) {
            currentTenantId = window.getCurrentTenantId();
        }
        
        console.log('currentTenantId:', currentTenantId);
        
        if (!currentTenantId) {
            throw new Error('テナント情報が取得できません');
        }
        
        // テナント情報を取得して会社名を取得
        const tenantDoc = await firebase.firestore()
            .collection('tenants')
            .doc(currentTenantId)
            .get();
        
        if (!tenantDoc.exists) {
            throw new Error('テナント情報が見つかりません');
        }
        
        const tenantData = tenantDoc.data();
        const companyName = tenantData.companyName || tenantData.name || '会社名';
        
        // 招待トークンを生成
        const inviteToken = generateRandomToken();
        
        // 有効期限を7日後に設定
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        // 招待コードデータを作成
        const inviteData = {
            code: inviteToken,
            tenantId: currentTenantId,
            companyName: companyName,
            createdBy: currentUser.uid,
            createdByEmail: currentUser.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
            maxUses: 100,
            used: 0,
            active: true,
            lastUsedAt: null
        };
        
        // Firestoreに保存
        const inviteRef = await firebase.firestore()
            .collection('invite_codes')
            .add(inviteData);
        
        
        // 招待リンクを生成
        const baseUrl = window.location.origin + window.location.pathname;
        const inviteLink = `${baseUrl}?invite=${inviteToken}`;
        
        // 招待リンクを表示
        const generatedSection = document.getElementById('generated-invite-section');
        const inviteLinkInput = document.getElementById('generated-invite-link');
        
        if (inviteLinkInput) {
            inviteLinkInput.value = inviteLink;
        }
        
        if (generatedSection) {
            generatedSection.classList.remove('hidden');
        }
        
        // 招待履歴を更新
        await loadInviteHistory();
        
        
        // 成功メッセージ
        if (typeof showSuccess === 'function') {
            showSuccess('招待リンクを生成しました！');
        }
        
    } catch (error) {
        
        let message = '招待リンクの生成に失敗しました';
        if (error.message) {
            message += ': ' + error.message;
        }
        
        if (typeof showError === 'function') {
            showError(message);
        } else {
            alert(message);
        }
        
    } finally {
        // ローディング解除
        generateBtn.disabled = false;
        generateBtn.textContent = originalText;
    }
}

/**
 * 招待リンクをクリップボードにコピー
 */
async function copyInviteLink() {
    const inviteLinkInput = document.getElementById('generated-invite-link');
    if (!inviteLinkInput || !inviteLinkInput.value) {
        alert('コピーする招待リンクがありません');
        return;
    }
    
    try {
        // モダンブラウザの場合
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(inviteLinkInput.value);
        } else {
            // フォールバック
            inviteLinkInput.select();
            inviteLinkInput.setSelectionRange(0, 99999);
            document.execCommand('copy');
        }
        
        // コピー完了のフィードバック
        const copyBtn = document.getElementById('copy-invite-link');
        const originalText = copyBtn.textContent;
        
        copyBtn.textContent = '✅ コピー完了';
        copyBtn.classList.add('btn-success');
        
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.classList.remove('btn-success');
        }, 2000);
        
        
        if (typeof showSuccess === 'function') {
            showSuccess('招待リンクをクリップボードにコピーしました！');
        }
        
    } catch (error) {
        
        // フォールバック: テキストを選択状態にする
        inviteLinkInput.select();
        inviteLinkInput.setSelectionRange(0, 99999);
        
        alert('招待リンクを選択しました。Ctrl+C（Mac: Cmd+C）でコピーしてください。');
    }
}

/**
 * 招待履歴を読み込み
 */
async function loadInviteHistory() {
    
    const historyContainer = document.getElementById('invite-history-data');
    if (!historyContainer) {
        return;
    }
    
    try {
        // ローディング表示
        historyContainer.innerHTML = '<tr><td colspan="5" style="text-align: center;">🔄 読み込み中...</td></tr>';
        
        // 現在のユーザーとテナント情報を取得
        console.log('loadInviteHistory: ユーザー情報取得中...');
        const currentUser = window.currentUser || window.getCurrentUser();
        console.log('currentUser:', currentUser);
        
        let currentTenantId;
        if (currentUser && currentUser.tenantId) {
            currentTenantId = currentUser.tenantId;
        } else if (typeof getCurrentTenantId === 'function') {
            currentTenantId = getCurrentTenantId();
        } else if (window.getCurrentTenantId) {
            currentTenantId = window.getCurrentTenantId();
        }
        
        console.log('currentTenantId:', currentTenantId);
        
        if (!currentTenantId) {
            throw new Error('テナント情報が取得できません');
        }
        
        // テナントの招待コードを取得（作成日時の降順）
        const inviteQuery = firebase.firestore()
            .collection('invite_codes')
            .where('tenantId', '==', currentTenantId)
            .orderBy('createdAt', 'desc')
            .limit(50);
        
        const inviteSnapshot = await inviteQuery.get();
        
        if (inviteSnapshot.empty) {
            historyContainer.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #6c757d;">招待リンクがまだ生成されていません</td></tr>';
            return;
        }
        
        // 招待履歴を表示
        const historyRows = [];
        
        inviteSnapshot.forEach(doc => {
            const data = doc.data();
            const createdAt = data.createdAt ? data.createdAt.toDate() : new Date();
            const expiresAt = data.expiresAt ? data.expiresAt.toDate() : null;
            const now = new Date();
            
            // 状態を判定
            let status = '有効';
            let statusClass = 'invite-status-active';
            
            if (!data.active) {
                status = '無効';
                statusClass = 'invite-status-disabled';
            } else if (expiresAt && expiresAt < now) {
                status = '期限切れ';
                statusClass = 'invite-status-expired';
            }
            
            const row = `
                <tr>
                    <td>${formatDateTime(createdAt)}</td>
                    <td>${expiresAt ? formatDate(expiresAt) : '無期限'}</td>
                    <td>${data.used || 0} / ${data.maxUses || '制限なし'}</td>
                    <td><span class="${statusClass}">${status}</span></td>
                    <td>
                        <button class="btn btn-small btn-secondary" onclick="toggleInviteStatus('${doc.id}', ${data.active})">
                            ${data.active ? '無効化' : '有効化'}
                        </button>
                    </td>
                </tr>
            `;
            historyRows.push(row);
        });
        
        historyContainer.innerHTML = historyRows.join('');
        
        
    } catch (error) {
        historyContainer.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #dc3545;">❌ 読み込みに失敗しました</td></tr>';
    }
}

/**
 * 招待コードの有効/無効を切り替え
 */
async function toggleInviteStatus(inviteId, currentStatus) {
    try {
        const newStatus = !currentStatus;
        
        await firebase.firestore()
            .collection('invite_codes')
            .doc(inviteId)
            .update({
                active: newStatus,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        
        // 履歴を再読み込み
        await loadInviteHistory();
        
        const statusText = newStatus ? '有効化' : '無効化';
        if (typeof showSuccess === 'function') {
            showSuccess(`招待リンクを${statusText}しました`);
        }
        
    } catch (error) {
        
        if (typeof showError === 'function') {
            showError('状態の更新に失敗しました');
        } else {
            alert('状態の更新に失敗しました');
        }
    }
}

/**
 * 日時フォーマット関数
 */
function formatDateTime(date) {
    if (!date) return '';
    return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDate(date) {
    if (!date) return '';
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// グローバル関数として公開
window.initInviteAdmin = initInviteAdmin;
window.generateInviteLink = generateInviteLink;
window.copyInviteLink = copyInviteLink;
window.loadInviteHistory = loadInviteHistory;
window.toggleInviteStatus = toggleInviteStatus;

