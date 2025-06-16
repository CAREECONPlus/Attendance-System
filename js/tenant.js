/**
 * 勤怠管理システム - マルチテナント機能
 * テナント（会社）の選択・管理・データ分離を担当
 */

console.log('tenant.js loaded - Multi-tenant support');

// 現在のテナント情報
let currentTenant = null;

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
    
    // 既存のページを非表示
    document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));
    
    // テナント選択画面を動的に作成
    let tenantSelectionPage = document.getElementById('tenant-selection-page');
    if (!tenantSelectionPage) {
        tenantSelectionPage = createTenantSelectionPage();
        document.body.appendChild(tenantSelectionPage);
    }
    
    tenantSelectionPage.classList.remove('hidden');
    loadTenantList();
}

/**
 * テナント選択画面のHTML作成
 */
function createTenantSelectionPage() {
    const page = document.createElement('div');
    page.id = 'tenant-selection-page';
    page.className = 'page';
    page.innerHTML = `
        <div class="container tenant-selection-container">
            <div class="tenant-selection-card">
                <div class="tenant-header">
                    <h1>🏢 勤怠管理システム</h1>
                    <h2>会社を選択してください</h2>
                </div>
                
                <div class="tenant-list" id="tenant-list">
                    <div class="loading-tenants">
                        <div class="spinner"></div>
                        <p>会社リストを読み込み中...</p>
                    </div>
                </div>
                
                <div class="tenant-actions">
                    <button id="create-new-tenant" class="btn btn-primary">
                        ➕ 新しい会社を登録
                    </button>
                </div>
                
                <div class="tenant-info">
                    <h3>💡 初回利用の方へ</h3>
                    <p>
                        1. 「新しい会社を登録」をクリック<br>
                        2. 会社名を入力して専用URLを生成<br>
                        3. URLを従業員の皆さんと共有
                    </p>
                </div>
            </div>
        </div>
        
        <!-- 新規テナント作成モーダル -->
        <div id="create-tenant-modal" class="modal hidden">
            <div class="modal-content">
                <h3>🏢 新しい会社の登録</h3>
                <form id="create-tenant-form">
                    <div class="form-group">
                        <label for="company-name">会社名</label>
                        <input type="text" id="company-name" name="companyName" required maxlength="100">
                    </div>
                    
                    <div class="form-group">
                        <label for="company-id">会社ID（英数字のみ）</label>
                        <input type="text" id="company-id" name="companyId" required pattern="[a-zA-Z0-9-]+" maxlength="50">
                        <small>例: branu-corp, abc-company</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="admin-email">管理者メールアドレス</label>
                        <input type="email" id="admin-email" name="adminEmail" required>
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">作成</button>
                        <button type="button" id="cancel-create-tenant" class="btn btn-secondary">キャンセル</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // イベントリスナーを設定
    setTimeout(() => {
        setupTenantPageEvents();
    }, 100);
    
    return page;
}

/**
 * テナントページのイベント設定
 */
function setupTenantPageEvents() {
    console.log('🔘 テナントページイベント設定');
    
    // 新規テナント作成ボタン
    const createBtn = document.getElementById('create-new-tenant');
    if (createBtn) {
        createBtn.addEventListener('click', showCreateTenantModal);
    }
    
    // モーダルのキャンセルボタン
    const cancelBtn = document.getElementById('cancel-create-tenant');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', hideCreateTenantModal);
    }
    
    // テナント作成フォーム
    const createForm = document.getElementById('create-tenant-form');
    if (createForm) {
        createForm.addEventListener('submit', handleCreateTenant);
    }
    
    // 会社名の入力で会社IDを自動生成
    const companyNameInput = document.getElementById('company-name');
    const companyIdInput = document.getElementById('company-id');
    if (companyNameInput && companyIdInput) {
        companyNameInput.addEventListener('input', (e) => {
            const name = e.target.value;
            const id = name.toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, '-')
                .substring(0, 30);
            companyIdInput.value = id;
        });
    }
}

/**
 * 既存テナントリストの読み込み
 */
async function loadTenantList() {
    console.log('📋 テナントリスト読み込み開始');
    
    const tenantList = document.getElementById('tenant-list');
    if (!tenantList) return;
    
    try {
        // Firestoreからテナント一覧を取得
        const tenantsQuery = firebase.firestore()
            .collection('tenants')
            .where('isActive', '==', true)
            .orderBy('createdAt', 'desc');
        
        const snapshot = await tenantsQuery.get();
        
        if (snapshot.empty) {
            tenantList.innerHTML = `
                <div class="no-tenants">
                    <h3>🏢 登録された会社がありません</h3>
                    <p>「新しい会社を登録」ボタンから最初の会社を作成してください</p>
                </div>
            `;
            return;
        }
        
        // テナントリストを表示
        let html = '<div class="tenant-grid">';
        snapshot.forEach(doc => {
            const tenant = doc.data();
            html += `
                <div class="tenant-card" onclick="selectTenant('${doc.id}')">
                    <div class="tenant-icon">🏢</div>
                    <h3>${tenant.companyName}</h3>
                    <p>ID: ${doc.id}</p>
                    <p class="tenant-users">👥 ${tenant.userCount || 0}名</p>
                    <div class="tenant-status active">✅ 利用可能</div>
                </div>
            `;
        });
        html += '</div>';
        
        tenantList.innerHTML = html;
        console.log(`✅ ${snapshot.size}件のテナントを表示`);
        
    } catch (error) {
        console.error('❌ テナントリスト読み込みエラー:', error);
        tenantList.innerHTML = `
            <div class="error-tenants">
                <h3>⚠️ エラー</h3>
                <p>会社リストの読み込みに失敗しました</p>
                <button onclick="loadTenantList()" class="btn btn-secondary">🔄 再試行</button>
            </div>
        `;
    }
}

/**
 * テナント選択処理
 */
async function selectTenant(tenantId) {
    console.log('🏢 テナント選択:', tenantId);
    
    try {
        // テナント情報を取得
        const tenantDoc = await firebase.firestore()
            .collection('tenants')
            .doc(tenantId)
            .get();
        
        if (!tenantDoc.exists) {
            alert('選択された会社が見つかりません');
            return;
        }
        
        const tenantData = tenantDoc.data();
        
        // 現在のテナントを設定
        currentTenant = {
            id: tenantId,
            ...tenantData
        };
        
        console.log('✅ テナント設定完了:', currentTenant);
        
        // URLを更新（ページリロードなし）
        const newUrl = `${window.location.pathname}?tenant=${tenantId}`;
        window.history.pushState({}, '', newUrl);
        
        // ログイン画面に遷移
        showPage('login');
        
        // ページタイトルを更新
        document.title = `${tenantData.companyName} - 勤怠管理システム`;
        
        // 成功メッセージ
        showToast(`${tenantData.companyName} を選択しました`, 'success');
        
    } catch (error) {
        console.error('❌ テナント選択エラー:', error);
        alert('テナント選択でエラーが発生しました');
    }
}

/**
 * 新規テナント作成モーダル表示
 */
function showCreateTenantModal() {
    const modal = document.getElementById('create-tenant-modal');
    if (modal) {
        modal.classList.remove('hidden');
        
        // フォーカスを会社名に移動
        const companyNameInput = document.getElementById('company-name');
        if (companyNameInput) {
            companyNameInput.focus();
        }
    }
}

/**
 * 新規テナント作成モーダル非表示
 */
function hideCreateTenantModal() {
    const modal = document.getElementById('create-tenant-modal');
    if (modal) {
        modal.classList.add('hidden');
        
        // フォームをリセット
        const form = document.getElementById('create-tenant-form');
        if (form) {
            form.reset();
        }
    }
}

/**
 * 新規テナント作成処理
 */
async function handleCreateTenant(e) {
    e.preventDefault();
    console.log('🏢 新規テナント作成開始');
    
    const formData = new FormData(e.target);
    const companyName = formData.get('companyName').trim();
    const companyId = formData.get('companyId').trim();
    const adminEmail = formData.get('adminEmail').trim();
    
    // バリデーション
    if (!companyName || !companyId || !adminEmail) {
        alert('全ての項目を入力してください');
        return;
    }
    
    // 会社IDの形式チェック
    if (!/^[a-zA-Z0-9-]+$/.test(companyId)) {
        alert('会社IDは英数字とハイフンのみ使用できます');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    try {
        // ローディング表示
        submitBtn.disabled = true;
        submitBtn.textContent = '作成中...';
        
        // 会社IDの重複チェック
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
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            settings: {
                workStartTime: '09:00',
                workEndTime: '18:00',
                breakTime: 60, // 分
                timezone: 'Asia/Tokyo'
            }
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
        
        // モーダルを閉じる
        hideCreateTenantModal();
        
        // テナントリストを再読み込み
        await loadTenantList();
        
        // 自動的に作成したテナントを選択
        await selectTenant(companyId);
        
    } catch (error) {
        console.error('❌ テナント作成エラー:', error);
        alert('テナントの作成に失敗しました: ' + error.message);
    } finally {
        // ローディング解除
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

/**
 * テナント初期化（システム起動時）
 */
async function initializeTenant() {
    console.log('🏢 テナント初期化開始');
    
    const tenantId = getTenantFromURL();
    
    if (tenantId) {
        // URLにテナントIDがある場合
        console.log('🔍 URLテナントID検出:', tenantId);
        
        try {
            // テナント情報を取得
            const tenantDoc = await firebase.firestore()
                .collection('tenants')
                .doc(tenantId)
                .get();
            
            if (tenantDoc.exists && tenantDoc.data().isActive) {
                // 有効なテナント
                currentTenant = {
                    id: tenantId,
                    ...tenantDoc.data()
                };
                
                console.log('✅ テナント初期化完了:', currentTenant);
                
                // ページタイトルを更新
                document.title = `${currentTenant.companyName} - 勤怠管理システム`;
                
                // ログイン画面に進む
                return true;
            } else {
                // 無効なテナント
                console.warn('⚠️ 無効なテナントID:', tenantId);
                alert('指定された会社は存在しないか、無効になっています');
                
                // URLパラメータをクリア
                window.history.replaceState({}, '', window.location.pathname);
                
                // テナント選択画面を表示
                showTenantSelection();
                return false;
            }
        } catch (error) {
            console.error('❌ テナント情報取得エラー:', error);
            
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
}

/**
 * 現在のテナント情報を取得
 */
function getCurrentTenant() {
    return currentTenant;
}

/**
 * テナント固有のコレクション名を生成
 * @param {string} collection ベースコレクション名
 * @returns {string} テナント固有のコレクション名
 */
function getTenantCollection(collection) {
    if (!currentTenant) {
        console.error('❌ currentTenantが設定されていません');
        return collection;
    }
    
    return `tenants_${currentTenant.id}_${collection}`;
}

/**
 * テナント固有のFirestoreリファレンスを取得
 * @param {string} collection コレクション名
 * @returns {firebase.firestore.CollectionReference} Firestoreリファレンス
 */
function getTenantFirestore(collection) {
    const tenantCollection = getTenantCollection(collection);
    return firebase.firestore().collection(tenantCollection);
}

/**
 * トースト通知を表示
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
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

console.log('✅ tenant.js 読み込み完了');
