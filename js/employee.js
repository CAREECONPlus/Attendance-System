// employee.js - 従業員ページの機能（完全版 - 1日1回制限対応）

console.log('employee.js loading...');

// 現在のユーザー情報とグローバル変数
let currentUser = null;
let currentAttendanceId = null;
let todayAttendanceData = null;
let dailyLimitProcessing = false;

// 従業員ページの初期化
function initEmployeePage() {
    console.log('🚀 従業員ページ初期化開始（完全版）');
    
    // Firebase認証状態の監視
    firebase.auth().onAuthStateChanged(async function(user) {
        if (user) {
            console.log('✅ ユーザー認証確認:', user.email);
            currentUser = user;
            
            try {
                // ユーザー名を表示
                displayUserName();
                
                // 現在時刻の表示を開始
                updateCurrentTime();
                setInterval(updateCurrentTime, 1000);
                
                // イベントリスナーの設定
                setupEmployeeEventListeners();
                
                // 現場選択の設定
                setupSiteSelection();
                
                // 今日の勤怠状態を復元
                await restoreTodayAttendanceState();
                
                // 最近の記録を読み込み（遅延実行）
                setTimeout(() => {
                    loadRecentRecordsSafely();
                }, 1000);
                
                console.log('✅ 従業員ページ初期化完了');
                
            } catch (error) {
                console.error('❌ 初期化エラー:', error);
                showErrorMessage('ページの初期化でエラーが発生しました');
            }
        } else {
            console.log('❌ ユーザー未認証');
            showPage('login');
        }
    });
}

// 今日の勤怠状態を復元
async function restoreTodayAttendanceState() {
    console.log('🔄 今日の勤怠状態を復元中...');
    
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const query = firebase.firestore()
            .collection('attendance')
            .where('userId', '==', currentUser.uid)
            .where('date', '==', today);
        
        const snapshot = await query.get();
        
        if (!snapshot.empty) {
            const recordData = snapshot.docs[0].data();
            todayAttendanceData = {
                id: snapshot.docs[0].id,
                ...recordData
            };
            currentAttendanceId = snapshot.docs[0].id;
            
            console.log('📋 今日の勤怠記録を発見:', todayAttendanceData);
            
            // 現在の状態に応じてUIを更新
            await restoreCurrentState(recordData);
        } else {
            console.log('📋 今日の勤怠記録なし - 出勤待ち状態');
            updateClockButtons('waiting');
        }
    } catch (error) {
        console.error('❌ 勤怠状態復元エラー:', error);
        updateClockButtons('waiting');
    }
}

// 現在の状態を復元
async function restoreCurrentState(recordData) {
    console.log('🔄 現在の状態を復元中...', recordData);
    
    try {
        // 勤務完了チェック
        if (recordData.endTime || recordData.status === 'completed') {
            console.log('✅ 勤務完了状態を復元');
            updateClockButtons('completed');
            updateStatusDisplay('completed', recordData);
            return;
        }
        
        // 休憩中かどうかチェック
        const breakQuery = firebase.firestore()
            .collection('breaks')
            .where('attendanceId', '==', currentAttendanceId)
            .where('userId', '==', currentUser.uid);
        
        const breakSnapshot = await breakQuery.get();
        
        // アクティブな休憩を検索
        let activeBreakData = null;
        breakSnapshot.docs.forEach(doc => {
            const breakData = doc.data();
            if (!breakData.endTime) {
                activeBreakData = breakData;
            }
        });
        
        if (activeBreakData) {
            console.log('⏸️ 休憩中状態を復元');
            updateClockButtons('break');
            updateStatusDisplay('break', recordData, activeBreakData);
        } else {
            console.log('💼 勤務中状態を復元');
            updateClockButtons('working');
            updateStatusDisplay('working', recordData);
        }
        
    } catch (error) {
        console.error('❌ 状態復元エラー:', error);
        updateClockButtons('working');
        updateStatusDisplay('working', recordData);
    }
}

