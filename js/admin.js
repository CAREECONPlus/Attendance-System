/**
 * 管理者画面の初期化処理
 * 全てのイベントリスナーを設定し、初期データを読み込みます
 */
function initAdminPage() {
    console.log('管理者ページの初期化開始');
    
    // 権限チェック
    if (!checkAuth('admin')) return;

    // 基本的なUI初期化（まず最初に表示すべき要素）
    setupAdminBasics();
    
    // 残りの初期化を少し遅延させて実行
    setTimeout(function() {
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
    }, 200);
}

/**
 * 管理者画面の基本的なUI初期化
 * 最初に表示すべき要素のみを設定
 */
function setupAdminBasics() {
    // ユーザー名を表示
    const currentUser = getCurrentUser();
    if (currentUser) {
        const adminUserNameEl = getElement('admin-user-name');
        if (adminUserNameEl) {
            adminUserNameEl.textContent = currentUser.fullName;
            console.log('管理者名を表示:', currentUser.fullName);
        }
    }
}

/**
 * 管理者画面のイベント設定
 * 各ボタンやフォーム要素にイベントリスナーを設定します
 */
function setupAdminEvents() {
    // タブ切り替え
    const tabButtons = document.querySelectorAll('.tab-btn');
    if (tabButtons) {
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                // アクティブタブの切り替え
                document.querySelector('.tab-btn.active')?.classList.remove('active');
                this.classList.add('active');
                
                // フィルターの表示切り替え
                const tabName = this.getAttribute('data-tab');
                
                if (tabName === 'daily') {
                    document.querySelector('.date-filter')?.classList.remove('hidden');
                    document.querySelector('.month-filter')?.classList.add('hidden');
                    document.querySelector('.employee-filter')?.classList.add('hidden');
                    document.querySelector('.site-filter')?.classList.add('hidden');
                } else if (tabName === 'monthly') {
                    document.querySelector('.date-filter')?.classList.add('hidden');
                    document.querySelector('.month-filter')?.classList.remove('hidden');
                    document.querySelector('.employee-filter')?.classList.add('hidden');
                    document.querySelector('.site-filter')?.classList.add('hidden');
                } else if (tabName === 'employee') {
                    document.querySelector('.date-filter')?.classList.add('hidden');
                    document.querySelector('.month-filter')?.classList.add('hidden');
                    document.querySelector('.employee-filter')?.classList.remove('hidden');
                    document.querySelector('.site-filter')?.classList.add('hidden');
                } else if (tabName === 'site') {
                    document.querySelector('.date-filter')?.classList.add('hidden');
                    document.querySelector('.month-filter')?.classList.add('hidden');
                    document.querySelector('.employee-filter')?.classList.add('hidden');
                    document.querySelector('.site-filter')?.classList.remove('hidden');
                }
                
                // データを再読み込み
                loadAttendanceData();
            });
        });
    }
    
    // フィルター変更イベント
    const filterDate = getElement('filter-date');
    if (filterDate) {
        filterDate.addEventListener('change', loadAttendanceData);
    }
    
    const filterMonth = getElement('filter-month');
    if (filterMonth) {
        filterMonth.addEventListener('change', loadAttendanceData);
    }
    
    const filterEmployee = getElement('filter-employee');
    if (filterEmployee) {
        filterEmployee.addEventListener('change', loadAttendanceData);
    }

    const filterSite = getElement('filter-site');
    if (filterSite) {
        filterSite.addEventListener('change', loadAttendanceData);
    }
    
    // CSV出力
    const exportCsvBtn = getElement('export-csv');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportCsv);
    }
    
    // ソートヘッダーの設定
    setupSortableHeaders();
    
    // モーダル関連
    setupModalEvents();
    
    // ログアウトボタン
    const adminLogoutBtn = getElement('admin-logout-btn');
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', function() {
            localStorage.removeItem('currentUser');
            showPage('login');
        });
    }
}

/**
 * モーダル関連のイベント設定
 */
