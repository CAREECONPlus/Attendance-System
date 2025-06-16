/**
 * 勤怠管理システム - マルチテナント機能（エラー処理強化版）
 */

console.log('tenant.js loaded - Robust Multi-tenant support');

// 現在のテナント情報
let currentTenant = null;
let tenantInitialized = false;

/**
 * URLパラメータからテナントIDを取得
 */
function getTenantFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const tenantId = urlParams.get('tenant');
    console.log('🏢 URLからテナントID取得:', tenantId);
    return tenantId;
}

/**
 * テナント選択画面を表示
 */
function showTenantSelection() {
    console.log('🏢 テナント選択画面を表示');
    
    try {
        // 既存のページを非表示
        document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));
        
        // テナント選択画面があるかチェック
        let tenantSelectionPage = document.getElementById('tenant-selection-page');
        if (tenantSelectionPage) {
            tenantSelectionPage.classList.remove('hidden');
        } else {
            console.warn('⚠️ テナント選択ページが見つかりません - 作成します');
            tenantSelectionPage = createTenantSelectionPage();
            document.body.appendChild(tenantSelectionPage);
        }
        
        // テナントリストを読み込み（エラーハンドリング付き）
        setTimeout(() => {
            loadTenantListSafely();
        }, 500);
        
    } catch (error) {
        console.error('❌ テナント選択画面表示エラー:', error);
        
        // フォールバック: ログイン画面を表示
        if (typeof showPage === 'function') {
            showPage('login');
        }
    }
}

/**
 * 安全なテナントリスト読み込み
 */
async function loadTenantListSafely() {
    console.log('📋 安全なテナントリスト読み込み開始');
    
    const tenantList = document.getElementById('tenant-list');
    if (!tenantList) {
        console.warn('⚠️ tenant-list要素が見つかりません');
        return;
    }
    
    try {
        // Firebase初期化確認
        if (typeof firebase === 'undefined' || !firebase.firestore) {
            throw new Error('Firebase未初期化');
        }
        
        // 最もシンプルなクエリ
        const tenantsRef = firebase.firestore().collection('tenants');
        const snapshot = await tenantsRef.get();
        
        console.log('✅ Firestore接続成功:', snapshot.size, '件取得');
        
        if (snapshot.empty) {
            showNoTenantsMessage();
            return;
        }
        
        // テナントリストを表示
        const tenants = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.isActive !== false) {
                tenants.push({
                    id: doc.id,
                    ...data
                });
            }
        });
        
        displayTenantList(tenants);
        
    } catch (error) {
        console.error('❌ テナントリスト読み込みエラー:', error);
        showTenantListError(error);
    }
}

/**
 * テナントがない場合の表示
 */
function showNoTenantsMessage() {
    const tenantList = document.getElementById('tenant-list');
    if (tenantList) {
        tenantList.innerHTML = `
            <div class="no-tenants">
                <h3>🏢 登録された会社がありません</h3>
                <p>「新しい会社を登録」ボタンから最初の会社を作成してください</p>
                <button onclick="showCreateTenantModal()" class="btn btn-primary" style="margin-top: 15px;">
                    ➕ 今すぐ作成
                </button>
            </div>
        `;
    }
}

/**
 * テナントリスト表示
 */
function displayTenantList(tenants) {
    const tenantList = document.getElementById('tenant-list');
    if (!tenantList) return;
    
    let html = '<div class="tenant-grid">';
    tenants.forEach(tenant => {
        html += `
            <div class="tenant-card" onclick="selectTenant('${tenant.id}')">
                <div class="tenant-icon">🏢</div>
                <h3>${escapeHtml(tenant.companyName || 'Unknown Company')}</h3>
                <p>ID: ${escapeHtml(tenant.id)}</p>
                <p class="tenant-users">👥 ${tenant.userCount || 0}名</p>
                <div class="tenant-status active">✅ 利用可能</div>
            </div>
        `;
    });
    html += '</div>';
    
    tenantList.innerHTML = html;
    console.log(`✅ ${tenants.length}件のテナントを表示`);
}

/**
 * テナントリストエラー表示
 */