// 1日1回制限チェック
async function checkDailyLimit(userId) {
    console.log('🔍 1日1回制限チェック開始');
    
    const today = new Date().toISOString().split('T')[0];
    console.log('📅 今日の日付:', today);
    
    try {
        // メモリ内チェック（高速）
        if (todayAttendanceData && todayAttendanceData.date === today) {
            console.log('🚫 メモリに既存の今日の記録があります:', todayAttendanceData);
            
            const message = `❌ 今日は既に出勤済みです！\n\n` +
                          `📋 出勤情報:\n` +
                          `• 出勤時間: ${todayAttendanceData.startTime || '不明'}\n` +
                          `• 現場: ${todayAttendanceData.siteName || '不明'}\n` +
                          `• 状態: ${getStatusText(todayAttendanceData.status)}\n\n` +
                          `🔒 1日1回のみ出勤可能です。`;
            
            alert(message);
            await restoreCurrentState(todayAttendanceData);
            return false;
        }
        
        // データベースチェック
        const query = firebase.firestore()
            .collection('attendance')
            .where('userId', '==', userId)
            .where('date', '==', today);
        
        const snapshot = await query.get();
        
        console.log('📊 データベースクエリ結果:', {
            isEmpty: snapshot.empty,
            size: snapshot.size
        });
        
        if (!snapshot.empty) {
            const existingRecord = snapshot.docs[0].data();
            console.log('❌ データベースに既存の出勤記録発見:', existingRecord);
            
            // グローバル変数を更新
            todayAttendanceData = {
                id: snapshot.docs[0].id,
                ...existingRecord
            };
            currentAttendanceId = snapshot.docs[0].id;
            
            const message = `❌ 今日は既に出勤済みです！\n\n` +
                          `📋 出勤情報:\n` +
                          `• 出勤時間: ${existingRecord.startTime || '不明'}\n` +
                          `• 現場: ${existingRecord.siteName || '不明'}\n` +
                          `• 状態: ${getStatusText(existingRecord.status)}\n\n` +
                          `🔒 1日1回のみ出勤可能です。`;
            
            alert(message);
            await restoreCurrentState(existingRecord);
            return false;
        }
        
        console.log('✅ 今日の出勤記録なし - 出勤可能');
        return true;
        
    } catch (error) {
        console.error('❌ 1日1回制限チェックエラー:', error);
        alert('出勤チェック中にエラーが発生しました。\n管理者にお問い合わせください。');
        return false;
    }
}

// 状態テキスト変換
function getStatusText(status) {
    const statusMap = {
        'working': '勤務中',
        'break': '休憩中', 
        'completed': '勤務完了',
        'pending': '処理中'
    };
    return statusMap[status] || '不明';
}

// ユーザー名の表示
function displayUserName() {
    const userNameElement = document.getElementById('user-name');
    if (userNameElement && currentUser) {
        userNameElement.textContent = currentUser.email || 'ユーザー';
    }
}

// 現在時刻の更新
function updateCurrentTime() {
    const now = new Date();
    
    const dateElement = document.getElementById('current-date');
    const timeElement = document.getElementById('current-time');
    
    if (dateElement) {
        dateElement.textContent = now.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
    }
    
    if (timeElement) {
        timeElement.textContent = now.toLocaleTimeString('ja-JP');
    }
}

