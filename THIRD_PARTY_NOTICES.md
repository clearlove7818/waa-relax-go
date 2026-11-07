# 第三方许可

| 来源 | 作者 | 使用内容与许可 |
| --- | --- | --- |
| [STC-Simplified-Technical-Chinese](https://github.com/daimonia-ai/STC-Simplified-Technical-Chinese) | Daimonia（杭州代梦智能科技有限公司） | 中文规则与词表采用 [CC BY 4.0](LICENSE)；源技能与检查代码采用 [MIT](licenses/STC-MIT.txt) |
| [i-have-adhd](https://github.com/ayghri/i-have-adhd) | Ayoub Ghriss | 交互规则改编，采用 [MIT](licenses/i-have-adhd-MIT.txt) |
| [tech-doc-style-chinese](https://github.com/Fenng/tech-doc-style-chinese) | Fenng | 协作说明参考，采用 [MIT](licenses/tech-doc-MIT.txt)；技能保持独立 |

改编说明：保留完整中文规则与词表，调整语境裁决、引号、篇幅建议和任务回执；交互按任务类型组织，明确持续范围、时间依据与完整性要求；检查器增加风格选择、引用保护和只读输入检查。

整合后的规则、词表与中文说明采用 [CC BY 4.0](LICENSE)，词表派生 JSON 沿用该许可。原创入口与适配代码采用 [MIT](LICENSE-CODE)。第三方版权、授权与免责声明保留在上述完整许可文本中。

## 维护参考

- STC 同步基线、i-have-adhd 吸收来源与能力落点统一见[当前来源记录](UPGRADE.md#当前来源记录)。
- 验证方法参考 STC 的[评测报告与证据说明](https://github.com/daimonia-ai/STC-Simplified-Technical-Chinese/tree/04cdd24e192121fc75f7da84b9be7a441ede36f6/benchmarks)，实际方法见[验证候选版本](UPGRADE.md#4-验证候选版本)。本包采用维护方法，不包含该评测数据包及其重算脚本。
- [LINUX DO 提示词讨论](https://linux.do/t/topic/3129955)作为表达行为设计参考。相关方法经提炼融入本包规则，不整段转载提示词；未将原帖视为具有独立授权声明的软件或规则包。

上述来源用于维护时比较；使用本包不需要启用 STC 或 i-have-adhd。独立的 Tech-Doc-Style-Chinese 按任务与本包互补使用。
