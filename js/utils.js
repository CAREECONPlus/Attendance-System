/**
 * 勤怠管理システム - ユーティリティ関数
 * 
 * このファイルには、システム全体で使用される共通の関数が含まれています。
 * 日付処理、時間計算、データアクセスなどの基本的な機能を提供します。
 */

// ================ データアクセス関連 ================

/**
 * ローカルストレージからユーザー情報を取得
 * @returns {Object|null} ログイン中のユーザー情報
 */
function getCurrentUser() {
    const userJSON = localStorage.getItem('currentUser');
    return userJSON ? JSON.parse(userJSON) : null;
}

/**
 * 勤怠記録をローカルストレージから取得
 * @returns {Array} 勤怠記録の配列
 */
function getAttendanceRecords() {
    const recordsJSON = localStorage.getItem('attendanceRecords');
    
    if (recordsJSON) {
        return JSON.parse(recordsJSON);
    } else {
        // サンプルデータを作成
        const sampleData = createSampleData();
        localStorage.setItem('attendanceRecords', JSON.stringify(sampleData));
        return sampleData;
    }
}

/**
 * サンプルデータ生成
 * @returns {Array} サンプル勤怠データの配列
 */
function createSampleData() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);
    
    return [
        {
            id: 1,
            userId: 2,
            userName: '山田太郎',
            date: yesterday.toISOString().split('T')[0],
            clockIn: new Date(yesterday.setHours(8, 0, 0)).toISOString(),
            clockOut: new Date(yesterday.setHours(17, 30, 0)).toISOString(),
            siteName: '新宿オフィスビル改修工事',
            notes: '3階の電気配線工事完了',
            breakTimes: [
                {
                    start: new Date(yesterday.setHours(12, 0, 0)).toISOString(),
                    end: new Date(yesterday.setHours(13, 0, 0)).toISOString()
                }
            ]
        },
        {
            id: 2,
            userId: 3,
            userName: '佐藤次郎',
            date: yesterday.toISOString().split('T')[0],
            clockIn: new Date(yesterday.setHours(8, 15, 0)).toISOString(),
            clockOut: new Date(yesterday.setHours(18, 0, 0)).toISOString(),
            siteName: '渋谷マンション建設現場',
            notes: '基礎工事の確認',
            breakTimes: [
                {
                    start: new Date(yesterday.setHours(12, 0, 0)).toISOString(),
                    end: new Date(yesterday.setHours(13, 0, 0)).toISOString()
                }
            ]
        },
        {
            id: 3,
            userId: 4,
            userName: '鈴木三郎',
            date: twoDaysAgo.toISOString().split('T')[0],
            clockIn: new Date(twoDaysAgo.setHours(7, 50, 0)).toISOString(),
            clockOut: new Date(twoDaysAgo.setHours(16, 45, 0)).toISOString(),
            siteName: '横浜倉庫補修工事',
            notes: '屋根修理完了',
            breakTimes: [
                {
                    start: new Date(twoDaysAgo.setHours(12, 0, 0)).toISOString(),
                    end: new Date(twoDaysAgo.setHours(12, 45, 0)).toISOString()
                }
            ]
        }
    ];
}

/**
 * ユーザーデータの取得
 * @returns {Array} ユーザー情報の配列
 */
function getUsers() {
    try {
        const usersJSON = localStorage.getItem('users');
        
        if (usersJSON) {
            return JSON.parse(usersJSON);
        } else {
            // 初期管理者・従業員アカウントを作成
            const initialUsers = [
                {
                    id: 1,
                    username: 'admin',
                    password: 'admin',
                    fullName: '管理者',
                    role: 'admin'
                },
                {
                    id: 2,
                    username: 'employee',
                    password: 'employee',
                    fullName: '山田太郎',
                    role: 'employee'
                },
                {
                    id: 3,
                    username: 'sato',
                    password: 'sato123',
                    fullName: '佐藤次郎',
                    role: 'employee'
                },
                {
                    id: 4,
                    username: 'suzuki',
                    password: 'suzuki123',
                    fullName: '鈴木三郎',
                    role: 'employee'
                }
            ];
            localStorage.setItem('users', JSON.stringify(initialUsers));
            return initialUsers;
        }
    } catch (error) {
        console.error('ユーザーデータ取得エラー:', error);
        // エラー時はデフォルトユーザーを返す
        return [
            {
                id: 1,
                username: 'admin',
                password: 'admin',
                fullName: '管理者',
                role: 'admin'
            },
            {
                id: 2,
                username: 'employee',
                password: 'employee',
                fullName: '山田太郎',
                role: 'employee'
            }
        ];
    }
}

/**
 * ユーザー登録処理
 * @param {string} username ユーザーID
 * @param {string} password パスワード
 * @param {string} fullName 氏名
 * @param {string} role 役割（admin/employee）
 * @returns {Object} 登録結果（success, message, user）
 */
