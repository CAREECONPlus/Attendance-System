/**
 * employee.js - 時間表示修正版
 */

console.log('employee.js 読み込み開始');

// グローバル変数
let dateTimeInterval = null;

/**
 * 従業員画面の初期化処理
 */
async function initEmployeePage() {
    console.log('従業員ページの初期化開始');
    
    try {
        // 基本的なUI初期化
        setupEmployeeBasics();
        
        // 現在の日時を表示
        updateDateTime();
        
        // 1秒ごとに時刻を更新
        if (dateTimeInterval) {
            clearInterval(dateTimeInterval);
        }
        dateTimeInterval = setInterval(updateDateTime, 1000);
        
        // 勤怠状況の確認
        await checkTodayAttendance();
        
        // 最近の記録を表示
        await loadRecentRecords();
        
        // イベントハンドラを設定
        setupEmployeeEvents();
        
        // 現場オプションの読み込み
        await populateSiteOptions();
        
        console.log('従業員ページの初期化完了');
    } catch (error) {
        console.error('従業員ページ初期化エラー:', error);
        showError('従業員画面の初期化に失敗しました');
    }
}

/**
 * 基本的なUI初期化
 */
function setupEmployeeBasics() {
    // ユーザー名を表示
    const currentUser = firebase.auth().currentUser;
    if (currentUser) {
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) {
            userNameEl.textContent = currentUser.displayName || currentUser.email;
            console.log('ユーザー名表示:', currentUser.displayName);
        }
    }
    
    // ログアウトボタン
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleEmployeeLogout);
    }
}

/**
 * 現在時刻の表示と更新
 */
function updateDateTime() {
    const now = new Date();
    
    // 日付の表示
    const dateOptions = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        weekday: 'long' 
    };
    
    // 時刻の表示
    const timeOptions = { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
    };
    
    const dateEl = document.getElementById('current-date');
    const timeEl = document.getElementById('current-time');
    
    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('ja-JP', dateOptions);
    } else {
        console.warn('current-date 要素が見つかりません');
    }
    
    if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('ja-JP', timeOptions);
    } else {
        console.warn('current-time 要素が見つかりません');
    }
}

/**
 * イベントハンドラの設定
 */
