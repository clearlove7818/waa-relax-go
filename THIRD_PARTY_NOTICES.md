# 第三方许可

| 来源 | 作者 | 使用内容与许可 |
| --- | --- | --- |
| [STC-Simplified-Technical-Chinese](https://github.com/daimonia-ai/STC-Simplified-Technical-Chinese) | Daimonia（杭州代梦智能科技有限公司） | 中文规则与词表采用 [CC BY 4.0](LICENSE)；源技能与检查代码采用 [MIT](licenses/STC-MIT.txt) |
| [i-have-adhd](https://github.com/ayghri/i-have-adhd) | Ayoub Ghriss | 交互规则改编，采用 [MIT](licenses/i-have-adhd-MIT.txt) |
| [tech-doc-style-chinese](https://github.com/Fenng/tech-doc-style-chinese) | Fenng | 协作说明参考，采用 [MIT](licenses/tech-doc-MIT.txt)；技能保持独立 |

改编说明：保留完整中文规则与词表，调整语境裁决、引号、篇幅建议和任务回执；交互按任务类型组织，明确持续范围、时间依据与完整性要求；检查器增加风格选择、引用保护和只读输入检查。

整合后的规则、词表与中文说明采用 [CC BY 4.0](LICENSE)，词表派生 JSON 沿用该许可。原创入口与适配代码采用 [MIT](LICENSE-CODE)。第三方版权、授权与免责声明保留在上述完整许可文本中。

## 维护参考

- STC 运行规则、词表及已有检查器适配的来源版本：`902f456328e42e589d3cc925bc95d57b9feb633d`；上游增量已处理至同步基线 `04cdd24e192121fc75f7da84b9be7a441ede36f6`。采用内容与适配情况见 [UPGRADE.md](UPGRADE.md)。
- STC [历史评测报告与证据说明](https://github.com/daimonia-ai/STC-Simplified-Technical-Chinese/tree/04cdd24e192121fc75f7da84b9be7a441ede36f6/benchmarks)用于本次维护方法与结论边界的适配。本次未引入其历史协议、规则快照、输出数据或重算脚本。上游涉及 MCTS 的改写与引用文本受其另行声明的 GPL-3.0 条款约束，未纳入本包，也不由本包既有许可重新授权。
- i-have-adhd 对应来源版本：`1ecea1993b7fce257ffbd686c070948b5e07eda6`，参考其 `skills/i-have-adhd/SKILL.md`。
- [LINUX DO 提示词讨论](https://linux.do/t/topic/3129955)作为表达行为设计参考。相关方法经提炼融入本包规则，不整段转载提示词；未将原帖视为具有独立授权声明的软件或规则包。

上述来源用于维护时比较；使用本包不需要启用 STC 或 i-have-adhd。独立的 Tech-Doc-Style-Chinese 按任务与本包互补使用。
