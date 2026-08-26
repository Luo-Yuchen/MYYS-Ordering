# MYYS-Ordering

馒有意思点单程序，一套以 GitHub Pages H5 为当前正式入口的轻量点单系统。微信小程序源码暂时保留，不参与当前发布。

## 功能

- 顾客可选择到店自提或配送到家，并生成 `A` / `D` 开头的订单号。
- 支持配送费、最低起送金额、满额免配送费和可配送区域配置。
- 商家可管理商品、订单、门店配置以及多个个人收款码。
- 订单区分待接单、制作中、待取餐、配送中、已完成和已取消等状态。
- 网页端默认使用复古怀旧风界面。
- 商品、订单和收款设置统一使用腾讯云 CloudBase 数据库与云存储。
- 商家端使用 CloudBase PG 数据库中的用户名和密码登录，首次登录强制改密。

## 技术架构

```text
GitHub Pages H5
       ↓
CloudBase Web SDK（Publishable Key）
       ↓
ordering-api 云函数
       ↓
CloudBase PostgreSQL / 云存储
```

浏览器端不直接持有 PG 服务密钥，也不直接开放数据库写权限。订单金额、库存、订单号和商家权限统一由云函数校验。

## 项目结构

```text
app/                    网页应用源码
github-pages/           GitHub Pages 构建入口
wechat-mini-program/    暂停发布的微信小程序源码，仅保留备用
cloudfunctions/         CloudBase 云函数
.github/workflows/      GitHub Pages 自动部署工作流
CLOUDBASE_SETUP.md      CloudBase 配置与部署说明
```

## 本地开发

需要 Node.js `>=22.13.0` 和 pnpm。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

构建 GitHub Pages 静态站点：

```bash
pnpm build:github-pages
```

## 检查

```bash
pnpm test
pnpm lint
```

## 部署

1. 按照 [CLOUDBASE_SETUP.md](./CLOUDBASE_SETUP.md) 应用 PostgreSQL 迁移并部署 `ordering-api` 云函数。
2. 确认 CloudBase 已创建 Publishable Key，网页端仅使用其匿名权限调用公开云函数。
3. GitHub `main` 分支更新后，仓库工作流会自动构建并发布网页版。
4. 当前正式访问地址为 <https://luo-yuchen.github.io/MYYS-Ordering/>。

当前不需要在微信开发者工具中关联 CloudBase 环境，也不发布 `wechat-mini-program`。未来恢复小程序时，再单独完成环境关联、真机验证和发布检查。

生产环境不要在前端开放数据库写权限；订单提交、金额校验和订单号生成统一通过云函数完成。
