/**
 * 勤怠管理システム - ユーティリティ関数（Firebase対応版）
 * 
 * このファイルには、システム全体で使用される共通の関数が含まれています。
 * 日付処理、時間計算、Firebase操作などの基本的な機能を提供します。
 */

console.log('utils.js loaded - Firebase version');

// ================ データアクセス関連（Firebase対応版） ================

/**
 * Firebase Authから現在のユーザー情報を取得
 * @returns {Object|null} ログイン中のユーザー情報
 */
function getCurrentUser() {
    // グローバルスコープの currentUser を参照（login.js で設定）
    return window.currentUser || null;
}

/**
 * 勤怠記録をFirestoreから取得
 * @param {string} userId ユーザーID（オプション）
 * @param {string} date 日付フィルター（オプション）
 * @returns {Promise<Array>} 勤怠記録の配列
 */
async function getAttendanceRecords(userId = null, date = null) {
    try {
        let query = db.collection('attendance');
        
        // ユーザーIDでフィルタ
        if (userId) {
            query = query.where('userId', '==', userId);
        }
        
        // 日付でフィルタ
        if (date) {
            query = query.where('date', '==', date);
        }
        
        // 日付の降順でソート
        query = query.orderBy('date', 'desc');
        
        const querySnapshot = await query.get();
        
        const records = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Timestampを文字列に変換
            clockInTime: doc.data().clockInTime?.toDate()?.toISOString() || null,
            clockOutTime: doc.data().clockOutTime?.toDate()?.toISOString() || null,
        }));
        
        // 各レコードの休憩データも取得
        await Promise.all(records.map(async (record) => {
            const breakQuery = await db.collection('breaks')
                .where('attendanceId', '==', record.id)
                .orderBy('startTime')
                .get();
            
            record.breakTimes = breakQuery.docs.map(breakDoc => {
                const breakData = breakDoc.data();
                return {
                    id: breakDoc.id,
                    start: breakData.startTime?.toDate()?.toISOString(),
                    end: breakData.endTime?.toDate()?.toISOString()
                };
            });
        }));
        
        return records;
    } catch (error) {
        console.error('勤怠記録取得エラー:', error);
        throw error;
    }
}

/**
 * ユーザーデータをFirestoreから取得
 * @param {string} role ロールフィルター（オプション）
 * @returns {Promise<Array>} ユーザー情報の配列
 */
async function getUsers(role = null) {
    try {
        let query = db.collection('users');
        
        // ロールでフィルタ
        if (role) {
            query = query.where('role', '==', role);
        }
        
        // 表示名でソート
        query = query.orderBy('displayName');
        
        const querySnapshot = await query.get();
        
        const users = querySnapshot.docs.map(doc => ({
            id: doc.id,
            uid: doc.id, // Firebase Auth UID
            ...doc.data()
        }));
        
        return users;
    } catch (error) {
        console.error('ユーザーデータ取得エラー:', error);
        throw error;
    }
}

/**
 * 特定のユーザー情報をFirestoreから取得
 * @param {string} userId ユーザーID (Firebase UID)
 * @returns {Promise<Object|null>} ユーザー情報
 */
async function getUserById(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (userDoc.exists) {
            return {
                id: userDoc.id,
                uid: userDoc.id,
                ...userDoc.data()
            };
        } else {
            return null;
        }
    } catch (error) {
        console.error('ユーザー取得エラー:', error);
        throw error;
    }
}

/**
 * ユーザーの現場履歴を更新
 * @param {string} userId ユーザーID
 * @param {string} siteName 現場名
 * @returns {Promise<void>}
 */
