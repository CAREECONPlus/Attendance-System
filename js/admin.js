/**
 * admin.js - 完全修正版
 * タブ切り替えとログアウトボタンの問題を解決
 */

console.log('admin.js 読み込み開始');

/**
 * 管理者画面の初期化処理
 */
async function initAdminPage() {
    console.log('管理者ページの初期化開始');
    
    try {
        // 基本的なUI初期化
        setupAdminBasics();
        
        // イベントリスナーの設定
        setupAdminEvents();
        
        // 今日の日付をセット
        const today = new Date().toISOString().split('T')[0];
        const filterDate = document.getElementById('filter-date');
        if (filterDate) filterDate.value = today;
        
        // 今月をセット
        const filterMonth = document.getElementById('filter-month');
        if (filterMonth) filterMonth.value = today.substring(0, 7);
        
        // データの読み込み
        await loadEmployeeList();
        await loadSiteList();
        await loadAttendanceData();
        
        console.log('管理者ページの初期化完了');
    } catch (error) {
        console.error('管理者ページ初期化エラー:', error);
        showError('管理者画面の初期化に失敗しました');
    }
}

/**
 * 基本的なUI初期化
 */
function setupAdminBasics() {
    // ユーザー名を表示
    const currentUser = firebase.auth().currentUser;
    if (currentUser) {
        const adminUserNameEl = document.getElementById('admin-user-name');
        if (adminUserNameEl) {
            adminUserNameEl.textContent = currentUser.displayName || currentUser.email;
        }
    }
}

/**
 * イベントリスナーの設定
 */
function setupAdminEvents() {
    console.log('管理者イベント設定開始');
    
    // タブ切り替えイベント（修正版）
    setupTabEvents();
    
    // フィルター変更イベント
    setupFilterEvents();
    
    // ログアウトボタン（修正版）
    setupLogoutButton();
    
    // CSV出力ボタン
    const exportBtn = document.getElementById('export-csv');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportCsv);
    }
    
    // ソートヘッダー
    setupSortableHeaders();
    
    console.log('管理者イベント設定完了');
}

/**
 * タブ切り替えイベントの設定
 */
function setupTabEvents() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    console.log('タブボタン数:', tabButtons.length);
    
    tabButtons.forEach((button, index) => {
        console.log(`タブボタン ${index}:`, button.textContent, 'data-tab:', button.getAttribute('data-tab'));
        
        // 既存のイベントリスナーを削除
        button.removeEventListener('click', handleTabClick);
        
        // 新しいイベントリスナーを追加
        button.addEventListener('click', handleTabClick);
    });
}

/**
 * タブクリック処理
 */
function handleTabClick(e) {
    e.preventDefault();
    console.log('タブクリック:', this.getAttribute('data-tab'));
    
    // 全てのタブからactiveクラスを削除
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // クリックされたタブにactiveクラスを追加
    this.classList.add('active');
    
    // フィルター表示の切り替え
    const tabName = this.getAttribute('data-tab');
    toggleFilterDisplay(tabName);
    
    // データの再読み込み
    loadAttendanceData();
}

/**
 * フィルターイベントの設定
 */
function setupFilterEvents() {
    const filters = [
        'filter-date',
        'filter-month', 
        'filter-employee',
        'filter-site'
    ];
    
    filters.forEach(filterId => {
        const filterEl = document.getElementById(filterId);
        if (filterEl) {
            filterEl.addEventListener('change', loadAttendanceData);
        }
    });
}

/**
 * ログアウトボタンの設定
 */
function setupLogoutButton() {
    const logoutBtn = document.getElementById('admin-logout-btn');
    console.log('ログアウトボタン:', logoutBtn);
    
    if (logoutBtn) {
        // 既存のイベントリスナーを削除
        logoutBtn.removeEventListener('click', handleAdminLogout);
        
        // 新しいイベントリスナーを追加
        logoutBtn.addEventListener('click', handleAdminLogout);
        console.log('ログアウトボタンのイベントリスナー設定完了');
    } else {
        console.error('ログアウトボタンが見つかりません');
        // HTMLの全てのボタンをチェック
        const allButtons = document.querySelectorAll('button');
        console.log('全ボタン一覧:');
        allButtons.forEach((btn, i) => {
            console.log(`${i}: id="${btn.id}", class="${btn.className}", text="${btn.textContent.trim()}"`);
        });
    }
}

