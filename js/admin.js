console.log('admin.js loaded');

/**
 * 管理者画面の初期化処理（Firebase v8対応版）
 * 全てのイベントリスナーを設定し、初期データを読み込みます
 */
async function initAdminPage() {
    console.log('管理者ページの初期化開始');
    
    // 権限チェック
    if (!checkAuth('admin')) return;

    // 基本的なUI初期化
    setupAdminBasics();
    
    // 編集機能を初期化
    initAdminEditFeatures();
    
    // 残りの初期化を少し遅延させて実行
    setTimeout(async function() {
        try {
            // 今日の日付をセット
            const today = new Date().toISOString().split('T')[0];
            const filterDate = getElement('filter-date');
            if (filterDate) filterDate.value = today;
            
            // 今月をセット
            const thisMonth = today.substring(0, 7);
            const filterMonth = getElement('filter-month');
            if (filterMonth) filterMonth.value = thisMonth;
            
            // データの読み込み（Firebase対応）
            await loadEmployeeList();
            await loadSiteList();
            await loadAttendanceData();
            
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
    console.log('管理者画面の基本UI初期化');
    
    // ユーザー名を表示
    const currentUser = getCurrentUser();
    if (currentUser) {
        const userNameEl = getElement('admin-user-name');
        if (userNameEl) {
            userNameEl.textContent = currentUser.displayName || currentUser.email;
        }
    }
    
    // ログアウトボタン
    const logoutBtn = getElement('admin-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            signOut();
        });
    }
    
    // タブ切り替えイベント
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            switchTab(tab);
        });
    });
}

/**
 * タブ切り替え関数
 */
function switchTab(tab) {
    // アクティブタブの切り替え
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`[data-tab="${tab}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // フィルター表示の切り替え
    document.querySelectorAll('.date-filter, .month-filter, .employee-filter, .site-filter').forEach(filter => {
        filter.classList.add('hidden');
    });
    
    if (tab === 'daily') {
        const dateFilter = document.querySelector('.date-filter');
        if (dateFilter) dateFilter.classList.remove('hidden');
    } else if (tab === 'monthly') {
        const monthFilter = document.querySelector('.month-filter');
        if (monthFilter) monthFilter.classList.remove('hidden');
    } else if (tab === 'employee') {
        const employeeFilter = document.querySelector('.employee-filter');
        if (employeeFilter) employeeFilter.classList.remove('hidden');
    } else if (tab === 'site') {
        const siteFilter = document.querySelector('.site-filter');
        if (siteFilter) siteFilter.classList.remove('hidden');
    }
    
    // データを再読み込み
    loadAttendanceData();
}

/**
 * 従業員リストの読み込み（Firebase v8対応版）
 */
async function loadEmployeeList() {
    try {
        const querySnapshot = await firebase.firestore().collection('users')
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
        querySnapshot.forEach(doc => {
            const employee = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = employee.displayName || employee.email;
            select.appendChild(option);
        });
        
        console.log(`従業員リスト読み込み完了: ${querySnapshot.size}件`);
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
        const querySnapshot = await firebase.firestore().collection('attendance').get();
        const sites = new Set();
        
        // すべての勤怠記録から現場名を抽出
        querySnapshot.forEach(doc => {
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
        if (!activeTab) return;
        
        let query = firebase.firestore().collection('attendance');
        let filteredData = [];
        
        // フィルター条件の適用
        if (activeTab === 'daily') {
            const filterDate = getElement('filter-date')?.value;
            if (filterDate) {
                query = query.where('date', '==', filterDate);
            }
        } else if (activeTab === 'monthly') {
            const filterMonth = getElement('filter-month')?.value;
            if (filterMonth) {
                // 月の最初と最後の日付を計算
                const startDate = `${filterMonth}-01`;
                const endDate = `${filterMonth}-31`;
                query = query.where('date', '>=', startDate).where('date', '<=', endDate);
            }
        } else if (activeTab === 'employee') {
            const employeeId = getElement('filter-employee')?.value;
            if (employeeId) {
                query = query.where('userId', '==', employeeId);
            }
        } else if (activeTab === 'site') {
            const siteName = getElement('filter-site')?.value;
            if (siteName) {
                query = query.where('siteName', '==', siteName);
            }
        }
        
        // 日付でソート
        query = query.orderBy('date', 'desc');
        
        const querySnapshot = await query.get();
        
        // データを配列に変換
        filteredData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // 休憩データも取得
        await loadBreakDataForRecords(filteredData);
        
        // テーブルを描画
        renderAttendanceTable(filteredData);
        
        console.log(`勤怠データ読み込み完了: ${filteredData.length}件`);
    } catch (error) {
        console.error('勤怠データ読み込みエラー:', error);
        showError('勤怠データの読み込みに失敗しました');
    }
}

/**
 * 各勤怠記録の休憩データを読み込み
 * @param {Array} attendanceData 勤怠データ配列
 */
async function loadBreakDataForRecords(attendanceData) {
    try {
        const promises = attendanceData.map(async (record) => {
            const breakQuery = await firebase.firestore().collection('breaks')
                .where('attendanceId', '==', record.id)
                .orderBy('startTime')
                .get();
            
            record.breakTimes = breakQuery.docs.map(doc => {
                const breakData = doc.data();
                return {
                    id: doc.id,
                    start: breakData.startTime,
                    end: breakData.endTime
                };
            });
            
            return record;
        });
        
        await Promise.all(promises);
    } catch (error) {
        console.error('休憩データ読み込みエラー:', error);
    }
}

/**
 * 勤怠テーブルのレンダリング（編集機能統合版）
 */
function renderAttendanceTable(data) {
    const tbody = getElement('attendance-data');
    if (!tbody) return;
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">データがありません</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.map(record => {
        const breakTime = calculateTotalBreakTime(record.breakTimes || []);
        const workTime = calculateWorkingTime(
            record.startTime,
            record.endTime,
            record.breakTimes || []
        );
        
        return `
            <tr>
                <td>${record.userEmail || record.userName || '-'}</td>
                <td>${formatDate(record.date)}</td>
                <td>${record.siteName || '-'}</td>
                <td>
                    <div class="work-times">
                        <div class="work-time-row">
                            <span class="work-time-label">出勤:</span>
                            <span class="work-time-value">${formatTime(record.startTime)}</span>
                        </div>
                        <div class="work-time-row">
                            <span class="work-time-label">退勤:</span>
                            <span class="work-time-value">${formatTime(record.endTime)}</span>
                        </div>
                        <div class="work-time-row break">
                            <span class="work-time-label">休憩:</span>
                            <span class="work-time-value">${breakTime.formatted || '0時間0分'}</span>
                        </div>
                        <div class="work-time-row total">
                            <span class="work-time-label">実労働:</span>
                            <span class="work-time-value">${workTime.formatted || '0時間0分'}</span>
                        </div>
                    </div>
                </td>
                <td>
                    <button onclick="showEditDialog(${JSON.stringify(record).replace(/"/g, '&quot;')})" 
                            class="btn btn-sm btn-primary edit-btn">
                        🔧 編集
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * 管理者イベントの設定
 */
function setupAdminEvents() {
    console.log('管理者イベントを設定中...');
    
    // CSV出力ボタン
    const exportBtn = getElement('export-csv');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }
    
    // フィルター変更イベント
    const filterInputs = document.querySelectorAll('#filter-date, #filter-month, #filter-employee, #filter-site');
    filterInputs.forEach(input => {
        input.addEventListener('change', loadAttendanceData);
    });
    
    console.log('管理者イベント設定完了');
}

/**
 * CSV出力関数
 */
async function exportToCSV() {
    try {
        const data = await getCurrentFilteredData();
        
        if (!data || data.length === 0) {
            showToast('出力するデータがありません', 'warning');
            return;
        }
        
        const csvContent = generateCSVContent(data);
        downloadCSV(csvContent, `attendance_${getTodayString()}.csv`);
        
        showToast('CSVファイルをダウンロードしました', 'success');
    } catch (error) {
        console.error('CSV出力エラー:', error);
        showToast('CSV出力に失敗しました', 'error');
    }
}

/**
 * 現在のフィルター設定でデータを取得
 */
