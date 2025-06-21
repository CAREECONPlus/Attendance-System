/**
 * Legacy usersからマルチテナント対応への移行スクリプト
 * ブラウザのコンソールで実行
 */

async function migrateToMultiTenant() {
    console.log('🚀 マルチテナント移行開始...');
    
    try {
        // 1. Legacy usersデータを取得
        const legacyUsers = await firebase.firestore().collection('users').get();
        console.log(`📊 移行対象ユーザー数: ${legacyUsers.size}`);
        
        // 2. 会社別にユーザーをグループ化
        const companiesMap = new Map();
        const usersData = [];
        
        legacyUsers.forEach(doc => {
            const data = doc.data();
            const company = data.company || 'default-company';
            
            usersData.push({
                uid: doc.id,
                email: data.email,
                displayName: data.displayName || data.name || '',
                role: data.role || 'employee',
                company: company,
                originalData: data
            });
            
            if (!companiesMap.has(company)) {
                companiesMap.set(company, []);
            }
            companiesMap.get(company).push({
                uid: doc.id,
                email: data.email,
                role: data.role || 'employee',
                name: data.displayName || data.name || ''
            });
        });
        
        console.log('🏢 検出された会社:', Array.from(companiesMap.keys()));
        console.table(usersData);
        
        // 3. テナント作成とユーザー移行
        const batch = firebase.firestore().batch();
        let operationCount = 0;
        
        for (const [companyName, users] of companiesMap.entries()) {
            // テナントID生成
            const tenantId = generateTenantId(companyName);
            console.log(`🏢 テナント作成: ${companyName} -> ${tenantId}`);
            
            // 管理者ユーザーを特定（admin または super_admin）
            const adminUser = users.find(u => u.role === 'admin' || u.role === 'super_admin') || users[0];
            
            // テナント情報作成
            const tenantData = {
                id: tenantId,
                companyName: companyName,
                adminEmail: adminUser.email,
                adminName: adminUser.name,
                department: '',
                phone: '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'active',
                migrated: true
            };
            
            const tenantRef = firebase.firestore().collection('tenants').doc(tenantId);
            batch.set(tenantRef, tenantData);
            operationCount++;
            
            // 各ユーザーをglobal_usersと tenant-specific collectionsに追加
            for (const user of users) {
                // Global users に追加
                const globalUserData = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.name,
                    role: user.role,
                    tenantId: tenantId,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    migrated: true
                };
                
                const globalUserRef = firebase.firestore().collection('global_users').doc(user.email);
                batch.set(globalUserRef, globalUserData);
                operationCount++;
                
                // Tenant-specific users に追加
                const originalUserData = usersData.find(u => u.uid === user.uid).originalData;
                const tenantUserRef = firebase.firestore()
                    .collection('tenants').doc(tenantId)
                    .collection('users').doc(user.uid);
                
                batch.set(tenantUserRef, {
                    ...originalUserData,
                    tenantId: tenantId,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    migrated: true
                });
                operationCount++;
                
                // バッチサイズ制限（500操作）
                if (operationCount >= 450) {
                    console.log('💾 バッチ実行中...');
                    await batch.commit();
                    operationCount = 0;
                }
            }
        }
        
        // 残りの操作を実行
        if (operationCount > 0) {
            console.log('💾 最終バッチ実行中...');
            await batch.commit();
        }
        
        console.log('✅ 移行完了！');
        console.log('📋 実行された操作:');
        console.log(`- テナント作成: ${companiesMap.size}個`);
        console.log(`- ユーザー移行: ${usersData.length}人`);
        
        // 4. 移行後の確認
        console.log('\n🔍 移行後の確認...');
        await verifyMigration();
        
    } catch (error) {
        console.error('❌ 移行エラー:', error);
    }
}

function generateTenantId(companyName) {
    const baseId = companyName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    
    const timestamp = Date.now().toString(36);
    return `${baseId}-${timestamp}`;
}

async function verifyMigration() {
    try {
        const globalUsers = await firebase.firestore().collection('global_users').get();
        const tenants = await firebase.firestore().collection('tenants').get();
        
        console.log(`✅ Global users: ${globalUsers.size}人`);
        console.log(`✅ Tenants: ${tenants.size}個`);
        
        // 詳細表示
        globalUsers.forEach(doc => {
            const data = doc.data();
            console.log(`👤 ${doc.id}: ${data.role} @ ${data.tenantId}`);
        });
        
        tenants.forEach(doc => {
            const data = doc.data();
            console.log(`🏢 ${doc.id}: ${data.companyName} (${data.adminEmail})`);
        });
        
    } catch (error) {
        console.error('❌ 確認エラー:', error);
    }
}

// グローバル関数として公開
window.migrateToMultiTenant = migrateToMultiTenant;
console.log('🔧 移行スクリプト準備完了');
console.log('実行: migrateToMultiTenant()');