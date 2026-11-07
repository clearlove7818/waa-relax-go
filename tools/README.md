# 可选只读检查器

此工具只读检查选定材料，支持风格、引号和用词提示，以及 Anti-Echo 冗余复核。普通对话可直接使用规则，不需要运行工具。

## 环境与支持边界

检查器需要 Node.js 18+，低于该版本时提示并退出，无第三方运行依赖。**已验证环境为 macOS、Node.js 26.13.0。** 其他版本的兼容性尚未验证。

不能运行 Node／shell／文件工具时，按完整规则人工复核，说明检查器未运行；不是技能读取失败。权限拒绝单独披露，不换路径／工具绕过。版本门槛不等于兼容性已实测。

## 调用

在完整技能目录所在位置，手工示例：

```sh
node waa-relax-go/tools/check.mjs --help
node waa-relax-go/tools/check.mjs 文档.md --profile for-document --style relax-go
node waa-relax-go/tools/check.mjs 技术说明.md --profile for-document --style tech-doc --quotes corner --format markdown
printf '%s\n' '点击「保存」。像素对齐。' | node waa-relax-go/tools/check.mjs --style tech-doc --json
```

安装目录不同时，使用本机实际目录代替示例 `waa-relax-go`，不依赖任何平台固定路径。入口没有 `init`、`install` 或 hook。

| 参数 | 用法 |
| --- | --- |
| 路径 | 指定文件或目录；没有路径时读取 stdin。空输入或目录无可检查文件返回 2，不算通过 |
| `--profile` | `for-chat`、`for-document`、`for-web-dev`、`for-instruction-writing` |
| `--style` | `relax-go` 默认弯引号；`tech-doc` 默认直角引号并给技术语境提示 |
| `--quotes` | `auto` 按风格；`curly` 弯引号；`corner` 直角引号；`preserve` 保留两类引号，不报其风格差异 |
| `--format` | `text` 可读报告（默认）或 `markdown` |
| `--json` | 完整结构化报告，包括 style、quotes、位置、rule、原句、建议、提取范围与计数；优先于 format |
| `--max-errors` | 非负安全整数；超过阈值返回 1，默认 0。不接受负数、小数、缺值或其他非法值 |
| `--no-warnings` | 隐藏普通 warning；计数保留，Anti-Echo pending 仍阻止通过 |
| `--anti-echo` | 未复核 G20 疑点返回 1 |
| `--review-decisions` | 已授权的 Anti-Echo 决定 JSON 路径；必须同时用 `--anti-echo` |
| `--` | 后续按路径处理，可检查以 `-` 开头的文件 |

重复路径按绝对定位去重。输入文件或父目录经过符号链接时拒绝读取，包括被后续 `..` 抵消的路径段；复核文件使用相同检查。目录内符号链接不展开。目录递归只读 Markdown、文本和代码，跳过隐藏目录以及 `node_modules`、`dist`、`build`、`out`、`coverage`、`vendor`、`target`；不读取 FIFO 等非普通文件。

路径检查与读取不是原子操作，不提供对抗其他进程并发替换路径的沙箱隔离。只检查可信、检查期间稳定的本地目录；这项限制不改变只读约定。

不指定场景时：`AGENTS.md`、`CLAUDE.md`、`SKILL.md` 使用指令场景；代码扩展名使用界面场景并提取字符串／JSX；其他使用文档场景。场景探测是候选，不证明字符串确实可见。

## 实际检查政策

| 规则 | 行为 |
| --- | --- |
| G3–G7 及 scoped 人称／I1 | 保留完整词表匹配、位置与原句，**warning**；先判断真实技术／官方／项目含义及原强度，不无条件替换 |
| G12 | 超过 40 的长度提示，**warning**；不截断解释／步骤，不强制 30 字步骤或 5 项列表 |
| G17 | 与选定 curly／corner 风格不同的引号为选定风格 **error**；`preserve` 不判两类引号错误。直引号给 warning |
| G19 | 中西文与数字边界无空格，warning；不修改字面量 |
| G20 | 可能无用的括号排除、自证、制作说明／界面标签，warning，启用 Anti-Echo 时 pending 阻止通过 |
| C3 | 可编辑对话感叹号，选定基线风格 error；固定语气／引用先保护 |
| D1／W1／W2／I2 | 人称、称呼混用、混合强度提示，warning；语境和项目约定优先 |

退出码：`0`＝未超过错误阈值且无待复核项；`1`＝超过错误阈值或有待复核项；`2`＝参数、输入、读取或运行失败。词语警告不使普通检查失败，含义由作者判断。

词语正则可能误报，例如指令场景中的 `不要求` 可被匹配为 `不要`；必须结合原句判断，不把匹配结果直接视为违规。

两类中文成对引号里的文字作为引用／词语提及跳过词表与代词；选定引号排版在可编辑周边单独检查。固定引语的两类引号可用 `--quotes preserve`，Markdown 引用块保持原文不查。不把技术术语加入全局白名单吞掉其他真正候选。需要 STC audit 与 tech-doc audit 时分别选择 style，不默默改成品约定。

