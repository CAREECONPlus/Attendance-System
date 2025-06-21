/**
 * 既存勤怠データのマルチテナント構造への移行スクリプト
 * ブラウザのコンソールで実行
 */

async function migrateAttendanceData() {
    console.log('🚀 勤怠データ移行開始...');
    
    try {
        // 1. テナント情報を取得
        const tenants = await firebase.firestore().collection('tenants').get();
        
        if (tenants.empty) {
            console.error('❌ テナントが見つかりません');
            return;
        }
        
        const tenantId = tenants.docs[0].id; // 最初のテナント（branu-company-xxx）
        console.log('🏢 移行先テナント:', tenantId);
        
        // 2. 既存の attendance データを取得
        const attendanceSnapshot = await firebase.firestore().collection('attendance').get();
        console.log(`📊 移行対象勤怠レコード数: ${attendanceSnapshot.size}`);
        
        // 3. 既存の breaks データを取得
        const breaksSnapshot = await firebase.firestore().collection('breaks').get();
        console.log(`📊 移行対象休憩レコード数: ${breaksSnapshot.size}`);
        
        if (attendanceSnapshot.empty && breaksSnapshot.empty) {
            console.log('ℹ️ 移行対象データがありません');
            return;
        }
        
        // 4. バッチで移行実行
        const batch = firebase.firestore().batch();
        let operationCount = 0;
        
        // 勤怠データ移行
        attendanceSnapshot.forEach(doc => {
            const data = doc.data();
            const newAttendanceRef = firebase.firestore()
                .collection('tenants').doc(tenantId)
                .collection('attendance').doc(doc.id);
            
            batch.set(newAttendanceRef, {
                ...data,
                tenantId: tenantId,
                migratedAt: firebase.firestore.FieldValue.serverTimestamp(),
                migrated: true
            });
            
            operationCount++;
            console.log(`📝 勤怠データ移行予約: ${doc.id} (${data.uid})`);
        });
        
        // 休憩データ移行
        breaksSnapshot.forEach(doc => {
            const data = doc.data();
            const newBreakRef = firebase.firestore()
                .collection('tenants').doc(tenantId)
                .collection('breaks').doc(doc.id);
            
            batch.set(newBreakRef, {
                ...data,
                tenantId: tenantId,
                migratedAt: firebase.firestore.FieldValue.serverTimestamp(),
                migrated: true
            });
            
            operationCount++;
            console.log(`☕ 休憩データ移行予約: ${doc.id} (${data.uid})`);
        });
        
        // 5. バッチ実行
        if (operationCount > 0) {
            console.log('💾 移行実行中...');
            await batch.commit();
            console.log('✅ 勤怠データ移行完了！');
            
            // 6. 移行確認
            setTimeout(async () => {
                const newAttendance = await firebase.firestore()
                    .collection('tenants').doc(tenantId)
                    .collection('attendance').get();
                
                const newBreaks = await firebase.firestore()
                    .collection('tenants').doc(tenantId)
                    .collection('breaks').get();
                
                console.log(`✅ 移行結果: 勤怠 ${newAttendance.size}件, 休憩 ${newBreaks.size}件`);
                console.log('🔄 ページをリロードして動作確認してください');
            }, 2000);
        } else {
            console.log('ℹ️ 移行対象データがありませんでした');
        }
        
    } catch (error) {
        console.error('❌ 移行エラー:', error);
    }
}

// 移行前の分析関数
async function analyzeAttendanceData() {
    console.log('🔍 勤怠データ分析開始...');
    
    try {
        // 既存データ確認
        const attendance = await firebase.firestore().collection('attendance').get();
        const breaks = await firebase.firestore().collection('breaks').get();
        
        console.log(`📊 既存勤怠データ: ${attendance.size}件`);
        console.log(`📊 既存休憩データ: ${breaks.size}件`);
        
        // ユーザー別データ数
        const userDataCount = new Map();
        
        attendance.forEach(doc => {
            const data = doc.data();
            const uid = data.uid;
            if (!userDataCount.has(uid)) {
                userDataCount.set(uid, { attendance: 0, breaks: 0 });
            }
            userDataCount.get(uid).attendance++;
        });
        
        breaks.forEach(doc => {
            const data = doc.data();
            const uid = data.uid;
            if (!userDataCount.has(uid)) {
                userDataCount.set(uid, { attendance: 0, breaks: 0 });
            }
            userDataCount.get(uid).breaks++;
        });
        
        console.log('👥 ユーザー別データ数:');
        for (const [uid, counts] of userDataCount.entries()) {
            console.log(`  ${uid}: 勤怠${counts.attendance}件, 休憩${counts.breaks}件`);
        }
        
        // 新しいテナント構造確認
        const tenants = await firebase.firestore().collection('tenants').get();
        tenants.forEach(doc => {
            console.log(`🏢 既存テナント: ${doc.id} (${doc.data().companyName})`);
        });
        
    } catch (error) {
        console.error('❌ 分析エラー:', error);
    }
}

// グローバル関数として公開
window.migrateAttendanceData = migrateAttendanceData;
window.analyzeAttendanceData = analyzeAttendanceData;

console.log('🔧 勤怠データ移行スクリプト準備完了');
console.log('分析実行: analyzeAttendanceData()');
console.log('移行実行: migrateAttendanceData()');