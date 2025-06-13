// employee.js - 従業員ページの機能（修正版）

// 現在のユーザー情報
let currentUser = null;
let currentAttendanceId = null;

// 従業員ページの初期化
function initEmployeePage() {
    console.log('🚀 従業員ページ初期化開始（安全版）');
    
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
        
        // 最近の記録を安全に読み込み（遅延実行）
        setTimeout(() => {
            loadRecentRecordsSafely();
        }, 2000);
        
        console.log('✅ 従業員ページ初期化完了（安全版）');
        
    } catch (error) {
        console.error('❌ 従業員ページ初期化エラー:', error);
        showErrorMessage('ページの初期化でエラーが発生しました');
    }
}

// ユーザー名の表示
function displayUserName() {
    const user = firebase.auth().currentUser;
    if (user) {
        currentUser = user;
        const userNameElement = document.getElementById('user-name');
        if (userNameElement) {
            userNameElement.textContent = user.email || 'ユーザー';
        }
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
    
    // 出勤ボタン
    const clockInBtn = document.getElementById('clock-in-btn');
    if (clockInBtn) {
        clockInBtn.addEventListener('click', handleClockIn);
    }
    
    // 退勤ボタン
    const clockOutBtn = document.getElementById('clock-out-btn');
    if (clockOutBtn) {
        clockOutBtn.addEventListener('click', handleClockOut);
    }
    
    // 休憩開始ボタン
    const breakStartBtn = document.getElementById('break-start-btn');
    if (breakStartBtn) {
        breakStartBtn.addEventListener('click', handleBreakStart);
    }
    
    // 休憩終了ボタン
    const breakEndBtn = document.getElementById('break-end-btn');
    if (breakEndBtn) {
        breakEndBtn.addEventListener('click', handleBreakEnd);
    }
    
    // ログアウトボタン
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
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

// 最近の記録を安全に読み込み
async function loadRecentRecordsSafely() {
    console.log('🔍 最近の記録を安全に読み込み中...');
    
    const recentList = document.getElementById('recent-list');
    if (!recentList) return;
    
    try {
        if (!currentUser) {
            console.log('❌ ユーザーが認証されていません');
            showWelcomeMessage();
            return;
        }
        
        // 最もシンプルなクエリを実行
        console.log('🔄 シンプルクエリを実行中...');
        const query = firebase.firestore()
            .collection('attendance')
            .where('userId', '==', currentUser.uid)
            .limit(5);
        
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            console.log('📋 記録が見つかりません');
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
                </div>
            </div>
        `;
    }
}

// 最近の記録を表示
function displayRecentRecords(snapshot) {
    const recentList = document.getElementById('recent-list');
    if (!recentList) return;
    
    let html = '<h4>📋 最近の記録</h4>';
    
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

// ステータステキストの取得
function getStatusText(status) {
    const statusMap = {
        'working': '勤務中',
        'break': '休憩中',
        'completed': '勤務終了',
        'absent': '欠勤'
    };
    return statusMap[status] || '不明';
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

// 出勤処理
async function handleClockIn() {
    console.log('🏢 出勤処理を開始...');
    
    try {
        if (!currentUser) {
            alert('ログインが必要です');
            return;
        }
        
        const siteNameElement = document.getElementById('site-name');
        const otherSiteElement = document.getElementById('other-site');
        const workNotesElement = document.getElementById('work-notes');
        
        let siteName = siteNameElement ? siteNameElement.value : '';
        
        // その他の現場が選択された場合
        if (siteName === 'other' && otherSiteElement) {
            siteName = otherSiteElement.value.trim();
        }
        
        if (!siteName) {
            alert('現場を選択してください');
            return;
        }
        
        const now = new Date();
        const workNotes = workNotesElement ? workNotesElement.value.trim() : '';
        
        // シンプルなドキュメント作成
        const attendanceData = {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            date: now.toISOString().split('T')[0],
            siteName: siteName,
            startTime: now.toLocaleTimeString('ja-JP'),
            status: 'working',
            notes: workNotes,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        console.log('💾 出勤データを保存中...', attendanceData);
        
        const docRef = await firebase.firestore()
            .collection('attendance')
            .add(attendanceData);
        
        currentAttendanceId = docRef.id;
        
        console.log('✅ 出勤記録完了:', docRef.id);
        alert('出勤しました！');
        
        // UI更新
        updateClockButtons('working');
        loadRecentRecordsSafely();
        
        // フォームをクリア
        if (workNotesElement) workNotesElement.value = '';
        
    } catch (error) {
        console.error('❌ 出勤エラー:', error);
        alert('出勤記録でエラーが発生しました: ' + error.message);
    }
}

// 退勤処理
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
        alert('お疲れさまでした！');
        
        // UI更新
        currentAttendanceId = null;
        updateClockButtons('completed');
        loadRecentRecordsSafely();
        
    } catch (error) {
        console.error('❌ 退勤エラー:', error);
        alert('退勤記録でエラーが発生しました: ' + error.message);
    }
}

// 休憩開始処理（インデックスエラー対策版）
async function handleBreakStart() {
    console.log('☕ 休憩開始処理...');
    
    try {
        if (!currentUser || !currentAttendanceId) {
            alert('出勤記録が見つかりません');
            return;
        }
        
        // 既存の休憩記録をシンプルにチェック
        const breakQuery = firebase.firestore()
            .collection('breaks')
            .where('attendanceId', '==', currentAttendanceId)
            .where('userId', '==', currentUser.uid);
        
        const breakSnapshot = await breakQuery.get();
        
        // 終了時間が未設定の休憩記録があるかチェック
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
        
        alert('休憩を開始しました');
        updateClockButtons('break');
        
    } catch (error) {
        console.error('❌ 休憩開始エラー:', error);
        alert('休憩記録でエラーが発生しました: ' + error.message);
    }
}

// 休憩終了処理（インデックスエラー対策版）
async function handleBreakEnd() {
    console.log('🔄 休憩終了処理...');
    
    try {
        if (!currentUser || !currentAttendanceId) {
            alert('出勤記録が見つかりません');
            return;
        }
        
        // シンプルなクエリのみ使用（orderByを削除）
        const breakQuery = firebase.firestore()
            .collection('breaks')
            .where('attendanceId', '==', currentAttendanceId)
            .where('userId', '==', currentUser.uid);
        
        const breakSnapshot = await breakQuery.get();
        
        // 終了時間が未設定の休憩記録を探す
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
            console.log('⚠️ アクティブな休憩記録が見つかりません');
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
        
        alert('休憩を終了しました');
        updateClockButtons('working');
        loadRecentRecordsSafely();
        
    } catch (error) {
        console.error('❌ 休憩終了エラー:', error);
        alert('休憩終了記録でエラーが発生しました: ' + error.message);
    }
}

// ボタンの状態更新
function updateClockButtons(status) {
    const clockInBtn = document.getElementById('clock-in-btn');
    const clockOutBtn = document.getElementById('clock-out-btn');
    const breakStartBtn = document.getElementById('break-start-btn');
    const breakEndBtn = document.getElementById('break-end-btn');
    const clockStatus = document.getElementById('clock-status');
    
    // 全ボタンをリセット
    if (clockInBtn) clockInBtn.disabled = false;
    if (clockOutBtn) clockOutBtn.disabled = true;
    if (breakStartBtn) breakStartBtn.disabled = true;
    if (breakEndBtn) breakEndBtn.disabled = true;
    
    // ステータスに応じてボタンを制御
    switch (status) {
        case 'working':
            if (clockInBtn) clockInBtn.disabled = true;
            if (clockOutBtn) clockOutBtn.disabled = false;
            if (breakStartBtn) breakStartBtn.disabled = false;
            if (clockStatus) clockStatus.innerHTML = '<div class="status-working">✅ 勤務中です</div>';
            break;
            
        case 'break':
            if (clockInBtn) clockInBtn.disabled = true;
            if (clockOutBtn) clockOutBtn.disabled = false;
            if (breakEndBtn) breakEndBtn.disabled = false;
            if (clockStatus) clockStatus.innerHTML = '<div class="status-break">⏸️ 休憩中です</div>';
            break;
            
        case 'completed':
            if (clockStatus) clockStatus.innerHTML = '<div class="status-completed">✅ 勤務終了しました</div>';
            break;
            
        default:
            if (clockStatus) clockStatus.innerHTML = '<div class="status-waiting">⏰ 出勤ボタンを押してください</div>';
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

console.log('✅ employee.js（修正版）読み込み完了');
