// 카테고리별 색상 매핑 - 모든 메뉴에서 일관되게 사용

export const getPurposeColor = (purposeId: string): string => {
  const colorMap: Record<string, string> = {
    announcement: "bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30",
    emergency: "bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30",
    greeting: "bg-purple-500/10 text-purple-600 border-purple-500/20 hover:bg-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30",
    policy: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 hover:bg-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/30",
    event: "bg-pink-500/10 text-pink-600 border-pink-500/20 hover:bg-pink-500/20 dark:bg-pink-500/20 dark:text-pink-400 dark:border-pink-500/30",
    promotion: "bg-orange-500/10 text-orange-600 border-orange-500/20 hover:bg-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30",
    service: "bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30",
    welfare: "bg-teal-500/10 text-teal-600 border-teal-500/20 hover:bg-teal-500/20 dark:bg-teal-500/20 dark:text-teal-400 dark:border-teal-500/30",
    traffic: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30",
    environment: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30",
    culture: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20 hover:bg-cyan-500/20 dark:bg-cyan-500/20 dark:text-cyan-400 dark:border-cyan-500/30",
    facility: "bg-sky-500/10 text-sky-600 border-sky-500/20 hover:bg-sky-500/20 dark:bg-sky-500/20 dark:text-sky-400 dark:border-sky-500/30",
    civil: "bg-slate-500/10 text-slate-600 border-slate-500/20 hover:bg-slate-500/20 dark:bg-slate-500/20 dark:text-slate-400 dark:border-slate-500/30",
    disaster: "bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30",
    celebration: "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30",
    health: "bg-lime-500/10 text-lime-600 border-lime-500/20 hover:bg-lime-500/20 dark:bg-lime-500/20 dark:text-lime-400 dark:border-lime-500/30",
    education: "bg-violet-500/10 text-violet-600 border-violet-500/20 hover:bg-violet-500/20 dark:bg-violet-500/20 dark:text-violet-400 dark:border-violet-500/30",
    mixed: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20 hover:bg-fuchsia-500/20 dark:bg-fuchsia-500/20 dark:text-fuchsia-400 dark:border-fuchsia-500/30",
  };
  return colorMap[purposeId] || "bg-gray-500/10 text-gray-600 border-gray-500/20 hover:bg-gray-500/20 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/30";
};