function setupModalEvents() {
    // モーダルを閉じるボタン
    const closeModalBtns = document.querySelectorAll('.close-btn');
    if (closeModalBtns) {
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const modalId = this.closest('.modal').id;
                document.getElementById(modalId)?.classList.add('hidden');
            });
        });
    }
    
    // 編集フォームの送信
    const editForm = getElement('edit-form');
    if (editForm) {
        editForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveAttendanceRecord();
        });
    }
    
    // 勤怠レコード削除
    const deleteRecordBtn = getElement('delete-record');
    if (deleteRecordBtn) {
        deleteRecordBtn.addEventListener('click', function() {
            if (confirm('この勤怠記録を削除してもよろしいですか？')) {
                deleteAttendanceRecord();
            }
        });
    }
    
    // 休憩時間追加ボタン
    const addBreakBtn = getElement('add-break-btn');
    if (addBreakBtn) {
        addBreakBtn.addEventListener('click', function() {
            openBreakModal();
        });
    }
    
    // 休憩フォームの送信
    const breakForm = getElement('break-form');
    if (breakForm) {
        breakForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addBreakTime();
        });
    }
    
    // 休憩追加キャンセル
    const cancelBreakBtn = getElement('cancel-break');
    if (cancelBreakBtn) {
        cancelBreakBtn.addEventListener('click', function() {
            document.getElementById('break-modal')?.classList.add('hidden');
        });
    }
}

/**
 * 従業員リストの読み込み
 * 従業員フィルター用のセレクトボックスを更新する
 */
function loadEmployeeList() {
    // 全ユーザーから従業員のみを抽出
    const allUsers = getUsers();
    const employees = allUsers.filter(user => user.role === 'employee');
    
    const select = getElement('filter-employee');
    if (!select) return;
    
    // 既存のオプションをクリア（最初の「全員」オプションは残す）
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    // 従業員リストを追加
    employees.forEach(employee => {
        const option = document.createElement('option');
        option.value = employee.id;
        option.textContent = employee.fullName;
        select.appendChild(option);
    });
}

/**
 * 現場リストの読み込み
 * 現場フィルター用のセレクトボックスを更新する
 */