async function updateSiteHistory(userId, siteName) {
    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            const currentHistory = userData.siteHistory || [];
            
            // 既に履歴にない場合のみ追加
            if (!currentHistory.includes(siteName)) {
                await userRef.update({
                    siteHistory: firebase.firestore.FieldValue.arrayUnion(siteName),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }
    } catch (error) {
        console.error('現場履歴更新エラー:', error);
        throw error;
    }
}

// ================ 日付/時間処理関連 ================

/**
 * 日付をフォーマット（YYYY/MM/DD）
 * @param {string|Date|firebase.firestore.Timestamp} dateInput 日付
 * @returns {string} フォーマットされた日付
 */
function formatDate(dateInput) {
    let date;
    
    if (!dateInput) return '-';
    
    // Firebase Timestampの場合
    if (dateInput.toDate && typeof dateInput.toDate === 'function') {
        date = dateInput.toDate();
    } else if (typeof dateInput === 'string') {
        date = new Date(dateInput);
    } else if (dateInput instanceof Date) {
        date = dateInput;
    } else {
        return '-';
    }
    
    if (isNaN(date.getTime())) return '-';
    
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}/${m}/${d}`;
}

/**
 * 時刻をフォーマット（HH:MM）
 * @param {string|Date|firebase.firestore.Timestamp} dateTimeInput 日時
 * @returns {string} フォーマットされた時刻
 */
function formatTime(dateTimeInput) {
    let date;
    
    if (!dateTimeInput) return '-';
    
    // Firebase Timestampの場合
    if (dateTimeInput.toDate && typeof dateTimeInput.toDate === 'function') {
        date = dateTimeInput.toDate();
    } else if (typeof dateTimeInput === 'string') {
        date = new Date(dateTimeInput);
    } else if (dateTimeInput instanceof Date) {
        date = dateTimeInput;
    } else {
        return '-';
    }
    
    if (isNaN(date.getTime())) return '-';
    
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * 時間差を計算（時間分形式に変換）
 * @param {string|Date|firebase.firestore.Timestamp} startTime 開始時間
 * @param {string|Date|firebase.firestore.Timestamp} endTime 終了時間
 * @returns {Object} 時間差の情報（hours, minutes, totalMinutes, formatted）
 */
function calculateTimeDiff(startTime, endTime) {
    try {
        let start, end;
        
        // Firebase Timestampまたは文字列をDateオブジェクトに変換
        if (startTime && startTime.toDate) {
            start = startTime.toDate();
        } else {
            start = new Date(startTime);
        }
        
        if (endTime && endTime.toDate) {
            end = endTime.toDate();
        } else {
            end = new Date(endTime);
        }
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return { hours: 0, minutes: 0, totalMinutes: 0, formatted: '0時間0分' };
        }
        
        const diffMs = end - start;
        if (diffMs < 0) {
            return { hours: 0, minutes: 0, totalMinutes: 0, formatted: '0時間0分' };
        }
        
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        return {
            hours: diffHrs,
            minutes: diffMins,
            totalMinutes: diffHrs * 60 + diffMins,
            formatted: `${diffHrs}時間${diffMins}分`
        };
    } catch (error) {
        console.error('時間差計算エラー:', error);
        return { hours: 0, minutes: 0, totalMinutes: 0, formatted: '0時間0分' };
    }
}

/**
 * 休憩時間の合計を計算
 * @param {Array} breakTimes 休憩時間の配列
 * @returns {Object} 合計休憩時間の情報
 */
function calculateTotalBreakTime(breakTimes) {
    if (!breakTimes || !Array.isArray(breakTimes) || breakTimes.length === 0) {
        return { hours: 0, minutes: 0, totalMinutes: 0, formatted: '0時間0分' };
    }
    
    let totalMinutes = 0;
    
    breakTimes.forEach(breakTime => {
        if (breakTime.start && breakTime.end) {
            const diff = calculateTimeDiff(breakTime.start, breakTime.end);
            totalMinutes += diff.totalMinutes;
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

/**
 * 実労働時間を計算（休憩時間を差し引く）
 * @param {string|Date|firebase.firestore.Timestamp} clockIn 出勤時間
 * @param {string|Date|firebase.firestore.Timestamp} clockOut 退勤時間
 * @param {Array} breakTimes 休憩時間の配列
 * @returns {Object} 実労働時間の情報
 */
function calculateWorkingTime(clockIn, clockOut, breakTimes) {
    if (!clockIn || !clockOut) {
        return { hours: 0, minutes: 0, totalMinutes: 0, formatted: '-' };
    }
    
    // 総時間
    const totalTime = calculateTimeDiff(clockIn, clockOut);
    
    // 休憩時間
    const breakTime = calculateTotalBreakTime(breakTimes);
    
    // 実労働時間
    const workingMinutes = Math.max(0, totalTime.totalMinutes - breakTime.totalMinutes);
    
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

/**
 * datetime-local入力用のフォーマット
 * @param {string|Date|firebase.firestore.Timestamp} dateInput 日時
 * @returns {string} datetime-local形式の文字列
 */
function formatDateTimeLocal(dateInput) {
    if (!dateInput) return '';
    
    let date;
    
    // Firebase Timestampの場合
    if (dateInput.toDate && typeof dateInput.toDate === 'function') {
        date = dateInput.toDate();
    } else if (typeof dateInput === 'string') {
        date = new Date(dateInput);
    } else if (dateInput instanceof Date) {
        date = dateInput;
    } else {
        return '';
    }
    
    if (isNaN(date.getTime())) return '';
    
    // タイムゾーンオフセットを考慮
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().slice(0, 16);
}

/**
 * 現在の時刻をdatetime-local形式で取得
 * @returns {string} 現在時刻のdatetime-local形式
 */
function getCurrentDateTimeLocal() {
    const now = new Date();
    return formatDateTimeLocal(now);
}

/**
 * 今日の日付をYYYY-MM-DD形式で取得
 * @returns {string} 今日の日付
 */
function getTodayString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

/**
 * 日本語の曜日を取得
 * @param {Date} date 日付オブジェクト
 * @returns {string} 曜日（月、火、水...）
 */
function getJapaneseDayOfWeek(date) {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[date.getDay()];
}

// ================ UI操作関連 ================

/**
 * 指定されたIDの要素を取得（存在チェック付き）
 * @param {string} id 要素のID
 * @returns {HTMLElement|null} 取得した要素
 */
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with id "${id}" not found`);
    }
    return element;
}

