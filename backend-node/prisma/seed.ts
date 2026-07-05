import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seeding...');
  console.log('========================================');

  // ========================================
  // 0. تنظيف الداتابيز لتجنب مشاكل التكرار
  // ========================================
  console.log('🧹 Cleaning up existing data...');
  await prisma.attribute_tests.deleteMany();
  await prisma.sport_attributes.deleteMany();
  await prisma.sports.deleteMany();
  await prisma.age_groups.deleteMany();
  console.log('✅ Database cleaned');

  // ========================================
  // 1. إنشاء الـ Age Groups
  // ========================================
  console.log('📊 Creating age groups...');
  await prisma.age_groups.createMany({
    data: [
      { id: 1, name: 'Under 18', min_age: 12, max_age: 17, description: 'Junior athletes under 18 years old' },
      { id: 2, name: '18-35', min_age: 18, max_age: 35, description: 'Adult athletes in prime age range' },
      { id: 3, name: '35+', min_age: 36, max_age: 60, description: 'Masters athletes over 35 years old' },
    ],
  });
  console.log('✅ Age groups created successfully');

  // ========================================
  // 2. إنشاء الرياضات الأساسية
  // ========================================
  console.log('\n🏆 Creating sports...');
  const sportsData = [
    { name: 'Boxing', description: 'The sweet science of boxing - footwork, head movement, and punching power.', icon: '🥊', is_active: true },
    { name: 'Weightlifting', description: 'Olympic weightlifting - snatch, clean and jerk, and strength training.', icon: '🏋️', is_active: true },
    { name: 'Running', description: 'Track and field running - sprints, middle distance, and long distance.', icon: '🏃', is_active: true },
    { name: 'Football', description: 'Association football - the beautiful game. Speed, endurance, and tactical awareness.', icon: '⚽', is_active: true },
    { name: 'Basketball', description: 'Basketball - vertical leap, shooting, and court awareness.', icon: '🏀', is_active: true },
  ];

  await prisma.sports.createMany({ data: sportsData });
  console.log(`✅ Created ${sportsData.length} sports`);

  // ========================================
  // 3. جلب الـ ID بتاعة كل رياضة (استخدام findFirst بدل findUnique)
  // ========================================
  console.log('\n🔍 Fetching sport IDs...');
  const boxing = await prisma.sports.findFirst({ where: { name: 'Boxing' } });
  const weightlifting = await prisma.sports.findFirst({ where: { name: 'Weightlifting' } });
  const running = await prisma.sports.findFirst({ where: { name: 'Running' } });
  const football = await prisma.sports.findFirst({ where: { name: 'Football' } });
  const basketball = await prisma.sports.findFirst({ where: { name: 'Basketball' } });
  console.log('✅ All sports fetched');

  // ========================================
  // 4. 🥊 Boxing - Attributes & Tests
  // ========================================
  console.log('\n🥊 Creating Boxing attributes and tests...');
  await prisma.sport_attributes.createMany({
    data: [
      { sport_id: boxing!.id, name: 'Punching Power', display_order: 1, description: 'Maximum force generation in punches' },
      { sport_id: boxing!.id, name: 'Speed', display_order: 2, description: 'Hand speed and reaction time' },
      { sport_id: boxing!.id, name: 'Endurance', display_order: 3, description: 'Cardiovascular and muscular endurance' },
      { sport_id: boxing!.id, name: 'Agility', display_order: 4, description: 'Footwork and directional change speed' },
      { sport_id: boxing!.id, name: 'Defense', display_order: 5, description: 'Head movement and blocking efficiency' },
    ],
  });

  const boxingAttrsList = await prisma.sport_attributes.findMany({
    where: { sport_id: boxing!.id },
    orderBy: { display_order: 'asc' },
  });

  await prisma.attribute_tests.createMany({
    data: [
      { sport_attribute_id: boxingAttrsList[0].id, test_name: 'Trap Bar Deadlift', weight: 0.40, unit: 'kg', higher_is_better: true, description: 'Maximum trap bar deadlift for force production' },
      { sport_attribute_id: boxingAttrsList[0].id, test_name: 'Punch Force (Heavy Bag)', weight: 0.35, unit: 'kgf', higher_is_better: true, description: 'Maximum punching force measured on heavy bag' },
      { sport_attribute_id: boxingAttrsList[0].id, test_name: 'Medicine Ball Rotational Throw', weight: 0.25, unit: 'meters', higher_is_better: true, description: 'Maximum distance throwing medicine ball from chest' },
      { sport_attribute_id: boxingAttrsList[1].id, test_name: 'Hand Speed (10 seconds)', weight: 0.60, unit: 'punches', higher_is_better: true, description: 'Number of punches thrown in 10 seconds' },
      { sport_attribute_id: boxingAttrsList[1].id, test_name: 'Reaction Time (Drop Stick)', weight: 0.40, unit: 'cm', higher_is_better: false, description: 'Distance stick drops before catching (lower is better)' },
      { sport_attribute_id: boxingAttrsList[2].id, test_name: '1.5 Mile Run', weight: 0.50, unit: 'minutes', higher_is_better: false, description: 'Time to complete 1.5 mile run (lower is better)' },
      { sport_attribute_id: boxingAttrsList[2].id, test_name: 'Shadow Boxing (3 mins)', weight: 0.50, unit: 'bpm', higher_is_better: false, description: 'Heart rate recovery after 3 minutes shadow boxing' },
      { sport_attribute_id: boxingAttrsList[3].id, test_name: 'Lateral Cone Drill', weight: 0.60, unit: 'seconds', higher_is_better: false, description: 'Time to complete lateral agility drill (lower is better)' },
      { sport_attribute_id: boxingAttrsList[3].id, test_name: 'Box Jump', weight: 0.40, unit: 'cm', higher_is_better: true, description: 'Maximum vertical box jump height' },
      { sport_attribute_id: boxingAttrsList[4].id, test_name: 'Head Movement (Evasion)', weight: 0.50, unit: 'evades/min', higher_is_better: true, description: 'Number of successful evasions per minute' },
      { sport_attribute_id: boxingAttrsList[4].id, test_name: 'Blocking Accuracy', weight: 0.50, unit: '%', higher_is_better: true, description: 'Percentage of punches successfully blocked' },
    ],
  });

  // ========================================
  // 5. 🏋️ Weightlifting - Attributes & Tests
  // ========================================
  console.log('\n🏋️ Creating Weightlifting attributes and tests...');
  await prisma.sport_attributes.createMany({
    data: [
      { sport_id: weightlifting!.id, name: 'Max Strength', display_order: 1, description: 'Maximum force production' },
      { sport_id: weightlifting!.id, name: 'Power', display_order: 2, description: 'Explosive strength and speed' },
      { sport_id: weightlifting!.id, name: 'Technique', display_order: 3, description: 'Form and movement efficiency' },
      { sport_id: weightlifting!.id, name: 'Flexibility', display_order: 4, description: 'Range of motion for lifting' },
      { sport_id: weightlifting!.id, name: 'Stability', display_order: 5, description: 'Core and joint stability' },
    ],
  });

  const weightliftingAttrsList = await prisma.sport_attributes.findMany({
    where: { sport_id: weightlifting!.id },
    orderBy: { display_order: 'asc' },
  });

  await prisma.attribute_tests.createMany({
    data: [
      { sport_attribute_id: weightliftingAttrsList[0].id, test_name: '1RM Squat', weight: 0.35, unit: 'kg', higher_is_better: true, description: 'Maximum one-rep max squat' },
      { sport_attribute_id: weightliftingAttrsList[0].id, test_name: '1RM Bench Press', weight: 0.30, unit: 'kg', higher_is_better: true, description: 'Maximum one-rep max bench press' },
      { sport_attribute_id: weightliftingAttrsList[0].id, test_name: '1RM Deadlift', weight: 0.35, unit: 'kg', higher_is_better: true, description: 'Maximum one-rep max deadlift' },
      { sport_attribute_id: weightliftingAttrsList[1].id, test_name: 'Power Clean', weight: 0.45, unit: 'kg', higher_is_better: true, description: 'Maximum power clean' },
      { sport_attribute_id: weightliftingAttrsList[1].id, test_name: 'Box Jump Height', weight: 0.30, unit: 'cm', higher_is_better: true, description: 'Maximum vertical box jump' },
      { sport_attribute_id: weightliftingAttrsList[1].id, test_name: 'Squat Jump Power', weight: 0.25, unit: 'Watts', higher_is_better: true, description: 'Power output during squat jump' },
      { sport_attribute_id: weightliftingAttrsList[2].id, test_name: 'Snatch Technique Score', weight: 0.40, unit: 'score', higher_is_better: true, description: 'Judged technique score for snatch (1-10)' },
      { sport_attribute_id: weightliftingAttrsList[2].id, test_name: 'Clean Technique Score', weight: 0.40, unit: 'score', higher_is_better: true, description: 'Judged technique score for clean (1-10)' },
      { sport_attribute_id: weightliftingAttrsList[2].id, test_name: 'Mobility Score', weight: 0.20, unit: 'score', higher_is_better: true, description: 'Overall mobility and flexibility score (1-10)' },
      { sport_attribute_id: weightliftingAttrsList[3].id, test_name: 'Sit and Reach', weight: 0.40, unit: 'cm', higher_is_better: true, description: 'Sit and reach flexibility test' },
      { sport_attribute_id: weightliftingAttrsList[3].id, test_name: 'Shoulder Rotation (Overhead)', weight: 0.35, unit: 'degrees', higher_is_better: true, description: 'Shoulder external rotation range' },
      { sport_attribute_id: weightliftingAttrsList[3].id, test_name: 'Hip Flexor Flexibility', weight: 0.25, unit: 'degrees', higher_is_better: true, description: 'Hip flexor flexibility range' },
      { sport_attribute_id: weightliftingAttrsList[4].id, test_name: 'Plank Hold', weight: 0.35, unit: 'seconds', higher_is_better: true, description: 'Maximum plank hold time' },
      { sport_attribute_id: weightliftingAttrsList[4].id, test_name: 'Single Leg Balance', weight: 0.30, unit: 'seconds', higher_is_better: true, description: 'Maximum single leg balance time' },
      { sport_attribute_id: weightliftingAttrsList[4].id, test_name: 'Core Stability (Side Plank)', weight: 0.35, unit: 'seconds', higher_is_better: true, description: 'Maximum side plank hold time each side' },
    ],
  });

  // ========================================
  // 6. 🏃 Running - Attributes & Tests
  // ========================================
  console.log('\n🏃 Creating Running attributes and tests...');
  await prisma.sport_attributes.createMany({
    data: [
      { sport_id: running!.id, name: 'Speed', display_order: 1, description: 'Maximum sprint velocity' },
      { sport_id: running!.id, name: 'Endurance', display_order: 2, description: 'Aerobic capacity and stamina' },
      { sport_id: running!.id, name: 'Stride Efficiency', display_order: 3, description: 'Running economy and form' },
      { sport_id: running!.id, name: 'Recovery', display_order: 4, description: 'Heart rate recovery rate' },
    ],
  });

  const runningAttrsList = await prisma.sport_attributes.findMany({
    where: { sport_id: running!.id },
    orderBy: { display_order: 'asc' },
  });

  await prisma.attribute_tests.createMany({
    data: [
      { sport_attribute_id: runningAttrsList[0].id, test_name: '40m Sprint', weight: 0.50, unit: 'seconds', higher_is_better: false, description: 'Time to complete 40m sprint (lower is better)' },
      { sport_attribute_id: runningAttrsList[0].id, test_name: 'Flying 30m', weight: 0.30, unit: 'seconds', higher_is_better: false, description: 'Flying 30m sprint time (lower is better)' },
      { sport_attribute_id: runningAttrsList[0].id, test_name: 'Step Frequency', weight: 0.20, unit: 'steps/sec', higher_is_better: true, description: 'Step frequency during sprint' },
      { sport_attribute_id: runningAttrsList[1].id, test_name: 'VO2 Max (Beep Test)', weight: 0.40, unit: 'ml/kg/min', higher_is_better: true, description: 'Estimated VO2 max from beep test' },
      { sport_attribute_id: runningAttrsList[1].id, test_name: '5km Run Time', weight: 0.35, unit: 'minutes', higher_is_better: false, description: 'Time to complete 5km run (lower is better)' },
      { sport_attribute_id: runningAttrsList[1].id, test_name: 'Heart Rate Recovery (1 min)', weight: 0.25, unit: 'bpm', higher_is_better: false, description: 'Heart rate drop after 1 minute rest (lower is better recovery)' },
      { sport_attribute_id: runningAttrsList[2].id, test_name: 'Stride Length', weight: 0.40, unit: 'meters', higher_is_better: true, description: 'Average stride length' },
      { sport_attribute_id: runningAttrsList[2].id, test_name: 'Cadence (SPM)', weight: 0.35, unit: 'steps/min', higher_is_better: true, description: 'Steps per minute during running' },
      { sport_attribute_id: runningAttrsList[2].id, test_name: 'Ground Contact Time', weight: 0.25, unit: 'ms', higher_is_better: false, description: 'Ground contact time during running (lower is better)' },
      { sport_attribute_id: runningAttrsList[3].id, test_name: 'HRV (Heart Rate Variability)', weight: 0.40, unit: 'ms', higher_is_better: true, description: 'Heart rate variability measure' },
      { sport_attribute_id: runningAttrsList[3].id, test_name: 'Recovery Heart Rate (2 min)', weight: 0.35, unit: 'bpm', higher_is_better: false, description: 'Heart rate after 2 minutes rest from max effort' },
      { sport_attribute_id: runningAttrsList[3].id, test_name: 'Sleep Quality Score', weight: 0.25, unit: 'score', higher_is_better: true, description: 'Subjective sleep quality score (1-10)' },
    ],
  });

  // ========================================
  // 7. ⚽ Football - Attributes & Tests
  // ========================================
  console.log('\n⚽ Creating Football attributes and tests...');
  await prisma.sport_attributes.createMany({
    data: [
      { sport_id: football!.id, name: 'Speed & Agility', display_order: 1, description: 'Sprint speed and change of direction' },
      { sport_id: football!.id, name: 'Endurance', display_order: 2, description: 'Cardiovascular and match endurance' },
      { sport_id: football!.id, name: 'Technical Skills', display_order: 3, description: 'Dribbling, passing, and shooting' },
      { sport_id: football!.id, name: 'Strength & Power', display_order: 4, description: 'Upper and lower body strength for duels' },
      { sport_id: football!.id, name: 'Tactical IQ', display_order: 5, description: 'Game awareness and decision making' },
    ],
  });

  const footballAttrsList = await prisma.sport_attributes.findMany({
    where: { sport_id: football!.id },
    orderBy: { display_order: 'asc' },
  });

  await prisma.attribute_tests.createMany({
    data: [
      { sport_attribute_id: footballAttrsList[0].id, test_name: '40m Sprint', weight: 0.35, unit: 'seconds', higher_is_better: false, description: 'Sprint speed over 40 meters' },
      { sport_attribute_id: footballAttrsList[0].id, test_name: 'Agility T-Test', weight: 0.35, unit: 'seconds', higher_is_better: false, description: 'Agility and change of direction ability' },
      { sport_attribute_id: footballAttrsList[0].id, test_name: 'Illinois Agility Test', weight: 0.30, unit: 'seconds', higher_is_better: false, description: 'Combined agility and speed test' },
      { sport_attribute_id: footballAttrsList[1].id, test_name: 'Yo-Yo Intermittent Recovery Test', weight: 0.45, unit: 'meters', higher_is_better: true, description: 'Intermittent endurance capacity' },
      { sport_attribute_id: footballAttrsList[1].id, test_name: '1.6km Run Time', weight: 0.35, unit: 'minutes', higher_is_better: false, description: 'Continuous running endurance' },
      { sport_attribute_id: footballAttrsList[1].id, test_name: 'Heart Rate Recovery', weight: 0.20, unit: 'bpm', higher_is_better: false, description: 'Heart rate drop after 1 minute rest' },
      { sport_attribute_id: footballAttrsList[2].id, test_name: 'Dribbling Speed Test', weight: 0.35, unit: 'seconds', higher_is_better: false, description: 'Speed while dribbling through cones' },
      { sport_attribute_id: footballAttrsList[2].id, test_name: 'Passing Accuracy (Loughborough)', weight: 0.35, unit: 'score', higher_is_better: true, description: 'Passing accuracy under pressure (1-10)' },
      { sport_attribute_id: footballAttrsList[2].id, test_name: 'Shooting Power & Accuracy', weight: 0.30, unit: 'score', higher_is_better: true, description: 'Shooting power and accuracy score (1-10)' },
      { sport_attribute_id: footballAttrsList[3].id, test_name: 'Countermovement Jump', weight: 0.35, unit: 'cm', higher_is_better: true, description: 'Explosive lower body power' },
      { sport_attribute_id: footballAttrsList[3].id, test_name: 'Isometric Squat Strength', weight: 0.35, unit: 'N', higher_is_better: true, description: 'Maximum isometric squat force' },
      { sport_attribute_id: footballAttrsList[3].id, test_name: 'Upper Body Strength (Push-ups)', weight: 0.30, unit: 'reps', higher_is_better: true, description: 'Maximum push-ups in 60 seconds' },
      { sport_attribute_id: footballAttrsList[4].id, test_name: 'Decision Making Score', weight: 0.40, unit: 'score', higher_is_better: true, description: 'Decision making under pressure (1-10)' },
      { sport_attribute_id: footballAttrsList[4].id, test_name: 'Positioning Awareness', weight: 0.35, unit: 'score', higher_is_better: true, description: 'Positional awareness and reading the game (1-10)' },
      { sport_attribute_id: footballAttrsList[4].id, test_name: 'Tactical Knowledge Quiz', weight: 0.25, unit: 'score', higher_is_better: true, description: 'Understanding of formations and strategies (1-10)' },
    ],
  });

  // ========================================
  // 8. 🏀 Basketball - Attributes & Tests
  // ========================================
  console.log('\n🏀 Creating Basketball attributes and tests...');
  await prisma.sport_attributes.createMany({
    data: [
      { sport_id: basketball!.id, name: 'Vertical Power', display_order: 1, description: 'Jumping ability and explosiveness' },
      { sport_id: basketball!.id, name: 'Speed & Agility', display_order: 2, description: 'Court speed and lateral quickness' },
      { sport_id: basketball!.id, name: 'Shooting Accuracy', display_order: 3, description: 'Shooting percentage and range' },
      { sport_id: basketball!.id, name: 'Endurance', display_order: 4, description: 'Game endurance and recovery' },
      { sport_id: basketball!.id, name: 'Basketball IQ', display_order: 5, description: 'Court vision and decision making' },
    ],
  });

  const basketballAttrsList = await prisma.sport_attributes.findMany({
    where: { sport_id: basketball!.id },
    orderBy: { display_order: 'asc' },
  });

  await prisma.attribute_tests.createMany({
    data: [
      { sport_attribute_id: basketballAttrsList[0].id, test_name: 'Max Vertical Jump', weight: 0.40, unit: 'cm', higher_is_better: true, description: 'Maximum standing vertical jump height' },
      { sport_attribute_id: basketballAttrsList[0].id, test_name: 'Reactive Strength Index', weight: 0.30, unit: 'ms', higher_is_better: true, description: 'Reactive strength and plyometric ability' },
      { sport_attribute_id: basketballAttrsList[0].id, test_name: 'Broad Jump', weight: 0.30, unit: 'cm', higher_is_better: true, description: 'Standing broad jump distance' },
      { sport_attribute_id: basketballAttrsList[1].id, test_name: '3/4 Court Sprint', weight: 0.35, unit: 'seconds', higher_is_better: false, description: 'Sprint speed over 3/4 court' },
      { sport_attribute_id: basketballAttrsList[1].id, test_name: 'Lateral Agility Drill', weight: 0.35, unit: 'seconds', higher_is_better: false, description: 'Lateral movement and defensive slide speed' },
      { sport_attribute_id: basketballAttrsList[1].id, test_name: 'Agility T-Test', weight: 0.30, unit: 'seconds', higher_is_better: false, description: 'Overall agility and change of direction' },
      { sport_attribute_id: basketballAttrsList[2].id, test_name: 'Free Throw Percentage', weight: 0.35, unit: '%', higher_is_better: true, description: 'Free throw shooting accuracy' },
      { sport_attribute_id: basketballAttrsList[2].id, test_name: '3-Point Shooting Percentage', weight: 0.35, unit: '%', higher_is_better: true, description: '3-point shot accuracy' },
      { sport_attribute_id: basketballAttrsList[2].id, test_name: 'Mid-Range Shooting Percentage', weight: 0.30, unit: '%', higher_is_better: true, description: 'Mid-range jump shot accuracy' },
      { sport_attribute_id: basketballAttrsList[3].id, test_name: 'Yo-Yo Intermittent Test (Basketball)', weight: 0.40, unit: 'meters', higher_is_better: true, description: 'Basketball-specific intermittent endurance' },
      { sport_attribute_id: basketballAttrsList[3].id, test_name: '1.6km Run Time', weight: 0.35, unit: 'minutes', higher_is_better: false, description: 'Continuous running endurance' },
      { sport_attribute_id: basketballAttrsList[3].id, test_name: 'Heart Rate Recovery (2 min)', weight: 0.25, unit: 'bpm', higher_is_better: false, description: 'Heart rate drop after 2 minutes rest' },
      { sport_attribute_id: basketballAttrsList[4].id, test_name: 'Court Vision Test', weight: 0.35, unit: 'score', higher_is_better: true, description: 'Ability to read defenses and find passes (1-10)' },
      { sport_attribute_id: basketballAttrsList[4].id, test_name: 'Decision Making Score', weight: 0.35, unit: 'score', higher_is_better: true, description: 'Game situation decision making (1-10)' },
      { sport_attribute_id: basketballAttrsList[4].id, test_name: 'Defensive Awareness', weight: 0.30, unit: 'score', higher_is_better: true, description: 'Defensive positioning and awareness (1-10)' },
    ],
  });

  // ========================================
  // 9. 📊 إحصائيات نهائية
  // ========================================
  console.log('\n========================================');
  console.log('📊 SEEDING COMPLETE!');
  console.log('========================================');
  console.log('🌱 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });