console.log('employee.js loaded');

/**
 * 勤怠管理システム - 従業員機能
 * 
 * このファイルには、従業員画面の機能に関連する関数が含まれています。
 * 出退勤、休憩、作業記録などの処理を担当します。
 */

// ================ 従業員側の機能 ================

/**
 * 従業員画面の初期化処理
 * 全てのイベントリスナーを設定し、初期データを読み込みます
 */
function initEmployeePage() {
    console.log('従業員ページの初期化開始');
    
    // 権限チェック
    if (!checkAuth('employee')) return;

    // 基本的なUI初期化（まず最初に表示すべき要素）
    setupEmployeeBasics();
    
    // 残りの初期化を少し遅延させて実行
    setTimeout(function() {
        // 現在の日時を表示
        updateDateTime();
        
        // 勤怠状況の確認
        checkTodayAttendance();
        
        // 最近の記録を表示
        loadRecentRecords();
        
        // イベントハンドラを設定
        setupEmployeeEvents();
        
        // 現場オプションの読み込み
        populateSiteOptions();
        
        // 1秒ごとに時刻を更新するタイマーを設定
        setInterval(updateDateTime, 1000);
        
        console.log('従業員ページの詳細初期化完了');
    }, 200);
}

/**
 * 従業員画面の基本的なUI初期化
 * 最初に表示すべき要素のみを設定
 */
function setupEmployeeBasics() {
    // ユーザー名を表示
    const currentUser = getCurrentUser();
    if (currentUser) {
        const userNameEl = getElement('user-name');
        if (userNameEl) {
            userNameEl.textContent = currentUser.fullName;
            console.log('ユーザー名を表示:', currentUser.fullName);
        }
    }
    
    // 出勤ボタン
    const clockInBtn = getElement('clock-in-btn');
    if (clockInBtn) {
        clockInBtn.addEventListener('click', clockIn);
    }
    
    // 退勤ボタン
    const clockOutBtn = getElement('clock-out-btn');
    if (clockOutBtn) {
        clockOutBtn.addEventListener('click', clockOut);
    }
    
    // 休憩開始ボタン
    const breakStartBtn = getElement('break-start-btn');
    if (breakStartBtn) {
        breakStartBtn.addEventListener('click', startBreak);
    }
    
    // 休憩終了ボタン
    const breakEndBtn = getElement('break-end-btn');
    if (breakEndBtn) {
        breakEndBtn.addEventListener('click', endBreak);
    }
    
    // ログアウトボタン
    const logoutBtn = getElement('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('currentUser');
            showPage('login');
        });
    }
}

/**
 * 従業員画面のイベント設定
 * イベントハンドラーの登録を担当します
 */
function setupEmployeeEvents() {
    console.log('従業員イベントを設定中...');
    
    // サイト選択の切り替え
    const siteSelect = getElement('site-name');
    const otherSite = getElement('other-site');
    
    if (siteSelect && otherSite) {
        siteSelect.addEventListener('change', function() {
            if (this.value === 'other') {
                otherSite.style.display = 'block';
                otherSite.required = true;
            } else {
                otherSite.style.display = 'none';
                otherSite.required = false;
            }
        });
    }
    
    console.log('従業員イベント設定完了');
}

/**
 * 勤務状況をチェックしてボタンの有効/無効状態を更新する
 * 今日の勤怠記録に基づいて、ボタンの状態や表示内容を変更します
 */
function checkTodayAttendance() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const today = new Date().toISOString().split('T')[0];
    const records = getAttendanceRecords();

    // 前日までの未完了の勤怠記録を確認し、必要に応じて自動終了処理
    handleIncompleteRecords(currentUser.id, today);

    // 今日の記録を検索（日付が今日のものだけを対象にする）
    const todayRecord = records.find(record =>
        record.userId === currentUser.id && record.date === today
    );

    const clockInBtn = getElement('clock-in-btn');
    const clockOutBtn = getElement('clock-out-btn');
    const breakStartBtn = getElement('break-start-btn');
    const breakEndBtn = getElement('break-end-btn');
    const clockStatus = getElement('clock-status');

    // すべてのボタンを一旦無効化
    if (clockInBtn) clockInBtn.disabled = true;
    if (clockOutBtn) clockOutBtn.disabled = true;
    if (breakStartBtn) breakStartBtn.disabled = true;
    if (breakEndBtn) breakEndBtn.disabled = true;

    if (!todayRecord) {
        // 未出勤
        if (clockStatus) {
            clockStatus.innerHTML = `
                <div class="status-waiting">おはようございます！<br>出勤ボタンを押してください</div>
            `;
        }
        if (clockInBtn) clockInBtn.disabled = false;
        return;
    }

    // 休憩中かどうかを確認
    const isOnBreak = todayRecord.breakTimes && todayRecord.breakTimes.some(
        breakTime => breakTime.start && !breakTime.end
    );

    if (todayRecord.clockIn && !todayRecord.clockOut) {
        // 出勤済み・退勤前
        if (isOnBreak) {
            // 休憩中
            if (clockStatus) {
                const lastBreak = todayRecord.breakTimes[todayRecord.breakTimes.length - 1];
                const breakStart = formatTime(lastBreak.start);
                
                clockStatus.innerHTML = `
                    <div class="status-break">現在休憩中です</div>
                    <div class="status-detail">出勤: ${formatTime(todayRecord.clockIn)}</div>
                    <div class="status-detail">休憩開始: ${breakStart}</div>
                `;
            }
            if (breakEndBtn) breakEndBtn.disabled = false;
        } else {
            // 勤務中
            if (clockStatus) {
                clockStatus.innerHTML = `
                    <div class="status-working">現在勤務中です</div>
                    <div class="status-detail">出勤: ${formatTime(todayRecord.clockIn)}</div>
                `;
            }
            if (clockOutBtn) clockOutBtn.disabled = false;
            if (breakStartBtn) breakStartBtn.disabled = false;
        }
    } else if (todayRecord.clockIn && todayRecord.clockOut) {
        // 出退勤済み
        if (clockStatus) {
            // 休憩時間の合計
            const breakTime = calculateTotalBreakTime(todayRecord.breakTimes);
            
            // 実労働時間
            const workTime = calculateWorkingTime(
                todayRecord.clockIn, 
                todayRecord.clockOut,
                todayRecord.breakTimes
            );
            
            clockStatus.innerHTML = `
                <div class="status-complete">本日の勤務は完了しています</div>
                <div class="status-detail">出勤: ${formatTime(todayRecord.clockIn)}</div>
                <div class="status-detail">退勤: ${formatTime(todayRecord.clockOut)}</div>
                <div class="status-detail">休憩: ${breakTime.formatted}</div>
                <div class="status-detail">実労働: ${workTime.formatted}</div>
            `;
        }
    }
}

/**
 * 未完了の勤怠記録を処理する
 * 前日以前の勤怠で終了していないものを自動的に終了させる
 * 
 * @param {number} userId ユーザーID
 * @param {string} today 今日の日付（YYYY-MM-DD）
 */
function handleIncompleteRecords(userId, today) {
    if (!userId || !today) return;
    
    const records = getAttendanceRecords();
    let hasChanged = false;
    
    // 前日までの未完了の勤怠記録を探す
    records.forEach(record => {
        if (record.userId === userId && record.date < today) {
            // 出勤しているが退勤していない記録
            if (record.clockIn && !record.clockOut) {
                console.log(`未完了の勤怠記録を自動終了: ${record.date}`);
                
                // その日の23:59:59で勤務終了としてマーク
                const endDate = new Date(record.date);
                endDate.setHours(23, 59, 59);
                record.clockOut = endDate.toISOString();
                
                // 休憩中だった場合は休憩も終了
                if (record.breakTimes) {
                    record.breakTimes.forEach(breakTime => {
                        if (breakTime.start && !breakTime.end) {
                            breakTime.end = endDate.toISOString();
                        }
                    });
                }
                
                hasChanged = true;
            }
        }
    });
    
    // 変更があれば保存
    if (hasChanged) {
        localStorage.setItem('attendanceRecords', JSON.stringify(records));
    }
}

/**
 * 出勤処理
 * 新しい勤怠記録を作成し、出勤時間を記録する
 */
