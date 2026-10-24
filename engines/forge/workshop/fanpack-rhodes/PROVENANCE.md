# PROVENANCE — 这份包是怎么来的

**它不是作者原件，是站方把原件的「内容部分」重打成的标准工坊包。**

| | |
|---|---|
| 原投稿 | `0ddd1f4b06e3`「罗德岛盟约mod」v1.1.0 |
| 原件 sha256 | `f06041f8a96ddde400034490de81c29d8687d8f091892274588ef94c7987f8c2` |
| 原作者 | B站@伊佐那邪_ · https://github.com/yznx09/Stronghold-Protocol-Rhodes-Kazdel-Mod |
| 原件形态 | 一键安装包（`install.mjs` 50,484 B + `payload/**` 64 个文件，zip 根套了一层 `fanpack-rhodes-mod/`） |
| 本包 | zip 根即 `pack.json`；引擎 `tools/workshop-validate.mjs` ⇒ **0 error / 42 warning** |

## 原件为什么不收

`install.mjs` 会把 `payload/**` 整份覆盖到引擎检出上（`data/chess.json`、`data/items.json`、`data/config.json`、
`server/match/builtinMeta.js`、`server/sim/content/kits/custom.js`、`public/i18n/*.json` 等），也就是「包改引擎源码」。
**本包不采用、绝不执行 `install.mjs`。**

## 本包映射了什么（逐条可核）

原件 `files.json` 的 `folders: ["packs/fanpack-rhodes"]` 说明它自带一个完整内容包 —— 本包就是那一棵树的声明面重打。

| 原件的哪一块 | 本包里去哪 | 数量 |
|---|---|---|
| `payload/packs/fanpack-rhodes/records.json` → `bonds` | `bonds.json` + `overrides`（7 条） | 8（1 新增 / 7 覆盖） |
| 同上 → `items` | `items.json` | 6（全部新增） |
| 同上 → `garrisons` | `garrisons.json` + `overrides`（3 条） | 24（21 新增 / 3 覆盖） |
| 同上 → `assets` | `pack.json.bondIcons` / `itemIcons` + 包内 `assets/*.png` | 1 + 2 张图 |
| `chess.json` → `chess` | `chess.json` + `overrides`（6 条） | 22（16 新增 / 6 覆盖） |
| `tokens.json` → `tokens` | `tokens.json`（无官方对撞） | 3（全部新增） |
| `variants.json` → `training` | `variants.json`（DESIGN §28.51 口径通道）+ `content:["variants"]` | **18 chess + 3 tokens** |

口径数值（满练度）**逐条无损**：把真包装进引擎自己的装载器（`server/data.js` 的 `loadData`），
21 条记录 / 作者写下的 **2929 个值**，差异 **0**。

## 剥掉的键（引擎从不读，或不在闭集里）

* `pack.json` 的 `_doc` / `type` / `englishName` / `app` / `credits` / `files{}` —— 不在引擎顶层键闭集 `PACK_FIELDS` 里，
  留着会让装载期 `PACK_UNKNOWN_FIELD` **整包拒绝**。其中 `_doc` 在**引擎仓与模组仓两仓 grep 均无任何代码读它**
  （只出现在 `CHANGELOG.md` 的叙述里）⇒ 删掉**行为不变**；说明文字原样搬进本文件与 `pack.json.description`。
* 内容文件里的 `_doc` / `version` / `roster` 与 `variants.json` 的 `shipped`。
* **外层套目录**：原件 zip 根是 `fanpack-rhodes-mod/`，本包 zip 根就是 `pack.json`。

## 两处必须写明的换算（数值一个没动）

1. `{$: value}` 叶子 → 原生值。
2. 整块替换分支写成完整值（原件安装器是深层字段合并，引擎对 `OVERRIDE_REPLACE_KEYS` 与数组是整块替换）。

## ⚠️ 一处如实披露：6 条装备的 `params` 按引擎规则重推过

`c_03_e_a/_b`（仅键序）、`c_04_e_a/_b`（补 `bond`+`other_equip`）、`c_05_e_a/_b`（补 `other_equip`）的 `params`
与它们**自己的 `buffs`** 对不上。`params` 是引擎的**派生量**（`shared/itemAuthoring.js` 的 `effectParams`；
作者自己的 `payload/tools/build-data.mjs` 里有一份逐字相同的实现）。重推前先证「作者写的每一个键值都还在」——
只补齐、只改键序，**没有一个数字被覆盖**。补进去的这两个键在**记录层**没有被任何引擎代码读
（`p.bond` 只在 `items/meta.js:178` 天师古鼎那一条专属 handler 里被读；`p.other_equip` 的读取入参是**逐 buff** 的
`{...bb,...bbStr}`，不是记录的 `params`）；战斗数值一律走 `buffsOf(rec)`，本包**一个 buff 都没改**。

## 没有搬进来的东西

`install.mjs`、`manifest.json`、`files.json`、`asset-additions.json`、`asset-manifest-additions.json`、
`payload/server/**`、`payload/public/**`、`payload/tools/**`、`payload/data/**`、`payload/docs/**`、原件的 `.bat` 一键脚本。

## 素材

含从游戏《明日方舟》解包出的官方素材。版权归鹰角网络 / Yostar；本站与改写者不主张任何权利，仅供非商业学习与个人娱乐。
本包自带的 3 张图是作者自制图标（1 张盟约图标 + 2 张装备图标）。

## 零删除

原投稿的记录与 `mod.zip` 一个字节都没删、没改；原件转 `superseded`（下架 ≠ 删除），`replacedBy` 指向本包，随时可恢复。
