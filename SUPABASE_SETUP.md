# Supabase 旧方案说明

当前项目已经迁移到腾讯 CloudBase，网页端和小程序端均不再调用 Supabase。

请按照 [CLOUDBASE_SETUP.md](./CLOUDBASE_SETUP.md) 部署 `ordering-api` 云函数、开启匿名登录并发布 GitHub Pages。

`supabase/` 与旧 `app/api/` 文件暂时保留用于历史数据结构参考，不再是当前程序的数据通路。
