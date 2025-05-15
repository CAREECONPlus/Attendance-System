console.log('employee.js loaded');

/**
 * 勤怠管理システム - 従業員機能（Firebase対応版）
 * 
 * このファイルには、従業員画面の機能に関連する関数が含まれています。
 * 出退勤、休憩、作業記録などの処理を担当します。
 */

// ================ 従業員側の機能 ================

/**
 * 従業員画面の初期化処理（Firebase対応版）
 * 全てのイベントリスナーを設定し、初期データを読み込みます
 */
async function initEmployeePage() {
    console.log('従業員ページの初期化開始');
    
    // 権限チェック
    if (!checkAuth('employee')) return;

    // 基本的なUI初期化
    setupEmployeeBasics();
    
    // 残りの初期化を少し遅延させて実行
    setTimeout(async function() {
        try {
            // 現在の日時を表示
            updateDateTime();
            
            // 勤怠状況の確認
            await checkTodayAttendance();
            
            // 最近の記録を表示
            await loadRecentRecords();
            
            // イベントハンドラを設定
            setupEmployeeEvents();
            
            // 現場オプションの読み込み
            await populateSiteOptions();
            
            // 1秒ごとに時刻を更新するタイマーを設定
            setInterval(updateDateTime, 1000);
            
            console.log('従業員ページの詳細初期化完了');
        } catch (error) {
            console.error('従業員ページ初期化エラー:', error);
            showError('データの読み込みに失敗しました');
        }
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
            userNameEl.textContent = currentUser.displayName || currentUser.email;
            console.log('ユーザー名を表示:', currentUser.displayName);
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
            signOut();
        });
    }
}

/**
 * 勤務状況をチェックしてボタンの有効/無効状態を更新する（視覚化改善版）
 */
async function checkTodayAttendance() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        console.log('currentUser が取得できません');
        return;
    }

    console.log('勤務状況チェック開始:', currentUser);

    try {
        const today = new Date().toISOString().split('T')[0];
        console.log('今日の日付:', today);
        
        // 前日までの未完了の勤怠記録を確認し、必要に応じて自動終了処理
        await handleIncompleteRecords(currentUser.uid, today);

        // 今日の記録を検索
        console.log('今日の記録を検索中...');
        const query = await db.collection('attendance')
            .where('userId', '==', currentUser.uid)
            .where('date', '==', today)
            .limit(1)
            .get();

        const clockInBtn = getElement('clock-in-btn');
        const clockOutBtn = getElement('clock-out-btn');
        const breakStartBtn = getElement('break-start-btn');
        const breakEndBtn = getElement('break-end-btn');
        const clockStatus = getElement('clock-status');

        // すべてのボタンのクラスをリセット
        [clockInBtn, clockOutBtn, breakStartBtn, breakEndBtn].forEach(btn => {
            if (btn) {
                btn.disabled = true;
                btn.classList.remove('btn-primary', 'btn-secondary', 'btn-warning', 'available', 'current-action');
            }
        });

        // 基本的なクラスを設定
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
                console.log('出勤ボタンを有効化・強調');
            }
            return;
        }

        const todayRecord = query.docs[0];
        const attendanceData = { id: todayRecord.id, ...todayRecord.data() };
        console.log('今日の記録:', attendanceData);

        // 休憩データを取得
        console.log('休憩データ取得中...');
        const breakQuery = await db.collection('breaks')
            .where('attendanceId', '==', attendanceData.id)
            .where('endTime', '==', null)
            .get();

        const isOnBreak = !breakQuery.empty;
        console.log('休憩中？:', isOnBreak);

        if (attendanceData.clockInTime && !attendanceData.clockOutTime) {
            // 出勤済み・退勤前
            if (isOnBreak) {
                // 休憩中
                const currentBreak = breakQuery.docs[0].data();
                const breakStart = formatTime(currentBreak.startTime.toDate().toISOString());
                
                if (clockStatus) {
                    clockStatus.innerHTML = `
                        <div class="status-break">現在休憩中です</div>
                        <div class="status-detail">出勤: ${formatTime(attendanceData.clockInTime.toDate().toISOString())}</div>
                        <div class="status-detail">休憩開始: ${breakStart}</div>
                    `;
                }
                
                // 出勤ボタン：完了状態（グレー）
                if (clockInBtn) {
                    clockInBtn.classList.add('current-action');
                    clockInBtn.textContent = '出勤済み';
                }
                
                // 休憩終了ボタンを有効化・強調
                if (breakEndBtn) {
                    breakEndBtn.disabled = false;
                    breakEndBtn.classList.add('available');
                    console.log('休憩終了ボタンを有効化・強調');
                }
            } else {
                // 勤務中
                if (clockStatus) {
                    clockStatus.innerHTML = `
                        <div class="status-working">現在勤務中です</div>
                        <div class="status-detail">出勤: ${formatTime(attendanceData.clockInTime.toDate().toISOString())}</div>
                    `;
                }
                
                // 出勤ボタン：完了状態（グレー）
                if (clockInBtn) {
                    clockInBtn.classList.add('current-action');
                    clockInBtn.textContent = '出勤済み';
                }
                
                // 退勤ボタンを有効化・強調（青）
                if (clockOutBtn) {
                    clockOutBtn.disabled = false;
                    clockOutBtn.classList.remove('btn-secondary');
                    clockOutBtn.classList.add('btn-primary', 'available');
                    console.log('退勤ボタンを有効化・強調');
                }
                
                // 休憩開始ボタンを有効化
                if (breakStartBtn) {
                    breakStartBtn.disabled = false;
                    console.log('休憩開始ボタンを有効化');
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
                    <div class="status-detail">出勤: ${formatTime(attendanceData.clockInTime.toDate().toISOString())}</div>
                    <div class="status-detail">退勤: ${formatTime(attendanceData.clockOutTime.toDate().toISOString())}</div>
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
            
            console.log('本日の勤務完了');
        }
    } catch (error) {
        console.error('勤怠状況チェックエラー:', error);
        showError('勤怠状況の確認に失敗しました: ' + error.message);
        
        // エラー時は出勤ボタンのみ有効化
        const clockInBtn = getElement('clock-in-btn');
        if (clockInBtn) {
            clockInBtn.disabled = false;
            clockInBtn.classList.add('btn-primary', 'available');
        }
    }
}

