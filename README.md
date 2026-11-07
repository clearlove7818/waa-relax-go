# waa-relax-go

中文表达与交互技能。用于撰写、改写、校对和审阅中文。也可统一术语、整理回执、把操作指导拆成可执行步骤。保留事实和完整解释，不改动代码、命令等机器字面量。

`waa-relax-go` 负责中文表达与交互；独立的 `tech-doc-style-chinese` 补充技术文档要求。

仓库地址：[clearlove7818/waa-relax-go](https://github.com/clearlove7818/waa-relax-go)。

## 包含什么

| 内容 | 入口 |
| --- | --- |
| 技能入口与读取顺序 | [SKILL.md](SKILL.md) |
| 57 条完整规则，含解释、原因与示例 | [通用](rules/for-all.md)、[对话](rules/for-chat.md)、[文档](rules/for-document.md)、[界面](rules/for-web-dev.md)、[指令](rules/for-instruction-writing.md) |
| 全部 51 不推荐＋29 推荐＋3 模板条目及完整字段 | [词表指南](dictionary/README.md) |
| 十条低负担行为、六个例外、五种阅读阻力与发出前检查 | [交互规则](references/interaction.md) |
| 自然语言启停、写作／完整润色／摘要／校对／审阅、独立技术文档协作 | [启停](references/activation-and-scope.md)、[编辑流程](references/editing-workflow.md)、[协作](references/tech-doc-compatibility.md) |
| 可选只读检查器，无第三方运行依赖 | [工具说明](tools/README.md) |

从 `SKILL.md` 开始，按任务读取：普通问答使用入口的共同原则；材料编辑读取通用、词表与对应场景；复杂交互读取步骤与状态规则。完整审计有独立路径，覆盖全部本包规则和适用词表，逐项记录结果，不以轻入口省略检查。

完整润色保留原有信息，摘要按授权取舍，校对只处理约定范围，审阅不自动写回。删冗余按整句的信息价值判断，不按否定词或字数计数；必要权限、失败和验证缺口仍须清楚。

## 怎么使用与停止

直接给能读取完整目录的宿主表达请求，例如：

```text
用 waa-relax-go 改这段中文，保留数字、条件、否定和原意：……
```

也可直接说「说清楚一点」「别绕，直接说重点」。需要操作步骤时，可说「拆成我能照做的步骤」；恢复上下文时，可说「别让我记前文」。普通请求覆盖当前任务及追问；「只这条」收窄到当前回复。

需要本会话跨主题持续时明确说：

```text
启用 relax go 模式，接下来都按这个方式。
```

停止时说「停止 relax go」「关闭这个表达模式」或模式控制语境中的 `normal mode`。模式只在当前会话持续；引文不改变模式。完整范围见[启停说明](references/activation-and-scope.md)。

## 安装

从仓库获取**完整 `waa-relax-go/` 目录**，按宿主的技能加载方式使用。宿主需要支持技能目录和相对资源读取；只复制 `SKILL.md` 会缺少规则与词表。

1. 确认宿主的技能目录；已有同名目录时先核对内容，避免覆盖用户改动。
2. 复制完整目录，保留规则、词表、参考文件、工具和许可证。
3. 让宿主读取 `SKILL.md`。
4. 用上述表达请求检查实际效果。

技能使用 Markdown 和相对路径，不依赖平台专属工具或配置。只有可选检查器需要 Node.js。

本包的表达与交互规则完整自足，无需安装、启用或读取 STC、i-have-adhd 来补齐日常能力。技术成品按下面的分工使用独立 tech-doc。

## 与 tech-doc 配合

技术文档、产品文案和界面文案适用时，读取独立的 `tech-doc-style-chinese` 及其参考。技术成品遵循专门要求，周围对话遵循本技能；不可读取时，说明缺项并按本技能继续。

普通中文默认弯引号，技术成品默认直角引号；项目约定与固定引用优先。检查器用 `--style relax-go|tech-doc` 和 `--quotes` 选择风格。具体分工见[协作说明](references/tech-doc-compatibility.md)。

## 可选检查器

从包含本目录的位置运行手工示例：

```sh
printf '%s\n' '点击「保存」。像素对齐。' | node waa-relax-go/tools/check.mjs --style tech-doc --json
```

结果中 `errors` 为 `0`；「对齐」保留为用词提示，供人工判断。

检查器只读，支持文件或标准输入、四种场景、文本／Markdown／JSON 报告，以及 Anti-Echo 冗余复核。语义仍需人工判断；参数与限制见[工具说明](tools/README.md)。

已验证环境为 macOS、Node.js 26.13.0；源码运行门槛为 Node.js 18+，其他版本兼容性未验证。没有运行时可直接按规则人工复核。

## 维护与升级

relax go 按基于 STC fork 后二次开发的项目维护。跟进 STC 时按[上游同步约定](UPGRADE.md#stc-上游同步约定)处理增量并保留二开能力；基线与来源见[当前来源记录](UPGRADE.md#当前来源记录)。i-have-adhd 更新或新提示词、文章与案例的吸收也按该指南执行。

## 验证范围

检查器回归验证参数、输入保护、提取和报告等程序行为，不证明模型回复质量。本包尚未建立普遍优于简短提示的对照证据，表达效果需在实际宿主和具体任务中判断。

## 致谢与许可

感谢 Daimonia 的 STC、Ayoub Ghriss 的 i-have-adhd，以及 Fenng 的 tech-doc-style-chinese。
规则与词表采用 [CC BY 4.0](LICENSE)，适配代码采用 [MIT](LICENSE-CODE)；来源署名与改动说明见[第三方许可](THIRD_PARTY_NOTICES.md)。