function loadSiteList() {
    const attendance = getAttendanceRecords();
    const sites = new Set();
    
    // すべての勤怠記録から現場名を抽出
    attendance.forEach(record => {
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
}

/**
 * データのソート処理
 * 
 * @param {Array} data ソートするデータ配列
 * @param {string} sortKey ソートキー
 * @param {string} sortDirection ソート方向（'asc'/'desc'）
 * @returns {Array} ソート済みデータ
 */
function sortAttendanceData(data, sortKey, sortDirection) {
    return [...data].sort((a, b) => {
        let aValue = a[sortKey];
        let bValue = b[sortKey];
        
        // 文字列の場合は小文字に変換して比較
        if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
        }
        if (typeof bValue === 'string') {
            bValue = bValue.toLowerCase();
        }
        
        // 昇順/降順に応じて比較
        if (sortDirection === 'asc') {
            return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
            return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
    });
}

/**
 * ソートヘッダーの設定
 * テーブルヘッダーがクリックされた時のイベントを設定する
 */
function setupSortableHeaders() {
    const headers = document.querySelectorAll('.attendance-table th.sortable');
    if (!headers.length) return;
    
    headers.forEach(header => {
        header.addEventListener('click', function() {
            const sortKey = this.getAttribute('data-sort');
            if (!sortKey) return;
            
            // 現在のソート方向を取得
            let sortDirection = 'asc';
            if (this.classList.contains('asc')) {
                sortDirection = 'desc';
                this.classList.remove('asc');
                this.classList.add('desc');
            } else if (this.classList.contains('desc')) {
                sortDirection = 'asc';
                this.classList.remove('desc');
                this.classList.add('asc');
            } else {
                // 初めてのソート
                this.classList.add('asc');
                
                // 他のヘッダーからソート表示をクリア
                headers.forEach(h => {
                    if (h !== this) {
                        h.classList.remove('asc', 'desc');
                    }
                });
            }
            
            // 現在のフィルタリング条件に基づいてデータを取得
            const activeTab = document.querySelector('.tab-btn.active')?.getAttribute('data-tab');
            const attendance = getAttendanceRecords();
            let filteredData = [];
            
            if (activeTab === 'daily') {
                const filterDate = getElement('filter-date')?.value;
                if (filterDate) {
                    filteredData = attendance.filter(record => record.date === filterDate);
                }
            } else if (activeTab === 'monthly') {
                const filterMonth = getElement('filter-month')?.value;
                if (filterMonth) {
                    filteredData = attendance.filter(record => record.date.startsWith(filterMonth));
                }
            } else if (activeTab === 'employee') {
                const employeeId = getElement('filter-employee')?.value;
                filteredData = employeeId ? 
                    attendance.filter(record => record.userId == employeeId) : 
                    attendance;
            } else if (activeTab === 'site') {
                const siteName = getElement('filter-site')?.value;
                filteredData = siteName ? 
                    attendance.filter(record => record.siteName === siteName) : 
                    attendance;
            }
            
            // データをソート
            const sortedData = sortAttendanceData(filteredData, sortKey, sortDirection);
            
            // テーブルを更新
            renderAttendanceTable(sortedData);
        });
    });
}

/**
 * テーブルの描画処理
 * 勤怠データをテーブルに表示する
 * 
 * @param {Array} data 表示するデータ配列
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
        
        if (record.clockIn) {
            if (record.clockOut) {
                // 休憩時間
                const breakTime = calculateTotalBreakTime(record.breakTimes);
                
                // 実労働時間
                const workTime = calculateWorkingTime(
                    record.clockIn, 
                    record.clockOut,
                    record.breakTimes
                );
                
                // 総勤務時間
                const totalTime = calculateTimeDiff(record.clockIn, record.clockOut);
                
                workTimeHTML = `
                    <div class="work-times">
                        <div>
                            <span class="work-time-label">出勤:</span>
                            <span class="work-time-value">${formatTime(record.clockIn)}</span>
                        </div>
                        <div>
                            <span class="work-time-label">退勤:</span>
                            <span class="work-time-value">${formatTime(record.clockOut)}</span>
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
                            <span class="work-time-value">${formatTime(record.clockIn)}</span>
                        </div>
                        <div>
                            <span class="work-time-value">勤務中</span>
                        </div>
                    </div>
                `;
            }
        }
        
        row.innerHTML = `
            <td>${record.userName}</td>
            <td>${formatDate(record.date)}</td>
            <td>${record.siteName}</td>
            <td>${workTimeHTML}</td>
            <td><button class="btn btn-small edit-btn" data-id="${record.id}">編集</button></td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // 編集ボタンにイベントリスナーを追加
    const editBtns = tableBody.querySelectorAll('.edit-btn');
    if (editBtns) {
        editBtns.forEach(button => {
            button.addEventListener('click', function() {
                const recordId = this.getAttribute('data-id');
                if (recordId) openEditModal(recordId);
            });
        });
    }
}

/**
 * 勤怠データの読み込み
 * 現在の表示タブとフィルター条件に基づいてデータを取得し表示する
 */
function loadAttendanceData() {
    const attendance = getAttendanceRecords();
    
    // フィルター条件の取得
    const activeTab = document.querySelector('.tab-btn.active')?.getAttribute('data-tab');
    if (!activeTab) return;
    
    let filteredData = [];
    
    if (activeTab === 'daily') {
        const filterDate = getElement('filter-date')?.value;
        if (filterDate) {
            filteredData = attendance.filter(record => record.date === filterDate);
        }
    } else if (activeTab === 'monthly') {
        const filterMonth = getElement('filter-month')?.value;
        if (filterMonth) {
            filteredData = attendance.filter(record => record.date.startsWith(filterMonth));
        }
    } else if (activeTab === 'employee') {
        const employeeId = getElement('filter-employee')?.value;
        filteredData = employeeId ? 
            attendance.filter(record => record.userId == employeeId) : 
            attendance;
    } else if (activeTab === 'site') {
        const siteName = getElement('filter-site')?.value;
        filteredData = siteName ? 
            attendance.filter(record => record.siteName === siteName) : 
            attendance;
    }
    
    // ソート（日付の新しい順）
    filteredData.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // テーブルを描画
    renderAttendanceTable(filteredData);
}

/**
 * 編集モーダルを開く
 * 指定されたIDの勤怠記録の編集フォームを表示する
 * 
 * @param {number|string} recordId 編集する勤怠記録のID
 */
function openEditModal(recordId) {
    const attendance = getAttendanceRecords();
    const record = attendance.find(r => r.id == recordId);
    
    if (!record) return;
    
    // フォームに値をセット
    getElement('edit-id').value = record.id;
    getElement('edit-date').value = record.date;
    getElement('edit-site').value = record.siteName;
    
    // 日時フォーマットの調整
    if (record.clockIn) {
        getElement('edit-clock-in').value = formatDateTimeLocal(record.clockIn);
    } else {
        getElement('edit-clock-in').value = '';
    }
    
    if (record.clockOut) {
        getElement('edit-clock-out').value = formatDateTimeLocal(record.clockOut);
    } else {
        getElement('edit-clock-out').value = '';
    }
    
    getElement('edit-notes').value = record.notes || '';
    
    // 休憩時間リストを表示
    renderBreakTimesList(record.breakTimes || []);
    
    // モーダルを表示
    getElement('edit-modal').classList.remove('hidden');
}

/**
 * 休憩時間追加モーダルを開く
 */
function openBreakModal() {
    const editId = getElement('edit-id').value;
    if (!editId) return;
    
    const clockIn = getElement('edit-clock-in').value;
    const clockOut = getElement('edit-clock-out').value;
    
    // 初期値を設定
    if (clockIn) {
        getElement('break-start').value = clockIn;
        getElement('break-start').min = clockIn;
        
        if (clockOut) {
            getElement('break-end').value = clockOut;
            getElement('break-end').max = clockOut;
        } else {
            getElement('break-end').value = getCurrentDateTimeLocal();
        }
    } else {
        getElement('break-start').value = '';
        getElement('break-end').value = '';
    }
    
    // モーダルを表示
    getElement('break-modal').classList.remove('hidden');
}

/**
 * 休憩時間リストの表示
 * 
 * @param {Array} breakTimes 休憩時間の配列
 */
function renderBreakTimesList(breakTimes) {
    const breakList = getElement('break-list');
    if (!breakList) return;
    
    breakList.innerHTML = '';
    
    if (!breakTimes || breakTimes.length === 0) {
        breakList.innerHTML = '<div class="form-hint">休憩記録がありません</div>';
        getElement('total-break-time').textContent = '合計休憩時間: 0時間0分';
        return;
    }
    
    let tempBreakTimes = [...breakTimes];
    
    // 日付の昇順でソート
    tempBreakTimes.sort((a, b) => new Date(a.start) - new Date(b.start));
    
    tempBreakTimes.forEach((breakTime, index) => {
        if (!breakTime.start) return;
        
        const breakItem = document.createElement('div');
        breakItem.className = 'break-item';
        
        let timeText = `${formatTime(breakTime.start)} 〜 `;
        let breakDuration = '';
        
        if (breakTime.end) {
            timeText += formatTime(breakTime.end);
            const diff = calculateTimeDiff(breakTime.start, breakTime.end);
            breakDuration = diff.formatted;
        } else {
            timeText += '(未終了)';
        }
        
        breakItem.innerHTML = `
            <div class="break-time">${timeText}</div>
            <div class="break-duration">${breakDuration}</div>
            <button type="button" class="break-remove" data-index="${index}">×</button>
        `;
        
        breakList.appendChild(breakItem);
    });
    
    // 休憩時間合計を計算して表示
    const totalBreak = calculateTotalBreakTime(breakTimes);
    getElement('total-break-time').textContent = `合計休憩時間: ${totalBreak.formatted}`;
    
    // 削除ボタンのイベントを設定
    const removeButtons = breakList.querySelectorAll('.break-remove');
    if (removeButtons) {
        removeButtons.forEach(button => {
            button.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                removeBreakTime(index);
            });
        });
    }
}

