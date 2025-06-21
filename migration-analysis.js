/**
 * ユーザーデータ移行のための分析スクリプト
 * ブラウザのコンソールで実行
 */

async function analyzeCurrentUserData() {
    console.log('🔍 ユーザーデータ分析開始...');
    
    try {
        // 1. Legacy usersコレクションを確認
        console.log('\n📊 Legacy users コレクション分析:');
        const legacyUsers = await firebase.firestore().collection('users').get();
        console.log(`Legacy users 数: ${legacyUsers.size}`);
        
        // 詳細分析
        const legacyData = [];
        legacyUsers.forEach(doc => {
            const data = doc.data();
            legacyData.push({
                uid: doc.id,
                email: data.email,
                role: data.role,
                tenantId: data.tenantId,
                company: data.company
            });
        });
        console.table(legacyData);
        
        // 2. Global usersコレクションを確認
        console.log('\n📊 Global users コレクション分析:');
        const globalUsers = await firebase.firestore().collection('global_users').get();
        console.log(`Global users 数: ${globalUsers.size}`);
        
        const globalData = [];
        globalUsers.forEach(doc => {
            const data = doc.data();
            globalData.push({
                email: doc.id,
                uid: data.uid,
                role: data.role,
                tenantId: data.tenantId
            });
        });
        console.table(globalData);
        
        // 3. テナント一覧を確認
        console.log('\n🏢 テナント一覧:');
        const tenants = await firebase.firestore().collection('tenants').get();
        console.log(`テナント数: ${tenants.size}`);
        
        const tenantData = [];
        for (const tenantDoc of tenants.docs) {
            const data = tenantDoc.data();
            const tenantUsers = await firebase.firestore()
                .collection('tenants').doc(tenantDoc.id)
                .collection('users').get();
            
            tenantData.push({
                tenantId: tenantDoc.id,
                companyName: data.companyName,
                adminEmail: data.adminEmail,
                userCount: tenantUsers.size,
                createdAt: data.createdAt ? data.createdAt.toDate().toLocaleDateString('ja-JP') : '不明'
            });
        }
        console.table(tenantData);
        
        // 4. 現在のユーザー情報
        console.log('\n👤 現在のユーザー情報:');
        const currentUser = firebase.auth().currentUser;
        if (currentUser) {
            console.log(`UID: ${currentUser.uid}`);
            console.log(`Email: ${currentUser.email}`);
            console.log(`表示名: ${currentUser.displayName}`);
            
            // global_usersでの情報確認
            const globalUserDoc = await firebase.firestore()
                .collection('global_users')
                .doc(currentUser.email)
                .get();
            
            if (globalUserDoc.exists) {
                console.log('✅ global_usersに存在:', globalUserDoc.data());
            } else {
                console.log('❌ global_usersに存在しない');
                
                // legacy usersでの情報確認
                const legacyUserDoc = await firebase.firestore()
                    .collection('users')
                    .doc(currentUser.uid)
                    .get();
                
                if (legacyUserDoc.exists) {
                    console.log('📋 legacy usersのデータ:', legacyUserDoc.data());
                } else {
                    console.log('❌ legacy usersにも存在しない');
                }
            }
        }
        
        console.log('\n✅ 分析完了');
        
    } catch (error) {
        console.error('❌ 分析エラー:', error);
    }
}

// 実行用関数
window.analyzeCurrentUserData = analyzeCurrentUserData;

console.log('🔧 分析スクリプト準備完了');
console.log('実行: analyzeCurrentUserData()');