function clockIn() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const siteSelect = getElement('site-name');
    let siteName = siteSelect?.value || '';

    if (siteName === 'other') {
        siteName = getElement('other-site')?.value || '';
    }

    if (!siteName) {
        alert('現場名を選択または入力してください');
        return;
    }

    const notes = getElement('work-notes')?.value || '';
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const records = getAttendanceRecords();

    const newId = records.length > 0 ? Math.max(...records.map(r => r.id)) + 1 : 1;

    const newRecord = {
        id: newId,
        userId: currentUser.id,
        userName: currentUser.fullName,
        date: today,
        clockIn: now.toISOString(),
        clockOut: null,
        siteName: siteName,
        notes: notes,
        breakTimes: []
    };

    records.push(newRecord);
    localStorage.setItem('attendanceRecords', JSON.stringify(records));

    // 現場履歴に追加
    saveSiteHistory(siteName);
    
    // UI更新
    checkTodayAttendance();
    loadRecentRecords();
    
    alert('出勤を記録しました');
}

/**
 * 退勤処理
 * 今日の勤怠記録に退勤時間を記録する
 */
function clockOut() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const today = new Date().toISOString().split('T')[0];
    const records = getAttendanceRecords();

    const recordIndex = records.findIndex(record =>
        record.userId === currentUser.id &&
        record.date === today &&
        record.clockIn &&
        !record.clockOut
    );

    if (recordIndex === -1) {
        alert('出勤記録が見つかりません。');
        return;
    }

    // 休憩中かどうかを確認
    const isOnBreak = records[recordIndex].breakTimes && 
                    records[recordIndex].breakTimes.some(breakTime => breakTime.start && !breakTime.end);
    
    if (isOnBreak) {
        alert('休憩中は退勤できません。先に休憩を終了してください。');
        return;
    }

    const notes = getElement('work-notes')?.value || '';
    if (notes) {
        records[recordIndex].notes = notes;
    }

    records[recordIndex].clockOut = new Date().toISOString();

    localStorage.setItem('attendanceRecords', JSON.stringify(records));

    // UI更新
    checkTodayAttendance();
    loadRecentRecords();
    
    alert('退勤を記録しました');
}

/**
 * 休憩開始処理
 * 今日の勤怠記録に休憩開始時間を追加する
 */
function startBreak() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const today = new Date().toISOString().split('T')[0];
    const records = getAttendanceRecords();

    const recordIndex = records.findIndex(record =>
        record.userId === currentUser.id &&
        record.date === today &&
        record.clockIn &&
        !record.clockOut
    );

    if (recordIndex === -1) {
        alert('出勤記録が見つかりません。');
        return;
    }

    // 既に休憩中かチェック
    const isOnBreak = records[recordIndex].breakTimes && 
                    records[recordIndex].breakTimes.some(breakTime => breakTime.start && !breakTime.end);
    
    if (isOnBreak) {
        alert('既に休憩中です。');
        return;
    }

    // 休憩時間を追加
    if (!records[recordIndex].breakTimes) {
        records[recordIndex].breakTimes = [];
    }
    
    records[recordIndex].breakTimes.push({
        start: new Date().toISOString(),
        end: null
    });

    localStorage.setItem('attendanceRecords', JSON.stringify(records));

    // UI更新
    checkTodayAttendance();
    
    alert('休憩を開始しました');
}

/**
 * 休憩終了処理
 * 今日の勤怠記録の最後の休憩に終了時間を設定する
 */
function endBreak() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const today = new Date().toISOString().split('T')[0];
    const records = getAttendanceRecords();

    const recordIndex = records.findIndex(record =>
        record.userId === currentUser.id &&
        record.date === today &&
        record.clockIn &&
        !record.clockOut
    );

    if (recordIndex === -1) {
        alert('出勤記録が見つかりません。');
        return;
    }

    // 休憩中かチェック
    const breakTimes = records[recordIndex].breakTimes || [];
    const currentBreakIndex = breakTimes.findIndex(breakTime => breakTime.start && !breakTime.end);
    
    if (currentBreakIndex === -1) {
        alert('休憩を開始していません。');
        return;
    }

    // 休憩終了時間を設定
    records[recordIndex].breakTimes[currentBreakIndex].end = new Date().toISOString();

    localStorage.setItem('attendanceRecords', JSON.stringify(records));

    // UI更新
    checkTodayAttendance();
    
    alert('休憩を終了しました');
}