/**
 * 出勤処理（視覚化改善版）
 */
async function clockIn() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const siteSelect = getElement('site-name');
    let siteName = siteSelect?.value || '';

    if (siteName === 'other') {
        siteName = getElement('other-site')?.value || '';
    }

    if (!siteName) {
        showError('現場名を選択または入力してください');
        return;
    }

    const notes = getElement('work-notes')?.value || '';
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    try {
        // ボタンの視覚的フィードバック
        const clockInBtn = getElement('clock-in-btn');
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
        
        // UI更新（ボタンの色が自動で変わる）
        await checkTodayAttendance();
        await loadRecentRecords();
        
        showSuccess('出勤を記録しました');
        console.log('出勤記録完了');
    } catch (error) {
        console.error('出勤エラー:', error);
        showError('出勤の記録に失敗しました');
    } finally {
        // エラー時のボタン復旧
        const clockInBtn = getElement('clock-in-btn');
        if (clockInBtn && clockInBtn.textContent === '処理中...') {
            clockInBtn.textContent = '出勤';
            clockInBtn.disabled = false;
            clockInBtn.classList.add('available');
        }
    }
}

/**
 * 退勤処理（Firebase対応版）
 */
async function clockIn() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const siteSelect = getElement('site-name');
    let siteName = siteSelect?.value || '';

    if (siteName === 'other') {
        siteName = getElement('other-site')?.value || '';
    }

    if (!siteName) {
        showError('現場名を選択または入力してください');
        return;
    }

    const notes = getElement('work-notes')?.value || '';
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    try {
        // ローディング削除：ボタン無効化のみ
        const clockInBtn = getElement('clock-in-btn');
        if (clockInBtn) {
            clockInBtn.disabled = true;
            clockInBtn.textContent = '処理中...';
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
        // ボタンを元に戻す
        const clockInBtn = getElement('clock-in-btn');
        if (clockInBtn) {
            clockInBtn.disabled = false;
            clockInBtn.textContent = '出勤';
        }
    }
}

/**
 * 退勤処理（ローディングUI削除版）
 */
async function clockOut() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const today = new Date().toISOString().split('T')[0];

    try {
        // ローディング削除：ボタン無効化のみ
        const clockOutBtn = getElement('clock-out-btn');
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

        const notes = getElement('work-notes')?.value || '';
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
        // ボタンを元に戻す
        const clockOutBtn = getElement('clock-out-btn');
        if (clockOutBtn) {
            clockOutBtn.disabled = false;
            clockOutBtn.textContent = '退勤';
        }
    }
}

/**
 * 直近の記録を表示（エラーハンドリング改善版）
 */
