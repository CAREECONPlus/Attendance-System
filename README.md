# 勤怠管理システム

マルチテナント対応の勤怠管理システムです。

## 🚀 デモ

- **従業員画面**: https://careeconplus.github.io/Attendance-System/
- **管理者登録**: https://careeconplus.github.io/Attendance-System/admin-register.html

## 📋 機能

### 従業員機能
- ✅ 出勤・退勤打刻
- ✅ 休憩開始・終了
- ✅ 勤怠履歴確認
- ✅ テナント別データ管理

### 管理者機能
- ✅ 従業員勤怠データ管理
- ✅ 管理者登録依頼承認・却下
- ✅ テナント管理

### Super Admin機能
- ✅ 管理者登録依頼の承認・却下
- ✅ テナント作成・管理
- ✅ システム全体の管理

## 🏗️ アーキテクチャ

### マルチテナント構造
```
├── global_users/         # 全テナント横断ユーザー管理
├── admin_requests/       # 管理者登録依頼
└── tenants/
    └── {tenant-id}/
        ├── users/        # テナント内ユーザー
        ├── attendance/   # 勤怠データ
        └── breaks/       # 休憩データ
```

### 技術スタック
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Firebase (Authentication, Firestore)
- **Hosting**: GitHub Pages
- **Email**: EmailJS

## 📁 プロジェクト構成

```
Attendance-System/
├── css/
│   └── style.css                # スタイルシート
│
├── js/
│   ├── admin.js                 # 管理者画面のメイン機能（215KB）
│   ├── employee.js              # 従業員画面の機能（56KB）
│   ├── login.js                 # ログイン処理
│   ├── auth.js                  # 認証関連
│   ├── firebase.js              # Firebase設定
│   ├── admin-register.js        # 管理者登録処理
│   ├── invite-admin.js          # 管理者招待機能
│   ├── invite-system.js         # 招待システム
│   ├── tenant.js                # テナント管理
│   ├── tenant-settings.js       # テナント設定
│   ├── email-config.js          # EmailJS設定
│   ├── error-handler.js         # エラーハンドリング
│   ├── utils.js                 # ユーティリティ関数
│   ├── config.js                # 設定ファイル
│   ├── main.js                  # メイン処理
│   └── missing-functions.js     # 補助機能
│
├── scripts/
│   ├── build-config.js          # ビルド設定
│   └── deploy.sh                # デプロイスクリプト
│
├── index.html                   # メインページ（従業員/管理者画面）
├── admin-register.html          # 管理者登録ページ
├── debug-add-user.html          # デバッグ用ページ
│
├── firebase.json                # Firebase設定
├── firestore.rules              # Firestoreセキュリティルール
├── firestore.indexes.json       # Firestoreインデックス
├── package.json                 # パッケージ情報
│
└── ドキュメント
    ├── README.md                # このファイル
    ├── SECURITY.md              # セキュリティガイドライン
    ├── EMAIL_SETUP.md           # メール設定手順
    ├── PRODUCTION_DEPLOY.md     # 本番デプロイ手順
    └── LICENSE                  # ライセンス情報
```

## 🔧 セットアップ

### 1. Firebase設定
`js/firebase.js`にFirebase設定を記述

### 2. EmailJS設定
`js/email-config.js`のEmailJS設定値を更新
詳細は`EMAIL_SETUP.md`を参照

### 3. Firestore セキュリティルール
`firestore.rules`をFirebaseコンソールにデプロイ

## 📝 使用方法

### 新規管理者登録フロー
1. 管理者登録フォームから依頼送信
2. dxconsulting.branu2@gmail.com宛に通知メール送信
3. Super Adminが管理画面で承認・却下
4. 承認時に自動でテナント・アカウント作成

### ログイン
- **従業員**: `index.html?tenant={tenant-id}`
- **管理者**: `index.html?tenant={tenant-id}` (roleがadmin)
- **Super Admin**: `index.html?tenant=system` (roleがsuper_admin)

## 🔒 セキュリティ

- Firestore Security Rulesによるテナント間データ分離
- ロールベースアクセス制御 (employee/admin/super_admin)
- クライアントサイド認証とサーバーサイド検証

## 📄 ライセンス

MIT License