/**
 * 休憩時間を追加
 */
function addBreakTime() {
    const editId = getElement('edit-id').value;
    const breakStart = getElement('break-start').value;
    const breakEnd = getElement('break-end').value;
    
    if (!editId || !breakStart || !breakEnd) {
        alert('必須項目を入力してください');
        return;
    }
    
    // 開始時間が終了時間より後の場合はエラー
    if (new Date(breakStart) >= new Date(breakEnd)) {
        alert('休憩開始時間は終了時間より前である必要があります');
        return;
    }
    
    // 勤怠記録を取得
    const records = getAttendanceRecords();
    const recordIndex = records.findIndex(r => r.id == editId);
    
    if (recordIndex === -1) return;
    
    // 休憩時間配列を初期化（存在しない場合）
    if (!records[recordIndex].breakTimes) {
        records[recordIndex].breakTimes = [];
    }
    
    // 新しい休憩時間を追加
    records[recordIndex].breakTimes.push({
        start: new Date(breakStart).toISOString(),
        end: new Date(breakEnd).toISOString()
    });
    
    // 更新したデータを一時保存
    const tempRecord = records[recordIndex];
    
    // 休憩時間リストを再描画
    renderBreakTimesList(tempRecord.breakTimes);
    
    // 休憩追加モーダルを閉じる
    getElement('break-modal').classList.add('hidden');
}