function showTenantListError(error) {
    const tenantList = document.getElementById('tenant-list');
    if (!tenantList) return;
    
    let errorMessage = 'データの読み込みに失敗しました';
    let solution = '';
    
    if (error.code === 'permission-denied') {
        errorMessage = 'データベースへのアクセス権限がありません';
        solution = `
            <div style="margin: 15px 0; font-size: 12px; text-align: left;">
                <strong>解決方法:</strong><br>
                1. Firebase Console → Firestore → ルール<br>
                2. 以下をコピー&ペースト:<br>
                <code style="background: rgba(0,0,0,0.1); padding: 5px; display: block; margin: 5px 0; font-size: 11px;">
rules_version = '2';<br>
service cloud.firestore {<br>
&nbsp;&nbsp;match /databases/{database}/documents {<br>
&nbsp;&nbsp;&nbsp;&nbsp;match /{document=**} {<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;allow read, write: if request.auth != null;<br>
&nbsp;&nbsp;&nbsp;&nbsp;}<br>
&nbsp;&nbsp;}<br>
}
                </code>
                3. 「公開」をクリック
            </div>
        `;
    } else if (error.code === 'unavailable') {
        errorMessage = 'Firestoreサービスに接続できません';
        solution = '<p>インターネット接続を確認してください</p>';
    }
    
    tenantList.innerHTML = `
        <div class="error-tenants">
            <h3>⚠️ エラー</h3>
            <p>${errorMessage}</p>
            ${solution}
            <button onclick="loadTenantListSafely()" class="btn btn-secondary" style="margin-top: 15px;">
                🔄 再試行
            </button>
            <button onclick="proceedWithoutTenant()" class="btn btn-primary" style="margin-top: 15px; margin-left: 10px;">
                🚀 従来モードで続行
            </button>
        </div>
    `;
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * テナントなしで続行
 */
function proceedWithoutTenant() {
    console.log('🚀 テナントなしで従来モードで続行');
    
    // currentTenantをnullに設定
    currentTenant = null;
    
    // ログイン画面に遷移
    if (typeof showPage === 'function') {
        showPage('login');
    }
    
    // ページタイトルを更新
    document.title = '勤怠管理システム';
    
    showToast('従来モードで続行します', 'info');
}

/**
 * テナント選択画面のHTML作成（最小限）
 */
function createTenantSelectionPage() {
    const page = document.createElement('div');
    page.id = 'tenant-selection-page';
    page.className = 'page';
    page.innerHTML = `
        <div style="max-width: 800px; margin: 50px auto; padding: 20px; text-align: center;">
            <div style="background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); padding: 40px;">
                <h1 style="color: #2C5DFF; margin-bottom: 10px; font-size: 2.5rem;">🏢 勤怠管理システム</h1>
                <h2 style="color: #666; margin-bottom: 30px; font-weight: 400;">会社を選択してください</h2>
                
                <div id="tenant-list">
                    <div style="padding: 60px 20px; color: #666;">
                        <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #2C5DFF; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                        <p>会社リストを読み込み中...</p>
                    </div>
                </div>
                
                <div style="margin: 30px 0;">
                    <button id="create-new-tenant" onclick="showCreateTenantModal()" style="background: #2C5DFF; color: white; border: none; border-radius: 6px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer;">
                        ➕ 新しい会社を登録
                    </button>
                </div>
                
                <div style="background: #e3f2fd; border-radius: 8px; padding: 20px; margin-top: 30px; text-align: left;">
                    <h3 style="color: #0133D8; margin-bottom: 15px;">💡 初回利用の方へ</h3>
                    <p style="color: #666; line-height: 1.6;">
                        1. 「新しい会社を登録」をクリック<br>
                        2. 会社名を入力して専用URLを生成<br>
                        3. URLを従業員の皆さんと共有
                    </p>
                </div>
            </div>
        </div>
    `;
    
    return page;
}

/**
 * テナント選択処理（エラーハンドリング強化）
 */
async function selectTenant(tenantId) {
    console.log('🏢 テナント選択:', tenantId);
    
    try {
        // Firebase確認
        if (typeof firebase === 'undefined' || !firebase.firestore) {
            throw new Error('Firebase未初期化');
        }
        
        // テナント情報を取得
        const tenantDoc = await firebase.firestore()
            .collection('tenants')
            .doc(tenantId)
            .get();
        
        if (!tenantDoc.exists) {
            throw new Error('選択された会社が見つかりません');
        }
        
        const tenantData = tenantDoc.data();
        
        // 現在のテナントを設定
        currentTenant = {
            id: tenantId,
            ...tenantData
        };
        
        console.log('✅ テナント設定完了:', currentTenant);
        
        // URLを更新
        const newUrl = `${window.location.pathname}?tenant=${tenantId}`;
        window.history.pushState({}, '', newUrl);
        
        // ページタイトルを更新
        document.title = `${tenantData.companyName} - 勤怠管理システム`;
        
        // ログイン画面に遷移
        if (typeof showPage === 'function') {
            showPage('login');
        } else {
            // showPage関数がない場合のフォールバック
            document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));
            const loginPage = document.getElementById('login-page');
            if (loginPage) {
                loginPage.classList.remove('hidden');
            }
        }
        
        // 成功メッセージ
        showToast(`${tenantData.companyName} を選択しました`, 'success');
        
    } catch (error) {
        console.error('❌ テナント選択エラー:', error);
        alert('テナント選択でエラーが発生しました: ' + error.message);
    }
}

/**
 * 新規テナント作成モーダル表示（簡易版）
 */
function showCreateTenantModal() {
    const companyName = prompt('会社名を入力してください:');
    if (!companyName || companyName.trim() === '') {
        return;
    }
    
    const companyId = companyName.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 30);
    
    const adminEmail = prompt('管理者メールアドレスを入力してください:');
    if (!adminEmail || adminEmail.trim() === '') {
        return;
    }
    
    createTenantSimple(companyName.trim(), companyId, adminEmail.trim());
}