async function getCurrentFilteredData() {
    const activeTab = document.querySelector('.tab-btn.active')?.getAttribute('data-tab');
    if (!activeTab) return [];
    
    let query = firebase.firestore().collection('attendance');
    
    // フィルター条件の適用
    if (activeTab === 'daily') {
        const filterDate = getElement('filter-date')?.value;
        if (filterDate) {
            query = query.where('date', '==', filterDate);
        }
    } else if (activeTab === 'monthly') {
        const filterMonth = getElement('filter-month')?.value;
        if (filterMonth) {
            const startDate = `${filterMonth}-01`;
            const endDate = `${filterMonth}-31`;
            query = query.where('date', '>=', startDate).where('date', '<=', endDate);
        }
    } else if (activeTab === 'employee') {
        const employeeId = getElement('filter-employee')?.value;
        if (employeeId) {
            query = query.where('userId', '==', employeeId);
        }
    } else if (activeTab === 'site') {
        const siteName = getElement('filter-site')?.value;
        if (siteName) {
            query = query.where('siteName', '==', siteName);
        }
    }
    
    query = query.orderBy('date', 'desc');
    const querySnapshot = await query.get();
    
    const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
    
    // 休憩データも取得
    await loadBreakDataForRecords(data);
    
    return data;
}

/**
 * CSV形式のコンテンツを生成
 */
