# 商家数据库账号登录与测试数据技术设计

## 设计概览

继续使用 CloudBase Event 云函数 ordering-api 作为唯一业务入口。网页版通过 CloudBase Web SDK、微信小程序通过 wx.cloud.callFunction 调用同一个云函数；两端不直接读取商家账号、密码摘要或会话表。

调用链为：网页端/小程序端 -> ordering-api -> CloudBase PG REST/RPC -> PostgreSQL。CLOUDBASE_APIKEY 只保存在云函数服务端环境变量中。

## PostgreSQL 数据模型

### merchant_accounts

- id：稳定主键，首个账号为 merchant-admin
- username_normalized：去除首尾空格并转成小写的唯一登录名
- display_name：商家端显示名称
- password_hash、password_salt：scrypt 摘要和独立随机盐
- password_algorithm、password_version：算法和参数版本
- enabled：是否允许登录
- must_change_password：是否要求首次登录改密
- created_at、updated_at、last_login_at：审计时间

### merchant_sessions

- id：随机会话记录主键
- merchant_id：关联商家账号
- token_hash：原始令牌的 SHA-256 摘要
- expires_at：12 小时过期时间
- revoked_at：退出或改密后的撤销时间
- created_at、last_used_at：会话时间

客户端只持有一次返回的 32 字节随机令牌；数据库不保存原始令牌。

### 业务表和测试数据

- products：6 条测试商品
- store_settings：默认店铺与配送配置
- payment_methods：2 条明确标注“测试占位，请勿付款”的停用收款方式
- orders：自提 A001 和配送 D001 各 1 条
- order_counters：与测试订单一致的 A/D 计数
- merchant_accounts：admin 商家账号，首次登录必须改密
- merchant_sessions：运行时登录后创建，不预置有效会话

迁移版本为 20260825163038_init_ordering_pg。所有表启用行级权限约束，匿名端和普通登录端无直接读写授权，服务角色执行受控 CRUD。

## PostgreSQL 事务函数

- ordering_create_order：在单个事务中锁定商品、校验价格和库存、扣减库存、生成 A/D 短号并写入订单。
- ordering_replace_payment_methods：在单个事务中覆盖商家完整收款方式列表。
- ordering_change_merchant_password：原子更新密码摘要、清除首次改密标记并撤销该账号全部旧会话。

三个函数均撤销 public、anon 和 authenticated 执行权，只授予 service_role。

## 云函数认证动作

- merchantLogin：校验用户名和密码，返回商家公开信息、会话令牌和过期时间。
- merchantLogout：撤销当前会话，重复退出按成功处理。
- changeMerchantPassword：校验当前密码并调用 PG 事务函数，成功后要求重新登录。
- getMerchantSession：返回当前商家公开信息和会话到期时间。

用户名不存在、密码错误、账号停用统一返回“用户名或密码错误”。日志只记录动作、错误类型和状态码，不记录事件、密码、环境变量或令牌。

## 双端改造

网页版使用账号登录弹层，密码输入框不回显；首次登录时强制改密。所有商家动作传递 merchantSessionToken，退出时调用 merchantLogout。

小程序管理页顶部使用用户名密码登录卡片，App.globalData 只在当前进程保存 merchantSessionToken 和商家公开资料。商品、订单、店铺和收款设置统一使用同一会话。

旧 ADMIN_ACCESS_KEY、adminKey 和 x-admin-key 不再参与 CloudBase 授权；旧 Supabase 兼容路由的商家写入口返回 410，只保留顾客令牌查询和公开读取。

## 部署与验证

1. 检查并应用 PG 迁移，确认 7 张表和测试数据。
2. 创建服务 API Key，只注入 ordering-api 的 CLOUDBASE_APIKEY。
3. 部署云函数并验证公开读取、错误登录、正确登录、首次改密、受保护管理和退出后拒绝。
4. 构建网页版并检查小程序 JavaScript、WXML 和样式。
5. 检查 Git 差异，确保不包含 API Key、明文密码、密码摘要、盐或会话令牌。
