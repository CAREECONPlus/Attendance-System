// employee.js - 従業員ページの機能（完全版 - 日付修正版）

console.log('employee.js loading...');

// 現在のユーザー情報とグローバル変数
let currentUser = null;
let dailyLimitProcessing = false;

// 変数監視用のプロキシ設定
let _todayAttendanceData = null;
let _currentAttendanceId = null;

// todayAttendanceDataの監視
Object.defineProperty(window, 'todayAttendanceData', {
    get: function() {
        return _todayAttendanceData;
    },
    set: function(value) {
        console.log('🔍 todayAttendanceData変更:', {
            old: _todayAttendanceData,
            new: value,
            stack: new Error().stack
        });
        _todayAttendanceData = value;
    }
});

// currentAttendanceIdの監視
Object.defineProperty(window, 'currentAttendanceId', {
    get: function() {
        return _currentAttendanceId;
    },
    set: function(value) {
        console.log('🔍 currentAttendanceId変更:', {
            old: _currentAttendanceId,
            new: value,
            stack: new Error().stack
        });
        _currentAttendanceId = value;
    }
});

// 🆕 日本時間で確実に今日の日付を取得する関数
function getTodayJST() {
    const now = new Date();
    
    // 日本時間で確実に計算（UTC + 9時間）
    const jstDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (9 * 3600000));
    const today = jstDate.toISOString().split('T')[0];
    
    console.log('🕐 日付計算詳細:', {
        現在時刻_UTC: now.toISOString(),
        現在時刻_JST: jstDate.toISOString(),
        今日の日付: today,
        タイムゾーンオフセット: now.getTimezoneOffset()
    });
    
    return today;
}