function registerUser(username, password, fullName, role) {
    console.log('登録開始:', username);
    
    // 直接ローカルストレージから取得
    try {
        // ユーザー名などの空白を除去
        username = username.trim();
        password = password.trim();
        fullName = fullName.trim();
        
        // ローカルストレージから直接取得
        const usersJSON = localStorage.getItem('users');
        let users = [];
        
        if (usersJSON) {
            try {
                users = JSON.parse(usersJSON);
                console.log('既存ユーザー読み込み:', users.length);
            } catch (e) {
                console.error('既存ユーザーの解析エラー:', e);
                users = [];
            }
        }
        
        // 重複チェック
        const existingUser = users.find(u => u.username === username);
        if (existingUser) {
            console.log('重複ユーザー:', username);
            return {
                success: false,
                message: 'このユーザーIDは既に使用されています'
            };
        }
        
        // 新しいID生成
        let newId = 1;
        if (users.length > 0) {
            // IDの最大値を取得
            const maxId = Math.max(...users.map(u => Number(u.id) || 0));
            newId = maxId + 1;
        }
        
        const newUser = {
            id: newId,
            username: username,
            password: password,
            fullName: fullName,
            role: role || 'employee'
        };
        
        // 追加
        users.push(newUser);
        
        // 保存
        localStorage.setItem('users', JSON.stringify(users));
        console.log('ユーザー保存完了:', newUser.username, '(合計:', users.length, ')');
        
        return {
            success: true,
            message: '登録が完了しました',
            user: newUser
        };
    } catch (error) {
        console.error('登録エラー:', error);
        return {
            success: false,
            message: '登録処理中にエラーが発生しました'
        };
    }
}

// ================ 日付/時間処理関連 ================

/**
 * 日付をフォーマット（YYYY/MM/DD）
 * @param {string} dateStr 日付文字列
 * @returns {string} フォーマットされた日付
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}/${m}/${d}`;
}

/**
 * 時刻をフォーマット（HH:MM）
 * @param {string} dateTimeStr 日時文字列
 * @returns {string} フォーマットされた時刻
 */
function formatTime(dateTimeStr) {
    const date = new Date(dateTimeStr);
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * 時間差を計算（ミリ秒 → 時間分形式に変換）
 * @param {string} startTime 開始時間
 * @param {string} endTime 終了時間
 * @returns {Object} 時間差の情報（hours, minutes, totalMinutes, formatted）
 */
function calculateTimeDiff(startTime, endTime) {
    const diffMs = new Date(endTime) - new Date(startTime);
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return {
        hours: diffHrs,
        minutes: diffMins,
        totalMinutes: diffHrs * 60 + diffMins,
        formatted: `${diffHrs}時間${diffMins}分`
    };
}

/**
 * 休憩時間の合計を計算
 * @param {Array} breakTimes 休憩時間の配列
 * @returns {Object} 合計休憩時間の情報
 */
function calculateTotalBreakTime(breakTimes) {
    if (!breakTimes || !breakTimes.length) return { hours: 0, minutes: 0, totalMinutes: 0, formatted: '0時間0分' };
    
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
 * @param {string} clockIn 出勤時間
 * @param {string} clockOut 退勤時間
 * @param {Array} breakTimes 休憩時間の配列
 * @returns {Object} 実労働時間の情報
 */
function calculateWorkingTime(clockIn, clockOut, breakTimes) {
    if (!clockIn || !clockOut) return { hours: 0, minutes: 0, totalMinutes: 0, formatted: '-' };
    
    // 総時間
    const totalTime = calculateTimeDiff(clockIn, clockOut);
    
    // 休憩時間
    const breakTime = calculateTotalBreakTime(breakTimes);
    
    // 実労働時間
    const workingMinutes = totalTime.totalMinutes - breakTime.totalMinutes;
    if (workingMinutes <= 0) return { hours: 0, minutes: 0, totalMinutes: 0, formatted: '0時間0分' };
    
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
 * @param {string} date 日時文字列
 * @returns {string} datetime-local形式の文字列
 */
function formatDateTimeLocal(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().slice(0, 16);
}

/**
 * 現在の時刻をdatetime-local形式で取得
 * @returns {string} 現在時刻のdatetime-local形式
 */
function getCurrentDateTimeLocal() {
    const now = new Date();
    return formatDateTimeLocal(now);
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
 * 画面切り替え関数
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
        return; // 対象ページが見つからない場合は処理を中断
    }

    // 画面ごとの初期化処理
    if (page === 'login') {
        // ログイン画面の初期化
        const usernameInput = getElement('username');
        if (usernameInput) usernameInput.focus();
    } 
    else if (page === 'register') {
        // 登録画面の初期化
        const usernameInput = getElement('reg-username');
        if (usernameInput) usernameInput.focus();
    }
}

/**
 * 認証チェック
 * @param {string} requiredRole 必要な権限
 * @returns {boolean} 認証結果
 */
function checkAuth(requiredRole) {
    const user = getCurrentUser();
    
    if (!user) {
        // ユーザーが存在しない場合はログイン画面にリダイレクト
        showPage('login');
        return false;
    }
    
    if (requiredRole && user.role !== requiredRole) {
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
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    
    const dateEl = getElement('current-date');
    const timeEl = getElement('current-time');
    
    if (dateEl) dateEl.textContent = now.toLocaleDateString('ja-JP', dateOptions);
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('ja-JP', timeOptions);
}
