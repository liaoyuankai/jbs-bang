import { FeedbackForm } from "@/components/FeedbackForm";
import { isMaintenance } from "@/lib/maintenance";

export default function FeedbackPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">联系站长</h1>
      <div className="rounded-lg bg-amber-50 p-4 text-[15px] leading-relaxed text-amber-950">
        <p>
          是当事人、觉得内容失实或泄露了你的隐私，想更正或下架？直接在下面写给站长，<strong>附上那条内容的链接</strong>
          ，并留一个联系方式，站长会尽快处理并回复你。
        </p>
        {isMaintenance() ? (
          <p className="mt-2">
            想报名当志愿者？也写在这里：留个联系方式，简单介绍一下自己，比如玩了多久、每周大概能出多少时间。
          </p>
        ) : (
          <p className="mt-2">也可以直接点那条内容旁边的「举报」，站长同样会收到。</p>
        )}
      </div>
      <p className="text-sm text-stone-600">这里写的只有站长能看到，不会公开，也不会被自动隐去联系方式。</p>
      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <FeedbackForm />
      </div>
    </div>
  );
}