/**
 * 管理者ログアウト処理
 */
async function handleAdminLogout() {
    console.log('管理者ログアウト開始');
    
    try {
        await firebase.auth().signOut();
        console.log('ログアウト成功');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('ログアウトエラー:', error);
        showError('ログアウトに失敗しました');
    }
}

/**
 * フィルター表示の切り替え
 */
function toggleFilterDisplay(tabName) {
    console.log('フィルター切り替え:', tabName);
    
    // 全てのフィルターを非表示
    const filterSections = [
        '.date-filter',
        '.month-filter',
        '.employee-filter',
        '.site-filter'
    ];
    
    filterSections.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
            element.classList.add('hidden');
        }
    });
    
    // 選択されたタブに応じてフィルターを表示
    let targetClass = '';
    switch(tabName) {
        case 'daily':
            targetClass = '.date-filter';
            break;
        case 'monthly':
            targetClass = '.month-filter';
            break;
        case 'employee':
            targetClass = '.employee-filter';
            break;
        case 'site':
            targetClass = '.site-filter';
            break;
    }
    
    if (targetClass) {
        const targetElement = document.querySelector(targetClass);
        if (targetElement) {
            targetElement.classList.remove('hidden');
        }
    }
}

/**
 * 従業員リストの読み込み
 */
async function loadEmployeeList() {
    try {
        console.log('従業員リスト読み込み開始');
        
        const snapshot = await db.collection('users')
            .where('role', '==', 'employee')
            .get();
        
        const employees = [];
        snapshot.forEach(doc => {
            employees.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // 名前でソート
        employees.sort((a, b) => {
            const nameA = a.displayName || a.email || '';
            const nameB = b.displayName || b.email || '';
            return nameA.localeCompare(nameB);
        });
        
        const select = document.getElementById('filter-employee');
        if (select) {
            // 既存のオプションをクリア（最初の選択肢は残す）
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }
            
            employees.forEach(employee => {
                const option = document.createElement('option');
                option.value = employee.id;
                option.textContent = employee.displayName || employee.email;
                select.appendChild(option);
            });
        }
        
        console.log(`従業員リスト読み込み完了: ${employees.length}件`);
    } catch (error) {
        console.error('従業員リスト読み込みエラー:', error);
    }
}

/**
 * 現場リストの読み込み
 */
async function loadSiteList() {
    try {
        console.log('現場リスト読み込み開始');
        
        const snapshot = await db.collection('attendance').get();
        const sites = new Set();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.siteName) {
                sites.add(data.siteName);
            }
        });
        
        const select = document.getElementById('filter-site');
        if (select) {
            // 既存のオプションをクリア（最初の選択肢は残す）
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }
            
            Array.from(sites).sort().forEach(site => {
                const option = document.createElement('option');
                option.value = site;
                option.textContent = site;
                select.appendChild(option);
            });
        }
        
        console.log(`現場リスト読み込み完了: ${sites.size}件`);
    } catch (error) {
        console.error('現場リスト読み込みエラー:', error);
    }
}

/**
 * 勤怠データの読み込み
 */