function setupEmployeeEvents() {
    console.log('従業員イベント設定開始');
    
    // 出勤ボタン
    const clockInBtn = document.getElementById('clock-in-btn');
    if (clockInBtn) {
        clockInBtn.addEventListener('click', clockIn);
    }
    
    // 退勤ボタン
    const clockOutBtn = document.getElementById('clock-out-btn');
    if (clockOutBtn) {
        clockOutBtn.addEventListener('click', clockOut);
    }
    
    // 休憩開始ボタン
    const breakStartBtn = document.getElementById('break-start-btn');
    if (breakStartBtn) {
        breakStartBtn.addEventListener('click', startBreak);
    }
    
    // 休憩終了ボタン
    const breakEndBtn = document.getElementById('break-end-btn');
    if (breakEndBtn) {
        breakEndBtn.addEventListener('click', endBreak);
    }
    
    // 現場選択の切り替え
    const siteSelect = document.getElementById('site-name');
    const otherSite = document.getElementById('other-site');
    
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
 * 従業員ログアウト処理
 */
async function handleEmployeeLogout() {
    console.log('従業員ログアウト開始');
    
    try {
        // setIntervalをクリア
        if (dateTimeInterval) {
            clearInterval(dateTimeInterval);
        }
        
        await firebase.auth().signOut();
        console.log('ログアウト成功');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('ログアウトエラー:', error);
        showError('ログアウトに失敗しました');
    }
}

/**
 * 勤務状況をチェック
 */
async function checkTodayAttendance() {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
        console.log('currentUser が取得できません');
        return;
    }

    console.log('勤務状況チェック開始:', currentUser.email);

    try {
        const today = new Date().toISOString().split('T')[0];
        console.log('今日の日付:', today);
        
        // 今日の記録を検索
        const query = await db.collection('attendance')
            .where('userId', '==', currentUser.uid)
            .where('date', '==', today)
            .limit(1)
            .get();

        const clockInBtn = document.getElementById('clock-in-btn');
        const clockOutBtn = document.getElementById('clock-out-btn');
        const breakStartBtn = document.getElementById('break-start-btn');
        const breakEndBtn = document.getElementById('break-end-btn');
        const clockStatus = document.getElementById('clock-status');

        // すべてのボタンのクラスをリセット
        [clockInBtn, clockOutBtn, breakStartBtn, breakEndBtn].forEach(btn => {
            if (btn) {
                btn.disabled = true;
                btn.classList.remove('btn-primary', 'btn-secondary', 'btn-warning', 'available', 'current-action');
            }
        });

        // デフォルトのクラスを設定
        if (clockInBtn) clockInBtn.classList.add('btn-secondary');
        if (clockOutBtn) clockOutBtn.classList.add('btn-secondary');
        if (breakStartBtn) breakStartBtn.classList.add('btn-warning');
        if (breakEndBtn) breakEndBtn.classList.add('btn-warning');

        if (query.empty) {
            console.log('今日の記録なし - 未出勤状態');
            // 未出勤 - 出勤ボタンを有効化・強調
            if (clockStatus) {
                clockStatus.innerHTML = `
                    <div class="status-waiting">おはようございます！<br>出勤ボタンを押してください</div>
                `;
            }
            if (clockInBtn) {
                clockInBtn.disabled = false;
                clockInBtn.classList.remove('btn-secondary');
                clockInBtn.classList.add('btn-primary', 'available');
            }
            return;
        }

        const todayRecord = query.docs[0];
        const attendanceData = { id: todayRecord.id, ...todayRecord.data() };
        console.log('今日の記録:', attendanceData);

        // 休憩データを取得
        const breakQuery = await db.collection('breaks')
            .where('attendanceId', '==', attendanceData.id)
            .where('endTime', '==', null)
            .get();

        const isOnBreak = !breakQuery.empty;

        if (attendanceData.clockInTime && !attendanceData.clockOutTime) {
            // 出勤済み・退勤前
            if (isOnBreak) {
                // 休憩中
                const currentBreak = breakQuery.docs[0].data();
                const breakStart = formatTime(currentBreak.startTime.toDate());
                
                if (clockStatus) {
                    clockStatus.innerHTML = `
                        <div class="status-break">現在休憩中です</div>
                        <div class="status-detail">出勤: ${formatTime(attendanceData.clockInTime.toDate())}</div>
                        <div class="status-detail">休憩開始: ${breakStart}</div>
                    `;
                }
                
                // 出勤ボタン：完了状態
                if (clockInBtn) {
                    clockInBtn.classList.add('current-action');
                    clockInBtn.textContent = '出勤済み';
                }
                
                // 休憩終了ボタンを有効化・強調
                if (breakEndBtn) {
                    breakEndBtn.disabled = false;
                    breakEndBtn.classList.add('available');
                }
            } else {
                // 勤務中
                if (clockStatus) {
                    clockStatus.innerHTML = `
                        <div class="status-working">現在勤務中です</div>
                        <div class="status-detail">出勤: ${formatTime(attendanceData.clockInTime.toDate())}</div>
                    `;
                }
                
                // 出勤ボタン：完了状態
                if (clockInBtn) {
                    clockInBtn.classList.add('current-action');
                    clockInBtn.textContent = '出勤済み';
                }
                
                // 退勤ボタンを有効化・強調
                if (clockOutBtn) {
                    clockOutBtn.disabled = false;
                    clockOutBtn.classList.remove('btn-secondary');
                    clockOutBtn.classList.add('btn-primary', 'available');
                }
                
                // 休憩開始ボタンを有効化
                if (breakStartBtn) {
                    breakStartBtn.disabled = false;
                }
            }
        } else if (attendanceData.clockInTime && attendanceData.clockOutTime) {
            // 出退勤済み
            if (clockStatus) {
                // 休憩時間を取得して合計
                const allBreaksQuery = await db.collection('breaks')
                    .where('attendanceId', '==', attendanceData.id)
                    .get();
                
                const breakTimes = allBreaksQuery.docs.map(doc => {
                    const breakData = doc.data();
                    return {
                        start: breakData.startTime?.toDate()?.toISOString(),
                        end: breakData.endTime?.toDate()?.toISOString()
                    };
                });

                const breakTime = calculateTotalBreakTime(breakTimes);
                const workTime = calculateWorkingTime(
                    attendanceData.clockInTime.toDate().toISOString(),
                    attendanceData.clockOutTime.toDate().toISOString(),
                    breakTimes
                );
                
                clockStatus.innerHTML = `
                    <div class="status-complete">本日の勤務は完了しています</div>
                    <div class="status-detail">出勤: ${formatTime(attendanceData.clockInTime.toDate())}</div>
                    <div class="status-detail">退勤: ${formatTime(attendanceData.clockOutTime.toDate())}</div>
                    <div class="status-detail">休憩: ${breakTime.formatted}</div>
                    <div class="status-detail">実労働: ${workTime.formatted}</div>
                `;
            }
            
            // 両方のボタンを完了状態に
            if (clockInBtn) {
                clockInBtn.classList.add('current-action');
                clockInBtn.textContent = '出勤済み';
            }
            if (clockOutBtn) {
                clockOutBtn.classList.add('current-action');
                clockOutBtn.textContent = '退勤済み';
            }
        }
    } catch (error) {
        console.error('勤怠状況チェックエラー:', error);
        showError('勤怠状況の確認に失敗しました');
        
        // エラー時は出勤ボタンのみ有効化
        const clockInBtn = document.getElementById('clock-in-btn');
        if (clockInBtn) {
            clockInBtn.disabled = false;
            clockInBtn.classList.add('btn-primary', 'available');
        }
    }
}

