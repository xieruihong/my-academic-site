# 谢瑞洪的个人学术网站

此目录是当前学术网站的 GitHub Pages 迁移版。目标公开地址保持不变：

https://xieruihong.github.io/my-academic-site/

## 日后在哪里更新

个人资料、论文、会议、专利、教育经历、项目、荣誉和动态集中在 `content/site-content.json`。

发布完成后，可在 GitHub 的 `master` 分支打开该文件，点击铅笔按钮修改，再点击 **Commit changes** 保存。网站会自动重新发布；Actions 中的发布任务成功后，刷新公开页面即可看到修改。

页面布局和固定文字在 `src/Home.tsx`；颜色和排版在 `src/globals.css`。

## 本地查看

使用 Node.js 24 和 pnpm 11.9.0。在此文件夹执行：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

打开终端显示的本地地址（末尾为 `/my-academic-site/`）。保存文件后本地页面会更新。本地修改不会自动公开，提交并推送到 GitHub 的 `master` 分支后才会发布。

## 自动更新范围

访客打开网页后，“最新成果与引用动态”向 ORCID 请求最新公开成果，并向 OpenAlex 查询引用数据；每 10 分钟刷新一次，也可手动刷新。第三方服务不可用时会显示本地备份。

此功能不是 Google Scholar 实时抓取，也不会自动改变履历、审稿状态或完整论文清单。这些内容由本人在资料文件中更新并发布。

## 首次替换与恢复

当前目录已适配 `/my-academic-site/` 路径，原有子页面会转向新版相应章节。完整首页会在构建时生成，无须服务器运行，也不依赖实时数据请求才能阅读。

首次迁移应将这些文件提交到原仓库的 `master` 分支，保留原有 Git 历史，不强制推送。先在 GitHub Settings → Pages 将发布来源切换为 **GitHub Actions**。现有 `gh-pages` 分支不要删除，作为旧网站的恢复点。另将被替换的源分支保存为备份分支。

后续由 `.github/workflows/deploy.yml` 在每次提交后执行构建和发布。无需购买域名或设置 DNS。

官方发布说明：[Vite GitHub Pages](https://vite.dev/guide/static-deploy.html#github-pages)、[GitHub Pages 发布来源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。
