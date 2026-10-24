import {html,alertDialog} from './components.js';
export const MOD_OPTIONS = Object.freeze([
 ['rounds','额外 4 回合','多四回合，Boss 在最后','常规 14 回合变为 18，短单人 9 回合变为 13。Boss 移至最后一关，延长模式不再追加隐藏关。关闭时保持原版回合规则。'],
 ['rhine','更多阵营','莱茵生命与卡兹戴尔','加入莱茵生命与卡兹戴尔两个阵营。莱茵：3/6/9人科研装置，生态维持仪兼具减速、治疗与突破护盾；能量装置为己方充能，9人解锁持续增伤激光钻机。卡兹戴尔：10名成员，按3/6人锁定档位；每次真正阵亡产生魂灵，完整继承所选技能、天赋与模组。6人开启21格众魂炮，只误伤炮击所属玩家的活体友军，队友与魂灵免疫；9人仍按6人档位。舍身刻印＋变形同构体可转职，众魂战刃强化对应魂灵，配刻印伤害加成由20%变35%。众魂层数增加本体生命及亡魂属性，阵亡特质可产层，亡魂不占人口。梅尔通过有效装置工作产层，普通／精锐同玩家每场共享24／48层预算；多萝西改为科研每层增加1／2点攻击，陷阱不产层。伊芙利特继承最高单台装置攻击，钻机真伤按科研成长、领袖按完整共享血量计算。新增五阶干员谬因，仅开放二技能自动战斗适配：直线周期法伤，中继器增攻和友军法抗穿透。友军改变波束方向仍作简化，复杂三技能暂未开放。'],
 ['relics','收藏品玩法','战后选择，本局持续增益','无漏怪作战后藏品三选一，共 46 件，本局持续生效、不占装备槽。连续三个作战回合本人漏怪可获逆风补给与下回合护盾。新增时间机器、木棍、解压玩具、护愈之手、时光之末、金钟罩和铁布衫。时光之末可自救或整备阶段救队友；解压玩具仅多人普通战斗生效。新一局重新收集。'],
 ['operators','新干员包','结城理等四名干员','加入结城理、娜仁图亚、予愿安洁莉娜和丰川祥子，包含技能、特质与模组。可与额外干员包同时开启，丰川祥子沿用本包实现，只会进卡池一次。'],
 ['damage','伤害统计','干员实际输出排行','查看本轮与上一轮实际扣血排行，召唤物伤害归属干员。仅用于本局查看，不写长期战绩；关闭时不生成伤害面板。'],
 ['lucky','恭喜发财','每人随机五阶开局','确认本局信息时，每名玩家和 AI 各获得一名不同的随机五阶干员，可正常部署、合成和出售。抽取使用本局可用公共卡池，照常消耗份数，可与任意难度组合。'],
 ['recruits','额外干员包','望、陈、凯尔希与维什戴尔','加入望、赤刃明霄陈、凯尔希·思衡托、维什戴尔。当前移植范围：望、陈、维什戴尔三技能，凯尔希二技能，技能自动释放；战斗中点望可放置棋子。丰川祥子由原新干员包提供，本包不重复添加；两个包可同时开启。若同时开启更多阵营，维什戴尔使用卡兹戴尔六阶版本，仅进入卡池一次。'],
 ['targeted','定向甄选','奖励向已激活盟约靠拢','晋升奖励仅第一个位置对人数最多的已激活盟约给予2.6倍抽取权重，后两个位置随机；提高概率，不保证必出本阵营。第6回合起，装备招募对主要盟约的转职装备给予2.6倍权重；当前等级无对应装备时保持等级并随机，仍遵守共享卡池。'],
]);
export const MOD_SOURCES = Object.freeze({
  "rounds": [
    [
      "llleeeqi / Stronghold-Protocol-Lele-Mods（本整合包新增）",
      "https://github.com/llleeeqi/Stronghold-Protocol-Lele-Mods"
    ],
    [
      "sganggs / Stronghold-Protocol（基础回合系统）",
      "https://github.com/sganggs/Stronghold-Protocol"
    ]
  ],
  "rhine": [
    [
      "YUYUYUYUYUYUYUTOUA / Stronghold-Protocol-Rhine（莱茵生命、卡兹戴尔）",
      "https://github.com/YUYUYUYUYUYUYUTOUA/Stronghold-Protocol-Rhine"
    ],
    [
      "SrC2O4 / Stronghold-Protocol（谬因）",
      "https://github.com/SrC2O4/Stronghold-Protocol"
    ]
  ],
  "relics": [
    [
      "UNDFFIO / Stronghold-Protocol-dlc",
      "https://github.com/UNDFFIO/Stronghold-Protocol-dlc"
    ]
  ],
  "operators": [
    [
      "remember-4 / Stronghold-Protocol-Rem",
      "https://github.com/remember-4/Stronghold-Protocol-Rem"
    ]
  ],
  "damage": [
    [
      "Stardust-minus / Stronghold-Protocol",
      "https://github.com/Stardust-minus/Stronghold-Protocol"
    ]
  ],
  "lucky": [
    [
      "RiZhiZhaoYi / Stronghold-Protocol",
      "https://github.com/RiZhiZhaoYi/Stronghold-Protocol"
    ]
  ],
  "recruits": [
    [
      "Lunac1a / Stronghold-Protocol",
      "https://github.com/Lunac1a/Stronghold-Protocol"
    ]
  ],
  "targeted": [
    [
      "Strinova-xinghui / Stronghold-Protocol",
      "https://github.com/Strinova-xinghui/Stronghold-Protocol"
    ]
  ]
});
export function ModInfo({id}){
 const option=MOD_OPTIONS.find(o=>o[0]===id);if(!option)return null;
 return html`<button type="button" class="mod-info" aria-label=${option[1]+'说明'} data-mod-info=${id}
 onClick=${e=>{e.preventDefault();e.stopPropagation();alertDialog({title:option[1],text:html`<div class="mod-info-body"><p class="modal__text">${option[3]}</p><p><b>来源项目 / 作者</b></p>${MOD_SOURCES[id].map(([label,url])=>html`<p><a href=${url} target="_blank" rel="noopener noreferrer">${label}</a></p>`)}<p class="modal__text">本整合包负责可选开关、兼容与部署；原玩法与实现归来源贡献者。</p></div>`,okText:'知道了'});}}>!</button>`;
}
export function ModCheckbox({id,label,desc,checked,disabled=false,onChange,testId,hostNote=false}){
 return html`<div class=${'friend-mod-cell'+(disabled?' is-disabled':'')} data-testid=${testId}>
  <label class="mod-option__label"><input type="checkbox" class=${'friend-'+id} checked=${checked} disabled=${disabled} aria-label=${label} onChange=${e=>!disabled&&onChange(e.currentTarget.checked)} />
  <span><b>${label}</b><small>${desc}${hostNote?' · 房主选择':''}</small></span></label><${ModInfo} id=${id} />
 </div>`;
}