`--style tech-doc` 适配引号与用词提示。语义、API 状态、段落格式和实际呈现按独立 tech-doc 要求人工复核。

<a id="anti-echo"></a>
## Anti-Echo 的内容绑定

先对明确选定的材料读取当前报告：

```sh
node waa-relax-go/tools/check.mjs 文档.md --anti-echo --json
```

报告 `antiEcho.pending` 给出 id、位置和原句。没用的内容删掉后重新检查；真实边界保留时，理由要写清删后如何导致具体误解、错误操作或未满足要求。只有任务已授权审稿记录文件时，才将当前 id 写入该审稿记录；不为每次聊天创建文件。

```json
{
  "version": 1,
  "decisions": [
    {
      "id": "从当前报告复制的完整 64 位 id，不直接使用这段示例",
      "decision": "keep",
      "reason": "报价不含税，删去范围会让客户按含税总价安排预算。"
    }
  ]
}
```

该 JSON 是格式说明，示例 id 故意不是可放行的真实散列。id 必须是 64 位小写十六进制字符串；格式错误、数组类型 id、空 reason、重复 id、非 keep 或错误 version 会返回 2。格式合法但未匹配当前内容的 id 不放行当前疑点，新 pending 返回 1；不能把旧示例当已复核记录。

```sh
node waa-relax-go/tools/check.mjs 文档.md --anti-echo --review-decisions 审稿决定.json
```

id 绑定规范化路径、完整文件 SHA-256、位置、原句和触发文字。移动路径或文件任意变化会使旧 keep 无法匹配；新 pending 返回 1。`--no-warnings` 或放宽 error 阈值不能绕过 pending。文件路径为绝对定位，报告会包含本次指定文件的路径；不要把含隐私或凭证材料交给本工具，也不要无授权外传报告。

机器仅验证绑定、数据格式与非空理由，不能判断理由是否充分。未匹配多余内容仍须按 G20 人工看；非括号“没有东坡肉”可能不触发。这是筛查限制，不是内容安全声明。

## 提取与保护限制

Markdown 跳过围栏／缩进代码、行内代码、URL／链接目标、引用块、frontmatter、注释和含 `✗` 的反例行；独立 `stc-disable-next-line` 注释跳过下一行。frontmatter 的 `---` 和 `...` 终止行均被识别，后续正文继续检查；未闭合时仍跳过剩余内容，须核对提取计数。路径、简单模板占位符被位置保持的遮罩保护；直接指定 JSON 文件只标 `protected-json`，不检查键和值，也不验证 JSON 语法。被保护内容不算已经语义审阅。

Markdown 中完整 HTML 标签的属性定界引号不触发 G17 直引号提示；属性内的中文、中文引号和嵌套的正文直引号仍按原规则检查。支持已测的多行属性和属性内 `>`，不把整段属性内容排除。该处理不证明属性属于用户可见文案。

代码字符串和 JSX 用轻量扫描器提取，遮罩简单路径／URL／插值和转义，保持定位。**不是 AST 或渲染器**：嵌套模板、复杂 JSX／HTML、实体、正则、多行引用、动态国际化与字符串拼接可能漏查或误查；不能确定某段是用户文案还是机器值。机器值始终不自动编辑，人工对完整字符串及真实页面复核（W8／W9）。JSON 保护、quote mode 和常见字面量已实测，不宣称任意语法均被保护。

## 回归验证

在本仓库根目录运行，无需安装 npm 包：

```sh
node --test tools/test/*.test.mjs
```

测试经 CLI 子进程运行，断言退出码、报告、提取计数与输入字节；样例写入系统临时目录并在结束时删除，只清理本次创建的目录。需要限制临时路径时，将 `TMPDIR` 指向已批准的真实目录。FIFO 用例在 macOS／类 Unix 环境使用系统 `mkfifo`，Windows 跳过该项，不代表其已验证。

当前套件有 24 项测试。成功结果为 `pass 24`、`fail 0`、`skipped 0`（macOS）；进程失败、超时、测试被跳过或提取断言失败都不能记为完整通过。覆盖参数、空输入、目录范围、去重、符号链接、FIFO、只读字节、双风格四种引号、机器内容保护、HTML／frontmatter 反例、Anti-Echo 决定失效及词表作用域、关键词义和例子。测试不证明模型行为、语义正确或页面渲染效果。

无需读代码的快速验收：

```sh
printf '%s\n' '<img alt="进行检查">' '正文说"保存"。' | node tools/check.mjs --json
```

预期退出码为 0：第 1 行保留 G4 用词候选，不出现属性定界引号的 G17；第 2 行仍有 G17 直引号提示。第 1 行仍报 G17，或正文提示、G4 候选消失，均表示未达到预期。

实现位于 `check/src/`，测试位于 `test/`，运行词表位于 `check/data/`。回归测试覆盖词表作用域和提示级别，不证明 YAML 与派生 JSON 已逐字段核对。

HTML 属性引号识别选择性改编自 STC 检查器，沿用仓库的 [STC MIT 许可](../licenses/STC-MIT.txt)和[第三方声明](../THIRD_PARTY_NOTICES.md)，未引入其 JSON 值扫描、安装或 hook 能力。
