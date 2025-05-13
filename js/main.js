/**
 * 勤怠管理システム - メインスクリプト
 * 
 * システムの初期化と全体の連携を担当します。
 * ページの読み込み完了時にシステムを初期化し、適切な画面を表示します。
 */

// window.onloadを追加 - ページが完全に読み込まれた時に実行
window.onload = function() {
    console.log('ページが完全に読み込まれました');
    initializeSystem();
};

// DOMContentLoadedイベントも保持
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM読み込み完了');
    // 少し遅延させてから初期化
    setTimeout(initializeSystem, 300);
});

/**
 * システム初期化の中心関数
 */
function initializeSystem() {
    console.log('勤怠管理システムを初期化中...');
    
    // ユーザーの状態を確認
    const currentUser = getCurrentUser();
    
    if (currentUser) {
        console.log(`ログイン済みユーザー: ${currentUser.fullName} (${currentUser.role})`);
        
        // ユーザーの役割に応じた画面を表示
        if (currentUser.role === 'admin') {
            showPage('admin');
            // 画面表示後に初期化
            setTimeout(function() {
                initAdminPage();
                console.log('管理者ページの初期化完了');
            }, 200);
        } else if (currentUser.role === 'employee') {
            showPage('employee');
            // 画面表示後に初期化
            setTimeout(function() {
                initEmployeePage();
                console.log('従業員ページの初期化完了');
            }, 200);
        } else {
            // 不明な役割の場合はログアウト
            console.warn('不明なユーザー役割:', currentUser.role);
            localStorage.removeItem('currentUser');
            showPage('login');
            initLoginForm();
        }
    } else {
        // 未ログインの場合はログイン画面を表示
        console.log('未ログインユーザー - ログイン画面を表示');
        showPage('login');
        initLoginForm();
    }
    
    // エラーハンドリングの設定
    window.addEventListener('error', function(e) {
        console.error('アプリケーションエラー:', e.message);
        // 重大なエラーが発生した場合のフォールバック処理
        try {
            alert('エラーが発生しました: ' + e.message);
        } catch (innerError) {
            // エラー処理中の二次エラーを防ぐ
            console.error('エラー通知中に二次エラーが発生:', innerError);
        }
    });
    
    console.log('勤怠管理システムの初期化が完了しました');
}

/**
 * ブラウザのキャッシュクリア時にデータ消失を防ぐための警告
 */
window.addEventListener('beforeunload', function(e) {
    // データが保存されている場合は確認ダイアログを表示
    if (localStorage.getItem('attendanceRecords') || 
        localStorage.getItem('users') ||
        localStorage.getItem('currentUser')) {
        // 標準的な確認メッセージ
        const confirmationMessage = 'ページを離れると一時データが失われる可能性があります。よろしいですか？';
        e.returnValue = confirmationMessage;
        return confirmationMessage;
    }
});

/**
 * エラーハンドリング
 */
window.addEventListener('error', function(e) {
    console.error('アプリケーションエラー:', e.message);
    // 重大なエラーが発生した場合のフォールバック処理
    try {
        alert('エラーが発生しました: ' + e.message);
    } catch (innerError) {
        // エラー処理中の二次エラーを防ぐ
        console.error('エラー通知中に二次エラーが発生:', innerError);
    }
});

/**
 * 新バージョンのデータ互換性を確保
 */
function checkDataCompatibility() {
    // データバージョンの確認（将来的な拡張用）
    const dataVersion = localStorage.getItem('dataVersion') || '1.0';
    
    // 将来的にデータ構造が変わった場合の移行処理をここに記述
    
    // 現在のバージョンを保存
    localStorage.setItem('dataVersion', '1.0');
}

// 互換性チェックを実行
checkDataCompatibility();