/**
 * 簡易テナント作成
 */
async function createTenantSimple(companyName, companyId, adminEmail) {
    console.log('🏢 簡易テナント作成:', { companyName, companyId, adminEmail });
    
    try {
        // Firebase確認
        if (typeof firebase === 'undefined' || !firebase.firestore) {
            throw new Error('Firebase未初期化');
        }
        
        // 重複チェック
        const existingTenant = await firebase.firestore()
            .collection('tenants')
            .doc(companyId)
            .get();
        
        if (existingTenant.exists) {
            alert('この会社IDは既に使用されています');
            return;
        }
        
        // テナントデータ作成
        const tenantData = {
            companyName: companyName,
            adminEmail: adminEmail,
            isActive: true,
            userCount: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Firestoreに保存
        await firebase.firestore()
            .collection('tenants')
            .doc(companyId)
            .set(tenantData);
        
        console.log('✅ テナント作成完了:', companyId);
        
        // 成功メッセージ
        const successUrl = `${window.location.origin}${window.location.pathname}?tenant=${companyId}`;
        alert(`🎉 ${companyName} の登録が完了しました！\n\n専用URL: ${successUrl}\n\nこのURLを従業員の皆さんと共有してください。`);
        
        // テナントリストを再読み込み
        await loadTenantListSafely();
        
        // 自動的に作成したテナントを選択
        await selectTenant(companyId);
        
    } catch (error) {
        console.error('❌ テナント作成エラー:', error);
        alert('テナントの作成に失敗しました: ' + error.message);
    }
}

/**
 * テナント初期化（エラーハンドリング強化）
 */
async function initializeTenant() {
    if (tenantInitialized) {
        console.log('⚠️ テナント初期化済み');
        return currentTenant !== null;
    }
    
    console.log('🏢 テナント初期化開始');
    
    try {
        const tenantId = getTenantFromURL();
        
        if (tenantId) {
            console.log('🔍 URLテナントID検出:', tenantId);
            
            // Firebase確認
            if (typeof firebase === 'undefined' || !firebase.firestore) {
                console.warn('⚠️ Firebase未初期化 - テナント選択画面を表示');
                showTenantSelection();
                return false;
            }
            
            // テナント情報を取得
            const tenantDoc = await firebase.firestore()
                .collection('tenants')
                .doc(tenantId)
                .get();
            
            if (tenantDoc.exists && tenantDoc.data().isActive !== false) {
                // 有効なテナント
                currentTenant = {
                    id: tenantId,
                    ...tenantDoc.data()
                };
                
                console.log('✅ テナント初期化完了:', currentTenant);
                
                // ページタイトルを更新
                document.title = `${currentTenant.companyName} - 勤怠管理システム`;
                
                tenantInitialized = true;
                return true;
            } else {
                // 無効なテナント
                console.warn('⚠️ 無効なテナントID:', tenantId);
                
                // URLパラメータをクリア
                window.history.replaceState({}, '', window.location.pathname);
                
                // テナント選択画面を表示
                showTenantSelection();
                return false;
            }
        } else {
            // URLにテナントIDがない場合
            console.log('🔍 テナントID未指定 - 選択画面を表示');
            showTenantSelection();
            return false;
        }
    } catch (error) {
        console.error('❌ テナント初期化エラー:', error);
        
        // エラー時はテナント選択画面を表示
        showTenantSelection();
        return false;
    }
}

/**
 * 現在のテナント情報を取得
 */
function getCurrentTenant() {
    return currentTenant;
}

/**
 * テナント固有のコレクション名を生成
 */
function getTenantCollection(collection) {
    if (!currentTenant) {
        console.warn('⚠️ currentTenantが設定されていません - 従来のコレクション名を使用');
        return collection;
    }
    
    return `tenants_${currentTenant.id}_${collection}`;
}

/**
 * テナント固有のFirestoreリファレンスを取得
 */
function getTenantFirestore(collection) {
    const tenantCollection = getTenantCollection(collection);
    return firebase.firestore().collection(tenantCollection);
}

/**
 * トースト通知を表示
 */
function showToast(message, type = 'info') {
    console.log(`📢 ${type.toUpperCase()}: ${message}`);
    
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
        color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
        border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#bee5eb'};
        border-radius: 8px;
        padding: 15px;
        max-width: 300px;
        z-index: 9999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        font-weight: 500;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, type === 'error' ? 5000 : 3000);
}

// グローバル関数のエクスポート
window.initializeTenant = initializeTenant;
window.getCurrentTenant = getCurrentTenant;
window.getTenantCollection = getTenantCollection;
window.getTenantFirestore = getTenantFirestore;
window.selectTenant = selectTenant;
window.showTenantSelection = showTenantSelection;
window.loadTenantListSafely = loadTenantListSafely;
window.showCreateTenantModal = showCreateTenantModal;
window.proceedWithoutTenant = proceedWithoutTenant;

console.log('✅ tenant.js 読み込み完了（エラー処理強化版）');