/**
 * 現場履歴を保存
 * 選択された現場名を履歴に追加する
 * 
 * @param {string} siteName 現場名
 */
function saveSiteHistory(siteName) {
    if (!siteName) return;
    
    // 既定の現場を除外
    const defaultSites = [
        "新宿オフィスビル改修工事",
        "渋谷マンション建設現場",
        "横浜倉庫補修工事"
    ];
    
    if (defaultSites.includes(siteName)) return;
    
    let history = JSON.parse(localStorage.getItem("siteHistory") || "[]");
    if (!history.includes(siteName)) {
        history.push(siteName);
        localStorage.setItem("siteHistory", JSON.stringify(history));
    }
}

/**
 * プルダウンに現場履歴を反映
 * 保存された現場履歴をセレクトボックスに追加する
 */
function populateSiteOptions() {
    const select = getElement("site-name");
    if (!select) return;
    
    const current = select.value;
    const history = JSON.parse(localStorage.getItem("siteHistory") || "[]");

    // 一旦クリア
    select.innerHTML = "";
    
    // デフォルトオプション
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "現場を選択してください";
    select.appendChild(defaultOption);

    // 定義済みのオプション
    const predefinedOptions = [
        "新宿オフィスビル改修工事",
        "渋谷マンション建設現場",
        "横浜倉庫補修工事"
    ];

    // 定義済みオプションを追加
    predefinedOptions.forEach(site => {
        const option = document.createElement("option");
        option.value = site;
        option.textContent = site;
        select.appendChild(option);
    });

    // 履歴を追加
    history.forEach(site => {
        const option = document.createElement("option");
        option.value = site;
        option.textContent = site;
        select.appendChild(option);
    });

    // その他オプション
    const otherOption = document.createElement("option");
    otherOption.value = "other";
    otherOption.textContent = "その他（直接入力）";
    select.appendChild(otherOption);

    // 現在選択を復元（なければデフォルト）
    select.value = current || "";
}

/**
 * 直近の記録を表示
 * 現在のユーザーの最近の勤怠記録を表示する
 */
function loadRecentRecords() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const attendance = getAttendanceRecords();
    
    // 現在のユーザーの記録を直近5件取得
    const userRecords = attendance
        .filter(record => record.userId === currentUser.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
    
    const recentList = getElement('recent-list');
    if (!recentList) return;
    
    recentList.innerHTML = '';
    
    if (userRecords.length === 0) {
        recentList.innerHTML = '<div class="no-records">記録がありません</div>';
        return;
    }
    
    userRecords.forEach(record => {
        const recordDiv = document.createElement('div');
        recordDiv.className = 'record-item';
        
        const dateObj = new Date(record.date);
        const dateStr = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
        
        let breakTimeStr = '';
        let totalTimeStr = '';
        
        if (record.clockIn && record.clockOut) {
            const breakTime = calculateTotalBreakTime(record.breakTimes);
            const workTime = calculateWorkingTime(
                record.clockIn, 
                record.clockOut,
                record.breakTimes
            );
            
            breakTimeStr = `
                <div class="record-break-info">休憩: ${breakTime.formatted}</div>
            `;
            
            totalTimeStr = `
                <div class="record-total-time">実労働: ${workTime.formatted}</div>
            `;
        }
        
        recordDiv.innerHTML = `
            <div class="record-date">${dateStr} (${formatDate(record.date)})</div>
            <div class="record-site">${record.siteName}</div>
            <div class="record-time">
                ${record.clockIn ? formatTime(record.clockIn) : '-'} 〜 
                ${record.clockOut ? formatTime(record.clockOut) : '勤務中'}
            </div>
            ${breakTimeStr}
            ${totalTimeStr}
        `;
        
        recentList.appendChild(recordDiv);
    });
}

// DOMが読み込まれた時に従業員ページを初期化（ユーザーが従業員の場合）
document.addEventListener('DOMContentLoaded', function() {
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.role === 'employee') {
        showPage('employee');
        initEmployeePage();
    }
});