// イベントリスナーの設定
function setupEmployeeEventListeners() {
    console.log('🔘 イベントリスナーを設定中...');
    
    const clockInBtn = document.getElementById('clock-in-btn');
    const clockOutBtn = document.getElementById('clock-out-btn');
    const breakStartBtn = document.getElementById('break-start-btn');
    const breakEndBtn = document.getElementById('break-end-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (clockInBtn) clockInBtn.addEventListener('click', handleClockIn);
    if (clockOutBtn) clockOutBtn.addEventListener('click', handleClockOut);
    if (breakStartBtn) breakStartBtn.addEventListener('click', handleBreakStart);
    if (breakEndBtn) breakEndBtn.addEventListener('click', handleBreakEnd);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    
    console.log('✅ イベントリスナー設定完了');
}

// 現場選択の設定
function setupSiteSelection() {
    const siteSelect = document.getElementById('site-name');
    const otherSiteInput = document.getElementById('other-site');
    
    if (siteSelect && otherSiteInput) {
        siteSelect.addEventListener('change', function() {
            if (this.value === 'other') {
                otherSiteInput.style.display = 'block';
                otherSiteInput.required = true;
            } else {
                otherSiteInput.style.display = 'none';
                otherSiteInput.required = false;
                otherSiteInput.value = '';
            }
        });
    }
}

// 現場名取得関数
function getSiteNameFromSelection() {
    const siteNameElement = document.getElementById('site-name');
    const otherSiteElement = document.getElementById('other-site');
    
    if (!siteNameElement) {
        console.error('❌ site-name要素が見つかりません');
        return null;
    }
    
    let siteName = siteNameElement.value;
    
    // 「その他」が選択された場合
    if (siteName === 'other') {
        if (otherSiteElement && otherSiteElement.value.trim()) {
            siteName = otherSiteElement.value.trim();
        } else {
            alert('現場名を入力してください');
            return null;
        }
    }
    
    // 空の値チェック
    if (!siteName || siteName === '') {
        alert('現場を選択してください');
        return null;
    }
    
    console.log('✅ 選択された現場:', siteName);
    return siteName;
}

// 出勤処理（1日1回制限対応）
async function handleClockIn() {
    console.log('🚀 出勤処理開始');
    
    // 二重実行防止
    if (dailyLimitProcessing) {
        console.log('⚠️ 既に処理中です');
        alert('処理中です。しばらくお待ちください。');
        return;
    }
    
    dailyLimitProcessing = true;
    
    // ボタンを即座に無効化
    const clockInBtn = document.getElementById('clock-in-btn');
    const originalText = clockInBtn ? clockInBtn.textContent : '出勤';
    
    if (clockInBtn) {
        clockInBtn.disabled = true;
        clockInBtn.textContent = '処理中...';
        clockInBtn.style.opacity = '0.5';
    }
    
    try {
        if (!currentUser) {
            throw new Error('ユーザーが認証されていません');
        }
        
        // 🚨 重要：1日1回制限チェック
        const canClockIn = await checkDailyLimit(currentUser.uid);
        if (!canClockIn) {
            return; // 出勤不可
        }
        
        // 現場選択チェック
        const siteNameElement = document.getElementById('site-name');
        const otherSiteElement = document.getElementById('other-site');
        const workNotesElement = document.getElementById('work-notes');
        
        const siteName = getSiteNameFromSelection();
        
        if (!siteName) {
            alert('現場を選択してください');
            return;
        }
        
        // 出勤データ作成
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const workNotes = workNotesElement ? workNotesElement.value.trim() : '';
        
        const attendanceData = {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            date: today,
            siteName: siteName,
            startTime: now.toLocaleTimeString('ja-JP'),
            status: 'working',
            notes: workNotes,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        console.log('💾 出勤データ保存中...', attendanceData);
        
        // Firestoreに保存
        const docRef = await firebase.firestore()
            .collection('attendance')
            .add(attendanceData);
        
        console.log('✅ 出勤記録完了:', docRef.id);
        
        // グローバル変数更新
        currentAttendanceId = docRef.id;
        todayAttendanceData = {
            id: docRef.id,
            ...attendanceData,
            createdAt: now,
            updatedAt: now
        };
        
        // UI更新
        updateClockButtons('working');
        updateStatusDisplay('working', todayAttendanceData);
        
        alert(`✅ 出勤しました！\n現場: ${siteName}\n時刻: ${attendanceData.startTime}`);
        
        // フォームをクリア
        if (workNotesElement) workNotesElement.value = '';
        
        // 最近の記録を更新
        loadRecentRecordsSafely();
        
    } catch (error) {
        console.error('❌ 出勤処理エラー:', error);
        alert('出勤処理中にエラーが発生しました。\n' + error.message);
        
        // エラー時はボタンを復元
        if (clockInBtn) {
            clockInBtn.disabled = false;
            clockInBtn.textContent = originalText;
            clockInBtn.style.opacity = '1';
        }
    } finally {
        dailyLimitProcessing = false;
    }
}

// 退勤処理（1日1回制限対応）
async function handleClockOut() {
    console.log('🏠 退勤処理を開始...');
    
    try {
        if (!currentUser || !currentAttendanceId) {
            alert('出勤記録が見つかりません');
            return;
        }
        
        const now = new Date();
        
        const updateData = {
            endTime: now.toLocaleTimeString('ja-JP'),
            status: 'completed',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        console.log('💾 退勤データを更新中...', updateData);
        
        await firebase.firestore()
            .collection('attendance')
            .doc(currentAttendanceId)
            .update(updateData);
        
        console.log('✅ 退勤記録完了');
        
        // グローバル変数更新
        todayAttendanceData = {
            ...todayAttendanceData,
            endTime: now.toLocaleTimeString('ja-JP'),
            status: 'completed'
        };
        
        // UI更新
        updateClockButtons('completed');
        updateStatusDisplay('completed', todayAttendanceData);
        
        alert('お疲れさまでした！');
        
        // 最近の記録を更新
        loadRecentRecordsSafely();
        
    } catch (error) {
        console.error('❌ 退勤エラー:', error);
        alert('退勤記録でエラーが発生しました: ' + error.message);
    }
}

// 休憩開始処理
async function handleBreakStart() {
    console.log('☕ 休憩開始処理...');
    
    try {
        if (!currentUser || !currentAttendanceId) {
            alert('出勤記録が見つかりません');
            return;
        }
        
        // 既存の休憩記録チェック
        const breakQuery = firebase.firestore()
            .collection('breaks')
            .where('attendanceId', '==', currentAttendanceId)
            .where('userId', '==', currentUser.uid);
        
        const breakSnapshot = await breakQuery.get();
        
        // アクティブな休憩があるかチェック
        let hasActiveBreak = false;
        breakSnapshot.docs.forEach(doc => {
            const breakData = doc.data();
            if (!breakData.endTime) {
                hasActiveBreak = true;
            }
        });
        
        if (hasActiveBreak) {
            alert('既に休憩中です');
            return;
        }
        
        const now = new Date();
        
        const breakData = {
            attendanceId: currentAttendanceId,
            userId: currentUser.uid,
            startTime: now.toLocaleTimeString('ja-JP'),
            date: now.toISOString().split('T')[0],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await firebase.firestore()
            .collection('breaks')
            .add(breakData);
        
        // 勤怠記録のステータスを更新
        await firebase.firestore()
            .collection('attendance')
            .doc(currentAttendanceId)
            .update({ 
                status: 'break',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        // グローバル変数更新
        todayAttendanceData.status = 'break';
        
        alert('休憩を開始しました');
        updateClockButtons('break');
        updateStatusDisplay('break', todayAttendanceData, breakData);
        
    } catch (error) {
        console.error('❌ 休憩開始エラー:', error);
        alert('休憩記録でエラーが発生しました: ' + error.message);
    }
}

// 休憩終了処理
async function handleBreakEnd() {
    console.log('🔄 休憩終了処理...');
    
    try {
        if (!currentUser || !currentAttendanceId) {
            alert('出勤記録が見つかりません');
            return;
        }
        
        const breakQuery = firebase.firestore()
            .collection('breaks')
            .where('attendanceId', '==', currentAttendanceId)
            .where('userId', '==', currentUser.uid);
        
        const breakSnapshot = await breakQuery.get();
        
        // アクティブな休憩記録を探す
        let activeBreakDoc = null;
        breakSnapshot.docs.forEach(doc => {
            const breakData = doc.data();
            if (!breakData.endTime) {
                activeBreakDoc = doc;
            }
        });
        
        if (activeBreakDoc) {
            const now = new Date();
            
            await activeBreakDoc.ref.update({
                endTime: now.toLocaleTimeString('ja-JP'),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('✅ 休憩終了記録完了');
        } else {
            alert('休憩記録が見つかりませんでした');
            return;
        }
        
        // 勤怠記録のステータスを勤務中に戻す
        await firebase.firestore()
            .collection('attendance')
            .doc(currentAttendanceId)
            .update({ 
                status: 'working',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        // グローバル変数更新
        todayAttendanceData.status = 'working';
        
        alert('休憩を終了しました');
        updateClockButtons('working');
        updateStatusDisplay('working', todayAttendanceData);
        
    } catch (error) {
        console.error('❌ 休憩終了エラー:', error);
        alert('休憩終了記録でエラーが発生しました: ' + error.message);
    }
}

// ボタンの状態更新（1日1回制限対応）
function updateClockButtons(status) {
    console.log('🔘 ボタン状態更新:', status);
    
    const clockInBtn = document.getElementById('clock-in-btn');
    const clockOutBtn = document.getElementById('clock-out-btn');
    const breakStartBtn = document.getElementById('break-start-btn');
    const breakEndBtn = document.getElementById('break-end-btn');
    
    // 全ボタンをリセット
    [clockInBtn, clockOutBtn, breakStartBtn, breakEndBtn].forEach(btn => {
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.style.backgroundColor = '';
        }
    });
    
    switch (status) {
        case 'waiting':
            console.log('📋 出勤待ち状態 - 出勤ボタンのみ有効');
            if (clockInBtn) clockInBtn.disabled = false;
            if (clockOutBtn) clockOutBtn.disabled = true;
            if (breakStartBtn) breakStartBtn.disabled = true;
            if (breakEndBtn) breakEndBtn.disabled = true;
            break;
            
        case 'working':
            console.log('💼 勤務中状態 - 退勤・休憩開始ボタンが有効');
            if (clockInBtn) clockInBtn.disabled = true;
            if (clockOutBtn) clockOutBtn.disabled = false;
            if (breakStartBtn) breakStartBtn.disabled = false;
            if (breakEndBtn) breakEndBtn.disabled = true;
            break;
            
        case 'break':
            console.log('⏸️ 休憩中状態 - 退勤・休憩終了ボタンが有効');
            if (clockInBtn) clockInBtn.disabled = true;
            if (clockOutBtn) clockOutBtn.disabled = false;
            if (breakStartBtn) breakStartBtn.disabled = true;
            if (breakEndBtn) breakEndBtn.disabled = false;
            break;
            
        case 'completed':
            console.log('🔒 勤務完了状態 - 全ボタン無効（1日制限）');
            // 全ボタンを視覚的に無効化
            [clockInBtn, clockOutBtn, breakStartBtn, breakEndBtn].forEach(btn => {
                if (btn) {
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                    btn.style.cursor = 'not-allowed';
                    btn.style.backgroundColor = '#6c757d';
                }
            });
            
            // ボタンテキストを変更
            if (clockInBtn) clockInBtn.textContent = '本日勤務完了';
            if (clockOutBtn) clockOutBtn.textContent = '退勤済み';
            if (breakStartBtn) breakStartBtn.textContent = '勤務終了';
            if (breakEndBtn) breakEndBtn.textContent = '勤務終了';
            break;
    }
    
    console.log('✅ ボタン状態更新完了');
}

// ステータス表示更新
function updateStatusDisplay(status, attendanceData, breakData = null) {
    const clockStatus = document.getElementById('clock-status');
    
    if (clockStatus) {
        let statusHtml = '';
        
        switch (status) {
            case 'working':
                statusHtml = `
                    <div class="status-working">
                        <h4>💼 勤務中です</h4>
                        <p>現場: ${attendanceData.siteName}</p>
                        <p>出勤時刻: ${attendanceData.startTime}</p>
                    </div>
                `;
                break;
                
            case 'break':
                statusHtml = `
                    <div class="status-break">
                        <h4>⏸️ 休憩中です</h4>
                        <p>現場: ${attendanceData.siteName}</p>
                        <p>休憩開始: ${breakData ? breakData.startTime : '不明'}</p>
                    </div>
                `;
                break;
                
            case 'completed':
                statusHtml = `
                    <div class="status-completed">
                        <h4>✅ 本日の勤務は完了しています</h4>
                        <p>現場: ${attendanceData.siteName}</p>
                        <p>勤務時間: ${attendanceData.startTime} - ${attendanceData.endTime}</p>
                        <p><strong>🔒 1日1回制限により再出勤はできません</strong></p>
                    </div>
                `;
                break;
                
            default:
                statusHtml = `
                    <div class="status-waiting">
                        <h4>⏰ 出勤ボタンを押してください</h4>
                        <p>現場を選択して出勤してください</p>
                    </div>
                `;
        }
        
        clockStatus.innerHTML = statusHtml;
    }
}

// 最近の記録を安全に読み込み
async function loadRecentRecordsSafely() {
    console.log('🔍 最近の記録を安全に読み込み中...');
    
    const recentList = document.getElementById('recent-list');
    if (!recentList) return;
    
    try {
        if (!currentUser) {
            showWelcomeMessage();
            return;
        }
        
        const query = firebase.firestore()
            .collection('attendance')
            .where('userId', '==', currentUser.uid)
            .limit(5);
        
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            showWelcomeMessage();
            return;
        }
        
        console.log('✅ 記録取得成功:', snapshot.size, '件');
        displayRecentRecords(snapshot);
        
    } catch (error) {
        console.error('❌ 記録読み込みエラー:', error);
        handleRecordLoadError(error);
    }
}

// ウェルカムメッセージの表示
function showWelcomeMessage() {
    const recentList = document.getElementById('recent-list');
    if (recentList) {
        recentList.innerHTML = `
            <div class="welcome-message">
                <h4>🎯 勤怠システムへようこそ</h4>
                <p>まだ勤怠記録がありません</p>
                <p><strong>出勤ボタンを押して勤務を開始しましょう</strong></p>
                <div class="usage-tips">
                    <h5>📝 使い方:</h5>
                    <ol>
                        <li>現場を選択してください</li>
                        <li>出勤ボタンをクリック</li>
                        <li>休憩時は休憩ボタンを使用</li>
                        <li>退勤時は退勤ボタンをクリック</li>
                    </ol>
                    <p><strong>🔒 注意: 1日1回のみ出勤可能です</strong></p>
                </div>
            </div>
        `;
    }
}

// 最近の記録を表示
function displayRecentRecords(snapshot) {
    const recentList = document.getElementById('recent-list');
    if (!recentList) return;
    
    const records = [];
    snapshot.forEach(doc => {
        records.push({ id: doc.id, ...doc.data() });
    });
    
    // 日付でソート
    records.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
    });

    let html = '';
    records.forEach(record => {
        html += `
            <div class="record-item">
                <div class="record-header">
                    <span class="record-date">${record.date || '日付不明'}</span>
                    <span class="record-status status-${record.status || 'unknown'}">${getStatusText(record.status)}</span>
                </div>
                <div class="record-details">
                    <div class="record-site">📍 ${record.siteName || '現場不明'}</div>
                    <div class="record-time">
                        ⏰ 出勤: ${record.startTime || '不明'}
                        ${record.endTime ? ` / 退勤: ${record.endTime}` : ' (勤務中)'}
                    </div>
                    ${record.notes ? `<div class="record-notes">📝 ${record.notes}</div>` : ''}
                </div>
            </div>
        `;
    });
    
    recentList.innerHTML = html;
}

// 記録読み込みエラーの処理
function handleRecordLoadError(error) {
    console.log('🔧 記録読み込みエラーを処理中:', error.code);
    
    const recentList = document.getElementById('recent-list');
    if (recentList) {
        recentList.innerHTML = `
            <div class="error-message">
                <h4>⚠️ データ読み込みエラー</h4>
                <p>記録の読み込みで問題が発生しました</p>
                <p><strong>出勤・退勤機能は正常に動作します</strong></p>
                <button onclick="loadRecentRecordsSafely()" class="retry-btn">🔄 再試行</button>
                <details class="error-details">
                    <summary>エラー詳細</summary>
                    <code>${error.message || 'Unknown error'}</code>
                </details>
            </div>
        `;
    }
}

// エラーメッセージの表示
function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-notification';
    errorDiv.innerHTML = `
        <div class="error-content">
            <h4>⚠️ エラー</h4>
            <p>${message}</p>
        </div>
    `;
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #fee;
        border: 1px solid #fcc;
        border-radius: 8px;
        padding: 15px;
        max-width: 300px;
        z-index: 9999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}

// ログアウト処理
function handleLogout() {
    if (confirm('ログアウトしますか？')) {
        firebase.auth().signOut()
            .then(() => {
                console.log('✅ ログアウト完了');
                // グローバル変数をリセット
                currentUser = null;
                currentAttendanceId = null;
                todayAttendanceData = null;
                dailyLimitProcessing = false;
                
                showPage('login');
            })
            .catch((error) => {
                console.error('❌ ログアウトエラー:', error);
                alert('ログアウトでエラーが発生しました');
            });
    }
}

// グローバルエラーハンドリング
window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && event.reason.code) {
        console.log('🔍 Firestoreエラーをキャッチ:', event.reason.code);
        
        // インデックスエラーなどを無視
        if (event.reason.code === 'failed-precondition' || 
            event.reason.code === 'permission-denied') {
            console.log('🛠️ インデックスエラーを無視して続行');
            event.preventDefault();
        }
    }
});

// 初期化実行
document.addEventListener('DOMContentLoaded', function() {
    console.log('📋 DOMContentLoaded - 従業員ページ初期化準備');
    // Firebase が読み込まれるまで少し待つ
    setTimeout(initEmployeePage, 500);
});

console.log('✅ employee.js（完全版 - 1日1回制限対応）読み込み完了');
