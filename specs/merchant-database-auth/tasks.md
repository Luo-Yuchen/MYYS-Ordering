# 商家数据库账号登录与测试数据实施任务

## 1. CloudBase PG

- [x] 确认环境 bun-order-d9gn0mjn09021bfbe 使用 PostgreSQL 运行模式。
- [x] 生成并应用迁移 20260825163038_init_ordering_pg。
- [x] 建立 7 张表、3 个事务函数、RLS 权限和索引。
- [x] 写入 6 条商品、店铺设置、2 条停用测试收款码、A001 自提单和 D001 配送单。
- [x] 写入 admin 商家账号的 scrypt 摘要和首次改密标记。
- [x] 重复查询验证表结构和测试数据数量。

## 2. CloudBase Event 云函数

- [x] 将业务数据访问迁移到 CloudBase PG REST/RPC。
- [x] 实现 scrypt、恒定时间密码比较和登录失败短时限制。
- [x] 实现 12 小时会话、令牌摘要、撤销和账号启用检查。
- [x] 增加 merchantLogin、merchantLogout、getMerchantSession 和 changeMerchantPassword。
- [x] 全部管理动作改用 merchantSessionToken。
- [x] 删除云函数 ADMIN_ACCESS_KEY 和 x-admin-key 授权。
- [x] 收敛错误日志，避免输出事件和敏感值。
- [x] 创建服务 API Key、注入云函数环境变量并部署。

## 3. 网页端

- [x] 增加用户名密码登录弹层。
- [x] 增加首次改密和改密后重新登录。
- [x] 订单、商品、店铺和收款设置改用数据库会话。
- [x] 退出商家端时撤销会话并清空内存令牌。
- [ ] 完成 lint、生产构建和交互冒烟测试。

## 4. 微信小程序端

- [x] 全局状态改为商家会话令牌和公开账号资料。
- [x] 增加用户名密码登录、首次改密和退出登录。
- [x] 管理 API、商品编辑和店铺编辑统一改用会话令牌。
- [x] 保持密码和令牌仅存在于当前小程序进程。
- [ ] 完成真机或开发者工具交互验证。

## 5. 兼容清理与交付

- [x] 停用旧 Supabase 商家固定口令旁路。
- [x] 更新环境变量示例和 CloudBase PG 部署说明。
- [ ] 全局检索旧授权字段并修复残留。
- [ ] 运行测试、CloudBase 代码审查、编码和 CRLF 检查。
- [x] 经部署门禁确认后部署 ordering-api 并执行云端冒烟测试。
- [x] 创建 Git 提交并在远端无冲突时推送 GitHub。
