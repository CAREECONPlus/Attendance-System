// employee.js - 従業員ページの機能（完全版 - 1日1回制限対応）

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

// 既存のグローバル変数宣言を削除または置き換え
// let currentAttendanceId = null; ← これを削除
// let todayAttendanceData = null;  ← これを削除

// 従業員ページの初期化
// initEmployeePage関数を以下で置き換え
function initEmployeePage() {
    console.log('🚀 従業員ページ初期化開始（完全版）');
    
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

// 改良版 restoreTodayAttendanceState関数
async function restoreTodayAttendanceState() {
    console.log('🔄 今日の勤怠状態を復元中...');
    
    try {
        if (!currentUser) {
            console.error('❌ currentUserが設定されていません');
            return;
        }
        
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        console.log('📅 検索対象日付:', { today, yesterday });
        console.log('👤 検索対象ユーザー:', currentUser.uid);
        
        // まず今日のデータを検索
        let query = firebase.firestore()
            .collection('attendance')
            .where('userId', '==', currentUser.uid)
            .where('date', '==', today);
        
        console.log('🔍 今日のデータをFirestoreで検索中...');
        let snapshot = await query.get();
        
        console.log('📊 今日のクエリ結果:', {
            empty: snapshot.empty,
            size: snapshot.size
        });
        
        // 今日のデータがない場合は昨日のデータを検索
        if (snapshot.empty) {
            console.log('⚠️ 今日のデータなし - 昨日のデータを検索中...');
            
            query = firebase.firestore()
                .collection('attendance')
                .where('userId', '==', currentUser.uid)
                .where('date', '==', yesterday);
            
            snapshot = await query.get();
            
            console.log('📊 昨日のクエリ結果:', {
                empty: snapshot.empty,
                size: snapshot.size
            });
        }
        
        // 最新の未完了データがあるかチェック
        if (!snapshot.empty) {
            let latestRecord = null;
            let latestDoc = null;
            
            // 複数ある場合は最新のものを選択
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (!latestRecord || 
                    (data.createdAt && (!latestRecord.createdAt || data.createdAt > latestRecord.createdAt))) {
                    latestRecord = data;
                    latestDoc = doc;
                }
            });
            
            console.log('📋 取得した最新記録:', latestRecord);
            
            // 勤務が完了していない場合のみ復元
            if (latestRecord.status !== 'completed' || !latestRecord.endTime) {
                console.log('🔄 未完了の勤務を復元中...');
                
                // グローバル変数に設定
                currentAttendanceId = latestDoc.id;
                todayAttendanceData = {
                    id: latestDoc.id,
                    ...latestRecord
                };
                
                console.log('✅ グローバル変数設定完了:', {
                    currentAttendanceId,
                    todayAttendanceData
                });
                
                // 現在の状態に応じてUIを更新
                await restoreCurrentState(latestRecord);
                
                console.log('✅ 勤怠状態復元完了');
            } else {
                console.log('✅ 勤務完了済み - 新規出勤待ち状態');
                currentAttendanceId = null;
                todayAttendanceData = null;
                updateClockButtons('waiting');
            }
            
        } else {
            console.log('📋 勤怠記録なし - 出勤待ち状態');
            currentAttendanceId = null;
            todayAttendanceData = null;
            updateClockButtons('waiting');
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
        alert('現場選択フォームに問題があります。\nページを再読み込みしてください。');
        return null;
    }
    
    let siteName = siteNameElement.value;
    
    // 空の値または未選択チェック
    if (!siteName || siteName === '' || siteName === '現場を選択してください') {
        alert('⚠️ 現場を選択してください');
        // フォーカスを現場選択に移動
        siteNameElement.focus();
        return null;
    }
    
    // 「その他」が選択された場合
    if (siteName === 'other') {
        if (otherSiteElement && otherSiteElement.value.trim()) {
            siteName = otherSiteElement.value.trim();
        } else {
            alert('⚠️ 現場名を入力してください');
            // フォーカスをその他入力欄に移動
            if (otherSiteElement) {
                otherSiteElement.focus();
            }
            return null;
        }
    }
    
    console.log('✅ 選択された現場:', siteName);
    return siteName;
}

// handleClockIn関数の修正版
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
            restoreButton(); // ボタンを復元
            return; // 出勤不可
        }
        
        // 現場選択チェック（ここでエラーになることが多い）
        const siteName = getSiteNameFromSelection();
        
        if (!siteName) {
            // ⭐ 重要：現場未選択時にボタンを復元
            restoreButton();
            return;
        }
        
        // 出勤データ作成
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const workNotesElement = document.getElementById('work-notes');
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
        
        // UI更新（成功時はボタン状態変更）
        updateClockButtons('working');
        updateStatusDisplay('working', todayAttendanceData);
        
        alert(`✅ 出勤しました！\n現場: ${siteName}\n時刻: ${attendanceData.startTime}`);
        
        // フォームをクリア
        if (workNotesElement) workNotesElement.value = '';
        
        // 最近の記録を更新
        loadRecentRecordsSafely();
        
        // 処理完了
        dailyLimitProcessing = false;
        
    } catch (error) {
        console.error('❌ 出勤処理エラー:', error);
        alert('出勤処理中にエラーが発生しました。\n' + error.message);
        
        // ⭐ エラー時は必ずボタンを復元
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

// employee.jsのupdateClockButtons関数を以下で置き換え
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

// ボタンを無効化するヘルパー関数
function disableButton(button, text) {
    if (button) {
        button.disabled = true;
        button.textContent = text;
        button.style.backgroundColor = '#6c757d'; // グレー
        button.style.color = 'white';
        button.style.opacity = '0.6';
        button.style.cursor = 'not-allowed';
    }
}

// 全ボタンをリセットするヘルパー関数
function resetAllButtons() {
    const buttons = [
        document.getElementById('clock-in-btn'),
        document.getElementById('clock-out-btn'),
        document.getElementById('break-start-btn'),
        document.getElementById('break-end-btn')
    ];
    
    buttons.forEach(btn => {
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.style.backgroundColor = '';
            btn.style.color = '';
        }
    });
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

// employee.jsの最後に以下の関数を追加

// デバッグ用：現在の状態を強制チェックする関数
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
    
    // 今日の日付チェック
    const today = new Date().toISOString().split('T')[0];
    console.log('今日の日付:', today);
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

// 緊急時の手動状態設定関数
function setManualWorkingState(siteName = 'BRANU') {
    console.log('🛠️ 手動で勤務中状態を設定');
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // 手動でtodayAttendanceDataを作成
    todayAttendanceData = {
        id: 'manual_' + Date.now(),
        userId: currentUser?.uid,
        userEmail: currentUser?.email,
        date: today,
        siteName: siteName,
        startTime: '8:56:50', // 画面に表示されている時間
        status: 'working',
        notes: '打刻1日目'
    };
    
    currentAttendanceId = todayAttendanceData.id;
    
    // UI更新
    updateClockButtons('working');
    updateStatusDisplay('working', todayAttendanceData);
    
    console.log('✅ 手動状態設定完了:', todayAttendanceData);
}