/**
 * 出勤処理
 */
async function clockIn() {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return;

    const siteSelect = document.getElementById('site-name');
    let siteName = siteSelect?.value || '';

    if (siteName === 'other') {
        siteName = document.getElementById('other-site')?.value || '';
    }

    if (!siteName) {
        showError('現場名を選択または入力してください');
        return;
    }

    const notes = document.getElementById('work-notes')?.value || '';
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    try {
        const clockInBtn = document.getElementById('clock-in-btn');
        if (clockInBtn) {
            clockInBtn.disabled = true;
            clockInBtn.textContent = '処理中...';
            clockInBtn.classList.remove('available');
        }

        // 今日の記録が既に存在するかチェック
        const existingQuery = await db.collection('attendance')
            .where('userId', '==', currentUser.uid)
            .where('date', '==', today)
            .get();

        if (!existingQuery.empty) {
            showError('今日は既に出勤済みです');
            return;
        }

        const newRecord = {
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email,
            date: today,
            clockInTime: firebase.firestore.Timestamp.fromDate(now),
            clockOutTime: null,
            siteName: siteName,
            notes: notes,
            status: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('attendance').add(newRecord);

        // 現場履歴に追加
        await saveSiteHistory(siteName);
        
        // UI更新
        await checkTodayAttendance();
        await loadRecentRecords();
        
        showSuccess('出勤を記録しました');
        console.log('出勤記録完了');
    } catch (error) {
        console.error('出勤エラー:', error);
        showError('出勤の記録に失敗しました');
    } finally {
        const clockInBtn = document.getElementById('clock-in-btn');
        if (clockInBtn && clockInBtn.textContent === '処理中...') {
            clockInBtn.textContent = '出勤';
            clockInBtn.disabled = false;
            clockInBtn.classList.add('available');
        }
    }
}

/**
 * 退勤処理
 */
async function clockOut() {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return;

    const today = new Date().toISOString().split('T')[0];

    try {
        const clockOutBtn = document.getElementById('clock-out-btn');
        if (clockOutBtn) {
            clockOutBtn.disabled = true;
            clockOutBtn.textContent = '処理中...';
        }

        // 今日の勤怠記録を取得
        const query = await db.collection('attendance')
            .where('userId', '==', currentUser.uid)
            .where('date', '==', today)
            .where('clockOutTime', '==', null)
            .limit(1)
            .get();

        if (query.empty) {
            showError('出勤記録が見つかりません');
            return;
        }

        const attendanceDoc = query.docs[0];
        const attendanceId = attendanceDoc.id;

        // 休憩中かどうかを確認
        const breakQuery = await db.collection('breaks')
            .where('attendanceId', '==', attendanceId)
            .where('endTime', '==', null)
            .get();

        if (!breakQuery.empty) {
            showError('休憩中は退勤できません。先に休憩を終了してください。');
            return;
        }

        const notes = document.getElementById('work-notes')?.value || '';
        const now = new Date();
        const attendanceData = attendanceDoc.data();

        // 総労働時間の計算
        const clockInTime = attendanceData.clockInTime.toDate();
        const totalMinutes = Math.floor((now - clockInTime) / (1000 * 60));

        const updateData = {
            clockOutTime: firebase.firestore.Timestamp.fromDate(now),
            status: 'completed',
            totalWorkTime: totalMinutes,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (notes) {
            updateData.notes = notes;
        }

        await attendanceDoc.ref.update(updateData);

        // UI更新
        await checkTodayAttendance();
        await loadRecentRecords();
        
        showSuccess('退勤を記録しました');
        console.log('退勤記録完了');
    } catch (error) {
        console.error('退勤エラー:', error);
        showError('退勤の記録に失敗しました');
    } finally {
        const clockOutBtn = document.getElementById('clock-out-btn');
        if (clockOutBtn) {
            clockOutBtn.disabled = false;
            clockOutBtn.textContent = '退勤';
        }
    }
}

/**
 * 休憩開始処理
 */
async function startBreak() {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return;

    const today = new Date().toISOString().split('T')[0];

    try {
        const breakStartBtn = document.getElementById('break-start-btn');
        if (breakStartBtn) {
            breakStartBtn.disabled = true;
            breakStartBtn.textContent = '処理中...';
        }

        // 今日の勤怠記録を取得
        const query = await db.collection('attendance')
            .where('userId', '==', currentUser.uid)
            .where('date', '==', today)
            .where('clockOutTime', '==', null)
            .limit(1)
            .get();

        if (query.empty) {
            showError('出勤記録が見つかりません');
            return;
        }

        const attendanceDoc = query.docs[0];
        const attendanceId = attendanceDoc.id;

        // 既に休憩中かチェック
        const breakQuery = await db.collection('breaks')
            .where('attendanceId', '==', attendanceId)
            .where('endTime', '==', null)
            .get();

        if (!breakQuery.empty) {
            showError('既に休憩中です');
            return;
        }

        // 休憩記録を追加
        const now = new Date();
        const breakData = {
            attendanceId: attendanceId,
            userId: currentUser.uid,
            startTime: firebase.firestore.Timestamp.fromDate(now),
            endTime: null,
            duration: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('breaks').add(breakData);

        // UI更新
        await checkTodayAttendance();
        
        showSuccess('休憩を開始しました');
        console.log('休憩開始記録完了');
    } catch (error) {
        console.error('休憩開始エラー:', error);
        showError('休憩開始の記録に失敗しました');
    } finally {
        const breakStartBtn = document.getElementById('break-start-btn');
        if (breakStartBtn) {
            breakStartBtn.disabled = false;
            breakStartBtn.textContent = '休憩開始';
        }
    }
}

/**
 * 休憩終了処理
 */
async function endBreak() {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return;

    const today = new Date().toISOString().split('T')[0];

    try {
        const breakEndBtn = document.getElementById('break-end-btn');
        if (breakEndBtn) {
            breakEndBtn.disabled = true;
            breakEndBtn.textContent = '処理中...';
        }

        // 今日の勤怠記録を取得
        const query = await db.collection('attendance')
            .where('userId', '==', currentUser.uid)
            .where('date', '==', today)
            .where('clockOutTime', '==', null)
            .limit(1)
            .get();

        if (query.empty) {
            showError('出勤記録が見つかりません');
            return;
        }

        const attendanceDoc = query.docs[0];
        const attendanceId = attendanceDoc.id;

        // 現在の休憩記録を取得
        const breakQuery = await db.collection('breaks')
            .where('attendanceId', '==', attendanceId)
            .where('endTime', '==', null)
            .get();

        if (breakQuery.empty) {
            showError('休憩を開始していません');
            return;
        }

        const breakDoc = breakQuery.docs[0];
        const breakData = breakDoc.data();
        const now = new Date();
        const startTime = breakData.startTime.toDate();
        const duration = Math.floor((now - startTime) / (1000 * 60));

        // 休憩記録を更新
        await breakDoc.ref.update({
            endTime: firebase.firestore.Timestamp.fromDate(now),
            duration: duration,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // UI更新
        await checkTodayAttendance();
        
        showSuccess('休憩を終了しました');
        console.log('休憩終了記録完了');
    } catch (error) {
        console.error('休憩終了エラー:', error);
        showError('休憩終了の記録に失敗しました');
    } finally {
        const breakEndBtn = document.getElementById('break-end-btn');
        if (breakEndBtn) {
            breakEndBtn.disabled = false;
            breakEndBtn.textContent = '休憩終了';
        }
    }
}

/**
 * 現場履歴を保存
 */
async function saveSiteHistory(siteName) {
    if (!siteName) return;
    
    const defaultSites = [
        "新宿オフィスビル改修工事",
        "渋谷マンション建設現場",
        "横浜倉庫補修工事"
    ];
    
    if (defaultSites.includes(siteName)) return;
    
    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) return;

        const userRef = db.collection('users').doc(currentUser.uid);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            const currentHistory = userData.siteHistory || [];
            
            if (!currentHistory.includes(siteName)) {
                await userRef.update({
                    siteHistory: firebase.firestore.FieldValue.arrayUnion(siteName),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('現場履歴に追加:', siteName);
            }
        }
    } catch (error) {
        console.error('現場履歴保存エラー:', error);
    }
}

/**
 * 現場選択肢の設定
 */
async function populateSiteOptions() {
    const select = document.getElementById("site-name");
    if (!select) return;
    
    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) return;

        const current = select.value;
        
        // ユーザーの現場履歴を取得
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const siteHistory = userDoc.exists ? (userDoc.data().siteHistory || []) : [];

        // 一旦クリア
        select.innerHTML = "";
        
        // デフォルトオプション
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "現場を選択してください";
        select.appendChild(defaultOption);

        // 定義済みオプション
        const predefinedOptions = [
            "新宿オフィスビル改修工事",
            "渋谷マンション建設現場",
            "横浜倉庫補修工事"
        ];

        predefinedOptions.forEach(site => {
            const option = document.createElement("option");
            option.value = site;
            option.textContent = site;
            select.appendChild(option);
        });

        // 履歴を追加
        siteHistory.forEach(site => {
            if (!predefinedOptions.includes(site)) {
                const option = document.createElement("option");
                option.value = site;
                option.textContent = site;
                select.appendChild(option);
            }
        });

        // その他オプション
        const otherOption = document.createElement("option");
        otherOption.value = "other";
        otherOption.textContent = "その他（直接入力）";
        select.appendChild(otherOption);

        // 現在選択を復元
        select.value = current || "";
    } catch (error) {
        console.error('現場選択肢読み込みエラー:', error);
    }
}

/**
 * 最近の記録を表示
 */
async function loadRecentRecords() {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return;

    try {
        const querySnapshot = await db.collection('attendance')
            .where('userId', '==', currentUser.uid)
            .orderBy('date', 'desc')
            .limit(5)
            .get();
        
        const recentList = document.getElementById('recent-list');
        if (!recentList) return;
        
        recentList.innerHTML = '';
        
        if (querySnapshot.empty) {
            recentList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <div class="empty-state-message">まだ記録がありません</div>
                    <div class="empty-state-submessage">出勤ボタンを押して記録を開始しましょう</div>
                </div>
            `;
            return;
        }
        
        // 各記録について詳細情報を取得
        for (const doc of querySnapshot.docs) {
            const record = { id: doc.id, ...doc.data() };
            
            // 休憩データを取得
            const breakQuery = await db.collection('breaks')
                .where('attendanceId', '==', record.id)
                .get();
            
            const breakTimes = breakQuery.docs.map(breakDoc => {
                const breakData = breakDoc.data();
                return {
                    start: breakData.startTime?.toDate()?.toISOString(),
                    end: breakData.endTime?.toDate()?.toISOString()
                };
            });
            
            const recordDiv = document.createElement('div');
            recordDiv.className = 'record-item';
            
            const dateObj = new Date(record.date);
            const dateStr = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
            
            let breakTimeStr = '';
            let totalTimeStr = '';
            
            if (record.clockInTime && record.clockOutTime) {
                const breakTime = calculateTotalBreakTime(breakTimes);
                const workTime = calculateWorkingTime(
                    record.clockInTime.toDate().toISOString(),
                    record.clockOutTime.toDate().toISOString(),
                    breakTimes
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
                    ${record.clockInTime ? formatTime(record.clockInTime.toDate()) : '-'} 〜 
                    ${record.clockOutTime ? formatTime(record.clockOutTime.toDate()) : '勤務中'}
                </div>
                ${breakTimeStr}
                ${totalTimeStr}
            `;
            
            recentList.appendChild(recordDiv);
        }
        
        console.log('最近の記録を表示完了');
    } catch (error) {
        console.error('最近の記録読み込みエラー:', error);
        
        const recentList = document.getElementById('recent-list');
        if (recentList) {
            recentList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <div class="empty-state-message">記録の読み込み中にエラーが発生しました</div>
                    <div class="empty-state-submessage">ページを再読み込みしてください</div>
                </div>
            `;
        }
    }
}

// ユーティリティ関数
function formatTime(date) {
    if (!date) return '-';
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP');
}

function calculateTotalBreakTime(breakTimes) {
    if (!breakTimes || !Array.isArray(breakTimes) || breakTimes.length === 0) {
        return { hours: 0, minutes: 0, totalMinutes: 0, formatted: '0時間0分' };
    }
    
    let totalMinutes = 0;
    
    breakTimes.forEach(breakTime => {
        if (breakTime.start && breakTime.end) {
            const start = new Date(breakTime.start);
            const end = new Date(breakTime.end);
            const diff = Math.floor((end - start) / (1000 * 60));
            totalMinutes += diff;
        }
    });
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return {
        hours: hours,
        minutes: minutes,
        totalMinutes: totalMinutes,
        formatted: `${hours}時間${minutes}分`
    };
}

function calculateWorkingTime(clockIn, clockOut, breakTimes) {
    if (!clockIn || !clockOut) {
        return { hours: 0, minutes: 0, totalMinutes: 0, formatted: '-' };
    }
    
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    const totalMinutes = Math.floor((end - start) / (1000 * 60));
    
    const breakTime = calculateTotalBreakTime(breakTimes);
    const workingMinutes = Math.max(0, totalMinutes - breakTime.totalMinutes);
    
    if (workingMinutes <= 0) {
        return { hours: 0, minutes: 0, totalMinutes: 0, formatted: '0時間0分' };
    }
    
    const workingHours = Math.floor(workingMinutes / 60);
    const workingMins = workingMinutes % 60;
    
    return {
        hours: workingHours,
        minutes: workingMins,
        totalMinutes: workingMinutes,
        formatted: `${workingHours}時間${workingMins}分`
    };
}

function showError(message) {
    console.error(message);
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function showSuccess(message) {
    console.log(message);
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

console.log('employee.js 読み込み完了');
