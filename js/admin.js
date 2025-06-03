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
        const querySnapshot = await db.collection('users')
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
        const querySnapshot = await db.collection('attendance').get();
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
        
        let query = db.collection('attendance');
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
            const breakQuery = await db.collection('breaks')
                .where('attendanceId', '==', record.id)
                .orderBy('startTime')
                .get();
            
            record.breakTimes = breakQuery.docs.map(doc => {
                const breakData = doc.data();
                return {
                    id: doc.id,
                    start: breakData.startTime?.toDate()?.toISOString(),
                    end: breakData.endTime?.toDate()?.toISOString()
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
 * 勤怠テーブルのレンダリング
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
            record.clockInTime,
            record.clockOutTime,
            record.breakTimes || []
        );
        
        return `
            <tr>
                <td>${record.userName || '-'}</td>
                <td>${formatDate(record.date)}</td>
                <td>${record.siteName || '-'}</td>
                <td>
                    <div class="work-times">
                        <div class="work-time-row">
                            <span class="work-time-label">出勤:</span>
                            <span class="work-time-value">${formatTime(record.clockInTime)}</span>
                        </div>
                        <div class="work-time-row">
                            <span class="work-time-label">退勤:</span>
                            <span class="work-time-value">${formatTime(record.clockOutTime)}</span>
                        </div>
                        <div class="work-time-row break">
                            <span class="work-time-label">休憩:</span>
                            <span class="work-time-value">${breakTime.formatted}</span>
                        </div>
                        <div class="work-time-row total">
                            <span class="work-time-label">実労働:</span>
                            <span class="work-time-value">${workTime.formatted}</span>
                        </div>
                    </div>
                </td>
                <td>
                    <button class="btn btn-small btn-secondary" onclick="editRecord('${record.id}')">編集</button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * 勤怠記録の編集
 */
function editRecord(recordId) {
    console.log('編集レコードID:', recordId);
    // TODO: 編集モーダルの実装
    showToast('編集機能は実装中です', 'warning');
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
    
    let query = db.collection('attendance');
    
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
            record.clockInTime,
            record.clockOutTime,
            record.breakTimes || []
        );
        
        return [
            record.userName || '',
            formatDate(record.date),
            record.siteName || '',
            formatTime(record.clockInTime),
            formatTime(record.clockOutTime),
            breakTime.formatted,
            workTime.formatted,
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

/**
 * 勤怠記録の保存（Firebase v8対応版）
 */
async function saveAttendanceRecord() {
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
        await db.collection('attendance').doc(recordId).update(updateData);
        
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
 * 勤怠記録の削除（Firebase v8対応版）
 */
async function deleteAttendanceRecord() {
    const recordId = getElement('edit-id')?.value;
    if (!recordId) return;
    
    if (!confirm('この勤怠記録を削除しますか？')) return;
    
    try {
        // 関連する休憩記録も削除
        const breakQuery = await db.collection('breaks')
            .where('attendanceId', '==', recordId)
            .get();
        
        const batch = db.batch();
        
        // 休憩記録を削除
        breakQuery.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // 勤怠記録を削除
        batch.delete(db.collection('attendance').doc(recordId));
        
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
 * 休憩時間を追加（Firebase v8対応版）
 */
async function addBreakTime() {
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
        
        await db.collection('breaks').add(breakData);
        
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
        const breakQuery = await db.collection('breaks')
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
                <button class="break-remove" onclick="removeBreakTime(${index})" title="削除">×</button>
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
 * 休憩時間を削除（Firebase v8対応版）
 * @param {number} index 削除する休憩時間のインデックス
 */
async function removeBreakTime(index) {
    const attendanceId = getElement('edit-id')?.value;
    if (!attendanceId) return;
    
    if (!confirm('この休憩時間を削除しますか？')) return;
    
    try {
        const breakQuery = await db.collection('breaks')
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
 * ユーザーフレンドリーなエラーメッセージ表示
 * @param {string} message エラーメッセージ
 */
function showError(message) {
    // トースト通知を表示（CSS追加分を使用）
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

/**
 * 成功メッセージ表示
 * @param {string} message 成功メッセージ
 */
function showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// グローバルスコープに関数をエクスポート
window.initAdminPage = initAdminPage;
window.switchTab = switchTab;
window.loadAttendanceData = loadAttendanceData;
window.editRecord = editRecord;
window.exportToCSV = exportToCSV;
window.saveAttendanceRecord = saveAttendanceRecord;
window.deleteAttendanceRecord = deleteAttendanceRecord;
window.addBreakTime = addBreakTime;
window.removeBreakTime = removeBreakTime;
