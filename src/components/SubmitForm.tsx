"use client";

import { useActionState, useEffect, useState } from "react";
import { createEntryAction } from "@/app/actions/entries";
import { INITIAL_STATE } from "@/lib/action-state";
import { CATEGORIES, type ListKind, type SubjectType } from "@/lib/taxonomy";

export type SubjectOption = {
  id: string;
  type: SubjectType;
  name: string;
  city: string;
  shopName: string | null;
};

export function SubmitForm({
  initialSubject,
  initialName,
  city,
  cities,
}: {
  initialSubject: SubjectOption | null;
  initialName: string;
  city: string;
  cities: string[];
}) {
  const [state, formAction, pending] = useActionState(createEntryAction, INITIAL_STATE);
  const [type, setType] = useState<SubjectType>(initialSubject?.type ?? "shop");
  const [list, setList] = useState<ListKind>("black");
  const [selected, setSelected] = useState<SubjectOption | null>(initialSubject);
  const [query, setQuery] = useState(initialName);
  const [results, setResults] = useState<SubjectOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [body, setBody] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (selected || creating || query.trim().length === 0) {
      setResults([]);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/subjects?q=${encodeURIComponent(query.trim())}&type=${type}&city=${encodeURIComponent(city)}`,
          { signal: ctl.signal },
        );
        if (res.ok) setResults((await res.json()) as SubjectOption[]);
      } catch {
        /* aborted */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [query, type, city, selected, creating]);

  const categories = CATEGORIES[type][list];
  const bodyLen = [...body].length;
  const typedName = query.trim();
  // typing a name is enough: when nothing is picked, the typed name becomes a new subject on submit
  const willCreateFromQuery = !selected && !creating && typedName.length > 0;

  function validate(): string | null {
    if (!selected && !creating && !typedName) return "第 1 步还没填：写上店名、DM 或玩家的名字";
    if (bodyLen < 10) return `第 3 步正文至少写 10 个字，现在 ${bodyLen} 个`;
    if (bodyLen > 2000) return "正文最多 2000 字";
    if (fileError) return fileError;
    return null;
  }

  return (
    <form
      action={formAction}
      className="space-y-5"
      encType="multipart/form-data"
      noValidate
      onSubmit={(e) => {
        const err = validate();
        if (err) {
          e.preventDefault();
          setFormError(err);
        } else {
          setFormError(null);
        }
      }}
    >
      <fieldset>
        <legend className="text-sm font-semibold">1. 这是关于谁的</legend>
        <div className="mt-2 flex gap-2">
          {(["shop", "dm", "player"] as SubjectType[]).map((t) => (
            <label
              key={t}
              className={`cursor-pointer rounded-md border px-4 py-2 text-[15px] ${
                type === t ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={t}
                checked={type === t}
                onChange={() => {
                  setType(t);
                  setSelected(null);
                }}
                className="sr-only"
              />
              {{ shop: "店家", dm: "DM", player: "玩家" }[t]}
            </label>
          ))}
        </div>

        {selected ? (
          <div className="mt-3 flex items-center gap-2 rounded border border-stone-300 bg-stone-50 px-3 py-2 text-sm">
            <input type="hidden" name="subjectId" value={selected.id} />
            <span className="font-medium">{selected.name}</span>
            {selected.shopName && <span className="text-stone-500">@{selected.shopName}</span>}
            <span className="text-stone-500">{selected.city}</span>
            <button type="button" className="ml-auto underline" onClick={() => setSelected(null)}>
              换一个
            </button>
          </div>
        ) : creating ? (
          <div className="mt-3 space-y-2 rounded border border-stone-300 bg-stone-50 p-3 text-sm">
            <input
              name="name"
              required
              defaultValue={query}
              placeholder={{ shop: "店名", dm: "DM 昵称", player: "玩家昵称" }[type]}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2.5"
            />
            {type === "dm" && (
              <input
                name="shopName"
                placeholder="所属店名（可不填）"
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2.5"
              />
            )}
            <input
              name="city"
              list="city-options"
              defaultValue={city}
              required
              placeholder="城市"
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2.5"
            />
            <datalist id="city-options">
              {cities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <button type="button" className="underline" onClick={() => setCreating(false)}>
              返回搜索
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setFormError(null);
              }}
              placeholder={{ shop: "搜店名", dm: "搜 DM 昵称", player: "搜玩家昵称" }[type]}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2.5"
            />
            {results.length > 0 && (
              <ul className="mt-1 divide-y divide-stone-100 rounded border border-stone-200 bg-white text-sm">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(r)}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-stone-50"
                    >
                      <span className="font-medium">{r.name}</span>
                      {r.shopName && <span className="text-stone-500">@{r.shopName}</span>}
                      <span className="ml-auto text-stone-500">{r.city}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {willCreateFromQuery && (
              <>
                <input type="hidden" name="name" value={typedName} />
                <input type="hidden" name="city" value={city} />
                <p className="mt-2 text-xs text-stone-500">
                  {results.length > 0 ? "从上面点选，或者不选、直接往下填，" : "没搜到也没关系，直接往下填，"}
                  发布时会自动新建「{typedName}」（{city}）
                </p>
              </>
            )}
            <button type="button" className="mt-2 py-1 text-[15px] underline" onClick={() => setCreating(true)}>
              {type === "dm" ? "新建并填所属店 / 城市" : "新建并填城市"}
            </button>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">2. 红榜还是黑榜</legend>
        <div className="mt-2 flex gap-2">
          {(["black", "red"] as ListKind[]).map((l) => (
            <label
              key={l}
              className={`cursor-pointer rounded-md border px-4 py-2 text-[15px] ${
                list === l
                  ? l === "red"
                    ? "border-rose-600 bg-rose-600 text-white"
                    : "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-300 bg-white"
              }`}
            >
              <input type="radio" name="list" value={l} checked={list === l} onChange={() => setList(l)} className="sr-only" />
              {l === "red" ? "红榜" : "黑榜"}
            </label>
          ))}
        </div>
        <select name="category" required className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2.5">
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">3. 发生了什么</legend>
        <textarea
          name="body"
          required
          maxLength={2000}
          rows={6}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setFormError(null);
          }}
          placeholder="写具体经过：什么时候、哪个本、谁做了什么。不要写手机号、微信号，系统会自动隐去。"
          className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2.5"
        />
        <div className="mt-1 flex justify-between text-xs text-stone-500">
          <span>10 到 2000 字</span>
          <span>{bodyLen}</span>
        </div>
        <label className="mt-2 block text-sm">
          发生月份（可不填）
          <input type="month" name="occurredAt" className="ml-2 rounded-md border border-stone-300 bg-white px-2 py-1.5" />
        </label>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">4. 证据（可不填）</legend>
        <input
          type="file"
          name="evidence"
          accept="image/*"
          multiple
          className="mt-2 block text-sm"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 5) setFileError("最多 5 张证据图");
            else if (files.some((f) => f.size > 5 * 1024 * 1024)) setFileError("每张证据图不超过 5 MB，请先压缩");
            else if (files.some((f) => !f.type.startsWith("image/"))) setFileError("证据必须是图片");
            else setFileError(null);
          }}
        />
        <p className="mt-1 text-xs text-stone-500">最多 5 张，每张 5 MB 以内。只有站长能看到，不会公开。</p>
        {fileError && <p className="mt-1 text-sm text-red-700">{fileError}</p>}
      </fieldset>

      {(formError || state.error) && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{formError ?? state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-stone-900 px-4 py-3 text-[17px] text-white disabled:opacity-40"
      >
        {pending ? "发布中…" : "发布"}
      </button>
      <p className="text-center text-xs text-stone-500">发布即表示你同意社区规范。</p>
    </form>
  );
}