async function loadAttendanceData() {
    try {
        console.log('勤怠データ読み込み開始');
        
        const activeTab = document.querySelector('.tab-btn.active');
        const tabName = activeTab ? activeTab.getAttribute('data-tab') : 'daily';
        
        let query = db.collection('attendance');
        
        // フィルター条件の適用
        switch(tabName) {
            case 'daily':
                const filterDate = document.getElementById('filter-date')?.value;
                if (filterDate) {
                    query = query.where('date', '==', filterDate);
                }
                break;
                
            case 'monthly':
                const filterMonth = document.getElementById('filter-month')?.value;
                if (filterMonth) {
                    const startDate = `${filterMonth}-01`;
                    const endDate = `${filterMonth}-31`;
                    query = query.where('date', '>=', startDate).where('date', '<=', endDate);
                }
                break;
                
            case 'employee':
                const employeeId = document.getElementById('filter-employee')?.value;
                if (employeeId) {
                    query = query.where('userId', '==', employeeId);
                }
                break;
                
            case 'site':
                const siteName = document.getElementById('filter-site')?.value;
                if (siteName) {
                    query = query.where('siteName', '==', siteName);
                }
                break;
        }
        
        const snapshot = await query.get();
        
        const attendanceData = [];
        snapshot.forEach(doc => {
            attendanceData.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // 各記録の休憩データを取得
        await loadBreakDataForRecords(attendanceData);
        
        // 日付でソート
        attendanceData.sort((a, b) => {
            return b.date.localeCompare(a.date);
        });
        
        // テーブルを描画
        renderAttendanceTable(attendanceData);
        
        console.log(`勤怠データ読み込み完了: ${attendanceData.length}件`);
    } catch (error) {
        console.error('勤怠データ読み込みエラー:', error);
        showError('勤怠データの読み込みに失敗しました');
    }
}

/**
 * 休憩データの読み込み
 */
async function loadBreakDataForRecords(attendanceData) {
    for (const record of attendanceData) {
        try {
            const breakSnapshot = await db.collection('breaks')
                .where('attendanceId', '==', record.id)
                .get();
            
            record.breakTimes = [];
            breakSnapshot.forEach(doc => {
                const breakData = doc.data();
                record.breakTimes.push({
                    id: doc.id,
                    startTime: breakData.startTime,
                    endTime: breakData.endTime,
                    duration: breakData.duration || 0
                });
            });
        } catch (error) {
            console.error(`記録ID ${record.id} の休憩データ取得エラー:`, error);
            record.breakTimes = [];
        }
    }
}

/**
 * テーブルの描画
 */
function renderAttendanceTable(data) {
    const tableBody = document.getElementById('attendance-data');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5" class="no-data">データがありません</td>';
        tableBody.appendChild(row);
        return;
    }
    
    data.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${record.userName || record.displayName || '不明'}</td>
            <td>${formatDate(record.date)}</td>
            <td>${record.siteName || '-'}</td>
            <td>${formatWorkTime(record)}</td>
            <td>
                <button class="btn btn-small edit-btn" onclick="openEditModal('${record.id}')">
                    編集
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

/**
 * 勤務時間の表示フォーマット
 */
function formatWorkTime(record) {
    const clockInTime = record.clockInTime?.toDate ? record.clockInTime.toDate() : 
                      (record.clockInTime ? new Date(record.clockInTime) : null);
    const clockOutTime = record.clockOutTime?.toDate ? record.clockOutTime.toDate() : 
                        (record.clockOutTime ? new Date(record.clockOutTime) : null);
    
    if (!clockInTime) return '-';
    
    let html = `<div class="work-times">`;
    html += `<div>出勤: ${formatTime(clockInTime)}</div>`;
    
    if (clockOutTime) {
        // 休憩時間の計算
        const totalBreakMinutes = (record.breakTimes || []).reduce((total, breakTime) => {
            if (breakTime.startTime && breakTime.endTime) {
                const start = breakTime.startTime.toDate ? breakTime.startTime.toDate() : new Date(breakTime.startTime);
                const end = breakTime.endTime.toDate ? breakTime.endTime.toDate() : new Date(breakTime.endTime);
                return total + Math.floor((end - start) / (1000 * 60));
            }
            return total;
        }, 0);
        
        // 実働時間の計算
        const totalMinutes = Math.floor((clockOutTime - clockInTime) / (1000 * 60));
        const workMinutes = totalMinutes - totalBreakMinutes;
        
        html += `<div>退勤: ${formatTime(clockOutTime)}</div>`;
        html += `<div>休憩: ${formatMinutes(totalBreakMinutes)}</div>`;
        html += `<div>実働: ${formatMinutes(workMinutes)}</div>`;
    } else {
        html += '<div>勤務中</div>';
    }
    
    html += '</div>';
    return html;
}

/**
 * ソート可能ヘッダーの設定
 */
function setupSortableHeaders() {
    const sortableHeaders = document.querySelectorAll('.sortable');
    
    sortableHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const field = this.getAttribute('data-sort');
            console.log('ソートクリック:', field);
            // ソート機能は後で実装
        });
    });
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

function formatMinutes(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}時間${mins}分`;
}

function showError(message) {
    console.error(message);
    alert(message); // 簡易版、後でtoastに変更可能
}

function exportCsv() {
    console.log('CSV出力');
    alert('CSV出力機能は実装中です');
}

function openEditModal(recordId) {
    console.log('編集モーダル:', recordId);
    alert('編集機能は実装中です');
}

console.log('admin.js 読み込み完了');