// 従業員ページの初期化
function initEmployeePage() {
    console.log('🚀 従業員ページ初期化開始（日付修正版）');
    
    // Firebase認証状態の監視
    firebase.auth().onAuthStateChanged(async function(user) {
        if (user) {
            console.log('✅ ユーザー認証確認:', user.email);
            
            // 🎯 重要：既にログイン済みの場合は変数をリセットしない
            const wasAlreadyLoggedIn = (currentUser && currentUser.uid === user.uid);
            currentUser = user;
            
            if (wasAlreadyLoggedIn) {
                console.log('🔄 既存ユーザーの再認証 - データを保持');
                // データがある場合は保持
                if (todayAttendanceData) {
                    console.log('📋 既存データを維持:', todayAttendanceData);
                    const status = todayAttendanceData.status === 'completed' ? 'completed' : 
                                  todayAttendanceData.status === 'break' ? 'break' : 'working';
                    updateClockButtons(status);
                    return; // 初期化をスキップ
                }
            } else {
                console.log('🆕 新規ログインまたは初回認証');
            }
            
            try {
                // ユーザー名を表示
                displayUserName();
                
                // 現在時刻の表示を開始（重複チェック）
                if (!window.timeIntervalSet) {
                    updateCurrentTime();
                    setInterval(updateCurrentTime, 1000);
                    window.timeIntervalSet = true;
                }
                
                // イベントリスナーの設定（重複チェック）
                if (!window.eventListenersSet) {
                    setupEmployeeEventListeners();
                    window.eventListenersSet = true;
                }
                
                // 現場選択の設定
                setupSiteSelection();
                
                // 今日の勤怠状態を復元（データがない場合のみ）
                if (!todayAttendanceData || !currentAttendanceId) {
                    await restoreTodayAttendanceState();
                }
                
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
            console.log('❌ ユーザー未認証 - ログアウト処理');
            // 🎯 明示的なログアウトの場合のみ変数をクリア
            if (window.explicitLogout) {
                currentUser = null;
                currentAttendanceId = null;
                todayAttendanceData = null;
                dailyLimitProcessing = false;
                window.explicitLogout = false;
            } else {
                console.log('⚠️ 自動ログアウト検出 - データを保持');
                // Firebase認証の一時的な切断の場合はデータを保持
                currentUser = null; // currentUserのみクリア
            }
            showPage('login');
        }
    });
}

// 🔧 修正版 restoreTodayAttendanceState関数（日付修正）
async function restoreTodayAttendanceState() {
    console.log('🔄 今日の勤怠状態を復元中...');
    
    try {
        if (!currentUser) {
            console.error('❌ currentUserが設定されていません');
            return;
        }
        
        // 🎯 修正: JST確実取得
        const today = getTodayJST();
        
        console.log('📅 正確な今日の日付:', today);
        console.log('👤 検索対象ユーザー:', currentUser.uid);
        
        // 今日のデータのみを検索
        const todayQuery = firebase.firestore()
            .collection('attendance')
            .where('userId', '==', currentUser.uid)
            .where('date', '==', today);
        
        console.log('🔍 今日のデータをFirestoreで検索中...');
        const todaySnapshot = await todayQuery.get();
        
        console.log('📊 今日のクエリ結果:', {
            検索日付: today,
            empty: todaySnapshot.empty,
            size: todaySnapshot.size
        });
        
        if (!todaySnapshot.empty) {
            // 今日のデータが見つかった場合
            let latestRecord = null;
            let latestDoc = null;
            
            todaySnapshot.docs.forEach(doc => {
                const data = doc.data();
                console.log('📋 今日のデータ詳細:', data);
                
                if (!latestRecord || 
                    (data.createdAt && (!latestRecord.createdAt || data.createdAt > latestRecord.createdAt))) {
                    latestRecord = data;
                    latestDoc = doc;
                }
            });
            
            // 今日のデータを復元
            currentAttendanceId = latestDoc.id;
            todayAttendanceData = {
                id: latestDoc.id,
                ...latestRecord
            };
            
            console.log('✅ 今日のデータ復元完了');
            await restoreCurrentState(latestRecord);
            
        } else {
            // 今日のデータがない場合は新規出勤待ち状態
            console.log('📋 今日の勤怠記録なし - 新規出勤待ち状態');
            
            currentAttendanceId = null;
            todayAttendanceData = null;
            updateClockButtons('waiting');
            updateStatusDisplay('waiting', null);
        }
        
        // データ設定後の確認
        setTimeout(() => {
            console.log('🔍 設定後確認:', {
                currentAttendanceId,
                todayAttendanceData: todayAttendanceData ? 
                    { id: todayAttendanceData.id, status: todayAttendanceData.status, date: todayAttendanceData.date } : null
            });
        }, 100);
        
    } catch (error) {
        console.error('❌ 勤怠状態復元エラー:', error);
        console.error('エラー詳細:', error.message);
        console.error('エラーコード:', error.code);
        
        // エラー時はデフォルト状態
        currentAttendanceId = null;
        todayAttendanceData = null;
        updateClockButtons('waiting');
        updateStatusDisplay('waiting', null);
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
        
        // 🎯 重要：状態復元後に強制的にボタン表示を更新
        setTimeout(() => {
            console.log('🔄 ボタン表示を再更新');
            const currentStatus = activeBreakData ? 'break' : 'working';
            updateClockButtons(currentStatus);
        }, 100);
        
    } catch (error) {
        console.error('❌ 状態復元エラー:', error);
        updateClockButtons('working');
        updateStatusDisplay('working', recordData);
    }
}

// 🔧 修正版 1日1回制限チェック（日付修正）
async function checkDailyLimit(userId) {
    console.log('🔍 1日1回制限チェック開始');
    
    // 🎯 修正: JST確実取得
    const today = getTodayJST();
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

// 現場選択の設定（直接入力対応）
function setupSiteSelection() {
    // 直接入力に変更したため、特別な設定は不要
    console.log('現場名は直接入力形式です');
}

// 現場名取得関数（直接入力対応）
function getSiteNameFromSelection() {
    const siteNameElement = document.getElementById('site-name');
    
    if (!siteNameElement) {
        console.error('❌ site-name要素が見つかりません');
        alert('現場名入力フォームに問題があります。\nページを再読み込みしてください。');
        return null;
    }
    
    const siteName = siteNameElement.value.trim();
    
    // 空の値チェック
    if (!siteName) {
        alert('⚠️ 現場名を入力してください');
        siteNameElement.focus();
        return null;
    }
    
    console.log('✅ 入力された現場:', siteName);
    return siteName;
}

// 🔧 修正版 handleClockIn関数（日付修正完全版）
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
    
    // ボタン状態を保存・変更する関数
    function setButtonProcessing() {
        if (clockInBtn) {
            clockInBtn.disabled = true;
            clockInBtn.textContent = '処理中...';
            clockInBtn.style.opacity = '0.5';
        }
    }
    
    // ボタン状態を復元する関数
    function restoreButton() {
        if (clockInBtn) {
            clockInBtn.disabled = false;
            clockInBtn.textContent = originalText;
            clockInBtn.style.opacity = '1';
        }
        dailyLimitProcessing = false;
    }
    
    setButtonProcessing();
    
    try {
        if (!currentUser) {
            throw new Error('ユーザーが認証されていません');
        }
        
        // 🚨 重要：1日1回制限チェック
        const canClockIn = await checkDailyLimit(currentUser.uid);
        if (!canClockIn) {
            restoreButton();
            return;
        }
        
        // 現場選択チェック
        const siteName = getSiteNameFromSelection();
        
        if (!siteName) {
            restoreButton();
            return;
        }
        
        // 🎯 日付生成を修正（JST確実対応）
        const now = new Date();
        
        // 🆕 修正: getTodayJST()を使用
        const today = getTodayJST();
        
        // デバッグ用ログ
        console.log('🕐 時刻情報:', {
            originalTime: now.toString(),
            savedDate: today,
            startTime: now.toLocaleTimeString('ja-JP')
        });
        
        const workNotesElement = document.getElementById('work-notes');
        const workNotes = workNotesElement ? workNotesElement.value.trim() : '';
        
        const attendanceData = {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            date: today,  // 🎯 修正された日付
            siteName: siteName,
            startTime: now.toLocaleTimeString('ja-JP'),
            status: 'working',
            notes: workNotes,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            // デバッグ用
            clientTimestamp: now.toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
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
        
        alert(`✅ 出勤しました！\n現場: ${siteName}\n時刻: ${attendanceData.startTime}\n日付: ${today}`);
        
        // フォームをクリア
        if (workNotesElement) workNotesElement.value = '';
        
        // 最近の記録を更新
        loadRecentRecordsSafely();
        
        // 処理完了
        dailyLimitProcessing = false;
        
    } catch (error) {
        console.error('❌ 出勤処理エラー:', error);
        alert('出勤処理中にエラーが発生しました。\n' + error.message);
        
        restoreButton();
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

// 🔧 修正版 休憩開始処理（日付修正）
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
            date: getTodayJST(), // 🎯 修正: JST確実取得
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

// updateClockButtons関数
function updateClockButtons(status) {
    console.log('🔘 ボタン状態更新:', status);
    
    const clockInBtn = document.getElementById('clock-in-btn');
    const clockOutBtn = document.getElementById('clock-out-btn');
    const breakStartBtn = document.getElementById('break-start-btn');
    const breakEndBtn = document.getElementById('break-end-btn');
    
    // 全ボタンの特殊クラスをリセット
    [clockInBtn, clockOutBtn, breakStartBtn, breakEndBtn].forEach(btn => {
        if (btn) {
            btn.classList.remove('break-active', 'processing');
            btn.disabled = false;
        }
    });
    
    switch (status) {
        case 'waiting':
            console.log('📋 出勤待ち状態');
            // 出勤ボタンのみ有効
            if (clockInBtn) {
                clockInBtn.disabled = false;
                clockInBtn.textContent = '出勤';
            }
            if (clockOutBtn) {
                clockOutBtn.disabled = true;
                clockOutBtn.textContent = '退勤';
            }
            if (breakStartBtn) {
                breakStartBtn.disabled = true;
                breakStartBtn.textContent = '休憩開始';
            }
            if (breakEndBtn) {
                breakEndBtn.disabled = true;
                breakEndBtn.textContent = '休憩終了';
            }
            break;
            
        case 'working':
            console.log('💼 勤務中状態');
            // 出勤済み、退勤・休憩開始が有効
            if (clockInBtn) {
                clockInBtn.disabled = true;
                clockInBtn.textContent = '出勤済み';
            }
            if (clockOutBtn) {
                clockOutBtn.disabled = false;
                clockOutBtn.textContent = '退勤';
            }
            if (breakStartBtn) {
                breakStartBtn.disabled = false;
                breakStartBtn.textContent = '休憩開始';
            }
            if (breakEndBtn) {
                breakEndBtn.disabled = true;
                breakEndBtn.textContent = '休憩終了';
            }
            break;
            
        case 'break':
            console.log('⏸️ 休憩中状態');
            // 出勤済み、退勤・休憩終了が有効
            if (clockInBtn) {
                clockInBtn.disabled = true;
                clockInBtn.textContent = '出勤済み';
            }
            if (clockOutBtn) {
                clockOutBtn.disabled = false;
                clockOutBtn.textContent = '退勤';
            }
            if (breakStartBtn) {
                breakStartBtn.disabled = true;
                breakStartBtn.textContent = '休憩中';
                breakStartBtn.classList.add('break-active'); // 🎨 特殊スタイル適用
            }
            if (breakEndBtn) {
                breakEndBtn.disabled = false;
                breakEndBtn.textContent = '休憩終了';
            }
            break;
            
        case 'completed':
            console.log('🔒 勤務完了状態');
            // 全ボタン無効（勤務完了）
            if (clockInBtn) {
                clockInBtn.disabled = true;
                clockInBtn.textContent = '本日勤務完了';
            }
            if (clockOutBtn) {
                clockOutBtn.disabled = true;
                clockOutBtn.textContent = '退勤済み';
            }
            if (breakStartBtn) {
                breakStartBtn.disabled = true;
                breakStartBtn.textContent = '勤務終了';
            }
            if (breakEndBtn) {
                breakEndBtn.disabled = true;
                breakEndBtn.textContent = '勤務終了';
            }
            break;
    }
    
    // 🎯 強制的にスタイルを再適用（キャッシュ問題対策）
    setTimeout(() => {
        console.log('🔄 ボタンスタイル再適用');
        [clockInBtn, clockOutBtn, breakStartBtn, breakEndBtn].forEach(btn => {
            if (btn) {
                // フォーカスを一瞬当てて外してスタイル更新を強制
                const originalTabIndex = btn.tabIndex;
                btn.tabIndex = -1;
                btn.focus();
                btn.blur();
                btn.tabIndex = originalTabIndex;
            }
        });
    }, 50);
    
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
                        <h4>✅ 本日は退勤済みです。</h4>
                        <p>現場: ${attendanceData.siteName}</p>
                        <p>勤務時間: ${attendanceData.startTime} - ${attendanceData.endTime}</p>
                        <p>お疲れさまでした。</p>
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

// 最近の記録を安全に読み込み（直近3日間のみ）
async function loadRecentRecordsSafely() {
    console.log('🔍 最近の記録を安全に読み込み中（直近3日間）...');
    
    const recentList = document.getElementById('recent-list');
    if (!recentList) return;
    
    try {
        if (!currentUser) {
            showWelcomeMessage();
            return;
        }
        
        // 直近3日間の日付範囲を計算
        const today = getTodayJST();
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 2); // 今日含めて3日間
        const threeDaysAgoString = threeDaysAgo.toISOString().split('T')[0];
        
        console.log('📅 検索範囲:', threeDaysAgoString, '〜', today);
        
        // インデックス不要の簡素化クエリ（ユーザーIDのみでフィルター）
        const query = firebase.firestore()
            .collection('attendance')
            .where('userId', '==', currentUser.uid)
            .limit(20); // 多めに取得してクライアント側でフィルター
        
        const snapshot = await query.get();
        
        // クライアント側で直近3日間でフィルター
        const filteredDocs = [];
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const recordDate = data.date;
            if (recordDate && recordDate >= threeDaysAgoString && recordDate <= today) {
                filteredDocs.push(doc);
            }
        });
        
        // 擬似的なsnapshot作成
        const filteredSnapshot = {
            empty: filteredDocs.length === 0,
            size: filteredDocs.length,
            docs: filteredDocs
        };
        
        if (filteredSnapshot.empty) {
            showWelcomeMessage();
            return;
        }
        
        console.log('✅ 記録取得成功:', filteredSnapshot.size, '件（直近3日間）');
        displayRecentRecords(filteredSnapshot);
        
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
        // 🎯 明示的なログアウトフラグを設定
        window.explicitLogout = true;
        
        firebase.auth().signOut()
            .then(() => {
                console.log('✅ ログアウト完了');
                // 変数クリアは onAuthStateChanged で実行される
                showPage('login');
            })
            .catch((error) => {
                console.error('❌ ログアウトエラー:', error);
                alert('ログアウトでエラーが発生しました');
                window.explicitLogout = false; // エラー時はフラグをリセット
            });
    }
}

// データ取得を強制実行する関数
async function forceDataReload() {
    console.log('🔄 データを強制再読み込み');
    
    // 現在の変数をクリア
    currentAttendanceId = null;
    todayAttendanceData = null;
    
    // 状態復元を実行
    await restoreTodayAttendanceState();
    
    // 結果確認
    setTimeout(() => {
        console.log('🔍 再読み込み後の状態:', {
            currentAttendanceId,
            todayAttendanceData,
            currentUser: currentUser?.email
        });
    }, 200);
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

// デバッグ用関数
function debugCurrentState() {
    console.log('🔍 デバッグ：現在の状態');
    console.log('currentUser:', currentUser?.email);
    console.log('currentAttendanceId:', currentAttendanceId);
    console.log('todayAttendanceData:', todayAttendanceData);
    
    // ボタンの現在の状態を確認
    const clockInBtn = document.getElementById('clock-in-btn');
    const clockOutBtn = document.getElementById('clock-out-btn');
    const breakStartBtn = document.getElementById('break-start-btn');
    const breakEndBtn = document.getElementById('break-end-btn');
    
    console.log('ボタン状態:', {
        clockIn: { disabled: clockInBtn?.disabled, text: clockInBtn?.textContent },
        clockOut: { disabled: clockOutBtn?.disabled, text: clockOutBtn?.textContent },
        breakStart: { disabled: breakStartBtn?.disabled, text: breakStartBtn?.textContent },
        breakEnd: { disabled: breakEndBtn?.disabled, text: breakEndBtn?.textContent }
    });
    
    // 🆕 正確な今日の日付チェック
    const today = getTodayJST();
    console.log('正確な今日の日付:', today);
    console.log('記録の日付:', todayAttendanceData?.date);
}

// 強制的に勤務中状態に修正する緊急関数
function forceWorkingState() {
    console.log('🚨 緊急：勤務中状態に強制修正');
    
    if (todayAttendanceData) {
        updateClockButtons('working');
        updateStatusDisplay('working', todayAttendanceData);
        console.log('✅ 勤務中状態に修正完了');
    } else {
        console.error('❌ todayAttendanceData が存在しません');
        
        // todayAttendanceDataがない場合は再取得を試行
        console.log('🔄 勤怠データ再取得を試行...');
        restoreTodayAttendanceState();
    }
}

// 状態を強制リセットして再初期化する関数
function forceStateReset() {
    console.log('🔄 状態を強制リセット');
    
    // グローバル変数をクリア
    currentAttendanceId = null;
    todayAttendanceData = null;
    
    // 状態を再取得
    setTimeout(() => {
        restoreTodayAttendanceState();
    }, 100);
}

// 🆕 正確な日付でのテスト関数
function testTodayDate() {
    const today = getTodayJST();
    console.log('🧪 今日の日付テスト:', today);
    
    // 今日のデータを検索
    const query = firebase.firestore()
        .collection('attendance')
        .where('userId', '==', currentUser.uid)
        .where('date', '==', today);
    
    query.get().then(snapshot => {
        console.log('📊 今日のデータ件数:', snapshot.size);
        if (snapshot.empty) {
            console.log('✅ 今日は出勤可能');
        } else {
            console.log('❌ 今日は既に出勤済み');
            snapshot.docs.forEach(doc => {
                console.log('今日のデータ:', doc.data());
            });
        }
    });
}

console.log('✅ employee.js（完全版 - 日付修正版）読み込み完了');
