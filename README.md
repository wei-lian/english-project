# CodeVocab

CodeVocab 是一个基于 Vue 3 + Vite 的测试项目，用来把 `CodeVocab_PRD_v1.0.md` 中定义的学习产品快速落成可演示的前端原型。

## 已实现范围

- 今日学习：翻转卡片模式、先测后学模式、熟练度标记、今日进度
- 复习中心：到期复习列表、快速/深度复习切换
- 学习统计：趋势图、掌握分布、学习/复习对比、分类统计
- 单词库：搜索、筛选、排序、分页、详情查看
- 设置中心：每日数量、学习模式、主题、导入导出、重置数据
- 数据层：`localStorage` 持久化、`public/learning_data.json` 初始种子、词典接口回退

## 启动方式

如果本机安装了 Node.js：

```bash
npm install
npm run dev
```

默认开发地址为 [http://127.0.0.1:4173](http://127.0.0.1:4173)。

## 项目说明

- 本项目是纯前端测试原型，浏览器运行时无法直接写回 `public/learning_data.json`。
- 自动保存使用 `localStorage`，导入导出通过本地 JSON 文件完成。
- 词库目前内置了一组精简示例数据，便于演示完整流程，后续可以按 PRD 扩展到 500+ 词。

## 扩充词库

项目内已提供批量抓取脚本：

```bash
python scripts/generate_vocabulary.py
```

脚本会读取 `scripts/code_vocab_seed.txt` 里的词单，调用 Free Dictionary API 抓取音标、英文释义、例句和发音地址，并输出到 `src/data/vocabulary.generated.json`。

如果你想直接覆盖当前词库，可以这样执行：

```bash
python scripts/generate_vocabulary.py --output src/data/vocabulary.json
```

说明：

- `scripts/code_vocab_seed.txt` 支持 `word|category|difficulty|fullForm|zh|description` 格式。
- 只有 `word` 是必填，其余字段可留空。
- 如果暂时没有中文释义，前端会自动回退显示英文说明，不会再出现空白卡片。
