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

初始商家用户名为 admin。当前 admin 账号已完成初始化，可使用数据库中配置的管理员密码直接访问商家功能；后续新建账号仍可启用首次改密策略。

密码不以明文保存。云函数使用 scrypt 和独立随机盐校验密码，登录成功后签发 12 小时会话，数据库仅保存会话令牌的 SHA-256 摘要。修改密码会撤销该账号的全部旧会话。

## 三、部署 CloudBase 云函数

1. 函数名称保持 ordering-api，运行时使用 Node.js 18。
2. 在函数服务端环境变量中配置 CLOUDBASE_ENV_ID=bun-order-d9gn0mjn09021bfbe。
3. 创建 CloudBase 服务 API Key，并仅写入函数服务端环境变量 CLOUDBASE_APIKEY。
4. 在 HTTP 访问服务创建 `/ordering-api` → `ordering-api`（SCF）路由，关闭路由鉴权；商家管理和顾客订单权限继续由函数内部会话令牌校验。
5. 禁止把 CLOUDBASE_APIKEY、商家密码、密码摘要或会话令牌提交到 Git。
6. 部署 cloudfunctions/ordering-api 并由云端安装依赖。

网页版只通过 CloudBase HTTPS 路由调用云函数，不持有 Publishable Key 或 PG 服务密钥。PG 表已启用行级安全限制，业务写入通过云函数和受限事务函数完成。

## 四、网页版 HTTPS 路由

GitHub Pages 通过 CloudBase HTTP 访问服务的 `/ordering-api` HTTPS 路由调用云函数。路由关闭网关鉴权，服务端 API Key 仍只允许保存在云函数环境变量中。

公开路由只指向 `ordering-api`。查询全部订单、修改订单、商品、店铺、收款设置和上传商家图片仍需数据库商家会话；顾客只能执行公开点单和持令牌查询。

## 五、小程序暂停说明

当前正式入口仅使用 GitHub Pages H5，暂时不使用微信小程序云开发，也不需要在微信开发者工具中导入 CloudBase 环境。

`wechat-mini-program` 目录继续保留作为备用源码，但不参与当前构建、部署和线上故障排查。未来恢复小程序时，需要重新核对 AppID、CloudBase 环境关联、云函数调用权限、合法域名和真机表现后再发布。

## 六、GitHub Pages

仓库已包含 .github/workflows/deploy-pages.yml：

1. 在 GitHub 仓库 Settings -> Pages 中选择 GitHub Actions。
2. 推送到 main 后等待部署工作流完成。
3. 当前不使用自定义域名，正式地址为 `https://luo-yuchen.github.io/MYYS-Ordering/`。

静态构建命令为 pnpm build:github-pages，输出目录为 dist-github-pages。

## 七、云存储与个人收款码

商品图和店铺主视觉背景保存在 CloudBase 云存储，PG 只保存永久文件编号，云函数生成临时 HTTPS 展示地址。

个人收款码由商家填写 HTTPS 图片地址。测试收款码默认停用；正式营业前请替换为商家自己的收款码、核对名称和备注，再手动启用。