function generateCSVContent(data) {
    const headers = ['従業員名', '日付', '現場名', '出勤時間', '退勤時間', '休憩時間', '実労働時間', 'メモ'];
    
    const rows = data.map(record => {
        const breakTime = calculateTotalBreakTime(record.breakTimes || []);
        const workTime = calculateWorkingTime(
            record.startTime,
            record.endTime,
            record.breakTimes || []
        );
        
        return [
            record.userEmail || record.userName || '',
            formatDate(record.date),
            record.siteName || '',
            formatTime(record.startTime),
            formatTime(record.endTime),
            breakTime.formatted || '0時間0分',
            workTime.formatted || '0時間0分',
            record.notes || ''
        ];
    });
    
    const csvArray = [headers, ...rows];
    return csvArray.map(row => 
        row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
}

/**
 * CSVファイルをダウンロード
 */
function downloadCSV(csvContent, filename) {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ================== 編集機能のグローバル変数 ==================
let currentEditRecord = null;
let editBreakRecords = [];
let changeHistory = [];

// ================== 編集ダイアログの表示 ==================
function showEditDialog(record) {
    console.log('📝 編集ダイアログを表示:', record);
    
    currentEditRecord = { ...record };
    editBreakRecords = [];
    
    const dialog = document.getElementById('edit-dialog');
    if (!dialog) {
        createEditDialog();
        return showEditDialog(record);
    }
    
    // フォームに現在の値を設定
    populateEditForm(record);
    
    // 休憩記録を読み込み
    loadBreakRecords(record.id);
    
    // 変更履歴を読み込み
    loadChangeHistory(record.id);
    
    dialog.style.display = 'block';
}

// ================== 編集ダイアログの作成 ==================
function createEditDialog() {
    const dialog = document.createElement('div');
    dialog.id = 'edit-dialog';
    dialog.className = 'modal';
    dialog.innerHTML = `
        <div class="modal-content" style="max-width: 800px; width: 90%;">
            <div class="modal-header">
                <h3>🔧 勤怠記録の編集</h3>
                <span class="close" onclick="closeEditDialog()">&times;</span>
            </div>
            
            <div class="modal-body">
                <!-- 基本情報タブ -->
                <div class="tab-container">
                    <div class="tab-buttons">
                        <button class="tab-btn active" onclick="showEditTab('basic')">基本情報</button>
                        <button class="tab-btn" onclick="showEditTab('breaks')">休憩時間</button>
                        <button class="tab-btn" onclick="showEditTab('history')">変更履歴</button>
                    </div>
                    
                    <!-- 基本情報タブ -->
                    <div id="basic-tab" class="tab-content active">
                        <form id="edit-attendance-form">
                            <div class="form-group">
                                <label for="edit-date">📅 日付:</label>
                                <input type="date" id="edit-date" name="date" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="edit-site-name">🏢 現場名:</label>
                                <input type="text" id="edit-site-name" name="siteName" required>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="edit-start-time">⏰ 出勤時間:</label>
                                    <input type="time" id="edit-start-time" name="startTime" required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="edit-end-time">🏁 退勤時間:</label>
                                    <input type="time" id="edit-end-time" name="endTime">
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="edit-status">📊 ステータス:</label>
                                <select id="edit-status" name="status" required>
                                    <option value="working">勤務中</option>
                                    <option value="completed">勤務完了</option>
                                    <option value="break">休憩中</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="edit-notes">📝 メモ:</label>
                                <textarea id="edit-notes" name="notes" rows="3"></textarea>
                            </div>
                            
                            <div class="form-group">
                                <label for="edit-reason">✏️ 変更理由 (必須):</label>
                                <textarea id="edit-reason" placeholder="変更の理由を記入してください..." rows="2" required></textarea>
                            </div>
                        </form>
                    </div>
                    
                    <!-- 休憩時間タブ -->
                    <div id="breaks-tab" class="tab-content">
                        <div class="breaks-header">
                            <h4>☕ 休憩時間の管理</h4>
                            <button type="button" onclick="addNewBreak()" class="btn btn-primary">
                                ➕ 休憩時間を追加
                            </button>
                        </div>
                        
                        <div id="breaks-list" class="breaks-list">
                            <!-- 休憩記録がここに表示される -->
                        </div>
                        
                        <div class="total-break-time">
                            <strong>📊 合計休憩時間: <span id="total-break-display">0時間0分</span></strong>
                        </div>
                    </div>
                    
                    <!-- 変更履歴タブ -->
                    <div id="history-tab" class="tab-content">
                        <h4>📜 変更履歴</h4>
                        <div id="change-history-list" class="history-list">
                            <!-- 変更履歴がここに表示される -->
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="modal-footer">
                <button type="button" onclick="closeEditDialog()" class="btn btn-secondary">キャンセル</button>
                <button type="button" onclick="deleteEditAttendanceRecord()" class="btn btn-danger">🗑️ 削除</button>
                <button type="button" onclick="saveAttendanceChanges()" class="btn btn-success">💾 保存</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // ダイアログ外クリックで閉じる
    dialog.addEventListener('click', function(e) {
        if (e.target === dialog) {
            closeEditDialog();
        }
    });
}

// ================== フォームに値を設定 ==================
function populateEditForm(record) {
    document.getElementById('edit-date').value = record.date || '';
    document.getElementById('edit-site-name').value = record.siteName || '';
    
    // 時間フォーマットの変換
    document.getElementById('edit-start-time').value = convertToTimeInput(record.startTime);
    document.getElementById('edit-end-time').value = convertToTimeInput(record.endTime);
    
    document.getElementById('edit-status').value = record.status || 'working';
    document.getElementById('edit-notes').value = record.notes || '';
    document.getElementById('edit-reason').value = '';
}

// ================== 時間フォーマット変換 ==================
function convertToTimeInput(timeString) {
    if (!timeString) return '';
    
    // "HH:MM:SS" または "HH:MM" を "HH:MM" に変換
    const parts = timeString.split(':');
    if (parts.length >= 2) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return '';
}

function convertFromTimeInput(timeInput) {
    if (!timeInput) return '';
    return `${timeInput}:00`;
}

// ================== 休憩記録の読み込み ==================
async function loadBreakRecords(attendanceId) {
    console.log('☕ 休憩記録を読み込み中...', attendanceId);
    
    try {
        const query = firebase.firestore()
            .collection('breaks')
            .where('attendanceId', '==', attendanceId);
        
        const snapshot = await query.get();
        
        editBreakRecords = [];
        snapshot.forEach(doc => {
            editBreakRecords.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // 開始時間でソート
        editBreakRecords.sort((a, b) => {
            const timeA = a.startTime || '';
            const timeB = b.startTime || '';
            return timeA.localeCompare(timeB);
        });
        
        displayBreakRecords();
        calculateTotalBreakTimeDisplay();
        
    } catch (error) {
        console.error('❌ 休憩記録読み込みエラー:', error);
        showErrorMessage('休憩記録の読み込みに失敗しました');
    }
}

// ================== 休憩記録の表示 ==================
function displayBreakRecords() {
    const breaksList = document.getElementById('breaks-list');
    
    if (editBreakRecords.length === 0) {
        breaksList.innerHTML = `
            <div class="no-breaks">
                <p>📋 休憩記録がありません</p>
                <p>「休憩時間を追加」ボタンで追加できます</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    editBreakRecords.forEach((breakRecord, index) => {
        if (breakRecord.isDeleted) return; // 削除予定の記録は表示しない
        
        html += `
            <div class="break-item" data-index="${index}">
                <div class="break-header">
                    <span class="break-number">休憩 ${index + 1}</span>
                    <button type="button" onclick="removeBreak(${index})" class="btn-remove">🗑️</button>
                </div>
                
                <div class="break-times">
                    <div class="time-group">
                        <label>開始時間:</label>
                        <input type="time" 
                               value="${convertToTimeInput(breakRecord.startTime)}" 
                               onchange="updateBreakTime(${index}, 'startTime', this.value)"
                               required>
                    </div>
                    
                    <div class="time-group">
                        <label>終了時間:</label>
                        <input type="time" 
                               value="${convertToTimeInput(breakRecord.endTime)}" 
                               onchange="updateBreakTime(${index}, 'endTime', this.value)">
                    </div>
                    
                    <div class="break-duration">
                        <span>⏱️ ${calculateBreakDuration(breakRecord)}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    breaksList.innerHTML = html;
}

// ================== 休憩時間の計算 ==================
function calculateBreakDuration(breakRecord) {
    if (!breakRecord.startTime || !breakRecord.endTime) {
        return '進行中';
    }
    
    const start = new Date(`2000-01-01 ${breakRecord.startTime}`);
    const end = new Date(`2000-01-01 ${breakRecord.endTime}`);
    
    if (end <= start) {
        return '無効';
    }
    
    const diffMs = end - start;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    return `${hours}時間${minutes}分`;
}

// ================== 合計休憩時間の計算 ==================
function calculateTotalBreakTimeDisplay() {
    let totalMinutes = 0;
    
    editBreakRecords.forEach(breakRecord => {
        if (breakRecord.isDeleted) return;
        
        if (breakRecord.startTime && breakRecord.endTime) {
            const start = new Date(`2000-01-01 ${breakRecord.startTime}`);
            const end = new Date(`2000-01-01 ${breakRecord.endTime}`);
            
            if (end > start) {
                const diffMs = end - start;
                totalMinutes += Math.floor(diffMs / (1000 * 60));
            }
        }
    });
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    const totalDisplay = document.getElementById('total-break-display');
    if (totalDisplay) {
        totalDisplay.textContent = `${hours}時間${minutes}分`;
    }
}

// ================== 新しい休憩記録の追加 ==================
function addNewBreak() {
    const newBreak = {
        id: `temp_${Date.now()}`, // 一時的なID
        attendanceId: currentEditRecord.id,
        userId: currentEditRecord.userId,
        startTime: '',
        endTime: '',
        date: currentEditRecord.date,
        isNew: true // 新規追加フラグ
    };
    
    editBreakRecords.push(newBreak);
    displayBreakRecords();
    calculateTotalBreakTimeDisplay();
}

// ================== 休憩記録の削除 ==================
function removeBreak(index) {
    if (confirm('この休憩記録を削除しますか？')) {
        const breakRecord = editBreakRecords[index];
        
        // 既存記録の場合は削除フラグを設定
        if (!breakRecord.isNew) {
            breakRecord.isDeleted = true;
        } else {
            // 新規追加の場合は配列から削除
            editBreakRecords.splice(index, 1);
        }
        
        displayBreakRecords();
        calculateTotalBreakTimeDisplay();
    }
}

// ================== 休憩時間の更新 ==================
function updateBreakTime(index, field, value) {
    if (editBreakRecords[index]) {
        editBreakRecords[index][field] = convertFromTimeInput(value);
        editBreakRecords[index].isModified = true;
        displayBreakRecords();
        calculateTotalBreakTimeDisplay();
    }
}

// ================== 変更履歴の読み込み ==================
async function loadChangeHistory(attendanceId) {
    console.log('📜 変更履歴を読み込み中...', attendanceId);
    
    try {
        const query = firebase.firestore()
            .collection('attendance_history')
            .where('attendanceId', '==', attendanceId);
        
        const snapshot = await query.get();
        
        changeHistory = [];
        snapshot.forEach(doc => {
            changeHistory.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // 手動でソート（タイムスタンプの降順）
        changeHistory.sort((a, b) => {
            const timeA = a.timestamp ? a.timestamp.seconds : 0;
            const timeB = b.timestamp ? b.timestamp.seconds : 0;
            return timeB - timeA;
        });
        
        displayChangeHistory();
        
    } catch (error) {
        console.error('❌ 変更履歴読み込みエラー:', error);
        displayChangeHistoryError();
    }
}

// ================== 変更履歴の表示 ==================
function displayChangeHistory() {
    const historyList = document.getElementById('change-history-list');
    
    if (changeHistory.length === 0) {
        historyList.innerHTML = `
            <div class="no-history">
                <p>📋 変更履歴がありません</p>
                <p>この記録はまだ編集されていません</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    changeHistory.forEach(history => {
        const timestamp = history.timestamp ? 
            new Date(history.timestamp.seconds * 1000).toLocaleString('ja-JP') : 
            '不明';
        
        html += `
            <div class="history-item">
                <div class="history-header">
                    <span class="history-date">📅 ${timestamp}</span>
                    <span class="history-user">👤 ${history.changedBy || '不明'}</span>
                </div>
                
                <div class="history-reason">
                    <strong>理由:</strong> ${history.reason || '記載なし'}
                </div>
                
                <div class="history-changes">
                    <strong>変更内容:</strong>
                    <div class="changes-detail">
                        ${formatChanges(history.changes)}
                    </div>
                </div>
            </div>
        `;
    });
    
    historyList.innerHTML = html;
}

// ================== 変更内容のフォーマット ==================
function formatChanges(changes) {
    if (!changes) return '変更内容が記録されていません';
    
    let html = '<ul>';
    Object.keys(changes).forEach(field => {
        const change = changes[field];
        const fieldName = getFieldDisplayName(field);
        
        html += `
            <li>
                <strong>${fieldName}:</strong> 
                "${change.before}" → "${change.after}"
            </li>
        `;
    });
    html += '</ul>';
    
    return html;
}

// ================== フィールド名の表示用変換 ==================
function getFieldDisplayName(field) {
    const fieldNames = {
        'siteName': '現場名',
        'startTime': '出勤時間',
        'endTime': '退勤時間',
        'status': 'ステータス',
        'notes': 'メモ',
        'date': '日付'
    };
    
    return fieldNames[field] || field;
}

// ================== 変更履歴表示エラー ==================
function displayChangeHistoryError() {
    const historyList = document.getElementById('change-history-list');
    historyList.innerHTML = `
        <div class="history-error">
            <h4>⚠️ 変更履歴の読み込みエラー</h4>
            <p>変更履歴の読み込みで問題が発生しました</p>
            <p>編集機能は正常に動作します</p>
        </div>
    `;
}

// ================== 勤怠記録の保存 ==================
async function saveAttendanceChanges() {
    console.log('💾 勤怠記録の変更を保存中...');
    
    const form = document.getElementById('edit-attendance-form');
    const formData = new FormData(form);
    
    const reason = document.getElementById('edit-reason').value.trim();
    if (!reason) {
        alert('変更理由を入力してください');
        return;
    }
    
    try {
        // 変更内容を検証
        const newData = {
            date: formData.get('date'),
            siteName: formData.get('siteName'),
            startTime: convertFromTimeInput(formData.get('startTime')),
            endTime: convertFromTimeInput(formData.get('endTime')),
            status: formData.get('status'),
            notes: formData.get('notes') || ''
        };
        
        // 変更箇所を特定
        const changes = detectChanges(newData);
        
        if (Object.keys(changes).length === 0 && !hasBreakChanges()) {
            alert('変更がありません');
            return;
        }
        
        // バリデーション
        if (!validateAttendanceData(newData)) {
            return;
        }
        
        // 保存実行
        await saveChangesToFirestore(newData, changes, reason);
        
        alert('✅ 変更を保存しました');
        closeEditDialog();
        
        // 管理者画面のデータを再読み込み
        await loadAttendanceData();
        
    } catch (error) {
        console.error('❌ 保存エラー:', error);
        alert('保存中にエラーが発生しました: ' + error.message);
    }
}

// ================== 変更箇所の検出 ==================
function detectChanges(newData) {
    const changes = {};
    
    Object.keys(newData).forEach(field => {
        const oldValue = currentEditRecord[field] || '';
        const newValue = newData[field] || '';
        
        if (oldValue !== newValue) {
            changes[field] = {
                before: oldValue,
                after: newValue
            };
        }
    });
    
    return changes;
}

// ================== 休憩記録の変更チェック ==================
function hasBreakChanges() {
    return editBreakRecords.some(breakRecord => 
        breakRecord.isNew || breakRecord.isDeleted || breakRecord.isModified
    );
}

// ================== データバリデーション ==================
function validateAttendanceData(data) {
    // 必須項目チェック
    if (!data.date || !data.siteName || !data.startTime) {
        alert('日付、現場名、出勤時間は必須です');
        return false;
    }
    
    // 時間の妥当性チェック
    if (data.endTime && data.startTime >= data.endTime) {
        alert('退勤時間は出勤時間より後である必要があります');
        return false;
    }
    
    // 休憩時間の妥当性チェック
    for (let breakRecord of editBreakRecords) {
        if (breakRecord.isDeleted) continue;
        
        if (breakRecord.startTime && breakRecord.endTime) {
            if (breakRecord.startTime >= breakRecord.endTime) {
                alert('休憩の終了時間は開始時間より後である必要があります');
                return false;
            }
        }
    }
    
    return true;
}

// ================== Firestoreへの保存 ==================
async function saveChangesToFirestore(newData, changes, reason) {
    const batch = firebase.firestore().batch();
    
    // 1. 勤怠記録の更新
    const attendanceRef = firebase.firestore()
        .collection('attendance')
        .doc(currentEditRecord.id);
    
    const updateData = {
        ...newData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: firebase.auth().currentUser?.email || 'unknown'
    };
    
    batch.update(attendanceRef, updateData);
    
    // 2. 変更履歴の記録
    if (Object.keys(changes).length > 0) {
        const historyRef = firebase.firestore().collection('attendance_history').doc();
        
        const historyData = {
            attendanceId: currentEditRecord.id,
            changes: changes,
            reason: reason,
            changedBy: firebase.auth().currentUser?.email || 'unknown',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            changeType: 'edit'
        };
        
        batch.set(historyRef, historyData);
    }
    
    // 3. 休憩記録の処理
    for (let breakRecord of editBreakRecords) {
        if (breakRecord.isDeleted && !breakRecord.isNew) {
            // 既存記録の削除
            const breakRef = firebase.firestore().collection('breaks').doc(breakRecord.id);
            batch.delete(breakRef);
            
        } else if (breakRecord.isNew && !breakRecord.isDeleted) {
            // 新規記録の追加
            const newBreakRef = firebase.firestore().collection('breaks').doc();
            const breakData = {
                attendanceId: currentEditRecord.id,
                userId: currentEditRecord.userId,
                startTime: breakRecord.startTime,
                endTime: breakRecord.endTime,
                date: currentEditRecord.date,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            batch.set(newBreakRef, breakData);
            
        } else if (!breakRecord.isNew && !breakRecord.isDeleted && breakRecord.isModified) {
            // 既存記録の更新
            const breakRef = firebase.firestore().collection('breaks').doc(breakRecord.id);
            const breakUpdateData = {
                startTime: breakRecord.startTime,
                endTime: breakRecord.endTime,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            batch.update(breakRef, breakUpdateData);
        }
    }
    
    // バッチ実行
    await batch.commit();
}

// ================== 勤怠記録の削除 ==================
async function deleteEditAttendanceRecord() {
    if (!currentEditRecord) return;
    
    const confirmMessage = `⚠️ 以下の勤怠記録を完全に削除しますか？\n\n` +
                          `日付: ${currentEditRecord.date}\n` +
                          `現場: ${currentEditRecord.siteName}\n` +
                          `従業員: ${currentEditRecord.userEmail}\n\n` +
                          `この操作は取り消せません。`;
    
    if (!confirm(confirmMessage)) return;
    
    const reason = prompt('削除理由を入力してください（必須）:');
    if (!reason || reason.trim() === '') {
        alert('削除理由を入力してください');
        return;
    }
    
    try {
        const batch = firebase.firestore().batch();
        
        // 1. 勤怠記録の削除
        const attendanceRef = firebase.firestore()
            .collection('attendance')
            .doc(currentEditRecord.id);
        batch.delete(attendanceRef);
        
        // 2. 関連する休憩記録の削除
        for (let breakRecord of editBreakRecords) {
            if (!breakRecord.isNew) {
                const breakRef = firebase.firestore().collection('breaks').doc(breakRecord.id);
                batch.delete(breakRef);
            }
        }
        
        // 3. 削除履歴の記録
        const historyRef = firebase.firestore().collection('attendance_history').doc();
        const historyData = {
            attendanceId: currentEditRecord.id,
            originalData: currentEditRecord,
            reason: reason.trim(),
            changedBy: firebase.auth().currentUser?.email || 'unknown',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            changeType: 'delete'
        };
        batch.set(historyRef, historyData);
        
        await batch.commit();
        
        alert('✅ 記録を削除しました');
        closeEditDialog();
        
        // 管理者画面のデータを再読み込み
        await loadAttendanceData();
        
    } catch (error) {
        console.error('❌ 削除エラー:', error);
        alert('削除中にエラーが発生しました: ' + error.message);
    }
}

// ================== 編集ダイアログのタブ切り替え ==================
function showEditTab(tabName) {
    // 全てのタブを非表示
    document.querySelectorAll('#edit-dialog .tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // 全てのタブボタンを非アクティブ
    document.querySelectorAll('#edit-dialog .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 指定されたタブを表示
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // 対応するタブボタンをアクティブ
    event.target.classList.add('active');
}

// ================== ダイアログを閉じる ==================
function closeEditDialog() {
    const dialog = document.getElementById('edit-dialog');
    if (dialog) {
        dialog.style.display = 'none';
    }
    
    // 変数をリセット
    currentEditRecord = null;
    editBreakRecords = [];
    changeHistory = [];
}

// ================== 編集機能の初期化 ==================
function initAdminEditFeatures() {
    console.log('🔧 管理者編集機能を初期化中...');
    
    // スタイルを適用
    initEditFunctionStyles();
    
    // 編集機能が利用可能であることをログ出力
    console.log('✅ 管理者編集機能が利用可能になりました');
    console.log('📋 利用可能な機能:');
    console.log('  • 勤怠記録の編集（現場名、勤務時間）');
    console.log('  • 休憩時間の追加・削除・編集');
    console.log('  • 勤怠記録の削除');
    console.log('  • 変更履歴の表示');
}

// ================== 編集機能のスタイル適用 ==================
function initEditFunctionStyles() {
    if (document.getElementById('edit-dialog-styles')) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'edit-dialog-styles';
    styleElement.innerHTML = `
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
        }
        
        .modal-content {
            background-color: #fefefe;
            margin: 2% auto;
            border: none;
            border-radius: 8px;
            width: 90%;
            max-width: 800px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid #ddd;
            background-color: #f8f9fa;
            border-radius: 8px 8px 0 0;
        }
        
        .modal-header h3 {
            margin: 0;
            color: #333;
        }
        
        .close {
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
            color: #aaa;
            transition: color 0.3s;
        }
        
        .close:hover {
            color: #000;
        }
        
        .modal-body {
            padding: 20px;
        }
        
        .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 20px;
            border-top: 1px solid #ddd;
            background-color: #f8f9fa;
            border-radius: 0 0 8px 8px;
        }
        
        .tab-container {
            margin-top: 10px;
        }
        
        .tab-buttons {
            display: flex;
            border-bottom: 2px solid #ddd;
            margin-bottom: 20px;
        }
        
        .tab-btn {
            background: none;
            border: none;
            padding: 12px 20px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            font-weight: 500;
            transition: all 0.3s;
        }
        
        .tab-btn:hover {
            background-color: #f8f9fa;
        }
        
        .tab-btn.active {
            border-bottom-color: #007bff;
            color: #007bff;
            background-color: #f8f9fa;
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        .form-row {
            display: flex;
            gap: 15px;
        }
        
        .form-row .form-group {
            flex: 1;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: #333;
        }
        
        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            transition: border-color 0.3s;
            box-sizing: border-box;
        }
        
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
        }
        
        .breaks-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .breaks-header h4 {
            margin: 0;
        }
        
        .breaks-list {
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 15px;
        }
        
        .break-item {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 10px;
        }
        
        .break-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .break-number {
            font-weight: bold;
            color: #495057;
        }
        
        .btn-remove {
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .btn-remove:hover {
            background: #c82333;
        }
        
        .break-times {
            display: flex;
            align-items: center;
            gap: 15px;
            flex-wrap: wrap;
        }
        
        .time-group {
            display: flex;
            flex-direction: column;
            min-width: 120px;
        }
        
        .time-group label {
            font-size: 12px;
            margin-bottom: 3px;
            color: #6c757d;
        }
        
        .time-group input {
            width: 100%;
            padding: 6px 8px;
            font-size: 13px;
        }
        
        .break-duration {
            margin-left: auto;
            font-weight: 500;
            color: #28a745;
        }
        
        .total-break-time {
            text-align: center;
            padding: 15px;
            background: #e9f7ef;
            border-radius: 6px;
            color: #155724;
        }
        
        .no-breaks,
        .no-history {
            text-align: center;
            padding: 40px 20px;
            color: #6c757d;
        }
        
        .history-list {
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 15px;
        }
        
        .history-item {
            background: #f8f9fa;
            border-left: 4px solid #007bff;
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 0 6px 6px 0;
        }
        
        .history-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .history-date {
            font-weight: 500;
            color: #495057;
        }
        
        .history-user {
            font-size: 14px;
            color: #6c757d;
        }
        
        .history-reason {
            margin-bottom: 10px;
            padding: 8px 12px;
            background: #fff3cd;
            border-radius: 4px;
            color: #856404;
        }
        
        .history-changes {
            color: #333;
        }
        
        .changes-detail {
            margin-top: 8px;
            padding: 10px;
            background: white;
            border-radius: 4px;
            border: 1px solid #e9ecef;
        }
        
        .changes-detail ul {
            margin: 0;
            padding-left: 20px;
        }
        
        .changes-detail li {
            margin-bottom: 5px;
        }
        
        .history-error {
            text-align: center;
            padding: 40px 20px;
            color: #dc3545;
            background: #f8d7da;
            border-radius: 6px;
        }
        
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s;
        }
        
        .btn-primary {
            background-color: #007bff;
            color: white;
        }
        
        .btn-primary:hover {
            background-color: #0056b3;
        }
        
        .btn-success {
            background-color: #28a745;
            color: white;
        }
        
        .btn-success:hover {
            background-color: #1e7e34;
        }
        
        .btn-danger {
            background-color: #dc3545;
            color: white;
        }
        
        .btn-danger:hover {
            background-color: #c82333;
        }
        
        .btn-secondary {
            background-color: #6c757d;
            color: white;
        }
        
        .btn-secondary:hover {
            background-color: #545b62;
        }
        
        .btn-sm {
            padding: 6px 12px;
            font-size: 12px;
        }
        
        .edit-btn {
            min-width: 60px;
        }
        
        @media (max-width: 768px) {
            .modal-content {
                width: 95%;
                margin: 5% auto;
            }
            
            .form-row {
                flex-direction: column;
                gap: 0;
            }
            
            .break-times {
                flex-direction: column;
                gap: 10px;
            }
            
            .time-group {
                min-width: 100%;
            }
            
            .history-header {
                flex-direction: column;
                align-items: flex-start;
            }
            
            .modal-footer {
                flex-direction: column;
                gap: 10px;
            }
            
            .modal-footer .btn {
                width: 100%;
            }
        }
    `;
    
    document.head.appendChild(styleElement);
}

// ================== ユーティリティ関数 ==================

/**
 * 要素を取得する関数
 */
function getElement(id) {
    return document.getElementById(id);
}

/**
 * 現在のユーザーを取得
 */
function getCurrentUser() {
    return firebase.auth().currentUser;
}

/**
 * 権限チェック
 */
function checkAuth(requiredRole) {
    const user = getCurrentUser();
    if (!user) {
        console.error('ユーザーが認証されていません');
        return false;
    }
    return true;
}

/**
 * 日付のフォーマット
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('ja-JP');
    } catch (error) {
        return dateString;
    }
}

/**
 * 時間のフォーマット
 */
function formatTime(timeString) {
    if (!timeString) return '-';
    return timeString;
}

/**
 * 今日の日付文字列を取得
 */
function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

/**
 * 合計休憩時間を計算
 */
function calculateTotalBreakTime(breakTimes) {
    if (!breakTimes || breakTimes.length === 0) {
        return { minutes: 0, formatted: '0時間0分' };
    }
    
    let totalMinutes = 0;
    breakTimes.forEach(breakTime => {
        if (breakTime.start && breakTime.end) {
            const start = new Date(`2000-01-01 ${breakTime.start}`);
            const end = new Date(`2000-01-01 ${breakTime.end}`);
            if (end > start) {
                totalMinutes += Math.floor((end - start) / (1000 * 60));
            }
        }
    });
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return {
        minutes: totalMinutes,
        formatted: `${hours}時間${minutes}分`
    };
}

/**
 * 実労働時間を計算
 */
function calculateWorkingTime(startTime, endTime, breakTimes) {
    if (!startTime || !endTime) {
        return { minutes: 0, formatted: '-' };
    }
    
    try {
        const start = new Date(`2000-01-01 ${startTime}`);
        const end = new Date(`2000-01-01 ${endTime}`);
        
        if (end <= start) {
            return { minutes: 0, formatted: '計算エラー' };
        }
        
        const totalMinutes = Math.floor((end - start) / (1000 * 60));
        const breakTime = calculateTotalBreakTime(breakTimes || []);
        const workingMinutes = totalMinutes - breakTime.minutes;
        
        const hours = Math.floor(workingMinutes / 60);
        const minutes = workingMinutes % 60;
        
        return {
            minutes: workingMinutes,
            formatted: `${hours}時間${minutes}分`
        };
    } catch (error) {
        return { minutes: 0, formatted: '計算エラー' };
    }
}

/**
 * エラーメッセージの表示
 */
function showError(message) {
    console.error('エラー:', message);
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
        border-radius: 8px;
        padding: 15px;
        max-width: 300px;
        z-index: 9999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 5000);
}

/**
 * 成功メッセージの表示
 */
function showSuccess(message) {
    console.log('成功:', message);
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
        border-radius: 8px;
        padding: 15px;
        max-width: 300px;
        z-index: 9999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
}

/**
 * トースト通知の表示
 */
function showToast(message, type = 'info') {
    const colors = {
        info: { bg: '#d1ecf1', color: '#0c5460', border: '#bee5eb' },
        success: { bg: '#d4edda', color: '#155724', border: '#c3e6cb' },
        warning: { bg: '#fff3cd', color: '#856404', border: '#ffeaa7' },
        error: { bg: '#f8d7da', color: '#721c24', border: '#f5c6cb' }
    };
    
    const colorSet = colors[type] || colors.info;
    
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colorSet.bg};
        color: ${colorSet.color};
        border: 1px solid ${colorSet.border};
        border-radius: 8px;
        padding: 15px;
        max-width: 300px;
        z-index: 9999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, type === 'error' ? 5000 : 3000);
}

/**
 * エラーメッセージ表示（編集機能用）
 */
function showErrorMessage(message) {
    showError(message);
}

/**
 * サインアウト処理
 */
function signOut() {
    if (confirm('ログアウトしますか？')) {
        firebase.auth().signOut()
            .then(() => {
                console.log('✅ ログアウト完了');
                showPage('login');
            })
            .catch((error) => {
                console.error('❌ ログアウトエラー:', error);
                showError('ログアウトでエラーが発生しました');
            });
    }
}

/**
 * 編集記録の処理（既存のeditRecord関数を置き換え）
 */
function editRecord(recordId) {
    console.log('編集レコードID:', recordId);
    
    // recordIdから完全なレコードデータを取得して編集ダイアログを表示
    const allRows = document.querySelectorAll('#attendance-data tr');
    for (let row of allRows) {
        const editBtn = row.querySelector('.edit-btn');
        if (editBtn && editBtn.onclick) {
            const onclickStr = editBtn.getAttribute('onclick');
            if (onclickStr && onclickStr.includes(recordId)) {
                editBtn.click();
                return;
            }
        }
    }
    
    showToast('レコードが見つかりませんでした', 'warning');
}

// ================== 既存関数のオーバーライド ==================

/**
 * 勤怠記録の保存（編集機能と区別するため名前変更）
 */
async function saveAttendanceRecordOriginal() {
    const recordId = getElement('edit-id')?.value;
    const date = getElement('edit-date')?.value;
    const clockIn = getElement('edit-clock-in')?.value;
    const clockOut = getElement('edit-clock-out')?.value;
    const siteName = getElement('edit-site')?.value;
    const notes = getElement('edit-notes')?.value;
    
    // バリデーション
    if (!date || !siteName) {
        showError('必須項目を入力してください');
        return;
    }
    
    try {
        const updateData = {
            date: date,
            siteName: siteName,
            notes: notes || '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // 時間情報の更新
        if (clockIn) {
            updateData.clockInTime = firebase.firestore.Timestamp.fromDate(new Date(clockIn));
        }
        
        if (clockOut) {
            updateData.clockOutTime = firebase.firestore.Timestamp.fromDate(new Date(clockOut));
            // 総労働時間の計算
            if (clockIn) {
                const totalMinutes = calculateTimeDiff(clockIn, clockOut).minutes;
                updateData.totalWorkTime = totalMinutes;
            }
        }
        
        // Firestoreに保存
        await firebase.firestore().collection('attendance').doc(recordId).update(updateData);
        
        // モーダルを閉じる
        const modal = getElement('edit-modal');
        if (modal) modal.classList.add('hidden');
        
        // データを再読み込み
        await loadAttendanceData();
        
        showSuccess('勤怠データを更新しました');
        console.log('勤怠データ更新完了:', recordId);
    } catch (error) {
        console.error('勤怠データ更新エラー:', error);
        showError('勤怠データの更新に失敗しました');
    }
}

/**
 * 勤怠記録の削除（編集機能と区別するため名前変更）
 */
async function deleteAttendanceRecordOriginal() {
    const recordId = getElement('edit-id')?.value;
    if (!recordId) return;
    
    if (!confirm('この勤怠記録を削除しますか？')) return;
    
    try {
        // 関連する休憩記録も削除
        const breakQuery = await firebase.firestore().collection('breaks')
            .where('attendanceId', '==', recordId)
            .get();
        
        const batch = firebase.firestore().batch();
        
        // 休憩記録を削除
        breakQuery.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // 勤怠記録を削除
        batch.delete(firebase.firestore().collection('attendance').doc(recordId));
        
        await batch.commit();
        
        // モーダルを閉じる
        const modal = getElement('edit-modal');
        if (modal) modal.classList.add('hidden');
        
        // データを再読み込み
        await loadAttendanceData();
        
        showSuccess('勤怠データを削除しました');
        console.log('勤怠データ削除完了:', recordId);
    } catch (error) {
        console.error('勤怠データ削除エラー:', error);
        showError('勤怠データの削除に失敗しました');
    }
}

/**
 * 休憩時間を追加（編集機能と区別するため名前変更）
 */
async function addBreakTimeOriginal() {
    const attendanceId = getElement('edit-id')?.value;
    const breakStart = getElement('break-start')?.value;
    const breakEnd = getElement('break-end')?.value;
    
    if (!attendanceId || !breakStart || !breakEnd) {
        showError('必須項目を入力してください');
        return;
    }
    
    // 開始時間が終了時間より後の場合はエラー
    if (new Date(breakStart) >= new Date(breakEnd)) {
        showError('休憩開始時間は終了時間より前である必要があります');
        return;
    }
    
    try {
        const currentUser = getCurrentUser();
        const startTime = firebase.firestore.Timestamp.fromDate(new Date(breakStart));
        const endTime = firebase.firestore.Timestamp.fromDate(new Date(breakEnd));
        const duration = Math.floor((new Date(breakEnd) - new Date(breakStart)) / (1000 * 60));
        
        const breakData = {
            attendanceId: attendanceId,
            userId: currentUser.uid,
            startTime: startTime,
            endTime: endTime,
            duration: duration,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await firebase.firestore().collection('breaks').add(breakData);
        
        // 休憩時間リストを再描画（新しいデータを取得）
        await loadBreakTimesForEdit(attendanceId);
        
        // 休憩追加モーダルを閉じる
        const modal = getElement('break-modal');
        if (modal) modal.classList.add('hidden');
        
        showSuccess('休憩時間を追加しました');
        console.log('休憩時間追加完了');
    } catch (error) {
        console.error('休憩時間追加エラー:', error);
        showError('休憩時間の追加に失敗しました');
    }
}

/**
 * 編集用の休憩時間データを読み込み
 * @param {string} attendanceId 勤怠記録ID
 */
async function loadBreakTimesForEdit(attendanceId) {
    try {
        const breakQuery = await firebase.firestore().collection('breaks')
            .where('attendanceId', '==', attendanceId)
            .orderBy('startTime')
            .get();
        
        const breakTimes = breakQuery.docs.map(doc => {
            const breakData = doc.data();
            return {
                id: doc.id,
                start: breakData.startTime?.toDate()?.toISOString(),
                end: breakData.endTime?.toDate()?.toISOString()
            };
        });
        
        renderBreakTimesList(breakTimes);
    } catch (error) {
        console.error('休憩時間読み込みエラー:', error);
    }
}

/**
 * 休憩時間リストのレンダリング
 */
function renderBreakTimesList(breakTimes) {
    const breakList = getElement('break-list');
    if (!breakList) return;
    
    if (!breakTimes || breakTimes.length === 0) {
        breakList.innerHTML = '<div class="no-data">休憩時間が登録されていません</div>';
        return;
    }
    
    breakList.innerHTML = breakTimes.map((breakTime, index) => {
        const duration = calculateTimeDiff(breakTime.start, breakTime.end);
        return `
            <div class="break-item">
                <div class="break-time">
                    ${formatTime(breakTime.start)} - ${formatTime(breakTime.end)}
                </div>
                <div class="break-duration">${duration.formatted}</div>
                <button class="break-remove" onclick="removeBreakTimeOriginal(${index})" title="削除">×</button>
            </div>
        `;
    }).join('');
    
    // 合計休憩時間を更新
    const totalBreakTime = calculateTotalBreakTime(breakTimes);
    const totalEl = getElement('total-break-time');
    if (totalEl) {
        totalEl.textContent = `合計休憩時間: ${totalBreakTime.formatted}`;
    }
}

/**
 * 休憩時間を削除（編集機能と区別するため名前変更）
 * @param {number} index 削除する休憩時間のインデックス
 */
async function removeBreakTimeOriginal(index) {
    const attendanceId = getElement('edit-id')?.value;
    if (!attendanceId) return;
    
    if (!confirm('この休憩時間を削除しますか？')) return;
    
    try {
        const breakQuery = await firebase.firestore().collection('breaks')
            .where('attendanceId', '==', attendanceId)
            .orderBy('startTime')
            .get();
        
        if (index >= breakQuery.docs.length) return;
        
        const breakDoc = breakQuery.docs[index];
        await breakDoc.ref.delete();
        
        // 休憩時間リストを再描画
        await loadBreakTimesForEdit(attendanceId);
        
        showSuccess('休憩時間を削除しました');
        console.log('休憩時間削除完了');
    } catch (error) {
        console.error('休憩時間削除エラー:', error);
        showError('休憩時間の削除に失敗しました');
    }
}

/**
 * 時間差計算のユーティリティ関数
 */
function calculateTimeDiff(startTime, endTime) {
    if (!startTime || !endTime) {
        return { minutes: 0, formatted: '0時間0分' };
    }
    
    try {
        const start = new Date(startTime);
        const end = new Date(endTime);
        
        if (end <= start) {
            return { minutes: 0, formatted: '無効' };
        }
        
        const diffMs = end - start;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;
        
        return {
            minutes: diffMinutes,
            formatted: `${hours}時間${minutes}分`
        };
    } catch (error) {
        return { minutes: 0, formatted: '計算エラー' };
    }
}

// ================== グローバルスコープに関数をエクスポート ==================
window.initAdminPage = initAdminPage;
window.switchTab = switchTab;
window.loadAttendanceData = loadAttendanceData;
window.editRecord = editRecord;
window.exportToCSV = exportToCSV;
window.saveAttendanceRecord = saveAttendanceRecordOriginal;
window.deleteAttendanceRecord = deleteAttendanceRecordOriginal;
window.addBreakTime = addBreakTimeOriginal;
window.removeBreakTime = removeBreakTimeOriginal;

// 編集機能の関数もエクスポート
window.showEditDialog = showEditDialog;
window.closeEditDialog = closeEditDialog;
window.showEditTab = showEditTab;
window.saveAttendanceChanges = saveAttendanceChanges;
window.deleteEditAttendanceRecord = deleteEditAttendanceRecord;
window.addNewBreak = addNewBreak;
window.removeBreak = removeBreak;
window.updateBreakTime = updateBreakTime;

// DOM読み込み完了時の初期化
document.addEventListener('DOMContentLoaded', function() {
    // 管理者ページの場合のみ編集機能を初期化
    if (window.location.hash === '#admin' || document.getElementById('admin-page')) {
        // 少し遅延させて確実に初期化
        setTimeout(initAdminEditFeatures, 100);
    }
});

console.log('✅ admin.js（完全版 - 編集機能統合）読み込み完了');


// admin.js の修正版 - Firebase権限エラー対応

// ================== Firebase権限エラー対応 ==================

// 変更履歴の読み込み（権限エラー対応版）
async function loadChangeHistory(attendanceId) {
    console.log('📜 変更履歴を読み込み中...', attendanceId);
    
    const historyList = document.getElementById('change-history-list');
    if (!historyList) return;
    
    // 初期状態で「読み込み中」を表示
    historyList.innerHTML = `
        <div class="loading-history">
            <p>📋 変更履歴を読み込み中...</p>
        </div>
    `;
    
    try {
        // シンプルなクエリで試行
        const query = firebase.firestore()
            .collection('attendance_history')
            .where('attendanceId', '==', attendanceId);
        
        const snapshot = await query.get();
        
        changeHistory = [];
        snapshot.forEach(doc => {
            changeHistory.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // 手動でソート（タイムスタンプの降順）
        changeHistory.sort((a, b) => {
            const timeA = a.timestamp ? a.timestamp.seconds : 0;
            const timeB = b.timestamp ? b.timestamp.seconds : 0;
            return timeB - timeA;
        });
        
        displayChangeHistory();
        
    } catch (error) {
        console.error('❌ 変更履歴読み込みエラー:', error);
        
        // 権限エラーの場合は適切なメッセージを表示
        if (error.code === 'permission-denied' || error.code === 'missing-or-insufficient-permissions') {
            displayChangeHistoryPermissionError();
        } else {
            displayChangeHistoryNotFound();
        }
    }
}

// 変更履歴の表示（改善版）
function displayChangeHistory() {
    const historyList = document.getElementById('change-history-list');
    
    if (changeHistory.length === 0) {
        historyList.innerHTML = `
            <div class="no-history">
                <div class="no-history-icon">📋</div>
                <h4>変更履歴がありません</h4>
                <p>この記録はまだ編集されていません。</p>
                <p>編集や削除を行うと、ここに変更履歴が表示されます。</p>
                <div class="history-info">
                    <small>💡 変更履歴には以下の情報が記録されます：</small>
                    <ul>
                        <li>変更日時</li>
                        <li>変更者</li>
                        <li>変更理由</li>
                        <li>変更内容の詳細</li>
                    </ul>
                </div>
            </div>
        `;
        return;
    }
    
    let html = '<div class="history-header-info"><h4>📜 変更履歴 (全 ' + changeHistory.length + ' 件)</h4></div>';
    
    changeHistory.forEach((history, index) => {
        const timestamp = history.timestamp ? 
            new Date(history.timestamp.seconds * 1000).toLocaleString('ja-JP') : 
            '不明';
        
        html += `
            <div class="history-item">
                <div class="history-number">#${index + 1}</div>
                <div class="history-content">
                    <div class="history-header">
                        <span class="history-date">📅 ${timestamp}</span>
                        <span class="history-user">👤 ${history.changedBy || '不明'}</span>
                    </div>
                    
                    <div class="history-type">
                        <span class="change-type-badge ${history.changeType}">
                            ${getChangeTypeText(history.changeType)}
                        </span>
                    </div>
                    
                    <div class="history-reason">
                        <strong>💭 変更理由:</strong> ${history.reason || '記載なし'}
                    </div>
                    
                    <div class="history-changes">
                        <strong>📝 変更内容:</strong>
                        <div class="changes-detail">
                            ${formatChangesImproved(history.changes, history.changeType)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    historyList.innerHTML = html;
}

// 変更タイプのテキスト変換
function getChangeTypeText(changeType) {
    const typeMap = {
        'edit': '✏️ 編集',
        'delete': '🗑️ 削除',
        'create': '➕ 作成'
    };
    return typeMap[changeType] || '🔄 変更';
}

// 変更内容のフォーマット改善版
function formatChangesImproved(changes, changeType) {
    if (changeType === 'delete') {
        return '<div class="delete-info">📋 この記録は削除されました</div>';
    }
    
    if (!changes || Object.keys(changes).length === 0) {
        return '<div class="no-changes">変更内容が記録されていません</div>';
    }
    
    let html = '<div class="changes-list">';
    Object.keys(changes).forEach(field => {
        const change = changes[field];
        const fieldName = getFieldDisplayName(field);
        
        html += `
            <div class="change-item">
                <div class="field-name">${fieldName}</div>
                <div class="change-values">
                    <span class="old-value">${change.before || '(空)'}</span>
                    <span class="arrow">→</span>
                    <span class="new-value">${change.after || '(空)'}</span>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    return html;
}

// 権限エラー時の表示
function displayChangeHistoryPermissionError() {
    const historyList = document.getElementById('change-history-list');
    historyList.innerHTML = `
        <div class="history-permission-error">
            <div class="error-icon">🔒</div>
            <h4>変更履歴へのアクセス権限がありません</h4>
            <p>変更履歴を表示するには、Firebase セキュリティルールの設定が必要です。</p>
            <div class="permission-info">
                <details>
                    <summary>🛠️ 解決方法</summary>
                    <div class="solution-steps">
                        <p><strong>Firebase Console での設定:</strong></p>
                        <ol>
                            <li>Firebase Console → Firestore Database → ルール</li>
                            <li>attendance_history コレクションへの読み取り権限を追加</li>
                        </ol>
                    </div>
                </details>
            </div>
            <p><strong>💡 編集機能は正常に動作します</strong></p>
        </div>
    `;
}

// 変更履歴が見つからない場合の表示
function displayChangeHistoryNotFound() {
    const historyList = document.getElementById('change-history-list');
    historyList.innerHTML = `
        <div class="no-history">
            <div class="no-history-icon">📋</div>
            <h4>変更履歴がありません</h4>
            <p>この記録はまだ編集されていません。</p>
            <p>編集や削除を行うと、ここに変更履歴が表示されます。</p>
        </div>
    `;
}

// ================== 保存処理の権限エラー対応 ==================

// Firestoreへの保存（権限エラー対応版）
async function saveChangesToFirestore(newData, changes, reason) {
    console.log('💾 Firestore保存開始...');
    
    try {
        // 基本的な保存（attendance_historyを除く）
        await saveBasicChanges(newData, changes, reason);
        
        // テスト用に変更履歴も保存を試行
        try {
            await saveChangeHistory(changes, reason);
            console.log('✅ 変更履歴も保存完了');
        } catch (historyError) {
            console.warn('⚠️ 変更履歴の保存に失敗（権限不足の可能性）:', historyError);
            // 変更履歴の保存に失敗しても、基本的な保存は成功として扱う
        }
        
        console.log('✅ 基本的な保存は完了');
        
    } catch (error) {
        console.error('❌ 保存エラー:', error);
        throw error;
    }
}

// 基本的な変更の保存
async function saveBasicChanges(newData, changes, reason) {
    const batch = firebase.firestore().batch();
    
    // 1. 勤怠記録の更新
    const attendanceRef = firebase.firestore()
        .collection('attendance')
        .doc(currentEditRecord.id);
    
    const updateData = {
        ...newData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: firebase.auth().currentUser?.email || 'unknown'
    };
    
    batch.update(attendanceRef, updateData);
    
    // 2. 休憩記録の処理
    for (let breakRecord of editBreakRecords) {
        if (breakRecord.isDeleted && !breakRecord.isNew) {
            // 既存記録の削除
            const breakRef = firebase.firestore().collection('breaks').doc(breakRecord.id);
            batch.delete(breakRef);
            
        } else if (breakRecord.isNew && !breakRecord.isDeleted) {
            // 新規記録の追加
            const newBreakRef = firebase.firestore().collection('breaks').doc();
            const breakData = {
                attendanceId: currentEditRecord.id,
                userId: currentEditRecord.userId,
                startTime: breakRecord.startTime,
                endTime: breakRecord.endTime,
                date: currentEditRecord.date,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            batch.set(newBreakRef, breakData);
            
        } else if (!breakRecord.isNew && !breakRecord.isDeleted && breakRecord.isModified) {
            // 既存記録の更新
            const breakRef = firebase.firestore().collection('breaks').doc(breakRecord.id);
            const breakUpdateData = {
                startTime: breakRecord.startTime,
                endTime: breakRecord.endTime,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            batch.update(breakRef, breakUpdateData);
        }
    }
    
    // 基本的な保存を実行
    await batch.commit();
}

// 変更履歴の保存（分離版）
async function saveChangeHistory(changes, reason) {
    if (!changes || Object.keys(changes).length === 0) {
        return; // 変更がない場合はスキップ
    }
    
    const historyRef = firebase.firestore().collection('attendance_history').doc();
    
    const historyData = {
        attendanceId: currentEditRecord.id,
        changes: changes,
        reason: reason,
        changedBy: firebase.auth().currentUser?.email || 'unknown',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        changeType: 'edit'
    };
    
    await historyRef.set(historyData);
}

// ================== 削除処理の権限エラー対応 ==================

// 勤怠記録の削除（権限エラー対応版）
async function deleteEditAttendanceRecord() {
    if (!currentEditRecord) return;
    
    const confirmMessage = `⚠️ 以下の勤怠記録を完全に削除しますか？\n\n` +
                          `日付: ${currentEditRecord.date}\n` +
                          `現場: ${currentEditRecord.siteName}\n` +
                          `従業員: ${currentEditRecord.userEmail || currentEditRecord.userName}\n\n` +
                          `この操作は取り消せません。`;
    
    if (!confirm(confirmMessage)) return;
    
    const reason = prompt('削除理由を入力してください（必須）:');
    if (!reason || reason.trim() === '') {
        alert('削除理由を入力してください');
        return;
    }
    
    try {
        // 基本的な削除を実行
        await deleteBasicRecord(reason);
        
        // 変更履歴の保存を試行
        try {
            await saveDeleteHistory(reason);
            console.log('✅ 削除履歴も保存完了');
        } catch (historyError) {
            console.warn('⚠️ 削除履歴の保存に失敗（権限不足の可能性）:', historyError);
        }
        
        alert('✅ 記録を削除しました');
        closeEditDialog();
        
        // 管理者画面のデータを再読み込み
        await loadAttendanceData();
        
    } catch (error) {
        console.error('❌ 削除エラー:', error);
        
        if (error.code === 'permission-denied') {
            alert('削除権限がありません。Firebase のセキュリティルールを確認してください。');
        } else {
            alert('削除中にエラーが発生しました: ' + error.message);
        }
    }
}

// 基本的なレコード削除
async function deleteBasicRecord(reason) {
    const batch = firebase.firestore().batch();
    
    // 1. 勤怠記録の削除
    const attendanceRef = firebase.firestore()
        .collection('attendance')
        .doc(currentEditRecord.id);
    batch.delete(attendanceRef);
    
    // 2. 関連する休憩記録の削除
    for (let breakRecord of editBreakRecords) {
        if (!breakRecord.isNew) {
            const breakRef = firebase.firestore().collection('breaks').doc(breakRecord.id);
            batch.delete(breakRef);
        }
    }
    
    await batch.commit();
}

// 削除履歴の保存
async function saveDeleteHistory(reason) {
    const historyRef = firebase.firestore().collection('attendance_history').doc();
    const historyData = {
        attendanceId: currentEditRecord.id,
        originalData: currentEditRecord,
        reason: reason.trim(),
        changedBy: firebase.auth().currentUser?.email || 'unknown',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        changeType: 'delete'
    };
    
    await historyRef.set(historyData);
}

// ================== 追加CSSスタイル ==================
function addImprovedHistoryStyles() {
    const additionalStyles = `
        <style>
        .loading-history {
            text-align: center;
            padding: 40px 20px;
            color: #6c757d;
        }
        
        .no-history {
            text-align: center;
            padding: 40px 20px;
            color: #6c757d;
            background: #f8f9fa;
            border-radius: 8px;
            margin: 10px 0;
        }
        
        .no-history-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        
        .no-history h4 {
            color: #495057;
            margin-bottom: 12px;
        }
        
        .history-info {
            margin-top: 20px;
            padding: 15px;
            background: white;
            border-radius: 6px;
            text-align: left;
        }
        
        .history-info ul {
            margin: 8px 0 0 20px;
            padding: 0;
        }
        
        .history-info li {
            margin-bottom: 4px;
            color: #6c757d;
        }
        
        .history-permission-error {
            text-align: center;
            padding: 40px 20px;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            color: #856404;
        }
        
        .error-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        
        .permission-info {
            margin: 20px 0;
            text-align: left;
        }
        
        .solution-steps {
            background: white;
            padding: 15px;
            border-radius: 6px;
            margin-top: 10px;
        }
        
        .solution-steps ol {
            margin: 10px 0 0 20px;
        }
        
        .history-header-info {
            margin-bottom: 20px;
            padding: 10px 15px;
            background: #e9f7ef;
            border-radius: 6px;
            color: #155724;
        }
        
        .history-item {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-left: 4px solid #007bff;
            border-radius: 0 6px 6px 0;
            margin-bottom: 15px;
            overflow: hidden;
        }
        
        .history-number {
            background: #007bff;
            color: white;
            padding: 8px 12px;
            font-weight: bold;
            font-size: 12px;
        }
        
        .history-content {
            padding: 15px;
        }
        
        .history-type {
            margin-bottom: 10px;
        }
        
        .change-type-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        }
        
        .change-type-badge.edit {
            background: #cce5ff;
            color: #0056b3;
        }
        
        .change-type-badge.delete {
            background: #f8d7da;
            color: #721c24;
        }
        
        .change-type-badge.create {
            background: #d4edda;
            color: #155724;
        }
        
        .changes-list {
            background: white;
            border-radius: 4px;
            padding: 10px;
            margin-top: 8px;
        }
        
        .change-item {
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid #f0f0f0;
        }
        
        .change-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        
        .field-name {
            font-weight: bold;
            color: #495057;
            margin-bottom: 4px;
        }
        
        .change-values {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }
        
        .old-value {
            background: #f8d7da;
            color: #721c24;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 13px;
        }
        
        .new-value {
            background: #d4edda;
            color: #155724;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 13px;
        }
        
        .arrow {
            color: #6c757d;
            font-weight: bold;
        }
        
        .delete-info {
            background: #f8d7da;
            color: #721c24;
            padding: 10px;
            border-radius: 4px;
            text-align: center;
            font-weight: bold;
        }
        
        .no-changes {
            color: #6c757d;
            font-style: italic;
            text-align: center;
            padding: 10px;
        }
        </style>
    `;
    
    // スタイルを追加
    if (!document.getElementById('improved-history-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'improved-history-styles';
        styleElement.innerHTML = additionalStyles.replace('<style>', '').replace('</style>', '');
        document.head.appendChild(styleElement);
    }
}

// 編集機能の初期化時にスタイルを追加
function initAdminEditFeaturesImproved() {
    console.log('🔧 管理者編集機能を初期化中（改善版）...');
    
    // 既存のスタイルを適用
    initEditFunctionStyles();
    
    // 改善されたスタイルを追加
    addImprovedHistoryStyles();
    
    console.log('✅ 管理者編集機能（改善版）が利用可能になりました');
}

// 既存の初期化関数を上書き
window.initAdminEditFeatures = initAdminEditFeaturesImproved;

console.log('✅ admin.js 権限エラー対応版 読み込み完了');
