# MYYS-Ordering

馒有意思点单程序，一套同时支持网页版与微信小程序的轻量点单系统。

## 功能

- 顾客可选择到店自提或配送到家，并生成 `A` / `D` 开头的订单号。
- 支持配送费、最低起送金额、满额免配送费和可配送区域配置。
- 商家可管理商品、订单、门店配置以及多个个人收款码。
- 订单区分待接单、制作中、待取餐、配送中、已完成和已取消等状态。
- 网页端与小程序端默认使用复古怀旧风界面。
- 商品、订单和收款设置统一使用腾讯云 CloudBase 数据库与云存储。

## 技术架构

```text
网页版（GitHub Pages） ─┐
                       ├─ CloudBase 云函数 ─ 数据库 / 云存储
微信小程序 ────────────┘
```

## 项目结构

```text
app/                    网页应用源码
github-pages/           GitHub Pages 构建入口
wechat-mini-program/    微信小程序源码
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

1. 按照 [CLOUDBASE_SETUP.md](./CLOUDBASE_SETUP.md) 创建数据库集合并部署 `ordering-api` 云函数。
2. 在 CloudBase 控制台启用匿名登录，并配置网页安全域名。
3. 在微信开发者工具中导入 `wechat-mini-program`，配置云开发环境后上传小程序。
4. GitHub `main` 分支更新后，仓库工作流会自动构建并发布网页版。

生产环境不要在前端开放数据库写权限；订单提交、金额校验和订单号生成统一通过云函数完成。
