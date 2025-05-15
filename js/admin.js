/**
 * 管理者画面の初期化処理（Firebase v8対応完全版）
 */
function initAdminPage() {
    console.log('管理者ページの初期化開始');
    
    // 権限チェック
    if (!checkAuth('admin')) return;

    // 基本的なUI初期化
    setupAdminBasics();
    
    // 残りの初期化を少し遅延させて実行
    setTimeout(function() {
        try {
            // 今日の日付をセット
            const today = new Date().toISOString().split('T')[0];
            const filterDate = getElement('filter-date');
            if (filterDate) filterDate.value = today;
            
            // 今月をセット
            const thisMonth = today.substring(0, 7);
            const filterMonth = getElement('filter-month');
            if (filterMonth) filterMonth.value = thisMonth;
            
            // データの読み込み
            loadEmployeeList();
            loadSiteList();
            loadAttendanceData();
            
            // イベントリスナーの設定
            setupAdminEvents();
            
            console.log('管理者ページの詳細初期化完了');
        } catch (error) {
            console.error('管理者ページ初期化エラー:', error);
            showError('データの読み込みに失敗しました');
        }
    }, 200);
}

/**
 * 管理者画面の基本的なUI初期化
 */
function setupAdminBasics() {
    // ユーザー名を表示
    const currentUser = getCurrentUser();
    if (currentUser) {
        const adminUserNameEl = getElement('admin-user-name');
        if (adminUserNameEl) {
            adminUserNameEl.textContent = currentUser.displayName || currentUser.email;
            console.log('管理者名を表示:', currentUser.displayName);
        }
    }
}

/**
 * 管理者画面のイベント設定（修正版）
 */
function setupAdminEvents() {
    // タブ切り替えイベント
    const tabButtons = document.querySelectorAll('.tab-btn');
    if (tabButtons && tabButtons.length > 0) {
        tabButtons.forEach(button => {
            // 既存のイベントリスナーを削除
            button.replaceWith(button.cloneNode(true));
        });
        
        // 新しいイベントリスナーを追加
        document.querySelectorAll('.tab-btn').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('タブクリック:', this.getAttribute('data-tab'));
                
                // アクティブタブの切り替え
                document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                // フィルターの表示切り替え
                const tabName = this.getAttribute('data-tab');
                toggleFilterDisplay(tabName);
                
                // データを再読み込み
                loadAttendanceData();
            });
        });
    }
    
    // フィルター変更イベント
    const filterDate = getElement('filter-date');
    if (filterDate) {
        filterDate.removeEventListener('change', loadAttendanceData);
        filterDate.addEventListener('change', loadAttendanceData);
    }
    
    const filterMonth = getElement('filter-month');
    if (filterMonth) {
        filterMonth.removeEventListener('change', loadAttendanceData);
        filterMonth.addEventListener('change', loadAttendanceData);
    }
    
    const filterEmployee = getElement('filter-employee');
    if (filterEmployee) {
        filterEmployee.removeEventListener('change', loadAttendanceData);
        filterEmployee.addEventListener('change', loadAttendanceData);
    }

    const filterSite = getElement('filter-site');
    if (filterSite) {
        filterSite.removeEventListener('change', loadAttendanceData);
        filterSite.addEventListener('change', loadAttendanceData);
    }
    
    // CSV出力
    const exportCsvBtn = getElement('export-csv');
    if (exportCsvBtn) {
        exportCsvBtn.removeEventListener('click', exportCsv);
        exportCsvBtn.addEventListener('click', exportCsv);
    }
    
    // ソートヘッダーの設定
    setupSortableHeaders();
    
    // モーダル関連
    setupModalEvents();
    
    // ログアウトボタン（修正）
    const adminLogoutBtn = getElement('admin-logout-btn');
    if (adminLogoutBtn) {
        adminLogoutBtn.removeEventListener('click', handleLogout);
        adminLogoutBtn.addEventListener('click', handleLogout);
        console.log('ログアウトボタンイベント設定完了');
    }
}

/**
 * ログアウト処理
 */
function handleLogout() {
    console.log('ログアウト処理開始');
    try {
        firebase.auth().signOut().then(() => {
            console.log('ログアウト成功');
            window.location.href = 'login.html';
        }).catch(error => {
            console.error('ログアウトエラー:', error);
            showError('ログアウトに失敗しました');
        });
    } catch (error) {
        console.error('ログアウト処理エラー:', error);
        showError('ログアウトに失敗しました');
    }
}

