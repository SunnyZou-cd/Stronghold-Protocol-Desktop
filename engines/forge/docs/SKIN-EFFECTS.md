# 官方时装的战斗特效

本机时装的 Spine、普攻施放、弹道、命中、技能、天赋、嵌套特效及召唤物表现，使用同一套官方外观配置。
`tools/local-extract/outfits.py` 从合法本机客户端提取配置和所需素材；浏览器按实际穿戴者隔离应用，
不会修改技能数值、伤害、移动、随机种子或模拟输入。模型和特效共同读取最终显示的皮肤，
“显示其他玩家的皮肤”关闭时两者共同恢复默认。

## 证据和范围

- 精确皮肤、跨形态 `tmplId` 和 `battleSkin`、`tokenSkinMap` 来自官方 `skin_table.json`。
  公开数据镜像：[ArknightsGameData](https://github.com/Kengxxiao/ArknightsGameData/blob/master/zh_CN/gamedata/excel/skin_table.json)。
- 特效来源是官方 battle skin prefab 的 `_replaceEffectPairs`，不是按名字猜颜色。
  `_fakeProjectileConfigs` 分别提供 `graphicProjectileKey` 与 `logicProjecitleKey`：可见飞行使用前者，
  命中/停止效果保留后者；`_fakeMuzzlePoint` 属于客户端的隐藏逻辑弹道，原值保留作审计，模拟命中时刻不变。
- 召唤物用实际 `ownerUnit` 链的 `summonerId` 找到具体主人，不能按玩家或同名干员猜主人。
  主人退场后使用已通过显示设置门控的 `summonerSkin` 后备。官方 `tokenSkinMap` 对应的 prefab
  在 `skinpack/<tokenId>.ab`，它替换模型、挂点和特效，并不创建新的模拟 unit。
- [PRTS 时装回廊](https://prts.wiki/w/%E6%97%B6%E8%A3%85%E4%B8%80%E8%A7%88)及各干员 `/spine`
  页面用于核对时装归属及战斗正背面模型；Wiki 模型页不能证明某套特效已在本项目运行。

本次已安装衣橱为 **303 套**：**248 套**有独立替换配置、**55 套**经官方 prefab 检查复用默认特效。
共有 **4,676 条**本体替换声明；可达资源闭包没有缺失特效、纹理、网格或文件。
召唤物包含 41 个本体、65 条主人外观到模型映射、79 组正背面模型。
机器可读统计见 [skin-effects-coverage.json](research/skin-effects-coverage.json)。这份统计不含游戏素材。

`char_264_f12yin@marthe#13` 的两条旧声明目标
`f12yin_skill_02_buff_b_01_marthe#13`、`f12yin_skill_03_buff_02_b_01_marthe#13`
在已应用热更的官方客户端中不存在；该皮肤实际使用的新父 prefab 已不再生成它们。
闭包核查将其列为 `unreachableReplacementTargets`，不会拿相似名字的资源冒充，也不把它们算作实际可达缺失。

覆盖统计表示配置接通与素材完整，不表示所有原版 Unity shader 都已像素级重现。
现有渲染器仍把下列 4 类 shader 交给 `basic` 家族，保留提取的混合状态：

| Shader | 材质数 | 涉及特效数 |
|---|---:|---:|
| `Legacy Shaders/Particles/Additive` | 2 | 2 |
| `Torappu/Unlit/Texture` | 12 | 12 |
| `Torappu/Particles/SimSpine/AlphaBlend-ZDistorted` | 12 | 4 |
| `Torappu/Particles/Disturb/Disturb GrabPass` | 1 | 1 |

这些是现有渲染器的着色降级，不是素材缺失。还原原版屏幕扭曲需要另行实现对应 shader。

## 重建本机资源

目的：从自己已安装的客户端，重建本机索引及素材。命令会写入 `--out`、`--manifest` 和报告目录；
加 `--merge-token-models` 时还会合并 `--wardrobe` 的召唤模型字段，保留原有 `chars`。
先备份这些本机文件。官方美术只能保留在本地，不能提交到 Git 或上传公开 Release。

前提：源码已有依赖，且已有默认官方特效索引与已安装衣橱。
没有默认索引时，先运行 `tools/local-extract/extract.py --only fx --fx-set used`，
并将 `--out` 和 `--manifest` 指向同一安装的 `public/assets/local`、`data/local-assets.json`。
官方皮肤表可使用 `.cache/gamedata/excel/skin_table.json`，或自己保存的官方数据镜像文件。

1. 在源码根目录准备 Python 环境。成功标志：`import UnityPy` 成功。

   ```powershell
   python -m venv C:\codex\Stronghold-Skins\fx-venv
   C:\codex\Stronghold-Skins\fx-venv\Scripts\python.exe -m pip install -r tools/local-extract/requirements.txt
   ```

2. 提取时装配置、召唤模型和新增特效。成功标志：末行输出 303 套的分项统计；
   实际衣橱不同时数字随之变化，不应硬凑 303。

   ```powershell
   C:\codex\Stronghold-Skins\fx-venv\Scripts\python.exe tools/local-extract/outfits.py --game "C:\Program Files\Hypergryph Launcher\games\Arknights\Arknights_Data\StreamingAssets\AB\Windows" --patch-game "C:\Program Files\Hypergryph Launcher\games\Arknights\Arknights_Data\PersistentData\Bundles" --skins C:\codex\Stronghold-Skins\cache\skins.json --wardrobe data/local-assets.json --out public/assets/local --manifest data/local-fx.json --report C:\codex\Stronghold-Skins\fx-report\coverage.json --jobs 2 --merge-token-models
   ```

   如果客户端没有热更目录，省略 `--patch-game`。该选项在报告目录建立独立硬链接视图，
   热更层优先、原安装作后备，不修改客户端源文件。视图和客户端需要在支持硬链接的同一卷。
   `--only-skins` 可按逗号分隔的精确皮肤键增量重查；`--reuse-report` 只适合显式复用同一安装的已验证扫描。

3. 校验真实文件和依赖闭包。成功标志：所有 `missing*`、`invalidFiles` 为空；shader fallback 会单列。

   ```powershell
   node tools/vfx-outfit-coverage.mjs --index public/assets/local/fx/index.json --manifest data/local-fx.json --assets public/assets --out C:\codex\Stronghold-Skins\fx-report\integrity.json
   node --test test/render/vfx-outfits.test.js test/render/summoner-appearance.test.js test/render/skin-presentation.test.js
   ```

4. 重启本机服务器，选择时装后进入战斗。成功标志：默认→A→B→默认立即更换模型及特效，
   同场另一个默认实例保持原样，隐藏其他玩家皮肤时本体和召唤物一起恢复默认。

## 本机数据契约

- `local-fx.json` 仍是唯一特效文件清单，所有 URL 由服务器现有的内容哈希路由提供。
  `fx/index.json.outfits[skinId]` 增加替换声明、实际挂点、假弹道配置、召唤物外观和分项核查结果。
- `OutfitIndex` 为穿戴者生成私有特效与弹道别名；其他实例和默认索引中的 unit 不被覆盖。
  技能、天赋、浮游单元及已持有的循环效果在外观变化时失效，随后由当前快照恢复。
- 提取器生成 `token-skins.json`：`groups` 为本机文件表，
  `tokenSkins[baseTokenId][ownerSkinId] = { front, back? }` 为完整 Spine entry。
  `--merge-token-models` 把两字段合入 `local-assets.json`；缺模型或默认装扮沿用召唤物本体。
  导出的物理文件、URL 和 atlas 页名统一使用安全字符，`#` 不会变成浏览器 fragment。
- 源码发布只含工具、代码、测试及统计。`data/local-fx.json`、`data/local-assets.json`、
  `public/assets/**` 和报告中的官方 prefab/纹理/网格保持忽略。
