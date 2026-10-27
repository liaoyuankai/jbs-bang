import { config } from "@/lib/config";

export default function RulesPage() {
  return (
    <article className="prose-sm space-y-6 rounded-lg border border-stone-200 bg-white p-5 leading-relaxed">
      <h1 className="text-xl font-bold">社区规范</h1>

      <section>
        <h2 className="font-semibold">这是什么</h2>
        <p className="mt-1">
          {config.siteName}收录剧本杀店家、DM、玩家的红榜与黑榜。数据在站长自己的服务器上，不依赖任何在线表格，不会被人一键清空。
        </p>
      </section>

      <section>
        <h2 className="font-semibold">先审后发</h2>
        <p className="mt-1">
          所有投稿、评论、当事人回应都先进入审核队列，审核通过后才公开。审核只看三件事：是不是在说一件具体的事、有没有辱骂、有没有联系方式。审核不替任何一方判断真假。
        </p>
      </section>

      <section>
        <h2 className="font-semibold">可信度标签</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>单方陈述：一位投稿人的说法，默认标签。</li>
          <li>多方印证：同一对象同一类事件有至少三位不同投稿人独立投稿。</li>
          <li>平台核验：审核看过证据，且当事人在回应期内未否认事实。</li>
          <li>历史存档：从原 QQ 在线表格导入，未经本站审核流程。</li>
          <li>已撤下：条目已下架，原位留有下架时间与原因。</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold">不允许的内容</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>手机号、微信号、QQ 号、身份证号、住址、照片中的人脸。系统会自动隐去，残留的审核会退回。</li>
          <li>纯辱骂，没有具体事件。</li>
          <li>拿不出任何经过的「听说」。</li>
          <li>同一个人换着账号重复投稿同一件事。</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold">当事人怎么办</h2>
        <p className="mt-1">
          每个对象页都有「我是当事人」入口，提交的回应审核通过后置顶显示，与投稿并列，不覆盖投稿。认为条目失实的，请在回应中说明并附上可核的经过，审核复核后会标注争议或下架。
        </p>
      </section>

      <section>
        <h2 className="font-semibold">下架留痕</h2>
        <p className="mt-1">
          本站没有物理删除。下架只改变状态，条目原位显示下架时间与原因，所有状态变化记入带哈希链的事件日志，透明度页公开最新链头。任何人都能据此验证站方没有偷改历史。
        </p>
      </section>

      <section>
        <h2 className="font-semibold">三条红线</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>本站不收任何删帖费、压帖费、置顶费。</li>
          <li>认证与否不影响黑榜显示。</li>
          <li>不出售、不交换任何用户数据。</li>
        </ul>
      </section>
    </article>
  );
}