/**
 * フィルター表示の切り替え
 */
function toggleFilterDisplay(tabName) {
    // 全てのフィルターを非表示
    ['date-filter', 'month-filter', 'employee-filter', 'site-filter'].forEach(filterId => {
        const filterEl = document.querySelector(`.${filterId}`);
        if (filterEl) filterEl.classList.add('hidden');
    });
    
    // 選択されたタブに応じてフィルターを表示
    let targetFilter = '';
    switch(tabName) {
        case 'daily':
            targetFilter = 'date-filter';
            break;
        case 'monthly':
            targetFilter = 'month-filter';
            break;
        case 'employee':
            targetFilter = 'employee-filter';
            break;
        case 'site':
            targetFilter = 'site-filter';
            break;
    }
    
    if (targetFilter) {
        const filterEl = document.querySelector(`.${targetFilter}`);
        if (filterEl) filterEl.classList.remove('hidden');
    }
}

/**
 * 従業員リストの読み込み（Firebase v8対応版）
 */
async function loadEmployeeList() {
    try {
        const snapshot = await db.collection('users')
            .where('role', '==', 'employee')
            .orderBy('displayName')
            .get();
        
        const select = getElement('filter-employee');
        if (!select) return;
        
        // 既存のオプションをクリア（最初の「全員」オプションは残す）
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // 従業員リストを追加
        snapshot.forEach(doc => {
            const employee = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = employee.displayName || employee.email;
            select.appendChild(option);
        });
        
        console.log(`従業員リスト読み込み完了: ${snapshot.size}件`);
    } catch (error) {
        console.error('従業員リスト読み込みエラー:', error);
        showError('従業員リストの読み込みに失敗しました');
    }
}

/**
 * 現場リストの読み込み（Firebase v8対応版）
 */
async function loadSiteList() {
    try {
        const snapshot = await db.collection('attendance').get();
        const sites = new Set();
        
        // すべての勤怠記録から現場名を抽出
        snapshot.forEach(doc => {
            const record = doc.data();
            if (record.siteName) {
                sites.add(record.siteName);
            }
        });
        
        const select = getElement('filter-site');
        if (!select) return;
        
        // 既存のオプションをクリア（最初の「全ての現場」オプションは残す）
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // 現場リストを追加
        Array.from(sites).sort().forEach(site => {
            const option = document.createElement('option');
            option.value = site;
            option.textContent = site;
            select.appendChild(option);
        });
        
        console.log(`現場リスト読み込み完了: ${sites.size}件`);
    } catch (error) {
        console.error('現場リスト読み込みエラー:', error);
        showError('現場リストの読み込みに失敗しました');
    }
}

/**
 * 勤怠データの読み込み（Firebase v8対応版）
 */
