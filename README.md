# suenyiyang-pi-preset

suenyiyang 的 [Pi](https://pi.dev) coding agent preset。

通过 Pi Package 打包并分发个人常用的 **extensions / skills / prompts / themes**，安装后即可在 Pi 中自动加载；换电脑时一条命令恢复整套插件配置。

> **Security:** Pi packages 拥有完整系统权限。Extensions 可执行任意代码，skills 可指示模型执行任意操作。安装第三方包前请先审阅源码。

## 安装

```bash
# 从 git 安装
pi install git:github.com/suenyiyang/suenyiyang-pi
pi install https://github.com/suenyiyang/suenyiyang-pi

# 从 npm 安装
pi install npm:suenyiyang-pi-preset
```

仅当前会话试用（不写入 settings）：

```bash
pi -e /path/to/suenyiyang-pi
pi -e git:github.com/suenyiyang/suenyiyang-pi
```

安装到项目级（写入 `.pi/settings.json`，可团队共享）：

```bash
pi install -l npm:suenyiyang-pi-preset
```

## 卸载 / 管理

```bash
pi remove npm:suenyiyang-pi-preset   # 或对应 source
pi list
pi update --extensions
pi config                         # 启用/禁用具体资源
```

## 内置依赖（bundled pi packages）

安装本 preset 时会一并带上下列 Pi 包，并自动加载其 extensions / skills / prompts：

| 包 | 提供 |
|----|------|
| [pi-subagents](https://www.npmjs.com/package/pi-subagents) | Claude Code 风格的自主 sub-agents（含 council mode、parallel review 等 prompts） |
| [pi-web-access](https://www.npmjs.com/package/pi-web-access) | Web 搜索 / URL 抓取 / GitHub / YouTube 等扩展 |
| [@juicesharp/rpiv-btw](https://www.npmjs.com/package/@juicesharp/rpiv-btw) | RPIV（Read-Plan-Implement-Verify）工作流扩展 |
| [pi-codex-image-gen](https://www.npmjs.com/package/pi-codex-image-gen) | 用 OpenAI Codex 后端生成/编辑图片（含 imagegen skill） |
| [pi-codex-tool-folding](https://github.com/suenyiyang/pi-codex-tool-folding) | 把一轮 run 里的所有 tool call 折叠成一行安静的 "Worked for..."（git 源） |
| [pi-openai-server-compaction](https://github.com/algal/pi-openai-server-compaction) | OpenAI server-side compaction，长会话上下文压缩（git 源） |

它们声明在 `dependencies` + `bundleDependencies` 中，资源通过 `pi.extensions` / `pi.skills` 的 `node_modules/...` 路径引用。

## 自带 extensions

| 文件 | 说明 |
|------|------|
| `extensions/tps-status.ts` | 在 footer 实时显示 tokens/second 流式生成速率，`/tps` 切换开关 |
| `extensions/auto-session-title.ts` | 自动用便宜模型给会话起名；可用 `~/.pi/agent/auto-session-title.json` 覆盖 `provider` / `model` / `reasoningEffort` / `timeoutMs`，无配置时自动挑选当前可用的最便宜模型 |

## 包结构

```
suenyiyang-pi/
├── package.json          # pi manifest + pi-package keyword
├── README.md
├── extensions/           # .ts / .js 扩展
├── skills/               # SKILL.md 技能目录
├── prompts/              # .md 提示词模板
└── themes/               # .json 主题
```

`package.json` 中的 `pi` 字段声明资源路径：

```json
{
  "name": "suenyiyang-pi-preset",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

路径相对于包根目录；数组支持 glob 与 `!exclusions`。

若省略 `pi` manifest，Pi 会从同名约定目录自动发现资源。

## 开发

1. 在对应目录添加资源：
   - `extensions/*.ts` — 扩展
   - `skills/<name>/SKILL.md` — 技能
   - `prompts/*.md` — 提示词
   - `themes/*.json` — 主题
2. 本地加载验证：

```bash
pi -e .
# 或
pi install .
```

3. 用 `pi config` 检查资源是否被加载。

### 依赖约定

- 运行时第三方依赖放在 `dependencies`（`pi install` 会执行 `npm install`）
- 若 import Pi 核心包，放入 `peerDependencies` 且版本为 `"*"`，不要打包：
  - `@earendil-works/pi-ai`
  - `@earendil-works/pi-agent-core`
  - `@earendil-works/pi-coding-agent`
  - `@earendil-works/pi-tui`
  - 上述包的旧 scope 名 `@mariozechner/pi-*`，Pi 运行时同样以虚拟模块提供；
    放进 `dependencies`（即使写成 alias）会安装真实副本并触发 host-provided 警告
  - `typebox`
- 部分第三方包对 Pi 核心包的 peer range 已过期。仓库根目录 `.npmrc` 因此设置
  `force=true`，让 `npm ci` 容忍这类冲突但不丢弃 peer 树。
  不要改用 `legacy-peer-deps`（会从 lock 中移除整个 `@earendil-works/*` peer 子树）。

## 换机同步

本仓库只同步 **插件**（packages）。`~/.pi/agent/settings.json` 里的个人偏好
（默认 provider/model、主题、subagents 模型覆盖等）不在包内，换新机器时：

```bash
pi install git:github.com/suenyiyang/suenyiyang-pi   # 恢复全部插件
# 再手动复制 settings.json（注意其中的 auth 与机器相关配置）
```

## 自动发布

发布使用 [npm Trusted Publisher](https://docs.npmjs.com/trusted-publishers)（OIDC），**无需**在仓库中配置 `NPM_TOKEN`。Workflow 文件：`.github/workflows/daily-release.yml`。

### 触发方式

| 触发 | 行为 |
|------|------|
| **push 到 `main`** | 自动发布。若当前 `package.json` 版本已在 npm 上存在，则自动 patch 升版、创建 `chore(release): x.y.z` commit、annotated `vX.Y.Z` tag 和 GitHub Release 并推回远端 |
| **每日北京时间 0:00**（`cron: 0 16 * * *` UTC） | 用 `npm-check-updates` 更新依赖；有变更才升版发布；无变更则跳过 |
| **手动 Run workflow** | 同日更逻辑；可勾选 `force_publish` 强制发一版 |

Bot 自己的 `chore(release):` 提交不会再次触发发布，避免循环。

### 版本规则

- 你已手动升版且该版本尚未发布 → 直接按该版本发布
- 你未升版（版本已在 npm 上）→ CI 自动 patch 并帮你推送 release commit

### 首次启用前请确认

- npm 包 Settings → Trusted Publisher 指向 `suenyiyang` / `suenyiyang-pi` / `daily-release.yml`
- 仓库 Settings → Actions → Workflow permissions 为 **Read and write**

在 npm 发布可用之前，直接用 `pi install git:...` 即可，不依赖 npm。

## License

MIT
