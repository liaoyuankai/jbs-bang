import { FeedbackForm } from "@/components/FeedbackForm";

export default function FeedbackPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">反馈给站长</h1>
      <p className="text-sm text-stone-600">
        这里写的只有站长能看到，不会公开，也不会被自动隐去联系方式。举报某条内容请用那条内容旁边的「举报」。
      </p>
      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <FeedbackForm />
      </div>
    </div>
  );
}
