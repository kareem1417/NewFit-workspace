import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seeding...");
  console.log("========================================");

  console.log("🧹 Cleaning up existing data...");
  await prisma.snapshot_test_values.deleteMany();
  await prisma.physical_snapshots.deleteMany();
  await prisma.user_sport_profiles.deleteMany();

  // 📌 2. مسح الإعدادات الأساسية للرياضات والاختبارات
  await prisma.attribute_tests.deleteMany();
  await prisma.sport_attributes.deleteMany();
  await prisma.sports.deleteMany();
  await prisma.age_groups.deleteMany();
  console.log("✅ Database cleaned");

  console.log("📊 Creating age groups...");
  await prisma.age_groups.createMany({
    data: [
      {
        id: 1,
        name: "Under 18",
        min_age: 12,
        max_age: 17,
        description: "Junior athletes under 18 years old",
      },
      {
        id: 2,
        name: "18-35",
        min_age: 18,
        max_age: 35,
        description: "Adult athletes in prime age range",
      },
      {
        id: 3,
        name: "35+",
        min_age: 36,
        max_age: 60,
        description: "Masters athletes over 35 years old",
      },
    ],
  });
  console.log("✅ Age groups created successfully");

  console.log("\n🏆 Creating sports...");
  const sportsData = [
    {
      name: "Boxing",
      description:
        "The sweet science of boxing - footwork, head movement, and punching power.",
      icon: "🥊",
      is_active: true,
    },
    {
      name: "Weightlifting",
      description:
        "Olympic weightlifting - snatch, clean and jerk, and strength training.",
      icon: "🏋️",
      is_active: true,
    },
    {
      name: "Running",
      description:
        "Track and field running - sprints, middle distance, and long distance.",
      icon: "🏃",
      is_active: true,
    },
    {
      name: "Football",
      description:
        "Association football - the beautiful game. Speed, endurance, and tactical awareness.",
      icon: "⚽",
      is_active: true,
    },
    {
      name: "Basketball",
      description: "Basketball - vertical leap, shooting, and court awareness.",
      icon: "🏀",
      is_active: true,
    },
  ];

  await prisma.sports.createMany({ data: sportsData });
  console.log(`✅ Created ${sportsData.length} sports`);

  const boxing = await prisma.sports.findFirst({ where: { name: "Boxing" } });
  const weightlifting = await prisma.sports.findFirst({
    where: { name: "Weightlifting" },
  });
  const running = await prisma.sports.findFirst({ where: { name: "Running" } });
  const football = await prisma.sports.findFirst({
    where: { name: "Football" },
  });
  const basketball = await prisma.sports.findFirst({
    where: { name: "Basketball" },
  });

  // ========================================
  // 🥊 Boxing (Physical Focus)
  // ========================================
  console.log("\n🥊 Creating Boxing attributes and tests...");
  await prisma.sport_attributes.createMany({
    data: [
      {
        sport_id: boxing!.id,
        name: "Foundation",
        display_order: 1,
        description: "Absolute strength base",
      },
      {
        sport_id: boxing!.id,
        name: "Explosive Power",
        display_order: 2,
        description: "Rate of force development",
      },
      {
        sport_id: boxing!.id,
        name: "Core Transfer",
        display_order: 3,
        description: "Core rotational power",
      },
      {
        sport_id: boxing!.id,
        name: "Anaerobic Endurance",
        display_order: 4,
        description: "High-intensity work capacity",
      },
    ],
  });
  const boxingAttrs = await prisma.sport_attributes.findMany({
    where: { sport_id: boxing!.id },
    orderBy: { display_order: "asc" },
  });
  await prisma.attribute_tests.createMany({
    data: [
      {
        sport_attribute_id: boxingAttrs[0].id,
        test_name: "Trap Bar Deadlift",
        weight: 0.5,
        unit: "kg",
        higher_is_better: true,
      },
      {
        sport_attribute_id: boxingAttrs[0].id,
        test_name: "Bench Press (1RM)",
        weight: 0.5,
        unit: "kg",
        higher_is_better: true,
      },
      {
        sport_attribute_id: boxingAttrs[1].id,
        test_name: "Medicine Ball Chest Pass",
        weight: 0.5,
        unit: "meters",
        higher_is_better: true,
      },
      {
        sport_attribute_id: boxingAttrs[1].id,
        test_name: "Box Jump Height",
        weight: 0.5,
        unit: "cm",
        higher_is_better: true,
      },
      {
        sport_attribute_id: boxingAttrs[2].id,
        test_name: "Rotational Med Ball Throw",
        weight: 1.0,
        unit: "meters",
        higher_is_better: true,
      },
      {
        sport_attribute_id: boxingAttrs[3].id,
        test_name: "3-Min Burpee Test",
        weight: 1.0,
        unit: "reps",
        higher_is_better: true,
      },
    ],
  });

  // ========================================
  // ⚽ Football (Soccer - Physical Focus)
  // ========================================
  console.log("\n⚽ Creating Football attributes and tests...");
  await prisma.sport_attributes.createMany({
    data: [
      {
        sport_id: football!.id,
        name: "Speed & Acceleration",
        display_order: 1,
      },
      { sport_id: football!.id, name: "Agility", display_order: 2 },
      { sport_id: football!.id, name: "Lower Body Power", display_order: 3 },
      { sport_id: football!.id, name: "Aerobic Capacity", display_order: 4 },
    ],
  });
  const footballAttrs = await prisma.sport_attributes.findMany({
    where: { sport_id: football!.id },
    orderBy: { display_order: "asc" },
  });
  await prisma.attribute_tests.createMany({
    data: [
      {
        sport_attribute_id: footballAttrs[0].id,
        test_name: "10m Sprint (Acceleration)",
        weight: 0.5,
        unit: "seconds",
        higher_is_better: false,
      },
      {
        sport_attribute_id: footballAttrs[0].id,
        test_name: "30m Sprint (Max Speed)",
        weight: 0.5,
        unit: "seconds",
        higher_is_better: false,
      },
      {
        sport_attribute_id: footballAttrs[1].id,
        test_name: "5-10-5 Pro Agility",
        weight: 1.0,
        unit: "seconds",
        higher_is_better: false,
      },
      {
        sport_attribute_id: footballAttrs[2].id,
        test_name: "Countermovement Jump (CMJ)",
        weight: 0.5,
        unit: "cm",
        higher_is_better: true,
      },
      {
        sport_attribute_id: footballAttrs[2].id,
        test_name: "Nordic Hamstring Curls (Max Reps)",
        weight: 0.5,
        unit: "reps",
        higher_is_better: true,
      },
      {
        sport_attribute_id: footballAttrs[3].id,
        test_name: "Yo-Yo Intermittent Recovery Level 1",
        weight: 1.0,
        unit: "meters",
        higher_is_better: true,
      },
    ],
  });

  // ========================================
  // 🏀 Basketball (Physical Focus)
  // ========================================
  console.log("\n🏀 Creating Basketball attributes and tests...");
  await prisma.sport_attributes.createMany({
    data: [
      { sport_id: basketball!.id, name: "Vertical Power", display_order: 1 },
      { sport_id: basketball!.id, name: "Lateral Quickness", display_order: 2 },
      { sport_id: basketball!.id, name: "Sprint Speed", display_order: 3 },
      {
        sport_id: basketball!.id,
        name: "Anaerobic Capacity",
        display_order: 4,
      },
    ],
  });
  const basketballAttrs = await prisma.sport_attributes.findMany({
    where: { sport_id: basketball!.id },
    orderBy: { display_order: "asc" },
  });
  await prisma.attribute_tests.createMany({
    data: [
      {
        sport_attribute_id: basketballAttrs[0].id,
        test_name: "Standing Vertical Jump",
        weight: 0.5,
        unit: "cm",
        higher_is_better: true,
      },
      {
        sport_attribute_id: basketballAttrs[0].id,
        test_name: "Max Approach Jump",
        weight: 0.5,
        unit: "cm",
        higher_is_better: true,
      },
      {
        sport_attribute_id: basketballAttrs[1].id,
        test_name: "Lane Agility Drill",
        weight: 1.0,
        unit: "seconds",
        higher_is_better: false,
      },
      {
        sport_attribute_id: basketballAttrs[2].id,
        test_name: "3/4 Court Sprint",
        weight: 1.0,
        unit: "seconds",
        higher_is_better: false,
      },
      {
        sport_attribute_id: basketballAttrs[3].id,
        test_name: "Suicide Run Drill",
        weight: 1.0,
        unit: "seconds",
        higher_is_better: false,
      },
    ],
  });

  // ========================================
  // 🏃 Running (Physical Focus)
  // ========================================
  console.log("\n🏃 Creating Running attributes and tests...");
  await prisma.sport_attributes.createMany({
    data: [
      { sport_id: running!.id, name: "Aerobic Capacity", display_order: 1 },
      { sport_id: running!.id, name: "Sprint Speed", display_order: 2 },
      { sport_id: running!.id, name: "Lower Body Power", display_order: 3 },
    ],
  });
  const runningAttrs = await prisma.sport_attributes.findMany({
    where: { sport_id: running!.id },
    orderBy: { display_order: "asc" },
  });
  await prisma.attribute_tests.createMany({
    data: [
      {
        sport_attribute_id: runningAttrs[0].id,
        test_name: "5K Time Trial",
        weight: 1.0,
        unit: "minutes",
        higher_is_better: false,
      },
      {
        sport_attribute_id: runningAttrs[1].id,
        test_name: "100m Sprint",
        weight: 1.0,
        unit: "seconds",
        higher_is_better: false,
      },
      {
        sport_attribute_id: runningAttrs[2].id,
        test_name: "Standing Broad Jump",
        weight: 1.0,
        unit: "meters",
        higher_is_better: true,
      },
    ],
  });

  // ========================================
  // 🏋️ Weightlifting (Physical Focus)
  // ========================================
  console.log("\n🏋️ Creating Weightlifting attributes and tests...");
  await prisma.sport_attributes.createMany({
    data: [
      {
        sport_id: weightlifting!.id,
        name: "Absolute Strength",
        display_order: 1,
      },
      {
        sport_id: weightlifting!.id,
        name: "Explosive Power",
        display_order: 2,
      },
    ],
  });
  const liftingAttrs = await prisma.sport_attributes.findMany({
    where: { sport_id: weightlifting!.id },
    orderBy: { display_order: "asc" },
  });
  await prisma.attribute_tests.createMany({
    data: [
      {
        sport_attribute_id: liftingAttrs[0].id,
        test_name: "Back Squat (1RM)",
        weight: 0.5,
        unit: "kg",
        higher_is_better: true,
      },
      {
        sport_attribute_id: liftingAttrs[0].id,
        test_name: "Deadlift (1RM)",
        weight: 0.5,
        unit: "kg",
        higher_is_better: true,
      },
      {
        sport_attribute_id: liftingAttrs[1].id,
        test_name: "Clean & Jerk (1RM)",
        weight: 1.0,
        unit: "kg",
        higher_is_better: true,
      },
    ],
  });

  console.log("\n========================================");
  console.log("📊 SEEDING COMPLETE!");
  console.log("========================================");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
