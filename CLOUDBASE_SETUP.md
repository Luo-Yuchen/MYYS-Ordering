# 腾讯 CloudBase PG + GitHub Pages 部署说明

本项目固定使用 CloudBase 环境 bun-order-d9gn0mjn09021bfbe，数据库运行模式为 PostgreSQL。

## 一、已建立的 CloudBase PG 数据

已通过迁移 20260825163038_init_ordering_pg 建立：

- products：商品、价格、库存、上下架状态和云存储图片编号
- orders：订单、顾客资料、自提/配送、金额和订单状态
- store_settings：店铺装修、配送范围、配送费、免配送费和最低起送配置
- payment_methods：多个个人收款码及名称、收款人、备注
- order_counters：每天的 A/D 三位短订单号计数器
- merchant_accounts：商家用户名、不可逆密码摘要和启用状态
- merchant_sessions：短期会话令牌摘要、过期和撤销状态

数据库同时包含 6 条测试商品、1 条自提订单、1 条配送订单和 2 条停用的测试收款码。测试收款码均标记“测试占位，请勿付款”。

## 二、商家账号

初始商家用户名为 admin。初始密码只用于第一次登录，账号带有首次改密标记；网页端和小程序端会要求先设置至少 10 位的新密码。

密码不以明文保存。云函数使用 scrypt 和独立随机盐校验密码，登录成功后签发 12 小时会话，数据库仅保存会话令牌的 SHA-256 摘要。修改密码会撤销该账号的全部旧会话。

## 三、部署 CloudBase 云函数

1. 函数名称保持 ordering-api，运行时使用 Node.js 18。
2. 在函数服务端环境变量中配置 CLOUDBASE_ENV_ID=bun-order-d9gn0mjn09021bfbe。
3. 创建 CloudBase 服务 API Key，并仅写入函数服务端环境变量 CLOUDBASE_APIKEY。
4. 将 ordering-api 调用权限设置为允许 anonymous 和 unauthenticated；商家管理和顾客订单权限继续由函数内部会话令牌校验。
5. 禁止把 CLOUDBASE_APIKEY、商家密码、密码摘要或会话令牌提交到 Git。
6. 部署 cloudfunctions/ordering-api 并由云端安装依赖。

网页版和小程序只调用云函数，不直接持有 PG 服务密钥。PG 表已启用行级安全限制，业务写入通过云函数和受限事务函数完成。

## 四、网页版匿名登录和安全域名

GitHub Pages 使用 CloudBase Web SDK 调用云函数，需要在 CloudBase 控制台开启匿名登录，并把 GitHub Pages 地址和正式域名 https://myys-ordering.com 加入 Web 安全域名。

匿名身份只能调用公开的点单云函数。查询全部订单、修改订单、商品、店铺、收款设置和上传商家图片仍需数据库商家会话。

## 五、小程序配置

1. 使用微信开发者工具打开项目根目录的 project.config.json，确认 AppID 为 wx2faf6bbe8487f0e4。
2. 打开“云开发 -> 设置 -> 环境设置 -> 管理我的环境 -> 使用已有腾讯云环境”，导入 bun-order-d9gn0mjn09021bfbe。
3. 确认环境列表已经显示该环境后重新编译；业务数据通过 wx.cloud.callFunction 访问，图片通过 wx.cloud.uploadFile 上传。
4. 若出现 -601034，先检查环境是否已导入以及 ordering-api 调用权限是否为空，不要把完整 errMsg 或 trace 展示给顾客。
5. 在真机上验证商家登录、首次改密、接单、收款设置和退出登录。

## 六、GitHub Pages

仓库已包含 .github/workflows/deploy-pages.yml：

1. 在 GitHub 仓库 Settings -> Pages 中选择 GitHub Actions。
2. 推送到 main 后等待部署工作流完成。
3. 自定义域名使用 myys-ordering.com，DNS 生效后开启 Enforce HTTPS。

静态构建命令为 pnpm build:github-pages，输出目录为 dist-github-pages。

## 七、云存储与个人收款码

商品图和店铺主视觉背景保存在 CloudBase 云存储，PG 只保存永久文件编号，云函数生成临时 HTTPS 展示地址。

个人收款码由商家填写 HTTPS 图片地址。测试收款码默认停用；正式营业前请替换为商家自己的收款码、核对名称和备注，再手动启用。
