/**
 * Firebase対応勤怠管理システム - 管理者画面 (Firebase v8)
 */

// グローバル変数
let currentSortField = 'date';
let currentSortDirection = 'desc';

/**
 * DOMContentLoaded時の初期化
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('管理者画面の初期化開始');
    checkAuthAndRole();
});

/**
 * Firebase認証とロール確認
 */
async function checkAuthAndRole() {
    firebase.auth().onAuthStateChanged(async function(user) {
        if (!user) {
            console.log('未認証ユーザー、ログイン画面へリダイレクト');
            window.location.href = 'login.html';
            return;
        }

        try {
            // ユーザーの役割を確認
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (!userDoc.exists || userDoc.data().role !== 'admin') {
                console.log('管理者権限なし、トップページへリダイレクト');
                alert('管理者権限が必要です');
                window.location.href = 'index.html';
                return;
            }

            console.log('管理者として認証完了');
            initializeAdminPage(user, userDoc.data());
        } catch (error) {
            console.error('ユーザー役割確認エラー:', error);
            alert('エラーが発生しました');
            window.location.href = 'login.html';
        }
    });
}

/**
 * 管理者画面の初期化
 */
function initializeAdminPage(user, userData) {
    // ユーザー名表示
    displayUserName(userData);
    
    // イベントリスナーの設定
    setupEventListeners();
    
    // 初期データの読み込み
    loadInitialData();
    
    console.log('管理者画面の初期化完了');
}

/**
 * ユーザー名の表示
 */
function displayUserName(userData) {
    const adminUserNameEl = document.getElementById('admin-user-name');
    if (adminUserNameEl) {
        adminUserNameEl.textContent = userData.displayName || userData.email;
    }
}

/**
 * イベントリスナーの設定
 */
function setupEventListeners() {
    // ログアウトボタン
    setupLogoutButton();
    
    // タブ切り替え
    setupTabButtons();
    
    // フィルター
    setupFilters();
    
    // CSV出力
    setupCsvExport();
    
    // ソート
    setupSortableHeaders();
    
    // モーダル
    setupModals();
}

/**
 * ログアウトボタンの設定
 */
function setupLogoutButton() {
    // 可能性のあるIDを全て試す
    const possibleIds = [
        'admin-logout-btn',
        'logout-btn',
        'admin-logout-button',
        'logout-button'
    ];
    
    let logoutBtn = null;
    
    for (const id of possibleIds) {
        logoutBtn = document.getElementById(id);
        if (logoutBtn) {
            console.log(`ログアウトボタンを発見: ID="${id}"`);
            break;
        }
    }
    
    if (!logoutBtn) {
        // IDで見つからない場合は、classや属性で検索
        logoutBtn = document.querySelector('.logout-btn') || 
                   document.querySelector('button[onclick*="logout"]') ||
                   document.querySelector('button[onclick*="Logout"]');
    }
    
    if (logoutBtn) {
        // 既存のイベントを削除してから新しく設定
        logoutBtn.onclick = null;
        logoutBtn.addEventListener('click', handleLogout);
        console.log('ログアウトボタンのイベントリスナー設定完了');
    } else {
        console.error('ログアウトボタンが見つかりません');
        // デバッグ用：全てのボタンをリストアップ
        const allButtons = document.querySelectorAll('button');
        console.log('ページ内の全ボタン:');
        allButtons.forEach((btn, index) => {
            console.log(`${index}: id="${btn.id}", class="${btn.className}", text="${btn.textContent.trim()}"`);
        });
    }
}

/**
 * ログアウト処理
 */
async function handleLogout() {
    console.log('ログアウト開始');
    
    try {
        await firebase.auth().signOut();
        console.log('ログアウト成功');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('ログアウトエラー:', error);
        alert('ログアウトに失敗しました: ' + error.message);
    }
}

/**
 * タブボタンの設定
 */
