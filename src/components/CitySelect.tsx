"use client";

/** Switching city submits the surrounding form at once; one tap instead of two on a phone. */
export function CitySelect({ cities, value }: { cities: string[]; value: string }) {
  return (
    <select
      name="city"
      defaultValue={value}
      aria-label="城市"
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="rounded-md border border-stone-300 bg-white py-2 pr-7 pl-3"
    >
      {cities.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}
