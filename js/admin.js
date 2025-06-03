/**
 * 管理者画面の初期化処理（Firebase対応版）
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
 * 従業員リストの読み込み（Firebase対応版）
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
 * 現場リストの読み込み（Firebase対応版）
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
 * 勤怠データの読み込み（Firebase対応版）
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
 * 勤怠記録の保存（Firebase対応版）
 */
async function saveAttendanceRecord() {
    const recordId = getElement('edit-id').value;
    const date = getElement('edit-date').value;
    const clockIn = getElement('edit-clock-in').value;
    const clockOut = getElement('edit-clock-out').value;
    const siteName = getElement('edit-site').value;
    const notes = getElement('edit-notes').value;
    
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
        getElement('edit-modal').classList.add('hidden');
        
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
 * 勤怠記録の削除（Firebase対応版）
 */
async function deleteAttendanceRecord() {
    const recordId = getElement('edit-id').value;
    if (!recordId) return;
    
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
        getElement('edit-modal').classList.add('hidden');
        
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
 * 休憩時間を追加（Firebase対応版）
 */
async function addBreakTime() {
    const attendanceId = getElement('edit-id').value;
    const breakStart = getElement('break-start').value;
    const breakEnd = getElement('break-end').value;
    
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
        getElement('break-modal').classList.add('hidden');
        
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
 * 休憩時間を削除（Firebase対応版）
 * @param {number} index 削除する休憩時間のインデックス
 */
async function removeBreakTime(index) {
    const attendanceId = getElement('edit-id').value;
    if (!attendanceId) return;
    
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