function setupTabButtons() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // アクティブタブの切り替え
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // フィルター表示の切り替え
            const tabName = this.getAttribute('data-tab');
            toggleFilterDisplay(tabName);
            
            // データの再読み込み
            loadAttendanceData();
        });
    });
}

/**
 * フィルターの設定
 */
function setupFilters() {
    // 今日の日付を設定
    const today = new Date().toISOString().split('T')[0];
    const filterDate = document.getElementById('filter-date');
    if (filterDate) filterDate.value = today;
    
    // 今月を設定
    const thisMonth = today.substring(0, 7);
    const filterMonth = document.getElementById('filter-month');
    if (filterMonth) filterMonth.value = thisMonth;
    
    // フィルター変更イベント
    const filters = ['filter-date', 'filter-month', 'filter-employee', 'filter-site'];
    filters.forEach(filterId => {
        const filterEl = document.getElementById(filterId);
        if (filterEl) {
            filterEl.addEventListener('change', loadAttendanceData);
        }
    });
}

/**
 * CSV出力の設定
 */
function setupCsvExport() {
    const exportBtn = document.getElementById('export-csv');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportCsv);
    }
}

/**
 * ソート可能ヘッダーの設定
 */
function setupSortableHeaders() {
    const sortableHeaders = document.querySelectorAll('.sortable');
    
    sortableHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const field = this.getAttribute('data-sort');
            
            if (currentSortField === field) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortField = field;
                currentSortDirection = 'asc';
            }
            
            // ヘッダーのソート表示を更新
            updateSortHeaders();
            
            // データを再読み込み
            loadAttendanceData();
        });
    });
}

/**
 * モーダルの設定
 */
function setupModals() {
    // モーダルの閉じるボタン
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal.style.display = 'none');
        }
        
        // モーダル外クリックで閉じる
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
    });
}

/**
 * 初期データの読み込み
 */
async function loadInitialData() {
    try {
        await Promise.all([
            loadEmployeeList(),
            loadSiteList(),
            loadAttendanceData()
        ]);
        console.log('初期データ読み込み完了');
    } catch (error) {
        console.error('初期データ読み込みエラー:', error);
        showErrorMessage('データの読み込みに失敗しました');
    }
}

/**
 * 従業員リストの読み込み（orderByを使わない版）
 */
async function loadEmployeeList() {
    try {
        console.log('従業員リスト読み込み開始');
        
        // orderByを使わずに取得
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
        
        // クライアントサイドでソート
        employees.sort((a, b) => {
            const nameA = a.displayName || a.email || '';
            const nameB = b.displayName || b.email || '';
            return nameA.localeCompare(nameB);
        });
        
        // プルダウンに追加
        const select = document.getElementById('filter-employee');
        if (select) {
            // 既存のオプションをクリア（最初の「全員」オプションは残す）
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
        // エラーが発生してもページの動作を止めない
        console.warn('従業員リストの読み込みに失敗しましたが、処理を続行します');
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
            // 既存のオプションをクリア（最初の「全ての現場」オプションは残す）
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }
            
            // アルファベット順でソート
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
        console.warn('現場リストの読み込みに失敗しましたが、処理を続行します');
    }
}

/**
 * フィルター表示の切り替え
 */