async function loadAttendanceData() {
    try {
        const activeTab = document.querySelector('.tab-btn.active')?.getAttribute('data-tab');
        if (!activeTab) {
            console.log('アクティブタブが見つかりません');
            return;
        }
        
        let query = db.collection('attendance');
        
        // フィルター条件の適用
        switch(activeTab) {
            case 'daily':
                const filterDate = getElement('filter-date')?.value;
                if (filterDate) {
                    query = query.where('date', '==', filterDate);
                } else {
                    // 日付が選択されていない場合は今日を表示
                    const today = new Date().toISOString().split('T')[0];
                    query = query.where('date', '==', today);
                }
                break;
                
            case 'monthly':
                const filterMonth = getElement('filter-month')?.value;
                if (filterMonth) {
                    const startDate = `${filterMonth}-01`;
                    const endDate = `${filterMonth}-31`;
                    query = query.where('date', '>=', startDate).where('date', '<=', endDate);
                }
                break;
                
            case 'employee':
                const employeeId = getElement('filter-employee')?.value;
                if (employeeId) {
                    query = query.where('userId', '==', employeeId);
                }
                break;
                
            case 'site':
                const siteName = getElement('filter-site')?.value;
                if (siteName) {
                    query = query.where('siteName', '==', siteName);
                }
                break;
        }
        
        // 日付でソート
        query = query.orderBy('date', 'desc');
        
        const snapshot = await query.get();
        
        // データを配列に変換
        const attendanceData = [];
        snapshot.forEach(doc => {
            attendanceData.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // 休憩データも取得
        await loadBreakDataForRecords(attendanceData);
        
        // テーブルを描画
        renderAttendanceTable(attendanceData);
        
        console.log(`勤怠データ読み込み完了: ${attendanceData.length}件`);
    } catch (error) {
        console.error('勤怠データ読み込みエラー:', error);
        showError('勤怠データの読み込みに失敗しました: ' + error.message);
    }
}

/**
 * 各勤怠記録の休憩データを読み込み（Firebase v8対応版）
 */
async function loadBreakDataForRecords(attendanceData) {
    try {
        for (const record of attendanceData) {
            const breakSnapshot = await db.collection('breaks')
                .where('attendanceId', '==', record.id)
                .orderBy('startTime')
                .get();
            
            record.breakTimes = [];
            breakSnapshot.forEach(doc => {
                const breakData = doc.data();
                record.breakTimes.push({
                    id: doc.id,
                    start: breakData.startTime?.toDate()?.toISOString(),
                    end: breakData.endTime?.toDate()?.toISOString()
                });
            });
        }
    } catch (error) {
        console.error('休憩データ読み込みエラー:', error);
    }
}

/**
 * テーブルの描画処理（修正版）
 */
function renderAttendanceTable(data) {
    const tableBody = getElement('attendance-data');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5" class="no-data">データがありません</td>';
        tableBody.appendChild(row);
        return;
    }
    
    // テーブル行の生成
    data.forEach(record => {
        const row = document.createElement('tr');
        
        // 勤務時間の計算
        let workTimeHTML = '-';
        
        // clockInTimeとclockOutTimeがFirestore Timestampの場合の処理
        const clockInTime = record.clockInTime?.toDate ? record.clockInTime.toDate().toISOString() : record.clockInTime;
        const clockOutTime = record.clockOutTime?.toDate ? record.clockOutTime.toDate().toISOString() : record.clockOutTime;
        
        if (clockInTime) {
            if (clockOutTime) {
                // 休憩時間
                const breakTime = calculateTotalBreakTime(record.breakTimes || []);
                
                // 実労働時間
                const workTime = calculateWorkingTime(
                    clockInTime, 
                    clockOutTime,
                    record.breakTimes || []
                );
                
                workTimeHTML = `
                    <div class="work-times">
                        <div>
                            <span class="work-time-label">出勤:</span>
                            <span class="work-time-value">${formatTime(clockInTime)}</span>
                        </div>
                        <div>
                            <span class="work-time-label">退勤:</span>
                            <span class="work-time-value">${formatTime(clockOutTime)}</span>
                        </div>
                        <div class="break">
                            <span class="work-time-label">休憩:</span>
                            <span class="work-time-value">${breakTime.formatted}</span>
                        </div>
                        <div class="total">
                            <span class="work-time-label">実働:</span>
                            <span class="work-time-value">${workTime.formatted}</span>
                        </div>
                    </div>
                `;
            } else {
                // 出勤のみ
                workTimeHTML = `
                    <div class="work-times">
                        <div>
                            <span class="work-time-label">出勤:</span>
                            <span class="work-time-value">${formatTime(clockInTime)}</span>
                        </div>
                        <div>
                            <span class="work-time-value">勤務中</span>
                        </div>
                    </div>
                `;
            }
        }
        
        row.innerHTML = `
            <td>${record.userName || record.displayName || '不明'}</td>
            <td>${formatDate(record.date)}</td>
            <td>${record.siteName || '-'}</td>
            <td>${workTimeHTML}</td>
            <td><button class="btn btn-small edit-btn" data-id="${record.id}">編集</button></td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // 編集ボタンにイベントリスナーを追加
    const editBtns = tableBody.querySelectorAll('.edit-btn');
    editBtns.forEach(button => {
        button.addEventListener('click', function() {
            const recordId = this.getAttribute('data-id');
            if (recordId) openEditModal(recordId);
        });
    });
}

/**
 * エラーメッセージを表示
 */
function showError(message) {
    console.error(message);
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

/**
 * 成功メッセージを表示
 */
function showSuccess(message) {
    console.log(message);
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// その他のモーダル関連の関数やソート関数は既存のままで使用可能
// 必要に応じて同様にFirebase v8対応に修正

// Firebase認証状態の監視（管理者用）
firebase.auth().onAuthStateChanged(async function(user) {
    if (user) {
        // ユーザーの役割を確認
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists && userDoc.data().role === 'admin') {
                console.log('管理者ユーザー確認完了');
                // 必要に応じて追加処理
            }
        } catch (error) {
            console.error('ユーザー役割確認エラー:', error);
        }
    }
});