async function loadRecentRecords() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    try {
        // 現在のユーザーの記録を直近5件取得
        const querySnapshot = await db.collection('attendance')
            .where('userId', '==', currentUser.uid)
            .orderBy('date', 'desc')
            .limit(5)
            .get();
        
        const recentList = getElement('recent-list');
        if (!recentList) return;
        
        recentList.innerHTML = '';
        
        if (querySnapshot.empty) {
            // 記録がない場合はエラーではなく、適切なメッセージを表示
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
                    ${record.clockInTime ? formatTime(record.clockInTime.toDate().toISOString()) : '-'} 〜 
                    ${record.clockOutTime ? formatTime(record.clockOutTime.toDate().toISOString()) : '勤務中'}
                </div>
                ${breakTimeStr}
                ${totalTimeStr}
            `;
            
            recentList.appendChild(recordDiv);
        }
        
        console.log('最近の記録を表示完了');
    } catch (error) {
        console.error('最近の記録読み込みエラー:', error);
        
        // エラー時も適切なメッセージを表示
        const recentList = getElement('recent-list');
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

/**
 * 休憩開始処理（Firebase対応版）
 */
async function startBreak() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const today = new Date().toISOString().split('T')[0];

    try {
        // ローディング表示
        const breakStartBtn = getElement('break-start-btn');
        if (breakStartBtn) {
            breakStartBtn.classList.add('loading');
            breakStartBtn.disabled = true;
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
        // ローディング解除
        const breakStartBtn = getElement('break-start-btn');
        if (breakStartBtn) {
            breakStartBtn.classList.remove('loading');
            breakStartBtn.disabled = false;
        }
    }
}

/**
 * 休憩終了処理（Firebase対応版）
 */
async function endBreak() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const today = new Date().toISOString().split('T')[0];

    try {
        // ローディング表示
        const breakEndBtn = getElement('break-end-btn');
        if (breakEndBtn) {
            breakEndBtn.classList.add('loading');
            breakEndBtn.disabled = true;
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
        // ローディング解除
        const breakEndBtn = getElement('break-end-btn');
        if (breakEndBtn) {
            breakEndBtn.classList.remove('loading');
            breakEndBtn.disabled = false;
        }
    }
}

/**
 * 現場履歴を保存（Firebase対応版）
 * @param {string} siteName 現場名
 */
async function saveSiteHistory(siteName) {
    if (!siteName) return;
    
    // 既定の現場を除外
    const defaultSites = [
        "新宿オフィスビル改修工事",
        "渋谷マンション建設現場",
        "横浜倉庫補修工事"
    ];
    
    if (defaultSites.includes(siteName)) return;
    
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) return;

        // ユーザーのsiteHistoryを更新
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
 * プルダウンに現場履歴を反映（Firebase対応版）
 */
async function populateSiteOptions() {
    const select = getElement("site-name");
    if (!select) return;
    
    try {
        const currentUser = getCurrentUser();
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

        // 履歴を追加（定義済みと重複しないもののみ）
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
        showError('現場選択肢の読み込みに失敗しました');
    }
}

/**
 * 直近の記録を表示（Firebase対応版）
 */
async function loadRecentRecords() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    try {
        // 現在のユーザーの記録を直近5件取得
        const querySnapshot = await db.collection('attendance')
            .where('userId', '==', currentUser.uid)
            .orderBy('date', 'desc')
            .limit(5)
            .get();
        
        const recentList = getElement('recent-list');
        if (!recentList) return;
        
        recentList.innerHTML = '';
        
        if (querySnapshot.empty) {
            recentList.innerHTML = '<div class="no-records">記録がありません</div>';
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
                    ${record.clockInTime ? formatTime(record.clockInTime.toDate().toISOString()) : '-'} 〜 
                    ${record.clockOutTime ? formatTime(record.clockOutTime.toDate().toISOString()) : '勤務中'}
                </div>
                ${breakTimeStr}
                ${totalTimeStr}
            `;
            
            recentList.appendChild(recordDiv);
        }
        
        console.log('最近の記録を表示完了');
    } catch (error) {
        console.error('最近の記録読み込みエラー:', error);
        showError('最近の記録の読み込みに失敗しました');
    }
}

/**
 * エラーメッセージを表示
 * @param {string} message エラーメッセージ
 */
function showError(message) {
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

// 従業員画面のイベント設定は基本的にそのまま使用可能
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

// DOMが読み込まれた時に従業員ページを初期化（Firebase Auth対応版）
firebase.auth().onAuthStateChanged(async function(user) {
    if (user) {
        // ユーザーの役割を確認
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists && userDoc.data().role === 'employee') {
            showPage('employee');
            initEmployeePage();
        }
    }
});
