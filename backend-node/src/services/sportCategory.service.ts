import { player_category } from "@prisma/client";

// 1. تحويل الاسم الداخلي لاسم مقروء (مثال: light_middleweight -> Light Middleweight)
export const formatCategoryLabel = (category: player_category): string => {
  if (category === "not_applicable") return "Not Applicable";
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// 2. إرجاع التصنيفات بناءً على رقم الرياضة (مرتبطة بالـ Seed اللي عملناه)
export const getCategoriesBySportId = (sportId: number): player_category[] => {
  // Boxing (1) & Weightlifting (2)
  if (sportId === 1 || sportId === 2) {
    return [
      "flyweight",
      "bantamweight",
      "featherweight",
      "lightweight",
      "light_welterweight",
      "welterweight",
      "light_middleweight",
      "middleweight",
      "super_middleweight",
      "light_heavyweight",
      "cruiserweight",
      "heavyweight",
    ];
  }
  // Football (4)
  else if (sportId === 4) {
    return [
      "goalkeeper",
      "center_back",
      "full_back",
      "defensive_midfielder",
      "central_midfielder",
      "attacking_midfielder",
      "winger",
      "striker",
    ];
  }
  // Basketball (5)
  else if (sportId === 5) {
    return [
      "point_guard",
      "shooting_guard",
      "small_forward",
      "power_forward",
      "center",
    ];
  }
  // الرياضات اللي ملهاش أوزان أو مراكز زي الـ Running (3)
  return ["not_applicable"];
};

// 3. تحديد نوع التصنيف للرياضة عشان الفرونت يعرف يكتب العنوان (Weight Class ولا Position)
export const getCategoryType = (sportId: number): string => {
  if (sportId === 1 || sportId === 2) return "weight_class";
  if (sportId === 4 || sportId === 5) return "playing_position";
  return "none";
};
