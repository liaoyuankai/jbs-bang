/** The maintenance and volunteer-recruiting text, shared by the maintenance page and the popup. */
export function MaintenanceNotice() {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      <p>各位玩家：</p>
      <p>
        最近举报和反馈太多，站长一个人处理不过来。为了不误伤任何人，也不让该处理的内容一直拖着，网站先暂停开放，进入维护。
      </p>

      <div>
        <h3 className="font-bold">维护期间</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>暂停投稿，已发布的内容暂时不展示</li>
          <li>「联系站长」照常开放。涉及泄露隐私、人身攻击的下架请求，站长优先处理</li>
        </ul>
      </div>

      <div className="rounded-lg bg-amber-50 p-4 text-amber-950">
        <h3 className="font-bold">招募志愿者</h3>
        <p className="mt-1">
          想把圈子整理得更好，现在招几位一起干的伙伴。<strong>没有工资，纯公益。</strong>
        </p>
        <p className="mt-2">主要做的事：</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>看举报，核对内容有没有违规</li>
          <li>帮忙整理、归档投稿</li>
        </ul>
        <p className="mt-2">希望你：</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>每周能抽出一点时间</li>
          <li>处事公道，不带个人恩怨。遇到和自己有关的内容，主动回避</li>
          <li>嘴严，投稿人和当事人的任何信息都不外传</li>
        </ul>
        <p className="mt-2">
          愿意来的话，点「联系站长」，留个联系方式，再简单介绍一下自己，比如玩了多久、每周大概能出多少时间。
        </p>
      </div>

      <p>等人手到位、规则理顺，网站会重新开放。谢谢大家理解和支持。</p>
    </div>
  );
}
