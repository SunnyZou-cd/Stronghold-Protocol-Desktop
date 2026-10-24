# PROVENANCE —— 本站改写记录（columbia）

本站收件为**改写件**，改动**只有一处**，逐条留档如下。

## 1. 移除顶层键 `stripDiyOverlaps`

- 来件 `pack.json` 顶层有 `"stripDiyOverlaps": true`。
- 本站包格式的字段表是
  `id, name, version, author, license, description, gameVersion, game, api, layer, combat, content, overrides, voices, voiceLangs, bondIcons, itemIcons, art, skins, support, operators, i18n, forms, fx, notices, playtest, enabled, callBudget, variants, behaviour, assets, client, server, routes, target, dependencies, conflicts`
  —— **没有这个字段**，装载器**不读**它 ⇒ 改写前实测 `PACK_UNKNOWN_FIELD`，**整包被点名拒收**（errors=1）。
- ⚠️ **该键的语义本站未知**：站点格式里没有对应文档，作者也未在包内说明。
  本站口径是**不凭空给语义** ⇒ 只做**移除**，不做任何映射、不猜。
- ⚠️ **可能影响原意**：若作者原意不是下面第 2 条那个意思，则本包相对来件的**行为可能不同**。

## 2. 按本站引擎的「包级声明通道」等价表达该意图

- 键名 `stripDiyOverlaps`（"strip Diy overlaps"）疑与本站行为开关 `diyPoolOverlap` 同指一事：
  一个包把某位**官方干员**做成自己的棋子，而这位干员**本来就在自选池**（`data/backups.json` 的
  `diy.ownedPool`）里 ⇒ 他能被上两次，而且自选槽绕过棋子自己的盟约。
  实测本包有 **4 条**这样的重叠，正是本包 4 个自写 kit 对应的干员。
- 本站引擎对这一格有**包级声明通道**（DESIGN §28.43 第 5 格）：

  ```json
  "behaviour": [{ "switch": "diyPoolOverlap", "option": "strip" }]
  ```

  读取点是 `shared/workshop.js` 的 `stripPackOperators`
  （判据 `behaviourValue(pack.behaviour, 'diyPoolOverlap') === 'strip'`）。
- 因此改写件**加上**这条声明 —— 这是对作者原键的**等价表达**，不是新增功能。

## 3. 未改动的部分

- 来件 101 个文件中，**100 个逐字节未改**（含 `assets/`、`kits/`、`meta/`、`battle/` 与全部
  JSON / `README.md`）。
- 只有 `pack.json` 改了上述**一处**（一行替换一行，仅 2 个键的增减）。
- 本文件（`PROVENANCE.md`）为本站新增。

## 4. 改写前后实测（引擎 `tools/workshop-validate.mjs`，只读调用，引擎仓一字未改）

- 改写前：`1 error(s), 0 warning(s)` ——
  `PACK_UNKNOWN_FIELD: pack.json: "stripDiyOverlaps" is not a field of this pack format`（整包不装载）。
- 改写后：`0 error(s), 17 warning(s)` —— `VALID: the engine accepts this content.`
- 17 条 warning **全部**是 `BB_UNKNOWN_KEY`（`skill.bb[...]` 里那些键由本包自带的 4 个 kit 读、
  通用 kit 不读），与本次改写无关，来件本来就有。

## 5. 素材

本包含 `assets/`（4 名干员的立绘 / 头像 / 骨骼动画 + 技能图 + 盟约图 + 道具图 + 4 套皮肤），
约 8.0 MB。作者未在包内附素材来源与授权说明；本站如实照录、不主张任何权利。
《明日方舟》相关素材版权归鹰角网络所有。