/**
 * 休憩時間を削除
 * 
 * @param {number} index 削除する休憩時間のインデックス
 */
function removeBreakTime(index) {
    const editId = getElement('edit-id').value;
    if (!editId) return;
    
    // 勤怠記録を取得
    const records = getAttendanceRecords();
    const recordIndex = records.findIndex(r => r.id == editId);
    
    if (recordIndex === -1 || !records[recordIndex].breakTimes || index >= records[recordIndex].breakTimes.length) {
        return;
    }
    
    // 指定したインデックスの休憩時間を削除
    records[recordIndex].breakTimes.splice(index, 1);
    
    // 更新したデータを一時保存
    const tempRecord = records[recordIndex];
    
    // 休憩時間リストを再描画
    renderBreakTimesList(tempRecord.breakTimes);
}

/**
 * 勤怠記録の保存
 */
function saveAttendanceRecord() {
    const recordId = getElement('edit-id').value;
    const date = getElement('edit-date').value;
    const clockIn = getElement('edit-clock-in').value;
    const clockOut = getElement('edit-clock-out').value;
    const siteName = getElement('edit-site').value;
    const notes = getElement('edit-notes').value;
    
    // バリデーション
    if (!date || !siteName) {
        alert('必須項目を入力してください');
        return;
    }
    
    // 勤怠データを更新
    const attendance = getAttendanceRecords();
    const recordIndex = attendance.findIndex(r => r.id == recordId);
    
    if (recordIndex === -1) return;
    
    // 基本情報の更新
    attendance[recordIndex].date = date;
    attendance[recordIndex].siteName = siteName;
    attendance[recordIndex].notes = notes;
    
    // 時間情報の更新
    if (clockIn) {
        attendance[recordIndex].clockIn = new Date(clockIn).toISOString();
    } else {
        attendance[recordIndex].clockIn = null;
    }
    
    if (clockOut) {
        attendance[recordIndex].clockOut = new Date(clockOut).toISOString();
    } else {
        attendance[recordIndex].clockOut = null;
    }
    
    // 保存
    localStorage.setItem('attendanceRecords', JSON.stringify(attendance));
    
    // モーダルを閉じる
    getElement('edit-modal').classList.add('hidden');
    
    // データを再読み込み
    loadAttendanceData();
    
    alert('勤怠データを更新しました');
}

/**
 * 勤怠記録の削除
 */
