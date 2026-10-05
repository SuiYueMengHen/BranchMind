# Branch Mind · 分支学习工作台

**学习有主线，问题有分支。**

Branch Mind 将课程、章节、讲义和答疑组织成清晰的学习结构。你只需要确定大主题，AI 会自动创建章节；选中章节后，可继续细分或开始学习。版本 **0.1.0** 基于 Prompt Tree，采用 Web/PWA 形态。

[English](README.md) · [详细使用与多端部署](ai-chat-client/docs/BRANCH_MIND.md) · [更新记录](CHANGELOG.md)

## 主要功能

- **先输入主题**：创建主题先弹出输入框，确认“量子力学”等课程名称后才调用 AI。
- **自动创建章节**：按课程主题规划有序章节，子主题一键细分，不需要再写提示，最多六层。
- **开始学习**：围绕当前小主题生成讲义；足够具体的小节不显示无用的细分按钮。
- **独立答疑**：下方自由输入框用于答疑；主线或章节里的提问自动进入独立分支，继续追问留在答疑里。
- **讲义风格**：严谨讲义、直觉理解、精简复习或自定义；支持中英文术语括注、单份讲义覆盖、Markdown 和 LaTeX。
- **共享符号与记忆**：后续章节读取课程符号约定、确认后的共享笔记及前面讲义的限长参考。答疑原文不自动混入其他章节。
- **默认 DeepSeek**：在设置里填写自己的 API Key；也支持其他 OpenAI 兼容服务。
- **备份和多端使用**：本地 IndexedDB、JSON 导入导出、可选的鉴权同步及版本冲突检查。
- **简洁界面**：桌面和手机布局、浅色/深色外观及 PWA 安装支持。

## 快速启动

需要 **Node.js 22+** 和 npm。

```sh
git clone https://github.com/SuiYueMengHen/BranchMind.git
cd BranchMind/ai-chat-client
npm ci
npm run dev
```

打开 **http://localhost:1666**，在“设置”中添加模型密钥，再创建学习主题。项目不附带任何可用密钥或个人学习数据。

稳定使用：

```sh
npm run build
npm start
```

服务端必须保持运行。请固定使用同一个访问地址；`localhost`、`127.0.0.1` 和不同端口对应不同的浏览器存储。CLI 可使用 `npm start -- --port 1666` 指定端口。

## 学习流程

1. 点击“新建学习主题”，输入主题，确认后自动生成章节。
2. 点击章节，“创建分支”自动生成更细的小主题。
3. 点击“开始学习”生成当前小节讲义。
4. 在下方输入疑问，进入独立答疑；随后返回章节继续学习。
5. 将确认过的结论保存为共享笔记，并维护全课程符号约定。

## Windows、macOS、Android 与同步

当前为响应式网页和 PWA，可通过兼容浏览器的安装入口使用；非 localhost 安装需要 HTTPS。**没有原生 EXE、DMG 或 APK 安装包。**

多端同步需要一台可长期运行的服务器、HTTPS 和持久化存储。设置至少 24 位随机 `BRANCH_MIND_SYNC_TOKEN` 后，学习空间以及模型/工具接口需要先输入连接口令。同步采用手动上传、下载和版本冲突检查，不自动合并；API Key 和模型配置需在各设备单独设置。

服务面向个人单空间。公开部署前应配置鉴权和 HTTPS，不能直接暴露模型或工具接口。GitHub Pages 无法运行本项目必需的 Next.js API。详见[部署说明](ai-chat-client/docs/BRANCH_MIND.md)。

Docker 的本机启动方式：

```sh
cd ai-chat-client
docker compose up --build -d
```

默认仅绑定本机地址，数据保存在持久卷。此版本未实测 Docker 构建和真实 Windows/Android 设备安装。

## 数据与隐私

课程内容保存在浏览器 IndexedDB；模型密钥单独保存在 localStorage，请求时发送到应用服务器和指定模型服务。应用服务器可以读取这些凭据及请求内容，并未实现端到端加密。启用同步后，服务器会保存学习数据快照；模型服务会收到用于教学的上下文。

备份不包含模型配置里的密钥，但如果你把密钥手动写进聊天或笔记，备份仍会包含该文本。分享前请自行检查。清理浏览器数据可能删除学习记录，请保留备份。

发布排除了环境文件、密钥、浏览器资料及截图、学习快照、请求日志和本地真实 API 测试报告。可运行 `npm run privacy:check` 检查发布仓库中的受跟踪文件（此可选检查需要 Python 3）。

## 开发与验证

```sh
cd ai-chat-client
npm ci
npm run typecheck
npm run lint
npm run test:run
npm run build
```

默认测试不调用付费模型。0.1.0 的离线回归测试共 112 项通过；真实 DeepSeek 测试已验证连接检测、流式输出、章节规划、细分、讲义生成和上下文继承。数学内容的正确性仍需要按学科检查。

## 许可证与来源

采用 [MIT](LICENSE) 许可证，依赖及上游说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

基于 [Prompt Tree](https://github.com/yxp934/Prompt-Tree) v0.7.0，基线提交 `e96db4ef11a674d6ad9f298b75b52f24201da2a7`。原始文档保存在 [UPSTREAM_README.md](ai-chat-client/docs/UPSTREAM_README.md)，兼容已有 `prompt-tree.*` 存储键。Branch Mind 自身版本从 0.1.0 开始。