function toggleFilterDisplay(tabName) {
    // 全てのフィルターを非表示
    const filterContainers = [
        document.querySelector('.date-filter'),
        document.querySelector('.month-filter'),
        document.querySelector('.employee-filter'),
        document.querySelector('.site-filter')
    ];
    
    filterContainers.forEach(container => {
        if (container) container.classList.add('hidden');
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
        const targetContainer = document.querySelector(targetClass);
        if (targetContainer) {
            targetContainer.classList.remove('hidden');
        }
    }
}

/**
 * 勤怠データの読み込み
 */
async function loadAttendanceData() {
    try {
        console.log('勤怠データ読み込み開始');
        
        const activeTab = document.querySelector('.tab-btn.active')?.getAttribute('data-tab');
        if (!activeTab) {
            console.log('アクティブタブが見つかりません');
            return;
        }
        
        let query = db.collection('attendance');
        
        // フィルター条件の適用
        switch(activeTab) {
            case 'daily':
                const filterDate = document.getElementById('filter-date')?.value;
                if (filterDate) {
                    query = query.where('date', '==', filterDate);
                } else {
                    // 日付が選択されていない場合は今日を表示
                    const today = new Date().toISOString().split('T')[0];
                    query = query.where('date', '==', today);
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
        
        // データを配列に変換
        const attendanceData = [];
        snapshot.forEach(doc => {
            attendanceData.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // 各記録に対して休憩データを取得
        await loadBreakDataForRecords(attendanceData);
        
        // クライアントサイドでソート
        sortAttendanceData(attendanceData);
        
        // テーブルを描画
        renderAttendanceTable(attendanceData);
        
        console.log(`勤怠データ読み込み完了: ${attendanceData.length}件`);
        
    } catch (error) {
        console.error('勤怠データ読み込みエラー:', error);
        showErrorMessage('勤怠データの読み込みに失敗しました: ' + error.message);
    }
}

/**
 * 各勤怠記録の休憩データを読み込み
 */
async function loadBreakDataForRecords(attendanceData) {
    const breakPromises = attendanceData.map(async record => {
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
    });
    
    await Promise.all(breakPromises);
}

/**
 * 勤怠データのソート
 */
function sortAttendanceData(data) {
    data.sort((a, b) => {
        let valueA, valueB;
        
        switch(currentSortField) {
            case 'date':
                valueA = a.date || '';
                valueB = b.date || '';
                break;
            case 'employee':
                valueA = a.userName || a.displayName || '';
                valueB = b.userName || b.displayName || '';
                break;
            case 'site':
                valueA = a.siteName || '';
                valueB = b.siteName || '';
                break;
            default:
                return 0;
        }
        
        const comparison = valueA.localeCompare(valueB);
        return currentSortDirection === 'asc' ? comparison : -comparison;
    });
}

/**
 * ソートヘッダーの表示更新
 */
function updateSortHeaders() {
    const headers = document.querySelectorAll('.sortable');
    
    headers.forEach(header => {
        const field = header.getAttribute('data-sort');
        const sortIcon = header.querySelector('.sort-icon');
        
        if (field === currentSortField) {
            header.classList.add('sorted');
            if (sortIcon) {
                sortIcon.textContent = currentSortDirection === 'asc' ? '▲' : '▼';
            }
        } else {
            header.classList.remove('sorted');
            if (sortIcon) {
                sortIcon.textContent = '';
            }
        }
    });
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
    
    let html = `
        <div class="work-times">
            <div>出勤: ${formatTime(clockInTime)}</div>
    `;
    
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
        
        html += `
            <div>退勤: ${formatTime(clockOutTime)}</div>
            <div>休憩: ${formatMinutes(totalBreakMinutes)}</div>
            <div class="work-time-total">実働: ${formatMinutes(workMinutes)}</div>
        `;
    } else {
        html += '<div class="work-time-status">勤務中</div>';
    }
    
    html += '</div>';
    return html;
}

/**
 * 時刻のフォーマット
 */
function formatTime(date) {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

/**
 * 日付のフォーマット
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * 分を時間:分の形式でフォーマット
 */
function formatMinutes(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}時間${mins}分`;
}

/**
 * CSV出力
 */
function exportCsv() {
    // この機能は後ほど実装
    alert('CSV出力機能は実装中です');
}

/**
 * 編集モーダルを開く
 */
function openEditModal(recordId) {
    // この機能は後ほど実装
    alert(`編集機能は実装中です (ID: ${recordId})`);
}

/**
 * エラーメッセージの表示
 */
function showErrorMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error-toast';
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

/**
 * 成功メッセージの表示
 */
function showSuccessMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast success-toast';
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
