# Supabase 接入步骤

## 1. 在 Supabase 后台启用匿名登录

1. 打开 `Authentication`。
2. 找到 `Providers`。
3. 启用 `Anonymous Sign-Ins`。

这个项目现在没有独立登录页，所以前端会在首次进入时自动创建一个匿名用户，并把学习数据绑定到这个用户上。

## 2. 建学习状态表

1. 打开 `SQL Editor`。
2. 新建一个查询。
3. 把 [supabase/user_learning_state.sql](C:/Users/jlz/Desktop/外语项目/supabase/user_learning_state.sql:1) 的内容整段复制进去并执行。

执行完成后，会得到一张 `public.user_learning_state` 表，用来保存：

- `settings`
- `daily_queue`
- `learning_records`
- `statistics`

## 3. 建词库表

1. 继续在 `SQL Editor` 新建一个查询。
2. 执行 [supabase/vocabulary.sql](C:/Users/jlz/Desktop/外语项目/supabase/vocabulary.sql:1)。

执行完成后，会得到一张 `public.vocabulary` 表。首页、复习中心、统计页、单词库页面都会优先读取这张表的数据。

## 4. 导入词库种子数据

1. 本地执行：

```bash
npm run generate:supabase:vocab
```

2. 执行完成后，会生成 [supabase/vocabulary_seed.sql](C:/Users/jlz/Desktop/外语项目/supabase/vocabulary_seed.sql:1)。
3. 把这个文件内容复制到 `SQL Editor` 再执行一次。

这样就会把当前本地的 90 条词库同步成 Supabase 可读取的数据。

## 5. 复制前端连接信息

打开 Supabase 项目的 `Connect` 弹窗，或者 `Settings > API Keys` 页面，拿到这两个值：

- `Project URL`
- `Publishable key`，格式是 `sb_publishable_...`

不要把 `sb_secret_...` 放进前端项目。

## 6. 配置本地环境变量

在项目根目录创建 `.env.local`，内容参考 [\.env.example](C:/Users/jlz/Desktop/外语项目/.env.example:1)：

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_publishable_key
```

改完后重启开发服务器。

## 7. 数据迁移规则

- 如果本地 `localStorage` 已经有学习数据，而云端表还是空的，应用会自动把本地数据首批同步到云端。
- 如果云端已经有数据，应用会优先读取云端数据。
- 如果 `public.vocabulary` 表里已经有词库数据，页面会优先读取线上词库；如果为空，会回退到本地 `src/data/vocabulary.json`。
- 如果 Supabase 没配好，应用会自动回退到本地存储，不会影响继续使用。

## 8. 你需要提供给我什么

如果你想让我继续帮你把真实环境变量也填好，你只需要提供：

- `Project URL`
- `Publishable key`

如果你还没执行 SQL，我也可以继续帮你核对建表结果；你把执行后的报错或表结构截图发我就行。