/**
 * 画面切り替え関数（Firebase対応版）
 * @param {string} page 表示するページ名（login/register/employee/admin）
 */
function showPage(page) {
    console.log(`画面切り替え: ${page}`);

    // すべての画面を非表示
    document.querySelectorAll('#login-page, #employee-page, #admin-page, #register-page').forEach(el => {
        el.classList.add('hidden');
    });

    // 指定した画面を表示
    const pageElement = document.getElementById(`${page}-page`);
    if (pageElement) {
        pageElement.classList.remove('hidden');
        console.log(`${page}-page を表示`);
    } else {
        console.error(`ページ要素が見つかりません: ${page}-page`);
        // フォールバックとしてログイン画面を表示
        const loginPage = document.getElementById('login-page');
        if (loginPage) {
            loginPage.classList.remove('hidden');
            console.log('ログイン画面にフォールバック');
        }
        return;
    }

    // ページごとの初期化処理
    if (page === 'login') {
        const usernameInput = getElement('username');
        if (usernameInput) usernameInput.focus();
    } else if (page === 'register') {
        const usernameInput = getElement('reg-username');
        if (usernameInput) usernameInput.focus();
    }
}

/**
 * 認証チェック（Firebase対応版）
 * @param {string} requiredRole 必要な権限
 * @returns {boolean} 認証結果
 */
function checkAuth(requiredRole) {
    const user = getCurrentUser();
    
    if (!user) {
        console.log('ユーザーが認証されていません');
        showPage('login');
        return false;
    }
    
    if (requiredRole && user.role !== requiredRole) {
        console.log(`権限不足: 要求=${requiredRole}, 実際=${user.role}`);
        // 権限がない場合は適切な画面にリダイレクト
        if (user.role === 'admin') {
            showPage('admin');
        } else if (user.role === 'employee') {
            showPage('employee');
        } else {
            showPage('login');
        }
        return false;
    }
    
    return true;
}

/**
 * 現在時刻の表示と更新
 */
function updateDateTime() {
    const now = new Date();
    const dateOptions = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        weekday: 'long' 
    };
    const timeOptions = { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
    };
    
    const dateEl = getElement('current-date');
    const timeEl = getElement('current-time');
    
    if (dateEl) dateEl.textContent = now.toLocaleDateString('ja-JP', dateOptions);
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('ja-JP', timeOptions);
}

/**
 * ローディング状態を表示/非表示
 * @param {HTMLElement} element 対象要素
 * @param {boolean} isLoading ローディング中かどうか
 */
function setLoadingState(element, isLoading) {
    if (!element) return;
    
    if (isLoading) {
        element.classList.add('loading');
        element.disabled = true;
    } else {
        element.classList.remove('loading');
        element.disabled = false;
    }
}

/**
 * トースト通知を表示
 * @param {string} message メッセージ
 * @param {string} type 種類（success, error, warning）
 * @param {number} duration 表示時間（ミリ秒）
 */
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, duration);
}

// ================ Firebase Firestore ヘルパー関数 ================

/**
 * Firebase Timestampを作成
 * @param {Date|string|number} dateInput 日付入力
 * @returns {firebase.firestore.Timestamp} Firebase Timestamp
 */
function createTimestamp(dateInput) {
    if (!dateInput) return null;
    
    let date;
    if (typeof dateInput === 'string') {
        date = new Date(dateInput);
    } else if (typeof dateInput === 'number') {
        date = new Date(dateInput);
    } else if (dateInput instanceof Date) {
        date = dateInput;
    } else {
        return null;
    }
    
    return firebase.firestore.Timestamp.fromDate(date);
}

/**
 * バッチ処理でFirestoreの操作を実行
 * @param {Array} operations 操作の配列
 * @returns {Promise<void>}
 */
async function executeBatch(operations) {
    const batch = db.batch();
    
    operations.forEach(operation => {
        switch (operation.type) {
            case 'set':
                batch.set(operation.ref, operation.data);
                break;
            case 'update':
                batch.update(operation.ref, operation.data);
                break;
            case 'delete':
                batch.delete(operation.ref);
                break;
        }
    });
    
    return batch.commit();
}

/**
 * デバッグ用：Firestoreのデータを整理して表示
 * @param {string} collection コレクション名
 * @param {number} limit 取得件数制限
 */
async function debugFirestoreData(collection, limit = 10) {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        console.warn('デバッグ機能は本番環境では無効です');
        return;
    }
    
    try {
        const query = db.collection(collection).limit(limit);
        const snapshot = await query.get();
        
        console.log(`=== ${collection} コレクション (${snapshot.size}件) ===`);
        snapshot.forEach(doc => {
            console.log(`ID: ${doc.id}`, doc.data());
        });
        console.log('=====================================');
    } catch (error) {
        console.error(`${collection} デバッグエラー:`, error);
    }
}