function deleteAttendanceRecord() {
    const recordId = getElement('edit-id').value;
    if (!recordId) return;
    
    let attendance = getAttendanceRecords();
    
    // 該当のレコードを除外した新しい配列を作成
    attendance = attendance.filter(r => r.id != recordId);
    
    // 保存
    localStorage.setItem('attendanceRecords', JSON.stringify(attendance));
    
    // モーダルを閉じる
    getElement('edit-modal').classList.add('hidden');
    
    // データを再読み込み
    loadAttendanceData();
    
    alert('勤怠データを削除しました');
}

/**
 * CSV出力処理
 * 現在の表示条件に基づいて勤怠データをCSVファイルとして出力する
 */
function exportCsv() {
    const attendance = getAttendanceRecords();
    const activeTab = document.querySelector('.tab-btn.active')?.getAttribute('data-tab');
    if (!activeTab) return;
    
    let filteredData = [];
    let fileName = '';
    
    // フィルター条件の適用
    if (activeTab === 'daily') {
        const filterDate = getElement('filter-date')?.value;
        if (filterDate) {
            filteredData = attendance.filter(record => record.date === filterDate);
            fileName = `勤怠データ_${filterDate}.csv`;
        }
    } else if (activeTab === 'monthly') {
        const filterMonth = getElement('filter-month')?.value;
        if (filterMonth) {
            filteredData = attendance.filter(record => record.date.startsWith(filterMonth));
            fileName = `勤怠データ_${filterMonth}.csv`;
        }
    } else if (activeTab === 'employee') {
        const employeeId = getElement('filter-employee')?.value;
        const employeeName = employeeId ? 
            getElement('filter-employee').options[getElement('filter-employee').selectedIndex]?.text : 
            '全従業員';
        
        filteredData = employeeId ? 
            attendance.filter(record => record.userId == employeeId) : 
            attendance;
        
        fileName = `勤怠データ_${employeeName}.csv`;
    } else if (activeTab === 'site') {
        const siteName = getElement('filter-site')?.value;
        const siteLabel = siteName || '全現場';
        
        filteredData = siteName ? 
            attendance.filter(record => record.siteName === siteName) : 
            attendance;
        
        fileName = `勤怠データ_${siteLabel}.csv`;
    }
    
    if (filteredData.length === 0) {
        alert('出力するデータがありません');
        return;
    }
    
    // データを日付順にソート
    filteredData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // ヘッダー行
    let csvContent = "従業員名,日付,現場名,出勤時間,退勤時間,休憩時間,実労働時間,メモ\n";
    
    // データ行の生成
    filteredData.forEach(record => {
        // 休憩時間の合計
        const breakTime = calculateTotalBreakTime(record.breakTimes);
        
        // 実労働時間
        const workTime = record.clockIn && record.clockOut ? 
            calculateWorkingTime(record.clockIn, record.clockOut, record.breakTimes) : 
            { formatted: '' };
        
        // 出退勤時間のフォーマット
        const clockInTime = record.clockIn ? formatTime(record.clockIn) : '';
        const clockOutTime = record.clockOut ? formatTime(record.clockOut) : '';
        
        // メモのエスケープ処理
        const escapedNotes = record.notes ? 
            record.notes.replace(/"/g, '""').replace(/\n/g, ' ') : 
            '';
        
        // CSVの1行を生成
        const row = [
            record.userName,
            formatDate(record.date),
            record.siteName,
            clockInTime,
            clockOutTime,
            breakTime.formatted,
            workTime.formatted,
            escapedNotes
        ].map(cell => `"${cell}"`).join(',');
        
        csvContent += row + '\n';
    });
    
    // BOMを追加してUTF-8として認識されるようにする
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // ダウンロードリンクを作成
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName || '勤怠データ.csv';
    
    // 見えないように設定してクリックをシミュレート
    document.body.appendChild(link);
    link.style.display = 'none';
    link.click();
    
    // クリーンアップ
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }, 100);
    
    console.log(`CSVファイルを出力しました: ${fileName}`);
}

// DOMが読み込まれた時に管理者ページを初期化（ユーザーが管理者の場合）
document.addEventListener('DOMContentLoaded', function() {
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.role === 'admin') {
        showPage('admin');
        initAdminPage();
    }
});
